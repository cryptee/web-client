////////////////////////////////////////////////////
////////////////////////////////////////////////////
//	
//  ALL CHANGES (KEY / PASS / EMAIL ETC HAPPEN HERE)
//
////////////////////////////////////////////////////
////////////////////////////////////////////////////

var reauthenticated = false;


/**
 * To be able to change anything like email / pass etc, we need to re-authenticate users. This function does that, and calls the actual change that needs to happen. 
 * @param {string} currentPassword
 */
async function reAuthUser(currentPass) {
    
    if (loginMethod === "password" && !currentPass) { 
        handleError("[REAUTH] Can't reauth a password-user without a password.");
        return false; 
    }

    var credential;
    
    if (loginMethod === "password") {

        credential = firebase.EmailAuthProvider.credential(theUser.email, currentPass);

        reauthenticated = true;

        try {
            await firebase.reauthenticateWithCredential(theUser, credential);
        } catch (error) {
            createPopup("Looks like you made a mistake with your current password, or we're having a connectivity issue. Please double check the current password you've typed, make sure your internet connection is stable, and try again.", "error");
        }

    }

    if (loginMethod === "google.com") {

        if (isInstalled) {
            createPopup("For your own security, as a google-login user, you can only delete your account by first logging in to Cryptee using a browser (instead of this Progressive Web App [PWA]) so that someone who may have gained access to this device cannot delete your account easily.", "error");
            return false;
        }
        
        try {
            
            var provider = new firebase.GoogleAuthProvider();
            
            if (isInWebAppiOS) {
                await firebase.reauthenticateWithRedirect(theUser, provider);
            } else {
                await firebase.reauthenticateWithPopup(theUser, provider);
            }
            
        } catch (error) {
            createPopup("Looks like Cryptee's having difficulty connecting to google to verify your identity. Chances are this is a network / connectivity issue. Please make sure your browser or ad-blocker is not configured to block connections to google and try again.", "error");
            return false;
        }

    }


    return true;

}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	CHANGE / VERIFY EMAIL
////////////////////////////////////////////////
////////////////////////////////////////////////

// change-email-input

// verify-pasword-for-email-change-input

async function changeEmail() {
    
    var newEmail = $("#change-email-input").val().trim();
    
    if (!newEmail) { return; }
    if (newEmail === theEmail) { return; }

    var currentPass = $("#verify-pasword-for-email-change-input").val();
    if (!currentPass) { 
        createPopup("To change / update your email address, for your safety, you'll need to prove you are indeed who you say you are. To prove your identity please enter your current login password.", "warning");
        return false; 
    }

    $("#change-email-button").addClass("loading");

    var reAuthorized = await reAuthUser(currentPass);
    if (!reAuthorized) { 
        // warning popups are sent in reauth already
        $("#change-email-button").removeClass("loading");
        return false;
    }
    
    try {
        await firebase.updateEmail(theUser,newEmail);
    } catch (error) {
        if (error.code === "auth/email-already-in-use") {
            createPopup("Looks like this email address is already in use on Cryptee. Please double check you've typed the correct email address, or try another email address.", "error");
        } else {
            createPopup("Looks we're having a connectivity issue, and couldn't change / update your email address. Please make sure your internet connection is stable, your browser or ad-blocker is not configured to block any connections from Cryptee and try again.", "error");
        }
        console.error(error);
        $("#change-email-button").removeClass("loading");
        return false;
    }

    await firebase.sendEmailVerification(theUser);
    
    createPopup("Email successfully set! Please check your email inbox (and spam folder just in case) for a verification mail.<br><br>From now on you will need to use your new email address <strong> ( " + newEmail + " ) </strong> to log in to Cryptee. ", "success");
    $("#change-email-button").removeClass("loading");

    return true;

}

function showVerifyEmailPopup() {
    if (reSentEmail) { return false; } // so that we won't keep re-sending.
    createPopup("a verification link has been sent to your email address. please click the link sent to your email address to verify your email.<br><br>If you haven't received the verification email, click below to re-send it. <br><br> <button class='bold white' onclick='resendVerifyEmailLink();'>resend email</button>", "error", "reverify");
}

