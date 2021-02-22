


////////////////////////////////////////////////
////////////////////////////////////////////////
// REFRESH TIMER
//
// This fires every 15 seconds to update doc
// generation times / recency etc 
////////////////////////////////////////////////
////////////////////////////////////////////////

var everyFifteenSecondsInterval = setInterval(function() {
    refreshDOM(true); // autorefresh
}, 15000);


////////////////////////////////////////////////
////////////////////////////////////////////////
//	REFRESH DOM (UPDATES ALL NAMES, RECENCY ETC)
////////////////////////////////////////////////
////////////////////////////////////////////////


/**
 * TAKES EVERYTHING FROM CATALOG.DOCS & CATALOG.FOLDERS, AND ONE BY ONE RENDERS THEM IN DOM IN THE CORRECT PLACES IF NECESSARY 
 * @param {boolean} autoRefresh (true if it's an autorefresh, won't leave breadcrumbs)
 */
async function refreshDOM(autoRefresh) {
    autoRefresh = autoRefresh || false;
    if (!autoRefresh) {
        breadcrumb('[REFRESH DOM] Starting');
    }

    // We'll need a master list of all folders this for everything
    // So let's get a folders object full of all folders with their IDs from catalog
    var folders = await getAllFoldersFromCatalog();    

    // RECENTS OR ROOT FOLDERS
    if (!activeFolderID) {
        
        // get all recents from catalog
        var recentDocs = await getRecentDocsFromCatalog();

        // sort recents by time
        recentDocs.sort(gensort);
        
        // render recents
        for (var recentDoc of recentDocs) {
            var docElem = $(`#recents > .doc[did="${recentDoc.docid}"]`);
            
            // don't show recent docs in archived folders 
            // (some docs i.e. homedoc may have no folder so, make sure we also check for docs without folders, and show them here)
            
            var rootFolderParentIDOfDoc = rootParentIDOfFolder(recentDoc.fid, folders); // top-most folder for this doc

            // we want to check if the doc is nested inside an archive folder. so get the topmost folder, (which is what could be archived)
            // then see if it's archived.

            if (!folders[recentDoc.fid] || !folders[rootFolderParentIDOfDoc].archived) { 
                
                if (!docElem.length) {
                    var docHTML = renderDoc(recentDoc, folders);
                    $("#recents").prepend(docHTML);
                } else { 
                    updateDocInDOM(recentDoc, folders);
                }

            }

            // if the parent of the doc is archived, remove it from recents
            if (!isEmpty(folders[rootFolderParentIDOfDoc]) && folders[rootFolderParentIDOfDoc].archived) { docElem.remove(); }

        }
        
        // get all root folders from our folders object
        var rootFolders = [];
        for (var fid in folders) {
            if (!folders[fid].parent && fid !== "f-uncat") { 
                rootFolders.push(folders[fid]); 
            }
        }
        
        // sort root folders by name
        rootFolders.sort(naturalSort);
        
        // add inbox to always top (which in this case is by pushing)
        if (!isEmpty(folders["f-uncat"])) {
            rootFolders.push(folders["f-uncat"]);
        }

        // render root folders
        for (var rootFolder of rootFolders) {
            var folderElem = $(`#folders > .folder[fid="${rootFolder.folderid}"]`);
            if (!folderElem.length) {
                var folderHTML = renderFolder(rootFolder);
                $("#folders").prepend(folderHTML);
            } else {
                // we don't do replacements here, because folder tab is an image, and we want to avoid repainting + flickering 
                updateFolderInDOM(rootFolder);
            }
        }

        // empty recents.
        var hasNoRecents = ($("#recents").children().length === 0);
        $("#leftListWrapper").toggleClass("no-recents", hasNoRecents);

        // no folders.
        var hasNoFolders = ($("#folders").children().length === 0);
        $("#leftListWrapper").toggleClass("no-folders", hasNoFolders);

    // ACTIVE FOLDER
    } else {


        // first render folder header
        var headerElem = $(".folderheader");
        var headerHTML = renderFolderHeader(folders[activeFolderID]);
        if (!headerElem.length) {
            $("#activeFolder").prepend(headerHTML);
        } else {
            headerElem.replaceWith(headerHTML);
        }




        // get subfolders of active folder
        var subfolders = [];
        for (var folderID in folders) {
            if (folders[folderID].parent === activeFolderID) { subfolders.push(folders[folderID]); }
        }
        
        // render sub folders
        for (var subFolder of subfolders) {
            var subfolderElem = $(`#activeFolder > .subfolder[fid="${subFolder.folderid}"]`);
            if (!subfolderElem.length) {
                var subfolderHTML = renderSubFolder(subFolder);
                $(".folderheader").after(subfolderHTML);
            } else { 
                updateFolderInDOM(subFolder);
            }
        }




        // get documents of active folder
        var folderDocs;
        if (activeFolderID) {
            folderDocs = await getDocsOfFolderFromCatalog(activeFolderID);
        }

        // render docs of active folder
        for (var folderDoc of folderDocs) {
            var folderDocElem = $(`#activeFolder > .doc[did="${folderDoc.docid}"]`);
            if (!folderDocElem.length) {
                var folderDocHTML = renderDoc(folderDoc, folders);
                $("#activeFolder").append(folderDocHTML);
            } else { 
                updateDocInDOM(folderDoc, folders);
            }
        }



        
        // finally, sort active folder 
        sortFolder(folderDocs, subfolders, folders[activeFolderID]);

        // empty folder. folder header counts as 1
        var isEmptyFolder = ($("#activeFolder").children().length <= 1);
        $("#activeFolder").toggleClass("empty", isEmptyFolder);
        $("#leftListWrapper").toggleClass("empty-folder", isEmptyFolder);
        
    }



    // active document 
    
    if (activeDocID) {
        try {
            
            // docname
            var activeDoc = await getDocFromCatalog(activeDocID);
            var activeDocName = docName(activeDoc);
            $("#panel-docinfo").find(".name").html(activeDocName);



            // folder name & id
            
            if (activeDocID !== "d-home") {
                
                var activeDocFolder = folders[activeDoc.fid];
                var activeDocFoldername = folderName(activeDocFolder);
                
                $("#panel-docinfo").find(".docfolder").html(activeDocFoldername);
                $("#activeDocFolderButton").attr("fid", activeDoc.fid);
                $("#activeDocFolderButton").show(); 

            } else {
                
                $("#panel-docinfo").find(".docfolder").empty();
                $("#activeDocFolderButton").attr("fid", "");
                $("#activeDocFolderButton").hide(); 

            }
            



            // gen / time
            var lastSaved = new Date(activeDoc.generation / 1000).toLocaleString("en-US", {
                year:"numeric", 
                month:"short", 
                day : "numeric", 
                hour : "numeric", 
                minute : "numeric", 
                second : "numeric" 
            });
            
            $("#panel-docinfo").find(".time").html(lastSaved);



            // offline status 
            if (activeDoc.offline) {
                $("#panel-docfile").addClass("for-offline-items");
            } else {
                $("#panel-docfile").removeClass("for-offline-items");
            }

        } catch (error) {
            error.did = activeDocID;
            handleError("[REFRESH DOM] Couldn't refresh active doc's info panel", error);
        }
        
    }


    // active file

    if (activeFileID) {
        var activeFile = await getDocFromCatalog(activeFileID);
        var activeFilename = docName(activeFile);
        $("#active-filename").attr("name", activeFilename);
    } else {
        $("#active-filename").attr("name", "");
        $("#file-viewer").attr("ext", "");
    }


    if (!autoRefresh) {
        breadcrumb('[REFRESH DOM] Refreshed');
    }
    
    return true;
}





