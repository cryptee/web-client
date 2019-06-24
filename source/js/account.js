
var thePhone;
var thePersonalCode;
var theOrders, theReturns;
var connectedRef;

var ordersRef;
var foldersRef;

var firestore = firebase.firestore();
var cloudfunctions = firebase.functions();

var reauthenticated = false;
var willLoseAuthForDeletion = false;
var connected;
var userToken;
var passVerified = false;
var passIsGood = false;
var keyVerified = false;
var keyIsGood = false;
var monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
var loginMethod = "";
var deletionMarkForData;
var deletionMarkForMeta;
var updateURL, cancelURL;
var pendingProration = false;

var productForPaddle = 523200;
var emailForPaddle;
var countryForPaddle;
var zipForPaddle;
var couponForPaddle = getUrlParameter("coupon") || "";

var encryptedStrongKey;

loadUserDetailsFromLS();
checkLatestVersion();

try {
  sessionStorage.removeItem('key');
} finally { }

//////////////////////////////////////////////////////
//////////////////// HELPERS ////////////////////////
/////////////////////////////////////////////////////

$(".account-menu-collapse").on('click', function(event) {
  $("#account-menu-left").toggleClass("collapsed");
  $(".account-menu-collapse").find("i").toggleClass("fa-chevron-left").toggleClass("fa-bars");
}); 


$("body").on('click', function(event) {
  if ($(window).width() < 768) { 
    if (!$(event.target).parents(".account-menu-collapse").length > 0 && !$(event.target).is(".account-menu-collapse")) {
      if (!$("#account-menu-left").hasClass("collapsed")) {
        $("#account-menu-left").addClass("collapsed");
        $(".account-menu-collapse").find("i").removeClass("fa-chevron-left").addClass("fa-bars");
      }
    }
  }
}); 


$(".menu-list").on('click', 'li', function(event) {
  whichTab = $(this).attr("tab");
  loadTab(whichTab);
});

function loadTab(whichTab) {

  if (whichTab === "history" || whichTab === "payments-plan") {
    theKey = null;
    loadJS('https://cdn.paddle.com/paddle/paddle.js', function(){
      paddleInit();
    }, document.body);
    checkIfPaddleIsLoaded();
    if (whichTab === "history") {
      ping("event", {eventCategory: "upgrade", eventAction : "history"});
    } else {
      ping("event", {eventCategory: "upgrade", eventAction : "edit-plan"});
    }
  } else {
    ping("event", {eventCategory: "settings-tab-loaded", eventAction : whichTab});
  }

  $(".settings-tab-contents").hide();
  $(".settings-tab-contents").removeClass('active');
  $("#" + whichTab + "-tab-contents").show();
  $("#" + whichTab + "-tab-contents").addClass("active");
  
  $(".menu-list").find("a").removeClass('is-active');
  $("li[tab="+whichTab+"]").find("a").addClass('is-active');
}

$(window).on('load', function(event) {
  if (isInWebAppiOS || isInWebAppChrome) {
    $("#acct-signout").hide();
  }
  if ($(window).width() < 768) { 
    $("#account-menu-left").addClass("collapsed");
    $(".account-menu-collapse").find("i").removeClass("fa-chevron-left").addClass("fa-bars");
  }
  $("#upgrade-coupon-input").val(couponForPaddle);
});

//////////////////////////////////////////////////////////
//////////////////// AUTHENTICATION  /////////////////////
//////////////////////////////////////////////////////////
checkForAction();

connectedRef = db.ref(".info/connected");

firebase.auth().onAuthStateChanged(function(user) {
  if (!user) {
    if (willLoseAuthForDeletion) {
      try { sessionStorage.removeItem('key'); } finally {
        window.location = "goodbye";
      }
    } else {
      try { sessionStorage.removeItem('key'); } finally {
        webAppURLController("signin?redirect=account");
      }
    }
  } else {
    //got user
    if (!reauthenticated) {
      createUserDBReferences(user);

      gotUser();
      reauthenticated = false;

      var providerId;
      if (theUser.toJSON().providerData[0]) {
        providerId = theUser.toJSON().providerData[0].providerId;
        if (providerId !== "" && providerId !== " ") {
          loginMethod = providerId; //password //google.com //phone
        }
      } else {
        loginMethod = "eid"; // if none, smartid.
      }
      arrangeSettings();
      webAppURLController();
    }
  }
}, function(error){
  if (error.code !== "auth/network-request-failed") {
    handleError("Error Authenticating", error);
  }
});

function gotUser() {
  $('#account-username').html(theUsername || theUser.email);
  if (theEmail.indexOf("@users.crypt.ee") !== -1) {
    // if anonymous email

    if (theEmail.startsWith("mid-")) {
      thePersonalCode = theEmail.replace("mid-", "").replace("@users.crypt.ee", "");
      thePhone = theUser.phoneNumber;
      $("#account-phone").html(thePhone);
      $("#account-personal-code").html(thePersonalCode);
      $("#navbar-phone, #navbar-card").show();
    }
    if (theEmail.startsWith("sid-")) {
      thePersonalCode = theEmail.replace("sid-", "").replace("@users.crypt.ee", "");
      $("#account-personal-code").html(thePersonalCode);
      $("#navbar-card").show();
    }

    $("#upgrade-email").slideDown();

  } else {
    // if not anonymous email
    $('#account-email').html(theEmail);
    $('#navbar-email').show();
    $("#recoveryemail").val(theEmail);
    $("#upgrade-email-input").val(theEmail);
    if (!emailVerified) {
      $("#noemail").show();
      $("#upgrade-email").slideDown();
    }
  }

  if (theUsername === null || theUsername === undefined || theUsername === "") {
    $("#nousername").show();
  }

  dataRef.on('value', function(snapshot) {  gotUserData(snapshot.val()); fillDataExporter(snapshot, null, null); });
  metaRef.on('value', function(snapshot) {  gotUserMeta(snapshot.val()); fillDataExporter(null, snapshot, null); });
  ordersRef.on('value', function(snapshot) {  gotUserOrders(snapshot.val()); fillDataExporter(null, null, snapshot); });

  firebase.auth().currentUser.getIdToken(true).then(function(token) { userToken = token; });

  connectedRef.on("value", function(snap) {
    if (snap.val() === true) {
      connected = true;
    } else {
      connected = false;
    }
  });

  db.ref('/users/' + theUserID + "/data/keycheck").once('value').then(function(snapshot) {
    encryptedStrongKey = JSON.parse(snapshot.val()).data; // or encrypted checkstring for legacy accounts
  });
  
}

function checkForAction() {
  var action = getUrlParameter("action") || "";
  if (action !== "") {
    if (action !== "upgrade") {
      loadTab(action);
    } else {
      openUpgrade();
    }
    
  }
}


function arrangeSettings() {

  if (loginMethod === "password") {

  } else if (loginMethod === "google.com") {
    $("#changepasscard, #recoveryemailcard, #currentpass-delete-field").hide();
    $('#google-reauth-message').show();
  } else {
    $("#changepasscard, #recoveryemailcard, #currentpass-delete-field").hide();
    $('#eid-reauth-message').show();
  }

}

$("#signout-button").on('click', function(event) {
  event.preventDefault();
  signOut();
});

