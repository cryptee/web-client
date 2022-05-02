
////////////////////////////////////////////////
////////////////////////////////////////////////
//	ALL API / CATALOG ACTIONS & SHORTCUTS
////////////////////////////////////////////////
////////////////////////////////////////////////


////////////////////////////////////////////////
////////////////////////////////////////////////
//	RENAME DOC OR FOLDER
////////////////////////////////////////////////
////////////////////////////////////////////////
/**
 * Renames a doc / folder in server and catalog, then refreshes the DOM.
 * @param {string} id DocID or FolderID
 * @param {string} name A name for the doc or folder
 */
async function renameDocOrFolder(id, name) {

    breadcrumb("[RENAME] Encrypting title of " + id);

    // encrypt title
    var encryptedTitle;
    var encryptedStringifiedTitle;

    try {
        encryptedTitle = await encrypt(JSON.stringify(name), [theKey]);
        encryptedStringifiedTitle = JSON.stringify(encryptedTitle);
    } catch (error) {
        handleError("[RENAME] Failed to encrypt title for rename.", error);
        return false;
    }
    
    if (!encryptedStringifiedTitle) {
        handleError("[RENAME] Failed to encrypt or stringify title for rename.", {id : id});
        return false;
    }
    
    breadcrumb("[RENAME] Saving encrypted title of " + id);

    var renameResponse;
    if (id.startsWith("d-")) {
        // rename doc
        renameResponse = await setDocMeta(id, { title : encryptedStringifiedTitle });
    } else if  (id.startsWith("f-")) {
        // rename folder
        renameResponse = await setFolderMeta(id, { title : encryptedStringifiedTitle });
    } else {
        renameResponse = false;
    }

    if (!renameResponse) {
        handleError("[RENAME] Failed to rename.", {id : id});
        return false;
    }

    breadcrumb("[RENAME] Updating catalog with the new title of " + id);

    var updatedCatalog;

    if (id.startsWith("d-")){
        updatedCatalog = await setDocMetaInCatalog(id, { decryptedTitle : name, title : encryptedTitle.data });
    } else if (id.startsWith("f-")) {
        updatedCatalog = await setFolderMetaInCatalog(id, { decryptedTitle : name, title : encryptedTitle.data });
    } else {
        updatedCatalog = false;
    }

    if (!updatedCatalog) {
        handleError("[RENAME] Failed to update catalog after rename.", {id : id});
        return false;
    }

    breadcrumb("[RENAME] Done. Renamed " + id);

    await refreshDOM();

    return true;
    
}




/**
 * Prepares the rename modal (i.e. sets the doc/folder id to the modal, preps the placeholder etc).
 * @param {string} [id] doc or folder id (optional, and will come from doc dropdown if not passed as a parameter)
 */
async function prepareRenameModal(id) {

    var name = "";
    var ext = "";
    var doc;

    if (id || $("#dropdown-doc").hasClass("show")) {
        id = id || $("#dropdown-doc").attr("did");
        
        if (!id) { 
            hideRightClickDropdowns();
            hidePanels(); 
            return false; 
        }

        doc = await getDocFromCatalog(id);
        name = docName(doc) || "";
        
        if (doc.isfile) {
            // it's a file, 
            // separate the extension, since we don't want people renaming .mp3 files and converting them to docs etc
            ext = extensionFromFilename(name) || "";    
            
            $("#modal-rename").attr("ext", ext);
            $("#rename-input").attr("placeholder", titleFromFilename(name));
            $("#rename-input").val(titleFromFilename(name));

        } else {
            // it's a cryptee document
            // there's no extension, so use as it is.
            
            ext = "";

            $("#modal-rename").attr("ext", "");
            $("#rename-input").attr("placeholder", name);
            $("#rename-input").val(name);
        }
        
    }

    if ($("#dropdown-folder").hasClass("show")) {
        id = $("#dropdown-folder").attr("fid");
        
        if (!id) { 
            hideRightClickDropdowns();
            hidePanels(); 
            return false; 
        }

        name = await getFolderNameFromCatalog(id);
        
        $("#modal-rename").attr("ext", "");
        $("#rename-input").attr("placeholder", name);
        $("#rename-input").val(name);
    }
    
    $("#modal-rename").attr("forid", id);
    
    showModal("modal-rename");
    breadcrumb('[RENAME] Showing rename modal for ' + id);
    
    hideRightClickDropdowns();
    hidePanels();

    return true;
}

/**
 * Called once the user confirms rename, takes the values from the modal, and calls renameDocOrFolder to rename the doc or folder on the server and in the catalog.
 */
