////////////////////////////////////////////////
//////////////// FIREBASE SETUP ////////////////
////////////////////////////////////////////////

var config = {
    apiKey: "AIzaSyBzI3Sr5lx_mhbmmlS8eehdUBfRXb7EyRk",
    authDomain: "flare.crypt.ee",
    databaseURL: "https://cryptee-54307.firebaseio.com",
    projectId: "cryptee-54307",
    storageBucket: "cryptee-54307.appspot.com",
    messagingSenderId: "88760710137"
  };

firebase.initializeApp(config);
var db = firebase.database();
var store = firebase.storage();
var tokenURL = "https://crypt.ee/api/auth";
var offlineStorage = localforage.createInstance({ name: "offlineStorage" });
var offlineErrorStorage = localforage.createInstance({ name: "offlineErrorStorage" });
var firebaseVersion = firebase.SDK_VERSION;

////////////////////////////////////////////////////
///////////// AUTHENTICATION HELPERS ///////////////
////////////////////////////////////////////////////

function signOut () {
  purgeOfflineStorage();
  firebase.auth().signOut().then(function() {
    try { localStorage.clear(); } finally {
      console.log('Signed Out');
      if (location.pathname === "/signin" || location.pathname === "/signin.html") {
        window.location.reload(true);
      }
    }
  }, function(error) {
    handleError("Error signing out", error);
  });
}

function saveUserDetailsToLS (theUsername, usedStorage, allowedStorage, paid) {
  localStorage.setItem('crypteeuser', JSON.stringify({
    "theUsername" : theUsername,
    "usedStorage" : usedStorage,
    "allowedStorage"  : allowedStorage,
    "paid" : paid
  }));
  setSentryTag("availableStorage", formatBytes(allowedStorage - usedStorage));
  setSentryTag("paid", paid);
}

function loadUserDetailsFromLS () {
  if (localStorage) {
    var crypteeuser = JSON.parse(localStorage.getItem("crypteeuser"));
    if (crypteeuser !== null && crypteeuser !== undefined && crypteeuser !== "") {
      var uname = crypteeuser.theUsername;
      var usedStorage = crypteeuser.usedStorage;
      var allowedStorage = crypteeuser.allowedStorage;

      $('.username').html(uname);
      $('#settings-storage-used').html(formatBytes(usedStorage, 0));
      $('.settings-storage-total').html(formatBytes(allowedStorage, 0));
      $("html, body").removeClass("is-loading");
      if (allowedStorage > paidUserThresholdInBytes) { 
        $("#upgrade-button, #donate-button, #upgrade-setting").hide();  
        $("#upgrade-button, .upgrade-setting-card, #donate-button").fadeOut();
        $(".paid-plan-only, .is-paid-plan").show();
      } else {
        $("#upgrade-button, #donate-button, #upgrade-setting").show();  
        $("#upgrade-button, .upgrade-setting-card, #donate-button").fadeIn();
        $(".paid-plan-only, .is-paid-plan").hide();
      }
    } else {
      console.log("no user found in localstorage");
    }
  }
}

function purgeOfflineStorage () {
  try { localStorage.clear(); } catch (e) {}
  try { sessionStorage.clear();} catch (e) {}
  try { offlineStorage.clear(); } catch (e) {}
  try { offlineErrorStorage.clear(); } catch (e) {}
}

////////////////////////////////////////////////////
/////////////   WEB APP AUTH CARRYOVER    //////////
////////////////////////////////////////////////////


var lastWebAppReminder = parseInt(localStorage.getItem("webapp-reminder"));
var oneDayInMilliseconds = 86400000;

function authenticatediOSWebApp () {


}

function unauthenticatediOSWebApp (redirectURL) {

  window.location = redirectURL;
  retokening = false;

}

function authenticatediOSBrowser () {
  // IF we're in iOS, append token to the end of URL.

  if (navigator.userAgent.match('CriOS') || navigator.userAgent.match('FxiOS')) {
    // IT IS A CHROME OR FIREFOX IN IOS. FML. CHANGE COPY ON WEBAPP WARNING.
    $(".the-webapp-description").html('To have a much better and refined experience, open Cryptee in Safari, navigate to this page, then tap on <img src="../assets/ios-share.svg" alt="iOS Add to Home Screen" style="max-height:26px; display:inline; width: 26px; vertical-align: middle;" /> and choose "Add to Home Screen".<br class="is-hidden-tiny"> Cryptee will work just like a regular app on your device, without a need for the browser.');
  }

  var providerId;
  var loginMethod;
  if (theUser.toJSON().providerData[0]) {
    providerId = theUser.toJSON().providerData[0].providerId;
    if (providerId !== "" && providerId !== " ") {
      loginMethod = providerId; //password //google.com //phone
    }
  } else {
    loginMethod = "eid"; // if none, smartid.
  }

  if (loginMethod === "google.com") {
    // tokenizeURL();
  }

  if (lastWebAppReminder) {
    if (lastWebAppReminder <= (new Date()).getTime() - oneDayInMilliseconds){
      showModal("webapp-modal");
    }
  } else {
    showModal("webapp-modal");
  }
}

function remindWebAppLater() {
  hideModal('webapp-modal');
  var mil = (new Date()).getTime().toString();
  localStorage.setItem("webapp-reminder", mil);
}

function authenticatedUser() {

  if (isios && !isInWebAppiOS) {
    authenticatediOSBrowser();
  }

  if (isInWebAppiOS) {
    authenticatediOSWebApp();
  }

  $("html, body").removeClass("is-loading");
}

function webAppURLController (redirectURL) {
  if (redirectURL) {
    // DID NOT GET USER,
    // REDIRECT TO SIGN IN
    // IF IT'S NOT AN IOS WEB APP & DOESN'T HAVE TOKEN

    if (isInWebAppiOS) {
      unauthenticatediOSWebApp (redirectURL);
    } else {
      window.location = redirectURL;
    }
  } else {
    // GOT USER,
    // if user is a google user,
    // TOKENIZE URL IF ON IOS AND NOT A WEB APP

    authenticatedUser();
  }
}
