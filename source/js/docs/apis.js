////////////////////////////////////////////////
////////////////////////////////////////////////
//	ALL API OPERATIONS
////////////////////////////////////////////////
////////////////////////////////////////////////

////////////////////////////////////////////////
////////////////////////////////////////////////
//	GETTERS
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Gets all folders' meta, all folders' titles, all docs' & files' meta, and recent docs' titles (default 3 months)
 */
async function getRecentDocsAndFolders() {

    var recentMonths = 3;
    breadcrumb("[RECENTS] Getting Recent Docs & Folders");
    var startedRequest = (new Date()).getTime();

    var rafResponse;
    try {
        rafResponse = await api("docs-raf", {m:recentMonths});
    } catch (error) {
        err("Couldn't get recent docs & folders due to error", error);
        return false;
    }

    if (!rafResponse) {  
        err("Didn't get recent docs & folders response");
        return false;
    }

    var gotResponse = (new Date()).getTime();
    breadcrumb("[RECENTS] Got Recent Docs & Folders in " + (gotResponse - startedRequest) + "ms.");

    rafResponse.data.docs = rafResponse.data.docs || [];
    rafResponse.data.folders = rafResponse.data.folders || [];

    await updateCatalogWithChanges(rafResponse.data.docs, rafResponse.data.folders);

    gotRecents = true; // for startup process

    return rafResponse.data;

    function err(msg, error) {
        handleError(msg, error);
    }
}



/**
 * Gets all docs, files and sub-folders of a folder. 
 * @param {string} fid Folder ID
 */
async function getFolder(fid) {
    if (!fid) {
        handleError("[DOCS] Can't get contents of folder. No FolderID!");
        return false;
    }

    breadcrumb("[DOCS] Getting contents of folder " + fid);
    var startedRequest = (new Date()).getTime();

    var folderResponse;
    try {
        folderResponse = await api("docs-folder", {f:fid});
    } catch (error) {
        error.fid = fid;
        err("Couldn't get contents of folder due to error", error);
        return false;
    }

    if (!folderResponse) {  
        err("Didn't get contents of folder response", {fid:fid});
        return false;
    }

    var gotResponse = (new Date()).getTime();
    breadcrumb("[DOCS] Got contents of folder in " + (gotResponse - startedRequest) + "ms.");

    folderResponse.data.docs = folderResponse.data.docs || [];
    folderResponse.data.folders = folderResponse.data.folders || [];

    await updateCatalogWithChanges(folderResponse.data.docs, folderResponse.data.folders, fid);

    return folderResponse.data;

    function err(msg, error) {
        handleError(msg, error);
    }

}



/**
 * Gets all folders
 */
async function getFolders () {

    breadcrumb("[FOLDERS] Getting folders");
    var startedRequest = (new Date()).getTime();
    
    var foldersResponse;
    try {
        foldersResponse = await api("docs-folders");
    } catch (error) {
        err("Couldn't get folders due to error", error);
        return false;
    }

    if (!foldersResponse) {  
        err("Didn't get folders");  
        return false;
    }

    var gotResponse = (new Date()).getTime();
    breadcrumb("[FOLDERS] Got folders in " + (gotResponse - startedRequest) + "ms.");

    return foldersResponse.data;

    function err(msg, error) {
        handleError(msg, error);
    }

}


/**
 * Gets all titles and tags, to be used for search
 */
async function getTitlesAndTags() {

    breadcrumb("[TITLES & TAGS] Getting titles & tags");
    var startedRequest = (new Date()).getTime();
    
    var ttResponse;
    try {
        ttResponse = await api("docs-tt");
    } catch (error) {
        err("Couldn't get titles & tags due to error", error);
        return false;
    }

    if (!ttResponse) {  
        err("Didn't get titles & tags");  
        return false;
    }

    var gotResponse = (new Date()).getTime();
    breadcrumb("[TITLES & TAGS] Got titles and tags in " + (gotResponse - startedRequest) + "ms.");

    var docsTT = ttResponse.data;

    var allDocsFromCatalog = await getAllDocsFromCatalog();

    // catalog is empty || titles response is empty, catalog had no docs, this means user has no docs
    if (isEmpty(allDocsFromCatalog) || (isEmpty(docsTT) && isEmpty(allDocsFromCatalog) && isOnline())) {
        return docsTT;
    }

    // let's create a complete picture here.
    // we got only titles and tags from server
    // but updateCatalogWithChanges expects complete doc objects to replace in catalog
    // so let's put titles & tags we got from server, into docs we've just read from the catalog.

    for (var did in allDocsFromCatalog) {
        if (docsTT[did]) {
            if (docsTT[did].title) { 
                allDocsFromCatalog[did].title = docsTT[did].title; 
            }
            
            if (docsTT[did].tags) { 
                allDocsFromCatalog[did].tags = docsTT[did].tags; 
            }
        }
    }

    // now let's pass this object as array to updateCatalogWithChanges
    // it'll find all docs that don't have titles in catalog, 
    // and update them with titles from this response. 

    await updateCatalogWithChanges(Object.values(allDocsFromCatalog), []);

    return ttResponse.data;

    function err(msg, error) {
        handleError(msg, error);
    }

}



