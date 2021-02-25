////////////////////////////////////////////////
////////////////////////////////////////////////
//	ALL CATALOG OPERATIONS
////////////////////////////////////////////////
////////////////////////////////////////////////



//////////////////////////////////////////////////
//////////////////////////////////////////////////
// 	 LOCAL STORAGE & INDEXED DB & OFFLINE STORAGE
//////////////////////////////////////////////////
//////////////////////////////////////////////////

// WE'LL START USING DEXIE INSTEAD OF LOCALFORAGE AS THE MAIN STORAGE DRIVER FOR ALL LOCAL OPERATIONS. 
// INSTEAD OF MAINTAINING AN IN-MEMORY CATALOG & WRITING THE CATALOG TO DEXIE, WE'LL NOW FULLY RELY ON DEXIE

// MAIN ADVANTAGE HERE IS THAT THE CATALOG WILL BE 100% CACHED AND READY. 

// NO MORE LOADING INTO MEMORY ETC. NO MORE OF THAT OLD encrypted indexed catalog BS.
// we work straight from indexeddb / localstorage now. it'll be a few ms slower, but way more reliable.

// this also allows us to have the very last snapshot / cache of the catalog always fully available when the device is offline. 
// so now we can start the whole app offline, but simply say docs are not available (or not in cache etc)

// advantage of this is that we don't have to worry about having a separate offline docs tab in the menu anymore
// we can simply mark online-docs as semi-transparent / unavailable etc. while we're offline, and make them available when online. 


// TREAT CATALOG LIKE THE SERVER, BUT LOCAL. 
// I.E. if you're saving an offlineDoc, write its generation into catalog.offline[doc] but NOT to catalog.docs
// on startup, you'll get the most recent info from the server, and update catalog.docs
// then during sync, you'll compare generations between catalog.offline and catalog.docs
// if something in catalog.docs is oudated, we upload the offline doc to server, get the latest generation from server, save it to both catalog.offline and catalog.docs.
// if something in catalog.offline is outdated, we download the file from the server, write its contents & generation to catalog.offline

var catalog                 = new Dexie("catalog");
// this has docs, folders, offline, errors

var offlineStorage          = new Dexie("offlineStorage");
// this is for backwards compatibility to read the old table 

catalog.version(1).stores({
    docs: 'docid, title, decryptedTitle, tags, decryptedTags, generation, fid',
    offline: 'docid',
    folders:'folderid, parent, title, decryptedTitle'
});





////////////////////////////////////////////////
////////////////////////////////////////////////
//	CATALOG GETTERS / SHORTCUTS
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Gets the doc from catalog
 * @param {string} did Document ID
 */
async function getDocFromCatalog(did) {
    if (!did) {
        handleError("[CATALOG] Can't get doc without an ID");
        return "";
    }

    var doc;

    try {
        doc = await catalog.docs.get(did);
    } catch (error) {
        error.did = did;
        handleError("[CATALOG] Couldn't get doc from catalog", error);
        return false;
    }

    return doc;
}


/**
 * Gets the folder from catalog
 * @param {string} fid FolderID
 */
async function getFolderFromCatalog(fid) {
    if (!fid) {
        handleError("[CATALOG] Can't get folder without an ID");
        return "";
    }
    
    var folder;
    
    try {
        folder = await catalog.folders.get(fid);
    } catch (error) {
        error.fid = fid;
        handleError("[CATALOG] Couldn't get folder from catalog", error);
        return false;
    }

    return folder;

}


/**
 * Gets all folders from catalog as an object
 * @returns {Promise<Object>} foldersObject All folders in an object mapped by ID
 */
async function getAllFoldersFromCatalog() {
    var folders = {};
    var foldersArray = [];

    try {
        foldersArray = await catalog.folders.toArray();
    } catch (error) {
        handleError("[CATALOG] Couldn't get all folders from catalog", error);
        return false;
    }

    foldersArray.forEach(folder => { folders[folder.folderid] = folder; });
    
    return folders;

}


/**
 * Gets all docs from catalog as an object
 * @returns {Promise<Object>} docsObject All docs in an object mapped by ID
 */
async function getAllDocsFromCatalog() {

    var docs = {};
    var docsArray = [];

    try {
        docsArray = await catalog.docs.toArray();
    } catch (error) {
        handleError("[CATALOG] Couldn't get all docs from catalog", error);
        return false;
    }

    docsArray.forEach(doc => { docs[doc.docid] = doc; });
    
    return docs;

}


/**
 * Gets all docs and folders from catalog as an array
 */
async function getAllDocsAndFoldersFromCatalog() {

    var docsArray = [];
    var foldersArray = [];

    try {
        docsArray = await catalog.docs.toArray();
        foldersArray = await catalog.folders.toArray();
    } catch (error) {
        handleError("[CATALOG] Couldn't get all docs or folders from catalog", error);
        return false;
    }

    return docsArray.concat(foldersArray);

}






/**
 * Gets all docs with encrypted titles, that also doesn't have decrypted titles.
 * @returns {Promise<Array>} docsNeedTitlesDecryption
 */
async function getDocsWithEncryptedTitlesFromCatalog() {
    var docsWithEncryptedTitles;
    var docsNeedTitlesDecryption = [];

    try {
        docsWithEncryptedTitles = await catalog.docs.where("title").notEqual("");
        docsNeedTitlesDecryption = await docsWithEncryptedTitles.and((doc)=>{ return !doc.decryptedTitle; }).toArray();
    } catch (error) {
        handleError("[CATALOG] Couldn't get docs that need titles decryption.", error);
    }

    return docsNeedTitlesDecryption;
}


/**
 * Gets all docs with encrypted tags, that also doesn't have decrypted tags.
 * @returns {Promise<Array>} docsNeedTagsDecryption
 */
