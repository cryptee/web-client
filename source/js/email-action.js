var auth = firebase.auth();
var mode, actionCode;

document.addEventListener('DOMContentLoaded', () => {

    // Get the action to complete.
    mode = getUrlParameter('mode');

    // Get the one-time code from the query parameter.
    actionCode = getUrlParameter('oobCode');

    if (mode === "resetPassword") {
        handleResetPassword();
    } else if (mode === "recoverEmail") {
        handleRecoverEmail();
    } else if (mode === "verifyEmail") {
        handleVerifyEmail();
    } else {
        somethingWentWrong();
        if (mode) {
            handleError("[EMAIL ACTION] ILLEGAL / INVALID MODE", { mode: mode });
        } else {
            handleError("[EMAIL ACTION] ILLEGAL ACTION. NO MODE PROVIDED");
        }
    }

}, false);

function somethingWentWrong() {
    $("#error").show();
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	VERIFY EMAIL
////////////////////////////////////////////////
////////////////////////////////////////////////


async function handleVerifyEmail() {
    
    $("#verify").show();

    try {
        await auth.applyActionCode(actionCode);
    } catch (error) {
        handleError("[EMAIL ACTION] Invalid / Expired action code.", error, "warning");
        createPopup("For your own safety, these links have an expiry time.<br><br> Looks like this email verification link has expired or is invalid.<br><br> Please try verifying your email again.", "error");
        $("#verify").find("progress").remove();
        $("#verify-status").html("sorry, looks like this link has expired");
        return false;
    }
    
    $("#verify-status").html(`
        thank you!<br>
        you have successfully verified your email.
    `);

    $("#verify").find("progress").remove();

    return true;
    
}

////////////////////////////////////////////////
////////////////////////////////////////////////
//	RESET PASS STATE
////////////////////////////////////////////////
////////////////////////////////////////////////

async function handleResetPassword() {
    
    var accountEmail;
    
    // Verify the password reset code is valid.
    try {
        accountEmail = await auth.verifyPasswordResetCode(actionCode);
    } catch (error) {
        handleError("[EMAIL ACTION] Invalid / Expired action code.", error, "warning");
        createPopup("For your own safety, password reset links have an expiry time.<br><br> Looks like this password reset link has expired or is invalid.<br><br> Please try resetting your password again.", "error");
        return false;
    }

    $("#reset").show();
    $("#reset-email").html(accountEmail);

    return true;

}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	RECOVER EMAIL STATE
////////////////////////////////////////////////
////////////////////////////////////////////////

var restoredEmail = null;
async function handleRecoverEmail() {
    
    $("#recover").show();

    var restorationInfo;

    try {
        restorationInfo = await auth.checkActionCode(actionCode);
    } catch (error) {
        handleError("[EMAIL ACTION] Invalid / Expired action code.", error, "warning");
        createPopup("For your own safety, these links have an expiry time.<br><br> Looks like this link has expired or is no longer valid.", "error");
        $("#recover").find("progress").remove();
        $("#recover-status").html("sorry, looks like this link has expired");
        return false;
    }

    restoredEmail = restorationInfo.data.email;

    try {
        await auth.applyActionCode(actionCode);
    } catch (error) {
        handleError("[EMAIL ACTION] Invalid / Expired action code.", error, "warning");
        createPopup("For your own safety, these links have an expiry time.<br><br> Looks like this link has expired or is no longer valid.", "error");
        $("#recover").find("progress").remove();
        $("#recover-status").html("sorry, looks like this link has expired");
        return false;
    }

    if (!restoredEmail) { return false; }

    $("#recover-status").html(`
        <span>your login email has been reset back to:</span>
        <span class="gray">${restoredEmail}</span>
    `);

    $("#recover").find("progress").remove();
    $("#recover-reset").show();

}

async function sendPasswordResetEmail() {
    
    if (!restoredEmail) { return false; }

    try {
        await auth.sendPasswordResetEmail(restoredEmail);    
    } catch (error) {
        handleError("[EMAIL ACTION] Failed to send password reset email", error, "warning");
        createPopup("We weren't able to send you a password reset email. Chances are this is a connectivity issue. We recommend logging into your account and changing your password right away.", "error");
        return false;
    }

    createPopup("Done! We've sent you a password reset email! If you have any other devices where you're logged into cryptee, they will all be automatically logged out for your safety.", "success");

    return true;

}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	RESET / CHANGE PASSWORD 
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


$("#reset-password-new-input").on('keydown keypress paste copy cut change', function(event) {
    setTimeout(function () {

        var first64DigitsOfPassword = $("#reset-password-new-input").val().trim().substring(0,64);
        passScore = zxcvbn(first64DigitsOfPassword).score;

        if (passScore === 0) {
            $("#password-strength-message").html(passComment(passScore));
            $("#password-strength").attr("value", 5);
            $("#reset-password-button").attr("disabled", true); 
            passColor("red");
        }
        
        else if (passScore === 1) {
            $("#password-strength-message").html(passComment(passScore));
            $("#password-strength").attr("value", 10);
            $("#reset-password-button").attr("disabled", true);
            passColor("red");
        }
        
        else if (passScore === 2) {
            $("#password-strength-message").html(passComment(passScore));
            $("#password-strength").attr("value", 40);
            $("#reset-password-button").removeAttr("disabled");
            passColor("yellow");
        }
        
        else if (passScore === 3) {
            $("#password-strength-message").html(passComment(passScore));
            $("#password-strength").attr("value", 75);
            $("#reset-password-button").removeAttr("disabled");
            passColor("green");
        }
        
        else {
            $("#password-strength").attr("value", 100);
            $("#reset-password-button").removeAttr("disabled");
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
            $("#reset-password-button").attr("disabled", true); 
            passColor("red");
        }
        
        if (first64DigitsOfPassword.length === 0) {
            $("#password-strength-message").html(" &nbsp; ");
            $("#password-strength").attr("value", 0); 
            passColor("red");
        }

    }, 50);
}); 


async function resetPassword() {

    var newPassword     = $("#reset-password-new-input").val();
    var verifyPassword  = $("#reset-password-verify-input").val();
    
    if (!newPassword) { return; }
    if (!verifyPassword) { return; }
    if (passScore < 2) { return; }

    if (newPassword !== verifyPassword) {
        createPopup("The passwords you've typed into the <strong>new password</strong> field and <strong>verify password</strong> field don't match. Please make sure and verify that you're typing your new password correctly", "warning");
        return;
    }

    $("#reset-password-button").addClass("loading");

    try {
        await auth.confirmPasswordReset(actionCode, newPassword);
    } catch (error) {
        createPopup("For your own safety, password reset links have an expiry time.<br><br> Looks like either this password reset link has expired or the password you've chosen is too weak.<br><br> Please try resetting your password again.", "error");
        $("#reset-password-button").remove();
        return false;
    }

    createPopup("Done! Your password is successfully reset! From now on, while logging in, you'll need to use your new password.<br><br>if you have any other devices where you're logged into cryptee, they will all be automatically logged out for your safety.", "success");

    $("#reset").hide();

    return true;

}


