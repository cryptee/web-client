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
        $(".appButton[app='upgrade']").show();  
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
    
    $(".appButton[app='install']").show();

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
//	GET LATEST NEWS
////////////////////////////////////////////////
////////////////////////////////////////////////

async function getLatestNews() {
    
    var lastReadNews;
    try { lastReadNews = localStorage.getItem("news"); } catch (e) {}

    var latestNewsID;
    try {
        latestNewsID = (await axios.get(apiROOT + "/api/news")).data;
    } catch (e) {
        handleError("Couldn't fetch latest news", e);
    }

    if (latestNewsID) {
        if (lastReadNews !== latestNewsID) { 
            $(".newsButton").addClass("unread"); 
            $(".newsButton").attr("hash", latestNewsID); 
        }
    }
    
}

function markNewsRead() {
    
    var newsHash = $(".newsButton").attr("hash");
    try { localStorage.setItem("news", newsHash); } catch (e) {}
    $(".newsButton").removeClass("unread"); 

}

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

    $(".appButton[app='docs'] > a").trigger("click");
    return false;
});

key('p', function () {
    // update first if necessary
    if (isUpdateAvailable()) { reloadForNewVersion(); return false; }

    $(".appButton[app='photos'] > a").trigger("click");
    return false;
});

// force-reinstall/update
key('alt+r', function () {
    showUpdateAvailable();
    reloadForNewVersion();
    return false;
});