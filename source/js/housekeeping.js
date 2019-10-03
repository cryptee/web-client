////////////////////////////////////////////////
////////////////  SENTRY  SETUP  ////////////////
////////////////////////////////////////////////

var sentryEnv;
if (location.origin.indexOf("crypt.ee") === -1) {
    sentryEnv = "alpha";
}
if (location.origin.indexOf("crypt.ee") !== -1) {
    sentryEnv = "prod";
}
if (location.origin.indexOf("alfa.crypt.ee") !== -1) {
    sentryEnv = "alfa";
}
if (location.origin.indexOf("beta.crypt.ee") !== -1) {
    sentryEnv = "beta";
}

try {
    Sentry.init({
        dsn: 'https://bbfa9a3a54234070bc0899a821e613b8@sentry.crypt.ee/149319',
        maxBreadcrumbs: 250,
        environment: sentryEnv,
        ignoreErrors: [
            'KaTeX parse error', '[Parchment]',
            "'setEnd' on 'Range'", "'setStart' on 'Range'", "MetaMask",
            "lastpass", "u.position is not a function",
            "this.emitter is undefined", "can't access dead object",
            "Cannot read property 'mutations' of undefined"
        ]
    });
} catch (e) {
    console.error("Error initializing Sentry.", e);
}

////////////////////////////////////////////////
//////////////// FEEDBACK SETUP ////////////////
////////////////////////////////////////////////

// callback ( result )
var contactFormURL = "https://crypt.ee/api/contactform";

function collectContactForm(contactFormObject) {
    contactFormObject = contactFormObject || null;
    if (contactFormObject) {
        $.ajax({
            url: contactFormURL,
            method: "POST",
            data: contactFormObject,
            dataType: "json",
            success: function () {
                console.log("feedback submitted.");
            }
        });
    }
}


////////////////////////////////////////////////
///////////////// PING SETUP ///////////////////
////////////////////////////////////////////////

// ping("click", {btn : "btn name or sth"});

var pingURL = "https://crypt.ee/api/ping";

function ping(type, obj, callback) {
    callback = callback || noop;
    obj = obj || {};

    obj.aip = 1;
    obj.t = type;
    obj.ua = navigator.userAgent;
    obj.sr = $(window).width().toString() + "x" + $(window).height().toString();
    obj.dp = location.pathname;

    if (detectedLocale) {
        obj.geoid = detectedLocale;
    } else {
        obj.geoid = "XX";
    }

    var sessionID;
    try {
        sessionID = sessionStorage.getItem("sessionID");
    } catch (error) {}

    if (sessionID) {
        obj.cid = sessionID;
    }
    if (isInWebAppiOS || isInWebAppChrome) {
        obj.ds = "app";
    } else {
        obj.ds = "web";
    }

    var pingData = {
        "type": type,
        "obj": obj
    };
    $.ajax({
        url: pingURL,
        type: 'POST',
        dataType: "json",
        data: pingData,
        success: function (data) {
            callback();
        }
    }).fail(function (resp) {
        if (resp.status !== 200 && resp.status !== 0 && resp.status !== 502) {
            console.log("Ping Error");
            callback();
        }
    });
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

// can take a title, a data obj, and level
// level can be "debug", "info", "warning", "error" or "fatal"
// defaults to "error"
function handleError(errorTitle, data, level) {

    if (typeof errorTitle !== "string") {

        // use old error reporting for backwards compatibility
        // errorTitle = errorObj
        // data = connectivity
        var error = errorTitle;
        var connectivity = data || "online";

        if (error) {
            console.log(error);
            Sentry.withScope(function (scope) {
                if (error.code) {
                    scope.setFingerprint([error.code]);
                }

                scope.setTag("connectivity", connectivity);
                Sentry.captureException(error);
            });
        }

    } else {

        level = level || 'error';
        data = data || {};
        console.log(errorTitle);
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
}

function setSentryUser(userid) {
    Sentry.configureScope(function (scope) {
        scope.setUser({
            id: userid
        });
    });
}

function setSentryTag(key, val) {
    Sentry.configureScope(function (scope) {
        scope.setTag(key, val);
    });
}

function setSentryRelease(release) {
    Sentry.configureScope(function (scope) {
        scope.addEventProcessor(function (event) {
            return new Promise(function(resolve) {
                event.release = release;
                return resolve(event);
            });
        });
    });
}
// level takes "info" or "warning"
function breadcrumb(message, level) {
    level = level || "info";
    Sentry.addBreadcrumb({
        message: message,
        level: level
    });

    if (location.origin.indexOf("crypt.ee") === -1) {
        // we're on testing env. log to console.
        console.log(message);
    }
}

function logTimeStart(name) {
    if (location.origin.indexOf("crypt.ee") === -1) {
        console.time(name);
    }
}

function logTimeEnd(name) {
    if (location.origin.indexOf("crypt.ee") === -1) {
        console.timeEnd(name);
    }
}