var theUser;
var theUserID;
var theUsername;
var theEmail;
var thePhone;
var thePersonalCode;
var theOrders, theReturns;
var emailVerified;
var connectedRef;
var dataRef;
var metaRef;
var ordersRef;
var foldersRef;
var rootRef;
var db = firebase.database();
var store = firebase.storage();
var firestore = firebase.firestore();
var cloudfunctions = firebase.functions();

var firestoreSettings = {timestampsInSnapshots: true}; firestore.settings(firestoreSettings);

var reauthenticated = false;
var willLoseAuthForDeletion = false;
var connected;
var userToken;
var passVerified = false;
var passIsGood = false;
var keyVerified = false;
var keyIsGood = false;
var userPlan;
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

loadUserDetailsFromLS();
checkLatestVersion();

try {
  sessionStorage.removeItem('key');
} finally { }

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
    }
	});
}

var paddleTries = 0;
var paddleMaxTries = 60;
var paddleLoaded = false;
function checkIfPaddleIsLoaded () {
  setTimeout(function () {
    try {
      if (Paddle) { paddleLoaded = true; }
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
//////////////////////////////////////////////////////
//////////////////// HELPERS ////////////////////////
/////////////////////////////////////////////////////


$(".settings-tab").on('click', function(event) {
  whichTab = $(this).attr("tab");
  loadTab(whichTab);
});

function loadTab(whichTab) {

  if (whichTab === "history") {
    theKey = null;
    loadJS('https://cdn.paddle.com/paddle/paddle.js', function(){
      paddleInit();
    }, document.body);
    checkIfPaddleIsLoaded();
  }

  $(".settings-tab-contents").hide();
  $(".settings-tab-contents").removeClass('active');
  $("#" + whichTab + "-tab-contents").show();
  $("#" + whichTab + "-tab-contents").addClass("active");
  $(".settings-tab.is-dark").removeClass('is-dark');
  $(".settings-tab[tab="+whichTab+"]").addClass('is-dark');
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

  if ($(window).width() < 768) {
    $(".upgrade-container, .upgrade-image-container").removeClass("is-checkout");
  } else {
    setTimeout(function() {
      $(".upgrade-container, .upgrade-image-container").removeClass("is-checkout");
    }, 500);
  }
}

function closeUpgrade() {
  console.log("Closing Upgrade");
  history.pushState("upgrade-complete", null, '/account');
  $(".upgrade-container, .upgrade-image-container").addClass("is-checkout");
  if ($(window).width() < 768) {
    $("#upgrade-view").removeClass("upgradeOn");
  } else {
    setTimeout(function() {
      $("#upgrade-view").removeClass("upgradeOn");
    }, 500);
  }
}

$('.period-button').on('click', function(event) {
  $("#priceToPay").html($(this).attr("amount"));
  $(".additional-price").html($(this).attr("additional"));
  $(".per-period").html(" / " + $(this).attr("period"));
  $(".period-button").addClass('is-white').css({"background-color" : "transparent"});
  $(this).removeClass("is-white").css({"background-color" : "white"});
});

$(window).on('load', function(event) {
  if (isInWebAppiOS || isInWebAppChrome) {
    $("#acct-signout").hide();
  }

  $("#upgrade-coupon-input").val(couponForPaddle);
});

//////////////////////////////////////////////////////////
//////////////////// AUTHENTICATION  /////////////////////
//////////////////////////////////////////////////////////


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
      theUser = user;
      theUserID = theUser.uid;
      theUsername = theUser.displayName;
      theEmail = theUser.email;
      emailVerified = theUser.emailVerified;
      connectedRef = firebase.database().ref(".info/connected");
      dataRef = db.ref().child('/users/' + theUserID + "/data/");
      metaRef = db.ref().child('/users/' + theUserID + "/meta/");
      ordersRef = db.ref().child('/users/' + theUserID + "/orders/");
      returnsRef = db.ref().child('/users/' + theUserID + "/returns/");
      foldersRef = db.ref().child('/users/' + theUserID + "/data/folders/");
      photosRef = firestore.collection("users").doc(theUserID).collection("photos");
      rootRef = store.ref().child('/users/' + theUserID);
      setSentryUser(theUserID);

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
    handleError(error);
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

    $("#upgrade-email").show();

  } else {
    // if not anonymous email
    $('#account-email').html(theEmail);
    $('#navbar-email').show();
    $("#recoveryemail").val(theEmail);
    $("#upgrade-email-input").val(theEmail);
    if (!emailVerified) {
      $("#noemail").show();
      $("#upgrade-email").show();
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

  checkForAction();
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
    $("#changepassbutton, #recoveryemailbutton, #currentpass-delete-field").hide();
    $('#google-reauth-message').show();
  } else {
    $("#changepassbutton, #recoveryemailbutton, #currentpass-delete-field").hide();
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

    if (data.prorate) {
      if (data.prorate === "complete" && pendingProration) {
        prorateComplete();
        pendingProration = false;
        dataRef.update({"prorate" : null});
      }
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
      userPlan = meta.plan;

      $("#upgrade-button, #upgrade-setting, #donate-button").fadeOut();

      $(".paid-plan-only").show();
      $("#payment-method").show();
      populatePlanDetails(meta);
    } else {
      $(".paid-plan-only").hide();

      if (allowedStorage > paidUserThresholdInBytes) {
        $("#upgrade-button, #upgrade-setting, #donate-button").fadeOut();
        paidOrNot = true;
      } else {
        $("#upgrade-button, #upgrade-setting, #donate-button").fadeIn();
      }
    }

    saveUserDetailsToLS(theUsername, usedStorage, allowedStorage, paidOrNot);

    setTimeout(function() {
      $("body, html").removeClass('is-loading');
    }, 1000);
    
  } else {
    deletionMarkForMeta = true; checkDeletionMarks();
  }
}

function gotUserOrders(orders) {
  if (orders !== null) {
    $("#paymenthistorybutton").show();
  } else {
    $("#paymenthistorybutton").hide();
  }
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
  var plan = $(".per-period").html().replace(" / ", "");

  if (plan === "mo") {
    productForPaddle = 523200;
  } else {
    productForPaddle = 523300;
  }

  emailForPaddle = $("#upgrade-email-input").val().trim();
  countryForPaddle = $("#upgrade-countries").val();
  zipForPaddle = $("#upgrade-zip-input").val().trim();
  couponForPaddle = $("#upgrade-coupon-input").val().trim() || "";

  $("#upgrade-form").addClass("is-loading");
  $(".upgrade-container, .upgrade-image-container").addClass("is-checkout");
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
  var checkoutid = data.checkout.id;
  console.log("Payment Successful", data);

  var writeCheckoutID = cloudfunctions.httpsCallable('writecheckoutid');
  writeCheckoutID({checkoutid: checkoutid}).then(function(result) {
    console.log("CheckoutId written successfully");
    orderComplete();
  }).catch(function(error) {
    handleError("Successful Checkout but couldn't write checkoutid" + checkoutid);
  });
}

// unnecessary for now but keeping anyway.
function paymentTerminated(data) {
  console.log("Payment Terminated", data);
}

function populatePlanDetails (meta) {
  plan = meta.plan;

  if (plan < 523300) {
    $('.settings-plan').html("Monthly Plan");
    $(".change-plan-button").html("Switch to Yearly Plan").prop("disabled", false);
  } else {
    $('.settings-plan').html("Yearly Plan");
    $(".change-plan-button").html("Switch to Monthly Plan").prop("disabled", false);
  }

  $(".change-payment-button").click(function(){
    popupLoadURL(meta.updateurl, "Cryptee : Update Payment Method", 400, 600);
  });
}

function updatePrices(data) {
  // var hasApplePay = data.checkoutData.apple_pay_enabled;
  var currencyLabels = document.querySelectorAll(".currency");
  var subtotal = data.eventData.checkout.prices.customer.total - data.eventData.checkout.prices.customer.total_tax;

  for(var i = 0; i < currencyLabels.length; i++) {
    currencyLabels[i].innerHTML = data.eventData.checkout.prices.customer.currency + " ";
  }

  document.getElementById("checkout-subtotal").innerHTML = subtotal.toFixed(2);
  document.getElementById("checkout-tax").innerHTML = data.eventData.checkout.prices.customer.total_tax;
  // document.getElementById("checkout-total").innerHTML = data.eventData.checkout.prices.customer.total;
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

    // document.getElementById("checkout-recurringPrice").innerHTML = recurringString;
    document.getElementById("checkout-total").innerHTML = recurringString;
  }

  $(".the-methods").fadeOut(500, function(){
    $(".the-totals").fadeIn(500);
  });
}


function toggleHistoryView() {
  $("#historyView").toggle();
}


function showCancelSubsButton() {
  $("#cancelSubscriptionNotification").fadeIn();
  $("#prorateView").fadeOut();
}

$(".closeCancelSubs").on('click', function(){
  $("#cancelSubscriptionNotification").fadeOut();
});

function cancelSubscription() {
  dataRef.update({"cancelsub" : "cancel"});
  $("#cancelSubscriptionNotification").find("button").addClass("is-loading").prop("disabled", true);
}

function showProrateView () {
  $("#prorateView").fadeIn();
  $("#cancelSubscriptionNotification").fadeOut();
}

function prorateParallel (){
  pendingProration = true;
  $("#prorateToYearlyNotification").fadeOut();
  $("#prorateView").find("button").addClass("is-loading").prop("disabled", true);
  if (userPlan) {
    if (userPlan < 523300) {
      dataRef.update({"prorate" : "toYearly"});
    } else {
      dataRef.update({"prorate" : "toMonthly"});
    }
  } else {
    var prorateNoPlan = cloudfunctions.httpsCallable('prorateNoPlan');
    prorateNoPlan({uid : theUserID}).then(function(result) {
      $("#prorateView").find("button").removeClass("is-loading");
      $("#prorateView").find("p").html("Looks like you're trying to access a panel meant for paid users. Perhaps become a paid user first?");
    }).catch(function(error) {
      $("#prorateView").find("button").removeClass("is-loading");
      $("#prorateView").find("p").html("Looks like you're trying to access a panel meant for paid users. Perhaps become a paid user first?");
      console.log(error);
    });
  }
}

function prorateComplete() {
  $("#prorateView").find("button").removeClass("is-loading").prop("disabled", false);
  $("#prorateView").fadeOut();
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












function hideReauthPopup () {
  $("#reauth-error").slideUp(500);
}

function showReauthPopup(color, message){
  $("#change-pass-button").removeClass('loading disabled');
  $("#change-key-button").removeClass('loading disabled');
  $("#reauth-error").html('<button class="delete" onclick="hideReauthPopup();"></button>' + message);
  $("#reauth-error").removeClass("is-warning is-success is-info is-danger").addClass(color).slideDown(500);
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
  db.ref('/users/' + theUserID + "/data/keycheck").once('value').then(function(snapshot) {
    var encryptedStrongKey = JSON.parse(snapshot.val()).data; // or encrypted checkstring for legacy accounts
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
    handleError(error);
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
  if (!isMobile) {
    if (data && !dataAdded) {
      var theData = data.toJSON();
      delete theData.cryptmail;
      var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(theData));
      $("#account-data-json").append("<a style='text-decoration:none;' href='"+dataStr+"' download='Cryptee Account Data.json'><span class='icon'><i class='fa fa-download fa-fw'></i></span> Download Account Data (JSON File)</a><br>");
      $("#account-data-json").removeClass("is-loading");
      exportData = data;
      dataAdded = true;
    }

    if (meta && !metaAdded) {
      var theMeta = meta.toJSON();
      var metaStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(theMeta));
      $("#account-data-json").append("<a style='text-decoration:none;' href='"+metaStr+"' download='Cryptee Meta Data.json'><span class='icon'><i class='fa fa-download fa-fw'></i></span> Download Meta Data (JSON File)</a><br>");
      $("#account-data-json").removeClass("is-loading");
      metaAdded = true;
    }

    if (orders && !ordersAdded) {
      var theOrders = orders.toJSON();
      var ordersStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(theOrders));
      $("#account-data-json").append("<a style='text-decoration:none;' href='"+ordersStr+"' download='Cryptee Orders Data.json'><span class='icon'><i class='fa fa-download fa-fw'></i></span> Download Orders Data (JSON File)</a><br>");
      $("#account-data-json").removeClass("is-loading");
      ordersAdded = true;
    }
  }
}

var myDataPopulated = false;
$("#settings-my-data-button").on("click", function(){
  if (!myDataPopulated) {
    myDataPopulated = true;
    generateExportURLs(exportData);
  }
});

function generateExportURLs (data) {
  var fileRef = rootRef.child("home.crypteedoc");
  fileRef.getDownloadURL().then(function(docURL) {
    $("#account-files-section").append("<a class='fileExportURL' href='"+docURL+"'><span class='icon'><i class='fa fa-download fa-fw'></i></span>Home Document</a><br>");
  });

  if (data) {
    var docsFolders = data.val().folders;
    if (docsFolders) {
      $.each(docsFolders, function(fid, folder){
        var docsOfFolder = folder.docs;
        $.each(docsOfFolder, function(did, doc){
          if (doc.isfile) {
            generateFileURLAndAppendToList(did);
          } else {
            generateDocURLAndAppendToList(did);
          }
        });
      });
    }

    generatePhotosURLs();
  }
}

function generateDocURLAndAppendToList(did) {
  var fileRef = rootRef.child(did + ".crypteedoc");
  fileRef.getDownloadURL().then(function(docURL) {
    $("#account-files-section").append("<a class='fileExportURL' href='"+docURL+"'><span class='icon'><i class='fa fa-download fa-fw'></i></span>"+did.replace("d-","").replace("p-","")+"</a><br>");
  });
}

function generateFileURLAndAppendToList(did) {
  var fileRef = rootRef.child(did + ".crypteefile");
  fileRef.getDownloadURL().then(function(docURL) {
    $("#account-files-section").append("<a class='fileExportURL' href='"+docURL+"'><span class='icon'><i class='fa fa-download fa-fw'></i></span>"+did.replace("d-","").replace("p-","")+"</a><br>");
  });
}

function generatePhotosURLs () {
  photosRef.get().then(function(photosHomeItems) {
    photosHomeItems.docs.forEach(function(photosHomeItem){
      var photosHomeItemId = photosHomeItem.data().id;
      if (photosHomeItemId) {
          if (photosHomeItemId.startsWith('p-')) {
            var fileRef = rootRef.child(photosHomeItemId + ".crypteefile");
            fileRef.getDownloadURL().then(function(docURL) {
              $("#account-files-section").append("<a class='fileExportURL' href='"+docURL+"'><span class='icon'><i class='fa fa-download fa-fw'></i></span>"+photosHomeItemId.replace("d-","").replace("p-","")+"</a><br>");
            });
          } else if (photosHomeItemId.startsWith('f-')) {
            enumerateFolderForExport(photosHomeItemId);
          }
        }
    });
  });
}

function enumerateFolderForExport(fid){
  photosRef.doc(fid).collection(fid).get().then(function(folderItems) {

    folderItems.docs.forEach(function(folderItem) {
      var folderItemId = folderItem.id;
      if (folderItemId) {
        if (folderItemId.startsWith('p-')) {
          var fileRef = rootRef.child(folderItemId + ".crypteefile");
          fileRef.getDownloadURL().then(function(docURL) {
            $("#account-files-section").append("<a class='fileExportURL' href='"+docURL+"'><span class='icon'><i class='fa fa-download fa-fw'></i></span>"+folderItemId.replace("d-","").replace("p-","")+"</a><br>");
          });
        } else if (folderItemId.startsWith('f-')) {
          enumerateFolderForExport(folderItemId);
        }
      }
    });

  });
}












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






































//
