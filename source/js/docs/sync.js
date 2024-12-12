////////////////////////////////////////////////
////////////////////////////////////////////////
//	SYNC
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Syncs docs in catalog to docs in server, uploads / downloads outdated stuff in offline storage
 */
async function sync() {
    breadcrumb('[SYNC] Starting docs sync...');

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
        breadcrumb('[SYNC] No docs to sync, catalog is empty. Done.');
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
        breadcrumb('[SYNC] No docs to sync. Done.');
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
        handleError("[SYNC] Failed to sync docs.");
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

let syncingTemplates = true;
async function syncTemplates() {

    breadcrumb('[SYNC] Syncing / downloading templates meta from server ...');

    let catalogTemplates = await getAllTemplatesFromCatalog();
    let serverTemplates = await getTemplates();
    
    serverTemplates = serverTemplates || [];
    if (!serverTemplates.length) {
        handleError("[SYNC] Failed to get templates from server, aborting!");    
        return false;
    }

    breadcrumb(`[SYNC] Got ${serverTemplates.length} templates from server`);

    let serverTemplateIDs = [];
    let templatesToDownloadAndDecrypt = {};
    let templateIDsToDeleteFromCatalog = [];

    // compare generations of each template to catalog. 
    serverTemplates.forEach(template => {
        let tfid = template.tfid; 
        serverTemplateIDs.push(tfid);
        if (!catalogTemplates[tfid]) { templatesToDownloadAndDecrypt[tfid] = template; }
    });

    // check if server is missing one that we have locally in catalog.
    // this means user deleted template from one device & server, so delete it on other devices too.
    for (const tfid in catalogTemplates) {
        if (!serverTemplateIDs.includes(tfid)) { templateIDsToDeleteFromCatalog.push(tfid); }
    }

    let numTemplatesToDeleteFromCatalog = templateIDsToDeleteFromCatalog.length;
    if (!numTemplatesToDeleteFromCatalog) {
        breadcrumb(`[SYNC] No templates to delete from catalog.`);
    } else {
        breadcrumb(`[SYNC] Will delete ${numTemplatesToDeleteFromCatalog} template(s) from catalog.`);
    }

    await deleteTemplatesFromCatalog(templateIDsToDeleteFromCatalog);

    let numTemplatesToSyncDown = Object.keys(templatesToDownloadAndDecrypt).length;
    if (!numTemplatesToSyncDown) {
        breadcrumb(`[SYNC] No templates to sync.`);
        prepareUserTemplates();
        return;
    } else {
        breadcrumb(`[SYNC] We're missing ${numTemplatesToSyncDown} template(s) in catalog.`);
    }

    // if it doesn't exist in catalog, download, decrypt and add to catalog. 
    for (const tfid in templatesToDownloadAndDecrypt) {
    
        let template = templatesToDownloadAndDecrypt[tfid];
        
        try {
            
            let [plaintextDeltas, thumbBlob] = await Promise.all([
                downloadAndDecryptFile(template.tfid,  template.ttoken, "crypteedoc", null, null, null, template, true),
                downloadAndDecryptFile(template.ttid, template.tttoken, "blob", null, "image/webp", null, null, true)
            ]);

            template.thumb = thumbBlob;
            
            template.deltas = plaintextDeltas;

        } catch (error) {
            error.tfid = template.tfid;
            handleError(`[SYNC] Failed to download & decrypt template`, error);
            continue;
        }

        if (!template.thumb || !template.deltas) {
            handleError(`[SYNC] Failed to download & decrypt template`, {tfid: template.tfid});
            continue;
        }

        try {
            template.title = await decrypt(template.title, [theKey]);
        } catch (error) {
            error.tfid = template.tfid;
            handleError(`[SYNC] Failed to decrypt template title`, error);
            continue;
        }

        if (isEmpty(template.title)) {
            handleError(`[SYNC] Decrypted template title object is empty.`, {tfid: template.tfid});
            continue;
        }

        if (template.title) {
            if (!template.title.data) {
                handleError(`[SYNC] Decrypted template title data is empty.`, {tfid: template.tfid});
                continue;
            }

            template.title = JSON.parse(template.title.data);
        }

        delete template.ttoken;
        delete template.tttoken;

        await newTemplateInCatalog(template);

        breadcrumb(`[SYNC] Successfully sync'ed template ${template.tfid} to catalog`);
        
    }

    syncingTemplates = false;
    prepareUserTemplates();

}