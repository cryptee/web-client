////////////////////////////////////////////////
////////////////////////////////////////////////
//	LOAD DOC 
////////////////////////////////////////////////
////////////////////////////////////////////////

$("body").on('click', '.doc > .info', function(event) {
    var did = $(this).parent().attr("did");
    clearSearchOnlyIfNecessary();
    prepareToLoadDoc(did);
}); 

/**
 * Determines if something's a doc or a file, and calls either loadDoc or loadFile, and prevents loading if there's something already loading
 * @param {string} did Doc or File ID
 * @param {string} [filename] Optional filename (i.e. when we call this from an attachment, name of which may not be decrypted in the catalog)
 */
async function prepareToLoadDoc(did, filename) {
    filename = filename || "";
    
    // check if active doc changed, and save it in background if necessary
    if (docState(activeDocID).changed) {
        // save active doc in background with the contents that are in the editor right now.
        // before the contents of the editor change
        saveDoc(activeDocID, true, quill.getContents());
    }
    
    var doc = await getDocFromCatalog(did);

    // DETERMINE IF IT'S A DOC OR FILE
    if (doc.isfile) { 
        loadFile(doc, filename);
    } else {
        if (!loadingDoc) {
            loadDoc(doc);
        } else {
            createPopup("already loading & decrypting a document, please wait.", "info");
        }
    }
    
}



var loadingDoc = false;

/**
 * Loads a document (downloads, decrypts, adds to quill, opens it in editor etc)
 * @param {Object} doc A Document Object
 */
