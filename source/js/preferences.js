var txt = {};
var localeURL = "https://flare.crypt.ee/api/locale";
var detectedLocale = "XX", detectedCurrency = "XX";
var sessionID;
var darkMode = false;
var monthsOfRecentDocsPreference = 6;

///////////////////////////////////////////////
//////////////// I18N & CURRENCIES  ///////////
///////////////////////////////////////////////
try { darkMode = localStorage.getItem("darkMode"); } catch (e) {}  

if (darkMode) {
  activateDarkMode();
  $(".darkmodeswitch").prop('checked', true).attr('checked', true);
} else {
  $(".darkmodeswitch").prop('checked', false).attr('checked', false);
}

$(document).ready(function() {
  try {
    // CURRENTLY, PREFERENCES.JS IS THE FIRST POINT OF ENTRY.
    // SO TEST FOR THE SESSION STORAGE HERE, AND SET THE SENTRY TAG HERE.
    sessionStorage.setItem("sessionStorageTest", "test");
    sessionStorage.removeItem("sessionStorageTest");
    setSentryTag("sessionStorage", "enabled");
  } catch (e) {    
    setSentryTag("sessionStorage", "disabled");
    // if not on signin / signup, redirect to signin to show sessionStorage error.
    if (
        window.location.pathname !== "/signin" 
     && window.location.pathname !== "/signup" 
     && window.location.pathname !== "/help"
    
     ) {
      // and if on an app page (and not landing page or other pages) -- simply by checking to see if openpgp is there
      if (openpgp) {
        window.location = "signin";
      }
    }
  }

  try { sessionID = sessionStorage.getItem("sessionID"); } catch (e) {}  

  $.ajax({ url: localeURL, type: 'GET',
    success: function(flareResponse){
      var detected = JSON.parse(flareResponse);
      detectedLocale = detected.loc;
      detectedCurrency = detected.cur;

      if (sessionID === null) {
        if ($("#pageis").attr("type") === "www") {
          if ($("#pagehas").attr("type") !== "critical") {
            sessionID = detected.ses;
            sessionStorage.setItem("sessionID", sessionID);
          } else {
            sessionStorage.removeItem("sessionID");
            sessionID = null;
          }
        } else {
          sessionStorage.removeItem("sessionID");
          sessionID = null;
        }
      }

      setCurrencies (detectedCurrency);
      setSentryTag("locale", detectedLocale);
      if (detectedLocale !== "XX") {
        try {
          $("#upgrade-countries>option[value='"+ detectedLocale +"']").prop('selected', true);
          $(".upgrade-countries-select").removeClass("is-danger").addClass("is-success");
          checkUpgradeForm();
        } catch (e) {}
      } else {
        try {
          $("#upgrade-countries>option[value='']").prop('selected', true);
          $(".upgrade-countries-select").removeClass("is-success").addClass("is-danger");
        } catch (e) {}
      }

      ping("pageview", { dr : document.referrer });
    },
    error:function (xhr, ajaxOptions, thrownError){
      if (navigator.onLine) { // throw this error only if user is online.
        if (xhr.status !== 0) {
          handleError("Error getting locale",thrownError);
        }
      }
    }
  });
});

function setCurrencies (cur) {
  if (cur === "USD") {
    try { $('.additional-cur').html("$"); } catch (e) {}
    try { $('.cur').html("$"); } catch (e) {}
  } else {
    try { $('.additional-cur').html("€"); } catch (e) {}
    try { $('.cur').html("€"); } catch (e) {}
  }
}


function detectLang () {
  // detect from ip or cloudflare
}

function getLangFromLS () {

}

function setLangToLS () {

}

function translatePage () {

}

///////////////////////////////////////////////
///////////////// USER PREFERENCES  ///////////
///////////////////////////////////////////////

var userPreferences = {
  "general" : {
    "inactivityTimeout" : 30
  },
  "docs" : {
    "direction" : "ltr",
    "spellcheck" : "on",
    "opentab" : "recents" // or can be "folders"
  },
  "photos" : {

  },
  "home" : {

  }
};

function gotPreferences(pref) {
  if (pref !== undefined && pref !== null && pref !== "" && pref !== {}) {

    if (pref.general) {
      if (pref.general.inactivityTimeout >= 0) {
        userPreferences.general.inactivityTimeout = pref.general.inactivityTimeout;
      }

    }

    if (pref.docs) {
      if (pref.docs.direction) {
        userPreferences.docs.direction = pref.docs.direction;
      }

      if (pref.docs.spellcheck) {
        userPreferences.docs.spellcheck = pref.docs.spellcheck;
      }

      if (pref.docs.opentab) {
        userPreferences.docs.opentab = pref.docs.opentab;
      }

    }

    if (pref.photos) {

    }

    if (pref.home) {

    }

  }

  localStorage.setItem("crypteepref", JSON.stringify(userPreferences));

  if (window.location.pathname === "/account") {
    populatePreferences();
  }

  applyPreferences();
}

