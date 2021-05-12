////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 ALL USER INTERACTIONS
////////////////////////////////////////////////
////////////////////////////////////////////////



////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 POPUP INTERACTIONS & FUNCTIONS
////////////////////////////////////////////////
////////////////////////////////////////////////

$(document).on('click', '.popup > .close', function (event) {
    var popup = $(this).parents(".popup");
    var shown = popup.hasClass("show");
    var popupID = popup.attr("id");
    if (shown) {
        hidePopup(popupID);
    }
});

$(document).on('click', '.popup > .minimize', function (event) {
    var popup = $(this).parents(".popup");
    var popupID = popup.attr("id");
    minimizeMaximizePopup(popupID);
});

$(document).on('click', '.popup > p', function (event) {
    var popup = $(this).parents(".popup");
    var popupID = popup.attr("id");
    if (popup.hasClass("minimized")) {
        minimizeMaximizePopup(popupID);
    }
});


$('.popup').on('swipeUp', function (event) {
    var popup = $(this);
    var popupID = popup.attr("id");
    if (popup.hasClass("minimized")) {
        minimizeMaximizePopup(popupID);
    }
});

$('.popup').on('swipeDown', function (event) {
    var popup = $(this);
    var popupID = popup.attr("id");
    var minimizable = popup.hasClass("minimizable");
    var persistent = popup.hasClass("persistent");
    var shown = popup.hasClass("show");
    var corner = popup.hasClass("corner");

    if (corner) {
        if (minimizable) {
            minimizeMaximizePopup(popupID);
        } else {
            if (!persistent && shown) {
                hidePopup(popupID);
            }
        }
    }
});



/**
 * 
 * @param {String} popupID i.e. "cool-popup"
 * @param {String} message can be anything you want to show in popup
 * @param {('info'|'error'|'warning'|'success')} type can be info, error, warning or success
 */
function showPopup(popupID, message, type) {
    type = type || ""; // info, error, warning, success 
    message = message || "";

    if (popupID.length > 1) {
        var popup = $("#" + popupID);

        if (message.length > 1) {
            var msgBox = popup.find(".message");
            msgBox.empty();
            msgBox.html(message);
        }

        popup.addClass(type);

        popup.addClass("sliding");
        setTimeout(function () {
            popup.removeClass("sliding");
            popup.addClass("show");
        }, 500);
    }
}

/**
 * a shortcut for creating & showing a one-off popup.
 * @param {String} message can be anything you want to show in popup 
 * @param {('info'|'error'|'warning'|'success'|'dark')} type can be info, error, warning or success
 * @param {string} [creationID] an optional ID to refer to this dynamically created popup 
 * @param {boolean} [persist] optionally, make this popup persist?
 */
function createPopup(message, type, creationID, persist) {
    type = type || ""; // info, error, warning, success 
    message = message || "";
    persist = persist || false;
    creationID = creationID || (new Date()).getTime();

    var persistent = "";
    var closeButton = '<button class="close"><img src="../assets/cross.svg" alt="close" title="close message"></button>';
    if (persist) { 
        persistent = "minimizable persistent"; 
        closeButton = `<button class="minimize"><img src="../assets/dash.svg" alt="minimize" title="minimize/maximize message"></button>`;
    }

    var popup = `
    <div class="popup ${type} corner created ${persistent}" id="popup-${creationID}">
        ${closeButton}
        <p class="message justify">${message}</p>
    </div>`;

    $("#create-popups-before-placeholder").before(popup);

    setTimeout(function () {
        showPopup("popup-"+creationID, message, type); 
    }, 10);
}

/**
 * 
 * @param {String} popupID i.e. "cool-popup"
 */
function hidePopup(popupID) {
    if (popupID.length > 1) {
        var popup = $("#" + popupID);
        if (popup.hasClass("show")) {
            popup.removeClass("show");
            popup.addClass("sliding");
            setTimeout(function () {
                popup.removeClass("sliding");
                setTimeout(function () {
                    popup.removeClass("info error warning success");
                    if (popup.hasClass("created")) {
                        popup.remove();
                    }
                }, 500);
            }, 500);
        }
    }
}



/**
 * Toggle minimize / maximize popup
 * @param {String} popupID i.e. "cool-popup"
 */
