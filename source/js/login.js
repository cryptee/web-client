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
    prepKeyModal();
});

function iframeWarning() {
    $(".wrapper").remove();
    $(".bottom").remove();
    $("#logo").remove();
    showPopup("popup-login", "<b>THIS IS NOT CRYPTEE!</b><br><br>Seems like this page is loaded in an iframe on another page.<br><br>for your security, we've disabled logging in!", "error");
}

function startProgress() {
    $("progress").addClass("show");
    $("button").prop('disabled', true);
    $("input").prop('disabled', true);
}

function stopProgress() {
    $("progress").removeClass("show");
    $("button").removeAttr("disabled");
    $("input").removeAttr("disabled");
}

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

    disableGoogleButtonIfNecessary();
}); 

$("#email").on('keyup', function(event) {
    if (event.key === "Enter") {
        $("#pswrd").trigger("focus");
    }

    disableGoogleButtonIfNecessary();
}); 

function checkLoginForm() {
    sessionStorage.clear();
    var pswrd = $("#pswrd").val().trim();
    var email = $("#email").val().trim();

    if (!email) { $("#email").trigger("focus"); return true; }
    if (!pswrd) { $("#pswrd").trigger("focus"); return true; }

    if (!email.includes("@")) { email += "@users.crypt.ee"; }
    
    loginWithPassword(email, pswrd);
}

function loginWithPassword(email, pswrd) {
    startProgress();

    firebase.signInWithEmailAndPassword(firebase.getAuth(), email, pswrd).catch(function (error) {
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
        } else {
            showPopup( "popup-login",  `there seems to be an error logging you in. please try again shortly.`,  "warning" );
            breadcrumb('[LOGIN] Other unknown error.');
            handleError("[LOGIN] Unknown login error", error);
        }
        stopProgress();
        disableGoogleButtonIfNecessary();
    });
}

function disableGoogleButtonIfNecessary() {
    var pswrd = ($("#pswrd").val() || "").trim();
    var email = ($("#email").val() || "").trim();

    if (email || pswrd) { 
        $("#g").prop('disabled', true); 
    } else {
        $("#g").removeAttr("disabled");
    }
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
    
    try {
        if (isInWebAppiOS) {
            await firebase.signInWithRedirect(firebase.getAuth(), provider);
        } else {
            await firebase.signInWithPopup(firebase.getAuth(), provider);
        }
    } catch (error) {
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