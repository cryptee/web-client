var passScore, keyScore;
var useGoogle = false;
var useEmail = false;

var theUser, theUserID;

////////////////////////////////////////////////
////////////////////////////////////////////////
//	UI
////////////////////////////////////////////////
////////////////////////////////////////////////

$('#next').on('click', submitStep1); 
$('#signup').on('click', submitStep2);
$("#bigg").on('click', skipStep1);

$('#keyinfo').on('click', function() {
    showPopup("popup-signup", "In addition to the login password, Cryptee also uses a data encryption key to encrypt &amp; decrypt your data on your device, so that it's accessible only by you. The key never leaves your device, and it's never sent to any servers.<br><br><br>");
}); 

function passColor(color) {
    $("#password-strength, #password-strength-message").removeClass("yellow red green"); 
    $("#password-strength, #password-strength-message").addClass(color); 
}

function keyColor(color) {
    $("#key-strength").removeClass("yellow red green"); 
    $("#key-strength").addClass(color); 
}

$(document).on('ready', function(event) {
    $("#email").trigger("focus");
}); 

////////////////////////////////////////////////
////////////////////////////////////////////////
//	CHECK USERNAME / EMAIL / KEY
////////////////////////////////////////////////
////////////////////////////////////////////////

$("#email").on('keydown keypress paste copy cut change', function(event) {
    setTimeout(function () {
        var value = $("#email").val().trim();
        if (value && value.includes("@") && !isEmail(value)) {
            // show email must be valid note
            $("#email-notice").addClass("show");
        } else {
            $("#email-notice").removeClass("show");
        }
    }, 50);
}); 


$("#pswrd").on('keydown keypress paste copy cut change', function(event) {
    var key = event.key;
    setTimeout(function () {
        
        var first64DigitsOfPassword = $("#pswrd").val().trim().substring(0,64);
        passScore = zxcvbn(first64DigitsOfPassword).score;

        if (passScore === 0) {
            $("#password-strength-message").html("too weak");
            $("#password-strength").attr("value", 5);
            passColor("red");
        }
        
        else if (passScore === 1) {
            $("#password-strength-message").html("weak");
            $("#password-strength").attr("value", 10);
            passColor("red");
        }
        
        else if (passScore === 2) {
            $("#password-strength-message").html("fair");
            $("#password-strength").attr("value", 40);
            passColor("yellow");
        }
        
        else if (passScore === 3) {
            $("#password-strength-message").html("good enough");
            $("#password-strength").attr("value", 75);
            passColor("green");
        }
        
        else {
            $("#password-strength").attr("value", 100);
            passColor("green");
            
            if (first64DigitsOfPassword.length >= 32) {
                $("#password-strength-message").html("amazing!");
            } else {
                $("#password-strength-message").html("excellent");
            }
        }
        
        // password must be at least 6 characters
        if (first64DigitsOfPassword.length < 6) {
            $("#password-strength-message").html("minimum 6 characters");
            $("#password-strength").attr("value", 5);
            passColor("red");
        }

        if (first64DigitsOfPassword.length === 0) {
            $("#password-strength-message").html(" &nbsp; ");
            $("#password-strength").attr("value", 0); 
            passColor("red");
        }

        if (key === "Enter") {
            submitStep1();
        }
        
        if (key === "Tab" && $("#pswrd").val().trim().length === 0) {
            $("#email").trigger("focus");
        }
    }, 50);
}); 



$("#key").on('keydown keypress paste copy cut change', function(event) {

    setTimeout(function () {
        
        var first64DigitsOfKey = $("#key").val().substring(0,64);
        keyScore = zxcvbn(first64DigitsOfKey).score;

        if (keyScore === 0) {
            $("#key-strength").attr("value", 25);
            $("#signup").attr("disabled", true); 
            keyColor("red");
        }
        
        else if (keyScore === 1) {
            $("#key-strength").attr("value", 35);
            $("#signup").removeAttr("disabled");
            keyColor("yellow");
        }
        
        else if (keyScore === 2) {
            $("#key-strength").attr("value", 65);
            $("#signup").removeAttr("disabled");
            keyColor("green");
        }
        
        else if (keyScore === 3) {
            $("#key-strength").attr("value", 75);
            $("#signup").removeAttr("disabled");
            keyColor("green");
        }
        
        else {
            $("#key-strength").attr("value", 100);
            $("#signup").removeAttr("disabled");
            keyColor("green");
        }
        
        if (first64DigitsOfKey.length === 0) {
            $("#key-strength").attr("value", 0); 
            keyColor("red");
        }

    }, 50);

}); 


