
///////////////////////////////////////////////////
/////////////////// SIGN UP  //////////////////////
///////////////////////////////////////////////////
var passScore;
var keyScore;
var usernameIsGood = false;
var passVerified = false;
var passIsGood = false;
var keyVerified = false;
var keyIsGood = false;
var privAgreed = false;
var thePass = "";
var theKey = "";
var theUser;
var theCheck;
var theUserID;
var theUsername = "";
var theEmail = "";
var theCryptmail;
var theEpoch;
var signUpWithToken = false;
var signUpWithEmail = false;
var theStrongKey = generateStrongKey();
var requestsURL = 'https://crypt.ee/api/';
var providerUsed;
var images = {
  "auth" : {
    "url" : "/imgs/identify.jpg",
    "current" : true
  },
  "key" : {
    "url" : "/imgs/locks.jpg",
    "current" : false
  }
};

function showSignupInfo (message, color, closable, sectionToGoIfError) {
  closable = closable || false;
  sectionToGoIfError = sectionToGoIfError || false;
  var closeButton = "";
  if (closable) { closeButton = "<button id='signup-info-delete' class='delete'></button><br>"; }
  $("#signup-info").html(closeButton + message).removeClass("is-info is-warning is-danger is-success").addClass(color);
  $(".signup-info-wrapper").fadeIn(500,function(){
    $("#signup-info").addClass("shown");
    if (sectionToGoIfError === "auth") {
      loadAuthSection();
    } else {
      loadKeySection();
    }
  });

  $("#signup-info-delete").on('click', function(event) {
    hideSignupInfo ();
  });
}

function hideSignupInfo () {
  $("#signup-info").removeClass("is-info is-warning is-danger is-success shown");
  $(".signup-info-wrapper").fadeOut();
}

$(".question").on('click',function(event) {
  $(this).parents(".signup-section").find(".notification").addClass('shown');
});

$(".notification").on('click', '.delete', function(event) {
  $(this).parents(".notification").removeClass('shown');
});

$(".reveal-pass-input-button").on('click', function(event) {
  var input = $(this).siblings('input');
  var icon = $(this).find("i");
  var type = input.attr("type");
  if (type === "password") {
    input.attr("type", "text");
    icon.removeClass("fa-eye").addClass("fa-eye-slash");
    input.focus();
  } else {
    input.attr("type", "password");
    icon.removeClass("fa-eye-slash").addClass("fa-eye");
    input.focus();
  }
});

$(".provider-button").on('click', function(event) {
  providerUsed = $(this).attr("provider");
  if (providerUsed !== "username") {
    loadKeySection();
  } else {
    if (usernameIsGood && passIsGood) {
      loadKeySection();
    } else {
      if (!passIsGood) {
        $("#signup-pass").focus();
      }

      if (!usernameIsGood) {
        $("#signup-username").focus();
      }
    }
  }
});

$(".signup-back").on('click', function(event) {
  loadAuthSection();
});

function loadKeySection() {
  $(".signup-section[section='key']").show();
  $(".signup-section[section='key']").addClass("active");
  $(".signup-section[section='auth']").addClass("previous").removeClass("active");
  setTimeout(function () {
    $("#signup-key").focus();
  }, 500);
  // setTimeout(function () { $(".signup-section[section='auth']").hide(); }, 1000);  
  imageController("key");
}

function loadAuthSection() {
  $(".signup-section[section='auth']").show();
  $(".signup-section[section='key']").removeClass("active");
  $(".signup-section[section='auth']").removeClass("previous").addClass("active");
  // setTimeout(function () { $(".signup-section[section='key']").hide(); }, 1000);  
  imageController("auth");
}

var enextTimeout; // this is in place in case if the keypress/change gets called multiple times, and "enter" calls next twice.
function checkNextButton() {
  if (usernameIsGood && passIsGood) {
    $(".provider-button[provider='username']").prop("disabled", false).attr("disabled", false);
    clearTimeout(enextTimeout);
    enextTimeout = setTimeout(function () {
      if (userPressedEnterToMoveOn) {
        userPressedEnterToMoveOn = false;
        providerUsed = "username";
        loadKeySection();
      }
    }, 50);
  } else {
    $(".provider-button[provider='username']").prop("disabled", true).attr("disabled", true);
  }
}