async function getDocsWithEncryptedTagsFromCatalog() {
    var docsWithEncryptedTags;
    var docsNeedTagsDecryption = [];

    try {
        docsWithEncryptedTags = await catalog.docs.where("tags").notEqual("");
        docsNeedTagsDecryption = await docsWithEncryptedTags.and((doc)=>{ return !doc.decryptedTags; }).toArray();
    } catch (error) {
        handleError("[CATALOG] Couldn't get docs that need tags decryption.", error);
    }

    return docsNeedTagsDecryption;
}


/**
 * Gets all folders with encrypted titles, that also doesn't have decrypted titles.
 * @returns {Promise<Array>} foldersNeedTitlesDecryption
 */
async function getFoldersWithEncryptedTitlesFromCatalog() {
    var foldersWithEncryptedTitles; 
    var foldersNeedTitlesDecryption = [];

    try {
        foldersWithEncryptedTitles = await catalog.folders.where("title").notEqual("");
        foldersNeedTitlesDecryption = await foldersWithEncryptedTitles.and((folder)=>{ return !folder.decryptedTitle; }).toArray();
    } catch (error) {
        handleError("[CATALOG] Couldn't get folders that need titles decryption.", error);
    }

    return foldersNeedTitlesDecryption;
}



/**
 * Gets recent docs from catalog
 * @returns {Promise<Array>} recentDocs
 */
async function getRecentDocsFromCatalog() {
    
    // TODO – v3.1 get recent months from preferences and change the month parameter from 3 to something else
    var recentMonths = 3;
    var milisecondsAgo = recentMonthsAgo(recentMonths);

    var recentDocs = [];
    try {
        recentDocs = await catalog.docs.where("generation").above(milisecondsAgo).toArray();
    } catch (error) {
        handleError("[CATALOG] Couldn't get recent docs", error);
    }

    // backwards compatibility. V1 & V2 users had something called a "home document" (now d-home)
    // it was a special un-deletable document. 
    // it was a dumb idea.
    // v3 treats it like any other doc. 
    // it's a doc without a folder, so it has to show up under recents no matter how old it is.

    var homeDoc;
    try {
        homeDoc = await getDocFromCatalog("d-home");
    } catch (error) {}

    if (!isEmpty(homeDoc)) {
        if (recentDocs.filter(doc => doc.docid === 'd-home').length <= 0) { recentDocs.push(homeDoc); }
    }

    return recentDocs;
}


/**
 * Gets docs of folder with given ID from catalog
 * @param {string} fid folderid
 * @returns {Promise<Array>} docsOfFolder
 */
async function getDocsOfFolderFromCatalog(fid) {
    fid = fid || "";

    var docsOfFolder = [];
    try {
        docsOfFolder = await catalog.docs.where("fid").equals(fid).toArray();
    } catch (error) {
        error.fid = fid;
        handleError("[CATALOG] Couldn't get docs of folder", error);
    }

    return docsOfFolder;
}



/**
 * Gets subfolders of folder with given ID from catalog
 * @param {string} fid folderid
 * @returns {Promise<Array>} subfoldersOfFolder
 */
async function getSubfoldersOfFolderFromCatalog(fid) {
    fid = fid || "";

    var subfoldersOfFolder = [];
    try {
        subfoldersOfFolder = await catalog.folders.where("parent").equals(fid).toArray();
    } catch (error) {
        error.fid = fid;
        handleError("[CATALOG] Couldn't get subfolders of folder", error);
    }

    return subfoldersOfFolder;
}



/**
 * Gets all root folders from catalog.
 * @returns {Promise<Array>} rootFolders
 */
async function getRootFoldersFromCatalog() {

    var rootFolders = [];
    try {
        rootFolders = await catalog.folders.filter((folder)=>{ return !folder.parent; }).toArray();
    } catch (error) {
        handleError("[CATALOG] Couldn't get root folders", error);
    }

    return rootFolders;
}


/**
 * Gets document name from catalog
 * @param {string} did DocumentID
 * @returns {Promise<string>} name
 */
async function getDocNameFromCatalog (did) {
    if (!did) {
        handleError("[CATALOG] Can't get doc name without an ID");
        return "";
    }

    var doc = await getDocFromCatalog(did);
    if (!doc) { 
        return ""; 
    }
    
    return docName(doc);
}



/**
 * Gets foldername from catalog
 * @param {string} fid FolderID
 * @returns {Promise<string>} name
 */
async function getFolderNameFromCatalog(fid) {
    if (!fid) {
        handleError("[CATALOG] Can't get folder name without an ID");
        return "";
    }
        
    var folder = await getFolderFromCatalog(fid);
    if (!folder) { return ""; }

    return folderName(folder);
}





/**
 * Gets parent of folder from catalog
 * @param {string} fid FolderID
 * @returns {Promise<string>} parent FID
 */
async function parentOfFolder(fid) {
    if (!fid) {
        handleError("[CATALOG] Can't get folder parent without an ID");
        return "";
    }
        
    var folder = await getFolderFromCatalog(fid);
    if (!folder) { return ""; }

    return folder.parent || "";
}




/**
 * Gets document generation from catalog
 * @param {string} did DocumentID
 * @returns {Promise<number>} generation
 */
async function getDocGenFromCatalog (did) {
    if (!did) {
        handleError("[CATALOG] Can't get doc gen without an ID");
        return "";
    }

    var doc = await getDocFromCatalog(did);
    if (!doc) { 
        return ""; 
    }
    
    if (!doc.generation) { return 0; }
    return parseInt(doc.generation);
}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	CATALOG SETTERS / SHORTCUTS
////////////////////////////////////////////////
////////////////////////////////////////////////

 /**
  * Updates document meta in catalog. (note that this can't create a doc. use newDocInCatalog for that)
  * @param {string} did DocumentID
  * @param {Object} meta Document Meta
  */
