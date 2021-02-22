////////////////////////////////////////////////
////////////////////////////////////////////////
// 
//	ALL AUTHENTICATION & KEY MODALS HAPPEN HERE
// 
////////////////////////////////////////////////
////////////////////////////////////////////////









////////////////////////////////////////////////
////////////////////////////////////////////////
//	KEY MODALS
////////////////////////////////////////////////
////////////////////////////////////////////////

function showKeyModal() {
    breadcrumb('[KEY] Showing key modal');
    $("#key-error").removeClass("shown");
    $("#modal-key").removeClass("hide");
    setTimeout(function () {
        $("#key-input").trigger("focus");
    }, 250);
}

function hideKeyModal() {
    breadcrumb('[KEY] Hiding key modal');
    $("#key-input").val("");
    $("#modal-key").addClass("hide");
    
    // since we accept keys on blur as well, once we empty the key input, we want to make sure blur event doesn't try re-start decryption.
    // hence the 10ms delay 
    setTimeout(function () { $("#key-input").trigger("blur"); }, 10);
}









////////////////////////////////////////////////
////////////////////////////////////////////////
//	AUTHENTICATION
////////////////////////////////////////////////
////////////////////////////////////////////////

var theUser, theUserJSON, theUserID, theUsername, theEmail, emailVerified, theUserPlan, thePaymentProcessor, loginMethod, keycheck;
var isPaidUser, usedStorage, allowedStorage, remainingStorage;
var paddleCancelURL, paddleUpdateURL;

/**
 * Authenticate user. This is usually the first thing on every page.
 * @param {function} authenticatedCallback the callback function when the user is authenticated 
 * @param {function} unauthenticatedCallback the callback function when the user is not authenticated (or logged out)
 * @param {function} errorCallback the callback function when auth throws an error
 */
function authenticate(authenticatedCallback, unauthenticatedCallback, errorCallback) {
    
    authenticatedCallback = authenticatedCallback || noop;
    unauthenticatedCallback = unauthenticatedCallback || noop;
    errorCallback = errorCallback || noop;

    var authStartTime = (new Date()).getTime();
    breadcrumb('[AUTH] Re/Authenticating');
    
    firebase.auth().onAuthStateChanged(function(user){
        if (user) {
            // user logged in
            var authEndTime = (new Date()).getTime();
            var timeToAuth = (authEndTime - authStartTime) + "ms";
            
            breadcrumb("[AUTH] Logged In. Took " + timeToAuth);
            setSentryTag("time-to-auth", timeToAuth);
            
            createUserDBReferences(user);

            // CHECK IF USER HAS KEY, AND WE'RE DONE. 
            // IF USER DOESN'T HAVE KEY, WE'LL TAKE TO SIGNUP IN GETKEYCHECK
            getKeycheck().then(()=>{
                getFreshToken(user);
                authenticatedCallback(user);
            });

            getUserInfo();

        } else {
            // if not logged in
            breadcrumb('[AUTH] Not Logged In');

            unauthenticatedCallback();
            
            purgeLocalAndSessionStorage();
            purgeOfflineStorage();
            purgeLocalCache();
        }
    }, function (error) {
        if (error.code !== "auth/network-request-failed") {
            handleError("[AUTH] Error Authenticating", error);
        }
        errorCallback(error);
    });
}


async function getFreshToken(user) {
    breadcrumb("[AUTH] Getting a new token.");
    try {
        await user.getIdTokenResult(true);
    } catch (error) {
        // this is most likely going to get triggered when user gets redirected away too quickly on login / home etc.
        breadcrumb("[AUTH] Error Getting Fresh Token");
    }
    breadcrumb("[AUTH] Got a new token.");
}

////////////////////////////////////////////////
////////////////////////////////////////////////
//
//    REFERENCES TO BE USED IN ALL APPS
// 
////////////////////////////////////////////////
////////////////////////////////////////////////