function imageController (targetSection) {
  var imageToUse = images[targetSection];

  if (!imageToUse.current) {
    images.key.current = false;
    images.auth.current = false;
    imageToUse.current = true;
    $("#signup-hero").addClass('changing');
    setTimeout(function () {
      $("#signup-hero").css("background-image",  'url(' + imageToUse.url + ')');
      $("#signup-hero").removeClass('changing');
    }, 500);
  }
}

var imagesPreloaded = false;
function preloadImages () {
  // do it in order.
  if (!imagesPreloaded) {
    imagesPreloaded = true;
    setTimeout(function () {
      keyImg = new Image();
      keyImg.src = images.key.url;
    }, 500);
  }
}

function sessionStorageBlocked() {
  showSignupInfo("Seems like your browser is blocking accesss to sessionStorage. This is usually caused by browsers like Firefox heavy-handedly blocking sessionStorage when they're configured to block all cookies.<br><br>"+
  "Cryptee needs access to sessionStorage to keep you in memory while signed in, and can't work without it. We're very sorry for the inconvenience. Please make the necessary adjustments and try again.","is-danger");
}

$(window).on("resize", function() {
  if ($(window).width() > 768) {
    preloadImages();
  }
});

$(window).on("load", function(event) {

  if (inIframe()){
    $("#signup-auth-methods").remove();
    $(".signup-title").html("This page is loaded in an iframe. You are not on CRYPT.EE!");
    $(".title.is-3").html("WARNING");
  }

  if (getUrlParameter("status") === "newuser") {
    // as soon as we get firebase auth, we'll take the user to the encryption key view, but on slow connections this could take a few seconds.
    // disable selections until then just to be safe.
    $("#signup-auth-methods").css("pointer-events", "none");
  }

  if ($(window).width() > 768) {
    preloadImages();
  }

  try {
    sessionStorage.setItem("sessionStorageTest", "test");
    sessionStorage.removeItem("sessionStorageTest");
  } catch (e) {
    // SHOW MODAL ABOUT SESSION STORAGE ACCESS.
    sessionStorageBlocked(); 
  }

  var referrerButton;
  try { referrerButton = sessionStorage.getItem("signup-referrer"); } catch (e) {}
  
  if (referrerButton){
    ping("event", {eventCategory: "which-signup-button", eventAction : referrerButton}, function(){
      sessionStorage.removeItem('signup-referrer');
    });
  }

  if (isInWebAppiOS) {
    if (!isIOSPWAAdvanced) {
      var googleAuthUUID = localStorage.getItem('gauthUUID');
      if (googleAuthUUID !== null) {
        tryGettingIdTokenFromCrypteeGAuth(googleAuthUUID);
      } else {
        console.log("generating UUID for PWA Google Login");
        generateNewUUIDForGoogleAuthOniOSPWA ();
      }
    }
  }
});

function tryGettingIdTokenFromCrypteeGAuth(googleAuthUUID) {
  signUpWithToken = true;
  $("html, body").addClass("is-loading");
  $.ajax({
    url : requestsURL + 'iosgauth',
    type: 'POST',
    dataType : "json",
    data: {"uuid" : googleAuthUUID},
    error:function (xhr, ajaxOptions, thrownError){
      console.log("no google token found on server");
      $("html, body").removeClass("is-loading");
    }
  }).done(function( response ) {
    if (response.gauth) {
      // GOT GAUTH ID TOKEN, NOW GET AUTH TOKEN.
      $.ajax({ url: tokenURL, type: 'POST',
        headers: { "Authorization": "Bearer " + response.gauth },
        contentType:"application/json; charset=utf-8",
        success: function(data){
          gotAuthToken(data);
        },
        error:function (xhr, ajaxOptions, thrownError){
          console.log("no google token found on server");
          $("html, body").removeClass("is-loading");
        }
      });
    } else {
      console.log("no google token found on server");
      $("html, body").removeClass("is-loading");
      // NO TOKEN.
    }
    localStorage.removeItem("gauthUUID");
  });
}


