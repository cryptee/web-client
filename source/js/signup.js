
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
var requestsURL = 'https://crypt.ee/api/';
var pathTaken;
var images = {
  "intro" : {
    "author" : "Mitch Lensink",
    "profile" : "https://unsplash.com/@lensinkmitchel",
    "url" : "/imgs/identify.jpg",
    "current" : true
  },
  "sid" : {
    "author" : "Lonely Planet",
    "profile" : "https://unsplash.com/@lonely_planet",
    "url" : "/imgs/baltic.jpg",
    "current" : false
  },
  "pass" : {
    "author" : "Paweł Czerwiński",
    "profile" : "https://unsplash.com/@pawel_czerwinski",
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
    if (sectionToGoIfError) {
      goToSection(sectionToGoIfError);
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

$(".signup-next-button").on('click', function(event) {
  var targetSection = $(this).attr("next");
  if (targetSection !== "createacct") {
    goToSection(targetSection);
  }
});

function goToSection(targetSection) {
  var curSection = $(".signup-section.active").attr("section");
  if (curSection === "auth") { pathTaken = targetSection; }
  if (targetSection === "google") { targetSection = "key"; }

  // $(".signup-section.active").addClass("previous");
  var cursecno = $(".signup-section.active").attr("secno");
  var targetsecno = $(".signup-section[section='"+targetSection+"']").attr("secno");
  $(".signup-section").each(function(section) {
    var secno = $(this).attr("secno");
    if (secno < targetsecno) {
      $(this).addClass("previous");
    } else {
      $(this).removeClass("previous");
    }
  });


  $(".signup-section.active").removeClass("active");
  $(".signup-section[section='"+targetSection+"']").addClass('active');

  if (targetSection === "key") {
    if (pathTaken === "google") {
      $(".signup-section.active[section='"+targetSection+"']").find(".signup-title").html("We just need an encryption key, and you're ready.");
    } else {
      $(".signup-section.active[section='"+targetSection+"']").find(".signup-title").html("Finally, type in an encryption key.");
    }
  }

  if (pathTaken !== "user") {
    $(".key-regular-desc").hide();
  } else {
    $(".key-regular-desc").show();
  }

  imageController (targetSection);

  setTimeout(function () {
    var firstNextInput = $(".signup-section[section='"+targetSection+"']").find("input")[0];
    if (firstNextInput) {
      firstNextInput.focus();
    }
  }, 150);
}

var enextTimeout; // this is in place in case if the keypress/change gets called multiple times, and "enter" calls next twice.
function enableNext() {
  $(".signup-section.active").find("button.signup-next-button").prop("disabled", false).attr("disabled", false);
  clearTimeout(enextTimeout);
  enextTimeout = setTimeout(function () {
    if (userPressedEnterToMoveOn) {
      userPressedEnterToMoveOn = false;
      var targetSection = $(".signup-section.active").find("button.signup-next-button").attr("next");
      if (targetSection !== "createacct") {
        goToSection(targetSection);
      }
    }
  }, 50);
}

function disableNext() {
  $(".signup-section.active").find("button.signup-next-button").prop("disabled", true).attr("disabled", true);
}

$(".signup-back").on('click', function(event) {
  var targetSection = $(this).attr("prev");
  var curSection = $(".signup-section.active").attr("section");
  if (curSection === "auth") { pathTaken = targetSection; }

  var cursecno = $(".signup-section.active").attr("secno");
  var targetsecno = $(".signup-section[section='"+targetSection+"']").attr("secno");

  $(".signup-section.active").removeClass("active");
  if (curSection !== "key") {
    $(".signup-section[section='"+targetSection+"']").removeClass("previous").addClass('active');
    targetsecno = $(".signup-section[section='"+targetSection+"']").attr("secno");
  } else {
    if (pathTaken === "user") {
      $(".signup-section[section='pass']").removeClass("previous").addClass('active');
      targetsecno = $(".signup-section[section='pass']").attr("secno");
    } else if (pathTaken === "sid") {
      $(".signup-section[section='sid']").removeClass("previous").addClass('active');
      targetsecno = $(".signup-section[section='sid']").attr("secno");
    } else {
      $(".signup-section[section='auth']").removeClass("previous").addClass('active');
      targetsecno = $(".signup-section[section='auth']").attr("secno");
    }
  }

  $(".signup-section").each(function(section) {
    var secno = $(this).attr("secno");
    if (secno < targetsecno) {
      $(this).addClass("previous");
    } else {
      $(this).removeClass("previous");
    }
  });

  imageController (targetSection);
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

function imageController (targetSection) {
  var imageToUse;

  if (targetSection === "pass") {
    // show dual padlock
    imageToUse = images.pass;
  } else if (targetSection === "sid") {
    // show estonia photo
    imageToUse = images.sid;
  } else if (targetSection === "key") {
    // show padlock
    imageToUse = images.pass;
  } else {
    // show intro image
    imageToUse = images.intro;
  }

  if (!imageToUse.current) {
    images.pass.current = false;
    images.sid.current = false;
    images.intro.current = false;
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
      sidImg = new Image();
      passImg = new Image();

      sidImg.src = images.sid.url;
      passImg.src = images.pass.url;
    }, 500);
  }
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
    $("#sessionStorage-error").show();
    showSignupInfo("<i class='fa fa-exclamation-triangle'></i>&nbsp; Seems like your browser is blocking accesss to sessionStorage. Cryptee needs to use sessionStorage to keep you in memory while signed in.<br><br> Often this happens because some browsers like Firefox is a bit heavy-handed, and if you have cookies disabled, sessionStorage gets disabled too. Without this Cryptee will not work. We're very sorry for the inconvenience. Please make the necessary adjustments and try again.","is-danger");
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
      $(".signup-bottom-buttons").hide();
      $(".signup-title").hide();
      $("#signup-auth-methods").css("pointer-events", "none");
      $("#signup-auth-methods").html("<img src='../assets/spinner.gif' class='small-logo'><br><br><h2 class='title is-2'>One moment,<br> we're waiting for Google.</h2>");
    }
  }
} catch (e) {}




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
    disableNext();
  } else {
    $("#signup-pass").removeClass('is-danger');
    $("#pass-score").removeClass('is-danger').addClass('is-success');
    passIsGood = true;
    enableNext();
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
      $("#signup-key").parents(".signup-section").find(".help").fadeOut();
      keyIsGood = true;

      if (keyIsGood && userPressedEnterToMoveOn) { $(".signuptermsbutton").focus(); }
      checkSignupButton();

    }).catch(function(e){

      $("#signup-key").addClass('is-danger');
      $("#signup-key").parents(".signup-section").find(".help").fadeIn();
      keyIsGood = false;

      if (keyIsGood && userPressedEnterToMoveOn) { $(".signuptermsbutton").focus(); }
      checkSignupButton();

    });
  }
}

