
///////////////////////////////////////////////////
/////////////////// SIGN UP  //////////////////////
///////////////////////////////////////////////////
var passScore;
var keyScore;
var passVerified = false;
var passIsGood = false;
var keyVerified = false;
var keyIsGood = false;
var privAgreed = false;
var theUser;
var theCheck;
var theUserID;
var theUsername;
var theEmail;
var theCryptmail;
var theEpoch;
var signUpWithToken = false;
var signUpWithEmail = false;
var leftForGoogleRedirect = JSON.parse(sessionStorage.getItem('leftForGoogleRedirect')) || false;
var requestsURL = 'https://crypt.ee/api/';

$(window).on("load", function(event) {
  // if (isInWebAppiOS) {
  //   $("#google-tab-contents").prepend('<p><b>(Only for iOS 11.2+)</b><b> For older versions of iOS:</b><br>In order to sign up to Cryptee using your Google account in an iOS Home Screen application, <a href="https://cryptee.kayako.com/article/24-how-to-sign-up-using-google-account-in-home-screen-application-using-an-older-version-of-ios" target="_blank"><b> please read this tutorial.</b></a></p><br><br>');
  // }
  try {
    sessionStorage.setItem("sessionStorageTest", "test");
    sessionStorage.removeItem("sessionStorageTest");
  } catch (e) {
    // SHOW MODAL ABOUT SESSION STORAGE ACCESS.
    $("#signup-info").html("<i class='fa fa-exclamation-triangle'></i>&nbsp; It seems like your browser is blocking accesss to sessionStorage.<br><br> Cryptee needs access to sessionStorage to keep you in memory while logged in. This error usually happens because some browsers like Firefox is a bit heavy-handed, and if you have cookies disabled, it disables sessionStorage too. Without this Cryptee will not work. We're very sorry for the inconvenience. ").removeClass("is-info").addClass("is-danger").show();
  }

  var referrerButton = sessionStorage.getItem("signup-referrer");
  if (referrerButton){
    ping("event", {eventCategory: "which-signup-button", eventAction : referrerButton}, function(){
      sessionStorage.removeItem('signup-referrer');
    });
  }

  if (isInWebAppiOS) {
    var googleAuthUUID = localStorage.getItem('gauthUUID');
    if (googleAuthUUID !== null) {
      tryGettingIdTokenFromCrypteeGAuth(googleAuthUUID);
    } else {
      console.log("generating UUID for PWA Google Login");
      generateNewUUIDForGoogleAuthOniOSPWA ();
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
          gotToken(data);
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

if (leftForGoogleRedirect || localStorage.getItem("iosgauthsignupkey")) {
  $(".signup-bottom-buttons").hide();
  $(".small-logo").attr("src", "../../assets/spinner.gif");
  $(".tabs").hide();
  $(".question").html("One moment, we're waiting for Google.");
}

$(".tabs").on('click', 'li', function(event) {
  whichTab = $(this).attr("tab");
  $(".tab-content").hide();
  $("#" + whichTab + "-tab-contents, #button-section, #encryption-key").show();
  $(".tabs li").removeClass('is-active');
  $(this).addClass('is-active');
  checkSignupButton ();
  // ping("click", {btn : whichTab});
});

function isEmail(email) {
  var regex = /^([a-zA-Z0-9_.+-])+\@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/;
  return regex.test(email);
}

$("#signup-email").on("keydown keypress paste copy cut change", function(){
  setTimeout(function(){
    if ($("#signup-email").val()) {
      if (isEmail($("#signup-email").val().trim())){
        $("#email-help").fadeOut();
      } else {
        $("#email-help").fadeIn();
      }
    } else {
      $("#email-help").fadeOut();
    }
  },50);
});

$("#signup-email").on("blur", function(){
  if ($("#signup-email").val()) {
    if (isEmail($("#signup-email").val().trim())){
      $("#email-help").fadeOut();
    } else {
      $("#email-help").fadeIn();
    }
  } else {
    $("#email-help").fadeOut();
  }
});

function checkPass() {
  if ( $("#signup-pass").val().trim() !== $("#signup-pass-ver").val().trim() ) {
    $("#signup-pass-ver").addClass('is-danger');
    $("#signup-pass-ver").parents(".field").find(".help").fadeIn();
    passVerified = false;
  } else {
    $("#signup-pass-ver").removeClass('is-danger');
    $("#signup-pass-ver").parents(".field").find(".help").fadeOut();
    passVerified = true;
  }

  passScore = zxcvbn($("#signup-pass").val().trim()).score + 1;

  $("#pass-score").attr("value", passScore * 20);
  if (passScore <= 2) {
    $("#signup-pass").addClass('is-danger');
    $("#pass-score").removeClass('is-success').addClass('is-danger');
    passIsGood = false;
  } else {
    $("#signup-pass").removeClass('is-danger');
    $("#pass-score").removeClass('is-danger').addClass('is-success');
    passIsGood = true;
  }
  checkSignupButton();
}

function checkKey() {
  if ( $("#signup-key").val().trim() !== $("#signup-key-ver").val().trim() ) {
    $("#signup-key-ver").addClass('is-danger');
    $("#signup-key-ver").parents(".field").find(".help").fadeIn();
    keyVerified = false;
  } else {
    $("#signup-key-ver").removeClass('is-danger');
    $("#signup-key-ver").parents(".field").find(".help").fadeOut();
    keyVerified = true;
  }

  keyScore = zxcvbn($("#signup-key").val().trim()).score + 1;

  $("#key-score").attr("value", keyScore * 20);

  if (keyScore <= 1) {
    $("#signup-key").addClass('is-danger');
    $("#key-score").removeClass('is-success').addClass('is-danger');
    keyIsGood = false;
  } else {
    $("#signup-key").removeClass('is-danger');
    $("#key-score").removeClass('is-danger').addClass('is-success');
    keyIsGood = true;
  }
  checkSignupButton();
}

$("#signup-pass").on("keydown keypress paste copy cut change", function(){
  setTimeout(function(){
    checkPass();
  },50);
});

$("#signup-pass-ver").on("keydown keypress paste copy cut change", function(){
  setTimeout(function(){
    checkPass();
  },50);
});

$("#signup-key").on("keydown keypress paste copy cut change", function(){
  setTimeout(function(){
    checkKey();
  },50);
});

$("#signup-key-ver").on("keydown keypress paste copy cut change", function(){
  setTimeout(function(){
    checkKey();
  },50);
});

$("#signup-si-personal-code, #signup-mi-personal-code, #signup-mi-phone-number").on("keydown keypress paste copy cut change", function(){
  setTimeout(function(){
    checkSignupButton();
  },50);
});

$("#signup-username").on("keydown keypress paste copy cut change", function(){
  setTimeout(function(){
    var input = $("#signup-username").val();
    $("#username-help").fadeOut(500);
    checkSignupButton();
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
  $("#signup-button").addClass('is-loading').prop('disabled', true);
  // ping("click", {
  //   btn : "signUp",
  //   keyStrength : $("#key-score").attr("value"),
  //   method : $("li.is-active").attr("tab"),
  //   unameOnly : ($("li[tab='userpass']").hasClass("is-active")&&$("#signup-email").val().trim()==="")
  // },function(){
    signupInitiate ();
  // });
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
        window.location = "/signin.html";
      }
    }, function(error) {
      handleError(error);
      console.error('Sign Out Error', error);
    });
  }
});

function checkSignupButton () {

  // sign up with username & pass
  if ($("li[tab='userpass']").hasClass("is-active")) {
    if (passVerified && keyVerified && passIsGood && keyIsGood && privAgreed) {
      if ($("#signup-username").val().trim() !== "" || ($("#signup-email").val().trim() !== "" && isEmail($("#signup-email").val()))) {
        $("#signup-button").prop('disabled', false);
      } else {
        $("#signup-button").prop('disabled', true);
      }
    } else {
      $("#signup-button").prop('disabled', true);
    }
  }

  if ($("li[tab='google']").hasClass("is-active")) {
    if (keyVerified && keyIsGood && privAgreed) {
      $("#signup-button").prop('disabled', false);
    } else {
      $("#signup-button").prop('disabled', true);
    }
  }

  if ($("li[tab='smartid']").hasClass("is-active")) {
    if (keyVerified && keyIsGood && privAgreed) {
      if ($("#signup-si-personal-code").val().trim() !== "") {
        $("#signup-button").prop('disabled', false);
      } else {
        $("#signup-button").prop('disabled', true);
      }
    } else {
      $("#signup-button").prop('disabled', true);
    }
  }

  if ($("li[tab='mobileid']").hasClass("is-active")) {
    if (keyVerified && keyIsGood && privAgreed) {
      if ($("#signup-mi-personal-code").val().trim().replace(" ", "") !== "" && $("#signup-mi-phone-number").val().trim().replace(" ", "") !== "") {
        $("#signup-button").prop('disabled', false);
      } else {
        $("#signup-button").prop('disabled', true);
      }
    } else {
      $("#signup-button").prop('disabled', true);
    }
  }

  if (getUrlParameter("status") === "newuser") {
    if (keyVerified && keyIsGood && privAgreed) {
      $("#signup-button").prop('disabled', false);
    }
  }
}


function signupInitiate () {
  sessionStorage.setItem('key', JSON.stringify($("#signup-key").val().trim()));
  $("#signup-message").fadeOut();
  $("#signup-info").removeClass("is-warning").addClass("is-info");

  // sign up with username & pass
  if ($("li[tab='userpass']").hasClass("is-active")) {
    createUser();
  }

  if ($("li[tab='google']").hasClass("is-active")) {
    createUserWithGoogle();
  }

  if ($("li[tab='smartid']").hasClass("is-active")) {
    createUserWithSmartID();
  }

  if ($("li[tab='mobileid']").hasClass("is-active")) {
    createUserWithMobileID();
  }

  if (getUrlParameter("status") === "newuser") {
    sessionStorage.clear();
    // try { sessionStorage.setItem("sessionID", sessionID); } catch (e) {}
    saveKey($("#signup-key").val());
  }
}









function createUser () {
  theCryptmail = $("#signup-username").val().trim() + "@users.crypt.ee";
  theEmail = $("#signup-email").val().trim();

  var emailToUse;
  if (theEmail !== "") {
    emailToUse = theEmail;
  } else {
    emailToUse = theCryptmail;
  }

  firebase.auth().createUserWithEmailAndPassword(emailToUse, $("#signup-pass").val()).then(function(usercred) {
      signUpWithEmail = true;
      theUser = usercred.user;
      theUserID = theUser.uid;
      theCryptmail = $("#signup-username").val() + "@users.crypt.ee";
      theEmail = $("#signup-email").val();
      theEpoch = (new Date()).getTime();
      theUsername = $("#signup-username").val();
      Raven.setUserContext({ id: theUserID });
      logUser(theUser, theUsername, $("#signup-key").val());
  }, function(error) {
      var errorCode = error.code;
      var errorMessage = error.message;
      if        (errorCode == 'auth/weak-password') {
        $("#signup-message > span").html("Our servers think something about your password seems too weak"); $("#signup-message").fadeIn(); $("#signup-button").prop('disabled', false).removeClass("is-loading is-success").html("Try Again");
      } else if (errorCode == 'auth/email-already-in-use') {
        $("#username-help").fadeIn(500); $("#signup-button").prop('disabled', false).removeClass("is-loading is-success").html("Try Again");
      } else if (errorCode == 'auth/invalid-email') {
        $("#signup-message > span").html("Our servers think you may have used an invalid character in your username. No @ symbols please."); $("#signup-message").fadeIn(); $("#signup-button").prop('disabled', false).removeClass("is-loading is-success").html("Try Again");
      } else {
        handleError(error);
        $("#signup-message > span").html("Something went wrong... We're terribly sorry. Please try again soon."); $("#signup-message").fadeIn(); $("#signup-button").prop('disabled', false).removeClass("is-loading is-success").html("Try Again");
      }
  });
}

function logUser(newUser, username, key){
  $("#signup-button").html("<i class='fa fa-check'></i>").addClass('is-success');
  newUser.updateProfile({
      displayName : username
  }).then(function() {
      // Update successful.
      if (theEmail !== "") {
        newUser.sendEmailVerification();
      }
      sessionStorage.clear();
      // try { sessionStorage.setItem("sessionID", sessionID); } catch (e) {}
      saveKey(key);
  }, function(error) {
    $("#signup-message > span").html("Something went wrong... We're terribly sorry. Please try again soon."); $("#signup-message").fadeIn(); $("#signup-button").prop('disabled', false).removeClass("is-loading is-success").html("Try Again");
  });
}










function createUserWithGoogle () {
  signUpWithToken = true;
  var provider = new firebase.auth.GoogleAuthProvider();
  provider.addScope('email');
  if (isInWebAppiOS) {
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

  } else {
    firebase.auth().signInWithPopup(provider).then(function(result) {
      var token = result.credential.accessToken;
      theUser = result.user;
      theUserID = theUser.uid;
      theEmail = theUser.email;
      theEpoch = (new Date()).getTime();
      $("#signup-button").html("<i class='fa fa-check'></i>").addClass('is-success');
    }).catch(function(error) {
      handleError(error);
      $("#signup-message > span").html("Something went wrong... We're terribly sorry. Please try again soon."); $("#signup-message").fadeIn(); $("#signup-button").prop('disabled', false).removeClass("is-loading is-success").html("Try Again");
    });
  }
}

firebase.auth().getRedirectResult().then(function(result) {
  if (result.user !== null) {
    signUpWithToken = true;
    var token = result.credential.accessToken;
    theUser = result.user;
    theUserID = theUser.uid;
    theEmail = theUser.email;
    theEpoch = (new Date()).getTime();
    $("#signup-button").html("<i class='fa fa-check'></i>").addClass('is-success');
  }
});

function createUserWithMobileID () {
  $("#signup-info").html("You will receive a notification on your phone shortly.<br><br> Only type your pin code, if the numbers you see on your phone are :<br><b style='font-size:24px;'></b>").show();
  signUpWithToken = true;
  $.ajax({
    url : requestsURL + 'midlogin',
    type: 'POST',
    dataType : "json",
    data: {personal: $("#signup-mi-personal-code").val().trim().replace(" ", ""), phone: $("#signup-mi-phone-number").val().trim().replace(" ", "")}
  }).done(function( response ) {
    // ping("message",{msg : "midCodeDisplayed"});
    gotMIResponse(response.code, response.istoken);
  }).fail(function(){
    // ping("message",{msg : "midIssueOrUserError"});
    $("#signup-info").html("Something went wrong. Please double check the information you've entered is correct and try again. If you are certain the information is correct, Mobile-ID must be experiencing issues, and it should start working again in a few minutes.").removeClass("is-info").addClass("is-warning");
    $("#signup-button").prop('disabled', false).removeClass("is-loading is-success").html("Try Again");
  });
}

function createUserWithSmartID () {
  $("#signup-info").html("You will receive a notification on your phone shortly.<br><br> Only type your pin code, if the numbers you see on your phone are :<br><b style='font-size:24px;'></b>").show();
  signUpWithToken = true;
  $.ajax({
    url : requestsURL + 'sidlogin',
    type: 'POST',
    dataType : "json",
    data: {personal: $("#signup-si-personal-code").val().trim(), country: $("input[type='radio']:checked").val()}
  }).done(function( response ) {
    // ping("message",{msg : "sidCodeDisplayed"});
    gotSIResponse(response.code, response.istoken);
  }).fail(function(){
    // ping("message",{msg : "sidIssueOrUserError"});
    $("#signup-info").html("Something went wrong. Please double check the information you've entered is correct and try again. If you are certain the information is correct, Smart-ID must be experiencing issues, and it should start working again in a few minutes.").removeClass("is-info").addClass("is-warning");
    $("#signup-button").prop('disabled', false).removeClass("is-loading is-success").html("Try Again");
  });
}

var tokenRetry = false;
function gotToken(token) {
  $("#signup-button").html("<i class='fa fa-check'></i>").addClass('is-success');
  firebase.auth().signInWithCustomToken(token).catch(function(error) {
    var errorCode = error.code;
    var errorMessage = error.message;
    console.log("error signing in with token");
    handleError(error);

    if (!tokenRetry) {
      setTimeout(function () {
        tokenRetry = true;
        gotToken(token);
      }, 2000);
    } else {
      // ping("message",{msg : "gotTokenError"});
      $("#signup-info").html("Something went wrong. It seems we can't process the signup at this moment. Please try again in a minute.").removeClass("is-info").addClass("is-warning");
      $("#signup-button").prop('disabled', false).removeClass("is-loading is-success").html("Try Again");
      tokenRetry = false;
    }
  });
}

function gotSIResponse (code, token) {
  $("#signup-info").html("You will receive a notification on your phone shortly.<br><br> Only type your pin code, if the numbers you see on your phone are :<br><b style='font-size:24px;'>"+code+"</b>").show();
  $.ajax({
    url : requestsURL + 'sidstatus',
    type: 'POST',
    dataType : "json",
    data: {personal: $("#signup-si-personal-code").val().trim(), istoken: token}
  }).done(function( response ) {
    if (response.crtoken) {
      // ping("message",{msg : "gotSidConfirmation"});
      gotToken(response.crtoken);
    } else {
      console.log(response);
    }
  }).fail(function(){
    // ping("message",{msg : "gotSidError"});
    $("#signup-info").html("Something went wrong. Please double check the information you've entered is correct and try again.").removeClass("is-info").addClass("is-warning");
    $("#signup-button").prop('disabled', false).removeClass("is-loading is-success").html("Try Again");
  });
}

function gotMIResponse (code, token) {
  $("#signup-info").html("You will receive a notification on your phone shortly.<br><br> Only type your pin code, if the numbers you see on your phone are :<br><b style='font-size:24px;'>"+code+"</b>").show();
  $.ajax({
    url : requestsURL + 'midstatus',
    type: 'POST',
    dataType : "json",
    data: {personal: $("#signup-mi-personal-code").val().trim(), istoken: token}
  }).done(function( response ) {
    if (response.crtoken) {
      // ping("message",{msg : "gotMidConfirmation"});
      gotToken(response.crtoken);
    } else {
      console.log(response);
    }
  }).fail(function(){
    // ping("message",{msg : "gotMidError"});
    $("#signup-info").html("Something went wrong. Please double check the information you've entered is correct and try again.").removeClass("is-info").addClass("is-warning");
    $("#signup-button").prop('disabled', false).removeClass("is-loading is-success").html("Try Again");
  });
}


firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    //got user // if this is just a logged in user, don't start process again.

    $('.username').html(user.displayName);
    if (signUpWithToken || signUpWithEmail) {
      sessionStorage.clear();
      var iosGAuthSignupKey = JSON.parse(localStorage.getItem("iosgauthsignupkey"));
      if (iosGAuthSignupKey) {
        saveKey(iosGAuthSignupKey);
        localStorage.setItem("iosgauthsignupkey", "");
      } else {
        saveKey($("#signup-key").val());
      }
      // try { sessionStorage.setItem("sessionID", sessionID); } catch (e) {}
    } else {
      if (getUrlParameter("status") === "newuser") {
        // USER CAME FROM SIGNIN. DIDN'T HAVE ACCOUNT. CREATE KEY.
        var iosGAuthSignupKey = JSON.parse(localStorage.getItem("iosgauthsignupkey"));

        if (iosGAuthSignupKey) {
          saveKey(iosGAuthSignupKey);
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
          //   } else {
          //     loginMethod = "eid"; // if none, smartid.
          //   }
          //
          //   ping("message",{msg : "newuserFromSignin", method : loginMethod});
          // } catch (e) {}

          $(".question").html("One last thing");
          $(".tabs, .hideFromSignin").hide();
          $("#encryption-key, .fromSignIn, #button-section").fadeIn();
        }
      } else {
        signOut();
        // try { sessionStorage.setItem("sessionID", sessionID); } catch (e) {}
      }
    }
  }
}, function(error){
  if (error.code !== "auth/network-request-failed") {
    handleError(error);
  }
});

function saveKey(key){
  var hashedKey = hashString(key);
  sessionStorage.setItem('key', JSON.stringify(hashedKey));
  createAcctHome();
}


function createAcctHome(){
  setTimeout(function () {
    window.location = "createacct.html";
  }, 2000);
}