function minimizeMaximizePopup(popupID) {
    if (popupID.length > 1) {
        var popup = $("#" + popupID);

        var shown = popup.hasClass("show");
        popup.toggleClass("minimized", shown);
        popup.toggleClass("show", !shown);
    }
}

/**
 * A shortcut function to hide all visible popups easily
 */
function hideAllPopups() {
    $(".popup.show").not(".minimizable").not(".minimized").each(function(){
        var id = $(this).attr("id");
        hidePopup(id);
    });
}


////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 MODAL INTERACTIONS & FUNCTIONS
////////////////////////////////////////////////
////////////////////////////////////////////////




/**
 * 
 * @param {String} modalID i.e. "cool-modal"
 */
function showModal(modalID) {
    
    if (modalID.length > 1) {
        var modal = $("#" + modalID);
        modal.addClass("show");
        modal.find("input:first-child").trigger("focus");
    }

    if (typeof hidePanels === 'function') { hidePanels(); }

}

/**
 * 
 * hides active modal
 */
function hideActiveModal() {
    var modal = $(".modal.show");
    modal.removeClass("show");
    modal.find("input").val("");
    modal.find("textarea").val("");
    modal.find("input").blur();
    modal.find("textarea").blur();
}

$('.modal').on('click', 'button.close', function (event) {
    hideActiveModal();
});

$('.modal').on('swipeRight', function (event) {
    if (!$(this).hasClass("persistent")) {
        hideActiveModal();
    }
});

key('esc', function () {
    if ($(".modal.show").length >= 1) {
        hideActiveModal();
    }
});

$(".modal").on('keyup', 'input:first-child, input:last-child' , function(event) {
    if (event.key === "Enter") {
        $(this).parents(".modal").find("button.default").trigger("click");
    }

    if (event.key === "Escape") {
        if ($(this).val().trim() !== "") {
            $(this).val("");
        } else {
            $(this).parents(".modal").find("button.cancel").trigger("click");
        }
    }
    
}); 









////////////////////////////////////////////////
////////////////////////////////////////////////
//	DROPZONE
////////////////////////////////////////////////
////////////////////////////////////////////////

function showDropzone(){
    $("#dropzone").addClass("show");
}

function hideDropzone() {
    $("#dropzone").removeClass("show");
}

////////////////////////////////////////////////
////////////////////////////////////////////////
//	PROGRESS SHORTCUTS
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Starts a progress bar by removing it's max/val attributes 
 * @param {string} progressID i.e. "progress-photo-info"
 */
function startProgressWithID(progressID) {
    if (!progressID) { return; }
    $("#" + progressID).removeAttr("max");
    $("#" + progressID).removeAttr("value");
}

/**
 * Stops a progress bar by removing it's max/val attributes 
 * @param {string} progressID i.e. "progress-photo-info" 
 */
function stopProgressWithID(progressID) {
    if (!progressID) { return; }
    $("#" + progressID).attr("value", 0);
    $("#" + progressID).attr("max", 100);
}


/**
 * Starts progressing a modal, its progress indicator, and disables its buttons etc.
 * @param {String} modalID i.e. "cool-modal"
 */
function startModalProgress(modalID) {
    if (modalID.length > 1) {
        var modal = $("#" + modalID);
        modal.find("progress").removeAttr("max");
        modal.find("progress").removeAttr("value");
        modal.find("button").addClass("loading");
        modal.find("input").trigger("blur");
        modal.find("input").attr("disabled", true);
    }
}

/**
 * Stops progressing a modal, its progress indicator and re-enables its buttons etc.
 * @param {string} modalID i.e. "cool-modal" 
 */
function stopModalProgress(modalID) {
    if (modalID.length > 1) {
        var modal = $("#" + modalID);
        modal.find("progress").attr("value", 0);
        modal.find("progress").attr("max", 100);
        modal.find("button").removeClass("loading");
        modal.find("input").removeAttr("disabled");
    }
}



////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 RADIO BUTTONS
////////////////////////////////////////////////
////////////////////////////////////////////////

$("body").on('click', 'button.radio', function (event) {
    var group = $(this).attr("group");
    $("button[group='" + group + "']").removeClass("selected");
    $(this).addClass("selected");
});


