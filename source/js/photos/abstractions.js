////////////////////////////////////////////////
////////////////////////////////////////////////
//	LOADERS
////////////////////////////////////////////////
////////////////////////////////////////////////

var albums = {};
var photos = {};
var favorites = {};
var activeAlbumID = "";

// HERE WE'LL LOAD THINGS (I.E. LOAD AN ALBUM / PHOTO)
// THIS DOESN'T MEAN "DOWNLOAD"
// THIS MEANS LOAD WHAT'S ALREADY DOWNLOADED (OR CALL A GETTER IF NECESSARY TO DOWNLOAD)

/**
 * Preparations before loading an album or favorites
 */
function prepBeforeLoadingAlbumOrFavorites() {
    startMainProgress();

    hideSorter();
    hideAlbumDropdownsExcept();
    clearSelections();
    clearSearch();

    // clear existing album contents
    $("#albumContents").empty();

    // remove all lightbox events to stop thousands of slideChange events from triggering.
    // and remove all slides from lightbox 
    try { lightbox.off('slideChange'); } catch (e) {}
    lbox.removeAllSlides(); 

    // clear timeline
    clearTimeline(true);
    
    // scroll to top
    scrollTop();
}

/**
 * Loads an album with given Album ID, and displays its photos
 * @param {string} aid Album ID
 */
async function loadAlbum(aid) {
    
    if (activeAlbumID === aid) { 
        breadcrumb('[LOAD ALBUMS] Already in this album ('+aid+').');
        clearSearch();
        stopMainProgress();
        return; 
    }

    prepBeforeLoadingAlbumOrFavorites();

    // if we haven't started up yet, we skip this, since this will come from prestartup
    // we'll set "startedUp" to true once loadAlbum is complete for the first time.
    if (startedUp) {

        if (aid === "home") { 
            // if we did start up, and if we're just navigating back to gallery, get a fresh set of all albums. 
            await getAlbums(); 
        } 

        // if we did start up, get a fresh set of the album's photos. (or if 'home', get all photos without albums)
        await getAlbumPhotos(aid);

    }

    // decrypt the album's titles, and add them to the albums object

    // – if we haven't started up, this means we have encrypted titles in memory, and we should decrypt them now. 
    // – if we did start up, get a fresh set of titles & decrypt (if we're not loading home) 
    // – getAlbums will already decrypt home's titles. So do this only when we're not loading home.
    if (!startedUp || aid !== "home") {
        await decryptAlbumTitles(aid);
    }
    
    // we haven't started up, and the url has an album's ID = we're loading in straight to the album. 
    // this means we'll need this album's name to display in the header, and the only way to get it is if we decrypt home's titles.
    // this won't be decrypted in getAlbums if we haven't started up (because getAlbums is called in pre-startup, without the keys.)

    if (!startedUp && aid !== "home") {
        await decryptAlbumTitles("home");
    }

    activeAlbumID = aid;
    albums = albums || {};
    albums[activeAlbumID] = albums[activeAlbumID] || {};

    // get the sort of the album, and get a sorted array with everything in the album
    var albumSort = albums[activeAlbumID].sort || "date-desc";
    var sortedAlbumContents = getSortedActiveAlbumContents(albumSort);

    // now go through the sorted array, render items and add to DOM
    var albumContentsHTML = [];
    var lightboxContentsHTML = [];

    // if it's not home or favorites, add header
    if (aid !== "home") {
        var albumHeaderHTML = renderAlbumHeader(aid);
        albumContentsHTML.push(albumHeaderHTML);
    }

    sortedAlbumContents.forEach(item => {
        var id = item[0];
        if (id !== "home" && id.startsWith("f-")) {
            var albumHTML = renderAlbum(id);
            albumContentsHTML.push(albumHTML);
            addToTimeline(item);
        }

        if (id.startsWith("p-")) {
            var photoHTML = renderPhoto(id);
            albumContentsHTML.push(photoHTML);
            
            addToTimeline(item);
            
            lightboxContentsHTML.push(`<div class='swiper-zoom-container' pid='${id}'><img class="lbox-photo" pid='${id}' draggable='false' src=""/></div>`);
        }
    });

    $("#albumContents").append(albumContentsHTML.join(""));

    lbox.appendSlide(lightboxContentsHTML);
    lbox.update();

    // now that all slides are in the lightbox, start listening for slideChange again.
    lightbox.on('slideChange', lightboxPhotoChanged);

    // PREPARE NAVBAR 

    resetNavbar();

    if (activeAlbumID === "home") {
        navbarForGallery();
    } else {
        navbarForAlbum();
    }

    var numberOfPhotosInAlbum = (albums[activeAlbumID].photos || []).length || 0;
    if (numberOfPhotosInAlbum <= 0) {
        navbarForNoPhotos();
    }




    /// Once everything's added to DOM, add their intersection observers. and draw timeline
    setTimeout(function () {
        drawTimeline(albumSort);
    }, 10);
    
    setTimeout(function () { 
        $("#albumContents").children().each(function () {
            setupIntersectionObserver (this);
        });
    }, 500);
    
    setTimeout(function () { 
        $("#albumContents").removeClass("loading");
        updateTimelineWithItemsOnScreen(); 
    }, 1000);
    

    


    
    
    

    // STOP PROGRESS
    stopMainProgress();
    startedUp = true;






    if (!isios && !isipados) {
        if (activeAlbumID === "home") {
            history.pushState("home", null, '/photos');
        } else {
            history.pushState(activeAlbumID, null, '/photos?album='+activeAlbumID);
        }
    }
}







/**
 * Loads user's favorite photos
 */
async function loadFavorites() {

    if (activeAlbumID === "favorites") { 
        breadcrumb('[LOAD FAVORITES] Already in favorites');
        return; 
    }

    prepBeforeLoadingAlbumOrFavorites();

    if (!favorites) {
        try {
            await getAlbumPhotos("favorites");
        } catch (error) {
            handleError("[ALBUM PHOTOS] Error getting favorites", error);
        }
    }

    activeAlbumID = "favorites";

    var albumContents = Object.keys(favorites);
    // now go through the array, render items and add to DOM
    var albumContentsHTML = [];
    var lightboxContentsHTML = [];

    var albumHeaderHTML = renderAlbumHeader("favorites");
    albumContentsHTML.push(albumHeaderHTML);

    albumContents.forEach(pid => {
        var photoHTML = renderPhoto(pid);
        albumContentsHTML.push(photoHTML);
        lightboxContentsHTML.push(`<div class='swiper-zoom-container' pid='${pid}'><img class="lbox-photo" pid='${pid}' draggable='false' src=""/></div>`);
    });

    $("#albumContents").append(albumContentsHTML.join(""));

    lbox.appendSlide(lightboxContentsHTML);
    lbox.update();

    // now that all slides are in the lightbox, start listening for slideChange again.
    lightbox.on('slideChange', lightboxPhotoChanged);

    resetNavbar();
    navbarForFavorites();

    var numberOfPhotosInAlbum = albumContents.length || 0;
    if (numberOfPhotosInAlbum <= 0) {
        navbarForNoPhotos();
    }

    // Once everything's added to DOM, add their intersection observers. 
    
    setTimeout(function () { 
        $("#albumContents").children().each(function () {
            setupIntersectionObserver (this);
        });

        $("#albumContents").removeClass("loading");
    }, 1000);

    // STOP PROGRESS
    stopMainProgress();
    startedUp = true;

    if (!isios && !isipados) {
        history.pushState(activeAlbumID, null, '/photos?album=favorites');
    }

}







