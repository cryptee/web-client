////////////////////////////////////////////////////
////////////////// ALL GLOBAL VARS /////////////////
////////////////////////////////////////////////////
var firestore = firebase.firestore();
var cloudfunctions = firebase.functions();
setCloudFunctionsAPIBaseURL();

var theKey;
var keyToRemember;

if (sessionStorage.getItem('key')) {
  keyToRemember = JSON.parse(sessionStorage.getItem('key')); // hashedKey
  sessionStorage.removeItem('key');
}

if (localStorage.getItem('memorizedKey')) {
  keyToRemember = JSON.parse(localStorage.getItem('memorizedKey')); // hashedKey
}

var homeRef, titlesRef, uploadsRef, userRef;
var connectedRef = db.ref(".info/connected");

var connected = false;
var upOrDownInProgress = false;

var activeFID = "home";

var activePID = "";
var activePName = "";

var bootOfflineTimer = setInterval(function() { if(!$("#key-modal").hasClass("shown")) { showBootOffline(); } }, 4000);
var thumbnailGenerator;
var homeLoaded = false;

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

var batchDeleteFiles = cloudfunctions.httpsCallable('batchDeleteFiles');
function batchDeleteItems(deletionsObject, callback, errorCallback) {
  callback = callback || noop;
  errorCallback = errorCallback || noop;
  breadcrumb('[BATCH DELETE] Starting...');
  if (deletionsObject) { 
    batchDeleteFiles({ type: "photos", deletions : deletionsObject }).then(function (result) {
      var functionResponse = result.data;
      if (functionResponse) {
        if (functionResponse.status === "done") {
          // all set. photos deleted.
          breadcrumb('[BATCH DELETE] Done.');
          callback();
        }
      }
    }).catch(function (error) {
      handleError("Error deleting photos", error);
      errorCallback(error);
    }); 
  }
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
  if (!darkMode) {
    $("#nav-logo").attr("src", "../assets/loading-f5f5f5.gif");
  }
  
  $("#main-progress").removeAttr("value");
}

function hideBackgroundProgress() {
  if (!darkMode) {
    $("#nav-logo").attr("src", "../assets/cryptee-logo-b.svg");
  } else {
    $("#nav-logo").attr("src", "../assets/cryptee-logo-w.svg");
  }

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

// var observer;

// if (isMobile || isipados) {
//   observer = new IntersectionObserver(onEntryAndExit, { rootMargin: "25% 0% 25% 0%", threshold: [0.15] } );
// } else {
//   observer = new IntersectionObserver(onEntryAndExit, { rootMargin: "50% 0% 50% 0%", threshold: [0.15] } );
// }

var observer = new IntersectionObserver(onEntryAndExit, { rootMargin: "50% 0% 50% 0%", threshold: [0.20] } );

var navbar = document.getElementById("photos-top-nav");
var oneRem = parseFloat(getComputedStyle(document.documentElement).fontSize);
var sticky = navbar.offsetTop - ( oneRem / 4 );

var scrollStoppedTimeout;
$(window).on('scroll', throttleScroll(function(event) {
// $(window).on('scroll', function(event) {  
  if (Math.max($(window).scrollTop(), $("body").scrollTop(), document.body.scrollTop) >= sticky) {
    if (!navbar.classList.contains("sticky")) {
      navbar.classList.add("sticky");
    }
  } else {
    navbar.classList.remove("sticky");
  }

  lastActivityTime = (new Date()).getTime();

  thumbnailEntryTimeout = 750;
  clearTimeout(scrollStoppedTimeout);
  scrollStoppedTimeout = setTimeout(function () {
    thumbnailEntryTimeout = 10;
  }, 10);

// });
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

    clearTimeline();
    drawTimeline(sorttype.replace("sort-", ""));
  }, 250);
});

function sortByTitle (reverse){
  reverse = reverse || false;
  var sorttype;
  $(".sort-button").removeClass("selected");
  if (reverse) {
    $("#sort-az-desc").addClass("selected");
    sorttype = "az-desc";
    $('.folder-content').sort(function(a, b) {
      var at = ($(a).attr("photositemname") || "").toUpperCase();
      var bt = ($(b).attr("photositemname") || "").toUpperCase();
      if (at > bt) {
        return -1;
      } else {
        return 1;
      }
    }).appendTo('#folder-contents');
  } else {
    $("#sort-az-asc").addClass("selected");
    sorttype = "az-asc";
    $('.folder-content').sort(function(a, b) {
      var at = ($(a).attr("photositemname") || "").toUpperCase();
      var bt = ($(b).attr("photositemname") || "").toUpperCase();
      if (at < bt) {
        return -1;
      } else {
        return 1;
      }
    }).appendTo('#folder-contents');
  }

  hideWindowProgress();
  saveFolderSort(activeFID, sorttype);
  updateLightboxSort(sorttype);
}

function sortByDate (reverse){
  reverse = reverse || false;
  var sorttype;
  $(".sort-button").removeClass("selected");
  if (reverse) {
    // up -> down = newest -> oldest
    $("#sort-date-desc").addClass("selected");
    sorttype = "date-desc";
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
    sorttype = "date-asc";
    $('.folder-content').sort(function(a, b) {
      if ($(a).attr("datesort") < $(b).attr("datesort")) {
        return -1;
      } else {
        return 1;
      }
    }).appendTo('#folder-contents');
  }

  hideWindowProgress();
  saveFolderSort(activeFID, sorttype);
  updateLightboxSort(sorttype);
}

function saveFolderSort(fid, sorttype, callback, callbackParam) {
  callback = callback || noop;
  fid = fid || activeFID;
  sorttype = sorttype || "az-asc";
  
  if (fid) {
    titlesRef.doc(fid).set({"sort" : sorttype}, {
      merge: true
    }).then(function(response) {
      callback(callbackParam);
    }).catch(function(error) {
      error.fid = fid;
      error.sorttype = sorttype;
      console.error("Error saving sort of folder: ", error);
    });
  } else {
    callback(callbackParam);
  }
}

function updateLightboxSort(sorttype) {
  sorttype = sorttype || "az-asc";
  var itemsArray = sortItemsObject(sorttype);

  // remove all lightbox events to stop thousands of slideChange events from triggering.
  // and remove all slides from lightbox 
  try { lightbox.off('slideChange'); } catch (e) {}
  lbox.removeAllSlides(); 

  itemsArray.forEach(function (item, index) {
    if (isItAMediaID(item[0])) {
      lbox.appendSlide("<div pid='"+item[0]+"' class='swiper-zoom-container'></div>");
    }
  });
  
  lbox.update();

  setTimeout(function () {
    // now that all slides are in the lightbox, start listening for slideChange again.
    lightbox.on('slideChange', lightboxPhotoChanged); 
  }, 10);
}

var timelineObject = {};
var clearingTimeline = false;

clearTimeline(true);

function clearTimeline(force) {
  clearingTimeline = true;
  $("#photos-timeline-navigator").addClass("loading");
  setTimeout(function () {
    $("#photos-timeline-navigator").children().remove();
    $("#photos-timeline-navigator").removeClass("loading");
    setTimeout(function () {
      clearingTimeline = false;
    }, 300);
  }, 300);

  if (force) {
    timelineObject = {};
    timelineObject.az = {};
    timelineObject.years = {};
    timelineObject.months = {};
    timelineObject.days = {};

    timelineObject.yearsAndMonths = {};
    timelineObject.monthsAndDays = {};
  }
}

function drawTimeline(sort) {
  sort = sort || "az-asc"; // processTitles & all other sort's default fallback is az-asc
  if (!isMobile && !isios && !isipados) {

    var sortOrder = "asc";
    if (sort.indexOf("desc") > -1) {
      sortOrder = "desc";
    }

    var whatToUse = analyzeTimelineObject(sort);
    var timelineInUse = timelineObject[whatToUse];
    var timelineLabels = Object.keys(timelineInUse);
    var labels;

    if (sortOrder === "desc") {
      labels = timelineLabels.sort().reverse();
    } else {
      labels = timelineLabels.sort();
    }

    if (whatToUse === "yearsAndMonths" || whatToUse === "months") {
      renderTimeline(labels,whatToUse);
    } else {
      if (labels.length > 1) {
        renderTimeline(labels,whatToUse);
      }
    }
    
  }
}

function analyzeTimelineObject(sort) {
  var whatToUse;
  if (sort.startsWith("date")) {
    var years = Object.keys(timelineObject.years);
    var months = Object.keys(timelineObject.months);
    var days = Object.keys(timelineObject.days);
    if (years.length <= 1) {
      // all from same year.

      if (months.length <= 1) {
        // all from same month.
        whatToUse = "days";
      } else {
        // all from same year. use months and days
        if (months.length >= 4) {
          whatToUse = "months";
        } else {
          whatToUse = "monthsAndDays";
        }
      }

    } else {
      // use years & months if less than 10 years
      if (years.length >= 10) {
        whatToUse = "years";
      } else {
        whatToUse = "yearsAndMonths";
      }
    }

  } else {
    //  use az 
    whatToUse = "az";
  }
  return whatToUse;
}

function addToTimeline(item) {
  
  var name = item[1] || "Untitled";
  var exif = item[2] || "0000:00:00";
  var date = dateFromEXIF(exif);

  var year = yearFromTitle(name) || date.split(":")[0] || "0000";
  var month = date.split(":")[1] || "00";
  var day = date.split(":")[2] || "00";

  var yearAndMonth = year + ":" + month || "0000:00";
  var monthAndDay = month + ":" + day || "00:00";

  var firstLetter = name.slice(0,1);

  timelineObject.years[year] = (timelineObject.years[year] || 0) + 1;
  timelineObject.yearsAndMonths[yearAndMonth] = (timelineObject.yearsAndMonths[yearAndMonth] || 0) + 1;
  timelineObject.monthsAndDays[monthAndDay] = (timelineObject.monthsAndDays[monthAndDay] || 0) + 1;
  timelineObject.months[month] = (timelineObject.months[month] || 0) + 1;
  timelineObject.days[day] = (timelineObject.days[day] || 0) + 1;

  timelineObject.az[firstLetter] = (timelineObject.az[firstLetter] || 0) + 1;
}

function renderTimeline(labels, whatToUse) {
  if (!clearingTimeline) {
    $("#photos-timeline-navigator").attr("type", whatToUse);
    
    labels.forEach(function(label, index){
      $("#photos-timeline-navigator").append(renderTimelineLabel(label, whatToUse));
    });
    
    $("#photos-timeline-navigator").children().each(function(i){
      var elem = $(this);
      setTimeout(function () { elem.removeClass("loading"); }, i * 25);
    });
  } else {
    setTimeout(function () {
      renderTimeline(labels, whatToUse);
    }, 10);
  }
}

function renderTimelineLabel(label, whatToUse) {
  var labelElement = "";
  var year, month, monthName, day;

  if (whatToUse === "yearsAndMonths") {
    year = label.split(":")[0];
    month = label.split(":")[1];
    monthName = monthsOfYearArray[parseInt(month)];

    if (!$("#tldate-" + year).length) {
      if (year !== "0000") {
        labelElement = "<p class='loading' goto='"+year+"' id='tldate-"+year+"'>"+year+" &horbar;&horbar;</p>";
      } else {
        labelElement = "<p class='loading' goto='"+year+"' id='tldate-"+year+"'>&infin; &horbar;&horbar;</p>";
      }
    }  

    if (year !== "0000") {
      labelElement = labelElement + "<p class='sub-tl-label loading' goto='"+year+month+"' id='tldate-"+year+month+"'>"+monthName+" &horbar;</p>";
    }
  } 

  else if (whatToUse === "monthsAndDays") {
      
    year = Object.keys(timelineObject.years)[0]; // all months have same year. 
    month = label.split(":")[0];
    day = label.split(":")[1];
    monthName = monthsOfYearArray[parseInt(month)];
    
    if (!$("#tldate-" + year + month).length) {
      if (month !== "00") {
        labelElement = "<p class='loading' goto='"+year+month+"' id='tldate-"+year+month+"'>"+monthName+" &horbar;&horbar;</p>";
      } else {
        labelElement = "<p class='loading' goto='"+year+month+"' id='tldate-"+year+month+"'>&infin; &horbar;&horbar;</p>";
      }
    }  

    if (month !== "00") {
      labelElement = labelElement + "<p class='sub-tl-label loading' goto='"+year+month+day+"' id='tldate-"+year+month+day+"'>"+day+" &horbar;</p>";
    }

  }
  
  else if (whatToUse === "months") {
      
    year = Object.keys(timelineObject.years)[0]; // all months have same year. 
    monthName = monthsOfYearArray[parseInt(label)];
    labelElement = "<p class='loading' goto='"+year+label+"' id='tl-label-"+label+"'>" + monthName + " &horbar;</p>";
  
  } 

  else if (whatToUse === "days") {
    
    month = Object.keys(timelineObject.months)[0]; // all days have same month.
    monthName = monthsOfYearArray[parseInt(month)];
    labelElement = "<p class='loading' goto='day-"+label+"' id='tl-label-"+label+"'>" + monthName +  " " + label + " &horbar;</p>";

  } else {
    
    labelElement = "<p class='loading' goto='"+label+"' id='tl-label-"+label+"'>"+label+" &horbar;</p>";
  
  }
  
  return labelElement;
}

$("#photos-timeline-navigator").on('click', "p", function(event) {
  var goto = $(this).attr("goto");
  var firstElem;
  
  if (goto.startsWith("day")) {
    goto = goto.replace("day-", "");
    firstElem = $(".folder-content[datesort$='"+goto+"']")[0];
  } else {
    firstElem = $(".folder-content[datesort^='"+goto+"']")[0] || $(".folder-content[photositemname^='"+goto+"']")[0];
  }

  if (firstElem) {
    if (isipados || isios) {
      var offset = $(firstElem).offset().top - 200;
      $("html").animate({ scrollTop: offset }, 3000);
    } else {
      firstElem.scrollIntoView();
    }
  }
}); 

function scrollToItem (id, animationTime) {
  animationTime = animationTime || 100;
  if (id) {
    if ($("#" + id).length) {
      if ($("#" + id).offset()) {
        var offset = $("#" + id).offset().top - 200;
        $("html").animate({ scrollTop: offset }, animationTime);
      }
    }
  }
}

////////////////////////////////////////////////////
////////////////// SIGN IN AND KEY /////////////////
////////////////////////////////////////////////////

authenticate(function(user) {
  //got user 
  
  checkForExistingUser(function(){
    if (keyToRemember) {
      checkKey();
    } else {
      showKeyModal();
    }
  });

  webAppURLController();
  lazyLoadUncriticalAssets();

}, function(){
  // no user. redirect to sign in IF NOT WEBAPP
  webAppURLController("signin?redirect=photos");
});

function checkForExistingUser (callback){
  callback = callback || noop;
  getKeycheck().then(function(kcheck) {
    callback();
  });
}

