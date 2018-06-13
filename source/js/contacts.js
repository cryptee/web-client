var theKey = JSON.parse(sessionStorage.getItem('key'));
sessionStorage.removeItem('key');


var theUser;
var theUserID;
var theUsername;
var reauthenticated = false;
var retokening = false;
var rootRef;
var contactsRef;
var connectedRef = firebase.database().ref(".info/connected");
var allFieldKeys;
var metaRef;
var dataRef;
var rootRef;

var fieldChanged = false;
var idleTime = 0;
var lastSaved = (new Date()).getTime();
var idleInterval = setInterval(autosaveTimer, 1000);
var isSaving = false;

var importedObject;
var contactsObject = [];

var huaLowStorage = false;
var huaExceededStorage = false;
var allowedStorage, usedStorage;


var blankObject = {"Name":"","Given Name":"","Additional Name":"","Family Name":"","Yomi Name":"","Given Name Yomi":"","Additional Name Yomi":"","Family Name Yomi":"","Name Prefix":"","Name Suffix":"","Initials":"","Nickname":"","Short Name":"","Maiden Name":"","Birthday":"","Gender":"","Location":"","Billing Information":"","Directory Server":"","Mileage":"","Occupation":"","Hobby":"","Sensitivity":"","Priority":"","Subject":"","Notes":"","Group Membership":"","E-mail 1 - Type":"","E-mail 1 - Value":"","E-mail 2 - Type":"","E-mail 2 - Value":"","E-mail 3 - Type":"","E-mail 3 - Value":"","E-mail 4 - Type":"","E-mail 4 - Value":"","IM 1 - Type":"","IM 1 - Service":"","IM 1 - Value":"","IM 2 - Type":"","IM 2 - Service":"","IM 2 - Value":"","IM 3 - Type":"","IM 3 - Service":"","IM 3 - Value":"","Phone 1 - Type":"","Phone 1 - Value":"","Phone 2 - Type":"","Phone 2 - Value":"","Phone 3 - Type":"","Phone 3 - Value":"","Address 1 - Type":"","Address 1 - Formatted":"","Address 1 - Street":"","Address 1 - City":"","Address 1 - PO Box":"","Address 1 - Region":"","Address 1 - Postal Code":"","Address 1 - Country":"","Address 1 - Extended Address":"","Address 2 - Type":"","Address 2 - Formatted":"","Address 2 - Street":"","Address 2 - City":"","Address 2 - PO Box":"","Address 2 - Region":"","Address 2 - Postal Code":"","Address 2 - Country":"","Address 2 - Extended Address":"","Address 3 - Type":"","Address 3 - Formatted":"","Address 3 - Street":"","Address 3 - City":"","Address 3 - PO Box":"","Address 3 - Region":"","Address 3 - Postal Code":"","Address 3 - Country":"","Address 3 - Extended Address":"","Organization 1 - Type":"","Organization 1 - Name":"","Organization 1 - Yomi Name":"","Organization 1 - Title":"","Organization 1 - Department":"","Organization 1 - Symbol":"","Organization 1 - Location":"","Organization 1 - Job Description":"","Relation 1 - Type":"","Relation 1 - Value":"","Website 1 - Type":"","Website 1 - Value":"","Website 2 - Type":"","Website 2 - Value":"","Event 1 - Type":"","Event 1 - Value":""};

window.onbeforeunload = function() {
  if (fieldChanged){
    return true;
  }
};

function getToken() {
  if (!retokening) {
    retokening = true;
    firebase.auth().currentUser.getIdToken(true).then(function(idToken) {

      /////////////////
      ///   add token to payload here.
      ////////

      $.ajax({ url: tokenURL, type: 'POST',
          headers: {
            "Authorization": "Bearer " + idToken
          },
          contentType:"application/json; charset=utf-8",
          success: function(data){
            gotToken(data);
          },
          error:function (xhr, ajaxOptions, thrownError){
              console.log(thrownError);
              retokening = false;
          }
      });
    }).catch(function(error) {
      if (error.code !== "auth/network-request-failed") {
        handleError(error);
      }
      console.log("error getting token");
      retokening = false;
    });
  }
}

function gotToken(tokenData) {
  var token = tokenData;
  firebase.auth().signInWithCustomToken(token).then(function(){
    retokening = false;
  }).catch(function(error) {
    if (error.code !== "auth/network-request-failed") {
      handleError(error);
    }
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

      dataRef = db.ref().child('/users/' + theUserID + "/data/");
      metaRef = db.ref().child('/users/' + theUserID + "/meta/");
      rootRef = store.ref().child('/users/' + theUserID);
      contactsRef = rootRef.child("contacts.crypteedoc");

      Raven.setUserContext({ id: theUserID });

      $('.username').html(theUsername);

      checkForExistingUser(function(){
        if (theKey) {
          checkKey(theKey);
        } else {
          showKeyModal();
        }
      });
    }

    getToken();

  } else {
    // no user. redirect to sign up
    window.location = "signin.html?redirect=contacts";
  }
}, function(error){
  if (error.code !== "auth/network-request-failed") {
    handleError(error);
  }
});

