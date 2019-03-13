var theUser, theUsername, theEmail, metaRef, theUserID, typeOfApp;

firebase.auth().onAuthStateChanged(function (user) {
    if (user) {
        //got user
        theUser = user;
        theUsername = theUser.displayName;
        theEmail = theUser.email;
        theUserID = theUser.uid;
        gotUser();
    }
});

function gotUser() {
    var unameToShow = " " + (theUsername || theEmail);
    $('.username').html(unameToShow);
}

function submitReport() {
    var description = $("textarea").val().trim();
    var contact = $("#email-input").val().trim();
    var reason = $("#contact-form").attr("formtype");

    if (isInWebAppiOS || isInWebAppChrome) {
        typeOfApp = "PWA";
    } else {
        typeOfApp = "WEB";
    }

    var crypteeUID = theUserID || "(Unknown)";
    var crypteeEmail = theEmail;
    var crypteeUsername = theUsername;

    var appType = typeOfApp;
    var ua = (navigator.userAgent || "(Unknown)");
    var resolution = $(window).width().toString() + "x" + $(window).height().toString();

    var contactFormObject = {
        "reason": reason,
        "description": description,
        "contact": contact,
        "crypteeUID": crypteeUID,
        "crypteeEmail": crypteeEmail,
        "crypteeUsername": crypteeUsername,
        "appType": appType,
        "ua": ua,
        "resolution": resolution
    };

    if (description !== "" && contact !== "") {
        collectContactForm(contactFormObject);

        $("button").addClass("is-loading").attr('disabled', 'disabled').prop("disabled", true);

        setTimeout(function () {
            formSubmitted();
        }, 2000);
    }
}

function formSubmitted() {
    $("button").html("Thank you!").addClass("is-success").removeClass("is-loading").attr('disabled', 'disabled').prop("disabled", true);
}

function showContactForm(type) {
    hideSearch();
    if (type === "bugreport") {
        $("#form-text").html("Please describe the bug below, and include what <b>device, model, operating system &amp; browser</b> you were using (and their versions too if you know them). This will help us reproduce the error better and quicker.<br><br>");
        $("#form-description").attr("placeholder", "... I was writing my journal using Cryptee Docs on Windows 10 with Google Chrome v69, then my cat jumped onto my laptop and finished the journal for me ...");
    } else {
        $("#form-text").html("<b>How can we help you?</b>");
        $("#form-description-title").hide();
        $("#form-description").attr("placeholder", "... How can I train my dog to fetch? ...")
    }
    $("#contact-form").attr("formtype", type);
    $("#contact-form").show();
    window.location = "#contact-form"    
}










/*//////////////////////////////////////////////////
/////////////// ARTICLE MANAGEMENT /////////////////
//////////////////////////////////////////////////*/

var articlesRootURL = "https://kb.crypt.ee";
var articlesCollection = [];
var slug = getUrlParameter("article");
var topic = getUrlParameter("topic");
var articlesReady = false;
var topics = {
    "account" : '<span class="icon"><i class="fa fa-user"></i></span> Account &amp; Security',
    "general" : '<span class="icon"><i class="fa fa-lock"></i></span> General',
    "payments" : '<span class="icon"><i class="fa fa-credit-card"></i></span> Payments',
    "docs" : '<span class="icon"><i class="fa fa-file"></i></span> Cryptee Documents',
    "photos" : '<span class="icon"><i class="fa fa-photo"></i></span> Cryptee Photos'
}

function fetchAllArticles() {
    showWindowProgress();
    $.ajax({ url: articlesRootURL, type: 'GET', dataType: 'text',
        success: function(allArticlesXML) {
            var x2js = new X2JS();
            x2js.xml_str2json(allArticlesXML).ListBucketResult.Contents.forEach(function(article){

                if (article.Key.split("/")[1]) {
                    // article                    
                    var theTitle = b64URLToString(article.Key.split("/")[1].replace(".html",""));
                    var theSlug = slugify(theTitle);

                    articlesCollection.push({
                        "slug" : theSlug,
                        "title" : theTitle,
                        "topic" : article.Key.split("/")[0],
                        "url" : article.Key
                    });
                }
                
            });

            articlesCollectionReady();
        },
        error:function (xhr, ajaxOptions, thrownError){
            console.log("Couldn't load articles:", thrownError);
        }
    });
}

fetchAllArticles();

function articlesCollectionReady() {
    hideWindowProgress();
    $("#search-bar").find(".button").removeClass("is-loading");

    if (slug) { loadArticle(slug); }
    if (topic) { loadTopic(topic); }

    articlesReady = true;
}

function loadArticle(articleSlug) {
    if (articleSlug) {
        clearSearch();
        showWindowProgress();
        var articleURL;
        articlesCollection.forEach(function(article){
            if (article.slug === articleSlug) {
                articleURL = articlesRootURL + "/" + article.url;
            }
        });
        $( "#article-contents" ).load(articleURL, function( response, status, xhr ) {
            if ( status == "error" ) {
                console.log("Sorry but there was an error loading this article.");
            } else {
                history.replaceState("article", null, '/help?article='+articleSlug);
                $("html").scrollTop(0);
                ping("event", {eventCategory: "help-article", eventAction : articleSlug});
                showContent();
            }
        });
    } else {
        closeArticle();
    }
}

function closeArticle(then) {
    hideContent(then);
    history.replaceState("home", null, '/help');
}

function showContent(callback) {
    $(".is-hidden-with-content").addClass("is-invisible");
    setTimeout(function () {
        $("#contact-form").hide();
        $(".is-hidden-with-content").hide();
        $(".is-visible-with-content").show();
        $(".is-visible-with-content").addClass("is-visible");
        hideWindowProgress();
    }, 505);
}