var reSentEmail = false;
async function resendVerifyEmailLink() {
    hidePopup("popup-reverify");
    reSentEmail = true; 
    await firebase.sendEmailVerification(theUser);
    createPopup("Verification email sent! Please check your email (and spam folder just in case)", "success");
    $("#verify-email-warning").html("check your inbox for a verification email");
}

////////////////////////////////////////////////
////////////////////////////////////////////////
//	CHANGE PASSWORD
////////////////////////////////////////////////
////////////////////////////////////////////////

function passComment(score) {
    return passwordStrengthMessages[score][Math.floor((Math.random()*passwordStrengthMessages[score].length))];
} 

function passColor(color) {
    $("#password-strength, #password-strength-message").removeClass("yellow red green"); 
    $("#password-strength, #password-strength-message").addClass(color); 
}

var passwordStrengthMessages = {
    0 :  ["too weak", "nope", "not good", "worrisome", "that's simply not a password"],
    1 :  ["still weak", "still not good enough", "try harder", "still worrisome"],
    2 :  ["close ... but you can do better", "fair ... but not your best work", "getting there ..."],
    3 :  ["good enough, but you can do even better", "strong enough, but why not better?"],
    4 :  ["excellent", "now, that's a strong password!", "that'll do!", "that's amazing", "perfection!", "award winning!", "incredible!", "great job!"],
    11 : ["that's gotta be a password manager!", "mind-blown! you got this!"]
};

var passScore;

$("#change-password-input").on('keydown keypress paste copy cut change', function(event) {
    setTimeout(function () {

        var first64DigitsOfPassword = $("#change-password-input").val().trim().substring(0,64);
        passScore = zxcvbn(first64DigitsOfPassword).score;

        if (passScore === 0) {
            $("#password-strength-message").html(passComment(passScore));
            $("#password-strength").attr("value", 5);
            $("#change-password-button").attr("disabled", true); 
            passColor("red");
        }
        
        else if (passScore === 1) {
            $("#password-strength-message").html(passComment(passScore));
            $("#password-strength").attr("value", 10);
            $("#change-password-button").attr("disabled", true);
            passColor("red");
        }
        
        else if (passScore === 2) {
            $("#password-strength-message").html(passComment(passScore));
            $("#password-strength").attr("value", 40);
            $("#change-password-button").removeAttr("disabled");
            passColor("yellow");
        }
        
        else if (passScore === 3) {
            $("#password-strength-message").html(passComment(passScore));
            $("#password-strength").attr("value", 75);
            $("#change-password-button").removeAttr("disabled");
            passColor("green");
        }
        
        else {
            $("#password-strength").attr("value", 100);
            $("#change-password-button").removeAttr("disabled");
            passColor("green");
            
            if (first64DigitsOfPassword.length >= 32) {
                $("#password-strength-message").html(passComment(11));
            } else {
                $("#password-strength-message").html(passComment(passScore));
            }
        }
        
        // password must be at least 6 characters
        if (first64DigitsOfPassword.length < 6) {
            $("#password-strength").attr("value", 5);
            $("#change-password-button").attr("disabled", true); 
            passColor("red");
        }

        if (first64DigitsOfPassword.length === 0) {
            $("#password-strength-message").html(" &nbsp; ");
            $("#password-strength").attr("value", 0); 
            passColor("red");
        }

    }, 50);
}); 


