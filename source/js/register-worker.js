////////////////////////////////////////////////
////////////////////////////////////////////////
//	REGISTER WORKER 
////////////////////////////////////////////////
////////////////////////////////////////////////

var canUseWorkers = false;

/**
 * This is used to track the state of the outdated/old service worker which will be replaced once the new one kicks in. 
 * For now only used during updater, if you use this after the updater, it will be for the new/current service worker.
 * It can be : 
 * 
 * "parsed" = The initial state of a service worker after it is downloaded and confirmed to be runnable. A service worker is never updated to this state, only started up at this state.
 * 
 * "installing" = The service worker in this state is considered an installing worker.
 * 
 * "installed" = The service worker in this state is considered a waiting worker. 
 * 
 * "activating" = The service worker in this state is considered an active worker.
 * 
 * "activated" = The service worker in this state is considered an active worker ready to handle functional events.
 * 
 * "redundant" = A new service worker is replacing the current service worker, or the current service worker is being discarded due to an install failure.
 */
var serviceWorkerState = "parsed";

if ('serviceWorker' in navigator) {
    canUseWorkers = true;
    window.addEventListener('load', function () { registerServiceWorker(); });
} else {
    canUseWorkers = false;
    try {
        setSentryTag("worker", "no");
        breadcrumb("[WORKER] No Support");
    } catch (e) {}
}




/**
 * A helper function to remove an old service worker if you need to.
 */
async function removeServiceWorker() {
    
    var registration;

    try {
        registration = await navigator.serviceWorker.getRegistration();    
    } catch (error) {
        console.error(error);        
    }

    await registration.unregister();
    
    window.location.reload();
       
}


/**
 * A helper function to register Cryptee's Service Worker in a nice and tidy way
 */
async function registerServiceWorker() {
    
    let registration;
    try {
        registration = await navigator.serviceWorker.register('../service-worker.js');
    } catch (e) {
        if (location.origin.includes("crypt.ee")) {
            
            try {
                breadcrumb('[WORKER] Errored');
                setSentryTag("worker", "errored");
            } catch (e2) {}

            canUseWorkers = false;
            return false;
        }
    }
    
    try {
        breadcrumb('[WORKER] Registered');
        setSentryTag("worker", "yes");
    } catch (e2) {}

    let sw;

    try {

        sw = registration.installing || registration.waiting || registration.active;
        
        if (sw) {
            serviceWorkerState = sw.state;
            sw.addEventListener('statechange', (e) => { 
                serviceWorkerState = e.target.state; 
                breadcrumb('[WORKER STATE] ' + serviceWorkerState);
            });
        }

    } catch (e3) {}

    return true;
 
}
