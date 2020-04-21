
////////////////////////////////////////////////////
///////////////////   KEY MODAL    /////////////////
////////////////////////////////////////////////////

var latest = (new Date()).getTime();
var photoJSON = "https://static.crypt.ee/signin-photo.json";
var photoURL = "https://static.crypt.ee/signin-photo.jpg";
var unsplashObject;
function loadKeyModalBackground () {
  if (darkMode) {
    photoJSON = "https://static.crypt.ee/signin-photo-night.json";
    photoURL = "https://static.crypt.ee/signin-photo-night.jpg";
  }

  $.ajax({ url: photoJSON }).done(function(data) {
    unsplashObj = JSON.parse(data);

    $('<img/>').attr('src', photoURL).on('load', function() {
      $(this).remove();
      $('#key-modal').find("img").attr('src', photoURL);
      $('#photo-credit').html("&copy; &nbsp;" + unsplashObj.author + " via Unsplash");
      $('#photo-credit').attr("href", unsplashObj.author_url); 
      $('#key-modal').removeClass("img-loading");
    });

  });
}

$("#key-modal").on('click', function(event) {
  $("#key-input").focus();
}); 

logTimeStart('Time Until KeyModal');
function showKeyModal () {
  breadcrumb('Showing Key Modal');
  logTimeEnd('Time Until KeyModal');
  // 767 to accommodate ipads / other portrait tablets
  if ($(window).width() > 767) {
    loadKeyModalBackground();
  } else {
    $("#photo-credit").hide();
  }

  $("#key-modal").addClass("shown");
  setTimeout(function () {
    $("html, body").addClass("modal-is-active");
    $("#key-input").focus();
  }, 750);

  if (isInWebAppiOS || isInWebAppChrome) {
    $('#photo-credit').html("Security Preferences <span class='icon'><i class='fa fa-cog'></i></span>");
    $('#photo-credit').attr("href", "/account?action=security").removeClass("openInSafari").removeAttr("target"); 
    $("#photo-credit").show();
  }
}

function hideKeyModal () {
  breadcrumb('Hiding Key Modal');
  $("html, body").removeClass("modal-is-active");
  $("#key-modal").removeClass("shown");
  setTimeout(function () {
    $("#key-input").blur();
  }, 100);
}


function wrongKey (error) {
  logTimeEnd("Checking Key");
  setTimeout(function () {
    $("#key-modal-decrypt-button").removeClass("is-loading");
  }, 1000);
  console.log("wrong key or ", error);
  try {
    sessionStorage.removeItem('key');
    localStorage.removeItem('memorizedKey');
  } catch (e) {}
  if ($("#key-modal")[0]) {  
    showKeyModal();
  }
  $('#key-status').html('<span class="icon"><i class="fa fa-exclamation-triangle fa-fw fa-sm"></i></span> Wrong key, please try again.');
  $("#key-status").addClass("shown");
  $("#key-modal-signout-button").addClass("shown");
  $("#key-input-downloads").prop('disabled', false);
  $("#prepare-downloads-button").removeClass("is-success is-dark is-loading disable-clicks").addClass("is-danger").html("Wrong Key");
}

function keyModalApproved (){
  $('#key-status').html('<span class="icon"><i class="fa fa-key fa-fw fa-sm"></i></span> Checking Key');
  $("#key-modal-decrypt-button").addClass("is-loading");
  var key = $('#key-input').val();
  checkKey(key);
}


$("#key-input").on('keydown', function (e) {
  setTimeout(function(){
    lastActivityTime = (new Date()).getTime();
    if (e.keyCode == 13 && $('#key-input').val()) {
      keyModalApproved ();
    }
  },50);
});