function checkForExistingUser (callback){
  callback = callback || noop;

  db.ref('/users/' + theUserID + "/data/keycheck").once('value').then(function(snapshot) {
    if (snapshot.val() === null) {
      window.location = "signup.html?status=newuser";
    } else {
      callback();
    }
  });

}


function checkKey(key){
  db.ref('/users/' + theUserID + "/data/keycheck").once('value').then(function(snapshot) {
    var encryptedStrongKey = JSON.parse(snapshot.val()).data; // or encrypted checkstring for legacy accounts
    var hashedKey = hashString(key);
    openpgp.decrypt({ message: openpgp.message.readArmored(encryptedStrongKey), passwords: [hashedKey],  format: 'utf8' }).then(function(plaintext) {
        rightKey(plaintext);
    }).catch(function(error) {
        checkLegacyKey(dataRef, key, hashedKey, encryptedStrongKey, function(plaintext){
          rightKey(plaintext);
          // if it's wrong, wrongKey() will be called in checkLegacyKey in main.js
        });
    });
  });
}


function rightKey (plaintext) {
  var theStrongKey = plaintext.data;
  hideKeyModal();
  theKey = theStrongKey;
  signInComplete();
}

function wrongKey (error) {
  console.log("wrong key or ", error);
  sessionStorage.removeItem('key');
  showKeyModal();
  $('#key-status').html("Wrong key, please try again.");
}



function keyModalApproved (){
  $('#key-status').html("Checking key");
  event.preventDefault();
  var key = $('#key-input').val();
  checkKey(key);
}

$("#key-input").on('keydown', function (e) {
  setTimeout(function(){
    if (e.keyCode == 13) {
        keyModalApproved ();
    }
  },50);
});