////////////////////////////////////////////////
////////////////////////////////////////////////
//	VALIDATION
////////////////////////////////////////////////
////////////////////////////////////////////////

function submitStep1() {
    breadcrumb('[SIGNUP] Submitted Step 1');

    // check there's a username / email in the first place
    var usernameOrEmail = $("#email").val().trim();
    if (!usernameOrEmail) {
        $("#email").trigger("focus");
        return;
    }

    // if it's an email, check it's valid
    if (usernameOrEmail && usernameOrEmail.includes("@") && !isEmail(usernameOrEmail)) {
        $("#email").trigger("focus");
        return;
    }

    // check pass is strong enough for step 1
    if (!passScore || passScore < 2) { 
        $("#pswrd").trigger("focus");
        return;
    }

    // submit step 1, and go to step 2
    useEmail = true;
    $("#email, #pswrd").trigger("blur");
    $("#signup-wrap").attr("step", "2");
    $("#key, #signup").removeAttr("tabindex");
    
    setTimeout(function () {
        $("#key").trigger("focus");
    }, 250);

    return;
}



// for google, we can skip step 1
function skipStep1() {
    
    breadcrumb('[SIGNUP] Skipped Step 1');

    // submit step 1, and go to step 2
    useGoogle = true;
    $("#email, #pswrd").trigger("blur");
    $("#signup-wrap").attr("step", "2");
    $("#key, #signup").removeAttr("tabindex");
    
    setTimeout(function () {
        $("#key").trigger("focus");
    }, 250);

    return;

}



async function submitStep2() {
    
    breadcrumb('[SIGNUP] Submitted Step 2');

    // check pass is strong enough for step 1
    if (keyScore < 1) { 
        $("#key").trigger("focus");
        return;
    }

    // CHECK TO SEE IF KEY IS THE SAME AS ACCOUNT PASSWORD
    var chosenKey  = $("#key").val(); // this is not a mistake, we do not trim keys, maybe user wants a space.
    var chosenPass = $("#pswrd").val().trim();

    if (chosenKey === chosenPass) {
        showPopup("popup-signup", "for your own safety &amp; privacy, Your key can't be the same as the account password you chose in the previous step. Please pick another encryption key.");
        return;
    }

    // CHECK TO SEE IF WE CAN HASH THE KEY
    var hashedKey; 
    try {
        hashedKey = await hashString(chosenKey);
    } catch (error) {
        handleError("[SIGNUP] Failed to hash the key", error);
        showPopup("popup-signup", "Looks like your key contains a special character that isn't safe to use. Please pick another encryption key.");
        return;
    } 

    // SUBMIT STEP 2, SEND FORM
    $("#signup-wrap").attr("step", "3");
    
    hidePopup("popup-signup");

    startSignup();
}



async function startSignup() {

    if (useGoogle) {
        
        if (!theUser) {
            
            var provider = new firebase.auth.GoogleAuthProvider();
            provider.addScope('email');
    
            var gUserCredentials;
            try {
                gUserCredentials = await firebase.auth().signInWithPopup(provider);
            } catch (error) {
                googleSignupError(error);
                return;
            }
            
            theUser = gUserCredentials.user;
            theUserID = theUser.uid;

        } else {
            // we have a user = meaning :
            // user signed up on the login page, 
            // we took the user to this page to generate key. 
            // let's double check, and create user in db if this is the case. 
            if (getUrlParameter("status") === "newuser") {
                createUserInDB();
            }
        }

    } else {

        var usernameOrEmail = $("#email").val().trim();
        if (usernameOrEmail && !usernameOrEmail.includes("@")) {
            usernameOrEmail = usernameOrEmail + "@users.crypt.ee";
        }
        var chosenEmail = usernameOrEmail;
        var chosenPass = $("#pswrd").val().trim();

        var userCredentials; 
        try {
            userCredentials = await firebase.auth().createUserWithEmailAndPassword(chosenEmail, chosenPass);
        } catch (error) {
            usernamePassSignupError(error);
            return;
        }

        theUser = userCredentials.user;
        theUserID = theUser.uid;
    }
    
    setSentryUser(theUserID);
    breadcrumb("[SIGNUP] Created User");
}



