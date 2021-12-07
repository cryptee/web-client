
////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////
//	
//
//  SEARCH
//
//
////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////

// 1A) WE'LL CHECK CATALOG, AND IF THERE'S ANYTHING WITHOUT TITLES, REQUEST ALL TITLES FROM SERVER, AND SLOWLY START DECRYPTING THEM 
// 1B) WE'LL SEARCH THE EXISTING CATALOG WITH WHAT'S IN THE INPUT FIELD, AND SEE IF WE CAN FIND ANYTHING IN IT – 
// 2 ) UNTIL WE GET SERVER'S RESPONSE, WE'LL SHOW SEARCHING PROGRESS
// 3 ) ONCE WE GET SERVER'S RESPONSE, WE SHOW THE NUMBER OF ITEMS WE'LL NEED TO DECRYPT IN PROGRESS
// 4 ) ONCE DECRYPTION IS COMPLETE, WE'LL SEARCH WITH WHAT'S IN THE INPUT FIELD AGAIN & UPDATE RESULTS




////////////////////////////////////////////////
////////////////////////////////////////////////
//	INIT
////////////////////////////////////////////////
////////////////////////////////////////////////


var searchTimer, searchKeydownTimer;

var searchArray = [];

var searchOptions = {
    shouldSort: true,
    threshold: 0.4,
    location: 0,
    distance: 100,
    maxPatternLength: 32,
    minMatchCharLength: 2,
    includeMatches: true,
    useExtendedSearch: true,
    includeScore: true,
    keys: [ "type", "decryptedTitle", "decryptedTags" ]
};

async function search(term) {
        
    if (term.length < 2) { return; }

    loadSearch();
    
    var allDocsAndFolders = await createSearchIndexFromCatalog(); 
    var fuse = new Fuse(searchArray, searchOptions);
    var results = fuse.search(term, { limit : 50 });
    processSearchResults(results, allDocsAndFolders, term);
    
    // once we've decrypted the entire catalog, we'll stop here.
    if (decryptedEntireCatalog) { 
        stopLeftProgress();
        return true;  
    }

    // if there are still unencrypted things in the catalog, and we're online continue searching here.
    if (isOnline()) {
        // download all missing titles, decrypt & continue searching
        // if we're already downloading and decrypting, this will return false
        // so we'll skip searching, and have the previous search function finish things up
        var downloadedAndDecrypted = await downloadAndDecryptTheEntireCatalog(allDocsAndFolders.docs);
        
        if (downloadedAndDecrypted) {
            await search(term);
        }
        
        return true;
    }

    // we're offline, can't search more, stop search
    stopLeftProgress();
    return false;
}









/**
 * This gets all docs & folders from catalog, and updates/creates a searchArray for fuse to search
 * @returns {Object} docsAndfolders
 * @returns {Object} docsAndfolders.docs all docs mapped by id
 * @returns {Object} docsAndfolders.folders all folders mapped by id
 */