////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 RENDERERS
//   DOC, FILE, FOLDER, SEARCH RESULT ETC.
////////////////////////////////////////////////
////////////////////////////////////////////////



/**
 * Renders and returns a DOM element for a doc
 * @param {Object} doc 
 * @param {Object} folders All Folders mapped by ID 
 * @returns {String} Doc's DOM Element
 */
function renderDoc(doc, folders) {
    
    var randomString = newUUID(16);

    // NAME
    var filename = docName(doc) || randomString; 
    var lcname = filename.toLowerCase();

    // EXTENSION
    var extension = ""; 
    
    // ICON
    var icon = extractFromFilename(filename, "icon");
    if (doc.docid === "d-home") { icon = "ri-home-4-line"; }



    // FOLDER
    var fname = "";
    if (doc.fid && !isEmpty(folders)) { 
        fname = folderName(folders[doc.fid]); 
    }

    // FOLDER COLOR
    var fcolor = "";
    if (doc.fid && !isEmpty(folders)) { 
        fcolor = folders[doc.fid].color || "#FFF";
         
        // for the sake of recent docs, if a folder doesn't have color, then it's white

        if (["#000", "#000000", "#363636"].includes(fcolor)) {
            fcolor = "#FFF";
        }
    }

    // SELECTED
    var selected = "";
    if (selections.includes(doc.docid)) {
        selected = "selected";
    }

    // DECRYPTING
    var decrypting = "";
    if (filename === randomString) { 
        decrypting = "decrypting"; 
    }

    // IS IT A FILE
    // WHEN
    var isfile = "";
    var when = "";

    if (doc.isfile) {
        isfile = "isfile";
        extension = extensionFromFilename(filename);
    } else {
        if (doc.generation > 0) {
            when = timeSince(doc.generation) + " ago";
        } else {
            when = "a long time ago";
        }
    }

    // IS IT OFFLINE 
    var isOffline = "";
    if (doc.offline) {
        isOffline = "offline";
        if (doc.offline > doc.generation) {
            if (doc.offline > 0) {
                when = timeSince(doc.offline) + " ago";
            } else {
                when = "a long time ago";
            }
        }
    }
    
    // ACTIVE DOC
    var active = "";
    if (doc.docid === activeDocID || doc.docid === activeFileID) {
        active = "active";
    }

    // TAGS
    var tags = "";
    if (doc.matchingTags) {
        if (doc.matchingTags.length) {
            tags = doc.matchingTags.join(", ");
        }
    }

    var card = 
    `<div class="doc ${selected} ${decrypting} ${active} ${isfile} ${isOffline}" did="${doc.docid}" gen="${(doc.generation || 0)}" ext="${extension}" name="${lcname}">
        <button class="icon"><i class="${icon}"></i></button>
        <span class="info">
            <p class="name">${filename}</p>
            <small class="when bold">${when}</small>
            <small class="tags">${tags}</small>
            <small class="fldr" fid="${doc.fid}" style="color:${fcolor};">${fname}</small>
        </span>
        <button class="more"><i class="ri-more-2-fill"></i></button>
    </div>`;

    return card;
}


