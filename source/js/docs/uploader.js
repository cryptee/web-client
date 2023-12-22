////////////////////////////////////////////////
////////////////////////////////////////////////
//
//	ALL UPLOADER RELATED FUNCTIONS (I.E. DRAG & DROP ETC INCL)
//
////////////////////////////////////////////////
////////////////////////////////////////////////


var dragCounter = 0;
window.addEventListener('dragenter',    handleDragEnter,    false);
window.addEventListener('dragend',      handleDragEnd,      false);
window.addEventListener('dragleave',    handleDragLeave,    false);
window.addEventListener('dragover',     handleDragOver,     false);

if (!isCanvasBlocked()) {
    // ENABLE UPLOADS / DRAG & DROP IF CANVAS ISN'T BLOCKED

    document.getElementById('upload-input').addEventListener('click', enableWakeLock, false);
    document.getElementById('upload-input').addEventListener('change', handleFileSelect, false);

    // ONLY ENABLE DRAG & DROP IF USER CAN UPLOAD FOLDERS.
    // AS OF DATE THIS IS ONLY NOT SUPPORTED IN OPERA.
    // https://caniuse.com/mdn-api_datatransferitem_webkitgetasentry
    // THEY'LL NEED TO USE THE UPLOAD BUTTON INSTEAD. 
    // SORRY NOT SORRY. 

    if (canUploadFolders) {
        $("#explorer-dropzone").on('drop', function(event){
            handleDrop(event, "explorer");
        }); 

        $("#document-dropzone").on('drop', function(event){
            handleDrop(event, "document");
        }); 
    }

} else {
    showModal("modal-canvas-blocked");

    $("#upload-input").on('click', function (event) {
        event.preventDefault();
        showModal("modal-canvas-blocked");
    });
}

if (!isFileAPIAvailable) {
    createPopup("Unfortunately your browser or device seems to have File API blocked, which is what allows us to encrypt files on your device before uploading them. Without this feature enabled, unfortunately you can't upload anything to Cryptee.","error");
    disableUploads();
}

/**
 * Disables upload buttons / inputs if necessary
 */
function disableUploads() {
    $("#uploadFileButton").attr("disabled", "");
    $("#upload-input").remove();
}