async function changePassword() {

    var currentPass     = $("#change-password-current-password-input").val();
    var newPassword     = $("#change-password-input").val();
    var verifyPassword  = $("#verify-password-input").val();
    
    if (!newPassword) { return; }
    if (!verifyPassword) { return; }
    if (passScore < 2) { return; }

    if (!currentPass) { 
        createPopup("To change / update your your password, for your safety, you'll need to prove you are indeed who you say you are. To prove your identity please enter your current login password.", "warning");
        return false; 
    }

    if (newPassword === currentPass || verifyPassword === currentPass) {
        createPopup("You've typed the same password into the <strong>current password</strong> field, and <strong>new password</strong> field. Please pick a new password to change your password.", "dark");
        return;
    }

    if (newPassword !== verifyPassword) {
        createPopup("The passwords you've typed into the <strong>new password</strong> field and <strong>verify password</strong> field don't match. Please make sure and verify that you're typing your new password correctly", "warning");
        return;
    }

    

    $("#change-password-button").addClass("loading");

    var reAuthorized = await reAuthUser(currentPass);
    if (!reAuthorized) { 
        // warning popups are sent in reauth already
        $("#change-password-button").removeClass("loading");
        return false;
    }

    try {
        firebase.updatePassword(theUser, newPassword);
    } catch (error) {
        createPopup("Looks we're having a connectivity issue, and couldn't change / update your password. Please make sure your internet connection is stable, your browser or ad-blocker is not configured to block any connections from Cryptee and try again.", "error");
        console.error(error);
        $("#change-password-button").removeClass("loading");
        return false;
    }

    createPopup("Done! Successfully changed your password! From now on, while logging in, you'll need to use your new password.<br><br>if you have any other devices where you're logged into cryptee, they will all be automatically logged out for your safety.", "success");
    $("#change-password-button").removeClass("loading");
    $("#password-strength").attr("value", 0);
    $("#change-password-current-password-input").val("");
    $("#change-password-input").val("");
    $("#verify-password-input").val("");

    return true;

}

////////////////////////////////////////////////
////////////////////////////////////////////////
//	CHANGE KEY
////////////////////////////////////////////////
////////////////////////////////////////////////

function keyColor(color) {
    $("#key-strength").removeClass("yellow red green"); 
    $("#key-strength").addClass(color); 
}

$("#new-key-for-change-key-input").on('keydown keypress paste copy cut change', function(event) {

    setTimeout(function () {
        
        var first64DigitsOfKey = $("#new-key-for-change-key-input").val().substring(0,64);
        keyScore = zxcvbn(first64DigitsOfKey).score;

        if (keyScore === 0) {
            $("#key-strength").attr("value", 25);
            $("#change-key-button").attr("disabled", true); 
            keyColor("red");
        }
        
        else if (keyScore === 1) {
            $("#key-strength").attr("value", 35);
            $("#change-key-button").removeAttr("disabled");
            keyColor("yellow");
        }
        
        else if (keyScore === 2) {
            $("#key-strength").attr("value", 65);
            $("#change-key-button").removeAttr("disabled");
            keyColor("green");
        }
        
        else if (keyScore === 3) {
            $("#key-strength").attr("value", 75);
            $("#change-key-button").removeAttr("disabled");
            keyColor("green");
        }
        
        else {
            $("#key-strength").attr("value", 100);
            $("#change-key-button").removeAttr("disabled");
            keyColor("green");
        }
        
        if (first64DigitsOfKey.length === 0) {
            $("#key-strength").attr("value", 0); 
            keyColor("red");
        }

    }, 50);

}); 



