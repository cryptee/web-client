////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 UI
////////////////////////////////////////////////
////////////////////////////////////////////////

var sorterShown = false;
function showSorter() {
    if (!sorterShown) {
        $("#sorter").addClass("shown");
        sorterShown = true;
    }
}

// hook this up to scroll, click to album contents, and a few other things. 
// (or when user clicks outside this etc)

function hideSorter() {
    if (sorterShown) {
        $("#sorter").removeClass("shown");
        sorterShown = false;
    }
}



function stopMainProgress() {
    $("#main-progress").attr("value", 100);
    $("#main-progress").attr("max", 100);

    $("body").removeClass("loading");
    $("body").removeClass("searching");

    $("#albumContents").removeClass("loading");
    $("#searchContents").removeClass("loading");
}

function stopMainProgressforSearch() {
    $("#main-progress").attr("value", 100);
    $("#main-progress").attr("max", 100);

    $("body").removeClass("loading");
    $("#searchContents").removeClass("loading");
}

/**
 * Start Main View Progress (optionally NOT fade the contents if it's a small action that doesn't require fading contents)
 * @param {boolean} contentsShouldntFade if set to true, this won't fade the contents on the screen, and simply run the progress bar
 * @param {boolean} keepSearch if this is a search loading progress, this keeps the search bar usable.
 */
function startMainProgress(contentsShouldntFade, keepSearch) {
    contentsShouldntFade = contentsShouldntFade || false;
    keepSearch = keepSearch || false;
    $("#main-progress").removeAttr("max");
    $("#main-progress").removeAttr("value");
    $("body").addClass("loading");

    if (keepSearch) { $("body").addClass("searching"); }

    if (contentsShouldntFade) { return; }

    $("#albumContents").addClass("loading");
    $("#searchContents").addClass("loading");
}

function startLightboxProgress() {
    startProgressWithID("lightbox-progress");
}

var stopLightboxProgressTimeout;
function stopLightboxProgress() {
    clearTimeout(stopLightboxProgressTimeout);
    stopLightboxProgressTimeout = setTimeout(function () {
        stopProgressWithID("lightbox-progress");
    }, 300);
}


/**
 * Starts tagging photos progress & disables tag button and input
 */
function startTaggingPhotosProgress() {
    $("#add-tags-button").addClass("loading");
    $("#photos-tags-input").attr("disabled", true);
    startProgressWithID("progress-tagging-photos");
}

function startTaggingPhotosLoadingProgress() {
    startTaggingPhotosProgress();
    $("#tags-highlighter").addClass("loading");
}

/**
 * Stops tagging photos progress & enables tag button and input
 */
function stopTaggingPhotosProgress() {
    $("#add-tags-button").removeClass("loading");
    $("#tags-highlighter").removeClass("loading");
    $("#photos-tags-input").removeAttr("disabled");

    stopProgressWithID("progress-tagging-photos");

    $("#progress-tagging-photos").attr("value", 100);
    $("#progress-tagging-photos").attr("max", 100);
}







$(".contents").on('click', '.photo', function(event) {
    var photoID = $(this).attr("id");
    var shifted = event.shiftKey;

    if (event.target.tagName.toUpperCase() !== "I" && !$("body").hasClass("nav-selection") && !$("body").hasClass("searching")) {
        loadPhoto(photoID);
    } else if ($("body").hasClass("searching")) {
        loadSearchResult(photoID);
    } else {
        if (!shifted) {
            togglePhotoSelection(photoID);
        } else {
            shiftSelectedPhoto(photoID);
        }
    }

    activityHappened();
}); 


$(".contents").on('click', '.album', function(event) {
    var albumID = $(this).attr("id");
    
    if (event.target.tagName.toUpperCase() === "I") {
        showEditAlbumPopup(albumID);
    } else {
        hideAllPopups();
        loadAlbum(albumID);
    }
    
    activityHappened();
}); 

// right click on album opens context menu
$("#albumContents").on('contextmenu', '.album', function(event) {
    event.preventDefault();

    var albumID = $(this).attr("id");
    showEditAlbumPopup(albumID);
    activityHappened();

    return false;
}); 



$("#gallery-button").on('click', function(event) {
    loadAlbum("home");
    hideAllPopups();
    activityHappened();
}); 

$("#favorites-button").on('click', function(event) {
    loadFavorites();
    hideAllPopups();
    activityHappened();
}); 

////////////////////////////////////////////////
////////////////////////////////////////////////
//	KEYBOARD SHORTCUTS
////////////////////////////////////////////////
////////////////////////////////////////////////