function isBodyActivity() {
    return $("body").hasClass("starting");
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	drag / drop events
////////////////////////////////////////////////
////////////////////////////////////////////////

function handleDragEnter(evt) {
    if (dragCounter === 0 && theKey && isEmpty(uploadQueue) && !isBodyActivity()) { 
        showDropzone(); 
    }
    
    highlightDropzone(evt.target);

    dragCounter++;
    evt.stopPropagation();
    evt.preventDefault();
}

function handleDragLeave(evt) {
    dragCounter--;
    if (dragCounter === 0 && theKey && isEmpty(uploadQueue) && !isBodyActivity()) { hideDropzone(); }
    
    evt.stopPropagation();
    evt.preventDefault();
}

function handleDragEnd(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    hideDropzone();
}

function handleDragOver(evt) {
    evt.stopPropagation();
    evt.preventDefault();
    evt.dataTransfer.dropEffect = 'copy';
}


function highlightDropzone(target) {
    if ($(target).attr("id") === "explorer-dropzone" || $(target).parents("#explorer-dropzone").length >= 1) {
        $("#explorer-dropzone").addClass("highlight");
        $("#document-dropzone").removeClass("highlight");
    }
    
    if ($(target).attr("id") === "document-dropzone" || $(target).parents("#document-dropzone").length >= 1) {
        $("#document-dropzone").addClass("highlight");
        $("#explorer-dropzone").removeClass("highlight");
    }
}

function hideDropzone() {
    $("#explorer-dropzone").removeClass("highlight");
    $("#document-dropzone").removeClass("highlight");
    $("#dropzone").removeClass("show");
    stopDropzoneProgresses();
}


async function showDropzone() {
    
    var targetFID = activeFolderID || "f-uncat";
    
    if ($("#leftListWrapper").attr("show") !== "folder") { 
        targetFID = "f-uncat"; 
    }

    var fname = await getFolderNameFromCatalog(targetFID);

    $("#dropzone-folder").text(fname);
    $("#dropzone").addClass("show");
    return true;
}


/**
 * Starts the progressbar in dropzone until upload / embed starts / finishes
 * @param {('explorer'|'document'))} dropzoneID 
 */
function startDropzoneProgress(whichDropzone) {
    stopDropzoneProgresses();
    $("#" + whichDropzone + "-dropzone").find("progress").removeAttr("max");
    $("#" + whichDropzone + "-dropzone").find("progress").removeAttr("value");
}

/**
 * Stops the progressbars in dropzones
 */
function stopDropzoneProgresses() {
    $("#dropzone").find("progress").attr("value", 100);
    $("#dropzone").find("progress").attr("max", 100);
}


function abortDropzone() {
    dragCounter = 0;
    hideDropzone();
}



async function handleDrop (evt, where) {
    evt.stopPropagation();
    evt.preventDefault();

    if (!isEmpty(uploadQueue)) { 
        //already uploading
        createPopup("It seems like there are still some uploads in progress. Please wait for the ongoing uploads to complete before uploading more files.","info");
        return false; 
    }

    dragCounter = 0;

    if (!isFileAPIAvailable) { 
        createPopup("Unfortunately your browser or device seems to have File API blocked, which is what allows us to encrypt files on your device before uploading them. Without this feature enabled, unfortunately you can't upload anything to Cryptee.","error");
        hideDropzone();
        return false; 
    }

    hideDropzone();

    var items = evt.dataTransfer.items;
    for (let i = 0; i < items.length; i++) {
        let item = items[i].webkitGetAsEntry();
        if (item) { traverseFileTree(item, where); }
    }

    // this will run in traverseFileTree when it's done traversing. 
    // runUploadQueue();
}



async function handleFileSelect(evt) { 
    evt.stopPropagation();
    evt.preventDefault();
    
    if (!isEmpty(uploadQueue)) { 
        //already uploading
        createPopup("It seems like there are still some uploads in progress. Please wait for the ongoing uploads to complete before uploading more files.","info");
        return true; 
    }

    dragCounter = 0;

    if (!isFileAPIAvailable) { 
        createPopup("Unfortunately your browser or device seems to have File API blocked, which is what allows us to encrypt files on your device before uploading them. Without this feature enabled, unfortunately you can't upload anything to Cryptee.","error");
        hideDropzone();
        return true; 
    }

    var files = evt.target.files;
    for (var i = 0; i < files.length; i++) {
        addFileToUploadQueue(files[i]);
    }

    runUploadQueue();
}



// TRAVERSES THROUGH THE FILE TREE TO GO THROUGH FOLDER BY FOLDER / to their subfolders etc.  
var traverseFiletreeTimeout;
function traverseFileTree(item, where) {

    clearTimeout(traverseFiletreeTimeout);
    
    if (item.isFile) {
        
        item.file(function(file) {
            if (where === "document" && file.type.includes("image")) {
                // if user dropped images on the editor, embed them
                processEmbedImage(file);
            } else {
                // if user dropped other things on the editor, upload / embed them accordingly
                addFileToUploadQueue(file);
            }
        });

        traverseFiletreeTimeout = setTimeout(function() {
            runUploadQueue(where);
        }, 250);

    } else if (item.isDirectory) {

        item.createReader().readEntries((entries) => {
            entries.forEach(function(entry) {
                traverseFileTree(entry, where);
            });
        });

    } else {
        // neither file, nor folder. ignore 

        traverseFiletreeTimeout = setTimeout(function() {
            runUploadQueue(where);
        }, 250);
    }

}



var uploadQueue = {};
var uploadQueueOrder = [];
var maxFilesize = 500000000; // 500mb for now, will be increased as we test for edge cases

// for now, let's start with 2 to see how it goes. 
// Reason why this is 2 vs 4 like in Photos has to do with the fact that in Docs, 
// you could be doing multiple other things during an upload (i.e. saving docs, downloading files etc)
// we want to be reasonable and conservative with our memory use. 
// we may some day increase this, or make saves and downloads watch for one another and queue up to consume less memory 
// but until then, this is the best way to go.
var maxParallelUploads = 2; 

/**
 * Adds a file to the upload queue
 * @param {*} file A File() object
 * @param {*} [did] An optional pre-defined did to use for the upload 
 */
function addFileToUploadQueue(file, did) {
    var filename = (file.name || "").trim().toLowerCase(); // "file.zip"
    
    // ignore common BS files. 
    var ignoreList = [".ds_store", "desktop.ini", "icon"];
    if (ignoreList.includes(filename)) { return; }

    // gather necessary info
    filename = (file.name || "").trim(); // "File.zip"

    var extension = extensionFromFilename(filename); // auto lowercase
    var status = "";
    var size = file.size; 
    var type = file.type;
    did = did || "d-" + newUUID() + "-v4";
    
    if (size > maxFilesize) { 
        status = "too large (>500mb)"; 
        handleError("[UPLOAD FILE] Too Large", { size : size }, "info");
    }
    
    uploadQueue[did] = {
        plaintextFile : file,
        plaintextName : filename,
        ext : extension,
        size : size,
        type : type,
        status : status
    };

    $("#uploader-progress-wrapper").prepend(renderUpload(did, status));
    if (status) { $("#uploader-skipped-list").append(renderSkippedUpload(filename, status)); }
}




/**
 * Starts the upload queue when things are ready
 * @param {string} [where] will upload go into a folder / embed into a doc
 * @param {string} [predefinedTargetFID] the target folder all uploads in this session should go into
 */
async function runUploadQueue(where, predefinedTargetFID) {

    where = where || "explorer";
    var willEmbed = false;

    breadcrumb('[UPLOAD] Initializing');

    setTimeout(function () { hideDropzone(); }, 500);
    showUploader();

    // is there anything in the queue even ... maybe it's empty? 
    var numberOfItemsInQueue = Object.keys(uploadQueue).length; 
    if (numberOfItemsInQueue === 0) {
        uploadQueueFinished();
        return true;
    }
    
    // if there are files with issues / large files etc, they'll be added with a status message. 
    // if there isn't a status message, file is good to upload. 

    var numberOfUploadableItemsInQueue = 0;
    for (var id in uploadQueue) {
        var item = uploadQueue[id];
        if (!item.status) { numberOfUploadableItemsInQueue++; }
    }

    // so now that we've got unsupported files out of the way, 
    // do we have any items we can upload?
    if (numberOfUploadableItemsInQueue === 0) {
        uploadQueueFinished();
        return true;
    }

    // now that all files are in the queue, let's see where we'll upload them. 
    
    var targetFID;
    if (where === "document" && activeDocID) {
        // files were dropped into the document, we'll upload them to document's parent folder, and later embed them to doc.
        var activeDoc = await getDocFromCatalog(activeDocID);
        targetFID = activeDoc.fid;
        willEmbed = true;
        breadcrumb('[UPLOAD] Will upload to ' + targetFID + " & embed upload(s) into the document.");
    }

    if (where === "explorer" && activeFolderID) {
        // files were dropped into the explorer, we'll upload them to the active folder, (or inbox)
        targetFID = activeFolderID;
    }
    
    // IF we're not uploading to document, 
    // or if there's no open active document, 
    // AND if the activefolder isn't open (i.e. a sub folder is open but user is looking at recents instead, use inbox)
    if ((where !== "document" || !activeDocID) && $("#leftListWrapper").attr("show") !== "folder") {
        targetFID = "f-uncat";
    }

    // if we still couldn't get a target folder, upload to inbox
    if (!targetFID) { targetFID = "f-uncat"; }

    // override document/explorer/activefolder stuff, if a predefined target fid is provided, 
    // i.e. while importing evernote notes, and we know where to upload stuff
    targetFID = predefinedTargetFID || targetFID;

    breadcrumb('[UPLOAD] Will upload to ' + targetFID);

    // if we'll upload to inbox – does inbox exist? let's make sure before we try to upload anything.
    // if it doesn't exist, let's create it
    if (targetFID === "f-uncat") {   
        var inboxFolder = await getFolderFromCatalog("f-uncat");
        if (isEmpty(inboxFolder)) {
            await newFolder("","Inbox","f-uncat");
        }
    }

    // add files to queue
    for (var did in uploadQueue) { 
        uploadQueue[did].targetFID = targetFID;
        uploadQueueOrder.push(did); 
    }

    breadcrumb('[UPLOAD] Queued ' + uploadQueueOrder.length + " file(s) for upload");

    var promiseToUploadEverythingInQueue = new PromisePool(promiseToUploadNextInQueue, maxParallelUploads);
    await promiseToUploadEverythingInQueue.start();

    // release wake lock to let device sleep
    disableWakeLock();

    await uploadQueueFinished(targetFID, willEmbed);

    return true;

}


/**
 * Promise generator for the upload queue
 * @returns {Promise} processEncryptAndUploadPhoto
 */
 function promiseToUploadNextInQueue() {
    
    // if everything we have in the queue are being uploaded, return null, we're done here.
    var numberOfItemsInQueue = Object.keys(uploadQueue).length;
    if (!numberOfItemsInQueue) { return null; }
    
    // if we still have some uploads in the queue, check to see if they're being uploaded, and return a promise to upload them.
    var nextUploadID;

    for (var did in uploadQueue) { 
        
        if (uploadQueue[did] && !uploadQueue[did].uploading) {
            nextUploadID = did; 
            break; 
        }

    }
    
    if (!nextUploadID) { return null; }

    // add this upload to active uploads right away so promise pool won't pick it up for upload again
    uploadQueue[nextUploadID].uploading = true;
    return encryptAndUploadFile(nextUploadID);

}


/**
 * Encrypt & Upload a selected/dropped file
 * @param {string} uploadID Upload / Document ID
 */
async function encryptAndUploadFile(uploadID) {

    var upload = uploadQueue[uploadID];

    // odd, but there's a very very slim chance it could happen, so terminate to be safe. 
    if (!upload || isEmpty(upload)) { return false; }

    var targetFID = upload.targetFID || "f-uncat";

    // skip, because file is too large (or other error);
    if (upload.status) { return false; }

    // skip, because already exceeded storage.
    if (remainingStorage <= 0) { return err("exceeded"); }

    breadcrumb('[UPLOAD] Processing ' + uploadID);

    // update uploader status
    onUploadEncrypting(uploadID);

    activityHappened();


    // choose and lock a slot for this upload
    var slotNo = chooseAnAvailableSlot();
    assignUploadToSlotNo(uploadID, slotNo);


    // generate an additional fileKey for this file
    var fileKeys = [theKey];
    var { fileKey, wrappedKey } = await generateFileKey();
    if (fileKey && wrappedKey) { fileKeys.push(fileKey); }
    





    //
    //
    // UPLOAD THE FILE
    //
    //

    var encryptedFile = await streamingEncrypt(upload.plaintextFile, fileKeys);
    if (!encryptedFile) { return err("[UPLOAD] Couldn't encrypt file"); }
    
    addUploadVariantToUploader(uploadID, encryptedFile.size);

    var uploadFilename; 
    if (upload.ext === "uecd") {
        uploadFilename = uploadID + ".crypteedoc";
    } else {
        uploadFilename = uploadID + ".crypteefile";
    }

    var fileUpload = await streamingUploadFile(encryptedFile, uploadFilename, true);
    if (!fileUpload) { return err("[UPLOAD] Failed to upload file"); }
    if (fileUpload === "exceeded") { return err("exceeded"); }

    activityHappened();






    //
    //
    // ENCRYPT ITS TITLE
    //
    //
    
    var encryptedTitle;
    var encryptedStringifiedTitle;

    try {
        if (upload.ext === "uecd") {
            encryptedTitle = await encrypt(JSON.stringify(titleFromFilename(upload.plaintextName)), fileKeys);
        } else {
            encryptedTitle = await encrypt(JSON.stringify(upload.plaintextName), fileKeys);
        }
        encryptedStringifiedTitle = JSON.stringify(encryptedTitle);
    } catch (error) {
        return err("[UPLOAD] Failed to encrypt filename");
    }
    
    if (!encryptedStringifiedTitle) {
        return err("[UPLOAD] Failed to encrypt / stringify filename");
    }

    activityHappened();






    //
    //
    // SAVE ITS META
    //
    //

    var metaSavedToServer, metaSavedToCatalog;
    
    enableWakeLock();
    
    var docSize = parseInt(fileUpload.size);

    if (upload.ext === "uecd") {

        var docGen = parseInt(fileUpload.generation);
        
        metaSavedToServer = await setDocMeta(uploadID, {
            size : docSize,
            docid: uploadID, 
            fid : targetFID,
            generation : docGen, 
            title : encryptedStringifiedTitle,
            wrappedKey : wrappedKey,
        });

        metaSavedToCatalog = await newDocInCatalog({
            size : docSize,
            docid: uploadID,
            fid : targetFID,
            generation : docGen,
            wrappedKey : wrappedKey,
            title : encryptedTitle.data,
            decryptedTitle : titleFromFilename(upload.plaintextName), // for local catalog, to save a decryption cycle, we save the decrypted title too
        });

    } else { 

        metaSavedToServer = await setDocMeta(uploadID, {
            isfile : true,
            size : docSize,
            docid: uploadID, 
            fid : targetFID,
            mime : upload.type,
            wrappedKey : wrappedKey,
            title : encryptedStringifiedTitle
        });

        metaSavedToCatalog = await newDocInCatalog({
            isfile : true,
            size : docSize,
            docid: uploadID,            
            fid : targetFID,
            mime : upload.type,
            wrappedKey : wrappedKey,
            title : encryptedTitle.data,
            decryptedTitle : upload.plaintextName, // for local catalog, to save a decryption cycle, we save the decrypted title too
        });

    }

    // release wake lock to let device sleep
    disableWakeLock();
    activityHappened();

    if (!metaSavedToServer || !metaSavedToCatalog) {
        return err("[UPLOAD] Failed to save file meta to server or catalog");
    }


    //
    //
    // UPLOAD COMPLETE
    //
    //

    delete uploadQueue[uploadID];

    doneWithSlot(slotNo);

    // done, refresh dom
    await refreshDOM();

    return true;
    
    function err(msg, error) {
        error = error || {};
        error.uploadID = uploadID;
        handleError(msg, error);
        if (uploadQueue[uploadID]) { uploadQueue[uploadID].status = "error"; }
        
        if (msg === "exceeded") {
            $("#uploader-skipped-list").append(renderSkippedUpload(uploadQueue[uploadID].plaintextName, "not enough storage space"));
            if (uploadQueue[uploadID]) { uploadQueue[uploadID].status = "exceeded"; }
        } else {
            $("#uploader-skipped-list").append(renderSkippedUpload(uploadQueue[uploadID].plaintextName, msg));
        }

        return false;
    }
}







/**
 * Things to do when the upload queue is completed
 * @param {string} [targetFID] Folder ID (f-uncat will be used if not provided)
 * @param {boolean} [embed] whether to embed the file to the open document after it's uploaded or not
 */
async function uploadQueueFinished(targetFID, embed) {

    targetFID = targetFID || "f-uncat";
    embed = embed || false;

    var issues = false;
    if (Object.keys(uploadQueue).length >= 1) { issues = true; }

    if (!issues) {
        breadcrumb('[UPLOAD] Uploads completed without issues.');
        setTimeout(function () { hideUploader(); }, 500);
    } else {
        $("#uploader-wrapper").addClass("done");
        breadcrumb('[UPLOAD] Uploads completed with issues.');
        $("#uploader-status-detail").html("<span onclick='toggleSkippedUploads();'>some file(s) were not uploaded. click here for more info.</span>");

        // if any one of the uploads weren't uploaded due to storage quota exceeded, show error state.
        for (var uploadID in uploadQueue) { if (uploadQueue[uploadID].status === "exceeded") { updateUploaderState("error"); } }
    }

    if (uploadQueueOrder.length > 0) {
        if (embed) {
            // user dragged files to document (and not to folder, we'll now embed the file(s) into the document)
            for (var did of uploadQueueOrder) {
                await attachSelectedFileInline(did);
            }
        } else {
            // user dragged files to explorer/folder, so show folder.
            // if we're not in the folder, load the folder to show uploads
            // i.e. load inbox to show the files 
            if (targetFID !== activeFolderID) { 
                await loadFolder(targetFID); 
            }
        }
    }

    uploadQueue = {};
    uploadQueueOrder = [];

    stopDropzoneProgresses();

    refreshDOM();

    return true;

}



// we keep track of which slot is in use, so uploading dots can pick a free one 
var slotsInUse = { 1 : false, 2 : false, 3 : false, 4 : false };

/**
 * Chooses the first available slot, marks it as in-use, and returns its no
 * @returns {Number} slotNoToUse
 */
function chooseAnAvailableSlot() {
    
    var slotNoToUse;

    // pick next available canvas
    for (var slotNo in slotsInUse) {
        var isTaken = slotsInUse[slotNo];
        if (!isTaken) { slotNoToUse = slotNo; break; }
    }
    
    // mark slot as taken
    slotsInUse[slotNoToUse] = true;
    
    return slotNoToUse; 
}

function doneWithSlot(slotNo) { slotsInUse[slotNo] = false; }