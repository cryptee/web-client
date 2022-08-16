////////////////////////////////////////////////
////////////////  SENTRY  SETUP  ////////////////
////////////////////////////////////////////////

var env;
if (!location.origin.includes("crypt.ee"))          { env = "unknown"; }
if (location.origin.includes("crypt.ee"))           { env = "prod";    }
if (location.origin.includes("beta"))               { env = "beta";    }
if (location.origin.includes("alfa"))               { env = "alfa";    }
if (location.origin.includes("localhost"))          { env = "local";   }

try {
    var sentryConfig = {
        dsn: 'https://bbfa9a3a54234070bc0899a821e613b8@sentry.crypt.ee/149319',
        tracesSampleRate: 1.0,
        maxBreadcrumbs: 500,
        environment: "v3-" + env,
        ignoreErrors: [
            'KaTeX parse error', '[Parchment]',
            "'setEnd' on 'Range'", "'setStart' on 'Range'", "MetaMask",
            "lastpass", "u.position is not a function",
            "this.emitter is undefined", "can't access dead object",
            "Cannot read property 'mutations' of undefined", "NS_ERROR_FAILURE",
            "formats/code", "ui/color-picker", "lib/showdown", "blots/cursor", "lib/tribute", "core/selection"
        ],
        denyUrls: [
            // Chrome extensions
            /extensions\//i,
            /^chrome:\/\//i,
        ],
        beforeBreadcrumb(breadcrumb, hint) {
            return cleanBreadcrumbs(breadcrumb, hint);
        },
    };

    // this will be replaced in build
    if (env !== "local") { sentryConfig.release = "cryptee-v3-" + "local-dev-ver"; }
    Sentry.init(sentryConfig);
} catch (e) {
    console.error("Error initializing Sentry.", e);
}


////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 TEST SESSIONSTORAGE & LOCALSTORAGE
////////////////////////////////////////////////
////////////////////////////////////////////////
$(document).on("ready", function () {
    
    try {
        // CURRENTLY, HOUSEKEEPING.JS IS THE FIRST POINT OF ENTRY.
        // SO TEST FOR THE SESSION STORAGE & LOCALSTORAGE HERE, AND SET THE SENTRY TAG HERE.

        sessionStorage.setItem("sessionStorageTest", "test");
        sessionStorage.removeItem("sessionStorageTest");

        setSentryTag("sessionStorage", "enabled");
    
    } catch (e) {

        setSentryTag("sessionStorage", "disabled");

        // if not on signin / signup / help, redirect to signin to show sessionStorage error.
        if ( location.pathname !== "/login" && location.pathname !== "/signup" && location.pathname !== "/help" ) {
            location.href = "/login";
        } else {
            var sessionStorageErrorMessage = "Seems like your browser's private browsing mode or an ad-blocker is blocking sessionStorage, a temporary storage mechanism Cryptee needs to function. Please try loading this page again after disabling your ad-blockers / private browsing mode, or visit our helpdesk for more info.";
            showPopup("popup-login", sessionStorageErrorMessage, "error");
            showPopup("popup-signup", sessionStorageErrorMessage, "error");
        }

    }

    try {
        // CURRENTLY, HOUSEKEEPING.JS IS THE FIRST POINT OF ENTRY.
        // SO TEST FOR indexedDB & UUID Generation HERE, AND SET THE SENTRY TAG HERE.
        console.log("[IDB] Testing");
        var now = (new Date()).getTime();
        var testID = newUUID(8);
        var idbTest = new Dexie("idbTest-" + now);
        idbTest.version(now).stores({ test: 'id' });
        idbTest.test.put({ id : testID }).then(()=>{
            idbTest.test.get(testID).then((testIO)=>{
                if (testIO.id !== testID) { 
                    indexedDBBlocked(true, idbTest);
                } else {
                    indexedDBBlocked(false, idbTest);
                }
            }).catch((e)=>{
                indexedDBBlocked(true, idbTest);
            });  
        }).catch((e)=>{
            indexedDBBlocked(true, idbTest);
        });

    } catch (error) {
        indexedDBBlocked(true);
    }

});

