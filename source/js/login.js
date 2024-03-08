////////////////////////////////////////////////
////////////////////////////////////////////////
//	LOGIN PAGE
////////////////////////////////////////////////
////////////////////////////////////////////////




////////////////////////////////////////////////
////////////////////////////////////////////////
//	SECURITY MEASURES & HELPERS
////////////////////////////////////////////////
////////////////////////////////////////////////

$(window).on("load", function (event) {
    if (inIframe()) { iframeWarning(); }
    if (isInstalled) { $("#logo").attr("href", "#"); }
});

function iframeWarning() {
    $(".wrapper").remove();
    $(".bottom").remove();
    $("#logo").remove();
    showPopup("popup-login", "<b>THIS IS NOT CRYPTEE!</b><br><br>Seems like this page is loaded in an iframe on another page.<br><br>for your security, we've disabled logging in!", "error");
}

function startProgress() {
    $("body").addClass("progressing");
    $("button").prop('disabled', true);
    $("input").prop('disabled', true);
}

function stopProgress() {
    $("body").removeClass("progressing");
    $("button").removeAttr("disabled");
    $("input").removeAttr("disabled");
}

////////////////////////////////////////////////
////////////////////////////////////////////////
// MFA
////////////////////////////////////////////////
////////////////////////////////////////////////

$("input.totp").on('paste change cut copy keyup', function(event) {

    setTimeout(updateMFAInputs, 10);

    if (event.key === "Enter") {
        var totpLength = ($("input.totp").val() || "").trim().length || 0;
        if (totpLength >= 6) { setTimeout(checkLoginForm, 100); }
    } else {
        var totpLength = ($("input.totp").val() || "").trim().length || 0;
        if (totpLength >= 6) { setTimeout(checkLoginForm, 100); }
    }

}); 

$("input.totp").on('paste', function(event) {
    var totpLength = ($("input.totp").val() || "").trim().length || 0;
    if (totpLength >= 6) { setTimeout(checkLoginForm, 100); }
}); 

$("input.totp").on("focus click", function () {
    var that = this;
    setTimeout(function () { that.selectionStart = that.selectionEnd = 10000; }, 1);
});

function updateMFAInputs() {
    var values = ($("input.totp").val() || "").split("");
    $(".totp-a").val(values[0]);
    $(".totp-b").val(values[1]);
    $(".totp-c").val(values[2]);
    $(".totp-d").val(values[3]);
    $(".totp-e").val(values[4]);
    $(".totp-f").val(values[5]);
}

$("#recovery").on('click', function(event) { 
    $("body").toggleClass("recovery"); 
    setTimeout(function () {
        if ($("body").hasClass("recovery")) {
            $("#recovery-input").trigger("focus");
        } else {
            $("input.totp").trigger("focus");
        }
    }, 1000);
}); 

////////////////////////////////////////////////
////////////////////////////////////////////////
//  AUTHENTICATE
//	CHECK IF USER IS ALREADY LOGGED IN
//  OR WHEN THE USER IS LOGGED IN
////////////////////////////////////////////////
////////////////////////////////////////////////

$("progress").addClass("show");
authenticate(function(user){

    // IF USER LOGGED IN WITH GOOGLE, CHECK IF USER HAS A CUSTOM CLAIM "KEYCHECK".
    // IF THEY DON'T, THIS MEANS USER SIGNED UP USING THE GOOGLE BUTTON ON THE LOGIN PAGE, 
    // AND WE NEED TO CREATE AN ENCRYPTION KEY FOR THEM. 
    user.getIdTokenResult(true).then((idTokenResult) => {
        if (idTokenResult.claims.keycheck) {
            // LOGGED IN
            loginCompleted();
        } else {
            // LIKELY GOOGLE AUTH USER, WHO SIGNED UP ON LOGIN PAGE BY USING THE "G" BUTTON. 
            // USER DOESN'T HAVE A KEY. REDIRECT TO SIGN UP TO SET THEIR KEY.
            
            // console.log(idTokenResult);
            window.location = "/signup?status=newuser";
        }
    });

}, function(){
    // NOT LOGGED IN
    stopProgress();
}, function(error) {
    // ERROR
    stopProgress();
    if (error.code !== "auth/network-request-failed") {
        showPopup("popup-login", "we're having trouble logging you in. please try again shortly", "warning");
    } else {
        showPopup("popup-login", "we're having trouble logging you in. please try disabling your ad blockers or dns filters if you have any, and try again", "warning");
        handleError("[LOGIN] Error Authenticating", error);
    }
});



