////////////////////////////////////////////////
////////////////////////////////////////////////
//	REGISTER WORKER 
////////////////////////////////////////////////
////////////////////////////////////////////////

var canUseWorkers = false;

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
    
    try {
        await navigator.serviceWorker.register('../service-worker.js');
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

    return true;
 
}