////////////////////////////////////////////////////
///////////////   TOKEN MANAGEMENT   ///////////////
////////////////////////////////////////////////////
var retokening = false;
function getToken (callback) {
  callback = callback || noop;
  if (!retokening) {
    
    retokening = true;
    
    if (theUser) {
      breadcrumb('[TOKEN] Getting ID Token');
      theUser.getIdToken(true).then(function(idToken) {
        breadcrumb('[TOKEN] Got ID Token');
        breadcrumb('[TOKEN] Getting New Auth Token');
        $.ajax({
          url: tokenURL,
          type: 'POST',
          headers: { "Authorization": "Bearer " + idToken },
          contentType: "text/plain; charset=utf-8",
          success: function(data) {
            gotToken(data, callback);
          },
          error: function(xhr, ajaxOptions, thrownError) {
            handleError("Error Getting Custom Token (Network Req Failed)", thrownError);
            callback();
            retokening = false;
          }
        });

      }).catch(function(error) {
        if (error.code !== "auth/network-request-failed") {
          handleError("Error Getting ID Token", error, "warning");
        } else {
          handleError("Error Getting ID Token (Network Req Failed)", error);
        }
        callback();
        retokening = false;
      });
    } else {
      setTimeout(function () {
        getToken();
      }, 1000);
    }
  
  }
}

function gotToken (tokenData, callback) {
  var token = tokenData;
  callback = callback || noop;
  if (token) {
    breadcrumb('[TOKEN] Got New Auth Token');
    breadcrumb('[TOKEN] Signing In With New Auth Token');
    firebase.auth().signInWithCustomToken(token).then(function(){
      breadcrumb('[TOKEN] Signed In With New Auth Token');
      retokening = false;
      callback();
    }).catch(function(error) {
      if (error.code !== "auth/network-request-failed") {
        handleError("Error Signing In With Token", error);
      } else {
        handleError("Error Signing In With Token (Network Req Failed)", error);
      }
      callback();
      // TODO CREATE SOME SORT OF ERROR HANDLING MECHANISM FOR TOKEN-SIGNIN ERRORS
      setTimeout(function() {
        retokening = false;
      }, 5000);
    });
  } else {
    handleError("Error Signing In With Token, Undefined Token");
    callback();
    setTimeout(function() {
      retokening = false;
    }, 5000);
  }
}

////////////////////////////////////////////////////
////////////  AUTHENTICATION & PERSISTENCE /////////
////////////////////////////////////////////////////

var theUser, theUserJSON, theUserID, theUsername, theEmail, emailVerified, theUserPlan, keycheck;

function authenticate(gotUserCallback, noUserCallback) {
  var authStartTime = (new Date()).getTime();
  breadcrumb('[AUTH] Re/Authenticating');
  firebase.auth().onAuthStateChanged(function(user) {
    var authEndTime = (new Date()).getTime();
    var timeToAuth = (authEndTime - authStartTime) + "ms";
    breadcrumb("[AUTH] Took " + timeToAuth);
    setSentryTag("time-to-auth", timeToAuth);
    if (!user) {
      // if not logged in
      breadcrumb('[AUTH] Not Logged In');
      
      purgeOfflineStorage();
      noUserCallback();

    } else {
      // user logged in
      breadcrumb('[AUTH] Logged In');
      
      createUserDBReferences(user);
      gotUserCallback(user);
      getToken();

    }
  }, function(error){
    if (error.code !== "auth/network-request-failed") {
      handleError("Error Authenticating", error);
    }
  });
}


////////////////////////////////////////////////////
/////////////// IN APP AUTHENTICATION //////////////
////////////////////////////////////////////////////

var rootRef, dataRef, metaRef;
var theToken;
var isPaidUser;
var usedStorage, allowedStorage;

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

  rootRef       = store.ref().child('/users/' + theUserID);
  dataRef       = db.ref().child('/users/' + theUserID + "/data/");
  metaRef       = db.ref().child('/users/' + theUserID + "/meta/");

  setSentryUser(theUserID);
  $('.username').html(theUser.displayName || theEmail);

  /////////////////////////////
  // APP SPECIFIC REFERENCES //
  /////////////////////////////

  // ONLY INITIALIZING THESE IN APPS THEMSELVES TO AVOID NAMESPACE CONFLICTS
  // LIKE "homeRef" can be home doc in Docs, but home Album in Photos etc.
  // or titlesRef etc. 
  
  var app = location.pathname.replace("/", "");

  if (app === "docs") {
    homeGenerationRef = db.ref().child('/users/' + theUserID + "/data/homegeneration");
    foldersRef = db.ref().child('/users/' + theUserID + "/data/folders/");
  }  

  if (app === "photos") { 
    userRef =  firestore.collection("users").doc(theUserID);
    homeRef =    userRef.collection("photos");
    titlesRef =  userRef.collection("titles");
    uploadsRef = userRef.collection("uploads");
    favRef =     userRef.collection("favorites");
  }

  if (app === "account") {
    ordersRef = db.ref().child('/users/' + theUserID + "/orders/");
    returnsRef = db.ref().child('/users/' + theUserID + "/returns/");
    foldersRef = db.ref().child('/users/' + theUserID + "/data/folders/");
    photosRef = firestore.collection("users").doc(theUserID).collection("photos");
    photosTitlesRef = firestore.collection("users").doc(theUserID).collection("titles");
  }

}