async function setDocMetaInCatalog(did, meta) {
    
    if (!did) {
        handleError("[CATALOG] Can't set doc meta. No DID!");
        return false;
    }

    if (isEmpty(meta)) {
        handleError("[CATALOG] Can't set doc meta. No Meta!");
        return false;
    }

    breadcrumb("[CATALOG] Setting doc meta " + did);

    try {
        await catalog.docs.update(did, meta);
    } catch (error) {
        error.did = did;
        handleError("[CATALOG] couldn't set doc meta in catalog", error);
        return false;
    }
    
    return true;

}

/**
 * Creates a new doc in catalog (note that this can't update a doc in catalog. Use setDocMetaInCatalog for that)
 * @param {Object} doc Document Object
 */
async function newDocInCatalog(doc) {
     
    if (isEmpty(doc)) {
        handleError("[CATALOG] Can't create doc in catalog. No Meta!");
        return false;
    }

    if (!doc.docid) {
        handleError("[CATALOG] Can't create doc in catalog. No DID!");
        return false;
    }

    breadcrumb("[CATALOG] Creating new doc: " + doc.docid);

    try {
        await catalog.docs.put(doc);
    } catch (error) {
        error.did = doc.docid;
        handleError("[CATALOG] couldn't create new doc in catalog", error);
        return false;
    }
    
    return true;

}




 /**
  * Updates folder meta in catalog. (note that this can't create a folder. Use newfolderInCatalog for that)
  * @param {string} fid FolderID
  * @param {Object} meta Folder Meta
  */
async function setFolderMetaInCatalog(fid, meta) {

    if (!fid) {
        handleError("[CATALOG] Can't set folder meta. No FolderID!");
        return false;
    }

    if (isEmpty(meta)) {
        handleError("[CATALOG] Can't set folder meta. No Meta!");
        return false;
    }

    breadcrumb("[CATALOG] Setting folder meta " + fid);

    try {
        await catalog.folders.update(fid, meta);
    } catch (error) {
        error.fid = fid;
        handleError("[CATALOG] couldn't set folder meta in catalog", error);
        return false;
    }
    
    return true;

}

/**
 * Creates a new folder in catalog (note that this can't update a folder in catalog. Use setFolderMetaInCatalog for that)
 * @param {Object} folder Folder Object
 */
async function newFolderInCatalog(folder) {

    if (isEmpty(folder)) {
        handleError("[CATALOG] Can't create new folder. No Folder!");
        return false;
    }

    if (!folder.folderid) {
        handleError("[CATALOG] Can't create new folder. No FolderID!");
        return false;
    }

    breadcrumb("[CATALOG] Creating new folder " + folder.folderid);

    try {
        await catalog.folders.put(folder);
    } catch (error) {
        error.fid = folder.folderid;
        handleError("[CATALOG] couldn't create new folder in catalog", error);
        return false;
    }
    
    return true;

}




/**
 * Move a folder to a new parent, by setting its meta to the new parent in catalog
 * @param {string} fidToMove FolderID of folder we'll move
 * @param {string} targetFID FolderID of the destination we'll move the folder to
 */
async function moveFolderInCatalog(fidToMove, targetFID) {
    
    if (!fidToMove) {
        handleError("[CATALOG] Can't move folder. No FolderID!");
        return false;
    }

    breadcrumb("[CATALOG] Moving " + fidToMove + " to " + targetFID);

    var parentOfFolderBeforeMove = await parentOfFolder(fidToMove);
    
    var moved = await setFolderMetaInCatalog(fidToMove, { parent : targetFID });
    
    if (!parentOfFolderBeforeMove && fidToMove) { 
        // moved folder from root to non-root, remove it from root folders list, because refresh dom can't.
        $(`#folders > .folder[fid="${fidToMove}"]`).remove();
    }

    await refreshDOM();

    if (!moved) {
        return false;
    } else {
        return true;
    }

}



/**
 * Move docs to a new folder, by setting their fid in catalog
 * @param {Array} arrayOfItemsToMove docs we'll move
 * @param {string} targetFID FolderID of the destination we'll move the docs to
 */
async function moveDocsInCatalog(arrayOfItemsToMove, targetFID) {
    
    if (!Array.isArray(arrayOfItemsToMove) || arrayOfItemsToMove.length === 0) {
        breadcrumb("[CATALOG] No docs to move, skipping.");
        return false;
    }

    if (!targetFID) {
        handleError("[CATALOG] Can't move docs. No target FolderID!");
        return false;
    }

    breadcrumb("[CATALOG] Moving " + arrayOfItemsToMove.length + " items to " + targetFID);

    var promisesToMove = [];
    arrayOfItemsToMove.forEach(did => {
        if (did.startsWith("d-")) {
            promisesToMove.push(setDocMetaInCatalog(did, { fid : targetFID }));
        }
    });

    await Promise.all(promisesToMove.map(p => p.catch((e) => undefined)));

    await refreshDOM();

    return true;
}




////////////////////////////////////////////////
////////////////////////////////////////////////
//	CATALOG DELETERS / SHORTCUTS
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Deletes a folder its docs, and its subfolders and their docs from catalog & offline storage, then removes them from DOM.
 * @param {string} fid folderID
 */
async function deleteFolderAndItsContentsFromCatalog(fid) {
    if (!fid) {
        handleError("[CATALOG] Can't delete folder. No FolderID!");
        return false;
    }

    breadcrumb("[CATALOG] Deleting folder and all its contents: " + fid);

    // first get & delete all subfolders of folder
    
    var subfolders = await getSubfoldersOfFolderFromCatalog(fid);
    
    for (var subfolder of subfolders) {

        // delete subfolders of folder using the same function in a chain loop
        await deleteFolderAndItsContentsFromCatalog(subfolder.folderid);        
    }
    
    // get all docs of folder
    var docs = await getDocsOfFolderFromCatalog(fid);

    var arrayOfDIDsToDelete = [];
    for (var doc of docs) {
        arrayOfDIDsToDelete.push(doc.docid);
    }

    // delete docs in bulk from catalog
    await deleteDocsFromCatalog(arrayOfDIDsToDelete);

    // delete folder from catalog
    try {
        await catalog.folders.delete(fid);
    } catch (error) {
        handleError("[CATALOG] Failed to delete folder from catalog", error);
    }

    breadcrumb('[CATALOG] Deleted folder: ' + fid + " and all its contents:\n\n" + arrayOfDIDsToDelete);

    // now let's clear them from DOM
    $(`.folder[fid="${fid}"]`).remove();
    $(`.subfolder[fid="${fid}"]`).remove();

    await refreshDOM();

    return true;
}



