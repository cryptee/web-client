
///////////////////////////////////////////////////
/////////////////// SIGN UP  //////////////////////
///////////////////////////////////////////////////
var passScore;
var keyScore;
var passVerified = false;
var passIsGood = false;
var keyVerified = false;
var keyIsGood = false;
var theUser;
var theCheck;
var theUserID;
var theUsername;
var theEmail;
var theCryptmail;
var theEpoch;

//       type   : 'different[pass]',
//       prompt : "Encryption Key can't be the same as your Sign In Password"

//     terms: { rules: [{
//       type   : 'checked',
//       prompt : "You must agree to the terms and conditions"
//     }]},

function isEmail(email) {
  var regex = /^([a-zA-Z0-9_.+-])+\@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/;
  return regex.test(email);
}

$("#signup-email").on("keyup", function(){
  if ($("#signup-email").val()) {
    if (isEmail($("#signup-email").val().trim())){
      $("#email-help").fadeOut();
    } else {
      $("#email-help").fadeIn();
    }
  } else {
    $("#email-help").fadeOut();
  }
});

$("#signup-email").on("blur", function(){
  if ($("#signup-email").val()) {
    if (isEmail($("#signup-email").val().trim())){
      $("#email-help").fadeOut();
    } else {
      $("#email-help").fadeIn();
    }
  } else {
    $("#email-help").fadeOut();
  }
});

function checkPass() {
  if ( $("#signup-pass").val().trim() !== $("#signup-pass-ver").val().trim() ) {
    $("#signup-pass-ver").addClass('is-danger');
    $("#signup-pass-ver").parents(".field").find(".help").fadeIn();
    passVerified = false;
  } else {
    $("#signup-pass-ver").removeClass('is-danger');
    $("#signup-pass-ver").parents(".field").find(".help").fadeOut();
    passVerified = true;
  }

  passScore = zxcvbn($("#signup-pass").val().trim()).score + 1;

  $("#pass-score").attr("value", passScore * 20);
  if (passScore <= 2) {
    $("#signup-pass").addClass('is-danger');
    $("#pass-score").removeClass('is-success').addClass('is-danger');
    passIsGood = false;
  } else {
    $("#signup-pass").removeClass('is-danger');
    $("#pass-score").removeClass('is-danger').addClass('is-success');
    passIsGood = true;
  }
}

function checkKey() {
  if ( $("#signup-key").val().trim() !== $("#signup-key-ver").val().trim() ) {
    $("#signup-key-ver").addClass('is-danger');
    $("#signup-key-ver").parents(".field").find(".help").fadeIn();
    keyVerified = false;
  } else {
    $("#signup-key-ver").removeClass('is-danger');
    $("#signup-key-ver").parents(".field").find(".help").fadeOut();
    keyVerified = true;
  }

  keyScore = zxcvbn($("#signup-key").val().trim()).score + 1;

  $("#key-score").attr("value", keyScore * 20);

  if (keyScore <= 1) {
    $("#signup-key").addClass('is-danger');
    $("#key-score").removeClass('is-success').addClass('is-danger');
    keyIsGood = false;
  } else {
    $("#signup-key").removeClass('is-danger');
    $("#key-score").removeClass('is-danger').addClass('is-success');
    keyIsGood = true;
  }
}

$("#signup-pass").on("keyup", function(){
  checkPass();
});

$("#signup-pass-ver").on("keyup", function(){
  checkPass();
});

$("#signup-key").on("keyup", function(){
  checkKey();
});

$("#signup-key-ver").on("keyup", function(){
  checkKey();
});

$("#signup-username").on("keyup", function(){
  var input = $("#signup-username").val();
  $("#username-help").fadeOut(500);
});

$("#signup-button").on("click",function(){
  signupInitiate ();
});

function signupInitiate() {
  if (passVerified && keyVerified && passIsGood && keyIsGood) {
    if ($("#signup-username").val().trim() !== "" || ($("#signup-email").val().trim() !== "" && isEmail($("#signup-email").val()))) {
      createUser();
    }
  } else {
    $("#signup-message").fadeIn();
  }
}

function createUser() {

    theCryptmail = $("#signup-username").val().trim() + "@users.crypt.ee";
    theEmail = $("#signup-email").val().trim();

    var emailToUse;
    if (theEmail !== "") {
      emailToUse = theEmail;
    } else {
      emailToUse = theCryptmail;
    }

    $("#signup-button").addClass('is-loading').prop('disabled', true);

    firebase.auth().createUserWithEmailAndPassword(emailToUse, $("#signup-pass").val()).then(function(newUser) {
        theUser = newUser;
        theUserID = theUser.uid;
        theCryptmail = $("#signup-username").val() + "@users.crypt.ee";
        theEmail = $("#signup-email").val();
        theEpoch = (new Date()).getTime();
        theUsername = $("#signup-username").val();
        logUser(newUser, theUsername, $("#signup-key").val()); // Optional
    }, function(error) {
        var errorCode = error.code;
        var errorMessage = error.message;
        if        (errorCode == 'auth/weak-password') {
          $("#signup-message > span").html("Our servers think something about your password seems too weak"); $("#signup-message").fadeIn(); $("#signup-button").prop('disabled', false).removeClass("is-loading is-success").html("Try Again");
        } else if (errorCode == 'auth/email-already-in-use') {
          $("#username-help").fadeIn(500); $("#signup-button").prop('disabled', false).removeClass("is-loading is-success").html("Try Again");
        } else if (errorCode == 'auth/invalid-email') {
          $("#signup-message > span").html("Our servers think you may have used an invalid character in your username. No @ symbols please."); $("#signup-message").fadeIn(); $("#signup-button").prop('disabled', false).removeClass("is-loading is-success").html("Try Again");
        } else {
          $("#signup-message > span").html("Something went wrong... We're terribly sorry. Please try again soon."); $("#signup-message").fadeIn(); $("#signup-button").prop('disabled', false).removeClass("is-loading is-success").html("Try Again");
        }
    });

}

function logUser(newUser, username, key){
  $("#signup-button").html("<i class='fa fa-check'></i>").addClass('is-success');
  newUser.updateProfile({
      displayName : username
  }).then(function() {
      // Update successful.
      if (theEmail !== "") {
        newUser.sendEmailVerification();
      }
      saveKey(key);
  }, function(error) {
    $("#signup-message > span").html("Something went wrong... We're terribly sorry. Please try again soon."); $("#signup-message").fadeIn(); $("#signup-button").prop('disabled', false).removeClass("is-loading is-success").html("Try Again");
  });
}

function saveKey(key){
  sessionStorage.clear();
  sessionStorage.setItem('key', JSON.stringify(key));
  createAcctHome();
}


function createAcctHome(){
  setTimeout(function () {
    window.location = "createacct.html";
  }, 2000);
}