async function tryChangingKey() {

    var currentKey = $("#current-key-for-change-key-input").val();
    var newKey     = $("#new-key-for-change-key-input").val();
    var verifyKey  = $("#verify-new-key-for-change-key-input").val();
    
    if (!newKey) { return; }
    if (!verifyKey) { 
        $("#verify-new-key-for-change-key-input").trigger("focus");
        return; 
    }
    if (passScore < 2) { return; }

    if (!currentKey) { 
        createPopup("To change / update your your key, for your safety, you'll need to prove you are indeed who you say you are. To prove your identity please enter your current encryption key.", "warning");
        return false; 
    }

    if (newKey === currentKey || verifyKey === currentKey) {
        createPopup("You've typed the same key into the <strong>current encryption key</strong> field, and <strong>new encryption key</strong> field. Please pick a new key to change your encryption key.", "dark");
        return;
    }

    if (newKey !== verifyKey) {
        createPopup("The keys you've typed into the <strong>new encryption key</strong> field and <strong>verify encryption key</strong> field don't match. Please make sure and verify that you're typing your new key correctly", "warning");
        return;
    }

    $("#change-key-button").addClass("loading");

    var hashedCurrentKey;
    try {
        hashedCurrentKey = await hashString(currentKey);
    } catch (error) {
        handleError("[CHANGE KEY] Failed to hash the current key", error);
        createPopup("Looks like your browser is having a difficulty with our cryptographic functions. Chances are an ad-blocker is causing issues. Please try disabling your ad-blockers or changing your key on another device or browser.", "error");
        $("#change-key-button").removeClass("loading");
        return false;
    }

    // VERIFY CURRENT KEY BY TRYING TO DECRYPT KEYCHECK
    var dataEncryptionKey;
    try {
       plaintextDEK = await decrypt(keycheck, [hashedCurrentKey]);
       dataEncryptionKey = plaintextDEK.data;
    } catch (error) {
        handleError("[CHANGE KEY] Failed to decrypt the current key", error, "info");
        createPopup("Looks like you made a mistake with your current key. Please double check the current key you've typed and try again.", "error");
        $("#change-key-button").removeClass("loading");
        return false;
    }

    // IF WE MADE IT HERE, THIS MEANS WE GOT THE CORRECT KEY.

    var stringifiedWrappedKey;
    try {
        var hashedKEK = await hashString(newKey); 
        
        // encrypt data encryption key using the hashed key encryption key
        var wrappedKey = await encrypt(dataEncryptionKey, [hashedKEK]);
        
        // stringify wrapped key
        stringifiedWrappedKey = JSON.stringify(wrappedKey);
    } catch (error) {
        handleError("[CHANGE KEY] Failed to hash / encrypt / wrap / stringify user key.", error);
        createPopup("Looks like your browser is having a difficulty with our cryptographic functions. Chances are an ad-blocker is causing issues. Please try disabling your ad-blockers or changing your key on another device or browser.", "error");
        $("#change-key-button").removeClass("loading");
        return false;
    }

    // BOOM. we've got the new wrapped key, now to save it.

    var apiResponse; 

    try {
        apiResponse = await api("user-newkeycheck", {}, { keycheck : stringifiedWrappedKey }, "POST");
    } catch (error) {
        handleError("[CHANGE KEY] API had an error.", error);
        createPopup("Looks we're having a connectivity issue, and couldn't change / update your key. Please make sure your internet connection is stable, your browser or ad-blocker is not configured to block any connections from Cryptee and try again.", "error");
        $("#change-key-button").removeClass("loading");
        return false;
    }

    if (!apiResponse) {
        handleError("[CHANGE KEY] Didn't get a response from the API.");
        createPopup("Looks we're having a connectivity issue, and couldn't change / update your key. Please make sure your internet connection is stable, your browser or ad-blocker is not configured to block any connections from Cryptee and try again.", "error");
        $("#change-key-button").removeClass("loading");
        return false;
    }

    if (apiResponse.status !== 200) {
        handleError("[CHANGE KEY] API had an error: " + apiResponse.status);
        createPopup("Looks we're having a connectivity issue, and couldn't change / update your key. Please make sure your internet connection is stable, your browser or ad-blocker is not configured to block any connections from Cryptee and try again.", "error");
        $("#change-key-button").removeClass("loading");
        return false;
    }
    
    // clear old cached keycheck & memorized key for safety.
    try {
        sessionStorage.removeItem("ses-keycheck");
        localStorage.removeItem('memorizedKey');
    } catch (error) {}
    
    // get newcheck for cache ahead of time
    await getKeycheck(true);

    createPopup("Done! Successfully changed your encryption key! From now on, while using the app, you'll need to use your new encryption key.", "success");
    $("#change-key-button").removeClass("loading");
    $("#key-strength").attr("value", 0);
    $("#current-key-for-change-key-input").val("");
    $("#new-key-for-change-key-input").val("");
    $("#verify-new-key-for-change-key-input").val("");

    return true;

}