key('command+A, ctrl+A', function () {
    if (!$("input").is(":focus")) {
        selectAll();
        return false;
    }
});

key('command+F, ctrl+F', function () {
    $("#searchInput").trigger("focus");
    return false;
});

key('esc', function () {
    // clearing search also scrolls up. 
    // and we may be using lightbox in search results (albeit very unlikely)
    // so, this guarantees that if we press escape, and lightbox is visible, we won't clear search / scroll.
    if (!$("#lightbox").hasClass("show")) {
        clearSearch();
    } else {
        closeLightbox();
    }
    
    hideAllPopups();
    clearSelections();
    activityHappened();
    hideSorter();
    hideTagsPanel();
    return false;
});

var keyScrolling = false;
var keyScrollThrottleSpeed = 500; 
if (isSafari) { keyScrollThrottleSpeed = 1000; }

key('down', function() {
    activityHappened();
    if (keyScrolling) { return false; }
    keyScrolling = true;
    scrollVerticalTo(0 - $("#albumContents").offset().top + 512);
    setTimeout(function () { keyScrolling = false; }, keyScrollThrottleSpeed);
    return false;
});

key('up', function() {
    activityHappened();
    if (keyScrolling) { return false; }
    keyScrolling = true;
    scrollVerticalTo(0 - $("#albumContents").offset().top - 512);
    setTimeout(function () { keyScrolling = false; }, keyScrollThrottleSpeed);
    return false;
});

key('shift + down', function() {
    activityHappened();
    if (keyScrolling) { return false; }
    keyScrolling = true;
    scrollVerticalTo(0 - $("#albumContents").offset().top + 1024);
    setTimeout(function () { keyScrolling = false; }, keyScrollThrottleSpeed);
    return false;
});

key('shift + up', function() {
    activityHappened();
    if (keyScrolling) { return false; }
    keyScrolling = true;
    scrollVerticalTo(0 - $("#albumContents").offset().top - 1024);
    setTimeout(function () { keyScrolling = false; }, keyScrollThrottleSpeed);
    return false;
});


////////////////////////////////////////////////
////////////////////////////////////////////////
//	NAVBAR STATES 
////////////////////////////////////////////////
////////////////////////////////////////////////

function navbarForGallery() {
    $("body").addClass("nav-gallery");
}

function navbarForAlbum() {
    $("body").addClass("nav-album");
}

function navbarForFavorites() {
    $("body").addClass("nav-favorites");
}

function navbarForNoPhotos() {
    $("body").addClass("nav-nophotos");
}

function navbarForSelectionModeOn() {
    $("body").addClass("nav-selection");
}

function navbarForSelectionModeOff() {
    $("body").removeClass("nav-selection");
}

function resetNavbar() {
    $("body").removeClass("nav-album nav-gallery nav-nophotos nav-favorites");
}

if (!isTouch && !isipados) {
    $("#delete-button").on('mouseenter', function(event) {
        $("body").addClass("highlight-deletions");
    }); 
    
    $("#delete-button").on('mouseleave', function(event) {
        $("body").removeClass("highlight-deletions");
    });
}








////////////////////////////////////////////////
////////////////////////////////////////////////
//	HELPERS
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * 
 * @param {string} id A media ID (i.e. t-12345)
 * @param {('p'|'t'|'l'|'v'|'r')} type A media type (i.e. "l" for lightbox)
 * @returns {string} convertedID the new, converted media ID 
 */
function convertID(id,type) {
    if (id) {
        var result = id
            .replace("p-", type + "-") // photo
            .replace("t-", type + "-") // thumb
            .replace("l-", type + "-") // lightbox
            .replace("v-", type + "-") // video
            .replace("r-", type + "-"); // RAW

        return result;
    } else {
        return null;
    }
}

/**
 * Takes a month number, returns a month name in english ( and potentially other languages in the future)
 * @param {number} exifDate the month number (i.e. 2 for February)
 * @returns {string} fancyMonthName ( Feb '20 )
 */
function fancyDate(exifDate) {
    var result = null;
    var year, month;

    if (!exifDate) {
        return result;
    }

    if (exifDate.includes(":")) {

        // Looks like not every camera manufacturer follows the standards. Some of these splits can throw undefined. [facepalm]

        try {
            year = exifDate.split(":")[0].slice(2, 4);
        } catch (e) {}

        try {
            month = exifDate.split(":")[1];
        } catch (e) {}

        if (year && month) {
            var monthName = (monthsShort[parseInt(month)] || "").toUpperCase();
            result = (monthName + " " + "&#39;" + year);
        }

    }

    return result;
}