/**
 * Downloads, decrypts and returns a document or file, either as blob (if it's a v3 file), or as b64 (v1,v2,v3 docs)
 * @param {Object} doc Document or File Object from catalog
 * @param {boolean} [inBackground] optionally download & decrypt in background (i.e. files etc) this will not show body progress 
 * @returns {*} decrypted doc or file 
 */
async function downloadDocumentOrFile(doc, inBackground) {
    
    if (isEmpty(doc)) {
        handleError("[DOCS] Can't download file. No doc found in catalog!");
        return false;
    }

    var did = doc.docid;

    if (!did) {
        handleError("[DOCS] Can't download file. No DID!");
        return false;
    }

    var filename = did; // downloadFile automatically adds .crypteefile if there's no extension
    if (!doc.isfile) { filename = did + ".crypteedoc"; }

    var encryptedContents = await downloadFile(filename);
    if (!encryptedContents) {
        handleError("[DOCS] Failed to download file. Didn't get any contents!", { filename : filename });
        return false;
    }

    if (!inBackground) {
        startRightProgress("decrypting...");
    }

    var decryptedContents;
    try {
        if (doc.isfile && did.endsWith("-v3")) {
            // it's a v3 file upload which is binary
            decryptedContents = await decryptToBinary(encryptedContents, [theKey]);
        } else {
            // it's a V1 & v2 upload, or a V3 doc upload which are b64 (docs etc.)
            decryptedContents = await decrypt(encryptedContents, [theKey]);
        }
    } catch (error) {
        handleError("[DOCS] Failed to decrypt doc/file.", { filename : filename });
        return false;
    }

    if (doc.isfile && did.endsWith("-v3")) {
        // it's a v3 file upload, we have the Uint8Array file in :
        // decryptedContents.data
        // and its mimetype in doc.mime;

        return decryptedContents.data;
    } else {
        // it's a V1 & v2 file upload, which are b64, so now we have the B64 in decryptedContents.data;
        // it's a V1,V2,V3 doc upload = Stringified quill.getContents ... requires JSON.parsing.
        var parsedDecryptedDocument;
        try {
            parsedDecryptedDocument = JSON.parse(decryptedContents.data);
        } catch (error) {
            parsedDecryptedDocument = decryptedContents.data;
        }

        if (!parsedDecryptedDocument) {
            handleError("[DOCS] Failed to parse document.", { filename : filename });
            return false;
        }

        return parsedDecryptedDocument;

    }

}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	SETTERS
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Sets document meta
 * @param {string} did Document ID
 * @param {Object} meta Meta information to set to document
 */
async function setDocMeta(did, meta) {
    if (!did) {
        handleError("[DOC META] Can't set doc meta. No DID!");
        return false;
    }

    if (isEmpty(meta)) {
        handleError("[DOC META] Can't set doc meta. No Meta!");
        return false;
    }

    // server always takes generation as string, returns it as number for backwards compat 
    if (meta.generation) { meta.generation = meta.generation.toString(); }

    breadcrumb("[DOC META] Setting doc meta " + did);
    var startedRequest = (new Date()).getTime();

    var response;
    try {
        response = await api("docs-docmeta", {d:did}, meta);
    } catch (error) {
        error.did = did;
        err("Couldn't set doc meta due to error", error);
        return false;
    }

    if (!response) {  
        err("Didn't get set doc meta response", {did:did});
        return false;
    }

    if (response.status !== 200) {
        response.did = did;
        err("Couldn't set doc meta, response code: " + response.status);
        return false;
    }

    var gotResponse = (new Date()).getTime();
    breadcrumb("[DOC META] Set doc ("+did+") meta in " + (gotResponse - startedRequest) + "ms");

    return true;

    function err(msg, error) {
        handleError(msg, error);
    }

}


/**
 * Sets folder meta
 * @param {string} fid FolderID
 * @param {Object} meta Meta information to set to folder
 */
