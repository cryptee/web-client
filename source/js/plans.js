////////////////////////////////////////////////
////////////////////////////////////////////////
//	AUTH / STARTUP
////////////////////////////////////////////////
////////////////////////////////////////////////

authenticate(function(user){
    // LOGGED IN

}, function(){
    // NOT LOGGED IN
    location.href = "/login";
}, function(error) {
    // ERROR
    if (error.code === "auth/network-request-failed") {
        handleError("[HOME] Error Authenticating", error);
    }
    
    location.href = "/login";
});



////////////////////////////////////////////////
////////////////////////////////////////////////
//	ON LOAD
////////////////////////////////////////////////
////////////////////////////////////////////////

var userEmail = "";

try {
    userEmail = localStorage.getItem("email");
    if (userEmail.includes("users.crypt.ee")) { userEmail = ""; }
} catch (error) {}

// set email
$("#billing-email").val(userEmail);

if (userEmail) {
    // hide input
    $("#billing-email").addClass("already-have"); 
    
    // hide its error messages
    $("#billing-email").next().addClass("already-have");
}

// set current plan
if (theUserPlan && theUserPlan !== "free") {
    if (storagePlansByID[theUserPlan]) {
        var currentPlan = storagePlansByID[theUserPlan];
        var currentPeriod = currentPlan.period;
        var currentPlanSize = currentPlan.formattedQuota.replace(" ", "");
        $(`.plan[plan='${currentPlanSize}']`).attr("current", currentPeriod);
        $('body').attr("current", theUserPlan);

        if (thePaymentProcessor === "paddle" && storagePlansByID[theUserPlan].period === "yr") {
            yearlyPaddle();
        }
    }
}

function yearlyPaddle() {
    $("button[period='yr']").trigger("click");
    $("body").addClass("paddle-yearly");
}

////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 PERIOD SELECTION
////////////////////////////////////////////////
////////////////////////////////////////////////



$('#period').on('click', 'button', function (event) {
    $('#period > button').removeClass("active");
    $(this).addClass("active");
    var period = $(this).attr("period");
    $('#period').attr("period", period);
});


$('#period').on('click', 'small', function (event) {
    $('#period > button[period="yr"]').trigger("click");
});


$('.plan').on('click', "button", function (event) {
    var plan = $(this).parents(".plan").attr("plan");
    var period = $("#period").attr("period");
    var price = $(this).attr(period);

    if (theUserPlan && theUserPlan !== "free") {
        switchConfirm(plan, period);
    } else {
        chosenPlan(plan, period, price);
    }
});


function chosenPlan(plan, period, price) {
    $("#billing").attr({ "plan": plan, "period": period, "price": price });

    $("#chosenstorage").html(plan.replace("GB", ""));
    $("#chosenbilling").attr("price", price);
    $("#chosenbilling").attr("period", period);

    $("body").removeClass("chooseplan");
    $("body").addClass("billing");
}








////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 BILLING INFORMATION SECTION 
////////////////////////////////////////////////
////////////////////////////////////////////////

function validateBillingInfo(checkout) {
    checkout = checkout || false;
    
    var email = $("#billing-email").val().trim();
    var name = $("#billing-name").val().trim();
    var zip = $("#billing-zip").val().trim();

    if ((checkout && !email) || (!checkout && email && !isEmail(email))) {
        $('#billing-email').trigger("focus");
        $('#billing-email').addClass("error");
        return false;
    } else {
        $('#billing-email').removeClass("error");
    }
    
    if (checkout && !zip) {
        $('#billing-zip').trigger("focus");
        $('#billing-zip').addClass("error");
        return false;
    } else {
        $('#billing-zip').removeClass("error");
    }
    
    if (checkout && !name) {
        $('#billing-name').trigger("focus");
        $('#billing-name').addClass("error");
        return false;
    } else {
        $('#billing-name').removeClass("error");
    }  

    return true;
}

$(".validate").on('change', validateBillingInfo);









