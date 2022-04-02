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

function prepareForPrint() {
    printMode = true;
    darkModePrefBeforePrint = darkMode;
    if (darkModePrefBeforePrint) {
        breadcrumb('[PRINT] Preparing to print, editor was in dark mode');
    } else {
        breadcrumb('[PRINT] Preparing to print, editor was in light mode');
    }
    deactivateDarkMode();
}

var printMode = false;
var darkModePrefBeforePrint;
try {
    var printMediaQuery = window.matchMedia("print");

    if (!isSafari && !isios && !isipados) {
        printMediaQuery.addEventListener("change", (e) => { 
            if (e.matches) {
                prepareForPrint();
            } else {
                printMode = false;
            }
            
        });
    } else {
        if (printMediaQuery) {
            printMediaQuery.addListener((e) => {
                if (e.matches) { 
                    prepareForPrint();
                } else {
                    printMode = false;
                }
            });
        }
    }

} catch (error) {
    handleError("Couldn't add matchMedia listener for print mode", error);
}

try {
    var darkmodeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    if (!isSafari && !isios && !isipados) {
        darkmodeMediaQuery.addEventListener("change", (e) => {
            if (e.matches && !printMode && darkModePrefBeforePrint) { turnDarkModeOn(); }
        });
    } else {
        if (darkmodeMediaQuery) {
            darkmodeMediaQuery.addListener((e) => {
                if (e.matches && !printMode && darkModePrefBeforePrint) { turnDarkModeOn(); }
            });
        }
    }
    
} catch (error) {
    handleError("Couldn't add matchMedia listener for dark mode", error);
}

try {
    var lightmodeMediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    
    if (!isSafari && !isios && !isipados) {
        lightmodeMediaQuery.addEventListener("change", (e) => {
            if (e.matches && !printMode) { turnDarkModeOff(); }
        });
    } else {
        if (lightmodeMediaQuery) {
            lightmodeMediaQuery.addListener((e) => {
                if (e.matches && !printMode) { turnDarkModeOff(); }
            });
        }
    }

} catch (error) {
    handleError("Couldn't add matchMedia listener for dark mode", error);
}


function turnDarkModeOn() {
    try {
       localStorage.setItem("darkMode", 1);
    } catch (error) {}
    darkMode = true;
    activateDarkMode();
}

function turnDarkModeOff() {
    try {
        localStorage.removeItem("darkMode");
    } catch (error) {}
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