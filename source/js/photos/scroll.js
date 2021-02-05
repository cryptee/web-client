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
    hideAlbumDropdownsExcept();
    
}, scrollThrottleTime));

function scrollTop() {
    $("main")[0].scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    activityHappened();
}


function scrollVerticalTo(y) {
    $("main")[0].scrollTo({ top: y, left: 0, behavior: 'smooth' });
    activityHappened();
}


function scrollToItem(id) {
    if (!id) { return; }

    var elemToScrollTo = $("#" + id)[0];
    if (!elemToScrollTo) { return; }

    var offset = $(elemToScrollTo).offset().top;
    var albumOffset = $("#albumContents").offset().top;

    $("main")[0].scrollTo({
        top: (0 - albumOffset) + offset,
        left: 0
    });
}

function setupIntersectionObserver (el) {
    var hasObserver = $(el).hasClass("obsrv");
    if (!hasObserver) {
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

var observer = new IntersectionObserver(onEntryAndExit, intersectionObserverConfig);





function onEntryAndExit(changes) {

    changes.forEach(function (change) {
        var onScreenTimer;
        var wrapperElem = change.target;
        var itemClasses = wrapperElem.classList;
        var thumbImgID  = wrapperElem.getAttribute("thumb");
        var imgElem     = wrapperElem.querySelector("img");
        var thumbToken  = wrapperElem.getAttribute("thumbToken");

        if (itemClasses.contains("content")) {

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
                        getThumbnail(thumbImgID, thumbToken, wrapperElem, imgElem);
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