/**
 * Renders and returns a DOM element for a folder
 * @param {Object} folder 
 * @returns {string} Folder's DOM Element
 */
function renderFolder(folder) {

    var fid = folder.folderid;
    
    var fname = folderName(folder);
    if (fid === "f-uncat") { fname = "Inbox"; }
    var lcname = fname.toLowerCase();

    var color = folder.color || "#FFF";

    var archived = "";
    if (folder.archived) {
        archived = "archived";
    }

    var card =
    `<div class="folder ${archived}" style="--fcolor:${color}" fid="${fid}" name="${lcname}">
        <i class="ri-more-2-fill"></i>
        <img class="foldertab" src="../assets/foldertab.svg" draggable="false">
        <div class="contents">
            <p class="name">${fname}</p>
        </div>
    </div>`;

    return card;
}

/**
 * Renders and returns a DOM element for a subfolder
 * @param {Object} folder 
 * @returns {string} Subfolder's DOM Element
 */
function renderSubFolder(folder) {

    var fid = folder.folderid;
    
    var fname = folderName(folder);
    if (fid === "f-uncat") { fname = "Inbox"; }
    var lcname = fname.toLowerCase();

    var color = folder.color || "#FFF";

    // technically speaking, there's no such thing called an archived sub-folder.
    // this is merely here for cosmetic purposes to hide the folder in a nice way.
    var archived = "";
    if (folder.archived) {
        archived = "archived";
    }

    var card = 
    `<div class="subfolder ${archived}" fid="${fid}" name="${lcname}">
        <button class="icon"><i style="color:${color}" class="ri-folder-fill"></i></button>
        <p class="name">${fname}</p>
        <button class="more"><i class="ri-more-2-fill"></i></button>
    </div>`;

    return card;
}

/**
 * Renders and returns a DOM element for a folder header with the back button
 * @param {Object} activeFolder Active Folder Object 
 * @returns {string} Folder Header's DOM Element
 */
function renderFolderHeader(activeFolder) {

    var fname = folderName(activeFolder);
    var ctxButton = "";
    var fid = activeFolder.folderid || ""; 

    if (activeFolder) {
        if (fid === "f-uncat") { 
            fname = "Inbox"; 
            ctxButton = `<button class="icon" id="inbox-info" onclick="showInboxPopup();"><i class="ri-question-fill"></i></button>`;
        } else {
            ctxButton = `<button class="icon" id="active-folder-dropdown" onclick="showFolderRightClickDropdown(activeFolderID,0,48);"><i class="ri-more-2-fill"></i></button>`;
        }
    }

    var card = 
    `<div class="folderheader" fid='${fid}'>
        <button class="icon goback"><i class="ri-arrow-left-line"></i></button>
        <p class="name">${fname}</p>
        ${ctxButton}
    </div>`;

    return card;
}


/**
 * Renders a separator for the file explorer
 * @param {string} label the separator label (if not provided, it'll be "documents")
 * @param {*} order where the separator will be in the list
 */
function renderSeparator(label,order) {
    label = label || "documents";
    return `<div class="separator" style="order:${order};" order="${order}"><hr><small>${label}</small></div>`;
}


