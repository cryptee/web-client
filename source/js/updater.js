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

// DON'T CHANGE THESE TWO.

// ADDED A CODEKIT BUILD HOOK SHELL SCRIPT THAT REPLACES THIS WITH THE LATEST GITHUB HASH
// WHICH IN RETURN GETS DISPLAYED ON PAGES IF NEEDED. (LIKE ACCOUNT PAGE ETC. TO GET HELP)
// ALSO GETS PASSED TO SENTRY FOR MORE GRANULAR INFO. YAS.

var latestDeployVersion = "local-dev-ver";


$("#cryptee-latest-deploy-version").text("" + latestDeployVersion);

var serverDeployVersion;
var numberOfFilesInTheServerDeployVersion = 0;

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
    numberOfFilesInTheServerDeployVersion = parseInt(deployedVersion.nf) || 0;

    if (serverDeployVersion !== latestDeployVersion) {
        breadcrumb("[UPDATER] Update available, showing pop-up!");
        
        // update available
        showUpdateAvailable(numberOfFilesInTheServerDeployVersion);
    } else {
        breadcrumb("[UPDATER] Up to date!");
    }
    
    return true;
}


function showUpdateAvailable(numberOfFilesInTheServerDeployVersion) {
    $("body").append(renderUpdateCard(numberOfFilesInTheServerDeployVersion));
    setTimeout(function () { $("#update-available").addClass("show"); }, 25);
}

function isUpdateAvailable() {
    return $("#update-available").hasClass("show");
}

async function reloadForNewVersion() {
    
    breadcrumb("[UPDATER] User clicked on update!");

    // strangely sometimes serviceWorker passes as undefined 
    // in some versions of FF Linux. This is here as a failsafe
    // just in case since the update bubble covers the whole home screen.
    
    if (!navigator.serviceWorker) {
        updateCompleteLoadNewVersion();
        return true;
    }
    
    $("#update-available").addClass("loading");
    
    breadcrumb("[UPDATER] Getting caches key list...");

    // we do this here as a short-circuit cheat. 
    // if we can't open caches here, we can skip the rest of this whole thing,
    // since the next function (checkInstallationStatus) will try and keep opening the serverDeployVersion cache and count the number of keys in there every x seconds.
    // if the worker is slow or hasn't started installing yet, the cache may not even exist, so erroring out in the next function doesn't mean we can't access caches.
    // so by checking if we can use caches, and aborting early, allows us to ignore errors in the next function

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

    breadcrumb("[UPDATER] Installing new version...");

    await checkInstallationStatus();

    breadcrumb("[UPDATER] All the new files are installed! Starting to delete old versions. ");


    try {
        await Promise.all(
            keyList.map(function (key) { 
                if (key !== serverDeployVersion) {
                    return caches.delete(key).catch((e) => undefined); 
                }
            })
        );
    } catch (error) { handleError("[UPDATER] Couldn't delete old caches", error); }

    breadcrumb("[UPDATER] Deleted old version!");
    
    updateCompleteLoadNewVersion();
    return true;

}


async function updateCompleteLoadNewVersion() {
    breadcrumb("[UPDATER] Reloading for new version!");
    try { sessionStorage.setItem("updateComplete", true); } catch (e) { }
    window.location.href = "/home";
    return true;
}


var installedFilesCount = 0;
var installationTimeoutCounter = 0;
var numberOfInstalledFilesLastTimeWeChecked = 0;
async function checkInstallationStatus() {
        
    var newCache;
    try {
        newCache = await caches.open(serverDeployVersion);
        installedFilesCount = (await newCache.keys() || []).length || 0;
    } catch (e) {}
    
    breadcrumb("[UPDATER] Checking installation status ... Installed: " + installedFilesCount + " out of " + numberOfFilesInTheServerDeployVersion + " files");

    if (!newCache) {
        breadcrumb("[UPDATER] New cache doesn't exist yet or nothing's installed yet... waiting...");
    }

    // if we still have some files to install 
    if (installedFilesCount < numberOfFilesInTheServerDeployVersion) {

        // first update progress status
        var percentage = ((100 * installedFilesCount) / numberOfFilesInTheServerDeployVersion).toFixed(2);
        $("#update-available").find("progress").attr("value", installedFilesCount);
        $("#update-available").find("p").text(percentage + "%");

        // now we'll check how long it has been since we last had an increase in the installed files count
        // if we haven't been able to install not even a single more file for another 5 seconds, timeout
        // we'll instead fall back to network->cache to not keep user waiting
        // their network seems super slow 
        
        if (installedFilesCount === numberOfInstalledFilesLastTimeWeChecked) {
            // number of files haven't changed again, keep adding to timeout
            installationTimeoutCounter+=200;
        } else {
            // reset timeout timer, we're still installing 
            installationTimeoutCounter = 0;
        }
        
        // set this check's file count to the installer to keep track
        numberOfInstalledFilesLastTimeWeChecked = installedFilesCount;

        // finally check if we're timing out, if not, wait 200ms then check back again
        if (installationTimeoutCounter <= 5000) {
            
            // wait 200ms then check back again
            await promiseToWait(200); 
            return checkInstallationStatus();

        } else {
            // install timed out
            breadcrumb("[UPDATER] We haven't been able to install even a single file in the last 5 seconds, timing out, and will fall back to installing in the background via worker-network-cache instead");
            $("#update-available").find("progress").attr("value", numberOfFilesInTheServerDeployVersion);
            $("#update-available").find("p").text("100% — finishing up...");
            return false;
        }

    }
    
    // installation complete, give it another 200ms for UX
    await promiseToWait(200); 

    return true;

}




////////////////////////////////////////////////
////////////////////////////////////////////////
//	RENDER UPDATES CARD
////////////////////////////////////////////////
////////////////////////////////////////////////

function renderUpdateCard(numberOfFiles) {
    
    numberOfFiles = numberOfFiles || 100;

    var card = 
    `<div id="update-available" onclick='reloadForNewVersion();'>
        <img id="logo" src="../assets/logo-b.svg" alt="CRYPTEE">
        <div>
            <h2></h2>
            <p></p>
            <br><br><br>
            <progress class="progress" value="0" max="${numberOfFiles}"></progress>
        </div>
    </div>`;
    return card;
}