async function loadDoc(doc) {
    var did = doc.docid;
    loadingDoc = true;

    breadcrumb('[LOAD DOC] Loading ' + did);

    
    //
    //
    // DISPLAY PRE-LOADING PROGRESS
    //
    //

    // start doc loading progress
    startDocOrFileProgress(did);

    // make editor progress indeterminate
    startRightProgress("loading...");

    
    
    
    
    // CHECK CONNECTION FIRST. 
    var connection = await checkConnection(); 
    
    
    // USER ISN'T CONNECTED, AND DOC ISN'T AVAILABLE OFFLINE. ABORT. 
    if (!connection && !doc.offline) {
        handleError("[LOAD DOC] Failed to load. No connection, and no offline doc available", {did:did});
        createPopup(`Failed to load your document <b>${docName(doc)}</b>. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        failedToLoadDoc(doc);
        return false;
    }
    
    
    
    
    
    //
    //
    // START DOWNLOADING / FETCHING FROM OFFLINE STORAGE
    //
    //

    // WE'LL FIRST CHECK IF DOC IS AVAILABLE OFFLINE, AND WHETHER IF IT'S RECENT. (I.E. AS NEW AS THE ONLINE ONE / OR NEWER)
    // AND WE'LL USE THE OFFLINE ONE IF IT'S RECENT. 
    // OR WE'LL DOWNLOAD THE ONLINE ONE IF NOT.
    
    var isOfflineDocRecent = false;
    var reSaveOfflineDoc = false;
    var offlineDoc = {};
    

    // if doc is available offline, check if it's newer than the one in catalog.
    if (doc.offline) {
        breadcrumb('[LOAD DOC] There is an offline version. Comparing catalog & offline generations of ' + did);
        offlineDoc = await getDocFromOfflineCatalog(did);

        if (!isEmpty(offlineDoc)) {
            if (doc.offline >= doc.generation) {
                // there's an offline doc, and it's newer or in-sync with the online doc. use it. 
                isOfflineDocRecent = true;
            }
        } else {
            // doc was flagged offline in catalog, but somehow doesn't exist in offline catalog.
            handleError("[LOAD DOC] Doc was flagged 'offline', but wasn't in offline-catalog. Will fix/re-save after load.", {did:did});
            reSaveOfflineDoc = true;
        }

    }



    var docContents;
    if (isOfflineDocRecent) {
        // offline doc is recent – use it.
        breadcrumb('[LOAD DOC] Found a recent offline version. Loading it: ' + did);
        docContents = await loadDocFromOfflineCatalog(did, offlineDoc);
    } else {
        if (connection) {
            // there's no offline doc, or it's not recent, we're connected, so download newest from server.
            breadcrumb('[LOAD DOC] Downloading & Decrypting document: ' + did);
            docContents = await downloadAndDecryptFile(did, null, "crypteedoc", docName(doc), null, null, doc);
        } else {
            // there's no offline doc, or it's not recent, but we're not connected. so continue using outdated version. 
            breadcrumb('[LOAD DOC] Found an outdated offline version. Loading it: ' + did);
            createPopup(`loaded the offline copy of <b>${docName(doc)}</b>, but can't confirm if it's indeed the latest version or not since you're not connected to the internet. If you save this document, it could potentially overwrite online contents that may be more recent. We recommend making a copy of this document before saving it.`, "warning");
            docContents = await loadDocFromOfflineCatalog(did, offlineDoc);
        }
    }

    activityHappened();

    
    if (!docContents) {
        handleError("[LOAD DOC] Failed to load, got no contents.", {did:did});
        createPopup(`Failed to load your document <b>${docName(doc)}</b>. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        failedToLoadDoc(doc);
        return false;
    }

    await loadedDocPrepareEditor(doc, did, docContents, connection, reSaveOfflineDoc);

    loadingDoc = false;
}


/**
 * Prepare the editor after the doc is loaded (used both in loadDoc and in newDoc after creating a brand new document in foreground)
 * @param {*} doc document object
 * @param {string} did document id
 * @param {object} docContents quill deltas
 * @param {boolean} connection 
 * @param {boolean} [forceSaveOfflineDoc] 
 */
async function loadedDocPrepareEditor(doc, did, docContents, connection, forceSaveOfflineDoc) {
    
    forceSaveOfflineDoc = forceSaveOfflineDoc || false;
    
    breadcrumb('[LOAD DOC] Preparing editor for ' + did);

    // set activeDocID;
    activeDocID = did;

    // there's been some activity. 
    activityHappened();

    // quit paper mode before you set editor's contents to avoid an unnecessary calculation nightmare
    disablePaperMode(true);

    // disable spell check before adding new text in. (ridiculously good for performance) 
    quill.root.spellcheck = false;
    $("#spellCheckerButton").removeClass("on");

    // clear editor to avoid a large diff compute time
    // https://github.com/quilljs/quill/issues/1537
    // https://github.com/cryptee/web-client/issues/102
    quill.setContents("");
    
    // Load document metadata from the delta
    docContents = loadDocumentMetadataFromDelta(docContents);

    // add delta into the editor. 
    try {
        quill.setContents(docContents);
    } catch (error) {
        handleError("[LOAD DOC] Quill failed to set contents.", {did:activeDocID});
        createPopup(`Failed to load your document <b>${docName(doc)}</b>. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        failedToLoadDoc(doc);
        return false;
    }

    // clear editor history
    quill.history.clear();
    
    // lock/unlock editor (if doc is locked)
    if (doc.islocked) {
        lockEditor();
    } else {
        unlockEditor();
    }

    // quit viewing mode
    disableViewingMode();

    if (doc.paper) {
        enablePaperMode(doc.paper, doc.orientation, true);
    }
    
    // quill.setContents will trigger somethingChanged() for the doc we've just opened. 
    // So we'll have to set that flag back
    docChanged(activeDocID, false);

    // there was an offline doc flag, but document wasn't in offline storage, re-save it there to fix future issues. 
    // ALTERNATIVELY, it's a new doc, and we've loaded the editor, and we want to make sure newly created doc is available offline,
    // until it's meta is saved to server as a failsafe.
    // read more in newDoc() – EDGE CASE

    if (forceSaveOfflineDoc) {
        await makeDocumentAvailableOffline(activeDocID);
    }

    //
    //
    // DISPLAY LOADED PROGRESS
    //
    //



    
    // stop doc loading spinner
    stopDocOrFileProgress(activeDocID);

    // set editor progress to 100%
    stopRightProgress("green");
    if (!connection) { stopRightProgress("blue"); }

    // show document (remove no-doc or loading from body / editor)
    updateEditorState(); // blank = show doc

    
    // refresh dom to reflect active doc in recents/folder etc
    await refreshDOM();



    //
    //
    // DISPLAY OTHER INFORMATION
    //
    //



    // set document name in the browser tab
    document.title = "Cryptee | " + docName(doc);

    // prep info panel with doc name, folder, size, word count etc
    breadcrumb('[LOAD DOC] Preparing "DOCINFO" Panel for ' + activeDocID);
    prepareActiveDocumentInfoPanel(activeDocID, doc, docContents);

    breadcrumb('[LOAD DOC] Preparing "DOCFILE" Panel for ' + activeDocID);
    prepareActiveDocumentFilePanel(activeDocID, doc);

    breadcrumb('[LOAD DOC] Preparing "DOCTOOLS" Panel for ' + activeDocID);
    prepareActiveDocumentToolsPanel(activeDocID, doc);

    breadcrumb('[LOAD DOC] Generating table of contents for ' + activeDocID);
    generateTableOfContents();

    breadcrumb('[LOAD DOC] Loaded ' + activeDocID);

}









/**
 * Called when there's a problem loading a document
 * @param {Object} doc A document object
 */
async function failedToLoadDoc(doc) {
    loadingDoc = false;
    stopDocOrFileProgress(doc.docid);

    if (!activeDocID) {
        stopRightProgress("red");
        document.title = "Cryptee";
        updateEditorState("no-doc");
    } else {
        stopRightProgress();
    }
}


















var activeFileID;
var loadingFile = false;

/**
 * Loads a non-document file (i.e. a PDF)
 * @param {Object} doc a non-document file 
 * @param {string} [filename] Optional filename (i.e. when we call this from an attachment, name of which may not be decrypted in the catalog)
 */
async function loadFile(doc, filename) {
    
    loadingFile = true;
    var did = doc.docid;
    filename = filename || docName(doc);
    var ext = extensionFromFilename(filename);

    breadcrumb('[LOAD FILE] Loading ' + did);

    startDocOrFileProgress(did);
    
    if (previewerSupportedExtensions.includes(ext)) {
        startFileViewerProgress();
    }

    // CHECK CONNECTION FIRST. 
    var connection = await checkConnection(); 

    // USER ISN'T CONNECTED, ABORT. 
    if (!connection) {
        handleError("[LOAD FILE] Failed to load. No connection", {did:did});
        createPopup(`Failed to load your file <b>${docName(doc)}</b>. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        failedToLoadFile(did);
        return false;
    }
    
    // if either the previewer or the importer supports the file, download & decrypt it

    activityHappened();
    
    // LOAD PREVIEWER FOR SUPPORTED FORMAT (I.E. JPG, PDF) 
    if (previewerSupportedExtensions.includes(ext)) {
        await loadFileIntoFileViewer(doc, filename);
    } 
    
    // START IMPORTER FOR SUPPORTED FORMAT
    else if (importerSupportedExtensions.includes(ext)) {
        await importFile(doc, filename);
    } 

    // SHOW UNSUPPORTED FILE / DOWNLOAD POPUP
    else {
        handleError('[LOAD FILE] – Unsupported Format (' + ext + ")", { did : doc.docid }, "info");
        await displayUnsupportedFile(doc, filename);
    }

    // refresh dom to reflect active file in recents/folder – and update name in file viewer
    refreshDOM();

    stopDocOrFileProgress(did);

    if (previewerSupportedExtensions.includes(ext)) {
        stopFileViewerProgress();
    }

    loadingFile = false;

    return true;
}




/**
 * Called when there's a problem loading a file
 * @param {Object} doc A non-document file/doc object
 */
async function failedToLoadFile(did) {
    loadingFile = false;
    stopDocOrFileProgress(did);
    if (!activeFileID) { stopFileViewerProgress(); }
}



/**
 * Closes active document without saving it. (i.e. when active doc is deleted or when there's an error)
 */
async function closeActiveDoc() { 

    breadcrumb('[CLOSE DOC] Closing ' + activeDocID);

    docChanged(activeDocID, false);
    
    // make editor state hidden.
    updateEditorState("no-doc");
    
    setTimeout(function () {
        stopRightProgress("red");
        stopRightProgress();
    }, 500);

    // set activeDocID;
    activeDocID = "";

    // reset spellcheck
    quill.root.spellcheck = false;
    
    // clear contents
    quill.setContents("");

    // clear editor history
    quill.history.clear();

    // there's been some activity. 
    activityHappened();

    unlockEditor();
    
    document.title = "Cryptee";

    await refreshDOM();
    
    return true;
}