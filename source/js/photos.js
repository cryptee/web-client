////////////////////////////////////////////////////
////////////////// ALL GLOBAL VARS /////////////////
////////////////////////////////////////////////////

var theKey = JSON.parse(sessionStorage.getItem('key'));
var theUser;
var theUserID;
var theUsername;
var theToken;
var connectedRef;

var reauthenticated = false;
var retokening = false;
var initialLoadComplete = false;
var connected = false;

var photoJSON = "https://storage.googleapis.com/cryptee-54307.appspot.com/public/signin-photo.json";
var unsplashObject;
var upOrDownInProgress = false;

////////////////////////////////////////////////////
////////////////// SIGN IN AND KEY /////////////////
////////////////////////////////////////////////////

function getToken() {
  if (!retokening) {
    retokening = true;
    firebase.auth().currentUser.getIdToken(true).then(function(idToken) {

      $.ajax({ url: tokenURL, type: 'POST',
          headers: { "Authorization": "Bearer " + idToken },
          contentType:"application/json; charset=utf-8",
          success: function(data){ gotToken(data); },
          error:function (xhr, ajaxOptions, thrownError){
              console.log(thrownError);
              retokening = false;
          }
      });
    }).catch(function(error) {
      // TODO CREATE SOME SORT OF ERROR HANDLING MECHANISM FOR TOKEN-FETCHING ERRORS
      Raven.captureException(JSON.stringify(error));
      console.log("error getting token");
      retokening = false;
    });
  }
}

function gotToken(tokenData) {
  var token = tokenData;
  firebase.auth().signInWithCustomToken(token).catch(function(error) {
    var errorCode = error.code;
    var errorMessage = error.message;
    Raven.captureException(JSON.stringify(error));
    // TODO CREATE SOME SORT OF ERROR HANDLING MECHANISM FOR TOKEN-SIGNIN ERRORS
    setTimeout(function () {
      retokening = false;
    }, 5000);
    console.log("error signing in with token");
  });
}

firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    //got user // if this is a reauth don't start process again.
    if (reauthenticated) {
      // console.log("reauthenticated");
    } else {
      reauthenticated = true;
      theUser = user;
      theUserID = theUser.uid;
      theUsername = theUser.displayName;

      rootRef = store.ref().child('/users/' + theUserID);
      connectedRef = firebase.database().ref(".info/connected");

      $('.username').html(theUsername);

      if (theKey) { checkKey(theKey); }
      else { showKeyModal(); }
    }

    getToken();

  } else {
    // no user. redirect to sign up
    window.location = "signin.html?redirect=photos";
  }
});

function showKeyModal () {
  $("#key-modal").addClass("is-active");
  setTimeout(function () {
    $("#key-input").focus();
  }, 500);
}

function hideKeyModal () {
  $("#key-modal").removeClass("is-active");
  $("#key-input").blur();
}

function checkKey (key){
  key = key || theKey;

  db.ref('/users/' + theUserID + "/data/keycheck").once('value').then(function(snapshot) {
    var checkString = JSON.parse(snapshot.val()).data;
    var theCheck;
    openpgp.decrypt({ message: openpgp.message.readArmored(checkString), password: key,  format: 'utf8' }).then(function(plaintext) {
        theCheck = plaintext.data;
        sessionStorage.setItem('key', JSON.stringify(key));
        hideKeyModal();
        theKey = key;
        // signInComplete();
    }).catch(function(error) {
        console.log("wrong key or ", error);
        sessionStorage.removeItem('key');
        showKeyModal();
        $('#key-status').html("Wrong key, please try again.");
    });
  });
}


function keyModalApproved (){
  $('#key-status').html("Checking key");
  var key = $('#key-input').val();
  checkKey(key);
}


function signOut(){
  try { sessionStorage.clear(); sessionStorage.removeItem('key'); } finally {
    firebase.auth().signOut().then(function() {
      console.log('Signed Out');
    }, function(error) {
      Raven.captureException(JSON.stringify(error));
      console.error('Sign Out Error', error);
    });
  }
}


$("#key-input").on('keyup', function (e) {
    if (e.keyCode == 13) {
        keyModalApproved ();
    }
});

function signInComplete () {

  connectedRef.on("value", function(snap) {
    connectionStatus(snap.val());
  });

  metaRef.on('value', function(userMeta) {
    allowedStorage = userMeta.val().allowedStorage || freeUserQuotaInBytes;
    usedStorage = userMeta.val().usedStorage || 0;

    if (userMeta.val().hasOwnProperty("plan") && userMeta.val().plan !== "") {
      // paid user remove upgrade button
        $("#upgrade-button").parents("li").hide();
        $("#low-storage-warning").removeClass('showLowStorage viaUpgradeButton');
        closeExceededStorageModal();
      if (usedStorage >= allowedStorage){
        showBumpUpThePlan(true);
      } else if ((usedStorage >= allowedStorage * 0.8) && !huaLowStorage){
        showBumpUpThePlan(false);
      } else if ((usedStorage <= (allowedStorage - 1500000000)) && userMeta.val().quantity >= 6){
        bumpDownThePlan();
      }
    } else {

      if (usedStorage >= allowedStorage){
        $(".exceeded-storage").html(formatBytes(usedStorage + 100000 - allowedStorage));
        exceededStorage();
      } else if ((usedStorage >= allowedStorage * 0.8) && !huaLowStorage){
        $("#low-storage-warning").addClass('showLowStorage');
      }

    }
  });

}


////////////////////////////////////////////////////
/////////////////// STATUS DISPLAY //////////////////
////////////////////////////////////////////////////

function showProgress (status){
  $("#status").html(status);
  $(".loading-message").stop(true, true).fadeIn(100);
}

function hideProgress (callback){
  callback = callback || noop;
  $(".loading-message").stop(true, true).fadeOut(100, function() {
      callback();
  });
}


////////////////////////////////////////////////////
/////////////////// WINDOW EVENTS //////////////////
////////////////////////////////////////////////////


$(window).resize(function(event) {

});

$(window).on("load", function(event) {
  if (isMobile) {
    $(".modal-img-credit").hide();
  } else {
    $.ajax({url: photoJSON}).done(function(data) {
      unsplashObj = JSON.parse(data);
      $('.key-modal-background').css("background-image", "url("+unsplashObj.photo_url+")").css("background-size", "cover");
      $('#photo-credit').html("&copy; &nbsp;" + unsplashObj.author + " via Unsplash");
      $('#photo-credit').attr("href", unsplashObj.author_url);
    });
  }

  if (isInWebAppiOS) {
    // $("#upload-progress, #active-doc-contents, #file-viewer").addClass("iosPinned");
  }
});

// Enable navigation prompt
window.onbeforeunload = function() {
  if (upOrDownInProgress){
    return true;
  }
};


////////////////////////////////////////////////////
//////////////////// LAYOUT STUFF //////////////////
////////////////////////////////////////////////////

$('#photos-contents').masonry({
  itemSelector: '.image',
  columnWidth: '.gridSizer',
  percentPosition : true
});

// CALL  $('#photos-contents').masonry(); after each photo loaded.