function createUserDBReferences(user) {
  
    ///////////////////////////////////////
    // REFERENCES TO BE USED IN ALL APPS //
    ///////////////////////////////////////
  
    theUser       = user;
    theUserID     = theUser.uid;
    theEmail      = theUser.email;
    theUserJSON   = theUser.toJSON();
    theUsername   = theUser.displayName;
    emailVerified = theUser.emailVerified;
  
    if (theUserJSON.providerData[0]) {
        providerId = theUserJSON.providerData[0].providerId;
        if (providerId.trim() !== "") {
            loginMethod = providerId; //password //google.com //phone etc
        }
    }

    setSentryUser(theUserID);
    if (theUsername) {
        $('.username').html(theUsername);
    } else {
        $('.username').html(theEmail);
        $('.username').addClass("email-user");
    }

    $('.username').val(theUsername);
    try { localStorage.setItem("username", (theUsername || theEmail)); } catch (e) {}

    if (!theEmail.endsWith("@users.crypt.ee")) {
        $('.email').html(theEmail);
        $('.email').val(theEmail);
        try { localStorage.setItem("email", theEmail); } catch (e) {}
    } else {
        $('.email').html("");
        $('.email').val("");
        try { localStorage.removeItem("email"); } catch (e) {}
    }

    if (!theEmail.endsWith("@users.crypt.ee") && !emailVerified) {
        $(".email").attr("unverified", true);
    }

    if (loginMethod === "google.com") {
        
        $(".for-pass-users").hide();
        $(".for-google-users").show();

    } else {
        
        $(".for-pass-users").show();
        $(".for-google-users").hide();

        if (!theEmail.endsWith("users.crypt.ee")) {
            $("#change-email-tab-button").html("change email");
        } else {
            $("#change-email-tab-button").html("set email");
        }

    }
}









////////////////////////////////////////////////
////////////////////////////////////////////////
//	
//  GET KEYCHECK
//
////////////////////////////////////////////////
////////////////////////////////////////////////

// THIS REQUIRES BUILDING AN API
// IF YOU CAN, SOMEHOW CACHE THIS REQUEST ON THIS DEVICE.
// IT'LL GAIN YOU SPEED & TIME.

/**
 * Get a keycheck, force = true, to get it from server
 * @param {boolean} force
 */
async function getKeycheck(force) {
    
    force = force || false;
    
    try { keycheck = sessionStorage.getItem("ses-keycheck"); } catch (e) {}

    if (keycheck && !force) {
        breadcrumb("[KEYCHECK] Keycheck Complete");
        return keycheck;
    }

    if (!theUserID) { location.href = "/login"; }

    var keycheckResponse;
    try {
        keycheckResponse = await api("user-keycheck");
    } catch (error) {
        // POSSIBLE NETWORK ISSUE OR BAD AUTH TOKEN
        handleError("Couldn't get keycheck due to error", error);
        return false;
    }
    
    if (!keycheckResponse) { 
        // instead of a handleError, we're using a breadcrumb. Here's why.
        // getKeycheck is called in authenticate, and on login / home, if user's redirected before the API responds, we'll get ECONNABORTED, and return false.
        // so this may not be an error – and if it is an error, we'll catch it in "[API] Request to /user-keycheck failed"
        // so here we just have to return false, maybe keep track in a breadcrumb but otherwise move on.
        breadcrumb("Didn't get keycheck response");
        return false;
    }

    if (keycheckResponse.status === 200) {

        // GOT KEYCHECK. SET SESSION KEYCHECK
        breadcrumb("[KEYCHECK] Keycheck Complete");
        keycheck = keycheckResponse.data;
        sessionStorage.setItem("ses-keycheck", keycheck);
        return keycheck;

    } else if (keycheckResponse.status === 404) {

        // USER DOESN'T HAVE KEYCHECK. REDIRECT TO SIGNUP TO SET KEY
        breadcrumb("[KEYCHECK] User doesn't have keycheck, redirecting to signup.");
        location.href = "/signup?status=newuser";
        return false;

    } else {

        // POSSIBLE NETWORK ERROR OR BAD AUTH TOKEN
        handleError("Couldn't get keycheck, response code :" + keycheckResponse.status);
        return false;

    }

}






