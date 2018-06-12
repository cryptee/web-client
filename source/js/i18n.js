var txt = {};
var localeURL = "https://flare.crypt.ee/api/locale";
var detectedLocale = "XX", detectedCurrency = "XX";
var sessionID = sessionStorage.getItem("sessionID");

///////////////////////////////////////////////
//////////////// I18N & CURRENCIES  ///////////
///////////////////////////////////////////////

$(document).ready(function() {
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
      setSmartIDRadios (detectedLocale);

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
      handleError(thrownError);
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

function setSmartIDRadios (loc) {
  $("input[type='radio'][value='"+loc+"']").prop("checked", true);
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
