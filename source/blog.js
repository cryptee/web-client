function insertAfter(el, referenceNode) {
    referenceNode.parentNode.insertBefore(el, referenceNode.nextSibling);
}

function doesSubscriptionBoxExist() {
    var subscriptionElement = document.getElementById("subscribe"); 
    return document.body.contains(subscriptionElement);
}

function insertEmailForm() {
    var formNode = document.createElement('div');
    var articleNode = document.querySelector('article');

    formNode.innerHTML = 
    "<hr>" +
    '<div id="subscribe">'+
        '<form method="post" action="/api/collections/cryptee/email/subscribe">'+
            '<input type="hidden" name="web" value="1">'+
            '<p>Enter your email to subscribe to updates.</p>'+
            '<input type="email" name="email" placeholder="me@example.com">'+
            '<input type="submit" value="Subscribe">'+
        '</form>'+
    '</div>';

    if (!doesSubscriptionBoxExist()) {
        insertAfter(formNode, articleNode);
    }
}

if (location.pathname !== "/" && location.pathname !== "") {
    insertEmailForm();
}