// magic link equivalent of google auth on iOS PWA
function generateNewUUIDForGoogleAuthOniOSPWA () {
  $.ajax({
    url : requestsURL + 'iosgauth',
    type: 'POST',
    dataType : "json",
    data: {"uuid" : ""},
    error:function (xhr, ajaxOptions, thrownError){
      console.log("no google token found on server");
      $("html, body").removeClass("is-loading");
    }
  }).done(function( response ) {
    localStorage.setItem("gauthUUID", response.uuid);
    // now when the user clicks sign in with GAuth we'll open Safari with UUID in URL and generate ID token from Google Login.
  });
}

var leftForGoogleRedirect = false;
try { leftForGoogleRedirect = JSON.parse(sessionStorage.getItem('leftForGoogleRedirect')); } catch (e) {}

try { 
  if (localStorage) {
    if (leftForGoogleRedirect || localStorage.getItem("iosgauthsignupkey")) {
      providerUsed = "google";
      showWaitingForGoogle();
    }
  }
} catch (e) {}

function showWaitingForGoogle() {
  $(".signup-bottom-buttons").hide();
  $(".signup-title").hide();
  $("#signup-auth-methods").css("pointer-events", "none");
  $("#signup-auth-methods").html("<img src='../assets/loading-ffffff.gif' class='waiting-google-img small-logo'><br><br><h2 class='title is-5 has-text-centered'>One moment please,<br> we're waiting for Google.</h2>");
}


















function isEmail(email) {
  var regex = /^([a-zA-Z0-9_.+-])+\@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/;
  return regex.test(email);
}

function checkPass() {
  passScore = zxcvbn(thePass).score + 1;
  $("#pass-score").attr("value", passScore * 20);

  if (passScore <= 2) {
    $("#signup-pass").addClass('is-danger');
    $("#pass-score").removeClass('is-success').addClass('is-danger');
    passIsGood = false;
    checkNextButton();
  } else {
    $("#signup-pass").removeClass('is-danger');
    $("#pass-score").removeClass('is-danger').addClass('is-success');
    passIsGood = true;
    checkNextButton();
  }

  checkKey();
}

var userPressedEnterToMoveOn = false;

function checkKey() {

  if (theKey !== "") {
    keyScore = zxcvbn(theKey).score + 1;
    $("#key-score").attr("value", keyScore * 20);

    if (keyScore > 1) {
      $("#signup-key").removeClass('is-danger');
      $("#key-score").removeClass('is-danger').addClass('is-success');

      if (theKey === thePass) {
        $("#signup-key").addClass('is-danger');
        $("#unique-key-error").fadeIn();
        keyIsGood = false;
      } else {
        $("#signup-key").removeClass('is-danger');
        $("#unique-key-error").fadeOut();
        keyIsGood = true;
      }
    } else {
      $("#signup-key").addClass('is-danger');
      $("#key-score").removeClass('is-success').addClass('is-danger');
      keyIsGood = false;
    }
  } else {
    keyIsGood = false;
  }


  if (keyIsGood) {
    var keyToTest = theKey;

    // this is to test hashing the key to see if it has any invalid / wide / unsupported / unhashable characters
    hashString(keyToTest).then(function (newHashedKey) {

      $("#signup-key").removeClass('is-danger');
      $("#invalid-char-error").fadeOut();
      keyIsGood = true;

      if (keyIsGood && userPressedEnterToMoveOn) { $(".signuptermsbutton").focus(); }
      checkSignupButton();

    }).catch(function(e){

      $("#signup-key").addClass('is-danger');
      $("#invalid-char-error").fadeIn();
      keyIsGood = false;

      if (keyIsGood && userPressedEnterToMoveOn) { $(".signuptermsbutton").focus(); }
      checkSignupButton();

    });
  } else {
    checkSignupButton();
  }
}

