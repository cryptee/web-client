////////////////////////////////////////////////////
////////////////// ALL GLOBAL VARS /////////////////
////////////////////////////////////////////////////
var firestore = firebase.firestore();
var cloudfunctions = firebase.functions();


var theKey;
var keyToRemember = JSON.parse(sessionStorage.getItem('key')); // hashedKey
sessionStorage.removeItem('key');

if (localStorage.getItem('memorizedKey')) {
  keyToRemember = JSON.parse(localStorage.getItem('memorizedKey')); // hashedKey
}

var homeRef, titlesRef;
var connectedRef = db.ref(".info/connected");

var connected = false;
var upOrDownInProgress = false;

var activeFID = "home";

var activePID = "";
var activePName = "";

var bootOfflineTimer = setInterval(function() { if(!$("#key-modal").hasClass("shown")) { showBootOffline(); } }, 4000);
var thumbnailGenerator;
var homeLoaded = false;

var numberOfItemsPerSection = 50;
if (isMobile) {
  numberOfItemsPerSection = 25;
}

var lastActivityTime = (new Date()).getTime();
var inactivityInterval = setInterval(inactiveTimer, 1000);
var ww = $(window).width();

loadUserDetailsFromLS();
checkLatestVersion();

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




////////////////////////////////////////////////////////
/////////////////// CONNECTION STATUS  /////////////////
////////////////////////////////////////////////////////

var windowVisible;
document.addEventListener('visibilityChange', handleVisibilityChange, false);

$(window).on("focus", function () {
  checkLatestVersion();
  windowVisible = true;
});

$(window).on("blur", function () {
  windowVisible = false;
});

function handleVisibilityChange() {
  if (document[hidden]) {
    // hidden
    windowVisible = false;
  } else {
    // shown
    checkLatestVersion();
    windowVisible = true;
  }
}

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
  hideWindowProgress ();
}

function hideBootOffline () {
  $(".photos-offline").fadeOut(250);
}

////////////////////////////////////////////////////////
/////////////////// LOADING STATUS  /////////////////
////////////////////////////////////////////////////////

function showBackgroundProgress() {
  // $("#nav-logo").animate({opacity : 0}, 300, function(){
    $("#nav-logo").attr("src", "../assets/loading-f5f5f5.gif");
    // $("#nav-logo").animate({opacity : 1}, 300);
  // });
  $("#main-progress").removeAttr("value");
}

function hideBackgroundProgress() {
  // $("#nav-logo").animate({opacity : 0}, 300, function(){
    $("#nav-logo").attr("src", "../assets/cryptee-logo-b.svg");
    // $("#nav-logo").animate({opacity : 1}, 300);
  // });
  $("#main-progress").attr("value", "100");
}

function showWindowProgress () {
  showBackgroundProgress();
  $("#folder-contents").addClass("is-loading");
}

function hideWindowProgress () {
  hideBackgroundProgress();
  $("#folder-contents").removeClass("is-loading");
}

function showLibraryUpdate (msg) {
  showWindowProgress();
  $("#folder-contents").addClass("is-updating").attr("update-status", msg);
}

function hideLibraryUpdate () {
  hideWindowProgress();
  $("#folder-contents").removeClass("is-updating");
}




////////////////////////////////////////////////////////
/////////////////////// IDLE TIMER  ////////////////////
////////////////////////////////////////////////////////

function inactiveTimer () {
  var now = (new Date()).getTime();
  var timeoutAmount = userPreferences.general.inactivityTimeout * 60000; // default is 30 mins

  if (timeoutAmount !== 0) {
    if (now - lastActivityTime > timeoutAmount) {
      inactivityTimeout();
    }
  }
}


$(window).on("click", function(){
  lastActivityTime = (new Date()).getTime();
});





////////////////////////////////////////////////////
/////////////////// WINDOW EVENTS //////////////////
////////////////////////////////////////////////////

$(window).on("load", function(event) {
  if (ww > 768) {
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
  $("#photos-sort-nav").toggleClass("visible");
});

$(".sort-button").on('click', function(event) {
  $(".sort-button").removeClass("selected");
  $(this).addClass("selected");
  var sorttype = $(this).attr("id");

  setTimeout(function () {
    if (sorttype === "sort-az-asc") {
      sortByTitle();
    }
    if (sorttype === "sort-az-desc") {
      sortByTitle(true);
    }
    if (sorttype === "sort-date-asc") {
      sortByDate();
    }
    if (sorttype === "sort-date-desc") {
      sortByDate(true);
    }
  }, 250);
});

function sortByTitle (reverse){
  reverse = reverse || false;
  $(".sort-button").removeClass("selected");
  if (reverse) {
    $("#sort-az-desc").addClass("selected");
    $('.folder-content').sort(function(a, b) {
      if ($(a).attr("photositemname") > $(b).attr("photositemname")) {
        return -1;
      } else {
        return 1;
      }
    }).appendTo('#folder-contents');
  } else {
    $("#sort-az-asc").addClass("selected");
    $('.folder-content').sort(function(a, b) {
      if ($(a).attr("photositemname") < $(b).attr("photositemname")) {
        return -1;
      } else {
        return 1;
      }
    }).appendTo('#folder-contents');
  }

  hideWindowProgress();
}

function sortByDate (reverse){
  reverse = reverse || false;
  $(".sort-button").removeClass("selected");
  if (reverse) {
    // up -> down = newest -> oldest
    $("#sort-date-desc").addClass("selected");
    $('.folder-content').sort(function(a, b) {
      if ($(a).attr("datesort") > $(b).attr("datesort")) {
        return -1;
      } else {
        return 1;
      }
    }).appendTo('#folder-contents');
  } else {
    // up -> down = oldest -> newest
    $("#sort-date-asc").addClass("selected");
    $('.folder-content').sort(function(a, b) {
      if ($(a).attr("datesort") < $(b).attr("datesort")) {
        return -1;
      } else {
        return 1;
      }
    }).appendTo('#folder-contents');
  }

  hideWindowProgress();
}


////////////////////////////////////////////////////
////////////////// SIGN IN AND KEY /////////////////
////////////////////////////////////////////////////


firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    //got user 
    
    createUserDBReferences(user);

    checkForExistingUser(function(){
      if (keyToRemember) {
        checkKey();
      } else {
        showKeyModal();
      }
    });
    

    getToken();
    webAppURLController();
    lazyLoadUncriticalAssets();
  } else {
    // no user. redirect to sign in IF NOT WEBAPP
    webAppURLController("signin?redirect=photos");
  }
}, function(error){
  if (error.code !== "auth/network-request-failed") {
    handleError("Error Authenticating", error);
  }
});

function checkForExistingUser (callback){
  callback = callback || noop;

  db.ref('/users/' + theUserID + "/data/keycheck").once('value').then(function(snapshot) {
    if (snapshot.val() === null) {
      window.location = "signup?status=newuser";
    } else {
      callback();
    }
  });

}

function checkKey (key) {
  db.ref('/users/' + theUserID + "/data/keycheck").once('value').then(function(snapshot) {
    var encryptedStrongKey = JSON.parse(snapshot.val()).data; // or encrypted checkstring for legacy accounts

    if (key) {
      hashString(key).then(function(hashedKey){
        checkHashedKey(hashedKey);
      }).catch(function(e){
        wrongKey ("Wide Character Error");
      });
    } else {
      hashedKey = keyToRemember;
      checkHashedKey(hashedKey);
    }

    function checkHashedKey(hashedKey) {
      decrypt(encryptedStrongKey, [hashedKey]).then(function (plaintext) {
        rightKey(plaintext, hashedKey);
      }).catch(function (error) {
        checkLegacyKey(dataRef, key, hashedKey, encryptedStrongKey, function (plaintext) {
          rightKey(plaintext, hashedKey);
          // if it's wrong, wrongKey() will be called in checkLegacyKey in main.js
        });
      });
    }

  });
}

function rightKey (plaintext, hashedKey) {
  var theStrongKey = plaintext.data;

  $("#key-modal-decrypt-button").removeClass("is-loading");
  $("#key-status").removeClass("shown");
  $("#key-modal-signout-button").removeClass("shown");
  
  hideKeyModal();
  theKey = theStrongKey;
  keyToRemember = hashedKey;

  newEncryptedKeycheck(hashedKey,function(newKeycheck){
    var encryptedKeycheck = newKeycheck; // here we encrypt a timestamp using the hashedKey, and save this to localstore.
    localStorage.setItem("encryptedKeycheck", encryptedKeycheck); // we will use this in docs offline mode to verify the entered encryption key is correct.
    signInComplete();
  });
}












////////////////////////////////////////////////////
/////////////////// SIGN IN COMPLETE ///////////////
////////////////////////////////////////////////////