////////////////////////////////////////////////
////////////////////////////////////////////////
//	CHECK KEY
////////////////////////////////////////////////
////////////////////////////////////////////////

var theKey;
var keyToRemember;
var encryptedKeycheck; // a timestamp encrypted with hashedKey to verify the hashedKey in offline mode.

try {
    if (sessionStorage.getItem('key')) {
        keyToRemember = JSON.parse(sessionStorage.getItem('key')); // hashedKey
        sessionStorage.removeItem('key');
    } 
} catch (e) {
    // sessionStorage blocked, just to silence the errors.
}


try {
    if (localStorage.getItem('memorizedKey')) {
        keyToRemember = JSON.parse(localStorage.getItem('memorizedKey')); // hashedKey
    }

    if (localStorage.getItem("encryptedKeycheck")) {
        encryptedKeycheck = JSON.parse(localStorage.getItem("encryptedKeycheck")).data;
    }
} catch (error) {
    // localStorage blocked, just to silence the errors.
}


$("#key-enter").on('click', function(event) {
    var key = $("#key-input").val();
    checkKey(key);
}); 

$("#key-input").on('keyup', function(event) {
    if (event.key === "Enter") {
        var key = $("#key-input").val();
        checkKey(key);
    }
    activityHappened();
}); 

$("#key-input").on('blur', function(event) {
    var key = $("#key-input").val();
    if (key) { checkKey(key); }
}); 





function checkKey(key, checkOfflineKey) {
    key = key || $("#key-input").val();
    
    // if it's docs, check if we started offline, otherwise, check if we have an offline key
    if (location.pathname === "/docs") {
        startedOffline = startedOffline || false;
        checkOfflineKey = checkOfflineKey || startedOffline || false;
    } else {
        checkOfflineKey = checkOfflineKey || false;
    }
    
    if (key) {
        breadcrumb('[KEY] Checking key');
        startKeyProgress();
        // modal already shown, and user typed key into modal, check it

        hashString(key).then(function (hashedKey) {
            checkHashedKey(hashedKey);
        }).catch(function (e) {
            handleError("[KEY] Error hashing/checking key", e, "fatal");
            wrongKey("error. please try again shortly");
        });
          
    } else {
        // check if there's a saved key, and try checking that, 
        // if not, show key modal
        
        if (keyToRemember) {
            breadcrumb('[KEY] Checking saved key');
            setSentryTag("rememberKey", true);

            var hashedKey = keyToRemember;
            checkHashedKey(hashedKey);
        } else {
            showKeyModal();
        }
        
    }

    function checkHashedKey(hashedKey) {
        
        if (!checkOfflineKey) {
            
            // ONLINE MODE (uses an online keycheck)
            
            if (!keycheck) {
                wrongKey("we're having trouble logging you in. <br>this is most likely a connectivity issue. <br>please try disabling your ad blockers <br>or dns filters if you have any, and try again<br><br>");
            } else {
                decrypt(keycheck, [hashedKey]).then(function (plaintextKey) {
                    rightKey(plaintextKey, hashedKey);
                }).catch(function (error) {
                    wrongKey("wrong key", hashedKey);
                });
            }

        } else {

            // OFFLINE MODE (uses offline encrypted keycheck)

            if (!encryptedKeycheck) {
                wrongKey("it seems like you're offline and we couldn't verify your identity. <br>in order to start using offline mode, you'll need to enter your key at least once when you're online on this device.");
            } else {
                decrypt(encryptedKeycheck, [hashedKey]).then(function (plaintextKey) {
                    rightKey(plaintextKey, hashedKey);
                }).catch(function (error) {
                    wrongKey("wrong key", hashedKey);
                });
            }

        }
    }
}