/**
 * Renders and returns a DOM element for an upload to be added into the uploads panel
 * @param {string} uploadID 
 * @param {string} name 
 * @param {number} loaded 
 * @param {number} total 
 * @param {string} status (or percentage)
 */
function renderUpload(uploadID, name, loaded, total, status) {
    loded = loaded || "0";
    total = total || 100;
    status = status || "%00.00";
    name = name || " ";

    var uploadCard = 
    `<div class="upload" id="upload-${uploadID}" status="${status}">
        <p>${name}</p>
        <small class="status">${status}</small>
        <progress class="progress white" value="${loaded}" max="${total}"></progress>
    </div>`;

    return uploadCard;
}














////////////////////////////////////////////////
////////////////////////////////////////////////
//	UPDATE RENDERED ITEMS
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Updates a folder's DOM element with the correct values
 * @param {Object} folder 
 */
function updateFolderInDOM(folder) {

    var fid = folder.folderid;
    
    var fname = folderName(folder);
    if (fid === "f-uncat") { fname = "Inbox"; }
    var lcname = fname.toLowerCase();

    var color = folder.color || "#FFF";

    $(`.folder[fid="${fid}"]`).attr("style", `--fcolor:${color}`);
    $(`.folder[fid="${fid}"]`).find(".name").html(fname);
    $(`.folder[fid="${fid}"]`).attr("name", lcname);

    $(`.subfolder[fid="${fid}"]`).find(".ri-folder-fill").attr("style", `color:${color}`);
    $(`.subfolder[fid="${fid}"]`).find(".name").html(fname);
    $(`.subfolder[fid="${fid}"]`).attr("name", lcname);

    if (folder.archived) {
        $(`.folder[fid="${fid}"]`).addClass("archived");
        $(`.subfolder[fid="${fid}"]`).addClass("archived");
    } else {
        $(`.folder[fid="${fid}"]`).removeClass("archived");
        $(`.subfolder[fid="${fid}"]`).removeClass("archived");
    }
    
}





/**
 * Updates a doc's DOM element with the correct values
 * @param {Object} doc 
 * @param {Object} folders All Folders mapped by ID 
 */
function updateDocInDOM(doc, folders) {
    
    var docElem = $(`.doc[did="${doc.docid}"]`);

    var randomString = newUUID(16);

    // NAME
    var filename = docName(doc) || randomString; 
    var lcname = filename.toLowerCase();
    docElem.find(".name").html(filename);
    docElem.attr("name", lcname);

    // ICON
    var icon = extractFromFilename(filename, "icon");
    if (doc.docid === "d-home") { icon = "ri-home-4-line"; }

    docElem.find(".icon").find("i").removeClass();
    docElem.find(".icon").find("i").addClass(icon);

    // FOLDER
    var fname = "";
    if (doc.fid) { 
        fname = folderName(folders[doc.fid]); 
        docElem.find(".fldr").attr("fid", doc.fid);
        docElem.find(".fldr").html(fname);
    }

    // FOLDER COLOR
    var fcolor = "";
    if (doc.fid && !isEmpty(folders)) { 
        fcolor = folders[doc.fid].color || "#FFF";
            
        // for the sake of recent docs, if a folder doesn't have color, then it's white

        if (["#000", "#000000", "#363636"].includes(fcolor)) {
            fcolor = "#FFF";
        }

        docElem.find(".fldr").attr("style", `color:${fcolor};`);
    }

        
    // SELECTED
    docElem.toggleClass("selected", selections.includes(doc.docid));

    // DECRYPTING
    docElem.toggleClass("decrypting", (filename === randomString));

    // IS FILE & EXTENSION
    if (doc.isfile) {
        docElem.addClass("isfile");
        docElem.attr("ext", extensionFromFilename(filename));
    } else {
        docElem.removeClass("isfile");
        docElem.attr("ext", "");
    }

    var when = timeSince(doc.generation) + " ago";
    if (doc.generation <= 0) { when = "a long time ago"; } 

    // IS OFFLINE
    if (doc.offline) {
        docElem.addClass("offline");
        
        if (doc.offline > doc.generation) {
            if (doc.offline > 0) {
                when = timeSince(doc.offline) + " ago";
            } else {
                when = "a long time ago";
            }
        }

    } else {
        docElem.removeClass("offline");
    }

    // WHEN
    docElem.attr("gen", (doc.generation || 0));
    docElem.find(".when").html(when);
    
    // ACTIVE DOC
    var isActive = (doc.docid === activeDocID || doc.docid === activeFileID);
    docElem.toggleClass("active", isActive);

}