////////////////////////////////////////////////
////////////////////////////////////////////////
//	VALIDATE VAT
////////////////////////////////////////////////
////////////////////////////////////////////////

var vatInfo = {};
var validatingVAT = false;
async function validateVAT() {

    validatingVAT = true;

    var vatNumber = $("#vat-number").val().trim();
    
    $("#company-name").html("validating vat #");
    $("#company-address").html("one moment please");
    $("#company").removeClass("validating validated error");
    $("#company").addClass("validating");

    var vatResponse = await checkVAT(vatNumber);

    // {
    //     "valid": true,
    //     "database": "ok",
    //     "format_valid": true,
    //     "query": "LUxxxxxxxx",
    //     "country_code": "LU",
    //     "vat_number": "xxxxxxxx",
    //     "company_name": "AMAZON EUROPE CORE S.A R.L.",
    //     "company_address": "5, RUE PLAETIS L-2338 LUXEMBOURG"
    // }       

    if (!vatResponse || isEmpty(vatResponse)) { 
        $("#company").removeClass("validating validated error");
        vatInfo = {};
        validatingVAT = false;
        return false;
    }

    if (vatResponse.database !== "ok") {
        err("Sadly, seems like European Union's VAT database servers aren't responding at the very moment. For tax compliance reasons, we cannot accept your VAT number unless it's verifed by EU's servers. We recommend trying again shortly. alternatively, you can continue the checkout without entering your VAT #, however <i>we won't be able to add your VAT # to invoices in the future.</i>", 
            "failed to validate validate vat #");
        return false;
    }

    if (!vatResponse.valid || !vatResponse.format_valid) {
        err("Seems like your VAT # isn't valid, you've made a formatting mistake, or we don't support VAT-billing for your country. Please double check and try again. For tax compliance, we can't accept your VAT # unless it's verifed by EU's servers. Alternatively, you can continue the checkout without entering your VAT #, however <i>we won't be able to add your VAT # to invoices in the future.</i>", 
        "invalid vat #");
        return false;
    }

    $("#company").removeClass("validating validated error");
    $("#company").addClass("validated");
    $("#company-name").html(vatResponse.company_name);
    $("#company-address").html(vatResponse.company_address);
    
    vatInfo = vatResponse;
    validatingVAT = false;
    return true;

    function err(popupMsg, miniMsg) {
        createPopup(popupMsg, "error");
        $("#company").removeClass("validating validated error");
        $("#company").addClass("error");
        $("#company-name").html("error");
        $("#company-address").html(miniMsg);
        vatInfo = {};
        validatingVAT = false;
    }
}





////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 CHECKOUT & STRIPE
////////////////////////////////////////////////
////////////////////////////////////////////////



var placeholderColor = "#888";
if (isFirefox) { placeholderColor = "#aaa"; }

var stripe = Stripe('pk_live_D9FkoKTyS1dPXaHhGrMZM8be00VxCQFFx5', { apiVersion: '2020-08-27;tax_product_beta=v1', betas: ["tax_product_beta_1"] });
var elements = stripe.elements({fonts : [ { src: `url('https://static.crypt.ee/fonts/JosefinSans-VariableFont_wght.ttf')`, family: 'Josefin Sans' } ]});

var elementStyles = {
    base: {
        color: '#fff',
        fontWeight: '350',
        fontFamily: 'Josefin Sans, sans-serif',
        fontSize: '16px',
        textTransform: 'lowercase',
        fontSmoothing: 'antialiased',

        ':focus': { color: '#FFF' },
        '::placeholder': { color: placeholderColor },
        ':focus::placeholder': { color: placeholderColor },
    },
    invalid: {
        color: '#CC0101',
        ':focus': { color: '#FFF' },
        '::placeholder': { color: '#980000' }, 
    },
};

var elementClasses = { focus: 'focus', empty: 'empty', invalid: 'invalid' };

var cardNumber = elements.create('cardNumber', { style: elementStyles, classes: elementClasses });
cardNumber.mount('#card-pan');

