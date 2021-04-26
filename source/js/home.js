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

}

////////////////////////////////////////////////
////////////////////////////////////////////////
//	HOTKEYS
////////////////////////////////////////////////
////////////////////////////////////////////////

key('h', function () {
    $("#helpButton > a").trigger("click");
    return false;
});

key('a', function () {
    $("#accountButton > a").trigger("click");
    return false;
});

key('d', function () {
    $(".appButton[app='docs'] > a").trigger("click");
    return false;
});

key('p', function () {
    $(".appButton[app='photos'] > a").trigger("click");
    return false;
});

// force-reinstall/update
key('alt+r', function () {
    showUpdateAvailable();
    reloadForNewVersion();
    return false;
});