////////////////////////////////////////////////
////////////////////////////////////////////////
//	KEY REMEMBER
////////////////////////////////////////////////
////////////////////////////////////////////////

$("body").on('click', '#key-remember', function (event) {
    $(this).toggleClass("selected");
});


////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 SCROLL RELATED STUFF
////////////////////////////////////////////////
////////////////////////////////////////////////

function throttleScroll(func, wait) {
    var context, args, timeout, throttling, more, result;
    return function () {
        context = this;
        args = arguments;
        var later = function () {
            timeout = null;
            if (more) func.apply(context, args);
        };
        if (!timeout) timeout = setTimeout(later, wait);
        if (throttling) {
            more = true;
        } else {
            result = func.apply(context, args);
        }
        throttling = true;
        return result;
    };
}








////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 GET LOCALE FOR CURRENCIES & BILLING
////////////////////////////////////////////////
////////////////////////////////////////////////

var detectedLocale;
async function getLocale() {
    var response;
    try {
        response = await axios.get(apiROOT + "/api/locale");
    } catch (e) {}

    if (!response) { return; }

    var locale = response.data;
    
    if (!locale) { return; }

    // set currencies
    var cur = locale.cur || "EUR";
    // if (cur === "USD") { $("*[cur]").attr("cur", "$"); }

    // set locale for billing & error collection 
    // (useful for things like keyboard layout incompatibilities)
    // i.e. cyrillic keyboards on some android vendors send a different return character than others etc. etc. 

    var loc = locale.loc || "XX";
    detectedLocale = loc;
    
    try {
        $("#countries > option[value='" + loc + "']").prop('selected', true);
    } catch (e) {}
    
    setSentryTag("locale", loc);

    if (detectedLocale === "GB") {
        $("#favorites-button").html(`fav<span class="hidden-tablet">ourit</span>es`);
    }

}

$(document).on('ready', getLocale); 








////////////////////////////////////////////////
////////////////////////////////////////////////
//	KEY MODAL IMAGE LOADER
////////////////////////////////////////////////
////////////////////////////////////////////////

async function prepKeyModal() {
    var lastImgNo = 0;
    var numImages = 96;
    
    try {
        lastImgNo = sessionStorage.getItem("imgno");
    } catch (e) {}
    
    var imgNo = Math.floor(Math.random() * (numImages - 0) + 0);
    
    if (imgNo == lastImgNo) {
        prepKeyModal();
        return;
    }
    
    sessionStorage.setItem("imgno", imgNo);

    var authorsURL = "https://static.crypt.ee/splash/bw-portrait/authors.json";
    var authorName = "";
    var authorURL = "";
    try {
        var authorsResponse = await axios.get(authorsURL);
        var authors = authorsResponse.data;
        var author = authors[imgNo];
        authorName = author.author;
        authorURL = author.author_url;
    } catch (e) {}

    var imgURL = "https://static.crypt.ee/splash/bw-portrait/" + imgNo + ".jpg";
    $("#key-image").attr("src", imgURL);
    $("#key-image").on('load', function(event) {
        var img = $(this);
        setTimeout(function () {
            img.addClass("loaded");
        }, 100);
    }); 
    
    $("#key-image-author").html("© " + authorName);
    $("#image-author").html("© " + authorName);

}

prepKeyModal();





////////////////////////////////////////////////
////////////////////////////////////////////////
//	GO TO HELPDESK
////////////////////////////////////////////////
////////////////////////////////////////////////

async function goToHelpdesk() {
    if (location.pathname.startsWith("/docs")) {
        startModalProgress("modal-help");
        $("#goToHelpdeskButton").addClass("loading");
        $("#goToHelpdeskButton").html("saving your document...");
        await saveDoc();
        location.href = "/help";
    } else {
        location.href = "/help";
    }
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	UPGRADE
////////////////////////////////////////////////
////////////////////////////////////////////////

async function goToUpgrade() {
    if (location.pathname.startsWith("/docs")) {
        $("#upgrade").addClass("loading");
        $("#upgrade").html("<span>saving your document...</span>");
        if (remainingStorage > 0) { await saveDoc(); } // if we don't have any storage space, we can't save anyway.
        location.href = "/plans";
    } else {
        location.href = "/plans";
    }
}