////////////////////////////////////////////////
////////////////////////////////////////////////
//	LOGIN COMPLETED, TAKE USER HOME
////////////////////////////////////////////////
////////////////////////////////////////////////

function loginCompleted() {
    if (getUrlParameter("redirect")) {        
        location.href = getUrlParameter("redirect");
    } else {
        location.href = "/home";
    }
}




////////////////////////////////////////////////
////////////////////////////////////////////////
//	PASSWORD SIGN IN FLOW
////////////////////////////////////////////////
////////////////////////////////////////////////

$("#login").on('click', checkLoginForm); 

$("#pswrd").on('keyup', function(event) {
    if (event.key === "Enter") {
        checkLoginForm();
    }
}); 

$("#email").on('keyup', function(event) {
    if (event.key === "Enter") {
        $("#pswrd").trigger("focus");
    }
}); 

function checkLoginForm() {
    sessionStorage.clear();
    var pswrd = $("#pswrd").val().trim();
    var email = $("#email").val().trim();

    if (!email) { $("#email").trigger("focus"); return true; }
    if (!pswrd) { $("#pswrd").trigger("focus"); return true; }

    if (!email.includes("@")) { email += "@users.crypt.ee"; }
    
    if ($("body").hasClass("mfa")) {
        if ($("body").hasClass("recovery")) {
            loginWithRecovery();
        } else {
            loginWithMFA();
        }
    } else {
        loginWithPassword(email, pswrd);
    }
}

let mfaResolver;
let mfaUID;
let mfaHints = {};
function showMFASteps(auth, error) {

    breadcrumb("[LOGIN] Showing MFA steps...");
    const resolver = firebase.getMultiFactorResolver(auth, error);
    for (const hint of (resolver.hints || [])) { mfaHints[hint.factorId] = hint; }
    mfaResolver = resolver;
    mfaUID = resolver.hints[0].uid;

    // get the hints, and check which MFA method we'll display. 
    // for this we'll add sub classes to body.
    // for now we only use TOTP, so for now, "body.mfa" displays the TOTP form right away 
    // but soon we'll add passkeys.
    // when passkeys are ready, "body.mfa" will display an mfa method picker,
    // using the mfaHints array below. 
    // 
    // also, don't forget to update changes.js 
    // for reauthentication (reauthMFA) using the same logic as well 
    // 
    // tldr; 
    // we're building this with passkeys in mind.
    // it's weird for now, but for a good reason.

    $("body").addClass("mfa totp");
    setTimeout(function () { $("input.totp").trigger("focus"); }, 2000);
    
}

async function loginWithMFA() {
    
    breadcrumb("[LOGIN] Logging in with MFA...");

    if (!$("body").hasClass("mfa")) { 
        loginWithMFAError();
    }

    startProgress();
    $("#mfa-hint").removeClass("error");
    $("#mfa-hint").removeClass("quota-exceeded");

    var multiFactorAssertion;
    if ($("body").hasClass("totp")) {
        var otpA = $(".totp-a").val();
        var otpB = $(".totp-b").val();
        var otpC = $(".totp-c").val();
        var otpD = $(".totp-d").val();
        var otpE = $(".totp-e").val();
        var otpF = $(".totp-f").val();
        var otp = otpA + otpB + otpC + otpD + otpE + otpF;
        multiFactorAssertion = firebase.TotpMultiFactorGenerator.assertionForSignIn(mfaHints["totp"].uid, otp);
    }
    
    // let userCreds;
    try {
        // userCreds = 
        await mfaResolver.resolveSignIn(multiFactorAssertion);
    } catch (error) {
        loginWithMFAError(error);
    }

}