function usernamePassSignupError(error) {
    var errorCode = error.code;

    if (errorCode == 'auth/weak-password') {
        showPopup("popup-signup", "Our servers think the password you picked seems too weak. please pick another account password.");
        breadcrumb('[SIGNUP] Server thinks password is too weak');
        $("#signup-wrap").attr("step", "1");
    } else if (errorCode == 'auth/email-already-in-use') {
        showPopup("popup-signup", "Seems like the username or email you picked is already in use. please pick another username, or use another email address.");
        breadcrumb('[SIGNUP] Username / Email already in use');
        $("#signup-wrap").attr("step", "1");
    } else if (errorCode == 'auth/invalid-email') {
        showPopup("popup-signup", "Our servers think you may have used an invalid character in your username. No @ symbols or spaces please.");
        breadcrumb('[SIGNUP] Invalid character in username / email');
        $("#signup-wrap").attr("step", "1");
    } else {
        handleError("[SIGNUP] Failed to create user with email & pass – likely blocker", error, "warning");
        showPopup("popup-signup", "Seems like we're having a connectivity issue. Chances are your browser, ad-blocker or dns-based-filters are mistakenly blocking access to a resource Cryptee needs to complete your sign up. Please disable your ad-blocker / dns filters temporarily and try again.");
    }

}


function googleSignupError(error) {
    if (error.code !== "auth/missing-or-invalid-nonce") {
        console.log(error); // replacing this with a traditional console log because it only throws "user cancelled / closed popup error"
        showPopup("popup-signup", "Seems like we're having a connectivity issue. Chances are your browser, ad-blocker or dns-based-filters are mistakenly blocking access to Google, which Cryptee needs to contact to complete your sign up with Google Auth. Please disable your ad-blocker / dns filters temporarily and try again.");
    }
}


// THIS IS THE FUNCTION THAT SAVES ALL NECESSARY USER PROPERTIES TO USER PROFILE, AUTH & DB
// AFTER WE GET AUTHENTICATED
async function createUserInDB() {
    
    if (!useGoogle && !useEmail) {
        // PROBLEM. THIS SHOULDN'T EVER HAPPEN. BUT JUST IN CASE.
        // THIS IS NOT A NORMAL SIGNUP. 
        
        if (getUrlParameter("status") === "newuser") {
            // USER LOGGED IN USING GOOGLE ON LOGIN SCREEN, SKIP TO STEP 1
            handleError("[SIGNUP] User chose neither Google nor Email, but tried creating user in DB. Looks like a 'new-user' from login page, taking to step 1.");
            skipStep1(); 
            return;
        } else {
            handleError("[SIGNUP] User chose neither Google nor Email, but tried creating user in DB. Aborting.");
            showPopup("popup-signup", "Seems like we're having an issue creating your account. Chances are your browser, ad-blocker or dns-based-filters are mistakenly blocking access to a resource Cryptee needs to complete your sign up. Please disable your ad-blocker / dns filters temporarily and try again.");
            return;
        }

    }

    // user is using a username / email, so let's first set their username & send a verification email.
    if (useEmail) {
        var usernameOrEmail = $("#email").val().trim();
        if (usernameOrEmail && !usernameOrEmail.includes("@")) {
            
            // it's a username, try setting username
            
            try {
                await theUser.updateProfile({ displayName : usernameOrEmail });
            } catch (error) {
                handleError("[SIGNUP] Failed to save user's username", error, "warning");
            }

        } else {
            
            // it's an email, send verification email
            
            try {
                await theUser.sendEmailVerification();
            } catch (error) {
                handleError("[SIGNUP] Failed to send verification email", error, "warning");
            }
            
        }
    }

    // user is using a google login OR an email.
    // since google logins don't require verification / displayName updates,
    // we're continuing as expected

    var stringifiedWrappedKey = await prepareUserKey();

    if (!stringifiedWrappedKey) {
        showPopup("popup-signup", "Seems like we're having an issue creating your account. Chances are your browser or ad-blocker is mistakenly blocking access to a cryptographic resource Cryptee requires to complete your sign up. Please disable your ad-blocker temporarily and try again.");
        return;
    }

    // save wrapped key

    var savedKeycheck = await saveWrappedKey(stringifiedWrappedKey);
    if (!savedKeycheck) {
        showPopup("popup-signup", "Seems like we're having an issue creating your account. Chances are your browser, ad-blocker or dns-based-filters are mistakenly blocking access to a resource Cryptee needs to complete your sign up. Please disable your ad-blocker / dns filters temporarily and try again.");
        return;
    }

    // saved key, signup complete, we're good to go.
    
    try { sessionStorage.setItem("newsignup", true); } catch (error) {}

    window.location = "/home";

}