function indexedDBBlocked(isIDBBlocked, idbDB) {
    if (!isIDBBlocked) {
        console.log("[IDB] Available");
        setSentryTag("indexedDB", "available");
    } else {
        console.error("[IDB] Blocked");
        setSentryTag("indexedDB", "blocked");
        var idbBlockedErrorMessage = "Seems like your browser's private browsing mode or an ad-blocker is blocking indexedDB, which is a local storage mechanism Cryptee requires to function. Please try loading this page again after disabling your ad-blockers / private browsing mode, or visit our helpdesk for more info.";
        showPopup("popup-login", idbBlockedErrorMessage, "error");
        showPopup("popup-signup", idbBlockedErrorMessage, "error");

        if (location.pathname === "/login") {
            $(".wrapper").remove();
            $(".bottom").remove();
        } 
        
        else if (location.pathname === "/signup") {
            $("#step1").remove();
        }

        else {
            createPopup("Seems like your browser's private browsing mode or an ad-blocker is blocking indexedDB, which is a local storage mechanism Cryptee requires to function. Please try loading this page again after disabling your ad-blockers / private browsing mode, or visit our helpdesk for more info.", "error");
        }
    }

    if (idbDB) { idbDB.delete(); }
}

////////////////////////////////////////////////
////////////////////////////////////////////////
//	CLEAN BREADCRUMBS
////////////////////////////////////////////////
////////////////////////////////////////////////

// This cleans all breadcrumbs to remove unnecessary stuff
// i.e. button labels/names, ui images' alt attributes etc.

function cleanBreadcrumbs(breadcrumb, hint) {
    var category = breadcrumb.category || "";
    
    if (category.startsWith("ui")) {
        
        // clear name attributes
        breadcrumb.message = breadcrumb.message.replace(/name=\s*(.*?)\s*"]/gi, "name='...']");
        
        // clear alt attributes
        breadcrumb.message = breadcrumb.message.replace(/alt=\s*(.*?)\s*"]/gi, "alt='...']");

    }
    
    return breadcrumb;
}


///////////////////////////////////////////
//////////////// REPORT BUGS /////////////
///////////////////////////////////////////

// USING CUSTOM BUGREPORTING AT /BUGREPORT NOW

function handleOfflineError(error) {
    if (error) {
        console.log(error);
        Sentry.withScope(function (scope) {
            if (error.code) {
                scope.setFingerprint([error.code]);
            }

            scope.setTag("connectivity", "offline");
            Sentry.captureException(error);
        });
    }
}

/**
 * Handle & Log Errors
 * @param {string} errorTitle an error message title (i.e. "Couldn't upload file ...")
 * @param {object} data Error Data Object, will be iterated and processed
 * @param {('debug'|'info'|'warning'|'error'|'fatal')} level Error Level
 */
function handleError(errorTitle, data, level) {
    
    level = level || 'error';
    data = data || {};
    
    if (env === "local") { 
        if (level !== "info") {
            console.error(errorTitle);
            if (!isEmpty(data)) { console.error(data); }
        } else {
            console.warn(errorTitle);
        }
        return; 
    } else {
        console.log(errorTitle);
    }

    Sentry.withScope(function (scope) {
        Object.keys(data).forEach(function (key) {
            scope.setExtra(key, data[key]);
        });

        if (data.code) {
            scope.setFingerprint([data.code]);
        }

        scope.setLevel(level);
        Sentry.captureMessage(errorTitle);
    });
    
}

function setSentryUser(userid) {
    Sentry.configureScope(function (scope) {
        scope.setUser({ id: userid });
        scope.setTag("loggedin", "true");
    });
}

function setSentryTag(key, val) {
    Sentry.configureScope(function (scope) {
        scope.setTag(key, val);
    });
}



/**
 * A Breadcrumb Message Logger for debugging
 * @param {string} message Breadcrumb Message i.e. "[Document] Saving ..."
 * @param {('info'|'warning'))} level 
 */
function breadcrumb(message, level) {
    level = level || "info";
    Sentry.addBreadcrumb({
        message: message,
        level: level
    });

    // we're on testing / local env. log breadcrumbs to console.
    if (env !== "prod") { console.log(message); }
}

function logTimeStart(name) {
    if (env !== "prod") { console.time(name); }
}

function logTimeEnd(name) {
    if (env !== "prod") { console.timeEnd(name); }
}
