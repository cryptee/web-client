////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 DARK MODE
////////////////////////////////////////////////
////////////////////////////////////////////////

if (darkMode) {
    $("button[group='darkmode'][val='on']").addClass("selected");
    $("button[group='darkmode'][val='off']").removeClass("selected");

    try {
        breadcrumb('[Color Scheme] Dark Mode');
        setSentryTag("color-scheme", "dark");
    } catch (e) {}

} else {
    $("button[group='darkmode'][val='off']").addClass("selected");
    $("button[group='darkmode'][val='on']").removeClass("selected");

    try {
        breadcrumb('[Color Scheme] Light Mode');
        setSentryTag("color-scheme", "light");
    } catch (e) {}
}
                                            
try {
    
    // var printMediaQuery = window.matchMedia("print");
    var darkmodeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    var lightmodeMediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    
    darkmodeMediaQuery.onchange = (e) => { if (e.matches) { turnDarkModeOn(); } };
    lightmodeMediaQuery.onchange = (e) => { if (e.matches) { turnDarkModeOff(); } };

} catch (error) {
    handleError("Couldn't add matchMedia listener for light/dark mode", error);
}

function turnDarkModeOn() {
    try { localStorage.setItem("darkMode", 1); } catch (error) {}
    darkMode = true;
    activateDarkMode();
}

function turnDarkModeOff() {
    try { localStorage.removeItem("darkMode"); } catch (error) {}
    darkMode = false;
    deactivateDarkMode();
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	QUICK START 
////////////////////////////////////////////////
////////////////////////////////////////////////

try {
    var quickstart = localStorage.getItem("quickstart");
    if (quickstart) {
        $("button[group='quickstart'][val]").removeClass("selected");
        $("button[group='quickstart'][val='"+quickstart+"']").addClass("selected");
    } else {
        $("button[group='quickstart'][val]").addClass("selected");
        $("button[group='quickstart'][val='photos']").removeClass("selected");
        $("button[group='quickstart'][val='docs']").removeClass("selected");
    }
} catch (e) {}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	REMEMBER KEY
////////////////////////////////////////////////
////////////////////////////////////////////////


try {

    var rememberingKey = false;
    if (localStorage.getItem('memorizedKey')) {
        var memorizedKey = JSON.parse(localStorage.getItem('memorizedKey')); // hashedKey
        if (memorizedKey) { rememberingKey = true; }
    }
      
    if (rememberingKey) {
        $("button[group='remember-key'][val='dont']").removeClass("selected");
        $("button[group='remember-key'][val='do']").addClass("selected");
    } else {
        $("button[group='remember-key'][val='dont']").addClass("selected");
        $("button[group='remember-key'][val='do']").removeClass("selected");
    }

} catch (e) {}




////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 INACTIVITY TIMEOUT
////////////////////////////////////////////////
////////////////////////////////////////////////

var inactivityTimeoutInMinutes;
try {
    inactivityTimeoutInMinutes = localStorage.getItem("inactivityTimeout") || 30;
    inactivityTimeoutInMinutes = parseInt(inactivityTimeoutInMinutes);
    if (isNaN(inactivityTimeoutInMinutes)) { inactivityTimeoutInMinutes = 30; }
    $("#inactivityTimeoutInput").val(inactivityTimeoutInMinutes);
} catch (e) {}




////////////////////////////////////////////////
////////////////////////////////////////////////
//	FONTS
////////////////////////////////////////////////
////////////////////////////////////////////////

var defaultFont = "josefin-sans"; 
try {
    defaultFont = localStorage.getItem("defaultFont") || "josefin-sans";
    if (!defaultFont) { defaultFont = "josefin-sans"; }
} catch (e) {}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	APP PREFERENCES
////////////////////////////////////////////////
////////////////////////////////////////////////

var defaultAppPreferences = {
    "docs" : {},
    "photos" : {
        "high-res-thumbnails"         : "auto",
        "video-thumbnails-type"       : "animated",
        "cover-bg-dominant-color"     : "color"
    },
};

var appPreference = { ...defaultAppPreferences };

/**
 * Gets an app preference (i.e. photos / high-res-thumbnails) from localStorage (or gets the default)
 * @param {('photos'|'docs')} app 
 * @param {String} preferenceKey (i.e. "high-res-thumbnails") 
 * @returns preferenceValue
 */
function getAppPreference(app, preferenceKey) {
    
    if (!app || !preferenceKey) { return false; }
    
    // preference doesn't exist
    if (isEmpty(defaultAppPreferences[app])) { 
        handleError("[PREFERENCES] Can't get preference. App Preference doesn't exist!", { app : app, preferenceKey : preferenceKey });
        return false; 
    }

    if (!defaultAppPreferences[app][preferenceKey]) { 
        handleError("[PREFERENCES] Can't get preference. App Preference Key doesn't exist!", { app : app, preferenceKey : preferenceKey });
        return false; 
    }

    var preferenceIndex = "preference-" + app + "-" + preferenceKey;

    var preference;

    try {
        preference = localStorage.getItem(preferenceIndex);
    } catch (error) {}
    
    if (!preference) {
        preference = defaultAppPreferences[app][preferenceKey];
    }
    
    return preference;

}


/**
 * Sets an app preference (i.e. photos / high-res-thumbnails) to localStorage
 * @param {('photos'|'docs')} app 
 * @param {String} preferenceKey (i.e. "high-res-thumbnails") 
 * @param {String} preferenceValue (i.e. "high") 
 */
 function setAppPreference(app, preferenceKey, preferenceValue) {
    
    if (!app || !preferenceKey || !preferenceValue) { 
        handleError("[PREFERENCES] Can't save app preference without app / preference key or value", { app : app, preferenceKey : preferenceKey, preferenceValue : preferenceValue });
        return false; 
    }
    
    // preference doesn't exist
    if (isEmpty(defaultAppPreferences[app])) { 
        handleError("[PREFERENCES] Can't set preference. App Preference doesn't exist!", { app : app, preferenceKey : preferenceKey, preferenceValue : preferenceValue });
        return false; 
    }

    var preferenceIndex = "preference-" + app + "-" + preferenceKey;

    try {
        localStorage.setItem(preferenceIndex, preferenceValue);
        breadcrumb('[PREFERENCES] Successfully set app preference (' + app + "-" + preferenceKey + ":" + preferenceValue + ")");
    } catch (error) {}
    
}

function loadAppPreferences() {
    
    for (const appName in defaultAppPreferences) {
        
        const app = defaultAppPreferences[appName];
        
        for (const preferenceKey in app) {
            
            var preferenceValue = getAppPreference(appName, preferenceKey);

            appPreference[appName][preferenceKey] = preferenceValue;

            $("button.appPreference.radio[group='"+appName + "-" + preferenceKey+"'][val]").removeClass("selected");
            $("button.appPreference.radio[group='"+appName + "-" + preferenceKey+"'][val='"+preferenceValue+"']").addClass("selected");

        }

    }

    breadcrumb('[PREFERENCES] Loaded app preferences');

}

loadAppPreferences();