$("#signup-pass").on("keydown keypress paste copy cut change", function(e){
  if (e.keyCode == 9) {  //tab pressed
    e.preventDefault(); // this prevents a weird bug where pressing tab force loads next section
    return false;
  }

  setTimeout(function(){
    thePass = $("#signup-pass").val().trim();

    if (e) {
      if (e.keyCode) {
        if (e.keyCode == 13) {
          userPressedEnterToMoveOn = true;
        } else {
          userPressedEnterToMoveOn = false;
        }
      }
    }

    checkPass();
  },50);
});

$("#signup-key").on("keydown keypress paste copy cut change", function(e){
  setTimeout(function(){
    theKey = $("#signup-key").val().trim();

    if (e) {
      if (e.keyCode) {
        if (e.keyCode == 13) {
          userPressedEnterToMoveOn = true;
        } else {
          userPressedEnterToMoveOn = false;
        }
      }
    }

    checkKey();
  },50);
});

$("#signup-username").on("keydown keypress paste copy cut change blur", function(e){
  if (e) {
    if (e.keyCode) {
      if (e.keyCode == 13) {
        userPressedEnterToMoveOn = true;
      } else {
        userPressedEnterToMoveOn = false;
      }

      if (e.keyCode == 32) {
        e.preventDefault();
        return false;
      }
    }
  }

  setTimeout(function(){
    var input = $("#signup-username").val().trim();
    $("#username-help").fadeOut(500);

    if (input.indexOf("@") > -1 && !isEmail(input)) {
      $("#email-help").fadeIn();
    } else {
      $("#email-help").fadeOut();
    }

    if (input !== "") {
      if (input.indexOf("@") > -1) {
        if (isEmail(input)) {
          theEmail = input;
          theUsername = "";
          usernameIsGood = true;
        } else {
          usernameIsGood = false;
        }
      } else {
        theEmail = "";
        theUsername = input;
        usernameIsGood = true;
      }
    } else {
      usernameIsGood = false;
    }

    checkNextButton();
  },50);
});

$(".signuptermsbutton").on("click touchend change", function() {
  if ($(".signuptermsbutton").is(':checked')) {
    privAgreed = true;
  } else {
    privAgreed = false;
  }
  checkSignupButton();
});

$("#signup-button").on("click",function(){
  $("#signup-button").addClass('is-loading').prop('disabled', true).attr("disabled", true);
  signupInitiate();
});

$(".fromSignInSignOut").on("click",function(){
  try {
    localStorage.removeItem('crypteeuser');
    sessionStorage.clear();
    sessionStorage.removeItem('key');
  } finally {
    firebase.auth().signOut().then(function() {
      try { localStorage.clear(); } finally {
        console.log('Signed Out');
        window.location = "/signin";
      }
    }, function(error) {
      handleError("Error Signing Out", error);
      console.error('Sign Out Error', error);
    });
  }
});


function enableSignup() {
  $("#signup-button").prop('disabled', false).attr("disabled", false);
}

function disableSignup() {
  $("#signup-button").prop('disabled', true).attr("disabled", true);
}

function checkSignupButton () {

  if (keyIsGood && privAgreed) {
    enableSignup();
  } else {
    disableSignup();
  }

}


function signupInitiate () {
  $("#signup-message").fadeOut();

  // sign up with username & pass
  if (providerUsed === "username" && getUrlParameter("status") !== "newuser") {
    createUser();
  }

  if (providerUsed === "google" && getUrlParameter("status") !== "newuser") {
    createUserWithGoogle();
  }

  if (getUrlParameter("status") === "newuser") {
    sessionStorage.clear();
    saveKey(theKey);
  }
}









