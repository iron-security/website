import { getAssetFromKV } from '@cloudflare/kv-asset-handler'

addEventListener('fetch', event => {
  try {
    return event.respondWith(handleRequest(event));
  } catch (e) {
    console.error(e);
    event.respondWith(new Response('Internal Error', { status: 500 }))
  }
})

async function handleRequest(event)
{
  // create an URL object so we can extract the URI
  const url = new URL(event.request.url);

  // if this is an API call to contact, do it there
  if (event.request.method === 'POST' && url.pathname === '/api/contact/')
  {
    return handleContactRequest(event);
  }

  // set caching options for static assets
  let options = { cacheControl: {
    edgeTTL: 60 * 60 * 24,
    browserTTL: 60 * 60 * 24,
    bypassCache: (ENVIRONMENT === 'dev'),
  }};

  // retrieve static asset from KV
  let page = null;
  try {
    page = await getAssetFromKV(event, options);
  } catch (e) {
    console.log('failed to fetch KV ' + event.request.path + ' : ' + e);
    return new Response('404 Not Found', { status: 404 });
  }

  // allow headers to be altered
  const response = new Response(page.body, page);

  // set security headers
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin");
  response.headers.set("Permissions-Policy", "none");

  // only set a secure CSP paramater if we are running over HTTPS, not locally
  if (ENVIRONMENT === 'prd') {
    response.headers.set("Content-Security-Policy", CSP_POLICY + " upgrade-insecure-requests; block-all-mixed-content");
  } else {
    response.headers.set("Content-Security-Policy", CSP_POLICY);
  }
  
  // set the CORS header to the Host request header
  // this is secure since we explicitly define worker routes in the wranger.toml
  response.headers.set("Access-Control-Allow-Origin", "https://" + event.request.headers.get('host'));

  return response;
}

async function handleContactRequest(event)
{
  // parse the request json body
  const body = await event.request.json();
  
  // already reject if input is empty
  if (body.email === '' || body.subject === '' || body.message === '' || body.captcha_token === '') {
    return new Response('400 Bad Request', { status: 400 });
  }

  // detect overly big email messages
  if (body.message.length > MAX_MESSAGE_LENGTH) {
    return new Response('400 Bad Request', { status: 400 });
  }

  // quick'n easy spam detection
  if (body.crf !== '') {
    console.log('SPAM detected! crf field filled in.');
    return new Response('400 Bad Request', { status: 400 });
  }

  // request the captcha challenge
  const captchaParameters = {
    secret: CAPTCHA_PRIVATEKEY,
    response: body.captcha_token,
    remoteip: event.request.headers.get('CF-Connecting-IP'),
  };

  let result = await fetch(CAPTCHA_VERIFY_URL + '?' + new URLSearchParams(captchaParameters));

  if (! result.ok) {
    console.log(result.status + ' ' + result.statusText);
    return new Response('400 Bad Request', { status: 400 });
  }

  const captchaResult = await result.json();

  // verify the captcha result
  if (true !== captchaResult.success) {
    console.error('invalid captcha result: ' + captchaResult);
    return new Response('400 Bad Request', { status: 400 });
  }

  // verify the captcha reliability
  if (captchaParameters.score < CAPTCHA_MIN_SCORE) {
    console.error('too low captcha score: ' + captchaParameters.score);
    return new Response('400 Bad Request', { status: 400 });
  }

  // request is deemed a success! so try submit the email for sending
  const mgResult = await fetch('https://api.mailgun.net/v3/' + MAILGUN_DOMAIN + '/messages', {
    method: 'post',
    timeout: 10000,
    headers: {
      'Authorization': 'Basic ' + Buffer.from('api:' + MAILGUN_APIKEY).toString('base64'),
    },
    body: new URLSearchParams({
      from: 'Website Contact <website@' + MAILGUN_DOMAIN + '>',
      to: EMAIL_TO,
      subject: 'Contact Form: ' + body.subject,
      text: body.email + '\n' + body.message,
    }),
  });

  if (! mgResult.ok) {
    const mgResponse = await mgResult.json();
    console.log('mailgun call failed: ' + mgResult.status + ' ' + mgResult.statusText + ' -> ' + mgResponse.message);
    return new Response('500 Server Error', { status: 500 });
  }

  // email was sent!
  console.log("successfully sent contact form email for " + body.email + " titled " + body.subject);

  // let the browser know it was a success
  return new Response('200 OK', { status: 200 });
}