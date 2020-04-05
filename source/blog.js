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
    formNode.className = "subscribe-wrapper";

    formNode.innerHTML = 
    "<hr>" +
    '<div id="subscribe">'+
        '<form method="post" action="/api/collections/cryptee/email/subscribe">'+
            '<input type="hidden" name="web" value="1">'+
            '<p>Enter your email to subscribe to updates.</p>'+
            '<input type="email" name="email" placeholder="me@example.com">'+
            '<input type="submit" value="Subscribe"><br><br>'+
            '<p>You can also subscribe via Mastodon, Pleroma,<br>or any ActivityPub-enabled service using <b>@read@blog.crypt.ee!</b></p>' +
        '</form>'+
    '</div>';

    if (!doesSubscriptionBoxExist()) {
        insertAfter(formNode, articleNode);
    }
}

if (location.pathname !== "/" && location.pathname !== "") {
    insertEmailForm();
}

