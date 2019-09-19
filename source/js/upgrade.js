
/////////////////////////////////////////////////////////////
///////////////////   PAYMENT FEEDBACK   ////////////////////
/////////////////////////////////////////////////////////////
var huaLowStorage, huaExceededStorage = false;

$("#upgrade-thanks > .notification > .delete").on('click', function(event) {
  loadTab("overview");
  closeUpgrade();
});

function orderComplete () {
  if (location.pathname.indexOf("account") > -1) {
    // REMOVE UPGRADE FROM URL
    history.pushState("upgrade-complete", null, '/account');
    $("#upgrade-thanks").addClass("showUpgradeThanks");
    ping("event", {eventCategory: "upgrade", eventAction : "complete"});
  }
}

function exceededStorage(callback, callbackParam) {
  try { quill.blur(); } catch (e){}
  callback = callback || noop;
  getToken();
  if (!huaExceededStorage) {
    $("#exceeded-modal").addClass("is-active");
    if (location.pathname.replace("/", "") === "home") {
      showExceededAtHome();
    } else {
      breadcrumb('Displaying Exceeded Storage');
    }
  }
}

function closeExceededStorageModal () {
  $("#exceeded-modal").removeClass("is-active");
  huaExceededStorage = true;
}

$("#low-storage-warning > .notification > .delete").on('click', function(event) {
  hideLowStorageWarning(true);
});

function showLowStorageWarning() {
  showWarningModal("low-storage-warning");
}

function hideLowStorageWarning(userAcknowledged) {
  hideActiveWarningModal();
  if (userAcknowledged) { huaLowStorage = true; }
}

function showPlans() {
  if (isPaidUser) {
    window.location = "account?action=payments-plan";
  } else {
    window.location = "account?action=upgrade";
  }
}

function showExceededAtHome() {
  breadcrumb('Displaying Exceeded Storage @ Home');
  $(".usage-progress").removeClass("is-dark is-warning").addClass("is-danger");
  $("#home-welcome-card").find(".usage").css({"backgroundColor" : "#d9534f", "color" : "#FFF"});
  $("#app-buttons-level").fadeOut(500, function() {
    $("#exceeded-home").fadeIn();
  });
}

function closeExceededAtHome() {
  $("#exceeded-home").fadeOut(500, function() {
    $("#app-buttons-level").fadeIn();
  });
}