function checkDeletionMarks() {
  if (deletionMarkForData && deletionMarkForMeta && willLoseAuthForDeletion) {
    try { localStorage.removeItem('crypteeuser'); sessionStorage.clear(); sessionStorage.removeItem('key'); } finally {
      window.location = "goodbye";
    }
  }
}













var gotDeletionEIDCode = false;

function gotUserData (data) {
  if (data !== null) {
    foldersCount = data.foldersCount;
    $('#settings-folders-count').html(foldersCount);

    if (data.cancelsub === "done"){
      $('#cancelSubscriptionNotification').hide();
      $('#subscriptionCanceled').show();
      dataRef.update({"cancelsub" : null});
      $("#cancelSubscriptionNotification").find("button").removeClass("is-loading").prop("disabled", false);
    }

    if (data.orderComplete) {
      if (data.orderComplete === "yes" && !pendingProration) {
        orderComplete();
        dataRef.update({"orderComplete" : null});
      }
    }

    if (data.clips) {
      $("#delete-webclips-card").show();
    } else {
      $("#delete-webclips-card").hide();
    }

    if (data.clippers) {
      $("#webclippers-card").show();
      showClippers(data.clippers);
    } else {
      $("#webclippers-card").hide();
    }
    
    var deleteCanceledError = false;
    if (data.deletemecode) {
      if (data.deletemecode !== "") {
        gotEIDResponse(data.deletemecode);
        gotDeletionEIDCode = true;
      } else {
        if (willLoseAuthForDeletion) {
          deleteCanceledError = true;
        }
      }
    } else {
      if (willLoseAuthForDeletion) {
        deleteCanceledError = true;
      }
    }

    if (deleteCanceledError && gotDeletionEIDCode) {
      $("#delete-account-button").removeClass('is-loading').prop('disabled', false);
      $("#delete-account-confirm-button").removeClass('is-loading').prop('disabled', false);
      showReauthPopup("is-warning", "Something went wrong. It seems that either you've cancelled the Smart-ID/Mobile-ID request, or our Smart-ID/Mobile-ID login system is experiencing some trouble. Please try again shortly.");
    }

    gotPreferences(data.preferences);

  } else {
    deletionMarkForData = true; checkDeletionMarks();
  }
}




function gotUserMeta (meta){
  if (meta !== null) {
    var paidOrNot = false;
    usedStorage = meta.usedStorage - 100000;
    if (usedStorage <= 0) { usedStorage = 0; } else { usedStorage = meta.usedStorage; }
    $('#settings-storage-used').html(formatBytes(usedStorage));

    allowedStorage = meta.allowedStorage || freeUserQuotaInBytes;
    $('.settings-storage-total').html(formatBytes(allowedStorage));

    $(".usage-progress").attr("value", usedStorage).attr("max", allowedStorage);

    if (meta.hasOwnProperty("plan") && meta.plan !== "") {
      theUserPlan = meta.plan;
      paidOrNot = true;

      $("#upgrade-button, .upgrade-setting-card").fadeOut();
      $(".paid-plan-only").show();
      $("#payment-method").show();
      populatePlanDetails(meta);
    } else {
      $(".paid-plan-only").hide();
    }

    saveUserDetailsToLS(theUsername, usedStorage, allowedStorage, paidOrNot, theUserPlan);

    setTimeout(function() {
      $("body, html").removeClass('is-loading');
    }, 1000);
    
  } else {
    deletionMarkForMeta = true; checkDeletionMarks();
  }
}

function hideReauthPopup () {
  $("#reauth-error").fadeOut(500);
}

function showReauthPopup(color, message){
  $("#change-pass-button").removeClass('loading disabled');
  $("#change-key-button").removeClass('loading disabled');
  $("#reauth-error").html('<button class="delete" onclick="hideReauthPopup();"></button>' + message);
  $("#reauth-error").removeClass("is-warning is-success is-info is-danger").addClass(color).fadeIn(500);
}

function reauthForPass (){
  $("#change-pass-button").addClass('loading disabled');
  var currentPass = $("#currentpass").val();
  var credential = firebase.auth.EmailAuthProvider.credential(theUser.email, currentPass);
  reauthenticated = true;
  theUser.reauthenticateAndRetrieveDataWithCredential(credential).then(function() {
    changePassword();
  }, function(error) {
    $("#change-pass-button").removeClass('loading disabled');
    showReauthPopup("is-warning", "Please check your current password and try again.");
  });
}

function reauthForEmail (){
  $("#change-email-button").addClass('loading disabled');
  var currentPass = $("#currentpass-email").val();
  var credential = firebase.auth.EmailAuthProvider.credential(theUser.email, currentPass);
  reauthenticated = true;
  theUser.reauthenticateAndRetrieveDataWithCredential(credential).then(function() {
    changeEmail();
  }, function(error) {
    $("#change-email-button").removeClass('loading disabled');
    showReauthPopup("is-warning", "Please check your current password and try again.");
  });
}

function reauthForDelete (){
  $("#delete-account-button").addClass('is-loading').prop('disabled', true);
  $("#delete-account-confirm-button").addClass('is-loading').prop('disabled', true);
  reauthenticated = true;
  var credential;

  if (loginMethod === "password") {
    var currentPass = $("#currentpass-delete").val();
    credential = firebase.auth.EmailAuthProvider.credential(theUser.email, currentPass);
    theUser.reauthenticateAndRetrieveDataWithCredential(credential).then(function() {
      prepareToDeleteAccount();
    }, function(error) {
      $("#delete-account-button").removeClass('is-loading').prop('disabled', false);
      $("#delete-account-confirm-button").removeClass('is-loading').prop('disabled', false);
      showReauthPopup("is-warning", "Please check your current password and try again.");
    });
  }

  else if (loginMethod === "google.com") {
    var provider = new firebase.auth.GoogleAuthProvider();
    if (isInWebAppiOS || isInWebAppChrome) {
      firebase.auth().signInWithRedirect(provider);
    } else {
      firebase.auth().signInWithPopup(provider).then(function(result) {
         var token = result.credential.accessToken;
         credential = firebase.auth.GoogleAuthProvider.credential(null, token);
         theUser.reauthenticateAndRetrieveDataWithCredential(credential).then(function() {
           prepareToDeleteAccount();
         }, function(error) {
           $("#delete-account-button").removeClass('is-loading').prop('disabled', false);
           $("#delete-account-confirm-button").removeClass('is-loading').prop('disabled', false);
           showReauthPopup("is-warning", "Please login to your google account and try again.");
         });
      });
    }
  }

  else {
    willLoseAuthForDeletion = true;
    dataRef.update({"deleteme" : "byebye"});
  }
}

firebase.auth().getRedirectResult().then(function(result) {
  if (result.user !== null) {
    $("body").addClass("is-loading");
    var token = result.credential.accessToken;
    credential = firebase.auth.GoogleAuthProvider.credential(null, token);
    result.user.reauthenticateAndRetrieveDataWithCredential(credential).then(function() {
      $("body").addClass("is-loading");
      prepareToDeleteAccount();
    }, function(error) {
      $("#delete-account-button").removeClass('is-loading').prop('disabled', false);
      $("#delete-account-confirm-button").removeClass('is-loading').prop('disabled', false);
      showReauthPopup("is-warning", "Please login to your google account and try again.");
    });
  }
});

function gotEIDResponse (code) {
  showReauthPopup("is-info", "You will receive a verification notification on your phone shortly.<br><br> Only type your pin code, if the numbers you see on your phone are :<br><b style='font-size:24px;'>"+code+"</b>");
}

