
////////////////////////////////////////////////
////////////////////////////////////////////////
//	LIGHTBOX
////////////////////////////////////////////////
////////////////////////////////////////////////

var lightbox;
var lbox;

$(document).on('ready', function () {
    lightbox = new Swiper('#lightbox-swipe-container', {
        // Optional parameters
        virtual: true,
        wrapperClass: "lightbox-wrapper",
        keyboard: {
            enabled: true
        },
        preloadImages: false,
        lazy: false,
        zoom: true,
        setWrapperSize: true,
        slidesPerView: 1,
        slidesPerColumn: 1,
        addSlidesBefore: 1,
        addSlidesAfter: 1,
    });

    lbox = lightbox.virtual;

    lightbox.on("zoomChange", lightboxZoomChanged);
});


$("#lightbox-previous").on('click', function(event) {
    lightbox.slidePrev();
    activityHappened();
}); 

$("#lightbox-next").on('click', function(event) {
    lightbox.slideNext();
    activityHappened();
}); 

/**
 * Show lightbox, and optionally animate to a photo id
 * @param {string} [pid] Photo ID to animate
 */
function showLightbox(pid) { 
    
    // if user clicks on the photo that's already open in the lightbox (in the active slide)
    // then we won't get a slide-change event, and therefore won't have a zoom-in animation
    // this is to buffer for that. 
    // if the user clicks, and it's active slide, we call prep photo manually here.
    var currentSlidePID = $(".swiper-slide-active").find("img").attr("pid");
    if (pid === currentSlidePID) { preparePhotoBehindLightbox(pid); }

    $("#lightbox").addClass("show");
    $("#lightbox")[0].addEventListener('swiped-down', function() {  closeLightbox(); }); 
    $("#lightbox")[0].addEventListener('swiped-up', function() {  closeLightbox(); }); 
}

function hideLightbox() {
    $("#lightbox")[0].removeEventListener('swiped-down', function() {  closeLightbox(); }); 
    $("#lightbox")[0].removeEventListener('swiped-up', function() {  closeLightbox(); }); 

    $("#lightbox").removeClass("show");
    $(".in-lightbox").removeClass("in-lightbox");
    hidePopup("popup-photo-info");
}

/**
 * This prepares the photo behind the lightbox (zooms in & slides to photo) so that when user's opening lightbox, we zoom into photo, 
 * and when user's closing lightbox we zoom out from it
 * @param {String} pid Photo ID to highlight/prepare behind the lightbox
 */
function preparePhotoBehindLightbox(pid) {
    if (!pid) { return; }

    $(".in-lightbox").removeClass("in-lightbox");

    var photo = $("#" + pid);

    if (!photo.length) { return; } // photo doesn't exist in DOM. abort here, or you'll get undefined in offset, and this whole thing crashes.

    var photoOffsetLeft = photo.offset().left;
    var photoOffsetTop = photo.offset().top + $("main").scrollTop();
    var photoOffsetWidthAndHeight = photo.offset().width; // we know it's 16rem = 256px, and will be 2x but depending on how "rem" is interpreted, it's safer to read it
    var ww = $(window).width();
    var wh = $(window).height();

    // each photo is 16rem, and scales up 2x so to center it we'll need to move them to : 
    // x = half the window's width - photo width;
    // y = half the window's height - photo height;
    
    var targetX = (ww / 2) - (photoOffsetWidthAndHeight / 2);
    var targetY = (wh / 2) - (photoOffsetWidthAndHeight / 2) + $("main").scrollTop();

    // and we'll need to move them from their current offset, by calculating the difference.
    var xDifference = targetX - photoOffsetLeft;
    var yDifference = targetY - photoOffsetTop;

    $("#" + pid)[0].style.setProperty("--xTransitionToCenter", xDifference + "px");
    $("#" + pid)[0].style.setProperty("--yTransitionToCenter", yDifference + "px");
    
    // it's okay if we don't remove these, css resets their transform to 0 anyway.
    $("#" + pid).addClass("in-lightbox");
    
    setTimeout(function () { scrollToItem(pid); }, 300);
}

/**
 * Gets a photo's index from the dom (and slider mimics the dom, so this should be good)
 * @param {string} pid PhotoID
 * @returns {number} photoIndex
 */
function getPhotoIndex(pid) {
    if (!pid) { return 0; }
    return $(".photo").index("#"+pid);
}

/**
 * Gets triggered when the photo in lighbox changes
 */
function lightboxPhotoChanged() {

    // wait 50ms to make sure virtual DOM is reflected correctly in real DOM
    // all because injecting inline b64 takes time...
    // then check if previous & next slides have image, if not, load them.
    setTimeout(function () {
        
        hidePopup("popup-photo-info");

        pid = $(".swiper-slide-active").find("img").attr("pid");
        
        if (!isios && !isipados) { history.pushState(pid, null, '/photos?photo='+pid); }

        activePhotoID = pid;
        var thisPhoto = $("#" + pid);
        var nextPhotoID;
        var prevPhotoID;

        // this will scroll to element behind the lightbox & zoom in
        // so that 
        // a) when the user closes lightbox, they'll be where they left.
        // b) we can ensure that the next slide's thumbnail is always loaded.
        // c) the photo is zoomed in, so if you're entering lightbox, we get a zoomin animation, and exiting, a zoom-out animation
        // (we take next slide thumbs from the gallery, so if the thumb isn't loaded, we won't have a next slide thumb)  
        preparePhotoBehindLightbox(pid);

        // decrypt & load the photo's description to lightbox
        // this happens in async
        loadPhotoDescriptionToLightbox(pid); 

        var nextPhoto = thisPhoto.next(".photo");
        if (nextPhoto.length) {
            nextPhotoID = nextPhoto.attr("id");
            preloadLightboxImage(nextPhotoID);
            $("#lightbox-next").removeClass("disabled");
        } else {
            $("#lightbox-next").addClass("disabled");
        }
        
        var prevPhoto = thisPhoto.prev(".photo");
        if (prevPhoto.length) {
            prevPhotoID = prevPhoto.attr("id");
            preloadLightboxImage(prevPhotoID);
            $("#lightbox-previous").removeClass("disabled");
        } else {
            $("#lightbox-previous").addClass("disabled");
        }

        if (favorites[pid]) {
            $("#lightbox-favorite").addClass("fav");
        } else {
            $("#lightbox-favorite").removeClass("fav");
        }     

        activityHappened();
    }, 50);

}

