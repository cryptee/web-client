var theUser;
var theUserID;
var theUsername;
var theEmail;
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
var reauthenticated = false;
var willLoseAuthForDeletion = false;
var connected;
var userToken;
var passVerified = false;
var passIsGood = false;
var userPlan;
var monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
var acctURL = "";

var invoiceURLBase = "https://svartlab.test.onfastspring.com/account/order/";
var invoiceURLEnd = "/invoice";

//////////////////////////////////////////////////////
//////////////////// HELPERS ////////////////////////
/////////////////////////////////////////////////////


$(".settings-tab").on('click', function(event) {
  whichTab = $(this).attr("tab");
  $("#upgrade").hide();
  $("#upgrade-button").fadeIn(250);
  $(".settings-tab-contents").hide();
  $("#" + whichTab + "-tab-contents").show();
  $(".settings-tab.is-dark").removeClass('is-dark');
  $(this).addClass('is-dark');
});

$("#upgrade-button").on('click', function(event) {
  $('#upgrade').fadeIn(250);
});


//////////////////////////////////////////////////////////
//////////////////// AUTHENTICATION  /////////////////////
//////////////////////////////////////////////////////////


firebase.auth().onAuthStateChanged(function(user) {
  if (!user) {
    if (willLoseAuthForDeletion) {
      window.location = "goodbye.html";
    } else {
      window.location = "signin.html?redirect=account";
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
      rootRef = store.ref().child('/users/' + theUserID);
      gotUser();
      reauthenticated = false;
    }
  }
});

function gotUser() {
  $('#account-username').html(theUsername);
  if (theEmail.indexOf("@users.crypt.ee") !== -1) {
    // if anonymous email
    $('#account-email').html("<span class='tag'>No Email</span>");
  } else {
    // if not anonymous email
    $('#account-email').html(theEmail);
    $("#recoveryemail").val(theEmail);
    if (!emailVerified) {
      console.log("not verified");
      $("#noemail").show();
    }
  }

  dataRef.on('value', function(snapshot) {  gotUserData(snapshot.val());  });
  metaRef.on('value', function(snapshot) {  gotUserMeta(snapshot.val());  });
  ordersRef.on('value', function(snapshot) { theOrders = snapshot.val(); gotUserOrders(); });
  returnsRef.on('value', function(snapshot) { theReturns = snapshot.val(); gotUserReturns(); });
  firebase.auth().currentUser.getIdToken(true).then(function(token) { userToken = token; });

  connectedRef.on("value", function(snap) {
    if (snap.val() === true) {
      connected = true;
    } else {
      connected = false;
    }
  });

  dataRef.child("orderComplete").on('value', function(snapshot) {
    orderCompleteBool = snapshot.val();
    if (orderCompleteBool) {
      orderComplete();
      dataRef.update({"orderComplete" : ""});
    }
  });

}



$("#signout-button").on('click', function(event) {
  event.preventDefault();
  signOut();
});

function signOut (){
  sessionStorage.removeItem('key');
  firebase.auth().signOut().then(function() {
    console.log('Signed Out');
  }, function(error) {
    Raven.captureException(JSON.stringify(error));
    console.error('Sign Out Error', error);
  });
}

function gotUserData (data) {
  foldersCount = data.foldersCount;
  $('#settings-folders-count').html(foldersCount);

  if (data.accturl !== "geturl") {
    if (data.accturl && acctURL === "") {
      $(".change-payment-method-button").removeClass('is-loading').prop('disabled', false);
      acctURL = data.accturl + "#/account";
      $(".change-payment-method-button").prop('onclick',null).off('click').click(function(event) {
        var win = window.open(acctURL, '_blank');
        if (win) { win.focus(); }
      });
    }
  } else {
    dataRef.update({"accturl" : ""});
    $(".change-payment-method-button").addClass('is-loading').prop('disabled', true);
  }

  if (data.cancelsub === "done"){
    $('#cancelSubscriptionNotification').hide();
    $('#subscriptionCanceled').show();
    dataRef.update({"cancelsub" : null});
  }
}