function changePassword (){
  var newPass = $("#newpass").val();
  theUser.updatePassword(newPass).then(function() {
    showReauthPopup("is-success", "Password successfully changed");
    $("#currentpass").val(""); $("#newpass").val(""); $("#newpassver").val("");
    $("#pass-score").attr("value", 0);
  }, function(error) {
    showReauthPopup("is-warning", "Couldn't change your password. Please try again.");
  });
}

function changeEmail (){

  var newEmail = $("#recoveryemail").val().trim();
  var newUsername = $("#newusername").val().trim();

  if (newEmail === "" && (theUser.displayName === null || theUser.displayName === undefined || theUser.displayName === "")) {
    // USER DOESN'T HAVE A USERNAME, AND IS TRYING TO REMOVE THE EMAIL.
    if (newUsername === "") {
      // USER DIDN'T SET A NEW USERNAME EITHER. THROW ALERT
      showReauthPopup("is-warning", "You have signed up to Cryptee with an email address and not with a username. Please pick a username if you'd like to remove your email address.");
    } else {
      // USER DID SET A NEW USERNAME. TRY SETTING THIS ONE UP.
      setEmail (newUsername + "@users.crypt.ee");
    }
  } else {
    // USER DOES HAVE A USERNAME OR DIDN'T LEAVE THE EMAIL FIELD BLANK.
    if (newEmail === "") {
      // USER LEFT THE EMAIL FIELD BLANK, WILL START USING USERNAME INSTEAD.
      newEmail = theUser.displayName + "@users.crypt.ee";
    }
    setEmail(newEmail);
  }

  function setEmail (emailToSet) {
    theUser.updateEmail(emailToSet).then(function() {
      // Update successful.
      if (emailToSet.indexOf("@users.crypt.ee") !== -1) {
        // USER WILL USE A USERNAME FROM NOW ON.

        if (newUsername !== "") {
          //USER SET A NEW USERNAME, UPDATE REALTIME DB + USER PROFILE.
          theUser.updateProfile({ displayName : newUsername}).then(function() {
            dataRef.update({ username : newUsername }, function(){
              showReauthPopup("is-success", "Email successfully removed from our database! From now on, you will need to use your new username ( " + newUsername + " ) to sign in.");
              $("#nousername").hide();
            });
          });
        } else {
          if (theUser.displayName !== null && theUser.displayName !== undefined && theUser.displayName !== "") {
            // USER ALREADY HAD A USERNAME, AND WILL START USING THE USERNAME INSTEAD OF THE EMAIL.
            showReauthPopup("is-success", "Email successfully removed from our database! From now on, you will need to use your username ( " + theUser.displayName + " ) to sign in.");
          }
        }
      } else {
        showReauthPopup("is-success", "Email successfully set! Please check your inbox for a verification mail. From now on, you will need to use your new email ( " + emailToSet + " ) to sign in. ");
        verifyEmail();
      }
    }, function(error) {
      if (error.code === "auth/email-already-in-use") {
        showReauthPopup("is-warning", "It seems like this email / username is already in use. Please try another one.");
      } else {
        showReauthPopup("is-warning", "We're having trouble changing your email. Please try again later.");
      }
      console.log(error);
    });
  }
}

function verifyEmail() {
  $("#verify-email-button").addClass('is-loading');
  theUser.sendEmailVerification().then(function(){
    $("#verify-email-button").removeClass('is-loading').html("Email Sent").addClass('disable-clicks');
  });
}

function checkPassStrength() {
  if ( $("#newpass").val().trim() !== $("#newpassver").val().trim() ) {
    $("#newpassver").addClass('is-danger');
    $("#newpassver").parents(".field").find(".help").fadeIn();
    passVerified = false;
  } else {
    $("#newpassver").removeClass('is-danger');
    $("#newpassver").parents(".field").find(".help").fadeOut();
    passVerified = true;
  }

  var passScore = zxcvbn($("#newpass").val().trim()).score + 1;

  $("#pass-score").attr("value", passScore * 20);
  if (passScore <= 2) {
    $("#newpass").addClass('is-danger');
    $("#pass-score").removeClass('is-success').addClass('is-danger');
    passIsGood = false;
  } else {
    $("#newpass").removeClass('is-danger');
    $("#pass-score").removeClass('is-danger').addClass('is-success');
    passIsGood = true;
  }
}


function checkKeyStrength() {
  if ( $("#newkey").val().trim() !== $("#newkeyver").val().trim() ) {
    $("#newkeyver").addClass('is-danger');
    $("#newkeyver").parents(".field").find(".help").fadeIn();
    keyVerified = false;
  } else {
    $("#newkeyver").removeClass('is-danger');
    $("#newkeyver").parents(".field").find(".help").fadeOut();
    keyVerified = true;
  }

  var keyScore = zxcvbn($("#newkey").val().trim()).score + 1;

  $("#key-score").attr("value", keyScore * 20);

  if (keyScore <= 1) {
    $("#newkey").addClass('is-danger');
    $("#key-score").removeClass('is-success').addClass('is-danger');
    keyIsGood = false;
  } else {
    $("#newkey").removeClass('is-danger');
    $("#key-score").removeClass('is-danger').addClass('is-success');
    keyIsGood = true;
  }

  if (keyIsGood) {
    var keyToTest = $("#newkey").val().trim();
    // this is to test hashing the key to see if it has any invalid / wide / unsupported / unhashable characters
    hashString(keyToTest).then(function (newHashedKey) {
      $("#newkey").removeClass('is-danger');
      $("#newkey").parents(".field").find(".help").fadeOut();
      keyIsGood = true;
    }).catch(function(e){
      $("#newkey").addClass('is-danger');
      $("#newkey").parents(".field").find(".help").fadeIn();
      keyIsGood = false;
    });
  }
}

function tryChangingKey () {
  var currentkey = $("#currentkey").val().trim();
  var newKey = $("#newkey").val().trim();
  hashString(currentkey).then(function (hashedKey) {
    decrypt(encryptedStrongKey, [hashedKey]).then(function (plaintext) {
      // RIGHT KEY
      var theStrongKey = plaintext.data;
      hashString(newKey).then(function (newHashedKey) {
        encrypt(theStrongKey, [newHashedKey]).then(function (ciphertext) {
          var newEncryptedStrongKey = JSON.stringify(ciphertext);
          dataRef.update({
            keycheck: newEncryptedStrongKey
          }, function (error) {
            if (error) {
              showReauthPopup("is-warning", "Couldn't change your Encryption Key. Please try again.");
            } else {
              showReauthPopup("is-success", "Encryption Key successfully changed!");
              $("#currentkey").val("");
              $("#newkey").val("");
              $("#newkeyver").val("");
              $("#key-score").attr("value", 0);
            }
          });
        });
      });

    }).catch(function (error) {
      console.log(error);
      setTimeout(function () {
        showReauthPopup("is-warning", "Whoops. Seems like you made a mistake with your current Encryption Key. Please try again.");
      }, 1000);
    });
  }).catch(function(e){
    console.log(error);
    setTimeout(function () {
      showReauthPopup("is-warning", "Whoops. Seems like you made a mistake with your Encryption Key. Please try again.");
    }, 1000);
  });
}

$("#newpass, #newpassver").on("keydown keypress paste copy cut change", function(){
  setTimeout(function(){
    checkPassStrength();
  },50);
});