async function loadPhotoDescriptionToLightbox(pid){

    if (!pid) { return false; }
    if (isEmpty(photos[pid])) { return false; }

    breadcrumb('[LIGHTBOX] Will try loading photo description');
    var plaintextDescription = await decryptPhotoDescription(pid);
    if (!plaintextDescription) { return false; }

    $(`.swiper-zoom-container[pid='${pid}']`).attr("description", plaintextDescription);

    breadcrumb('[LIGHTBOX] Loaded Photo Description');

    return true;
}

/**
 * Checks if the image is already in the lightbox cache
 * @param {string} pid photo ID
 */
function isImgInLightboxCache(pid) {
    var inCache = false;
    var slideIndex = getPhotoIndex(pid);
    if (lbox.cache && $(lbox.cache[slideIndex]).find("img").attr("loaded")) {
        inCache = true;
    }

    return inCache;
}


/**
 * Adds an image to the lightbox's DOM if it's not already in lightbox's virtual dom cache
 * @param {string} id image id (thumb / original etc)
 * @param {string} dataURL 
 */
function addImageToLightboxDOMIfNotAlreadyInCache(id, dataURL) {
    if (!isImgInLightboxCache(id)) {
        $(`.lbox-photo[pid='${id}']`).attr({
            "src" : dataURL,
            "loaded" : "1"
        });
        setTimeout(function () { lbox.update(); }, 10);
    }

    stopLightboxProgress();
}


/**
 * Preloads a photo for lightbox ahead of time 
 * @param {string} pid photo id
 */
async function preloadLightboxImage(pid) {

    if (!pid) { return false; }

    startLightboxProgress();

    var thumbID = convertID(pid, "t");

    if (isImgInLightboxCache(pid)) {
        // already in cache, don't download & decrypt.
        stopLightboxProgress();
        return true;
    }

    var imgDataURL;
    
    try {
        if (extensionOfPhoto(pid) === "gif") {
            if (pid.endsWith("-v3")) {
                var imgBlob = await getPhoto(pid, "p");
                imgDataURL = blobToObjectURL(imgBlob);
            } else {
                imgDataURL = await getPhoto(pid, "p");
            }
        } else {
            imgDataURL = await getPhoto(pid, "l");
        }
    } catch (error) {
        handleError('[PRELOAD PHOTO] Failed to download/decrypt photo ('+pid+').');
        return false; 
    }

    
    // if for some reason we fail to get the large size let's use the thumb size, better this than nothing
    imgDataURL = imgDataURL || $("img[thumb='"+thumbID+"']").attr("src");
    
    // if photo is in cache, and in fact in the swiper, there's no need to add it again. 
    addImageToLightboxDOMIfNotAlreadyInCache(pid, imgDataURL);

    stopLightboxProgress();
}


/**
 * closes lightbox
 */
function closeLightbox() {
    
    activePhotoID = null;
    
    hideLightbox();

    if (!isios && !isipados) {
        if (activeAlbumID === "home") {
            history.pushState("home", null, '/photos');
        } else if (activeAlbumID === "favorites") {
            history.pushState("favorites", null, '/photos?favorites');
        } else {
            history.pushState(activeAlbumID, null, '/photos?album='+activeAlbumID);
        }
    }

    exitFullscreen();
    activityHappened();
}




/**
 * Gets triggered when lightbox's zoom changes 
 */
function lightboxZoomChanged(event, scale) {
    
    $("#lightbox")[0].removeEventListener('swiped-down', function() {  closeLightbox(); }); 
    $("#lightbox")[0].removeEventListener('swiped-up', function() {  closeLightbox(); }); 
    
    // pinch in (zoom out) triggers swipedown, so we're only going to enable this once zoom gets back to 1
    if (scale === 1) {
        setTimeout(function () {
            $("#lightbox")[0].addEventListener('swiped-down', function() {  closeLightbox(); }); 
            $("#lightbox")[0].addEventListener('swiped-up', function() {  closeLightbox(); }); 
        }, 25);
    }

    activityHappened();
}

/**
 * Updates the sort order of lightbox if the album's sort order changes, to keep up with the order of things 
 * @param {('az-asc'|'az-desc'|'date-asc'|'date-desc')} sorttype        
 */
function updateLightboxSort(sorttype) {
    sorttype = sorttype || "date-desc";

    // remove all lightbox events to stop thousands of slideChange events from triggering.
    // and remove all slides from lightbox 
    try { lightbox.off('slideChange'); } catch (e) {}
    lbox.removeAllSlides(); 
  
    var lightboxContentsHTML = [];

    $(".content.photo").each(function(){
       var pid = $(this).attr("id"); 
       lightboxContentsHTML.push(`<div class='swiper-zoom-container' pid='${pid}'><img class="lbox-photo" pid='${pid}' draggable='false' src=""/></div>`);
    });

    lbox.appendSlide(lightboxContentsHTML);
    lbox.update();

    setTimeout(function () {
        // now that all slides are in the lightbox, start listening for slideChange again.
        lightbox.on('slideChange', lightboxPhotoChanged); 
    }, 10);
}

