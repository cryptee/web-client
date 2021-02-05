////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 STARTUP FUNCTIONS
////////////////////////////////////////////////
////////////////////////////////////////////////

// THESE NEEDS TO COME FIRST SO THAT THERE'S NO FLASHING ON PAGE LOADS


// DARK MODE
var darkMode = false;
try {
    darkMode = localStorage.getItem("darkMode");
} catch (e) {}

if (darkMode) {
    activateDarkMode();
} else {
    deactivateDarkMode();
}


// QUICK START (only runs in /home)
quickStart();




////////////////////////////////////////////////
////////////////////////////////////////////////
//	DARK MODE FUNCTIONS
////////////////////////////////////////////////
////////////////////////////////////////////////

function activateDarkMode() {
    document.documentElement.classList.add("dm");
}

function deactivateDarkMode() {
    document.documentElement.classList.remove("dm");
}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	QUICK START FUNCTIONS
////////////////////////////////////////////////
////////////////////////////////////////////////

function quickStart() {
    if (location.pathname !== "/home") { return; }
    // if user has a quickstart preference, and you already haven't quickstarted this session, navigate to the quickstart app. 
    try {
        var quickstartPref = localStorage.getItem("quickstart");
        var quickstarted = sessionStorage.getItem("quickstarted");

        if (quickstartPref && !quickstarted) {
            sessionStorage.setItem("quickstarted", 1);
            console.log("[QUICKSTART] Quickstarting to: " + quickstartPref);
            window.location.replace("/" + quickstartPref);
        }
    } catch (e) {}
}


