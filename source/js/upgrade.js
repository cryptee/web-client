/////////////////////////////////////////////////////////////
///////////////////   PAYMENT FEEDBACK   ////////////////////
/////////////////////////////////////////////////////////////
var huaLowStorage, huaExceededStorage = false;
var app = location.pathname.replace("/", "");

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
  $(".exceeded-storage").html(formatBytes(usedStorage + 105000 - allowedStorage));
  try { quill.blur(); } catch (e){}
  callback = callback || noop;
  getToken();
  if (!huaExceededStorage) {
    if (app === "home") {
      showExceededAtHome();
    } else {
      if (app === "photos") {
        if (!isUploading) {
          breadcrumb('Displaying Exceeded Storage');
          $("#exceeded-modal").addClass("is-active");
        }
      } else {
        breadcrumb('Displaying Exceeded Storage');
        $("#exceeded-modal").addClass("is-active");
      }
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
  if (app === "photos") {
    if (!isUploading) {
      showFlyingModal("low-storage-warning");
    }
  } else {
    showFlyingModal("low-storage-warning");
  }
}

function hideLowStorageWarning(userAcknowledged) {
  hideActiveFlyingModal();
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