function gotUserMeta (meta){
  if (meta.hasOwnProperty("plan") && meta.plan !== "") {
    db.ref().child('/users/' + theUserID + "/data/accturl").remove(function(){
      dataRef.update({"accturl" : "geturl"});
      acctURL = "";
    });

    $("#upgrade-button").parents("li").hide();
    $("#upgrade").hide();
    $("#payment-method").show();
    $(".change-plan-button").html("Change Plan").removeClass('is-info');
    populatePlanDetails(meta);
  } else {
    $('.settings-plan').html("Free Plan");
    $(".free-plan-change-button").html("Current Plan").prop("disabled", true);
    $(".yearly-plan-change-button").html("Subscribe Yearly").prop("disabled", false);
    $(".monthly-plan-change-button").html("Subscribe Monthly").prop("disabled", false);
    $("#payment-method").hide();
    $(".change-plan-button").html("Upgrade").addClass('is-info');
  }

  usedStorage = meta.usedStorage;
  $('#settings-storage-used').html(formatBytes(usedStorage));

  allowedStorage = meta.allowedStorage || freeUserQuotaInBytes;
  $('.settings-storage-total').html(formatBytes(allowedStorage));

  userPlan = meta.plan;

  if (meta.deactivationDateDisplay) {
    var deactivationColumn = '<div class="columns"><div class="column"><b>Subscription Cancellation Date</b></div><div class="column"><span id="cancellation-date"></span></div><div class="column"></div></div>';
    if (meta.deactivationDateDisplay !== "soon") {
      $("#changePlanView").before(deactivationColumn);
      $("#cancellation-date").html(meta.deactivationDateDisplay);
      $(".free-plan-change-button").html("Scheduled : " + meta.deactivationDateDisplay).prop("disabled", true);
    }
  }

  $("body, html").removeClass('is-loading');
}



function populatePlanDetails (meta) {
  plan = meta.plan;
  if (plan.includes('monthly')) {
    $('.settings-plan').html("Monthly Plan");
    $(".free-plan-change-button").html("Cancel Subscription").prop("disabled", false);
    $(".yearly-plan-change-button").html("Subscribe Yearly").prop("disabled", false);
    $(".monthly-plan-change-button").html("Current Plan").prop("disabled", true);
  } else if (plan.includes('yearly')){
    $('.settings-plan').html("Yearly Plan");
    $(".free-plan-change-button").html("Cancel Subscription").prop("disabled", false);
    $(".monthly-plan-change-button").html("Subscribe Monthly").prop("disabled", false);
    $(".yearly-plan-change-button").html("Current Plan").prop("disabled", true);
  } else {
    $('.settings-plan').html("Unlimited Plan");
    $(".change-plan-button").prop("disabled", true);
    $(".change-payment-method-button").prop("disabled", true);
    $(".show-history-button").prop("disabled", true);
  }
}

function gotUserOrders() {
  if (theOrders !== null) {
    var latestOrder = Object.keys(theOrders).reduce(function(a, b){ return theOrders[a] > theOrders[b] ? a : b; });
    var paymentMethod = theOrders[latestOrder].payment.type;

    if (paymentMethod === "PayPal" || paymentMethod === "paypal") {
      $(".settings-payment-method").html(paymentMethod);
    } else {
      var paymentEnding = theOrders[latestOrder].payment.cardEnding || "";
      $(".settings-payment-method").html(paymentMethod + "<br>" + paymentEnding);
    }

    $.each(theOrders, function(index, order) {
      var date = new Date(order.time);
      var orderDate = monthNames[date.getMonth()] + " " + date.getDate() + " " + date.getFullYear();
      var orderCard = '<div class="columns" id="'+order.time+'">' +
                        '<div class="column">'+ orderDate +'</div>' +
                        '<div class="column">'+ order.charge +'</div>' +
                        '<div class="column">' +
                          '<a href="'+invoiceURLBase + order.referenceid + invoiceURLEnd+'" target="_blank" class="button is-dark is-small">View Invoice</a>' +
                        '</div>' +
                      '</div>';
      if ($("#"+order.time).length <= 0) {
        $("#invoices").append(orderCard);
      }
    });

    $("#invoices .columns").sort(function(a, b) {
      return parseInt(b.id) - parseInt(a.id);
    }).each(function() {
      var elem = $(this);
      elem.remove();
      $(elem).appendTo("#invoices");
    });
  }
}


function gotUserReturns() {
  if (theReturns !== null) {
    var latestReturn = Object.keys(theReturns).reduce(function(a, b){ return theReturns[a] > theReturns[b] ? a : b; });

    $.each(theReturns, function(index, areturn) {
      var date = new Date(areturn.time);
      var returnDate = monthNames[date.getMonth()] + " " + date.getDate() + " " + date.getFullYear();
      var returnCard = '<div class="columns" id="'+areturn.time+'">' +
                        '<div class="column">'+ returnDate +'</div>' +
                        '<div class="column">'+ areturn.amount +'</div>' +
                        '<div class="column">'+ areturn.returnreference+'</div>' +
                       '</div>';
      if ($("#"+areturn.time).length <= 0) {
        $("#returns").append(returnCard);
      }
    });

    $("#returns .columns").sort(function(a, b) {
      return parseInt(b.id) - parseInt(a.id);
    }).each(function() {
      var elem = $(this);
      elem.remove();
      $(elem).appendTo("#returns");
    });

  }
}

function toggleChangePlanView() {
  if (userPlan !== "" && userPlan !== undefined && userPlan !== null) {
    $("#changePlanView").toggle();
  } else {
    $('#upgrade').fadeIn(250);
  }
}