function createUser () {
  theCryptmail = theUsername + "@users.crypt.ee";

  var emailToUse;
  if (theEmail !== "") {
    emailToUse = theEmail;
  } else {
    emailToUse = theCryptmail;
  }

  firebase.auth().createUserWithEmailAndPassword(emailToUse, thePass).then(function(usercred) {
      signUpWithEmail = true;
      theUser = usercred.user;
      theUserID = theUser.uid;
      setSentryUser(theUserID);
      console.log("created user profile");
      
  }, function(error) {
      var errorCode = error.code;
      var errorMessage = error.message;
      if        (errorCode == 'auth/weak-password') {
        showSignupInfo("Our servers think something about your password seems too weak", "is-warning", true, "pass");
        $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
      } else if (errorCode == 'auth/email-already-in-use') {
        loadAuthSection();
        $("#username-help").fadeIn(500);
        $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
      } else if (errorCode == 'auth/invalid-email') {
        showSignupInfo("Our servers think you may have used an invalid character in your username. No @ symbols or spaces please.", "is-warning", true, "user");
        $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
      } else {
        handleError("Error Creating User", error);
        showSignupInfo("Something went wrong. It seems we can't process the signup at this moment. Please try disabling content blockers and other extensions if possible to make sure nothing is interfering with the sign up process and try again shortly.", "is-warning", true, "key");
        $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
      }
  });
}











function createUserWithGoogle () {
  // do not remove this from here. it's incredibly critical that this is here.
  signUpWithToken = true; 
  // shortly, getRedirectResult is redundant. In theory onAuthStateChanged can fire before getRedirectResult.
  // this means that if you remove this line, if there's a foot-race, and onAuthStateChanged fires before getRedirectResult,
  // onAuthStateChanged would see signUpWithToken = false => resulting in a non-token flow. So DO NOT REMOVE THIS LINE. BUT SIGN-UP DEFINITELY NEEDS RE-TOOLING. UGH.
  
  if (isInWebAppiOS) {
    if (isIOSPWAAdvanced) {
      usePopup(); 
    } else {
      useRedirect();
    }
  } else {
    usePopup();
  }

  function usePopup() {
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    firebase.auth().signInWithPopup(provider).then(function(result) {
      // var token = result.credential.accessToken;
      theUser = result.user;
      theUserID = theUser.uid;
      theEmail = theUser.email;
      theEpoch = (new Date()).getTime();
      setSentryUser(theUserID);
      $("#signup-button").html("<i class='fa fa-check'></i>").addClass('is-success');
    }).catch(function(error) {
      if (error.code === "auth/missing-or-invalid-nonce") {
        
      } else {
        console.log(error); // replacing this with a traditional console log because it only throws "user cancelled / closed popup error"
        $("#signup-message > span").html("Something went wrong... We're terribly sorry. Please try again soon."); $("#signup-message").fadeIn(); $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
      }
    });
  }

  function useRedirect() {
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');

    var leftForGoogleRedirect = true;
    sessionStorage.setItem('leftForGoogleRedirect', JSON.stringify(true));
    // firebase.auth().signInWithRedirect(provider);
    localStorage.setItem("iosgauthsignupkey", JSON.stringify($("#signup-key").val()));

    var urlToPass = location.origin + "/gauth?uuid=" + localStorage.getItem("gauthUUID");
    var gauthFrame = document.getElementById('gauthFrame');
    var iframeDoc = gauthFrame.contentDocument || gauthFrame.contentWindow.document;
    var a = iframeDoc.createElement('a');
    a.setAttribute("href", urlToPass);
    a.setAttribute("target", "_blank");
    var dispatch = iframeDoc.createEvent("HTMLEvents");
    dispatch.initEvent("click", true, true);
    a.dispatchEvent(dispatch);

  }
}

firebase.auth().getRedirectResult().then(function(result) {
  if (result.user !== null) {
    signUpWithToken = true;
    // var token = result.credential.accessToken;
    theUser = result.user;
    theUserID = theUser.uid;
    theEmail = theUser.email;
    theUsername = theUser.displayName;
    theEpoch = (new Date()).getTime();
    setSentryUser(theUserID);
    $("#signup-button").html("<i class='fa fa-check'></i>").addClass('is-success');
  }
});