/**
 * Takes an array of Document IDs, and deletes them in bulk from the catalog. 
 * @param {Array} arrayOfDIDsToDelete Array of Document IDs to delete
 */
async function deleteDocsFromCatalog(arrayOfDIDsToDelete) {
    
    if (!Array.isArray(arrayOfDIDsToDelete) || arrayOfDIDsToDelete.length === 0) {
        // No docs to delete, skipping.
        return false;
    }

    breadcrumb('[CATALOG] Deleting '+arrayOfDIDsToDelete.length+' docs in bulk');

    // delete docs in bulk from catalog
    try {
        await catalog.docs.bulkDelete(arrayOfDIDsToDelete);
    } catch (error) {
        handleError("[CATALOG] Failed to delete docs from catalog", error);
    }

    // delete docs in bulk from catalog's offline storage
    try {
        await catalog.offline.bulkDelete(arrayOfDIDsToDelete);
    } catch (error) {
        handleError("[CATALOG] Failed to delete offline docs from catalog", error);
    }
    
    breadcrumb('[CATALOG] Deleted '+arrayOfDIDsToDelete.length+' docs in bulk');

    // now let's clear it all from DOM
    arrayOfDIDsToDelete.forEach(did => { $(`.doc[did="${did}"]`).remove(); });

    if (arrayOfDIDsToDelete.includes(activeDocID)) {
        closeActiveDoc();
    }

    if (arrayOfDIDsToDelete.includes(activeFileID)) {
        closeFileViewer();
    }

    await refreshDOM();
    
    return true;

}




/**
 * Takes an array of Folder IDs, and deletes them in bulk from the catalog. 
 * @param {Array} arrayOfFIDsToDelete Array of Folder IDs to delete
 */
async function deleteFoldersFromCatalog(arrayOfFIDsToDelete) {
    
    if (!Array.isArray(arrayOfFIDsToDelete) || arrayOfFIDsToDelete.length === 0) {
        // No folders to delete, skipping.
        return false;
    }

    breadcrumb('[CATALOG] Deleting '+arrayOfFIDsToDelete.length+' folders in bulk');

    // delete folders in bulk from catalog
    try {
        await catalog.folders.bulkDelete(arrayOfFIDsToDelete);
    } catch (error) {
        handleError("[CATALOG] Failed to delete folders from catalog", error);
    }

    breadcrumb('[CATALOG] Deleted '+arrayOfFIDsToDelete.length+' folders in bulk');

    // now let's clear it all from DOM
    arrayOfFIDsToDelete.forEach(fid => { 
        $(`.folder[fid="${fid}"]`).remove();
        $(`.subfolder[fid="${fid}"]`).remove();
    });

    await refreshDOM();
    
    return true;

}




////////////////////////////////////////////////
////////////////////////////////////////////////
//	CATALOG OPERATIONS
////////////////////////////////////////////////
////////////////////////////////////////////////





/**
 * Takes an array of docs and folders from server, and checks catalog with these to see if anything changed. Used in getRecentDocsAndFolders 
 * @param {*} serverDocs Array of docs from server
 * @param {*} serverFolders Array of folders from server
 * @param {string} [parentFID] A parent Folder ID. If provided, we'll only check for deletions in the given folder, and not the entire catalog.
 * @returns {Object} changes An object with two arrays of changes.
 * @returns {Object} changes.docsToUpdateInCatalog
 * @returns {Object} changes.foldersToUpdateInCatalog 
 */