$("#newkey, #newkeyver").on("keydown keypress paste copy cut change", function(){
  setTimeout(function(){
    checkKeyStrength();
  },50);
});

$("#change-pass-button").on("click" , function(){
  if (passVerified && passIsGood) {
    reauthForPass();
  }
});

$("#change-key-button").on("click" , function(){
  if (keyVerified && keyIsGood) {
    tryChangingKey();
  }
});

$("#change-email-button").on('click', function(event) {
  reauthForEmail();
});

$("#delete-account-button").on('click', function(event) {
  $("#delete-account-confirm-button").fadeIn();
});

$("#delete-account-confirm-button").on('click', function(event) {
  reauthForDelete();
});

function prepareToDeleteAccount() {
  $("body").addClass("is-loading");
  console.log("delete requested");
  willLoseAuthForDeletion = true;
  theUser.delete().then(function() {
    // User deleted.
  }, function(error) {
    $("#cant-delete").html("Strangely, we can't seem to delete your account. This is likely a temporary issue. Please try again soon.");
    handleError("Error deleting account", error, "fatal");
    console.log("strangely. can't delete: ", error);
  });

}




//////////////////////////////////////////////////////////
////////////////// GDPR DATA EXPORT  /////////////////////
//////////////////////////////////////////////////////////
var dataAdded = false;
var metaAdded = false;
var ordersAdded = false;
var exportData;

function fillDataExporter (data, meta, orders) {
  if (data && !dataAdded) {
    var theData = data.toJSON();
    delete theData.cryptmail;
    var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(theData));
    $("#account-data-json").append("<a style='text-decoration:none;' href='"+dataStr+"' download='Cryptee Account Data.json'><span class='icon'><i class='fa fa-download fa-fw'></i></span> Download Account Data (JSON File)</a><br>");
    exportData = data;
    dataAdded = true;
  }

  if (meta && !metaAdded) {
    var theMeta = meta.toJSON();
    var metaStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(theMeta));
    $("#account-data-json").append("<a style='text-decoration:none;' href='"+metaStr+"' download='Cryptee Meta Data.json'><span class='icon'><i class='fa fa-download fa-fw'></i></span> Download Meta Data (JSON File)</a><br>");
    metaAdded = true;
  }

  if (orders && !ordersAdded) {
    var theOrders = orders.toJSON();
    var ordersStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(theOrders));
    $("#account-data-json").append("<a style='text-decoration:none;' href='"+ordersStr+"' download='Cryptee Orders Data.json'><span class='icon'><i class='fa fa-download fa-fw'></i></span> Download Orders Data (JSON File)</a><br>");
    ordersAdded = true;
  }
}

/////////////////////////////////////////////////////////////////
// THESE USE THE STRONGKEY, AND USELESS TO PRESENT TO USER     //
// UNLESS USER IS PRESENTED WITH THE STRONGKEY.                //
// NEEDS REDESIGN. – REMOVING UNTIL THERE'S A BETTER SOLUTION  //
/////////////////////////////////////////////////////////////////


// var myDataPopulated = false;
// $("#settings-my-data-button").on("click", function(){
//   if (!myDataPopulated) {
//     myDataPopulated = true;
//     generateExportURLs(exportData);
//   }
// });

// function generateExportURLs (data) {
//   var fileRef = rootRef.child("home.crypteedoc");
//   fileRef.getDownloadURL().then(function(docURL) {
//     $("#account-files-section").append("<a class='fileExportURL' href='"+docURL+"'><span class='icon'><i class='fa fa-download fa-fw'></i></span>Home Document</a><br>");
//   });

//   if (data) {
//     var docsFolders = data.val().folders;
//     if (docsFolders) {
//       $.each(docsFolders, function(fid, folder){
//         var docsOfFolder = folder.docs;
//         $.each(docsOfFolder, function(did, doc){
//           if (doc.isfile) {
//             generateFileURLAndAppendToList(did);
//           } else {
//             generateDocURLAndAppendToList(did);
//           }
//         });
//       });
//     }

//     generatePhotosURLs();
//   }
// }

// function generateDocURLAndAppendToList(did) {
//   var fileRef = rootRef.child(did + ".crypteedoc");
//   fileRef.getDownloadURL().then(function(docURL) {
//     $("#account-files-section").append("<a class='fileExportURL' href='"+docURL+"'><span class='icon'><i class='fa fa-download fa-fw'></i></span>"+did.replace("d-","").replace("p-","")+"</a><br>");
//   });
// }

// function generateFileURLAndAppendToList(did) {
//   var fileRef = rootRef.child(did + ".crypteefile");
//   fileRef.getDownloadURL().then(function(docURL) {
//     $("#account-files-section").append("<a class='fileExportURL' href='"+docURL+"'><span class='icon'><i class='fa fa-download fa-fw'></i></span>"+did.replace("d-","").replace("p-","")+"</a><br>");
//   });
// }

// function generatePhotosURLs () {
//   photosRef.get().then(function(photosHomeItems) {
//     photosHomeItems.docs.forEach(function(photosHomeItem){
//       var photosHomeItemId = photosHomeItem.data().id;
//       if (photosHomeItemId) {
//           if (photosHomeItemId.startsWith('p-')) {
//             var fileRef = rootRef.child(photosHomeItemId + ".crypteefile");
//             fileRef.getDownloadURL().then(function(docURL) {
//               $("#account-files-section").append("<a class='fileExportURL' href='"+docURL+"'><span class='icon'><i class='fa fa-download fa-fw'></i></span>"+photosHomeItemId.replace("d-","").replace("p-","")+"</a><br>");
//             });
//           } else if (photosHomeItemId.startsWith('f-')) {
//             enumerateFolderForExport(photosHomeItemId);
//           }
//         }
//     });
//   });
// }

// function enumerateFolderForExport(fid){
//   photosRef.doc(fid).collection(fid).get().then(function(folderItems) {

//     folderItems.docs.forEach(function(folderItem) {
//       var folderItemId = folderItem.id;
//       if (folderItemId) {
//         if (folderItemId.startsWith('p-')) {
//           var fileRef = rootRef.child(folderItemId + ".crypteefile");
//           fileRef.getDownloadURL().then(function(docURL) {
//             $("#account-files-section").append("<a class='fileExportURL' href='"+docURL+"'><span class='icon'><i class='fa fa-download fa-fw'></i></span>"+folderItemId.replace("d-","").replace("p-","")+"</a><br>");
//           });
//         } else if (folderItemId.startsWith('f-')) {
//           enumerateFolderForExport(folderItemId);
//         }
//       }
//     });

//   });
// }












//////////////////////////////////////////////////////////
//////////////////   PREFERENCES     /////////////////////
//////////////////////////////////////////////////////////
var populatingPreferences = false;


var inactivityTimeoutInputTimeout;
$("#inactivityTimeoutInput").on("keydown keypress paste copy cut change", function(e){
  clearTimeout(inactivityTimeoutInputTimeout);
  if (!populatingPreferences) {
    setTimeout(function () {
      var timeoutValue = Number($("#inactivityTimeoutInput").val().trim());
      if (timeoutValue <= 0) {
        timeoutValue = 0;
        $("#inactivityTimeoutInput").val(0);
      }
      inactivityTimeoutInputTimeout = setTimeout(function () {
        if (userPreferences) {
          userPreferences.general.inactivityTimeout = timeoutValue;
          dataRef.update({"preferences" : userPreferences});
        }
      }, 1000);
    }, 50);
  }
});