$("#signup-pass").on("keydown keypress paste copy cut change", function(e){
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

$("#signup-si-personal-code").on("keydown keypress paste copy cut change", function(e){
  setTimeout(function(){
    var sidCode = $("#signup-si-personal-code").val().trim();

    if (e) {
      if (e.keyCode) {
        if (e.keyCode == 13) {
          userPressedEnterToMoveOn = true;
        } else {
          userPressedEnterToMoveOn = false;
        }
      }
    }

    if (sidCode !== "" && sidCode.match("^[0-9]+$")) {
      enableNext();
    } else {
      disableNext();
    }
  },50);
});

$("#signup-username").on("keydown keypress paste copy cut change blur", function(e){
  setTimeout(function(){
    var input = $("#signup-username").val().trim();
    $("#username-help").fadeOut(500);

    if (e) {
      if (e.keyCode) {
        if (e.keyCode == 13) {
          userPressedEnterToMoveOn = true;
        } else {
          userPressedEnterToMoveOn = false;
        }
      }
    }

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
          enableNext();
        } else {
          disableNext();
        }
      } else {
        theEmail = "";
        theUsername = input;
        enableNext();
      }
    } else {
      disableNext();
    }
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
  $("#signup-button").addClass('is-loading').prop('disabled', true).attr("disabled", true);
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

  // if ($("li[tab='mobileid']").hasClass("is-active")) {
  //   if (keyVerified && keyIsGood && privAgreed) {
  //     if ($("#signup-mi-personal-code").val().trim().replace(" ", "") !== "" && $("#signup-mi-phone-number").val().trim().replace(" ", "") !== "") {
  //       $("#signup-button").prop('disabled', false);
  //     } else {
  //       $("#signup-button").prop('disabled', true);
  //     }
  //   } else {
  //     $("#signup-button").prop('disabled', true);
  //   }
  // }

  // if (getUrlParameter("status") === "newuser") {
  //   if (keyIsGood && privAgreed) {
  //     enableSignup();
  //   } else {
  //     disableSignup();
  //   }
  // }
}


function signupInitiate () {
  sessionStorage.setItem('key', JSON.stringify(theKey));
  $("#signup-message").fadeOut();

  // sign up with username & pass
  if (pathTaken === "user" && getUrlParameter("status") !== "newuser") {
    createUser();
  }

  if (pathTaken === "google" && getUrlParameter("status") !== "newuser") {
    createUserWithGoogle();
  }

  if (pathTaken === "sid" && getUrlParameter("status") !== "newuser") {
    createUserWithSmartID();
  }

  // if ($("li[tab='mobileid']").hasClass("is-active")) {
  //   createUserWithMobileID();
  // }

  if (getUrlParameter("status") === "newuser") {
    sessionStorage.clear();
    // try { sessionStorage.setItem("sessionID", sessionID); } catch (e) {}
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
      logUser(theUser, theUsername, theKey);
  }, function(error) {
      var errorCode = error.code;
      var errorMessage = error.message;
      if        (errorCode == 'auth/weak-password') {
        showSignupInfo("Our servers think something about your password seems too weak", "is-warning", true, "pass");
        $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
      } else if (errorCode == 'auth/email-already-in-use') {
        goToSection("user");
        $("#username-help").fadeIn(500);
        $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
      } else if (errorCode == 'auth/invalid-email') {
        showSignupInfo("Our servers think you may have used an invalid character in your username. No @ symbols or spaces please.", "is-warning", true, "user");
        $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
      } else {
        handleError("Error Creating User", error);
        showSignupInfo("Something went wrong... We're terribly sorry. Please try again soon.", "is-warning", true);
        $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
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
    $("#signup-message > span").html("Something went wrong... We're terribly sorry. Please try again soon."); $("#signup-message").fadeIn(); $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
  });
}










function createUserWithGoogle () {
  signUpWithToken = true;
  
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
      var token = result.credential.accessToken;
      theUser = result.user;
      theUserID = theUser.uid;
      theEmail = theUser.email;
      theEpoch = (new Date()).getTime();
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
    var token = result.credential.accessToken;
    theUser = result.user;
    theUserID = theUser.uid;
    theEmail = theUser.email;
    theEpoch = (new Date()).getTime();
    $("#signup-button").html("<i class='fa fa-check'></i>").addClass('is-success');
  }
});

