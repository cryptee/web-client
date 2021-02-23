
async function rememberEncryptionKey() {


    // FIRST CHECK IF USER ENTERED ANYTHING AT ALL
    var enteredKey = $("#remember-key-input").val();
    if (!enteredKey) {
        $("#remember-key-input").trigger("focus");
        return false;
    }

    // START LOADING SPINNER
    $("#remember-key-button").addClass("loading");
    breadcrumb('[REMEMBER KEY] Verifying key');
    
    // GET KEYCHECK IF YOU DON'T HAVE IT FOR SOME REASON
    if (!keycheck) { 
        breadcrumb('[REMEMBER KEY] Looks like we dont have a keycheck. Getting keycheck');
        await getKeycheck(); 
    }
    
    if (!keycheck) {
        breadcrumb('[REMEMBER KEY] Failed. Still no keycheck.');
        createPopup("Failed to verify your key. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        $("#remember-key-button").removeClass("loading");
        return false;
    }

    // HASH THE KEY
    var hashedKey, plaintextKey;

    breadcrumb('[REMEMBER KEY] Hashing key.');
    try {
        hashedKey = await hashString(enteredKey);
    } catch (error) {
        handleError("[REMEMBER KEY] Failed to hash key", error);
    }
    
    if (!hashedKey) {
        breadcrumb('[REMEMBER KEY] Failed. There was a problem hashing the key');
        createPopup("Failed to verify your key. Please double check the key you've typed.", "error");
        $("#remember-key-button").removeClass("loading");
        return false;
    }

    // TRY DECRYPTING KEYCHECK, IF IT SUCCEEDS, WE'VE VERIFIED THE KEY, AND YOU CAN REMEMBER THE HASHED KEY
    breadcrumb('[REMEMBER KEY] Testing the key');
    try {
        plaintextKey = await decrypt(keycheck, [hashedKey]);
    } catch (error) {
        handleError("[REMEMBER KEY] Failed to decrypt keycheck", error, "info");
    }

    if (isEmpty(plaintextKey)) {
        breadcrumb('[REMEMBER KEY] Failed. Failed to verify key');
        createPopup("Failed to verify your key. Please double check the key you've typed.", "error");
        $("#remember-key-button").removeClass("loading");
        return false;
    }
    
    // KEY IS CORRECT, REMEMBER THE HASHED KEY
    breadcrumb('[REMEMBER KEY] Verified. Saving to local storage');
    try {
        localStorage.setItem('memorizedKey', JSON.stringify(hashedKey));
    } catch (error) {
        handleError("[REMEMBER KEY] Couldn't set hashed key to local storage", error);
        createPopup("Failed to remember your key. Please make sure your browser / ad-blockers aren't configured to block access to sessionStorage, localStorage or IndexedDB, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        $("#remember-key-button").removeClass("loading");
        return false;
    }

    breadcrumb('[REMEMBER KEY] Done.');
    $("#remember-key-button").removeClass("loading");
    $("button[group='remember-key'][val='dont']").removeClass("selected");
    $("button[group='remember-key'][val='do']").addClass("selected");
    $("#remember-key-save-form").hide();
    $("#remember-key-input").val("");

    createPopup("Done! From now on, Cryptee <b>will</b> remember your encryption key on this device, as long as you stay logged in, and you won't have to type it every time you launch the app.", "success");

    return true;
    
}