var cardExpiry = elements.create('cardExpiry', { style: elementStyles, classes: elementClasses });
cardExpiry.mount('#card-exp');

var cardCvc = elements.create('cardCvc', { style: elementStyles, classes: elementClasses });
cardCvc.mount('#card-cvc');

var stripeValidation = { num : false, exp : false, cvc : false };

cardNumber.on('change', function(event) {
    if (event.error) {
        stripeValidation.num = false;
    } else {
        stripeValidation.num = true;
    }
    validateStripe();
});

cardExpiry.on('change', function(event) {
    if (event.error) {
        stripeValidation.exp = false;
    } else {
        stripeValidation.exp = true;
    }
    validateStripe();
});

cardCvc.on('change', function(event) {
    if (event.error) {
        stripeValidation.cvc = false;
    } else {
        stripeValidation.cvc = true;
    }
    validateStripe();
});

$("#billing-name").on('keydown keypress paste copy cut change', function(event) {
    setTimeout(function () {
        validateStripe();
    }, 50);
}); 

function validateStripe() {
    var billingNameForValidation = $("#billing-name").val().trim();
    if (stripeValidation.num && stripeValidation.exp && stripeValidation.cvc && billingNameForValidation) {
        $("#checkout-button").removeAttr("disabled");
    } else {
        $("#checkout-button").attr("disabled", true);
    }
}

async function createPaymentMethod(billingDetails) {
    
    var paymentMethodResult;
    try {
        paymentMethodResult = await stripe.createPaymentMethod({
            type: 'card',
            card: cardNumber,
            billing_details: billingDetails,
        });
    } catch (error) {
        handleError("[UPGRADE] Failed to create payment method", error);
        return false;
    }

    if (!paymentMethodResult || isEmpty(paymentMethodResult)) {
        handleError("[UPGRADE] Failed to create payment method, got no payment method result");
        return false;
    }
    
    var paymentMethod = paymentMethodResult.paymentMethod;

    if (!paymentMethod || isEmpty(paymentMethod)) {
        handleError("[UPGRADE] Failed to create payment method, stripe returned no payment method");
        return false;
    }

    return paymentMethod;

}






var paymentMethodID;
var paymentIntentSecret;