async function loginWithMFAError(error) {
    
    await promiseToWait(5000); 
    
    stopProgress();

    if (error.code === "auth/invalid-verification-code") {
        
        if ($("body").hasClass("totp")) {
            $("#mfa-hint").addClass("error");
            $("input.totp").val("");
            updateMFAInputs();
            setTimeout(function () { $("input.totp").trigger("focus"); }, 10);
        }

    } else if (error.code === "auth/quota-exceeded") {
        
        showPopup("popup-login", `seems like you've tried logging in too many times using multi factor authentication today. <br><br>for your own security access to your account is temporarily disabled, please try again later.`, "error");
        breadcrumb('[LOGIN] [MFA] Quota Exceeded!');

        $("body").addClass("quota-exceeded");
        $("#mfa-hint").addClass("error quota-exceeded");
        $("input.totp").remove();
        updateMFAInputs();

    } else if (error.code === 'auth/network-request-failed') {

        showPopup("popup-login", `seems like your browser, ad-blocker, dns / vpn / network filter is blocking a connection either to ours or google's authentication server(s). please try disabling your ad / content blockers, dns / vpn / network filters (if you have any), check your internet connection and try again.`, "error");
        breadcrumb('[LOGIN] [MFA] No network (or login server blocked)');

        $("#mfa-hint").addClass("error network");
        $("input.totp").val("");
        updateMFAInputs();
        setTimeout(function () { $("input.totp").trigger("focus"); }, 10);

    } else {

        showPopup( "popup-login", `there seems to be an error logging you in and verifying your multi-factor authentication code. please try again shortly.`,  "warning" );
        breadcrumb('[LOGIN] [MFA] Other unknown error.');
        handleError("[LOGIN] [MFA] Unknown login error", error);

    }
   
}

async function loginWithRecovery() {
    // send mfaUID here, this is the temp UID we get after user authenticates with password. 
    
    startProgress();

    let recoveryCode = $("#recovery-input").val().trim();

    breadcrumb("[LOGIN] [MFA] Attempting to use recovery code ...");
        
    // Now let's make the API call

    var apiURL = apiROOT + "/api/v3/user-unauthenticatedMFADisableWithRecoveryCode";
    
    var axiosConfig = {
        method: "POST",
        url: apiURL,
        data : { uid : mfaUID, recoveryCode : recoveryCode },
        headers: { "Content-Type" : "application/json" },
        timeout: 30000 // in case if shit hits the fan, this will fail in 30 seconds
    };

    try {
        await axios(axiosConfig);
    } catch (error) {
        error.mfaUID = mfaUID;
        error.recoveryCode = recoveryCode;
        handleError("[LOGIN] [MFA] Request to recovery code endpoint failed", error);
        showPopup( "popup-login", `there seems to be an issue with the recovery code you've used or we're having network issues. please disable your ad-blocker, dns / vpn / network, then try again shortly.`,  "warning" );
        stopProgress();
        return false;
    }    

    breadcrumb("[LOGIN] [MFA] Recovery code worked, disabled MFA. Will login regularly now.");
    $("body").addClass("recovering");

    // if we make it here, it means mfa is now disabled, access regularly.
    
    await promiseToWait(3000);

    sessionStorage.clear();
    
    var pswrd = $("#pswrd").val().trim();
    var email = $("#email").val().trim();
    
    if (!email.includes("@")) { email += "@users.crypt.ee"; }

    loginWithPassword(email, pswrd);
    
}