var tokenRetry = false;
function gotAuthToken(token) {
  $("#signup-button").html("<i class='fa fa-check'></i>").addClass('is-success');
  firebase.auth().signInWithCustomToken(token).catch(function(error) {
    var errorCode = error.code;
    var errorMessage = error.message;
    console.log("error signing in with token");
    handleError("Error Signing In With Token", error);

    if (!tokenRetry) {
      setTimeout(function () {
        tokenRetry = true;
        gotAuthToken(token);
      }, 2000);
    } else {
      // ping("message",{msg : "gotAuthTokenError"});
      showSignupInfo("Something went wrong. It seems we can't process the signup token at this moment. Please try disabling content blockers and other extensions if possible to make sure nothing is interfering with the sign up process and try again shortly.", "is-warning", true, "key");
      $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
      tokenRetry = false;
    }
  });
}

function logUser(newUser, username, key){
  $("#signup-button").html("<i class='fa fa-check'></i>").addClass('is-success');
  newUser.updateProfile({ displayName : username }).then(function() {
    // Update successful.
    if (theEmail !== "") {
      newUser.sendEmailVerification();
    }
    sessionStorage.clear();
    saveKey(key);
  }, function(error) {
    $("#signup-message > span").html("Something went wrong... We're terribly sorry. Please try again soon."); $("#signup-message").fadeIn(); $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
  });
}

firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    //got user // if this is just a logged in user, don't start process again.
    
    theUser = user;
    theUserID = theUser.uid;
    setSentryUser(theUserID);
    $('.username').html(user.displayName || user.email);
    
    if (signUpWithToken) {
      sessionStorage.clear();
      var iosGAuthSignupKey = JSON.parse(localStorage.getItem("iosgauthsignupkey"));
      if (iosGAuthSignupKey) {
        saveKey(iosGAuthSignupKey);
        localStorage.setItem("iosgauthsignupkey", "");
      } else {
        saveKey(theKey);
      }
    } else if (signUpWithEmail) {
      logUser(user, theUsername, theKey); // this calls the saveKey
    } else {
      if (getUrlParameter("status") === "newuser") {
        // USER CAME FROM SIGNIN. DIDN'T HAVE ACCOUNT. CREATE KEY.
        // using "2" to make a linter happy
        var iosGAuthSignupKey2 = JSON.parse(localStorage.getItem("iosgauthsignupkey"));

        if (iosGAuthSignupKey2) {
          saveKey(iosGAuthSignupKey2);
          localStorage.setItem("iosgauthsignupkey", "");
        } else {
          // try {
          //   var loginMethod = "";
          //   var providerId;
          //   if (user.toJSON().providerData[0]) {
          //     providerId = user.toJSON().providerData[0].providerId;
          //     if (providerId !== "" && providerId !== " ") {
          //       loginMethod = providerId; //password //google.com //phone
          //     }
          //   }
          //
          //   ping("message",{msg : "newuserFromSignin", method : loginMethod});
          // } catch (e) {}

          $(".fromSignIn").fadeIn();
          $("#signinButton").fadeOut();
          loadKeySection();
          $(".signup-section[section='key']").find(".signup-title").html("We just need an encryption key, and you're ready.");
          $(".signup-back").hide();
        }
      } else {
        signOut();
      }
    }
  }
}, function(error){
  if (error.code !== "auth/network-request-failed") {
    handleError("Error Authenticating", error);
    showSignupInfo("Something went wrong. It seems we can't process the signup at this moment. Please try again in a minute.", "is-warning", true, "key");
    $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
  }
});

function saveKey(key){
  hashString(key).then(function (hashedKey) {
    createFirstAuth(hashedKey);
  });
}

function createFirstAuth(hashedKey) {
  var curUser = firebase.auth().currentUser;
  if (curUser) {
    curUser.getIdToken(true).then(function(idToken) {
      $.ajax({ url: tokenURL, type: 'POST', headers: { "Authorization": "Bearer " + idToken }, contentType:"application/json; charset=utf-8",
        success: function(data){ 
          gotSignupToken(data, hashedKey); 
        },
        error:function (xhr, ajaxOptions, thrownError){ 
          handleError("Couldn't get signup auth token", thrownError); 
          showSignupInfo("Something went wrong. It seems we can't process the signup at this moment. Please try again in a minute.", "is-warning", true, "key");
          $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
        }
      });
    });
  } else {
    handleError("Couldn't get current user to get signup auth token", thrownError); 
    showSignupInfo("Something went wrong. It seems we can't process the signup at this moment. Please try again in a few seconds.", "is-warning", true, "key");
    $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
  }
}

