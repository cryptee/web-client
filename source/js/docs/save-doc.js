////////////////////////////////////////////////
////////////////////////////////////////////////
//	SAVE DOC / UPLOAD DOC / DOCUMENT STATES ETC
////////////////////////////////////////////////
////////////////////////////////////////////////



////////////////////////////////////////////////
////////////////////////////////////////////////
//	AUTOSAVE TIMER
////////////////////////////////////////////////
////////////////////////////////////////////////

var idleTime = 0;
var idleInterval = setInterval(idleTimer, 1000);

// AUTOSAVE IN 4 SECONDS IF ONLINE, OR 2 SEC IF OFFLINE
function idleTimer() {
    idleTime++;
    
    if (activeDocID) {
        if (isOnline()) {
            if (idleTime > 4) { saveDoc(); }
        } else {
            if (idleTime > 2) { saveDoc(); }
        }
    }

}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	DOCUMENTS' STATES (CHANGED / SAVING)
////////////////////////////////////////////////
////////////////////////////////////////////////

// This is where we keep track of document's states
// it looks like this : 
// docsStates[did] = {
// changed : true,
// saving : true
// }

// to access it always use docState
var docsStates = {};

/**
 * The current change & save state of a document with given ID.
 * @param {string} did Document ID
 * @returns {Object} state Document State Object
 * @returns {boolean} state.changed Whether if document changed 
 * @returns {boolean} state.saving  Whether if document is already being saved/uploaded 
 */
function docState(did) {
    if (!did) {
        return { changed: false, saving: false };
    }

    docsStates[did] = docsStates[did] || {};
    docsStates[did].changed = docsStates[did].changed || false;
    docsStates[did].saving = docsStates[did].saving || false;
    return docsStates[did];
}

/**
 * Sets a document's changed state to true or false
 * @param {string} did Document ID
 * @param {boolean} changed
 */
function docChanged(did, changed) {
    if (!did) { return false; }
    docsStates[did] = docsStates[did] || {};
    docsStates[did].changed = changed || false;
    idleTime = 0;
}

/**
 * Sets a document's saving state to true or false
 * @param {string} did Document ID
 * @param {boolean} saving
 */
function docSaving(did, saving) {
    if (!did) { return false; }
    docsStates[did] = docsStates[did] || {};
    docsStates[did].saving = saving || false;
    idleTime = 0;

    $(`.doc[did="${did}"]`).toggleClass("saving", saving);
}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	ON EDITOR CHANGE
////////////////////////////////////////////////
////////////////////////////////////////////////



function somethingChanged() {
    updateRightProgress(0, 100);
    $('#progress').addClass('yellow');
    $("#panel-docfile").addClass("saving");
    $("#dropdown-doc.for-active-doc").addClass("saving");
    activityHappened();
    docChanged(activeDocID, true);
}



// Show navigation warning if user tries to leave while there's a pending save / change
window.onbeforeunload = function () {
    var pendingSaveOrUnsavedChange = false;
    
    for (var did in docsStates) {
        if (docState(did).saving || docState(did).changed) {
            pendingSaveOrUnsavedChange = true;
        }
    }

    if (Object.keys(saveQueue).length >= 1) {
        pendingSaveOrUnsavedChange = true;
    }

    // if this returns true, we'll warn user before navigating away
    if (pendingSaveOrUnsavedChange) { return true; }
};



////////////////////////////////////////////////
////////////////////////////////////////////////
//	SAVE QUEUE
////////////////////////////////////////////////
////////////////////////////////////////////////

// if the user tries to save the same file twice really quickly, queue & run the second save after the first one's complete
// saveQueue[did] = { inBackground : true, plaintextContents : plaintextContents };
var saveQueue = {};




/**
 * Runs the save queue for a document
 * @param {string} document id 
 */
