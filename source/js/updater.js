////////////////////////////////////////////////
////////////////////////////////////////////////
//	
//
//  UPDATES HANDLER
//
//
////////////////////////////////////////////////
////////////////////////////////////////////////


////////////////////////////////////////////////////
///////////////// DISPLAY VERSION //////////////////
////////////////////////////////////////////////////

// DON'T CHANGE THIS.
// ADDED A CODEKIT BUILD HOOK SHELL SCRIPT THAT REPLACES THIS WITH THE LATEST GITHUB HASH
// WHICH IN RETURN GETS DISPLAYED ON PAGES IF NEEDED. (LIKE ACCOUNT PAGE ETC. TO GET HELP)
// ALSO GETS PASSED TO SENTRY FOR MORE GRANULAR INFO. YAS.

var latestDeployVersion = "local-dev-ver";
$("#cryptee-latest-deploy-version").text("" + latestDeployVersion);


var serverDeployVersion;

checkLatestVersion();

async function checkLatestVersion() {

    // this allows for beta to get updates from beta, and prod from prod.
    var updateOrigin = location.origin;
    
    // get latest deploy version from server. don't trust the current one in cache.
    var now = (new Date()).getTime();

    breadcrumb("[UPDATER] Checking latest version");

    var version = await fetch(updateOrigin + "/v.json?cachebuster=" + now);
    var deployedVersion = await version.json();

    if (!deployedVersion) { return false; }
    serverDeployVersion = deployedVersion.v;

    if (serverDeployVersion !== latestDeployVersion) {
        breadcrumb("[UPDATER] Update available, showing pop-up!");
        // update available
        showUpdateAvailable();
    } else {
        breadcrumb("[UPDATER] Up to date!");
    }
    
    return true;
}


function showUpdateAvailable () {
  $("body").append(renderUpdateCard());
  setTimeout(function () { $("#update-available").addClass("show"); }, 25);
}

function isUpdateAvailable() {
    return $("#update-available").hasClass("show");
}

async function reloadForNewVersion() {
    
    // strangely sometimes serviceWorker passes as undefined 
    // in some versions of FF Linux. This is here as a failsafe
    // just in case since the update bubble covers the whole home screen.
    
    if (!navigator.serviceWorker) {
        updateCompleteLoadNewVersion();
        return true;
    }
    
    $("#update-available").addClass("loading");
    breadcrumb("[UPDATER] Removing old version...");
    breadcrumb("[UPDATER] Getting service worker registration... (will timeout in 15sec)");
    
    var reg; 
    try {
        reg = await promiseTimeout(navigator.serviceWorker.getRegistration(), 15000);
    } catch (error) {
        handleError("[UPDATER] Couldn't get service worker registration", error);
    }
    
    if (!reg || isEmpty(reg)) { 
        updateCompleteLoadNewVersion(); 
        return true; 
    }

    breadcrumb("[UPDATER] Unregistering service worker... (will timeout in 15sec)");
    
    try {
        await promiseTimeout(reg.unregister(), 15000);
    } catch (error) {
        handleError("[UPDATER] Couldn't unregister service worker", error);
        updateCompleteLoadNewVersion(); 
        return true;
    }
    
    breadcrumb("[UPDATER] Getting caches key list...");
    var keyList; 
    try {
        keyList = await caches.keys();
    } catch (error) {
        handleError("[UPDATER] Couldn't get caches keylist", error);
    }

    if (!keyList || isEmpty(keyList)) { 
        updateCompleteLoadNewVersion(); 
        return true; 
    }

    breadcrumb("[UPDATER] Deleting old version...");

    try {
        await Promise.all(
            keyList.map(function (key) { 
                return caches.delete(key).catch((e) => undefined); 
            })
        );
    } catch (error) { handleError("[UPDATER] Couldn't delete old caches", error); }

    breadcrumb("[UPDATER] Deleted old version!");

    updateCompleteLoadNewVersion();
    return true;

}


function updateCompleteLoadNewVersion() {

    breadcrumb("[UPDATER] Reloading for new version!");
    try { sessionStorage.setItem("updateComplete", true); } catch (e) {}

    window.location.href = "/home";

}






////////////////////////////////////////////////
////////////////////////////////////////////////
//	RENDER UPDATES CARD
////////////////////////////////////////////////
////////////////////////////////////////////////

function renderUpdateCard() {
    var card = 
    `<div id="update-available" onclick='reloadForNewVersion();'>
        <img id="logo" src="../assets/logo-b.svg" alt="CRYPTEE">
        <div>
            <h2></h2>
            <p>click here to reload &amp; launch the new version of cryptee</p>
            <br><br><br>
            <b></b>
        </div>
    </div>`;
    return card;
}



