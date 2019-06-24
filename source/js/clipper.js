////////////////////////////////////////////////////
////////////////// ALL GLOBAL VARS /////////////////
////////////////////////////////////////////////////

var theKey;
var keyToRemember = JSON.parse(sessionStorage.getItem('key')); // hashedKey
sessionStorage.removeItem('key');

if (localStorage.getItem('memorizedKey')) {
    keyToRemember = JSON.parse(localStorage.getItem('memorizedKey')); // hashedKey
}

var connected = false;

checkLatestVersion();

////////////////////////////////////////////////////
////////////////// SIGN IN AND KEY /////////////////
////////////////////////////////////////////////////

firebase.auth().onAuthStateChanged(function (user) {
    if (user) {
        //got user
                    
        createUserDBReferences(user);

        checkForExistingUser(function () {
            if (keyToRemember) {
                checkKey();
            } else {
                $("html, body").removeClass("pending");
                showKeyModal();
            }
        });

        getToken();
        webAppURLController();
    } else {
        // no user. redirect to sign in IF NOT WEBAPP
        webAppURLController("signin?redirect=clipper");
    }
}, function (error) {
    if (error.code !== "auth/network-request-failed") {
        handleError("Error Authenticating", error);
    }
});

function checkForExistingUser(callback) {
    callback = callback || noop;

    db.ref('/users/' + theUserID + "/data/keycheck").once('value').then(function (snapshot) {
        if (snapshot.val() === null) {
            window.location = "signup?status=newuser";
        } else {
            callback();
        }
    });

}

function checkKey(key) {
    db.ref('/users/' + theUserID + "/data/keycheck").once('value').then(function (snapshot) {
        var encryptedStrongKey = JSON.parse(snapshot.val()).data; // or encrypted checkstring for legacy accounts
        
        $("html, body").removeClass("pending");

        if (key) {
            hashString(key).then(function (hashedKey) {
                checkHashedKey(hashedKey);
            }).catch(function (e) {
                wrongKey("Wide Character Error");
            });
        } else {
            hashedKey = keyToRemember;
            checkHashedKey(hashedKey);
        }

        function checkHashedKey(hashedKey) {
            decrypt(encryptedStrongKey, [hashedKey]).then(function (plaintext) {
                rightKey(plaintext, hashedKey);
            }).catch(function (error) {
                checkLegacyKey(dataRef, key, hashedKey, encryptedStrongKey, function (plaintext) {
                    rightKey(plaintext, hashedKey);
                    // if it's wrong, wrongKey() will be called in checkLegacyKey in main.js
                });
            });
        }

    });
}

function rightKey(plaintext, hashedKey) {
    var theStrongKey = plaintext.data;

    $("#key-modal-decrypt-button").removeClass("is-loading");
    $("#key-status").removeClass("shown");
    $("#key-modal-signout-button").removeClass("shown");

    hideKeyModal();
    theKey = theStrongKey;
    keyToRemember = hashedKey;

    newEncryptedKeycheck(hashedKey, function (newKeycheck) {
        var encryptedKeycheck = newKeycheck; // here we encrypt a timestamp using the hashedKey, and save this to localstore.
        localStorage.setItem("encryptedKeycheck", encryptedKeycheck); // we will use this in docs offline mode to verify the entered encryption key is correct.
        signInComplete();
    });
}

function signInComplete() {
    breadcrumb('Sign in Complete');
    var isClipperAuthenticated = $("#clipperAuthenticated").attr("content");
    if (isClipperAuthenticated === true || isClipperAuthenticated === "true") {
        breadcrumb('Clipper Already Authenticated');
        $("#already").removeClass("hidden");
    } else {
        $("#authenticating").removeClass("hidden");
        generateClipperAuthObject();
    }
}








var crypteeClipperAuthObject;
var checkerInterval;
var clipperKey;
var clipperToken;
var uid;
function generateClipperAuthObject() {
    breadcrumb('Generating Clipper Auth Object');
    clipperKey = generateStrongKey();
    clipperToken = newUUID(128);
    uid = theUserID;

    breadcrumb('Waiting for "CREATE" msg from extension');
    checkerInterval = setInterval(function(){
        shouldItStartAuthProcess();
    }, 100);
}


function shouldItStartAuthProcess() {
    if ($("#create").attr("content") === "true" || $("#create").attr("content") === true) {
        clearInterval(checkerInterval);
        encryptAndUploadClipperCredentials();
    }
}

function encryptAndUploadClipperCredentials() {
    breadcrumb('Encrypting Clipper Credentials');

    encrypt(clipperKey, [theKey]).then(function(ciphertext) {
        var encryptedClipperKey = JSON.stringify(ciphertext);
        var clipperID = (new Date()).getTime();
        var newClipperData = {};
        newClipperData[clipperID] = {
            "token": clipperToken,
            "key" : encryptedClipperKey,
            "browser" : browserName(),
            "os": browserOS()
        };
        breadcrumb('Encrypted Clipper Credentials');

        dataRef.child("clippers").update(newClipperData, function(error){
          if (error) {
            handleError("Error saving new clipper to server", error);
          } else {
            $("#uid").attr("content", uid);
            $("#clipperKey").attr("content", clipperKey);
            $("#clipperToken").attr("content", clipperToken);
            breadcrumb('Uploaded Encrypted Clipper Credentials');
            $("#authenticating").slideUp(function(){
                $("#done").addClass("visible");
            });
          }
        });
    });
    
}

function browserName () {
    var ua=navigator.userAgent,tem,M=ua.match(/(opera|chrome|safari|firefox|msie|trident(?=\/))\/?\s*(\d+)/i) || []; 
    if(/trident/i.test(M[1])){
        tem=/\brv[ :]+(\d+)/g.exec(ua) || []; 
        return {name:'IE ',version:(tem[1]||'')};
        }   
    if(M[1]==='Chrome'){
        tem=ua.match(/\bOPR\/(\d+)/)
        if(tem!=null)   {return {name:'Opera', version:tem[1]};}
        }   
    M=M[2]? [M[1], M[2]]: [navigator.appName, navigator.appVersion, '-?'];
    if((tem=ua.match(/version\/(\d+)/i))!=null) {M.splice(1,1,tem[1]);}
    return M[0] || "Unknown Browser";
}

function browserOS() {
    var userAgent = window.navigator.userAgent,
        platform = window.navigator.platform,
        macosPlatforms = ['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'],
        windowsPlatforms = ['Win32', 'Win64', 'Windows', 'WinCE'],
        iosPlatforms = ['iPhone', 'iPad', 'iPod'],
        os = null;
  
    if (macosPlatforms.indexOf(platform) !== -1) {
      os = 'Mac OS';
    } else if (iosPlatforms.indexOf(platform) !== -1) {
      os = 'iOS';
    } else if (windowsPlatforms.indexOf(platform) !== -1) {
      os = 'Windows';
    } else if (/Android/.test(userAgent)) {
      os = 'Android';
    } else if (!os && /Linux/.test(platform)) {
      os = 'Linux';
    }
  
    return os || "Unknown OS";
}
