var theUser;
var theUserID;
var theUsername;
var theToken;
var theEmail;
var dataRef;
var signinURL = "https://crypt.ee/api/auth";
var latest = (new Date()).getTime();
var photoJSON = "https://static.crypt.ee/signin-photo.json?cachebust=" + latest;
var photoURL = "https://static.crypt.ee/signin-photo.jpg?cachebust=" + latest;
var requestsURL = 'https://crypt.ee/api/';
var logintype = "";

$(".tabs").on('click', 'li', function(event) {
  whichTab = $(this).attr("tab");
  $(".tab-content").hide();
  $("#" + whichTab + "-tab-contents, #button-section, #encryption-key").show();
  $(".tabs li").removeClass('is-active');
  $(this).addClass('is-active');
  checkSigninButton ();
  // ping("click", {btn : whichTab});
});

$(window).on("load", function(event) {
  if ($(window).width() > 768) {
    $.ajax({url: photoJSON}).done(function(data) {
      var usObj = JSON.parse(data);

      $('<img/>').attr('src', photoURL).on('load', function() {
        $(this).remove();
        $(".hero-banner .hero").css("background-image", "url("+photoURL+")");
        $('#photo-credit').html("&copy; &nbsp;" + usObj.author + " via Unsplash");
        $('#photo-credit').attr("href", usObj.author_url);
      });
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

  try {
    sessionStorage.setItem("sessionStorageTest", "test");
    sessionStorage.removeItem("sessionStorageTest");
  } catch (e) {
    // SHOW MODAL ABOUT SESSION STORAGE ACCESS.
    $("#signin-info").html("<i class='fa fa-exclamation-triangle'></i>&nbsp; It seems like your browser is blocking accesss to sessionStorage.<br><br> Cryptee needs access to sessionStorage to keep you in memory while you're logged in. This error usually happens because some browsers like Firefox is a bit heavy-handed, and if you have cookies disabled, it disables sessionStorage too. Without this Cryptee will not work. We're very sorry for the inconvenience. ").removeClass("is-info").addClass("is-danger").show();
  }

});

firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    //got user
    theUser = user;
    theUserID = theUser.uid;
    theEmail = theUser.email;
    theUsername = theUser.displayName;
    Raven.setUserContext({ id: theUserID });
    dataRef = db.ref().child('/users/' + theUserID + "/data/");
    $('.username').html(theUsername || theEmail);

    $("html, body").removeClass("is-loading");

    if (!isMobile) {
      $(".hero-banner").css("width", "100%");
      $(".hero-body > .container").delay(1000).fadeOut(250, function() {
        checkForExistingUser ();
      });
    } else {
      checkForExistingUser ();
    }
  } else {
    if (getUrlParameter("dlddid")) {
      $("#signin-info").html("Please sign in to start your download.").show();
    }
  }
}, function(error){
  if (error.code !== "auth/network-request-failed") {
    handleError(error);
  }
});

function checkForExistingUser (){

  db.ref('/users/' + theUserID + "/data/keycheck").once('value').then(function(snapshot) {
    //  CHECK IF USER HAS KEY IN DATABASE. IF NOT REDIRECT TO SIGNUP.
    if (snapshot.val() === null) {
      window.location = "signup?status=newuser";
    } else {
      if (isMobile) {
        signInComplete();
      } else {
        if (getUrlParameter("dlddid")) {
          $("#key-status").html("Enter your encryption key to start the download");
        }
        showKeyModal();
      }
    }
  });

}

function showKeyModal() {
  $("#key-modal").addClass("is-active");
  $("#key-modal").delay(10).animate({opacity : 1 }, 250, function(){
    setTimeout(function () {
      $("#key-input").focus();
    }, 250);
  });
}

function hideKeyModal() {
  $("#key-modal").removeClass("is-active");
  $("#key-input").blur();
}

