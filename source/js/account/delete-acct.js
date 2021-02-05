////////////////////////////////////////////////
////////////////////////////////////////////////
//	ACCOUNT DELETION
////////////////////////////////////////////////
////////////////////////////////////////////////

var willLoseAuthForDeletion = false;

$("#delete-account-button").on('click', function(event) {
    var currentPass = $("#delete-account-password").val().trim();

    if (loginMethod === "google.com") {
        showPopup('popup-delete');
        return true;
    }

    // non-google user, check they typed password
    if (!currentPass) {
        $("#delete-account-password").trigger("focus");
        return false;    
    }

    showPopup('popup-delete');

    return true;
    
}); 

async function confirmAccountDeletion() {
    
    var currentPass = $("#delete-account-password").val().trim();

    if (loginMethod !== "google.com" && !currentPass) { 
        createPopup("To delete your account, for your safety, you'll need to prove you are indeed who you say you are. To prove your identity please enter your current login password.", "warning");
        return false; 
    }

    $("#delete-account-button").addClass("loading");
    $("#delete-account-confirm-button").addClass("loading");

    var reAuthorized = await reAuthUser(currentPass);
    if (!reAuthorized) { 
        // warning popups are sent in reauth already
        $("#delete-account-button").removeClass("loading");
        $("#delete-account-confirm-button").removeClass("loading");
        return false;
    }

    willLoseAuthForDeletion = true;

    try {
        await theUser.delete();
    } catch (error) {
        handleError("[DELETE ACCOUNT] Failed to delete account", error);
        $("#delete-account-button").removeClass("loading");
        $("#delete-account-confirm-button").removeClass("loading");
        createPopup("Looks we're having a connectivity issue, and couldn't delete your account. Please make sure your internet connection is stable, your browser or ad-blocker is not configured to block any connections from Cryptee and try again.", "error");
        return false;
    }
    
    $("#delete-account-button").removeClass("loading");
    $("#delete-account-confirm-button").removeClass("loading");

    return true;

}