function signInComplete () {

  connectedRef.on("value", function(snap) { connectionStatus(snap.val()); });
  metaRef.on('value', function(userMeta) { gotMeta(userMeta); });
  dataRef.child("preferences").on('value', function(snapshot) { gotPreferences(snapshot.val()); });

  $(".photos-search").delay(750).animate({opacity: 1}, 500);
  $("#photos-top-nav").delay(750).animate({opacity: 1}, 500);    

  if (getUrlParameter("p")) {
    var pidToLoad = getUrlParameter("p");
    var slideIndex = getSlideIndex(pidToLoad);
    
    // don't load if it's not a photo in current folder
    if (slideIndex !== undefined) { 
      loadPhoto(getUrlParameter("p"), "", "display");
    }

    getHomeFolder();
  } else if (getUrlParameter("f")) {
    getAllFilesOfFolder(getUrlParameter("f"));
  } else {
    getHomeFolder();
  }
  didAnyTitlesObjectChange = true;

  if (isCanvasBlocked()) {
    setTimeout(function() {
      showCanvasBlockedModal();
    }, 1000);
  }

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
              console.log("Deleted corrupted item reference with id: ", itemID);
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

  try {
    // leave in try catch in case if pid or tid is undefined for some reason.
    handleError('Photo/Thumb not found, trying to fix', {"id":pidOrTid});
  } catch (e) {
    handleError('Photo/Thumb with undefined id not found, trying to fix');
  }

  doesTheOriginalExist(pidOrTid, function(originalLost){
    if (originalLost) {
      // ORIGINAL FILE LOST. DELETE BOTH THUMB AND ORIGINAL.
      handleError("Photo doesn't have original. Will sadly purge.", {"id":pidOrTid});
      sadlyPurgeFile(pidOrTid);
    } else {
      // ORIGINAL FILE EXISTS, LET'S CHECK IF THUMBNAIL IS MISSING.
      doesTheThumbnailExist(pidOrTid, function(thumbLost){
        if (thumbLost) {
          handleError("Thumb was missing, but found the original. Will try to regenerate.", {"id":pidOrTid});

          // THUMB IS MISSING, REGENERATE THUMBNAIL.
          // mimic the upload phase, but first download original, use generateThumbnail and go through the whole spiel to make it work from scratch.
          // this will definitely be more extensive than the original uploader.
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
  var fileRef = rootRef.child(tid.replace("p","t") + ".crypteefile");
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

  getFolderThumbnailID(activeFID, function(thumb){
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

    photoRef.delete().finally(function() {
      thumbRef.delete().finally(function() {
        lightRef.delete().finally(function() {
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
        thumbRef.delete().catch();
        whereFrom.delete().catch();
        lightRef.delete().catch();
        if (activeFID !== "home") {
          var adjustmentCount = 0 - Object.keys(selectionsObject).length;
          adjustFolderCount (activeFID, adjustmentCount, isFolderThumbDeleted);
        }
        $("#"+pid).remove();
        delete activeItemsObject[pid];
        updateTitles();
      } else {
        error.pid = pid;
        handleError("Error purging photo",error);
        $("#photos-delete-selections-modal").find(".button.is-success").removeClass("is-loading").prop("disabled", false).attr("disabled", false);
        $(".delete-selections-status").removeClass("is-light is-warning is-danger").addClass("is-danger").html("<p class='title'>Error Deleting Photo... Sorry.. Please Reload the page.</p>");
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
    showWindowProgress();
    $("body, html").animate({ scrollTop: "0px" }, 1000);
    homeRef.get().then(function(items) {
      if (!homeFolderLoaded) {
        history.replaceState("home", null, '/photos');
        $("#photos-new-folder-button, #photos-get-ghost-folder-button").removeClass("unavailable");
        $("#get-home-folder-button").addClass("unavailable");
        processItemsFromFirestore("home", items, callback, callbackParam);
        homeFolderLoaded = true; otherFolderLoaded = false;
      } else {
        hideWindowProgress();
      }
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
  showWindowProgress();
  $("body, html").animate({ scrollTop: "0px" }, 1000);
  homeRef.doc(fid).collection(fid).get().then(function(items) {
    if (!otherFolderLoaded) {
      history.pushState(fid, null, '/photos?f='+fid);
      $("#get-home-folder-button").removeClass("unavailable");
      $("#photos-new-folder-button, #photos-get-ghost-folder-button").addClass("unavailable");
      processItemsFromFirestore(fid, items, callback, callbackParam);
      homeFolderLoaded = false; otherFolderLoaded = true;      
    } else {
      hideWindowProgress();
    }
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
        hideWindowProgress();
      } else {
        getTitles(fid, contents, function(){
          $(".sort-button").removeClass("selected");
          $("#sort-az-asc").addClass("selected");
          hideWindowProgress();
          callback(callbackParam);
        });
      }
    });
  } else {
    hideWindowProgress();
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
    var folderObject = {"count" : 0, "id" : fid, "date" : "" };
    homeRef.doc(fid).set(folderObject, {
      merge: true
    }).then(function(response) {
      var titlesObject = {}; titlesObject.self = newFTitle;
      encryptAndUploadTitles (titlesObject, fid, function(){

        if (activeFID === "home") {
          activeItemsObject[fid] = {};
          activeItemsObject[fid].title = newFTitle;
          activeItemsObject[fid].pinky = null;
          activeItemsObject[fid].count = 0;
          activeItemsObject[fid].thumb = null;
        }

        hideEmptyFolderDialog();
        folderCreated(fid, newFTitle, function(){
          callback(callbackParam);
          sortByTitle();
        });
      });
    }).catch(function(error) {
      console.error("Error creating new folder: ", error);
    });
  }
}



////////////////////////////////////////////////////
/////////      HELPERS & ABSTRACTIONS       ////////
////////////////////////////////////////////////////

// THIS DOWNLOADS THE ORIGINAL, DECRYPTS, RETURNS B64 OR ERROR
// HEAVY OPERATION. BE CAREFUL WITH THIS. 

function getB64OfPhotoID (id, callback, errorCallback) {
  callback = callback || noop;
  errorCallback = errorCallback || noop;
  if (id) {     
    var fileRef = rootRef.child(id + ".crypteefile");
    fileRef.getDownloadURL().then(function(fileURL) {
      $.ajax({ url: fileURL, type: 'GET',
        success: function(encryptedFileContents){
          var theEncryptedFileContents = JSON.parse(encryptedFileContents).data;
          decrypt(theEncryptedFileContents, [theKey]).then(function(plaintext) {
            var decryptedContents = plaintext.data;
            callback(decryptedContents);
          }).catch(function(error) {
            errorCallback(error);
          });
        },
        error:function (xhr, ajaxOptions, thrownError){
          errorCallback(thrownError);
        }
      });
    }).catch(function(error) {
      
      error.pidOrTid = id;
      handleError("Error getting download URL for photo", error);
      errorCallback(error);

      switch (error.code) {
        case 'storage/object-not-found':
          fixFile(id);
          break;
        case 'storage/unauthorized':
          fixFilesAndFolders();
          break;
        case 'storage/canceled':
          break;
        case 'storage/unknown':
          break;
      }

    });
  } else {
    errorCallback(null);
  }
}



// THIS DOWNLOADS THE ORIGINAL, DECRYPTS, GETS B64 AND EXTRACTS DATE.
// SUPER HEAVY OPERATION. BE CAREFUL WITH THIS. 

function getEXIFDateStringOfPhotoID(pidOrTid, fid, callback, callbackParam) {
  callback = callback || noop;
  fid = fid || null;
  var date;
  var pid = pidOrTid.replace("t-", "p-").replace("l-", "p-");

  if (fid) {
    breadcrumb('[EXIF] – GETTING EXIF DATE OF: ' + pid);
    homeRef.doc(fid).collection(fid).doc(pid).get().then(function(item) {
      var photoObject = item.data();
      date = photoObject.date;
      if (date) {
        // if photo has date, use it
        breadcrumb('[EXIF] – GOT EXIF DATE OF: ' + pid);
        callback(date);
      } else {
        // photo doesn't have date, so extract from original
        breadcrumb('[EXIF] – COULDNT FIND EXIF DATE. MUST BE A LEGACY PHOTO. WILL EXTRACT FROM ORIGINAL: ' + pid);
        extractEXIFFromOriginalPhoto();
      }
    }).catch(function(error) {
      //photo doesn't exist!? try extracting from original
      breadcrumb('[EXIF] – COULDNT FIND EXIF DATE. MUST BE A LEGACY PHOTO. WILL EXTRACT FROM ORIGINAL: ' + pid);
      extractEXIFFromOriginalPhoto();
    });
  } else {
    // didn't get folder id reference, so can't use photo date even if there's any, extract from original
    breadcrumb('[EXIF] – COULDNT FIND EXIF DATE. MUST BE A LEGACY PHOTO. WILL EXTRACT FROM ORIGINAL: ' + pid);
    extractEXIFFromOriginalPhoto(); 
  }

  function extractEXIFFromOriginalPhoto() {
    breadcrumb('[EXIF] – DOWNLOADING ORIGINAL OF: ' + pid);
    getB64OfPhotoID(pid, function(origB64){
      if (origB64) {
        
        getEXIF(origB64, function (exif) {
          if (exif) {
            if (exif.DateTime) { 
              var date = exif.DateTime;
              callback(date);
            } else {
              // no date found in exif
              callback(null);
            }
          } else {
            // no exif found
            callback(null);
          }
        });
      
      } else {
        // couldn't get b64 of original. 
        callback(null);
      }
    }, function(error){
      // couldn't get b64 of original. 
      callback(null);
    });
  }

}



function timeFromEXIF (exifDateString) {
  var result = "";
  try {
    if (exifDateString.split(' ')[1]) {
      result = exifDateString.split(' ')[1];
    }   
  } catch (e) {}
  
  return result;
}



function dateFromEXIF (exifDateString) {
  var result = "";
  try {
    if (exifDateString.split(' ')[0]) {
      result = exifDateString.split(' ')[0];
    }   
  } catch (e) {}
  
  return result;
}



function fancyDate (dateString) {
  var result = null;
  if (dateString) {
    var months = ["", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    var year = dateString.split(":")[0].slice(2,4);
    var month = dateString.split(":")[1];
    var monthName = months[parseInt(month)];
    result = (monthName + " " + "&#39;" + year);
  }
  return result;
}

function sortableExifDate (dateString) {
  var result = "00000000";
  if (dateString) {
    var year = dateString.split(":")[0];
    var month = dateString.split(":")[1];
    var day = dateString.split(":")[2].split(" ")[0];
    result = year + "" + month + "" + day;
  }
  return result;
}



///////////////////////////////////////////////////
////////////////// FILE UPLOAD ////////////////////
///////////////////////////////////////////////////

function showFileUploadStatus (color, message) {
  if (!isMobile) {
    // on desktops we're now uploading 3 at a time, so this will be fucked up and use lots of memory.
    $("#upload-preview").hide();
  }

  $(".upload-status-message").html(message);
  if (color === "is-danger") { $("body").removeClass("disable-clicks"); }
  $("#photos-upload-status").addClass("is-active");
}

function hideFileUploadStatus () {  
  $("body").removeClass("disable-clicks");
  $("#upload-status").removeClass("is-dark is-light is-white is-danger is-success").addClass("is-white");
  $("#photos-upload-status").removeClass("is-active");
  $("#upload-status-contents").html("");
  $("#upload-preview").css("backgroundImage", 'url("")');
}

window.addEventListener('dragenter', handleDragEnter, false);
window.addEventListener('dragend', handleDragEnd, false);
window.addEventListener('dragleave', handleDragLeave, false);
window.addEventListener('dragover', handleDragOver, false);
window.addEventListener('drop', handlePhotosDrop, false);

if (!isCanvasBlocked()) {
  document.getElementById('upload-photo-to-folder').addEventListener('change', handlePhotoSelect, false);
} else {
  $("#upload-photo-to-folder").on('click', function(event) {
    event.preventDefault();
    showCanvasBlockedModal();
  });
}


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
          var forEachEntry = function(i) {
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
              forEachEntry(i + 1);
            });
          };
          forEachEntry(0);
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
  showFileUploadStatus("is-white", processingMessage);
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


          // if there are folders in the file tree uploaded,
          // create those albums now, and move things into them.
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
                  }, 3000);
                });
              }
            });
          } else {

            // no folders in the upload, awesome. update titles and we're good to go.
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

  // all files moved into folders if there were any. we can now safely purge filetree
  fileTreeToUpload = {};
  fileTreeToUpload.thecrypteehomefolder = {};
  fileTreeToUpload.thecrypteehomefolder.files = [];

  // and finally load the target folder once again to avoid double show up issues etc. and hide modal.
  if (hasFolders) {
    // means that we didn't call doneWithAllUploads in uploadCompleteAndFolderAdjusted, call it now.
    // a.k.a reload home / target folder
    doneWithAllUploads();
  } else {
    // doneWithAllUploads is already called in uploadCompleteAndFolderAdjusted so we're all good.

  }

}

function doneWithAllUploads(callback, callbackParam) {
  callback = callback || noop;

  if (activeFID !== "home") {
    otherFolderLoaded = false;
    getAllFilesOfFolder(activeFID, function(){
      if (!fileUploadError) {
        hideFileUploadStatus();
        callback(callbackParam);
      } else {
        showFileUploadStatus("is-danger", "Done uploading, but some of your files were not uploaded.<br><br><a class='button is-light' onclick='hideFileUploadStatus();'>Close</a>");
      }
    });
  } else {
    homeFolderLoaded = false;
    getHomeFolder(function(){
      if (!fileUploadError) {
        hideFileUploadStatus();
        callback(callbackParam);
      } else {
        showFileUploadStatus("is-danger", "Done uploading, but some of your files were not uploaded.<br><br><a class='button is-light' onclick='hideFileUploadStatus();'>Close</a>");
      }
    });
  }
}


function handlePhotoSelect(evt) {
  evt.stopPropagation();
  evt.preventDefault();
  if (theKey && theKey !== "") {
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
        showFileUploadStatus("is-white", processingMessage);
      }

    } else {
      setTimeout(function () {
        showFileUploadStatus("is-danger", "Unfortunately your browser or device does not support File API, which is what allows us to encrypt files on your device. Therefore we can't upload your file.");
      }, 10000);
    }
  }
}

function handlePhotosDrop (evt) {
  evt.stopPropagation();
  evt.preventDefault();

  if (theKey && theKey !== "") {
    $("#photos-drag-overlay").removeClass("shown");
    dragCounter = 0;
    somethingDropped = true;

    var targetfid = activeFID;

    if (isAPIAvailable()) {
      if (!isCanvasBlocked()){
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
          showFileUploadStatus("is-white", processingMessage);
        }
      } else {
        showCanvasBlockedModal(); 
      }

    } else {
      setTimeout(function () {
        showFileUploadStatus("is-danger", "Unfortunately your browser or device does not support File API, which is what allows us to encrypt files on your device. Therefore we can't upload your file.");
      }, 10000);
    }
  }

}

function handleDragEnter(evt) {
  if (dragCounter === 0) {
    if (theKey && theKey !== "") {
      // DRAG ENTERING DO SOMETHING ONCE
      $("#photos-drag-overlay").addClass("shown");
    }
  }

  dragCounter++;

  evt.stopPropagation();
  evt.preventDefault();
}

function handleDragLeave(evt) {
  dragCounter--;
  if (dragCounter === 0) {
    if (theKey && theKey !== "") {
      // DRAG LEFT DO SOMETHING ONCE
      $("#photos-drag-overlay").removeClass("shown");
    }
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
    // then decide how many photos should be uploaded simultaneously. Currently it's 1. 
    // And they use a shared canvas for memory optimization while generating thumbnails.

    nextUpload(callback, callbackParam); // starts upload with first file
  }, 100);
}

var numFilesUploading = 0;
var maxNumberOfSimultaneousUploads = 3;
if (isMobile) {
  maxNumberOfSimultaneousUploads = 1;
}
function nextUpload(callback, callbackParam) {
  callback = callback || noop;
  callbackParam = callbackParam || null;
  if (!isUploading) {
    isUploading = true; // stops next file / batch from going through right away.

    uploadList.forEach(function(upload, index) {

      if (upload.file) {
        if ( !upload.processed && (numFilesUploading < maxNumberOfSimultaneousUploads) ) {
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
          '<div class="upload" id="upload-'+slugify(upload.file.name)+'-'+upload.file.size+'">'+
            '<progress class="progress is-small is-danger" value="100" max="100"></progress>'+
            '<p class="deets fn">'+upload.file.name+'</p>'+
            '<p class="deets fs">Too Large (' + formatBytes(upload.file.size) + ')</p>'+
          '</div>';
          $("#upload-status-contents").append(uploadElem);
          document.title = "Cryptee | Uploading " + numFilesLeftToBeUploaded + " photo(s)";
        }
        // if file is too large or too many files uploading skip and wait until next round.
      }
      
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
      var fileExt = extensionFromFilename(filename);
      //THIS LINE IS TO MAKE SURE FILE HAS SOME CONTENTS AND MAKE THIS "TRY" FAIL IF IT'S EMPTY, LIKE WHEN IT IS A FOLDER.
      var fileContents = base64FileContents.substr(base64FileContents.indexOf(',')+1);

      if (fileExt.match(/^(jpg|jpeg|png)$/i)) {
        var processingMessage = "Encrypting and Uploading photo(s). <b>" + numFilesLeftToBeUploaded.toString() + " Photos</b> left.";
        showFileUploadStatus("is-white", processingMessage);
        encryptAndUploadPhoto(base64FileContents, predefinedPID, fid, filename, callback, callbackParam);
      } else {
        numFilesLeftToBeUploaded--;
        numFilesUploading--;
        fileUploadError = true;
        uploadElem =
        '<div class="upload" id="upload-'+slugify(file.name)+'-'+file.size+'">'+
          '<progress class="progress is-small is-danger" value="100" max="100"></progress>'+
          '<p class="deets fn">'+file.name+'</p>'+
          '<p class="deets fs">(Error)</p>'+
        '</div>';
        $("#upload-status-contents").append(uploadElem);
        isUploading = false; // allows next file to go through.
        // this allows users to quit the uploader if they only dragged a PDF or sth. that isn't supported.
        if (numFilesLeftToBeUploaded <= 0) {
          showFileUploadStatus("is-danger", "Some of your files were not uploaded.<br><br><a class='button is-light' onclick='hideFileUploadStatus();'>Close</a>");
          uploadCompleteResetUploaderState();
        } else {
          nextUpload(callback, callbackParam);
          document.title = "Cryptee | Uploading " + numFilesLeftToBeUploaded + " photo(s)";
        }
      }
    } catch (e) {
      // commenting out this error since it just causes anxiety for corrupted files
      // if (base64FileContents) { handleError("Error reading photo in processPhotoForUpload",e); }
      fileUploadError = true;
      showFolderUploadError();
      uploadElem =
      '<div class="upload" id="upload-'+slugify(file.name)+'-'+file.size+'">'+
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
      handleError("Error reading photo in processPhotoForUpload", err, "warning");
      uploadElem =
      '<div class="upload" id="upload-'+slugify(file.name)+'-'+file.size+'">'+
        '<progress class="progress is-small is-danger" value="100" max="100"></progress>'+
        '<p class="deets fn">'+file.name+'</p>'+
        '<p class="deets fs">(Error)</p>'+
      '</div>';
      $("#upload-status-contents").append(uploadElem);
      isUploading = false; // allows next file to go through.

      // this allows users to quit the uploader if they only dragged an unreadable file or sth.
      if (numFilesLeftToBeUploaded <= 0) {
        showFileUploadStatus("is-danger", "Some of your files were not uploaded.<br><br><a class='button is-light' onclick='hideFileUploadStatus();'>Close</a>");
        uploadCompleteResetUploaderState();
      } else {
        nextUpload(callback, callbackParam);
      }
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

  var plaintextFileContents = fileContents;
  var dominant, thumbnail, lightboxPreview, exifDate;

  generateThumbnailsAndNecessaryMeta(plaintextFileContents, function(uploadObject){
  // generatePrimitive(plaintextFileContents, function(pn){
    thumbnail = uploadObject.thumbnail;
    lightboxPreview = uploadObject.lightbox;
    exifDate = uploadObject.date;

    generateDominant(function(dmnt){
      dominant = dmnt;  

      // CURRENTLY UNUSED, CAUSES ERRORS IN SOME BROWSERS 
      // We don't need the contents of these canvases anymore.
      // Before starting encryption clear them to save up memory.
      // clearThumbnailCanvases();
      
      // ENCRYPT & UPLOAD THUMBNAIL FIRST.
      encrypt(thumbnail, [theKey]).then(function(ciphertext) {
        var encryptedTextFile = JSON.stringify(ciphertext);

        var saveUploadThumb = thumbRef.putString(encryptedTextFile);
        saveUploadThumb.on('state_changed', function(thumbSnap){
          if (!fileUploadError) {
            var processingMessage = "Encrypting and Uploading photo(s). <b>" + numFilesLeftToBeUploaded.toString() + " Photos </b> left.";
            showFileUploadStatus("is-white", processingMessage);
          }
          
          lastActivityTime = (new Date()).getTime();

          // switch (thumbSnap.state) { case firebase.storage.TaskState.PAUSED: break; case firebase.storage.TaskState.RUNNING: break; }
          if (thumbSnap.bytesTransferred === thumbSnap.totalBytes) {

            // THUMBNAIL UPLOADED. MOVE ON TO ORIGINAL PHOTO.

            encrypt(plaintextFileContents, [theKey]).then(function(ciphertext) {
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
                    $("#upload-status-contents").prepend(uploadElem);
                    $("#upload-status-contents").animate({ scrollTop: 0 }, 500);
                    if (isMobile) {
                      // on desktops we upload 3 at a time, so this will be fucked up and use lots of memory for no reason.
                      $("#upload-preview").css("backgroundImage", 'url("'+lightboxPreview+'")');
                    }
                  } else {
                    $("#upload-"+pid).find("progress").attr("value", snapshot.bytesTransferred);
                    $("#upload-"+pid).find(".fs").html(Math.floor((snapshot.bytesTransferred * 100) / snapshot.totalBytes) +"%");
                  }

                  lastActivityTime = (new Date()).getTime();

                  // switch (snapshot.state) { case firebase.storage.TaskState.PAUSED: break; case firebase.storage.TaskState.RUNNING: break; }
                  if (snapshot.bytesTransferred === snapshot.totalBytes) {

                    // ORIGINAL PHOTO UPLOADED. MOVE ON TO LIGHTBOX PREVIEW

                    // ENCRYPT & UPLOAD LIGHTBOX PREVIEW IMAGE
                    encrypt(lightboxPreview, [theKey]).then(function(ciphertext) {
                        var encryptedTextFile = JSON.stringify(ciphertext);

                        var saveUploadLightboxPreview = lightRef.putString(encryptedTextFile);
                        saveUploadLightboxPreview.on('state_changed', function(lightSnap){
                          if (!fileUploadError) {
                            var processingMessage = "Encrypting and Uploading photo(s). <b>" + numFilesLeftToBeUploaded.toString() + " Photos </b> left.";
                            showFileUploadStatus("is-white", processingMessage);
                          }
                          
                          lastActivityTime = (new Date()).getTime();

                          if (lightSnap.bytesTransferred === lightSnap.totalBytes) {

                            // LIGHTBOX PREVIEW UPLOADED.

                            $("#upload-"+pid).remove();
                            photoUploadComplete(fid, pid, dominant, thumbnail, filename, exifDate, callback, callbackParam);

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

}


function handleUploadError (pid, filename, error, callback, callbackParam) {
  if (usedStorage >= allowedStorage) {
    showFileUploadStatus("is-danger", "Error uploading your file(s). Looks like you've already ran out of storage. Please consider upgrading to a paid plan or deleting something else.<br><br><a class='button is-light' onclick='hideFileUploadStatus();'>Close</a>" + ' &nbsp; <a class="button is-success" onclick="showPlans()">Upgrade Plan</a>');

    if (activeFID !== "home") {
      otherFolderLoaded = false;
      getAllFilesOfFolder(activeFID);
    } else {
      homeFolderLoaded = false;
      getHomeFolder();
    }

  } else {
    if (error.code === "storage/retry-limit-exceeded") {
      handleError("Retry limit exceeded while uploading photo", error, "warning");
      isUploading = false;
      uploadRetryFailed(pid, callback, callbackParam);
    } else {
      handleError("Error while uploading photo", error);
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

function photoUploadComplete (fid, pid, dominant, thumbnail, filename, exifDate, callback, callbackParam) {
  callback = callback || noop;
  callbackParam = callbackParam || pid;
  var photoObject = { "id" : pid, "pinky" : dominant };
  if (exifDate) { if (exifDate !== "") { 
    photoObject.date  = exifDate;
    try { photoObject.year  = exifDate.split(":")[0] || "";               } catch (error) {} 
    try { photoObject.month = exifDate.split(":")[1] || "";               } catch (error) {} 
    try { photoObject.day   = exifDate.split(":")[2].split(" ")[0] || ""; } catch (error) {} 
    try { photoObject.time  = exifDate.split(' ')[1] || "";               } catch (error) {} 
  } } // "YYYY:MM:DD HH:MM:SS" 
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
    console.error("Error saving uploaded photo: ", error);
    handleError("Error setting uploaded photo to firestore in photoUploadComplete", error);
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
      if (numFilesLeftToBeUploaded <= 0) {
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
    handleError("Photo uploaded to inactive FID", {"targetFID":fid, "activeFID":activeFID});
  }
}


// this will called once uploads are finished.
// drag or select. at the end of every upload one way or another.

function uploadCompleteAndFolderAdjusted (callback, callbackParam) {
  callback = callback || noop;

  uploadCompleteResetUploaderState ();

 // SO BECAUSE THIS GETS CALLED AT THE END OF ALL TYPES OF UPLOADS,
 // BUT WE WANT TO FIRST MOVE FILES BEFORE HIDING THE UPLOAD MODALS
 // IF THE UPLOAD HAS ANY FOLDERS, WE DON'T CALL THIS. THIS PART WILL INSTEAD GET CALLED BY
 // BATCH UPLOAD COMPLETE.

  if (Object.keys(fileTreeToUpload).length <= 1) {
    // so if there are no folders to move photos into, done with uploads.
    // a.k.a. load home / target folder and hide upload modals.
    doneWithAllUploads(callback, callbackParam);
  } else {
    // if there are photos to move into folders, we'll deal with these guys in queueUpload's callback in processUploadTree.
    // which will be executed with this callback.
    callback(callbackParam);
  }

}

function uploadCompleteResetUploaderState () {
  document.title = "Cryptee | Photos";
  numFilesUploaded = 0;
  numFilesUploading = 0;

  somethingDropped = false;
  uploadList = [];
  isUploading = false;
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
            decrypt(theEncryptedFileContents, [theKey]).then(function(plaintext) {
              var decryptedContents = plaintext.data;
              var id = fid || pid;

              var tmpImg = new Image();
              tmpImg.onload = function(){
                $("#" + id).find("img").replaceWith(tmpImg);
                $("#sr-" + id).find("img").replaceWith(tmpImg);
                $(".sr-folder-photo[pid="+id+"]").find("img").replaceWith(tmpImg);
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
                  $(".sr-folder-photo[pid="+id+"]").removeClass("is-loading");

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
      if (tid.indexOf("l-") === -1) {
        handleError("Error getting photo URL", error);
      }
      switch (error.code) {
        case 'storage/object-not-found':
          errorText = "Seems like this file doesn't exist or you don't have permission to open this doc. We're not sure how this happened.<br> Please try again shortly, or contact our support. We're terribly sorry about this.";
          // File or doc doesn't exist at all ~ shit. alright let's try to repair things.
          // Chances are we've got a problem.
          // TODO : ERROR DISPLAYING
          // showDocProgress(errorText);
          if (tid.indexOf("l-") !== -1) {
            console.log("Tried loading a high-res thumbnail (lightbox size) for", pid ,", but there wasn't one. Falling back to regular size.");
            var regularSizeID = tid.replace("l-", "t-");
            getThumbnail (regularSizeID, fid);
          } else {
            fixFile(tid);
          }
          break;
        case 'storage/unauthorized':
          errorText = "Seems like this file doesn't exist or you don't have permission to open this doc. We're not sure how this happened.<br> Please try again shortly, or contact our support. We're terribly sorry about this.";
          // File or doc doesn't exist at all ~ shit. alright let's try to repair things.
          // Chances are we've got a problem.
          // TODO : ERROR DISPLAYING
          // showDocProgress(errorText);

          if (tid.indexOf("l-") !== -1) {
            console.log("Tried loading a high-res thumbnail (lightbox size) for", pid ,", but there wasn't one. Falling back to regular size.");
            var regSizeID = tid.replace("l-", "t-"); // using regSizeID to make linter happy
            getThumbnail (regSizeID, fid);
          } else {
            fixFilesAndFolders();
          }
          
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
      handleError("Error getting photo thumbnail, unkown PID ", {"fid" : fid, "pid" : "unkown"});
    }
  }
}

function getThumbForItem (folderContent, tid, id) {
  // this happens if for some reason the browser crashes or gets closed mid-upload,
  // then some items / folders gets a thumbnail generated. #sad.
  if (folderContent !== null && folderContent !== undefined) {
    if (folderContent.classList.contains("albumitem")) {
      var album = folderContent.querySelector(".album");
      if (album) {
        if (!album.classList.contains("is-loading")) {
          album.classList.add("is-loading");
        }

        // use higher resolution album images on desktops with retina displays
        if (doWeNeedHighResThumbs() && tid) {
          tid = tid.replace("t-", "l-");
        }

        getThumbnail(tid, id);
      }
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

function doWeNeedHighResThumbs() {
  var highRes = false;
  if (ww > 500) { highRes = true; }
  return highRes;
}

if (doWeNeedHighResThumbs()) {
  console.log("High resolution screen detected. Will use high-res album thumbnails.");
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
        setFolderDateFromThumbnailEXIF(fid);
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
          setFolderDateFromThumbnailEXIF(activeFID, function() {
            clearSelections();
            $("#" + pid).find(".photo").removeClass("is-loading");
          });
        }).catch(function(error) {
         console.error("Error saving folder's thumbnail:", error);
        });
      }
    });
  });
}

function getFolderThumbnailID(fid, callback) {
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
    if (count <= 0) { count = 0; } // sometimes this gets negative values. putting this as a failsafe.
    var countToSet = count + adjustment;
    if (countToSet <= 0) { countToSet = 0; } // sometimes this gets negative values. putting this as a failsafe.
    var folderCountObject = {"count" : countToSet};
    homeRef.doc(fid).set(folderCountObject, {
      merge: true
    }).then(function(response) {
      $("#" + fid).find(".album").removeClass("is-loading");
      $("#" + fid).removeClass("is-loading");
      // $("#"+fid).find(".deets").html(count + adjustment + " Photo(s)");

      if ((countToSet) <= 0) {
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


// MOVE PHOTOS (MOVE ITEMS OR MOVE SELECTIONS) 

function moveSelectionsToFolder (arrayOfPIDsToMove, toFolderID, indexToMove, thumbnailIsMoving, callback, callbackParam) {
  callback = callback || noop;
  if (toFolderID !== activeFID) {
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
  $("#photos-move-selections-modal").find(".is-success").attr("disabled", true).prop("disabled", true);
  $("#move-folders-list-home").hide();
  $("#move-folders-list-home, #move-folders-list-new").removeClass("is-active");
  $(".photos-move-folders-list-item.is-active").removeClass("is-active");
  $("#photos-move-folders-list").addClass("is-loading");
  $("#photos-move-folders-list").find("div").remove();
  showModal('photos-move-selections-modal');

  titlesRef.doc("home").get().then(function(titles) {
    if (titles.data()) {
      var encryptedTitlesObject = JSON.parse(titles.data().titles).data;
      decrypt(encryptedTitlesObject, [theKey]).then(function(plaintext) {
        $.each(JSON.parse(plaintext.data).folders, function(fid, ftitle) {
          var parsedFilename = JSON.parse(ftitle);
          var isCurrent = ""; if (fid === activeFID) { isCurrent = "is-current"; }
          $("#photos-move-folders-list").append('<div class="column move-folder is-half" fname="'+parsedFilename+'"><button fid="'+fid+'" class="button is-fullwidth '+isCurrent+' photos-move-folders-list-item"><span class="icon is-small"><i class="fa fa-book"></i></span><span>'+parsedFilename+'</span></button></div>');
        });

        if (activeFID === "home") {
          $("#move-folders-list-home").addClass("is-current");
        } else {
          $("#move-folders-list-home").removeClass("is-current");
        }

        $('.move-folder').sort(function(a, b) {
          if ($(a).attr("fname") > $(b).attr("fname")) {
            return -1;
          } else {
            return 1;
          }
        }).appendTo('#photos-move-folders-list');

        $("#move-folders-list-home").fadeIn(250);
        $("#photos-move-folders-list").removeClass("is-loading");
      });
    }
  });
}

$("#photos-move-selections-modal").on('click', '.photos-move-folders-list-item', function(event) {
  event.preventDefault();
  var toFolderID = $(this).attr("fid");
  if (toFolderID !== activeFID) {
    $("#move-folders-list-home, #move-folders-list-new").removeClass("is-active");
    $(".photos-move-folders-list-item.is-active").removeClass("is-active");
    $(this).addClass("is-active");
    $("#photos-move-selections-modal").find(".is-success").attr("disabled", false).prop("disabled", false);
  }
});

$("#move-folders-list-home").on('click', function(event) {
  event.preventDefault();

  if (activeFID !== "home") {
    $("#move-folders-list-home").removeClass("is-active");
    $(".photos-move-folders-list-item.is-active").removeClass("is-active");
    $(this).addClass("is-active");
    $("#photos-move-selections-modal").find(".is-success").attr("disabled", false).prop("disabled", false);
  }
});

function moveFolderSelectionMade () {
  var toFolderID = $(".photos-move-folders-list-item.is-active").attr("fid");
  if (toFolderID !== undefined && toFolderID !== null && toFolderID !== "") {
    progressModal("photos-move-selections-modal");
    if (toFolderID === "new") {
      var aNewUUID = "f-" + newUUID();
      newFolder("New Album", aNewUUID, function(){
        moveThem(aNewUUID);
      });
    } else {
      moveThem(toFolderID);
    }
  }

  function moveThem (fidToMoveTo) {
    var thumbnailIsMoving = false;
    getFolderThumbnailID(activeFID, function(thumb){
      var selectionsArray = Object.keys(selectionsObject);
      selectionsArray.forEach(function(pid) {
        if (thumb) {
          if (pid === thumb.replace("t-", "p-")) {
            thumbnailIsMoving = true;
          }
        } else {
          thumbnailIsMoving = true; // force thumb regeneration.
        }
      });
      $("#photos-move-selections-modal").addClass("disable-clicks");
      moveSelectionsToFolder(selectionsArray, fidToMoveTo, 0, thumbnailIsMoving, function(){
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

var resizedCanvas, originalCanvas, orientationCanvas;
var resizedContext, originalContext, orientationContext;

function generateThumbnailsAndNecessaryMeta(imgB64, callback) {
    // image sizes in max pixels – for the longest dimension of image 

    var sizes = { "lightbox" : 1920, "thumbnail" : 768 };
    var qualities = { "lightbox": 0.5, "thumbnail": 0.3 };
    var uploadObject = { "lightbox" : "", "thumbnail" : "", "date" : "" };

    getEXIF(imgB64, function (exif) {
        var orientation;
        if (exif.Orientation) { orientation = exif.Orientation; }
        if (exif.DateTime) { uploadObject.date = exif.DateTime; } 
        // reuse these canvases globally in the interest of saving memory if garbage collection is shittier / slower than expected.

        resizedCanvas = resizedCanvas || document.createElement("canvas");
        resizedContext = resizedContext || resizedCanvas.getContext("2d");

        originalCanvas = originalCanvas || document.createElement("canvas");
        originalContext = originalContext || originalCanvas.getContext("2d");

        orientationCanvas = orientationCanvas || document.createElement("canvas");
        orientationContext = orientationContext || orientationCanvas.getContext("2d");

        var img = new Image();
        img.src = imgB64;

        img.onload = function () {

            var width = img.width;
            var height = img.height;

            orientationCanvas.width = width;
            orientationCanvas.height = height;

            if (orientation > 4) {
                orientationCanvas.width = height;
                orientationCanvas.height = width;
            }
            
            switch (orientation) {
                case 2:
                    // horizontal flip
                    orientationContext.translate(width, 0);
                    orientationContext.scale(-1, 1);
                    break;
                case 3:
                    // 180° rotate left
                    orientationContext.translate(width, height);
                    orientationContext.rotate(Math.PI);
                    break;
                case 4:
                    // vertical flip
                    orientationContext.translate(0, height);
                    orientationContext.scale(1, -1);
                    break;
                case 5:
                    // vertical flip + 90 rotate right
                    orientationContext.rotate(0.5 * Math.PI);
                    orientationContext.scale(1, -1);
                    break;
                case 6:
                    // 90° rotate right
                    orientationContext.rotate(0.5 * Math.PI);
                    orientationContext.translate(0, -height);
                    break;
                case 7:
                    // horizontal flip + 90 rotate right
                    orientationContext.rotate(0.5 * Math.PI);
                    orientationContext.translate(width, -height);
                    orientationContext.scale(-1, 1);
                    break;
                case 8:
                    // 90° rotate left
                    orientationContext.rotate(-0.5 * Math.PI);
                    orientationContext.translate(-width, 0);
                    break;
            }

            orientationContext.drawImage(img, 0, 0);

            for (var size in sizes) { // cycle through all sizes, and generate thumbnails
                var maxWidthOrHeight = sizes[size]; // lightbox, thumbnail etc. 
                var ratio = 1;

                if (orientationCanvas.width > maxWidthOrHeight) { ratio = maxWidthOrHeight / orientationCanvas.width; }
                else if (orientationCanvas.height > maxWidthOrHeight) { ratio = maxWidthOrHeight / orientationCanvas.height; }

                originalCanvas.width = orientationCanvas.width;
                originalCanvas.height = orientationCanvas.height;

                originalContext.drawImage(orientationCanvas, 0, 0, orientationCanvas.width, orientationCanvas.height, 0, 0, originalCanvas.width, originalCanvas.height);

                resizedCanvas.width = originalCanvas.width * ratio; // this canvas gets a reduced size
                resizedCanvas.height = originalCanvas.height * ratio;

                resizedContext.drawImage(originalCanvas, 0, 0, originalCanvas.width, originalCanvas.height, 0, 0, resizedCanvas.width, resizedCanvas.height);
                uploadObject[size] = resizedCanvas.toDataURL("image/jpeg", qualities[size]);
            }

            callback(uploadObject);
        };
    });
}

function generateDominant (callback) {
  callback = callback || noop;
  var colorThief = new ColorThief();
  // resizedCanvas & resizedContext are globally shared to save memory
  var dominantColor = colorThief.getColor(resizedCanvas, resizedContext);
  callback (dominantColor.toString());
}

function clearThumbnailCanvases () {
  originalCanvas = null;
  resizedCanvas = null;
  orientationCanvas = null;
}

// function generatePallette(imgEl, callback) {
//   var canvas = document.createElement("canvas");
//   var ctx = canvas.getContext("2d");
//   var img = new Image();
//   img.src = imgEl.attr("src");
//
//   img.onload = function () {
//     canvas.width = img.width; canvas.height = img.height;
//     ctx.drawImage(img, 0,0, canvas.width, canvas.height);
//     var colorThief = new ColorThief();
//     var pallette = colorThief.getPalette(canvas, ctx);
//     callback(pallette);
//   };
// }


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

function folderCreated (fid, fname, callback, callbackParam) {
  callback = callback || noop;
  if (activeFID === "home") {
    activeItemsObject[fid].title = fname;
    renderFolder(fid, fname, "", "", "",updateTitles, callback, callbackParam);
  } else {
    callback(callbackParam);
  }
}

function renderFolder (fid, fname, pinky, thumb, exifDate, callback, callback2, callbackParam2) {
  callback = callback || noop;
  callback2 = callback2 || noop;
  
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
      // dominant = "background-color:rgb(" + pinky + ");";
      pinkyObj = '<img draggable="false" src="//:0" tid="'+thumb+'">';
      // var colorContrast = pinky.split(",").reduce(function add(a, b) { return parseInt(a) + parseInt(b); }, 0);
      // if (colorContrast < 385) {
      //   loadingColor = "is-white-loader";
      // }
    } else {
      pinkyObj = pinky;
    }
  }

  var theParsedFoldername = "";
  try { theParsedFoldername = JSON.parse(fname); } catch (e) { theParsedFoldername = fname; }
  
  var date = yearFromTitle(theParsedFoldername) || fancyDate(exifDate) || "";
  var titleWithoutYear = yearOmittedTitle(theParsedFoldername);
  var sortableDate;
  if (yearFromTitle(theParsedFoldername)) {
    sortableDate = yearFromTitle(theParsedFoldername) + "0000";
  } else {
    sortableDate = sortableExifDate(exifDate) || "";
  }

  var folderDivOpener = '<div photositemname="'+theParsedFoldername+'" class="column is-full folder-content albumitem" id="'+fid+'" date="'+ date +'" datesort="'+sortableDate+'" style="'+dominant+'">';
  var folderHTML =
    '<div class="album '+loadingColor+'" style="'+dominant+'">'+
      pinkyObj +
      // '<div class="button is-light unclickable albumicon"><span class="icon"><i class="fa fa-fw fa-book"></i></span></div>'+
      '<input onclick="this.focus()" type="text" class="albumtitle" value="'+titleWithoutYear+'" placeholder="'+theParsedFoldername+'" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />'+
      // '<span class="settingsicon icon is-small"><i class="fa fa-fw fa-ellipsis-v"></i></span>'+
      '<span class="deletefoldericon icon is-small"><i class="fa fa-fw fa-trash"></i></span>'+
      '<span class="ghostfoldericon icon is-small"><i class="fa fa-fw fa-eye-slash"></i></span>'+
      '<progress class="progress is-small is-dark"></progress>'+
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

function renderPhoto (pid, nail, pname, exifDate, callback, callbackParam) {
  callback = callback || noop;
  pname = pname || "Untitled.jpg";
  nail = nail || "";
  var sortableDate = sortableExifDate(exifDate) || "";
  var date = fancyDate(exifDate) || "";
  // PINKY IS A PINKYNAIL. IT'S A 35X35 PIXEL VERSION OF THE IMAGE, THAT HOPEFULLY ISN'T TOO INVASIVE FOR PRIVACY.
  // IT ALLOWS TO DISPLAY A BLURRED VERSION OF THE IMAGE, WHILE THE ACTUAL THUMBNAIL IS LOADING. WE STORE THIS UNENCRYPTED
  // TO SAVE TIME. IF WE REALIZE THAT THIS IS UNNECESSARY, WE CAN SKIP THIS TOO LATER. BUT FOR NOW I'M ADDING IT JUST IN CASE.
  var isItSelected = "";
  var isItLoading = "";
  var isLoaded = "";
  var loadingColor = "is-black-loader";
  if (pid in selectionsObject) { isItSelected = " selected"; }

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

  var photoDivOpener = '<div photositemname="'+theParsedFilename+'" class="column is-one-quarter-desktop is-one-third-tablet is-half-mobile folder-content photoitem '+isItSelected+'" id="'+pid+'" date="'+ date +'" datesort="'+sortableDate+'" style="'+dominant+'">';
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

  if (activeItemsObject[id]) {
    if (id.startsWith('p-')) {
      domElement = renderPhoto(id, activeItemsObject[id].pinky, activeItemsObject[id].title, activeItemsObject[id].date);
    } else if (id.startsWith('f-')) {
      domElement = renderFolder(id, activeItemsObject[id].title, activeItemsObject[id].pinky, activeItemsObject[id].thumb, activeItemsObject[id].date);
    } else { 
      // wtf. neither photo nor folder.
      handleError("User has a non-photo/non-folder item", {"id": id});
    }
  } else {
    handleError("User has an item that's not in activeItemsObject", {"id": id});
    // somehow item isn't in activeItemsObject. wtf. soooo not adding. since it's better than crashing. but wtf. 
  }

  return domElement;
}







function renderFolderShell(id, title, exifDate) {
  var date = yearFromTitle(title) || fancyDate(exifDate) || "";
  var sortableDate;
  if (yearFromTitle(title)) {
    sortableDate = yearFromTitle(title) + "0000";
  } else {
    sortableDate = sortableExifDate(exifDate) || "";
  }
  var html = "<div photositemname='"+title+"' class='column is-full folder-content albumitem shell' id='"+id+"' date='"+ date +"' datesort='"+sortableDate+"'><progress class='progress is-small is-dark'></progress></div>";
  return html;
}

function renderPhotoShell (id, title, exifDate) {
  var theParsedFilename = "";
  try { theParsedFilename = JSON.parse(title); } catch (e) { theParsedFilename = title; }
  theParsedFilename = titleFromFilename(theParsedFilename);
  
  var sortableDate = sortableExifDate(exifDate) || "";
  var date = fancyDate(exifDate) || "";

  var html = "<div photositemname='"+theParsedFilename+"' class='column is-one-quarter-desktop is-one-third-tablet is-half-mobile folder-content photoitem shell' id='"+id+"' date='"+ date +"' datesort='"+sortableDate+"'></div>";
  return html;
}

function renderDOMShell (id) {
  var shellElement = "";

  if (activeItemsObject[id]) {
    if (id.startsWith('p-')) {
      shellElement = renderPhotoShell(id, activeItemsObject[id].title, activeItemsObject[id].date);
    } else if (id.startsWith('f-')) {
      shellElement = renderFolderShell(id, activeItemsObject[id].title, activeItemsObject[id].date);
    } else { 
      // wtf. neither photo nor folder.
    }
  } else {
    handleError("User has an item that's not in activeItemsObject", {"id": id});
    // somehow item isn't in activeItemsObject. wtf. soooo not adding. since it's better than crashing. but wtf. 
  }

  return shellElement;
}

function addIntersectionObserver (el){
  observer.observe(el);
}


function onEntryAndExit (changes, observer) {

  changes.forEach(function (change) {
    var onScreenTimer;
    var id, folderContent;
    if (change.intersectionRatio > 0.15) {
      // entered
      if (change.target.classList.contains("shell")) {
        folderContent = change.target;
        id = folderContent.id;

        var domElement = renderDOMElement(id);
        folderContent.innerHTML = domElement;

        var tid = null; 
        // fixes a bug where folderContent.querySelector("img") can be null. 
        // passing null to get Thumb For Item which passes null to get Thumbnail,
        // if FID exists, it generates folder thumb, if not throws a predefined error as it should now.
        if (folderContent.querySelector("img")) {
          tid = folderContent.querySelector("img").getAttribute("tid");
        }

        onScreenTimer = setTimeout(function(){
          getThumbForItem (folderContent, tid, id);
        }, 500);

        folderContent.classList.remove('shell');
      }

    } else {
      // exited
      folderContent = change.target;
      id = folderContent.id;

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



//breadcrumb navigation management /// not the error logging breadcrumbs. adding for clarity..
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
  // this is to make sure we have a user before calling this function.
  // otherwise getAllFilesOfFolder will get called before auth is complete, and tons of shit will be undefined.
  
  if (theUser) { 
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
  var titleToReturn = (filename.substring(0,filename.lastIndexOf(extension)) + '');
  if (titleToReturn === "") { titleToReturn = filename; }
  return titleToReturn;
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
  decrypt(encryptedTitlesObject, [theKey]).then(function(plaintext) {
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

  breadcrumb("[Process Titles] Adding all items from fstore to activeItemsObject.");

  var tryFixingFiles = false;
  contents.forEach(function(item) {

    if (item.data().id) {
      var id = item.data().id;
      activeItemsObject[id] = activeItemsObject[id] || {};

      activeItemsObject[id].pinky = item.data().pinky;
      activeItemsObject[id].title = "Untitled"; // as a placeholder
      if (item.data().date) {
        activeItemsObject[id].date = item.data().date;
      } else {
        activeItemsObject[id].date = "";
      }

      if (id.startsWith('f-')) {
        activeItemsObject[id].count = item.data().count;
        activeItemsObject[id].thumb = item.data().thumb;
        if (!item.data().date) {
          if (item.data().date !== "") {
            foldersWithoutDates.push(id);
          }
        }
      }
    } else {
      breadcrumb("[Process Titles] Caught item without id in fstore : " + item.ref.path);
      if (!isMobile) { tryFixingFiles = true; }
    }

  });

  /////////////////////////////////////////////
  // - 2 - CYCLE ALL TITLES FROM titlesObject
  // AND ADD TO active Items Object
  /////////////////////////////////////////////

  breadcrumb("[Process Titles] Adding all folder titles from titlesObject to activeItemsObject.");
  $.each(titlesObject.folders, function(fid, ftitle) {
    var parsedFilename = JSON.parse(ftitle);
    activeItemsObject[fid] = activeItemsObject[fid] || {};
    activeItemsObject[fid].title = parsedFilename;
  });

  breadcrumb("[Process Titles] Adding all photo titles from titlesObject to activeItemsObject.");
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
    breadcrumb("[Process Titles] Adding summoned folder title to activeItemsObject. (" + summonedFID + ")");
    activeItemsObject[summonedFID].title = summonedTitle;
    somethingSummoned = false;
    summonedFID = "";
    summonedTitle = "";
  }

  /////////////////////////////////////////////////
  // - 4 - NOW THAT WE HAVE EVERYTHING CONSOLIDATED
  // IN active Items Object - SORT ALL TITLES
  /////////////////////////////////////////////////

  breadcrumb("[Process Titles] activeItemsObject ready. Sorting titles.");

  // [[id, title], [id, title]]
  // item[0] is the id, item[1] is the filename
  var itemsArray = sortItemsObject();
  var sortedDOMArray = [];
  
  // remove all lightbox events to stop thousands of slideChange events from triggering.
  // and remove all slides from lightbox 
  try { lightbox.off('slideChange'); } catch (e) {}
  lbox.removeAllSlides(); 
  
  breadcrumb("[Process Titles] Sorted. Rendering DOM Shells");
  // insert dom elements into the sortedDOMArray in correct order.
  itemsArray.forEach(function (item, index) {
    // item[0] is the id, item[1] is the filename
    var shellElement = renderDOMShell(item[0]);
    sortedDOMArray.push(shellElement);

    // if it's a photo, add a shell div to lightbox slider
    // you will then go to this slide, and fill this div with image later
    // don't worry these are virtualized, and only the current, prev and next
    // slides are in DOM. Others aren't. 

    if (item[0].startsWith("p-")) {
      lbox.appendSlide("<div pid='"+item[0]+"'></div>");
    }
  });
  
  lbox.update();

  breadcrumb("[Process Titles] Inserting DOM Shells");

  // now we have a pre-sorted sortedDOMArray which has all photo and album objects
  // add this and ghost element to dom in a single joint chunk
  $("#folder-contents").append(sortedDOMArray.join(""));

  $(".folder-content").each(function () {
    addIntersectionObserver (this);
  });

  // now that all slides are in the lightbox, start listening for slideChange again.
  lightbox.on('slideChange', lightboxPhotoChanged);
  
  callback();

  if (tryFixingFiles) {
    breadcrumb("[Process Titles] Completed with errors. Will try fixing.");  
    tryFixingFiles = false;
    fixFilesAndFolders();
  } else {
    breadcrumb("[Process Titles] Completed."); 
  }

  // if there's albums without dates, use the date from the thumbnail photo,
  // and add a date to these albums

  if (!isMobile) {
    if (foldersWithoutDates.length > 0) {
      updateFoldersWithoutDates();
    } else {
      hideLibraryUpdate();
    }
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
      decrypt(encryptedTitlesObject, [theKey]).then(function(plaintext) {
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
  callback = callback || noop;
  
  
  var plaintextTitles = JSON.stringify(titlesObjectToEncrypt);
  lastActivityTime = (new Date()).getTime();
  encrypt(plaintextTitles, [theKey]).then(function(ciphertext) {
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
    decrypt(encryptedTitlesObject, [theKey]).then(function(plaintext) {
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
    decrypt(encryptedTitlesObject, [theKey]).then(function(plaintext) {
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


////////////////////////////////////////////////////
//////////////////   RENAME TITLE     //////////////
////////////////////////////////////////////////////


$("#folder-contents").on("keydown", '.phototitle, .albumtitle', function(event) {
  var theinput = $(this);
  setTimeout(function(){
    if (event.keyCode == 13) { theinput.blur(); }
    else {
      if (theinput.hasClass("albumtitle")) {
        var tempTitle = theinput.val();
        var year = yearFromTitle(tempTitle);
        if (year) { 
          theinput.parents(".folder-content").attr("date", year); 
          theinput.parents(".folder-content").attr("datesort", year + "0000"); 
        } else {
          theinput.parents(".folder-content").attr("date", "");
          theinput.parents(".folder-content").attr("datesort", "");
        }
      }
    }
  },50);
});

$("#folder-contents").on("blur", '.phototitle, .albumtitle', function(event) {
  var input = $(this);
  var trimmedTitle = input.val().trim();
  if (trimmedTitle === "" || trimmedTitle === " ") {
    input.val("Unnamed");
  }
  
  var fidOrPid = input.parents(".folder-content").attr("id");

  if (input.attr("placeholder") !== trimmedTitle) {
    input.parents(".folder-content").find(".photo").addClass("is-loading");
    input.parents(".folder-content").find(".album").addClass("is-loading");

    if (input.attr("ext")) {
      activeItemsObject[fidOrPid].title = trimmedTitle + "." + input.attr("ext");
    } else {
      activeItemsObject[fidOrPid].title = trimmedTitle;
    }

    updateTitles(function(){
      if (input.hasClass("albumtitle")){
        updateFolderTitle(fidOrPid, trimmedTitle, function(){
          input.parents(".folder-content").find(".photo").removeClass("is-loading");
          input.parents(".folder-content").find(".album").removeClass("is-loading");
          input.attr("placeholder", trimmedTitle);
          input.val(yearOmittedTitle(trimmedTitle));

          var year = yearFromTitle(trimmedTitle);
          if (!year) {
            var date = activeItemsObject[fidOrPid].date;
            year = (fancyDate(date) || "").replace("&#39;", "'") || "";
          }
          input.parents(".folder-content").attr("date", year);
          input.parents(".folder-content").attr("datesort", year + "0000");

          console.log("folder title updated.");
        });
      } else {
        input.parents(".folder-content").find(".photo").removeClass("is-loading");
        input.parents(".folder-content").find(".album").removeClass("is-loading");
        input.attr("placeholder", trimmedTitle);
        console.log("photo title updated.");
      }
    });
  } else {
    if (input.hasClass("albumtitle")) {
      input.val(yearOmittedTitle(trimmedTitle));
    }
  }
});

$("#folder-contents").on("focus", '.albumtitle', function(event) {
  var input = $(this);
  input.val(input.attr("placeholder"));
});

function yearFromTitle (title) {
  title = title || ""; 
  if (typeof title !== 'string') { title = ""; } // fixes an issue where title could be null or not string, thus match isn't a function.

  var year = title.match(/\b(19|20)\d{2}\b/gm);
  if (Array.isArray(year)) {
    // more than one year entered. use the first one. 
    year = year[0] + "";
  }
  return year || null;
}

function yearOmittedTitle (title) {
  var year = yearFromTitle(title);
  if (year) {

    // CHARACTERS ON BOTH SIDES

    title = title.replace("( " + year + " )", "").replace("(" + year + ")", "");
    title = title.replace("[ " + year + " ]", "").replace("[" + year + "]", "");
    title = title.replace("{ " + year + " }", "").replace("{" + year + "}", "");
    title = title.replace("| " + year + " |", "").replace("|" + year + "|", "");
    
    title = title.replace("( " + year + ")", "").replace("(" + year + " )", "");
    title = title.replace("[ " + year + "]", "").replace("[" + year + " ]", "");
    title = title.replace("{ " + year + "}", "").replace("{" + year + " }", "");
    title = title.replace("| " + year + "|", "").replace("|" + year + " |", "");

    title = title.replace("-" + year + "-", "");
    title = title.replace("–" + year + "–", "");
    title = title.replace("/" + year + "/", "");
    title = title.replace("_" + year + "_", "");
    title = title.replace("." + year + ".", "");
    title = title.replace(":" + year + ":", "");

    // CHARACTERS ON ONE SIDE

    title = title.replace("- " + year, "").replace("-" + year, "");
    title = title.replace(year + " -", "").replace(year + "-", "");

    title = title.replace("/ " + year, "").replace("/" + year, "");
    title = title.replace(year + " /", "").replace(year + "/", "");

    title = title.replace("_ " + year, "").replace("_" + year, "");
    title = title.replace(year + " _", "").replace(year + "_", "");

    title = title.replace(". " + year, "").replace("." + year, "");
    title = title.replace(year + " .", "").replace(year + ".", "");

    title = title.replace(": " + year, "").replace(":" + year, "");
    title = title.replace(year + " :", "").replace(year + ":", "");

    title = title.replace("– " + year, "").replace("–" + year, "");
    title = title.replace(year + " –", "").replace(year + "–", "");

    title = title.replace("| " + year, "").replace("|" + year, "");
    title = title.replace(year + " |", "").replace(year + "|", "");

    // REMOVE YEAR, AND DOUBLE SPACES
    title = title.replace(year, "").replace(/ {1,}/g," ");

    // TRIM ENDING SPACES
    title = title.trim();
  }

  return title;
}





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
    $("#delete-album-modal").find(".subtitle").html("Deleting ...");
    var fid = fidToDelete;
    homeRef.doc(fid).collection(fid).get().then(function(items) {

      if (items.docs.length > 0) {
        noItemsLeftToDelete = items.docs.length;

        $("#delete-album-modal").find(".subtitle").html("Deleting (<b>" + noItemsLeftToDelete + "</b> left)");
        
        items.docs.forEach(function(item) {
          var pid = item.data().id;
          var tid = pid.replace("p-", "t-");
          var lid = pid.replace("p-", "l-");
          var photoRef = rootRef.child(pid + ".crypteefile");
          var thumbRef = rootRef.child(tid + ".crypteefile");
          var lightRef = rootRef.child(lid + ".crypteefile");

          photoRef.delete().finally(function() {
            thumbRef.delete().finally(function() {
              lightRef.delete().finally(function() {

                noItemsLeftToDelete--;
                $("#delete-album-modal").find(".subtitle").html("Deleting (<b>" + noItemsLeftToDelete + "</b> left)");

                if (noItemsLeftToDelete === 0) {
                  $("#delete-album-modal").find(".subtitle").html("Deleting (Finalizing)");
                  var collectionRefToDelete = homeRef.doc(fid).collection(fid);
                  deleteCollection (collectionRefToDelete).then(function(){
                    homeRef.doc(fid).delete().then(function(){
                      titlesRef.doc(fid).delete().then(function(){
                        deleteFolderComplete(fid);
                      });
                    });
                  });
                }

              }).catch();
            }).catch();
          }).catch();
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
  var albumTitle = $(this).parents(".albumitem").find("input").attr("placeholder").toUpperCase();
  var thisIcon = $(this);
  
  // this is to test hashing the title to see if it has any invalid / wide / unsupported / unhashable characters
  hashString(albumTitle).then(function(testHashingTheTitle){
    fidToGhost = thisIcon.parents(".albumitem").attr("id");
    $("#ghost-folder-confirm-input").val(albumTitle);
    $("#ghost-folder-confirm-input").attr("placeholder", albumTitle);
    showModal("ghost-album-modal");
  }).catch(function(e){
    showModal("ghost-album-titleerror-modal");
  });

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
    hashString($("#ghost-folder-confirm-input").val().toUpperCase()).then(function(titleHashToGhost){
      var makeGhostAlbum = cloudfunctions.httpsCallable('makeGhostAlbum');
      makeGhostAlbum({ hash: titleHashToGhost, fid: fidToGhost }).then(function (result) {

        var functionResponse = result.data;
        if (functionResponse) {
          if (functionResponse.status === "done") {
            // all set. album ghosted.
            doneGhosting();
          }
          if (functionResponse.error) {
            unprogressModal("ghost-album-modal");
            $("#ghost-album-modal").find(".theStatus").html("<p>Something went wrong. Please try again.</p>").show();
          }
        }

      }).catch(function (error) {
        unprogressModal("ghost-album-modal");
        $("#ghost-album-modal").find(".theStatus").html("<p>Something went wrong. Please try again.</p>").show();
        console.log(error);
      });
    }).catch(function(e){
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
    hashString(titleToSummon).then(function(titleHashToSummon){
      // CLIENTSIDE ONCE GOT THE CONFIRMATION :

      var summonGhostAlbum = cloudfunctions.httpsCallable('summonGhostAlbum');
      summonGhostAlbum({ hash: titleHashToSummon }).then(function (result) {
        var functionResponse = result.data;
        if (functionResponse) {
          if (functionResponse.status === "done") {
            // all set. album ghosted.

            somethingSummoned = true;
            summonedFID = functionResponse.fid;
            summonedTitle = titleToSummon;
            titleToSummon = "";

            homeFolderLoaded = false; otherFolderLoaded = false;
            getHomeFolder(function () { // we save the ghost title into activeItemsObject['id'].title in processTitles in getHomeFolder here.
              updateTitles(function () {
                hideModal("photos-summon-ghost-album-modal");
              });
            });
          }

          if (functionResponse.error) {
            unprogressModal("photos-summon-ghost-album-modal");
            $("#photos-summon-ghost-album-modal").find(".theStatus").html("<p>Something went wrong. Please try again.</p>").show();
          }

          if (functionResponse.nope) {
            unprogressModal("photos-summon-ghost-album-modal");
            $("#photos-summon-ghost-album-modal").find(".theStatus").html("<p>No ghost folders found with this title.</p>").show();
          }
        }

      }).catch(function (error) {
        unprogressModal("photos-summon-ghost-album-modal");
        $("#photos-summon-ghost-album-modal").find(".theStatus").html("<p>Something went wrong. Please try again.</p>").show();
        console.log(error);
      }); 
    }).catch(function(e){
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
  selectionsObject = selectionsObject || {}; // somehow sometimes, these could come undefined. not sure why yet. but this is a failsafe.
  activeItemsObject = activeItemsObject || {}; // somehow sometimes, these could come undefined. not sure why yet. but this is a failsafe.
  
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
    $("#photos-set-thumb-button").addClass("unavailable");
    $("#photos-del-sel-modal-toggle-button").attr("disabled", true).prop("disabled", true);
  }
  $("#photos-delete-selections-modal").find(".subtitle").html('Are you sure you want to delete your selections? (<span class="number-of-selections"></span>)?');
  if (numberOfSelections <= 1) {
    $(".number-of-selections").html(numberOfSelections + "<span class='hiddenForFinger'> photo</span>");
  } else {
    $(".number-of-selections").html(numberOfSelections + "<span class='hiddenForFinger'> photos</span>");
  }
}

var completedDeletions;
var numOfSelectionsToDelete;
function deleteSelections() {
  progressModal("photos-delete-selections-modal");
  completedDeletions = 0;
  numOfSelectionsToDelete = Object.keys(selectionsObject).length;
  $("#photos-delete-selections-modal").find(".subtitle").html("Deleting (0 / " + numOfSelectionsToDelete + ")");
  getFolderThumbnailID(activeFID, function(thumb){
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

      photoRef.delete().finally(function() {
        thumbRef.delete().finally(function() {
          lightRef.delete().finally(function() {
            whereFrom.delete().then(function() {
              areDeletionsComplete(pid, isFolderThumbDeleted);
            });
          }).catch();
        }).catch();
      }).catch(function(error) {
        if (error.code === "storage/object-not-found") {
          thumbRef.delete();
          whereFrom.delete();
          lightRef.delete();
          areDeletionsComplete(pid, isFolderThumbDeleted);
        } else {
          error.pid = pid;
          handleError("Error deleting photo", error);
          $("#photos-delete-selections-modal").find(".button.is-success").removeClass("is-loading").prop("disabled", false).attr("disabled", false);
          areDeletionsComplete(pid, isFolderThumbDeleted);
        }
      });
    });

  });
}

function areDeletionsComplete(pid, isFolderThumbDeleted) {
  completedDeletions++;
  $("#photos-delete-selections-modal").find(".subtitle").html("Deleting (" + completedDeletions + " / " + numOfSelectionsToDelete + ")");

  if (Object.keys(selectionsObject).length === completedDeletions) {
    if (activeFID !== "home") {
      var adjustmentCount = 0 - Object.keys(selectionsObject).length;
      adjustFolderCount (activeFID, adjustmentCount, isFolderThumbDeleted);
    }

    Object.keys(selectionsObject).forEach(function(pid){
      delete activeItemsObject[pid];
    });

    $(".photoitem.selected").remove();
    selectionsObject = {};

    updateTitles(function(){
      hideModal("photos-delete-selections-modal");
      clearSelections();
      numOfSelectionsToDelete = 0;
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

      var shiftSel = foldercontent.prevUntil(".photoitem.selected", ".photoitem");
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

        var shiftSel = selPhoto.prevUntil(".photoitem.selected", ".photoitem");
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
    $("#" + pid).find(".photo").addClass("is-loading");

    if (displayOrDownload === "download"){
      // use original
      getLightboxDownloadURL(pid, function(downloadURL){
        gotDownloadURL(downloadURL);
      }, true);
    } else {
      // TRY USING LIGHTBOX
      preparingToDisplayPhoto = pid;
      if (isImgInLightboxCache(pid)) {
        // IMG ALREADY IN CACHE, DISPLAY RIGHT AWAY
        displayPhoto(pid);
      } else {
        // not in cache, download instead
        getLightboxDownloadURL(pid, function(downloadURL){
          gotDownloadURL(downloadURL);
        });
      }
    }
  } else {
    handleError("Error loading Photo. Blank PID.");
  }

  function gotDownloadURL (downloadURL) {
    if (downloadURL) {
      $.ajax({ url: downloadURL, type: 'GET',
        success: function(encryptedPhoto){
          photoLoaded(pid, ptitle, encryptedPhoto, displayOrDownload, callback, callbackParam);
        },
        error:function (xhr, ajaxOptions, thrownError){
          console.log(thrownError);
          setTimeout(function(){ window.location.reload(); }, 2500);
        }
      }).progress(function(e) {
        $("#" + pid).find(".photo").addClass("is-loading"); // to make sure photo looks loading if user tapped on photo while it was still loading thumb, then loading indicator was removed.
      });
    } else {
      console.log(thrownError);
      setTimeout(function(){ window.location.reload(); }, 2500);
    }
  }

}




var queuePhoto;
function photoLoaded (pid, ptitle, encryptedPhoto, displayOrDownload, callback, callbackParam) {
  callback = callback || noop;
  displayOrDownload = displayOrDownload || "display";
  var encryptedB64 = JSON.parse(encryptedPhoto).data;
  $("#" + pid).find(".photo").addClass("is-loading"); // to make sure photo looks loading if user tapped on photo while it was still loading thumb, then loading indicator was removed.
  decrypt(encryptedB64, [theKey]).then(function(plaintext) {
    $("#" + pid).find(".photo").addClass("is-loading"); // to make sure photo looks loading if user tapped on photo while it was still loading thumb, then loading indicator was removed.
    var decryptedPhoto = plaintext.data;
    if (displayOrDownload === "download"){
      downloadPhotoToDisk(pid, ptitle, decryptedPhoto, callback, callbackParam);
    } else {
      displayPhoto(pid, decryptedPhoto, callback, callbackParam);
    }
  });
}

function displayPhoto (pid, pb64, callback, callbackParam) {
  callback = callback || noop;

  var slideIndex = getSlideIndex(pid);

  // this will make sure the div is now in DOM (and not just in virtual slider DOM) so that you can add the image into it
  lightbox.slideTo(slideIndex, null, false);   
  
  // if photo is in cache, and in fact in the, no need to add again. 
  addImgToDOMIfNotAlreadyInCache(pid, pb64);

  setTimeout(function () {
    // wait for the DOM to update on slow devices. we're injecting b664 inline here. ugh. sorry. 
    showModal("lightbox-modal");
    lightboxPhotoChanged(pid); 
  }, 20);

  callback(callbackParam);
}



function preloadNextSlide (nextPID, callback, callbackParam) {
  callback = callback || noop;
  // nextPID = nextPID || $("#sr-"+pid).next(".photos-search-result").attr("pid") || $(".photos-search-result").first().attr("pid") || $("#"+pid).nextUntil(".photoitem").last().next().attr("id") || $("#"+pid).next(".photoitem").attr("id") || $(".photoitem").first().attr("id");

  if (nextPID !== undefined) {
    $("#lightbox-spinner").addClass("wait");
    getLightboxDownloadURL(nextPID, function(downloadURL){
      gotNextOrPrevLightboxDownloadURL(downloadURL, nextPID, callback, callbackParam);
    });
  }
}



function preloadPrevSlide (prevPID, callback, callbackParam) {
  callback = callback || noop;
  // prevPID = prevPID || $("#sr-"+pid).prev(".photos-search-result").attr("pid") || $(".photos-search-result").last().attr("pid") || $("#"+pid).prevUntil(".photoitem").last().prev().attr("id") || $("#"+pid).prev(".photoitem").attr("id") || $(".photoitem").last().attr("id");  
      
  if (prevPID !== undefined) {
    $("#lightbox-spinner").addClass("wait");
    getLightboxDownloadURL(prevPID, function(downloadURL){
      gotNextOrPrevLightboxDownloadURL(downloadURL, prevPID, callback, callbackParam);
    });
  }
}

function gotNextOrPrevLightboxDownloadURL(downloadURL, pid, callback, callbackParam) {
  callback = callback || noop;
  if (pid) {
    if (downloadURL) {
      $.ajax({ url: downloadURL, type: 'GET',
        success: function(encryptedPhoto){
          var encryptedB64 = JSON.parse(encryptedPhoto).data;
          decrypt(encryptedB64, [theKey]).then(function(plaintext) {
            var b64 = plaintext.data;

            // if photo is in cache, and in fact in the, no need to add again. 
            addImgToDOMIfNotAlreadyInCache(pid, b64);
            callback(callbackParam);
          });
        }
      });
    }
  }
}


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

  if (!isMobile) {  // seems like some android phones have issues with the exit fullscreen call
    try {
      
      if (document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
        var cancelFullScreen = document.exitFullscreen || document.mozCancelFullScreen || document.webkitExitFullscreen || document.msExitFullscreen;
        if (cancelFullScreen) {
          cancelFullScreen.call(document);
        }
      }
      
    } catch (e) {
      // likely still a phone we didn't catch in isMobile or sth else happened.
    }
  }
}

if (isMobile) {
  $("#lightbox-fullscreen").hide();
}



////////////////////////////////////////////////////
///////////////     LIGHTBOX       /////////////////
////////////////////////////////////////////////////

var lightbox;
var lbox;
$(document).ready(function () {
  lightbox = new Swiper ('#lightbox-swipe-container', {
    // Optional parameters
    virtual : true,
    wrapperClass: "lightbox-wrapper",
    keyboard: {enabled : true},
    preloadImages: false,
    lazy:false,
    setWrapperSize:true,
    slidesPerView:1,
    slidesPerColumn:1,
    addSlidesBefore:1,
    addSlidesAfter:1
  });

  lbox = lightbox.virtual;
});

function lightboxPhotoChanged(pid) {
  pid = pid || undefined;
  
  $("#lightbox-next-button").html("");
  $("#lightbox-prev-button").html("");
  $("#lightbox-next-button").off();
  $("#lightbox-prev-button").off();

  // wait 50ms to make sure virtual DOM is reflected correctly in real DOM
  // all because injecting inline b64 takes time...
  // then check if previous & next slides have image, if not, load them.

  setTimeout(function () {

    // new active slide's PID
    pid = pid || $(".swiper-slide-active").find("div").attr("pid");
    
    if (pid) {  
      history.pushState(pid, null, '/photos?p='+pid);
      activePID = pid;
      preparingToDisplayPhoto = false;
      $("#" + pid).find(".photo").removeClass("is-loading");
    }

    var prevSlideDIV = $(".swiper-slide-prev").find("div");
    var prevSlidePID = prevSlideDIV.attr("pid");

    var nextSlideDIV = $(".swiper-slide-next").find("div");
    var nextSlidePID = nextSlideDIV.attr("pid");
    
    if (nextSlideDIV.find("img").length <= 0) {
      // doesn't have image
      preloadNextSlide(nextSlidePID);
    }

    if (prevSlideDIV.find("img").length <= 0) {
      // doesn't have image
      preloadPrevSlide(prevSlidePID);
    }

    // add the prev / next button images 
    var nextImgThumb = $("#" + nextSlidePID).find("img").attr("src");
    var prevImgThumb = $("#" + prevSlidePID).find("img").attr("src");
    
    if (nextImgThumb) {
      if (nextImgThumb !== "" && nextImgThumb !== "//:0") {
        $("#lightbox-next-button").html("<img src='"+nextImgThumb+"' draggable='false'>");
        $("#lightbox-next-button").on('click', function(event) {
          lightbox.slideNext();
        }); 
      }
    }

    if (prevImgThumb) {
      if (prevImgThumb !== "" && prevImgThumb !== "//:0") {
        $("#lightbox-prev-button").html("<img src='"+prevImgThumb+"' draggable='false'>"); 
        $("#lightbox-prev-button").on('click', function(event) {
          lightbox.slidePrev();
        }); 
      }
    }

  }, 50);
}

function getSlideIndex(pid) {
  var slideIndex;

  // don't use indexOf "<div>" etc. here.
  // if the div has img in it, string won't ever match. 
  // instead check for each slide, and check to see if each slide element has a matching pid. 
  // it takes more time, but it's guaranteed to be accurate. 

  lbox.slides.forEach(function(slide, index) {
    if ($(slide).attr("pid") === pid) {
      slideIndex = index;
    }
  });

  return slideIndex;
}

function isImgInLightboxCache(pid) {
  var inCache; 
  if (lbox.cache) {
    var slideIndex = getSlideIndex(pid);
    inCache = $(lbox.cache[slideIndex]).find("img").length > 0;
  } else {
    inCache = false;
  }
  return inCache;
}

function addImgToDOMIfNotAlreadyInCache (pid, b64) {
  if (!isImgInLightboxCache(pid)) {
    var slideShell = $(".swiper-slide").find("div[pid='"+pid+"']");
    var lightboxPhotoElement = '<img class="lightbox-photo" draggable="false" src="'+b64+'">';
    slideShell.html(lightboxPhotoElement);
    setTimeout(function () { lbox.update(); }, 10);
  }
  $("#lightbox-spinner").removeClass("wait");
}

function getLightboxDownloadURL(pid, callback, forceOriginal) {
  callback = callback || noop;
  forceOriginal = forceOriginal || false;

  if (pid) {
    var lid = pid.replace("p", "l");
    var origRef = rootRef.child(pid + ".crypteefile");
    var lightRef = rootRef.child(lid + ".crypteefile");

    if (forceOriginal) {
      // force use original url
      useOriginal();
    } else {
      // first try lightbox, otherwise fallback to original
      useLightboxPreviewSize();
    }
  } else {
    callback(null);
  }


  function useOriginal() {
    origRef.getDownloadURL().then(function(originalDownloadURL) {
      callback(originalDownloadURL);
    }).catch(function(error) {
      error.pid = pid;
      handleError("Error getting Photo URL.", error);
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

  function useLightboxPreviewSize () {
    lightRef.getDownloadURL().then(function(lightboxDownloadURL) {
      callback(lightboxDownloadURL);
    }).catch(function(error) {
      if (error.code === 'storage/object-not-found') {
        // fallback for legacy photo without preview image. so load original.
        useOriginal();
      }
    });
  }
}



// this was in displayPhoto 

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
      // $(".exifButton").hide();
    // }
// });


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
  minMatchCharLength: 2,
  includeMatches: true,
  includeScore: true,
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
  /// prevent an early click initiating initSearch – so check user id
  /// I think some users have an issue with the initial animation
  /// which exposes the search bar and people click quickly.

  if (theUserID) {
    //   get all titles.
    searchArray = [];
    $("#search-bar").find(".button").addClass("is-loading");
    titlesRef.get().then(function(titles) {
      var howManyFolders = titles.docs.length;
      var currentFolderIndex = 0;

      if (howManyFolders >= 1) {
        titles.docs.forEach(function(titleObject){
          var titlesOfFolder = titleObject.data().titles;
          var fid = titleObject.id;
          var encryptedTitlesObject = JSON.parse(titlesOfFolder).data;
          decrypt(encryptedTitlesObject, [theKey]).then(function(plaintext) {
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
      handleError("Error getting photo & album titles for search", error);
    });
  }
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
    $("html, body").removeClass("search-active");
  }, 500);

  currentResultSelection = 0;
}

function showSearch (callback) {
  callback = callback || noop;

  $("html, body").addClass("search-active");
  setTimeout(function () {
    $("#photos-search-contents").addClass("search-active");
  }, 500);

  callback();
}

var searchResultsPhotosToDownload = [];
var searchResultsFolderPhotosToDownload = [];
function displaySearchResults (results, term) {
  $("#photos-search-contents").html("");
  var resultsToAppend = [];
  searchResultsPhotosToDownload = [];
  searchResultsFolderPhotosToDownload = [];
  var resultFolders = {};

  $.each(results, function(i, rslt) {
    
    if (searchResultsPhotosToDownload.length <= 80) { // limits search results to max 80 so that it's divisible by 4, and it's 20 rows
      var result = rslt.item;
      var resultTitle = result.name;
      var resultFTitle = result.fname;
      var resultFID = result.fid;
      var resultPID = result.pid;
      var matchesAlbumName = false;
      var matchesPhotoName = false;
      $.each(rslt.matches, function(i, mtch) {
        if (mtch.key === "name") {
          resultTitle = underlineSearchResult(mtch.indices,resultTitle);
          matchesPhotoName = true;
        }

        if (mtch.key === "fname") {
          resultFTitle = underlineSearchResult(mtch.indices,resultFTitle);
          resultFolders[resultFID] = resultFolders[resultFID] || {};
          resultFolders[resultFID].photos = resultFolders[resultFID].photos || [];
          resultFolders[resultFID].photos.push(resultPID);
          resultFolders[resultFID].title = resultFTitle;
          resultFolders[resultFID].fid = resultFID;
          matchesAlbumName = true;
        }
      });

      if (matchesPhotoName) {
        resultsToAppend.push(searchResultPhoto(resultPID, resultFID, resultTitle, resultFTitle));
        searchResultsPhotosToDownload.push(rslt);
      }

    } else {
      return false;
    }

  });
  
  // photos first
  $("#photos-search-contents").append(resultsToAppend.join(""));
  
  //folders first
  var folderResultsHTML = prepareSearchResultFolders(resultFolders);
  $("#photos-search-contents").append(folderResultsHTML);
  

  showSearch();

  searchTimer = setTimeout(function () {
    $.each(searchResultsPhotosToDownload, function(i, rslt) {
      getThumbnail(rslt.item.pid);
    });

    $.each(searchResultsFolderPhotosToDownload, function(i, pid) {
      getThumbnail(pid);
    });    

  }, 250);
  
  function searchResultPhoto(pid, fid, ptitle, ftitle) {
    ptitle = ptitle.replace(".jpg", "").replace(".png", "").replace(".jpeg", "").replace(".JPG", "").replace(".PNG", "").replace(".JPEG", "");
    var photo =
    '<div class="column is-3 photos-search-result sr-'+pid+'" fid="'+fid+'" pid="'+pid+'" ptitle="'+ptitle+'" id="sr-'+pid+'">'+
    '  <div class="photos-sr-photo image is-loading" pid="'+pid+'">'+
    '     <img src="" id="">'+
    '  </div>'+
    '  <p class="title is-5 photos-sr-photo">'+ptitle+'</p>'+
    '  <p class="subtitle is-6 photos-sr-folder">'+ftitle+'</p>'+
    '</div>';
  
    return photo;
  }
  
  function searchResultFolder(srfolder) {
    var fid = srfolder.fid;
    var ftitle = srfolder.title;
    var photosText = "Photos";
    var numPhotos = srfolder.photos.length;
    if (numPhotos === 1) { photosText = "Photo"; }
    var folder =
    '<div class="column is-half-tablet is-full-mobile photos-search-result-folder sr-'+fid+'" fid="'+fid+'" ftitle="'+ftitle+'" id="sr-'+fid+'">'+
      '<div class="sr-folder-images">'+
        searchResultFolderPhotos(srfolder.photos) +
      '</div>'+
    '  <p class="title is-5 photos-sr-folder">'+ftitle+'</p>'+
    '  <p class="subtitle is-6">('+numPhotos+' ' +photosText+')</p>'+
    '</div>';
  
    return folder;
  }
  
  function searchResultFolderPhotos(photos) {
    var foldersPhotos = [];
    $.each(photos, function(i, pid) {
      if (i <= 3) { // 4 photos is good
        var photo =
        '  <div class="sr-folder-photo image is-loading" pid="'+pid+'">'+
        '     <img src="" id="">'+
        '  </div>';
        foldersPhotos.push(photo);
        searchResultsFolderPhotosToDownload.push(pid);
      }
    });
  
    return foldersPhotos.join("");
  }

  function prepareSearchResultFolders(folders) {
    var folderResultsToAppend = [];
    $.each(folders, function(i, folder) {
      folderResultsToAppend.push(searchResultFolder(folder));
    });
    return folderResultsToAppend.join("");
  }

}

$('#photos-search-contents').on('click', '.photos-sr-photo', function(event) {
  var result = $(this).parents(".photos-search-result");
  var fidToLoad = result.attr("fid");
  var pidToLoad = result.attr("pid");
  
  clearSearch ();
  homeFolderLoaded = false; otherFolderLoaded = false;
  if (fidToLoad === "home") {
    getHomeFolder(function(){
      setTimeout(function () {
        // give it some time for the lightbox to initialize (takes milliseconds but nevertheless)
        loadPhoto(pidToLoad, "", "display");
      }, 100);
    });
  } else {
    getAllFilesOfFolder (fidToLoad,function(){
      setTimeout(function () {
        // give it some time for the lightbox to initialize (takes milliseconds but nevertheless)
        loadPhoto(pidToLoad, "", "display");
      }, 100);
    });
  }
});

$('#photos-search-contents').on('click', '.photos-sr-folder, .sr-folder-images', function(event) {
  var fidToLoad = $(this).parents(".photos-search-result").attr("fid") || $(this).parents(".photos-search-result-folder").attr("fid");
  
  clearSearch ();
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
  if (ptitle === ".jpg" || ptitle === undefined || ptitle === null || ptitle === "" || ptitle === " ") {
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

    getB64OfPhotoID (activePID, function(decryptedPhoto){
      downloadPhotoToDisk(activePID, activePName, decryptedPhoto);
    }, function(error) {
      $("#lightbox-download").removeClass("is-loading");
      handleError("Error downloading original photo to save to disk", error);    
    });

  }
}

















































////////////////////////////////////////////////////
/////////        CREATE FOLDER DATES        ////////
////////////////////////////////////////////////////

var foldersWithoutDates = [];

function setFolderDateFromThumbnailEXIF(fid, callback, callbackParam) {
  callback = callback || noop;
  var dateToSet = "";
  breadcrumb('[EXIF] – SETTING FOLDER DATE FROM ITS THUMBNAIL EXIF:' + fid);
  showBackgroundProgress(); 

  if (fid) {

    getFolderThumbnailID(fid, function(tid){
      if (tid) {
        breadcrumb('[EXIF] – GOT FOLDER THUMBNAIL ID: ' + tid);
        getEXIFDateStringOfPhotoID(tid, fid, function(date) {
          var dateToSet = dateFromEXIF(date) || ""; // "YYYY:MM"      –  i.e. "2019:07" 
          breadcrumb('[EXIF] – GOT DATE FOR: ' + tid + " (" + dateToSet + ")");
          setFolderDate(fid, dateToSet);
        });
      } else {
        breadcrumb('[EXIF] – COULDNT GET FOLDER THUMB: ' + fid + " – SKIPPING");
        setFolderDate(fid);
      }
    });
  
  } else {
    console.error("Folder ID can't be undefined in setFolderDate");
    callback(callbackParam);
  }



  function setFolderDate(fid, dateToSet) {
    dateToSet = dateToSet || "";
    homeRef.doc(fid).update({ "date" : dateToSet }).then(function(response) {
      breadcrumb('[EXIF] – DONE SETTING DATE FOR: ' + fid);
      try {
        // if folder is in foldersWithoutDates, remove it.
        foldersWithoutDates.splice( foldersWithoutDates.indexOf(fid) , 1 );
      } catch (e) {}
      hideBackgroundProgress();
      callback(callbackParam);
    }).catch(function(error) {
      console.error("Error setting folder date from its thumbnail's EXIF:", error);
    });
  }


}

function updateFoldersWithoutDates() {
  if (foldersWithoutDates.length > 0) {
    breadcrumb('[EXIF UPDATE] – ADDING DATES TO FOLDERS IN ACTIVE DIRECTORY (' + foldersWithoutDates.length + " LEFT)");
    showLibraryUpdate(foldersWithoutDates.length + " ITEMS LEFT");
    
    setFolderDateFromThumbnailEXIF(foldersWithoutDates[0], function(){
      updateFoldersWithoutDates();
    });

  } else {
    breadcrumb('[EXIF UPDATE] – COMPLETED. ADDED DATES TO FOLDERS IN ACTIVE DIRECTORY');
    // done. restart
    sessionStorage.setItem("key", JSON.stringify(keyToRemember));
    window.location.reload();
  }
}






































//