function toggleHistoryView() {
  $("#historyView").toggle();
}



function showReauthPopup(color, message){
  $("#change-pass-button").removeClass('loading disabled');
  $("#reauth-error").html(message);
  $("#reauth-error").removeClass("is-warning is-success is-info is-danger").addClass(color).show();
}

function reauthForPass (){
  $("#change-pass-button").addClass('loading disabled');
  var currentPass = $("#currentpass").val();
  var credential = firebase.auth.EmailAuthProvider.credential(theUser.email, currentPass);
  reauthenticated = true;
  theUser.reauthenticateWithCredential(credential).then(function() {
    changePassword();
  }, function(error) {
    showReauthPopup("is-warning", "Please check your current password and try again.");
  });
}

function reauthForEmail (){
  $("#change-email-button").addClass('loading disabled');
  var currentPass = $("#currentpass-email").val();
  var credential = firebase.auth.EmailAuthProvider.credential(theUser.email, currentPass);
  reauthenticated = true;
  theUser.reauthenticateWithCredential(credential).then(function() {
    changeEmail();
  }, function(error) {
    showReauthPopup("is-warning", "Please check your current password and try again.");
  });
}

function reauthForDelete (){
  $("#delete-account-button").addClass('loading disabled');
  $("#delete-account-confirm-button").addClass('loading disabled');
  var currentPass = $("#currentpass-delete").val();
  var credential = firebase.auth.EmailAuthProvider.credential(theUser.email, currentPass);
  reauthenticated = true;
  theUser.reauthenticateWithCredential(credential).then(function() {
    prepareToDeleteAccount();
  }, function(error) {
    showReauthPopup("is-warning", "Please check your current password and try again.");
  });
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
  if (newEmail === "") {
      newEmail = theUser.displayName + "@users.crypt.ee";
  }
  theUser.updateEmail(newEmail).then(function() {
  // Update successful.
  if (newEmail.indexOf("@users.crypt.ee") !== -1) {
    showReauthPopup("is-success", "Email successfully removed from our database!");
    setTimeout(function () {
      window.location.reload();
    }, 2000);
  } else {
    showReauthPopup("is-success", "Email successfully set! Please check your inbox for a verification mail.");
    verifyEmail();
  }
}, function(error) {
  showReauthPopup("is-warning", "We can't seem to set your email. Please try again.");
});
}

function verifyEmail() {
  $("#verify-email-button").addClass('is-loading');
  theUser.sendEmailVerification().then(function(){
    $("#verify-email-button").removeClass('is-loading').html("Email Sent").addClass('disable-clicks');
  });
}

function checkPass() {
  if ( $("#newpass").val().trim() !== $("#newpassver").val().trim() ) {
    $("#newpassver").addClass('is-danger');
    $("#newpassver").parents(".field").find(".help").fadeIn();
    passVerified = false;
  } else {
    $("#newpassver").removeClass('is-danger');
    $("#newpassver").parents(".field").find(".help").fadeOut();
    passVerified = true;
  }

  passScore = zxcvbn($("#newpass").val().trim()).score + 1;

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

$("#newpass").on("keyup", function(){
  checkPass();
});

$("#newpassver").on("keyup", function(){
  checkPass();
});

$("#change-pass-button").on("click" , function(){
  if (passVerified && passIsGood) {
    reauthForPass();
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
  console.log("delete requested");
  willLoseAuthForDeletion = true;
  theUser.delete().then(function() {
    // User deleted.
  }, function(error) {
    $("#cant-delete").html("Strangely, we can't seem to delete your account. This is likely a temporary issue. Please try again soon.");
    Raven.captureException(JSON.stringify(error));
    console.log("strangely. can't delete: ", error);
  });

}

function showCancelSubsButton() {
  $("#cancelSubscriptionNotification").fadeIn();
  $("#prorateToYearlyNotification").fadeOut();
  $("#prorateToMonthlyNotification").fadeOut();
}

function cancelSubscription() {
  dataRef.update({"cancelsub" : "cancel"});
}

function showProrateToYearly () {
  $("#prorateToYearlyNotification").fadeIn();
  $("#prorateToMonthlyNotification").fadeOut();
  $("#cancelSubscriptionNotification").fadeOut();
}

function showProrateToMonthly () {
  $("#prorateToMonthlyNotification").fadeIn();
  $("#prorateToYearlyNotification").fadeOut();
  $("#cancelSubscriptionNotification").fadeOut();
}

function prorateToYearly (){
  $("#prorateToYearlyNotification").fadeOut();
  dataRef.update({"prorate" : "toYearly"});
}

function prorateToMonthly () {
  $("#prorateToMonthlyNotification").fadeOut();
  dataRef.update({"prorate" : "toMonthly"});
}
