
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
        watchSlidesProgress : true,
        effect : "slide",
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
    if (pid === currentSlidePID) { prepareThumbnailBehindLightbox(pid); }

    $("#lightbox").addClass("show");
    $("#lightbox")[0].addEventListener('swiped-down', function() {  closeLightbox(); }); 
    $("#lightbox")[0].addEventListener('swiped-up', function() {  closeLightbox(); }); 
    resetAllVideos();
}

function hideLightbox() {
    $("#lightbox")[0].removeEventListener('swiped-down', function() {  closeLightbox(); }); 
    $("#lightbox")[0].removeEventListener('swiped-up', function() {  closeLightbox(); }); 

    $("#lightbox").removeClass("show video");
    $(".in-lightbox").removeClass("in-lightbox");
    hidePopup("popup-photo-info");
    resetAllVideos();
}

/**
 * This prepares the photo behind the lightbox (zooms in & slides to photo) so that when user's opening lightbox, we zoom into photo, 
 * and when user's closing lightbox we zoom out from it
 * @param {String} pid Photo ID to highlight/prepare behind the lightbox
 */
function prepareThumbnailBehindLightbox(pid) {
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
function getMediaIndex(pid) {
    if (!pid) { return 0; }
    return $(".media").index("#"+pid);
}

/**
 * Gets triggered when the photo in lighbox changes
 */
function lightboxMediaChanged() {

    // wait 50ms to make sure virtual DOM is reflected correctly in real DOM
    // all because injecting inline b64 takes time...
    // then check if previous & next slides have image, if not, load them.
    setTimeout(function () {
        
        hidePopup("popup-photo-info");
        hideActiveModal();
        clearSelections();
        
        var pid = $(".swiper-slide-active").find("img").attr("pid") || $(".swiper-slide-active").find("video").attr("pid");
        
        // failsafe.
        if (!pid) { return; }

        if (!isios && !isipados) { history.pushState(pid, null, '/photos?photo='+pid); }

        var thisMedia = $("#" + pid);
        var nextMediaID;
        var prevMediaID;

        // this will scroll to element behind the lightbox & zoom in
        // so that 
        // a) when the user closes lightbox, they'll be where they left.
        // b) we can ensure that the next slide's thumbnail is always loaded.
        // c) the photo is zoomed in, so if you're entering lightbox, we get a zoomin animation, and exiting, a zoom-out animation
        // (we take next slide thumbs from the gallery, so if the thumb isn't loaded, we won't have a next slide thumb)  
        prepareThumbnailBehindLightbox(pid);

        // decrypt & load the photo's description to lightbox
        // this happens in async
        loadMediaDescriptionToLightbox(pid); 

        // VIDEO RELATED LOADING
        resetAllVideos();
        $("#lightbox").toggleClass("video", pid.startsWith("v-"));
        videoEnteredLightbox(pid);

        // if it's not a video, and photo is already in cache, stop progress = photo loaded
        if (!pid.startsWith("v-") && isMediaInLightboxCache(pid)){ 
            stopLightboxProgress();
        }

        var nextPhoto = thisMedia.next(".media");
        if (nextPhoto.length) {
            nextMediaID = nextPhoto.attr("id");
            preloadLightboxImage(nextMediaID);
            $("#lightbox-next").removeClass("disabled");
        } else {
            $("#lightbox-next").addClass("disabled");
        }
        
        var prevPhoto = thisMedia.prev(".media");
        if (prevPhoto.length) {
            prevMediaID = prevPhoto.attr("id");
            preloadLightboxImage(prevMediaID);
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

async function loadMediaDescriptionToLightbox(pid){

    if (!pid) { return false; }
    if (isEmpty(photos[pid])) { return false; }

    breadcrumb('[LIGHTBOX] Will try loading photo description');
    var plaintextDescription = await decryptPhotoDescription(pid);
    if (!plaintextDescription) { return false; }

    $(`.swiper-zoom-container[pid='${pid}']`).attr("description", plaintextDescription);
    $(`.swiper-video-container[pid='${pid}']`).attr("description", plaintextDescription);

    breadcrumb('[LIGHTBOX] Loaded Photo Description');

    return true;
}

/**
 * Checks if the image is already in the lightbox cache
 * @param {string} pid photo ID
 */
function isMediaInLightboxCache(pid) {
    var inCache = false;
    var slideIndex = getMediaIndex(pid);
    if (lbox.cache && ($(lbox.cache[slideIndex]).find("img").attr("loaded") || $(lbox.cache[slideIndex]).find("video").attr("poster"))) {
        inCache = true;
    }

    return inCache;
}

function isVideoInLightboxCache(pid) {
    var inCache = false;
    var slideIndex = getMediaIndex(pid);
    if (lbox.cache && $(lbox.cache[slideIndex]).find("video").attr("loaded")) {
        inCache = true;
    }

    return inCache;
}


/**
 * Adds a photo / video to the lightbox's DOM if it's not already in lightbox's virtual dom cache
 * @param {string} id image id (thumb / original etc)
 * @param {string} dataURL 
 */
function addMediaToLightboxDOMIfNotAlreadyInCache(id, dataURL) {
        
    if (!isMediaInLightboxCache(id)) {
        if (id.startsWith("v-")) {
            $(`.lbox-video[pid='${id}']`).attr({ "poster" : dataURL });
        } else {
            $(`.lbox-photo[pid='${id}']`).attr({ "src" : dataURL, "loaded" : "1" });
        }
        setTimeout(function () { lbox.update(); }, 10);
        // setTimeout(function () { revokeObjectURL(dataURL); }, 100);
    }

    // for videos, we have to keep progress running, since after the poster image we'll start loading videos
    if (id.startsWith("v-")){ 
        startLightboxProgress();
    } else {
        if (id === activePhotoID()) {
            stopLightboxProgress(); 
        }
    }

}


/**
 * Preloads a photo for lightbox ahead of time 
 * @param {string} pid photo id
 */
async function preloadLightboxImage(pid) {

    if (!pid) { return false; }

    startLightboxProgress();

    var thumbID = convertID(pid, "t");

    if (isMediaInLightboxCache(pid)) {
        // already in cache, don't download & decrypt.

        // for videos, we have to keep progress running, since after the poster image we'll start loading videos
        // so if it's not a video, stop progress
        // or if it's a video, but it's loaded, stop progress
        if (!pid.startsWith("v-") || !isEmpty(loadedVideos[pid])){ 
            stopLightboxProgress(); 
        } 

        return true;
    }

    var imgDataURL;
    
    try {
        if (extensionOfPhoto(pid) === "gif") {
            imgDataURL = await getMedia(pid, "p", "url");
        } else {
            imgDataURL = await getMedia(pid, "l", "url");
        }
    } catch (error) {
        handleError('[PRELOAD PHOTO] Failed to download/decrypt photo ('+pid+').');
        return false; 
    }

    
    // if for some reason we fail to get the large size let's use the thumb size, better this than nothing
    imgDataURL = imgDataURL || $("img[thumb='"+thumbID+"']").attr("src");
    
    // if photo is in cache, and in fact in the swiper, there's no need to add it again. 
    // this calls stop lightbox progress
    addMediaToLightboxDOMIfNotAlreadyInCache(pid, imgDataURL);

}


/**
 * closes lightbox
 */
function closeLightbox() {
    
    hideLightbox();
    hideActiveModal();
    
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

    $(".content.media").each(function(){
       var pid = $(this).attr("id"); 
       lightboxContentsHTML.push(renderLightboxMedia(pid));
    });

    lbox.appendSlide(lightboxContentsHTML);
    lbox.update();

    setTimeout(function () {
        // now that all slides are in the lightbox, start listening for slideChange again.
        lightbox.on('slideChange', lightboxMediaChanged); 
    }, 10);
}




////////////////////////////////////////////////
////////////////////////////////////////////////
//	VIDEO PLAYER
////////////////////////////////////////////////
////////////////////////////////////////////////

var loadedVideos = {};

/**
 * Once the video is visible in the lightbox, this function starts loading it
 * @param {String} id 
 */
async function videoEnteredLightbox(id) {
    
    // only for videos ofc
    if (!id.startsWith("v-")) { return; }

    // don't download / decrypt video if it's already in lightbox cache
    // instead play it if it's already cached. 
    
    if (!isVideoInLightboxCache(id)) {
        
        startLightboxProgress();
        
        var mediaDataURL = await getMedia(id, "v", "url");
        var video = $(`.lbox-video[pid='${id}']`);
        video.find("source").attr({ "src" : mediaDataURL });
        video.attr({ "loaded" : "1" });

        if (video) {
            video[0].load();
            loadedVideos[id] = { video : video[0] };
            startListeningToVideoEvents(id);
            calculateVideoProgress();
        }
        
    } else {
        
        loadedVideos[id].video.currentTime = 0;
        loadedVideos[id].video.play();
        calculateVideoProgress();
        
    }
    
    await new Promise(resolve => loadedVideos[id].video.addEventListener('loadedmetadata', resolve));
    await new Promise(resolve => loadedVideos[id].video.addEventListener('loadeddata', resolve));
    calculateVideoProgress();

    useActiveVideoInMediaSession();

    stopLightboxProgress();

}

function startListeningToVideoEvents(id) {
    
    var videoID = id; // storing in a new variable to make it possible to pass into the listeners' callbacks below

    if (isEmpty(loadedVideos[videoID])) { 
        resetVideo(videoID);
        return; 
    }

    var video = loadedVideos[videoID].video;
    
    // if user navigated away already, don't play this video
    if (!isVideoActive(videoID)) {
        resetVideo(videoID);
        return;
    }
    
    video.addEventListener('play', function()  { videoOnPlay(videoID); }, false);
    video.addEventListener('pause', function() { videoOnPause(videoID); }, false);
    video.addEventListener('volumechange', function() { videoOnVolumeChange(videoID); }, false);

}


/**
 * Helps figure out if a video is active/on-screen or not
 * @param {String} id 
 * @returns {Boolean} isActive
 */
function isVideoActive(id) { 
    if (isEmpty(loadedVideos[id])) { return false; }
    return $(loadedVideos[id].video).parents(".swiper-slide").hasClass("swiper-slide-active"); 
}

/**
 * Called by a video element when video starts playing,
 * @param {String} id 
 */
function videoOnPlay(id) {
    if (isVideoActive(id)) { 
        $("#lightbox-playpause").toggleClass("playing", true); 
        try { navigator.mediaSession.playbackState = 'playing'; } catch (e) {}
    } 
}

/**
 * Called by a video element when the video is paused
 * @param {String} id 
 */
function videoOnPause(id) {
    if (isVideoActive(id)) { 
        $("#lightbox-playpause").toggleClass("playing", false); 
        try { navigator.mediaSession.playbackState = 'paused'; } catch (e) {}
    } 
}


function videoOnVolumeChange(id) {
    if (isEmpty(loadedVideos[id])) { return false; }

    if (isVideoActive(id)) {
        var video = loadedVideos[id].video;
        $("#lightbox-volume").toggleClass("muted", video.muted);
    }
}


/**
 * Pauses and resets a video to time=0
 * @param {String} id 
 */
function resetVideo(id) {
    if (isEmpty(loadedVideos[id])) { return false; }
    
    var video = loadedVideos[id].video;
    video.pause();
    video.currentTime = 0;
}

/**
 * Cycles through and resets all videos (pauses/ and resets to time=0 i.e. when lightbox is getting closed / changing slides etc)
 * @param {String} id 
 */
function resetAllVideos() {
    for (const id in loadedVideos) { resetVideo(id); }
    $("#lightbox-playpause").toggleClass("playing", false);
}

function playPauseActiveVideo() {
    if (!activePhotoID().startsWith("v-")) { return true; }
    
    if (isEmpty(loadedVideos[activePhotoID()])) { return true; }

    var video = loadedVideos[activePhotoID()].video;
    
    if (!video) { return true; }

    if (video.paused || video.ended) {
        video.play();
    } else {
        video.pause();
    }
}

$("#lightbox").on('click', 'video', playPauseActiveVideo);

function muteUnmuteActiveVideo() {

    if (!activePhotoID().startsWith("v-")) { return true; }

    if (isEmpty(loadedVideos[activePhotoID()])) { return true; }

    var video = loadedVideos[activePhotoID()].video;
    
    if (video.muted) {
        video.muted = false;
    } else {
        video.muted = true;
    }

}

function currentTimeOfVideo(id) {

    if (!loadedVideos[id]) { return 0; }

    if (isEmpty(loadedVideos[id])) { return 0; }

    var video = loadedVideos[id].video;

    if (!video) { return 0; }
    
    return parseInt(video.currentTime || 0); 

}

function playVideoFrom(clickedTime) {
    
    // only for active videos

    var activeID = activePhotoID() || "";
    if (!activeID.startsWith("v-")) { return true; }

    if (isEmpty(loadedVideos[activePhotoID()])) { return true; }

    var video = loadedVideos[activePhotoID()].video;
    video.currentTime = parseInt(clickedTime) || 0;
    video.play();
    
}

function calculateVideoProgress() {
    
    if (!activePhotoID()) { return; }
    if (isEmpty(loadedVideos[activePhotoID()])) { return; }
    
    var video = loadedVideos[activePhotoID()].video;
    
    if (!video) { return; }

    $("#lightbox-player-progress").empty();
    
    var ct = video.currentTime || 0;
    var du = video.duration || 0;
    var pr = video.playbackRate || 0;
    
    var lightboxPlayerProgressStyle = window.getComputedStyle($("#lightbox-player-progress")[0], null);
    var playerWidth = parseInt(lightboxPlayerProgressStyle.getPropertyValue("width"));

    var noProgressDots = playerWidth / 24;
    
    var durationPerDot = du / noProgressDots;
    
    var dot = 0;
    
    while (dot <= noProgressDots) {
        
        var dotDuration = parseInt(durationPerDot * dot);
        
        if (dotDuration < du) {
            var dotHTML = `<b p="${dotDuration}"></b>`;
            $("#lightbox-player-progress").append(dotHTML);
        }

        dot++;
    }
    
    setTimeout(function () { 
        $("#lightbox-player-progress").attr("time", currentTimeOfVideo(activePhotoID())); 
        // SETTING THESE FUCK UP MEDIA CONTROLS FOR OSX / CHROME. SKIP FOR NOW. 
        // if ("mediaSession" in navigator) { navigator.mediaSession.setPositionState({ duration: du, playbackRate: pr, position: ct }); }
    }, 500);

}

var lightboxResizeTimeout;
$(window).on('resize', function(event) {
    
    clearTimeout(lightboxResizeTimeout);
    
    if ($("#lightbox").hasClass("show")) {
        lightboxResizeTimeout = setTimeout(calculateVideoProgress, 100);
    }
    
}); 

function updateVideoProgress() {
    
    // only for active videos
    var activeID = activePhotoID() || "";
    if (!activeID.startsWith("v-")) { return true; }
    
    var ct = currentTimeOfVideo(activeID);
    $("#lightbox-player-progress").attr("time", ct);

    var nextProgressItem = $("#lightbox-player-progress").find("b").filter(function() { return $(this).attr("p") <= ct; });
    var currentProgressItem = nextProgressItem.prev();
    
    if (currentProgressItem) { 
        currentProgressItem.addClass("played");
        $("#lightbox-player-progress > b").not(currentProgressItem).removeClass("played");
    }
    
}

var videoProgressInterval = setInterval(updateVideoProgress, 1000);

$("#lightbox-player-progress").on('click', 'b', function(event) {
    var clickedTime = $(this).attr("p") || 0;
    playVideoFrom(clickedTime);
});  

function useActiveVideoInMediaSession() {
    var id = activePhotoID();
    var videoTitle = photos[id].decryptedTitle || "Untitled.mp4";
    var videoThumbnailURL = $(`.lbox-video[pid='${id}']`).attr("poster");
    setMediaSessionAPIMetadata(videoTitle, videoThumbnailURL, "image/jpg");
}

// SETTING THESE FUCK UP MEDIA CONTROLS FOR OSX / CHROME. SKIP FOR NOW. 
// if ("mediaSession" in navigator) {
    // var defaultSkipTime = 1; // 1 second default skip time

    // navigator.mediaSession.setActionHandler('play', playPauseActiveVideo);
    // navigator.mediaSession.setActionHandler('pause', playPauseActiveVideo);

    // navigator.mediaSession.setActionHandler('seekbackward', (details) => {
    //     playVideoFrom(Math.max(video.currentTime - (details.seekOffset || defaultSkipTime), 0));
    // });
    
    // navigator.mediaSession.setActionHandler('seekforward', (details) => {
    //     playVideoFrom(Math.min(video.currentTime + (details.seekOffset || defaultSkipTime), 0));
    // });

    // navigator.mediaSession.setActionHandler('seekto', (details) => { playVideoFrom(details.seekTime); });
// }