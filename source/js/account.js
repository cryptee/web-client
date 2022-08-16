$(document).on('ready', function(event) {
    var tab     = getUrlParameter("s");
    var subtab  = getUrlParameter("ss");
    if (tab)    { loadTab(tab); }
    if (subtab) { loadTab(tab, 0, subtab); }

    if (!tab && !subtab && $(window).width() > 960) {
        loadTab("overview");
    }
}); 


////////////////////////////////////////////////
////////////////////////////////////////////////
//	AUTH / STARTUP
////////////////////////////////////////////////
////////////////////////////////////////////////

authenticate(function(user){
    // LOGGED IN

}, function(){
    // NOT LOGGED IN
    if (willLoseAuthForDeletion) {
        window.location = "/farewell";
    } else {
        location.href = "/login";
    }
}, function(error) {
    // ERROR
    if (error.code === "auth/network-request-failed") {
        handleError("[HOME] Error Authenticating", error);
    }
    
    location.href = "/login";
});




////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 TAB NAVIGATOR
////////////////////////////////////////////////
////////////////////////////////////////////////

$('nav').on('click', 'button[tab]', function(event) {
    // click button to open tab

    var button = $(this);
    var tab = button.attr("tab");
    loadTab(tab, button);
}); 

$('section').on('click', 'button[subtab]', function(event) {
    // click button to open subtab

    var button = $(this);
    var tab = button.attr("tab");
    var subtab = button.attr("subtab");
    loadTab(tab, button, subtab);
}); 

$('#back').on('click', function(event) {
    var to = $(this).attr("to");
    if (to === "nav") {
        loadNav();
    } else {
        loadTab(to);
    }
}); 


function loadTab(tab, btn, subtab) {
    subtab = subtab || "";
    
    $("button, nav, section").removeClass("active passive");
    if (btn) { btn.addClass("active"); }
    
    $("nav").addClass("passive");
    $("button[tab='"+tab+"']").not("[subtab]").addClass("active"); 
    
    if (subtab) {
        $("section[tab='"+tab+"']").not("[subtab]").addClass("passive");
        $("section[tab='"+tab+"'][subtab='"+subtab+"']").addClass("active"); 
        $("button[tab='"+tab+"'][subtab='"+subtab+"']").addClass("active"); 
    } else {
        $("section[tab='"+tab+"']").not("[subtab]").addClass("active");
    }

    $('#back').addClass("show");
    if (subtab) { 
        $('#back').attr("to", tab); 
        history.replaceState("tab", null, '/account?s='+tab+'&ss='+subtab);
    } else {
        $('#back').attr("to", "nav");
        history.replaceState("tab", null, '/account?s='+tab);
    }
}

function loadNav() {
    $("button, nav, section").removeClass("active passive");
    $("nav").addClass("active");
    $('#back').removeClass("show");
    $('#back').attr("to", "");
    history.replaceState("account", null, '/account');
}





////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 DARK MODE
////////////////////////////////////////////////
////////////////////////////////////////////////

$("button.radio[group='darkmode']").on('click', function(event) {
    setTimeout(function () {
        var value = $("button.radio.selected[group='darkmode']").attr("val");
        if (value === "on") {
            try { localStorage.setItem("darkMode", 1); } catch (e) {}
            darkMode = true;
            activateDarkMode();
        } else {
            try { localStorage.removeItem("darkMode"); } catch (e) {}
            darkMode = false;
            deactivateDarkMode();
        }
    }, 10);
}); 


////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 QUICKSTART
////////////////////////////////////////////////
////////////////////////////////////////////////

$("button.radio[group='quickstart']").on('click', function(event) {
    setTimeout(function () {
        var value = $("button.radio.selected[group='quickstart']").attr("val");
        if (value) {
            try { 
                localStorage.setItem("quickstart", value); 
                sessionStorage.setItem("quickstarted", 1);
            } catch (e) {}
        } else {
            try { localStorage.removeItem("quickstart"); } catch (e) {}
        }
    }, 10);
}); 


////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 APP RADIO BUTTON PREFERENCES
////////////////////////////////////////////////
////////////////////////////////////////////////


$("button.appPreference.radio").on('click', function(event) {
    
    var thisButtonGroup = $(this).attr("group");
    
    setTimeout(function () {
        
        if (!thisButtonGroup) { return; }

        var app             = thisButtonGroup.split("-")[0];
        var preferenceKey   = thisButtonGroup.replace(app + "-", "");
        var preferenceValue = $("button.appPreference.radio.selected[group='"+thisButtonGroup+"']").attr("val");

        setAppPreference(app, preferenceKey, preferenceValue);
        
    }, 10);

}); 


////////////////////////////////////////////////
////////////////////////////////////////////////
//	REMEMBER KEY
////////////////////////////////////////////////
////////////////////////////////////////////////

$("button.radio[group='remember-key']").on('click', function(event) {
    if ($(this).attr("val") === "dont") {
        try { 
            localStorage.removeItem('memorizedKey');
            memorizedKey = null;
            rememberingKey = false;
            createPopup("Done! From now on, Cryptee <b>will not</b> remember your encryption key on this device, and you will need to type it every time you launch the app.", "success");

        } catch (e) {}
    } else {
        if (!memorizedKey) {
            $("#remember-key-save-form").show();
        }
    }
}); 


$("#remember-key-button").on('click', function(event) {
    rememberEncryptionKey();
}); 


////////////////////////////////////////////////
////////////////////////////////////////////////
//	INACTIVITY TIMEOUT
////////////////////////////////////////////////
////////////////////////////////////////////////

$("#inactivityTimeoutInput").on('change', function(event) {
    var mins = $("#inactivityTimeoutInput").val();
    mins = parseInt(mins);
    
    if (mins <= 0) { 
        mins = 0; 
        $("#inactivityTimeoutInput").val(0);
    }

    if (typeof mins !== "number" || isNaN(mins)) {
        mins = 30;
        $("#inactivityTimeoutInput").val(30);
    }

    localStorage.setItem("inactivityTimeout", mins);
}); 


////////////////////////////////////////////////
////////////////////////////////////////////////
//	metadata export
////////////////////////////////////////////////
////////////////////////////////////////////////

async function exportAllMetadata() {

    breadcrumb('[EXPORT ALL METADATA] Exporting');

    $("#exportAllMetadataButton").addClass("loading");

    var allDataRequest;
    try {
        allDataRequest = await api("user-everything");
    } catch (error) {
        handleError("[EXPORT ALL METADATA] Failed to export all data", error);
    }
    
    if (!allDataRequest) {
        handleError("[EXPORT ALL METADATA] Failed to export all data");
        createPopup("it seems we're having difficulty connecting our servers to export your data. Chances are this is a network / connectivity problem, or your browser is configured to block access to a resource cryptee needs. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues. ", "error");
        $("#exportAllMetadataButton").removeClass("loading");
        return false;
    }

    try {
        var blob = new Blob([JSON.stringify(allDataRequest.data)], {type: "application/json;charset=utf-8"});
        saveAsOrShare(blob, "Your Cryptee Metadata.json");
    } catch (error) {
        handleError("[EXPORT ALL METADATA] Failed to export all data", error);
        createPopup("it seems we're having difficulty saving your data to your downloads folder. Please make sure your ad-blockers / browser settings aren't affecting your browser's download APIs and try again.", "error");
        $("#exportAllMetadataButton").removeClass("loading");
        return false;
    }

    $("#exportAllMetadataButton").removeClass("loading");
    breadcrumb('[EXPORT ALL METADATA] Done.');

    return true;
}