async function upgrade() {
    
    // VALIDATE THE FORM / AND DON'T CONTINUE IF IT'S NOT READY YET
    var formValidated = validateBillingInfo(true); // true for checkout
    if (!formValidated) { return false; }

    // CHECK IF WE'RE STILL VALIDATING THE VAT – AND ABORT IF WE ARE.
    if (validatingVAT) { 
        createPopup("One moment please, we're still validating the VAT number you've entered.", "info");
        return false; 
    }

    // VALIDATION COMPLETE. START PROCESSING
    $("body").addClass("processing");

    // COLLECT EVERYTHING FROM INPUTS & FORM
    
    // GET PLAN DETAILS
    var plan = $("#billing").attr("plan") || "";
    var period = $("#billing").attr("period") || "";
    var storagePlan = storagePlans[period][plan];

    // GET INFO FROM FORM
    var zip = $("#billing-zip").val().trim();
    var name = $("#billing-name").val().trim();
    var email = $("#billing-email").val().trim();
    var country = $("#countries").val();
        



    // STEP 1 – COLLECT PAYMENT METHOD INFO
    var paymentInfo = { 
        email : email, 
        name : name, 
        address : { postal_code : zip } 
    };
    
    


    // STEP 2 – CREATE PAYMENT METHOD 
    var paymentMethod;
    try {
        paymentMethod = await createPaymentMethod(paymentInfo); // this is the only piece of info we'll send
    } catch (error) {
        handleError("[UPGRADE] Failed to create payment method", error);
    }

    if (!paymentMethod) {
        handleError("[UPGRADE] Failed to create payment method");
        processingError("failed-to-create-payment-method");
        return false;
    }

    paymentMethodID = paymentMethod.id;

    breadcrumb('[UPGRADE] Created payment method');




    // STEP 3 
    // NOW THAT WE'VE CREATED A PAYMENT METHOD. 
    // LET'S CREATE A CUSTOMER, AND ADD THEIR PAYMENT METHOD & INFO FOR INVOICES
    
    var customerDetails = { 
        email : email, 
        name : name,
        address : {} 
    };
    


    // IF IT'S A BUSINESS CHECKOUT (WITH VAT NUMBER) = CUSTOMER IS A BUSINESS
    var vatNumber;
    if (!isEmpty(vatInfo)) {
        
        // USE THE COMPANY NAME FOR INVOICE INSTEAD OFCARD HOLDER NAME
        customerDetails.name = vatInfo.company_name;
        
        // ADD BUSINESS COUNTRY FOR INVOICE, 
        customerDetails.address.country = vatInfo.country_code || country; 
        
        // ADD BUSINESS ADDRESS FOR INVOICE
        customerDetails.address.line1 = vatInfo.company_address; 

        // ADD BUSINESS VAT NUMBER FOR INVOICE
        vatNumber = vatInfo.query;

        breadcrumb('[UPGRADE] GOT Vat # – B2B User.');
    } else {
        breadcrumb('[UPGRADE] Did not get vat # – B2C User.');
    }
    
    


    // STEP 4 – CALL CHECKOUT API TO CREATE CUSTOMER, PROCESS TAX INFO, CREATE SUBSCRIPTION, AND RETURN A RESULT 
    
    var checkoutResponse = await checkout(paymentMethodID, customerDetails, storagePlan, vatNumber);
    if (!checkoutResponse) {
        processingError();
        return false;
    }

    // STEP 5 – SHOW ERRORS 

    // payment failed – had location issues
    if (checkoutResponse === "unrecognized_location") {
        processingError("unrecognized_location");
        return false;
    }

    // payment failed – stripe couldn't process payment
    if (checkoutResponse === "stripe-error") {
        processingError("stripe-error");
        return false;
    }

    // STEP 6 – CHECKOUT ALMOST COMPLETE. CHECK IF USER NEEDS TO DO A 3DS AUTH 

    var threeDSecureSuceeded = false;
    if (typeof checkoutResponse !== "string") {
        threeDSecureSuceeded = true;
    } else {
        if (checkoutResponse.startsWith("pi_") && checkoutResponse.includes("_secret_")) {
            // pi_abc_secret_xyz
            paymentIntentSecret = checkoutResponse;
            threeDSecureSuceeded = await show3DSPopup(paymentMethodID, paymentIntentSecret);
        } else {
            threeDSecureSuceeded = true;
        }
    }
    

    if (!threeDSecureSuceeded) {
        threeDSError();
        return false;
    }

    // payment succeeded, but had db issues
    if (checkoutResponse === "db-error") {
        dbError();
        return false;
    }

    // get new plan info from profile
    await getUserInfo();

    // show confirmation
    paymentSuccessful();
    return true;
}


function toggleVAT() {
    $("body").toggleClass("vat");
    if ($("body").hasClass("vat")) {
        $("#vat-fields > select").attr("tabindex", "");
        $("#vat-fields > input").attr("tabindex", "");
    } else {
        $("#vat-fields > select").attr("tabindex", "-1");
        $("#vat-fields > input").attr("tabindex", "-1");
    }
}


function paymentSuccessful() {
    breadcrumb("[UPGRADE] Checkout Successful!");
    $("body").removeClass("billing vat processing");
    $("body").addClass("thanks");
}

function threeDSError() {
    $("body").removeClass("billing vat processing threeds dberror");
    $("body").addClass("threeds");
}

function dbError() {
    $("body").removeClass("billing vat processing threeds dberror");
    $("body").addClass("dberror");
}

