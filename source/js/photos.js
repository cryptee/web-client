 ////////////////////////////////////////////////////
////////////////// ALL GLOBAL VARS /////////////////
////////////////////////////////////////////////////
var firestore = firebase.firestore();
var firestoreSettings = {timestampsInSnapshots: true}; firestore.settings(firestoreSettings);
var cloudfunctions = firebase.functions();


var theKey;
var keyToRemember = JSON.parse(sessionStorage.getItem('key'));
sessionStorage.removeItem('key');

var theUser;
var theUserID;
var theUsername;
var theToken;

var rootRef, dataRef, titlesRef;
var connectedRef = firebase.database().ref(".info/connected");

var reauthenticated = false;
var retokening = false;
var connected = false;
var upOrDownInProgress = false;

var activeFID = "home";

var activePID = "";
var activePName = "";

var bootOfflineTimer = setInterval(function() { if(!$("#key-modal").hasClass("is-active")) { showBootOffline(); } }, 4000);
var thumbnailGenerator;
var homeLoaded = false;

var numberOfItemsPerSection = 50;
if (isMobile) {
  numberOfItemsPerSection = 25;
}

var lastActivityTime = (new Date()).getTime();
var inactivityInterval = setInterval(inactiveTimer, 1000);


////////////////////////////////////////////////////
///////////////////    HOTKEYS    //////////////////
////////////////////////////////////////////////////



key('command+A, ctrl+A', function(){
  if (!$("input").is(":focus")) {
    selectAll(); return false;
  }
  lastActivityTime = (new Date()).getTime();
});

key('esc', function(){
  if (!$(".modal").hasClass("is-active")) {
    if (Object.keys(selectionsObject).length > 0)  {
      clearSelections();
    }
  } else {
    hideActiveModal();
  }
  closeLightbox();
  lastActivityTime = (new Date()).getTime();
});

key('right', function(){
  if ($("#lightbox-modal").hasClass("is-active")) {
    showNextPhoto();
  }
  lastActivityTime = (new Date()).getTime();
});

key('left', function(){
  if ($("#lightbox-modal").hasClass("is-active")) {
    showPrevPhoto();
  }
  lastActivityTime = (new Date()).getTime();
});



////////////////////////////////////////////////////
////////////// FIRESTORE BATCH DELETE //////////////
////////////////////////////////////////////////////

function deleteCollection (collectionRef) {
  var query = collectionRef.orderBy('__name__').limit(10);
  return new Promise(function(resolve, reject) {
    deleteQueryBatch(query, resolve, reject);
  });
}

function deleteQueryBatch (query, resolve, reject) {
  query.get().then(function(snapshot) {
    if (snapshot.size == 0) { return 0; }
    var batch = firestore.batch();
    snapshot.docs.forEach(function(doc) { batch.delete(doc.ref); });
    return batch.commit().then(function() { return snapshot.size; });
  }).then(function(numDeleted) {
    if (numDeleted === 0) { resolve(); return; }
    process.nextTick(function() { deleteQueryBatch(query, resolve, reject); });
  }).catch(reject);
}



////////////////////////////////////////////////////
/////////////////// STATUS DISPLAY //////////////////
////////////////////////////////////////////////////

function showProgress (status) {
  $("#status").html(status);
  $(".loading-message").stop(true, true).fadeIn(100);
}

function hideProgress (callback) {
  callback = callback || noop;
  $(".loading-message").stop(true, true).fadeOut(100, function() {
    callback();
  });
}










////////////////////////////////////////////////////////
/////////////////// CONNECTION STATUS  /////////////////
////////////////////////////////////////////////////////

function connectionStatus (status) {
  connected = status; // boolean, true if connected
  if (status === true) {
    clearInterval(bootOfflineTimer);
    hideBootOffline();
  } else {
    if (!theKey || theKey === undefined || theKey === null || theKey === "") {
      showBootOffline();
    }
  }
}

function showBootOffline () {
  $(".photos-offline").fadeIn(250);
  $("#folder-contents").removeClass("is-loading");
}

function hideBootOffline () {
  $(".photos-offline").fadeOut(250);
}










////////////////////////////////////////////////////////
/////////////////////// IDLE TIMER  ////////////////////
////////////////////////////////////////////////////////

function inactiveTimer () {
  var now = (new Date()).getTime();

  // 30minutes
  if (now - lastActivityTime > 1800000) {
    inactivityTimeout();
  }

}

$(window).on("click", function(){
  lastActivityTime = (new Date()).getTime();
});





////////////////////////////////////////////////////
/////////////////// WINDOW EVENTS //////////////////
////////////////////////////////////////////////////

$(window).on("load", function(event) {
  if ($(window).width() > 768) {
    loadKeyModalBackground();
  } else {
    $(".modal-img-credit").hide();
  }

  if (isInWebAppiOS) {
    // $("#upload-progress, #active-doc-contents, #file-viewer").addClass("iosPinned");
  }
});

// Enable navigation prompt
window.onbeforeunload = function() {
  if (upOrDownInProgress) {
    return true;
  }
};


/////////////////////////////////////////////////////////////////
/////////////////// STICKY NAVBAR & PRELOADER ///////////////////
/////////////////////////////////////////////////////////////////
var observer;

if (isMobile) {
  observer = new IntersectionObserver(onEntryAndExit, { rootMargin: "200% 0% 200% 0%", threshold: [0.15] } );
} else {
  observer = new IntersectionObserver(onEntryAndExit, { rootMargin: "400% 0% 400% 0%", threshold: [0.15] } );
}

var navbar = document.getElementById("photos-top-nav");
var oneRem = parseFloat(getComputedStyle(document.documentElement).fontSize);
var sticky = navbar.offsetTop - ( oneRem / 4 );

$(window).on('scroll', throttleScroll(function(event) {
// $(window).on('scroll', function(event) {
  if (Math.max($(window).scrollTop(), $("body").scrollTop(), document.body.scrollTop) >= sticky) {
    navbar.classList.add("sticky");
  } else {
    navbar.classList.remove("sticky");
  }
// });

  lastActivityTime = (new Date()).getTime();
}, 100));



////////////////////////////////////////////////////
//////////////////// LAYOUT STUFF //////////////////
////////////////////////////////////////////////////

$("#photos-sort-button").on('click', function(event) {
  if ($(this).find("i").hasClass("fa-sort-alpha-desc")) {
    $(this).find("i").removeClass("fa-sort-alpha-desc").addClass("fa-sort-alpha-asc");
    sortByTitle(true);
  } else {
    $(this).find("i").addClass("fa-sort-alpha-desc").removeClass("fa-sort-alpha-asc");
    sortByTitle();
  }
});

function sortByTitle (reverse){
  reverse = reverse || false;
  if (reverse) {
    $('.folder-content').sort(function(a, b) {
      if ($(a).attr("name") > $(b).attr("name")) {
        return -1;
      } else {
        return 1;
      }
    }).appendTo('#folder-contents');
  } else {
    $('.folder-content').sort(function(a, b) {
      if ($(a).attr("name") < $(b).attr("name")) {
        return -1;
      } else {
        return 1;
      }
    }).appendTo('#folder-contents');
  }

  $("#folder-contents").removeClass("is-loading");
}


////////////////////////////////////////////////////
////////////////// SIGN IN AND KEY /////////////////
////////////////////////////////////////////////////