function wrongKey(description, hashedKey) {
    hashedKey = hashedKey || "";
    stopKeyProgress();
    
    try {
        sessionStorage.removeItem('key');
        localStorage.removeItem('memorizedKey');
    } catch (e) {}
    
    // the typed key or memorized key is wrong
    breadcrumb('[KEY] Wrong Key');
    $("#key-error").addClass("shown");
    $("#key-progress").addClass("error");

    if (description) {
        $("#key-error-description").html(description); 
    }
    
}







function rightKey(plaintextKey, hashedKey) {
    theKey = plaintextKey.data; // theStrongKey
    keyToRemember = hashedKey;
    
    stopKeyProgress();
    hideKeyModal();
    
    newEncryptedKeycheck(hashedKey);
    
    // THIS IS DEFINED IN EACH APP
    startup = startup || noop;
    startup();
}



/**
 * Encrypts a timestamp using the hashedKey, (to be saved to localstore in apps, where in the future, we can use this when we're offline to verify the entered encryption key is correct.)
 * @param {string} hashedKey 
 * @param {function} callback 
 */
function newEncryptedKeycheck(hashedKey) {
    var now = ((new Date()).getTime()).toString();
    encrypt(now, [hashedKey]).then(function (ciphertext) {
        try { localStorage.setItem("encryptedKeycheck", JSON.stringify(ciphertext)); } catch (e) {}
    }).catch(function (error) {
        handleError("Couldn't encrypt a new keycheck. Continuing.");
    });
}
  





function startKeyProgress() {
    $("#key-progress").attr("value", "");
    $("#key-progress").attr("max", "");
}

function stopKeyProgress() {
    $("#key-progress").attr("value", 100);
    $("#key-progress").attr("max", 100);
}


















////////////////////////////////////////////////
////////////////////////////////////////////////
//	
// GET USER INFO / GOT USER INFO
// (formerly getUserMeta etc)
// 
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * THIS GETS THE USER INFO, formerly getUserMeta, but now also returns user data.
 */
async function getUserInfo() {
    var userInfoResponse;

    try {
        userInfoResponse = await api("user-info");
    } catch (error) {
        // POSSIBLE NETWORK ISSUE OR BAD AUTH TOKEN
        handleError("Couldn't get user info due to error", error);
        return false;
    }

    if (!userInfoResponse) {
        // instead of a handleError, we're using a breadcrumb. Here's why.
        // getUserInfo is called in authenticate, and on login / home, if user's redirected before the API responds, we'll get ECONNABORTED, and return false.
        // so this may not be an error – and if it is an error, we'll catch it in "[API] Request to /user-info failed"
        // so here we just have to return false, maybe keep track in a breadcrumb but otherwise move on.
        breadcrumb("[USER INFO] Didn't get user info response");
        return false;
    }

    if (userInfoResponse.status === 200) {

        // GOT USER INFO. 
        breadcrumb("[USER INFO] Got user info");

        var userInfo = userInfoResponse.data;
        
        // here for posterity if you need it
        // if (userInfo.data)   { gotUserData(userInfo.data); }
        if (userInfo.meta)   { gotUserMeta(userInfo.meta, userInfo.stripe); }

        return userInfo;

    } else if (userInfoResponse.status === 404) {

        handleError("[USER INFO] User doesn't have info.");
        return false;

    } else {

        // POSSIBLE NETWORK ERROR OR BAD AUTH TOKEN
        handleError("Couldn't get user info, response code :" + userInfoResponse.status);
        return false;

    }

}


// here for posterity if you need it
// function gotUserData(data) { }



function gotUserMeta(meta, stripe) {
    if (!meta) { return; }
    
    if (meta.usedStorage >= 0) { usedStorage = meta.usedStorage || 0; } else { usedStorage = 0; }
    if (meta.allowedStorage)   { allowedStorage = meta.allowedStorage; }
    
    remainingStorage = allowedStorage - usedStorage;

    theUserPlan = meta.plan || "free";
    if (meta.updateurl || stripe) {
        if (stripe) {
            thePaymentProcessor = "stripe";
        } else {
            thePaymentProcessor = "paddle";
            paddleCancelURL = meta.cancelurl;
            paddleUpdateURL = meta.updateurl;
        }
    }

    if (thePaymentProcessor && location.pathname === "/account") {
        getPaymentMethodUpdateURL();
    }

    updateUserInLS();
}