/**
 * Loads a photo into the lightbox
 * @param {string} pid Photo ID
 */
async function loadPhoto(pid) {
    
    if (!pid) {
        handleError('[LOAD PHOTO] Failed to load. No PID.');
        return false; 
    }

    var thumbID = convertID(pid, "t");
    startMainProgress(true); // true means, contents shouldn't fade

    hideSorter();
    clearSearch(true);
    hideAlbumDropdownsExcept();
    
    var imgDataURL;
    
    // don't download / decrypt if it's already in lightbox cache
    if (!isImgInLightboxCache(pid)) {
        try {
            
            if (extensionOfPhoto(pid) === "gif") {
                // if it's a GIF, load original, since we don't have a lightbox image
                if (pid.endsWith("-v3")) {
                    imgBlob = await getPhoto(pid, "p");
                    imgDataURL = blobToObjectURL(imgBlob);
                } else {
                    imgDataURL = await getPhoto(pid, "p");
                }
            } else {
                // if it's not a gif  
                // – OR WE DON'T KNOW WHETHER IF IT'S A GIF OR NOT
                // – THIS CAN HAPPEN IF SOMEONE FAVORITES A GIF. FAVORITES DON'T HAVE NAMES
                // – SO WE WON'T KNOW THE PHOTO'S EXTENSION. 

                // try loading lightbox size, if it fails, try loading original size.

                imgDataURL = await getPhoto(pid, "l");
                if (!imgDataURL) {
                    if (pid.endsWith("-v3")) {
                        imgBlob = await getPhoto(pid, "p");
                        imgDataURL = blobToObjectURL(imgBlob);
                    } else {
                        imgDataURL = await getPhoto(pid, "p");
                    }
                }

            }
        } catch (error) {
            error.pid = pid;
            handleError('[LOAD PHOTO] Failed to download/decrypt photo.', error);
            return false; 
        }

        // if for some reason we fail to get the large size let's use the thumb size, better this than nothing
        imgDataURL = imgDataURL || $("img[thumb='"+thumbID+"']").attr("src");
    }

    var photoIndex = getPhotoIndex(pid);

    // this will make sure the div is now in DOM (and not just in virtual slider DOM) so that you can add the image into it
    lightbox.slideTo(photoIndex, null, false);   
    
    // not sure why but the first photo doesn't trigger slide-change, presumably because we're already on that slide on launch
    if (photoIndex === 0) {
        lightboxPhotoChanged(); 
    }

    // if photo is in cache, and in fact in the swiper, there's no need to add it again. 
    addImageToLightboxDOMIfNotAlreadyInCache(pid, imgDataURL);

    setTimeout(function () {
        // wait for the DOM to update on slow devices. we're injecting b664 inline here. ugh. sorry. 
        showLightbox();
        stopMainProgress();
    }, 20);

}





////////////////////////////////////////////////
////////////////////////////////////////////////
//	DECRYPTORS
////////////////////////////////////////////////
////////////////////////////////////////////////

// HERE WE'LL DECRYPT TITLES, THUMBNAILS, PHOTOS ETC.





/**
 * Decrypts the titles of an album with given ID, and writes the decrypted titles to albums object.
 * @param {string} aid AlbumID
 */
async function decryptAlbumTitles(aid) {
    if (!aid) { 
        handleError("[DECRYPT ALBUM TITLES] Can't decrypt. No AlbumID");
        return false; 
    }

    var album = albums[aid];
    if (!album) {
        handleError("[DECRYPT ALBUM TITLES] Can't decrypt. Album doesn't exist.", {aid : aid});
        return false;
    }
    
    var encryptedTitles = album.titles;
    if (!encryptedTitles) {
        breadcrumb("[DECRYPT ALBUM TITLES] Nothing to decrypt. Album has no titles", {aid : aid});
        return true;
    }

    breadcrumb('[DECRYPTING] Album titles ('+aid+')');
    var plaintextTitles = "";

    try {
        plaintextTitles = await decrypt(encryptedTitles, [theKey]);
    } catch (error) {
        handleError("[DECRYPT ALBUM TITLES] Failed to decrypt album titles.", error);
        return false;
    }

    var decryptedTitles = {};

    try {
        decryptedTitles = JSON.parse(plaintextTitles.data);
    } catch (error) {
        handleError("[DECRYPT ALBUM TITLES] Failed to parse decrypted album titles.", error);
        return false;
    }

    var decryptedAlbumTitles = decryptedTitles.albums || decryptedTitles.folders; // for backwards compatibility
    for (var albumID in decryptedAlbumTitles) {
        if (decryptedAlbumTitles.hasOwnProperty(albumID)) {
            albums[albumID] = albums[albumID] || {};
            var parsedAlbumTitle = "Untitled Album";
            try {
                parsedAlbumTitle = JSON.parse(decryptedAlbumTitles[albumID]);
            } catch (error) {
                parsedAlbumTitle = decryptedAlbumTitles[albumID] || "Untitled Album";
            }
            albums[albumID].decryptedTitle = parsedAlbumTitle;
        }
    }

    var decryptedPhotoTitles = decryptedTitles.photos;
    for (var photoID in decryptedPhotoTitles) {
        if (decryptedPhotoTitles.hasOwnProperty(photoID)) {            
            photos[photoID] = photos[photoID] || {};
            var parsedPhotoTitle = "Untitled.jpg";
            try {
                parsedPhotoTitle = JSON.parse(decryptedPhotoTitles[photoID]);
            } catch (error) {
                parsedPhotoTitle = decryptedPhotoTitles[photoID] || "Untitled.jpg";
            }
            photos[photoID].decryptedTitle = parsedPhotoTitle;

            albums[aid].photos = albums[aid].photos || [];
            if (!albums[aid].photos.includes(photoID)) {
                albums[aid].photos.push(photoID);
            }
        }
    }

    breadcrumb('[DECRYPTED] Album titles ('+aid+')');

    return true;
}





////////////////////////////////////////////////
////////////////////////////////////////////////
//	SORTING
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * This sorts the active active album's contents with the given sorting type, and returns a sorted array of albums / photos etc.
 * @param {('az-asc'|'az-desc'|'date-asc'|'date-desc')} sorttype Sorting Type
 * @returns {Array} sortedAlbumContentsArray an array of sorted album contents (albums / photos etc.)
 */