$(".ltrswitch").on("change", function(e){
  if (!populatingPreferences) {
    if ($(".ltrswitch").is(':checked')) {
      $(".rtlswitch").prop('checked', false).attr('checked', false);
    } else {
      $(".rtlswitch").prop('checked', true).attr('checked', true);
    }

    updateTextDirection();
  }
});

$(".rtlswitch").on("change", function(e){
  if (!populatingPreferences) {
    if ($(".rtlswitch").is(':checked')) {
      $(".ltrswitch").prop('checked', false).attr('checked', false);
    } else {
      $(".ltrswitch").prop('checked', true).attr('checked', true);
    }

    updateTextDirection();
  }
});

function updateTextDirection() {
  setTimeout(function () {
    var selection = "ltr";
    if ($(".ltrswitch").is(':checked')) {
      selection = "ltr";
    } else {
      selection = "rtl";
    }

    if (userPreferences) {
      userPreferences.docs.direction = selection;
      dataRef.update({"preferences" : userPreferences});
    }
  }, 500);
}

$(".spellcheckswitch").on("change", function(e){
  if (!populatingPreferences) {
    updateSpellchecker();
  }
});

function updateSpellchecker() {
  setTimeout(function () {
    var spellcheckStatus = "on";
    if ($(".spellcheckswitch").is(':checked')) {
      spellcheckStatus = "on";
    } else {
      spellcheckStatus = "off";
    }

    if (userPreferences) {
      userPreferences.docs.spellcheck = spellcheckStatus;
      dataRef.update({"preferences" : userPreferences});
    }
  }, 500);
}

// //////////////////////////
// REMEMBER ENCRYPTION KEY // 
// //////////////////////////

// 1) localStorage - memorizedKey

var memorizedKey;

reflectDeviceSecuritySettings();



function changedDeviceSecurityCheckbox(setting) {
  
  if (setting === "usekey") { userchoseUseKey(); } 
  else {
    if (setting === "usenone") {
      userChoseUseNone();
    }
    
    // set to false in case if user cancels, then set to true, once user approves
    $("#" + setting).find(".crypteecheckbox").prop('checked', false).attr('checked', false).prop('disabled', false).attr('disabled', false);

    // buttons ready, show the modal
    showWarningModal("device-setting-keypin-modal");
  }
}

function userchoseUseKey() {
  localStorage.removeItem('memorizedKey');
  memorizedKey = null;
  reflectDeviceSecuritySettings();
}

function userChoseUseNone() {
  $("#rememberkey-button").show();
}

$(".crypteecheckbox").on('change', function(event) {
  var checkboxid = $(this).parents(".login-option-label").attr("id");
  if ($(this).is(':checked')) {
    changedDeviceSecurityCheckbox(checkboxid);
  }
}); 

var confirmkeyTimeout;
var confirmedHashedKey;
$("#device-setting-confirmkey").on('keydown keypress paste change', function(event) {
  clearTimeout(confirmkeyTimeout);
  confirmkeyTimeout = setTimeout(function () {
    var typedKey = $("#device-setting-confirmkey").val().trim();
    checkCurrentKey(typedKey, function(isItTheRightKey, hashedKey){
      if (isItTheRightKey) {
        confirmedHashedKey = hashedKey;
        $("#device-setting-confirmkey").removeClass("is-danger").addClass("is-success");
        $("#rememberkey-button").prop('disabled', false).attr('disabled', false);
        $("#device-setting-keypin-modal").find(".fa-key").removeClass("fa-key").addClass("fa-check");
      } else {
        $("#device-setting-confirmkey").removeClass("is-success").addClass("is-danger");
        $("#rememberkey-button").prop('disabled', true).attr('disabled', true);
        $("#device-setting-keypin-modal").find(".fa-check").addClass("fa-key").removeClass("fa-check");
      }
    });
  }, 100);
}); 

$("#rememberkey-button").on('click', function(event) {
  if (confirmedHashedKey){
    localStorage.setItem("memorizedKey", JSON.stringify(confirmedHashedKey));
    confirmedHashedKey = null;
    reflectDeviceSecuritySettings();
    setTimeout(function () {
      hideActiveWarningModal();
      $("#device-setting-keypin-modal").find(".fa-check").addClass("fa-key").removeClass("fa-check"); 
      $("#rememberkey-button").prop('disabled', true).attr('disabled', true);
    }, 10);
  }
}); 

function reflectDeviceSecuritySettings() {
  var setting;

  if (localStorage.getItem('memorizedKey')) {
    memorizedKey = JSON.parse(localStorage.getItem('memorizedKey'));
    if (memorizedKey) {
      setting = "usenone";
    }
  }
  
  if (!memorizedKey) {
    setting = "usekey";
  }

  $(".device-security-card").find(".crypteecheckbox").prop('checked', false).attr('checked', false).prop('disabled', false).attr('disabled', false);
  $("#device-security-status").removeClass("is-warning").removeClass("is-success");
  if (setting === "usenone") {
    $("#usenone").find(".crypteecheckbox").prop('checked', true).attr('checked', true).prop('disabled', true).attr('disabled', true);
    $("#device-security-status").html('<span class="icon"><i class="fa fa-exclamation-triangle"></i></span>' + "<b>Risky</b><br><br>Optimized for convenience.<br>Not using Encryption Key. (Encryption key saved on device)");
    $("#device-security-status").addClass("is-warning");
  } else {
    $("#usekey").find(".crypteecheckbox").prop('checked', true).attr('checked', true).prop('disabled', true).attr('disabled', true);
    $("#device-security-status").html('<span class="icon"><i class="fa fa-star"></i></span>' + "<b>Excellent</b><br><br>Optimized for high-security. (Using Encryption Key)");
    $("#device-security-status").addClass("is-success");
  }
}

function checkCurrentKey (typedKey, callback) {
  callback = callback || noop;
  hashString(typedKey).then(function (hashedKey) {
    decrypt(encryptedStrongKey, [hashedKey]).then(function (plaintext) {
      // RIGHT KEY
      callback(true, hashedKey);
    }).catch(function (error) {
      callback(false, null);
    });
  }).catch(function(e){
    callback(false, null);
  });
}



// CLEAR LOCAL CACHE

if (localStorage.getItem("encryptedCatalog")) {
  $("#encrypted-local-cache-card").show();
} else {
  $("#encrypted-local-cache-card").hide();
}

function clearLocalCache() {
  localStorage.removeItem("encryptedCatalog");
  $("#clear-cache-button").html("Cleared").addClass("is-success").prop('disabled', true).attr('disabled', true);
}



//  DELETE OFFLINE DOCUMENTS
var offlineDocsStorage = localforage.createInstance({ name: "offlineStorage" });
var hasOfflineDocs = false;
offlineDocsStorage.iterate(function(doc, did, i) {
  if (doc) {
    hasOfflineDocs = true;
  }
}).then(function() {
  if (hasOfflineDocs) {
    $("#delete-offline-docs-card").show();
  } else {
    $("#delete-offline-docs-card").hide();
  }
});

function deleteOfflineDocs() {
  offlineDocsStorage.clear().then(function() {
    $("#delete-offline-docs-button").html("Deleted").addClass("is-success").prop('disabled', true).attr('disabled', true);
  });
}