////////////////////////////////////////////////
////////////////////////////////////////////////
//	USER IN LOCAL STORAGE FOR QUICK START
////////////////////////////////////////////////
////////////////////////////////////////////////

function updateUserInLS() {
    try {
        if (theUsername || theEmail) { localStorage.setItem("username", (theUsername || theEmail)); }
        
        if (theEmail && !theEmail.endsWith("@users.crypt.ee")) { 
            localStorage.setItem("email", theEmail); 
        } else {
            localStorage.removeItem("email"); 
        }

        
        localStorage.setItem("usedStorage", (usedStorage || 0)); 
        setSentryTag("usedStorage", formatBytes(usedStorage));
        

        if (allowedStorage) { 
            localStorage.setItem("allowedStorage", allowedStorage); 
            setSentryTag("allowedStorage", formatBytes(allowedStorage));
        }
        
        updateRemainingStorage(remainingStorage);
        
        if (theUserPlan && theUserPlan !== "free") {
            localStorage.setItem("plan", theUserPlan); 
        } else {
            localStorage.removeItem("plan");
        }

        if (thePaymentProcessor) {
            localStorage.setItem("paymentProcessor", thePaymentProcessor); 
        } else {
            localStorage.removeItem("paymentProcessor"); 
        }

        plansUpdated();
        gotPaymentProcessor();

        breadcrumb("[LS] Updated LS");
    } catch (e) {
        breadcrumb("[LS] Couldn't update user in LS, LS likely disabled");
    }
}


function restoreUserFromLS() {
    try {
        
        var username = localStorage.getItem("username");
        var email = localStorage.getItem("email");
        
        if (username) {
            $('.username').html(username);
        } else {
            $('.username').html(email);
            $('.username').addClass("email-user");
        }

        $('.username').val(username);

        $('.email').html(email);
        $('.email').val(email);

        allowedStorage = localStorage.getItem("allowedStorage");
        var formattedAllowedStorage = (formatBytes(allowedStorage) || "").toLowerCase();
        var allowedStorageInt = parseFloat(formattedAllowedStorage);
        var allowedStorageUnit = formattedAllowedStorage.split(allowedStorageInt)[1];
        $(".allowedStorage").html(allowedStorageInt);
        $(".allowedStorageUnit").html(allowedStorageUnit);

        usedStorage = localStorage.getItem("usedStorage") || 0;
        var formattedUsedStorage = (formatBytes(usedStorage) || "").toLowerCase();
        var usedStorageInt = parseFloat(formattedUsedStorage);
        var usedStorageUnit = formattedUsedStorage.split(usedStorageInt)[1];
        $(".usedStorage").html(usedStorageInt);
        $(".usedStorageUnit").html(usedStorageUnit);

        remainingStorage = localStorage.getItem("remainingStorage");
        updateRemainingStorage(remainingStorage);

        theUserPlan = localStorage.getItem("plan");
        plansUpdated();

        thePaymentProcessor = localStorage.getItem("paymentProcessor"); 
        gotPaymentProcessor();

    } catch (e) {
        breadcrumb("Couldn't get user from LS, LS likely disabled");    
    }
}


restoreUserFromLS();




////////////////////////////////////////////////
////////////////////////////////////////////////
//	PLANS MANAGEMENT 
////////////////////////////////////////////////
////////////////////////////////////////////////


function plansUpdated() {
    if (theUserPlan && theUserPlan !== "free") { 
        $("#upgrade").hide(); 
        
        $(".for-paid-users").show();
        $(".for-free-users").hide();

        setSentryTag("plan", theUserPlan);
        setSentryTag("paid", true);
    } else {
        $("#upgrade").show(); 
        
        $(".for-paid-users").hide();
        $(".for-free-users").show();

        setSentryTag("plan", "free");
        setSentryTag("paid", false);
    }
}


