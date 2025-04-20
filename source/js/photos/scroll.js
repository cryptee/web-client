////////////////////////////////////////////////
/////////////////////////////////////////////////
// 	 SCROLL
////////////////////////////////////////////////
////////////////////////////////////////////////

// normally this will be 500, 
// but if user's finger browsing on a touch device
// it will be lowered, so that the timeline updates faster.

var scrollThrottleTime = 500;
if (isTouch) { scrollThrottleTime = 100; }

var scrollStoppedTimeout;
$("main").on('scroll', throttleScroll(function(event) {

    $("main").addClass("scrolling");

    clearTimeout(scrollStoppedTimeout);

    scrollStoppedTimeout = setTimeout(function () {
        $("main").removeClass("scrolling");
        activityHappened();
    }, scrollThrottleTime);

    updateTimelineWithItemsOnScreen();

    hideSorter();
    hidePopup("popup-album-info");
    
}, scrollThrottleTime));

/**
 * Scroll to top of main, and return a promise that resolves once scroll is complete. 
 * We optionally use this promise to do stuff AFTER the scroll is complete. e.g. show edit album name popup
 * @returns Promise that resolves when the scroll has stopped.
 */
async function scrollTop() {
    $("main")[0].scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    activityHappened();
    return new Promise(resolve => { $("main")[0].addEventListener('scrollend', () => { resolve(); }, { once: true }); });
}


function scrollVerticalTo(y) {
    $("main")[0].scrollTo({ top: y, left: 0, behavior: 'smooth' });
    activityHappened();
}


function scrollToItem(id) {
    if (!id) { return; }

    var elemToScrollTo = $("#" + id)[0];
    if (!elemToScrollTo) { return; }

    requestAnimationFrame(() => {
        
        if (isScrolledIntoView(elemToScrollTo)) { return; }

        var offset = $(elemToScrollTo).offset().top;
        var albumOffset = $("#albumContents").offset().top;
        var mainScrollTop = $("main").scrollTop(); 

        var targetScrollTop = mainScrollTop + offset - albumOffset;

        $("main")[0].scrollTo({ top: targetScrollTop, left: 0 });

    });
    
}

function setupIntersectionObserver (el) {
    var hasObserver = $(el).hasClass("obsrv");
    if (!hasObserver && observer) {
        observer.observe(el);
        $(el).addClass("obsrv");
    }
}

var intersectionObserverConfig = { 
    root: $("main")[0], 
    rootMargin: "512px 0px 512px 0px", 
    threshold: 0.1 
};

if (useHighResThumbnails || isTouch) { 
    intersectionObserverConfig.rootMargin = "256px 0px 256px 0px"; 
}

var observer; 
try {
    observer = new IntersectionObserver(onEntryAndExit, intersectionObserverConfig);
} catch (e) {}

if (observer) {
    setSentryTag("intersection-observer", true);
    breadcrumb('[INTERSECTION OBSERVER] Supported.');
} else {
    setSentryTag("intersection-observer", false);
    breadcrumb("[INTERSECTION OBSERVER] Unsupported! Thumbnails won't work.");
    createPopup("Looks like your browser's lacking a feature required for Cryptee Photos to work. Chances are either your browser is configured to block access to IntersectionObserver(s) or your device is too old, and this browser doesn't support the feature. Please disable your content-blockers, try again and or update your device or browser if this issue continues.", "error");
}





function onEntryAndExit(changes) {

    changes.forEach(function (change) {
        var onScreenTimer;
        var wrapperElem = change.target;
        var itemClasses = wrapperElem.classList;
        
        if (itemClasses.contains("content")) {

            var thumbImgID  = wrapperElem.getAttribute("thumb");
            var imgElem     = wrapperElem.querySelector("img");
            var thumbToken  = wrapperElem.getAttribute("thumbToken");
            var isFavAlbum  = wrapperElem.getAttribute("id") === "favorites";
            
            // if (change.intersectionRatio > 0.25) {
            if (change.isIntersecting) {
    
                // ENTERED VIEWPORT & was offscreen
                itemClasses.add('onscreen');
                
                // if it's not loading already, start loading
                if (!itemClasses.contains("loading")) {
                
                    // this controls how quickly we should start loading thumbnails.
                    // too soon, and you'll load too many thumbnails = lose time downloading.
                    // too late, and you'll wait too much for thumbnails to load when they enter screen.
                    // 750 gives a great performance so far.
                
                    onScreenTimer = setTimeout(function () {
                        if (!isFavAlbum) {
                            getThumbnail(thumbImgID, thumbToken, wrapperElem, imgElem);
                        } else {
                            const favImages = wrapperElem.querySelectorAll('img');
                            for (const img of favImages) {
                                const favThumbID = img.getAttribute('thumb');
                                const favThumbToken = img.getAttribute('thumbToken');
                                getThumbnail(favThumbID, favThumbToken, wrapperElem, img);
                            }
                        }
                    }, 750);
            
                }
    
            } else {
                // EXITED VIEWPORT
    
                if (onScreenTimer) { clearTimeout(onScreenTimer); }
    
                // abort download, image left viewport before download has completed
                cancelDownload(thumbImgID);
    
                itemClasses.remove('onscreen');
                itemClasses.remove('loading');
                imgElem.setAttribute("src", "");
            }

        }

    });

}



