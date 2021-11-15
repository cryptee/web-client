////////////////////////////////////////////////
////////////////////////////////////////////////
//	WAKE LOCK
////////////////////////////////////////////////
////////////////////////////////////////////////

var noSleep; 
if (NoSleep) { noSleep = new NoSleep(); }
var wakeLockEnabled = false;

/**
 * ENABLES / REQUESTS WAKE LOCK TO KEEP DEVICE AWAKE (I.E. DURING UPLOADS)
 */
function enableWakeLock() {

    if (wakeLockEnabled) { return false; }
    if (!noSleep) { return false; }

    try {
        noSleep.enable();
        wakeLockEnabled = true;
        breadcrumb('[WAKE LOCK] Requested');
        return true;
    } catch (error) {
        breadcrumb('[WAKE LOCK] Failed / Rejected');
        return false;
    }

}

/**
 * RELEASES WAKE LOCK TO LET DEVICE SLEEP
 */
function disableWakeLock() {
    
    if (!wakeLockEnabled) { return false; }
    if (!noSleep) { return false; }

    try {
        noSleep.disable();
        wakeLockEnabled = false;
        breadcrumb('[WAKE LOCK] Released');
        return true;
    } catch (error) {
        breadcrumb('[WAKE LOCK] Failed to release / rejected');
        return false;
    }

}