function processingError(type) {
    $("body").removeClass("processing threeds dberror"); 

    if (type === "unrecognized_location") {
        handleError("[UPGRADE] Unrecognized Location Error");
        createPopup("Looks like we're having difficulty determining your location for tax compliance purposes. Often this happens if you're using a VPN pointing to a different country than your payment card's issue country. Please temporarily turn off your VPN or TOR, then try again. thank you for your understanding.", "warning");
    } else {
        type = type || "";
        if (type) { type = "(" + type + ")"; }
        handleError(`[UPGRADE] Payment Processing Error ${type}`, {}, "fatal");
        createPopup("<strong>Failed to process your payment.</strong> Your card may be declined, or your ad-blocker may be blocking connections to Cryptee's payments processor <i>Stripe</i>. Please make sure you have enough funds on your card, double-check your payment information, unblock/allow connections to <i>Stripe</i> from your ad-blocker, check your internet connection and try again.", "error");
    }
}



/**
 * IF IT'S AN EU CARD / OR CARD REQUIRES 3DS, SHOW THE POPUP
 * @param {*} paymentMethodID 
 * @param {*} paymentIntentSecret i.e. "pi_abc_secret_xyz"
 */
async function show3DSPopup(paymentMethodID, paymentIntentSecret) {

    if (!paymentMethodID) { 
        handleError("[UPGRADE] Tried to show 3DS Popup, but there was no paymentMethodID");
        return false; 
    }

    if (!paymentIntentSecret) { 
        handleError("[UPGRADE] Tried to show 3DS Popup, but there was no paymentIntentSecret");
        return false; 
    }
    
    breadcrumb('[UPGRADE] Showing 3DS Auth Popup');
    var three3dsConfirmation = await stripe.confirmCardPayment(paymentIntentSecret, { payment_method:paymentMethodID });
    
    if (three3dsConfirmation.error) {
        // 3DS Failed. Try Again;
        handleError('[UPGRADE] 3DS Auth Failed! Will send email.', three3dsConfirmation.error, "fatal");
        return false;
    }
    
    breadcrumb('[UPGRADE] 3DS Auth Suceeded!');
    return true;
}

$('#card-info').on('click', function(event) {
    createPopup("your payments will be processed securely and privately in ireland, europe, using stripe. your card information never touches cryptee's servers.");
}); 




////////////////////////////////////////////////
////////////////////////////////////////////////
//	SWITCH PLANS
////////////////////////////////////////////////
////////////////////////////////////////////////

async function switchToPlan() {

    var planID = $("#switch-confirm").attr("planid");
    
    switchingPlans();

    var switchResponse = await switchPlans(planID);
    if (!switchResponse) {
        $("body").removeClass("billing vat processing threeds switching switch-confirm dberror");
        $("#switch-confirm").attr("planid", "");
        createPopup("Looks like we're having difficulty switching your plan. Chances are this is a connectivity issue. Your browser or ad-blocker may be blocking connections to our servers. Please check your internet connection, unblock connections to Cryptee from your ad-blocker and try again.", "error");
        return false;
    }

    // get new plan info from profile
    await getUserInfo();

    thanksSwitched();

    return true;

}

function switchConfirm(plan, period) {
    
    // set planid to confirmation modal
    var planID = storagePlans[period][plan];
    $("#switch-confirm").attr("planid", planID);

    // set plan name to button
    var planName = (plan + " plan").toLowerCase();
    $("#switchname").html(planName);

    // show confirmation modal
    $("body").removeClass("billing vat processing threeds switching switch-confirm dberror");
    $("body").addClass("switch-confirm");

}

function closeSwitcher() {
    $("body").removeClass("billing vat processing threeds switching switch-confirm dberror");
    $("#switch-confirm").attr("planid", "");
}

function switchingPlans() {
    $("body").removeClass("billing vat processing threeds switching switch-confirm dberror");
    $("body").addClass("switching");
}

function thanksSwitched() {
    $("body").removeClass("billing vat processing threeds switching switch-confirm dberror");
    $("body").addClass("thanks-switch");
}