/**
 * Extracts date from an EXIF date
 * @param {string} exifDateString an exif date
 */
function dateFromEXIF(exifDateString) {
    var result = "";
    try {
        if (exifDateString.split(' ')[0]) {
            result = exifDateString.split(' ')[0];
        }
    } catch (e) {}

    return result;
}
  


/**
 * Takes an exif date string, and returns a year
 * @param {string} dateString an exif date string
 * @returns {string} year
 */
function yearFromEXIF(dateString) {
    var year = "0000";
    if (dateString) {
        if (dateString.indexOf(":") !== -1) {
            // Looks like not every camera manufacturer follows the standards. Some of these splits can throw undefined. [facepalm]
            try {
                year = dateString.split(":")[0] || "0000";
            } catch (e) {}
        }
    }
    return year;
}


/**
 * Takes an exif date string, and returns a month
 * @param {string} dateString an exif date string
 * @returns {string} month
 */
function monthFromEXIF(dateString) {
    var month = "00";
    if (dateString) {
        if (dateString.indexOf(":") !== -1) {
            // Looks like not every camera manufacturer follows the standards. Some of these splits can throw undefined. [facepalm]
            try {
                month = dateString.split(":")[1] || "00";
            } catch (e) {}
        }
    }

    return month;
}



/**
 * Takes an exif date string, and returns a day
 * @param {string} dateString an exif date string
 * @returns {string} day
 */
function dayFromEXIF(dateString) {
    var day = "00";
    if (dateString) {
        if (dateString.indexOf(":") !== -1) {
            // Looks like not every camera manufacturer follows the standards. Some of these splits can throw undefined. [facepalm]
            try {
                day = dateString.split(":")[2].split(" ")[0] || "00";
            } catch (e) {}
        }
    }

    return day;
}



/**
 * Extracts time from an EXIF date
 * @param {string} exifDateString an exif date
 */
function timeFromEXIF(exifDateString) {
    var result = "";
    try {
        if (exifDateString.split(' ')[1]) {
            result = exifDateString.split(' ')[1];
        }
    } catch (e) {}

    return result;
}




/**
 * Takes an exif date string, and generates a sortable exif date string
 * @param {string} dateString an exif date string
 * @returns {string} sortableExifDate a sortable exif date string
 */
function sortableExifDate(dateString) {
    var result = "00000000";
    var year = "0000";
    var month = "00";
    var day = "00";
    var time = "000000";
    if (dateString) {
        if (dateString.indexOf(":") !== -1) {
            // Looks like not every camera manufacturer follows the standards. Some of these splits can throw undefined. [facepalm]
            year = yearFromEXIF(dateString);
            month = monthFromEXIF(dateString);
            day = dayFromEXIF(dateString);

            try {
                time = replaceAll(timeFromEXIF(dateString),":", "");
            } catch (e) {}

            result = year + "" + month + "" + day + "" + time;
        }
    }

    return result;
}










/**
 * Gets today's EXIF
 */