function loginWithPassword(email, pswrd) {
    startProgress();
    breadcrumb("[LOGIN] Logging in with password...");
    let auth = firebase.getAuth();
    firebase.signInWithEmailAndPassword(auth, email, pswrd).catch(function (error) {
        var errorCode = error.code;
        if (errorCode === 'auth/wrong-password' || errorCode === 'auth/user-not-found' || errorCode === 'auth/invalid-email') {
            showPopup(
                "popup-login", 
                `<b>wrong password or credentials</b>
                <br><br>
                if you have an e-mail on file, please use that instead of your username, otherwise please try again`, 
                "warning"
            );
            breadcrumb('[LOGIN] Wrong pass / User Not Found / Invalid Email');
        } else if (errorCode === 'auth/user-disabled') {
            showPopup(
                "popup-login", 
                `<b>user deactivated</b>
                <br><br>
                seems like this user is deactivated. please contact our support if you think this is a mistake`, 
                "error"
            );
            breadcrumb('[LOGIN] User Disabled');
        } else if (errorCode === 'auth/network-request-failed') { 
            showPopup("popup-login", `seems like your browser, ad-blocker, dns / vpn / network filter is blocking a connection either to ours or google's authentication server(s). please try disabling your ad / content blockers, dns / vpn / network filters (if you have any), check your internet connection and try again.`, "error");
            breadcrumb('[LOGIN] No network (or login server blocked)');
        } else if (errorCode === 'auth/too-many-requests') {
            showPopup("popup-login", `due to unusual activity, the requests from this device, ip address or user are temporarily blocked. please try again after some time or contact our support team for more information.`, "error");
            breadcrumb('[LOGIN] Unusual activity.');
            handleError("[LOGIN] Unusual activity.");
        } else if (errorCode === 'auth/web-storage-unsupported') {
            showPopup("popup-login", `a feature required by cryptee to store account information locally in your browser to log you in seems to be missing, disabled or blocked. please try enabling localStorage, sessionStorage and IndexedDB, then try logging in again after restarting your browser. alternatively, try using another browser which supports these features.`, "error");
            handleError("[LOGIN] Web Storage Unsupported");
        } else if (errorCode === 'auth/multi-factor-auth-required') {
            mfaError = error;
            showMFASteps(auth, error);
        } else {
            showPopup( "popup-login", `there seems to be an error logging you in. please try again shortly.`,  "warning" );
            breadcrumb('[LOGIN] Other unknown error.');
            handleError("[LOGIN] Unknown login error", error);
        }
        stopProgress();
    });
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	GOOGLE LOGIN FLOW
////////////////////////////////////////////////
////////////////////////////////////////////////


$("#g").on('click', loginWithGoogle);

async function loginWithGoogle() {
    startProgress();
    
    var provider = new firebase.GoogleAuthProvider();
    provider.addScope('email');
    
    $("#pswrd").val("");
    $("#email").val("");
    
    try {
        if (isInWebAppiOS) {
            await firebase.signInWithRedirect(firebase.getAuth(), provider);
        } else {
            await firebase.signInWithPopup(firebase.getAuth(), provider);
        }
    } catch (error) {
        console.error(error);
        if (error.code === "auth/web-storage-unsupported") {
            stopProgress();
            showPopup(
                "popup-login",
                `<b>about cookies...</b><br><br>
                it seems your browser is blocking 3rd party cookies. since google is a third party, logging in using google requires that you enable this feature for cryptee. if you'd like to use google login with cryptee, please un-block third party cookies for google, and try again.`,
                "error"
            );
        } else if (error.code === "auth/missing-or-invalid-nonce") {
            stopProgress();
            breadcrumb('[LOGIN] Missing or Invalid Nonce');
        } else if (error.code === "auth/operation-not-supported-in-this-environment") {
            stopProgress();
            breadcrumb('[LOGIN] Operation not supported in this environment');
            showPopup("popup-login", "we're having trouble logging you in. please try disabling your ad blockers or dns filters if you have any, and try again", "warning");
        } else {
            stopProgress();
            breadcrumb('[LOGIN] Other error. Likely user closed google popup');
            showPopup("popup-login", `there seems to be an error logging you in. please try again shortly.`, "warning");
        }
    }
    
}