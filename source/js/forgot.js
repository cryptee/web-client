////////////////////////////////////////////////
////////////////////////////////////////////////
//	FORGOT PASSWORD
////////////////////////////////////////////////
////////////////////////////////////////////////

$("#reset-button").on('click', function (event) {
    if ($("#forgot-email").val().trim() !== "") {
        sendForgotEmail();
    } else {
        $("#forgot-email").trigger("focus");
    }
});

async function sendForgotEmail() {
    var emailAddress = $("#forgot-email").val().trim();

    if (!emailAddress) {
        $("#forgot-email").trigger("focus");
        return false;
    }

    $("#reset-button").addClass("loading");

    try {
        await firebase.sendPasswordResetEmail(firebase.getAuth(), emailAddress);
    } catch (error) {
        if (error.code === "auth/user-not-found") {
            createPopup("no account found with that email address. please try again", "warning");
            $("#reset-button").removeClass("loading");
            return false;
        } else {
            handleError("[FORGOT PASSWORD] Failed to send password reset email, likely ad blocker, or abuse", error);
            createPopup("it seems we're having difficulty connecting our servers to send a password reset email. Chances are this is a network / connectivity problem, or your browser / ad-blocker is configured to block access to a resource cryptee needs. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues. ", "error");
            $("#reset-button").removeClass("loading");
            return false;
        }
    }

    $("#reset-button").html("email sent!");
    $("#reset-button").addClass("green");
    $("#reset-button").attr("disabled", true);
    
    setTimeout(function () { window.location = "/login"; }, 5000);
    

}