//  DELETE ALL WEB CLIPS

function deleteWebclips() {
  var clipRefsArray = [];
  var totalToDelete = 0;
  
  // ITERATE THROUGH ALL WEBCLIPS IN STORAGE AND DELETE THEM. 
  dataRef.child("clips").once('value', function(snapshot) {
    var snap = snapshot.val();
    if (snap) {
      $.each(snap, function(i, wcid){
        var clipRef = rootRef.child("wc-" + wcid + ".crypteeclip");
        clipRefsArray.push(clipRef);
      });
      
      totalToDelete = clipRefsArray.length;

      $.each(clipRefsArray, function(index, clipRef) {
          clipRef.delete().then(function() {
            totalToDelete--;
            areAllClipsDeleted();
          }).catch(function(error) {
            totalToDelete--;
            areAllClipsDeleted();
            if (error.code !== "storage/object-not-found") {
              handleError("Error Deleting Webclip", error);
            }
          });
      });
    }
  });

  function areAllClipsDeleted() {
    if (totalToDelete <= 0) {
      dataRef.child("clips").remove().then(function() {
        $("#delete-webclips-button").html("Deleted").removeClass("is-danger").addClass("is-success").prop('disabled', true).attr('disabled', true);
      });
    }
  }
  
}



function showClippers(clippers) {
  $.each(clippers, function(wcid, clipper){
    if ($('.clipper[wcid="'+wcid+'"]').length === 0) {
      $("#clippers-list").append(renderClipper(wcid, clipper));
    }
  });
}

function renderClipper(wcid, clipper) {
  var clipperElement = '<div class="clipper media" wcid="'+wcid+'">'+
    '<div class="media-left">'+
      '<span class="clipper-icon icon"><i class="fa fa-'+resolveBrowserIcon(clipper.browser.name)+'"></i></span>'+
    '</div>'+
    '<div class="media-content">'+
      '<p class="browser">'+clipper.browser.name+' on '+clipper.os+'</p>'+
      '<div class="remove-clipper-button" wcid="'+wcid+'">Remove</div>'+
    '</div>'+
  '</div>';

  return clipperElement;
}

$("#clippers-list").on('click', ".remove-clipper-button" ,function() {
  var wcid = $(this).attr("wcid");

  dataRef.child("clippers/" + wcid).remove().then(function() {
    $('.clipper[wcid="'+wcid+'"]').remove();
  });
}); 

function resolveBrowserIcon(browser) {
  var icon = "laptop";  
  
  if (browser) {
    //intentionally excluding first letter to not have to worry about uppercase letter
    if (browser.indexOf("hrome") > -1) { icon = "chrome"; }
    if (browser.indexOf("pera") > -1) { icon = "opera"; }
    if (browser.indexOf("irefox") > -1) { icon = "firefox"; }
    if (browser.indexOf("afari") > -1) { icon = "safari"; }
    if (browser.indexOf("dge") > -1) { icon = "edge"; }
  }  

  return icon;
}






/////////////////////////////////////////////////////////////////////
//                          UPGRADE FORM                           //
// all functions related to upgrade, downgrade, proration etc.     //
// and all functions related to paddle & animations etc.           //
/////////////////////////////////////////////////////////////////////

// a,b,c - m (monthly), y (yearly).
var selectedPlan = "b";
var selectedPaymentPeriod = "y";

function paddleInit() {
  // This is how paddle detects mobile layout, so we use the same to make sure ours match
  if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
    $("#upgrade-form").addClass("paddleWillBeMobile");
  }

  paddleAffiliateAnalyticsClient = {};
  paddleAnalyticsClient = {};
  paddleAnalytics = {};

  Paddle.Analytics = noop;
  Paddle.Analytics.track = noop;
  Paddle.Analytics.trackPageview = noop;
  Paddle.Affiliate = noop;
  Paddle.Affiliate.Event = noop;
  Paddle.Affiliate.isAffiliate = noop;

  Paddle.Options({
    enableTracking: false,
    poweredByBadge: false,
    checkoutVariant: 'multipage-compact-payment'
  });
  Paddle.Setup({
		vendor: 28922,
    eventCallback: function(eventData) {
      updatePrices(eventData);
    },
    enableTracking: false,
    poweredByBadge: false,
    checkoutVariant: 'multipage-compact-payment'
	});
}

var paddleTries = 0;
var paddleMaxTries = 60;
var paddleLoaded = false;
function checkIfPaddleIsLoaded () {
  setTimeout(function () {
    try {
      if (Paddle) { 
        paddleLoaded = true; 
      }
    } catch (e) {
      if (paddleTries <= paddleMaxTries) {
        if (paddleTries < 3) {
          console.log("Likely an ad blocker or Paddle down.");
        }
        paddleTries++;
        checkIfPaddleIsLoaded();
      }
    }
  }, 1000);
}


function updatePrices(data) {
  var currencyLabels = document.querySelectorAll(".currency");
  var subtotal = data.eventData.checkout.prices.customer.total - data.eventData.checkout.prices.customer.total_tax;

  for(var i = 0; i < currencyLabels.length; i++) {
    currencyLabels[i].innerHTML = data.eventData.checkout.prices.customer.currency + " ";
  }

  document.getElementById("checkout-subtotal").innerHTML = subtotal.toFixed(2);
  document.getElementById("checkout-tax").innerHTML = data.eventData.checkout.prices.customer.total_tax;
  var recurringString;

  if (data.eventData.checkout.recurring_prices) {
    var recurringCurrency = data.eventData.checkout.recurring_prices.customer.currency;
    var recurringTotal = data.eventData.checkout.recurring_prices.customer.total;
    var intervalType = data.eventData.checkout.recurring_prices.interval.type.replace("month", "mo").replace("year", "yr");
    var intervalCount = data.eventData.checkout.recurring_prices.interval.length;

    if (intervalCount > 1) {
      recurringString = '<span class="is-line-value">'+recurringCurrency+" "+recurringTotal+"/"+intervalCount+" "+intervalType+"s</span>";
    }
    else {
      recurringString = '<span class="is-line-value">'+recurringCurrency+" "+recurringTotal+"/"+intervalType+"</span>";
    }
    document.getElementById("checkout-total").innerHTML = recurringString;
  }

  $(".initial-sum").fadeOut(500, function(){
    $(".the-totals").fadeIn(500);
  });
}

$("#upgrade-button, .upgrade-card").on('click', function(event) {
  openUpgrade();
});

function openUpgrade() {
  theKey = null;
  loadJS('https://cdn.paddle.com/paddle/paddle.js', function(){
    paddleInit();
  }, document.body);
  checkIfPaddleIsLoaded();

  console.log("Opening Upgrade");
  $("#upgrade-view").addClass("upgradeOn");
  ping("event", {eventCategory: "upgrade", eventAction : "open"});

  showPriceCards();
  showMobilePriceCards();
}

function closeUpgrade() {
  if ( $(".checkout-container.is-visible").length ) {
    window.location.href = "account";
  } else {
    ping("event", {eventCategory: "upgrade", eventAction : "close"});
    console.log("Closing Upgrade");
    history.pushState("upgrade-complete", null, '/account');
    $(".upgrade-container").removeClass("is-checkout"); // 500ms
    $("#upgrade-container-deets").fadeOut();
    hidePriceCards(); // 750ms
    hideMobilePriceCards();
    setTimeout(function() { 
      $("#upgrade-view").removeClass("upgradeOn"); 
      $(".upgrade-container").hide(); 
    }, 750);
    
  }
}