async function setFolderMeta(fid, meta) {
    if (!fid) {
        handleError("[FOLDER META] Can't set folder meta. No FolderID!");
        return false;
    }

    if (isEmpty(meta)) {
        handleError("[FOLDER META] Can't set folder meta. No Meta!");
        return false;
    }

    breadcrumb("[FOLDER META] Setting folder meta " + fid);
    var startedRequest = (new Date()).getTime();

    var response;
    try {
        response = await api("docs-foldermeta", {f:fid}, meta);
    } catch (error) {
        error.fid = fid;
        err("Couldn't set folder meta due to error", error);
        return false;
    }

    if (!response) {  
        err("Didn't get set folder meta response", {fid:fid});
        return false;
    }

    if (response.status !== 200) {
        response.fid = fid;
        err("Couldn't set folder meta, response code: " + response.status);
        return false;
    }

    var gotResponse = (new Date()).getTime();
    breadcrumb("[FOLDER META] Set folder ("+fid+") meta in " + (gotResponse - startedRequest) + "ms");

    return true;

    function err(msg, error) {
        handleError(msg, error);
    }
}





/**
 * Makes a server-assisted copy of a document, and returns the copy document
 * @param {string} did DocumentID
 * @param {string} copyTitle encrypted title of the copied document's title
 */
async function makeDocumentCopy(did, copyTitle) {

    if (!did) {
        handleError("[COPY DOC] Can't copy. No DID!");
        return false;
    }

    if (!copyTitle) {
        handleError("[COPY DOC] Can't copy. No Title!");
        return false;
    }

    breadcrumb("[COPY DOC] Copying doc " + did);
    var startedRequest = (new Date()).getTime();

    var response;
    try {
        response = await api("docs-copy", {d:did}, copyTitle);
    } catch (error) {
        error.did = did;
        err("Couldn't copy doc due to error", error);
        return false;
    }

    if (!response) {
        err("Didn't get set doc meta response", {did:did});
        return false;
    }

    if (response.status !== 200) {
        response.did = did;
        err("Couldn't copy doc, response code: " + response.status);
        return false;
    }

    var gotResponse = (new Date()).getTime();
    breadcrumb("[COPY DOC] Copied doc ("+did+") in " + (gotResponse - startedRequest) + "ms");

    return response.data;

    function err(msg, error) {
        handleError(msg, error);
    }

}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	MOVERS
////////////////////////////////////////////////
////////////////////////////////////////////////


/**
 * Takes an array of document IDs, and moves them to the target folder, by setting their meta to the correct folder id in bulk on the server.
 * @param {Array} arrayOfDIDs Array of Document IDs to move
 * @param {string} targetFID Target Folder's ID
 */
async function moveDocs(arrayOfDIDs, targetFID) {
    
    if (!Array.isArray(arrayOfDIDs) || arrayOfDIDs.length === 0) {
        handleError("[MOVE DOCS] Can't move docs. No docs!");
        return false;
    }

    if (!targetFID) {
        handleError("[MOVE DOCS] Can't move docs. No target FID!");
        return false;
    }

    breadcrumb('[MOVE DOCS] Starting to move');
    var startedRequest = (new Date()).getTime();

    var response;
    try {
        response = await api("docs-move", {f:targetFID}, arrayOfDIDs, "POST", 120);
    } catch (error) {
        error.to   = targetFID;
        error.docs = arrayOfDIDs;
        err("Couldn't move docs due to error", error);
        return false;
    }

    if (!response) {  
        err("Didn't get move docs response", {to:targetFID, docs:arrayOfDIDs});
        return false;
    }
    
    if (response.status !== 200) {
        response.to   = targetFID;
        response.docs = arrayOfDIDs;
        err("Couldn't move docs, response code: " + response.status);
        return false;
    }

    var gotResponse = (new Date()).getTime();
    breadcrumb("[MOVE DOCS] Moved " + arrayOfDIDs.length + " docs(s) in " + (gotResponse - startedRequest) + "ms");

    return true;

    function err(msg, error) {
        handleError(msg, error);
    }

}


/**
 * Move a folder to a new parent, by setting its meta to the new parent in server
 * @param {string} fidToMove FolderID of folder we'll move
 * @param {string} targetFID FolderID of the destination we'll move the folder to
 */
async function moveFolder(fidToMove, targetFID) {
    
    if (!fidToMove) {
        handleError("[MOVE FOLDER] Can't move folder. No FolderID!");
        return false;
    }

    if (fidToMove === targetFID) {
        handleError("[MOVE FOLDER] Can't move folder onto itself.");
        return false;
    }

    breadcrumb("[MOVE FOLDER] Moving " + fidToMove + " to " + targetFID);

    var moved = await setFolderMeta(fidToMove, { parent : targetFID });

    if (!moved) {
        return false;
    } else {
        return true;
    }

}

