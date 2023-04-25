function checkTweakers()
{
    if (location.pathname !== '/') { return; }

    const urlParams = new URLSearchParams(window.location.search); 
    if (! urlParams.has('orig') || urlParams.get('orig') !== 'tweakers') { return; }

    $('#txtSubtext').text('like a cyber Tweaker.');
};

checkTweakers();