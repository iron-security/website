function invalidContactSubmit(err)
{
    console.log('contact message failed: ' + err);

    $('#alert-success').addClass('d-none');
    $('#alert-error').removeClass('d-none');

    $('#btn-submit').removeClass('disabled');
}

function onSubmitCaptcha(captchaToken)
{
    if ($('#btn-submit').hasClass('disabled')) {
        return;
    }

    $('#btn-submit').addClass('disabled');

    const json = {
        captcha_token: captchaToken,
        email: $('#contact_email').val(),
        subject: $('#contact_subject').val(),
        message: $('#contact_message').val(),
        crf: $('#contact_crf').val(),
    };
    
    // request options
    const options = {
        method: 'POST',
        body: JSON.stringify(json),
        headers: {
            'Content-Type': 'application/json'
        }
    }
    
    // send post request
    fetch('/api/contact/', options)
    .then(function(resp) {
        if (! resp.ok) {
            invalidContactSubmit(resp.statusText);
            return;
        }

        $('#alert-success').removeClass('d-none');
        $('#alert-error').addClass('d-none');

        $('#contact_subject').val();
        $('#contact_message').val();
    })
    .catch(function(err){
        invalidContactSubmit(err);
    });
}