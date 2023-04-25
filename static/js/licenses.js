let alertError = $('#altError');
let alertMessage = $('#lblError');
let alertSuccess = $('#altSuccess');

let btnQuote = $('#btnGetQuote');

let inName = $('#inName');
let inEmail = $('#inEmail');
let inCompanyName = $('#inCompany');
let inCompanyaddress = $('#inComAddr');
let inCompanyCoutnry = $('#inComCountry');
let inCompanyVAT = $('#inComVAT');
let inCID = $('#inCID');

let inEDR = $('#inEDR');
let chkRemov = $('#chkRemovable');
let chkFirewall = $('#chkFirewall');
let chkAsset = $('#chkAsset');
let chkVuln = $('#chkVuln');
let chkSIEM = $('#chkSIEM');
let chkIntel = $('#chkIntel');
let inMobile = $('#numMobile');
let inCloud = $('#numCloud');

let inCRF = $('#license_crf');

let tblQuote = $('#tblQuote');
let lblEDR = $('#lblEndpoints');
let lblRemov = $('#lblRemov');
let lblFirewall = $('#lblFirewall');
let lblAsset = $('#lblAsset');
let lblVuln = $('#lblVuln');
let lblSIEM = $('#lblSIEM');
let lblIntel = $('#lblIntel');
let lblMobile = $('#lblMobile');
let lblCloud = $('#lblCloud'); 
let lblSupport = $('#lblSupport');
let lblTotal = $('#lblTotal');

function invalidQuoteError(errorMessage)
{
    console.log('license form failed validation: ' + errorMessage);

    alertError.removeClass('d-none');
    alertMessage.text(errorMessage);
}

function validateEmail(email)
{
  return email.match(
    /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  );
};

function isNumeric(str) {
    if (typeof str != "string") return false // we only process strings!  
    return !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
           !isNaN(parseFloat(str)) // ...and ensure strings of whitespace fail
  }

function validateForm()
{
    let numEDR = inEDR.val();
    if (! isNumeric(numEDR) || numEDR < 0) {
        invalidQuoteError('The amount of EDR licenses should be a number.');
        return false;
    }

    let numMobile = inMobile.val();
    if (! isNumeric(numMobile) || numMobile < 0) {
        invalidQuoteError('The amount of Mobile licenses should be a number.');
        return false;
    }

    let numCloud = inCloud.val();
    if (! isNumeric(numCloud) || numCloud < 0) {
        invalidQuoteError('The amount of Cloud licenses should be a number.');
        return false;
    }

    // ---

    let fullName = inName.val();
    if (fullName.length < 3) {
        invalidQuoteError('A correct full name must be provided.');
        return false;
    }

    let email = inEmail.val();
    if (! validateEmail(email)) {
        invalidQuoteError('A valid email address must be provided.');
        return false;
    }

    let companyName = inCompanyName.val();
    if (companyName.length < 3) {
        invalidQuoteError('A correct company legal name must be provided.');
        return false;
    }

    let companyaddress = inCompanyaddress.val();
    if (companyaddress.length < 3) {
        invalidQuoteError('A correct company address must be provided.');
        return false;
    }

    let companyCountry = inCompanyCoutnry.val();
    if (companyCountry.length < 3) {
        invalidQuoteError('A correct company country of registration must be provided.');
        return false;
    }

    let companyVAT = inCompanyVAT.val();
    if (companyVAT.length < 4) {
        invalidQuoteError('A correct company VAT number must be provided.');
        return false;
    }

    // ---

    return true;
}

function updateTotals()
{
    let total = 0;

    const edrNum = inEDR.val() !== "0" ? Number(inEDR.val()) : 0;
    const edrTotal = edrNum * 45;
    lblEDR.text('€ ' + edrTotal);
    total += edrTotal;

    if (edrTotal > 0)
    {
        const removTotal = chkRemov.is(":checked") ? edrNum * 3 : 0;
        lblRemov.text('€ ' + removTotal);
        total += removTotal;

        const fwTotal = chkFirewall.is(":checked") ? edrNum * 4 : 0;
        lblFirewall.text('€ ' + fwTotal);
        total += fwTotal;

        const assetTotal = chkAsset.is(":checked") ? edrNum * 9 : 0;
        lblAsset.text('€ ' + assetTotal);
        total += assetTotal;

        const vulnTotal = chkVuln.is(":checked") ? edrNum * 15 : 0;
        lblVuln.text('€ ' + vulnTotal);
        total += vulnTotal;

        const siemTotal = chkSIEM.is(":checked") ? edrNum * 4 : 0;
        lblSIEM.text('€ ' + siemTotal);
        total += siemTotal;

        const intelTotal = chkIntel.is(":checked") ? edrNum * 17 : 0;
        lblIntel.text('€ ' + intelTotal);
        total += intelTotal;
    }

    const mobTotal = inMobile.val() !== "0" ? Number(inMobile.val()) * 30 : 0;
    lblMobile.text('€ ' + mobTotal);
    total += mobTotal;
    
    const cloudTotal = inCloud.val() !== "0" ? Number(inCloud.val()) * 30 : 0;
    lblCloud.text('€ ' + cloudTotal);
    total += cloudTotal;
   
    const supportFee = (total > 0) ? (total * 0.12) : 0;
    lblSupport.text('€ ' + supportFee.toFixed(2));

    const grandTotal = (total + supportFee).toFixed(2);
    lblTotal.text('€ ' + grandTotal);
}

function resetQuoteButton()
{
    btnQuote.val('');
    btnQuote.removeClass('disabled');
    btnQuote.append(
        $('<i class="fa fa-arrow-right"></i> Send quote'),
    );
}

function onSubmitCaptcha(captchaToken)
{
    // don't allow double submits
    if (btnQuote.hasClass('disabled')) {
        return;
    }

    btnQuote.text('Sending quote...');
    btnQuote.addClass('disabled');

    // hide any previous error messages 
    alertError.addClass('d-none');
    alertSuccess.addClass('d-none');

    // check for any mistakes
    if (! validateForm()) {
        resetQuoteButton();
        return
    }

    // what to send to the backend
    const formPayload = {
        captcha_token: captchaToken,
        crf: inCRF.val(),
        
        quote: {
            number_edr: inEDR.val(),
            has_removables: chkRemov.is(":checked"),
            has_firewall: chkFirewall.is(":checked"),
            has_asset: chkAsset.is(":checked"),
            has_vulnerability: chkVuln.is(":checked"),
            has_siem: chkSIEM.is(":checked"),
            has_intel: chkIntel.is(":checked"),

            number_mobile: inMobile.val(),
            number_cloud: inCloud.val(),
        },

        details: {
            contact_name: inName.val(),
            email: inEmail.val(),
            
            company_name: inCompanyName.val(),
            company_address: inCompanyaddress.val(),
            company_country: inCompanyCoutnry.val(),
            company_vat: inCompanyVAT.val(),

            cid: inCID.val(),
        },
    };
    
    // request options
    const options = {
        method: 'POST',
        body: JSON.stringify(formPayload),
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    // send post request
    fetch('/api/quote/send/', options)
    .then(function(resp) {
        // show error if backend threw an error
        if (! resp.ok) {
            invalidQuoteError(resp.statusText);
            resetQuoteButton();
            return;
        }

        // ...

        // success!
        btnQuote.text('Quote sent!');
        alertSuccess.removeClass('d-none');
    })
    .catch(function(err){
        invalidQuoteError(err);
        resetQuoteButton();
    });
}

tblQuote.on('change', updateTotals);