function populatePreferences () {
  populatingPreferences = true;
  $("#inactivityTimeoutInput").val(userPreferences.general.inactivityTimeout);

  if (userPreferences.docs.direction === "ltr") {
    $(".ltrswitch").prop('checked', true).attr('checked', true);
    $(".rtlswitch").prop('checked', false).attr('checked', false);
  } else {
    $(".ltrswitch").prop('checked', false).attr('checked', false);
    $(".rtlswitch").prop('checked', true).attr('checked', true);
  }

  if (userPreferences.docs.spellcheck === "on") {
    $(".spellcheckswitch").prop('checked', true).attr('checked', true);
  } else {
    $(".spellcheckswitch").prop('checked', false).attr('checked', false);
  }

  setTimeout(function () {
    populatingPreferences = false;
  }, 100);
}

function applyPreferences () {
  if (window.location.pathname === "/docs") {
    if (userPreferences.docs.direction === "rtl") {
      $("body").addClass("direction-pref-rtl");
    } else {
      $("body").removeClass("direction-pref-rtl");
    }

    if (userPreferences.docs.spellcheck === "on") {
      if (quill) { quill.root.spellcheck = true; }
    } else {
      if (quill) { quill.root.spellcheck = false; }
    }

    if (userPreferences.docs.opentab === "folders") {
      if (!startedOffline && connectivityMode) {
        breadcrumb('Loading Tab: Folders');
        $("#folders-button:not(.active)").click();
      }
    } else {
      if (!startedOffline && connectivityMode) {
        breadcrumb('Loading Tab: Recents');
        $("#recents-button:not(.active)").click();
      }
    }
  }
}


try {
  monthsOfRecentDocsPreference = localStorage.getItem("numRecentDocs") || 6;
} catch (e) {}
$("#num-recent-docs-input").val(monthsOfRecentDocsPreference);

function activateDarkMode() {
  if (window.location.pathname !== "/signin" && window.location.pathname !== "/signup") { 
    $("html").addClass("dm");
    $("#nav-logo").attr("src", "../assets/cryptee-logo-w.svg");

    try {
      breadcrumb('[COLOR SCHEME] Dark Mode');
      setSentryTag("color-scheme", "dark");
    } catch (e) {}
  }
  
  if (window.location.pathname === "/home") {
    $(".app-icon").each(function(){
      var src = $(this).attr("src");
      var whiteSrc = src.replace(".png", "-w.png");
      $(this).attr("src", whiteSrc);
    });
  }

  if (window.location.pathname === "/docs") {
    $("#export-currentdoc-as-crypteedoc").find("img").attr("src", "../assets/cryptee-logo-w.svg");
    $("#sync-progress-bar").addClass("is-success");
  }
}

function deactivateDarkMode() {
  if (window.location.pathname !== "/signin" && window.location.pathname !== "/signup") {
    $("html").removeClass("dm");
    $("#nav-logo").attr("src", "../assets/cryptee-logo-b.svg");
    
    try {
      breadcrumb('[COLOR SCHEME] Light Mode');
      setSentryTag("color-scheme", "light");
    } catch (e) {}
  }

  if (window.location.pathname === "/home") {
    $(".app-icon").each(function(){
      var src = $(this).attr("src");
      var whiteSrc = src.replace("-w.png", ".png");
      $(this).attr("src", whiteSrc);
    });
  }

  if (window.location.pathname === "/docs") {
    $("#export-currentdoc-as-crypteedoc").find("img").attr("src", "../assets/cryptee-logo-b.svg");
    $("#sync-progress-bar").removeClass("is-success");
  }
}

try {
  window.matchMedia("(prefers-color-scheme: dark)").addListener(function(e){
    if (e.matches) {
      try { localStorage.setItem("darkMode", 1); } catch (error) {}
      darkMode = true;
      activateDarkMode();
    }
  });
} catch (error) {
  handleError("Couldn't add matchMedia listener for dark mode");
}

try {
  window.matchMedia("(prefers-color-scheme: light)").addListener(function(e){
    if (e.matches) {
      try { localStorage.removeItem("darkMode"); } catch (error) {}
      darkMode = false;
      deactivateDarkMode();
    }
  });
} catch (error) {
  handleError("Couldn't add matchMedia listener for dark mode");
}