async function updateCatalogWithChanges(serverDocs, serverFolders, parentFID) {

    parentFID = parentFID || "";

    serverDocs = serverDocs || [];
    serverFolders = serverFolders || [];

    var serverDocsObj = {};
    var serverFoldersObj = {};

    var startedCheckingCatalog = (new Date()).getTime();
    breadcrumb("[CHECK CATALOG] Checking catalog for changes");

    var catalogDocs = await getAllDocsFromCatalog();
    var catalogFolders = await getAllFoldersFromCatalog();

    serverDocs.forEach(serverDoc => { serverDocsObj[serverDoc.docid] = serverDoc; });
    serverFolders.forEach(serverFolder => { serverFoldersObj[serverFolder.folderid] = serverFolder; });

    // NOW GO THROUGH THE DOCS & FOLDERS WE GOT FROM SERVER
    // AND COMPARE THEM TO THE ONES WE HAVE IN CATALOG
    // IF ANYTHING CHANGED, ADD TO CATALOG FOR UPDATE. 

    var docsToUpdateInCatalog = [];
    var foldersToUpdateInCatalog = [];

    serverDocs.forEach(serverDoc => {
        var did = serverDoc.docid;
        
        // for some reason if there's no doc id, since this is the key we need for storing things, skip to avoid headaches
        if (!did) { return; } 

        var catalogDoc = catalogDocs[did] || {};
        var updateInCatalog = false;

        if (
            serverDoc.fid !== catalogDoc.fid ||               // if doc's folder changed
            serverDoc.generation !== catalogDoc.generation    // if doc's generation changed
        ) {
            // breadcrumb('[CHECK CATALOG] Doc has a different folder or generation, will update ' + did);
            updateInCatalog = true;
        }
        
        // if we got titles from server, and it's not the same one we have in the catalog
        if (serverDoc.title && serverDoc.title !== catalogDoc.title) {
            // breadcrumb('[CHECK CATALOG] Doc has a different title, will update ' + did);
            updateInCatalog = true;
        }
        
        // if server detected that the doc doesn't have titles, update it in catalog
        if (serverDoc.untitled) {
            // breadcrumb('[CHECK CATALOG] Doc has no title, will update ' + did);
            updateInCatalog = true;
        }
        
        // if we got tags from server, and it's not the same one we have in the catalog
        if (serverDoc.tags && serverDoc.tags !== catalogDoc.tags) {
            // breadcrumb('[CHECK CATALOG] Doc has a different tags, will update ' + did);
            updateInCatalog = true;
        }
                
        // if we'll replace the doc in catalog, and if the doc is available offline, 
        // this means its offline generation in catalog will be gone once it's replaced. 
        // to avoid this, if a document is offline, set the catalogDoc.offline to serverDoc.offline here,
        // so that once serverDoc is "bulkPUT" into the catalog, the catalog doc's offline generation won't be erased.
        if (updateInCatalog && catalogDoc.offline) {
            serverDoc.offline = catalogDoc.offline;
        }

        if (updateInCatalog) {
            docsToUpdateInCatalog.push(serverDoc);
        }
    });

    serverFolders.forEach(folder => {
        var fid = folder.folderid;
        var catalogFolder = catalogFolders[fid] || {};

        if (
            folder.title !== catalogFolder.title ||
            folder.color !== catalogFolder.color ||
            folder.parent !== catalogFolder.parent ||
            folder.archived !== catalogFolder.archived
        ) {
            foldersToUpdateInCatalog.push(folder);
        }
    });


    // now we have two arrays at hand. (docsToUpdateInCatalog and foldersToUpdateInCatalog)
    // one for all docs that have changed, and one for all folders that have changed.

    // we'll put these docs to the catalog in bulk. 

    // by putting to catalog, we'll delete the old "decrypted title" & "decrypted tag" etc in the local catalog, and overwrite it with our server one.
    // which means, its titles will be re-decrypted.

    var numberOfUpdates = (docsToUpdateInCatalog.length || 0) + (foldersToUpdateInCatalog.length || 0);

    breadcrumb(`[CHECK CATALOG] Will update ${docsToUpdateInCatalog.length} docs and ${foldersToUpdateInCatalog.length} folders in catalog.`);


    if (numberOfUpdates > 0) {
        
        var startedWritingToCatalog = (new Date()).getTime();
        breadcrumb("[RECENTS] Writing " + numberOfUpdates + " updates to local catalog");
        
        await Promise.all([
            catalog.docs.bulkPut(docsToUpdateInCatalog), 
            catalog.folders.bulkPut(foldersToUpdateInCatalog)
        ].map(p => p.catch(() => undefined)));
    
        var wroteToCatalog = (new Date()).getTime();
        breadcrumb("[RECENTS] Wrote " + numberOfUpdates + " updates to local catalog in " + (wroteToCatalog - startedWritingToCatalog) + "ms.");
    
    }
    
    
    // NOW THAT WE'VE COMPLETED WRITING ALL CHANGES/UPDATES USING bulkPut, 
    // LET'S CHECK THE CATALOG, AND SERVER RESPONSES TO SEE WHAT'S DELETED ON THE SERVER 
    
    // go through all docs in catalog (optionally filter by parentFID), see if any of them are missing in serverDocs.
    // if yes, that means the doc is deleted on server, remove it from catalog

    var arrayOfDIDsToDelete = [];
    var arrayOfFIDsToDelete = [];

    for (var did in catalogDocs) {

        // there's a parent folderID filter, if doc isn't in this parent folder, won't delete it, so skip
        if (parentFID && catalogDocs[did].fid !== parentFID) { continue; } 
        
        // we got docs from server,
        // but doc doesn't exist on server
        // if it has an offline tag, and no generation, it means it's created offline, and we'll upload it in sync
        // if it doesn't have an offline tag, it means it's deleted (or ghosted) on server, so we'll delete it from catalog now.
        if (!isEmpty(serverDocsObj) && isEmpty(serverDocsObj[did]) && !catalogDocs[did].offline) { 
            breadcrumb('[CHECK CATALOG] Doc no longer exists on server, and not offline, will remove from local catalog: ' + did);
            arrayOfDIDsToDelete.push(did); 
        }

    }

    // go through all folders in catalog (optionally filter by parentFID), see if any of them are missing in serverFolders
    // if yes, that means folder is deleted or ghosted on server so delete folder from catalog.

    for (var fid in catalogFolders) {
        
        // there's a parent folderID filter, if folder isn't in this parent folder, won't delete it, so skip
        if (parentFID && catalogFolders[fid].parent !== parentFID) { continue; } 

        // TODO – THIS MAY DELETE A FOLDER FULL OF OFFLINE DOCS. DOUBLE CHECK. 
        // WE SHOULD ALSO CHECK TO SEE IF THIS FOLDER OR ITS SUBFOLDERS HAVE ANY OFFLINE DOCS IN IT BEFORE DELETING IT

        // EXAMPLE, USER IS OFFLINE, CREATES NEW DOCS, ALL OF THEM GO TO INBOX
        // INBOX DOESN'T EXIST ON SERVER, 
        // ALL OFFLINE DOCS IN FOLDER WOULD GET DELETED. 

        // we got folders from server, but folder doesn't exist on server
        if (!isEmpty(serverFoldersObj) && isEmpty(serverFoldersObj[fid])) { 
            breadcrumb('[CHECK CATALOG] Folder no longer exists on server, will remove from local catalog: ' + did);
            arrayOfFIDsToDelete.push(fid); 
        }
    }

    breadcrumb(`[CHECK CATALOG] Will delete ${arrayOfDIDsToDelete.length} docs and ${arrayOfFIDsToDelete.length} folders from catalog.`);
    
    var numberOfDeletions = (arrayOfDIDsToDelete.length  || 0) + (arrayOfFIDsToDelete.length || 0);

    await deleteDocsFromCatalog(arrayOfDIDsToDelete);
    await deleteFoldersFromCatalog(arrayOfFIDsToDelete);

    if (numberOfDeletions > 0) {
        breadcrumb(`[CHECK CATALOG] Deleted ${arrayOfDIDsToDelete.length} docs and ${arrayOfFIDsToDelete.length} folders from catalog.`);
    }

    var checkedCatalog = (new Date()).getTime();
    breadcrumb("[CHECK CATALOG] Checked & Updated catalog in " + (checkedCatalog - startedCheckingCatalog) + "ms.");

    return true;
}





