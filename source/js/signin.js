var theKey = JSON.parse(sessionStorage.getItem('key'));
var theUser;
var theUserID;
var theUsername;
var theToken;
var signinURL = "https://crypt.ee/auth";
var photoJSON = "https://storage.googleapis.com/cryptee-54307.appspot.com/public/signin-photo.json";

$(window).on("load", function(event) {
  if (!isMobile) {
    $.ajax({url: photoJSON}).done(function(data) {
      var usObj = JSON.parse(data);
      $(".hero-banner .hero").css("background-image", "url("+usObj.photo_url+")");
      $('#photo-credit').html("&copy; &nbsp;" + usObj.author + " via Unsplash");
      $('#photo-credit').attr("href", usObj.author_url);
    });
  }
});

var getUrlParameter = function getUrlParameter(sParam) {
    var sPageURL = decodeURIComponent(window.location.search.substring(1)),
        sURLVariables = sPageURL.split('&'),
        sParameterName,
        i;

    for (i = 0; i < sURLVariables.length; i++) {
        sParameterName = sURLVariables[i].split('=');

        if (sParameterName[0] === sParam) {
            return sParameterName[1] === undefined ? true : sParameterName[1];
        }
    }
};

firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    //got user
    theUser = user;
    theUserID = theUser.uid;
    theUsername = theUser.displayName;
    $('.username').html(theUsername);

    if (!isMobile) {
      $(".hero-banner").css("width", "100%");
      $(".hero-body > .container").delay(1000).fadeOut(250, function() {
        if (theKey) {
          checkKey(theKey);
        } else {
          showKeyModal();
        }
      });
    } else {
      signInComplete ();
    }
  }
});

function showKeyModal() {
  $("#key-modal").addClass("is-active");
  $("#key-modal").delay(10).animate({opacity : 1 }, 250, function(){
    setTimeout(function () {
      $("#key-input").focus();
    }, 250);
  });
}

function hideKeyModal() {
  $("#key-modal").removeClass("is-active");
  $("#key-input").blur();
}

function checkKey(key){
  key = key || theKey;

  db.ref('/users/' + theUserID + "/data/keycheck").once('value').then(function(snapshot) {
    var checkString = JSON.parse(snapshot.val()).data;
    var theCheck;
    openpgp.decrypt({ message: openpgp.message.readArmored(checkString), password: key,  format: 'utf8' }).then(function(plaintext) {
        theCheck = plaintext.data;
        sessionStorage.setItem('key', JSON.stringify(key));
        theKey = key;
        signInComplete();
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

function signInComplete () {
  if (getUrlParameter("redirect")) {
    window.location = getUrlParameter("redirect") + ".html";
  } else {
    window.location = "home.html";
  }
}

function signOut(){
  try { sessionStorage.clear(); sessionStorage.removeItem('key'); } finally {
    firebase.auth().signOut().then(function() {
      window.location.reload(false);
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


function signin(token){
  var email;
  sessionStorage.clear();

  if ($("#signin-user").val().indexOf("@") != -1) {
    email = $("#signin-user").val();
  } else {
    email = $("#signin-user").val() + "@users.crypt.ee";
  }
  var password = $("#signin-pass").val();
  firebase.auth().signInWithEmailAndPassword(email, password).catch(function(error) {
    var errorCode = error.code;
    var errorMessage = error.message;
    if (errorCode === 'auth/wrong-password' || errorCode === 'auth/user-not-found' || errorCode === 'auth/invalid-email') {
      $("#wrong-password").fadeIn(500);
    } else if (errorCode === 'auth/user-disabled'){
      $("#user-disabled").fadeIn(500);
    } else {
      $("#other-error").fadeIn(500);
    }
    console.log(error);
  });
}

function signinRequest() {
  $.ajax({ url: signinURL, type: 'POST',
      success: function(data){
        gotToken(data);
      },
      error:function (xhr, ajaxOptions, thrownError){
          console.log(thrownError);
      }
  });
}

function gotToken(tokenData) {
  var token = JSON.parse(tokenData);
  signin(token);
}

$("#signin-button").on('click', function(event) {
  event.preventDefault();
  signin();
});

$("#signin-pass").on('keyup', function (e) {
    if (e.keyCode == 13) {
        signin();
    }
});

$("#signin-user").on('keyup', function (e) {
    if (e.keyCode == 13) {
        $("#signin-pass").focus();
    }
});
