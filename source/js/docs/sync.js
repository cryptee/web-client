////////////////////////////////////////////////
////////////////////////////////////////////////
//	SYNC
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Syncs docs in catalog to docs in server, uploads / downloads outdated stuff in offline storage
 */
async function sync() {
    breadcrumb('[SYNC] Starting sync...');

    var docsToUpsync = [];
    var docsToDownsync = [];
    var docs;
    try {
        docs = await getAllDocsFromCatalog();
    } catch (error) {
        handleError("[SYNC] Couldn't get documents from catalog to start the sync", error);
        createPopup("Failed to sync. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        return false;
    }

    // NOTHING TO SYNC, DONE
    if (isEmpty(docs)) {
        breadcrumb('[SYNC] Nothing to sync, catalog is empty. Done.');
        return true;
    }

    for (var did in docs) {
        var doc = docs[did];

        if (doc.isfile) { continue; }
        if (!doc.generation) {

            // for backwards compatibility. 
            // v1 & v2 users who had a home doc, but never used it have a home doc with generation = 0.
            // there's no need to throw an error for this, since it just means they never used their home doc. 
            if (did === "d-home" && doc.generation === 0) { continue; }

            handleError("[SYNC] Caught a doc without generation", {did:did});
            
            continue;
        }

        // there's an offline version, and it is newer than the online one. Add it to upsync to re-encrypt & upload it
        if (doc.offline && ((doc.offline || 0) > doc.generation)) { docsToUpsync.push(doc); }

        // there's an offline version, and it is outdated. Add it to downsync to download & re-encrypt & store it
        if (doc.offline && (doc.offline < doc.generation)) { docsToDownsync.push(doc); }
    }

    if (!docsToDownsync.length && !docsToUpsync.length) {
        breadcrumb('[SYNC] Nothing to sync. Done.');
        return true;
    }

    breadcrumb(`[SYNC] Will upsync ${docsToUpsync.length}, and downsync ${docsToDownsync.length} documents.`);

    var upsyncCompleted = true;
    var downsyncCompleted = true;

    if (docsToUpsync.length > 0) {
        upsyncCompleted = await syncUP(docsToUpsync);
    }

    if (docsToDownsync.length > 0) {
        downsyncCompleted = await syncDOWN(docsToDownsync);
    }

    if (!upsyncCompleted || !downsyncCompleted) {
        handleError("[SYNC] Failed to sync.");
        createPopup("Failed to sync your documents. Chances are this is a network problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        return false;
    }
    
    breadcrumb(`[SYNC] Done! upsync'ed ${docsToUpsync.length}, and downsync'ed ${docsToDownsync.length} documents.`);

    return true;
}


/**
 * Re-Encrypts & Uploads (up-syncs) offline docs to server 
 * @param {Array} docsToUpsync Array of documents to upsync
 */
async function syncUP(docsToUpsync) {
    var failedToUpsync = []; 

    // re-encrypt & upload offline doc, and update doc meta on server & catalog.docs
    for (var doc of docsToUpsync) {
        var did = doc.docid;
        var plaintextOfflineContents = await loadDocFromOfflineCatalog(did);
        var docUpload = await encryptAndUploadDocument(did, plaintextOfflineContents, true);
        
        var metaSavedToServer, metaSavedToCatalog;
        
        // upload successful, update meta on server & catalog 
        if (!isEmpty(docUpload)) {
            
            var docGen = parseInt(docUpload.generation);
            var docSize = parseInt(docUpload.size);
            var docTags = await findAndEncryptDocumentTags(did, plaintextOfflineContents);
            var encryptedTags = docTags.tags;
            var decryptedTags = docTags.decryptedTags;        

            var docToUpload = { 
                size : docSize,
                generation : docGen, 
                tags : encryptedTags 
            };
            
            // if user created an offline doc, while offline, this means we also have to upload the titles of the doc. 
            // offline-created docs' titles are also saved to regular catalog, because why not.
            // so upsync also encrypts & uploads titles

            var encryptedStringifiedTitle;

            if (doc.decryptedTitle) {
                try {
                    var encryptedTitle = await encrypt(JSON.stringify(doc.decryptedTitle), [theKey]);
                    encryptedStringifiedTitle = JSON.stringify(encryptedTitle);
                } catch (error) {
                    handleError("[SYNC] Failed to encrypt title during upsync.", error);
                }
            }

            // add the encrypted & stringified title to doc meta upload
            if (encryptedStringifiedTitle) { docToUpload.title = encryptedStringifiedTitle; }

            // upload meta
            metaSavedToServer = await setDocMeta(did, docToUpload);

            // update catalog
            metaSavedToCatalog = await setDocMetaInCatalog(did, {
                size : docSize,
                offline : docGen,
                generation : docGen,
                tags : encryptedTags,
                decryptedTags : decryptedTags
            });

        }

        if (isEmpty(docUpload) || !metaSavedToServer || !metaSavedToCatalog) {
            failedToUpsync.push(doc);
        }
    
    }

    if (failedToUpsync.length >= 1) {
        breadcrumb(`[SYNC] Failed to upsync ${failedToUpsync.length} documents.`);
        return false;
    }

    return true;
}




/**
 * Downloads, Decrypts & Re-Encrypts documents to update offline storage
 * @param {Array} docsToDownsync Array of documents to downSync
 */
async function syncDOWN(docsToDownsync) {
    
    var failedToDownsync = [];
    
    // download online doc, decrypt, re-encrypt, and update catalog.offline
    for (var doc of docsToDownsync) {
        var madeOffline; 
        
        var plaintextDocContents = await downloadAndDecryptFile(doc.docid, null, "crypteedoc", docName(doc), null, null, doc, true);
        
        if (!isEmpty(plaintextDocContents)) {
            madeOffline = await saveDocToOfflineCatalog(doc, plaintextDocContents);
        }

        if (isEmpty(plaintextDocContents) || !madeOffline) {
            failedToDownsync.push(doc);
        }
    }

    if (failedToDownsync.length >= 1) {
        breadcrumb(`[SYNC] Failed to downsync ${failedToDownsync.length} documents.`);
        return false;
    }

    return true;
}