// function createUserWithMobileID () {
//   showSignupInfo("You will receive a notification on your phone shortly.<br><br> Only type your pin code, if the numbers you see on your phone are :<br><b style='font-size:24px;'></b>", "is-info");
//   signUpWithToken = true;
//   $.ajax({
//     url : requestsURL + 'midlogin',
//     type: 'POST',
//     dataType : "json",
//     data: {personal: $("#signup-mi-personal-code").val().trim().replace(" ", ""), phone: $("#signup-mi-phone-number").val().trim().replace(" ", "")}
//   }).done(function( response ) {
//     // ping("message",{msg : "midCodeDisplayed"});
//     gotMIResponse(response.code, response.istoken);
//   }).fail(function(){
//     // ping("message",{msg : "midIssueOrUserError"});
//     showSignupInfo("Something went wrong. Please double check the information you've entered is correct and try again. If you are certain the information is correct, Mobile-ID must be experiencing issues, and it should start working again in a few minutes.", "is-warning", true);
//     $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
//   });
// }

function createUserWithSmartID () {
  showSignupInfo("You will receive a notification on your phone shortly.<br><br> Only type your pin code, if the numbers you see on your phone are :<br><b style='font-size:24px;'></b>", "is-info", false);
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
    showSignupInfo("Something went wrong. Please double check the information you've entered is correct and try again. If you are certain the information is correct, Smart-ID must be experiencing issues, and it should start working again in a few minutes.", "is-warning", true, "sid");
    $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
  });
}

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
      var goBackTo = "";
      if (pathTaken === "sid") {
        goBackTo = "sid";
      }
      if (pathTaken === "google") {
        goBackTo = "key";
      }
      showSignupInfo("Something went wrong. It seems we can't process the signup token at this moment. Please try again in a minute.", "is-warning", true, goBackTo);
      $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
      tokenRetry = false;
    }
  });
}