function todaysEXIF() {
    var today = new Date();
    var currentDay = today.getUTCDate();
    var currentMonth = today.getUTCMonth() + 1; // it's 0 based. jesus.
    var currentYear = today.getFullYear();
    return currentYear + ":" + ("0" + currentMonth).slice(-2) + ":" + ("0" + currentDay).slice(-2);
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




  
/**
 * Takes a PID and returns its extension from filename, i.e. "gif"
 * @param {string} pid A Photo ID
 * @returns {string} ext A photo extension (i.e. "gif")
 */
function extensionOfPhoto(pid) {
    if (!pid) { return ""; }
    
    var photo = photos[pid] || {};
    
    if (isEmpty(photo)) { return "jpg"; }

    var name = photo.decryptedTitle || "Untitled.jpg";
    
    return extensionFromFilename(name);
}






var useHighResThumbnails = false;
function doWeNeedHighResThumbs() {
    if ($(window).width() > 703) {
        useHighResThumbnails = true;
    }

    if (useHighResThumbnails) {
        console.log("[THUMBNAILS] High resolution screen detected. Will use high-res album thumbnails.");
    }
}

doWeNeedHighResThumbs();
  

/**
 * Checks the lightbox, and gets the active, currently visible photo's ID
 */
function activePhotoID() {
    return $(".swiper-slide-active.swiper-slide-visible").find(".swiper-zoom-container").attr("pid") || $(".swiper-slide-active.swiper-slide-visible").find("img").attr("pid") || null;
}

////////////////////////////////////////////////
////////////////////////////////////////////////
//	AUTH / STARTUP
////////////////////////////////////////////////
////////////////////////////////////////////////

checkConnection();

authenticate(function(user){
    // LOGGED IN
    preStartup();

    checkKey(); // rightKey will call startup();

}, function(){
    // NOT LOGGED IN
    location.href = "/login";
}, function(error) {
    // ERROR
    if (error.code === "auth/network-request-failed") {
        handleError("[HOME] Error Authenticating", error);
    }
    
    location.href = "/login";
});






////////////////////////////////////////////////
////////////////////////////////////////////////
// 
//	PRE-STARTUP
//
////////////////////////////////////////////////
////////////////////////////////////////////////

// LOADING ALBUMS / PHOTOS STARTS EVEN BEFORE WE START CHECKING FOR THE KEY
// WE PREPARE A LIST OF ALBUMS & PREP VIRTUAL DOM. THIS WAY WE CAN SAVE TIME DOWNLOADING
// ONCE IT'S DONE, WE SET THIS TO TRUE, AND STARTUP CONTINUES.

var preStartupComplete = false; 

async function preStartup() {
    
    var albumToLoad = getUrlParameter("album") || "home";

    await Promise.all([getAlbums(), getAlbumPhotos(albumToLoad), getAlbumPhotos("favorites")]);
    preStartupComplete = true; // ready for startup

    // load all albums' info (i.e. albumnames / dates etc)
    // await getAlbums();
    
    // load album's photos (or if we're home, loads all photos without albums)
    // await getAlbumPhotos(albumToLoad);

    // load all favorites
    // await getAlbumPhotos("favorites");

}


// ONCE THE KEY IS READY, (OR IF IT'S IN MEMORY) 
// rightKey will call startup for all apps.
// ON THAT SIGNAL WE PUSH THE VIRTUAL DOM TO REAL DOM

var startedUp = false;

async function startup() {

    var albumToLoad = getUrlParameter("album") || "home";

    // if we're still getting the album for the first time, wait before you load the album
    if (!preStartupComplete) { return setTimeout(startup, 100); }
    
    if (albumToLoad === "favorites" || albumToLoad === "favourites") {
        await loadFavorites();
    } else {
        await loadAlbum(albumToLoad);
    }

    breadcrumb('[STARTED UP]');

    $("body").removeClass("starting");
    activityHappened();
    checkAndWarnForExceededStorageIfNecessary();

}





var inactivityInterval;
if (inactivityTimeoutInMinutes && !memorizedKey) {
    inactivityInterval = setInterval(inactiveTimer, 1000);
}











////////////////////////////////////////////////
////////////////////////////////////////////////
//	SORTING
////////////////////////////////////////////////
////////////////////////////////////////////////

$(".sort-button").on('click', function(event) {
    if ($(this).hasClass("selected")) { 
        hideSorter();
        return; 
    }

    $(".sort-button").removeClass("selected");
    var sorttype = $(this).attr("type");
    sortThings(sorttype);
    hideSorter();
}); 

$("main").on('click', function(event) {
    hideSorter();
}); 



////////////////////////////////////////////////
////////////////////////////////////////////////
//	TIMELINE
////////////////////////////////////////////////
////////////////////////////////////////////////


$("#timeline").on('click', "small", function (event) {
    scrollWithTimeline($(this)[0], "smooth");
});


if (isTouch) {
    $("#timeline").on('touchmove', function(e) {
        thumbnailEntryTimeout = 750;
        $("main").addClass("scrolling");
        $("main").addClass("browsing");
        var fingerX = e.touches[0].pageX;
        var fingerY = e.touches[0].pageY;
        var label = document.elementFromPoint(fingerX, fingerY);
        scrollWithTimeline(label);
    });
    
    $("#timeline").on('touchend', function(e) {
        setTimeout(function () {
            $("main").removeClass("browsing");
            thumbnailEntryTimeout = 10;
        }, 250);
    });
}





////////////////////////////////////////////////
////////////////////////////////////////////////
//	FAVORITES
////////////////////////////////////////////////
////////////////////////////////////////////////


$("#lightbox-favorite").on('click', function(event) {
    var isFav = $("#lightbox-favorite").hasClass("fav");

    if (isFav) {
        unfavoritePhoto(activePhotoID());
        $("#lightbox-favorite").removeClass("fav");
    } else {
        favoritePhoto(activePhotoID());
        $("#lightbox-favorite").addClass("fav");
    }
}); 



////////////////////////////////////////////////
////////////////////////////////////////////////
//	SEARCH
////////////////////////////////////////////////
////////////////////////////////////////////////


$("#searchInput").on('keydown', function (event) {
    // set a unique search id to the searchContents
    
    event = event || {};
    
    activityHappened();
    
    setTimeout(function(){
        var searchID = newUUID(4); 
        $("#searchContents").attr("search", searchID);
        
        var searchTerm = $("#searchInput").val().trim();
        $("#searchContents").attr("term", searchTerm);
        

        if (event.key.startsWith("Arrow")) {
            event.preventDefault();
        } else if (event.key === "Meta" || event.key === "Shift") {
            event.preventDefault();
        } else if (event.key === "Alt" || event.key === "Control") {
            event.preventDefault();
        } else if (event.key === "CapsLock" || event.key === "Tab") {
            event.preventDefault();
        } else if (event.metaKey || event.ctrlKey || event.shiftKey) {
            event.preventDefault();
        } else if (event.key === "Escape" || searchTerm === "") {
            event.preventDefault();
            clearSearch();
            stopMainProgress();
        } else if (event.key === "Enter") {
            $("#searchInput").trigger("blur");
        } else {
            
            startMainProgress(false, true);

            clearTimeout(searchTimer);
            clearTimeout(searchKeydownTimer);
            searchKeydownTimer = setTimeout(function () { 
                
                search(searchTerm, searchID); 
                
            }, 700);
            
        }
        
    },50);
});




////////////////////////////////////////////////
////////////////////////////////////////////////
//	SHOW ALBUM COVER POPUP
////////////////////////////////////////////////
////////////////////////////////////////////////

function showChangeCoverPopup() {
    createPopup("to change an album's cover photo, first open the album and select the photo you'd like to use for the cover by pressing the check-mark over the photo. Once the photo is selected, press 'make album cover' on the top menu.", "info");
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	TAGS / TAGS HIGHLIGHTER
////////////////////////////////////////////////
////////////////////////////////////////////////

$("#photos-tags-input").on('keydown keypress paste copy cut change', function(event) {
    
    if (event.key === "Enter") { event.preventDefault(); return false; }
    if (event.key === "Escape") { 
        event.preventDefault(); 
        hideTagsPanel();
        return false; 
    }

    setTimeout(function () {

        var userInput = $("#photos-tags-input").val();
        
        // remove newlines (i.e. if user pastes them)
        if (userInput.includes("\r") || userInput.includes("\n")) {
            userInput = userInput.replace(/[\r\n]/g, '');
            
            // remove newlines from the text input
            $("#photos-tags-input").val(userInput);
        }

        // remove html entities (i.e. if user pastes them)
        userInput = stripHTMLEntities(userInput);
            
        // remove html entities from the text input
        $("#photos-tags-input").val(userInput);

        // remove all characters after 100th
        if (userInput.length > 100) {    
            userInput = userInput.substring(0,100);    
            $("#photos-tags-input").val(userInput);
        }
        
        // get tags
        var tags = extractHashtags(userInput);

        // highlight each tag in the highlighter
        tags.forEach(tag => { userInput = replaceAll(userInput, tag, `<i>${tag}</i>`); });
        $("#tags-highlighter").html(userInput);

    }, 10);

}); 

function showTagsPanel() {
    $("body").addClass("tagging");
    $("#tags-highlighter").empty();
    $("#photos-tags-input").val("");
    $("#panel-add-tags").addClass("show");

    var photosToTag = selectedPhotos();

    if (photosToTag.length === 1) {
        // if only one photo is selected, load its tags into the editor.
        loadTagsOfPhoto(photosToTag[0]);
    } else if (photosToTag.length > 1) {
        // if more than one photo is selected, don't bother loading tags, focus the editor instead
        setTimeout(function () { $("#photos-tags-input").trigger("focus"); }, 100);
    } else {

        // if no photos are selected, then show alert
        createPopup("In order to tag photos, please select at least one photo to tag by pressing the checkmark icons on photos.", "warning");
    }

}

function hideTagsPanel() {
    $("body").removeClass("tagging");
    $("#panel-add-tags").removeClass("show");
    $("#photos-tags-input").trigger("blur");
    setTimeout(function () { // for cosmetics
        $("#tags-highlighter").empty();
        $("#photos-tags-input").val("");
    }, 200);
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	EDIT PHOTO / DESCRIPTION / TAGS / DATE
////////////////////////////////////////////////
////////////////////////////////////////////////

$("#photos-desc").on('keydown', function(event) {
    
    event = event || {};
    
    activityHappened();
    
    setTimeout(function(){
    
        if (event.key === "Escape") {
            event.preventDefault();
            $("#photo-desc").trigger("blur");
        }
        
    },50);

}); 