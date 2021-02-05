////////////////////////////////////////////////
////////////////////////////////////////////////
//	ALL ACCOUNT PAYMENT SETTINGS FOR STRIPE & PADDLE 
////////////////////////////////////////////////
////////////////////////////////////////////////

var updateURL;

function manageStripeInvoices() {
    if (updateURL) {
        window.open(updateURL, '_blank');
    } else {
        createPopup("Sorry, there seems to be a problem redirecting you to our payment processor to manage your invoices. Chances are this is a network / connectivity problem or you have an ad-blocker preventing cryptee from redirecting you. Please check your internet connection, try again shortly, and if this problem persists reach out to us from our helpdesk.", "error");
    }
}

function updatePaymentMethod() {
    if (updateURL) {
        window.open(updateURL, '_blank');
    } else {
        createPopup("Sorry, there seems to be a problem redirecting you to our payment processor to update your payment method. Chances are this is a network / connectivity problem or you have an ad-blocker preventing cryptee from redirecting you. Please check your internet connection, try again shortly, and if this problem persists reach out to us from our helpdesk.", "error");
    }
}

async function getStripePortalURL() {

    breadcrumb('[PORTAL] Requesting a new portal URL');

    var apiResponse; 

    try {
        apiResponse = await api("payments-stripeportalurl");
    } catch (error) {
        handleError("[PORTAL] API had an error.", error);
        return false;
    }

    if (!apiResponse || isEmpty(apiResponse)) {
        handleError("[PORTAL] Didn't get a response from the API.");
        return false;
    }

    if (apiResponse.status !== 200) {
        handleError("[PORTAL] API had an error: " + apiResponse.status);
        return false;
    }

    breadcrumb('[PORTAL] Got a new portal URL');

    return apiResponse.data;

}

async function getPaymentMethodUpdateURL() {
    if (thePaymentProcessor === "stripe") {
        // get stripe portal url
    
        $("#update-payment-method-button").addClass("loading");
        
        updateURL = await getStripePortalURL();
        
        $("#update-payment-method-button").removeClass("loading");

    } else {
        updateURL = paddleUpdateURL;
    }
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	EMAIL PADDLE INVOICES
////////////////////////////////////////////////
////////////////////////////////////////////////

async function emailPaddleInvoices() {
    
    var email = $("#email-paddle-invoices-input").val().trim();
    if (!email) {
        $("#email-paddle-invoices-input").trigger("focus");
        return false;
    }
    
    $("#email-paddle-invoices-button").addClass("loading");
    $("#email-paddle-invoices-button").html("sending email...");
    
    var sent = await requestPaddleToEmailInvoices(email);

    if (!sent) {
        $("#email-paddle-invoices-button").removeClass("loading");
        $("#email-paddle-invoices-button").html("email invoices");
        createPopup("Sorry, there seems to be a problem contacting our payment processor to send you your invoices. Chances are this is a network / connectivity problem or you have an ad-blocker preventing cryptee from contacting our payments processor. Please check your internet connection, try again shortly, and if this problem persists reach out to us from our helpdesk.", "error");
        return true;
    }

    $("#email-paddle-invoices-button").html("sent! check your inbox");
    $("#email-paddle-invoices-button").removeClass("loading");
    $("#email-paddle-invoices-button").addClass("green");
    $("#email-paddle-invoices-button").attr("disabled", true);

}





async function requestPaddleToEmailInvoices(email) {

    breadcrumb('[PADDLE API] Requesting paddle to email invoices');

    if (!email) {
        handleError("[PADDLE API] Can't sent invoices without an email address.");
        return false;
    }

    var apiResponse; 

    try {
        apiResponse = await api("payments-paddleinvoices", {}, { email : email }, "POST");
    } catch (error) {
        handleError("[PADDLE API] API had an error.", error);
        return false;
    }

    if (!apiResponse || isEmpty(apiResponse)) {
        handleError("[PADDLE API] Didn't get a response from the API.");
        return false;
    }

    if (apiResponse.status !== 200) {
        handleError("[PADDLE API] API had an error: " + apiResponse.status);
        return false;
    }

    breadcrumb('[PADDLE API] Done! Paddle should have sent invoices');

    return true;

}




////////////////////////////////////////////////
////////////////////////////////////////////////
//	CANCEL SUBSCRIPTION 
////////////////////////////////////////////////
////////////////////////////////////////////////

$("#cancel-subscription-button").on('click', function(event) {
    var reason = $("#cancel-subscription-reason").val().trim();
    if (!reason) {
        $("#cancel-subscription-reason").trigger("focus");
    } else {
        showModal('modal-cancel-subscription');
    }
}); 



async function submitCancelSubscriptionForm() {
    
    var reason = $("#cancel-subscription-reason").val().trim();

    try {
        await submitForm("unsubscribe", { body : reason });
    } catch (error) {
        handleError("[FORMS] Failed to submit cancel subscription form.", error);    
    }

    return true;

}


async function confirmedCancelSubscription() {
    
    startModalProgress("modal-cancel-subscription");

    await submitCancelSubscriptionForm();

    var cancelledSubscription;
    try {
        cancelledSubscription = await api("payments-unsubscribe");
    } catch (error) {
        handleError("[CANCEL SUBCRIPTION] Failed to cancel subscription.", error);
        stopModalProgress("modal-cancel-subscription");
    }

    if (!cancelledSubscription) {
        createPopup("Sorry, there seems to be a problem contacting our servers to cancel your subscription. Chances are this is a network / connectivity problem or you have an ad-blocker preventing connections to cryptee's servers. Please check your internet connection, try again shortly, and if this problem persists reach out to us from our helpdesk.", "error");
        return false;
    }

    // get new plan info from profile
    await getUserInfo();

    // show confirmation
    createPopup("Sucessfully cancelled your subscription! Your storage quota will be updated in a few seconds. Thank you for giving Cryptee a try!", "success");
    
    stopModalProgress("modal-cancel-subscription");
    
    hideActiveModal();

    loadTab("overview");

    return true;

}