function hideContent(then) {
    $(".is-visible-with-content").removeClass("is-visible");
    setTimeout(function () {
        $(".is-hidden-with-content").show();
        $(".is-hidden-with-content").removeClass("is-invisible");
        setTimeout(function () {
            $(".is-visible-with-content").hide();
            if (then === "contact") {
                showContactForm('contactform');
            }
        }, 505);
    }, 505);
}


function showWindowProgress () {
    $("#nav-logo").attr("src", "../assets/loading-f5f5f5.gif");
    $("#main-progress").removeAttr("value");
}

function hideWindowProgress () {
    $("#nav-logo").attr("src", "../assets/cryptee-logo-b.svg");
    $("#main-progress").attr("value", "100");
}


/*//////////////////////////////////////////////////
////////////////// SEARCH TERMS ////////////////////
//////////////////////////////////////////////////*/

var searchOptions = {
    shouldSort: true,
    threshold: 0.3,
    location: 0,
    distance: 500,
    maxPatternLength: 250,
    minMatchCharLength: 1,
    includeMatches: true,
    keys: [ "title" ]
};
  
$("#search-input").on("keydown", function(event) {
    // ios 11 compatiblity. we can't trigger shit with keyup and keydown fires before character is in input.
    setTimeout(function(){
  
      if (event.keyCode === 27) {
        event.preventDefault();
        clearSearch();
      } else if (event.keyCode === 8 && $("#search-input").val().trim() === "") {
        event.preventDefault();
        clearSearch();
      } else {
        search($("#search-input").val().trim());
      }
  
      if ($("#search-input").val().trim() === "") {
        clearSearch();
      }

    }, 50);
});
  
function search (term){
    $("#search-button-icon").addClass("fa-close").removeClass("fa-search");
    var fuse = new Fuse(articlesCollection, searchOptions);
    var results = fuse.search(term);
    displaySearchResults(results, term);
}

function clearSearch() {
    $("#search-button-icon").removeClass("fa-close").addClass("fa-search");
    $("#search-input").val("");
    $("#search-results").html("");
    hideSearch();
}

function displaySearchResults(results, term) {
    showSearch();
    $("#search-results").html("");

    var resultsToAppend = [];
    $.each(results, function(i, rslt) {
        
        var result = rslt.item;
        var resultTitle = result.title;
        var resultSlug = result.slug.replace(" ", "");

        $.each(rslt.matches, function(i, mtch) {
            if (mtch.key === "title") {

                var pair = mtch.indices.shift();
                var resultname = [];
                // Build the formatted string
                for (var j = 0; j < resultTitle.length; j++) {
                    var char = resultTitle.charAt(j);
                    
                    if (pair && j == pair[0]) {
                        resultname.push('<u>');
                    }
                    
                    resultname.push(char);
                    
                    if (pair && j == pair[1]) {
                        resultname.push('</u>');
                        pair = mtch.indices.shift();
                    }
                }
            
                resultTitle = resultname.join('');
            }
        });

        var srCard =
        '<div class="column is-full">'+
            '<a class="tag help-tag is-medium" onclick="loadArticle(\''+resultSlug+'\')">'+
                '<span class="icon"><i class="fa fa-file-text-o"></i></span> &nbsp;'+
                '<span>'+resultTitle+'</span>'+
            '</a>'+
        '</div>';

        resultsToAppend.push(srCard);
    });

    if (results.length > 0) {
        $("#search-results").append(resultsToAppend.join(""));
    } else {
        var noResults = "<div class='has-text-centered'><br><br><p>Looks like we don't have an answer for what you need help with. <br> Contact us and we'll get back to you shortly with an answer.</p>" +
        '<br><br><div class="button hero-button www-action-button" onclick="showContactForm(\'contactform\')">Contact Us</div><br><br><br><br></div>';
        
        $("#search-results").append(noResults);
    }
}

function showSearch() {
    $("html, body").addClass("resultsVisible");
    $("#help-results").addClass("visible");
}

function hideSearch() {
    $("html, body").removeClass("resultsVisible");
    $("#help-results").removeClass("visible");
    $("#search-results").html("");
}


function loadTopic(topicID) {
    if (topicID) {

        showSearch();
        $("#search-results").html("");
        var once = false;
        if (articlesReady) {
            history.replaceState("topic", null, '/help?topic='+topicID);
            ping("event", {eventCategory: "help-topic", eventAction : topicID});
            $.each(articlesCollection, function(i,article) {
                if (article.topic === topicID) {
                    var srCard =
                    '<div class="column is-full">'+
                    '<a class="tag help-tag is-medium" onclick="loadArticle(\''+article.slug+'\')">'+
                    '<span class="icon"><i class="fa fa-file-text-o"></i></span> &nbsp;'+
                    '<span>'+article.title.trim()+'</span>'+
                    '</a>'+
                    '</div>';
                    
                    if (!once) {
                        $("#search-results").append('<a onclick="closeTopic();" style="margin-right:auto; line-height:3rem;"><b><span class="icon"><i class="fa fa-caret-left"></i></span> Back<span class="is-hidden-mobile"> to Helpdesk</span></b></a>');
                        $("#search-results").append("<h3>"+topics[topicID]+"</h3>");
                        once = true;
                    }
                    
                    $("#search-results").append(srCard);
                }  
            });
        } else {
            setTimeout(function () {
                loadTopic(topicID);
            }, 100);
        }
        
    } else {
        closeTopic();
    }
}

function closeTopic() {
    hideSearch();
    history.replaceState("home", null, '/help');
}