function checkKey(key){
  db.ref('/users/' + theUserID + "/data/keycheck").once('value').then(function(snapshot) {
    if (snapshot.val() === null) {
      window.location = "signup?status=newuser";
    } else {
      var encryptedStrongKey = JSON.parse(snapshot.val()).data; // or encrypted checkstring for legacy accounts

      var hashedKey, goodKey = true;

      try {
        hashedKey = hashString(key);
      } catch (e) {
        goodKey = false;
        wrongKey ("Wide Character Error");
      }

      if (goodKey) {
        openpgp.decrypt({ message: openpgp.message.readArmored(encryptedStrongKey), passwords: [hashedKey],  format: 'utf8' }).then(function(plaintext) {
            rightKey(plaintext, hashedKey);
        }).catch(function(error) {
            checkLegacyKey(dataRef, key, hashedKey, encryptedStrongKey, function(plaintext){
              rightKey(plaintext, hashedKey);
              // if it's wrong, wrongKey() will be called in checkLegacyKey in main.js
            });
        });
      } else {
        wrongKey ("Wide Character Error");
      }
    }
  });
}

function rightKey (plaintext, hashedKey) {
  // var theStrongKey = plaintext.data;
  // var theKey = theStrongKey;
  sessionStorage.setItem("key", JSON.stringify(hashedKey));

  newEncryptedKeycheck(hashedKey,function(newKeycheck){
    var encryptedKeycheck = newKeycheck; // here we encrypt a timestamp using the hashedKey, and save this to localstore.
    localStorage.setItem("encryptedKeycheck", encryptedKeycheck); // we will use this in docs offline mode to verify the entered encryption key is correct.
    signInComplete();
  });
}

function wrongKey (error) {
  console.log("wrong key or ", error);
  sessionStorage.removeItem('key');
  showKeyModal();
  $('#key-status').html("Wrong key, please try again.");
}


function keyModalApproved (){
  $('#key-status').html("Checking key");
  var key = $('#key-input').val();
  checkKey(key);
}

function signInComplete () {
  if (getUrlParameter("redirect")) {
    if (getUrlParameter("dlddid")) {
      window.location = getUrlParameter("redirect") + "?dlddid=" + getUrlParameter("dlddid");
    } else {
      window.location = getUrlParameter("redirect");
    }
  } else {
    window.location = "home";
  }
}

$("#key-input").on('keydown', function (e) {
  setTimeout(function(){
    if (e.keyCode == 13) {
        keyModalApproved ();
    }
  },50);
});

function checkSigninButton () {

  // sign up with username & pass
  if ($("li[tab='userpass']").hasClass("is-active")) {
    logintype = "password";
    if ($("#signin-user").val().trim() !== "" && $("#signin-pass").val().trim() !== "") {
      $("#signin-button").prop('disabled', false);
    } else {
      $("#signin-button").prop('disabled', true);
    }

  }

  if ($("li[tab='google']").hasClass("is-active")) {
    logintype = "google";
    $("#signin-button").prop('disabled', false);
  }

  if ($("li[tab='smartid']").hasClass("is-active")) {
    logintype = "smartid";
    if ($("#signin-si-personal-code").val().trim() !== "") {
      $("#signin-button").prop('disabled', false);
    } else {
      $("#signin-button").prop('disabled', true);
    }
  }

  if ($("li[tab='mobileid']").hasClass("is-active")) {
    logintype = "mobileid";
    if ($("#signin-mi-personal-code").val().trim().replace(" ", "") !== "" && $("#signin-mi-phone-number").val().trim().replace(" ", "") !== "") {
      $("#signin-button").prop('disabled', false);
    } else {
      $("#signin-button").prop('disabled', true);
    }
  }

  setTimeout(function () {
    checkSigninButton();
  }, 250);
}

$("input").on("keydown keypress paste copy cut change", function(){
  setTimeout(function(){
    checkSigninButton();
  },50);
});


