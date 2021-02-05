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
$("#cryptee-latest-deploy-version").html("" + latestDeployVersion);


var serverDeployVersion;

checkLatestVersion();

async function checkLatestVersion() {

    // this allows for beta to get updates from beta, and prod from prod.
    var updateOrigin = location.origin;
    
    // get latest deploy version from server. don't trust the current one in cache.
    var now = (new Date()).getTime();

    breadcrumb("[UPDATER] Checking latest version");
    var deployedVersion;

    try {
        var version = await fetch(updateOrigin + "/v.json?cachebuster=" + now);
        deployedVersion = await version.json();
    } catch (error) {
        handleError("[UPDATER] Failed to get the latest version", error);
    }

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
    
    var reg = await navigator.serviceWorker.getRegistration();
    if (!reg) { 
        updateCompleteLoadNewVersion(); 
        return true; 
    }

    await reg.unregister();
    
    var keyList = await caches.keys();
    await Promise.all(keyList.map(function (key) { return caches.delete(key); }));
    
    updateCompleteLoadNewVersion();

    return true;

}


function updateCompleteLoadNewVersion() {

    breadcrumb("[UPDATER] Reloading for new version!");

    window.location.reload();

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



