var theUser, theUsername, theEmail, metaRef, theUserID, typeOfApp;
detectedLocale = detectedLocale || "XX";

function loadHome() {
    location.href = "/home";
}

function slugToArticleID(slug) {
    var foundArticleID;
    for (var articleID in articles) {
        var article = articles[articleID];
        if (article.slug === slug) {
            foundArticleID = articleID;
        }
    }
    return foundArticleID;
}

////////////////////////////////////////////////
////////////////////////////////////////////////
//	AUTH / STARTUP
////////////////////////////////////////////////
////////////////////////////////////////////////

authenticate(function(user){
    // LOGGED IN
}, function(){
    // NOT LOGGED IN
}, function(error) {
    // ERROR
    if (error.code === "auth/network-request-failed") {
        handleError("[HOME] Error Authenticating", error);
    }
});



////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 LOAD ALL ARTICLES
////////////////////////////////////////////////
////////////////////////////////////////////////

var articles = {};
var slug = getUrlParameter("article");
var topic = getUrlParameter("topic");

async function fetchAllArticles() {
    try {
        articles = (await axios.get(apiROOT + "/api/kb/posts")).data;
    } catch (e) {
        handleError("Couldn't fetch kb articles", e);
    }

    if (articles) { articlesReady(); }
}

fetchAllArticles();

function articlesReady() {
    if (slug)  { loadArticle(slug); }
    if (topic) { loadTopic(topic);  }
}

////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 LOAD ARTICLE
////////////////////////////////////////////////
////////////////////////////////////////////////


function closeArticle() {
    $("body").removeClass("article");
    $("article").children().remove();
    history.replaceState("home", null, '/help');
    // window.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
}

function loadArticle(slug) {
    if (!articles || !slug) { 
        handleError("[HELP] Can't load an article without articles / slug.");
    }

    var articleID = slugToArticleID(slug);
    
    if (!articleID) {
        handleError("[HELP] Article with slug not found.", {slug:slug}, "warning");
        return false;
    }

    $("body").addClass("article");
    $("main").addClass("loading");   
    clearSearch();
    
    var articleURL = apiROOT + "/api/kb/post?id=" + articleID;

    $("article").load(articleURL, function(res, status, xhr) {
        if (status === "error") {
            handleError("[HELP] Failed to load article with slug.", { slug : slug }, "warning");
        } else {
            articleLoaded(slug);
        }
    });
}

function articleLoaded(slug) {
    history.replaceState("article", null, '/help?article='+slug);
    $("article")[0].scrollTo({ top: 0, left: 0 });

    $("main").removeClass("loading");
    $("article").children().each(function(i) {
        var child = $(this);
        setTimeout(function () { child.addClass("loaded"); }, i * 15);
    });
}


////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 LOAD TOPIC ("CATEGORY" in knowledgebase)
////////////////////////////////////////////////
////////////////////////////////////////////////


function loadTopic(topicID) {
    if (!articles || !topicID) { 
        handleError("[HELP] Can't load a topic without articles / topicID.");
    }
    
    clearSearch();
    clearTimeout(clearTopicTimeout);
    $("#results").addClass("floating");
    history.replaceState("topic", null, '/help?topic='+topicID);

    var articlesToAppend = [];
    $.each(articles, function(i,article) {
        if (article.cat === topicID) {

            var articleTitle = article.title.trim();
            var articleSlug = article.slug;

            var srCard = `<p onclick="loadArticle('${articleSlug}')">– ${articleTitle}</p>`;
            if (!articlesToAppend.includes(srCard)) { 
                articlesToAppend.push(srCard);
            }
            
        }  
    });

    $("#results").append(articlesToAppend.join(""));
    
}


////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 SEARCH
////////////////////////////////////////////////
////////////////////////////////////////////////

var searchOptions = {
    shouldSort: true,
    threshold: 0.3,
    location: 0,
    distance: 500,
    maxPatternLength: 250,
    minMatchCharLength: 1,
    includeMatches: true,
    keys: [ {name:"title", weight:0.3}, {name:"tags", weight:0.7} ]
};

$("#searchInput").on("keydown", function(event) {
    // ios 11 compatiblity. we can't trigger shit with keyup and keydown fires before character is in input.
    setTimeout(function () {
        var value = $("#searchInput").val().trim();

        if (event.key === "Escape") {
            event.preventDefault();
            clearSearch();
        } else if (event.key === "Backspace" && !value) {
            event.preventDefault();
            clearSearch();
        } else {
            search(value); 
        }

        if (!value) { clearSearch(); }

    }, 50);
});
  
function search(term) {
    var fuse = new Fuse(Object.values(articles), searchOptions);
    var results = fuse.search(term);
    displaySearchResults(results, term);
}

function displaySearchResults(results, term) {
    $("#results").empty();
    $("#results").removeClass("floating");

    var resultsToAppend = [];
    $.each(results, function(i, rslt) {
        
        var result = rslt.item;
        var resultTitle = result.title.trim();
        var resultSlug = result.slug;
        
        $.each(rslt.matches, function(i, mtch) {
            if (mtch.key === "title") {
                resultTitle = underlineSearchResult(mtch.indices,resultTitle);
            }
        });

        var srCard = `<p onclick="loadArticle('${resultSlug}')">– ${resultTitle}</p>`;
        if (!resultsToAppend.includes(srCard)) { 
            resultsToAppend.push(srCard);
        }

    });

    if (results.length > 0) {
        $("#results").append(resultsToAppend.join(""));
    } else {
        var noResults = "<div class='has-text-centered'><br><br><p>looks like we don't have an answer for that question.<br><br> perhaps try a few other ways to ask the same question.<br><br> we have hundreds of help articles and chances are you are seconds away from finding an answer to your question. if you still can't find the answer you're looking for, contact us and we'll get back to you shortly with an answer.</p>" +
        '<br><br><div class="button hero-button www-action-button white bold" onclick="openContact();">contact us</div><br><br><br><br></div>';
        
        $("#results").append(noResults);
    }
}