async function confirmRename() {

    var id      = $("#modal-rename").attr("forid");
    var oldName = $("#rename-input").attr("placeholder");
    var newName = ($("#rename-input").val() || "").trim();
    var ext     = $("#modal-rename").attr("ext");

    if (!id) {
        handleError("[RENAME] Can't rename without an id");
        hideActiveModal();
        return true;
    }

    if (!newName) {
        $("#rename-input").trigger("focus");
        return true;
    }

    if (newName === oldName) {
        breadcrumb('[RENAME] Same name, cancelling.');
        hideActiveModal();
        return true;
    }

    // glue back the extension. 
    // Don't worry, if it's a cryptee document or folder, this is empty.
    if (ext) { newName = newName + "." + ext; }

    startModalProgress("modal-rename");

    var renamed = await renameDocOrFolder(id, newName);

    if (!renamed) {
        createPopup("Failed to rename. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        stopModalProgress("modal-rename");
        return false;
    }

    stopModalProgress("modal-rename");
    
    hideActiveModal();

    return true;

}




////////////////////////////////////////////////
////////////////////////////////////////////////
//	NEW FOLDER
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Creates a new folder in catalog & server, refreshes DOM, scrolls folders up to top, and displays folder.
 * @param {string} [parent] A Parent Folder ID
 * @param {string} [name] A foldername
 * @param {string} [fid] A folder id
 * @param {string} [color] An optional folder color like #4bbf73
 */
async function newFolder(parent, name, fid, color) {
    
    
    parent = parent || "";
    
    fid = fid || "f-" + newUUID();
    
    name = (name || "A New Folder").trim();

    var availableColors = ["#d9534f","#FF8C00","#ffdd57","#4bbf73","#1f9bcf","#8A2BE2"];
    color = color || availableColors[Math.floor(Math.random() * availableColors.length)];

    // encrypt title
    var encryptedTitle;
    var encryptedStringifiedTitle;

    try {
        encryptedTitle = await encrypt(JSON.stringify(name), [theKey]);
        encryptedStringifiedTitle = JSON.stringify(encryptedTitle);
    } catch (error) {
        handleError("[NEW FOLDER] Failed to encrypt title for new folder", error);
        return false;
    }

    if (!encryptedStringifiedTitle) {
        handleError("[NEW FOLDER] Failed to encrypt or stringify title.", {fid : fid});
        return false;
    }
    
    // FIRST UPDATE THE CATALOG, SO YOU CAN SHOW THE FOLDER IN DOM
    breadcrumb("[NEW FOLDER] Updating catalog with the new folder " + fid);

    newFolderInCatalog({ 
        folderid : fid,
        parent : parent,
        color : color,
        decryptedTitle : name,
        title : encryptedStringifiedTitle,
    }).then((updatedCatalog) => {
        if (!updatedCatalog) {
            createPopup("Failed to create new folder. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        } else {
            breadcrumb("[NEW FOLDER] Updated catalog with the new folder " + fid);
            refreshDOM().then(()=>{ 
                if (!parent) { scrollTop("folders"); } else { scrollTop("activeFolder"); }
            });
        }
    }).catch(function(error){
        handleError("[NEW FOLDER] Failed to set new folder meta to catalog", error); 
    });

    // SECONDLY, SAVE THE FOLDER TO SERVER.

    breadcrumb("[NEW FOLDER] Saving folder to server: " + fid);
    
    setFolderMeta(fid, { 
        folderid : fid,
        parent : parent,
        color : color,
        title : encryptedStringifiedTitle,
    }).then((newFolderResponse)=>{
        if (!newFolderResponse) {
            createPopup("Failed to create new folder. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        } else {
            breadcrumb("[NEW FOLDER] Saved new folder to server. " + fid);
        }
    }).catch(function(error){
        handleError("[NEW FOLDER] Failed to set new folder meta to server", error); 
    });

    return true;

}


/**
 * Creates a new folder using the button on the sidebar, and scrolls to folders view & to the top to show the folder. 
 */
async function confirmNewFolder() {
    
    breadcrumb('[NEW FOLDER] Creating new folder.');

    if (!activeFolderID) {
        // if we're in root, we may be in recents too, so scroll to folders
        $("#leftListWrapper").attr("show", "folders");
    }

    hideRightClickDropdowns();
    hidePanels();

    var title = $("#new-folder-input").val().trim();
    if (!title){
        $("#new-folder-input").trigger("focus");
        return;
    }

    $("#confirmNewFolderButton").addClass("loading");
    $("#newFolderButton").addClass("loading");
    $("#new-folder-input").trigger("blur");
    hidePanels();

    // create a new folder in the current folder, both on server & in catalog
    await newFolder(activeFolderID, title);

    $("#confirmNewFolderButton").removeClass("loading");
    $("#newFolderButton").removeClass("loading");
    $("#new-folder-input").val("");

    return true;

}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	COPY DOCUMENT
////////////////////////////////////////////////
////////////////////////////////////////////////
/**
 * Makes a server assisted copy of the document
 * @param {string} did Document ID
 * @param {boolean} forImport If it's a copy for an import, we'll call the copy (Original) intead of (Copy)
 * @param {string} newName optional new name for the new copy, this will be used if provided.
 */
async function copyDocument(did, forImport, newName) {
    forImport = forImport || false;
    newName = newName || "";

    var originalDoc = await getDocFromCatalog(did);

    if (!originalDoc) {
        handleError("[COPY DOC] Failed to get original doc from catalog for copy.", {did:did});
        return false;
    }

    var originalName = originalDoc.decryptedTitle;
    var copyName;
    var annotation = " (Copy)";
    if (forImport) { annotation = " (Original)"; } 

    if (!newName) {
        if (originalDoc.isfile) {
            copyName = titleFromFilename(originalName) + annotation + "." + extensionFromFilename(originalName);
        } else {
            copyName = originalName + annotation;
        }
    } else {
        if (originalDoc.isfile) {
            copyName = newName + "." + extensionFromFilename(originalName);
        } else {
            copyName = newName;
        }
    }

    breadcrumb("[COPY DOC] Encrypting title of " + did);

    // encrypt copy doc's title
    var encryptedTitle;
    var encryptedStringifiedTitle;

    try {
        encryptedTitle = await encrypt(JSON.stringify(copyName), [theKey]);
        encryptedStringifiedTitle = JSON.stringify(encryptedTitle);
    } catch (error) {
        handleError("[COPY DOC] Failed to encrypt title for copy.", error);
        return false;
    }
    
    if (!encryptedStringifiedTitle) {
        handleError("[COPY DOC] Failed to encrypt or stringify title for copy.", {did : did});
        return false;
    }

    // tell server to make a copy
    var copiedDoc = await makeDocumentCopy(did, encryptedStringifiedTitle);
    if (isEmpty(copiedDoc)) {
        handleError("[COPY DOC] Failed to copy document. Copied doc is empty", {did:did});
        return false;
    }

    // add a few other pieces of meta we already know to make it easy to refresh dom and save time
    copiedDoc.decryptedTitle = copyName;

    // set the copy into the catalog
    var savedCopyToCatalog = await newDocInCatalog(copiedDoc);
    if (!savedCopyToCatalog) {
        handleError("[COPY DOC] Failed to save copy to catalog.", { did:did, copyDID : copiedDoc.docid });
        return false;
    }

    breadcrumb("[RENAME] Done. Copied " + did + " to " + copiedDoc.docid);

    await refreshDOM();

    return true;
}


/**
 * Confirms copying selected document, using either the ID from copy document panel, from dropdown, or from the active doc's panel
 * @param {string} [did] doc id (optionally passed from active document panel, otherwise comes from doc dropdown)
 */
async function confirmCopyDoc(did) {
    newName = ($("#copy-doc-input").val() || "").trim() || "";
    did = did || $("#panel-copy-doc").attr("did") || $("#dropdown-doc").attr("did");
    
    if (!did) { 
        hideRightClickDropdowns();
        hidePanels();
        return false; 
    }

    $("#copyDocButton, #copyActiveDocButton, #confirmCopyDocButton, #copy-doc-recos").addClass("loading");
    $("#copy-doc-recos").find(".docreco").removeClass("selected");
    $("#copy-doc-input").attr("disabled", true); 
    $("#copy-doc-input").trigger("blur"); 

    var copied = await copyDocument(did, false, newName);

    $("#copyDocButton, #copyActiveDocButton, #confirmCopyDocButton, #copy-doc-recos").removeClass("loading");
    $("#copy-doc-input").removeAttr("disabled");

    hideRightClickDropdowns();
    hidePanels();

    if (!copied) {
        createPopup("Failed to copy document. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        return false;
    }

    // if it's the active document
    if (did === activeDocID) {
        var fidOfActiveDoc = $("#activeDocFolderButton").attr("fid");

        if (activeFolderID === fidOfActiveDoc) { 
            // if the doc's folder is open, simply show the folder
            openSidebarMenu();
        } else {
            // if the doc's folder isn't open, show it in recents
            $("#recentsButton").trigger("click");
        }
    }

    return true;
}

/**
 * Shows copy doc panel, for a document with ID coming either from active doc panel or inferred from the doc right click dropdown
 * @param {string} [did] doc id (optionally passed from active document panel, otherwise comes from doc dropdown)
 */
async function showCopyDocPanel(did) {
    did = did || $("#dropdown-doc").attr("did") || "";
    
    hideRightClickDropdowns();
    hidePanels('panel-copy-doc');

    var doc = await getDocFromCatalog(did);
    var name = docName(doc) || "";

    if (!doc) {
        handleError("[COPY DOC] Failed to get original doc from catalog for copy.", {did:did});
        return false;
    }

    var placeholderName;
    var annotation = " (Copy)";

    if (doc.isfile) {
        placeholderName = titleFromFilename(name) + annotation;
    } else {
        placeholderName = name + annotation;
    }

    var targetFID = activeFolderID || "f-uncat";
    var targetFolderName = await getFolderNameFromCatalog(targetFID);
    $("#copy-doc-target-folder").text(targetFolderName);

    $("#panel-copy-doc").attr("did", did);
    $("#copy-doc-input").val(placeholderName);
    $("#copy-doc-recos").html(docNameTimeRecommendations());
    
    togglePanel('panel-copy-doc');
    $("#copy-doc-input").trigger("focus");
    $("#copy-doc-input")[0].select();
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	DOCUMENT NAME / FOLDER NAME SHORTCUTS
////////////////////////////////////////////////
////////////////////////////////////////////////
/**
 * A helper to get a document's name
 * @param {Object} doc A Document Object
 */
function docName(doc) {
    var name; 
    
    if (!doc || isEmpty(doc)) { return "Untitled Document"; }

    if (doc.untitled) {
        name = "Untitled Document";
    } else {
        name = doc.decryptedTitle || "";
    }

    if (doc.docid === "d-home") { name = "Home Document"; } // backwards compatibility with v1 & v2
    
    return name;
}

/**
 * A helper to get a folder's name
 * @param {Object} folder A Folder Object
 */
function folderName(folder) {
    var name;
    
    // this could happen if it's home doc
    if (isEmpty(folder)) { return "Untitled Folder"; }
    
    if (folder.folderid === "f-uncat") { 
        name = "Inbox";
    } else {
        name = folder.decryptedTitle || "Untitled Folder";
    }

    return name;
}



/**
 * Gets all docs without titles from catalog. To be used in search
 * @param {Object} allDocs
 * @returns {Object} docsWithoutTitles 
 */
async function getDocsWithoutTitles(allDocs) {

    breadcrumb('[SEARCH] Getting all docs without titles');
    
    var docsWithoutTitles = {};

    for (var did in allDocs) {
        var doc = allDocs[did];
        if (!doc.title && !doc.decryptedTitle && did !== "d-home") {
            docsWithoutTitles[did] = doc;
        }    
    }

    breadcrumb('[SEARCH] Got ' + Object.keys(docsWithoutTitles).length + ' docs without titles');

    return docsWithoutTitles;

}


var decryptedEntireCatalog = false;
var decryptingEntireCatalog = false;
/**
 * Gets all titles & tags from server, writes to catalog and decrypts the catalog, to be used in search
 *
 * WARNING – extremely CPU-heavy!! Use carefully
 * @param {Object} [allDocs] docs mapped by id (optional, or we'll get from catalog)
 */
async function downloadAndDecryptTheEntireCatalog(allDocs) {
    
    // don't do it twice during the same session. it's useless
    // failsafe circuitbreaker
    if (decryptingEntireCatalog) { 
        breadcrumb('[DECRYPT CATALOG] Still decrypting ...');
        return false; 
    }

    decryptingEntireCatalog = true;
    breadcrumb('[DECRYPT CATALOG] Checking for missing titles & tags in the catalog');

    // just in case
    if (isEmpty(allDocs)) {
        allDocs = await getAllDocsFromCatalog();
    }

    // check if there are any docs without titles / tags in the first place
    var docsWithoutTitles = await getDocsWithoutTitles(allDocs);
    if (isEmpty(docsWithoutTitles)) {

        // All good, entire catalog is already decrypted
        decryptingEntireCatalog = false;
        decryptedEntireCatalog = true;
        
        return true;
    }

    breadcrumb('[DECRYPT CATALOG] Found ' + Object.keys(docsWithoutTitles).length + ' missing titles / tags. Downloading titles & tags to complete the catalog');
    
    await getTitlesAndTags();

    await decryptCatalog(); // this calls refresh dom too
    
    breadcrumb('[DECRYPT CATALOG] Decrypted the entire catalog.');

    decryptingEntireCatalog = false;
    decryptedEntireCatalog = true;

    return true;
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	GHOSTERS
////////////////////////////////////////////////
////////////////////////////////////////////////



////////////////////////////////////////////////
////////////////////////////////////////////////
//	LOADERS
////////////////////////////////////////////////
////////////////////////////////////////////////

function loadSearch() {
    breadcrumb('[LOAD SEARCH] Loading search');
    activeFolderID = "";
    $("#activeFolder").empty();
    $("#leftListWrapper").attr("show", "results");
    hideRightClickDropdowns();
    hidePanels();
    refreshDOM();
}

function loadRecents() {
    breadcrumb('[LOAD RECENTS] Loading recents');
    activeFolderID = "";
    $("#activeFolder").empty();
    $("#leftListWrapper").attr("show", "recents");
    hideRightClickDropdowns();
    hidePanels();
    refreshDOM();
}

/**
 * Loads the root folder, changes activeFolderID, scrolls to folders view, empties activeFolder and its contents from dom, refreshes dom
 */
function loadRootFolder() {
    breadcrumb('[LOAD FOLDER] Loading Root');
    activeFolderID = "";
    $("#activeFolder").empty();
    $("#leftListWrapper").attr("show", "folders");
    hideRightClickDropdowns();
    hidePanels();
    refreshDOM();
}

/**
 * Loads the parent folder of the currently active folder using loadFolder.
 */
async function loadParentFolder() {
    var parentID = await parentOfFolder(activeFolderID);
    if (parentID) {
        loadFolder(parentID);
    } else {
        loadRootFolder();
    }
}

/**
 * Loads the folder with given ID into DOM, gets a fresh list of docs from server, adds to DOM, decrypts doc titles, refreshes DOM again. This function also downloads the folders' docs' meta into catalog.
 * @param {string} fid FolderID
 */
async function loadFolder(fid) {
    
    if (!fid) {
        handleError("[LOAD FOLDER] Can't load folder without an ID");
        loadRootFolder();
        return false;
    }
    
    // check if folder exists in catalog
    // i.e. if you have a doc in a ghosted folder, attached to another doc that's not in a ghost. 
    // if you first load the un-ghosted doc, then click on the doc in the ghosted folder,
    // you can now use the active doc panel to try to load the parent of the doc, which is ghosted.
    // this would mean the folder is missing in catalog, and you'll get an error. 
    // so before loading anything, we have to check the catalog first. 

    var folder = await getFolderFromCatalog(fid);
    if (!folder) {
        handleError("[LOAD FOLDER] Requested folder doesn't exist.", {fid:fid});
        createPopup("Cryptee can't seem to find the folder you're looking for. It may be deleted, ghosted or you may be having connectivity issues. If you haven't ghosted or deleted it, this is likely a connectivity issue, or your browser is blocking access to indexedDB. Disable your ad-blockers, check your connection, try again and please reach out to our support via our helpdesk if this issue continues.", "error");
        return false;
    }

    breadcrumb('[LOAD FOLDER] Loading ' + fid);
    
    startLeftProgress();
    
    // set active folder
    activeFolderID = fid;

    // clear old contents
    $("#activeFolder").empty();

    // show folder with what's already in catalog
    $("#leftListWrapper").attr("show", "folder");

    // load everything from catalog into DOM
    await refreshDOM();
    
    // now start loading a fresh set of contents of the folder from server 
    // set contents to catalog
    // decrypt catalog
    // refresh dom again

    await getFolder(activeFolderID);
    await decryptCatalog(); // this calls refresh dom

    stopLeftProgress();

    return true;

}



/**
 * Gets root parent (oldest parent / top folder) of folder using the given folders object
 * @param {string} fid FolderID
 * @param {Object} folders Folders Object, mapped by fid 
 * @returns {Promise<string>} root parent (oldest parent / top folder) FID
 */
function rootParentIDOfFolder(fid, folders) {
    if (!fid) { return ""; }

    var folder = folders[fid] || {};    

    if (!folder) { return ""; }

    var parentFID = folder.parent || "";

    if (parentFID) {
        // if there's a parent, call this function again, and get its parent
        return rootParentIDOfFolder(parentFID, folders);
    } else {
        // if there isn't a parent, currrent FID is the topmost one, return it.
        return fid;
    }

}

////////////////////////////////////////////////
////////////////////////////////////////////////
//	SELECTIONS
////////////////////////////////////////////////
////////////////////////////////////////////////



/**
 * Selects / Unselects a document
 * @param {string} did 
 */
function toggleDocSelection(did) {
    if (!did) { return; }
    if (did.startsWith("f-")) { return; }
    
    var selectionIndex = selections.indexOf(did);
    if (selectionIndex >= 0) {
        
        // selected
        selections.splice(selectionIndex, 1);
        $(`.doc[did="${did}"]`).removeClass("selected");
        
        breadcrumb('[SELECT] Unselected ' + did);

    } else {
        
        // not selected
        selections.push(did);
        $(`.doc[did="${did}"]`).addClass("selected");
        
        breadcrumb('[SELECT] Selected ' + did);

    }

    $("#no-selections").html(selections.length);

    if (selections.length >= 1) {
        showFloater("selectionsFloat");
    } else {
        hideFloater("selectionsFloat");
    }
}


/**
 * Shift Selects / De-Selects a document
 * @param {*} where parent element of a doc (i.e. recents / activefolder etc)
 * @param {string} did document id
 */
function shiftToggledDocSelection(where, did) {
    var indexOfLastSelectedDocBeforeClickedOne = 0;
    var idOfLastSelectedDocBeforeClickedOne;
    var clickedDoc = where.find(`.doc[did=${did}]`);
    var clickedDocIndex = parseInt(clickedDoc.attr("order"));
    var clickedDocSelected = clickedDoc.hasClass("selected");

    where.find(".doc").forEach(function(doc){
        var selected = $(doc).hasClass("selected");
        var docIndex = parseInt($(doc).attr("order"));
        var did = $(doc).attr("did");

        if (docIndex < clickedDocIndex) {
            if (!clickedDocSelected && selected) {
                indexOfLastSelectedDocBeforeClickedOne = docIndex || 0;
                idOfLastSelectedDocBeforeClickedOne = did;
            }
            
            if (clickedDocSelected && !selected) {
                indexOfLastSelectedDocBeforeClickedOne = docIndex || 0;
                idOfLastSelectedDocBeforeClickedOne = did;
            }
        }
    
    });

    where.children().forEach(docToSelect => {
        var docIndex = parseInt($(docToSelect).attr("order"));
        var docIDToSelect = $(docToSelect).attr("did");
        if (docIndex > indexOfLastSelectedDocBeforeClickedOne && docIndex < clickedDocIndex) {
            toggleDocSelection(docIDToSelect);
        }
    });

    // select/unselect the one before the clicked on
    // toggleDocSelection(idOfLastSelectedDocBeforeClickedOne);

    // selected the one we clicked on
    toggleDocSelection(did); 
}

/**
 * Clears selections, and hides selection popup
 */
function clearSelections() {
    selections = [];
    $(".doc.selected").removeClass("selected");
    hideRightClickDropdowns();
    hidePanels();
    hideFloater("selectionsFloat");
}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	EDIT LOCKS
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Toggles a document's edit lock on server and catalog by setting the meta
 * @param {string} did document id
 * @param {boolean} lock locked or not
 */
async function toggleDocumentEditLock(did, lock) {
    
    lock = lock || false;
    
    var catalogResponse;
    try {
        catalogResponse = await setDocMetaInCatalog(did, {islocked:lock});
    } catch (error) {
        handleError("[LOCK] Failed to set edit lock on document in catalog", {did : did});
    }

    var serverResponse;
    try {
        serverResponse = await setDocMeta(did, {islocked:lock});
    } catch (error) {
        handleError("[LOCK] Failed to set edit lock on document", {did : did});
    }

    if (!serverResponse || !catalogResponse) {
        createPopup(`Failed to lock edits for this document. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        return false;
    }

    await refreshDOM();

    return true;
}


function lockEditor() {
    if (!mobilePaperMode) {
        quill.disable();
    }
    $("body").addClass("locked-doc");
    $("#lockEditsButton").addClass("on");
}

function unlockEditor() {
    if (!mobilePaperMode) {
        quill.enable();
    }
    $("body").removeClass("locked-doc");
    $("#lockEditsButton").removeClass("on");
}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	PAPER MODE META
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Saves document's paper size & orientation to catalog and server. 
 * This is not a super duper critical thing, since user can always re-enable it while viewing the doc. 
 * It's more of a convenience thing. Since enabling paper mode adds a bunch of preview-classes, it changes the document's generation,
 * thus updates the document, and forces all other devices to sync these pieces of meta even for offline docs 
 * @param {String} did Document ID
 * @param {('a4'|'a3'|'usletter'|'uslegal')} paperStock The paper stock size (i.e. A4, A3, US Letter or US Legal) 
 * @param {('portrait'|'landscape')} orientation The paper orientation (portrait or landscape)
 * @returns 
 */
async function saveDocumentPaperSizeAndOrientation(did, paperStock, orientation) {
    breadcrumb('[PAPER] Saving Document Paper Size & Orientation in Catalog & DB');
    
    try {
        await setDocMetaInCatalog(did, { paper : paperStock, orientation : orientation });
        await setDocMeta(did, { paper : paperStock, orientation : orientation });    
    } catch (error) {
        handleError("[PAPER] Failed to save Paper Size & Orientation", error);    
    }

    breadcrumb('[PAPER] Saved Document Paper Size & Orientation in Catalog & DB');


    return true;
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	DROPDOWNS
////////////////////////////////////////////////
////////////////////////////////////////////////


/**
 * Shows right click dropdown for document with given ID
 * @param {string} did Document ID
 * @param {number} y mouseY
 * @param {number} [x] mouseX (optional, otherwise dropdown will appear on the left-side)
 */
function showDocRightClickDropdown(did, y, x) {
    var alreadyShown = $("#dropdown-doc").hasClass("show");
    
    hideRightClickDropdowns();
    hideFloaters();
    hidePanels();

    // if already shown, we just need to hide it anyway.
    if (alreadyShown) { return; }

    // customizations

    
    // get doc name, and display in dropdown
    var docInDom = $(`.doc[did="${did}"]`).first();
    var name = (docInDom.find(".name").text() || "").trim();
    $("#dropdown-doc").attr("name", name);

    // get doc id, display in dropdown for debugging in non-live environments
    var docIDToShow = (did || "").replace("d-", "");
    $("#dropdown-doc").find(".docid").text(docIDToShow);

    // get extension to show image-only options 
    var ext = docInDom.attr("ext");
    var forImages = ["jpg", "jpeg", "png", "gif"].includes(ext);
    $("#dropdown-doc").toggleClass("for-images", forImages);

    // check if it's a file to hide docs-only options
    var isfile = docInDom.hasClass("isfile");
    $("#dropdown-doc").toggleClass("for-files", isfile);

    // check if it's home doc or other reserved doc, which you can't rename.
    var forReserved = (did === "d-home");
    $("#dropdown-doc").toggleClass("for-reserved", forReserved);

    // if doc is offline
    var offline = docInDom.hasClass("offline");
    var forOfflineItems = !isfile && offline;
    $("#dropdown-doc").toggleClass("for-offline-items", forOfflineItems);

    // if doc is loading / downloading
    var isLoading = docInDom.hasClass("loading");
    $("#downloadFileButton").toggleClass("loading", isLoading);

    // if doc is active
    var forActiveDoc = did === activeDocID;
    $("#dropdown-doc").toggleClass("for-active-doc", forActiveDoc);
    
    // doc is recent / search result, add open parent folder button
    if ($("#leftListWrapper").attr("show") === "recents" || $("#leftListWrapper").attr("show") === "results") {    
        var parentFID = docInDom.find(".fldr").attr("fid") || "";
        if (parentFID) {
            $("#dropdown-doc").attr("parent", parentFID);
        } else { 
            $("#dropdown-doc").attr("parent", "");
        }
    }

    var forSavingOrChangedDocs = docState(did).saving || docState(did).changed;
    $("#dropdown-doc").toggleClass("saving", forSavingOrChangedDocs);    

    x = x || 0;
    y = y || 0;

    var wh = $(window).height();
    var ww = $(window).width();

    var dh = $("#dropdown-doc").height();
    var dw = $("#dropdown-doc").width();
    
    if (wh - y < dh) { y = wh - dh - 32; }
    
    if (x) {
        if (ww - x < dw) { x = ww - dw - 32; }
    }

    $("#dropdown-doc").attr("did", did);
    $("#dropdown-doc").addClass("show");
    $("#dropdown-doc").css({"top" : `${(y+16)}px`});
    
    if (x) {
        $("#dropdown-doc").css({"left" : `${(x+16)}px`});
    } else {
        // from docs.css (.dropdown) if you change this, update it in CSS

        if (ww < 544) {
            $("#dropdown-doc").css({"left" : `5rem`});
        } else {
            $("#dropdown-doc").css({"left" : `16.75rem`});
        }
    }

    breadcrumb('[RIGHT CLICK] Showing dropdown for ' + did);
}





/**
 * Shows right click dropdown for folder with given ID
 * @param {string} fid FolderID
 * @param {number} y mouseY
 * @param {number} [x] mouseX (optional, otherwise dropdown will appear on the left-side)
 */
function showFolderRightClickDropdown(fid,y, x) {
    var alreadyShown = $("#dropdown-folder").hasClass("show");

    hideRightClickDropdowns();
    hideFloaters();
    hidePanels();
    
    // if already shown, we just need to hide it anyway.
    if (alreadyShown) { return; }
    
    // get folder id, display in dropdown for debugging in non-live environments
    var folderIDToShow = (fid || "").replace("f-", "").replace("uncat", "inbox");
    $("#dropdown-folder").find(".folderid").text(folderIDToShow);

    // customizations

    // if folder is archived
    var archived = $(`.folder[fid="${fid}"]`).hasClass("archived") || $(`.subfolder[fid="${fid}"]`).hasClass("archived");
    $("#dropdown-folder").toggleClass("for-archived-items", archived);

    // if folder is offline
    var offline = $(`.folder[fid="${fid}"]`).hasClass("offline") || $(`.subfolder[fid="${fid}"]`).hasClass("offline");
    $("#dropdown-folder").toggleClass("for-offline-items", offline);

    // get folder name, and display in dropdown
    var name = ($(`.folder[fid="${fid}"]`).find(".name").text() || "").trim() || ($(`.subfolder[fid="${fid}"]`).find(".name").text() || "").trim();
    $("#dropdown-folder").attr("name", name);



    // check if it's inbox folder or other reserved folder, which you can't rename.
    var forReserved = (fid === "f-uncat");
    $("#dropdown-folder").toggleClass("for-reserved", forReserved);


    // check if it's cllicked from the active folder (fid will be equal to activeFolderID) and add from-active-folder
    var forActiveFolder = (fid === activeFolderID);
    $("#dropdown-folder").toggleClass("for-active-folder", forActiveFolder);

    x = x || 0;
    y = y || 0;

    var wh = $(window).height();
    var dh = $("#dropdown-folder").height();
    if (wh - y < dh) { y = wh - dh - 32; }

    // there's one more button there so lets make sure this works even on smaller screens
    if (forReserved) { y = y - 48; }

    $("#dropdown-folder").attr("fid", fid);
    $("#dropdown-folder").addClass("show");
    $("#dropdown-folder").css({"top" : `${(y+16)}px`});

    breadcrumb('[RIGHT CLICK] Showing dropdown for ' + fid);
}






/**
 * Shows right click dropdown for selected documents / files
 * @param {number} x mouseX
 * @param {number} y mouseY
 */
function showSelectionsRightClickDropdown(x,y) {
    var alreadyShown = $("#dropdown-selections").hasClass("show");

    hideRightClickDropdowns();
    hidePanels();

    // if already shown, we just need to hide it anyway.
    if (alreadyShown) { return; }

    if (selections.length < 1) { return; }
    if ((isios || isipados) && selections.length > 1) { 
        $("#dropdown-selections").addClass("ios-multi-download");
    } else {
        $("#dropdown-selections").removeClass("ios-multi-download");
    }









    x = x || 0;
    y = y || 0;

    var wh = $(window).height();
    var dh = $("#dropdown-selections").height();
    if (wh - y < dh) { y = wh - dh - 32; }

    $("#dropdown-selections").attr("items", selections);
    $("#dropdown-selections").attr("name", selections.length + " selected item(s)");
    $("#dropdown-selections").addClass("show");
    $("#dropdown-selections").css({"top" : `${(y+16)}px`});

    breadcrumb('[RIGHT CLICK] Showing dropdown for selections: ' + selections.toString());

}


/**
 * hides all right click dropdowns
 */
function hideRightClickDropdowns() {
    $(".dropdown").removeAttr("did");
    $(".dropdown").removeAttr("fid");
    $(".dropdown").removeAttr("parent");
    $(".dropdown").removeClass("show");
}



/////////////////////////////////////////////////
/////////////////////////////////////////////////
//	COLOR FOLDER / CHANGE FOLDER COLOR / COLORIZE
/////////////////////////////////////////////////
/////////////////////////////////////////////////

/**
 * Colorizes the folder selected in the right click dropdown, with the given color. Sets folder color on server & in the catalog. Called in the folders dropdown.    
 * @param {string} color 
 */
async function colorizeSelectedFolder(color) {
    var fid = $("#dropdown-folder").attr("fid");
    
    if (!fid) { 
        hideRightClickDropdowns();
        hidePanels();
        return false; 
    }

    if (!color) {
        handleError("[COLORIZE FOLDER] Can't folor a folder without color.");
        return false;
    }

    breadcrumb("[COLORIZE] Setting folder color on server: " + fid + " " + color);
    $(`i[color='${color}']`).css({"animation": "0.5s blinkOpacity ease infinite;"});
    
    var colorized;
    try {
        colorized = await setFolderMeta(fid, { color : color });
    } catch (error) {
        error.fid = fid;
        handleError("[COLORIZE] Failed to set folder color", error);
    }

    if (!colorized) {
        createPopup("Failed to set folder color. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        return false;
    }

    breadcrumb("[COLORIZE] Setting folder color on catalog: " + fid + " " + color);

    // update catalog with new color
    var updatedCatalogWithNewColor = await setFolderMetaInCatalog(fid, { color : color });
    
    if (!updatedCatalogWithNewColor) {
        createPopup("Failed to set folder color. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        return false;
    }

    breadcrumb("[COLORIZE] Done.");
    $(`i[color='${color}']`).css({"animation": ""});

    await refreshDOM();

    return true;
}






////////////////////////////////////////////////
////////////////////////////////////////////////
//	MOVE
////////////////////////////////////////////////
////////////////////////////////////////////////


/**
 * Prepares the move floater, sets necessary values like folder / docs' ids to floater
 * @param {('rightclick'|'selections'|'activeDoc')} whatToMove what we'll be moving, right click'ed doc/file or folder or multiple selections, or active doc 
 */
async function prepareMoveFloater(whatToMove) {
    if (!whatToMove) {
        handleError("[MOVE] Can't prepare move floater without knowing what to move");
        return true;
    }

    var arrayOfItemsToMove = [];
    
    if (whatToMove === "rightclick") {
        var rightClickedItemToMove = $("#dropdown-doc").attr("did") || $("#dropdown-folder").attr("fid");
        arrayOfItemsToMove.push(rightClickedItemToMove);
    } 
    
    if (whatToMove === "selections") {
        selections.forEach(did => { arrayOfItemsToMove.push(did); });
    }

    if (whatToMove === "activeDoc") {
        arrayOfItemsToMove.push(activeDocID); 
    }

    if (arrayOfItemsToMove.length > 0) {
        if ($("#leftListWrapper").attr("show") !== "folders" && $("#leftListWrapper").attr("show") !== "folder") {
            $("#leftListWrapper").attr("show", "folders");
        }

        $("#moveFloat").attr("items", arrayOfItemsToMove);
        $("#moveFloat").attr("what", whatToMove);
        breadcrumb('[MOVE] Showing move float for ' + arrayOfItemsToMove);
        
        showFloater("moveFloat");

        hideRightClickDropdowns();
        hidePanels();
    }

}

/**
 * Starts move operation, triggered by clicking on the move floater in the left sidebar
 */
async function confirmMove() {
    var arrayOfItemsToMove = ($("#moveFloat").attr("items") || "").split(",") || [];
    var whatToMove         = $("#moveFloat").attr("what");
    var targetFID          = activeFolderID;
    var isMovingAFolder    = (arrayOfItemsToMove.length === 1 && arrayOfItemsToMove[0].startsWith("f-"));

    // if we're moving a doc & there's no target folder
    // or
    // if we're moving a document, but we clicked move while we're not in an active folder
    if ((!isMovingAFolder && !targetFID) || (!isMovingAFolder && $("#leftListWrapper").attr("show") !== "folder")) {
        createPopup("<b>You are not in a folder.</b><br>To move files, first right click on them (or press <i class='ri-more-2-fill'></i>) and press <b>'move to'</b>. Then, open the target folder you'd like to move things into. Finally, once you're in the target folder press the green <b>move here</b> button in the bottom.", "info");
        return false;
    }

    // if we're moving a folder, but we're not in root folders, or inside an active folder, 
    if (isMovingAFolder && !$("#leftListWrapper").attr("show").startsWith("folder")) {
        createPopup("<b>You are not in a folder.</b><br>To move a folder, first right click on it (or press <i class='ri-more-2-fill'></i>) and press <b>'move to'</b>. Then, open the target folder you'd like to move it into. Finally, once you're in the target folder press the green <b>move here</b> button in the bottom.", "info");
        return false;
    } 

    if (arrayOfItemsToMove.length <= 0) {
        hideFloater("moveFloat");
        return false;
    }

    if (isMovingAFolder) {
        // CHECK IF USER'S TRYING TO MOVE FOLDER TO SAME PARENT FOLDER. (SO NOT REALLY MOVING ANYTHING) 
        var originalParent = await parentOfFolder(arrayOfItemsToMove[0]);
        if (originalParent === targetFID) {
            createPopup("The folder you'd like to move is already in the folder you've selected.<br><br> To move files or folders, first right click on them (or press <i class='ri-more-2-fill'></i>) and press <b>'move to'</b>. Then, open the target folder you'd like to move things into. Finally, once you're in the target folder press the green <b>move here</b> button in the bottom.","info");
            hideFloater("moveFloat");
            return false;
        }

        // CHECK IF USER'S TRYING TO MOVE FOLDER ONTO ITSELF.
        if (arrayOfItemsToMove[0] === targetFID) {
            createPopup("The folder you'd like to move is the same as the destination folder you've selected. You can't move a folder into itself. <br><br> To move files or folders, first right click on them (or press <i class='ri-more-2-fill'></i>) and press <b>'move to'</b>. Then, open the target folder you'd like to move things into. Finally, once you're in the target folder press the green <b>move here</b> button in the bottom.","info");
            hideFloater("moveFloat");
            return false;
        }
    } else {
        // CHECK IF USER'S TRYING TO MOVE DOCS TO THE SAME FOLDER.
        var tryingToMoveDocstoSameFolder = false;
        for (var did of arrayOfItemsToMove) {
            var doc = await getDocFromCatalog(did);
            if (doc.fid === targetFID) { 
                tryingToMoveDocstoSameFolder = true;
                break; 
            }
        }
        if (tryingToMoveDocstoSameFolder) {
            createPopup("Can't move the file(s) you've selected, because some of these file(s) are already in the same folder.<br><br> To move files or folders, first right click on them (or press <i class='ri-more-2-fill'></i>) and press <b>'move to'</b>. Then, open the target folder you'd like to move things into. Finally, once you're in the target folder press the green <b>move here</b> button in the bottom.","info");
            hideFloater("moveFloat");
            return false;
        }
    }

    startMoveProgress();

    var movedOnServer = false;
    
    if (isMovingAFolder) {
        // move folder
        movedOnServer = await moveFolder(arrayOfItemsToMove[0], targetFID);
    } else {
        // move docs
        movedOnServer = await moveDocs(arrayOfItemsToMove, targetFID);
    }
    
    if (!movedOnServer) {
        createPopup("Failed to move items. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        stopMoveProgress();
        return false;
    }

    var movedInCatalog = false;

    if (isMovingAFolder) {
        // move folder
        movedInCatalog = await moveFolderInCatalog(arrayOfItemsToMove[0], targetFID);
    } else {
        // move docs
        movedInCatalog = await moveDocsInCatalog(arrayOfItemsToMove, targetFID);
    }

    if (!movedInCatalog) {
        createPopup("Failed to move items. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        stopMoveProgress();
        return false;
    } 

    if (whatToMove === "selections") {
        clearSelections();
    }

    hideFloater("moveFloat");

    setTimeout(function () {
        stopMoveProgress();
    }, 500);

    return true;
}










////////////////////////////////////////////////
////////////////////////////////////////////////
//	DELETE FOLDER
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Prepares the delete folder modal, sets necessary values like folder's id & name to modal
 */
async function prepareDeleteFolderModal() {
    
    var fid = $("#dropdown-folder").attr("fid");

    if (!fid) { 
        hideRightClickDropdowns(); 
        hidePanels();
        return false; 
    }

    var fname = await getFolderNameFromCatalog(fid);
    $("#deleting-foldername").text(fname);
    $("#modal-delete-folder").attr("fid", fid);

    breadcrumb('[DELETE] Showing delete modal for ' + fid);
    showModal("modal-delete-folder");

    hideRightClickDropdowns();
    hidePanels();

    return true;

}

/**
 * Called once user confirms the deletion of a folder, takes values like FID from the modal itself. 
 */
async function confirmDeleteFolder() {
    var fid = $("#modal-delete-folder").attr("fid");

    if (!fid) {
        handleError("[DELETE FOLDER] Can't delete folder without an id");
        hideActiveModal();
        return true;
    }

    startModalProgress("modal-delete-folder");

    var deletedFromServer = await deleteFolder(fid);
    if (!deletedFromServer) {
        createPopup("Failed to delete folder. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        stopModalProgress("modal-delete-folder");
        return false;
    }

    var deletedFromCatalog = await deleteFolderAndItsContentsFromCatalog(fid);
    if (!deletedFromCatalog) {
        createPopup("Failed to delete folder. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        stopModalProgress("modal-delete-folder");
        return false;
    }

    stopModalProgress("modal-delete-folder");

    hideActiveModal();

    return true;

}






////////////////////////////////////////////////
////////////////////////////////////////////////
//	DELETE DOC(S)
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Prepares the delete docs modal, sets necessary values like docs' ids & names to modal
 * @param {('rightclick'|'selections'|'activeDoc')} whatToDelete what we'll be deleting, right click or selections 
 */
async function prepareDeleteDocsModal(whatToDelete) {

    if (!whatToDelete) {
        handleError("[DELETE DOCS] Can't prepare delete docs modal without knowing what to delete");
        return true;
    }

    var arrayOfDIDsToDelete = [];

    if (whatToDelete === "rightclick") {
        var rightClickedDIDtoDelete = $("#dropdown-doc").attr("did");
        arrayOfDIDsToDelete.push(rightClickedDIDtoDelete);
    } 
    
    if (whatToDelete === "selections") {
        selections.forEach(did => { arrayOfDIDsToDelete.push(did); });
    }

    if (whatToDelete === "activeDoc") {
        arrayOfDIDsToDelete.push(activeDocID);
    }

    $("#deleting-filenames").empty();
    
    for (var did of arrayOfDIDsToDelete) {
        var name = await getDocNameFromCatalog(did);

        name = name || "";
        name = escapeHTML(name);

        var active = "";
        if (did === activeDocID || did === activeFileID) { active = "<span class='deleting-active-doc-tag'>currently open</span>"; }

        $("#deleting-filenames").append(`<p>${name} ${active}</p>`);
    }
    
    if (arrayOfDIDsToDelete.length > 0) {
        $("#modal-delete-selections").attr("dids", arrayOfDIDsToDelete);
        $("#modal-delete-selections").attr("what", whatToDelete);
        
        showModal("modal-delete-selections");

        breadcrumb('[DELETE] Showing delete modal for ' + arrayOfDIDsToDelete);
    }

    hideRightClickDropdowns();
    hidePanels();

    return true;

}


/**
 * Called once user confirms the deletion of selected docs, takes values like did from the modal itself. 
 */
async function confirmDeletingSelectedDocs() {
    var arrayOfDIDsToDelete = ($("#modal-delete-selections").attr("dids") || "").split(",") || [];
    var whatToDelete = $("#modal-delete-selections").attr("what");

    if (arrayOfDIDsToDelete.length === 0) {
        handleError("[DELETE DOCS] Can't delete docs, no ids found");
        hideActiveModal();
        return true;
    }

    startModalProgress("modal-delete-selections");

    if (arrayOfDIDsToDelete.includes(activeDocID) || whatToDelete === "activeDoc") {
        startRightProgress("deleting...");
    }

    // first delete docs from server
    var deletedFromServer = await deleteDocs(arrayOfDIDsToDelete);
    if (!deletedFromServer) {
        createPopup("Failed to delete docs/files. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        stopModalProgress("modal-delete-selections");
        return false;
    }

    var deletedFromCatalog = await deleteDocsFromCatalog(arrayOfDIDsToDelete);
    if (!deletedFromCatalog) {
        createPopup("Failed to delete docs/files. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        stopModalProgress("modal-delete-selections");
        return false;
    }

    if (whatToDelete === "selections") {
        clearSelections();
    }

    stopModalProgress("modal-delete-selections");

    hideActiveModal();

    return true;

}






////////////////////////////////////////////////
////////////////////////////////////////////////
//	ARCHIVE FOLDER
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Archives / Unarchives a selected folder in dropdown
 */
async function archiveUnarchiveSelectedFolder() {

    var fid = $("#dropdown-folder").attr("fid");
    
    if (!fid) { 
        hideRightClickDropdowns();
        hidePanels();
        return false; 
    }

    $("#archiveFolderButton").addClass("loading");

    var archived = $(`.folder[fid="${fid}"]`).hasClass("archived") || $(`.subfolder[fid="${fid}"]`).hasClass("archived");

    var updatedCatalog, updatedServer;
    
    if (!archived) {
        // archive it   
        updatedCatalog = await setFolderMetaInCatalog(fid, { parent : "", archived : true });   
        updatedServer = await setFolderMeta(fid, { parent : "", archived : true });
    } else {
        // unarchive it
        updatedCatalog = await setFolderMetaInCatalog(fid, { parent : "", archived : false });
        updatedServer = await setFolderMeta(fid, { parent : "", archived : false });
    }
    
    await refreshDOM();
    
    $("#archiveFolderButton").removeClass("loading");
    hideRightClickDropdowns();
    hidePanels();
    
    // now that we've archived/unarchived a folder, if there's nothing left, disable show archived mode
    var numberOfArchivedFolders = $("#folders").children(".archived").length;
    if (numberOfArchivedFolders <= 0) {
        $("#leftListWrapper").removeClass("show-archived");
    }
    
    if (!updatedCatalog || !updatedServer) {
        createPopup("Failed to archive folder. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        return false;
    }
    
    // remove subfolder from dom entirely.
    // once the folder is moved during archival, refreshDOM won't be able to find it. 
    // meaning that it won't be removed from the activeFolder by refreshDOM.
    $(`.subfolder[fid="${fid}"]`).remove();
    
    return true;

}



/**
 * Toggles visibility of archived folders
 */
function toggleArchivedFolders() {
    var numberOfArchivedFolders = $("#folders").children(".archived").length;
    if (numberOfArchivedFolders > 0) {
        $("#leftListWrapper").toggleClass("show-archived");
    } else {
        $("#leftListWrapper").removeClass("show-archived");
        createPopup("Looks like you don't have any archived folders. This button allows you to show/hide all your archived folders. To archive a folder, right click or press <i class='ri-more-2-fill'></i> on the folder, then press 'archive'.", "info");
    }
}







////////////////////////////////////////////////
////////////////////////////////////////////////
//	SORT FOLDER
////////////////////////////////////////////////
////////////////////////////////////////////////




/**
 * Sorts a folder given two arrays, an array of docs and folders;
 * @param {Array} docs An array of docs in the folder
 * @param {Array} subfolders an array of folders in the folder
 * @param {Object} activeFolder an the active folder to save time reading from catalog
 * @param {("azasc"|"azdesc"|"extasc"|"extdesc"|"genasc"|"gendesc")} [sorttype] An optional sorttype
 */
function sortFolder(docs, subfolders, activeFolder, sorttype) {
    if (!activeFolderID) { 
        handleError("[SORT] We're not in activeFolder. Cancelling.", {}, "warning");
        return false; 
    }

    if (!activeFolder || isEmpty(activeFolder)) {
        handleError("[SORT] Folder doesn't exist in catalog. Cancelling.");
        return false; 
    }

    // delete all existing separators from the active folder
    $("#activeFolder > .separator").remove();

    sorttype = sorttype || activeFolder.sortdocs || "azasc";

    var docsByExtensions = {};
    var sortedFolders = []; 
    var sortedItems = [];
    var sortedDocs = [];
    var items = [];
    
    



    // A-Z Ascending
    if (sorttype === "azasc") {
        items       = items.concat(docs,subfolders);
        sortedItems = items.sort(naturalSort);
    }
    
    // A-Z Descending
    if (sorttype === "azdesc") {
        items       = items.concat(docs,subfolders);
        sortedItems = items.sort(naturalSort).reverse();
    }





    // Gen Ascending
    if (sorttype === "genasc") {
        sortedFolders   = subfolders.sort(naturalSort);
        sortedDocs      = docs.sort(gensort).reverse();
    }
    
    // Gen Descending
    if (sorttype === "gendesc") {
        sortedFolders   = subfolders.sort(naturalSort);
        sortedDocs      = docs.sort(gensort);
    }





    // EXTENSION SORTING 

    // first create a list of all docs, grouped by extensions. 
    if (sorttype === "extasc" || sorttype === "extdesc") {
        docs.forEach(doc => {
            var ext = (extensionFromFilename((doc.decryptedTitle || "")) || "").toLowerCase();
            docsByExtensions[ext] = docsByExtensions[ext] || [];
            docsByExtensions[ext].push(doc);
        });
    }



    

    // Extension Ascending
    if (sorttype === "extasc") {
        
        sortedFolders = subfolders.sort(naturalSort).reverse();
        
        // if there's any sub-folders, add a section separator
        if (sortedFolders.length >= 1) {
            sortedFolders.unshift({separatorEXT : "folders"});
        }

        // sort extensions amongst themselves, alphabetically
        Object.keys(docsByExtensions).sort().forEach(extasc => {

            // sort docs of each extension, alphabetically amongst themselves
            docsByExtensions[extasc] = docsByExtensions[extasc].sort(naturalSort).reverse();

            // add a separator before each new extension
            sortedDocs.push({separatorEXT : extasc});

            // now add the alphabetically sorted docs of each extension to the master sorted docs list
            sortedDocs = sortedDocs.concat(docsByExtensions[extasc]);

        });
        
    }
    
    
    // Extension Descending
    if (sorttype === "extdesc") {

        sortedFolders = subfolders.sort(naturalSort).reverse();
        
        // if there's any sub-folders, add a section separator
        if (sortedFolders.length >= 1) {
            sortedFolders.unshift({separatorEXT : "folders"});
        }
        
        // sort extensions amongst themselves, alphabetically
        Object.keys(docsByExtensions).sort().reverse().forEach(extdesc => {

            // sort docs of each extension, alphabetically amongst themselves
            docsByExtensions[extdesc] = docsByExtensions[extdesc].sort(naturalSort).reverse();
            
            // add a separator before each new extension
            sortedDocs.push({separatorEXT : extdesc});

            // now add the alphabetically sorted docs of each extension to the master sorted docs list
            sortedDocs = sortedDocs.concat(docsByExtensions[extdesc]); 

        });
    }
    

    

    // if folder is sorted by gen / ext, we'll always first show subfolders, then docs 
    if (sorttype === "genasc" || sorttype === "gendesc" || sorttype === "extasc" || sorttype === "extdesc") {
        sortedItems     = sortedItems.concat(sortedFolders, sortedDocs);
    }




    // now add the CSS order for everything that will be displayed in the active folder
    sortedItems.forEach((item,i) => {
        if (item.docid) {
            // if it's a doc, just set CSS Order, since it's already in dom
            $(`#activeFolder > .doc[did='${item.docid}']`).css("order",i+"").attr("order", i);
        } else if (item.folderid) {
            // if it's a subfolder, just set CSS Order, since it's already in dom
            $(`.subfolder[fid='${item.folderid}']`).css("order",i+"").attr("order", i);
        } else {
            // if it's an extension separator, it's not in DOM, because we cleared them earlier so render with extension & order and add to DOM
            $("#activeFolder").append(renderSeparator(item.separatorEXT,i));
        }
    });
    
    $("#activeFolder").attr("sort", sorttype);
    $("#panel-sort").attr("sort", sorttype);
    
    return true;

}


/**
 * Changes a folder's sort using the given sort type.
 * @param {("azasc"|"azdesc"|"extasc"|"extdesc"|"genasc"|"gendesc")} [sorttype] An optional sorttype
 */
async function changeFolderSort(sorttype) {
    sorttype = sorttype || "azasc";

    breadcrumb('[SORT] Sorting folder : ' + sorttype);

    // set in catalog
    await setFolderMetaInCatalog(activeFolderID, {sortdocs : sorttype});

    // now refresh will take it from catalog
    await refreshDOM();

    // set it on server
    await setFolderMeta(activeFolderID, {sortdocs : sorttype});

    return true;
}





////////////////////////////////////////////////
////////////////////////////////////////////////
//	DOC INFO PANEL
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Prepares the active document's Info Panel on document load / document changes folder / doc renames etc
 * @param {string} did Document ID
 * @param {Object} [doc] Document Object
 * @param {Object} [contents] Document Contents from server / offline storage 
 */
async function prepareActiveDocumentInfoPanel(did, doc, contents) {

    doc = doc || await getDocFromCatalog(did);
    contents = contents || quill.getContents();
    
    // update name
    var name = docName(doc);
    $("#panel-docinfo").find(".name").text(name);
    

    // update size
    var size = bytesize(JSON.stringify(contents)); 
    var formattedSize = formatBytes(size);
    $("#panel-docinfo").find(".size").html(formattedSize);

    // when / generation
    var generation = doc.generation;
    if (doc.offline > doc.generation) {
        generation = doc.offline;
    }

    // update time 
    var lastSaved = new Date(generation / 1000).toLocaleString("en-US", {
        year:"numeric", 
        month:"short", 
        day : "numeric", 
        hour : "numeric", 
        minute : "numeric", 
        second : "numeric" 
    });

    if (generation <= 0) { lastSaved = "a long time ago"; }
    $("#panel-docinfo").find(".time").html(lastSaved);


    // update folder name if it's not home
    if (did !== "d-home") {
        var fname = await getFolderNameFromCatalog(doc.fid);
        $("#panel-docinfo").find(".docfolder").text(fname);
        $("#activeDocFolderButton").attr("fid", doc.fid);
        $("#activeDocFolderButton").show(); 
    } else {
        $("#panel-docinfo").find(".docfolder").empty();
        $("#activeDocFolderButton").attr("fid", "");
        $("#activeDocFolderButton").hide(); 
    }

    // update doc id (for non-live environments)
    var docIDToShow = (did || "").replace("d-", "");
    $("#panel-docinfo").find(".docid").text(docIDToShow);
    
    // update folder id (for non-live environments)
    var folderIDToShow = (doc.fid || "").replace("f-", "").replace("uncat", "inbox");
    $("#panel-docinfo").find(".folderid").text(folderIDToShow);

    // updates the word & char counts
    updateCounts();
    
    
    return true;

}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	WORD COUNTS / CHARACTER COUNTS / SELECTION COUNDS
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Gets the selection's word / character count and updates the counts in the panel, call this in quill selection-change event if range > 1
 */
function selectionCounts() {
    var selection = window.getSelection();
    if (selection.rangeCount > 0) {
        var range = selection.getRangeAt(0);
        var documentFragment = range.cloneContents();
        var selectedContents = $(documentFragment).text();
        var words = wordCount(selectedContents);
        var chars = charCount(selectedContents);
        updateCounts(words, chars);
    }
}

function wordCount(text) {
    text = text || quill.getText().trim();
    // Splitting empty text returns a non-empty array
    return text.length > 0 ? text.split(/\s+/).length : 0;
}

function charCount(text) {
    text = text || quill.getText().trim();
    return text.length;
}

/**
 * Updates the counters using either the given number of words & chars (i.e. for selected text), OR gets it from the document itself. 
 * Call this with no parameters in quill selection-change event if range <= 0
 * @param {number} [words] number of words
 * @param {number} [chars] number of characters
 */
function updateCounts(words, chars) {

    var docWords = wordCount() || "";
    var docChars = charCount() || "";

    if (words && chars) {
        // selection
        $("#panel-docinfo").find(".total-chars").html(docChars);
        $("#panel-docinfo").find(".total-words").html(docWords);
        $("#panel-docinfo").find(".selection-words").html(words);
        $("#panel-docinfo").find(".selection-chars").html(chars);
    } else {
        // whole doc, empty selection
        $("#panel-docinfo").find(".total-chars").html(docChars);
        $("#panel-docinfo").find(".total-words").html(docWords);
        $("#panel-docinfo").find(".selection-words").empty();
        $("#panel-docinfo").find(".selection-chars").empty();
    }

}
  



////////////////////////////////////////////////
////////////////////////////////////////////////
//	DOC FILE PANEL
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Prepares the active document's file panel for things like rename, move to, copy etc.
 * @param {string} did doc id
 * @param {object} doc document object
 */
function prepareActiveDocumentFilePanel(did, doc) {

    // check if it's home doc or other reserved doc, which you can't rename.
    var forReserved = (did === "d-home");
    $("#panel-docfile").toggleClass("for-reserved", forReserved);

    if (doc.offline) {
        $("#panel-docfile").addClass("for-offline-items");
    } else {
        $("#panel-docfile").removeClass("for-offline-items");
    }

    // for saving
    $("#panel-docfile").toggleClass("saving", docState(did).saving);

}





////////////////////////////////////////////////
////////////////////////////////////////////////
//	DOC ACTIONS PANEL
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Prepares the active document's tools panel for things like locks, spell checker etc.
 * @param {string} did doc id
 * @param {object} doc document object
 */
function prepareActiveDocumentToolsPanel(did, doc) {
    
    // locked 
    $("#lockEditsButton").toggleClass("on", (doc.islocked || false));

    // reset viewing mode
    $("#viewingModeButton").removeClass("on");
}




////////////////////////////////////////////////
////////////////////////////////////////////////
//	VIEWING MODE
////////////////////////////////////////////////
////////////////////////////////////////////////


async function enableViewingMode() {
    $("#viewingModeButton").addClass("on");
    $("body").addClass("viewing-doc");
    swiper.allowSlidePrev = false;
    quill.disable();
}

async function disableViewingMode() {
    $("#viewingModeButton").removeClass("on");
    $("body").removeClass("viewing-doc");
    swiper.allowSlidePrev = true;

    // check if doc was locked or not, and enable editor if it wasn't locked;
    var doc = await getDocFromCatalog(activeDocID);
    if (!doc.islocked && !mobilePaperMode) { quill.enable(); }
}




////////////////////////////////////////////////
////////////////////////////////////////////////
//	CRYPTEEFILE ATTACHMENTS
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Attaches a selected file (or doc with given ID) inline to the current document in the editor
 * @param {string} [did] doc id (optionally use a did instead of the selection)
 */
async function attachSelectedFileInline(did) {
    did = did || $("#dropdown-doc").attr("did");
    
    if (!did) { 
        hideRightClickDropdowns();
        hidePanels();
        return false; 
    }

    if (isCursorInTable()) {
        createPopup("Unfortunately you can't add attachments inside tables yet. Please place your cursor outside of the table, and press attach again.", "info");
        return false;
    }

    var name = await getDocNameFromCatalog(did);

    var attachmentTag = `<p><br></p><crypteefile did='${did}'></crypteefile><p><br></p>`;
    quill.clipboard.dangerouslyPasteHTML(getLastSelectionRange().index, attachmentTag, "user");
    quill.setSelection(getLastSelectionRange().index + 2, "silent");
    $(`crypteefile[did="${did}"]`).attr("filetitle", name);
    hideRightClickDropdowns();
    hidePanels();
}

/**
 * Attaches a selected folder (or folder with given ID) inline to the current document in the editor
 * @param {string} [fid] folder id (optionally use a fid instead of the selection)
 */
async function attachSelectedFolderInline(fid) {
    fid = fid || $("#dropdown-folder").attr("fid");

    if (!fid) { 
        hideRightClickDropdowns();
        hidePanels();
        return false; 
    }

    if (isCursorInTable()) {
        createPopup("Unfortunately you can't add attachments inside tables yet. Please place your cursor outside of the table, and press attach / link again.", "info");
        return false;
    }

    var name = await getFolderNameFromCatalog(fid);

    var attachmentTag = `<p><br></p><crypteefolder fid='${fid}'></crypteefolder><p><br></p>`;
    quill.clipboard.dangerouslyPasteHTML(getLastSelectionRange().index, attachmentTag, "user");
    quill.setSelection(getLastSelectionRange().index + 2, "silent");
    $(`crypteefolder[fid="${fid}"]`).attr("foldertitle", name);
    hideRightClickDropdowns();
    hidePanels();
}




////////////////////////////////////////////////
////////////////////////////////////////////////
//	EMBEDS / INSERTS
////////////////////////////////////////////////
////////////////////////////////////////////////


/**
 * Show the correct embed modal
 * @param {('link'|'formula'|'video')} what Which embed modal to show 
 */
function showEmbed(what) {
    if (what === "link") {
        $("#hyperlink-input").val("");
        togglePanel("link-box");
        setTimeout(function () { $("#hyperlink-input").trigger("focus"); }, 50);
    }

    if (what === "formula") {
        showModal("modal-katex");
    }

    if (what === "video") {
        showModal("modal-embed");
    }
}

/**
 * Confirm the embed modal
 * @param {('link'|'formula'|'video')} what Which embed modal to confirm 
 */
function confirmEmbed(what) {
    var erroredOut = false;
    
    if (what === "link") {
        var link = $("#hyperlink-input").val() || "";
        if (link) {
            quillSafelyFormat('link', link.trim());
        }
    }

    if (what === "video") {
        var url = $("#embed-input").val();
        if (url) {
            quill.insertEmbed(getLastSelectionRange().index, 'video', url.trim());
        }
    }

    if (what === "formula") {
        var formula = $("#katex-input").val();
        if (formula) {
            try {
                quill.insertEmbed(getLastSelectionRange().index, 'formula', formula.trim());
            } catch (error) {
                createPopup("there was an error parsing your formula. please check the format is correct, and try again", "error");
                erroredOut = true;
            }
        }
    }

    if (!erroredOut) {
        hideActiveModal();
        hidePanels();
    }
}


/**
 * reads & extracts B64 of an image & embeds into editor 
 * @param {*} File
 * @param {*} [lastSelectionRangeIndex] (getLastSelectionRange().index) Where to embed the image in the editor.
 */
async function processEmbedImage(file, lastSelectionRangeIndex) {    

    breadcrumb('[EMBED IMAGE] Embedding image');
    showEmbeddingImageProgress();
    
    var filename = file.name || "";
    filename = escapeHTML(filename);
    var ext = extensionFromFilename(filename);
    lastSelectionRangeIndex = lastSelectionRangeIndex || getLastSelectionRange().index;

    // make sure image is supported 
    if (!["jpg", "jpeg", "png", "gif"].includes(ext)) {
        breadcrumb('[EMBED IMAGE] Unsupported Format: ' + ext);
        createPopup("unfortunately, most browsers only support displaying images in <b>jpg</b>, <b>png</b> or <b>gif</b> format. So that you can continue to open your documents, files and images in all browsers and devices, we had to restrict our editor to use one of these three extensions. we're very sorry for this inconvenience caused by browsers.", "warning");
        return false;
    }

    activityHappened();

    breadcrumb('[EMBED IMAGE] Reading embedded image');

    var imgBuffer;
    try {
        imgBuffer = await readFileAs(file, "arrayBuffer");
    } catch (error) {
        handleError("[EMBED IMAGE] Couldn't read image file as array buffer", error);
        return "";
    }

    // read the file as buffer, optimize it, then convert to base64
    var base64;
    try {
        base64 = await optimizeImageBuffer(imgBuffer);
    } catch (error) {
        handleError("[EMBED IMAGE] Failed to read file", error);
        createPopup("failed to read / embed image file. chances are your image file is corrupted or in a format not supported by your browser. Please make sure your image file is <b>jpg</b>, <b>png</b> or <b>gif</b>, and if your browser has any privacy extensions or preferences enabled that could affect the use of its File APIs, please disable these temporarily and try again.", "error");
        return false;
    }

    activityHappened();

    var optimizedImageSize = bytesize(base64);

    // prevent files larger than 10mb
    if (optimizedImageSize > 10000000) {
        breadcrumb('[EMBED IMAGE] Image too large: ' + formatBytes(optimizedImageSize));
        createPopup("for your documents to encrypt/decrypt smoothly without issues on all devices, including slower phones; for performance reasons, cryptee optimizes in-line images to make them smaller than 10mb. unfortunately, even after optimization, the image was too large to embed in the document. we're very sorry for this inconvenience caused by encryption in browsers.", "warning");
        return false;
    }

    // insert into editor
    quill.clipboard.dangerouslyPasteHTML(lastSelectionRangeIndex, `<img src="${base64}" class="embedded-image" alt="${filename}" draggable="false" />`);
    
    hideEmbeddingImageProgress();

    return true;

}

/**
 * Reads an image file as buffer, and returns a b64 string of the optimized image that is ready to embed in the editor. 
 * @param {File} imageFile 
 */
async function optimizeImageBuffer(imgBuffer) {

    breadcrumb('[EMBED IMAGE] Optimizing embedded image');

    // read exif from original buffer (should take about 30ms, even for a 30mb file)
    var exif = await readEXIF(imgBuffer);

    var orientation;

    // if the browser won't handle orientation, and there's exif orientation data, use it to rotate pic.
    if (!browserWillHandleEXIFOrientation && exif.Orientation) { orientation = exif.Orientation; }

    var resizedCanvas = document.createElement("canvas");
    var resizedContext = resizedCanvas.getContext("2d");
    var originalCanvas = document.createElement("canvas");
    var originalContext = originalCanvas.getContext("2d");
    var orientationCanvas = document.createElement("canvas");
    var orientationContext = orientationCanvas.getContext("2d");
    
    var img = new Image();
    var blob;
    try {
        var uint8img = arrayBufferToUint8Array(imgBuffer);
        var type     = getImageMimetypeFromUint8Array(uint8img);
        blob         = new Blob([imgBuffer], {type: type});
    } catch (error) {
        handleError("[EMBED IMAGE] Failed to get image buffer / blob", error);
        return "";
    }
    
    if (!blob) {
        handleError("[EMBED IMAGE] Failed to get image blob");
        return "";
    }
    
    try {
        img.src = (URL || webkitURL).createObjectURL(blob);
    } catch (error) {
        handleError("[EMBED IMAGE] Failed to get image object url", error);
        return "";
    }

    try {
        breadcrumb("[EMBED IMAGE] Decoding image");
        await img.decode();
        breadcrumb("[EMBED IMAGE] Decoded image");
    } catch (error) {
        handleError("[EMBED IMAGE] Failed to decode image.", error);
        return "";
    }

    var width = img.width;
    var height = img.height;

    orientationCanvas.width = width;
    orientationCanvas.height = height;

    if (orientation > 4) {
        orientationCanvas.width = height;
        orientationCanvas.height = width;
    }

    switch (orientation) {
        case 2:
            // horizontal flip
            orientationContext.translate(width, 0);
            orientationContext.scale(-1, 1);
            break;
        case 3:
            // 180° rotate left
            orientationContext.translate(width, height);
            orientationContext.rotate(Math.PI);
            break;
        case 4:
            // vertical flip
            orientationContext.translate(0, height);
            orientationContext.scale(1, -1);
            break;
        case 5:
            // vertical flip + 90 rotate right
            orientationContext.rotate(0.5 * Math.PI);
            orientationContext.scale(1, -1);
            break;
        case 6:
            // 90° rotate right
            orientationContext.rotate(0.5 * Math.PI);
            orientationContext.translate(0, -height);
            break;
        case 7:
            // horizontal flip + 90 rotate right
            orientationContext.rotate(0.5 * Math.PI);
            orientationContext.translate(width, -height);
            orientationContext.scale(-1, 1);
            break;
        case 8:
            // 90° rotate left
            orientationContext.rotate(-0.5 * Math.PI);
            orientationContext.translate(-width, 0);
            break;
    }

    orientationContext.drawImage(img, 0, 0);

    var maxWidthOrHeight = 2592;
    var ratio = 1;

    if (orientationCanvas.width > maxWidthOrHeight) {
        ratio = maxWidthOrHeight / orientationCanvas.width;
    } else if (orientationCanvas.height > maxWidthOrHeight) {
        ratio = maxWidthOrHeight / orientationCanvas.height;
    }

    originalCanvas.width = orientationCanvas.width;
    originalCanvas.height = orientationCanvas.height;

    originalContext.drawImage(orientationCanvas, 0, 0, orientationCanvas.width, orientationCanvas.height, 0, 0, originalCanvas.width, originalCanvas.height);

    resizedCanvas.width = originalCanvas.width * ratio; // this canvas gets a reduced size
    resizedCanvas.height = originalCanvas.height * ratio;

    resizedContext.drawImage(originalCanvas, 0, 0, originalCanvas.width, originalCanvas.height, 0, 0, resizedCanvas.width, resizedCanvas.height);
    
    return resizedCanvas.toDataURL("image/jpeg", 0.95); // the whole point is to draw it on canvas, and re-capture, resulting in a png->jpg conversion with some optimization

}

/**
 * EMBEDS THE SELECTED IMAGE FROM CRYPTEE
 * @param {string} [did] optionally DID of image to embed 
 */
async function embedImageFromCryptee(did) {

    did = did || false;

    var selectedDID = did || $("#dropdown-doc").attr("did") || "";

    if (!selectedDID) { 
        handleError("[EMBED IMAGE FROM CRYPTEE] Can't embed image without a did");
        hideRightClickDropdowns();
        hidePanels();
        return false; 
    } 

    $("#embedImageFromCrypteeButton").addClass("loading");

    var file;
    try {
        file = await getDocFromCatalog(selectedDID);
    } catch (error) {
        error.did = selectedDID;
        handleError("[EMBED IMAGE FROM CRYPTEE] Failed to get file from catalog", error);
        createPopup("Failed to embed your image. Chances are your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        $("#embedImageFromCrypteeButton").removeClass("loading");
        hideRightClickDropdowns();
        hidePanels();
        return false;
    }

    if (!file.isfile) {
        handleError("[EMBED IMAGE FROM CRYPTEE] Selected item with did isn't a file. Can't inline embed it", { did : selectedDID });
        createPopup("Failed to embed your image. Chances are your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        $("#embedImageFromCrypteeButton").removeClass("loading");
        hideRightClickDropdowns();
        hidePanels();
        return false; 
    }

    var fileContents;
    try {
        fileContents = await downloadDocumentOrFile(file, true);
    } catch (error) {
        error.did = selectedDID;
        handleError("[EMBED IMAGE FROM CRYPTEE] Failed to download file", error);
        createPopup(`Failed to connect / download your image to embed. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        $("#embedImageFromCrypteeButton").removeClass("loading");
        hideRightClickDropdowns();
        hidePanels();
        return false;
    }

    var filename = docName(file);
    
    try {
        if (selectedDID.endsWith("-v3")) {
            // if it's a v3 upload, file is a uint8array – so make it a blob, then a file and pass it onto our embedder
            processEmbedImage(blobToFile(uInt8ArrayToBlob(fileContents, file.mime), filename));
        } else {
            // if it's not a v3 upload, file is a datauri, so convert from that to blob to file and pass it onto our embedder
            processEmbedImage(blobToFile(dataURIToBlob(fileContents), filename));
        }
    } catch (error) {
        error.did = selectedDID;
        handleError("[EMBED IMAGE FROM CRYPTEE] Couldn't embed image", error);
        createPopup(`Failed to connect / download your image to embed. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        $("#embedImageFromCrypteeButton").removeClass("loading");
        hideRightClickDropdowns();
        hidePanels();
        return false;
    }

    $("#embedImageFromCrypteeButton").removeClass("loading");

    return true;
    
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	TABLE OF CONTENTS
////////////////////////////////////////////////
////////////////////////////////////////////////

var tocArray = [];
function generateTableOfContents() {
    tocArray = [];
    var tocIndex = 0;
    $("#tableofcontents").empty();

    $(".ql-editor").children("h1,h2,h3").each(function(i,heading){
        var headingText = $(heading).text();
        if (headingText.trim() !== "") {
            var tagName = $(heading).prop("tagName");
            var repTag = "";
            if (tagName === "H1") { repTag = "b"; }
            if (tagName === "H2") { repTag = "p"; }
            if (tagName === "H3") { repTag = "small"; }
            $("#tableofcontents").append(`<${repTag} class="doctoc ${tagName}" index="${tocIndex}">${headingText}</${repTag}>`);
            tocArray.push($(heading));
            tocIndex++;
        } 
    });
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	SHOW PERSISTENT STORAGE PROMPT
////////////////////////////////////////////////
////////////////////////////////////////////////


var deniedPersistentStorage = false;

/**
 * Asks the user to permit persistent storage access.
 */
async function askPersistentStoragePermission() {
    
    if (!navigator.storage || !navigator.storage.persist || env === "local" || env === "unknown") { return false; }
    
    var offlineDocs = await getAllDocsFromOfflineCatalog();
    
    // if we have more than 5 offline documents, prompt persistent storge popup
    if (Object.keys(offlineDocs).length > 5) {
        
        breadcrumb('[PERSISTENT STORAGE] Asking for permission');
        var persistent = await navigator.storage.persist();
        
        if (persistent) {
            breadcrumb('[PERSISTENT STORAGE] User granted permission.');
        } else {
            breadcrumb('[PERSISTENT STORAGE] User denied permission.');
            if (!deniedPersistentStorage) {
                deniedPersistentStorage = true;
                setTimeout(function () {
                    breadcrumb('[PERSISTENT STORAGE] Showing a popup explanation for once.');
                    createPopup(`in order for cryptee to securely store your documents on your device in offline mode, you'll need to give cryptee 'persistent storage' permissions.<br> <button class="black" onclick="askPersistentStoragePermission(); hidePopup('popup-persistent-storage-popup');">allow persistent storage</button>`, "warning", "persistent-storage-popup");
                }, 1000);
            }
        }

    }

}





/**
 * Makes a document offline, by downloading it if necessary, and saving it to catalog.offline
 * @param {string} [did] document Id
 */
async function makeDocumentAvailableOffline(did) {

    var selectedDID = $("#dropdown-doc").attr("did") || "";

    if (!did && $("#dropdown-doc").hasClass("show") && selectedDID) { 
        did = selectedDID;
        breadcrumb('[MAKE DOC OFFLINE] Will make selected doc offline : ' + did);
    }

    if (!did) {
        handleError("[MAKE DOC OFFLINE] Can't make offline doc without did!");
        hideRightClickDropdowns();
        hidePanels();
        return false;
    }

    breadcrumb('[MAKE DOC OFFLINE] Making document offline : ' + did);
    $("#makeDocOfflineButton, #makeActiveDocOfflineButton").addClass("loading");

    var doc = await getDocFromCatalog(did);
    var offlineDoc = await getDocFromOfflineCatalog(did);

    if (isEmpty(doc)) {
        handleError("[MAKE DOC OFFLINE] Failed to make doc offline, got no doc.", {did:did});
        createPopup(`Failed to make your document offline. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        
        $("#makeDocOfflineButton, #makeActiveDocOfflineButton").removeClass("loading");
        hideRightClickDropdowns();
        hidePanels();

        return false;
    } 

    if (doc.offline && !isEmpty(offlineDoc)) {
        handleError("[MAKE DOC OFFLINE] Doc was already offline. Terminated.", {did:did});
        
        $("#makeDocOfflineButton, #makeActiveDocOfflineButton").removeClass("loading");
        hideRightClickDropdowns();
        hidePanels();
        
        return true;
    }

    var docContents; 
    if (did === activeDocID) {
        if (docState(activeDocID).changed) { await saveDoc(); }
        docContents = quill.getContents();
    } else {
        docContents = await downloadDocumentOrFile(doc, true);
    }

    if (!docContents || isEmpty(docContents)) {
        handleError("[MAKE DOC OFFLINE] Failed to make doc offline, got no contents.", {did:did});
        createPopup(`Failed to make <b>${docName(doc)}</b> available offline. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        
        $("#makeDocOfflineButton, #makeActiveDocOfflineButton").removeClass("loading");
        hideRightClickDropdowns();
        hidePanels();
        
        return false;
    }

    var madeOffline = await saveDocToOfflineCatalog(doc, docContents);
    
    if (!madeOffline) {
        handleError("[MAKE DOC OFFLINE] Failed to make doc offline. Couldn't save to offline catalog.", {did:did});
        createPopup(`Failed to make <b>${docName(doc)}</b> available offline. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        
        $("#makeDocOfflineButton, #makeActiveDocOfflineButton").removeClass("loading");
        hideRightClickDropdowns();
        hidePanels();
        
        return false;
    }

    breadcrumb('[MAKE DOC OFFLINE] Made document offline : ' + did);

    await refreshDOM();
    
    $("#makeDocOfflineButton, #makeActiveDocOfflineButton").removeClass("loading");
    hideRightClickDropdowns();
    hidePanels();

    return true;

}





/**
 * Makes a document online-only, by removing it from offline storage
 * @param {string} [did] document Id
 */
async function makeDocumentOnlineOnly(did) {

    var selectedDID = $("#dropdown-doc").attr("did") || "";

    if (!did && $("#dropdown-doc").hasClass("show") && selectedDID) { 
        did = selectedDID;
        breadcrumb('[MAKE DOC ONLINE] Will make selected doc online-only : ' + did);
    }

    if (!did) {
        handleError("[MAKE DOC OFFLINE] Can't make offline doc without did!");
        hideRightClickDropdowns();
        hidePanels();
        
        return false;
    }

    breadcrumb('[MAKE DOC ONLINE] Making document online-only : ' + did);
    $("#makeDocOnlineButton, #makeActiveDocOnlineButton").addClass("loading");

    var doc = await getDocFromCatalog(did);

    if (isEmpty(doc)) {
        handleError("[MAKE DOC ONLINE] Failed to make doc online-only, got no doc.", {did:did});
        createPopup(`Failed to make your document online-only. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        
        $("#makeDocOnlineButton, #makeActiveDocOnlineButton").removeClass("loading");
        hideRightClickDropdowns();
        hidePanels();
        
        return false;
    } 

    var removedFromOfflineCatalog = await removeDocFromOfflineCatalog(did);

    if (!removedFromOfflineCatalog) {
        handleError("[MAKE DOC ONLINE] Failed to make doc online-only. Couldn't remove from offline catalog.", {did:did});
        createPopup(`Failed to make <b>${docName(doc)}</b> online-only. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        
        $("#makeDocOnlineButton, #makeActiveDocOnlineButton").removeClass("loading");
        hideRightClickDropdowns();
        hidePanels();
        
        return false;
    }

    // if we're not online
    // if there's no online generation in catalog
    // it means doc was created offline, and never uploaded to server.
    // delete from catalog entirely, if it is somehow online, 
    // we'll re-download from server in the next restart anyway
    if (!isOnline() && !doc.generation) {
        await deleteDocsFromCatalog([did]);
    }

    breadcrumb('[MAKE DOC ONLINE] Made document online-only : ' + did);

    await refreshDOM();
    
    $("#makeDocOnlineButton, #makeActiveDocOnlineButton").removeClass("loading");
    hideRightClickDropdowns();
    hidePanels();
        

    return true;

}


/**
 * Prepares the make docs online modal, sets necessary values like docs' ids & names to modal
 * @param {('rightclick'|'selections'|'activeDoc')} whatToRemove what we'll be deleting from offline storage, right click or selections 
 */
async function prepareMakeOnlineModal(whatToRemove) {
 
    if (!whatToRemove) {
        handleError("[MAKE DOC ONLINE] Can't prepare modal without knowing what to remove from offline storage");
        return true;
    }

    var arrayOfDIDsToRemove = [];

    if (whatToRemove === "rightclick") {
        var rightClickedDIDtoRemove = $("#dropdown-doc").attr("did");
        arrayOfDIDsToRemove.push(rightClickedDIDtoRemove);
    } 
    
    if (whatToRemove === "selections") {
        selections.forEach(did => { arrayOfDIDsToRemove.push(did); });
    }

    if (whatToRemove === "activeDoc") {
        arrayOfDIDsToRemove.push(activeDocID);
    }

    $("#making-online-filenames").empty();

    for (var did of arrayOfDIDsToRemove) {
        var doc = await getDocFromCatalog(did);
        var name = docName(doc);

        var active = "";
        if (did === activeDocID) { active = "<span class='deleting-active-doc-tag'>currently open</span>"; }

        var notOnServer = "";
        if (!doc.generation || doc.offline > doc.generation) { 
            notOnServer = "<span class='deleting-not-synced-tag'>not sync'ed to server!</span>"; 
        } 

        $("#making-online-filenames").append(`<p>${name} ${active} ${notOnServer}</p>`);
    }

    if (arrayOfDIDsToRemove.length > 0) {
        $("#modal-make-selections-online").attr("dids", arrayOfDIDsToRemove);
        $("#modal-make-selections-online").attr("what", whatToRemove);
        
        showModal("modal-make-selections-online");

        breadcrumb('[MAKE DOC ONLINE] Showing modal for ' + arrayOfDIDsToRemove);
    }

    hideRightClickDropdowns();
    hidePanels();

    return true;

}

/**
 * Called once user confirms the deletion of selected docs from offline storage, takes values like did from the modal itself. 
 */
async function confirmMakingSelectedDocsOnline() {
    var arrayOfDIDsToRemove = ($("#modal-make-selections-online").attr("dids") || "").split(",") || [];
    var whatToRemove = $("#modal-make-selections-online").attr("what");

    if (arrayOfDIDsToRemove.length === 0) {
        handleError("[MAKE DOC ONLINE] Can't remove docs from offline storage, no ids found");
        hideActiveModal();
        return true;
    }

    startModalProgress("modal-make-selections-online");

    if (!isOnline() && (arrayOfDIDsToRemove.includes(activeDocID) || whatToRemove === "activeDoc")) {
        startRightProgress("removing...");
    }

    var errors = false;
    for (var did of arrayOfDIDsToRemove) {
        var removed = await makeDocumentOnlineOnly(did);
        if (!removed && !errors) { errors = true; }
    }

    if (errors) {
        createPopup("Failed to remove docs from offline storage. Chances are your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        stopModalProgress("modal-make-selections-online");
        return false;
    }

    if (whatToRemove === "selections") {
        clearSelections();
    }

    if (!isOnline() && (arrayOfDIDsToRemove.includes(activeDocID) || whatToRemove === "activeDoc")) {
        closeActiveDoc();
    }

    stopModalProgress("modal-make-selections-online");

    hideActiveModal();

    return true;

}





////////////////////////////////////////////////
////////////////////////////////////////////////
//	EPUB PAGEFLIPS / BOOKMARKS
////////////////////////////////////////////////
////////////////////////////////////////////////



/**
 * Saves an EPUB Page Flip
 * @param {string} did Doc ID
 * @param {*} location 
 */
async function saveEPUBPage(did, location) {
    breadcrumb('Page Flipped ('+location+')');
    
    try {
        await setDocMetaInCatalog(did, {page:location});
        await setDocMeta(did, {page:location});    
    } catch (error) {
        handleError("[EPUB] Failed to save pageflip", error);    
    }

    return true;
}




/**
 * Adds an EPUB Bookmark
 * @param {string} did Doc ID
 * @param {*} location 
 */
async function addEPUBBookmark(did, location) {
    breadcrumb('Added Bookmark ('+location+')');

    try {
        var b64Location = btoa(location);
        var doc = await getDocFromCatalog(did);
        var bookmarksObject = doc.bookmarks || {};
        bookmarksObject[b64Location] = 1;

        await setDocMetaInCatalog(did, {bookmarks:bookmarksObject});
        await setDocMeta(did, {bookmarks:bookmarksObject});    
    } catch (error) {
        handleError("[EPUB] Failed to add bookmark", error);  
    }

    return true;
}




/**
 * Deletes an EPUB Bookmark
 * @param {string} did Doc ID
 * @param {*} location 
 */
async function deleteEPUBBookmark(did, location) {
    breadcrumb('Removed Bookmark ('+location+')');

    try {
        var b64Location = btoa(location);
        var doc = await getDocFromCatalog(did);
        var bookmarksObject = doc.bookmarks || {};
        delete bookmarksObject[b64Location];

        await setDocMetaInCatalog(did, {bookmarks:bookmarksObject});
        await setDocMeta(did, {bookmarks:bookmarksObject});    
    } catch (error) {
        handleError("[EPUB] Failed to delete bookmark", error);  
    }

    return true;
}


/**
 * Zooms into the EPUB reader or optionally sets the zoom to provided value
 * @param {number} [zoom] (i.e 120 for 120%)
 */
function epubZoom(zoom) {
    zoom = zoom || "";

    var lastZoom; 
    try {
        lastZoom = localStorage.getItem("epub-zoom") || 100;
    } catch (error) { lastZoom = 100; }
    
    lastZoom = parseInt(lastZoom);

    var newZoom = zoom || lastZoom + 10;
    if (newZoom >= 190) { newZoom = 190; }
    
    localStorage.setItem("epub-zoom", newZoom);

    var epubReaderFrame = document.getElementById('embeddedEPUBReader');
    var reader = epubReaderFrame.contentWindow.reader;

    reader.rendition.themes.fontSize(newZoom + "%");

    $("#file-viewer").attr("zoom", newZoom);
}

/**
 * Zooms out of the EPUB reader
 */
function epubZoomOut() {
    var lastZoom; 
    
    try {
        lastZoom = localStorage.getItem("epub-zoom") || 100;
    } catch (error) { lastZoom = 100; }
    
    lastZoom = parseInt(lastZoom);

    var newZoom = lastZoom - 10;
    if (newZoom <= 70) { newZoom = 70; }

    localStorage.setItem("epub-zoom", newZoom);

    var epubReaderFrame = document.getElementById('embeddedEPUBReader');
    var reader = epubReaderFrame.contentWindow.reader;

    reader.rendition.themes.fontSize(newZoom + "%");

    $("#file-viewer").attr("zoom", newZoom);
}



/**
 * Toggles between light / dark mode for epub reader
 */
function epubToggleTheme() {
    $("#file-viewer").toggleClass("epubLight");
    
    var light = $("#file-viewer").hasClass("epubLight");
    

    var epubReaderFrame = document.getElementById('embeddedEPUBReader');
    var reader = epubReaderFrame.contentWindow.reader;
    var body = $(epubReaderFrame.contentDocument).find("body");

    if (!reader) { 
        handleError("[EPUB READER] Couldn't access reader. iFrame may be blocked", {}, "warning");
        return; 
    }

    if (!reader.rendition) {
        handleError("[EPUB READER] Couldn't access reader rendition. iFrame may be blocked", {}, "warning");
        return;
    }

    if (light) {
        reader.rendition.themes.select("light");
        body.removeClass("dark");
        body.addClass("light");
    } else {
        reader.rendition.themes.select("dark");
        body.removeClass("light");
        body.addClass("dark");
    }
}





////////////////////////////////////////////////
////////////////////////////////////////////////
//	GHOST / SUMMON
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Prepares the Ghost Folder Modal, by getting the folder's ID, name etc.
 */
function prepareMakeGhostModal() {
    
    var fid = $("#dropdown-folder").attr("fid");
    
    if (!fid) { 
        hideRightClickDropdowns();
        hidePanels();
        return false; 
    }

    if (fid === "f-uncat") {
        handleError("[GHOST FOLDER] User tried ghosting Inbox");
        hideRightClickDropdowns();
        hidePanels();
        return false; 
    }

    $("#modal-ghost").attr("fid", fid);

    showModal("modal-ghost");

    hideRightClickDropdowns();
    hidePanels();

    return true;
}




/**
 * Makes a folder Ghost by using the id / name from ghost modal
 */
async function makeGhostFolder() {
    
    var fid = $("#modal-ghost").attr("fid") || "";

    if (!fid) {
        handleError("[GHOST FOLDER] Can't make ghost without Folder ID.");
        return false;
    }

    var folder = await getFolderFromCatalog(fid);
    if (isEmpty(folder)){
        handleError("[GHOST FOLDER] Can't ghost a folder that doesn't seem to exist. (or is empty)");
        createPopup("There seems to be an issue and we can't seem to be able to ghost this folder. Please try renaming the folder, if it has any special characters, or reach out to our support via our helpdesk for more help.", "error");
        return false;
    }

    var fname = folderName(folder);
    if (!fname) {
        handleError("[GHOST FOLDER] Can't ghost, folder title is empty");
        createPopup("Please give this folder a valid and memorable name before ghosting it. You'll need to use this name to summon (retrieve) this folder later.", "error");
        return false; 
    }

    var typedName = $("#ghost-input").val();
    if (typedName !== fname) {
        $("#ghost-input").trigger("focus");
        createPopup("Please type this folder's name exactly as it is to confirm you can remember it before ghosting it. You'll need to use this name to summon (retrieve) this folder later.", "error");
        return false; 
    }

    startModalProgress("modal-ghost");
    breadcrumb('[GHOST FOLDER] Hashing title');




    // #1 HASH THE TITLE
    var hashedTitleToGhost;

    try {
        hashedTitleToGhost = await hashString(fname);
    } catch (error) {
        handleError("[GHOST FOLDER] Couldn't hash entered title.", error);
    }

    if (!hashedTitleToGhost) {
        createPopup("There seems to be an issue with this folder's name. Please check the folder name to see if it has any special characters, or reach out to our support via our helpdesk for more help.", "error");
        stopModalProgress("modal-ghost");
        return false;
    }

    activityHappened();





    // GOT THE HASHED TITLE
    // #2 SEND THE HASH TO API TO GHOST THE FOLDER WITH THIS HASHED TITLE. 
    // ONCE THE GHOSTING IS COMPLETE, API WILL RETURN CONFIRMATION, AND YOU CAN REMOVE IT FROM CATALOG & REFRESH CATALOG
    breadcrumb('[GHOST FOLDER] Ghosting Folder');

    var apiResponse;

    try {
        apiResponse = await setGhostFolder(fid, hashedTitleToGhost);
    } catch (error) {
        handleError("[GHOST FOLDER] An error occurred with API", error);
    }

    if (!apiResponse) {
        createPopup("It seems we're having difficulties ghosting your folder at the moment. Chances are this is a network problem. Please check your connection and reach out to our support via our helpdesk if this issue continues", "error");
        stopModalProgress("modal-ghost");
        return false;
    }





    // FOLDER IS GHOSTED. LET'S CLEAN THINGS UP.
    // WE'LL NEED TO DELETE ALL ITS DOCS, ALL ITS SUBFOLDERS RECURSIVELY FROM CATALOG. 
    // FASTEST WAY TO DO THIS, IS TO RELY ON AN EXISTING SYSTEM, WHICH IS DELETE FOLDER FROM CATALOG

    breadcrumb('[GHOST FOLDER] Ghosted Folder. Recursively removing its subfolders & docs to update catalog.');
    
    await deleteFolderAndItsContentsFromCatalog(fid);

    activityHappened();

    stopModalProgress("modal-ghost");
    hideActiveModal();

    $("#modal-ghost").attr("fid", "");
    $("#ghost-input").val("");

    return true;

}



/**
 * Summons a ghost folder using the text from the modal or optionally using the given hash.
 * @param {string} [hash] for debugging 
 */
async function summonGhostFolder(hash) {
    hash = hash || false;

    activityHappened();

    var folderNameToSummon = $("#summon-input").val() || "";

    if (folderNameToSummon.length === 0) { 
        $("#summon-input").trigger("focus");
        return false; 
    }

    breadcrumb('[SUMMON FOLDER] Summoning Folder.');

    startModalProgress("modal-summon");

    // #1 HASH THE TITLE

    var hashedTitleToSummon;

    breadcrumb('[SUMMON FOLDER] Hashing Title.');

    try {
        hashedTitleToSummon = await hashString(folderNameToSummon);
    } catch (error) {
        handleError("[SUMMON FOLDER] Couldn't hash entered title.", error);
    }

    hashedTitleToSummon = hash || hashedTitleToSummon;

    if (!hashedTitleToSummon) {
        createPopup("There seems to be an issue with the folder name you've entered. Please check the folder name to see if it has any special characters, or reach out to our support via our helpdesk for more help.", "error");
        stopModalProgress("modal-summon");
        return false;
    }

    activityHappened();

    // GOT THE HASHED TITLE. 
    // #2 SEND THE HASH TO API TO SEE IF THERE'S A GHOST WITH THIS TITLE.
    // IF THERE IS, THIS WILL RETURN THE GHOST FOLDER TO ADD TO albums[]

    var folder;
    try {
        folder = await getSummonFolder(hashedTitleToSummon);
    } catch (error) {
        handleError("[SUMMON FOLDER] An error happened with API", error);
        stopModalProgress("modal-summon");
        return false;
    }

    if (isEmpty(folder)) {
        breadcrumb('[SUMMON FOLDER] Done.');
        stopModalProgress("modal-summon");
        return false;
    }

    breadcrumb('[SUMMON FOLDER] Summoned Folder. Checking it for backwards compatibility.');
    
    //  CHECK IF IT'S A V1 or V2 GHOST FOLDER.
    //  In V1 & V2, you were only allowed to ghost/summon folders without subfolders. 
    //  And once ghosted, their hashes were written over their titles, leaving the folder without a title. (long story)
    //  So if a user's summoning a legacy V1/V2 folder, that was ghosted before V3 they will arrive without titles. 
    //  We'll have to write the title to the folder, and update the folder in catalog & server.
    //  The way we know we need to do this, is if the folder arrives with a title = hash.
    //  We have to do this before we fetch the folders using getRecentDocsAndFolders and decrypt the catalog.
    //  Otherwise decrypt catalog will fail.
     
    if (folder.title.startsWith(hashedTitleToSummon) || folder.title.includes(hashedTitleToSummon)) {
        
        breadcrumb('[SUMMON FOLDER] Summoned Folder is a V1/V2 folder. Updating to V3.');

        // We need to update the foldername on server & catalog. 
        // However. Keyword "UPDATE". And folder doesn't exist in catalog, so we can't simply rename it.  
        // So first, we'll have to create a temporary new folder in catalog. 
        await newFolderInCatalog({ folderid : folder.folderid });

        // Now that we have a temporary folder in catalog, proceed to rename folder it as expected. 
        // rename won't fail now
        await renameDocOrFolder(folder.folderid, folderNameToSummon);

    }
    
    breadcrumb('[SUMMON FOLDER] Passed Backwards Compatibility Check. Fetching folders / subfolders / docs.');

    // THERE IS NO BETTER WAY TO ADD ALL THE NEW FOLDERS / SUBFOLDERS / DOCS TO THE CATALOG, 
    // THAN TO CALL getRecentDocsAndFolders() WHICH GETS ALL FOLDERS, DOCS & FILES, 
    // ADDS EVERYTHING TO CATALOG, TITLES OF ALL FOLDERS, AND TITLES OF ONLY THE RECENT DOCS / FILES.

    await getRecentDocsAndFolders();

    breadcrumb('[SUMMON FOLDER] Decrypting folders / subfolders / docs.');

    await decryptCatalog(); // refreshes dom as well

    breadcrumb('[SUMMON FOLDER] Done! Summoned Folder Successfully.');

    activityHappened();

    stopModalProgress("modal-summon");
    
    hideActiveModal();
    
    $("#summon-input").val("");

    return true;

}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	DOCUMENT METADATA
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Takes a plaintext document delta object (plaintextContents) and enriches it by adding in document metadata. (i.e. documentFont)
 * @param {Object} plaintextContents 
 * @param {Boolean} [isItForNewDoc] (forces things like using defaultFont vs getting the document's font from DOM) 
 * @returns {Object} plaintextContents
 */
 function addDocumentMetadataToDelta(plaintextContents, isItForNewDoc) {

    plaintextContents = plaintextContents || {};
    isItForNewDoc = isItForNewDoc || false;

    breadcrumb('[DOC META] Saving document metadata');

    /**
     * documentFont (a.k.a. device default font at the time of document creation / save)
     */
    var documentFont = $(".ql-editor").attr("font") || defaultFont;
    if (isItForNewDoc) { documentFont = defaultFont; }
    
    plaintextContents.metadata = {
        
        "documentFont" : documentFont,
        
    };
    
    breadcrumb('[DOC META] Saved document metadata');
    return plaintextContents;

}

/**
 * Takes a plaintext document delta object (plaintextContents), and loads document's metadata into the DOM / Editor. (i.e. documentFont)
 * @param {Object} plaintextContents 
 * @returns {Object} plaintextContents
 */
function loadDocumentMetadataFromDelta(plaintextContents) {
    
    plaintextContents = plaintextContents || {};
    
    breadcrumb('[DOC META] Loading document metadata');
    
    // if we don't have any metadata, return defaults
    if (isEmpty(plaintextContents.metadata)) { 
        plaintextContents.metadata = {
            documentFont : "josefin-sans", // for backwards compatibility with documents that don't have a font
        };
        breadcrumb('[DOC META] Document has no metadata will use defaults');
    }
    
    // Load documentFont (a.k.a. device default font at the time of document creation / save)
    $(".ql-editor").attr("font", plaintextContents.metadata.documentFont);
    
    // if quill throws a tantrum, start deleting these. 
    // delete plaintextContents.metadata.documentFont;
    
    breadcrumb('[DOC META] Loaded document metadata');
    return plaintextContents;

}