$(".pricing-card").on('click', function(event) {
  $(".pricing-card").removeClass("is-black");
  $(this).addClass("is-black");
  selectedPlan = $(this).attr("plan");
});

$(".selected-plan-desktop-button").on('click', function(event) {
  if (selectedPaymentPeriod) {
    if (selectedPlan) {
      displayCheckoutPrice();
      selectedPriceCard(); // 300ms
      $(".upgrade-container").show(); 
      setTimeout(function () { 
        $("#upgrade-container-deets").fadeIn();
        $(".upgrade-container").addClass("is-checkout"); 
      }, 310);
    }
  }
}); 

$("#back-to-plan-button").on('click', function(event) {
  
  $(".upgrade-container").removeClass("is-checkout"); // 500ms
  $("#upgrade-container-deets").fadeOut();
  setTimeout(function () {
    $(".upgrade-container").hide();
    showPriceCards();
    showMobilePriceCards();
  }, 500);

}); 


// 500ms
function showPriceCards() { 
  $("#pricing").fadeIn(50);
  setTimeout(function () { $(".pricing-card").eq(0).addClass("visible").removeClass("selected"); }, 100);
  setTimeout(function () { $(".pricing-card").eq(1).addClass("visible").removeClass("selected"); }, 200);
  setTimeout(function () { $(".pricing-card").eq(2).addClass("visible").removeClass("selected"); }, 300);
}


// 300ms
function selectedPriceCard() { 
  setTimeout(function () { $(".pricing-card").eq(2).addClass("selected"); }, 10);
  setTimeout(function () { $(".pricing-card").eq(1).addClass("selected"); }, 100);
  setTimeout(function () { $(".pricing-card").eq(0).addClass("selected"); }, 200);
  $("#pricing").fadeOut(300); 
}

// 750ms
function hidePriceCards() { 
  setTimeout(function () { $(".pricing-card").eq(2).removeClass("visible").removeClass("selected"); }, 50);
  setTimeout(function () { $(".pricing-card").eq(1).removeClass("visible").removeClass("selected"); }, 150);
  setTimeout(function () { $(".pricing-card").eq(0).removeClass("visible").removeClass("selected"); }, 250);
  setTimeout(function () { $("#pricing").fadeOut(300);                                              }, 350);
}

$(".mobile-pricecard").on('click', function(event) {
  $(".mobile-pricecard").removeClass("is-black");
  $(this).addClass("is-black");
  selectedPlan = $(this).attr("plan");
});

$(".selected-plan-mobile-button").on('click', function(event) {
  if (selectedPaymentPeriod) {
    if (selectedPlan) {
      displayCheckoutPrice();
      selectedMobilePriceCard(); // 300ms
      $(".upgrade-container").show(); 
      setTimeout(function () { 
        $("#upgrade-container-deets").fadeIn();
        $(".upgrade-container").addClass("is-checkout"); 
      }, 310);
    }
  }
}); 

// 300ms
function selectedMobilePriceCard() { 
  setTimeout(function () { $(".mobile-pricecard").eq(2).addClass("selected"); }, 10);
  setTimeout(function () { $(".mobile-pricecard").eq(1).addClass("selected"); }, 100);
  setTimeout(function () { $(".mobile-pricecard").eq(0).addClass("selected"); }, 200);
  $("#mobile-pricing").fadeOut(300); 
}

// 500ms
function showMobilePriceCards() { 
  $("#mobile-pricing").fadeIn(50);
  setTimeout(function () { $(".mobile-pricecard").eq(0).addClass("visible").removeClass("selected"); }, 100);
  setTimeout(function () { $(".mobile-pricecard").eq(1).addClass("visible").removeClass("selected"); }, 200);
  setTimeout(function () { $(".mobile-pricecard").eq(2).addClass("visible").removeClass("selected"); }, 300);
}

// 750ms
function hideMobilePriceCards() { 
  setTimeout(function () { $(".mobile-pricecard").eq(2).removeClass("visible").removeClass("selected"); }, 50);
  setTimeout(function () { $(".mobile-pricecard").eq(1).removeClass("visible").removeClass("selected"); }, 150);
  setTimeout(function () { $(".mobile-pricecard").eq(0).removeClass("visible").removeClass("selected"); }, 250);
  setTimeout(function () { $("#mobile-pricing").fadeOut(300);                                              }, 350);
}


function displayCheckoutPrice() {
  var checkoutPrice;
  var checkoutPeriod;

  if (selectedPaymentPeriod === "m") {
    checkoutPrice = priceTable[selectedPlan].m; // monthly
    checkoutPeriod = "mo";
  } else {
    checkoutPrice = priceTable[selectedPlan].yt; // yearly total
    checkoutPeriod = "yr";
  }

  $("#checkout-price").html(checkoutPrice + "/" + checkoutPeriod);
}

$("#upgrade-email-input, #upgrade-zip-input").on("keydown keypress paste copy cut change click", function(e) {
  setTimeout(function(){
    var einput = $("#upgrade-email-input").val().trim();
    var zipinput = $("#upgrade-zip-input").val().trim();

    if (einput !== "" && einput.indexOf("@") > 0) {
      $("#upgrade-email-input").removeClass("is-danger").addClass("is-success");
    } else {
      $("#upgrade-email-input").removeClass("is-success").addClass("is-danger");
    }

    if (zipinput === "") {
      $("#upgrade-zip-input").removeClass("is-success").addClass("is-danger");
    } else {
      $("#upgrade-zip-input").removeClass("is-danger").addClass("is-success");
    }

    var submit = false;
    if (e.keyCode == 13) {
      submit = true;
    }

    checkUpgradeForm(submit);
  },50);
});

$("#upgrade-countries").on("change", function(){
  if ($("#upgrade-countries").val() !== "") {
    $(".upgrade-countries-select").removeClass("is-danger").addClass("is-success");
  } else {
    $(".upgrade-countries-select").removeClass("is-success").addClass("is-danger");
  }
});

function checkUpgradeForm (submit) {
  if ($("#upgrade-email-input").hasClass("is-success") && $("#upgrade-zip-input").hasClass("is-success") && $(".upgrade-countries-select").hasClass("is-success")) {
    $(".paymentButton").prop("disabled", false);
    if (submit) {
      $(".paymentButton").click();
    }
  } else {
    $(".paymentButton").prop("disabled", true);
  }
}

$(".paymentButton").on("click",function(){
  // PLAN           PLAN CODE

  // 10GB MONTHLY = 523200
  if (selectedPlan === "a" && selectedPaymentPeriod === "m") {
    productForPaddle = 523200;
  }

  // 10GB YEARLY = 560664
  if (selectedPlan === "a" && selectedPaymentPeriod === "y") {
    productForPaddle = 560664;
  }

  // 400GB MO = 523202
  if (selectedPlan === "b" && selectedPaymentPeriod === "m") {
    productForPaddle = 523202;
  }

  // 400GB YR = 560661
  if (selectedPlan === "b" && selectedPaymentPeriod === "y") {
    productForPaddle = 560661;
  }

  // 2TB MO = 560659
  if (selectedPlan === "c" && selectedPaymentPeriod === "m") {
    productForPaddle = 560659;
  }

  // 2TB YR = 560663
  if (selectedPlan === "c" && selectedPaymentPeriod === "y") {
    productForPaddle = 560663;
  }

  emailForPaddle = $("#upgrade-email-input").val().trim();
  countryForPaddle = $("#upgrade-countries").val();
  zipForPaddle = $("#upgrade-zip-input").val().trim();
  couponForPaddle = $("#upgrade-coupon-input").val().trim() || "";

  $("#upgrade-form").addClass("is-loading");
  $(".upgrade-container").addClass("is-checkout");
  setTimeout(function() {
    $("#upgrade-form, .upgrade-container").addClass("is-white");
    $("#upgrade-reason").addClass("is-small");
    openPaddle();
  }, 750);
});