////////////////////////////////////////////////
////////////////////////////////////////////////
//	DECRYPTERS
////////////////////////////////////////////////
////////////////////////////////////////////////

// LET'S SET THE NUMBER OF PARALLEL DECRYPTION TASKS WE CAN USE
// BY DEFAULT WE'LL USE 4, AND SET IT HIGHER IF THERE'S MORE CPU / worker threads available.
var decryptionThreadCount = 4;
if (cryptoThreadsCount > 4) {
    decryptionThreadCount = cryptoThreadsCount;
}

/**
 * This waits until recents are downloaded to start decrypting the catalog. 
 */
function decryptCatalogWhenRecentsAreReady() {
    if (gotRecents) {
        decryptCatalog().then(function() {
            hideBodyProgress();
            sync();
            setTimeout(function () { if (isTouch) {  $("html, body").addClass("overflowBG");  }  }, 500);
        });
    } else {
        setTimeout(decryptCatalogWhenRecentsAreReady, 100);
    }
}


/**
 * Decrypts all catalog items that require decryption. (i.e. a doc that has encrypted titles (doc.title) but doesn't have decryptedTitle (doc.decryptedTitle) )
 */
async function decryptCatalog() {
    
    breadcrumb("[DECRYPT CATALOG] Checking what needs decryption");

    // Gets all docs with encrypted titles, that also doesn't have decrypted titles.
    var docsNeedTitlesDecryption = await getDocsWithEncryptedTitlesFromCatalog();

    // Gets all docs with encrypted tags, that also doesn't have decrypted tags
    var docsNeedTagsDecryption = await getDocsWithEncryptedTagsFromCatalog();

    // Gets all folders with encrypted titles, that also doesn't have decrypted titles.
    var foldersNeedTitlesDecryption = await getFoldersWithEncryptedTitlesFromCatalog();

    var totalItemsNeedDecryption = docsNeedTitlesDecryption.length + docsNeedTagsDecryption.length + foldersNeedTitlesDecryption.length;
    var totalItemsDecrypted = 0;    


    // DECRYPT DOC TITLES

    var docIndexForTitlesDecryption = -1;
    if (docsNeedTitlesDecryption.length >= 1) {
        breadcrumb("[DECRYPT CATALOG] Decrypting " + docsNeedTitlesDecryption.length + " doc titles");
        var decryptDocTitles = new PromisePool(promisesToDecryptDocTitles, decryptionThreadCount);
        await decryptDocTitles.start();
    }
    
    // DECRYPT DOC TAGS
    
    var docIndexForTagsDecryption = -1;
    if (docsNeedTagsDecryption.length >= 1) {
        breadcrumb("[DECRYPT CATALOG] Decrypting " + docsNeedTagsDecryption.length + " doc tags");
        var decryptDocTags = new PromisePool(promisesToDecryptDocTags, decryptionThreadCount);
        await decryptDocTags.start();
    }
    
    // DECRYPT FOLDER TITLES
    
    var folderIndex = -1;
    if (foldersNeedTitlesDecryption.length >= 1) {
        breadcrumb("[DECRYPT CATALOG] Decrypting " + foldersNeedTitlesDecryption.length + " folder titles");
        var decryptFolderTitles = new PromisePool(promisesToDecryptFolderTitles, decryptionThreadCount);
        await decryptFolderTitles.start();
    }



    breadcrumb("[DECRYPT CATALOG] Done.");

    await refreshDOM();
    
    return true; 





    // PROMISE GENERATOR FOR PARALLEL DECRYPTING DOC TITLES
    function promisesToDecryptDocTitles() {
        if (docIndexForTitlesDecryption < docsNeedTitlesDecryption.length) {
            docIndexForTitlesDecryption++;
            var doc = docsNeedTitlesDecryption[docIndexForTitlesDecryption] || {};
            if (doc && !isEmpty(doc)) {
                updateDecryptionProgress();
                return decryptTitle(doc.docid);
            } else {
                return null;
            }
        } else {
            return null;
        }
    }



    // PROMISE GENERATOR FOR PARALLEL DECRYPTING DOC TAGS
    function promisesToDecryptDocTags() {
        if (docIndexForTagsDecryption < docsNeedTagsDecryption.length) {
            docIndexForTagsDecryption++;
            var doc = docsNeedTagsDecryption[docIndexForTagsDecryption] || {};
            if (doc && !isEmpty(doc)) {
                updateDecryptionProgress();
                return decryptTagsOfDocument(doc.docid);
            } else {
                return null;
            }
        } else {
            return null;
        }
    }



    // PROMISE GENERATOR FOR PARALLEL DECRYPTING FOLDER TITLES
    function promisesToDecryptFolderTitles() {
        if (folderIndex < foldersNeedTitlesDecryption.length) {
            folderIndex++;
            var folder = foldersNeedTitlesDecryption[folderIndex] || {};
            if (folder && !isEmpty(folder)) {
                updateDecryptionProgress();
                return decryptTitle(folder.folderid);
            } else {
                return null;
            }
        } else {
            return null;
        }
    }
    

    // UPDATE THE BODY'S PROGRESS TO SHOW THE DECRYPTION PROGRESS
    function updateDecryptionProgress() {
        totalItemsDecrypted++;
        
        if ($("body").hasClass("starting")) {
            var percentage = ((100 * totalItemsDecrypted) / totalItemsNeedDecryption).toFixed(2);
            showBodyProgress("starting", `decrypting files & folders... ${percentage}%`);
        } else {
            updateLeftProgress(totalItemsDecrypted, totalItemsNeedDecryption);
        }
        
    }
}