async function createSearchIndexFromCatalog() {
    
    breadcrumb('[SEARCH] Indexing');

    var allDocsAndFolders = await getAllDocsAndFoldersFromCatalog();
    var folders = {};
    var docs = {};

    if (!Number.isInteger(allDocsAndFolders.length)) {
        createPopup("Failed to search. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        searchArray = [];
        return false;
    }

    // add searchable types to items
    allDocsAndFolders.forEach(item => {
        
        if (item.docid) { docs[item.docid] = item; }
        if (item.folderid) { folders[item.folderid] = item; }

        if (!item.decryptedTitle) { return; }
        
        if (item.docid) { 
            // add filetypes for search
            item.type = extractFromFilename(item.decryptedTitle, "filetype"); 
            
            // add home document 
            if (item.docid === "d-home") { item.decryptedTitle = "Home Document"; }
        }

        if (item.folderid) { 
            if (item.parent) {
                item.type = "subfolder"; 
            } else {
                item.type = "folder"; 
            }

            // add inbox folder
            if (item.folderid === "f-uncat") { item.decryptedTitle = "Inbox Folder"; }
        }

    });

    searchArray = allDocsAndFolders;

    breadcrumb('[SEARCH] Indexed');

    return {folders:folders, docs:docs};

}























/**
 * Processes & prepares search results to display them
 * @param {Array} results An array of resulting doc or folder objects [{doc}, {doc}, {folder}, ...]
 * @param {Object} allDocsAndFolders {docs:docs, folders:folders} An object of two objects, 'docs' and 'folders', containing items mapped by their ids  
 * @param {String} term search term 
 */
function processSearchResults(results, allDocsAndFolders, term) {
    var allFolders = allDocsAndFolders.folders;

    $("#results").children().remove();
    searchHighlightIndex = -1;
        
    // user cleared search before we got the results, skip
    clearTimeout(clearSearchTimeout);
    if (!$("#searchInput").val().trim()) { clearSearch(); }

    results.forEach((result, i) => {
        var item = result.item;

        // if the doc / folder doesn't have a title, skip
        if (!item.decryptedTitle) { return; }

        result.matches.forEach(match => {
            if (match.key === "decryptedTitle") {
                item.decryptedTitle = item.decryptedTitle;
            } 
            
            if (match.key === "decryptedTags") {
                var matchingTag = "#" + match.value;
                item.matchingTags = item.matchingTags || [];
                item.matchingTags.push(matchingTag);
            }
        });

        if (item.docid) {
            $("#results").append(renderDoc(item, allFolders));
        } else {
            $("#results").append(renderSubFolder(item));
        }
    });

}



var searchHighlightIndex = -1;

function highlightNextSearchResult () {
    if (searchHighlightIndex < $("#results").children().length - 1) {
        $("#results > .highlight").removeClass("highlight");
        searchHighlightIndex++;
        $("#results").children().eq(searchHighlightIndex).addClass("highlight");
    }
    scrollToHighlightedResult();
}

function highlightPreviousSearchResult () {
    if (searchHighlightIndex > 0) {
        $("#results > .highlight").removeClass("highlight");
        searchHighlightIndex--;
        $("#results").children().eq(searchHighlightIndex).addClass("highlight");
    }
    scrollToHighlightedResult();
}

function loadHighlightedResult() {
    if (isOnline()) {
        $("#results > .highlight").not(".active, .loading, .decrypting").find(".info").trigger("click");
    } else {
        $("#results > .highlight.offline").not(".active, .loading, .decrypting").find(".info").trigger("click");

        if (!$("#results > .doc.highlight").hasClass("offline")) {
            showDocNotAvailableOfflinePopup();        
        }
    }

    $("#results > .subfolder.highlight").trigger("click");
}

function scrollToHighlightedResult() {
    // don't worry there's max 50 results
    
    var scrollPosition = $("#results").scrollTop() - 128;
    var result = $("#results > .highlight");
    var resultTop = result.offset().top;
    var resultHeight = result.offset().height;
    var resultBottom = resultTop + resultHeight;    
    
    if (resultTop <= 0) {
        $("#results")[0].scrollTo({ 
            top: scrollPosition - resultHeight + resultTop, 
            left: 0, 
            behavior: 'smooth' 
        });
    } else {
        $("#results")[0].scrollTo({ 
            top: scrollPosition - resultHeight + resultBottom, 
            left: 0, 
            behavior: 'smooth' 
        });
    }
    
}


var clearSearchTimeout;
/**
 * Clears search, loads recents, and optionally blurs the search input
 * @param {boolean} blur 
 */
function clearSearch(blur) {
    blur = blur || false;
    
    if (blur) { 
        clear(); 
    } else {
        clearTimeout(clearSearchTimeout);

        $("#results").children().remove();
        searchHighlightIndex = -1;

        clearSearchTimeout = setTimeout(clear, 500);
    }

    function clear() {
        $("#searchInput").val("");     
        if (blur) { $("#searchInput").trigger("blur"); }
        loadRecents(); // this also refreshes dom
    }
}

function clearSearchOnlyIfNecessary() {
    if ($("#searchInput").val().trim()) {
        clearSearch(true);
    }
}