function clearSearch() {
    history.replaceState("home", null, '/help');

    $("#searchInput").val("");
    $("#searchInput").trigger("blur");
    $("#results").empty();
}

var clearTopicTimeout;
function clearTopicResults() {
    clearSearch();
    
    clearTopicTimeout = setTimeout(function () {
        $("#results").removeClass("floating");
    }, 1000);
}

key('command+F, ctrl+F', function () {
    if ($("body").hasClass("article")) { 
        return true; 
    }

    $("#searchInput").trigger("focus");
    return false;
});

key('esc', function() {
    closeArticle();
    return true;
});

$("#searchInput").on('focus', function(event) {
    hideHelpPanel();
}); 

////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 CONTACT
////////////////////////////////////////////////
////////////////////////////////////////////////

function openContact(which) {
    clearTopicResults();
    if (which === "bug") {
        showHelpPanel("panel-bug");
    } else {
        showHelpPanel("panel-contact");
    }
}

async function sendBugReport() {
    
    var email = $("#bug-report-form-email").val().trim();
    if (!email || !isEmail(email)) { 
        $("#bug-report-form-email").trigger("focus");
        return false;
    }

    var body = $("#bug-report-form").val().trim();
    if (!body) {
        $("#bug-report-form").trigger("focus");
        return false;
    }

    startHelpProgress("panel-bug");
    var submittedForm;

    try {
        submittedForm = await submitForm("bug", {
            email : email, 
            body : body,
        });
    } catch (error) {
        error.email = email;
        error.body = body;
        handleError("[FORMS] Failed to submit bug report", error);
    }

    if (!submittedForm) {
        var error = {};
        error.email = email;
        error.body = body;
        error.status = submittedForm.status;
        handleError("[FORMS] Failed to submit bug report", error);
        createPopup("Looks like we're having a difficulty submitting your bug report... Ohhh the irony... Chances are this is a connectivity issue. Your browser or ad-blocker may be blocking connections to our servers. Please check your internet connection, unblock connections to Cryptee from your ad-blocker and try again.", "error");
    }

    stopHelpProgress("panel-bug");
    hideHelpPanel();
    createPopup("Thank you for helping us fix cryptee's errors and get rid of its bugs! We've received your bug report and someone from our team will get back to you as quickly as humanly possible", "success");
    return true;


}

async function sendContactForm() {

    var email = $("#contact-form-email").val().trim();
    if (!email || !isEmail(email)) { 
        $("#contact-form-email").trigger("focus");
        return false;
    }

    var body = $("#contact-form").val().trim();
    if (!body) {
        $("#contact-form").trigger("focus");
        return false;
    }

    startHelpProgress("panel-contact");
    var submittedForm;

    try {
        submittedForm = await submitForm("help", {
            email : email, 
            body : body,
            meta : collectDiagnosticsInfo()
        });
    } catch (error) {
        error.email = email;
        error.body = body;
        handleError("[FORMS] Failed to submit help form", error);
    }

    if (!submittedForm) {
        var error = {};
        error.email = email;
        error.body = body;
        error.status = submittedForm.status;
        handleError("[FORMS] Failed to submit help form", error);
        createPopup("Looks like we're having a difficulty processing your question / feedback message. Chances are this is a connectivity issue. Your browser or ad-blocker may be blocking connections to our servers. Please check your internet connection, unblock connections to Cryptee from your ad-blocker and try again.", "error");

    }

    stopHelpProgress("panel-contact");
    hideHelpPanel();
    createPopup("Thank you contacting us! We've received your support question / feedback message and someone from our team will get back to you as quickly as humanly possible", "success");
    return true;

}


/**
 * Shows the help contact / bug panel
 * @param {String} which 
 */
function showHelpPanel(which) {
    $("#" + which).addClass("show");
}


/**
 * Hides the help contact / bug panel
 */
function hideHelpPanel() {
    $(".panel-help").removeClass("show");
}


/**
 * Starts progressing a help panel, its progress indicator, and disables its buttons etc.
 * @param {String} panelID i.e. "panel-bug"
 */
function startHelpProgress(panelID) {
    if (panelID.length > 1) {
        var panel = $("#" + panelID);
        panel.find("progress").removeAttr("max");
        panel.find("progress").removeAttr("value");
        panel.find("button").addClass("loading");
        panel.find("input").trigger("blur");
        panel.find("input").attr("disabled", true);
        panel.find("textarea").attr("disabled", true);
    }
}



/**
 * Stops progressing a help panel, its progress indicator and re-enables its buttons etc.
 * @param {string} panelID i.e. "panel-bug" 
 */
function stopHelpProgress(panelID) {
    if (panelID.length > 1) {
        var panel = $("#" + panelID);
        panel.find("progress").attr("value", 0);
        panel.find("progress").attr("max", 100);
        panel.find("button").removeClass("loading");
        panel.find("input").removeAttr("disabled");
        panel.find("textarea").removeAttr("disabled");
    }
}