function gotSIResponse (code, token) {
  showSignupInfo("You will receive a notification on your phone shortly.<br><br> Only type your pin code, if the numbers you see on your phone are :<br><b style='font-size:24px;'>"+code+"</b>", "is-info", false);
  $.ajax({
    url : requestsURL + 'sidstatus',
    type: 'POST',
    dataType : "json",
    data: {personal: $("#signup-si-personal-code").val().trim(), istoken: token}
  }).done(function( response ) {
    if (response.crtoken) {
      // ping("message",{msg : "gotSidConfirmation"});
      gotAuthToken(response.crtoken);
    } else {
      console.log(response);
    }
  }).fail(function(){
    // ping("message",{msg : "gotSidError"});
    showSignupInfo("Something went wrong. Please double check the information you've entered is correct and try again.", "is-warning", true, "sid");
    $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
  });
}

// function gotMIResponse (code, token) {
//   showSignupInfo("You will receive a notification on your phone shortly.<br><br> Only type your pin code, if the numbers you see on your phone are :<br><b style='font-size:24px;'>"+code+"</b>", "is-info");
//   $.ajax({
//     url : requestsURL + 'midstatus',
//     type: 'POST',
//     dataType : "json",
//     data: {personal: $("#signup-mi-personal-code").val().trim(), istoken: token}
//   }).done(function( response ) {
//     if (response.crtoken) {
//       // ping("message",{msg : "gotMidConfirmation"});
//       gotAuthToken(response.crtoken);
//     } else {
//       console.log(response);
//     }
//   }).fail(function(){
//     // ping("message",{msg : "gotMidError"});
//     showSignupInfo("Something went wrong. Please double check the information you've entered is correct and try again.", "is-warning", true, "mid");
//     $("#signup-button").prop('disabled', false).attr("disabled", false).removeClass("is-loading is-success").html("Try Again");
//   });
// }


firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    //got user // if this is just a logged in user, don't start process again.

    $('.username').html(user.displayName || user.email);
    if (signUpWithToken || signUpWithEmail) {
      sessionStorage.clear();
      var iosGAuthSignupKey = JSON.parse(localStorage.getItem("iosgauthsignupkey"));
      if (iosGAuthSignupKey) {
        saveKey(iosGAuthSignupKey);
        localStorage.setItem("iosgauthsignupkey", "");
      } else {
        saveKey(theKey);
      }
      // try { sessionStorage.setItem("sessionID", sessionID); } catch (e) {}
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
          //   } else {
          //     loginMethod = "eid"; // if none, smartid.
          //   }
          //
          //   ping("message",{msg : "newuserFromSignin", method : loginMethod});
          // } catch (e) {}

          $(".fromSignIn").fadeIn();
          $("#signinButton").fadeOut();
          goToSection("key");
          $(".signup-section[section='key']").find(".signup-title").html("We just need an encryption key, and you're ready.");
          $(".signup-back").hide();
        }
      } else {
        signOut();
        // try { sessionStorage.setItem("sessionID", sessionID); } catch (e) {}
      }
    }
  }
}, function(error){
  if (error.code !== "auth/network-request-failed") {
    handleError("Error Authenticating", error);
  }
});

function saveKey(key){
  hashString(key).then(function (hashedKey) {
    sessionStorage.setItem('key', JSON.stringify(hashedKey));
    createAcctHome();
  });
}


function createAcctHome(){
  setTimeout(function () {
    window.location = "createacct";
  }, 2000);
}