function signin(token){
  $("#signin-button").addClass('is-loading').prop('disabled', true);

  if ($("li[tab='userpass']").hasClass("is-active")) {

    var email;
    sessionStorage.clear();
    // try { sessionStorage.setItem("sessionID", sessionID); } catch (e) {}

    if ($("#signin-user").val().indexOf("@") != -1) {
      email = $("#signin-user").val();
    } else {
      email = $("#signin-user").val() + "@users.crypt.ee";
    }
    var password = $("#signin-pass").val();
    firebase.auth().signInWithEmailAndPassword(email, password).catch(function(error) {
      var errorCode = error.code;
      var errorMessage = error.message;
      if (errorCode === 'auth/wrong-password' || errorCode === 'auth/user-not-found' || errorCode === 'auth/invalid-email') {
        $("#wrong-password").fadeIn(500);
      } else if (errorCode === 'auth/user-disabled'){
        $("#user-disabled").fadeIn(500);
      } else {
        $("#other-error").fadeIn(500);
      }
      $("#signin-button").removeClass('is-loading').prop('disabled', false);
    });

  }

  if ($("li[tab='google']").hasClass("is-active")) {
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.addScope('email');
    if (isInWebAppiOS) {
      // firebase.auth().signInWithRedirect(provider);

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
      firebase.auth().signInWithPopup(provider).catch(function(error) {
        console.log(error);
        $("#other-error").fadeIn(500);
        $("#signin-button").removeClass('is-loading').prop('disabled', false);
      });
    }
  }

  if ($("li[tab='smartid']").hasClass("is-active")) {
    $("#signin-info").html("If you are a Smart-ID user, you will receive a verification notification on your phone shortly.<br><br> Only type your pin code, if the numbers you see on your phone are :<br><b style='font-size:24px;'></b>").removeClass("is-warning").addClass("is-info").show();
    $("#signin-button").addClass('is-loading').prop('disabled', true);

    $.ajax({
      url : requestsURL + 'sidlogin',
      type: 'POST',
      dataType : "json",
      data: {personal: $("#signin-si-personal-code").val().trim().replace(" ", ""), country: $("input[type='radio']:checked").val()}
    }).done(function( response ) {
      // ping("message",{msg : "sidCodeDisplayed"});
      gotSIResponse(response.code, response.istoken);
    }).fail(function(){
      // ping("message",{msg : "sidIssueOrUserError"});
      $("#signin-info").html("Something went wrong. Please double check the information you've entered is correct and try again. If you are certain the information is correct, Smart-ID must be experiencing issues, and it should start working again in a few minutes.").removeClass("is-info").addClass("is-warning");
      $("#signin-button").removeClass('is-loading').prop('disabled', false);
    });
  }

  if ($("li[tab='mobileid']").hasClass("is-active")) {
    $("#signin-button").addClass('is-loading').prop('disabled', true);
    $("#signin-info").html("If you are a Mobile-ID user, you will receive a Mobile-ID verification prompt on your phone shortly.").removeClass("is-warning").addClass("is-info").show();
    $.ajax({
      url : requestsURL + 'midlogin',
      type: 'POST',
      dataType : "json",
      data: {personal: $("#signin-mi-personal-code").val().trim().replace(" ", ""), phone: $("#signin-mi-phone-number").val().trim().replace(" ", "")}
    }).done(function( response ) {
      // ping("message",{msg : "midCodeDisplayed"});
      gotMIResponse(response.code, response.istoken);
    }).fail(function(){
      // ping("message",{msg : "midIssueOrUserError"});
      $("#signin-info").html("Something went wrong. Please double check the information you've entered is correct and try again. If you are certain the information is correct, Mobile-ID must be experiencing issues, and it should start working again in a few minutes.").removeClass("is-info").addClass("is-warning");
      $("#signin-button").removeClass('is-loading').prop('disabled', false);
    });
  }

}

