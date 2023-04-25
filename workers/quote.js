import { Buffer } from 'buffer';
import { jsPDF } from 'jspdf';
import { SignBytes } from './sign';

// Ensure globals are available when jsPDF is required
const window = { document: { createElementNS: () => { return {} } } }
const navigator = {}

export async function handleQuoteRequest(event)
{
    // parse the request json body
    const body = await event.request.json();
  
    // already reject if input is empty
    if (body.captcha_token === '') {
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

    // fetch the reCaptchav3 result from google
    let result = await fetch(CAPTCHA_VERIFY_URL + '?' + new URLSearchParams(captchaParameters));

    // if we didn't get a response, error out
    if (! result.ok) {
      console.log(result.status + ' ' + result.statusText);
      return new Response('400 Bad Request', { status: 400 });
    }

    // decode the json response
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

    // check if the quote is valid
    if (! validateQuote(body.quote)) {
        console.log('quote failed validation');
        return new Response('400 Bad Request', { status: 400 });
    }

    // check if the company details are valid
    if (! validateDetails(body.details)) {
        console.log('details failed validation');
        return new Response('400 Bad Request', { status: 400 });
    }

    // -- looks good

    // generate quote PDF
    const pdfBytes = generatePDF(body);
    if (! pdfBytes || pdfBytes.length == 0) {
        console.log('pdf generation failed');
        return new Response('400 Bad Request', { status: 400 });
    }

    // generate quote PDF crypto signature
    const pdfSignature = await SignBytes(SIGNSECRET, pdfBytes);
    if (! pdfSignature || pdfSignature.length == 0) {
        console.log('pdf signature failed');
        return new Response('400 Bad Request', { status: 400 });
    }

    // send quote via email
    const formData = new FormData();
    formData.append('from', 'IRON Quote System <hello@' + MAILGUN_DOMAIN + '>');
    formData.append('to', body.details.email);
    formData.append('subject', 'IRON quote requested from the website');
    formData.append('text', 
        'Dear ' + body.details.contact_name + ',\n\n' +
        'Thank you for using IRON to look at CrowdStrike licenses.\n' +
        'Your generated quote has been attached to this email. Please sign it and reply back if agreed.\n' +
        'Your invoice signature to mention is: ' + pdfSignature + '\n\n' +
        'Best regards,\nThe IRON team.\n\n\n\n',
    );
    formData.append('attachment', new Blob([Buffer.from(pdfBytes)], { type: 'application/pdf' }), 'iron-quote.pdf'),
    formData.append('h:Reply-To', EMAIL_TO);

    const mgResult = await fetch('https://api.mailgun.net/v3/' + MAILGUN_DOMAIN + '/messages', {
        method: 'post',
        timeout: 10000,
        headers: {
            'Authorization': 'Basic ' + Buffer.from('api:' + MAILGUN_APIKEY).toString('base64'),
        },
        body: formData,
    });

    // return error if we couldn't send the email
    if (! mgResult.ok) {
        const mgResponse = await mgResult.json();
        console.log('mailgun call failed: ' + mgResult.status + ' ' + mgResult.statusText + ' -> ' + mgResponse.message);
        return new Response('500 Server Error', { status: 500 });
    }

    // email was sent!
    console.log("successfully sent quote email to " + body.details.email);

    // let the browser know it was a success
    return new Response('200 OK', { status: 200 });
}

async function validateQuote(data)
{
    if (typeof data.number_edr !== 'number' || data.number_edr < 0) {
        return false;
    }

    if (typeof data.has_removables !== 'boolean') {
        return false;
    }

    if (typeof data.has_firewall !== 'boolean') {
        return false;
    } 

    if (typeof data.has_asset !== 'boolean') {
        return false;
    }

    if (typeof data.has_vulnerability !== 'boolean') {
        return false;
    }

    if (typeof data.has_siem !== 'boolean') {
        return false;
    }

    if (typeof data.has_intel !== 'boolean') {
        return false;
    }

    if (typeof data.number_mobile !== 'number' || data.number_mobile < 0) {
        return false;
    }

    if (typeof data.number_cloud !== 'number' || data.number_cloud < 0) {
        return false;
    }

    return true;
}

async function validateEmail(email)
{
  return email.match(
    /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  );
};

async function validateDetails(data)
{
    if (typeof data.contact_name !== 'string' || data.contact_name.length < 3) {
        return false;
    }

    if (typeof data.email !== 'string' || !validateEmail(data.email)) {
        return false;
    }

    if (typeof data.company_name !== 'string' || data.company_name.length < 3) {
        return false;
    }

    if (typeof data.company_address !== 'string' || data.company_address.length < 3) {
        return false;
    }

    if (typeof data.company_country !== 'string' || data.company_country.length < 3) {
        return false;
    }

    if (typeof data.company_vat !== 'string' || data.company_vat.length < 3) {
        return false;
    }

    if (data.cid !== '') {
        if (typeof data.cid !== 'string' || data.cid.length < 10) {
            return false;
        }
    }

    return true;
}

function generatePDF(request)
{
    const doc = new jsPDF({
        orientation: 'p',
        format: 'a4'
    });

    const pageWidth = doc.internal.pageSize.width;

    const now = new Date();
    const dateToday = (now.getDate() + '/' + now.getMonth() + 1) + '/' + now.getFullYear();

    const docText = (x, y, text) => {
        if (x > 0) return doc.text(x, y, text)
        return doc.text(pageWidth + x, y, text, null, null, 'right')
    }

    const getLines = (text, start, end) => text.replace(/\\n/g, '\n').split('\n').slice(start, end)

    // the quote identifier is just based on the timestamp
    let quoteNumber = now.getDate() + '' +  (now.getMonth() + 1) + '' + + now.getFullYear() + '' + now.getSeconds();

    doc.setFont('helvetica');
    doc.setFont(undefined, 'bold');
    doc.setFontSize(14);
    docText(20, 24,
        'ironPeak services GCV\n' +
        'De Croixlaan 26, 1910 Berg, Belgium\n' +
        'VAT BE0694785660\n' +
        'BANK BE76068909740795\n' +
        'hello@iron.security',
    );
    docText(-60, 24, 'Quote #' + quoteNumber);

    doc.setFont(undefined, 'normal');
    doc.setFontSize(10)
    doc.setLineHeightFactor(1.3)
    docText(20, 30, getLines('hello@iron.security', 1))
    docText(-60, 30, dateToday)

    docText(20, 60, getLines(
        'Customer name: ' + request.details.contact_name + '\n' +
        'Company: ' + request.details.company_name + '\n' +
        'Address: ' + request.details.company_address + '\n' +
        'Country: ' + request.details.company_country + '\n' +
        'VAT: ' + request.details.company_vat
    , 0))

    doc.setFont(undefined, 'bold')
    docText(20, 98, 'Description')
    doc.text(pageWidth - 40, 98, 'Amount', null, null, 'right')

    // --- calculate goods

    doc.setLineWidth(.333)
    doc.line(20, 102, pageWidth - 20, 102)

    let itemY = 108;
    let totalCost = 0;

    if (request.quote.number_edr > 0)
    {
        let itemCost = 45 * request.quote.number_edr;

        doc.setFont(undefined, 'normal');
        docText(20, itemY, ('x' + request.quote.number_edr).padEnd(15) + ' Endpoint Detection & Response (incl. Threat Hunting)');
        docText(-40, itemY, '€ ' + itemCost);

        itemY += 5;
        totalCost += itemCost;
    }

    if (request.quote.number_edr > 0 && request.quote.has_removables === true)
    {
        let itemCost = 3 * request.quote.number_edr;

        doc.setFont(undefined, 'normal');
        docText(20, itemY, ('x' + request.quote.number_edr).padEnd(15) + ' Endpoint removable device management');
        docText(-40, itemY, '€ ' + itemCost);

        itemY += 5;
        totalCost += itemCost;
    }

    if (request.quote.number_edr > 0 && request.quote.has_firewall === true)
    {
        let itemCost = 4 * request.quote.number_edr;

        doc.setFont(undefined, 'normal');
        docText(20, itemY, ('x' + request.quote.number_edr).padEnd(15) + ' Endpoint firewall management');
        docText(-40, itemY, '€ ' + itemCost);

        itemY += 5;
        totalCost += itemCost;
    }

    if (request.quote.number_edr > 0 && request.quote.has_asset === true)
    {
        let itemCost = 9 * request.quote.number_edr;

        doc.setFont(undefined, 'normal');
        docText(20, itemY, ('x' + request.quote.number_edr).padEnd(15) + ' Endpoint asset management');
        docText(-40, itemY, '€ ' + itemCost);

        itemY += 5;
        totalCost += itemCost;
    }

    if (request.quote.number_edr > 0 && request.quote.has_siem === true)
    {
        let itemCost = 4 * request.quote.number_edr;

        doc.setFont(undefined, 'normal');
        docText(20, itemY, ('x' + request.quote.number_edr).padEnd(15) + ' SIEM data replicator');
        docText(-40, itemY, '€ ' + itemCost);

        itemY += 5;
        totalCost += itemCost;
    }

    if (request.quote.number_edr > 0 && request.quote.has_intel === true)
    {
        let itemCost = 17 * request.quote.number_edr;

        doc.setFont(undefined, 'normal');
        docText(20, itemY, ('x' + request.quote.number_edr).padEnd(15) + ' Endpoint intelligence enrichment');
        docText(-40, itemY, '€ ' + itemCost);

        itemY += 5;
        totalCost += itemCost;
    }

    if (request.quote.number_mobile > 0)
    {
        let itemCost = 30 * request.quote.number_mobile;

        doc.setFont(undefined, 'normal');
        docText(20, itemY, ('x' + request.quote.number_mobile).padEnd(15) + ' Mobile Endpoint Protection');
        docText(-40, itemY, '€ ' + itemCost);

        itemY += 5;
        totalCost += itemCost;
    }

    if (request.quote.number_cloud > 0)
    {
        let itemCost = 80 * request.quote.number_cloud;

        doc.setFont(undefined, 'normal');
        docText(20, itemY, ('x' + request.quote.number_cloud).padEnd(15) + ' Cloud Workload Protection');
        docText(-40, itemY, '€ ' + itemCost);

        itemY += 5;
        totalCost += itemCost;
    }

    // support fee
    {
        let itemCost = totalCost * 0.12;

        doc.setFont(undefined, 'normal');
        docText(20, itemY, 'x1'.toFixed(2).padEnd(15) + ' Support fee (12%)');
        docText(-40, itemY, '€ ' + itemCost);

        itemY += 5;
        totalCost += itemCost;
    }
    
    // spacing between totals and table
    itemY += 10;

    const formatTotal = (amount) => {
        let str = (amount + '').replace(/[^0-9\.\,]/g, '')
        let num = parseFloat(str, 10)
        if (Math.floor(num) === num) return num + ''
        return num.toFixed(2)
    }

    const totalAmount = formatTotal(totalCost);
    doc.setFont(undefined, 'bold');
    docText(-66 , itemY + 5, 'Total (ex. VAT) € ' + totalAmount);

    /*
    // We are not including VAT to keep things simple, e.g. non-EU does not need to pay VAT
    const vatCost = (0.21 * totalCost);
    const vatAmount = '€ ' + vatCost.toFixed(2).padStart(10);
    doc.setFont(undefined, 'bold');
    docText(-66, itemY + 10, 'VAT                   ' + vatAmount);

    const grandTotal = (totalCost + vatCost).toFixed(2).padStart(10);
    doc.setFont(undefined, 'bold');
    docText(-66, itemY + 15, 'Total                 € ' + grandTotal);
    */

    doc.setFont(undefined, 'normal');
    let nextweek = new Date(now.getFullYear(), now.getMonth(), now.getDate()+7);
    let nextWeekDate = nextweek.getDate() + '/' + nextweek.getMonth() + '/' + nextweek.getFullYear();
    docText(20, itemY + 30,
        "\n\nThis quote will be valid until " + nextWeekDate + " for 1-year subscription licenses with EU data residency (if applicable).\n" +
        "Terms & Conditions apply from https://docs.iron.security/company/terms-conditions/\n" +
        "An invoice to pay will be delivered once this quote has been signed.\n\n" +
        "If agreed, please sign below:",
    );

    // --

    console.log('generated quote for a total of ' + totalAmount + ' for ' + request.details.email);
    return doc.output('arraybuffer');
}