/**
 * Takes an ID (doc or folder), decrypts the title, saves the plaintext title to catalog
 * @param {string} id Doc or Folder ID
 */
async function decryptTitle(id) {
    if (!theKey) {
        handleError("[DECRYPT TITLE] Can't decrypt without the key");
        return false;
    }

    if (!id) {
        handleError("[DECRYPT TITLE] Can't decrypt without an id");
        return false;
    }

    var whatToDecrypt = {};
    if (id.startsWith("d-")) {
        whatToDecrypt = await getDocFromCatalog(id);
        if (!whatToDecrypt) { handleError("[DECRYPT TITLE] Couldn't get doc from catalog", {id:id}); }
    }
    
    if (id.startsWith("f-")) {
        whatToDecrypt = await getFolderFromCatalog(id);
        if (!whatToDecrypt) { handleError("[DECRYPT TITLE] Couldn't get folder from catalog", {id:id}); }
    }

    if (!whatToDecrypt.title) {
        handleError("[DECRYPT TITLE] Couldn't find a title to decrypt", {id:id});
    }

    breadcrumb('[DECRYPT TITLE] Decrypting title of ' + id);

    var encryptedTitle = whatToDecrypt.title || "";
    var plaintextTitle;

    if (encryptedTitle) {
        try {
            plaintextTitle = await decrypt(encryptedTitle, [theKey]);    
        } catch (error) {
            error.docOrFolderID = id;
            handleError("[DECRYPT TITLE] Failed to decrypt title.", error);
        }
        
        if (isEmpty(plaintextTitle)) {
            handleError("[DECRYPT TITLE] Decrypted title object is empty.", {id:id});
        }
        
        if (!plaintextTitle.data) {
            handleError("[DECRYPT TITLE] Decrypted title data is empty.", {id:id});
        }
    }

    var decryptedTitle = "";

    try {
        if (plaintextTitle) { decryptedTitle = plaintextTitle.data; }
    } catch (e) {}

    var parsedDecryptedTitle = decryptedTitle;

    try {
        parsedDecryptedTitle = JSON.parse(decryptedTitle);
    } catch (error) {
        parsedDecryptedTitle = decryptedTitle;
    }

    var setMetaSuccessfully;
    if (id.startsWith("d-")) {
        setMetaSuccessfully = await setDocMetaInCatalog(id, { decryptedTitle : (parsedDecryptedTitle || "Untitled Document") });
    }

    if (id.startsWith("f-")) {
        setMetaSuccessfully = await setFolderMetaInCatalog(id, { decryptedTitle : (parsedDecryptedTitle || "Untitled Folder") });
    }

    if (!setMetaSuccessfully) {
        handleError("[DECRYPT TITLE] Couldn't update doc/folder meta in catalog", {id:id});
        return false;
    }

    return true;
}






/**
 * Takes a Doc ID, decrypts the tags, saves the plaintext tags to catalog
 * @param {string} id Doc ID
 */
async function decryptTagsOfDocument(id) {
    if (!theKey) {
        handleError("[DECRYPT TAGS] Can't decrypt without the key");
        return false;
    }

    if (!id) {
        handleError("[DECRYPT TAGS] Can't decrypt without an id");
        return false;
    }

    var docToDecrypt = await getDocFromCatalog(id);
    if (!docToDecrypt) { handleError("[DECRYPT TAGS] Couldn't get doc from catalog", {id:id}); }
    
    breadcrumb('[DECRYPT TAGS] Decrypting tags of ' + id);

    var encryptedTags = docToDecrypt.tags || "";
    var plaintextTags;

    if (encryptedTags) {
        try {
            plaintextTags = await decrypt(encryptedTags, [theKey]);    
        } catch (error) {
            error.did = id;
            handleError("[DECRYPT TAGS] Failed to decrypt tags.", error);
        }
        
        if (isEmpty(plaintextTags)) {
            handleError("[DECRYPT TAGS] Decrypted tags object is empty.", {id:id});
        }
        
        if (!plaintextTags.data) {
            handleError("[DECRYPT TAGS] Decrypted tags data is empty.", {id:id});
        }
    }

    var decryptedTags = "";
    if (plaintextTags) { decryptedTags = plaintextTags.data; }

    var parsedDecryptedTags = decryptedTags;

    try {
        parsedDecryptedTags = JSON.parse(decryptedTags);
    } catch (error) {
        parsedDecryptedTags = decryptedTags;
    }

    var setMetaSuccessfully = await setDocMetaInCatalog(id, { decryptedTags : (parsedDecryptedTags || []) });
    if (!setMetaSuccessfully) {
        handleError("[DECRYPT TAGS] Couldn't update doc in catalog", {id:id});
        return false;
    }

    return true;
}





////////////////////////////////////////////////
////////////////////////////////////////////////
//	OFFLINE
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Encrypts & saves a document to offline catalog.
 * @param {*} docToSave a document object from catalog
 * @param {*} plaintextContents contents you get from quill.getContents(), plaintext, because for Offline Storage we'll encrypt them using keyToRemember instead of theKey 
 */