async function prepareUserKey() {

    // key encryption key
    var chosenKEK = $("#key").val(); // this is not a mistake, we do not trim keys, maybe user wants a space.

    var stringifiedWrappedKey;

    try {
        var hashedKEK = await hashString(chosenKEK); 
        
        // data encryption key
        var dataEncryptionKey = generateStrongKey();
    
        // encrypt data encryption key using the hashed key encryption key
        var wrappedKey = await encrypt(dataEncryptionKey, [hashedKEK]);
        
        // stringify wrapped key
        stringifiedWrappedKey = JSON.stringify(wrappedKey);
    } catch (error) {
        handleError("[SIGNUP] Failed to hash / encrypt / wrap / stringify user key.", error);
    }

    return stringifiedWrappedKey;

}


async function saveWrappedKey(wrappedKey) {
    
    if (!wrappedKey) {
        handleError("[SAVE NEW USER] Can't save new user without a keycheck.");
        return false;
    }
    
    var apiResponse; 

    try {
        apiResponse = await api("user-new", {}, { keycheck : wrappedKey }, "POST");
    } catch (error) {
        handleError("[SAVE NEW USER] API had an error.", error);
        return false;
    }

    if (!apiResponse) {
        handleError("[SAVE NEW USER] Didn't get a response from the API.");
        return false;
    }

    if (apiResponse.status !== 200) {
        handleError("[SAVE NEW USER] API had an error: " + apiResponse.status);
        return false;
    }

    return true;

}






////////////////////////////////////////////////
////////////////////////////////////////////////
//
//	AUTH
//
////////////////////////////////////////////////
////////////////////////////////////////////////

// THERE ARE A FEW THINGS THAT COULD HAPPEN HERE. 

// 1) USER CREATED NEW ACCOUNT WITH EMAIL, AND WE GOT AUTH
// 2) USER CREATED NEW ACCOUNT WITH GOOGLE, AND WE GOT AUTH
// 3) USER STARTED CREATED ACCOUNT WITH GOOGLE ON LOGIN SCREEN, SO HAS NO KEY, AND WE NEED TO SET A KEY HERE
// 4) EXISTING USER, WHO ACCIDENTALLY CAME TO SIGNUP PAGE.

// SO ONCE WE GET AUTH, WE'LL HAVE TO HANDLE THESE 4 SCENARIOS GRACEFULLY.


firebase.auth().onAuthStateChanged(function (user) {
    if (!user) { return; } // got no user, carry on. 

    theUser = user;
    theUserID = theUser.uid;
    setSentryUser(theUserID);

    // (scenario 1) user signed up using email
    // OR
    // (scenario 2) user signed up using google
    if (useEmail || useGoogle)  { 
        breadcrumb('[SIGNUP] Authenticated! User signed up with email or google.');
        createUserInDB(); 
        return;
    }
    
    // (scenario 3) user created new account with google on login screen, and has no key, so we need to set a key.
    if (getUrlParameter("status") === "newuser") {
        theUser.getIdToken(true).then((idTokenResult) => {
            var keycheckClaim; 
            try { keycheckClaim = idTokenResult.claims.keycheck; } catch (error) {}

            if (!keycheckClaim) {
                breadcrumb('[SIGNUP] Authenticated! User signed up with google on login page. Asking for a key now.');
                skipStep1();
                return;  
            } else {
                // a regular user who came to the sign in page right after they signed up – so their token didn't have the keycheck claim
                breadcrumb('[SIGNUP] Authenticated! Likely an existing user, logging out for safety.');
                logOut();
                return;
            }
        });
    }
    
    // scenario 4 – just a regular user, who accidentally came to the signup page. 
    // in the interest of not fucking things up even more, we'll sign them out. 

    breadcrumb('[SIGNUP] Authenticated! Likely an existing user, logging out for safety.');
    logOut();

}, function (error) {
    handleError("[SIGNUP] Failed to authenticate – likely blocker", error, "warning");
    showPopup("popup-signup", "Seems like we're having a connectivity issue. Chances are your browser, ad-blocker or dns-based-filters are mistakenly blocking access to a resource Cryptee needs to complete your sign up. Please disable your ad-blocker / dns filters temporarily and try again.");
});