function signInComplete(){
  // check to see if user already has contacts. if so, then open contacts box.
  // if not show welcome screen.
  db.ref('/users/' + theUserID + "/data/contacts").once('value').then(function(snapshot) {
    if (snapshot.val() >= 1) {
      //user has contacts show contacts list
      downloadContacts();
    } else {
      //show welcome;
      $("#contacts-welcome").fadeIn();
    }
  });

  metaRef.on('value', function(userMeta) {
    allowedStorage = userMeta.val().allowedStorage;
    usedStorage = userMeta.val().usedStorage;
    $(".used-storage").html(formatBytes(usedStorage));

    if (userMeta.val().hasOwnProperty("plan") && userMeta.val().plan !== "") {
      // paid user remove upgrade button
      $("#upgrade-button").parents("li").hide();
      $("#low-storage-warning").removeClass('showLowStorage viaUpgradeButton');
      closeExceededStorageModal();
      if (usedStorage >= allowedStorage){
        showBumpUpThePlan(true);
      } else if ((usedStorage >= allowedStorage * 0.8) && !huaLowStorage){
        showBumpUpThePlan(false);
      } else if (usedStorage <= (allowedStorage - 13000000000)){
        // this is 13GB because if user has 20GB, and using 7GB we'll downgrade to 10GB plan.
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

    saveUserDetailsToLS(theUsername, usedStorage, allowedStorage);
  });

  db.ref().child('/users/' + theUserID + "/data/").child("orderComplete").on('value', function(snapshot) {
    orderCompleteBool = snapshot.val();
    if (orderCompleteBool) {
      orderComplete();
      db.ref().child('/users/' + theUserID + "/data/").update({"orderComplete" : ""});
    }
  });
}

function isAPIAvailable() {
  // Check for the various File API support.
  if (window.File && window.FileReader && window.FileList && window.Blob) {
    // Great success! All the File APIs are supported.
    return true;
  } else {
    // SHOW ALERT. NOT SUPPORTED.
    return false;
  }
}

var thingsNeedResizing = "#contacts, #contact-details, #search-bar, #contacts-list, .column.is-8, #contacts-wrap";

$(document).ready(function() {
  if(isAPIAvailable()) {
    $('#contacts-import-input').bind('change', handleFileSelect);
    $('#contacts-import-input-two').bind('change', handleFileSelect);
  } else {
    $("#api-unsupported").show();
    $("#inputs").hide();
  }
  if(isMobile) {
    $("body").height($(window).height());
    $(thingsNeedResizing).addClass("itsMobile");
  }
});

$(window).resize(function(event) {
  arrangeTools();
});

$(window).on("load", function(event) {
  arrangeTools();
  if ($(window).width() > 768) {
    loadKeyModalBackground();
  } else {
    $(".modal-img-credit").hide();
  }
});

function arrangeTools() {
  /* Act on the event */
  var ww = $(window).width();
  if (ww <= 768) {
    // mobile
    if ($('#contact-details').children().length > 0){
      $("#contact-details").children().appendTo('#contact-details-modal-contents');
    }
  } else {
    // desktop
    if ($('#contact-details').children().length <= 0){
      $("#contact-details-modal-contents").children().appendTo('#contact-details');
      $("#contact-details-modal").removeClass("is-active");
    }
  }
}

//////// MODALS //////////

$(".modal-close").on('click', function(event) {
  $(this).parents(".modal").removeClass('is-active');
  $(this).parents(".modal").find('input').blur();
});

$(".modal-background").on('click', function(event) {
  if($(".modal.is-active:not(#key-modal)")){
    $(".modal.is-active:not(#key-modal)").removeClass('is-active');
    $(".modal.is-active").find("input").blur();
  }
});

$(document).keydown(function(e) {
    if (e.keyCode == 27) {
      $(".modal").removeClass('is-active');
      $(".modal").find('input').blur();
    }
});

function handleFileSelect(evt) {
    $("#import-status").removeClass("is-info is-danger is-warning is-success").addClass("is-info");
    $("#import-status > .title").html("Unpacking your contacts, please wait.");
    $("#import-status").fadeIn(250, function() {
      var files = evt.target.files;
      var file = files[0];
      processFile(file);
    });

}

function processFile(file) {
  var reader = new FileReader();
  reader.readAsText(file);
  reader.onload = function(event){

    $("#import-status").removeClass("is-info is-danger is-warning is-success").addClass("is-warning");
    $("#import-status > .title").html("Processing your contacts");
    var csv = event.target.result;

    try {
      importedObject = $.csv.toObjects(csv);

      //new way
      var mergedObjects = [];
      $.extend(true, mergedObjects, contactsObject, importedObject);
      encryptAndUploadContacts(mergedObjects, openContacts, mergedObjects);

      //old way
      // contactsObject.push.apply(contactsObject, importedObject);
      // encryptAndUploadContacts(contactsObject, openContacts, contactsObject);

      //new way
    } catch (e) {
      console.log(e);
      $("#import-status").removeClass("is-info is-danger is-warning is-success").addClass("is-danger");
      $("#import-status > .title").html("Error");
      $("#import-status").append("<p>Sorry, there seems to be a problem reading the file you've provided. Please make sure the file you're uploading is either a Google or Outlook CSV file.</p>");
    }

  };
  reader.onerror = function(){
    $("#import-status").removeClass("is-info is-danger is-warning is-success").addClass("is-danger");
    $("#import-status > .title").html("Error");
    $("#import-status").append("<p>Sorry, there seems to be a problem reading the file you've provided. Please make sure the file you're uploading is either a Google or Outlook CSV file.</p>");
  };
}

function skipImport() {
  newContact = {"Name":"","Given Name":"Your","Additional Name":"First","Family Name":"Contact","Yomi Name":"","Given Name Yomi":"","Additional Name Yomi":"","Family Name Yomi":"","Name Prefix":"","Name Suffix":"","Initials":"","Nickname":"","Short Name":"","Maiden Name":"","Birthday":"","Gender":"","Location":"","Billing Information":"","Directory Server":"","Mileage":"","Occupation":"","Hobby":"","Sensitivity":"","Priority":"","Subject":"","Notes":"","Group Membership":"","E-mail 1 - Type":"","E-mail 1 - Value":"support@crypt.ee","E-mail 2 - Type":"","E-mail 2 - Value":"","E-mail 3 - Type":"","E-mail 3 - Value":"","E-mail 4 - Type":"","E-mail 4 - Value":"","IM 1 - Type":"","IM 1 - Service":"","IM 1 - Value":"","IM 2 - Type":"","IM 2 - Service":"","IM 2 - Value":"","IM 3 - Type":"","IM 3 - Service":"","IM 3 - Value":"","Phone 1 - Type":"","Phone 1 - Value":"","Phone 2 - Type":"","Phone 2 - Value":"","Phone 3 - Type":"","Phone 3 - Value":"","Address 1 - Type":"","Address 1 - Formatted":"","Address 1 - Street":"","Address 1 - City":"","Address 1 - PO Box":"","Address 1 - Region":"","Address 1 - Postal Code":"","Address 1 - Country":"","Address 1 - Extended Address":"","Address 2 - Type":"","Address 2 - Formatted":"","Address 2 - Street":"","Address 2 - City":"","Address 2 - PO Box":"","Address 2 - Region":"","Address 2 - Postal Code":"","Address 2 - Country":"","Address 2 - Extended Address":"","Address 3 - Type":"","Address 3 - Formatted":"","Address 3 - Street":"","Address 3 - City":"","Address 3 - PO Box":"","Address 3 - Region":"","Address 3 - Postal Code":"","Address 3 - Country":"","Address 3 - Extended Address":"","Organization 1 - Type":"","Organization 1 - Name":"","Organization 1 - Yomi Name":"","Organization 1 - Title":"","Organization 1 - Department":"","Organization 1 - Symbol":"","Organization 1 - Location":"","Organization 1 - Job Description":"","Relation 1 - Type":"","Relation 1 - Value":"","Website 1 - Type":"","Website 1 - Value":"https://crypt.ee","Website 2 - Type":"","Website 2 - Value":"","Event 1 - Type":"","Event 1 - Value":""};
  var emptyContactsList = [newContact];
  encryptAndUploadContacts(emptyContactsList, openContacts, emptyContactsList);
}

function encryptAndUploadContacts(contactsObject, callback, callbackParam) {
  $("#import-status > .title").html("Encrypting your contacts");
  var contactsToEncrypt = JSON.stringify(contactsObject);

  openpgp.encrypt({ data: contactsToEncrypt, passwords: [theKey], armor: true }).then(function(ciphertext) {
      var encryptedContactsToUpload = JSON.stringify(ciphertext);
      $("#import-status > .title").html("Uploading your contacts");

      $('#upload-progress, #save-progress').attr("max", "0").attr("value", "100");

      var contactsUpload = contactsRef.putString(encryptedContactsToUpload);
      contactsUpload.on('state_changed', function(snapshot){
        $('#upload-progress, #save-progress').attr("max", snapshot.totalBytes);
        $('#upload-progress, #save-progress').attr("value", snapshot.bytesTransferred);
        switch (snapshot.state) { case firebase.storage.TaskState.PAUSED: break; case firebase.storage.TaskState.RUNNING: break; }

      }, function(error) {
        console.log("Upload contacts failed. Error: ", error);
        $("#import-status").removeClass("is-info is-danger is-warning is-success").addClass("is-danger");
        $("#import-status > .title").html("Error");
        $("#import-status").append("<p>Sorry, there seems to be a problem uploading your file. This is most likely a temporary problem on our end. Please try again shortly.</p>");
        handleError(error);
      }, function() {
        db.ref('/users/' + theUserID + "/data").update({"contacts" : 1});
        $("#import-status").removeClass("is-info is-danger is-warning is-success").addClass("is-success");
        $("#import-status > .title").html("Successfully uploaded your encrypted contacts.");
        setTimeout(function () {
          $("#import-status, #upload-progress, #contacts-welcome").fadeOut(250).promise().done(function() {
            callback(callbackParam);
          });
        }, 2250);
      });
  });
}

function downloadContacts() {
  $("#download-status").fadeIn(250);

  //DOWNLOAD _DOC
  contactsRef.getDownloadURL().then(function(theURL) {

    $.ajax({ url: theURL, type: 'GET',
          xhr: function() {
            var xhr = new window.XMLHttpRequest();
            xhr.addEventListener("progress", function(evt){
              if (evt.lengthComputable) {
                $('#upload-progress').attr("max", evt.total);
                $('#upload-progress').attr("value", evt.loaded);
              }
            }, false);
            return xhr;
        },
        success: function(encryptedContacts){
          decryptContacts(encryptedContacts);
        },
        error:function (xhr, ajaxOptions, thrownError){
          console.log(thrownError);
          $("#download-status").removeClass("is-info is-danger is-warning is-success").addClass("is-danger");
          $("#download-status > .title").html("Error");
          $("#download-status").append("<p>Sorry, there seems to be a problem loading your contacts. This is most likely a temporary problem on our end. Please try again shortly.</p>");
          Raven.captureException(thrownError);
        }
    });

  }).catch(function(error) {
    console.log(error);
    handleError(error);
    $("#download-status").removeClass("is-info is-danger is-warning is-success").addClass("is-danger");
    $("#download-status > .title").html("Error");
    $("#download-status").append("<p>Sorry, there seems to be a problem loading your contacts. This is most likely a temporary problem on our end. Please try again shortly.</p>");
  });
}

function decryptContacts(encryptedContacts) {
  $("#import-status, #contacts-welcome, #upload-progress, #download-status").fadeOut(250).promise().done(function() {
    $("#decrypting-status").fadeIn(250, function(){
      var encryptedContactsData = JSON.parse(encryptedContacts).data;
      openpgp.decrypt({ message: openpgp.message.readArmored(encryptedContactsData),   passwords: [theKey],  format: 'utf8' }).then(function(plaintext) {
          var decryptedText = plaintext.data;
          var contactObjects = JSON.parse(decryptedText);
          $("#decrypting-status").fadeOut(250, function() {
            openContacts(contactObjects);
          });
      });
    });
  });
}

function openContacts(contactObjects) {

    var ifItsMobile; if(isMobile) { ifItsMobile = "itsMobile"; } else { ifItsMobile = ""; }
    $("#thecontactslist").html("");
    contactsObject = contactObjects;
    $("#contacts-list, #search-bar").fadeIn(250).promise().done(function() {
      contactObjects.forEach(function(contact, index) {
        contact.index = index;
        var fml, gaf, gyayfy;
        try { fml = contact['First Name'] + " " + contact['Middle Name'] + " " + contact['Last Name']; } catch (e) {}
        try { gaf = contact['Given Name'] + " " + contact['Additional Name'] + " " + contact['Family Name']; } catch (e) {}
        try { gyayfy = contact['Given Name Yomi'] + " " + contact['Additional Name Yomi'] + " " + contact['Family Name Yomi']; } catch (e) {}

        var titleToDisplay =
            contact.Name ||
            ((!fml.includes("undefined")) && (fml.trim().length >= 1) && (fml)) ||
            ((!gaf.includes("undefined")) && (gaf.trim().length >= 1) && (gaf)) ||
            contact['Yomi Name'] ||
            ((!gyayfy.includes("undefined")) && (gyayfy.trim().length >= 1) && (gyayfy)) ||
            contact['Short Name'] ||
            contact.Company || contact['Organization 1 - Name'] || contact['Organization 1 - Yomi Name'] ||
            contact['E-mail Address'] ||
            contact['E-mail 1 - Value'] || contact['E-mail 2 - Value'] || contact['E-mail 3 - Value'] || contact['E-mail 4 - Value'];

        var contactCard = "";
        if (titleToDisplay) {
          contactCard = '<p class="notification is-white contact-card '+ ifItsMobile +'" cid="'+ index +'" contact-name="'+ titleToDisplay +'">'+ titleToDisplay +'</p>';
        } else {
          contactCard = '<p class="notification is-danger contact-card '+ ifItsMobile +'" contact-name="zzzzz-no-name">No Name, Company Name or Email</p>';
        }

        $("#thecontactslist").append(contactCard);
      });
      try {
        allFieldKeys = Object.keys(contactObjects[0]);
      } catch (e) {
        allFieldKeys = Object.keys(blankObject);
      }

      $("#contacts-status").html(contactObjects.length + " Contacts");
      db.ref('/users/' + theUserID + "/data").update({"contacts" : contactObjects.length});
      sortContacts("contact-name", prepareSearch);
    });
}

function sortContacts(sortparam, callback) {
  var contactlist = $('#thecontactslist');
	var contactCards = contactlist.children('.contact-card');

  contactCards.sort(function(a,b){
  	var an = a.getAttribute(sortparam).trim();
  	var	bn = b.getAttribute(sortparam).trim();

  	if(an > bn) {
  		return 1;
  	}
  	if(an < bn) {
  		return -1;
  	}
  	return 0;
  });

  contactCards.detach().appendTo(contactlist);
  callback();
}










///////////////////////////////////////////////////
////////////////// SEARCH /////////////////////////
///////////////////////////////////////////////////

var currentResultSelection = 0;
var searchOptions;
var searchTimeout;

function prepareSearch() {
  searchOptions = {
    shouldSort: true,
    threshold: 0.3,
    location: 0,
    distance: 100,
    maxPatternLength: 16,
    minMatchCharLength: 1,
    keys: allFieldKeys
  };
  $("#search-input").focus();
}

$("#search-input").on("keydown", function(event) {

  setTimeout(function(){
    if (event.keyCode === 27 || $("#search-input").val().trim() === "") {
      event.preventDefault();
      clearSearch();
    } else if (event.keyCode === 38) {
      event.preventDefault();
      moveSearchUp();
    } else if (event.keyCode === 40) {
      event.preventDefault();
      moveSearchDown();
    } else if (event.keyCode === 13) {
      event.preventDefault();
      if ($( ".highlightedResult" ).length > 0) {
          var cidToDisplay = $( ".highlightedResult" ).attr("cid");
          displayContact(cidToDisplay);
          $(".highlightedResult").addClass("is-dark");
          // open selection.
          //
          // var activeDID = activeDocID;
          // if ((didToLoad !== activeDID) && (typeof didToLoad != 'undefined')) {
          //   clearSearch();
          //   currentResultSelection = 0;
          //   saveDoc(loadDoc, didToLoad);
          // }
      }
    } else if ($("#search-input").val().trim().length >= 2){
      currentResultSelection = 0;
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(function(){
        //if the user is typing too fast, this allows us to slow the search down.
        search($("#search-input").val());
      }, 250);
    } else {
      $("#search-results").html("");
    }
  },50);

});

var fuse;
function search(term){
  fuse = new Fuse(contactsObject, searchOptions);
  var results = fuse.search(term).slice(0, 50);
  displaySearchResults(results);
}

function clearSearch() {
  $("#search-input").val("");
  $("#search-results").html("");
  currentResultSelection = 0;
  $("#thecontactslist").show();
  $("#contacts-status").html(contactsObject.length + " Contacts");
}

function displaySearchResults(results){
  var ifItsMobile; if(isMobile) { ifItsMobile = "itsMobile"; } else { ifItsMobile = ""; }
  $("#search-results").html("");
  $("#thecontactslist").hide();
  $("#contacts-status").html("Found " + results.length + " contact(s)");
  $.each(results, function(i, result){
    contact = result;
    var fml, gaf, gyayfy;
    try { fml = contact['First Name'] + " " + contact['Middle Name'] + " " + contact['Last Name']; } catch (e) {}
    try { gaf = contact['Given Name'] + " " + contact['Additional Name'] + " " + contact['Family Name']; } catch (e) {}
    try { gyayfy = contact['Given Name Yomi'] + " " + contact['Additional Name Yomi'] + " " + contact['Family Name Yomi']; } catch (e) {}

    var titleToDisplay =
        contact.Name ||
        ((!fml.includes("undefined")) && (fml.trim().length >= 1) && (fml)) ||
        ((!gaf.includes("undefined")) && (gaf.trim().length >= 1) && (gaf)) ||
        contact['Yomi Name'] ||
        ((!gyayfy.includes("undefined")) && (gyayfy.trim().length >= 1) && (gyayfy)) ||
        contact['Short Name'] ||
        contact.Company || contact['Organization 1 - Name'] || contact['Organization 1 - Yomi Name'] ||
        contact['E-mail Address'] ||
        contact['E-mail 1 - Value'] || contact['E-mail 2 - Value'] || contact['E-mail 3 - Value'] || contact['E-mail 4 - Value'];


    var index = contact.index;
    var contactCard = "";
    if (titleToDisplay) {
      contactCard = '<p class="notification is-white contact-card search-result '+ ifItsMobile +'" cid="'+index+'">'+ titleToDisplay +'</p>';
    } else {
      contactCard = '<p class="notification is-danger contact-card search-result '+ ifItsMobile +'" cid="'+index+'">No Name, Company Name or Email</p>';
    }
    $("#search-results").append(contactCard);
  });
}

function moveSearchUp() {
  if (currentResultSelection === 0) {
    $( ".search-result" ).first().removeClass('is-dark highlightedResult');
  } else {
    $( ".highlightedResult" ).removeClass('is-dark highlightedResult').prev().addClass('is-dark highlightedResult');
    displayContact($(".highlightedResult").attr("cid"));
    currentResultSelection--;
  }
}

function moveSearchDown() {
  if (currentResultSelection === 0) {
    $( ".search-result" ).first().addClass('is-dark highlightedResult');
    displayContact($(".highlightedResult").attr("cid"));
    currentResultSelection++;
  } else {
    $( ".highlightedResult" ).removeClass('is-dark highlightedResult').next().addClass('is-dark highlightedResult');
    displayContact($(".highlightedResult").attr("cid"));
    currentResultSelection++;
  }
}






///////////////////////////////////////////////////
////////////////// ACTIONS /////////////////////////
///////////////////////////////////////////////////

$("#contacts").on('click', '.contact-card', function(event) {
  $(".selectedContact").removeClass('is-dark selectedContact');
  $(this).addClass("is-dark selectedContact");
  displayContact($(this).attr("cid"));
});

function contactByCID(cid) {
  var theContact;
  contactsObject.forEach(function(contact) {
    if (contact.index === parseInt(cid)){
      theContact = contact;
    }
  });
  return theContact;
}

function displayContact(cid) {

  var theContact = contactByCID(cid);
  if (theContact){
    var fields = '<br><div class="button is-light add-more-info" cid="'+cid+'">+</div>';
    Object.keys(theContact).forEach(function(field){
      if (theContact[field] !== "" && field !== "index" && field !== "Group Membership" && field.indexOf("Type") === -1 && field.indexOf("Formatted") === -1) {
        fieldLabel = field.replace(" - Value", "").replace("Yomi", "(Phonetic)");
        if (field === "Notes"){
          fields = '<div class="field"><label class="label">'+ fieldLabel +'</label><p class="control"><textarea cid="'+cid+'" field="'+field+'" class="textarea detail-area" placeholder="'+ theContact[field] +'">'+theContact[field]+'</textarea></p></div>' + fields;
        } else {
          fields = '<div class="field"><label class="label">'+ fieldLabel +'</label><p class="control"><input cid="'+cid+'" field="'+field+'" class="input detail-input" type="text" value="'+theContact[field]+'" placeholder="'+ theContact[field] +'"></p></div>' + fields;
        }
      }
    });
    fields = fields + '<br><br><div class="new-fields">';
    Object.keys(theContact).forEach(function(field){
      if (theContact[field] === "") {
        fieldLabel = field.replace(" - Value", "").replace("Yomi", "(Phonetic)");
        if (field === "Notes"){
          fields = fields + '<div class="field"><label class="label">'+ fieldLabel +'</label><p class="control"><textarea cid="'+cid+'" field="'+field+'" class="textarea detail-area" placeholder="'+ theContact[field] +'">'+theContact[field]+'</textarea></p></div>';
        } else {
          fields = fields + '<div class="field"><label class="label">'+ fieldLabel +'</label><p class="control"><input cid="'+cid+'" field="'+field+'" class="input detail-input" type="text" value="'+theContact[field]+'" placeholder="'+ theContact[field] +'"></p></div>';
        }
      }
    });
    fields = fields + '</div>';
    $("#delete-contact").attr("cid", cid);
    $("#display-info, #add-contact-box").fadeOut(150, function() {
      $("#contact-display").html(fields);
      $("#contact-display, #delete-contact").fadeIn(150);
      var ww = $(window).width();
      if (ww <= 768) {
        $("#contact-details-modal").addClass("is-active");
        $("#contact-modal-close").addClass("modal-close").html('').removeClass("approveModal");
      }
    });
  }
}

$("#contact-display").on('click', '.add-more-info', function(event) {
  $(".new-fields").toggle();
});

$("#contact-display").on('keydown', '.detail-input', function(event) {
  var theinput = $(this);
  setTimeout(function(){
    if (theinput.val().trim() !== $(this).attr("placeholder")){
      var newValue = theinput.val().trim();
      var cid = theinput.attr("cid");
      var field = theinput.attr("field");

      var theContact = contactByCID(cid);
      theContact[field] = newValue;

      idleTime = 0;
      fieldChanged = true;
      $("#contacts-status").html("Changes will be saved shortly");
      $("#modal-status").html("Changes will be saved shortly");
      $("#contact-modal-close").removeClass("modal-close").html('<span class="icon"><i class="fa fa-check fa-fw fa-3" aria-hidden="true"></i></span>').addClass("approveModal");
      $("#save-progress").attr("value", 0);
    }
  },50);
});

function autosaveTimer () {
    idleTime++;
    if (idleTime > 5 && fieldChanged && !isSaving) { // 5 secs
      console.log("autosave fired");
      saveContacts();
    }
}

function saveContacts () {
  isSaving = true;
  $("#contacts-status").html("Saving changes");
  $("#modal-status").html("Saving changes");
  encryptAndUploadContacts(contactsObject, doneSaving, "Changes Saved");
}

function doneSaving(message){
  idleTime = 0;
  fieldChanged = false;
  isSaving = false;
  $("#contacts-status").html("Changes saved.");
  $("#modal-status").html("Changes saved.");
  setTimeout(function () {
    $("#contacts-status").html(contactsObject.length + " Contacts");
    db.ref('/users/' + theUserID + "/data").update({"contacts" : contactsObject.length});
  }, 2500);
}


$("#delete-contact").on('click', function(event) {
  var cid = $(this).attr("cid");
  $("#confirm-delete-contact").attr("cid", cid);
  $("#confirm-delete-contact").toggle(250);
});

$("#confirm-delete-contact").on('click', function(event) {
  var cid = $(this).attr("cid");
  deleteContact(cid);
});


function deleteContact(cid) {
  if (cid){
    $("#confirm-delete-contact, #delete-contact").fadeOut(150);
    for(var i = 0; i < contactsObject.length; i++) {
      if(contactsObject[i].index == cid) {
          contactsObject.splice(i, 1);
          break;
      }
    }
    $("#contact-display").fadeOut(250, function() {
      $("#contact-display").html("");
      $("#display-info").fadeIn(150);
      var ww = $(window).width();
      if (ww <= 768) { $("#contact-details-modal").removeClass("is-active"); }
    });
    $(".contact-card[cid='"+cid+"']").remove();

    idleTime = 0;
    fieldChanged = true;
    $("#contacts-status").html("Changes will be saved shortly");
    $("#modal-status").html("Changes will be saved shortly");
    $("#save-progress").attr("value", 0);
    db.ref('/users/' + theUserID + "/data").update({"contacts" : contactsObject.length});
  }
}


$("#add-contact-button").on('click', function(event) {
  if ($("#add-contact-box").is(":visible")) {
    hideAddContact();
  } else {
    showAddContact();
  }
});

function showAddContact() {
  $("#delete-contact, #contact-display, #display-info").fadeOut(250, function() {
    $("#add-contact-box").fadeIn(150);
    var ww = $(window).width();
    if (ww <= 768) {
      $("#contact-details-modal").addClass("is-active");
      $("#contact-modal-close").addClass("modal-close").html('').removeClass("approveModal");
    }
  });
}

function hideAddContact() {
  $("#add-contact-box").fadeOut(250, function() {
    $("#display-info").fadeIn(150);
    var ww = $(window).width();
    if (ww <= 768) { $("#contact-details-modal").removeClass("is-active"); }
  });
}

function findLargestCID() {
  var largest = 0;
  for (i = 0; i < contactsObject.length; i++) {
      if (contactsObject[i].index > largest) {
          largest = contactsObject[i].index;
      }
  }
  return largest;
}

function addContact() {
  var milliseconds = (new Date()).getTime();

  var newCName = $("#new-contact-name").val().trim() || "";
  var newCEmail = $("#new-contact-email").val().trim() || "";
  var newCPhone = $("#new-contact-phone").val().trim() || "";
  var newCOrganization = $("#new-contact-organization").val().trim() || "";
  var newCAddress = $("#new-contact-address").val().trim() || "";
  var newCWebsite = $("#new-contact-website").val().trim() || "";
  var newCNotes = $("#new-contact-notes").val().trim() || "";

  var newElementIndex = milliseconds;
  var newContact;

  newContact = {"Name":"","Given Name":"","Additional Name":"","Family Name":"","Yomi Name":"","Given Name Yomi":"","Additional Name Yomi":"","Family Name Yomi":"","Name Prefix":"","Name Suffix":"","Initials":"","Nickname":"","Short Name":"","Maiden Name":"","Birthday":"","Gender":"","Location":"","Billing Information":"","Directory Server":"","Mileage":"","Occupation":"","Hobby":"","Sensitivity":"","Priority":"","Subject":"","Notes":"","Group Membership":"","E-mail 1 - Type":"","E-mail 1 - Value":"","E-mail 2 - Type":"","E-mail 2 - Value":"","E-mail 3 - Type":"","E-mail 3 - Value":"","E-mail 4 - Type":"","E-mail 4 - Value":"","IM 1 - Type":"","IM 1 - Service":"","IM 1 - Value":"","IM 2 - Type":"","IM 2 - Service":"","IM 2 - Value":"","IM 3 - Type":"","IM 3 - Service":"","IM 3 - Value":"","Phone 1 - Type":"","Phone 1 - Value":"","Phone 2 - Type":"","Phone 2 - Value":"","Phone 3 - Type":"","Phone 3 - Value":"","Address 1 - Type":"","Address 1 - Formatted":"","Address 1 - Street":"","Address 1 - City":"","Address 1 - PO Box":"","Address 1 - Region":"","Address 1 - Postal Code":"","Address 1 - Country":"","Address 1 - Extended Address":"","Address 2 - Type":"","Address 2 - Formatted":"","Address 2 - Street":"","Address 2 - City":"","Address 2 - PO Box":"","Address 2 - Region":"","Address 2 - Postal Code":"","Address 2 - Country":"","Address 2 - Extended Address":"","Address 3 - Type":"","Address 3 - Formatted":"","Address 3 - Street":"","Address 3 - City":"","Address 3 - PO Box":"","Address 3 - Region":"","Address 3 - Postal Code":"","Address 3 - Country":"","Address 3 - Extended Address":"","Organization 1 - Type":"","Organization 1 - Name":"","Organization 1 - Yomi Name":"","Organization 1 - Title":"","Organization 1 - Department":"","Organization 1 - Symbol":"","Organization 1 - Location":"","Organization 1 - Job Description":"","Relation 1 - Type":"","Relation 1 - Value":"","Website 1 - Type":"","Website 1 - Value":"","Website 2 - Type":"","Website 2 - Value":"","Event 1 - Type":"","Event 1 - Value":""};
  newContact.Name = newCName;
  newContact["Email 1 - Value"] = newCEmail;
  newContact["Phone 1 - Value"] = newCPhone;
  newContact["Organization 1 - Name"] = newCOrganization;
  newContact["Address 1 - Formatted"] = newCAddress;
  newContact["Website 1 - Value"] = newCWebsite;
  newContact.Notes = newCNotes;
  newContact.index = newElementIndex;
  contactsObject.push(newContact);
  idleTime = 0;
  fieldChanged = true;
  $("#contacts-status").html("Changes will be saved shortly");
  $("#save-progress").attr("value", 0);
  openContacts(contactsObject);

  console.log(newContact);
  hideAddContact();
}

function exportContacts() {
  $("#contacts-status").html("Preparing CSV file for download...");
  var contactsCSV = $.csv.fromObjects(contactsObject);
  var csvstr = "data:text/csv;charset=utf-8," + encodeURIComponent(contactsCSV);
  saveAs(dataURIToBlob(csvstr), "contacts.csv");
}





///////////////////////////////////////////////////
//////////////////  UPGRADE ///////////////////////
///////////////////////////////////////////////////

$("#upgrade-button").on('click', function(event) {
  showUpgrade();
});

function showUpgrade () {
  $("#low-storage-warning").addClass("showLowStorage viaUpgradeButton");
}

////






///////////////////////////////////////////////////////////
////////////////// STORAGE HELPERS ///////////////////////
//////////////////////////////////////////////////////////

function exceededStorage(callback, callbackParam) {
  getToken();
  if (!huaExceededStorage) {
    $("#exceeded-modal").addClass("is-active");
    console.log("Storage exceeded. ", howMuchStorageLeft());
  }
}

function closeExceededStorageModal () {
  $("#exceeded-modal").removeClass("is-active");
  huaExceededStorage = true;
}

function howMuchStorageLeft() {
  if (allowedStorage > usedStorage) {
    bytesLeft = allowedStorage - usedStorage;
    storageLeft = formatBytes(bytesLeft);
    return storageLeft;
  } else {
    bytesLeft = allowedStorage - usedStorage;
    storageLeft = "-" + formatBytes(Math.abs(bytesLeft));
    return storageLeft;
  }
}

$("#low-storage-warning > .notification > .delete").on('click', function(event) {
  $("#low-storage-warning").removeClass('showLowStorage viaUpgradeButton');
  huaLowStorage = true;
});