function getSortedActiveAlbumContents(sorttype) {
    sorttype = sorttype || "date-desc";

    $(".sort-button").removeClass("selected");

    var titlesArray = [];
    
    // if the active album is home, add album titles to the list of things to sort
    if (activeAlbumID === "home") {
        for (var albumID in albums) {
            if (albums.hasOwnProperty(albumID)) {
                var album = albums[albumID] || {};
                var albumTitle = album.decryptedTitle;
                var albumDate = album.date || "0000:00:00";
                titlesArray.push([albumID, albumTitle, albumDate]);
            }
        }
    }

    // otherwise, add photos to the mix of things to sort
    // if for some reason the API request to "photos-album" fails, this object could be undefined, 
    // and we won't be able to access photos.
    if (!isEmpty(albums[activeAlbumID])) {
        albums[activeAlbumID].photos.forEach(photoID => {
            if (photos[photoID]) {
                var photo = photos[photoID];
                var photoTitle = (photo.decryptedTitle || "Untitled.jpg");
                var photoDate = (photo.date || "").split("0000:00:00T00:00:00")[0] || "0000:00:00";
                titlesArray.push([photoID, photoTitle, photoDate]);
            }
        });
    }

    if (sorttype === "az-asc") {
        $(".sort-button[type='az-asc']").addClass("selected");
        titlesArray.sort(function (a, b) {
            if (a[1] > b[1]) { // [1] == title
                return -1;
            } else {
                return 1;
            }
        });
    } else if (sorttype === "az-desc") {
        $(".sort-button[type='az-desc']").addClass("selected");
        titlesArray.sort(function (a, b) {
            if (a[1] < b[1]) { // [1] == title
                return -1;
            } else {
                return 1;
            }
        });
    } else if (sorttype === "date-asc") {
        $(".sort-button[type='date-asc']").addClass("selected");
        titlesArray.sort(function (a, b) {
            if (sortableExifDate(a[2]) < sortableExifDate(b[2])) { //  [1] = title, [2] = date
                return -1;
            } else {
                return 1;
            }
        });
    } else if (sorttype === "date-desc") {
        $(".sort-button[type='date-desc']").addClass("selected");
        titlesArray.sort(function (a, b) {
            if (sortableExifDate(a[2]) > sortableExifDate(b[2])) { // [1] = title, [2] = date
                return -1;
            } else {
                return 1;
            }
        });
    } else {
        // UNKNOWN SORT, use date-desc instead
        return getSortedActiveAlbumContents("date-desc");
    }

    var sortedAlbumContentsArray = [];
    sortedAlbumContentsArray = titlesArray;

    return sortedAlbumContentsArray;
}




/**
 * Sorts all visible items (i.e. photos / albums etc) and updates the lightbox & timeline
 * @param {('az-desc'|'az-asc'|'date-desc'|'date-asc')} sorttype The sort order / type 
 */
function sortThings(sorttype) {
    sorttype = sorttype || "date-desc";
    $(`.sort-button[type='${sorttype}']`).addClass("selected");

    var sortFunction;
    
    if (sorttype === "az-asc") {
        sortFunction = function(a,b) {
            var at = ($(a).attr("name") || "").toUpperCase();
            var bt = ($(b).attr("name") || "").toUpperCase();
            if (at > bt) { return -1; } else { return 1; }
        };
    } else if (sorttype === "az-desc") {
        sortFunction = function(a,b) {
            var at = ($(a).attr("name") || "").toUpperCase();
            var bt = ($(b).attr("name") || "").toUpperCase();
            if (at < bt) { return -1; } else { return 1; }
        };
    } else if (sorttype === "date-asc") {
        sortFunction = function(a,b) {
            if ($(a).attr("datesort") < $(b).attr("datesort")) { return -1; } else { return 1; }  
        };
    } else { // date-desc
        sortFunction = function (a,b) {
            if ($(a).attr("datesort") > $(b).attr("datesort")) { return -1; } else { return 1; }
        };
    }

    $(".content").sort(sortFunction).appendTo("#albumContents");

    updateLightboxSort(sorttype);

    setAlbumMeta(activeAlbumID, {"sort" : sorttype});

    clearTimeline();
    
    setTimeout(function () {
        drawTimeline(sorttype);
    }, 300);
}

function getCurrentSort() {
    return $('.sort-button.selected').attr("type");
}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	TIMELINE
////////////////////////////////////////////////
////////////////////////////////////////////////

var timelineObject = {};
var clearingTimeline = false;

clearTimeline(true);

/**
 * Clears timeline (and optionally) resets the timeline object
 * @param {boolean} force force-reset timeline object
 */