function gotPaymentProcessor() {
    if (thePaymentProcessor === "stripe") {
        $(".for-stripe-users").show();
        $(".for-paddle-users").hide();
    } else {
        $(".for-paddle-users").show();
        $(".for-stripe-users").hide();
    }
}




/**
 * Checks remaining storage, and displays warning if user has exceeded their storage quota
 */
function checkAndWarnForExceededStorageIfNecessary() {
    if (remainingStorage <= 0) {
        breadcrumb('[EXCEEDED STORAGE] Will show exceeded / upgrade prompt'); 
        setTimeout(function () {
            breadcrumb('[EXCEEDED STORAGE] Showing upgrade prompt'); 
            showModal("modal-exceeded-storage");
        }, 2000);
    }
}



function updateRemainingStorage(rs) {
    rs = parseInt(rs);
    localStorage.setItem("remainingStorage", rs); 
    var formattedRemainingStorage = (formatBytes(rs) || "").toLowerCase();
    $(".remainingStorage").html(formattedRemainingStorage);
    setSentryTag("remainingStorage", formatBytes(rs));
    remainingStorage = rs;

    checkAndWarnForExceededStorageIfNecessary();
}






////////////////////////////////////////////////
////////////////////////////////////////////////
//	GET UPDATED REMAINING STORAGE
////////////////////////////////////////////////
////////////////////////////////////////////////


/**
 * THIS GETS THE REMAINING STORAGE.
 */
async function getUpdatedRemainingStorage() {
    var remainingStorageResponse;

    try {
        remainingStorageResponse = await api("user-allowance");
    } catch (error) {
        // POSSIBLE NETWORK ISSUE OR BAD AUTH TOKEN
        handleError("Couldn't get user allowance due to error", error);
        return false;
    }

    if (!remainingStorageResponse) {
        handleError("Didn't get user allowance response");
        return false;
    }

    if (remainingStorageResponse.status === 200) {

        // GOT USER INFO. 
        var remainingStorage = remainingStorageResponse.data;
        
        breadcrumb("[USER ALLOWANCE] " + formatBytes(remainingStorage) + " storage left.");
        
        updateRemainingStorage(remainingStorage);
        
        return remainingStorage;

    } else {

        // POSSIBLE NETWORK ERROR OR BAD AUTH TOKEN
        handleError("Couldn't get user allowance, response code :" + remainingStorageResponse.status);
        return false;

    }

}











////////////////////////////////////////////////
////////////////////////////////////////////////
//	LOG OUT 
////////////////////////////////////////////////
////////////////////////////////////////////////

function logOut() {
    
    purgeLocalAndSessionStorage();
    purgeOfflineStorage();
    purgeLocalCache();

    firebase.auth().signOut().then(function () {
        
        purgeLocalAndSessionStorage();
        purgeOfflineStorage();
        purgeLocalCache();

        console.log('[LOGGED OUT]');
        
        if (location.pathname === "/login") { 
            location.reload(); 
        } else {
            location.href = "/login";
        }
    }, function (error) {
        handleError("Error logging out", error);
    });
}


function purgeOfflineStorage () {
    try {
        if (Dexie) { 
            var catalog = new Dexie("catalog"); 

            catalog.version(1).stores({
                docs: 'docid, title, decryptedTitle, tags, decryptedTags, generation, fid',
                offline: 'docid',
                folders:'folderid, parent, title, decryptedTitle'
            });

            catalog.offline.clear();
        }
    } catch (e) {}
}

function purgeLocalCache() {
    try {
        if (Dexie) { 
            var catalog = new Dexie("catalog"); 

            catalog.version(1).stores({
                docs: 'docid, title, decryptedTitle, tags, decryptedTags, generation, fid',
                offline: 'docid',
                folders:'folderid, parent, title, decryptedTitle'
            });
            
            catalog.docs.clear();
            catalog.folders.clear();
        }
    } catch (e) {}
}

function purgeLocalAndSessionStorage() {
    try { sessionStorage.clear(); } catch (e) {}
    try { localStorage.clear();   } catch (e) {}
}