function openPaddle () {
  if (paddleLoaded && Paddle) {
      $("#paddle-loading").hide();

      Paddle.Checkout.open({
        method: 'inline',
        frameTarget: 'checkout-container', //classname of checkout container
        frameInitialHeight: 360,
        frameStyle: 'width:320px; border: none; background: transparent;',
        product: productForPaddle,
        disableLogout : true,
        successCallback : 'paymentSuccessful',
        closeCallback : 'paymentTerminated',
        email : emailForPaddle,
        guest_country : countryForPaddle,
        guest_postcode : zipForPaddle,
        coupon : couponForPaddle,
        passthrough : theUserID
      });

      $(PaddleFrame).on('load', function(){
        $("#upgrade-form").removeClass("is-loading");
        $(".checkout-container").addClass("is-visible");
      });

      $("#upgrade-container-deets").fadeOut();
  } else {
    $("#upgrade-form").removeClass("is-loading");
    $(".checkout-container").addClass("is-visible");
  }
}

function paymentSuccessful(data) {
  orderComplete();
}

// unnecessary for now but keeping anyway.
function paymentTerminated(data) {
  console.log("Payment Terminated", data);
  ping("event", {eventCategory: "upgrade", eventAction : "terminated"});
}





function gotUserOrders(orders) {
  if (orders !== null) {
    $(".has-orders-only").show();
  } else {
    $(".has-orders-only").hide();
  }
}


function gotUserPeriod(period) {
  if (period === "y") {
    userHasYearlyPlan();
  } else {
    userHasMonthlyPlan();
  }
  switchPeriod(period);
  $(".prorate-plans[period='"+period+"']").find(".prorate-plan[quota='"+formatBytes(allowedStorage)+"']").addClass("current");
}

if (theUserPlan) {
  if (theUserPlan !== "free") {
    var period = plansObject[theUserPlan].p;
    gotUserPeriod(period);
  }
}

function userHasYearlyPlan() {
  $(".is-hidden-yearly, .per-period-button").hide();
  $(".is-shown-yearly").show();  
  if (allowedStorage === 10000000000) { //only for 10GB plans
    $("#yearly-to-monthly-notice").show();
  } else {
    $("#yearly-to-monthly-notice").hide();
  }
}

function userHasMonthlyPlan() {
  $(".is-shown-yearly").hide();
  $("#yearly-to-monthly-notice").hide();
}

function populatePlanDetails (meta) {
  var plan = parseInt(meta.plan);
  allowedStorage = meta.allowedStorage;
  
  $(".next-payment-date").html(meta.nextPayment);
  var period = plansObject[plan].p;
  
  gotUserPeriod(period);

  $(".change-payment-button").click(function(){
    popupLoadURL(meta.updateurl, "Cryptee : Update Payment Method", 400, 600);
  });

}

$(".per-period-button").on('click', function(event) {
  var selectedPeriod = $(this).attr("period");

  switchPeriod(selectedPeriod);

  $("#prorateView").slideUp();
}); 

function showYearlyToMonthlyMessage() {
  $("#yearlyToMonthlyMessage").slideToggle();
}

var selectedPlanToProrate;
$(".prorate-plans").on('click', ".switch-button", function(event) {
  selectedPlanToProrate = $(this).attr("planid");
  var selectedTier = $(this).parents(".prorate-plan").find(".price-wrap").attr("tier");
  var selectedPeriod = plansObject[selectedPlanToProrate].p;
  var selectedPrice;
  var formattedPeriod; 
  if (selectedPeriod === "m") {
    selectedPrice = priceTable[selectedTier].m;
    formattedPeriod = "/month";
  } else {
    selectedPrice = priceTable[selectedTier].yt;
    formattedPeriod = "/year";
  }
  var prorateLogicObject = prorateLogic(theUserPlan, selectedPlanToProrate);
  if (prorateLogicObject.billImmediately) {
    $(".billed-immediately-text").show();
    $(".billed-later-text").hide();
  } else {
    $(".billed-immediately-text").hide();
    $(".billed-later-text").show();
  }

  if (prorateLogicObject.willProrate) {
    $(".prorated-text").show();
  } else {
    $(".prorated-text").hide();
  }

  $("#prorateView").find(".storage").html(plansObject[selectedPlanToProrate].formattedQuota);
  $("#prorateView").find(".price").html(selectedPrice);
  $("#prorateView").find(".period").html(formattedPeriod);
  showProrateView();
}); 

function showProrateView() {
  $("#prorateView").slideDown();
  $("#cancelSubscriptionNotification").slideUp();
}

function switchPlans() {
 
  pendingProration = true;
  $("#prorateView").find("button").addClass("is-loading").prop("disabled", true);

  var switchFunction = cloudfunctions.httpsCallable('switchplans');
  switchFunction({plan : selectedPlanToProrate}).then(function(result) {
    console.log(result);
    var response = result.data;
    if (response) {
      if (response.status === "done") {
        prorateComplete();
      }
      if (response.error) {
        $("#prorateView").find(".notification").removeClass("is-black").addClass("is-danger");
        $("#prorateView").find(".notification").append("<br><br><p>Something went wrong. Please try again later.</p>");
        $("#prorateView").find("button").removeClass("is-loading").prop("disabled", false);
      }
    }
  }).catch(function(error) {
    
  });

}

function prorateComplete() {
  pendingProration = false;
  $("#prorateView").find(".notification").removeClass("is-black").addClass("is-success");
  setTimeout(function () {
    $("#prorateView").find("button").removeClass("is-loading").prop("disabled", false);
    $("#prorateView").slideUp();
  }, 1000);
}




























function emailInvoices() {
  var addressToUse = $("#invoice-email").val().trim();
  $(".email-invoices-button").addClass("is-loading").prop("disabled", true);
  Paddle.User.History(addressToUse, null, function(response) {
    if(response.success) {
      $(".email-invoices-button").removeClass("is-loading").prop("disabled", false);
      $(".email-invoices-button").removeClass("is-dark").addClass("is-success").html("Check your inbox").prop("disabled", true);
    } else {
      $(".email-invoices-button").removeClass("is-loading").prop("disabled", false);
      $(".email-invoices-button").removeClass("is-dark").addClass("is-danger").html("Looks like you made a mistake").prop("disabled", false);
    }
  });
}


















function showCancelSubsButton() {
  $("#cancelSubscriptionNotification").slideDown();
  $("#prorateView").slideUp();
}

$(".closeCancelSubs").on('click', function(){
  $("#cancelSubscriptionNotification").slideUp();
});

function cancelSubscription() {
  dataRef.update({"cancelsub" : "cancel"});
  $("#cancelSubscriptionNotification").find("button").addClass("is-loading").prop("disabled", true);
}




















//