function gotSignupToken(tokenData, hashedKey) {
  var token = tokenData;
  firebase.auth().signInWithCustomToken(token).then(function(){
    createUserInDB(hashedKey);
  }).catch(function(error) {
    handleError("Couldn't use signup auth token", error);
    showSignupInfo("Something went wrong. It seems we can't process the signup at this moment. Please try again in a minute.", "is-warning", true, "key");
    $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
  });
}

var createUserCounter = 0;
function createUserInDB(hashedKey) {
  if (theUserID && hashedKey && theStrongKey) {
    var usernameToUse = theUsername; 
    if (!usernameToUse) {
      if (theUser) {
        if (theUser.displayName) {
          usernameToUse = theUser.displayName;
        }
      }
    }   
    encrypt(theStrongKey, [hashedKey]).then(function(ciphertext) {
      var encryptedStrongKey = JSON.stringify(ciphertext);
      var newUserData = {
        username: usernameToUse,
        keycheck : encryptedStrongKey,
        lastOpenDocID : "home",
        tie : true,
        foldersCount : 0
      };
      db.ref().child('/users/' + theUserID + "/data/").set(newUserData, function(error){
        if (error) {
          if (createUserCounter < 3) {
            createUserCounter++;
            setTimeout(function () { createUserInDB(); }, 2000);
          } else {
            handleError("Couldn't set user data to dataref during signup", error);
            showSignupInfo("Something went wrong. It seems we can't process the signup at this moment. Please try again in a minute.", "is-warning", true, "key");
            $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
          }
        } else {
          createHomeDoc();
        }
      });
    });
  } else {
    handleError("Couldn't get all necessary user data set the key during signup", error);
    showSignupInfo("Something went wrong. It seems we can't process the signup at this moment. Please try again in a minute.", "is-warning", true, "key");
    $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
  }
}

var createHomeCounter = 0;
function createHomeDoc() {
  $("#signup-button").html("<i class='fa fa-check'></i>").addClass('is-success');
  $.get({url:"../js/homedoc.json", dataType:"text"}, function(homeDelta){
    if (homeDelta) {    
      encrypt(homeDelta, [theStrongKey]).then(function(ciphertext) {
        encryptedDocDelta = JSON.stringify(ciphertext);

        var homeUpload = store.ref().child('/users/' + theUserID).child("home.crypteedoc").putString(encryptedDocDelta);
        homeUpload.on('state_changed', function(snapshot){}, function(error) {      
          if (createHomeCounter < 3) {
            createHomeCounter++;
            handleError("Couldn't set user home to storage during signup. Will try a few more times.", error);
            setTimeout(function(){ createHomeDoc(); }, 2000);
          } else {
            handleError("Couldn't set user home to storage during signup", error);
            showSignupInfo("Something went wrong. It seems we can't process the signup at this moment. Please try again in a minute.", "is-warning", true, "key");
            $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
          }
        }, function() {
          signupComplete(); 
        });

      });
    } else {
      handleError("Couldn't get homedoc JSON during signup");
      showSignupInfo("Something went wrong. It seems we can't process the signup at this moment. Please try disabling content blockers and other extensions if possible to make sure nothing is interfering with the sign up process and try again shortly.", "is-warning", true, "key");
      $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
    }
  }).fail(function(error) {
    handleError("Couldn't get homedoc JSON during signup", error);
    showSignupInfo("Something went wrong. It seems we can't process the signup at this moment. Please try disabling content blockers and other extensions if possible to make sure nothing is interfering with the sign up proces and try again shortly..", "is-warning", true, "key");
    $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
  });
}



function signupComplete(){
  window.location = "home";
}