async function checkAndRunSaveQueueForDoc(did) {
    
    // if there's another save in the queue for this document, run that, then empty the queue.
    
    if (!isEmpty(saveQueue[did])) {
        breadcrumb('[SAVE] Running queued save for doc : ' + did);
        await saveDoc(did, saveQueue[did].inBackground, saveQueue[did].plaintextContents);
        delete saveQueue[did];
    }

    return true;
}




/**
 * Saves a document either in foreground or background
 * @param {string} [did] optional document id, otherwise active doc's id is used 
 * @param {boolean} [inBackground] whether to save in the background or not (provide a did if it's in the background)
 * @param {*} [plaintextContents] contents you get from quill.getContents(), optionally provided (i.e. when we're in background), or we get this from quill itself.
 */
async function saveDoc(did, inBackground, plaintextContents) {
    
    inBackground = inBackground || false;
    did = did || activeDocID;
    
    // there's no open doc, and this is a foreground save
    if (!inBackground && $("body").hasClass("no-doc")) {
        return false;
    }

    // there's no doc id. something's wrong.
    if (!did) {
        stopRightProgress("red");
        breadcrumb("[SAVE] Can't save without a document id.");
        createPopup("<b>Failed to save document!</b> Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        idleTime = 0;
        return false;
    }

    // tried to save in foreground, but doc hasn't changed yet. 
    // this is a circuit-breaker for :
    // a) if you press cmd + s 3 times quickly etc but nothing has changed, we'll save just once if something's changed.
    // b) when a document is open, idleTimer will keep calling save every 1-3 seconds, we'll only save once something's changed. 
    if (!inBackground && !docState(did).changed) {
        return false;
    }

    // tried to save in background, but gave no contents. something's wrong.
    if (inBackground && isEmpty(plaintextContents)) {
        handleError("[SAVE] Can't save in background without contents.", {did:did});
        createPopup("<b>Failed to save document!</b> Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        docSaving(did, false);
        return false;
    }

    // saving active doc in foreground, and it's open in the editor, get contents from editor.
    if (did === activeDocID && !inBackground && !$("body").hasClass("no-doc")) {
        plaintextContents = quill.getContents();
    }

    // if editor contents is an empty object (which it can't be) something's wrong.
    if (isEmpty(plaintextContents)) {
        stopRightProgress("red");
        handleError("[SAVE] Can't save doc without contents.", {did:did});
        createPopup("<b>Failed to save document!</b> Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        docSaving(did, false);
        return false;
    }

    // add document metadata to the delta (i.e. document fonts etc)
    plaintextContents = addDocumentMetadataToDelta(plaintextContents);

    // are we already trying to save the same doc? 
    // if so, add this save to the queue, and terminate. 
    // once ongoing save is complete, we'll go to queue, and run save again.
    
    // if the doc is being saved for more than 4 seconds, autosave timer could fire this again and again.
    // i.e. if doc is saving for 24+ seconds, autosave timer will fire this for 6 more times. 
    // even if the doc hasn't changed at all during the save. 
    // if the doc hasn't changed, 
    // once the save starts, we'll stop at the circuit breaker where we check for docState(did).changed
    
    // so in total, queued save will run only once after all changes stopped.

    if (docState(did).saving) {
        breadcrumb('[SAVE] Queued another save for doc : ' + did);
        saveQueue[did] = {
            inBackground : inBackground,
            plaintextContents : plaintextContents
        };
        return false;
    }


    
    // IF WE'VE MANAGE TO COME THIS FAR, 
    // LOOKS LIKE IT QUALIFIES AS A SAVE, LET'S GET STARTED 
    docSaving(did, true);
    

    // SINCE WE'VE ALREADY VERIFIED & GOT THE CONTENTS FROM THE EDITOR
    // WE CAN SET THIS TO DOC CHANGED = FALSE NOW. 
    // = NO CHANGES TOOK PLACE SINCE WE LAST GOT THE EDITOR'S CONTENTS.
    // IF A SAVE'S TRIGGERED AGAIN (which it will due to timer)
    // IT'LL BE IGNORED, UNLESS THERE WAS A CHANGE AS WELL
    docChanged(did, false);


    
    var forceOffline = false;
    var docUpload = {};
    var docGen, metaSavedToServer, metaSavedToCatalog;

    

    // THEN CHECK IF WE'RE CONNECTED.
    var connection = await checkConnection(); 
    activityHappened();

    
    // IF WE'RE CONNECTED, ENCRYPT & UPLOAD THE DOCUMENT TO SERVER
    if (connection) {
        docUpload = await encryptAndUploadDocument(did, plaintextContents, inBackground);
        activityHappened();
    }
    




    // IF WE'RE CONNECTED, AND DOC SUCCESSFULLY UPLOADED TO SERVER
    // SAVE DOC META TO SERVER & CATALOG

    if (connection && !isEmpty(docUpload)) { 

        docGen = parseInt(docUpload.generation);
        
        // request wake lock to keep device awake
        enableWakeLock();

        var docTags = await findAndEncryptDocumentTags(did, plaintextContents);
        var encryptedTags = docTags.tags;
        var decryptedTags = docTags.decryptedTags;        

        metaSavedToServer = await setDocMeta(did, { 
            generation : docGen,
            tags : encryptedTags 
        });

        metaSavedToCatalog = await setDocMetaInCatalog(did, {
            generation : docGen,
            tags : encryptedTags,
            decryptedTags : decryptedTags // for local catalog, to save a decryption cycle, we save the decrypted tags too
        });

        // release wake lock to let device sleep
        disableWakeLock();
        
        activityHappened();

    } 
    


    // 
    // 
    // ONLINE SAVING PART IS COMPLETE. 
    // 
    // 

    // if the doc's successfully uploaded, we'll have an up to date copy on server, up to date meta in server & catalog
    // if the doc's not uploaded for some reason, 
    // – we were offline 
    // - we started online, but lost connection
    // - upload failed
    // we'll now continue to save the doc offline if necessary. 
    
    
    var docToSave = await getDocFromCatalog(did);
    docToSave = docToSave || {};


    // WE STARTED ONLINE, BUT WE'RE NOT CONNECTED ANYMORE, OR DOC FAILED TO UPLOAD
    // WE'LL SAVE DOC TO OFFLINE AND SYNC IT UP LATER
    // (IF WE STARTED OFFLINE, GOT BACK CONNECTION MID-EDITING, PRESSED SAVE, IT WILL JUST SAVE DOC TO SERVER, AND USER WON'T SEE AN ERROR MESSAGE)

    if (!startedOffline && (!connection || isEmpty(docUpload) || !metaSavedToServer) && !docToSave.offline) {
        if (remainingStorage <= 0) {
            breadcrumb("[SAVE] Failed to save document, out of storage. Will save it offline instead.");
            createPopup("<b>Couldn't save document, because your Cryptee storage is full!</b><br>Your document will be saved to this device's offline storage instead, and uploaded once you have enough free storage available.<button class='bold white' onclick='goToUpgrade();'>switch to a larger plan</button>", "error");
        } else {
            breadcrumb("[SAVE] Failed to save document, no connection. Will save it offline instead.");
            createPopup("<b>Couldn't save document, no internet connection!</b> Seems like you're not connected to the internet. Your document will be saved to this device's offline storage, and uploaded once your connectivity is restored.", "error");
        }

        forceOffline = true;
    }




    
    
    
    // if the document is available offline, or we're forcing an offline save due to a failed upload, we'll save it to offline storage now. 
    // after this point, it shouldn't matter whether if we're in online or offline mode.

    var savedOffline;
    
    // tripwire, this should never happen, and doc should always be in catalog at this point, but just in case.
    if (!isEmpty(docToSave)) {
        
        // the doc is marked as available offline, so we'll need to update the offline copy 
        // or failed to upload doc to server, and now will try to save it to offline storage as a failsafe (so we can sync it up later). 
        if (docToSave.offline || forceOffline) {
        
            // Get the most up to date plaintext tags for the offline document from the doc delta
            // (offline documents store tags in plaintext, and they're encrypted before getting uploaded in sync)
            docToSave.decryptedTags = findDocumentTagsInDeltas(plaintextContents);
            
            // If we saved the doc to server / are online, it means we got a new generation from server, and we'll use that in docGen.
            // If we didn't get a generation from server, we'll use current time for the offline doc's generation.  
            docToSave.generation = docGen || (new Date()).getTime() * 1000;
        
            // encrypt & save the document to offline storage using the offline key
            savedOffline = await saveDocToOfflineCatalog(docToSave, plaintextContents);
            
        }
        
    }



    // IF IT'S AN OFFLINE DOC 
    // OR WE'RE FORCED TO SAVE IT OFFLINE DUE TO A FAILURE
    // AND IF DOC FAILED TO SAVE OFFLINE
    if ((docToSave.offline || forceOffline) && !savedOffline) {
        breadcrumb("[SAVE] Failed to save document offline.");
        stopRightProgress("red");
        showModal('modal-ecd-failsafe');
        docSaving(did, false);
        return false;
    }
    





    
    if (!inBackground) {

        breadcrumb('[SAVE] Preparing "DOCFILE" Panel for ' + did);
        prepareActiveDocumentFilePanel(did, docToSave);
        
        breadcrumb('[SAVE] Preparing "DOCTOOLS" Panel for ' + did);
        prepareActiveDocumentToolsPanel(did, docToSave);
        
        // update size in the info panel using contents
        try { // in case if stringify fails
            var size = bytesize(JSON.stringify(plaintextContents)); 
            $("#panel-docinfo").find(".size").html(formatBytes(size));
        } catch (error) {}
    
        breadcrumb('[SAVE] Generating table of contents for ' + did);
        generateTableOfContents();

        breadcrumb("[SAVE] Saved Document: " + did);
        
    }


    // finally update the progress bar
    if (!inBackground) {
        if (connection) {
            stopRightProgress("green");
        } else {
            stopRightProgress("blue");
        }

        $("#panel-docfile").removeClass("saving");
        $("#dropdown-doc.for-active-doc").removeClass("saving");
    } else {
        $(`#dropdown-doc[did='${did}']`).removeClass("saving");
    }

    // refreshDOM also updates the info panel if necessary.
    await refreshDOM();

    // move document to the top of the recents list, since it's updated now
    $(`#recents > .doc[did="${did}"]`).prependTo("#recents");

    // if the user tried saving again during this save, there will be another save in the queue. 
    // (this will always be the last time user pressed save, since object will be overwritten)
    // if there's another save in the queue, run that, then empty the queue.
    await checkAndRunSaveQueueForDoc(did);

    docSaving(did, false);

    // since it's in the background, we know for sure it can't change anymore.
    if (inBackground) {
        docChanged(did, false);
    }

    return true;
}




////////////////////////////////////////////////
////////////////////////////////////////////////
//	NEW DOC
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Creates a new document, optionally in a folder, optionally with content, optionally with title & optionally with pre-defined doc id 
 * so that it could be used to both create a new doc from UI or upload things like imported evernote notes for example
 * @param {string} [parentFID] optional folder id where the document should be created
 * @param {string} [plaintextTitle] optional name for the document
 * @param {Object} [plaintextDeltas] optional plaintext quill deltas
 * @param {string} [did] optional document id
 * @param {boolean} [inBackground] true = we'll create & upload in the background, false = we'll do it in foreground & load a new doc into the editor 
 */
async function newDoc(parentFID, plaintextTitle, plaintextDeltas, did, inBackground) {
    
    parentFID = parentFID || "f-uncat";
    plaintextDeltas = plaintextDeltas || {};
    plaintextTitle = plaintextTitle || "Untitled Document";
    did = did || "d-" + newUUID() + "-v3";
    inBackground = inBackground || false;


    breadcrumb('[NEW DOC] Importing / Creating new document: ' + did);
    // if we're creating in foreground
    // and if there's something else open, and if it changed, save the active doc first
    // much like preparing to load a new doc in prepareToLoadDoc()
    if (!inBackground && (activeDocID || !$("body").hasClass("no-doc"))) {
        if (docState(activeDocID).changed) {
            breadcrumb('[NEW DOC] There is an active document, saving it in background' + activeDocID);
            saveDoc(activeDocID, true, quill.getContents());
        }
    }


    // make sure plaintextDeltas have at least one insert op
    if (isEmpty(plaintextDeltas)) { 
        plaintextDeltas = { ops: [ {insert: "\n"} ] }; 
    } else {
        var hasAtLeastOneInsert;
        for (var op of plaintextDeltas.ops) { if (op.insert) { hasAtLeastOneInsert = true; break; } }
        if (!hasAtLeastOneInsert) { plaintextDeltas = { ops: [ {insert: "\n"} ] }; }
    }

    // make sure plaintextDeltas have the starter document meta defaults.
    plaintextDeltas = addDocumentMetadataToDelta(plaintextDeltas, true);
    
    var docUpload = {};
    var docGen, metaSavedToServer, metaSavedToCatalog;

    // THEN CHECK IF WE'RE CONNECTED.
    var connection = await checkConnection(); 
    activityHappened();


    // IF THIS IS A BACKGROUND UPLOAD, (I.E. AN EVERNOTE IMPORT) AND WE'RE NOT CONNECTED,
    // SHORT CIRCUIT HERE. BECAUSE WE'LL NEED INTERNET FOR IMPORTS / BACKGROUND NEW DOC CREATIONS
    // OTHERWISE WE CAN BLOW UP INDEXEDDB / OFFLINE STORAGE WITH 50MB EVERNOTE IMPORTS IN MERE SECONDS
    if (inBackground && !connection) {
        handleError("[NEW DOC] Can't import / create new doc without connection.", {did:did});
        createPopup("<b>Failed to import / create new document!</b> Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        return false;
    }
    



    //
    //
    // ENCRYPT TITLE
    //
    //
    
    var encryptedTitle;
    var encryptedStringifiedTitle;

    try {
        encryptedTitle = await encrypt(JSON.stringify(plaintextTitle), [theKey]);
        encryptedStringifiedTitle = JSON.stringify(encryptedTitle);
    } catch (error) {
        encryptedStringifiedTitle = "";
        handleError("[NEW DOC] Failed to encrypt title. Will instead pass blank.", error);
    }
    
    activityHappened();




    // 
    //
    // ENCRYPT TAGS
    //
    //

    var docToSave;
    var docTags = await findAndEncryptDocumentTags(did, plaintextDeltas);
    var encryptedTags = docTags.tags;
    var decryptedTags = docTags.decryptedTags;





    //
    //
    // IF IT'S A NEW DOC CREATION IN FOREGROUND
    // 
    //

    if (!inBackground) {
    
        // USER PRESSED " NEW DOC "
        // TO SAVE USER TIME, WE'LL WANT TO THE EDITOR FOR THE NEW DOC TO SHOW UP RIGHT AWAY. 
        
        // QUICKLY, CREATE A DOC IN THE CATALOG
        // IT DOESN'T HAVE TO EXIST IN SERVER JUST YET
        // NOR DOES IT NEED TO BE UPLOADED JUST YET. 
        
        // it'll be saved right away after this step, like a regular doc.
        // online, if we're online, and offline if we're offline.

        breadcrumb('[NEW DOC] Creating new document in local catalog');
        docToSave = {
            docid: did,
            fid : parentFID,
            generation : (new Date()).getTime() * 1000,
            tags : encryptedTags,
            title : encryptedTitle.data,
            decryptedTags : decryptedTags, // for local catalog, to save a decryption cycle, we save the decrypted tags too
            decryptedTitle : plaintextTitle, // for local catalog, to save a decryption cycle, we save the decrypted title too
        };
        
        metaSavedToCatalog = await newDocInCatalog(docToSave);
        if (!metaSavedToCatalog) {
            handleError("[NEW DOC] Failed to set/create doc meta.", {did:did});
            createPopup("<b>Failed to create new document!</b> Chances are your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your browser configuration, try again and reach out to our support via our helpdesk if this issue continues.", "error");
            return false;
        }

        // WARNING //
        //
        // HERE'S AN EDGE CASE SCENARIO. 
        //
        // When you create a new doc, and save it to local catalog, since it doesn't exist on server yet
        // IF the user loads the doc's folder, we'll call getFolder = and get its docs from server
        // Since this doc doesn't exist on server yet, it'll appear as if it's deleted from server, 
        // And sync will delete it from device & close doc. 
        // 
        // To prevent this from happening, we can do a few things:
        // 1) wait until doc meta's saved to server before showing editor = too slow.  
        // 2) prevent user from loading folder until the doc meta is saved to server (would be weird)
        // 3) make new document available offline, this way sync() won't delete it when folder's loaded. 
        //    instead, if user loads folder, new doc will upsync.
        //    once document's saved to server, we remove it from offline storage IF we're connected.


        // DONE, DOC CREATED. SO LET'S NOW PREPARE THE EDITOR. 
        // THIS PART IS ( & SHOULD BE ) THE SAME AS POST-LOAD OPERATIONS
        // true = force saves the document offline.

        await loadedDocPrepareEditor(docToSave, did, plaintextDeltas, connection, true);

        // new docs are always LTR unless user changes it. for now.
        quill.format('direction', 'ltr');
        quill.format('align', 'left');

        quill.focus();

        //
        // Now that the editor is emptied, user can start typing etc,
        // in the meantime, we save the rest of the meta to the server if we're connected
        //

        if (connection) {
            breadcrumb('[NEW DOC] Saving new doc meta to server');
            metaSavedToServer = await setDocMeta(did, {
                docid: did, 
                fid : parentFID,
                generation : docGen, 
                tags : encryptedTags,
                title : encryptedStringifiedTitle
            });
            
            if (!metaSavedToServer) {
                handleError("[NEW DOC] Failed to set new doc's meta.", {did:did});
                createPopup("<b>Failed to create new document!</b> Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
            } else {
                // doc's meta saved to server successfully, we can remove it from offline catalog safely now. 
                // edge case averted. if user's connection is spotty / goes offline again right here, the upcoming saveDoc below will save it offline again if necessary.
                breadcrumb('[NEW DOC] Saved new doc meta to server, will delete the offline failsafe now.');
                await removeDocFromOfflineCatalog(did);
            }
        }

        // 
        // if we're not connected, saveDoc will move forward with an offline save –
        // so doc will be created / saved offline now. 
        // and meta will be uploaded to server on the next sync
        // 

        // loadedDocPrepareEditor sets this to false, since it changes editor contents. we'll have to set it to true to force a save
        docChanged(did, true);

        await saveDoc();

        return true;

    }




    //
    //
    //
    // FOREGROUND NEW DOC CREATION IS COMPLETE HERE. 
    // FROM HERE ON, IT'S ALL BACKGROUND CREATION (I.E. EVERNOTE IMPORTS ETC) 
    //
    //
    //



    // IT QUALIFIES AS A SAVE, LET'S GET STARTED 
    docSaving(did, true);


    // SINCE THE CONTENTS COME EITHER FROM plaintextDeltas OR GENERATED AS A NEW DOC
    // WE CAN SET THIS TO DOC CHANGED = FALSE NOW. 
    // IF A SAVE'S TRIGGERED AGAIN (which it could if it's a new doc from UI due to timer)
    // IT'LL BE IGNORED, UNLESS THERE WAS A CHANGE AS WELL
    docChanged(did, false);



    // IF WE'RE CONNECTED, ENCRYPT & UPLOAD THE DOCUMENT TO SERVER
    if (connection) {
        docUpload = await encryptAndUploadDocument(did, plaintextDeltas, true);
        activityHappened();
    }
    

    // IF WE'RE CONNECTED, AND DOC SUCCESSFULLY UPLOADED TO SERVER
    // SAVE DOC META TO SERVER & CATALOG

    if (connection && !isEmpty(docUpload)) { 

        enableWakeLock();

        docGen = parseInt(docUpload.generation);

        metaSavedToServer = await setDocMeta(did, {
            docid: did, 
            fid : parentFID,
            generation : docGen, 
            tags : encryptedTags,
            title : encryptedStringifiedTitle
        });

        metaSavedToCatalog = await newDocInCatalog({
            docid: did,
            fid : parentFID,
            generation : docGen,
            tags : encryptedTags,
            title : encryptedTitle.data,
            decryptedTags : decryptedTags, // for local catalog, to save a decryption cycle, we save the decrypted tags too
            decryptedTitle : plaintextTitle, // for local catalog, to save a decryption cycle, we save the decrypted title too
        });

        // release wake lock to let device sleep
        disableWakeLock();
        activityHappened();

    }

    if (!metaSavedToServer || !metaSavedToCatalog || !connection || isEmpty(docUpload)) {
        handleError("[NEW DOC] Failed to create/import doc.", {did:did});
        createPopup("<b>Failed to create/import document!</b> Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        return false;
    }


    // 
    // 
    // ONLINE SAVING PART IS COMPLETE. 
    // 
    // 


    // if the doc's successfully uploaded, we'll have an up to date copy on server, up to date meta in server & catalog
    // if the doc's not uploaded for some reason, 
    // – we were offline 
    // - we started online, but lost connection
    // - upload failed
   
    breadcrumb("[NEW DOC] Created new document: " + did);
    
    // refreshDOM also updates the info panel if necessary.
    await refreshDOM();
    
    docSaving(did, false);
    docChanged(did, false);
    
    return true;

}










/**
 * Gets active document's tags and returns an array of plaintext tags
 * @param {*} plaintextContents contents you get from quill.getContents()
 * @returns {Array>} docTags
 */
function findDocumentTagsInDeltas(plaintextContents) {

    var tags = [];
    
    try {
        plaintextContents.ops.forEach(function(op) {
            if (!op.attributes) { return; }
            if (!op.attributes.tag) { return; }
            tags.push(op.insert);
        });
    } catch (e) {}

    return tags;

}





/**
 * Gets active document's tags and returns an object with encrypted and plaintext tags
 * @param {string} did document id
 * @param {*} plaintextContents contents you get from quill.getContents()
 * @returns {Promise<Object>} docTags
 * @returns {Promise<Object>} docTags.tags Encrypted Document Tags
 * @returns {Promise<Object>} docTags.decryptedTags Plaintext Document Tags
 */
async function findAndEncryptDocumentTags(did, plaintextContents) {

    breadcrumb('[SAVE] Checking tags of document: ' + did);
    
    var tags = findDocumentTagsInDeltas(plaintextContents) || [];

    if (tags.length === 0) {
        return { tags : "[]", decryptedTags : [] };
    }
    
    breadcrumb('[SAVE] Encrypting tags of document: ' + did);

    var plaintextStringifiedTags;
    try {
        plaintextStringifiedTags = JSON.stringify(tags);
    } catch (error) {
        handleError("[ENCRYPT TAGS] Failed to stringify document tags", error);
        return { tags : "[]", decryptedTags : tags };
    }

    var encryptedStringifiedTags;
    try {
        var encryptedTags = await encrypt(plaintextStringifiedTags, [theKey]);
        encryptedStringifiedTags = JSON.stringify(encryptedTags);
    } catch (error) {
        handleError("[ENCRYPT TAGS] Failed to encrypt document tags", error);
        return { tags : "[]", decryptedTags : tags };
    }

    return { tags : encryptedStringifiedTags, decryptedTags : tags };

}





/**
 * Encrypts and uploads a document (for using in save / sync etc)
 * @param {string} did document ID
 * @param {*} plaintextContents contents you get from quill.getContents()
 * @param {boolean} [inBackground] saving in background, so don't update progress bar.
 */
async function encryptAndUploadDocument(did, plaintextContents, inBackground) {

    inBackground = inBackground || false;

    if (!inBackground) { updateRightProgress(0, 100, "yellow"); }
    if (inBackground) { addSaveToUploadsPanel(did); }

    // request wake lock to keep device awake
    enableWakeLock();

    breadcrumb('[SAVE] Encrypting document: ' + did);
    
    var encryptedStringifiedContents;
    try {
        var stringifiedPlaintextContents = JSON.stringify(plaintextContents);
        var encryptedContents = await encrypt(stringifiedPlaintextContents, [theKey]);
        encryptedStringifiedContents = JSON.stringify(encryptedContents);
    } catch (error) {
        error.did = did;
        handleError("[SAVE] Failed to encrypt document", error);
        return false;
    }

    breadcrumb('[SAVE] Uploading document: ' + did);

    var docUpload;

    try {
        docUpload = await uploadFile(encryptedStringifiedContents, did + ".crypteedoc", inBackground);
    } catch (error) {
        handleError("[SAVE] Failed to upload document.", error);
        createPopup("<b>Failed to save document!</b> Chances are this is a network problem. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        return false;
    }
    
    if (docUpload === "exceeded") {
        handleError("[SAVE] Failed to upload document.");
        return false;
    }

    if (!docUpload || isEmpty(docUpload)) {
        handleError("[SAVE] Failed to upload document.");
        createPopup("<b>Failed to save document!</b> Chances are this is a network problem. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        return false;
    }

    removeSaveFromUploadsPanel(did);

    // release wake lock to let device sleep
    disableWakeLock();

    return docUpload;

}




/**
 * Adds a save operation into the uploads panel (to continue saving in background)
 * @param {string} did Document ID
 */
async function addSaveToUploadsPanel(did) {
    
    if ($("#upload-" +did).length) { return; }

    var dname = await getDocNameFromCatalog(did);
    var uploadCard = renderUpload(did, dname);
    $("#panel-uploads").append(uploadCard);

}


/**
 * Removes a save from the uploads panel (once the background upload is complete)
 * @param {string} did Document ID
 */
function removeSaveFromUploadsPanel(did) {
    $("#upload-" + did).remove();
}




////////////////////////////////////////////////
////////////////////////////////////////////////
//	NEW DOC UI
////////////////////////////////////////////////
////////////////////////////////////////////////



/**
 * User confirmed creating a new doc
 */
async function confirmNewDoc() {
    var title = $("#new-doc-input").val().trim();
    if (!title){
        $("#new-doc-input").trigger("focus");
        return;
    }

    var targetFID = activeFolderID || "f-uncat";

    $("#confirmNewDocButton").addClass("loading");
    $("#newDocButton").addClass("loading");
    $("#new-doc-input").trigger("blur");
    hidePanels();

    // if the target folder is inbox, make sure it exists.
    if (targetFID === "f-uncat") {   
        var inboxFolder = await getFolderFromCatalog("f-uncat");
        if (isEmpty(inboxFolder)) {
            await newFolder("","Inbox","f-uncat");
        }
    }

    await newDoc(targetFID,title);

    $("#confirmNewDocButton").removeClass("loading");
    $("#newDocButton").removeClass("loading");
    $("#new-doc-input").val("");

    quill.focus();

    return true;
}