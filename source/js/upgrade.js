
/////////////////////////////////////////////////////////////
///////////////////   PAYMENT FEEDBACK   ////////////////////
/////////////////////////////////////////////////////////////
var huaLowStorage, huaExceededStorage = false;

$("#upgrade-thanks > .notification > .delete").on('click', function(event) {
  $("#upgrade-thanks").removeClass('showUpgradeThanks');
});

$("#bumpup-window > .notification > .delete").on('click', function(event) {
  $("#bumpup-window").removeClass('showBumpUp');
  huaLowStorage = true;
});

$("#bumpdown-window > .notification > .delete").on('click', function(event) {
  $("#bumpdown-window").removeClass('showBumpDown');
});

function orderComplete () {
  $("#upgrade").hide();
  $("#upgrade-button").fadeIn(250);
  $(".settings-tab-contents").hide();
  $("#account-tab-contents").show();
  $(".settings-tab.is-dark").removeClass('is-dark');
  $(".settings-tab[tab='account']").addClass('is-dark');

  $("#upgrade-thanks").addClass("showUpgradeThanks");
  // currentPlan = meta.plan;
  // console.log("Order Complete. New Plan is : ", meta.plan);
  // console.log("Order Complete. New Subscription D is : ", meta.subscriptionid);
  // console.log("Order Complete. New Account ID is : ", meta.fsaccountid);
}

function showBumpUpThePlan (exceeded) {
  try { quill.blur(); } catch (e){}
  if (exceeded) {
    $("#bumpup-window").find(".title").html("Exceeded Storage");
    $("#bumpup-message").html("You have exceeded your storage limit. If you would like to add another 10GB to your plan click 'Upgrade' and we will automatically add another 10GBs to your account. Otherwise, you will need to clean up some space to be able to keep saving.");
  } else {
    $("#bumpup-window").find(".title").html("About to Exceed Storage");
    $("#bumpup-message").html("You are about to exceed your storage limit. You won't be able to save files once you exceed your storage limit. If you would like to add another 10GB to your plan click 'Upgrade' and we will automatically add another 10GB to your account.");
  }
  $("#bumpup-window").addClass("showBumpUp");
}

function bumpUpThePlan () {
  dataRef.update({"bump" : "up"},function(){
    $("#bumpup-window").removeClass("showBumpUp");
  });
}

function bumpDownThePlan () {
  dataRef.update({"bump" : "down"}, function(){
    // SHOW BUMP DOWN INFO MODAL.
    $("#bumpdown-window").addClass("showBumpDown");
  });
}

function exceededStorage(callback, callbackParam) {
  try { quill.blur(); } catch (e){}
  callback = callback || noop;
  getToken();
  if (!huaExceededStorage) {
    $("#exceeded-modal").addClass("is-active");
  }
}

function closeExceededStorageModal () {
  $("#exceeded-modal").removeClass("is-active");
  huaExceededStorage = true;
}

$("#low-storage-warning > .notification > .delete").on('click', function(event) {
  $("#low-storage-warning").removeClass('showLowStorage viaUpgradeButton');
  huaLowStorage = true;
});

function upgradeFromExceed() {
  window.location = "account?action=upgrade";
}
