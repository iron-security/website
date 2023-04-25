import { getAssetFromKV } from '@cloudflare/kv-asset-handler'
import { handleContactRequest } from './contact.js';
import { handleQuoteRequest } from './quote.js';

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

  // if this is an API call to send a quote, do it here
  if (event.request.method === 'POST' && url.pathname === '/api/quote/send/')
  {
    return handleQuoteRequest(event);
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