function clearTimeline(force) {
    if ( $(window).width() <= 703 ) { return; }

    clearingTimeline = true;
    $("#timeline").addClass("loading");
    setTimeout(function () {
        $("#timeline").children().remove();
        $("#timeline").removeClass("loading");
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

/**
 * Adds a new item to the timeline
 * @param {*} an item to add to timeline
 */
function addToTimeline(item) {
    if ( $(window).width() <= 703 ) { return; }

    var name = item[1] || "Untitled";
    var exif = item[2] || "0000:00:00";
    var date = dateFromEXIF(exif);

    var year = date.split(":")[0] || "0000";
    var month = date.split(":")[1] || "00";
    var day = date.split(":")[2] || "00";

    var yearAndMonth = year + ":" + month || "0000:00";
    var monthAndDay = month + ":" + day || "00:00";

    var firstLetter = name.slice(0, 1).toUpperCase();

    timelineObject.az = timelineObject.az || {};
    timelineObject.years = timelineObject.years || {};
    timelineObject.months = timelineObject.months || {};
    timelineObject.days = timelineObject.days || {};
    
    timelineObject.yearsAndMonths = timelineObject.yearsAndMonths || {};
    timelineObject.monthsAndDays = timelineObject.monthsAndDays || {};

    timelineObject.years[year] = (timelineObject.years[year] || 0) + 1;
    timelineObject.yearsAndMonths[yearAndMonth] = (timelineObject.yearsAndMonths[yearAndMonth] || 0) + 1;
    timelineObject.monthsAndDays[monthAndDay] = (timelineObject.monthsAndDays[monthAndDay] || 0) + 1;
    timelineObject.months[month] = (timelineObject.months[month] || 0) + 1;
    timelineObject.days[day] = (timelineObject.days[day] || 0) + 1;

    timelineObject.az[firstLetter] = (timelineObject.az[firstLetter] || 0) + 1;
}


/**
 * Draw the timeline
 * @param {('az-desc'|'az-asc'|'date-desc'|'date-asc')} sort the sort type to use for sorting the page / timeline
 */
function drawTimeline(sort) {
    if ( $(window).width() <= 703 ) { return; }

    sort = sort || "date-desc";
    
    var sortOrder = "asc";
    if (sort.endsWith("desc")) { sortOrder = "desc"; }

    var whatToUse = analyzeTimelineObject(sort);
    var timelineInUse = timelineObject[whatToUse];
    var timelineLabels = Object.keys(timelineInUse);
    var labels;

    if (sort.startsWith("date")) {
        if (sortOrder === "desc") {
            labels = timelineLabels.sort().reverse();
        } else {
            labels = timelineLabels.sort();
        }
    } else {
        if (sortOrder === "desc") {
            labels = timelineLabels.sort();
        } else {
            labels = timelineLabels.sort().reverse();
        }
    }

    if (whatToUse === "yearsAndMonths" || whatToUse === "months") {
        renderTimeline(labels, whatToUse);
    } else {
        if (labels.length > 1) {
            renderTimeline(labels, whatToUse);
        }
    }

    
}


/**
 * Analyzes the timeline object, and pics the optimum timeline - type to display
 * @param {('az-desc'|'az-asc'|'date-desc'|'date-asc')} sort a sorttype  
 */  
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


/**
 * Renders the timeline
 * @param {*} labels timeline labels to display
 * @param {*} whatToUse the type of timeline to use
 */
function renderTimeline(labels, whatToUse) {
    if (clearingTimeline) {
        setTimeout(function () { renderTimeline(labels, whatToUse); }, 10);
        return;
    }
    
    $("#timeline").attr("type", whatToUse);

    labels.forEach(function (label, index) {
        $("#timeline").append(renderTimelineLabel(label, whatToUse));
    });
    
    setTimeout(function () {
        var childrenHeight = $("#timeline").children().length * 17; // 16px + 1px border;
        var timelineHeight = $("#timeline").height();

        if (childrenHeight >= timelineHeight) {
            $("#timeline").addClass("compact");
        }

        $("#timeline").children().each(function (i) {
            var elem = $(this);
            setTimeout(function () { elem.removeClass("loading"); }, i * 25);
        });
    }, 10);
    
}
  

/**
 * Renders timeline labels
 * @param {*} labels timeline labels to display
 * @param {*} whatToUse the type of timeline to use
 */
function renderTimelineLabel(label, whatToUse) {
    var labelElement = "";
    var year, month, monthName, day;

    // normalize a few characters in dates I think some cameras might be using this in exif. [facepalm].
    label = label.split("/").join(":"); 
    label = label.split("-").join(":");
    label = label.split(".").join(":");

    if (whatToUse === "yearsAndMonths") {
        year = label.split(":")[0];
        month = label.split(":")[1];
        monthName = monthsShort[parseInt(month)];

        if (!$("#tl-date-" + year).length) {
            if (year !== "0000") {
                labelElement = `<small class='loading' goto='${year}' id='tl-date-${year}'>${year}</small>`;
            } else {
                labelElement = `<small class='loading' goto='${year}' id='tl-date-${year}'>&infin;</small>`;
            }
        }

        if (year !== "0000") {
            labelElement += `<small class='sub loading' goto='${year}${month}' id='tl-date-${year}${month}'>${monthName}</small>`;
        }

    } else if (whatToUse === "monthsAndDays") {

        year = Object.keys(timelineObject.years)[0]; // all months have same year. 
        month = label.split(":")[0];
        day = label.split(":")[1];
        monthName = monthsShort[parseInt(month)];

        if (!$("#tl-date-" + year + month).length) {
            if (month !== "00") {
                labelElement = `<small class='loading' goto='${year}${month}' id='tl-date-${year}${month}'>${monthName}</small>`;
            } else {
                labelElement = `<small class='loading' goto='${year}${month}' id='tl-date-${year}${month}'>&infin;</small>`;
            }
        }

        if (month !== "00") {
            labelElement += `<small class='sub loading' goto='${year}${month}${day}' id='tl-date-${year}${month}${day}'>${day}</small>`;
        }

    } else if (whatToUse === "months") {

        year = Object.keys(timelineObject.years)[0]; // all months have same year. 
        monthName = monthsShort[parseInt(label)];
        labelElement = `<small class='loading' goto='${year}${label}' id='tl-label-${year}${label}'>${monthName}</small>`;

    } else if (whatToUse === "days") {

        month = Object.keys(timelineObject.months)[0]; // all days have same month.
        monthName = monthsShort[parseInt(month)];
        labelElement = `<small class='loading' goto='day-${label}' id='tl-label-${label}'>${monthName} ${label}</small>`;

    } else {

        labelElement = "<p class='loading' goto='" + label + "' id='tl-label-" + label + "'>" + label + " &horbar;</p>";
        labelElement = `<small class='loading' goto='${label}' id='tl-label-${label}'>${label}</small>`;
    }

    return labelElement;
}

/**
 * Updates the timeline with items that are in viewport. (i.e. when user scrolls etc)
 */
function updateTimelineWithItemsOnScreen() {
    if ( $(window).width() <= 703 ) { return; }
    
    var using = $("#timeline").attr("type");
    var itemsOnScreen = $(".onscreen");
    
    $("small[goto]").removeClass("active");

    itemsOnScreen.forEach(item => {
        var name        = item.getAttribute("name") || "";
        var firstLetter = name.slice(0,1).toUpperCase();

        var date        = item.getAttribute("exifdate") || "";
        var year        = (date.split(":")[0] || "").trim().split(" ")[0]; 
        var month       = (date.split(":")[1] || "").trim().split(" ")[0]; 
        var day         = (date.split(":")[2] || "").trim().split(" ")[0];

        if (using === "years") {
            $(`#tl-label-${year}`).addClass("active");
        }

        if (using === "yearsAndMonths") { 
            $(`#tl-date-${year}`).addClass("active");
            $(`#tl-date-${year}${month}`).addClass("active");
        }
        
        if (using === "monthsAndDays") {
            $(`#tl-date-${year}${month}`).addClass("active");
            $(`#tl-date-${year}${month}${day}`).addClass("active");
        }
        
        if (using === "months") {
            $(`#tl-label-${year}${month}`).addClass("active");
        }

        if (using === "days") {
            $(`#tl-label-${day}`).addClass("active");
        }

        if (using === "az") {
            $(`#tl-label-${firstLetter}`).addClass("active");
        }

    });

}




/**
 * When user clicks / taps / swipes on a timeline label, scrolls the page with timeline
 * @param {*} timelineLabel 
 * @param {string} smooth (option to scroll smoothly or not. use this for clicks, and not for swipes) 
 */
function scrollWithTimeline(timelineLabel, smooth) {
    smooth = smooth || false;
    
    if(!timelineLabel) { return false; }

    var goto = timelineLabel.getAttribute("goto");
    
    if (!goto) { return false; }
    
    var firstElem;

    if (goto.startsWith("day")) {
        goto = goto.replace("day-", "");
        firstElem = $("[datesort$='" + goto + "']")[0];
    } else {
        firstElem = $("[datesort^='" + goto + "']")[0] || $("[name^='" + goto + "']")[0];
    }

    if (firstElem) {
        var offset = $(firstElem).offset().top;
        var albumOffset = $("#albumContents").offset().top;
        var scrollConfig = {
            top: (0 - albumOffset) + offset,
            left: 0
        };

        if (smooth) { scrollConfig.behavior = "smooth"; }
        $("main")[0].scrollTo(scrollConfig);
    }
}





////////////////////////////////////////////////
////////////////////////////////////////////////
//	SELECTIONS
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Selects a photo
 * @param {string} pid photo ID
 */
function togglePhotoSelection(pid) {
    $("#"+pid).toggleClass("selected");
    updateSelections();
}


/**
 * Selects multiple photos
 * @param {*} startIndex 
 * @param {*} endIndex 
 */
function selectPhotos(startIndex, endIndex) {
    $(".photo").slice(startIndex, endIndex).addClass("selected");
    updateSelections();
}


/**
 * Selects all photos
 */
function selectAll() {
    $(".content.photo").addClass("selected");
    updateSelections();
}


/**
 * Clears all photos selections
 */
function clearSelections() {
    $(".photo.selected").removeClass("selected");
    updateSelections();

    if (!downloadingPhotos) {
        hidePopup("popup-download");
    }

    hideActiveModal();
}


/**
 * Shift selects a photo
 * @param {string} photoID 
 */
function shiftSelectedPhoto(photoID) {
    var lastSelectedPhotoBeforeThisOne = 0;
            
    $(".photo").forEach(photo => {
        var selected = $(photo).hasClass("selected");
        if ($(photo).index() < $("#"+photoID).index() && selected) {
            lastSelectedPhotoBeforeThisOne = ($(photo).index() || 1) - 1;
        }
    });
    
    selectPhotos(lastSelectedPhotoBeforeThisOne, $("#"+photoID).index());
}


/**
 * Updates selections to reflect UI changes
 */
function updateSelections() {
    var noSelectedPhotos = $(".photo.selected").length;
    if (noSelectedPhotos >= 1) {
        navbarForSelectionModeOn();
    } else {
        navbarForSelectionModeOff();
    }

    if ((isios || isipados) && noSelectedPhotos > 1) {
        // DISABLE DOWNLOAD BUTTON. 
        // SADLY IOS ONLY ALLOWS DOWNLOADING ONE PHOTO AT A TIME.
        $("#download-button").addClass("ios");
        $("#start-downloads-button").addClass("ios");
    } else {
        // ENABLE DOWNLOAD BUTTON.
        $("#download-button").removeClass("ios");
        $("#start-downloads-button").removeClass("ios");
    }

    if (activeAlbumID !== "home" && activeAlbumID !== "favorites") {
        // HIDE MAKE COVER BUTTON IF MORE THAN ONE PHOTO IS SELECTED
        var moreThanOneSelected = (noSelectedPhotos > 1);
        $("#make-cover-button").toggleClass("hidden", moreThanOneSelected);
    }
    
    hideActiveModal();
    activityHappened();
}


/**
 * A helper to get all selected photo IDs in an array.
 */
function selectedPhotos() {
    var selectedIDs = [];

    $(".photo.selected").each(function(){
        var pid = $(this).attr("id");
        if (pid) {
            selectedIDs.push(pid);
        }
    });

    return selectedIDs;
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	ALBUM RIGHT CLICKS & DROPDOWNS
////////////////////////////////////////////////
////////////////////////////////////////////////


/**
 * Shows / Hides an album's dropdown
 * @param {string} albumID 
 */
function toggleAlbumDropdown(albumID) {

    if ($(`.dropdown[aid="${albumID}"]`).length >= 1) { 
        hideAlbumDropdownsExcept();
    } else {
        hideAlbumDropdownsExcept(albumID);
    
        $(`.album[id="${albumID}"]`).prepend(
        `<div class="dropdown" aid="${albumID}">
            <button id="edit-album-button"   aid="${albumID}" onclick="showEditAlbumPopup('${albumID}');">edit</button>
            <button id="ghost-album-button"  aid="${albumID}" onclick="showGhostAlbumModal('${albumID}');">ghost</button>
            <button id="delete-album-button" aid="${albumID}" onclick="showDeleteAlbumModal('${albumID}');" class="red">delete</button>
        </div>`);

        setTimeout(function () {
            $(`.album[id="${albumID}"]`).find(".dropdown").addClass("show");
        }, 10);
    }

}


/**
 * Hides all album dropdowns except an optional one.
 * @param {string} albumID 
 */
function hideAlbumDropdownsExcept(albumID) {
    albumID = albumID || "";

    $(".album > .dropdown").not(`.dropdown[aid="${albumID}"]`).removeClass("show");
    
    setTimeout(function () {
        $(".album > .dropdown").not(`.dropdown[aid="${albumID}"]`).remove();
    }, 300);
    
}




////////////////////////////////////////////////
////////////////////////////////////////////////
//	BULK DOWNLOAD PHOTOS
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * SHOWS BULK DOWNLOAD POPUP
 */
function showDownloadPopup() {
    if (selectedPhotos().length < 1) { return; }
    if ((isios || isipados) && selectedPhotos().length > 1) { return; }
    $("#popup-download").find(".status").html("DOWNLOAD PHOTOS");
    showPopup("popup-download");
}

var downloadingPhotos = false;

/**
 * STARTS BULK DOWNLOADING PHOTOS
 */
async function startDownloads() {
    
    // download in a batch of 2 for now, since parallel decrypting more stuff could mess things up. 
    // i.e. if a photo is 50mb, 2 of these would take ~100mb memory. 
    if (downloadingPhotos) { 
        breadcrumb("[DOWNLOAD PHOTOS] Already downloading");
        return; 
    }

    var batchSize = 2;
    var selections = selectedPhotos();

    downloadingPhotos = true;
    downloadsCancelled = false;
    $("#start-downloads-button").addClass("downloading");

    minimizeMaximizePopup("popup-download");
    
    breadcrumb(`[DOWNLOAD PHOTOS] Starting to download a total of ${selections.length} photo(s) in batches of 2`);
    
    for (var index = 0; index < selections.length; index+= batchSize) {
        if (!downloadsCancelled) {
            var firstPID = selections[index] || "";
            var secondPID = selections[index + 1] || "";
            $("#popup-download").find(".status").html(`DOWNLOADING ${index} / ${selections.length}`);
            await Promise.all([downloadAndSavePhoto(firstPID), downloadAndSavePhoto(secondPID)]);
        }
    }

    downloadingPhotos = false;
    downloadsCancelled = false;
    $("#start-downloads-button").removeClass("downloading");

    hidePopup("popup-download");
    // DOWNLOAD COMPLETE

    return true;
}


/**
 * Downloads and saves a photo to disk
 * @param {string} pid Photo ID
 */
async function downloadAndSavePhoto(pid) {
    if (!pid) { return false; } // likely the last in batch (an odd number)
    if (downloadsCancelled) { return false; } // download canceled;

    breadcrumb(`[DOWNLOAD PHOTO] Downloading ${pid}`);

    var img;

    try {
        img = await getPhoto(pid, "p");
    } catch (error) {
        error.pid = pid;
        handleError("[DOWNLOAD PHOTO] Couldn't Download Photo", error);
        return false;
    }

    var title = photos[pid].decryptedTitle || "Untitled.jpg";

    try {
        if (pid.endsWith("-v3")) {
            // if it's a v3 upload, img is a blob
            saveAs(img, title);
        } else {
            // if it's not a v3 upload, img is a b64
            saveAs(dataURIToBlob(img), title);
        }
    } catch (error) {
        error.pid = pid;
        handleError("[DOWNLOAD PHOTO] Couldn't Save Photo", error);
        return false;
    }

    return true;
}


var downloadsCancelled = false;

/**
 * Cancels downloads
 */
function cancelDownloads() {
    downloadsCancelled = true;
    hidePopup("popup-download");
    $("#start-downloads-button").removeClass("downloading");
}


/**
 * Selects and downloads the active photo (to be used in the lightbox)
 */
async function selectAndDownloadActivePhoto() {
    $("#lightbox-download").addClass("loading");
    await downloadAndSavePhoto(activePhotoID);
    $("#lightbox-download").removeClass("loading");
}




////////////////////////////////////////////////
////////////////////////////////////////////////
//	SET ALBUM COVER / MAKE ALBUM COVER
////////////////////////////////////////////////
////////////////////////////////////////////////


/**
 * Sets the selected photo as the active album's cover
 */
async function makeSelectedPhotoAlbumCover() {
    startMainProgress(true);

    if (selectedPhotos().length !== 1) {
        handleError("[ALBUM COVER] Can't set album cover. Too many selections");
        return false;
    }

    var selectedPID = selectedPhotos()[0];
    
    await setAlbumCover(activeAlbumID, selectedPID);
    
    clearSelections();

    stopMainProgress();
}




////////////////////////////////////////////////
////////////////////////////////////////////////
//	EDIT ALBUM
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Shows the edit album Popup
 * @param {string} aid Album ID
 */
function showEditAlbumPopup(aid) {
    if (activeAlbumID !== "home" || activeAlbumID !== "favorites") {
        aid = aid || activeAlbumID;    
    }

    if (!aid) {
        handleError("[EDIT ALBUM POPUP] Can't edit album without AlbumID");
        return false;
    }

    if (!albums[aid] || isEmpty(albums[aid])) {
        handleError("[EDIT ALBUM POPUP] Can't edit album. Album doesn't exist.", {aid:aid});
        return false;
    }

    updateEditAlbumPopupContents(aid);
    
    showPopup("popup-album-info");
}

$("#albumContents").on('click', "#albumheader", function () {
    showEditAlbumPopup();
}); 


/**
 * Update's the edit album popup contents (i.e. album name / date etc) mainly to be used when you create a new album during uploads
 * @param {string} aid Album ID
 */
function updateEditAlbumPopupContents(aid) {
    var albumCurrentName = albums[aid].decryptedTitle || "Untitled Album";
    var albumCurrentDate = replaceAll((albums[aid].date || "0000:00:00"), ":", "-");
    $("#popup-album-info").find("#album-name").attr("placeholder", albumCurrentName);
    $("#popup-album-info").find("#album-date").attr("placeholder", albumCurrentDate);

    $("#popup-album-info").find("#album-name").val(albumCurrentName);
    $("#popup-album-info").find("#album-date").val(albumCurrentDate);

    $("#popup-album-info").attr("aid", aid);
}

/**
 * Edit Album Info (name & date), this will get called in edit album info popup but can be called elsewhere by passing optional aid, name & date.
 * @param {string} [aid] AlbumID i.e. f-12345 (if not set, it'll come from popup-album-info so if you're using this elsewhere, aid is mandatory)
 * @param {string} [name] album name in plaintext
 * @param {string} [date] album date in format YYYY-MM-DD
 */
async function editAlbumInfo(aid, name, date) {
    
    aid = aid || $("#popup-album-info").attr("aid");
    name = (name || $("#popup-album-info").find("#album-name").val().trim()).toUpperCase();
    date = date || $("#popup-album-info").find("#album-date").val().trim();

    var oldName = ($("#popup-album-info").find("#album-name").attr("placeholder").trim() || "").toUpperCase();
    var oldDate = $("#popup-album-info").find("#album-date").attr("placeholder").trim();

    if (!aid) {
        handleError("[EDIT ALBUM] Can't edit album without AlbumID");
        return false;
    }

    if (!albums[aid] || isEmpty(albums[aid])) {
        handleError("[EDIT ALBUM] Can't edit album. Album doesn't exist.", {aid:aid});
        return false;
    }
    
    startProgressWithID("progress-album-info");
    $("#save-album-info-button").addClass("loading");

    if (date && !isValidDate(date)) {
        createPopup("Couldn't save your album's date. Please make sure the date format is YYYY-MM-DD", "error");
        stopProgressWithID("progress-album-info");
        $("#save-album-info-button").removeClass("loading");
        return false;
    }

    if (date && date !== oldDate) {
        // update album's meta with the correct date.

        var exifDate = replaceAll(date, "-", ":");
        var successfullySetAlbumMeta = await setAlbumMeta(aid, { date:exifDate });
            
        if (successfullySetAlbumMeta) {
            albums[aid].date = exifDate;
            refreshAlbumInDOM(aid);
        } else {
            error.aid = aid;
            handleError("[EDIT ALBUM] Couldn't set album date", error);
            createPopup("Couldn't save your album's date. Chances are this is a network problem. Please check your connection and reach out to our support via our helpdesk if this issue continues.", "error");
            
            stopProgressWithID("progress-album-info");
            $("#save-album-info-button").removeClass("loading");
            
            return false;
        }
    
    }


    if (name && name !== oldName) {
        var nameBeforeUpdate = (albums[aid].decryptedTitle || "Untitled Album").toUpperCase();
        
        // update decryptedTitles in local albums object
        // update home titles (because that's where all albums' titles are stored)
        albums[aid].decryptedTitle = name;
        var successfullySetAlbumTitles = await updateAlbumTitles("home");
        
        if (successfullySetAlbumTitles) {
            refreshAlbumInDOM(aid);
        } else {
            error.aid = aid;
            handleError("[EDIT ALBUM] Couldn't set album name", error);
            createPopup("Couldn't save your album's new name. Chances are this is a network problem. Please check your connection and reach out to our support via our helpdesk if this issue continues.", "error");
            
            // revert to the old name in the local cache to prevent confusion 
            albums[aid].decryptedTitle = nameBeforeUpdate;

            stopProgressWithID("progress-album-info");
            $("#save-album-info-button").removeClass("loading");
            
            return false;
        }
    }

    stopProgressWithID("progress-album-info");
    $("#save-album-info-button").removeClass("loading");

    hidePopup("popup-album-info");

}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	NEW ALBUM
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Creates a new album, optionally with a given name.
 * @param {string} [name] Plaintext Album Name
 */
async function newAlbum(name) {

    name = (name || "New Album").trim().toUpperCase();
    var aid = "f-" + newUUID(16);
    var date = todaysEXIF();
    var pinky = "54,54,54";

    startMainProgress(true);

    var albumMeta = {
        date : date,
        pinky : pinky,
        id : aid
    };

    try {        
        await setAlbumMeta(aid, albumMeta);
    } catch (error) {
        error.aid = aid;
        handleError("[NEW ALBUM] Couldn't create new album", error);
        createPopup("Couldn't create the new album. Chances are this is a network problem. Please check your connection and reach out to our support via our helpdesk if this issue continues.", "error");
        
        stopMainProgress();
        
        return false;
    }

    albums[aid] = albumMeta;
    albums[aid].photos = [];

    try {
        // update decryptedTitles in local albums object
        // update home titles (because that's where all albums' titles are stored)
        albums[aid].decryptedTitle = name;
        await updateAlbumTitles("home");
    } catch (error) {
        error.aid = aid;
        handleError("[NEW ALBUM] Couldn't set album name", error);
        createPopup("Couldn't create the new album. Chances are this is a network problem. Please check your connection and reach out to our support via our helpdesk if this issue continues.", "error");

        stopMainProgress();

        return false;
    }

    

    scrollTop();
    var albumHTML = renderAlbum(aid);
    $("#albumContents").prepend(albumHTML);
    stopMainProgress();
    showEditAlbumPopup(aid);

    return aid;
}





////////////////////////////////////////////////
////////////////////////////////////////////////
//	DELETIONS
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Deletes all selected photos
 */
async function deleteSelectedPhotos() {
    if (selectedPhotos().length === 0) { return false; }

    var photosToDelete = selectedPhotos();
    startMainProgress();
    startModalProgress("modal-delete-selections");
    
    var deleted = false;
    try {
        deleted = await deletePhotosOfAlbum(activeAlbumID, photosToDelete);
    } catch (error) {
        error.aid = activeAlbumID;
        error.photos = photosToDelete;
        handleError("[DELETE PHOTOS] Failed to delete photos", error);
    }
    
    if (!deleted) { 
        createPopup("Couldn't delete the selected photos. Chances are this is a network problem. Please check your connection and reach out to our support via our helpdesk if this issue continues.", "error");
        stopModalProgress("modal-delete-selections");
        stopMainProgress();
        hideActiveModal();
        return false;
    }
    
    var albumThumbDeleted = false;
    photosToDelete.forEach(pid => {
        delete albums[activeAlbumID].photos[pid];
        delete photos[pid];
        delete favorites[pid];
        $("#" + pid).remove();

        if (activeAlbumID !== "home") {
            var tid = convertID(pid,"t");
            if (albums[activeAlbumID].thumb === tid) { albumThumbDeleted = true; }
        }
    });
    
    if (albumThumbDeleted) {
        albums[activeAlbumID].thumb = "";
        albums[activeAlbumID].date = "";
        albums[activeAlbumID].ltoken = "";
        albums[activeAlbumID].ttoken = "";
        albums[activeAlbumID].pinky = "54,54,54";
    }
    
    try {
        await updateAlbumTitles(activeAlbumID);
    } catch (error) {
        error.aid = activeAlbumID;
        error.photos = photosToDelete;
        handleError("[DELETE PHOTOS] Failed to update album titles after deleting photos", error);
    }

    stopMainProgress();
    hideActiveModal();
    stopModalProgress("modal-delete-selections");
    clearSelections();
    
    getUpdatedRemainingStorage();
    return true;

}



/**
 * Deletes selected album
 */
async function deleteSelectedAlbum() {

    var aid = $("#modal-delete-album").attr("aid");

    if (!aid) {
        handleError("[DELETE ALBUM] Can't delete album. No AlbumID!");
        return false;
    }

    startMainProgress();
    startModalProgress("modal-delete-album");

    var photosOfAlbum = albums[aid].photos || [];
    var deleted = false;

    try {
        deleted = await deleteAlbum(aid);
    } catch (error) {
        error.aid = aid;
        handleError("[DELETE ALBUM] Failed to delete album", error);
    }

    if (!deleted) { 
        createPopup("Couldn't delete the selected album. Chances are this is a network problem. Please check your connection and reach out to our support via our helpdesk if this issue continues.", "error");
        stopModalProgress("modal-delete-album");
        stopMainProgress();
        hideActiveModal();
        return false;
    }

    photosOfAlbum.forEach(pid => {
        delete photos[pid];
        delete favorites[pid];
    });

    delete albums[aid];
    $(`.album[id="${aid}"]`).remove();

    try {
        await updateAlbumTitles("home");
    } catch (error) {
        error.deletingAlbumID = aid;
        handleError("[DELETE ALBUM] Failed to update home titles after deleting album", error);
    }

    stopMainProgress();
    hideActiveModal();
    stopModalProgress("modal-delete-album");

    getUpdatedRemainingStorage();
    
    return true;
}


/**
 * shows the delete album modal
 * @param {string} aid album id
 */
function showDeleteAlbumModal(aid) {
    if (!aid) {
        handleError("[DELETE ALBUM] Can't delete album. No AlbumID!");
        return false;
    }

    if (isEmpty(albums[aid])) { 
        return false; 
    }
    
    var albumName = "UNTITLED ALBUM";
    if (albums[aid]) {
        albumName = albums[aid].decryptedTitle || "UNTITLED ALBUM";
    }
    
    $("#modal-delete-album").attr("aid", aid);
    $("#deleting-albumname").html(albumName);

    showModal("modal-delete-album");
}



/**
 * shows the delete selections modal
 */
function showDeleteSelectionsModal() {
    if (selectedPhotos().length === 0) { return; }
    
    $('#deleting-filenames').empty();

    selectedPhotos().forEach(pid => {
        var name = "";
        
        if (!isEmpty(photos[pid])) { 
            name = photos[pid].decryptedTitle || ""; 
        }

        if (name && name !== "Untitled.jpg") {
            $('#deleting-filenames').append(`<p class="bold">${name}</p>`);
        }
    });

    showModal("modal-delete-selections");
}





////////////////////////////////////////////////
////////////////////////////////////////////////
//	FAVORITES
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Favorites a photo given its ID
 * @param {string} pid photo id
 */
async function favoritePhoto(pid) {
    if (!pid) {
        handleError("[FAVORITE PHOTO] Can't fav photo. No PhotoID!");
        return false;
    }
    
    try {
        await setFavoritePhoto(pid);
    } catch (error) {
        error.pid = pid;
        handleError("[FAVORITE PHOTO] Failed to fav photo", error);
        return false;
    }

    var photo = photos[pid] || {};
    if (isEmpty(photo)) { return false; }

    favorites[pid] = photo;
}


/**
 * un-favorites a photo given its ID
 * @param {string} pid photo id
 */
async function unfavoritePhoto(pid) {
    if (!pid) {
        handleError("[UNFAVORITE PHOTO] Can't un-fav photo. No PhotoID!");
        return false;
    }

    try {
        await setUnfavoritePhoto(pid);
    } catch (error) {
        error.pid = pid;
        handleError("[UNFAVORITE PHOTO] Failed to un-fav photo", error);
    }

    delete favorites[pid];

    if (activeAlbumID === "favorites") {
        $("#" + pid).remove();
    }

    if ($("#lightbox").hasClass("show")) {
        var slideIndex = getPhotoIndex(pid);
        lbox.removeSlide(slideIndex);
        if (lbox.slides.length <= 0) {
            hideLightbox();
            loadAlbum("home");
        }
    }
}





////////////////////////////////////////////////
////////////////////////////////////////////////
//	GHOST & SUMMON ALBUMS
////////////////////////////////////////////////
////////////////////////////////////////////////


/**
 * Ghosts the chosen album in the ghost-modal 
 */
async function makeGhostAlbum() {

    var aid = $("#modal-ghost").attr("aid") || "";

    if (!aid) {
        handleError("[GHOST ALBUM] Can't make ghost without Album ID.");
        return false;
    }

    var album = albums[aid] || {};
    if (isEmpty(album)) {
        handleError("[GHOST ALBUM] Can't ghost an album that doesn't seem to exist. (or is empty)");
        createPopup("There seems to be an issue and we can't seem to be able to ghost this album. Please try renaming the album name, if it has any special characters, or reach out to our support via our helpdesk for more help.", "error");
        return false;
    }

    var decryptedTitle = (album.decryptedTitle || "").toUpperCase();
    if (decryptedTitle.length === 0) { 
        handleError("[GHOST ALBUM] Can't ghost, album title is empty");
        createPopup("Please give this album a valid and memorable name before ghosting it. You'll need to use this name to summon (retrieve) this album later.", "error");
        return false; 
    }

    var typedTitle = $("#ghost-input").val().toUpperCase();
    if (typedTitle !== decryptedTitle) {
        $("#ghost-input").trigger("focus");
        createPopup("Please type this album's name exactly as it is to confirm you can remember it before ghosting it. You'll need to use this name to summon (retrieve) this album later.", "error");
        return false; 
    }
    
    startModalProgress("modal-ghost");

    // #1 HASH THE TITLE 

    var hashedTitleToGhost;

    try {
        hashedTitleToGhost = await hashString(decryptedTitle);
    } catch (error) {
        handleError("[GHOST ALBUM] Couldn't hash entered title.", error);
    }

    if (!hashedTitleToGhost) {
        createPopup("There seems to be an issue with this album's name. Please check the album name to see if it has any special characters, or reach out to our support via our helpdesk for more help.", "error");
        stopModalProgress("modal-ghost");
        return false;
    }

    activityHappened();

    // GOT THE HASHED TITLE
    // #2 SEND THE HASH TO API TO GHOST THE ALBUM WITH THIS HASHED TITLE. 
    // ONCE THE GHOSTING IS COMPLETE, API WILL RETURN CONFIRMATION, AND YOU CAN REMOVE IT FROM DOM
    
    var apiResponse;
    
    try {
        apiResponse = await setGhostAlbum(aid, hashedTitleToGhost);
    } catch (error) {
        handleError("[GHOST ALBUM] An error occurred with API", error);
    }

    if (!apiResponse) {
        createPopup("It seems we're having difficulties ghosting your album at the moment. Chances are this is a network problem. Please check your connection and reach out to our support via our helpdesk if this issue continues", "error");
        stopModalProgress("modal-ghost");
        return false;
    }

    // ALBUM IS GHOSTED. LET'S CLEAN THINGS UP
    var photosOfAlbum = albums[aid].photos || [];

    photosOfAlbum.forEach(pid => {
        delete photos[pid];
        delete favorites[pid];
    });

    delete albums[aid];
    $(`.album[id="${aid}"]`).remove();

    try {
        await updateAlbumTitles("home");
    } catch (error) {
        error.ghostingAlbumID = aid;
        handleError("[GHOST ALBUM] Failed to update home titles after ghosting album", error);
    }

    activityHappened();

    stopModalProgress("modal-ghost");
    hideActiveModal();
    $("#ghost-input").val("");
    
    return true;
}


/**
 * Summons an album using the name typed into the summon album modal
 */
async function summonGhostAlbum() {
    
    activityHappened();

    var decryptedTitleToSummon = $("#summon-input").val().toUpperCase() || "";

    if (decryptedTitleToSummon.length === 0) { 
        $("#summon-input").trigger("focus");
        return false; 
    }

    startModalProgress("modal-summon");

    // #1 HASH THE TITLE

    var hashedTitleToSummon; 

    try {
        hashedTitleToSummon = await hashString(decryptedTitleToSummon);
    } catch (error) {
        handleError("[SUMMON GHOST] Couldn't hash entered title.", error);
    }

    if (!hashedTitleToSummon) { 
        createPopup("There seems to be an issue with the album name you've entered. Please check the album name to see if it has any special characters, or reach out to our support via our helpdesk for more help.", "error");
        stopModalProgress("modal-summon");
        return false;
    }

    activityHappened();

    // GOT THE HASHED TITLE. 
    // #2 SEND THE HASH TO API TO SEE IF THERE'S A GHOST WITH THIS TITLE.
    // IF THERE IS, THIS WILL RETURN THE GHOST FOLDER TO ADD TO albums[]
    var album;
    try {
        album = await getSummonAlbum(hashedTitleToSummon);
    } catch (error) {
        handleError("[SUMMON GHOST] An error happened with API", error);
        stopModalProgress("modal-summon");
        return false;
    }
    
    if (isEmpty(album)) {
        stopModalProgress("modal-summon");
        return false;
    }

    var aid = album.id;
    albums[aid] = album;
    albums[aid].decryptedTitle = decryptedTitleToSummon;

    $("#albumContents").prepend(renderAlbum(aid));

    setTimeout(function () { 
        setupIntersectionObserver($("#" + aid)[0]); 
        scrollTop();
    }, 50);

    activityHappened();

    try {
        await updateAlbumTitles("home");
    } catch (error) {
        handleError("[NEW ALBUM] Couldn't save summoned album's name", error);
    }

    activityHappened();

    stopModalProgress("modal-summon");
    hideActiveModal();
    $("#summon-input").val("");
    
    return true;
}





/**
 * Shows the ghost album modal for an album with given id
 * @param {string} aid album id
 */
function showGhostAlbumModal(aid) {
    if (!aid) { 
        handleError("[GHOST ALBUM MODAL] Can't show. No AlbumID!");
        return false;
    }

    if (isEmpty(albums[aid])) { 
        return false; 
    }

    $("#modal-ghost").attr("aid", aid);

    showModal("modal-ghost");
}




////////////////////////////////////////////////
////////////////////////////////////////////////
//	MOVE PHOTOS
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Shows the move photos modal
 */
async function showMoveModal() {

    $("#albums-for-moving").empty();

    var albumsArray = [];
    Object.keys(albums).forEach(aid => {
        if (aid !== "favorites" && aid !== "home") {
            var album = albums[aid];
            album.id = aid;
            albumsArray.push(album);
        }
    });

    albumsArray.sort(function(a,b) {
        if ((a.decryptedTitle || "Untitled Album").toUpperCase() < (b.decryptedTitle || "Untitled Album").toUpperCase()) {
            return -1;
        } else {
            return 1;
        }
    });

    albumsArray.forEach(album => {
        aid = album.id;
        var albumName = album.decryptedTitle;
        if (aid === activeAlbumID) {
            $("#albums-for-moving").append(`<button class="radio" group="move" val="${aid}" disabled>${albumName}</button>`);        
        } else {
            $("#albums-for-moving").append(`<button class="bold radio" group="move" val="${aid}">${albumName}</button>`);        
        }
    });

    showModal("modal-move");
}



/**
 * Moves the selected photos to the selected album
 */
async function moveSelectedPhotos() {

    var photosToMove = selectedPhotos();
    var toAID = $("button.radio.selected[group='move']").attr("val");
    var fromAID = activeAlbumID;

    startMainProgress();
    startModalProgress("modal-move");

    var targetAlbumReady = false;
    
    try {
        targetAlbumReady = await getAlbumPhotos(toAID);
    } catch (error) {
        error.from = fromAID;
        error.to   = toAID;
        error.photos = photosToMove;
        handleError("[MOVE PHOTOS] Failed to get target album to move photos to", error);
    }

    if (!targetAlbumReady) { 
        createPopup("Couldn't move the selected photos. Chances are this is a network problem. Please check your connection and reach out to our support via our helpdesk if this issue continues.", "error");
        stopModalProgress("modal-move");
        stopMainProgress();
        hideActiveModal();
        return false;
    }

    var targetAlbumDecrypted = false;

    try {
        targetAlbumDecrypted = await decryptAlbumTitles(toAID);
    } catch (error) {
        error.from = fromAID;
        error.to   = toAID;
        error.photos = photosToMove;
        handleError("[MOVE PHOTOS] Failed to decrypt target album to move photos to", error);
    }

    if (!targetAlbumDecrypted) { 
        createPopup("Couldn't move the selected photos. Chances are this has to do with an ad-blocker / content-blocker extension. Please try disabling your extensions and try again.", "error");
        stopModalProgress("modal-move");
        stopMainProgress();
        hideActiveModal();
        return false;
    }

    var moved = false;

    try {
        moved = await movePhotos(fromAID, toAID, photosToMove);
    } catch (error) {
        error.from = fromAID;
        error.to   = toAID;
        error.photos = photosToMove;
        handleError("[MOVE PHOTOS] Failed to move photos", error);
    }

    if (!moved) { 
        createPopup("Couldn't move the selected photos. Chances are this is a network problem. Please check your connection and reach out to our support via our helpdesk if this issue continues.", "error");
        stopModalProgress("modal-move");
        stopMainProgress();
        hideActiveModal();
        return false;
    }

    var albumThumbMoved = false; 
    photosToMove.forEach(pid => {

        // add photo to target album
        albums[toAID].photos.push(pid);

        // update the album id of photo
        photos[pid].aid = toAID;

        // delete photos from source album
        delete albums[fromAID].photos[pid];

        // delete photos from dom
        $("#" + pid).remove();

        // if we're not in home, check if the thumbnail moved.
        if (fromAID !== "home") {
            var tid = convertID(pid,"t");
            if (albums[fromAID].thumb === tid) { albumThumbMoved = true; }
        }
    });

    if (albumThumbMoved) {
        albums[fromAID].thumb = "";
        albums[fromAID].date = "";
        albums[fromAID].ltoken = "";
        albums[fromAID].ttoken = "";
        albums[fromAID].pinky = "54,54,54";
    }

    try {
        await updateAlbumTitles(toAID);
    } catch (error) {
        error.from = fromAID;
        error.to   = toAID;
        error.photos = photosToMove;
        handleError("[MOVE PHOTOS] Failed to update target album titles after moving photos", error);
    }

    try {
        await updateAlbumTitles(fromAID);
    } catch (error) {
        error.from = fromAID;
        error.to   = toAID;
        error.photos = photosToMove;
        handleError("[MOVE PHOTOS] Failed to update source album titles after moving photos", error);
    }

    stopMainProgress();
    hideActiveModal();
    stopModalProgress("modal-move");
    clearSelections();

    return true;

}