function gotMeta(userMeta) {
  if (userMeta.val() !== null) {
    allowedStorage = userMeta.val().allowedStorage || freeUserQuotaInBytes;
    usedStorage = 0;
    
    if (userMeta.val().usedStorage) {
      usedStorage = userMeta.val().usedStorage - 105000; // -105kb to pad for the first home doc
      // if it's less than 100kb or less than 0, show 0. otherwise show the true value.
      if (usedStorage <= 0) { usedStorage = 0; } else { usedStorage = userMeta.val().usedStorage; }
    }

    $(".used-storage").html(formatBytes(usedStorage));
    $('#settings-storage-used').html(formatBytes(usedStorage, 0));

    $(".allowed-storage").html(formatBytes(allowedStorage));
    $('.settings-storage-total').html(formatBytes(allowedStorage, 0));

    $(".usage-progress").attr("value", usedStorage).attr("max", allowedStorage);

    var paidOrNot = false; // to save into localstorage

    if (userMeta.val().hasOwnProperty("plan") && userMeta.val().plan !== "") {
      // paid user remove upgrade button

      // if user changed plans, hide low storage warning.
      // if they lowered it we'll show it again shortly below, since they will have exceeded anyway.

      if (userMeta.val().plan !== theUserPlan) {
        hideLowStorageWarning();
      }

      theUserPlan = userMeta.val().plan;
      $("#upgrade-button").hide();
      paidOrNot = true;
      isPaidUser = true;
    }

    if (usedStorage >= allowedStorage){      
      exceededStorage();
    } else if ((usedStorage >= allowedStorage * 0.8) && !huaLowStorage){
      try { quill.blur(); } catch (e){}
      if (location.pathname.indexOf("home") === -1) {
        if (!isPaidUser) { // show at 80% for unpaid users
          showLowStorageWarning();
        } else {
          if (usedStorage >= allowedStorage * 0.95) { // show at 95% for paid users
            showLowStorageWarning();
          }
        }
      }
    }

    saveUserDetailsToLS(theUsername, theEmail, usedStorage, allowedStorage, paidOrNot, theUserPlan);
  }
}

////////////////////////////////////////////////////
////////////////  KEYCHECK & PERSISTENCE ///////////
////////////////////////////////////////////////////

// SUBSTITUTE FOR 
// dataRef.child("keycheck").once('value').then(function(snapshot)
// but returns snapshot.val() instead. 

// UTILIZES SESSION STORAGE, SO THIS RUNS ONCE, FOR EACH SESSION.
// MOST LIKELY WILL BE @ HOME ON MOBILE.

// Takes about 750 - 1250ms if it makes a call to the server. 
// It's stored in sessionStorage to save time, but DO NOT store this in localstorage to save more time. 
// if user changes their encryption key, and this is in localstorage,
// old key would still allow access to the strongKey. 
// Effectively rendering changing encryption key useless 

function getKeycheck() {
  return new Promise(function (resolve, reject) {
    try {
      keycheck = sessionStorage.getItem("session-keycheck");
    } catch (e) {}

    if (!keycheck) {
      if (theUserID) {
        //  CHECK IF USER HAS KEY IN DATABASE. 
        dataRef.child("keycheck").once('value').then(function(snapshot) {
          if (snapshot.val() === null) {
            // IF NO KEYCHECK IN DB REDIRECT TO SIGNUP.
            window.location = "signup?status=newuser";
          } else {
            keycheck = snapshot.val();
            
            try {
              sessionStorage.setItem("session-keycheck", keycheck);
            } catch (e) {}
            
            resolve(keycheck);
          
          }
        }).catch(reject);
      } else {
        window.location = "signin";
      }
    } else {
      resolve(keycheck);
    }
    
  });
}