function getToken () {
  if (!retokening) {
    retokening = true;
    firebase.auth().currentUser.getIdToken(true).then(function(idToken) {

      $.ajax({
        url: tokenURL,
        type: 'POST',
        headers: {
          "Authorization": "Bearer " + idToken
        },
        contentType: "application/json; charset=utf-8",
        success: function(data) {
          gotToken(data);
        },
        error: function(xhr, ajaxOptions, thrownError) {
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

function gotToken (tokenData) {
  var token = tokenData;
  firebase.auth().signInWithCustomToken(token).then(function(){
    retokening = false;
  }).catch(function(error) {
    if (error.code !== "auth/network-request-failed") {
      handleError(error);
    }
    // TODO CREATE SOME SORT OF ERROR HANDLING MECHANISM FOR TOKEN-SIGNIN ERRORS
    setTimeout(function() {
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

      rootRef = store.ref().child('/users/' + theUserID);
      dataRef = db.ref().child('/users/' + theUserID + "/data/");
      metaRef = db.ref().child('/users/' + theUserID + "/meta/");
      homeRef = firestore.collection("users").doc(theUserID).collection("photos");
      titlesRef = firestore.collection("users").doc(theUserID).collection("titles");

      Raven.setUserContext({ id: theUserID });

      $('.username').html(theUsername);
      $(".photos-search").animate({opacity: 1}, 500);

      checkForExistingUser(function(){
        if (keyToRemember) {
          checkKey();
        } else {
          showKeyModal();
        }
      });
    }

    getToken();
    webAppURLController();
  } else {
    // no user. redirect to sign in IF NOT WEBAPP
    webAppURLController("signin.html?redirect=photos");
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

function checkKey (key) {
  db.ref('/users/' + theUserID + "/data/keycheck").once('value').then(function(snapshot) {
    var encryptedStrongKey = JSON.parse(snapshot.val()).data; // or encrypted checkstring for legacy accounts
    var hashedKey;
    if (key) {
      hashedKey = hashString(key);
    } else {
      hashedKey = keyToRemember;
    }
    openpgp.decrypt({ message: openpgp.message.readArmored(encryptedStrongKey), passwords: [hashedKey],  format: 'utf8' }).then(function(plaintext) {
        rightKey(plaintext, hashedKey);
    }).catch(function(error) {
        checkLegacyKey(dataRef, key, hashedKey, encryptedStrongKey, function(plaintext){
          rightKey(plaintext, hashedKey);
          // if it's wrong, wrongKey() will be called in checkLegacyKey in main.js
        });
    });
  });
}

function rightKey (plaintext, hashedKey) {
  var theStrongKey = plaintext.data;
  hideKeyModal();
  theKey = theStrongKey;
  keyToRemember = hashedKey;
  signInComplete();
}

function wrongKey (error) {
  console.log("wrong key or ", error);
  sessionStorage.removeItem('key');
  showKeyModal();
  $('#key-status').html("Wrong key, please try again.");
}


function keyModalApproved () {
  $('#key-status').html("Checking key");
  var key = $('#key-input').val();
  checkKey(key);
}

$("#key-input").on('keydown', function(e) {
  setTimeout(function(){
    lastActivityTime = (new Date()).getTime();
    if (e.keyCode == 13) {
      keyModalApproved();
    }
  },50);
});











////////////////////////////////////////////////////
/////////////////// SIGN IN COMPLETE ///////////////
////////////////////////////////////////////////////


function signInComplete () {

  connectedRef.on("value", function(snap) {
    connectionStatus(snap.val());
  });

  metaRef.on('value', function(userMeta) {
    allowedStorage = userMeta.val().allowedStorage || freeUserQuotaInBytes;
    usedStorage = userMeta.val().usedStorage || 0;

    if (userMeta.val().hasOwnProperty("plan") && userMeta.val().plan !== "") {
      // paid user remove upgrade button
      $("#upgrade-button").parents("li").hide();
      $("#low-storage-warning").removeClass('showLowStorage viaUpgradeButton');
      closeExceededStorageModal();
      if (usedStorage >= allowedStorage) {
        showBumpUpThePlan(true);
      } else if ((usedStorage >= allowedStorage * 0.8) && !huaLowStorage) {
        showBumpUpThePlan(false);
      } else if (usedStorage <= (allowedStorage - 13000000000)) {
        // this is 13GB because if user has 20GB, and using 7GB we'll downgrade to 10GB plan.
        bumpDownThePlan();
      }
    } else {

      if (usedStorage >= allowedStorage) {
        $(".exceeded-storage").html(formatBytes(usedStorage + 100000 - allowedStorage));
        exceededStorage();
      } else if ((usedStorage >= allowedStorage * 0.8) && !huaLowStorage) {
        $("#low-storage-warning").addClass('showLowStorage');
      }
      if (allowedStorage > freeUserQuotaInBytes) {
        $("#upgrade-button").parents("li").hide();
      }
    }

    saveUserDetailsToLS(theUsername, usedStorage, allowedStorage);
  });

  if (getUrlParameter("p")) {
    loadPhoto(getUrlParameter("p"), "", "display");
    getHomeFolder();
  } else if (getUrlParameter("f")) {
    getAllFilesOfFolder(getUrlParameter("f"));
  } else {
    getHomeFolder();
  }
  didAnyTitlesObjectChange = true;
}







////////////////////////////////////////////////////
////////// AUTOMATIC REPAIRS & FIXES ///////////////
////////////////////////////////////////////////////

function fixFilesAndFolders (callback, callbackParam) {
  callback = callback || noop;
  var homePhotosArray = [];
  var homeFoldersArray = [];
  var titlesArray = [];

  homeRef.get().then(function(items) {
    if (items.docs.length > 0) {

      if (items.docs.length === 1 && items.docs[0].id === "home") {
        // HOME never gets adjustFolderCount, so might return length = 1 sometimes due to falsely getting pinky or thumb.
        callback(callbackParam);
      } else {
        items.docs.forEach(function(item) {
          if (item.data().id) {
            if (item.data().id.startsWith('p-')) {
              homePhotosArray.push(item.data().id);
            } else if (item.data().id.startsWith('f-')) {
              homeFoldersArray.push(item.data().id);
            }
          } else {
            // CHANCES ARE THIS IS A FUCKED UP FOLDER. CHECK IF IT HAS PINKY NULL & THUMB NULL. IF YES, DELETE.
            if (item.data().pinky === null && item.data().thumb === null) {
              var itemID = item.id;
              homeRef.doc(itemID).delete();
              console.log("Deleted corrupted item refernce with id:", itemID);
            }
          }
        });

        titlesRef.get().then(function(items) {
          items.docs.forEach(function(item) {
            if (item.id && item.id !== "home") {
              titlesArray.push(item.id);
            }
          });

          compareArrays(homeFoldersArray, homePhotosArray, titlesArray, callback, callbackParam);
        }).catch(function(error) {
          // titles seem empty. odd.
          callback(callbackParam);
        });
      }

    } else {
      // home seems empty. odd.
      callback(callbackParam);
    }
  });
}

function compareArrays (homeFoldersArray, homePhotosArray, titlesArray, callback, callbackParam) {
  callback = callback || noop;

  var homeExtraFIDs = homeFoldersArray.filter( function( el ) {
    return titlesArray.indexOf( el ) < 0;
  });

  var titlesExtraFIDs = titlesArray.filter( function( el ) {
    return homeFoldersArray.indexOf( el ) < 0;
  });

  removeExtrasTitleObjects (titlesExtraFIDs, callback, callbackParam);
}

function removeExtrasTitleObjects (titleObjectsToDelete, callback, callbackParam) {
  callback = callback || noop;
  if (titleObjectsToDelete.length > 0) {
    titleObjectsToDelete.forEach(function(fid){
      titlesRef.doc(fid).delete().then(function(){
        callback(callbackParam);
      });
    });
  } else {
    callback(callbackParam);
  }
}










function fixFile (pidOrTid) {

  doesTheOriginalExist(pidOrTid.replace("t","p"), function(originalLost){
    if (originalLost) {
      // ORIGINAL FILE LOST. DELETE BOTH THUMB AND ORIGINAL.
      sadlyPurgeFile(pidOrTid);
    } else {
      // ORIGINAL FILE EXISTS
      doesTheOriginalExist(pidOrTid.replace("t","p"), function(thumbLost){
        if (thumbLost) {
          // REGENERATE THUMBNAIL.
        } else {
          // WTF. ALL IS GOOD. SOMETHING'S OFF.
        }
      });
    }
  });
}

function doesTheOriginalExist(pid, callback) {
  var fileRef = rootRef.child(pid.replace("t","p") + ".crypteefile");
  fileRef.getDownloadURL().then(function(url) {
      // just to check if it exists. not really going to use it.
      originalLost = false;
      callback(originalLost);
  }).catch(function(error) {
    if (error.code === 'storage/object-not-found') {
      originalLost = true;
      callback(originalLost);
    }
  });
}

function doesTheThumbnailExist(tid, callback) {
  var fileRef = rootRef.child(tid.replace("t","p") + ".crypteefile");
  fileRef.getDownloadURL().then(function(url) {
      // just to check if it exists. not really going to use it.
      thumbLost = false;
      callback(thumbLost);
  }).catch(function(error) {
    if (error.code === 'storage/object-not-found') {
      thumbLost = true;
      callback(thumbLost);
    }
  });
}

function sadlyPurgeFile(pidOrTid) {

  getFolderThumbnail(activeFID, function(thumb){
    var isFolderThumbDeleted = false;
    var pid = pidOrTid.replace("t", "p");

    var whereFrom;
    if (activeFID === "home") {
      whereFrom = homeRef.doc(pid);
    } else {
      whereFrom = homeRef.doc(activeFID).collection(activeFID).doc(pid);
    }

    try {
      if (pid === thumb.replace("t-", "p-")) { isFolderThumbDeleted = true; }
    } catch (e) {
      isFolderThumbDeleted = false;
    }

    var tid = pid.replace("p", "t");
    var lid = pid.replace("p", "l");
    var photoRef = rootRef.child(pid + ".crypteefile");
    var thumbRef = rootRef.child(tid + ".crypteefile");
    var lightRef = rootRef.child(lid + ".crypteefile");

    photoRef.delete().then(function() {
      thumbRef.delete().then(function() {
        lightRef.delete().then(function() {
          whereFrom.delete().then(function() {
            if (activeFID !== "home") {
              var adjustmentCount = 0 - Object.keys(selectionsObject).length;
              adjustFolderCount (activeFID, adjustmentCount, isFolderThumbDeleted);
            }
            $("#"+pid).remove();
            delete activeItemsObject[pid];
            updateTitles();
          });
        });
      });
    }).catch(function(error) {
      if (error.code === "storage/object-not-found") {
        thumbRef.delete();
        whereFrom.delete();
        lightRef.delete();
        if (activeFID !== "home") {
          var adjustmentCount = 0 - Object.keys(selectionsObject).length;
          adjustFolderCount (activeFID, adjustmentCount, isFolderThumbDeleted);
        }
        $("#"+pid).remove();
        delete activeItemsObject[pid];
        updateTitles();
      } else {
        handleError(error);
        $("#photos-delete-selections-modal").find(".button.is-success").removeClass("is-loading").prop("disabled", false).attr("disabled", false);
        $(".delete-selections-status").removeClass("is-light is-warning is-danger").addClass("is-danger").html("<p class='title'>Error Deleting Doc... Sorry.. Please Reload the page.</p>");
      }
    });

  });

}


////////////////////////////////////////////////////
//////////////////// FIRESTORE CRUD ////////////////
////////////////////////////////////////////////////

$("#get-home-folder-button").on('click', function(event) {
  event.preventDefault();
  if (activeFID !== "home") {
    getHomeFolder();
  }
});

// homeRef.get() gets called twice for some reason. hardwiring a logic to stop this.
var homeFolderLoaded = false;
function getHomeFolder (callback, callbackParam) {
  callback = callback || noop;
  if (homeRef) {

    clearSelections();
    $("#folder-contents").addClass("is-loading");
    $("body, html").animate({ scrollTop: "0px" }, 250, function(){
      homeRef.get().then(function(items) {
        if (!homeFolderLoaded) {
          history.replaceState("home", null, '/photos');
          $("#photos-new-folder-button, #photos-get-ghost-folder-button").removeClass("unavailable");
          $("#get-home-folder-button").addClass("unavailable");
          processItemsFromFirestore("home", items, callback, callbackParam);
          homeFolderLoaded = true; otherFolderLoaded = false;
        }
      });
    });
    lastActivityTime = (new Date()).getTime();
  }
}

// homeRef.get() gets called twice for some reason. hardwiring a logic to stop this.
var otherFolderLoaded = false;
function getAllFilesOfFolder (fid, callback, callbackParam) {
  callback = callback || noop;
  // if (activeFID !== fid) {

  clearSelections();
  $("#folder-contents").addClass("is-loading");
  $("body, html").animate({ scrollTop: "0px" }, 250, function(){
    homeRef.doc(fid).collection(fid).get().then(function(items) {
      if (!otherFolderLoaded) {
        history.pushState(fid, null, '/photos?f='+fid);
        $("#get-home-folder-button").removeClass("unavailable");
        $("#photos-new-folder-button, #photos-get-ghost-folder-button").addClass("unavailable");
        processItemsFromFirestore(fid, items, callback, callbackParam);
        homeFolderLoaded = false; otherFolderLoaded = true;
      }
    });
  });
  lastActivityTime = (new Date()).getTime();
  // }
}


function processItemsFromFirestore (fid, items, callback, callbackParam) {
  callback = callback || noop;
  $("#folder-contents").html("");

  // clear old global object (referenced in appendfolde r & appendPhot o & getTitles)
  activeItemsObject = {};

  activeFID = fid;
  var contents = items.docs;

  if (contents.length > 0) {
    hideEmptyFolderDialog(function(){
      if (contents.length === 1 && contents[0].id === "home") {
        // HOME never gets adjustFolderCount, so might return length = 1 sometimes due to falsely getting pinky or thumb.
        showEmptyFolderDialog();
        $("#folder-contents").removeClass("is-loading");
      } else {

        getTitles(fid, contents, function(){
          $("#photos-sort-button").find("i").addClass("fa-sort-alpha-desc").removeClass("fa-sort-alpha-asc");
          $("#folder-contents").removeClass("is-loading");
          callback(callbackParam);
        });

      }
    });
  } else {
    $("#folder-contents").removeClass("is-loading");
    showEmptyFolderDialog();
    clearFolderThumbnail(fid);
  }

  hanselAndGretel();

}

$("#photos-new-folder-title-input").on('keydown', function (e) {
  setTimeout(function(){
    var newFTitle = $("#photos-new-folder-title-input").val().trim();
    if (e.keyCode === 13 && newFTitle !== "") {
      newFolder(newFTitle);
    } else if (e.keyCode === 27) {
      hideActiveModal();
    } else {
      //
    }
  },50);
});

function newFolder (newFTitle, preassignedFID, callback, callbackParam) {
  callback = callback || noop;
  newFTitle = newFTitle || $("#photos-new-folder-title-input").val().trim();
  if (newFTitle !== "") {
    progressModal("photos-new-folder-modal");
    var uuid = newUUID();
    var fid = preassignedFID || "f-" + uuid;
    var folderObject = {"count" : 0, "id" : fid };
    homeRef.doc(fid).set(folderObject, {
      merge: true
    }).then(function(response) {
      var titlesObject = {}; titlesObject.self = newFTitle;
      encryptAndUploadTitles (titlesObject, fid, function(){

        activeItemsObject[fid] = {};
        activeItemsObject[fid].title = newFTitle;
        activeItemsObject[fid].pinky = null;
        activeItemsObject[fid].count = 0;
        activeItemsObject[fid].thumb = null;

        hideEmptyFolderDialog();
        folderCreated(fid, 0, newFTitle, function(){
          callback(callbackParam);
          sortByTitle();
        });
      });
    }).catch(function(error) {
      console.error("Error creating new folder: ", error);
    });
  }
}


///////////////////////////////////////////////////
////////////////// FILE UPLOAD ////////////////////
///////////////////////////////////////////////////

function showFileUploadStatus(color, message) {
  $("#photos-upload-progress").attr("value", "0");
  $(".upload-status-message").html(message);
  if(color === "is-danger") { $("body").removeClass("disable-clicks"); }
  $("#upload-status").removeClass("is-dark is-light is-warning is-danger is-success").addClass(color);
  $("#photos-upload-status").addClass("is-active");
}

function hideFileUploadStatus() {
  $("body").removeClass("disable-clicks");
  $("#upload-status").removeClass("is-dark is-light is-warning is-danger is-success").addClass("is-warning");
  $("#photos-upload-status").removeClass("is-active");
  $("#upload-status-contents").html("");
}

window.addEventListener('dragenter', handleDragEnter, false);
window.addEventListener('dragend', handleDragEnd, false);
window.addEventListener('dragleave', handleDragLeave, false);
window.addEventListener('dragover', handleDragOver, false);
window.addEventListener('drop', handlePhotosDrop, false);

document.getElementById('upload-photo-to-folder').addEventListener('change', handlePhotoSelect, false);


var dragCounter = 0;
var numFilesLeftToBeUploaded = 0;
var numFilesUploaded = 0;

var fileTreeToUpload = {};
fileTreeToUpload.thecrypteehomefolder = {};
fileTreeToUpload.thecrypteehomefolder.files = []; // this is intentionally super long and awkward to prevent potential conflicts.

function isAPIAvailable() {
  // Check for the various File API support.
  if (window.File && window.FileReader && window.FileList && window.Blob) {
    // Great success! All the File APIs are supported.
    return true;
  } else {
    return false;
  }
}

function traverseFileTree(entry, path, entryname) {
  var isRoot = true;
  var isItJustAFile = false;
  if (path !== '/') { isRoot = false; }

  entryname = entryname || "";
  path = (path + entryname + '/') || "";

  // if path is STILL just a forward slash, this means it's just files dragged in.
  if (path === '/') { isItJustAFile = true; }

  return new Promise(function (resolve, reject) {
    if (entry.isFile) {
      entry.file(function(file) {
        var fileObj = {
          size : file.size,
          name : file.name,
          type : file.type,
          file : file,
          path : path,
          root : isRoot
        };
        if (isItJustAFile) {
          addItemToFileTree(fileObj);
        }
        resolve([fileObj]);
      });
    } else if (entry.isDirectory) {
      var filesOfDir = [];
      var dirReader = entry.createReader();
      var readEntries = function () {
        dirReader.readEntries(function (entries) {
          var forEach = function(i) {
            if ((!entries[i] && i === 0) || (this.maximum > 0 && filesOfDir.length >= this.maximum)) {
              // THIS GETS CALLED FOR EVERY ROOT & SUB-FOLDER
              // WHICH MEANS WE GET REPEAT RESULTS FOR FILES FROM SUB-FOLDERS,
              // IF FILE A IS IN A SUB FOLDER, WE WILL GET IT IN BOTH ROOT AND SUB.
              // TO PREVENT THIS WE ONLY SUBMIT THE filesOfDir Array to CreateFileTree once we know it's ROOT.
              // and this should prevent duplicates.

              var isItRoot = false;
              filesOfDir.forEach(function(item, index){
                if (item.root) { isItRoot = true; }
              });
              if (isItRoot) {
                filesOfDir.forEach(function(item, index){
                  addItemToFileTree(item);
                });
              }

              return resolve(filesOfDir);
            }
            if (!entries[i]) {
              return readEntries();
            }
            this.traverseFileTree(entries[i], path, entry.name).then(function (results) {
              filesOfDir.push.apply(filesOfDir, results);
              forEach(i + 1);
            });
          };
          forEach(0);
        });
      };
      readEntries();
    } else {
      resolve([]);
    }
  });
}

function addItemToFileTree (item) {
  var fileExt = extensionFromFilename(item.name);
  if (item.name !== ".DS_Store" && item.name !== "desktop.ini" && item.name !== "Icon") {
    if (fileExt.match(/^(jpg|jpeg|png)$/i)) {
      createFileTree(item.path, item.file);
    } else {
      fileUploadError = true;
      var uploadElem =
      '<div class="upload" id="upload-'+item.name+'-'+item.size+'">'+
        '<progress class="progress is-small is-danger" value="100" max="100"></progress>'+
        '<p class="deets fn">'+item.name+'</p>'+
        '<p class="deets fs">(Unsupported)</p>'+
      '</div>';
      $("#upload-status-contents").append(uploadElem);
    }
  }
}

function createFileTree(path, file) {
  if (path.trim() !== "" && path !== "/") {
    if (path.indexOf("/") !== -1){
      var folderPath = path.replace(/\/$/, "").replace(/\//, "").replace(/\//g, " - ").trim();
      fileTreeToUpload[folderPath] = fileTreeToUpload[folderPath] || {};
      fileTreeToUpload[folderPath].files = fileTreeToUpload[folderPath].files || [];

      fileTreeToUpload[folderPath].files.push({
        "file" : file,
        "pid" : ("p-" + newUUID())
      });

      fileTreeToUpload[folderPath].fid = "f-" + newUUID();

      fileTreeToUpload[folderPath].fname = folderPath;

      numFilesLeftToBeUploaded++;
      document.title = "Cryptee | Uploading " + numFilesLeftToBeUploaded + " photo(s)";
    }
  } else {
    fileTreeToUpload.thecrypteehomefolder.files.push({
      "file" : file,
      "pid" : ("p-" + newUUID())
    });
    numFilesLeftToBeUploaded++;
    document.title = "Cryptee | Uploading " + numFilesLeftToBeUploaded + " photo(s)";
  }

  var processingMessage = "Processing <b>" + numFilesLeftToBeUploaded.toString() + "</b> file(s).<br><br> Please don't navigate away from this page, or close the window.";
  showFileUploadStatus("is-warning", processingMessage);
  checkUploadQueue();
}

var queueTimeout;
function checkUploadQueue() {
  clearTimeout(queueTimeout);
  queueTimeout = setTimeout(function () {
    startUploadQueue();
  }, 100);
}

function startUploadQueue() {
  var loadHomeFirst = false;
  if (Object.keys(fileTreeToUpload).length <= 1) {
    //NO EXTRA FOLDERS. UPLOAD GOING INTO THE SAME FOLDER.
    loadHomeFirst = false;
  } else {
    //THERE ARE FOLDERS. LOAD HOME FIRST
    loadHomeFirst = true;
  }

  if (activeFID !== "home" && loadHomeFirst) {
    // GET HOME AND UPLOAD ALL THE FILES TO HOME FIRST.
    // IN A LOOP. THIS WILL UPLOAD EVERYTHING TO HOME AND UPDATETITLES ONCE ALL UPDATES ARE COMPLETE.
    getHomeFolder(function(){
      processUploadTree();
    });
  } else {
    processUploadTree();
  }
}


var folderCreationQueueTimeout;
function processUploadTree (callback, callbackParam) {
  callback = callback || noop;
  $.each(fileTreeToUpload, function(folderPath, folderItem) {
    if (folderItem.files !== undefined) {
      folderItem.files.forEach(function(fileItem) {
        queueUpload(fileItem.file, activeFID, fileItem.pid, function(){
        // processPhotoForUpload(fileItem.file, activeFID, fileItem.pid, function(){
          // ALL FILES UPLOADED.
          // ALL THE FILES UPLOADED TO HOME.
          // UPDATETITLES AUTO CALLED ONCE ALL UPDATES ARE COMPLETE.

          if (Object.keys(fileTreeToUpload).length > 1) {
            showFileUploadStatus("is-info", "Creating albums.");
            var tempFoldersArray = Object.keys(fileTreeToUpload);
            tempFoldersArray.forEach(function(fname) {
              if (fname !== "thecrypteehomefolder") {
                newFolder(fname, fileTreeToUpload[fname].fid, function(){
                  clearTimeout(folderCreationQueueTimeout);
                  folderCreationQueueTimeout = setTimeout(function () {
                    // ALL FOLDERS CREATED.
                    showFileUploadStatus("is-info", "Organizing photos and albums.");
                    prepareToMoveUploadsToWhereTheyBelong();
                  }, 1000);
                });
              }
            });
          } else {
            updateTitles(function(){
              batchUploadComplete(false);
            });
          }

        });
      });
    }
  });
}


function prepareToMoveUploadsToWhereTheyBelong() {
  updateTitles(function(){

    var uploadedFoldersAndPIDs = [];

    $.each(fileTreeToUpload, function(folderPath, folderItem) {
      if (folderItem.files !== undefined && folderPath !== "thecrypteehomefolder") {

        var fidToMove = folderItem.fid;
        var arrayOfPIDsToMove = [];

        // ARTIFICIALLY SELECT ALL THE FILES THAT WILL NEED TO GO INTO FOLDERS BASED ON THEIR DESTINATION FID
        // MOVE FILE REFERENCES TO FOLDERS.

        folderItem.files.forEach(function(fileItem) {
          var pid = fileItem.pid;
          arrayOfPIDsToMove.push(pid);
        });

        uploadedFoldersAndPIDs.push({fid: fidToMove, pids : arrayOfPIDsToMove});

      }
    });

    cycleThroughUploadedFoldersAndPIDs(uploadedFoldersAndPIDs, 0);

  });
}

function cycleThroughUploadedFoldersAndPIDs(moveOperations, i) {

  moveSelectionsToFolder(moveOperations[i].pids, moveOperations[i].fid, 0, false, function(){
    i++;
    if (i === moveOperations.length) {
      // DONE MOVING FILES TO FOLDERS.
      // ALL UPLOADS ARE COMPLETE, SHOW SUCCESS MESSAGE.
      updateTitles(function(){
        batchUploadComplete(true);
      });
    } else {
      cycleThroughUploadedFoldersAndPIDs(moveOperations, i);
    }
  });

}

function batchUploadComplete(hasFolders) {
  homeFolderLoaded = false; otherFolderLoaded = false;

  if (activeFID !== "home") {
    getAllFilesOfFolder(activeFID, function(){
      if (!fileUploadError) {
        hideFileUploadStatus();
      } else {
        showFileUploadStatus("is-danger", "Done uploading, but some of your files were not uploaded.<br><br><a class='button is-light' onclick='hideFileUploadStatus();'>Close</b>");
      }
      fileTreeToUpload = {};
      fileTreeToUpload.thecrypteehomefolder = {};
      fileTreeToUpload.thecrypteehomefolder.files = [];
    });
  } else {
    getHomeFolder(function(){
      if (!fileUploadError) {
        hideFileUploadStatus();
      } else {
        showFileUploadStatus("is-danger", "Done uploading, but some of your files were not uploaded.<br><br><a class='button is-light' onclick='hideFileUploadStatus();'>Close</b>");
      }
      fileTreeToUpload = {};
      fileTreeToUpload.thecrypteehomefolder = {};
      fileTreeToUpload.thecrypteehomefolder.files = [];
    });
  }
}




function handlePhotoSelect(evt) {
  evt.stopPropagation();
  evt.preventDefault();

  dragCounter = 0;
  somethingDropped = true;

  var targetfid = activeFID;

  if (isAPIAvailable()) {
    var files = evt.target.files;

    fileUploadError = false;

    for (var i = 0; i < files.length; i++) {
      var uuid = "p-" + newUUID();
      queueUpload(files[i], targetfid, uuid);
      numFilesLeftToBeUploaded++;
      document.title = "Cryptee | Uploading " + numFilesLeftToBeUploaded + " photo(s)";
      // numFilesUploading++;
    }

    if (numFilesLeftToBeUploaded > 0) {
      var processingMessage = "Processing <b>" + numFilesLeftToBeUploaded.toString() + "</b> file(s)";
      showFileUploadStatus("is-warning", processingMessage);
    }

  } else {
    setTimeout(function () {
      showFileUploadStatus("is-danger", "Unfortunately your browser or device does not support File API, which is what allows us to encrypt files on your device. Therefore we can't upload your file.");
    }, 10000);
  }

}

function handlePhotosDrop (evt) {
  evt.stopPropagation();
  evt.preventDefault();
  $("#photos-drag-overlay").removeClass("shown");
  dragCounter = 0;
  somethingDropped = true;

  var targetfid = activeFID;

  if (isAPIAvailable()) {

    var items;
    fileUploadError = false;

    if (canUploadFolders) {
      items = evt.dataTransfer.items;
      for (var j=0; j<items.length; j++) {
        var item = items[j].webkitGetAsEntry();
        if (item) { traverseFileTree(item, ''); }
      }
    } else {
      items = evt.dataTransfer.files;
      for (var i = 0; i < items.length; i++) {
        var uuid = "p-" + newUUID();
        queueUpload(items[i], targetfid, uuid);
        // processPhotoForUpload(items[i], targetfid, uuid);
        numFilesLeftToBeUploaded++;
        document.title = "Cryptee | Uploading " + numFilesLeftToBeUploaded + " photo(s)";
      }
    }

    if (numFilesLeftToBeUploaded > 0) {
      var processingMessage = "Processing <b>" + numFilesLeftToBeUploaded.toString() + "</b> file(s)";
      showFileUploadStatus("is-warning", processingMessage);
    }

  } else {
    setTimeout(function () {
      showFileUploadStatus("is-danger", "Unfortunately your browser or device does not support File API, which is what allows us to encrypt files on your device. Therefore we can't upload your file.");
    }, 10000);
  }
}

function handleDragEnter(evt) {
  if (dragCounter === 0) {
    // DRAG ENTERING DO SOMETHING ONCE
    $("#photos-drag-overlay").addClass("shown");
  }

  dragCounter++;

  evt.stopPropagation();
  evt.preventDefault();
}

function handleDragLeave(evt) {
  dragCounter--;
  if (dragCounter === 0) {
    // DRAG LEFT DO SOMETHING ONCE
    $("#photos-drag-overlay").removeClass("shown");
  }
  evt.stopPropagation();
  evt.preventDefault();
}


function handleDragEnd(evt) {
  evt.stopPropagation();
  evt.preventDefault();
  $("#photos-drag-overlay").removeClass("shown");
}

function handleDragOver(evt) {
  evt.stopPropagation();
  evt.preventDefault();
  evt.dataTransfer.dropEffect = 'copy';
}

var fileUploadError;
var folderUploadError = false;
function showFolderUploadError() {
  folderUploadError = true;
  showModal('folder-upload-error-modal');
}


var uploadList = [];
var isUploading = false;
var startUploadTimeout;

function queueUpload(file, fid, predefinedPID, callback, callbackParam) {
  callback = callback || noop;
  callbackParam = callbackParam || null;
  clearTimeout(startUploadTimeout);

  uploadList.push({file:file, fid:fid, pid:predefinedPID, processed:false});

  startUploadTimeout = setTimeout(function () {
    // check first and last image in uploadList, get their file sizes, make an average file size.
    // then check total size of uploadList, and calculate how much memory would be needed
    // then decide how many photos should be uploaded. (currently it's 3, but could be higher)
    // then again, it seems like a memory leak, and probably needs monitoring the memory instead.
    // # of photos were relatively low, and sizes were feasible and still crashed.
    // chances are encryption leaks memory. Try to find a way to clean up after it.

    nextUpload(callback, callbackParam); // starts upload with first file
  }, 100);
}

var numFilesUploading = 0;
function nextUpload(callback, callbackParam) {
  callback = callback || noop;
  callbackParam = callbackParam || null;
  if (!isUploading) {
    isUploading = true; // stops next file / batch from going through right away.

    uploadList.forEach(function(upload, index) {

      if ( !upload.processed && (numFilesUploading < 2) ) {
        if ( upload.file.size < (memoryLimit / numFilesUploading) ) {
          uploadList[index].processed = true;
          numFilesUploading++;
          processPhotoForUpload (upload.file, upload.fid, upload.pid, callback, callbackParam);
        }
      }

      if (upload.file.size >= memoryLimit) {
        uploadList[index].processed = true;
        numFilesLeftToBeUploaded--;
        fileUploadError = true;
        uploadElem =
        '<div class="upload" id="upload-'+file.name+'-'+file.size+'">'+
          '<progress class="progress is-small is-danger" value="100" max="100"></progress>'+
          '<p class="deets fn">'+file.name+'</p>'+
          '<p class="deets fs">Too Large (' + formatBytes(file.size) + ')</p>'+
        '</div>';
        $("#upload-status-contents").append(uploadElem);
        document.title = "Cryptee | Uploading " + numFilesLeftToBeUploaded + " photo(s)";
      }
      // if file is too large or too many files uploading skip and wait until next round.
    });

  }
}

function uploadRetryFailed (pidOrTid, callback, callbackParam) {
  callback = callback || noop;
  var pid = pidOrTid.replace("t","p");
  uploadList.forEach(function(upload, index) {
    if (upload.pid === pid) {
      uploadList[index].processed = false;
      nextUpload(callback, callbackParam);
    }
  });
}

function processPhotoForUpload (file, fid, predefinedPID, callback, callbackParam) {
  callback = callback || noop;

  var reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onloadend = function(){
    var base64FileContents = reader.result;
    var uploadElem;
    try {
      var filename = file.name;
      var filesize = file.size;
      var filetype = file.type;
      var fileExt = extensionFromFilename(filename);
      //THIS LINE IS TO MAKE SURE FILE HAS SOME CONTENTS AND MAKE THIS "TRY" FAIL IF IT'S EMPTY, LIKE WHEN IT IS A FOLDER.
      var fileContents = base64FileContents.substr(base64FileContents.indexOf(',')+1);

      // if (filetype.indexOf("image") !== -1) {
      if (fileExt.match(/^(jpg|jpeg|png)$/i)) {
        var processingMessage = "<span class='icon'><i class='fa fa-circle-o-notch fa-spin fa-fw fa-3x'></i></span> Encrypting and Uploading photo(s). <b>" + numFilesLeftToBeUploaded.toString() + " Photos</b> left.";
        showFileUploadStatus("is-warning", processingMessage);
        encryptAndUploadPhoto(base64FileContents, predefinedPID, fid, filename, callback, callbackParam);
      } else {
        numFilesLeftToBeUploaded--;
        numFilesUploading--;
        fileUploadError = true;
        uploadElem =
        '<div class="upload" id="upload-'+file.name+'-'+file.size+'">'+
          '<progress class="progress is-small is-danger" value="100" max="100"></progress>'+
          '<p class="deets fn">'+file.name+'</p>'+
          '<p class="deets fs">(Error)</p>'+
        '</div>';
        $("#upload-status-contents").append(uploadElem);
        isUploading = false; // allows next file to go through.
        nextUpload(callback, callbackParam);
        document.title = "Cryptee | Uploading " + numFilesLeftToBeUploaded + " photo(s)";
      }
    } catch (e) {
      handleError(e);
      console.log(e);
      fileUploadError = true;
      showFolderUploadError();
      uploadElem =
      '<div class="upload" id="upload-'+file.name+'-'+file.size+'">'+
        '<progress class="progress is-small is-danger" value="100" max="100"></progress>'+
        '<p class="deets fn">'+file.name+'</p>'+
        '<p class="deets fs">(Error)</p>'+
      '</div>';
      $("#upload-status-contents").append(uploadElem);
      isUploading = false; // allows next file to go through.
      nextUpload(callback, callbackParam);
    }

  };
  reader.onerror = function(err){
    numFilesLeftToBeUploaded--;
    numFilesUploading--;
    fileUploadError = true;
    document.title = "Cryptee | Uploading " + numFilesLeftToBeUploaded + " photo(s)";
    if (!folderUploadError && canUploadFolders) {
      handleError(err);
      uploadElem =
      '<div class="upload" id="upload-'+file.name+'-'+file.size+'">'+
        '<progress class="progress is-small is-danger" value="100" max="100"></progress>'+
        '<p class="deets fn">'+file.name+'</p>'+
        '<p class="deets fs">(Error)</p>'+
      '</div>';
      $("#upload-status-contents").append(uploadElem);
      isUploading = false; // allows next file to go through.
      nextUpload(callback, callbackParam);
    } else {
      setTimeout(function () {
        hideFileUploadStatus();
      }, 200);
    }
  };
}


function encryptAndUploadPhoto (fileContents, predefinedPID, fid, filename, callback, callbackParam) {

  callback = callback || noop;
  var uuid = newUUID();
  var pid = predefinedPID || "p-" + uuid;
  var photoRef = rootRef.child(pid + ".crypteefile");

  var tid = pid.replace("p", "t");
  var thumbRef = rootRef.child(tid + ".crypteefile");

  var lid = pid.replace("p", "l");
  var lightRef = rootRef.child(lid + ".crypteefile");

  var totalBytes;
  var plaintextFileContents = fileContents;
  var dominant, thumbnail, lightboxPreview;

  generateThumbnail(plaintextFileContents, function(tn, canvas, ctx){
  // generatePrimitive(plaintextFileContents, function(pn){
    thumbnail = tn;
    generateDominant(canvas, ctx, function(dmnt){
      dominant = dmnt;
      generateLightboxPreview(plaintextFileContents, function(lp){
        lightboxPreview = lp;

        // ENCRYPT & UPLOAD THUMBNAIL FIRST.
        openpgp.encrypt({ data: thumbnail, passwords: [theKey], armor: true }).then(function(ciphertext) {
            var encryptedTextFile = JSON.stringify(ciphertext);

            var saveUploadThumb = thumbRef.putString(encryptedTextFile);
            saveUploadThumb.on('state_changed', function(thumbSnap){
              if (!fileUploadError) {
                var processingMessage = "<span class='icon'><i class='fa fa-circle-o-notch fa-spin fa-fw fa-3x'></i></span> Encrypting and Uploading photo(s). <b>" + numFilesLeftToBeUploaded.toString() + " Photos </b> left.";
                showFileUploadStatus("is-warning", processingMessage);
              }

              // switch (thumbSnap.state) { case firebase.storage.TaskState.PAUSED: break; case firebase.storage.TaskState.RUNNING: break; }
              if (thumbSnap.bytesTransferred === thumbSnap.totalBytes) {

                // THUMBNAIL UPLOADED. MOVE ON TO ORIGINAL PHOTO.

                openpgp.encrypt({ data: plaintextFileContents, passwords: [theKey], armor: true }).then(function(ciphertext) {
                    var encryptedTextFile = JSON.stringify(ciphertext);
                    var saveUploadOriginal = photoRef.putString(encryptedTextFile);
                    saveUploadOriginal.on('state_changed', function(snapshot){


                      if ($('#upload-' + pid).length === 0) {
                        var uploadElem =
                        '<div class="upload" id="upload-'+pid+'">'+
                          '<progress class="progress is-small" value="'+snapshot.bytesTransferred+'" max="'+snapshot.totalBytes+'"></progress>'+
                          '<p class="deets fn">'+filename+'</p>'+

                          '<p class="deets fs">'+ Math.floor((snapshot.bytesTransferred * 100) / snapshot.totalBytes) +'%</p>'+
                        '</div>';
                        $("#upload-status-contents").append(uploadElem);
                      } else {
                        $("#upload-"+pid).find("progress").attr("value", snapshot.bytesTransferred);
                        $("#upload-"+pid).find(".fs").html(Math.floor((snapshot.bytesTransferred * 100) / snapshot.totalBytes) +"%");
                      }

                      lastActivityTime = (new Date()).getTime();

                      // switch (snapshot.state) { case firebase.storage.TaskState.PAUSED: break; case firebase.storage.TaskState.RUNNING: break; }
                      if (snapshot.bytesTransferred === snapshot.totalBytes) {

                        // ORIGINAL PHOTO UPLOADED. MOVE ON TO LIGHTBOX PREVIEW

                        // ENCRYPT & UPLOAD LIGHTBOX PREVIEW IMAGE
                        openpgp.encrypt({ data: lightboxPreview, passwords: [theKey], armor: true }).then(function(ciphertext) {
                            var encryptedTextFile = JSON.stringify(ciphertext);

                            var saveUploadLightboxPreview = lightRef.putString(encryptedTextFile);
                            saveUploadLightboxPreview.on('state_changed', function(lightSnap){
                              if (!fileUploadError) {
                                var processingMessage = "<span class='icon'><i class='fa fa-circle-o-notch fa-spin fa-fw fa-3x'></i></span> Encrypting and Uploading photo(s). <b>" + numFilesLeftToBeUploaded.toString() + " Photos </b> left.";
                                showFileUploadStatus("is-warning", processingMessage);
                              }

                              if (lightSnap.bytesTransferred === lightSnap.totalBytes) {

                                // LIGHTBOX PREVIEW UPLOADED.

                                $("#upload-"+pid).remove();
                                photoUploadComplete(fid, pid, dominant, thumbnail, filename, callback, callbackParam);

                              }
                            }, function(error) {
                              handleUploadError (pid, filename, error, callback, callbackParam);
                            });
                        });

                      }
                    }, function(error) {
                      handleUploadError (pid, filename, error, callback, callbackParam);
                    });
                });

              }
            }, function(error) {
              handleUploadError (pid, filename, error, callback, callbackParam);
            });
        });
      });
    });
  });

}


function handleUploadError (pid, filename, error, callback, callbackParam) {
  if (usedStorage >= allowedStorage) {
    showFileUploadStatus("is-danger", "Error uploading your file(s). Looks like you've already ran out of storage. Please consider upgrading to a paid plan or deleting something else.<br><br><a class='button is-light' onclick='hideFileUploadStatus();'>Close</a>" + ' &nbsp; <a class="button is-info" onclick="upgradeFromExceed()">Upgrade</a>');
    exceededStorage(callback, callbackParam);
  } else {
    if (error.code === "storage/retry-limit-exceeded") {
      handleError(error);
      isUploading = false;
      uploadRetryFailed(pid, callback, callbackParam);
    } else {
      handleError(error);
      var uploadElem =
      '<div class="upload" id="upload-'+pid+'">'+
        '<progress class="progress is-small is-danger" value="100" max="100"></progress>'+
        '<p class="deets fn">'+filename+'</p>'+
        '<p class="deets fs">(Error)</p>'+
      '</div>';
      $("#upload-status-contents").append(uploadElem);
      isUploading = false; // allows next file to go through.
      nextUpload(callback, callbackParam);
    }

  }
}

function photoUploadComplete (fid, pid, dominant, thumbnail, filename, callback, callbackParam) {
  callback = callback || noop;
  callbackParam = callbackParam || pid;
  var photoObject = {"id" : pid, "pinky" : dominant};
  var whereTo;

  if (fid === "home") {
    whereTo = homeRef.doc(pid);
  } else {
    whereTo = homeRef.doc(fid).collection(fid).doc(pid);
  }

  whereTo.set(photoObject, {
    merge: true
  }).then(function(response) {
    uploadCompleteUpdateFirestore (fid, pid, dominant, thumbnail, filename, callback, callbackParam);
  }).catch(function(error) {
    console.error("Error saving uploaded folder to firestore: ", error);
    handleError(error);
    var uploadElem =
    '<div class="upload" id="upload-'+pid+'">'+
      '<progress class="progress is-small is-danger" value="100" max="100"></progress>'+
      '<p class="deets fn">'+filename+'</p>'+
      '<p class="deets fs">(Error)</p>'+
    '</div>';
    $("#upload-status-contents").append(uploadElem);
    isUploading = false; // allows next file to go through.
    nextUpload(callback, callbackParam);
  });

}

function uploadCompleteUpdateFirestore (fid, pid, dominant, thumbnail, filename, callback, callbackParam) {
  callback = callback || noop;

  numFilesLeftToBeUploaded--;
  numFilesUploaded++;
  numFilesUploading--;

  if (fid === activeFID) {
    activeItemsObject[pid] = activeItemsObject[pid] || {};
    activeItemsObject[pid].title = filename;
    activeItemsObject[pid].pinky = dominant;
    updateTitles(function(){
      if (numFilesLeftToBeUploaded === 0) {
        if (fid !== "home") {
          adjustFolderCount (fid, numFilesUploaded, false, function(){
            uploadCompleteAndFolderAdjusted (callback, callbackParam);
          });
        } else {
          if ($(".folder-content").length > 0) {
            hideEmptyFolderDialog();
          } else {
            // show empty after upload? idk how the fuck this would happen but still.
            showEmptyFolderDialog();
          }
          uploadCompleteAndFolderAdjusted (callback, callbackParam);
        }
      } else {
        document.title = "Cryptee | Uploading " + numFilesLeftToBeUploaded;
        isUploading = false; // allows next file to go through.
        nextUpload(callback, callbackParam);
      }
    });
  } else {
    handleError("Upload completed to non-active FID");
  }
}

function uploadCompleteAndFolderAdjusted (callback, callbackParam) {
  callback = callback || noop;

  document.title = "Cryptee | Photos";
  numFilesUploaded = 0;
  numFilesUploading = 0;
  if (!fileUploadError) {
    hideFileUploadStatus();
  } else {
    showFileUploadStatus("is-danger", "Done uploading, but some of your files were not uploaded.<br><br><a class='button is-light' onclick='hideFileUploadStatus();'>Close</a>");
  }
  somethingDropped = false;
  uploadList = [];
  isUploading = false;

  callback(callbackParam);
}

function getThumbnail (pid, fid) {
  if (pid !== "" && pid !== " " && pid !== undefined && pid !== null) {
    fid = fid || null;
    var tid = pid.replace("p-", "t-");
    var fileRef = rootRef.child(tid + ".crypteefile");
    fileRef.getDownloadURL().then(function(thumbURL) {
      var tidrequest = $.ajax({ url: thumbURL, type: 'GET',
          success: function(encryptedFileContents){
            var theEncryptedFileContents = JSON.parse(encryptedFileContents).data;
            openpgp.decrypt({ message: openpgp.message.readArmored(theEncryptedFileContents),   passwords: [theKey],  format: 'utf8' }).then(function(plaintext) {
              var decryptedContents = plaintext.data;
              var id = fid || pid;

              var tmpImg = new Image();
              tmpImg.onload = function(){
                $("#" + id).find("img").replaceWith(tmpImg);
                $("#sr-" + id).find("img").replaceWith(tmpImg);
                setTimeout(function(){
                  $("img[tid="+tid+"]").addClass("is-loaded");

                  if (!fid) {
                    if (preparingToDisplayPhoto !== id) { // so that it's not removed if user tapped photo while thumb is still loading.
                      $("#" + id).find(".photo").removeClass("is-loading");
                    }
                  } else {
                    $("#" + id).find(".album").removeClass("is-loading");
                  }
                  $("#sr-" + id).find(".image").removeClass("is-loading");

                  setTimeout(function(){
                    $("#" + id).find(".photo").css("background-color", "transparent");
                  }, 500);
                }, 25);
              };
              tmpImg.src = decryptedContents;
              tmpImg.setAttribute("draggable",false);
              tmpImg.setAttribute("tid",tid);
            });
          },
          error:function (xhr, ajaxOptions, thrownError){
            if (thrownError !== "abort") {
              console.log(thrownError);
              // TODO : ERROR DISPLAYING
              var errorText = "A rather strange error happened! Please try reloading. Please try again shortly, or contact our support. We're terribly sorry about this.";
              // showDocProgress(errorText);
              setTimeout(function(){ window.location.reload(); }, 2500);
            }
          }
      });
      var id = fid || pid;
      if (activeItemsObject[id]) {
        activeItemsObject[id].tidreq = tidrequest;
      }
    }).catch(function(error) {
      var errorText;
      handleError(error);
      switch (error.code) {
        case 'storage/object-not-found':
          errorText = "Seems like this file doesn't exist or you don't have permission to open this doc. We're not sure how this happened.<br> Please try again shortly, or contact our support. We're terribly sorry about this.";
          // File or doc doesn't exist at all ~ shit. alright let's try to repair things.
          // Chances are we've got a problem.
          // TODO : ERROR DISPLAYING
          // showDocProgress(errorText);
          fixFile(tid);
          break;
        case 'storage/unauthorized':
          errorText = "Seems like this file doesn't exist or you don't have permission to open this doc. We're not sure how this happened.<br> Please try again shortly, or contact our support. We're terribly sorry about this.";
          // File or doc doesn't exist at all ~ shit. alright let's try to repair things.
          // Chances are we've got a problem.
          // TODO : ERROR DISPLAYING
          // showDocProgress(errorText);
          fixFilesAndFolders();
          break;
        case 'storage/canceled':
          // TODO : ERROR DISPLAYING
          errorText = "A strange error happened while trying to load this file. It might be because you may have closed your browser while this doc was being saved";
          // showDocProgress(errorText);
          break;
        case 'storage/unknown':
          // TODO : ERROR DISPLAYING
          errorText = "We can't seem to load this file. It's a mystery why. Somehow our servers are acting. Please try again shortly, or contact our support. We're terribly sorry about this.";
          // showDocProgress(errorText);
          break;
      }
    });
  } else {
    if (fid) {
      generateFolderThumbnail(fid);
    } else {
      handleError("Get Photo Thumbnail : Blank PID");
    }
  }
}

function getThumbForItem (folderContent, tid, id) {
  // this happens if for some reason the browser crashes or gets closed mid-upload,
  // then some items / folders gets a thumbnail generated. #sad.
  if (folderContent !== null && folderContent !== undefined) {
    if (folderContent.classList.contains("albumitem")) {
      var album = folderContent.querySelector(".album");
      if (!album.classList.contains("is-loading")) {
        album.classList.add("is-loading");
      }
      getThumbnail(tid, id);
    }

    if (folderContent.classList.contains("photoitem")) {
      var photo = folderContent.querySelector(".photo");
      if (photo) {
        if (!photo.classList.contains("is-loading")) {
          photo.classList.add("is-loading");
        }
        getThumbnail(id);
      }
    }
  }
}


function generateFolderThumbnail(fid) {
  $("#" + fid).find(".album").addClass("is-loading");
  homeRef.doc(fid).collection(fid).get().then(function(item) {
    if (item.docs[0]) {
      var firstPhoto = item.docs[0].data();
      var pinky = firstPhoto.pinky;
      var thumb = firstPhoto.id.replace("p-", "t-");
      var folderObject = {thumb : thumb, pinky : pinky};

      homeRef.doc(fid).set(folderObject, {
        merge: true
      }).then(function(response) {
        getThumbnail(thumb, fid);
      }).catch(function(error) {
       console.error("Error saving folder's generated thumbnail:", error);
      });
    } else {
      $("#" + fid).find(".album").removeClass("is-loading");
      clearFolderThumbnail(fid);
    }
  });
}

function setFolderThumbnail() {
  var selectionsArray = Object.keys(selectionsObject);
  var pid = selectionsArray[0];
  var thumb = pid.replace("p-", "t-");
  $("#" + pid).find(".photo").addClass("is-loading");

  homeRef.doc(activeFID).collection(activeFID).get().then(function(item) {
    item.docs.forEach(function(photo){
      if (photo.id === pid) {
        var pinky = photo.data().pinky;
        var folderObject = {thumb : thumb, pinky : pinky};

        homeRef.doc(activeFID).set(folderObject, {
          merge: true
        }).then(function(response) {
          $("#" + pid).find(".photo").removeClass("is-loading");
          clearSelections();
        }).catch(function(error) {
         console.error("Error saving folder's thumbnail:", error);
        });
      }
    });
  });
}

function getFolderThumbnail(fid, callback) {
  callback = callback || noop;
  if(fid !== "home") {
    homeRef.doc(fid).get().then(function(item) {
      callback(item.data().thumb);
    });
  } else {
    callback("");
  }
}

function clearFolderThumbnail(fid, callback) {
  callback = callback || noop;
  var folderObject = {thumb : null, pinky : null};
  homeRef.doc(fid).set(folderObject, {
    merge: true
  }).then(function(response) {
    callback();
  }).catch(function(error) {
   console.error("Error saving folder's thumbnail:", error);
  });
}

function adjustFolderCount (fid, adjustment, forceGenerateThumb, callback, callbackParam) {
  callback = callback || noop;
  // adjustment can be 1 or -1
  homeRef.doc(fid).get().then(function(item) {
    var count = item.data().count;
    var folderCountObject = {"count" : count + adjustment};
    homeRef.doc(fid).set(folderCountObject, {
      merge: true
    }).then(function(response) {
      $("#" + fid).find(".album").removeClass("is-loading");
      $("#" + fid).removeClass("is-loading");
      // $("#"+fid).find(".deets").html(count + adjustment + " Photo(s)");

      if ((count + adjustment) <= 0 ) {
        // IT IS EMPTY NOW.
        showEmptyFolderDialog();
        clearFolderThumbnail(fid);
      } else {
        if (count === 0) {
          // IT WAS EMPTY, AND NOW IT ISN'T EMPTY. AUTO-SET THUMBNAIL FOR FOLDER.
          hideEmptyFolderDialog();
          generateFolderThumbnail(fid);
        } else {
          if (forceGenerateThumb) {
            // IT WASN'T AND STILL ISN'T EMPTY, BUT WE STILL WANT TO FORCE NEW THUMBNAIL.
            // LIKE WHEN THE OLD THUMB IMAGE IS MOVED OUT FROM FOLDER OR DELETED.
            generateFolderThumbnail(fid);
          }
        }
      }
      clearSelections();
      callback(callbackParam);
    }).catch(function(error) {
      console.error("Error saving folder's new count: ", error);
      callback(callbackParam);
    });
  });
}

function moveSelectionsToFolder (arrayOfPIDsToMove, toFolderID, indexToMove, thumbnailIsMoving, callback, callbackParam) {
  callback = callback || noop;
  if (toFolderID !== activeFID) {
    progressModal("photos-move-selections-modal");
    var numberOfItemsToMove = arrayOfPIDsToMove.length;
    indexToMove = indexToMove || 0;
    showFileUploadStatus("is-info", "Organizing photos and albums. ("+ Math.floor((indexToMove * 100) / numberOfItemsToMove) +"%)");
    var pid = arrayOfPIDsToMove[indexToMove];
    if (pid !== "" && pid !== undefined && pid !== null && pid !== " ") {
      $("#" + toFolderID).find(".album").addClass("is-loading");

      if (activeFID === "home") {
        whereFrom = homeRef.doc(pid);
      } else {
        whereFrom = homeRef.doc(activeFID).collection(activeFID).doc(pid);
      }

      if (toFolderID === "home") {
        whereTo = homeRef.doc(pid);
      } else {
        whereTo = homeRef.doc(toFolderID).collection(toFolderID).doc(pid);
      }

      whereFrom.get().then(function(item) {
        var photoObject = item.data();
        whereTo.set(photoObject, {
          merge: true
        }).then(function(response) {
          whereFrom.delete().then(function() {
            indexToMove++;
            titlesToMove.photos[pid] = activeItemsObject[pid].title;
            delete activeItemsObject[pid];
            if (indexToMove === numberOfItemsToMove) {
              // DONE MOVING
              console.log("done moving");
              moveTitles(toFolderID, function(){
                if (activeFID !== "home") {
                  var adjustmentCount = 0 - numberOfItemsToMove;
                  adjustFolderCount (activeFID, adjustmentCount, thumbnailIsMoving);
                }
                if (toFolderID !== "home") {
                  adjustFolderCount (toFolderID, numberOfItemsToMove);
                }
                unprogressModal("photos-move-selections-modal");
                $("#photos-move-selections-modal").removeClass("disable-clicks");
                callback(callbackParam);
              });
            } else {
              // STILL HAS THINGS TO MOVE.
              moveSelectionsToFolder(arrayOfPIDsToMove, toFolderID, indexToMove, thumbnailIsMoving, callback, callbackParam);
            }
          }).catch(function(error) {
            indexToMove++;
            moveSelectionsToFolder(arrayOfPIDsToMove, toFolderID, indexToMove, thumbnailIsMoving, callback, callbackParam);
            console.error("Error deleting moved item from old folder in firestore: ", error);
          });
        }).catch(function(error) {
          indexToMove++;
          moveSelectionsToFolder(arrayOfPIDsToMove, toFolderID, indexToMove, thumbnailIsMoving, callback, callbackParam);
          console.error("Error saving moved item to firestore: ", error);
        });
      }).catch(function(error) {
        indexToMove++;
        moveSelectionsToFolder(arrayOfPIDsToMove, toFolderID, indexToMove, thumbnailIsMoving, callback, callbackParam);
        console.error("Error getting moved item from firestore: ", error);
      });
    }
  }
}

function showMoveSelectionsModal() {
  // SHOW LOADING
  $("#move-folders-list-home").hide();
  $("#photos-move-folders-list").addClass("is-loading");
  $("#photos-move-folders-list").find("li").remove();
  showModal('photos-move-selections-modal');

  titlesRef.doc("home").get().then(function(titles) {
    var encryptedTitlesObject = JSON.parse(titles.data().titles).data;
    openpgp.decrypt({ message: openpgp.message.readArmored(encryptedTitlesObject), passwords: [theKey], format: 'utf8' }).then(function(plaintext) {
      $.each(JSON.parse(plaintext.data).folders, function(fid, ftitle) {
        var parsedFilename = JSON.parse(ftitle);
        var isCurrent = ""; if (fid === activeFID) { isCurrent = "is-current"; }
        $("#photos-move-folders-list").append('<li><a fid="'+fid+'" class="'+isCurrent+' photos-move-folders-list-item"><span class="icon is-small"><i class="fa fa-book"></i></span> '+parsedFilename+'</a></li>');
      });

      if (activeFID === "home") {
        $("#move-folders-list-home").addClass("is-current");
      } else {
        $("#move-folders-list-home").removeClass("is-current");
      }

      $("#move-folders-list-home").fadeIn(250);
      $("#photos-move-folders-list").removeClass("is-loading");
    });
  });
}

$("#photos-move-folders-list").on('click', 'a', function(event) {
  event.preventDefault();
  var toFolderID = $(this).attr("fid");
  if (toFolderID !== activeFID) {
    $("#move-folders-list-home").removeClass("is-active");
    $(".photos-move-folders-list-item.is-active").removeClass("is-active");
    $(this).addClass("is-active");
  }
});

$("#move-folders-list-home").on('click', function(event) {
  event.preventDefault();

  if (activeFID !== "home") {
    $("#move-folders-list-home").removeClass("is-active");
    $(".photos-move-folders-list-item.is-active").removeClass("is-active");
    $(this).addClass("is-active");
  }
});

function moveFolderSelectionMade () {
  var toFolderID = $(".photos-move-folders-list-item.is-active").attr("fid");
  if (toFolderID !== undefined && toFolderID !== null && toFolderID !== "") {

    var thumbnailIsMoving = false;
    getFolderThumbnail(activeFID, function(thumb){
      var selectionsArray = Object.keys(selectionsObject);
      selectionsArray.forEach(function(pid) {
        if (pid === thumb.replace("t-", "p-")) {
          thumbnailIsMoving = true;
        }
      });
      $("#photos-move-selections-modal").addClass("disable-clicks");
      moveSelectionsToFolder(selectionsArray, toFolderID, 0, thumbnailIsMoving, function(){
        hideModal("photos-move-selections-modal");
        hideFileUploadStatus();
      });
    });
  }
}



////////////////////////////////////////////////////
///////////////// GENERATE THUMBNAIL ///////////////
////////////////////////////////////////////////////

// you can use generatePrimitive(imgB64, callback) as a drop in replacement
function generatePinkynail (imgB64, callback) {
  var maxWidth = 10, maxHeight = 10;
  var canvas = document.createElement("canvas");
  var ctx = canvas.getContext("2d");
  var canvasCopy = document.createElement("canvas");
  var copyContext = canvasCopy.getContext("2d");
  var img = new Image();
  img.src = imgB64;

  img.onload = function () {
    var ratio = 1;
    if (img.width > maxWidth) { ratio = maxWidth / img.width; }
    else if (img.height > maxHeight) { ratio = maxHeight / img.height; }
    canvasCopy.width = img.width;
    canvasCopy.height = img.height;
    copyContext.drawImage(img, 0, 0);
    canvas.width = img.width * ratio;
    canvas.height = img.height * ratio;
    ctx.drawImage(canvasCopy, 0, 0, canvasCopy.width, canvasCopy.height, 0, 0, canvas.width, canvas.height);
    callback(canvas.toDataURL("image/jpeg", 0.4));
  };
}

function generateThumbnail (imgB64, callback) {
  getEXIF(imgB64, function(exif) {
    var orientation;
    if (exif.Orientation) {
      orientation = exif.Orientation;
    }

    var maxWidth = 768, maxHeight = 768;

    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext("2d");

    var canvasCopy = document.createElement("canvas");
    var copyContext = canvasCopy.getContext("2d");

    var orientCanvas = document.createElement("canvas");
    var orientContext = orientCanvas.getContext("2d");

    var img = new Image();
    img.src = imgB64;

    img.onload = function () {

      var width = img.width
      var height = img.height

      orientCanvas.width = width;
      orientCanvas.height = height;

      if (orientation > 4) {
        orientCanvas.width = height;
        orientCanvas.height = width;
      }

      switch (orientation) {
        case 2:
          // horizontal flip
          orientContext.translate(width, 0)
          orientContext.scale(-1, 1)
          break
        case 3:
          // 180° rotate left
          orientContext.translate(width, height)
          orientContext.rotate(Math.PI)
          break
        case 4:
          // vertical flip
          orientContext.translate(0, height)
          orientContext.scale(1, -1)
          break
        case 5:
          // vertical flip + 90 rotate right
          orientContext.rotate(0.5 * Math.PI)
          orientContext.scale(1, -1)
          break
        case 6:
          // 90° rotate right
          orientContext.rotate(0.5 * Math.PI)
          orientContext.translate(0, -height)
          break
        case 7:
          // horizontal flip + 90 rotate right
          orientContext.rotate(0.5 * Math.PI)
          orientContext.translate(width, -height)
          orientContext.scale(-1, 1)
          break
        case 8:
          // 90° rotate left
          orientContext.rotate(-0.5 * Math.PI)
          orientContext.translate(-width, 0)
          break
      }

      orientContext.drawImage(img, 0, 0);

      var ratio = 1;
      if (orientCanvas.width > maxWidth) { ratio = maxWidth / orientCanvas.width; }
      else if (orientCanvas.height > maxHeight) { ratio = maxHeight / orientCanvas.height; }

      canvasCopy.width = orientCanvas.width;
      canvasCopy.height = orientCanvas.height;

      copyContext.drawImage(orientCanvas, 0, 0, orientCanvas.width, orientCanvas.height, 0, 0, canvasCopy.width, canvasCopy.height);

      canvas.width = canvasCopy.width * ratio; // this canvas gets a reduced size
      canvas.height = canvasCopy.height * ratio;

      ctx.drawImage(canvasCopy, 0, 0, canvasCopy.width, canvasCopy.height, 0, 0, canvas.width, canvas.height);
      callback(canvas.toDataURL("image/jpeg", 0.3), canvasCopy, copyContext);
    };
  });
}






function generateLightboxPreview (imgB64, callback) {
  getEXIF(imgB64, function(exif) {
    var orientation;
    if (exif.Orientation) {
      orientation = exif.Orientation;
    }

    var maxWidth = 1920, maxHeight = 1920;

    var canvas = document.createElement("canvas");
    var ctx = canvas.getContext("2d");

    var canvasCopy = document.createElement("canvas");
    var copyContext = canvasCopy.getContext("2d");

    var orientCanvas = document.createElement("canvas");
    var orientContext = orientCanvas.getContext("2d");

    var img = new Image();
    img.src = imgB64;

    img.onload = function () {

      var width = img.width
      var height = img.height

      orientCanvas.width = width;
      orientCanvas.height = height;

      if (orientation > 4) {
        orientCanvas.width = height;
        orientCanvas.height = width;
      }

      switch (orientation) {
        case 2:
          // horizontal flip
          orientContext.translate(width, 0)
          orientContext.scale(-1, 1)
          break
        case 3:
          // 180° rotate left
          orientContext.translate(width, height)
          orientContext.rotate(Math.PI)
          break
        case 4:
          // vertical flip
          orientContext.translate(0, height)
          orientContext.scale(1, -1)
          break
        case 5:
          // vertical flip + 90 rotate right
          orientContext.rotate(0.5 * Math.PI)
          orientContext.scale(1, -1)
          break
        case 6:
          // 90° rotate right
          orientContext.rotate(0.5 * Math.PI)
          orientContext.translate(0, -height)
          break
        case 7:
          // horizontal flip + 90 rotate right
          orientContext.rotate(0.5 * Math.PI)
          orientContext.translate(width, -height)
          orientContext.scale(-1, 1)
          break
        case 8:
          // 90° rotate left
          orientContext.rotate(-0.5 * Math.PI)
          orientContext.translate(-width, 0)
          break
      }

      orientContext.drawImage(img, 0, 0);

      var ratio = 1;
      if (orientCanvas.width > maxWidth) { ratio = maxWidth / orientCanvas.width; }
      else if (orientCanvas.height > maxHeight) { ratio = maxHeight / orientCanvas.height; }

      canvasCopy.width = orientCanvas.width;
      canvasCopy.height = orientCanvas.height;

      copyContext.drawImage(orientCanvas, 0, 0, orientCanvas.width, orientCanvas.height, 0, 0, canvasCopy.width, canvasCopy.height);

      canvas.width = canvasCopy.width * ratio; // this canvas gets a reduced size
      canvas.height = canvasCopy.height * ratio;

      ctx.drawImage(canvasCopy, 0, 0, canvasCopy.width, canvasCopy.height, 0, 0, canvas.width, canvas.height);
      callback(canvas.toDataURL("image/jpeg", 0.5));
    };
  });
}




function generateDominant(canvas, ctx, callback) {
  callback = callback || noop;
  var colorThief = new ColorThief();
  var dominantColor = colorThief.getColor(canvas, ctx);
  callback (dominantColor.toString());
}

function generatePallette(imgEl, callback) {
  var canvas = document.createElement("canvas");
  var ctx = canvas.getContext("2d");
  var img = new Image();
  img.src = imgEl.attr("src");

  img.onload = function () {
    canvas.width = img.width; canvas.height = img.height;
    ctx.drawImage(img, 0,0, canvas.width, canvas.height);
    var colorThief = new ColorThief();
    var pallette = colorThief.getPalette(canvas, ctx);
    callback(pallette);
  };
}


////////////////////////////////////////////////////
/////////////////      GET EXIF      ///////////////
////////////////////////////////////////////////////

function getEXIF(b64, callback) {
  callback = callback || noop;
  var img = new Image();
  img.src = b64;
  img.onload = function () {
    try {
      EXIF.getData(img, function() {
        var allMetaData = EXIF.getAllTags(this);
        callback(allMetaData, false);
      });
    } catch (e) {
      callback({}, e);
    }
  };
}

////////////////////////////////////////////////////
////////////// FILE & FOLDER MANAGEMENT ////////////
////////////////////////////////////////////////////

function showEmptyFolderDialog () {
  $(".photos-empty-folder").fadeIn(250);
}

function hideEmptyFolderDialog (callback) {
  callback = callback || noop;
  $(".photos-empty-folder").fadeOut(250, function(){
    callback();
  });
}

function folderCreated (fid, fcount, fname, callback, callbackParam) {
  callback = callback || noop;
  activeItemsObject[fid].title = fname;
  renderFolder(fid, fcount, fname, "", "", updateTitles, callback, callbackParam);
}

function renderFolder (fid, fcount, fname, pinky, thumb, callback, callback2, callbackParam2) {
  callback = callback || noop;
  callback2 = callback2 || noop;
  fcount = fcount || 0;
  fname = fname || "Untitled";
  pinky = pinky || '<img draggable="false" src="../assets/nothumb.jpg" style="opacity:1;" class="is-loaded">';

  var dominant = "";
  var pinkyObj = "";
  var loadingColor = "is-dark-loader";
  thumb = thumb || "";

  if (pinky.startsWith("data:image")) {
    pinkyObj = '<img draggable="false" src="'+pinky+'"  tid="'+thumb+'">';
  } else {
    if (!pinky.startsWith("<img")) {
      dominant = "background-color:rgb(" + pinky + ");";
      pinkyObj = '<img draggable="false" src="//:0" tid="'+thumb+'">';
      var colorContrast = pinky.split(",").reduce(function add(a, b) { return parseInt(a) + parseInt(b); }, 0);
      if (colorContrast < 385) {
        loadingColor = "is-white-loader";
      }
    } else {
      pinkyObj = pinky;
    }
  }

  var theParsedFoldername = "";
  try { theParsedFoldername = JSON.parse(fname); } catch (e) { theParsedFoldername = fname; }

  var folderDivOpener = '<div name="'+theParsedFoldername+'" class="folder-content albumitem" id="'+fid+'" fcount="'+fcount+'" style="'+dominant+'">';
  var folderHTML =
    '<div class="album '+loadingColor+'" style="'+dominant+'">'+
      pinkyObj +
      '<div class="button is-light unclickable albumicon"><span class="icon"><i class="fa fa-fw fa-book"></i></span></div>'+
      '<input onclick="this.focus()" type="text" class="albumtitle" value="'+theParsedFoldername+'" placeholder="'+theParsedFoldername+'" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />'+
      '<span class="settingsicon icon is-small"><i class="fa fa-fw fa-ellipsis-v"></i></span>'+
      '<span class="deletefoldericon icon is-small"><i class="fa fa-fw fa-trash"></i></span>'+
      '<span class="ghostfoldericon icon is-small"><i class="fa fa-fw fa-eye-slash"></i></span>'+
    '</div>';
  var folderDivCloser = '</div>';

  if (callback !== noop) {
    $("#folder-contents").append(folderDivOpener + folderHTML + folderDivCloser);
    callback(callback2, callbackParam2);
    hideModal("photos-new-folder-modal");
  } else {
    return folderHTML;
  }
}

function renderPhoto (pid, nail, pname, justUploaded, callback, callbackParam) {
  callback = callback || noop;
  pname = pname || "Untitled.jpg";
  nail = nail || "";

  // PINKY IS A PINKYNAIL. IT'S A 35X35 PIXEL VERSION OF THE IMAGE, THAT HOPEFULLY ISN'T TOO INVASIVE FOR PRIVACY.
  // IT ALLOWS TO DISPLAY A BLURRED VERSION OF THE IMAGE, WHILE THE ACTUAL THUMBNAIL IS LOADING. WE STORE THIS UNENCRYPTED
  // TO SAVE TIME. IF WE REALIZE THAT THIS IS UNNECESSARY, WE CAN SKIP THIS TOO LATER. BUT FOR NOW I'M ADDING IT JUST IN CASE.
  var isItSelected = "";
  var isItLoading = "";
  var isLoaded = "";
  var loadingColor = "is-black-loader";
  // if (!justUploaded) { isItLoading = "is-loading"; } else { isLoaded = 'opacity : 1'; }
  if (justUploaded) { isLoaded = 'opacity : 1'; }
  if (pid in selectionsObject) {isItSelected = " selected"}

  var theParsedFilename = "";
  try { theParsedFilename = JSON.parse(pname); } catch (e) { theParsedFilename = pname; }

  pext = extensionFromFilename(theParsedFilename) || "";
  theParsedFilename = titleFromFilename(theParsedFilename);

  var imgElem = ""; var dominant = "";
  if (nail.startsWith("data:image")) {
    imgElem = '<img draggable="false" src="'+nail+'" style="'+isLoaded+'">';
  } else {
    imgElem = "<img draggable='false' src='//:0' style='"+isLoaded+"'>";
    dominant = "background-color:rgb("+nail+");";
    var colorContrast = nail.split(",").reduce(function add(a, b) { return parseInt(a) + parseInt(b); }, 0);
    if (colorContrast < 385) {
      loadingColor = "is-white-loader";
    }
  }

  var photoDivOpener = '<div name="'+theParsedFilename+'" class="folder-content photoitem '+isItSelected+'" id="'+pid+'" style="'+dominant+'">';
  var photoHTML =
    '<div class="photo '+isItLoading+' '+loadingColor+'" style="'+dominant+'">'+
      imgElem +
      '<input type="text" class="phototitle" ext="'+pext+'" value="'+theParsedFilename+'" placeholder="'+theParsedFilename+'" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />'+
      '<div class="photo-selection">'+
        '<span class="selectionicon icon"><i class="seli fa fa-fw fa-check"></i></span>'+
      '</div>'+
    '</div>';
  var photoDivCloser = '</div>';

  if (callback !== noop) {
    $("#folder-contents").append(photoDivOpener + photoHTML + photoDivCloser);
    callback(callbackParam);
  } else {
    return photoHTML;
  }
}

function renderDOMElement (id){
  var domElement = "";
  if (id.startsWith('p-')) {
    domElement = renderPhoto(id, activeItemsObject[id].pinky, activeItemsObject[id].title);
  } else if (id.startsWith('f-')) {
    domElement = renderFolder(id, activeItemsObject[id].count, activeItemsObject[id].title, activeItemsObject[id].pinky, activeItemsObject[id].thumb);
  } else { // wtf. neither photo nor folder.
  }

  return domElement;
}







function renderFolderShell(id, pinky, title) {
  pinky = pinky || "246,246,246";
  dominant = "background-color:rgb(" + pinky + ");"; // optional, removing could speed up painting & reflow
  var html = "<div name='"+title+"' class='folder-content albumitem shell' id='"+id+"' style='"+dominant+"'></div>";
  return html;
}

function renderPhotoShell (id, pinky, title) {
  var theParsedFilename = "";
  try { theParsedFilename = JSON.parse(title); } catch (e) { theParsedFilename = title; }

  pext = extensionFromFilename(theParsedFilename) || "";
  theParsedFilename = titleFromFilename(theParsedFilename);

  pinky = pinky || "246,246,246";
  dominant = "background-color:rgb(" + pinky + ");"; // optional, removing could speed up painting & reflow
  var html = "<div name='"+theParsedFilename+"' class='folder-content photoitem shell' id='"+id+"' style='"+dominant+"'></div>";
  return html;
}

function renderDOMShell (id) {
  var shellElement = "";
  if (id.startsWith('p-')) {
    shellElement = renderPhotoShell(id, activeItemsObject[id].pinky, activeItemsObject[id].title);
  } else if (id.startsWith('f-')) {
    shellElement = renderFolderShell(id, activeItemsObject[id].pinky, activeItemsObject[id].title);
  } else { // wtf. neither photo nor folder.
  }
  return shellElement;
}

function addIntersectionObserver (el){
  observer.observe(el);
}


function onEntryAndExit (changes, observer) {

  changes.forEach(function (change) {
    var onScreenTimer;

    if (change.intersectionRatio > 0.15) {
      // entered
      if (change.target.classList.contains("shell")) {
        var folderContent = change.target;
        var id = folderContent.id;

        var domElement = renderDOMElement(id);
        folderContent.innerHTML = domElement;

        var tid = folderContent.querySelector("img").getAttribute("tid");

        onScreenTimer = setTimeout(function(){
          getThumbForItem (folderContent, tid, id);
        }, 500);

        folderContent.classList.remove('shell');
      }

    } else {
      // exited
      var folderContent = change.target;
      var id = folderContent.id;

      clearTimeout(onScreenTimer);

      if (activeItemsObject[id]) {
        if (activeItemsObject[id].tidreq) {
          activeItemsObject[id].tidreq.abort(); // abort ajax get request for thumbnail
        }
      }

      folderContent.innerHTML = "";
      change.target.classList.add('shell');

    }

  });

}



//breadcrumb management
function hanselAndGretel () {
  if (activeFID === "home") {
    $("#get-parent-folder-button").hide();
  } else {
    // GET NAME OF ITEM AND SHOW AS WELL.
    $("#get-parent-folder-button").show();
  }

  if (activePID !== "") {
    // GET NAME OF ITEM AND SHOW AS WELL.
    $("#active-photo-button").show();
  } else {
    $("#active-photo-button").hide();
  }
}

$("#folder-contents").on("click", ".albumitem", function(event){
  if (event.target.tagName.toLowerCase() !== "input") {
    event.stopPropagation(); event.preventDefault();
    var fid = $(this).attr("id");
    getAllFilesOfFolder (fid);
  }
});

window.addEventListener('popstate', function(e) {
  var id = e.state;
  if ($("#lightbox-modal").hasClass("is-active")) {
    $("#lightbox-modal").removeClass("is-active");
  } else {
    if (id) {
      if (id === "home") {
        homeFolderLoaded = false; otherFolderLoaded = false;
        getHomeFolder();
      } else {
        if (id.startsWith("f-")) {
          homeFolderLoaded = false; otherFolderLoaded = false;
          getAllFilesOfFolder(id);
        } else {
          loadPhoto(id, "", "display");
        }
      }
    } else {
      homeFolderLoaded = false; otherFolderLoaded = false;
      getHomeFolder();
    }
  }
});

// $("body").on('swiperight',  function(){
//   if (!$("#lightbox-modal").hasClass("is-active")) {
//     if (activeFID !== "home") {
//       getHomeFolder();
//     }
//   }
// });









// master title object for the open folder.
var activeItemsObject = {};

// it's flat (pid or fid doesn't matter)
// {
//   "id" : {
//     "title" : title,
//     "count" : count,     // folder only
//     "pinky" : pinky,
//     "thumb" : thumb,
//     "ext"   : ext        // photo only
//   }
// }







////////////////////////////////////////////////////
//////////////////   LOAD TITLES    ////////////////
////////////////////////////////////////////////////

// {
//   folders : {
//     '111' : 'folder test',
//     '222' : 'folder test2'
//   },
//   photos : {
//     'd111' : 'photo test',
//     'd222' : 'photo test2'
//   }
// }

function sortItemsObject () {
  // CYCLES THROUGH active Items Object and returns a sorted titles array like :
  // [[id, title], [id, title]]
  // item[0] as the id, item[1] as the filename

  var titlesArray = [];
  var activeItemsObjectArray = Object.keys(activeItemsObject);
  activeItemsObjectArray.forEach(function(id){
    var title = activeItemsObject[id].title || "Untitled";
    titlesArray.push([id, title]);
  });

  titlesArray.sort(function(a, b) {
    if (a[1] < b[1]) {
      return -1;
    } else {
      return 1;
    }
  });

  var sortedTitlesArray = [];
  sortedTitlesArray = titlesArray;

  return sortedTitlesArray;
}

function extensionFromFilename (filename) {
  return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
}

function titleFromFilename (filename) {
  var extension = "." + extensionFromFilename(filename);
  return (filename.substring(0,filename.lastIndexOf(extension)) + '');
}

function getTitles (fid, contents, callback) {
  titlesRef.doc(fid).get().then(function(titles) {
    gotTitles(titles.data().titles, contents, callback);
  }).catch(function(error) {
    console.log("Error getting titles of folder, likely empty");
  });
}

function gotTitles (JSONifiedEncryptedTitlesObject, contents, callback) {
  callback = callback || noop;
  var encryptedTitlesObject = JSON.parse(JSONifiedEncryptedTitlesObject).data;
  openpgp.decrypt({ message: openpgp.message.readArmored(encryptedTitlesObject), passwords: [theKey], format: 'utf8' }).then(function(plaintext) {
    var titlesObject = JSON.parse(plaintext.data);
    processTitles(titlesObject, contents, callback);
  });
}

function processTitles (titlesObject, contents, callback) {
  callback = callback || noop;


  /////////////////////////////////////////
  // - 1 - CYCLE ALL ITEMS FROM FIRESTORE
  // AND ADD TO active Items Object
  /////////////////////////////////////////

  var tryFixingFiles = false;
  contents.forEach(function(item) {

    if (item.data().id) {
      var id = item.data().id;
      activeItemsObject[id] = activeItemsObject[id] || {};

      activeItemsObject[id].pinky = item.data().pinky;
      activeItemsObject[id].title = "Untitled"; // as a placeholder

      if (id.startsWith('f-')) {
        activeItemsObject[id].count = item.data().count;
        activeItemsObject[id].thumb = item.data().thumb;
      }
    } else {
      if (!isMobile) { tryFixingFiles = true; }
    }

  });

  /////////////////////////////////////////////
  // - 2 - CYCLE ALL TITLES FROM titlesObject
  // AND ADD TO active Items Object
  /////////////////////////////////////////////

  $.each(titlesObject.folders, function(fid, ftitle) {
    var parsedFilename = JSON.parse(ftitle);
    activeItemsObject[fid] = activeItemsObject[fid] || {};
    activeItemsObject[fid].title = parsedFilename;
  });

  $.each(titlesObject.photos, function(pid, ptitle) {
    var parsedFilename = "";
    try { parsedFilename = JSON.parse(ptitle); } catch (e) { parsedFilename = ptitle; }
    activeItemsObject[pid] = activeItemsObject[pid] || {};
    activeItemsObject[pid].title = parsedFilename || "Untitled.jpg";
  });

  /////////////////////////////////////////////
  // - 3 - ADD SUMMONED FOLDER TITLE BACK IN
  // TO active Items Object
  /////////////////////////////////////////////

  var ghostElement;
  if (somethingSummoned) {
    activeItemsObject[summonedFID].title = summonedTitle;
    somethingSummoned = false;
    summonedFID = "";
    summonedTitle = "";
  }

  /////////////////////////////////////////////////
  // - 4 - NOW THAT WE HAVE EVERYTHING CONSOLIDATED
  // IN active Items Object - SORT ALL TITLES
  /////////////////////////////////////////////////

  // [[id, title], [id, title]]
  // item[0] is the id, item[1] is the filename
  var itemsArray = sortItemsObject();
  var sortedDOMArray = [];

  // insert dom elements into the sortedDOMArray in correct order.
  itemsArray.forEach(function (item, index) {
    // item[0] is the id, item[1] is the filename

    var shellElement = renderDOMShell(item[0]);
    sortedDOMArray.push(shellElement);

  });

  // now we have a pre-sorted sortedDOMArray which has all photo and album objects
  // add this and ghost element to dom in a single joint chunk
  $("#folder-contents").append(sortedDOMArray.join(""));

  $(".folder-content").each(function () {
    addIntersectionObserver (this);
  });

  callback();

  if (tryFixingFiles) {
    tryFixingFiles = false;
    fixFilesAndFolders();
  }
}





var didAnyTitlesObjectChange;
function updateTitles (callback, callbackParam) {
  callback = callback || noop;
  didAnyTitlesObjectChange = true;

  function writeTitles (oldSelf) {
    var titlesObject = {};
    var ftitles = {};
    var ptitles = {};

    var activeTitlesArray = Object.keys(activeItemsObject);
    activeTitlesArray.forEach(function(id) {
      var title = activeItemsObject[id].title;
      if (id.startsWith('p-')) {
        ptitles[id] = JSON.stringify(title);
      } else if (id.startsWith('f-')) {
        ftitles[id] = JSON.stringify(title);
      }
    });

    // ENCRYPT AND UPLOAD TITLES.
    if (activeFID === "home") {
      titlesObject.self = "Home";
    } else {
      titlesObject.self = oldSelf;
    }
    titlesObject.folders = ftitles;
    titlesObject.photos = ptitles;

    encryptAndUploadTitles (titlesObject, activeFID, callback, callbackParam);
  }

  titlesRef.doc(activeFID).get().then(function(titles) {
    if (titles.data() !== undefined) {
      var encryptedTitlesObject = JSON.parse(titles.data().titles).data;
      openpgp.decrypt({ message: openpgp.message.readArmored(encryptedTitlesObject), passwords: [theKey], format: 'utf8' }).then(function(plaintext) {
        var oldTitlesObject = JSON.parse(plaintext.data);
        writeTitles(oldTitlesObject.self);
      });
    } else {
      writeTitles();
    }
  }).catch(function(error) {
    console.log("Error getting titles of folder @ updateTitles, likely empty or had corruption somehow.", error);
  });
}


function encryptAndUploadTitles (titlesObjectToEncrypt, fid, callback, callbackParam) {
  var plaintextTitles = JSON.stringify(titlesObjectToEncrypt);
  lastActivityTime = (new Date()).getTime();
  openpgp.encrypt({ data: plaintextTitles, passwords: [theKey], armor: true }).then(function(ciphertext) {
    var encryptedTitlesObject = JSON.stringify(ciphertext);
    titlesRef.doc(fid).set({"titles" : encryptedTitlesObject}, {
      merge: true
    }).then(function(response) {
      callback(callbackParam);
    }).catch(function(error) {
      console.error("Error saving titles of folder: ", error);
    });
  });
}

function updateFolderTitle(fid, newFTitle, callback) {
  callback = callback || noop;
  titlesRef.doc(fid).get().then(function(titles) {
    var encryptedTitlesObject = JSON.parse(titles.data().titles).data;
    openpgp.decrypt({ message: openpgp.message.readArmored(encryptedTitlesObject), passwords: [theKey], format: 'utf8' }).then(function(plaintext) {
      var titlesObject = JSON.parse(plaintext.data);
      titlesObject.self = newFTitle;
      encryptAndUploadTitles(titlesObject, fid, callback);
    });
  }).catch(function(error) {
    var titlesObject = {}; titlesObject.self = newFTitle;
    encryptAndUploadTitles(titlesObject, fid, callback);
    console.log("Error getting titles of folder @ updateFolderTitle, likely empty or had corruption somehow.", error);
  });
}







var titlesToMove = {};
titlesToMove.photos = {};
titlesToMove.folders = {};
function moveTitles (toFID, callback, callbackParam) {

  callback = callback || noop;
  // titlesToMove.photos[pid] = etc.
  // titlesToMove.albums[fid] = etc.

  // GET TITLES OF TARGET FOLDER
  titlesRef.doc(toFID).get().then(function(titles) {
    // GOT TITLES OF TARGET FOLDER
    var encryptedTitlesObject = JSON.parse(titles.data().titles).data;
    openpgp.decrypt({ message: openpgp.message.readArmored(encryptedTitlesObject), passwords: [theKey], format: 'utf8' }).then(function(plaintext) {
      gotTargetFolderTitles (JSON.parse(plaintext.data), toFID, callback, callbackParam);
    });
  }).catch(function(error) {
    // target folder was empty (shouldn't happen. now should have self.)
    var targetTitlesObject = {};
    targetTitlesObject.photos = {};
    targetTitlesObject.folders = {};
    gotTargetFolderTitles (targetTitlesObject, toFID, callback, callbackParam);
  });

}

function gotTargetFolderTitles (targetTitlesObject, toFID, callback, callbackParam) {

  if (toFID === "home") {
    if (titlesToMove.folders) {
      $.each(titlesToMove.folders, function(fid, ftitle) {
        if (targetTitlesObject.folders) {
          targetTitlesObject.folders[fid] = ftitle;
        } else {
          targetTitlesObject.folders = {};
          targetTitlesObject.folders[fid] = ftitle;
        }
      });
    }
  }

  if (titlesToMove.photos) {
    $.each(titlesToMove.photos, function(pid, ptitle) {
      if (targetTitlesObject.photos) {
        targetTitlesObject.photos[pid] = ptitle;
      } else {
        targetTitlesObject.photos = {};
        targetTitlesObject.photos[pid] = ptitle;
      }
    });
  }

  // all titles appended. now encrypt and re-save onto target.
  encryptAndUploadTitles (targetTitlesObject, toFID, function(){

    // target folder now has all the titles merged.
    // delete moved titles from old one by setting them to null.

    if (titlesToMove.folders) {
      $.each(titlesToMove.folders, function(fid, ftitle) {
        delete activeItemsObject[fid];
        $("#" + fid).remove();
      });
    }

    if (titlesToMove.photos) {
      $.each(titlesToMove.photos, function(pid, ptitle) {
        delete activeItemsObject[pid];
        $("#" + pid).remove();
      });
    }

    titlestoMove = {};
    titlesToMove.photos = {};
    titlesToMove.folders = {};

    updateTitles(callback, callbackParam);
  });
}

$("#folder-contents").on("keydown", '.phototitle, .albumtitle', function(event) {
  var theinput = $(this);
  setTimeout(function(){
    if (event.keyCode == 13) { theinput.blur(); }
  },50);
});

$("#folder-contents").on("blur", '.phototitle, .albumtitle', function(event) {
  if ($(this).val().trim() === "" || $(this).val().trim() === " ") {
    $(this).val("Unnamed");
  }

  var input = $(this);
  var fidOrPid = $(this).parents(".folder-content").attr("id");

  if (input.attr("placeholder") !== input.val().trim()) {
    input.parents(".folder-content").find(".photo").addClass("is-loading");
    input.parents(".folder-content").find(".album").addClass("is-loading");

    if (input.attr("ext")) {
      activeItemsObject[fidOrPid].title = input.val().trim() + "." + input.attr("ext");
    } else {
      activeItemsObject[fidOrPid].title = input.val().trim();
    }

    updateTitles(function(){
      if (input.hasClass("albumtitle")){
        updateFolderTitle(fidOrPid, input.val().trim(), function(){
          input.parents(".folder-content").find(".photo").removeClass("is-loading");
          input.parents(".folder-content").find(".album").removeClass("is-loading");
          input.attr("placeholder", input.val().trim());
          console.log("folder title updated.");
        });
      } else {
        input.parents(".folder-content").find(".photo").removeClass("is-loading");
        input.parents(".folder-content").find(".album").removeClass("is-loading");
        input.attr("placeholder", input.val().trim());
      }
    });
  }
});









////////////////////////////////////////////////////
//////////////////   DELETE FOLDER    //////////////
////////////////////////////////////////////////////

var fidToDelete;
$("#folder-contents").on("click", '.deletefoldericon', function(event){
  event.stopPropagation(); event.preventDefault();
  var albumTitle = $(this).parents(".albumitem").find("input").val();
  var fid = $(this).parents(".albumitem").attr("id");
  fidToDelete = fid;
  $(".delete-folder-name").html(albumTitle);
  showModal("delete-album-modal");
});

var noItemsLeftToDelete;
function confirmDeleteFolder () {
  progressModal("delete-album-modal");
  if (fidToDelete !== activeFID) {
    var fid = fidToDelete;
    homeRef.doc(fid).collection(fid).get().then(function(items) {

      if (items.docs.length > 0) {
        noItemsLeftToDelete = items.docs.length;
        items.docs.forEach(function(item) {
          var pid = item.data().id;
          var tid = pid.replace("p-", "t-");
          var lid = pid.replace("p-", "l-");
          var photoRef = rootRef.child(pid + ".crypteefile");
          var thumbRef = rootRef.child(tid + ".crypteefile");
          var lightRef = rootRef.child(lid + ".crypteefile");

          photoRef.delete().then(function() {
            thumbRef.delete().then(function() {
              lightRef.delete().then(function() {

                noItemsLeftToDelete--;
                if (noItemsLeftToDelete === 0) {
                  var collectionRefToDelete = homeRef.doc(fid).collection(fid);
                  deleteCollection (collectionRefToDelete).then(function(){
                    homeRef.doc(fid).delete().then(function(){
                      titlesRef.doc(fid).delete().then(function(){
                        deleteFolderComplete(fid);
                      });
                    });
                  });
                }

              });
            });
          });
        });
      } else {
        homeRef.doc(fid).delete().then(function(){
          deleteFolderComplete(fid);
        });
      }
    });
  } else {
    homeFolderLoaded = false; otherFolderLoaded = false;
    getHomeFolder();
    hideModal("delete-album-modal");
  }
}

function deleteFolderComplete(fid) {
  hideModal("delete-album-modal");
  $("#"+fid).remove();
  delete activeItemsObject[fid];
  updateTitles();
}

$("#folder-contents").on("click", '.settingsicon', function(event) {
  event.stopPropagation();
  var fid = $(this).parents(".albumitem").attr("id");
  $(this).parents(".albumitem").find(".albumtitle").addClass("armed");
  $(this).parents(".albumitem").find(".deletefoldericon").addClass("armed");
  $(this).parents(".albumitem").find(".ghostfoldericon").addClass("armed");

  setTimeout(function(){ closeFolderSettings(fid); }, 5000);
});

$("#folder-contents").on("mouseleave", '.albumitem', function(event) {
  event.stopPropagation();
  var fid = $(this).attr("id");

  setTimeout(function(){ closeFolderSettings(fid); }, 5000);
});

function closeFolderSettings(fid) {
  $("#"+fid).find(".albumtitle").removeClass("armed");
  $("#"+fid).find(".deletefoldericon").removeClass("armed");
  $("#"+fid).find(".ghostfoldericon").removeClass("armed");
}


////////////////////////////////////////////////////
//////////////////    GHOST FOLDER    //////////////
////////////////////////////////////////////////////

var fidToGhost;
$("#folder-contents").on("click", '.ghostfoldericon', function(event) {
  event.stopPropagation(); event.preventDefault();
  var albumTitle = $(this).parents(".albumitem").find("input").val().toUpperCase();
  var fid = $(this).parents(".albumitem").attr("id");
  fidToGhost = fid;
  $("#ghost-folder-confirm-input").val(albumTitle);
  $("#ghost-folder-confirm-input").attr("placeholder", albumTitle);
  showModal("ghost-album-modal");
});

$("#ghost-folder-confirm-input").on('keydown', function(event) {
  setTimeout(function(){
    var valueTyped = $("#ghost-folder-confirm-input").val().toUpperCase();
    var valueToConfirm = $("#ghost-folder-confirm-input").attr("placeholder");
    if (valueTyped === valueToConfirm) {
      $("#ghost-folder-confirm-button").attr("disabled", false).prop("disabled", false);
    } else {
      $("#ghost-folder-confirm-button").attr("disabled", true).prop("disabled", true);
    }

    if (event.keyCode == 27) {
      $("#ghost-folder-confirm-button").attr("disabled", true).prop("disabled", true);
      $("#ghost-folder-confirm-input").val("");
      $("#ghost-folder-confirm-input").blur();
      hideModal("ghost-album-modal");
    }
  },50);
});

function makeGhostFolder () {
  progressModal("ghost-album-modal");
  fixFilesAndFolders(function(){
    var titleHashToGhost = hashString($("#ghost-folder-confirm-input").val().toUpperCase());

    var makeGhostAlbum = cloudfunctions.httpsCallable('makeGhostAlbum');
    makeGhostAlbum({hash: titleHashToGhost, fid : fidToGhost}).then(function(result) {

      var functionResponse = result.data;
      if (functionResponse) {
        if (functionResponse.status === "done"){
          // all set. album ghosted.
          doneGhosting();
        }
        if (functionResponse.error){
          unprogressModal("ghost-album-modal");
          $("#ghost-album-modal").find(".theStatus").html("<p>Something went wrong. Please try again.</p>").show();
        }
      }

    }).catch(function(error) {
      unprogressModal("ghost-album-modal");
      $("#ghost-album-modal").find(".theStatus").html("<p>Something went wrong. Please try again.</p>").show();
      console.log(error);
    });
  });
}

function doneGhosting(){
  $("#"+fidToGhost).remove();
  delete activeItemsObject[fidToGhost];
  updateTitles(function(){
    hideModal("ghost-album-modal");
  });
}

var titleToSummon;
var summonedFID;
var summonedTitle;
var somethingSummoned = false;

function summonGhostFolder () {
  progressModal("photos-summon-ghost-album-modal");
  fixFilesAndFolders(function(){
    titleToSummon = $("#ghost-folder-summon-input").val().toUpperCase();
    var titleHashToSummon = hashString(titleToSummon);

    // CLIENTSIDE ONCE GOT THE CONFIRMATION :

    var summonGhostAlbum = cloudfunctions.httpsCallable('summonGhostAlbum');
    summonGhostAlbum({hash: titleHashToSummon}).then(function(result) {
      var functionResponse = result.data;
      if (functionResponse) {
        if (functionResponse.status === "done"){
          // all set. album ghosted.

          somethingSummoned = true;
          summonedFID = functionResponse.fid;
          summonedTitle = titleToSummon;
          titleToSummon = "";

          homeFolderLoaded = false; otherFolderLoaded = false;
          getHomeFolder(function(){ // we save the ghost title into activeItemsObject['id'].title in processTitles in getHomeFolder here.
            updateTitles(function(){
              hideModal("photos-summon-ghost-album-modal");
            });
          });
        }

        if (functionResponse.error){
          unprogressModal("photos-summon-ghost-album-modal");
          $("#photos-summon-ghost-album-modal").find(".theStatus").html("<p>Something went wrong. Please try again.</p>").show();
        }

        if (functionResponse.nope) {
          unprogressModal("photos-summon-ghost-album-modal");
          $("#photos-summon-ghost-album-modal").find(".theStatus").html("<p>No ghost folders found with this title.</p>").show();
        }
      }

    }).catch(function(error) {
      unprogressModal("photos-summon-ghost-album-modal");
      $("#photos-summon-ghost-album-modal").find(".theStatus").html("<p>Something went wrong. Please try again.</p>").show();
      console.log(error);
    });
  });
}






////////////////////////////////////////////////////
//////////////////   SELECTIONS     ////////////////
////////////////////////////////////////////////////

var selectionsObject = {};

function updateSelections () {
  var selectionsArray = Object.keys(selectionsObject);
  var activeTitlesArray = Object.keys(activeItemsObject);
  activeTitlesArray.forEach(function(id){
    if (id.startsWith("p-")) {
      if (selectionsArray.indexOf(id) !== -1) {
        $("#" + id).addClass("selected");
      } else {
        $("#" + id).removeClass("selected");
      }
    }
  });

  var numberOfSelections = selectionsArray.length;

  if (numberOfSelections > 0) {
    $(".normal-nav-item").hide();
    $(".selection-nav-item").show();

    if (numberOfSelections === 1 && activeFID !== "home") {
      $("#photos-set-thumb-button").removeClass("unavailable");
    } else {
      $("#photos-set-thumb-button").addClass("unavailable");
    }

    $("#photos-del-sel-modal-toggle-button").attr("disabled", false).prop("disabled", false);
  } else {
    if (!selectionmode) {
      $(".normal-nav-item").show();
      $(".selection-nav-item").hide();
    }

    $("#photos-del-sel-modal-toggle-button").attr("disabled", true).prop("disabled", true);
  }

  if (numberOfSelections <= 1) {
    $(".number-of-selections").html(numberOfSelections + "<span class='hiddenForFinger'> photo</span>");
  } else {
    $(".number-of-selections").html(numberOfSelections + "<span class='hiddenForFinger'> photos</span>");
  }
}

var completedDeletions;
function deleteSelections() {
  progressModal("photos-delete-selections-modal");
  completedDeletions = 0;

  getFolderThumbnail(activeFID, function(thumb){
    var isFolderThumbDeleted = false;
    $.each(selectionsObject, function(pid) {

      var whereFrom;
      if (activeFID === "home") {
        whereFrom = homeRef.doc(pid);
      } else {
        whereFrom = homeRef.doc(activeFID).collection(activeFID).doc(pid);
      }

      try { if (pid === thumb.replace("t-", "p-")) { isFolderThumbDeleted = true; } } catch (e) { }
      var tid = pid.replace("p-", "t-");
      var lid = pid.replace("p-", "l-");

      var photoRef = rootRef.child(pid + ".crypteefile");
      var thumbRef = rootRef.child(tid + ".crypteefile");
      var lightRef = rootRef.child(lid + ".crypteefile");

      photoRef.delete().then(function() {
        thumbRef.delete().then(function() {
          lightRef.delete().then(function() {
            whereFrom.delete().then(function() {
              areDeletionsComplete(pid, isFolderThumbDeleted);
            });
          });
        });
      }).catch(function(error) {
        if (error.code === "storage/object-not-found") {
          thumbRef.delete();
          whereFrom.delete();
          lightRef.delete();
          areDeletionsComplete(pid, isFolderThumbDeleted);
        } else {
          handleError(error);
          $("#photos-delete-selections-modal").find(".button.is-success").removeClass("is-loading").prop("disabled", false).attr("disabled", false);
          $(".delete-selections-status").removeClass("is-light is-warning is-danger").addClass("is-danger").html("<p class='title'>Error Deleting Doc... Sorry.. Please Reload the page.</p>");
        }
      });
    });

  });
}

function areDeletionsComplete(pid, isFolderThumbDeleted) {
  completedDeletions++;
  if (Object.keys(selectionsObject).length === completedDeletions) {
    if (activeFID !== "home") {
      var adjustmentCount = 0 - Object.keys(selectionsObject).length;
      adjustFolderCount (activeFID, adjustmentCount, isFolderThumbDeleted);
    }

    Object.keys(selectionsObject).forEach(function(pid){
      delete activeItemsObject[pid];
    });

    $(".selected").remove();
    selectionsObject = {};

    updateTitles(function(){
      hideModal("photos-delete-selections-modal");
      clearSelections();

      if (activeFID === "home") {
        if ($(".folder-content").length > 0) {
          // hide empty after delete? idk how the fuck this would happen but still.
          hideEmptyFolderDialog();
        } else {
          showEmptyFolderDialog();
        }
      }
    });
  }
}

function clearSelections() {
  selectionmode = false;
  selectionsObject = {};
  $(".photo-selection").removeClass("selectionmode");
  updateSelections();
}

function selectAll() {

  Object.keys(activeItemsObject).forEach(function(id){
    if (id.startsWith("p-")) {
      selectionsObject[id] = activeItemsObject[id].title;
    }
  });

  updateSelections();
}

$("#folder-contents").on('click', '.photo-selection', function(event) {
  if (!isMobile) {
    event.preventDefault(); event.stopPropagation(); var shifted = event.shiftKey;

    if (shifted) {
      var foldercontent = $(this).parents(".folder-content");
      selectionsObject[foldercontent.attr("id")] = activeItemsObject[foldercontent.attr("id")].title;

      var shiftSel = foldercontent.prevUntil(".selected", ".photoitem");
      shiftSel.each(function(i, selection) {
        var selpid = $(selection).attr("id");
        selectionsObject[selpid] = activeItemsObject[selpid].title;
      });

    } else {
      var selection = $(this).parents(".folder-content");

      if (selection.attr("id") in selectionsObject) {
        delete selectionsObject[selection.attr("id")];
      } else {
        selectionsObject[selection.attr("id")] = activeItemsObject[selection.attr("id")].title;
      }

      if (window.navigator && window.navigator.vibrate) {
        navigator.vibrate(100);
      }
    }
    updateSelections();
  }
});

function selectionModeOn () {
  $(".normal-nav-item").hide();
  $(".selection-nav-item").show();
  $(".photo-selection").addClass("selectionmode");
  selectionmode = true;
}

////////////////////////////////////////////////////
////////////////   LOAD PHOTO     //////////////////
////////////////////////////////////////////////////
var selectionmode = false;
var preparingToDisplayPhoto = false;

$("#folder-contents").on("click", '.photoitem', function(event) {
  var shifted = event.shiftKey;
  var selPhoto = $(this);
  var pid = selPhoto.attr("id");

  if (event.target.tagName.toLowerCase() !== "input" && !preparingToDisplayPhoto && !$("#lightbox-modal").hasClass("is-active")) {
    if (selectionmode || Object.keys(selectionsObject).length > 0)  {
      if (shifted) {

        selectionsObject[pid] = activeItemsObject[pid].title;

        var shiftSel = selPhoto.prevUntil(".selected", ".photoitem");
        shiftSel.each(function(i, selection) {
          var selpid = $(selection).attr("id");
          selectionsObject[selpid] = activeItemsObject[selpid].title;
        });

      } else {
        var selection = selPhoto;

        if (selection.attr("id") in selectionsObject) {
          delete selectionsObject[selection.attr("id")];
        } else {
          selectionsObject[selection.attr("id")] = activeItemsObject[selection.attr("id")].title;
        }

        if (window.navigator && window.navigator.vibrate) {
          navigator.vibrate(100);
        }

      }
      updateSelections();
    } else {
      loadPhoto(pid, selPhoto.find(".phototitle").val(), "display");
    }
  }
});








function loadPhoto (pid, ptitle, displayOrDownload, callback, callbackParam) {
  callback = callback || noop;
  if (pid !== "" && pid !== " " && pid !== undefined && pid !== null) {
    preparingToDisplayPhoto = pid;
    $("#" + pid).find(".photo").addClass("is-loading");

    var lid = pid.replace("p", "l");
    var photoRef = rootRef.child(pid + ".crypteefile");
    var lightRef = rootRef.child(lid + ".crypteefile");

    if (displayOrDownload === "download"){
      // use original
      useOriginal();
    } else {
      // TRY USING LIGHTBOX
      useLightboxPrev();
    }

    function useOriginal () {
      photoRef.getDownloadURL().then(function(originalDownloadURL) {
        gotMeta(originalDownloadURL);
      }).catch(function(error) {
        var errorText;
        handleError(error);
        switch (error.code) {
          case 'storage/object-not-found':
            // File or doc doesn't exist at all ~ shit. alright let's try to repair things.
            fixFile(pid);
            break;
          case 'storage/unauthorized':
            // File or doc doesn't exist at all ~ shit. alright let's try to repair things. // Chances are we've got a problem.
            fixFilesAndFolders();
            break;
        }
        $("#" + pid).find(".photo").addClass("is-loading");
      });
    }

    function useLightboxPrev () {
      lightRef.getDownloadURL().then(function(lightboxDownloadURL) {
        gotMeta(lightboxDownloadURL);
      }).catch(function(error) {
        if (error.code === 'storage/object-not-found') {
          // fallback for legacy photo without preview image. so load original.
          useOriginal();
        }
      });
    }

    function gotMeta (downloadURL) {

      $.ajax({ url: downloadURL, type: 'GET',
          success: function(encryptedPhoto){
            photoLoaded(pid, ptitle, encryptedPhoto, null, displayOrDownload, callback, callbackParam);
          },
          error:function (xhr, ajaxOptions, thrownError){
            console.log(thrownError);
            var errorText = "A rather strange error happened! Please try reloading. Please try again shortly, or contact our support. We're terribly sorry about this.";
            // showDocProgress(errorText);
            setTimeout(function(){ window.location.reload(); }, 2500);
          }
      }).progress(function(e) {
        $("#" + pid).find(".photo").addClass("is-loading"); // to make sure photo looks loading if user tapped on photo while it was still loading thumb, then loading indicator was removed.
      });
    }

  } else {
    handleError("Load Photo : Blank PID");
  }
}




var queuePhoto;

function photoLoaded (pid, ptitle, encryptedPhoto, psize, displayOrDownload, callback, callbackParam) {
  callback = callback || noop;
  displayOrDownload = displayOrDownload || "display";
  var encryptedB64 = JSON.parse(encryptedPhoto).data;
  $("#" + pid).find(".photo").addClass("is-loading"); // to make sure photo looks loading if user tapped on photo while it was still loading thumb, then loading indicator was removed.
  openpgp.decrypt({ message: openpgp.message.readArmored(encryptedB64),   passwords: [theKey],  format: 'utf8' }).then(function(plaintext) {
    $("#" + pid).find(".photo").addClass("is-loading"); // to make sure photo looks loading if user tapped on photo while it was still loading thumb, then loading indicator was removed.
    var decryptedPhoto = plaintext.data;
    if (displayOrDownload === "download"){
      downloadPhotoToDisk(pid, ptitle, decryptedPhoto, callback, callbackParam);
    } else {
      displayPhoto(pid, ptitle, psize, decryptedPhoto, callback, callbackParam);
    }
  });
}

var nextB64, nextTitle, nextPID, nextSize;
function loadNextFromPID (pid, callback, callbackParam) {
  callback = callback || noop;
  nextPID = $("#sr-"+pid).next(".photos-search-result").attr("pid") || $(".photos-search-result").first().attr("pid") || $("#"+pid).nextUntil(".photoitem").last().next().attr("id") || $("#"+pid).next(".photoitem").attr("id") || $(".photoitem").first().attr("id");
  nextTitle = $("#sr-"+pid).next(".photos-search-result").attr("ptitle") || $(".photos-search-result").first().attr("ptitle") || $("#"+pid).nextUntil(".photoitem").last().next().find(".phototitle").val() || $("#"+pid).next(".photoitem").find(".phototitle").val() || $(".photoitem").first().find(".phototitle").val();

  function gotMeta(photoURL) {
    $.ajax({ url: photoURL, type: 'GET',
      success: function(encryptedPhoto){
        var encryptedB64 = JSON.parse(encryptedPhoto).data;
        openpgp.decrypt({ message: openpgp.message.readArmored(encryptedB64),   passwords: [theKey],  format: 'utf8' }).then(function(plaintext) {
          nextB64 = plaintext.data;
          $("#lightbox-next-photo").attr("src", nextB64);
          $("#nextPhotoTitle").val(nextTitle);
          $("#lightbox-next-photo-button").removeClass("is-loading");
          $("#lightbox-photo").removeClass("wait");
          $("#lightbox-spinner").removeClass("wait");
          if (queuePhoto === "next") { showNextPhoto(); queuePhoto = ""; }
          callback(callbackParam);
        });
      }
    });
  }

  if (nextPID !== undefined) {
    var nextOriginalRef = rootRef.child(nextPID + ".crypteefile");
    var nextLightboxRef = rootRef.child(nextPID.replace("p", "l") + ".crypteefile");

    $("#lightbox-next-photo-button").addClass("is-loading").show();

    nextLightboxRef.getDownloadURL().then(function(nextLightDownloadURL) {
        gotMeta(nextLightDownloadURL);
    }).catch(function(error) {
      if (error.code === 'storage/object-not-found') {
        // LEGACY PHOTO WITHOUT PREVIEW PHOTO, LOAD ORIGINAL INSTEAD.
        nextOriginalRef.getDownloadURL().then(function(nextOriginalDownloadURL) {
          gotMeta(nextOriginalDownloadURL);
        }).catch(function(error) {
          //
        });
      }
    });

  } else {
    $("#lightbox-previous-photo-button").hide();
    $("#lightbox-next-photo-button").hide();
  }
}

var prevB64, prevTitle, prevPID, prevSize;
function loadPrevFromPID (pid, callback, callbackParam) {
  callback = callback || noop;
  prevPID = $("#sr-"+pid).prev(".photos-search-result").attr("pid") || $(".photos-search-result").last().attr("pid") || $("#"+pid).prevUntil(".photoitem").last().prev().attr("id") || $("#"+pid).prev(".photoitem").attr("id") || $(".photoitem").last().attr("id");
  prevTitle = $("#sr-"+pid).prev(".photos-search-result").attr("ptitle") || $(".photos-search-result").last().attr("ptitle") || $("#"+pid).prevUntil(".photoitem").last().prev().find(".phototitle").val() || $("#"+pid).prev(".photoitem").find(".phototitle").val() || $(".photoitem").last().find(".phototitle").val();

  function gotMeta (photoURL) {
    $.ajax({ url: photoURL, type: 'GET',
      success: function(encryptedPhoto){
        var encryptedB64 = JSON.parse(encryptedPhoto).data;
        openpgp.decrypt({ message: openpgp.message.readArmored(encryptedB64),   passwords: [theKey],  format: 'utf8' }).then(function(plaintext) {
          prevB64 = plaintext.data;
          $("#lightbox-previous-photo").attr("src", prevB64);
          $("#prevPhotoTitle").val(prevTitle);
          $("#lightbox-previous-photo-button").removeClass("is-loading");
          $("#lightbox-photo").removeClass("wait");
          $("#lightbox-spinner").removeClass("wait");
          if (queuePhoto === "prev") { showPrevPhoto(); queuePhoto = ""; }
          callback(callbackParam);
        });
      }
    });
  }

  if (prevPID !== undefined) {
    var prevOriginalRef = rootRef.child(prevPID + ".crypteefile");
    var prevLightboxRef = rootRef.child(prevPID.replace("p", "l") + ".crypteefile");

    $("#lightbox-previous-photo-button").addClass("is-loading").show();

    prevLightboxRef.getDownloadURL().then(function(prevLightboxDownloadURL) {
      gotMeta (prevLightboxDownloadURL);
    }).catch(function(error) {
      if (error.code === 'storage/object-not-found') {
        prevOriginalRef.getDownloadURL().then(function(prevOriginalDownloadURL) {
          // LEGACY PHOTO WITHOUT PREVIEW PHOTO, LOAD ORIGINAL INSTEAD.
          gotMeta (prevOriginalDownloadURL);
        }).catch(function(error) {
          //
        });
      }
    });

  } else {
    $("#lightbox-previous-photo-button").hide();
  }
}


function displayPhoto (pid, ptitle, psize, pb64, callback, callbackParam) {
  callback = callback || noop;

  $(".lightboxPhotoTitle").html(ptitle);

  setTimeout(function(){
    if (psize !== null && psize !== undefined && psize !== "") {
      $("#lightboxPhotoDetails").html(formatBytes(psize));
    } else {
      var photoRef = rootRef.child(pid + ".crypteefile");
      photoRef.getMetadata().then(function(originalMetadata) {
        var gotSize = originalMetadata.size;
        $("#lightboxPhotoDetails").html(formatBytes(gotSize));
      });
    }
  }, 250);

  history.pushState(pid, null, '/photos?p='+pid);

  var photoOrientation = 1;

  /// YOU JUST GOT A PREVIEW IMAGE GENERATED FROM CANVAS. DOESN'T HAVE EXIF.
  // IT'S ALREADY ORIENTATION CORRECTION WHILE CREATING PREVIEW.
  // TEMPORARILY DISABLE ALL EXIF FOR NOW. IMPLEMENT SAVING EXIF SEPARATELY
  // IMPLEMENT NEXT AND PREV JUST LIKE THE INITIAL LOAD (WITH FALLBACKS TO ORIGINAL IF NEEDED.)

  // getEXIF(pb64,function(exif, error){
  //   if(!error && exif !== {}) {
  //     var lat = "", lon = "", date = "", fNum = "", iso = "", make = "", model = "";
  //     var visibleInfoNum = 4;
  //
  //     if (exif.GPSLatitude) {
  //       lat = (exif.GPSLatitude[0] + "° " + exif.GPSLatitude[1] + "' " + exif.GPSLatitude[2] + '" ' + exif.GPSLatitudeRef);
  //       lon = (exif.GPSLongitude[0] + "° " + exif.GPSLongitude[1] + "' " + exif.GPSLongitude[2] + '" ' + exif.GPSLongitudeRef);
  //       $("#exif-globe").show();
  //     } else {
  //       $("#exif-globe").hide();
  //       visibleInfoNum--;
  //     }
  //
  //     if (exif.DateTime) {
  //       date = exif.DateTime;
  //       $("#exif-clock").show();
  //     } else {
  //       $("#exif-clock").hide();
  //       visibleInfoNum--;
  //     }
  //
  //     if (exif.FNumber && exif.ISOSpeedRatings){
  //       fNum = exif.FNumber;
  //       iso = exif.ISOSpeedRatings;
  //       $("#exif-cogs").show();
  //     } else {
  //       $("#exif-cogs").hide();
  //       visibleInfoNum--;
  //     }
  //
  //     if (exif.Make && exif.Model) {
  //       make = exif.Make;
  //       model = exif.Model;
  //       $("#exif-camera").show();
  //     } else {
  //       $("#exif-camera").hide();
  //       visibleInfoNum--;
  //     }
  //
  //     if (exif.Orientation) {
  //       photoOrientation = exif.Orientation;
  //     }
  //
  //     $(".exif-date").html(date);
  //     $(".exif-coords").html(lat + " " + lon);
  //     $(".exif-lens").html("f" + fNum + ", ISO: " + iso);
  //     $(".exif-cam").html(make + " " + model);
  //
  //     if (visibleInfoNum > 0) {
  //       $(".exifButton").show();
  //     } else {
  //       $(".exifButton").hide();
  //     }
  //   } else {
      $(".exifButton").hide();
    // }


    $("#lightbox-photo").attr("src", pb64);
    $("#lightbox-photo").removeClass("wait lightbox-photo-orientation-1 lightbox-photo-orientation-2 lightbox-photo-orientation-3 lightbox-photo-orientation-4 lightbox-photo-orientation-5 lightbox-photo-orientation-6 lightbox-photo-orientation-7 lightbox-photo-orientation-8");
    // $("#lightbox-photo").addClass("lightbox-photo-orientation-" + photoOrientation);
    $("#lightbox-spinner").removeClass("wait");
    $(".lightboxPhotoMeta").fadeIn(250);

    $("#lightbox-photo").removeClass("exif");
    $(".lightboxExif").addClass("behind");

    showModal("lightbox-modal");

    activePID = pid;
    activePName = ptitle + "." + $("#"+pid).find(".phototitle").attr("ext");
    preparingToDisplayPhoto = false;
    $("#" + pid).find(".photo").removeClass("is-loading");
    callback(callbackParam);

    // this gives some buffer time to show photo loading animation more smoothly.
    setTimeout(function(){
      loadNextFromPID(pid);
      loadPrevFromPID(pid);
    },500)

  // });
}

function showPrevPhoto () {
  if (!$("#lightbox-previous-photo-button").hasClass("is-loading")) {
    displayPhoto(prevPID, prevTitle, prevSize, prevB64);
  } else {
    $("#lightbox-photo").addClass("wait");
    $("#lightbox-spinner").addClass("wait");
    $(".lightboxPhotoMeta").fadeOut(250);
    queuePhoto = "prev";
  }
}

function showNextPhoto () {
  if (!$("#lightbox-next-photo-button").hasClass("is-loading")) {
    displayPhoto(nextPID, nextTitle, nextSize, nextB64);
  } else {
    $("#lightbox-photo").addClass("wait");
    $("#lightbox-spinner").addClass("wait");
    $(".lightboxPhotoMeta").fadeOut(250);
    queuePhoto = "next";
  }
}

$("#lightbox-modal").on('swipeleft',  function(){
  if (isMobile) { showNextPhoto(); }
});

$("#lightbox-modal").on('swiperight',  function(){
  if (isMobile) { showPrevPhoto(); }
});

$("#lightbox-close").on('click', function(event) {
  event.preventDefault();
  closeLightbox();
});

function closeLightbox() {
  hideModal("lightbox-modal");
  if (activeFID === "home") {
    history.pushState("home", null, '/photos');
  } else {
    history.pushState(activeFID, null, '/photos?f='+activeFID);
  }

  try {
    var doc = window.document;
    var cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
    cancelFullScreen.call(doc);
  } catch (e) {
    // likely a phone
  }

}

function toggleExif() {
  if (!$("#lightbox-photo").hasClass("exif")) {
    $("#lightbox-photo").addClass("exif");
    $(".lightboxExif").removeClass("behind");
  } else {
    $("#lightbox-photo").removeClass("exif");
    $(".lightboxExif").addClass("behind");
  }
}


////////////////////////////////////////////////////
////////////////     SEARCH       //////////////////
////////////////////////////////////////////////////

var searchReady = false;
var firstSearchInit = false;
var searchArray = [];
var searchTimer;

var searchOptions = {
  shouldSort: true,
  threshold: 0.4,
  location: 0,
  distance: 100,
  maxPatternLength: 32,
  minMatchCharLength: 1,
  includeMatches: true,
  keys: [ "name", "fname" ]
};

$("#search-input").on('focus', function(event) {
  // INIT SEARCH QUERIES ALL FOLDERS' TITLES FOR FILENAMES.
  // THIS IS A VERY COSTLY OPERATION. BOTH COMPUTATIONALLY AND FINANCIALLY.
  // AND IT WILL LIKELY TAKE TIME. SO THE EASIEST WAY TO DO THIS IS
  // TO ONLY INDEX WHEN THE USER PRESSES SEARCH, WE SHOW A "PREPARING" INDICATOR
  // FOR A FEW SECONDS, GET ALL TITLES ETC. THEN RUN THE QUERY.
  // LATER ON WE DON'T REQUERY THIS UNLESS THERE WERE ANY CHANGES IN TITLES.
  // THIS ALLOWS US TO CREATE A FASTER SEARCH AFTER FIRST INIT.
  // AND WE CAN RE-INIT LATER IF NEEDED.

  if (!firstSearchInit) {
    firstSearchInit = true;
    initSearch();
  } else {
    if (didAnyTitlesObjectChange) {
      initSearch();
    } else {
      searchReady = true;
    }
  }
  lastActivityTime = (new Date()).getTime();
});

function initSearch () {
  //   get all titles.
  $("#search-bar").find(".button").addClass("is-loading");
  titlesRef.get().then(function(titles) {
    var howManyFolders = titles.docs.length;
    var currentFolderIndex = 0;

    if (howManyFolders >= 1) {
      titles.docs.forEach(function(titleObject){
        var titlesOfFolder = titleObject.data().titles;
        var fid = titleObject.id;
        var encryptedTitlesObject = JSON.parse(titlesOfFolder).data;
        openpgp.decrypt({ message: openpgp.message.readArmored(encryptedTitlesObject), passwords: [theKey], format: 'utf8' }).then(function(plaintext) {
          currentFolderIndex++;
          titlesObject = JSON.parse(plaintext.data);
          $.each(titlesObject.photos, function(pid, ptitle) {
            var theParsedFilename = ptitle;
            try { theParsedFilename = JSON.parse(ptitle); } catch (e) {}
            var fname = titlesObject.self || 'Home';
            searchArray.push({fid:fid, pid:pid, fname:fname, name:theParsedFilename});
          });
          if(currentFolderIndex === howManyFolders) {
            doneSearchIndexing();
          }
        });
      });
    } else {
      doneSearchIndexing();
    }

  }).catch(function(error) {
    doneSearchIndexing();
    console.log("Error getting titles of all folders");
    handleError(error);
  });

}

function doneSearchIndexing() {
  $("#search-bar").find(".button").removeClass("is-loading");
  didAnyTitlesObjectChange = false;
  searchReady = true;
}

var searchKeyDownTimer;
$("#search-input").on("keydown", function(event) {

  setTimeout(function(){
    if (event.keyCode === 27 || $("#search-input").val().trim() === "") {
      event.preventDefault();
      clearSearch();
    } else if (event.keyCode === 37 || event.keyCode === 38 || event.keyCode === 39 || event.keyCode === 40) {
      event.preventDefault();
    } else if (event.keyCode === 91) {
      event.preventDefault();
    } else if (event.keyCode === 93) {
      event.preventDefault();
    } else if (event.keyCode === 16) {
      event.preventDefault();
    } else if (event.keyCode === 17) {
      event.preventDefault();
    } else if (event.keyCode === 18) {
      event.preventDefault();
    } else if (event.keyCode === 20) {
      event.preventDefault();
    } else if (event.keyCode === 13) {
      $("#search-input").blur();
    } else {
      if (event.metaKey || event.ctrlKey || event.shiftKey) {
        event.preventDefault();
      } else {
        currentResultSelection = 0;
        clearTimeout(searchTimer);
        clearTimeout(searchKeyDownTimer);
        searchKeyDownTimer = setTimeout(function () {
          search($("#search-input").val().trim());
        }, 250);
      }
    }
  },50);

});



function search (term) {
  if (searchReady) {
    $("#search-button-icon").addClass("fa-close").removeClass("fa-search");
    var fuse = new Fuse(searchArray, searchOptions);
    var results = fuse.search(term);
    displaySearchResults(results, term);
  } else {
    setTimeout(function () {
      search (term);
    }, 10);
  }
  lastActivityTime = (new Date()).getTime();
}



function clearSearch () {
  $("#search-button-icon").removeClass("fa-close").addClass("fa-search");
  $("#search-input").val("");

  $("#photos-search-contents").removeClass("search-active");

  setTimeout(function () {
    $("#photos-search-contents").html("");
    $(".photos-top-nav, .photos-nav-spacer, #folder-contents").removeClass("search-active");
  }, 500);

  currentResultSelection = 0;
}


function displaySearchResults (results, term) {
  $("#photos-search-contents").html("");
  var resultsToAppend = [];
  $.each(results, function(i, rslt) {
    if (i <= 50) { // limits search results to max 50
      var result = rslt.item;
      var resultTitle = result.name;
      var resultFTitle = result.fname;
      var resultFID = result.fid;

      $.each(rslt.matches, function(i, mtch) {
        if (mtch.key === "name") {
          var pair = mtch.indices.shift();
          var resultname = [];
          // Build the formatted string
          for (var j = 0; j < resultTitle.length; j++) {
            var char = resultTitle.charAt(j);
            if (pair && j == pair[0]) {
              resultname.push('<u>');
            }
            resultname.push(char);
            if (pair && j == pair[1]) {
              resultname.push('</u>');
              pair = mtch.indices.shift();
            }
          }
          resultTitle = resultname.join('');
        }

        if (mtch.key === "fname") {
          var fpair = mtch.indices.shift();
          var resultfname = [];
          // Build the formatted string
          for (var k = 0; k < resultFTitle.length; k++) {
            var fchar = resultFTitle.charAt(k);
            if (fpair && k == fpair[0]) {
              resultfname.push('<u>');
            }
            resultfname.push(fchar);
            if (fpair && k == fpair[1]) {
              resultfname.push('</u>');
              fpair = mtch.indices.shift();
            }
          }
          resultFTitle = resultfname.join('');
        }
      });

      var srCard =
      '<div class="card photos-search-result sr-'+result.pid+'" pid="'+result.pid+'" ptitle="'+result.name+'" id="sr-'+result.pid+'">'+
      '  <div class="card-image photos-sr-photo" pid="'+result.pid+'">'+
      '    <figure class="image is-loading">'+
      '      <img src="" id="">'+
      '    </figure>'+
      '  </div>'+
      '  <div class="card-content">'+
      '     <p class="title is-5 photos-sr-photo"  pid="'+result.pid+'">'+resultTitle+'</p>'+
      '     <p class="subtitle is-6 photos-sr-folder" fid="'+result.fid+'" fname="'+result.fname+'"><span class="icon"><i class="fa fa-book"></i></span> '+resultFTitle+'</p>'+
      '  </div>'+
      '</div>';

      resultsToAppend.push(srCard);
    }
  });
  $("#photos-search-contents").append(resultsToAppend.join(""));

  $(".photos-top-nav, .photos-nav-spacer, #folder-contents").addClass("search-active");
  setTimeout(function () {
    $("#photos-search-contents").addClass("search-active");
  }, 500);

  searchTimer = setTimeout(function () {
    $.each(results, function(i, rslt) {
      var resultPID = rslt.item.pid;
      getThumbnail (resultPID);
    });
  }, 250);
}

$('#photos-search-contents').on('click', '.photos-sr-photo', function(event) {
  var image = $(this).parents(".photos-search-result").find(".image");
  image.addClass("is-loading");
  loadPhoto($(this).attr("pid"), $(this).attr("ptitle"), "display", function(){
    image.removeClass("is-loading");
  });
});

$('#photos-search-contents').on('click', '.photos-sr-folder', function(event) {
  clearSearch ();
  var fidToLoad = $(this).attr("fid");
  homeFolderLoaded = false; otherFolderLoaded = false;
  if (fidToLoad === "home") {
    getHomeFolder();
  } else {
    getAllFilesOfFolder (fidToLoad);
  }
});




////////////////////////////////////////////////////
/////////////     DOWNLOADS       //////////////////
////////////////////////////////////////////////////


function downloadSelections () {
  $.each(selectionsObject, function(pid) {
    var photoRef = rootRef.child(pid + ".crypteefile");
    var filename = $("#"+pid).find("input").val() + "." + $("#"+pid).find("input").attr("ext");
    loadPhoto(pid, filename, "download");
  });
}

function downloadPhotoToDisk (pid, ptitle, decryptedPhoto, callback, callbackParam) {
  callback = callback || noop;
  if (ptitle === ".jpg" || ptitle === undefined || ptitle === null) {
    ptitle = "Photo.jpg";
  }
  saveAs(dataURIToBlob(decryptedPhoto), ptitle);
  $("#"+pid).find(".photo").removeClass("is-loading");
  $("#lightbox-download").removeClass("is-loading");
  callback(callbackParam);
}

function downloadActiveLightboxPhotoToDisk () {
  if (isios) {
    showModal("ios-download-modal");
  } else {
    // NOT IOS PROCEED DOWNLOADING THE ORIGINAL.
    $("#lightbox-download").addClass("is-loading");
    var activePhotoOriginalRef = rootRef.child(activePID + ".crypteefile");
    activePhotoOriginalRef.getDownloadURL().then(function(downloadURL) {
      $.ajax({ url: downloadURL, type: 'GET',
        success: function(encryptedPhoto){
          var encryptedB64 = JSON.parse(encryptedPhoto).data;
          openpgp.decrypt({ message: openpgp.message.readArmored(encryptedB64),   passwords: [theKey],  format: 'utf8' }).then(function(plaintext) {
            var decryptedPhoto = plaintext.data;
            downloadPhotoToDisk(activePID, activePName, decryptedPhoto);
          });
        },
        error:function (xhr, ajaxOptions, thrownError){
          $("#lightbox-download").removeClass("is-loading");
          console.log(thrownError);
          var errorText = "A rather strange error happened! Please try reloading. Please try again shortly, or contact our support. We're terribly sorry about this.";
        }
      });
    }).catch(function(error) {
      var errorText;
      handleError(error);
      $("#lightbox-download").removeClass("is-loading");
      switch (error.code) {
        case 'storage/object-not-found':
          errorText = "Seems like this file doesn't exist or you don't have permission to open this doc. We're not sure how this happened.<br> Please try again shortly, or contact our support. We're terribly sorry about this.";
          // File or doc doesn't exist at all ~ shit. alright let's try to repair things.
          // Chances are we've got a problem.
          // showDocProgress(errorText);
          fixFile(pid);
          break;
        case 'storage/unauthorized':
          errorText = "Seems like this file doesn't exist or you don't have permission to open this doc. We're not sure how this happened.<br> Please try again shortly, or contact our support. We're terribly sorry about this.";
          // File or doc doesn't exist at all ~ shit. alright let's try to repair things.
          // Chances are we've got a problem.
          // showDocProgress(errorText);
          fixFilesAndFolders();
          break;
        case 'storage/canceled':
          errorText = "A strange error happened while trying to load this file. It might be because you may have closed your browser while this doc was being saved";
          // showDocProgress(errorText);
          break;
        case 'storage/unknown':
          errorText = "We can't seem to load this file. It's a mystery why. Somehow our servers are acting. Please try again shortly, or contact our support. We're terribly sorry about this.";
          // showDocProgress(errorText);
          break;
      }
    });
  }
}



////////////////////////////////////////////////////
/////////////       UPGRADE       //////////////////
////////////////////////////////////////////////////

$("#upgrade-button").on('click', function(event) {
  showUpgrade();
});

function showUpgrade () {
  $("#low-storage-warning").addClass("showLowStorage viaUpgradeButton");
}

$(".subscribe-button").on('click', function(event) {
  window.location = 'account?action=upgrade';
});
























//