function tryGettingIdTokenFromCrypteeGAuth(googleAuthUUID) {
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





firebase.auth().getRedirectResult().then(function(result) {
  // console.log(result);
}).catch(function(error) {
  console.log(error);
  $("#other-error").fadeIn(500);
  $("#signin-button").removeClass('is-loading').prop('disabled', false);
});

function gotSIResponse (code, token) {
  $("#signin-info").html("If you are a Smart-ID user, you will receive a verification notification on your phone shortly.<br><br> Only type your pin code, if the numbers you see on your phone are :<br><b style='font-size:24px;'>"+code+"</b>").removeClass("is-warning").addClass("is-info").show();
  $.ajax({
    url : requestsURL + 'sidstatus',
    type: 'POST',
    dataType : "json",
    data: {personal: $("#signin-si-personal-code").val().trim(), istoken: token}
  }).done(function( response ) {
    if (response.crtoken) {
      // ping("message",{msg : "gotSidConfirmation"});
      gotToken(response.crtoken);
    } else {
      console.log(response);
    }
  }).fail(function(){
    // ping("message",{msg : "gotSidError"});
    $("#signin-info").html("Something went wrong. Please double check the information you've entered is correct and try again.").removeClass("is-info").addClass("is-warning");
    $("#signin-button").removeClass('is-loading').prop('disabled', false);
  });
}

function gotMIResponse (code, token) {
  $("#signin-info").html("You will receive a notification on your phone shortly.<br><br> Only type your pin code, if the numbers you see on your phone are :<br><b style='font-size:24px;'>"+code+"</b>").show();
  $.ajax({
    url : requestsURL + 'midstatus',
    type: 'POST',
    dataType : "json",
    data: {personal: $("#signin-mi-personal-code").val().trim(), istoken: token}
  }).done(function( response ) {
    if (response.crtoken) {
      // ping("message",{msg : "gotMidConfirmation"});
      gotToken(response.crtoken);
    } else {
      console.log(response);
    }
  }).fail(function(){
    // ping("message",{msg : "gotMidError"});
    $("#signin-info").html("Something went wrong. Please double check the information you've entered is correct and try again.").removeClass("is-info").addClass("is-warning");
    $("#signin-button").removeClass('is-loading').prop('disabled', false);
  });
}


function signinRequest() {
  $.ajax({ url: signinURL, type: 'POST',
      success: function(data){
        gotToken(data);
      },
      error:function (xhr, ajaxOptions, thrownError){
          console.log(thrownError);
      }
  });
}

var tokenRetry = false;
function gotToken(token) {
  firebase.auth().signInWithCustomToken(token).catch(function(error) {
    var errorCode = error.code;
    var errorMessage = error.message;
    console.log("error signing in with token");

    if (!tokenRetry) {
      setTimeout(function () {
        tokenRetry = true;
        gotToken(token);
      }, 2000);
    } else {
      $("#signin-info").html("Something went wrong. It seems we can't process the signin at this moment. Please try again in a minute.").removeClass("is-info").addClass("is-warning");
      $("#signin-button").prop('disabled', false).removeClass("is-loading is-success").html("Try Again");
      tokenRetry = false;
    }
  });
}

$("#signin-button").on('click', function(event) {
  event.preventDefault();
  // ping("click", {
  //   btn : "signIn",
  //   method : $("li.is-active").attr("tab")
  // },function(){
    signin ();
  // });
});

$("#signin-pass, #signin-si-personal-code, #signin-mi-phone-number").on('keydown', function (e) {
  setTimeout(function(){
    if (e.keyCode == 13 && !$("#signin-button").hasClass("is-loading")) {
      // ping("keydown", {
      //   btn : "signIn",
      //   method : "userpass"
      // },function(){
        signin ();
      // });
    }
  },50);
});

$("#signin-user").on('keydown', function (e) {
  setTimeout(function(){
    if (e.keyCode == 13) {
      $("#signin-pass").focus();
    }
  },50);
});