function checkKey (key) {
    // keycheck is set in auth.js in getKeyckeck();
    var encryptedStrongKey = JSON.parse(keycheck).data; // or encrypted checkstring for legacy accounts

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
  favRef.onSnapshot(function (snapshot){ gotFavorites(snapshot); });

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
    if (getUrlParameter("f") !== "favorites") {
      getAllFilesOfFolder(getUrlParameter("f"));
    } else {
      getFavoritesFolder();
    }
  } else if (getUrlParameter("favorites")) {
    getFavoritesFolder();
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
            if (isItAMediaID(item.data().id)) {
              homePhotosArray.push(item.data().id);
            } else if (isItAFolderID(item.data().id)) {
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

  doesTheOriginalExist(pidOrTid, function(originalLost, originalURL){
    originalURL = originalURL || "";
    if (originalLost) {
      // ORIGINAL FILE LOST. DELETE BOTH THUMB AND ORIGINAL.
      handleError("Photo doesn't have original. Will sadly purge.", {"id":pidOrTid});
      sadlyPurgeFile(pidOrTid);
    } else {
      // ORIGINAL FILE EXISTS, LET'S CHECK IF THUMBNAIL IS MISSING.
      doesTheThumbnailExist(pidOrTid, function(thumbLost, thumbURL){
        thumbURL = thumbURL || "";
        if (thumbLost) {
          handleError("Thumb was missing, but found the original. Will try to regenerate.", {"id":pidOrTid});
          
          // THUMB IS MISSING, REGENERATE THUMBNAIL.
          // mimic the upload phase, but first download original, use generateThumbnail and go through the whole spiel to make it work from scratch.
          // this will definitely be more extensive than the original uploader.

          // gotURL(originalURL, function(decryptedOriginalsB64){

              // YOU ALSO NEED TO CHECK IF THE PHOTO IS A GIF OR NOT. GIFS DONT HAVE LIGHTBOX IMAGES. 

          // });

          
        } else {
          // WTF. ALL IS GOOD. SOMETHING'S OFF.
        }
      });
    }
  });

  function gotURL(downloadURL, callback, callbackParam) {
    callback = callback || noop;
    $.ajax({ url: downloadURL, type: 'GET',
      success: function(encryptedPhoto){ 
        gotEncryptedPhoto(encryptedPhoto, callback, callbackParam); 
      },
      error:function (xhr, ajaxOptions, thrownError){ 
        err("Error downloading photo during bulk download.", thrownError); 
      }
    });
  }

  function gotEncryptedPhoto(encryptedPhoto, callback, callbackParam) {
    callback = callback || noop;
    var encryptedB64 = JSON.parse(encryptedPhoto).data;
    decrypt(encryptedB64, [theKey]).then(function(plaintext) {
      var decryptedPhoto = plaintext.data;
      callback(decryptedPhoto, callbackParam);
    }).catch(function (error) {
      err("Error decrypting photo during bulk download."); 
    });
  }

  function err(msg, err) {
    err = err || {};
    err.pid = pid;
    handleError(msg, err);
    callback(callbackParam); // something didn't work, sadly skip and continue. 
  } 

}

function doesTheOriginalExist(pid, callback) {
  if (pid.startsWith("p-") || pid.startsWith("t-") || pid.startsWith("l-")) {
    var fileRef = rootRef.child(convertID(pid,"p") + ".crypteefile");
    fileRef.getDownloadURL().then(function(url) {
      // just to check if it exists. not really going to use it.
      originalLost = false;
      callback(originalLost, url);
    }).catch(function(error) {
      if (error.code === 'storage/object-not-found') {
        originalLost = true;
        callback(originalLost);
      }
    });
  } else {
    // likely video or raw. 
    originalLost = false;
  }
}

function doesTheLightboxExist(lid, callback) {
  var fileRef = rootRef.child(convertID(lid,"l") + ".crypteefile");
  fileRef.getDownloadURL().then(function(url) {
      // just to check if it exists. not really going to use it.
      lightboxLost = false;
      callback(lightboxLost, url);
  }).catch(function(error) {
    if (error.code === 'storage/object-not-found') {
      lightboxLost = true;
      callback(lightboxLost);
    }
  });
}

function doesTheThumbnailExist(tid, callback) {
  var fileRef = rootRef.child(convertID(tid,"t") + ".crypteefile");
  fileRef.getDownloadURL().then(function(url) {
      // just to check if it exists. not really going to use it.
      thumbLost = false;
      callback(thumbLost, url);
  }).catch(function(error) {
    if (error.code === 'storage/object-not-found') {
      thumbLost = true;
      callback(thumbLost);
    }
  });
}

function sadlyPurgeFile(pidOrTid) {

  if (activeFID !== "favorites") {
  
    getFolderThumbnailID(activeFID, function(thumb){
      var isFolderThumbDeleted = false;
      var pid = convertID(pidOrTid,"p");
      
      var whereFrom;
      if (activeFID === "home") {
        whereFrom = homeRef.doc(pid);
      } else {
        whereFrom = homeRef.doc(activeFID).collection("photos").doc(pid);
      }

      try {
        if (pid === convertID(thumb,"p")) { isFolderThumbDeleted = true; }
      } catch (e) {
        isFolderThumbDeleted = false;
      }

      var tid = convertID(pid,"t");
      var lid = convertID(pid,"l");
      var photoRef = rootRef.child(pid + ".crypteefile");
      var thumbRef = rootRef.child(tid + ".crypteefile");
      var lightRef = rootRef.child(lid + ".crypteefile");

      photoRef.delete().finally(function() {
        thumbRef.delete().finally(function() {
          lightRef.delete().finally(function() {
            whereFrom.delete().then(function() {
              if (activeFID !== "home" && activeFID !== "favorites") {
                var adjustmentCount = 0 - Object.keys(selectionsObject).length;
                adjustFolderCount (activeFID, adjustmentCount, isFolderThumbDeleted);
              }
              $("#"+pid).remove();
              delete activeItemsObject[pid];
              updateTitles();
            }).catch(function(err){});
          }).catch(function(err){});
        }).catch(function(err){});
      }).catch(function(error) {
        if (error.code === "storage/object-not-found") {
          thumbRef.delete().catch(function(err){});
          whereFrom.delete().catch(function(err){});
          lightRef.delete().catch(function(err){});
          if (activeFID !== "home" && activeFID !== "favorites") {
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

}


////////////////////////////////////////////////////
//////////////////// FIRESTORE CRUD ////////////////
////////////////////////////////////////////////////

function beforeLoadingFolder() {
  clearSelections();
  showWindowProgress();
  $("body, html").animate({ scrollTop: "0px" }, 1000);
  lastActivityTime = (new Date()).getTime();
}

function prepareTopNavButtons(fid) {

  // remove unavailable from all buttons, and add slowly below
  // select-all will be decided in sortAndRenderActiveItemsObject
  // once we know if there's any photos in folder to select in the first place.
  $(".photos-nav-item, .sort-button").not("#photos-select-all-button").removeClass("unavailable");

  if (fid === "home") {
    $("#photos-new-folder-button, #photos-get-ghost-folder-button").removeClass("unavailable");
    $("#get-home-folder-button").addClass("unavailable");
    showFavoritePhotosButton();
  }

  else if (fid === "favorites") {
    $("#get-home-folder-button").removeClass("unavailable");
    $("#photos-new-folder-button, #photos-get-ghost-folder-button, #photos-upload-photo-button, #photos-upload-photo-button, #get-favorites-folder-button").addClass("unavailable");
    $("#sort-az-asc, #sort-az-desc").addClass("unavailable");
    
  }

  else {
    $("#get-home-folder-button").removeClass("unavailable");
    $("#photos-new-folder-button, #photos-get-ghost-folder-button, #get-favorites-folder-button").addClass("unavailable");
    
  }

}

$("#get-home-folder-button").on('click', function(event) {
  event.preventDefault();
  if (activeFID !== "home") {
    getHomeFolder();
  }
});

$("#get-favorites-folder-button").on('click', function(event) {
  event.preventDefault();
  if (activeFID === "home") {
    getFavoritesFolder();
  }
});

function getPIDsOfFolder(fid, callback) {
  callback = callback || noop;
  var pids = [];
  if (fid) {
    homeRef.doc(fid).collection("photos").get().then(function(items) {
      items.docs.forEach(function(doc){
        var pid = doc.id;
        pids.push(pid);
      });
      callback(pids);
    }).catch(function(error){
      error = error || {};
      error.fid = fid || "undefined";
      handleError("Couldn't get PIDs from folder @getPIDsOfFolder", error);
    });
  } else {
    callback([]);
  }
}

// homeRef.get() gets called twice for some reason. hardwiring a logic to stop this.
var homeFolderLoaded = false;
function getHomeFolder (callback, callbackParam) {
  callback = callback || noop;
  if (homeRef) {
    beforeLoadingFolder();
    homeRef.get().then(function(items) {
      if (!homeFolderLoaded) {
        history.replaceState("home", null, '/photos');
        prepareTopNavButtons("home");
        processItemsFromFirestore("home", items, callback, callbackParam);
        homeFolderLoaded = true; otherFolderLoaded = false;
      } else {
        hideWindowProgress();
      }
    });
  }
}

// homeRef.get() gets called twice for some reason. hardwiring a logic to stop this.
var otherFolderLoaded = false;
function getAllFilesOfFolder (fid, callback, callbackParam) {
  callback = callback || noop;
  // if (activeFID !== fid) {
  beforeLoadingFolder();
  homeRef.doc(fid).collection("photos").get().then(function(items) {
    if (!otherFolderLoaded) {
      if (!isios && !isipados) {
        history.pushState(fid, null, '/photos?f='+fid);
      }
      prepareTopNavButtons(fid);
      processItemsFromFirestore(fid, items, callback, callbackParam);
      homeFolderLoaded = false; otherFolderLoaded = true;      
    } else {
      hideWindowProgress();
    }
  });
  // }
}

// homeRef.get() gets called twice for some reason. hardwiring a logic to stop this.
function getFavoritesFolder (callback, callbackParam) {
  callback = callback || noop;
  beforeLoadingFolder();
  
  if (!otherFolderLoaded) {
    if (!isios && !isipados) {
      history.pushState("favorites", null, '/photos?favorites');
    }
    prepareTopNavButtons("favorites");
    showFavoritePhotos(callback, callbackParam);
    homeFolderLoaded = false; otherFolderLoaded = true;      
  } else {
    hideWindowProgress();
  }
  
}

// this is basically processItemsFromFirestore, getTitles and all that jazz in one function, 
// because favorites don't have most of other folders' features. 

function showFavoritePhotos (callback, callbackParam) {
  callback = callback || noop;

  /////// here it's a shorter version of processItemsFromFirestore ///////
  
  if (favoritesLoaded) {
    var favArray = Object.keys(favoritesObject);
    if (favArray.length > 0) {
      $("#folder-contents").html("");

      // clear old global object
      activeItemsObject = {};
      activeItemsObject = favoritesObject;
      activeFID = "favorites";

      sortAndRenderActiveItemsObject("date-desc");

      hideWindowProgress();

      callback();
    } else {
      // there are no favorites, load home instead.
      console.log("[FAVORITES] There are no favorites, loading home instead.");
      getHomeFolder();
    }
  } else {
    console.log("[FAVORITES] Waiting for Favorites to load.");
    setTimeout(function () {
      showFavoritePhotos (callback, callbackParam);
    }, 1000);
  }

}

function showFavoritePhotosButton() {
  if (favoritesLoaded) {
    var favArray = Object.keys(favoritesObject);
    if (favArray.length > 0) {
      // show
      $("#get-favorites-folder-button").removeClass("unavailable");
    } else {
      // hide
      $("#get-favorites-folder-button").addClass("unavailable");
    }
  } else {
    console.log("[FAVORITES] Waiting for Favorites to load.");
    setTimeout(function () {
      showFavoritePhotosButton (callback, callbackParam);
    }, 500);
  }
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

$("#folder-contents").on("click", "#new-folder-shell", function(event){
  $("#new-folder-shell").addClass("creating");
  newFolder("Untitled Album", null, function() {
    $("#new-folder-shell").removeClass("creating");
  });
});

function newFolder (newFTitle, preassignedFID, callback, callbackParam) {
  callback = callback || noop;
  newFTitle = newFTitle || $("#photos-new-folder-title-input").val().trim();
  if (newFTitle !== "") {
    // progressModal("photos-new-folder-modal");
    var uuid = newUUID();
    var fid = preassignedFID || "f-" + uuid;
    var todaysEXIFDate = todaysEXIF();
    var folderObject = {"count" : 0, "id" : fid, "date" : todaysEXIFDate };
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
        folderCreated(fid, newFTitle, todaysEXIFDate, callback, callbackParam);
      });
    }).catch(function(error) {
      console.error("Error creating new folder: ", error);
    });
  }
}



////////////////////////////////////////////////////
/////////      HELPERS & ABSTRACTIONS       ////////
////////////////////////////////////////////////////

// THIS EITHER USES THE THUMBNAIL IMG / LIGHTBOX IMG URL FROM FIRESTORE IF ITS SAVED THERE,
// OR GETS IT FROM THE SERVER. MEANT AS A DROP-IN REPLACEMENT FOR ref . get Download URL ()

function getThumbnailDownloadURL(id, fid) {
  return new Promise(function (resolve, reject) {
    var token;
    var pid = convertID(id,"p");
    var size = "ttoken"; // ttoken (thumb URL Token) or ltoken (lightbox URL token) 
    
    if (id.startsWith("t-")) { size = "ttoken"; }
    if (id.startsWith("l-")) { size = "ltoken"; }

    if (activeItemsObject[pid]) { token = activeItemsObject[pid][size]; }
    if (activeItemsObject[fid]) { token = activeItemsObject[fid][size]; }
    
    if (token) {
      resolve(parsedFileURL(id, token));
    } else {
      var fileRef = rootRef.child(id + ".crypteefile"); // this will either be t- or l- depending on the highres demand 
      fileRef.getDownloadURL().then(function(dldURL) {
        resolve(cloudParsedStorageURL(dldURL));
      }).catch(function(error) {
        reject(error);
      });
    }
  });
}

// // this downloads the thumbnail, decrypts, returns b64 or error. 
// function getB64OfThumbOrLight(id, callback, errorCallback) {
//   getThumbnailDownloadURL(id).then(function(thumbURL) {
//     $.ajax({ url: thumbURL, type: 'GET',
//         success: function(encryptedFileContents){
//           decrypt(encryptedFileContents, [theKey]).then(function(plaintext) {
//             var decryptedContents = plaintext.data;
//             callback(decryptedContents);
//           }).catch(function(error) {
//             errorCallback(error);
//           });
//         },
//         error:function (xhr, ajaxOptions, thrownError){
//           errorCallback(thrownError);
//         }
//       });
//   });
// }

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
  var pid = convertID(pidOrTid,"p");

  if (fid) {
    breadcrumb('[EXIF] – GETTING EXIF DATE OF: ' + pid);
    homeRef.doc(fid).collection("photos").doc(pid).get().then(function(item) {
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
      //photo doesn't exist OR IT'S A RAW – looks like you'll try extracting from original
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
            var exifDate = extractExifDateTime(exif);
            if (exifDate) { 
              callback(exifDate);
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
  var year, month;

  if (dateString) {
    if (dateString.indexOf(":") !== -1) {
      // Looks like not every camera manufacturer follows the standards. Some of these splits can throw undefined. [facepalm]
      try { year = dateString.split(":")[0].slice(2,4); } catch (e) {}
      try { month = dateString.split(":")[1]; } catch (e) {}
      if (year && month) {
        var monthName = monthsOfYearArray[parseInt(month)];
        result = (monthName + " " + "&#39;" + year);
      }
    }
  }
  
  return result;
}

function sortableExifDate (dateString) {
  var result = "00000000";
  var year = "0000";
  var month = "00";
  var day = "00";
  if (dateString) {
    if (dateString.indexOf(":") !== -1) {
      // Looks like not every camera manufacturer follows the standards. Some of these splits can throw undefined. [facepalm]
      try { year = dateString.split(":")[0] || "0000"; } catch (e) {}
      try { month = dateString.split(":")[1] || "00"; } catch (e) {}
      try { day = dateString.split(":")[2].split(" ")[0] || "00"; } catch (e) {}
      result = year + "" + month + "" + day;
    }
  }
  
  return result;
}

function todaysEXIF() {
  var today = new Date();
  var currentDay = today.getUTCDate();
  var currentMonth = today.getUTCMonth() + 1; // it's 0 based. jesus.
  var currentYear = today.getFullYear();
  return currentYear + ":" + ("0" + currentMonth).slice(-2) + ":" + ("0" + currentDay).slice(-2);
}

function checkFormatSupport(extension) {
  // images we support and can view & convert in browsers natively
  if (extension.match(/^(jpg|jpeg|png|gif)$/i)) {
    return "supported-image-native";
  }

  // images we could try supporting, but need to convert for thumbnail first, and upload original alongside
  // TIFF,
  // CR2 & CR3 (Canon RAW)
  // NEF (Nikon RAW)
  // ARW (Sony RAW)
  // RAF (Fuji RAW)
  // 3FR & FFF (Hasselblad RAW)
  // DNG (Adobe RAW)

  // else if (extension.match(/^(tif|tiff|cr2|cr3|nef|arw|dng|3fr|fff)$/i)) {
  //   return "supported-image-utif";
  // }
  
  // // videos we support natively
  // else if (extension.match(/^(mp4)$/i)) {
  //   return "supported-video-native";
  // }

  // we don't support this yet, so don't upload to Photos.
  else { return "unsupported-format"; }
}

function convertID(id,type) {
  if (id) {
    var result = id
    .replace("p-", type+"-")  // photo
    .replace("t-", type+"-")  // thumb
    .replace("l-", type+"-")  // lightbox
    .replace("v-", type+"-")  // video
    .replace("r-", type+"-"); // RAW

    return result;
  } else {
    return null;
  }
}

function isItAMediaID(id) {
  var result = false;
  if ( id.startsWith("p-") || id.startsWith("r-") || id.startsWith("v-") ) {
    result = true;
  } else {
    result = false;
  }
  return result;
}

function isItAFolderID(id) {
  var result = false;
  if ( id.startsWith("f-") ) {
    result = true;
  } else {
    result = false;
  }
  return result;
}

///////////////////////////////////////////////////
////////////////// FILE UPLOAD ////////////////////
///////////////////////////////////////////////////

function uploadElement(pid, filename, progress) {
  progress = progress || "Encrypting";
  var element =
  '<div class="upload" id="upload-'+pid+'">'+
    '<div class="upload-symbol"></div>'+
    '<div class="upload-info">'+
        '<p class="upload-title">'+filename+'</p>'+
        '<p class="upload-progress">'+progress+'</p>'+
    '</div>'+
  '</div>';
  return element;
}

function showFileUploadStatus (color, message) {
  $(".upload-status-message").html(message);
  if (color === "is-danger") { $("body").removeClass("disable-clicks"); }
  $("#photos-upload-status").addClass("is-active");
}

function hideFileUploadStatus () { 
  uploadCompleteResetUploaderState(); 
  $("body").removeClass("disable-clicks");
  $("#upload-status").removeClass("is-dark is-light is-white is-danger is-success").addClass("is-white");
  $("#photos-upload-status").removeClass("is-active");
  $("#photos-upload-status-contents").html("");
  $(".upload").remove();
}

function showFileUploadError(name, size, msg, id) {
  name = name || "";
  size = size || 0;
  id = id || (slugify(name) + '-' + size);
  msg = msg || "Error";
  $("#photos-upload-status-contents").append(uploadElement(id, name, msg));
  setTimeout(function () { 
    $("#upload-"+id).addClass("visible"); 
    $("#upload-"+id).addClass("errored");
  }, 10);
}

function displayFileUploadProgress(id) {
  if (activeUploads[id]) {
    activeUploads[id].progress = activeUploads[id].originalProgress + activeUploads[id].thumbnailProgress + activeUploads[id].lightboxProgress;
    $("#upload-"+id).find(".upload-progress").html(Math.floor((activeUploads[id].progress * 100) / activeUploads[id].total) +"%");
  }
}

var uploaderCloseButton = "<br><br><a class='button is-light' onclick='hideFileUploadStatus();'>Close</a><br><br>";
var uploaderUpgradeButton = ' &nbsp; <a class="button is-success" onclick="showPlans()">Upgrade Plan</a><br><br>';

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
  if (item.name) {  
    var itemLowercaseName = item.name.trim().toLowerCase();
    if (itemLowercaseName !== ".ds_store" && itemLowercaseName !== "desktop.ini" && itemLowercaseName !== "icon") {
      var fileExt = extensionFromFilename(itemLowercaseName);
      var format = checkFormatSupport(fileExt);

      if (format !== "unsupported-format") {
        createFileTree(item.path, item.file);
      } else {
        unsupported();
      }
    }
  }

  function unsupported() {
    fileUploadError = true;
    handleError('[UPLOAD] – Unsupported Format (' + item.type + ")", {}, "info");
    showFileUploadStatus("is-danger", "Error" + uploaderCloseButton);
    showFileUploadError(item.name, item.size, "Unsupported", null);
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

  if (activeFID === "favorites") {
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
  var numFoldersInTree = Object.keys(fileTreeToUpload).length;
  breadcrumb('[Upload] – Processing Filetree. ('+numFoldersInTree+' Folders)');
  $.each(fileTreeToUpload, function(folderPath, folderItem) {
    if (folderItem.files !== undefined) {
      folderItem.files.forEach(function(fileItem) {
        var targetfid = activeFID;
        if (targetfid === "favorites") {
          targetfid = "home";
        }
        
        queueUpload(fileItem.file, targetfid, fileItem.pid, function(){
        // processPhotoForUpload(fileItem.file, targetfid, fileItem.pid, function(){
          // ALL FILES UPLOADED.
          // ALL THE FILES UPLOADED TO HOME.
          // UPDATETITLES AUTO CALLED ONCE ALL UPDATES ARE COMPLETE.

          
          // if there are folders in the file tree uploaded,
          // create those albums now, and move things into them.
          if (Object.keys(fileTreeToUpload).length > 1) {
            breadcrumb('[Upload] - Creating albums ('+Object.keys(fileTreeToUpload).length+')');
            showFileUploadStatus("is-info", "Creating albums");
            var tempFoldersArray = Object.keys(fileTreeToUpload);
            tempFoldersArray.forEach(function(fname) {
              if (fname !== "thecrypteehomefolder") {
                newFolder(fname, fileTreeToUpload[fname].fid, function(){
                  clearTimeout(folderCreationQueueTimeout);
                  folderCreationQueueTimeout = setTimeout(function () {
                    // ALL FOLDERS CREATED.
                    breadcrumb('[Upload] - Organizing albums ('+Object.keys(fileTreeToUpload).length+')');
                    showFileUploadStatus("is-info", "Organizing albums");
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

  // and finally load the target folder once again to avoid double show up issues etc. and hide modal.

  if (hasFolders) {
    // means that we didn't call doneWithAllUploads in uploadCompleteAndFolderAdjusted, call it now.
    // a.k.a reload home / target folder
    breadcrumb('[Upload] - Done.');
    doneWithAllUploads();
  } else {
    // doneWithAllUploads is already called in uploadCompleteAndFolderAdjusted so we're all good.

  }

}

function doneWithAllUploads(callback, callbackParam) {

  // all files moved into folders if there were any. we can now safely purge filetree

  uploadCompleteResetUploaderState();

  callback = callback || noop;

  if (activeFID !== "home" && activeFID !== "favorites") {
    otherFolderLoaded = false;
    getAllFilesOfFolder(activeFID, function(){
      targetFolderReloaded();
    });
  } else {
    homeFolderLoaded = false;
    getHomeFolder(function(){
      targetFolderReloaded();
    });
  }

  function targetFolderReloaded() {
    if (!fileUploadError) {
      hideFileUploadStatus();
      callback(callbackParam);
    } else {
      showFileUploadStatus("is-danger", "Finished uploading, but some of your files were not uploaded." + uploaderCloseButton);
      $(".upload:not(.visible)").hide();
    }
  }
}


function handlePhotoSelect(evt) {
  evt.stopPropagation();
  evt.preventDefault();
  if (theKey && theKey !== "" && !isUploading) {
    dragCounter = 0;
    somethingDropped = true;

    var targetfid = activeFID;
    if (targetfid === "favorites") {
      targetfid = "home";
    }
    
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
        showFileUploadStatus("is-danger", "Unfortunately your browser or device does not support File API, which is what allows us to encrypt files on your device. Therefore we can't upload your file." + uploaderCloseButton);
      }, 10000);
    }
  }
}

function handlePhotosDrop (evt) {
  evt.stopPropagation();
  evt.preventDefault();

  if (theKey && theKey !== "" && !isUploading) {
    $("#photos-drag-overlay").removeClass("shown");
    dragCounter = 0;
    somethingDropped = true;
    var loadHomeFirst = false;
    
    var targetfid = activeFID;
    if (targetfid === "favorites") {
      targetfid = "home";
      loadHomeFirst = true;
    }

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
          if (loadHomeFirst) {
            getHomeFolder(function(){
              items = evt.dataTransfer.files;
              for (var i = 0; i < items.length; i++) {
                var uuid = "p-" + newUUID();
                queueUpload(items[i], targetfid, uuid);
                // processPhotoForUpload(items[i], targetfid, uuid);
                numFilesLeftToBeUploaded++;
                document.title = "Cryptee | Uploading " + numFilesLeftToBeUploaded + " photo(s)";
              }
            });
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
        }

        if (numFilesLeftToBeUploaded > 0) {
          var processingMessage = "Processing <b>" + numFilesLeftToBeUploaded.toString() + "</b> file(s)";
          showFileUploadStatus("is-white", processingMessage);
        }

      } else {
        showCanvasBlockedModal(); 
      }

    } else {
      showFileUploadStatus("is-danger", "Unfortunately your browser or device does not support File API, which is what allows us to encrypt files on your device. Therefore we can't upload your file." + uploaderCloseButton);
    }
  }

}

function handleDragEnter(evt) {
  if (dragCounter === 0) {
    if (theKey && theKey !== "" && !isUploading) {
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
    if (theKey && theKey !== "" && !isUploading) {
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
    breadcrumb('[Upload] – Starting upload with ' + uploadList.length + ' files');
    nextUpload(callback, callbackParam); // starts upload with first file
  }, 100);
}

var numFilesUploading = 0;
var maxNumberOfSimultaneousUploads = 3;
if (isMobile || isipados) {
  maxNumberOfSimultaneousUploads = 1;
}
var nativeImageSizeLimit = 32 * 1000000; // used to be 32mb now 50 mb

function nextUpload(callback, callbackParam) {
  callback = callback || noop;
  callbackParam = callbackParam || null;
  
  if (!isUploading) {
    isUploading = true; // stops next file / batch from going through right away.

    uploadList.forEach(function(upload, index) {
      preprocessUpload(upload, index, callback, callbackParam);
    });
  }
}

function preprocessUpload(upload, index, callback, callbackParam) {
  callback = callback || noop;
  callbackParam = callbackParam || null;

  var file = upload.file;
  var fid = upload.fid;
  var pid = upload.pid;

  if (file) {

    var filename = file.name;
    var filesize = file.size;
    var fileExt = extensionFromFilename(filename);
    var format = checkFormatSupport(fileExt);

    if ( !upload.processed && (numFilesUploading < maxNumberOfSimultaneousUploads) ) {
      
      uploadList[index].processed = true;

      // NATIVELY SUPPORTED IMAGE LIKE JPG, PNG, GIF
      if (format === "supported-image-native") {
         
        if (filesize < nativeImageSizeLimit) {
          numFilesUploading++;
          processPhotoForUpload(file, fid, pid, callback, callbackParam);
        } else {
          uploadPreprocessingError(filename, filesize, "TOO LARGE");
        }
      
      } 
      
      else {
        uploadPreprocessingError(filename, filesize, "UNSUPPORTED", fileExt);
      }

    }
    
    // if file is too large or too many files uploading skip and wait until next round.
  }

}

function uploadPreprocessingError(filename, filesize, msg, fileExt) {
  numFilesLeftToBeUploaded--;
  fileUploadError = true;
  showFileUploadError(filename, filesize, msg, null);
  document.title = "Cryptee | Uploading " + numFilesLeftToBeUploaded + " photo(s)";
  breadcrumb('[Upload] – Unsupported Format (.' + fileExt +'). Skipping');

  // this allows users to quit the uploader if they only dragged an unreadable file or sth.
  if (numFilesLeftToBeUploaded <= 0) {
    showFileUploadStatus("is-danger", "Some of your files were not uploaded." + uploaderCloseButton);
    uploadCompleteResetUploaderState();
  }
}

function uploadProcessingError(filename, filesize, err, functionName, callback, callbackParam) {
  numFilesLeftToBeUploaded--;
  numFilesUploading--;
  fileUploadError = true;
  breadcrumb('[Upload] – Error Reading File. Skipping');
  document.title = "Cryptee | Uploading " + numFilesLeftToBeUploaded + " items(s)";
  if (canUploadFolders) {
    handleError("Error reading photo in " + functionName, err, "warning");
    showFileUploadError(filename, filesize, "Error", null);
    isUploading = false; // allows next file to go through.

    // this allows users to quit the uploader if they only dragged an unreadable file or sth.
    if (numFilesLeftToBeUploaded <= 0) {
      showFileUploadStatus("is-danger", "Some of your files were not uploaded." + uploaderCloseButton);
      $(".upload:not(.visible)").hide();
      uploadCompleteResetUploaderState();
    } else {
      nextUpload(callback, callbackParam);
    }
  } else {
    setTimeout(function () {
      hideFileUploadStatus();
      uploadCompleteResetUploaderState();
    }, 200);
  }
}




//////////////////////////////////////
///
/// UPLOADER FOR NATIVELY SUPPORTED
/// IMAGES. 
///
//////////////////////////////////////

function processPhotoForUpload (file, fid, predefinedPID, callback, callbackParam) {
  callback = callback || noop;

  var reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onloadend = function(){
    var base64FileContents = reader.result;
    try {
      var filename = file.name;
      
      //THIS LINE IS TO MAKE SURE FILE HAS SOME CONTENTS AND MAKE THIS "TRY" FAIL IF IT'S EMPTY, LIKE WHEN IT IS A FOLDER.
      var fileContents = base64FileContents.substr(base64FileContents.indexOf(',')+1);

      var processingMessage = " &nbsp; ENCRYPTING & UPLOADING " + numFilesLeftToBeUploaded.toString() + " LEFT";
      showFileUploadStatus("is-white", processingMessage);
      encryptAndUploadPhoto(base64FileContents, predefinedPID, fid, filename, callback, callbackParam);
      
    } catch (e) {
      if (base64FileContents === null) {
        breadcrumb('[Upload] – Error Reading File. File is NULL. Skipping.');
        // This seems to happen on Firefox Android if user selects multiple images to upload. WTF.
      } else {
        breadcrumb('[Upload] – Error Reading File. (' + e + ') Skipping.');
      }
      
      fileUploadError = true;
      showFileUploadError(file.name, file.size, "Error", null);
      isUploading = false; // allows next file to go through.
      nextUpload(callback, callbackParam);
    }

  };
  reader.onerror = function(err){
    uploadProcessingError(file.name, file.size, err, "processPhotoForUpload", callback, callbackParam);
  };
}

var activeUploads = {};
function encryptAndUploadPhoto (plaintextFileContents, predefinedPID, fid, filename, callback, callbackParam) {

  callback = callback || noop;
  var uuid = newUUID();
  var pid = predefinedPID || "p-" + uuid;
  var photoRef = rootRef.child(pid + ".crypteefile");

  var tid = convertID(pid,"t");
  var thumbRef = rootRef.child(tid + ".crypteefile");

  var lid = convertID(pid,"l");
  var lightRef = rootRef.child(lid + ".crypteefile");

  var fileExt = extensionFromFilename(filename);

  var dominant, exifDate;

  activeUploads[pid] = {};

  $("#photos-upload-status-contents").prepend(uploadElement(pid, filename));
  $("#photos-upload-status-contents").animate({ scrollTop: 0 }, 700);
  setTimeout(function () { $("#upload-"+pid).addClass("visible"); }, 10);

  breadcrumb('[Upload] (' + pid + ') Generating Thumbnails & Necessary Meta.');
  generateThumbnailsAndNecessaryMeta(plaintextFileContents, function(uploadObject){
  // generatePrimitive(plaintextFileContents, function(pn){
    exifDate = uploadObject.date;

    generateDominant(function(dmnt){
      dominant = dmnt; 

      // ENCRYPT & UPLOAD ORIGNAL FIRST, then thumbnails etc. 
      breadcrumb('[Upload] (' + pid + ') Encrypting Original.');
      encrypt(plaintextFileContents, [theKey]).then(function(originalCiphertext) {
        breadcrumb('[Upload] (' + pid + ') Encrypted Original.');
        activeUploads[pid].original = photoRef.putString(JSON.stringify(originalCiphertext), "raw");
        activeUploads[pid].original.pause();

        breadcrumb('[Upload] (' + pid + ') Encrypting Thumbnail.');
        encrypt(uploadObject.thumbnail, [theKey]).then(function(thumbnailCiphertext) {
          breadcrumb('[Upload] (' + pid + ') Encrypted Thumbnail.');
          activeUploads[pid].thumbnail = thumbRef.putString(JSON.stringify(thumbnailCiphertext), "raw", { cacheControl: 'private, max-age=86400' }); // adding 1 day local caching to speed up scrolls once images are loaded
          activeUploads[pid].thumbnail.pause();
          activeUploads[pid].thumbRef = thumbRef;

          if (!fileExt.match(/^(gif)$/i)) {
            breadcrumb('[Upload] (' + pid + ') Encrypting Lightbox.');
            encrypt(uploadObject.lightbox, [theKey]).then(function(lightboxCiphertext) {
              breadcrumb('[Upload] (' + pid + ') Encrypted Lightbox.');
              activeUploads[pid].lightbox = lightRef.putString(JSON.stringify(lightboxCiphertext), "raw", { cacheControl: 'private, max-age=86400' }); // adding 1 day local caching to speed up scrolls once images are loaded
              activeUploads[pid].lightbox.pause();
              activeUploads[pid].lightRef = lightRef;
              photoEncryptedStartUploading();
            }).catch(function(error){ handleUploadEncryptionError(pid, filename, error, callback, callbackParam); });
          } else {
            photoEncryptedStartUploading();
          }
        }).catch(function(error){ handleUploadEncryptionError(pid, filename, error, callback, callbackParam); });
      }).catch(function(error){ handleUploadEncryptionError(pid, filename, error, callback, callbackParam); });

    });
  });



  
  function photoEncryptedStartUploading() {
    breadcrumb('[Upload] (' + pid + ') Encrypted all sizes of the photo. Starting uploads.');

    var totalBytesForProgress = activeUploads[pid].original.snapshot.totalBytes + activeUploads[pid].thumbnail.snapshot.totalBytes;

    if (!fileExt.match(/^(gif)$/i)) {
      totalBytesForProgress += activeUploads[pid].lightbox.snapshot.totalBytes;
    }

    activeUploads[pid].total = totalBytesForProgress;
    activeUploads[pid].progress = 0;
    activeUploads[pid].originalProgress = 0;
    activeUploads[pid].thumbnailProgress = 0;
    activeUploads[pid].lightboxProgress = 0;

    if (!fileUploadError) {
      var processingMessage = numFilesLeftToBeUploaded.toString() + " LEFT";
      showFileUploadStatus("is-white", processingMessage);
    }

    //
    // first prepare the callbacks for each upload
    //

    // ORIGINAL PHOTO UPLOAD
    activeUploads[pid].original.on('state_changed', function(snapshot){
      
      lastActivityTime = (new Date()).getTime(); // keep last activity timer up to date
      firefoxDefibrillator(pid, "original"); // check pulse for firefox, and defibrilate if dead (uggghhh...)
      if (activeUploads[pid]) { activeUploads[pid].originalProgress = snapshot.bytesTransferred; } // update the byte progress
      displayFileUploadProgress(pid);
     
    }, function(error) { 
      handleUploadError (pid, filename, error, callback, callbackParam); 
    }, function(){
      // ORIGINAL PHOTO UPLOADED. MOVE ON TO THUMBNAIL
      breadcrumb('[Upload] (' + pid + ') Uploaded Original.');
      if (activeUploads[pid]) {
        activeUploads[pid].thumbnail.resume();
      }
    });




    // THUMBNAIL PHOTO UPLOAD
    activeUploads[pid].thumbnail.on('state_changed', function(thumbSnap){
      
      lastActivityTime = (new Date()).getTime(); // keep last activity timer up to date
      firefoxDefibrillator(pid, "thumbnail"); // check pulse for firefox, and defibrilate if dead (uggghhh...)
      if (activeUploads[pid]) { activeUploads[pid].thumbnailProgress = thumbSnap.bytesTransferred; } // update the byte progress
      displayFileUploadProgress(pid);

    }, function(error) { 
      handleUploadError (pid, filename, error, callback, callbackParam); 
    }, function() {
      // THUMBNAIL UPLOADED. MOVE ON TO LIGHTBOX SIZE IF NEEDED.
      breadcrumb('[Upload] (' + pid + ') Uploaded Thumbnail.');
      if (!fileExt.match(/^(gif)$/i)) {
        if (activeUploads[pid]) {
          activeUploads[pid].lightbox.resume();
        }
      } else {
        // it's a GIF, so no need to upload lightbox preview.
        activeUploads[pid].thumbRef.getDownloadURL().then(function(thumbURL) {
          photoUploadComplete(fid, pid, dominant, thumbURL, null, filename, exifDate, callback, callbackParam);
        }).catch(function(error){
          handleError("couldn't get download url of uploaded thumbnail img for gif", error);
        });
      }
    });


    if (activeUploads[pid].lightbox) {  
      // LIGHTBOX PHOTO UPLOAD (IF NOT GIF)
      activeUploads[pid].lightbox.on('state_changed', function(lightSnap){

        lastActivityTime = (new Date()).getTime(); // keep last activity timer up to date
        firefoxDefibrillator(pid, "lightbox"); // check pulse for firefox, and defibrilate if dead (uggghhh...)
        if (activeUploads[pid]) { activeUploads[pid].lightboxProgress = lightSnap.bytesTransferred; } // update the byte progress
        displayFileUploadProgress(pid);

      }, function(error) { 
        handleUploadError (pid, filename, error, callback, callbackParam); 
      }, function() {
        // LIGHTBOX PREVIEW UPLOADED.
        breadcrumb('[Upload] (' + pid + ') Uploaded Lightbox.');
        activeUploads[pid].thumbRef.getDownloadURL().then(function(thumbURL) {
          activeUploads[pid].lightRef.getDownloadURL().then(function(lightURL) {
            photoUploadComplete(fid, pid, dominant, thumbURL, lightURL, filename, exifDate, callback, callbackParam);
          }).catch(function(error){ 
            handleError("couldn't get download url of uploaded lightbox img", error); 
            photoUploadComplete(fid, pid, dominant, thumbURL, null, filename, exifDate, callback, callbackParam);
          });
        }).catch(function(error){ 
          handleError("couldn't get download url of uploaded thumbnail img", error); 
          photoUploadComplete(fid, pid, dominant, null, null, filename, exifDate, callback, callbackParam);
        });
      });
    }
      
    // now start uploading with the original. 
    activeUploads[pid].original.resume();

  }

}

// this pauses & resumes the upload if the state doesn't change at all for 5 seconds.
// It's to address a firefox upload timeout bug. For some reason XHR requests just stop, without any warning etc. 
// they just just stop. yep. srsly. no idea why for now.
// looks like some packets are getting lost, fucking up with the progress as well. 
// like the percentage backs down / backs up etc. (or it's because when we pause some stuff is left out mid-upload)
// so we have to artificially pause / resume the upload if nothing happens for 5 seconds.
// kinda like a defibrilator 

var firefoxUploadTimers = {};
function firefoxDefibrillator(pid, whichSize) {
  if (isFirefox) {
    
    firefoxUploadTimers[pid + whichSize] = firefoxUploadTimers[pid + whichSize] || {};

    clearTimeout(firefoxUploadTimers[pid + whichSize].timer);
    
    firefoxUploadTimers[pid + whichSize].timer = setTimeout(function () {
      
      if (activeUploads[pid]) {
        if (activeUploads[pid][whichSize]) {

          activeUploads[pid][whichSize].pause();
          activeUploads[pid][whichSize].resume(); 

        }
      }
        
    }, 5000);
  }
}

function handleUploadError (pid, filename, error, callback, callbackParam) {
  if (usedStorage >= allowedStorage) {
    showFileUploadStatus("is-danger", "Error uploading your file(s). Looks like you've already ran out of storage. Please consider upgrading to a paid plan or deleting something else." + uploaderCloseButton + uploaderUpgradeButton);
    $(".upload-status-message").addClass("exceeded");
    $(".upload:not(.visible)").hide();
    uploadCompleteResetUploaderState();

    if (activeFID !== "home" && activeFID !== "favorites") {
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
      handleError("Error while uploading photo", error, "warning");
      showFileUploadError(filename, 0, "Error", pid);
      isUploading = false; // allows next file to go through.
      nextUpload(callback, callbackParam);
    }

  }
}

function handleUploadEncryptionError(pid, filename, error, callback, callbackParam) {
  handleError("Error while encrypting photo", error);
  showFileUploadError(filename, 0, "Error", pid);
  isUploading = false; // allows next file to go through.
  nextUpload(callback, callbackParam);
}

function uploadRetryFailed (pidOrTid, callback, callbackParam) {
  callback = callback || noop;
  var pid = convertID(pidOrTid,"p");
  uploadList.forEach(function(upload, index) {
    if (upload.pid === pid) {
      uploadList[index].processed = false;
      nextUpload(callback, callbackParam);
    }
  });
}

function photoUploadComplete (fid, pid, dominant, thumbURL, lightURL, filename, exifDate, callback, callbackParam) {
  if (pid) {    
    breadcrumb('[Upload] (' + pid + ') Photo & thumbs uploaded.');

    $("#upload-"+pid).removeClass("visible");
    setTimeout(function () { $("#upload-"+pid).remove(); }, 1100);

    if (activeUploads[pid]) {
      try { activeUploads[pid].original = null;   } catch (error) {} 
      try { activeUploads[pid].thumbnail = null;  } catch (error) {} 
      try { activeUploads[pid].lightbox = null;   } catch (error) {} 
      
      try { activeUploads[pid].thumbRef = null;  } catch (error) {} 
      try { activeUploads[pid].lightRef = null;   } catch (error) {} 
      activeUploads[pid] = null;
    }

    callback = callback || noop;
    callbackParam = callbackParam || pid;
    var photoObject = { "id" : pid, "pinky" : dominant };
    if (thumbURL) { photoObject.ttoken = thumbURL.split("&token=")[1]; }
    if (lightURL) { photoObject.ltoken = lightURL.split("&token=")[1]; }

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
      whereTo = homeRef.doc(fid).collection("photos").doc(pid);
    }

    breadcrumb('[Upload] (' + pid + ') Saving to DB.');
    whereTo.set(photoObject, {
      merge: true
    }).then(function(response) {
      uploadCompleteUpdateFirestore (fid, pid, dominant, thumbURL, lightURL, filename, callback, callbackParam);
    }).catch(function(error) {
      console.error("Error saving uploaded photo: ", error);
      handleError("Error setting uploaded photo to firestore in photoUploadComplete", error);
      showFileUploadError(filename, 0, "Error", pid);
      isUploading = false; // allows next file to go through.
      nextUpload(callback, callbackParam);
    });
  } else {
    handleError("Missing PID @ photoUploadComplete", error);
    showFileUploadError(filename, 0, "Error", pid);
    isUploading = false; // allows next file to go through.
    nextUpload(callback, callbackParam);
  }
}


//////////////////////////////////////
///
/// UPLOADER FOR VIDEOS
///
//////////////////////////////////////



//////////////////////////////////////
///
/// UPLOADER FOR UTIF SUPPORTED IMAGES
///
//////////////////////////////////////



//////////////////////////////////////
///
/// THIS WILL GET CALLED AT THE END OF
/// ALL TYPES OF UPLOADS, NATIVE, UTIF
/// OR VIDEO, TO ADJUST THE TITLES, 
/// FOLDER COUNTS AND ALL THINGS ALIKE
///
/// IT ALSO CALLS NEXTUPLOAD –
/// JUST TO GIVE YOU AN IDEA. 
///
//////////////////////////////////////

function uploadCompleteUpdateFirestore (fid, id, dominant, thumbURL, lightURL, filename, callback, callbackParam) {
  breadcrumb('[Upload] (' + id + ') Saved to DB.');
  callback = callback || noop;

  numFilesLeftToBeUploaded--;
  numFilesUploaded++;
  numFilesUploading--;
  if (fid === activeFID) {
    activeItemsObject[id] = activeItemsObject[id] || {};
    activeItemsObject[id].title = filename;
    activeItemsObject[id].pinky = dominant;

    if (thumbURL) { activeItemsObject[id].ttoken = thumbURL.split("&token=")[1]; }
    if (lightURL) { activeItemsObject[id].ltoken = lightURL.split("&token=")[1]; }

    updateTitles(function(){
      if (numFilesLeftToBeUploaded <= 0) {
        if (fid !== "home" && fid !== "favorites") {
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

  // uploadCompleteResetUploaderState ();

 // SO BECAUSE THIS GETS CALLED AT THE END OF ALL TYPES OF UPLOADS,
 // BUT WE WANT TO FIRST MOVE FILES BEFORE HIDING THE UPLOAD MODALS
 // IF THE UPLOAD HAS ANY FOLDERS, WE DON'T CALL THIS. THIS PART WILL INSTEAD GET CALLED BY
 // BATCH UPLOAD COMPLETE.

  if (Object.keys(fileTreeToUpload).length <= 1) {
    // so if there are no folders to move photos into, done with uploads.
    // a.k.a. load home / target folder and hide upload modals.
    breadcrumb('[Upload] - Done. There were no folders.');
    doneWithAllUploads(callback, callbackParam);
  } else {
    // if there are photos to move into folders, we'll deal with these guys in queueUpload's callback in processUploadTree.
    // which will be executed with this callback.
    callback(callbackParam);
  }

}

function uploadCompleteResetUploaderState () {
  breadcrumb('[Upload] - Resetting Uploader State');
  
  document.title = "Cryptee | Photos";
  numFilesUploaded = 0;
  numFilesUploading = 0;

  somethingDropped = false;
  uploadList = [];
  isUploading = false;

  fileTreeToUpload = {};
  fileTreeToUpload.thecrypteehomefolder = {};
  fileTreeToUpload.thecrypteehomefolder.files = [];
}

function getThumbnail (pid, fid, forceHighRes) {
  if (pid !== "" && pid !== " " && pid !== undefined && pid !== null) {
    fid = fid || null;
    var tid = convertID(pid,"t");
    if (forceHighRes) { tid = convertID(pid,"l"); }
    getThumbnailDownloadURL(tid, fid).then(function(thumbURL) {
      var tidrequest = 
      $.ajax({ url: thumbURL, type: 'GET',
          success: function(encryptedAndCloudParsedFileContents){
            decrypt(encryptedAndCloudParsedFileContents, [theKey]).then(function(plaintext) {
              var decryptedContents = plaintext.data;
              var id = fid || convertID(pid,"p");
              
              // the request itself holds a .responseText which has 2x the encrypted string. 
              if (activeItemsObject[id]) {
                activeItemsObject[id].tidreq = null;
              }
              encryptedAndCloudParsedFileContents = null; 
              // so removing these two saves up 2x memory

              var tmpImg = new Image();
              tmpImg.onload = function(){
                $("#" + id).find("img").replaceWith(tmpImg);
                $(".srimg[pid="+id+"]").replaceWith(tmpImg);
                setTimeout(function(){
                  $("img[tid="+tid+"]").addClass("is-loaded");

                  if (!fid) {
                    if (preparingToDisplayPhoto !== id) { // so that it's not removed if user tapped photo while thumb is still loading.
                      $("#" + id).removeClass("is-loading");
                      setTimeout(function () {
                        $("#" + id).addClass("is-loaded");
                      }, 500); 
                    }
                  } else {
                    $("#" + id).find(".album").removeClass("is-loading");
                  }
                  
                  $(".photos-sr-photo[pid="+id+"]").removeClass("is-loading");
                  $(".sr-folder-photo[pid="+id+"]").removeClass("is-loading");
                  $(".sr-folder-photo[pid="+id+"]").removeClass("is-loading");

                }, 25);
              };
              tmpImg.src = decryptedContents;
              tmpImg.setAttribute("draggable",false);
              tmpImg.setAttribute("tid",tid);
              if (pid.indexOf("l-") !== -1) {
                tmpImg.setAttribute("hres",1);
              }
            });
          },
          error:function (xhr, ajaxOptions, thrownError){
            if (thrownError !== "abort") {
              console.log(thrownError);
              breadcrumb("couldn't download thumb from url, likely due to network errors (" + thrownError + ")");
            }
          }
      });
      var id = fid || pid;
      if (activeItemsObject[id]) {
        activeItemsObject[id].tidreq = tidrequest;
      }
    }).catch(function(error) {
      
      if (tid.indexOf("l-") === -1) {
        error = error || {};
        error.tid = tid;
        handleError("Error getting thumbnail URL", error);
      }

      switch (error.code) {
        case 'storage/object-not-found':
          if (tid.indexOf("l-") !== -1) {
            console.log("Tried loading a high-res thumbnail (lightbox size) for", pid ,", but there wasn't one. Falling back to regular size.");
            var regularSizeID = convertID(tid,"t");
            getThumbnail (regularSizeID, fid);
          } else {
            fixFile(tid);
          }
          break;
        case 'storage/unauthorized':
          if (tid.indexOf("l-") !== -1) {
            console.log("Tried loading a high-res thumbnail (lightbox size) for", pid ,", but there wasn't one. Falling back to regular size.");
            var regSizeID = convertID(tid,"t"); // using regSizeID to make linter happy
            getThumbnail (regSizeID, fid);
          } else {
            fixFilesAndFolders();
          }
          
          break;
        case 'storage/canceled':
          break;
        case 'storage/unknown':
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
  var forceHighRes = false;

  if (folderContent !== null && folderContent !== undefined) {
    if (folderContent.classList.contains("albumitem")) {
      var album = folderContent.querySelector(".album");
      if (album) {
        if (!album.classList.contains("is-loading")) {
          album.classList.add("is-loading");
        }

        // use higher resolution album images on desktops with retina displays
        if (doWeNeedHighResThumbs() && tid) {
          forceHighRes = true;
        }

        getThumbnail(tid, id, true);
      }
    }

    if (folderContent.classList.contains("mediaitem")) {
      var media = folderContent.querySelector(".media"); 
      if (media) {
        if (!folderContent.classList.contains("is-loading")) {
          folderContent.classList.add("is-loading");
        }

        if (doWeNeedHighResThumbs() && activeFID === "favorites") {
          forceHighRes = true;
        }

        getThumbnail(id, null, forceHighRes);
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
  homeRef.doc(fid).collection("photos").get().then(function(item) {
    if (item.docs[0]) {
      var firstMedia = item.docs[0].data();
      var firstMediaID = firstMedia.id;
      var pinky = firstMedia.pinky;
      var thumb = convertID(firstMediaID,"t");
      var folderObject = {thumb : thumb, pinky : pinky};

      homeRef.doc(fid).set(folderObject, {
        merge: true
      }).then(function(response) {
        var forceHighRes = false;
        if (doWeNeedHighResThumbs() && thumb) {
          forceHighRes = true;
        }
        getThumbnail(thumb, fid, forceHighRes);
        if (firstMediaID.startsWith("p-")) {
          setFolderDateFromThumbnailEXIF(fid);
        }
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
  var id = selectionsArray[0];
  
  var thumb = convertID(id,"t");
  activeItemsObject[id] = activeItemsObject[id] || {};
  var pinky = activeItemsObject[id].pinky;
  var thumbToken = activeItemsObject[id].ttoken;
  var lightToken = activeItemsObject[id].ltoken;
  
  var folderObject = {};
  if (thumb) { folderObject.thumb = thumb; }
  if (pinky) { folderObject.pinky = pinky; }
  if (thumbToken) { folderObject.ttoken = thumbToken; }
  if (lightToken) { folderObject.ltoken = lightToken; }
  
  $("#" + id).addClass("is-loading");

  homeRef.doc(activeFID).set(folderObject, {
    merge: true
  }).then(function(response) {
    if (id.startsWith("p-") || id.startsWith("r-")) {
      // it's a photo, so let's get EXIF data and set that to folder date.
      setFolderDateFromThumbnailEXIF(activeFID, function() {
        clearSelections();
        $("#" + id).removeClass("is-loading");
      });
    } else {
      // it's probably a video and we won't get EXIF data.
      clearSelections();
      $("#" + id).removeClass("is-loading");
    }
  }).catch(function(error) {
    console.error("Error saving folder's thumbnail:", error);
  });
      
    
}

function getFolderThumbnailID(fid, callback) {
  callback = callback || noop;
  if(fid !== "home" && fid !== "favorites") {
    homeRef.doc(fid).get().then(function(item) {
      if (item.data()){
        callback(item.data().thumb);
      } else {
        callback("");
      }
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
    var count = 0;
    if (item.data()) { count = item.data().count; }
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
  if (toFolderID !== activeFID && activeFID !== "favorites") {
    var numberOfItemsToMove = arrayOfPIDsToMove.length;
    indexToMove = indexToMove || 0;
    showFileUploadStatus("is-info", "Organizing albums. ("+ Math.floor((indexToMove * 100) / numberOfItemsToMove) +"%)");
    var pid = arrayOfPIDsToMove[indexToMove];
    if (pid !== "" && pid !== undefined && pid !== null && pid !== " ") {
      $("#" + toFolderID).find(".album").addClass("is-loading");

      if (activeFID === "home") {
        whereFrom = homeRef.doc(pid);
      } else {
        whereFrom = homeRef.doc(activeFID).collection("photos").doc(pid);
      }

      if (toFolderID === "home") {
        whereTo = homeRef.doc(pid);
      } else {
        whereTo = homeRef.doc(toFolderID).collection("photos").doc(pid);
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
                if (activeFID !== "home" && activeFID !== "favorites") {
                  var adjustmentCount = 0 - numberOfItemsToMove;
                  adjustFolderCount (activeFID, adjustmentCount, thumbnailIsMoving);
                }
                if (toFolderID !== "home" && toFolderID !== "favorites") {
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

  if (didAnyTitlesObjectChange || !titlesIndexReady) {
    prepareTitlesSearchIndex(function(){
      gotFolderTitlesForModal();
    });
  } else {
    gotFolderTitlesForModal();
  }

  function gotFolderTitlesForModal() {
    setTimeout(function () {
      // console.log(titlesIndex.folders);
      
      $.each(titlesIndex.folders, function(fid, ftitle) {
        var isCurrent = ""; if (fid === activeFID) { isCurrent = "is-current"; }
        if (fid !== "home" && fid !== "favorites") {
          $("#photos-move-folders-list").append('<div class="column move-folder is-half" fname="'+ftitle+'"><button fid="'+fid+'" class="button is-fullwidth '+isCurrent+' photos-move-folders-list-item"><span class="icon is-small"><i class="fa fa-book"></i></span><span>'+ftitle+'</span></button></div>');
        }
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
  
    }, 1000); // to make sure the download is complete. UX thing, don't remove.
  }
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
      newFolder("Untitled Album", aNewUUID, function(){
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
          if (pid === convertID(thumb,"p")) {
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
        uploadCompleteResetUploaderState();

      });
    });
  }
}



////////////////////////////////////////////////////
///////////////// GENERATE THUMBNAIL ///////////////
////////////////////////////////////////////////////


// https://github.com/blueimp/JavaScript-Load-Image/commit/1e4df707821a0afcc11ea0720ee403b8759f3881

var browserWillHandleEXIFOrientation;

// Check if browser supports automatic image orientation
function determineBrowserEXIFOrientationTreatment() {
  // black 2x1 JPEG, with the following meta information set - EXIF Orientation: 6 (Rotated 90° CCW)
  var testImageURL =
    'data:image/jpeg;base64,/9j/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAYAAAA' +
    'AAAD/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBA' +
    'QEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE' +
    'BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAf/AABEIAAEAAgMBEQACEQEDEQH/x' +
    'ABKAAEAAAAAAAAAAAAAAAAAAAALEAEAAAAAAAAAAAAAAAAAAAAAAQEAAAAAAAAAAAAAAAA' +
    'AAAAAEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8H//2Q==';
  var img = document.createElement('img');
  img.onload = function () {
    // Check if browser supports automatic image orientation:
    browserWillHandleEXIFOrientation = img.width === 1 && img.height === 2;
    if (browserWillHandleEXIFOrientation) {
      // true == browser supports = don't rotate in js
      breadcrumb('[EXIF Orientation] Will be handled by Browser');
      setSentryTag("browser-handles-exif-orientation", "yes");
    } else {
      // false == browser doesn't support = rotate in js
      breadcrumb('[EXIF Orientation] Will be handled by Cryptee');
      setSentryTag("browser-handles-exif-orientation", "no");
    }
  };
  img.src = testImageURL;
}

determineBrowserEXIFOrientationTreatment();

// you can use generatePrimitive(imgB64, callback) as a drop in replacement
// function generatePinkynail (imgB64, callback) {
//   var maxWidth = 10, maxHeight = 10;
//   var canvas = document.createElement("canvas");
//   var ctx = canvas.getContext("2d");
//   var canvasCopy = document.createElement("canvas");
//   var copyContext = canvasCopy.getContext("2d");
//   var img = new Image();
//   img.src = imgB64;

//   img.onload = function () {
//     var ratio = 1;
//     if (img.width > maxWidth) { ratio = maxWidth / img.width; }
//     else if (img.height > maxHeight) { ratio = maxHeight / img.height; }
//     canvasCopy.width = img.width;
//     canvasCopy.height = img.height;
//     copyContext.drawImage(img, 0, 0);
//     canvas.width = img.width * ratio;
//     canvas.height = img.height * ratio;
//     ctx.drawImage(canvasCopy, 0, 0, canvasCopy.width, canvasCopy.height, 0, 0, canvas.width, canvas.height);
//     callback(canvas.toDataURL("image/jpeg", 0.4));
//   };
// }

var resizedCanvas, originalCanvas, orientationCanvas;
var resizedContext, originalContext, orientationContext;

function generateThumbnailsAndNecessaryMeta(imgB64, callback) {
    // image sizes in max pixels – for the longest dimension of image 

    var sizes = { "lightbox" : 1920, "thumbnail" : 768 };
    var qualities = { "lightbox": 0.7, "thumbnail": 0.4 };
    var uploadObject = { "lightbox" : "", "thumbnail" : "", "date" : "" };

    getEXIF(imgB64, function (exif) {
        
        var orientation;
        // if the browser won't handle orientation, and there's exif orientation data, use it to rotate pic.
        if (!browserWillHandleEXIFOrientation && exif.Orientation) { orientation = exif.Orientation; }
        
        var exifDate = extractExifDateTime(exif);
        if (exifDate) { uploadObject.date = exifDate; }

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


// function generateVideoThumbnails (videoFile, callback, errorCallback) {
//   callback = callback || noop;
//   errorCallback = errorCallback || noop;

//   var sizes = { "lightbox" : 1920, "thumbnail" : 768 };
//   var qualities = { "lightbox": 0.5, "thumbnail": 0.3 };
//   var uploadObject = { "lightbox" : "", "thumbnail" : "", "duration" : "" };

//   resizedCanvas = resizedCanvas || document.createElement("canvas");
//   resizedContext = resizedContext || resizedCanvas.getContext("2d");

//   originalCanvas = originalCanvas || document.createElement("canvas");
//   originalContext = originalContext || originalCanvas.getContext("2d");

//   orientationCanvas = orientationCanvas || document.createElement("canvas");
//   orientationContext = orientationContext || orientationCanvas.getContext("2d");

//   var videoPlayer = document.getElementById('video-player');
//   var videoFileReader = new FileReader();

//   videoFileReader.onloadend = function() {
//     var videoBlob = new Blob([videoFileReader.result], {type: videoFile.type});
//     var videoObjectURL = URL.createObjectURL(videoBlob);
    
//     function timeupdate() {      
//       if (videoPlayer.currentTime > 0.1) {
//         videoPlayer.removeEventListener('timeupdate', timeupdate);
//         videoPlayer.pause();
//         uploadObject.duration = videoPlayer.duration;
//         snapshotFirstSecondOfVideo();
//         URL.revokeObjectURL(videoObjectURL);
//         videoPlayer.src = "";
//         gotThumbnails();
//       }
//     }

//     function snapshotFirstSecondOfVideo() {
//       orientationCanvas.width = videoPlayer.videoWidth;
//       orientationCanvas.height = videoPlayer.videoHeight;
//       orientationContext.drawImage(videoPlayer, 0, 0, orientationCanvas.width, orientationCanvas.height);

//       for (var size in sizes) { // cycle through all sizes, and generate thumbnails
//         var maxWidthOrHeight = sizes[size]; // lightbox, thumbnail etc. 
//         var ratio = 1;

//         if (orientationCanvas.width > maxWidthOrHeight) { ratio = maxWidthOrHeight / orientationCanvas.width; }
//         else if (orientationCanvas.height > maxWidthOrHeight) { ratio = maxWidthOrHeight / orientationCanvas.height; }

//         originalCanvas.width = orientationCanvas.width;
//         originalCanvas.height = orientationCanvas.height;

//         originalContext.drawImage(orientationCanvas, 0, 0, orientationCanvas.width, orientationCanvas.height, 0, 0, originalCanvas.width, originalCanvas.height);

//         resizedCanvas.width = originalCanvas.width * ratio; // this canvas gets a reduced size
//         resizedCanvas.height = originalCanvas.height * ratio;

//         resizedContext.drawImage(originalCanvas, 0, 0, originalCanvas.width, originalCanvas.height, 0, 0, resizedCanvas.width, resizedCanvas.height);
//         uploadObject[size] = resizedCanvas.toDataURL("image/jpeg", qualities[size]);
//       }
//     }

//     videoPlayer.preload = 'metadata';
//     videoPlayer.src = videoObjectURL;
//     videoPlayer.muted = true;
//     videoPlayer.playsInline = true;
//     videoPlayer.play();
//     videoPlayer.addEventListener('timeupdate', timeupdate);

//     function gotThumbnails() {
//       callback(uploadObject);
//     }
//   };

//   videoFileReader.onerror = function(err){
//     errorCallback(err);
//   };

//   videoFileReader.readAsArrayBuffer(videoFile);
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

function extractExifDateTime(exif) {
  var date;
  
  // use DateTimeOriginal || DateTimeDigitized || DateTime in this exact order. 
  // DateTimeOriginal = taken time, if it exists.
  // DateTime = Edited Time, if it's edited in lightroom, if not, taken time. 
  if (exif) {
    if (exif.DateTime) { 
      if (exif.DateTime.indexOf(":") !== -1) {
        // just to make sure we're not writing something non exif looking here.
        date = exif.DateTime; 
      }
    } 
  
    if (exif.DateTimeDigitized) { 
      if (exif.DateTimeDigitized.indexOf(":") !== -1) {
        // just to make sure we're not writing something non exif looking here.
        date = exif.DateTimeDigitized; 
      }
    } 
  
    if (exif.DateTimeOriginal) { 
      if (exif.DateTimeOriginal.indexOf(":") !== -1) {
        // just to make sure we're not writing something non exif looking here.
        date = exif.DateTimeOriginal; 
      }
    } 
  }

  return date;
}

////////////////////////////////////////////////////
////////////// FILE & FOLDER MANAGEMENT ////////////
////////////////////////////////////////////////////

function showEmptyFolderDialog () {
  $("#new-folder-shell").fadeOut(250);
  $(".photos-empty-folder").fadeIn(250);
}

function hideEmptyFolderDialog (callback) {
  callback = callback || noop;
  $(".photos-empty-folder").fadeOut(250, function(){
    $("#new-folder-shell").fadeIn(250);
    callback();
  });
}

function folderCreated (fid, fname, date, callback, callbackParam) {
  callback = callback || noop;
  if (activeFID === "home") {
    activeItemsObject[fid].title = fname;
    renderFolder(fid, fname, "", "", date, true, updateTitles, callback, callbackParam);
  } else {
    callback(callbackParam);
  }
}

function renderNewFolderShell() {
  var folderHTML = 
  '<div class="column is-full folder-content" id="new-folder-shell">'+
    '<div class="symbols">'+
      '<img src="../assets/square.svg" />'+
      '<img src="../assets/circle.svg" />'+
      '<img src="../assets/triangle.svg" />'+
    '</div>'+
    '<p>NEW ALBUM</p>'+
  '</div>';
  return folderHTML;
}

function renderFolder (fid, fname, pinky, thumb, exifDate, isItNew, callback, callback2, callbackParam2) {
  callback = callback || noop;
  callback2 = callback2 || noop;
  isItNew = isItNew || false;

  fname = fname || "Untitled";
  pinky = pinky || '<img draggable="false" src="../assets/nothumb.jpg" style="opacity:1;" class="is-loaded">';

  var pinkyObj = "";
  thumb = thumb || "";

  if (pinky.startsWith("data:image")) {
    pinkyObj = '<img draggable="false" src="'+pinky+'"  tid="'+thumb+'">';
  } else {
    if (!pinky.startsWith("<img")) {
      pinkyObj = '<img draggable="false" src="//:0" tid="'+thumb+'">';
    } else {
      pinkyObj = pinky;
    }
  }

  var downloadButton = "";
  if (pinky.indexOf("nothumb") === -1 && !isInWebAppiOS) {
    // folder has thumbnail, which means it has a photo, 
    // not in iOS WebApp, so show download button
    downloadButton = '<span class="downloadfoldericon icon is-small"><i class="fa fa-fw fa-download"></i></span>';
  }

  var theParsedFoldername = "";
  try { theParsedFoldername = JSON.parse(fname).toString(); } catch (e) { theParsedFoldername = fname; }  
  if (theParsedFoldername && typeof theParsedFoldername === "string") {
    theParsedFoldername = (theParsedFoldername || "Untitled").toUpperCase();
  } else {
    theParsedFoldername = "UNTITLED ALBUM";
  }
  var date = yearFromTitle(theParsedFoldername) || fancyDate(exifDate) || "";
  var titleWithoutYear = yearOmittedTitle(theParsedFoldername);
  var sortableDate = sortableDateFromTitleOrEXIF(theParsedFoldername, exifDate);

  var animateAfterAdding = "";
  if (callback !== noop) {
    animateAfterAdding = " display:none; ";
  }

  var newFolderFocus = "";
  if (isItNew) {
    newFolderFocus = 'onfocus="this.setSelectionRange(0, this.value.length)"';
  }

  var folderDivOpener = '<div class="column is-full folder-content albumitem" photositemname="'+theParsedFoldername+'" id="'+fid+'" date="'+ date +'" datesort="'+sortableDate+'" style="'+animateAfterAdding+'">';
  var folderHTML =
    '<div class="album">'+
      pinkyObj +
      // '<div class="button is-light unclickable albumicon"><span class="icon"><i class="fa fa-fw fa-book"></i></span></div>'+
      '<input onclick="this.focus()" '+newFolderFocus+' type="text" class="albumtitle" value="'+titleWithoutYear+'" placeholder="'+theParsedFoldername+'" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />'+
      // '<span class="settingsicon icon is-small"><i class="fa fa-fw fa-ellipsis-v"></i></span>'+
      '<span class="deletefoldericon icon is-small"><i class="fa fa-fw fa-trash"></i></span>'+
      '<span class="ghostfoldericon icon is-small"><i class="fa fa-fw fa-eye-slash"></i></span>'+
      downloadButton +
      '<progress class="progress is-small is-dark"></progress>'+
    '</div>';
  var folderDivCloser = '</div>';

  if (callback !== noop) {
    $("#new-folder-shell").after(folderDivOpener + folderHTML + folderDivCloser + "<div></div>");
    setTimeout(function () {
      $("#" + fid).css('min-height',0).css('height',160).slideDown(1000);
    }, 10);
    callback(callback2, callbackParam2);
  } else {
    return folderHTML;
  }
}

function renderFolderShell(id, title, exifDate) {
  var date = yearFromTitle(title) || fancyDate(exifDate) || "";
  var sortableDate = sortableDateFromTitleOrEXIF(title, exifDate);

  if (title && typeof title === "string") {
    title = (title || "Untitled").toUpperCase();
  } else {
    title = "UNTITLED ALBUM";
  }
  var html = "<div class='column is-full folder-content albumitem shell' photositemname='"+title+"' id='"+id+"' date='"+ date +"' datesort='"+sortableDate+"'><progress class='progress is-small is-dark'></progress></div>";
  return html;
}


function renderPhoto (pid, nail, pname, exifDate, rawBool, callback, callbackParam) {
  callback = callback || noop;
  pname = pname || "Untitled.jpg";
  nail = nail || "";
  rawBool = rawBool || false;

  var sortableDate = sortableExifDate(exifDate) || "";
  var date = fancyDate(exifDate) || "";
  var isItSelected = "";
  var isItLoading = "";
  var isLoaded = "";
  var loadingColor = "is-black-loader";
  if (pid in selectionsObject) { isItSelected = " selected"; }

  var theParsedFilename = "";
  try { theParsedFilename = JSON.parse(pname).toString(); } catch (e) { theParsedFilename = pname; }

  if (theParsedFilename && typeof theParsedFilename === "string") {
    pext = extensionFromFilename(theParsedFilename) || "";
    theParsedFilename = (titleFromFilename(theParsedFilename) || "Untitled.jpg").toUpperCase();
  } else {
    pext = extensionFromFilename("Untitled.jpg");
    theParsedFilename = (titleFromFilename("UNTITLED.jpg"));
  }

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

  var photoDivOpener = '<div photositemname="'+theParsedFilename+'" class="column is-one-sixth-fullhd is-one-quarter-desktop is-one-third-tablet is-half-mobile folder-content mediaitem '+isItSelected+'" id="'+pid+'" date="'+ date +'" datesort="'+sortableDate+'" style="'+dominant+'">';
  var photoHTML =
    '<div class="media '+isItLoading+' '+loadingColor+'">'+
      imgElem +
      '<input type="text" class="mediatitle" ext="'+pext+'" value="'+theParsedFilename+'" placeholder="'+theParsedFilename+'" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />'+
      '<div class="media-selection">'+
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


function renderPhotoShell (id, nail, title, exifDate) {
  nail = nail || "";
  var bgColor = "";
  if (!nail.startsWith("data:image")) {
    bgColor = "style='background-color:rgb("+nail+");'";
  }
  
  var theParsedFilename = "";
  try { theParsedFilename = JSON.parse(title).toString(); } catch (e) { theParsedFilename = title; }
  
  if (theParsedFilename && typeof theParsedFilename === "string") {
    theParsedFilename = (titleFromFilename(theParsedFilename).toString() || "Untitled.jpg").toUpperCase();
  } else {
    theParsedFilename = titleFromFilename("Untitled.jpg").toUpperCase();
  }
  
  var sortableDate = sortableExifDate(exifDate) || "";
  var date = fancyDate(exifDate) || "";

  var html = "<div photositemname='"+theParsedFilename+"' class='column is-one-sixth-fullhd is-one-quarter-desktop is-one-third-tablet is-half-mobile folder-content mediaitem shell is-loading' id='"+id+"' date='"+ date +"' datesort='"+sortableDate+"' "+bgColor+"></div>";
  return html;
}


function renderFavoritePhoto (pid, nail, exifDate, rawBool, callback, callbackParam) {
  callback = callback || noop;
  nail = nail || "";
  rawBool = rawBool || false;

  var sortableDate = sortableExifDate(exifDate) || "";
  var date = fancyDate(exifDate) || "";
 
  var isItLoading = "";
  var isLoaded = "";
  var loadingColor = "is-black-loader";

  var imgElem = ""; var dominant = "";
  if (nail.startsWith("data:image")) {
    imgElem = '<img draggable="false" src="'+nail+'" style="'+isLoaded+'">';
  } else {
    imgElem = "<img draggable='false' src='//:0' style='"+isLoaded+"'>";
    dominant = "background-color:rgb("+nail+");";
    var colorContrast = nail.split(",").reduce(function add(a, b) { return parseInt(a) + parseInt(b); }, 0);
    if (colorContrast < 385) { loadingColor = "is-white-loader"; }
  }

  var photoDivOpener = '<div class="column is-half folder-content mediaitem fav" id="'+pid+'" date="'+ date +'" datesort="'+sortableDate+'" style="'+dominant+'">';
  var photoHTML = 
  '<div class="media '+isItLoading+' '+loadingColor+'" style="'+dominant+'">'+ 
    imgElem + 
    '<div class="media-selection">'+
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


function renderFavoritePhotoShell (id, exifDate) {  
  var sortableDate = sortableExifDate(exifDate) || "";
  var date = fancyDate(exifDate) || "";

  var html = "<div class='column is-half folder-content mediaitem fav shell' id='"+id+"' date='"+ date +"' datesort='"+sortableDate+"'></div>";
  return html;
}






function renderDOMShell (id) {
  
  var shellElement = "";

  if (activeItemsObject[id]) {
    
    if (id.startsWith('p-')) {
      // PHOTO
      if (activeFID === "favorites") {
        shellElement = renderFavoritePhotoShell(id, activeItemsObject[id].date);
      } else {
        shellElement = renderPhotoShell(id, activeItemsObject[id].pinky, activeItemsObject[id].title, activeItemsObject[id].date);
      }
    } 
    
    else if (id.startsWith('f-')) {
      // FOLDER
      shellElement = renderFolderShell(id, activeItemsObject[id].title, activeItemsObject[id].date);
    } 

    else { 
      // wtf. neither photo nor folder.
    }


  } else {
    handleError("User has an item that's not in activeItemsObject @DOMShell", {"id": id});
    // somehow item isn't in activeItemsObject. wtf. soooo not adding. since it's better than crashing. but wtf. 
  }

  return shellElement;
}

function renderDOMElement (id){
  var domElement = "";

  if (activeItemsObject[id]) {
    if (id.startsWith('p-')) {
      // PHOTO
      if (activeFID === "favorites") {
        domElement = renderFavoritePhoto(id, activeItemsObject[id].pinky, activeItemsObject[id].date, false);
      } else {
        domElement = renderPhoto(id, activeItemsObject[id].pinky, activeItemsObject[id].title, activeItemsObject[id].date, false);
      }
    } 
    
    else if (id.startsWith('f-')) {
      // FOLDER
      domElement = renderFolder(id, activeItemsObject[id].title, activeItemsObject[id].pinky, activeItemsObject[id].thumb, activeItemsObject[id].date);
    } 
    else { 
      // wtf. neither photo nor folder.
      handleError("User has a non-photo/non-folder item", {"id": id});
    }
  } else {
    // if user has scrolled too far down, then goes back to home or to another folder, 
    // and quickly scrolls up or down before the titles of the new folder are loaded, what will happen is that 
    // while the new folder is loading, @ onEntryAndExit, we'll call renderDOMElement with an ID of a DOM shell from the DOM from the previous folder user navigated away from,
    // and because we're loading the new folder this ID isn't in activeItemsObject anymore, so now we'll have a renderDOMElement with an ID that's not in activeItemsObject anymore.
    // A mystery that is at least 6 months old. Case closed. boom.  
  }

  return domElement;
}






function addIntersectionObserver (el){
  observer.observe(el);
}

// this is 10 to ensure that when an album is initially loaded (when there's no scroll)
// photos start loading right away.
// will change this to 750 as soon as scroll starts, 
// and revert back to 10 when scroll stops. 
var thumbnailEntryTimeout = 10;

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

        // this controls how quickly we should start loading thumbnails.
        // too soon, and you'll load too many thumbnails = lose time downloading.
        // too late, and you'll wait too much for thumbnails to load when they enter screen.
        onScreenTimer = setTimeout(function(){
          getThumbForItem (folderContent, tid, id);
        }, thumbnailEntryTimeout);

        folderContent.classList.remove('shell');
      }

    } else {
      // exited
      folderContent = change.target;
      id = folderContent.id;

      if (id !== "new-folder-shell") {  
        
        if (onScreenTimer) {
          clearTimeout(onScreenTimer);
        }

        if (activeItemsObject[id]) {
          if (activeItemsObject[id].tidreq) {
            activeItemsObject[id].tidreq.abort(); // abort ajax get request for thumbnail
          }
        }

        folderContent.innerHTML = "";
        folderContent.classList.add('shell');
        folderContent.classList.remove('is-loaded');

        if (folderContent.classList.contains("mediaitem") && !folderContent.classList.contains("is-loading")) {
          folderContent.classList.add('is-loading');
        }

      }

    }

  });

}



//breadcrumb navigation management /// not the error logging breadcrumbs. adding for clarity..

$("#folder-contents").on("click", ".albumitem", function(event){
  if (event.target.tagName.toLowerCase() !== "input") {
    event.stopPropagation(); event.preventDefault();
    var fid = $(this).attr("id");
    getAllFilesOfFolder (fid);
  }
});


// THIS IS FOR ANDROID BACK BUTTON OR BROWSER BACK BUTTON
window.addEventListener('popstate', function(e) {
  // this is to make sure we have a user before calling this function.
  // otherwise getAllFilesOfFolder will get called before auth is complete, and tons of shit will be undefined.
  
  if (theUser && theKey) { 
    var id = e.state;
    if ($("#lightbox-modal").hasClass("is-active")) {
      closeLightbox();
    } else {
      if (id) {
        if (id === "home") {
          homeFolderLoaded = false; otherFolderLoaded = false;
          getHomeFolder();
        } 
        
        else if (id === "favorites") {
          homeFolderLoaded = false; otherFolderLoaded = false;
          getFavoritesFolder();
        } 
        
        else {
          if (isItAFolderID(id)) {
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

function sortItemsObject (sorttype, obj) {

  // CYCLES THROUGH active Items Object and returns a sorted titles array like :
  // [[id, title, date], [id, title, date]]
  // item[0] as the id, item[1] as the filename, item[2] as the date
  sorttype = sorttype || "az-asc";
  obj = obj || activeItemsObject;
  $(".sort-button").removeClass("selected");
  
  var titlesArray = [];
  var objArray = Object.keys(obj);
  objArray.forEach(function(id){
    var title = (obj[id].title || "Untitled").toUpperCase();
    var date = obj[id].date || "0000:00:00";
    titlesArray.push([id, title, date]);
  });

  if (sorttype === "az-asc") {
    $("#sort-az-asc").addClass("selected");
    titlesArray.sort(function(a, b) {
      if (a[1] < b[1]) { // [1] == title
        return -1;
      } else {
        return 1;
      }
    });
  } else if (sorttype === "az-desc") {
    $("#sort-az-desc").addClass("selected");
    titlesArray.sort(function(a, b) {
      if (a[1] > b[1]) { // [1] == title
        return -1;
      } else {
        return 1;
      }
    });
  } else if (sorttype === "date-asc") {
    $("#sort-date-asc").addClass("selected");
    titlesArray.sort(function(a, b) {
      if (sortableDateFromTitleOrEXIF(a[1], a[2]) < sortableDateFromTitleOrEXIF(b[1], b[2])) { //  [1] = title, [2] = date
        return -1;
      } else {
        return 1;
      }
    });
  } else if (sorttype === "date-desc") {
    $("#sort-date-desc").addClass("selected");
    titlesArray.sort(function(a, b) {
      if (sortableDateFromTitleOrEXIF(a[1], a[2]) > sortableDateFromTitleOrEXIF(b[1], b[2])) { // [1] = title, [2] = date
        return -1;
      } else {
        return 1;
      }
    });
  } else {
    // UNKNOWN SORT, use az-asc instead
    $("#sort-az-asc").addClass("selected");
    titlesArray.sort(function(a, b) {
      if (a[1] < b[1]) { // [1] == title
        return -1;
      } else {
        return 1;
      }
    });
  }

  var sortedTitlesArray = [];
  sortedTitlesArray = titlesArray;

  return sortedTitlesArray;
}

function extensionFromFilename (filename) {
  return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
}

function titleFromFilename (filename) {
  var extension = "." + extensionFromFilename(filename);
  var titleToReturn = (filename.substring(0,filename.lastIndexOf(extension)) + '');
  if (titleToReturn === "") { titleToReturn = filename; }
  return titleToReturn;
}

function getTitles (fid, contents, callback) {
  titlesRef.doc(fid).get().then(function(titles) {
    gotTitles(titles.data().titles, titles.data().sort, contents, callback);
  }).catch(function(error) {
    console.log("Error getting titles of folder, likely empty");
  });
}

function gotTitles (JSONifiedEncryptedTitlesObject, sort, contents, callback) {
  callback = callback || noop;
  var encryptedTitlesObject = JSON.parse(JSONifiedEncryptedTitlesObject).data;
  decrypt(encryptedTitlesObject, [theKey]).then(function(plaintext) {
    var titlesObject = JSON.parse(plaintext.data);
    processTitles(titlesObject, sort, contents, callback);
  });
}

function processTitles (titlesObject, sort, contents, callback) {
  callback = callback || noop;
  sort = sort || "az-asc";
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

      // get thumbnail url tokens from firestore if we have them
      if (item.data().ttoken) {
        activeItemsObject[id].ttoken = item.data().ttoken;
      } else {
        activeItemsObject[id].ttoken = "";
      }

      if (item.data().ltoken) {
        activeItemsObject[id].ltoken = item.data().ltoken;
      } else {
        activeItemsObject[id].ltoken = "";
      }

      if (isItAFolderID(id)) {
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

  sortAndRenderActiveItemsObject(sort);

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

  if (!isMobile && !isipados) {
    if (foldersWithoutDates.length > 0) {
      updateFoldersWithoutDates();
    } else {
      hideLibraryUpdate();
    }
  }

}


function sortAndRenderActiveItemsObject (sort) {

  // [[id, title], [id, title]]
  // item[0] is the id, item[1] is the filename, item[2] is the date
  var itemsArray = sortItemsObject(sort);
  var sortedDOMArray = [];
  var sortedLightboxArray = [];
  var numberOfMediaItems = 0;

  // remove all lightbox events to stop thousands of slideChange events from triggering.
  // and remove all slides from lightbox 
  try { lightbox.off('slideChange'); } catch (e) {}
  lbox.removeAllSlides(); 
  clearTimeline(true);
  breadcrumb("[Render Active Items] Sorted. Rendering DOM Shells");

  // insert dom elements into the sortedDOMArray in correct order.
  itemsArray.forEach(function (item, index) {
    // item[0] is the id, item[1] is the filename
    var itemid = item[0];
    sortedDOMArray.push(renderDOMShell(itemid));

    // if it's a photo, video or RAW, add a shell div to lightbox slider
    // you will then go to this slide, and fill this div with image later
    // don't worry these are virtualized, and only the current, prev and next
    // slides are in DOM. Others aren't. 
    
    if (isItAMediaID(itemid)) {
      sortedLightboxArray.push("<div pid='"+itemid+"' class='swiper-zoom-container'></div>");
      numberOfMediaItems++;
    }

    addToTimeline(item);
  });

  lbox.appendSlide(sortedLightboxArray);
  lbox.update();

  breadcrumb("[Render Active Items] Inserting DOM Shells");

  // now we have a pre-sorted sortedDOMArray which has all photo and album objects
  // add this and ghost element to dom in a single joint chunk
  $("#folder-contents").html("");
  $("#folder-contents").append(sortedDOMArray.join(""));

  // this is to prevent intersection observer chaos when 10,000s of photos are added simultaneously.
  setTimeout(function () {
    $(".folder-content").each(function () {
      addIntersectionObserver (this);
    });
  }, 100);

  // now that all slides are in the lightbox, start listening for slideChange again.
  lightbox.on('slideChange', lightboxPhotoChanged);

  if (activeFID === "home") {
    if($("#new-folder-shell").length === 0) {
      $("#folder-contents").prepend(renderNewFolderShell());
    }
  }

  if (numberOfMediaItems === 0) {
    $("#photos-select-all-button").addClass("unavailable");
  } else {
    $("#photos-select-all-button").removeClass("unavailable");
  }

  drawTimeline(sort);
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
      if (isItAFolderID(id)) {
        ftitles[id] = JSON.stringify(title);
      } else {
        ptitles[id] = JSON.stringify(title);
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


$("#folder-contents").on("keydown", '.mediatitle, .albumtitle', function(event) {
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

$("#folder-contents").on("blur", '.mediatitle, .albumtitle', function(event) {
  var input = $(this);
  var trimmedTitle = input.val().trim();
  if (trimmedTitle === "" || trimmedTitle === " ") {
    input.val("Unnamed");
  }
  
  var fidOrPid = input.parents(".folder-content").attr("id");

  if (input.attr("placeholder") !== trimmedTitle) {
    input.parents(".folder-content").addClass("is-loading");
    input.parents(".folder-content").find(".album").addClass("is-loading");

    if (input.attr("ext")) {
      activeItemsObject[fidOrPid].title = trimmedTitle + "." + input.attr("ext");
    } else {
      activeItemsObject[fidOrPid].title = trimmedTitle;
    }

    updateTitles(function(){
      if (input.hasClass("albumtitle")){
        updateFolderTitle(fidOrPid, trimmedTitle, function(){
          input.parents(".folder-content").removeClass("is-loading");
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
        input.parents(".folder-content").removeClass("is-loading");
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

function sortableDateFromTitleOrEXIF(title,exif) {
  var sortableDate = "00000000";
  if (yearFromTitle(title)) {
    sortableDate = yearFromTitle(title) + "0000";
  } else {
    sortableDate = sortableExifDate(exif) || "";
  }
  return sortableDate;
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
  $("#delete-album-modal").find(".subtitle").html('Are you sure you want to delete <b class="delete-folder-name"></b> and all of its contents?');
  $(".delete-folder-name").html(albumTitle);
  showModal("delete-album-modal");
});

function confirmDeleteFolder () {
  progressModal("delete-album-modal");
  if (fidToDelete !== activeFID) {
    $("#delete-album-modal").find(".subtitle").html("Deleting ...");
    var fid = fidToDelete;
    var albumRef = homeRef.doc(fid).collection("photos");
    albumRef.get().then(function(items) {

      var noItemsLeftToDelete = items.docs.length;
      var deletionsObject = {};
      deletionsObject[fid] = [];

      if (noItemsLeftToDelete > 0) {

        $("#delete-album-modal").find(".subtitle").html("Deleting (<b>" + noItemsLeftToDelete + "</b> items)");
        
        items.docs.forEach(function(item) {
          var pid = item.data().id;
          deletionsObject[fid].push(pid);          
          removeFromFavorites(pid);
        });

        batchDeleteItems(deletionsObject, function(){
          $("#delete-album-modal").find(".subtitle").html("Deleting (Finalizing)");
          deleteCollection(albumRef).then(function(){
            homeRef.doc(fid).delete().then(function(){
              titlesRef.doc(fid).delete().then(function(){
                deleteFolderComplete(fid);
              });
            });
          });
        }, function(error){
          handleError("Error Deleting Album", error);
          unprogressModal("delete-album-modal");
        });

      } else {
        homeRef.doc(fid).delete().then(function(){
          titlesRef.doc(fid).delete().then(function(){
            deleteFolderComplete(fid);
          });
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
    $("#ghost-folder-confirm-button").attr("disabled", true).prop("disabled", true);
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
    getPIDsOfFolder(fidToGhost, function(pids){

      pids.forEach(function(pid) {
        removeFromFavorites(pid);
      });

      hashString($("#ghost-folder-confirm-input").val().toUpperCase()).then(function(titleHashToGhost){
        var makeGhostAlbum = cloudfunctions.httpsCallable('makeGhostAlbumV2');
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

      var summonGhostAlbum = cloudfunctions.httpsCallable('summonGhostAlbumV2');
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
    }).catch(function(error){
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
    if (isItAMediaID(id)) {
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
    $("#photos-move-sel-modal-toggle-button").attr("disabled", false).prop("disabled", false);
    $("#photos-download-sel-modal-toggle-button").attr("disabled", false).prop("disabled", false);
  } else {
    if (!selectionmode) {
      $(".normal-nav-item").show();
      $(".selection-nav-item").hide();
    }
    $("#photos-set-thumb-button").addClass("unavailable");
    $("#photos-del-sel-modal-toggle-button").attr("disabled", true).prop("disabled", true);
    $("#photos-move-sel-modal-toggle-button").attr("disabled", true).prop("disabled", true);
    $("#photos-download-sel-modal-toggle-button").attr("disabled", true).prop("disabled", true);
  }

  $("#photos-delete-selections-modal").find(".subtitle").html('Are you sure you want to delete your selections? (<span class="number-of-selections"></span>)?');
  
  if (activeFID === "favorites") {
    $("#photos-set-thumb-button").addClass("unavailable");
    $("#photos-del-sel-modal-toggle-button").attr("disabled", true).prop("disabled", true);
    $("#photos-move-sel-modal-toggle-button").attr("disabled", true).prop("disabled", true);
  }

  if (numberOfSelections <= 1) {
    $(".number-of-selections").html(numberOfSelections + "<span class='hiddenForFinger'> photo</span>");
  } else {
    $(".number-of-selections").html(numberOfSelections + "<span class='hiddenForFinger'> photos</span>");
  }

}


function deleteSelections() {
  if (activeFID !== "favorites") {    
    progressModal("photos-delete-selections-modal");
    var numOfSelectionsToDelete = Object.keys(selectionsObject).length;
    $("#photos-delete-selections-modal").find(".subtitle").html("Deleting " + numOfSelectionsToDelete + " items");

    var deletionsObject = {};
    deletionsObject[activeFID] = [];
    getFolderThumbnailID(activeFID, function(thumb){
      var isFolderThumbDeleted = false;
      var thumbPID = convertID(thumb,"p");
      $.each(selectionsObject, function(pid) {
        try { if (pid === thumbPID) { isFolderThumbDeleted = true; } } catch (e) { }
        deletionsObject[activeFID].push(pid);
      });

      batchDeleteItems(deletionsObject, function(){
        allDeletionsComplete(isFolderThumbDeleted);
      }, function(error){
        unprogressModal("photos-delete-selections-modal");
        $("#photos-delete-selections-modal").find(".button.is-success").removeClass("is-loading").prop("disabled", false).attr("disabled", false);
      });
      
    });
  }
}

function allDeletionsComplete(isFolderThumbDeleted) {
  
  if (activeFID !== "home" && activeFID !== "favorites") {
    var adjustmentCount = 0 - Object.keys(selectionsObject).length;
    adjustFolderCount (activeFID, adjustmentCount, isFolderThumbDeleted);
  }

  Object.keys(selectionsObject).forEach(function(pid){
    delete activeItemsObject[pid];
  });

  $(".mediaitem.selected").remove();
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

function clearSelections() {
  selectionmode = false;
  selectionsObject = {};
  $(".media-selection").removeClass("selectionmode");
  updateSelections();
}

function selectAll() {
  // if (activeFID !== "favorites") {
    Object.keys(activeItemsObject).forEach(function(id){
      if (isItAMediaID(id)) {
        selectionsObject[id] = activeItemsObject[id].title;
      }
    });
    
    updateSelections();
  // }
}

$("#folder-contents").on('click', '.media-selection', function(event) {
  if (!isMobile) {
    event.preventDefault(); event.stopPropagation(); var shifted = event.shiftKey;

    if (shifted) {
      var foldercontent = $(this).parents(".folder-content");
      selectionsObject[foldercontent.attr("id")] = activeItemsObject[foldercontent.attr("id")].title;

      var shiftSel = foldercontent.prevUntil(".mediaitem.selected", ".mediaitem");
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

      if (window.navigator && window.navigator.vibrate && !isFirefox) {
        navigator.vibrate(100);
      }
    }
    updateSelections();
  }
});

function selectionModeOn () {
  $(".normal-nav-item").hide();
  $(".selection-nav-item").show();
  $(".media-selection").addClass("selectionmode");
  selectionmode = true;
}

////////////////////////////////////////////////////
////////////////   LOAD PHOTO     //////////////////
////////////////////////////////////////////////////
var selectionmode = false;
var preparingToDisplayPhoto = false;

$("#folder-contents").on("click", '.mediaitem', function(event) {
  var shifted = event.shiftKey;
  var selPhoto = $(this);
  var pid = selPhoto.attr("id");

  if (event.target.tagName.toLowerCase() !== "input" && !preparingToDisplayPhoto && !$("#lightbox-modal").hasClass("is-active")) {
    if (selectionmode || Object.keys(selectionsObject).length > 0)  {
      if (shifted) {

        selectionsObject[pid] = activeItemsObject[pid].title;

        var shiftSel = selPhoto.prevUntil(".mediaitem.selected", ".mediaitem");
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

        if (window.navigator && window.navigator.vibrate && !isFirefox) {
          navigator.vibrate(100);
        }

      }
      updateSelections();
    } else {
      loadPhoto(pid, selPhoto.find(".mediatitle").val(), "display");
    }
  }
});








function loadPhoto (pid, ptitle, displayOrDownload, callback, callbackParam) {
  callback = callback || noop;
  if (pid !== "" && pid !== " " && pid !== undefined && pid !== null) {
    $("#" + pid).addClass("is-loading");

    if (displayOrDownload === "download"){
      // use original
      getLightboxDownloadURL(pid, function(downloadURL){
        gotDownloadURL(downloadURL);
      }, true);
    } else {
      // TRY USING LIGHTBOX
      preparingToDisplayPhoto = pid;
      if (isImgInLightboxCache(pid) || isHighResImgInViewportCache(pid)) {
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
          if (downloadURL.startsWith("https://atlas.crypt.ee/")) {
            photoLoaded(pid, ptitle, encryptedPhoto, displayOrDownload, true, callback, callbackParam);
          } else {
            photoLoaded(pid, ptitle, encryptedPhoto, displayOrDownload, false, callback, callbackParam);
          }
        },
        error:function (xhr, ajaxOptions, thrownError){
          console.log(thrownError);
          setTimeout(function(){ window.location.reload(); }, 2500);
        }
      }).progress(function(e) {
        $("#" + pid).addClass("is-loading"); // to make sure photo looks loading if user tapped on photo while it was still loading thumb, then loading indicator was removed.
      });
    } else {
      console.log(thrownError);
      setTimeout(function(){ window.location.reload(); }, 2500);
    }
  }

}




var queuePhoto;
function photoLoaded (pid, ptitle, encryptedPhoto, displayOrDownload, skipParse, callback, callbackParam) {
  callback = callback || noop;
  displayOrDownload = displayOrDownload || "display";
  var encryptedB64;
  if (skipParse) {
    encryptedB64 = encryptedPhoto;
  } else {
    encryptedB64 = JSON.parse(encryptedPhoto).data;
  }

  $("#" + pid).addClass("is-loading"); // to make sure photo looks loading if user tapped on photo while it was still loading thumb, then loading indicator was removed.
  decrypt(encryptedB64, [theKey]).then(function(plaintext) {
    $("#" + pid).addClass("is-loading"); // to make sure photo looks loading if user tapped on photo while it was still loading thumb, then loading indicator was removed.
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
  var tid = convertID(pid, "t");
  pb64 = pb64 || $("img[tid='"+tid+"']").attr("src");

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
  // nextPID = nextPID || $("#sr-"+pid).next(".photos-search-result").attr("pid") || $(".photos-search-result").first().attr("pid") || $("#"+pid).nextUntil(".mediaitem").last().next().attr("id") || $("#"+pid).next(".mediaitem").attr("id") || $(".mediaitem").first().attr("id");

  if (nextPID !== undefined) {
    $("#lightbox-spinner").addClass("wait");
    getLightboxDownloadURL(nextPID, function(downloadURL){
      gotNextOrPrevLightboxDownloadURL(downloadURL, nextPID, callback, callbackParam);
    });
  }
}



function preloadPrevSlide (prevPID, callback, callbackParam) {
  callback = callback || noop;
  // prevPID = prevPID || $("#sr-"+pid).prev(".photos-search-result").attr("pid") || $(".photos-search-result").last().attr("pid") || $("#"+pid).prevUntil(".mediaitem").last().prev().attr("id") || $("#"+pid).prev(".mediaitem").attr("id") || $(".mediaitem").last().attr("id");  
      
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
          var encryptedB64;
          
          if (downloadURL.startsWith("https://atlas.crypt.ee/")) {
            encryptedB64 = encryptedPhoto;
          } else {
            encryptedB64 = JSON.parse(encryptedPhoto).data;
          }

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
    if (!isios && !isipados) {
      history.pushState("home", null, '/photos');
    }
  } else {
    if (!isios && !isipados) {
      history.pushState(activeFID, null, '/photos?f='+activeFID);
    }
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
    zoom: true,
    setWrapperSize:true,
    slidesPerView:1,
    slidesPerColumn:1,
    addSlidesBefore:1,
    addSlidesAfter:1,
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
      if (!isios && !isipados) {
        history.pushState(pid, null, '/photos?p='+pid);
      }
      activePID = pid;
      preparingToDisplayPhoto = false;
      setFavoriteButtonState();
      $("#" + pid).removeClass("is-loading");

      // this will scroll to element behind the lightbox. 
      // so that 
      // a) when the user closes lightbox, they'll be where they left.
      // b) we can ensure that the next slide's thumbnail is always loaded.
      // (we take next slide thumbs from the gallery, so if the thumb isn't loaded, we won't have a next slide thumb)  
      scrollToItem(pid); 
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

function isHighResImgInViewportCache(pid) {
  var inCache = false;
  var tid = convertID(pid, "t"); 
  var image = $("img[tid='"+tid+"']").attr("hres");
  if (image) {
    inCache = true;
  } 
  return inCache;
}

function addImgToDOMIfNotAlreadyInCache (id, b64) {
  if (!isImgInLightboxCache(id)) {
    var slideShell = $(".swiper-slide").find("div[pid='"+id+"']");
    slideShell.html(renderLightboxElement(id,b64));
    setTimeout(function () { lbox.update(); }, 10);
  }
  $("#lightbox-spinner").removeClass("wait");
}

function renderLightboxElement(id,b64) {
  var element = '<img class="lightbox-photo" draggable="false" src="'+b64+'">';
  return element;
}

function getLightboxDownloadURL(pid, callback, forceOriginal) {
  callback = callback || noop;
  forceOriginal = forceOriginal || false;

  if (pid) {
    var lid = convertID(pid,"l");
    var origRef = rootRef.child(pid + ".crypteefile");

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
      $("#" + pid).addClass("is-loading");
    });
  }

  function useLightboxPreviewSize () {
    getThumbnailDownloadURL(lid).then(function(lightboxDownloadURL) {
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
///////////////     FAVORITES       ////////////////
////////////////////////////////////////////////////

// check to see if PID exists in this object, 
// and show the correct fav/unfav button
// in the lightbox

var favoritesObject = {};
var favoritesLoaded = false;
function gotFavorites(snapshot) {  
  favoritesLoaded = true;
  snapshot.docChanges().forEach(function(change) {
    if (change.type === "added") {
      favoritesObject[change.doc.id] = change.doc.data();
    }
    if (change.type === "removed") {
      delete favoritesObject[change.doc.id];
    }
  });
}

function toggleFav() {
  // toggle fav for activePID.
  if (favoritesObject[activePID]) {
    // remove from fav
    $("#lightbox-fav").removeClass("fav");
    removeFromFavorites(activePID);
  } else {
    // add to fav
    $("#lightbox-fav").addClass("fav");
    addToFavorites(activePID);
  }
}

function setFavoriteButtonState() {
  if (favoritesObject[activePID]) {
    // it's in favs
    $("#lightbox-fav").addClass("fav");
  } else {
    // not in favs
    $("#lightbox-fav").removeClass("fav");
  }
}

function addToFavorites(id, callback) {
  callback = callback || noop;
  var originalAlbumRef, favAlbumRef;
  if (activeFID === "home") {
    originalAlbumRef = homeRef.doc(id);
  } else {
    originalAlbumRef = homeRef.doc(activeFID).collection("photos").doc(id);
  }

  favAlbumRef = favRef.doc(id);
  
  originalAlbumRef.get().then(function(photo) {
    if (photo.data()) {
      favAlbumRef.set(photo.data(), { merge: true }).then(function() {
        callback();
      });
    } else {
      callback();
    }
  });
}

function removeFromFavorites(id, callback) {
  callback = callback || noop;
  var favAlbumRef = favRef.doc(id);
  favAlbumRef.delete().then(function() {
    callback();
  });

  if (activeFID === "favorites") {
    if ($("#lightbox-modal").hasClass("is-active")) {
      var slideIndex = getSlideIndex(id);
      lbox.removeSlide(slideIndex);
      if (lbox.slides.length <= 0) {
        closeLightbox();
        getHomeFolder();
      }
    }

    delete activeItemsObject[id];
    $("#" + id).remove();
  }
}




////////////////////////////////////////////////////
////////////////     SEARCH       //////////////////
////////////////////////////////////////////////////

var titlesIndexReady = false;
var firstSearchInit = false;
var searchArray = [];
var titlesIndex = {};
var allFoldersArray = [];
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
    prepareTitlesSearchIndex();
  } else {
    if (didAnyTitlesObjectChange) {
      prepareTitlesSearchIndex();
    } else {
      titlesIndexReady = true;
    }
  }
  lastActivityTime = (new Date()).getTime();
});

function prepareTitlesSearchIndex (callback,callbackParam) {
  callback = callback || noop;

  /// prevent an early click initiating prepareTitlesSearchIndex – so check user id
  /// I think some users have an issue with the initial animation
  /// which exposes the search bar and people click quickly.

  if (theUserID) {
    //   get all titles.
    searchArray = [];
    titlesIndex = {};
    titlesIndex.photos = {};
    titlesIndex.folders = {};
    $("#search-bar").find(".button").addClass("is-loading");
    titlesRef.get().then(function(titles) {
      var howManyFolders = titles.docs.length;
      var currentFolderIndex = 0;

      if (howManyFolders >= 1) {
        titles.docs.forEach(function(titleObject){
          var titlesOfFolder = titleObject.data().titles;
          var fid = titleObject.id;
          if (titlesOfFolder && fid !== "favorites") {

            var encryptedTitlesObject = JSON.parse(titlesOfFolder).data;
            decrypt(encryptedTitlesObject, [theKey]).then(function(plaintext) {
              currentFolderIndex++;
              var titlesObject = JSON.parse(plaintext.data);

              var fname = titlesObject.self || 'Home';
              var parsedFoldername = fname;
              try { parsedFoldername = JSON.parse(fname); } catch (e) {}
              titlesIndex.folders[fid] = parsedFoldername;

              $.each(titlesObject.photos, function(pid, ptitle) {
                var theParsedFilename = ptitle;
                try { theParsedFilename = JSON.parse(ptitle); } catch (e) {}
                searchArray.push({fid:fid, pid:pid, fname:fname, name:theParsedFilename});
                titlesIndex.photos[pid] = theParsedFilename;
              });

              if (currentFolderIndex === howManyFolders) {
                donePreparingTitlesSearchIndex(callback, callbackParam);
              }
            });

          } else { 
            currentFolderIndex++;
            
            if (currentFolderIndex === howManyFolders) {
              donePreparingTitlesSearchIndex(callback, callbackParam);
            }
          }

          if (fid !== "home" && fid !== "favorites") {
            allFoldersArray.push(fid);
          }
        });
      } else {
        donePreparingTitlesSearchIndex(callback, callbackParam);
      }

    }).catch(function(error) {
      donePreparingTitlesSearchIndex(callback, callbackParam);
      console.error("Error getting titles of all folders", error);
      handleError("Error getting photo & album titles for search", error);
    });
  } else {
    callback(callbackParam);
  }
}

function donePreparingTitlesSearchIndex(callback, callbackParam) {
  callback = callback || noop;
  $("#search-bar").find(".button").removeClass("is-loading");
  didAnyTitlesObjectChange = false;
  titlesIndexReady = true;
  callback(callbackParam);
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
    } else if (event.keyCode === 9) {
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

        $("#search-bar").find(".button").addClass("is-loading");
        searchKeyDownTimer = setTimeout(function () {
          search($("#search-input").val().trim());
        }, 700);
      }
    }
  },50);

});



function search (term) {
  if (titlesIndexReady) {
    $("#search-button-icon").addClass("fa-close").removeClass("fa-search");

    syntacticSearch(term, function(results, understood){
      displaySyntacticSearchResults(results, understood);
    }, function(){
      if (term.trim() !== "") {
        var results = searchTitles(term);
        displayTitleSearchResults(results,term);
      } 
    });

  } else {
    setTimeout(function () {
      search (term);
    }, 10);
  }
  lastActivityTime = (new Date()).getTime();
}

function searchTitles(term) {
  var fuse = new Fuse(searchArray, searchOptions);
  var results = fuse.search(term);
  return results;
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
function displayTitleSearchResults (results,term) {
  $("#photos-search-contents").html("");
  var resultsToAppend = [];
  searchResultsPhotosToDownload = [];
  var resultFolders = {};

  $.each(results, function(i, rslt) {
    
    if (searchResultsPhotosToDownload.length <= 80) { // limits search results to max 80 so that it's divisible by 4, and it's 20 rows
      var result = rslt.item;
      var resultTitle = result.name;
      var resultFTitle = result.fname;
      var resultFID = result.fid;
      var resultPID = result.pid;
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
        }
      });

      if (matchesPhotoName) {
        resultsToAppend.push(renderSearchResultPhoto(resultPID, resultFID, resultTitle, resultFTitle));
        searchResultsPhotosToDownload.push(resultPID);
      }

    } else {
      return false;
    }

  });
  
  appendAndOrderSearchResults(resultFolders, resultsToAppend, '"'+term+'"');

  showSearch();

  searchTimer = setTimeout(function () {
    $.each(searchResultsPhotosToDownload, function(i, pid) {
      getThumbnail(pid);
    });

  }, 250);

}



function displaySyntacticSearchResults(results, understood) {
  $("#photos-search-contents").html("");
  understood = understood || "";
  var resultsToAppend = [];
  searchResultsPhotosToDownload = [];
  var resultFolders = {};

  $.each(results, function(i, result) {
    if (searchResultsPhotosToDownload.length <= 80) { // limits search results to max 80 so that it's divisible by 4, and it's 20 rows

      var resultPID;
      if (result.id.startsWith("p-")) {
        resultPID = result.id;
        
        var resultTitle = result.name;
        var resultFTitle = result.fname;
        var resultFID = result.fid;
        var resultDate = result.date;
        
        resultFolders[resultFID] = resultFolders[resultFID] || {};
        resultFolders[resultFID].photos = resultFolders[resultFID].photos || [];
        resultFolders[resultFID].photos.push(resultPID);
        resultFolders[resultFID].title = resultFTitle;
        resultFolders[resultFID].fid = resultFID;
        
        resultsToAppend.push(renderSearchResultPhoto(resultPID, resultFID, resultTitle, resultFTitle,resultDate));
        searchResultsPhotosToDownload.push(resultPID);
      }

    } else {
      return false;
    }
  });

  appendAndOrderSearchResults(resultFolders, resultsToAppend, understood, true);

  showSearch();

  searchTimer = setTimeout(function () {
    $.each(searchResultsPhotosToDownload, function(i, pid) {
      getThumbnail(pid);
    });
  }, 250);

}


function appendAndOrderSearchResults(folderResults, photoResults, understood,sort) {
  understood = understood || "";
  
  //folders first
  var numFolderResults = Object.keys(folderResults).length;
  var numPhotosResults = photoResults.length;

  var folderResultsHTML = prepareSearchResultFoldersForRender(folderResults);
  var photoResultsHTML = photoResults.join("");

  var understoodHTML = "<span class='understood'>"+understood+"</span>";

  if (numFolderResults < numPhotosResults) {  
    // folders first, photos next
    if (numFolderResults > 0) { appendFolderSearchResults(); }
    if (numPhotosResults > 0) { appendPhotoSearchResults(); }
  } else {
    // photos first, folders next
    if (numPhotosResults > 0) { appendPhotoSearchResults(); }
    if (numFolderResults > 0) { appendFolderSearchResults(); }
  }

  if (numFolderResults <= 0 && numPhotosResults <= 0) {
    appendNoResults();
  }

  $("#search-bar").find(".button").removeClass("is-loading");

  function appendNoResults() {
    $("#photos-search-contents").append("<div class='sr-empty'>NO RESULTS FOUND FOR: " + understoodHTML + "</div>");
    setTimeout(function () {
      $(".sr-empty").addClass("shown");
    }, 250);
  }

  function appendFolderSearchResults() {
    $("#photos-search-contents").append("<div class='sr-divider'>ALBUMS <b>("+numFolderResults+")</b> " + understoodHTML + "</div>");
    $("#photos-search-contents").append(folderResultsHTML);
  }

  function appendPhotoSearchResults() {
    $("#photos-search-contents").append("<div class='sr-divider'>PHOTOS <b>("+numPhotosResults+")</b> " + understoodHTML + "</div>");
    $("#photos-search-contents").append(photoResultsHTML);
    if (sort) {
      $('.photos-search-result').sort(function(a, b) {
        var at = ($(a).attr("ptitle") || "").toUpperCase();
        var bt = ($(b).attr("ptitle") || "").toUpperCase();
        if (at < bt) { return -1; } else { return 1; }
      }).appendTo('#photos-search-contents');
    }
  }
}


function renderSearchResultPhoto(pid, fid, ptitle, ftitle, date) {
  ptitle = ptitle || "";
  ptitle = ptitle.replace(".jpg", "").replace(".png", "").replace(".jpeg", "").replace(".JPG", "").replace(".PNG", "").replace(".JPEG", "");

  var dateElement = ""; 

  if (date) {
    dateElement = '<p class="subtitle is-6 sr-date">' + date + '</p>';
  }
  
  var photo =
  '<div class="column is-3 photos-search-result sr-'+pid+'" fid="'+fid+'" pid="'+pid+'" ptitle="'+ptitle+'" id="sr-'+pid+'">'+
  '  <div class="photos-sr-photo image is-loading" pid="'+pid+'">'+
  '     <img src="" class="srimg" pid="'+pid+'">'+
  '  </div>'+
  '  <p class="title is-5 photos-sr-photo">'+ptitle+'</p>'+
  '  <p class="subtitle is-6 photos-sr-folder">'+ftitle+'</p>'+
      dateElement +
  '</div>';

  return photo;
}

function renderSearchResultFolder(srfolder, date) {
  var fid = srfolder.fid;
  var ftitle = srfolder.title;
  var photosText = "Photos";
  var numPhotos = srfolder.photos.length;
  if (numPhotos === 1) { photosText = "Photo"; }
  
  var dateElement = ""; 

  if (date) {
    dateElement = '<p class="subtitle is-6 sr-date">' + date + '</p>';
  }
  
  var folder =
  '<div class="column is-half-tablet is-full-mobile photos-search-result-folder sr-'+fid+'" fid="'+fid+'" ftitle="'+ftitle+'" id="sr-'+fid+'">'+
    '<div class="sr-folder-images">'+
      renderSearchResultFolderPhotos(srfolder.photos) +
    '</div>'+
  '  <p class="title is-5 photos-sr-folder">'+ftitle+'</p>'+
  '  <p class="subtitle is-6">('+numPhotos+' ' +photosText+')</p>'+
      dateElement +
  '</div>';

  return folder;
}

function renderSearchResultFolderPhotos(photos) {
  var foldersPhotos = [];
  $.each(photos, function(i, pid) {
    if (i <= 3) { // 4 photos is good
      var photo =
      '  <div class="sr-folder-photo image is-loading" pid="'+pid+'">'+
      '     <img src="" class="srimg" pid="'+pid+'">'+
      '  </div>';
      foldersPhotos.push(photo);
      searchResultsPhotosToDownload.push(pid);
    }
  });

  return foldersPhotos.join("");
}

function prepareSearchResultFoldersForRender(folders) {
  var folderResultsToAppend = [];
  $.each(folders, function(i, folder) {
    folderResultsToAppend.push(renderSearchResultFolder(folder));
  });
  return folderResultsToAppend.join("");
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

if (isInWebAppiOS) {
  $("#photos-download-sel-modal-toggle-button").hide();
} else {
  $("#photos-download-sel-modal-toggle-button").show();
}

var downloadQueue = [];
function downloadSelections () {
  if (didAnyTitlesObjectChange || !titlesIndexReady) {
    prepareTitlesSearchIndex(function(){
      prepareDownloadQueue();
    });
  } else {
    prepareDownloadQueue();
  }

  function prepareDownloadQueue() {
    $.each(selectionsObject, function(pid) {
      downloadQueue.push({
        "filename" : titlesIndex.photos[pid],
        "pid" : pid
      });
    });
  
    if (!$("#photos-download-modal").hasClass("active")){
      $("#photos-downloading-status").html("DOWNLOAD PHOTOS");
      $("#photos-download-modal").addClass("active");
    } else {
      $("#photos-download-modal").addClass("flash");
      setTimeout(function () {
        $("#photos-download-modal").removeClass("flash");
      }, 501);
    }
  }
}

$("#folder-contents").on("click", '.downloadfoldericon', function(event){
  event.stopPropagation(); event.preventDefault();
  var fid = $(this).parents(".albumitem").attr("id");
  fidToDelete = fid;
  downloadFolder(fid);
});

function downloadFolder(fid) {
  $("#" + fid).find(".album").addClass("is-loading");
  
  if (didAnyTitlesObjectChange || !titlesIndexReady) {
    prepareTitlesSearchIndex(function(){
      prepareDownloadQueue();
    });
  } else {
    prepareDownloadQueue();
  }
  
  function prepareDownloadQueue() {
    
    $("#" + fid).find(".album").removeClass("is-loading");

    getPIDsOfFolder(fid, function(pids){
    
      pids.forEach(function(pid){
        downloadQueue.push({
          "filename" : titlesIndex.photos[pid],
          "pid" : pid
        });
      }); 

      if (!$("#photos-download-modal").hasClass("active")){
        $("#photos-downloading-status").html("DOWNLOAD PHOTOS");
        $("#photos-download-modal").addClass("active");
      } else {
        $("#photos-download-modal").addClass("flash");
        setTimeout(function () {
          $("#photos-download-modal").removeClass("flash");
        }, 501);
      }
    
    }); 
  }
}

function runDownloadQueue(index) {
  if (index === 0) {
    $("#photos-download-modal").addClass("downloading");
  }
  
  if (downloadQueue[index]) {
    $("#photos-downloading-status").html("DOWNLOADING (" + index + "/" + downloadQueue.length + ")");
    $("#photos-download-modal").find("progress").attr("max", downloadQueue.length);
    $("#photos-download-modal").find("progress").attr("value", index);
    
    var nextInLine = index + 1;
    downloadPhotoForBulkDownload(downloadQueue[index].pid, downloadQueue[index].filename, function(){
      runDownloadQueue(nextInLine);
    });
  } else {
    // downloads complete, clear queue.
    $("#photos-download-modal").removeClass("active downloading");
    $("#photos-downloading-status").html("DOWNLOAD PHOTOS");
    $("#photos-download-modal").find("progress").attr("value", 0);
    downloadQueue = [];
  }
}

function downloadPhotoForBulkDownload(pid, filename, callback, callbackParam) {
  callback = callback || noop;
  rootRef.child(pid + ".crypteefile").getDownloadURL().then(function(dldURL) {
    gotURL(dldURL);
  }).catch(function(error) { 
    err("Error getting Photo URL for bulk download.", error); 
  });

  function gotURL(downloadURL) {
    $.ajax({ url: downloadURL, type: 'GET',
      success: function(encryptedPhoto){ 
        gotEncryptedPhoto(encryptedPhoto); 
      },
      error:function (xhr, ajaxOptions, thrownError){ 
        err("Error downloading photo during bulk download.", thrownError); 
      }
    });
  }

  function gotEncryptedPhoto(encryptedPhoto) {
    var encryptedB64 = JSON.parse(encryptedPhoto).data;
    decrypt(encryptedB64, [theKey]).then(function(plaintext) {
      var decryptedPhoto = plaintext.data;
      downloadPhotoToDisk(pid, filename, decryptedPhoto, callback, callbackParam);
    }).catch(function (error) {
      err("Error decrypting photo during bulk download."); 
    });
  }

  function err(msg, err) {
    err = err || {};
    err.pid = pid;
    handleError(msg, err);
    callback(callbackParam); // something didn't work, sadly skip and continue. 
  } 
}

function downloadPhotoToDisk (pid, ptitle, decryptedPhoto, callback, callbackParam) {
  callback = callback || noop;
  if (ptitle === ".jpg" || ptitle === undefined || ptitle === null || ptitle === "" || ptitle === " ") {
    ptitle = "Photo.jpg";
  }
  saveAs(dataURIToBlob(decryptedPhoto), ptitle);
  $("#"+pid).removeClass("is-loading");
  $("#lightbox-download").removeClass("is-loading");
  callback(callbackParam);
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
      reflectFolderDateChange(fid, dateToSet);
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

function reflectFolderDateChange(fid, exifDate) {
  var date = fancyDate(exifDate) || "";
  var sortableDate = sortableExifDate(exifDate) || "";
  if (date) {
    date = date.replace("&#39;", "'");
    $("#" + fid).attr("date", date);
  }

  if (sortableDate) {
    $("#" + fid).attr("datesort", sortableDate);
  }
}






































//
