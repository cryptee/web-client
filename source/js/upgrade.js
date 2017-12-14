
/////////////////////////////////////////////////////////////
///////////////////  PAYMENT PROCESSING  ////////////////////
/////////////////////////////////////////////////////////////

$(".subscribe-monthly-button").on('click', function(event) {
  var s = {
  	'reset': true, 'checkout': true,
  	'products' : [ { 'path':'monthly-plan', 'quantity': 5 } ],
    'paymentContact': {'email': theUser.email || ""},
  };
  fastspring.builder.push({'tags': { "uid": theUserID }});
  fastspring.builder.push(s);
});

$(".subscribe-yearly-button").on('click', function(event) {
  var s = {
  	'reset': true, 'checkout': true,
  	'products' : [ { 'path':'yearly-plan', 'quantity': 5 } ],
    'paymentContact': {'email': theUser.email || ""},
  };
  fastspring.builder.push({'tags': { "uid": theUserID }});
  fastspring.builder.push(s);
});

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
  $("#upgrade-thanks").addClass("showUpgradeThanks");
  // currentPlan = meta.plan;
  // console.log("Order Complete. New Plan is : ", meta.plan);
  // console.log("Order Complete. New Subscription D is : ", meta.subscriptionid);
  // console.log("Order Complete. New Account ID is : ", meta.fsaccountid);
}

function showBumpUpThePlan (exceeded) {
  if (exceeded) {
    $("#bumpup-window").find(".title").html("Exceeded Storage");
    $("#bumpup-message").html("You have exceeded your 1GB storage limit. If you would like to add another 1GB to your plan for just $1/mo or $10/yr click 'Upgrade' and we will automatically add another 1GB to your account. Otherwise, you will need to clean up some space to be able to keep saving.");
  } else {
    $("#bumpup-window").find(".title").html("About to Exceed Storage");
    $("#bumpup-message").html("You are about to exceed your 1GB storage limit. You won't be able to save files once you exceed your storage limit. If you would like to add another 1GB to your plan for just $1/mo or $10/yr click 'Upgrade' and we will automatically add another 1GB to your account.");
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