async function saveDocToOfflineCatalog(docToSave, plaintextContents){

    if (!plaintextContents || isEmpty(plaintextContents)) {
        handleError("[CATALOG] Can't save offline doc without contents.");
        return false;
    }
    
    if (!docToSave || isEmpty(docToSave)) {
        handleError("[CATALOG] Can't save offline doc without the doc to save.");
        return false;
    }

    var did = docToSave.docid;

    breadcrumb('[CATALOG] Encrypting document for offline storage ', did);

    var encryptedStringifiedContents;
    try {
        var stringifiedPlaintextContents = JSON.stringify(plaintextContents);
        var encryptedContents = await encrypt(stringifiedPlaintextContents, [keyToRemember]);
        encryptedStringifiedContents = JSON.stringify(encryptedContents);
    } catch (error) {
        error.did = did;
        handleError("[CATALOG] Failed to encrypt doc for offline storage", error);
        return false;
    }

    breadcrumb('[CATALOG] Saving document offline ', did);
    
    try {
        await catalog.offline.put({
            docid : did,
            tags : docToSave.decryptedTags || [],
            contents : encryptedStringifiedContents
        });
    } catch (error) {
        error.did = did;
        handleError("[CATALOG] Failed to save doc to offline catalog", error);
        return false;
    }

    // INSTEAD OF SETTING A BOOLEAN VALUE (i.e. : doc.offline = true), 
    // WE SET THE OFFLINE GENERATION OF A DOC TO ".offline" IN CATALOG. (i.e. : doc.offline = generation)
    // THIS WAY, TO UPDATE THE CATALOG DURING SYNC, WE ONLY HAVE TO READ DOC FROM CATALOG, AND NO NEED TO READ FROM OFFLINE CATALOG 
    // AND WHEN WE REFRESH THE DOM, WE DON'T NEED TO READ THE OFFLINE DOC FROM OFFLINE CATALOG, WE CAN GET THE CORRECT GEN FROM ONLINE CATALOG
    var generation = parseInt(docToSave.generation);
    var setOfflineFlag = await setDocMetaInCatalog(did, {offline:generation});
    if (!setOfflineFlag) {
        handleError("[CATALOG] Failed to set doc's offline flag in catalog", {did:did});
        return false;
    }

    breadcrumb('[CATALOG] Saved document offline ', did);

    askPersistentStoragePermission();

    return true;
}


/**
 * Makes a document online-only, by removing it from offline storage
 * @param {string} did document Id
 */
async function removeDocFromOfflineCatalog(did) {

    if (!did) {
        handleError("[CATALOG] Can't remove offline doc from catalog without an did!");
        return false;
    }

    breadcrumb('[CATALOG] Removing offline doc from catalog : ' + did);

    try {
        await catalog.offline.delete(did);
    } catch (error) {
        handleError("[CATALOG] Failed to remove offline doc from catalog", error);
        return false;
    }

    var removeOfflineFlag = await setDocMetaInCatalog(did, { offline:false });

    if (!removeOfflineFlag) {
        handleError("[CATALOG] Failed to remove doc's offline flag in catalog", {did:did});
        return false;
    }

    breadcrumb('[CATALOG] Removed offline doc from catalog : ' + did);

    return true;
}


/**
 * Gets a doc from offline storage / checks if it exists in offline storage at all.
 * @param {string} did document ID
 * @returns {Promise<Object>} offlineDoc An offline document object
 */
async function getDocFromOfflineCatalog(did) {

    if (!did) {
        handleError("[CATALOG] Can't get offline doc from catalog without an did!");
        return false;
    }

    breadcrumb('[CATALOG] Checking / Getting offline doc from catalog : ' + did);

    var offlineDoc;
    try {
        offlineDoc = await catalog.offline.get(did);
    } catch (error) {
        handleError("[CATALOG] Failed to get offline doc from catalog", error);
        return false;
    }

    if (isEmpty(offlineDoc)) {
        breadcrumb('[CATALOG] There wasnt an offline doc in catalog : ' + did);
        return false;
    }

    breadcrumb('[CATALOG] Got offline doc from catalog : ' + did);

    return offlineDoc;

}



/**
 * Gets all offline docs from catalog as an object
 * @returns {Promise<Object>} docsObject All docs in an object mapped by ID
 */
async function getAllDocsFromOfflineCatalog() {

    var docs = {};
    var docsArray = [];

    try {
        docsArray = await catalog.offline.toArray();
    } catch (error) {
        handleError("[CATALOG] Couldn't get all offline docs from catalog", error);
        return false;
    }

    docsArray.forEach(doc => { docs[doc.docid] = doc; });
    
    return docs;

}



/**
 * Loads & Decrypts an offline document (either from catalog, or directly if doc provided in params) 
 * @param {string} did document ID
 * @param {Object} [offlineDoc] An optional offline document Object
 * @returns {Promise<Object>} docContents document contents to set into the editor
 */
async function loadDocFromOfflineCatalog(did, offlineDoc) {

    if (!did) {
        handleError("[CATALOG] Can't load offline doc without a did!");
        return false;
    }

    breadcrumb('[CATALOG] Loading document from offline storage: ' + did);

    offlineDoc = offlineDoc || await getDocFromOfflineCatalog(did);
    if (isEmpty(offlineDoc)) {
        handleError('[CATALOG] There wasnt an offline doc in catalog or offlineDoc not passed as parameter', {did:did});
        return false;
    }

    var encryptedStringifiedContents = offlineDoc.contents;
    var encryptedContents;
    try {
        var parsedEncryptedContents = JSON.parse(encryptedStringifiedContents);
        encryptedContents = parsedEncryptedContents.data;
    } catch (error) {
        handleError('[CATALOG] Failed to parse encrypted offline doc contents', {did:did});
        return false;
    }

    var stringifiedPlaintextContents;
    try {
        stringifiedPlaintextContents = await decrypt(encryptedContents, [keyToRemember]);
    } catch (error) {
        handleError('[CATALOG] Failed to decrypt offline doc contents', {did:did});
        return false;
    }

    var plaintextContents;
    try {
        plaintextContents = JSON.parse(stringifiedPlaintextContents.data);
    } catch (error) {
        handleError('[CATALOG] Failed to parse plaintext offline doc contents', {did:did});
        return false;
    }

    if (isEmpty(plaintextContents)) {
        handleError('[CATALOG] Offline doc contents were empty.', {did:did});
        return false;
    }

    breadcrumb('[CATALOG] Loaded document from offline storage: ' + did);

    return plaintextContents;
}

