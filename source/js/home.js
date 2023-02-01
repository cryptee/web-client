////////////////////////////////////////////////
////////////////////////////////////////////////
//	ALL HOME SCREEN FUNCTIONS
////////////////////////////////////////////////
////////////////////////////////////////////////

var newSignup = false;
try { newSignup = sessionStorage.getItem("newsignup"); } catch (e) {}

if (newSignup) {     
    firstTimeHome(); 
} else {
    secondTimeHome();
}

checkForPWAAndDisplayInstallationButton();

////////////////////////////////////////////////
////////////////////////////////////////////////
//	AUTHENTICATE
////////////////////////////////////////////////
////////////////////////////////////////////////

authenticate(function(user){
    // LOGGED IN    
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
//	FIRST TIME HOME / SECOND TIME HOME ETC...
////////////////////////////////////////////////
////////////////////////////////////////////////


/**
 * Runs all the errands for a first time user ...
 */
function firstTimeHome() {

}


/**
 * Runs all the errands for a continued user ... i.e. show upgrade button
 */
function secondTimeHome() {

    if (!theUserPlan || theUserPlan === "free") { 
        // show upgrade button for continued users
        $(".actionButton[app='upgrade']").show();
        $(".actionButton[app='upgrade']").addClass("willBeShown");  
    }

    getLatestNews();

}

function checkForPWAAndDisplayInstallationButton() {
    if (isInstalled)            { return; } // already in PWA
    if (!isMobile && !isipados) { return; } // on desktop
    
    // firefox on android has a bug, it doesn't report display-mode correctly, so we can't detect if Cryptee is a PWA on android firefox. 
    // seriously guys WTF this was working and it's broken again. 
    // https://github.com/mozilla-mobile/android-components/issues/8584
    // https://github.com/mozilla-mobile/fenix/issues/10252
    // at this point, fuck it, I legit just want to stop recommending android firefox. ffs.
    if (isFirefox && isAndroid) { return; }
    
    $(".actionButton[app='install']").show();
    $(".actionButton[app='install']").addClass("willBeShown");

    if (isios || isipados) {
        if (isSafari) { 
            $("#install-on-ios-safari").show(); 
        } else {
            $("#install-on-ios-other").show(); 
        }
    } else {   
        $("#install-on-other").show();
    }
    
}

$("#button-why").on('click', function(event) { $(this).toggleClass("open"); }); 

////////////////////////////////////////////////
////////////////////////////////////////////////
//	UPDATE COMPLETED
////////////////////////////////////////////////
////////////////////////////////////////////////

var updateComplete;

try { 
    
    updateComplete = sessionStorage.getItem("updateComplete"); 
    
    if (updateComplete) { 
        updateCompletedSuccessfully(); 
    }

} catch (e) {}

function updateCompletedSuccessfully() {
    
    try { sessionStorage.removeItem("updateComplete"); } catch (e) {}

    breadcrumb("[UPDATER] Successfully updated to: " + latestDeployVersion);

    getLatestNews(true);

}

////////////////////////////////////////////////
////////////////////////////////////////////////
//	GET LATEST NEWS / MARK NEWS READ
////////////////////////////////////////////////
////////////////////////////////////////////////

async function getLatestNews(forceShowNewsCard) {
    
    forceShowNewsCard = forceShowNewsCard || false;

    var latestNews = {};
    
    try {
        latestNews = (await axios.get(apiROOT + "/api/news")).data;
    } catch (e) {
        handleError("Couldn't fetch latest news", e);
    }
    
    if (isEmpty(latestNews)) { return; }
    if (!latestNews.id) { return; }
    
    
    var newsID      = latestNews.id;
    var newsURL     = DOMPurify.sanitize(latestNews.url, { ALLOWED_TAGS: [] });
    // var newsTitle   = DOMPurify.sanitize(latestNews.title, { ALLOWED_TAGS: [] });
    var newsExcerpt = DOMPurify.sanitize(latestNews.excerpt, { ALLOWED_TAGS: [] });
    
    $(".newsButton").attr("hash", newsID); 
    $("#news-card").find("p").text(newsExcerpt);
    $("#news-card").find("a.more").attr("href", newsURL + "#to-cryptee");
    
    if (lastReadNews !== newsID || forceShowNewsCard) { showLatestNewsCard(); }

}

async function markNewsRead() {
    
    var newsHash = $(".newsButton").attr("hash");
    
    // mark locally
    try { localStorage.setItem("news", newsHash); } catch (e) {}
    
    breadcrumb('[NEWS] Hiding news card...');
    breadcrumb('[NEWS] Marking news read...');

    $(".newsButton").removeClass("unread"); 
    $("body").removeClass("show-news");

    // mark on server
    await api("user-readnews", {}, { newsID : newsHash }, "POST");

    breadcrumb('[NEWS] Marked news read.');

}

function showLatestNewsCard() {
    breadcrumb('[NEWS] Displaying news card. ');
    $("body").addClass("show-news");
}

$("#news-card > div")[0].addEventListener('swiped-down', markNewsRead);

////////////////////////////////////////////////
////////////////////////////////////////////////
//	HOTKEYS
////////////////////////////////////////////////
////////////////////////////////////////////////

key('h', function () {
    // update first if necessary
    if (isUpdateAvailable()) { reloadForNewVersion(); return false; }

    $("#helpButton > a").trigger("click");
    return false;
});

key('a', function () {
    // update first if necessary
    if (isUpdateAvailable()) { reloadForNewVersion(); return false; }

    $("#accountButton > a").trigger("click");
    return false;
});

key('d', function () {
    // update first if necessary
    if (isUpdateAvailable()) { reloadForNewVersion(); return false; }

    $(".appButton[app='docs']").trigger("click");
    return false;
});

key('p', function () {
    // update first if necessary
    if (isUpdateAvailable()) { reloadForNewVersion(); return false; }

    $(".appButton[app='photos']").trigger("click");
    return false;
});

key('u', function () {
    // update first if necessary
    if (isUpdateAvailable()) { reloadForNewVersion(); return false; }

    $(".actionButton[app='upgrade']").trigger("click");
    return false;
});

key('s', function () {
    // update first if necessary
    if (isUpdateAvailable()) { reloadForNewVersion(); return false; }

    $("#accountButton > a").trigger("click");
    return false;
});

key('n', function () {
    // update first if necessary
    if (isUpdateAvailable()) { reloadForNewVersion(); return false; }

    $("#topNewsButton").trigger("click");
    return false;
});

key('esc', function () {
    $("#news-card > div > .close").trigger("click");
    return false;
});

// force-reinstall/update
key('alt+r', function () {
    showUpdateAvailable();
    reloadForNewVersion();
    return false;
});