////////////////////////////////////////////////
////////////////////////////////////////////////
//	DELETERS
////////////////////////////////////////////////
////////////////////////////////////////////////


/**
 * Takes an array of Document IDs, and deletes them in bulk on the server side. 
 * @param {Array} arrayOfDIDsToDelete Array of Document IDs to delete
 */
async function deleteDocs(arrayOfDIDsToDelete) {
    if (!Array.isArray(arrayOfDIDsToDelete) || arrayOfDIDsToDelete.length === 0) {
        handleError("[DELETE DOCS] Can't delete docs. No docs!");
        return false;
    }

    breadcrumb('[DELETE DOCS] Starting deletion');
    var startedRequest = (new Date()).getTime();

    var response;
    try {
        response = await api("docs-delete", {}, arrayOfDIDsToDelete, "DELETE", 120);
    } catch (error) {
        error.docs = arrayOfDIDsToDelete;
        err("Couldn't delete docs due to error", error);
        return false;
    }

    if (!response) {  
        err("Didn't get delete docs response", {docs:arrayOfDIDsToDelete});
        return false;
    }

    if (response.status !== 200) {
        response.docs = arrayOfDIDsToDelete;
        err("Couldn't delete docs, response code: " + response.status);
        return false;
    }

    var gotResponse = (new Date()).getTime();
    breadcrumb("[DELETE DOCS] Deleted " + arrayOfDIDsToDelete.length + " docs(s) in " + (gotResponse - startedRequest) + "ms");

    getUpdatedRemainingStorage();

    return true;

    function err(msg, error) {
        handleError(msg, error);
    }

}


/**
 * Deletes a folder, and all its sub folders, and all documents & files on the server in bulk, 
 * @param {string} fidToDelete Folder ID to delete
 */
async function deleteFolder(fidToDelete) {
    if (!fidToDelete) {
        handleError("[DELETE FOLDER] Can't delete folder. No FolderID!");
        return false;
    }

    breadcrumb('[DELETE FOLDER] Starting deletion');
    var startedRequest = (new Date()).getTime();

    var response;
    try {
        response = await api("docs-delete", {f:fidToDelete}, [], "DELETE", 120);
    } catch (error) {
        error.fid = fidToDelete;
        err("Couldn't delete folder due to error", error);
        return false;
    }

    if (!response) {  
        err("Didn't get delete folder response", {f:fidToDelete});
        return false;
    }

    if (response.status !== 200) {
        response.fid = fidToDelete;
        err("Couldn't delete folder, response code: " + response.status);
        return false;
    }

    var gotResponse = (new Date()).getTime();
    breadcrumb("[DELETE FOLDER] Deleted folder in " + (gotResponse - startedRequest) + "ms");

    getUpdatedRemainingStorage();
    
    return true;

    function err(msg, error) {
        handleError(msg, error);
    }
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	GHOSTERS
////////////////////////////////////////////////
////////////////////////////////////////////////


async function setGhostFolder(fid, hashedTitleToGhost) {

    if (!hashedTitleToGhost) { 
        handleError("[GHOST FOLDER] Can't ghost folder without a title.");
        return false;
    }

    var apiResponse; 

    try {
        apiResponse = await api("docs-ghost", { f:fid }, { hash : hashedTitleToGhost }, "POST");
    } catch (error) {
        handleError("[GHOST FOLDER] API had an error.", error);
        return false;
    }

    if (!apiResponse) {
        handleError("[GHOST FOLDER] Didn't get a response from the API.");
        return false;
    }

    if (apiResponse.status !== 200) {
        handleError("[GHOST FOLDER] API had an error: " + apiResponse.status);
        return false;
    }

    return true;

}



async function getSummonFolder(hashedTitleToSummon) {

    if (!hashedTitleToSummon) { 
        handleError("[SUMMON FOLDER] Can't summon folder without a title.");
        return false;
    }

    var apiResponse;

    try {
        apiResponse = await api("docs-summon", {}, { hash : hashedTitleToSummon }, "POST");
    } catch (error) {
        handleError("[SUMMON FOLDER] API had an error.", error);
        return false;
    }

    if (!apiResponse) {
        handleError("[SUMMON FOLDER] Didn't get a response from the API.");
        return false;
    }

    if (apiResponse.status !== 200) {
        handleError("[SUMMON FOLDER] API had an error: " + apiResponse.status);
        return false;
    }

    return apiResponse.data;
    
}