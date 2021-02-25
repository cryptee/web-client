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

    $("#dropzone-folder").html(fname);
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


function updateUploader(uploaded, total) {
    if ((uploaded + "") && (total + "")) {
        $("#panel-uploads").attr("uploaded", uploaded);
        $("#panel-uploads").attr("total", total);
    } else {
        $("#panel-uploads").removeAttr("uploaded");
        $("#panel-uploads").removeAttr("total");
    }
}










async function handleDrop (evt, where) {
    evt.stopPropagation();
    evt.preventDefault();

    if (!isEmpty(uploadQueue)) { 
        //already uploading
        return true; 
    }

    dragCounter = 0;

    if (!isFileAPIAvailable) { 
        createPopup("Unfortunately your browser or device seems to have File API blocked, which is what allows us to encrypt files on your device before uploading them. Without this feature enabled, unfortunately you can't upload anything to Cryptee.","error");
        hideDropzone();
        return true; 
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
var maxFilesize = 50000000; // 50mb for now, due to technical limits

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
    did = did || "d-" + newUUID() + "-v3";
    
    if (size > maxFilesize) { 
        status = "too large (>50mb)"; 
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

    $("#panel-uploads").append(renderUpload(did, filename, 0, 0, status));
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
    }

    if (where === "explorer" && activeFolderID) {
        // files were dropped into the explorer, we'll upload them to the active folder, (or inbox)
        targetFID = activeFolderID;
    }
    
    // if the activefolder isn't open (i.e. a sub folder is open but user is looking at recents instead, use inbox)
    if ($("#leftListWrapper").attr("show") !== "folder") { targetFID = "f-uncat"; }

    // if we still couldn't get a target folder, upload to inbox
    if (!targetFID) { targetFID = "f-uncat"; }

    // override document/explorer/activefolder stuff, if a predefined target fid is provided, 
    // i.e. while importing evernote notes, and we know where to upload stuff
    targetFID = predefinedTargetFID || targetFID;

    // if we'll upload to inbox – does inbox exist? let's make sure before we try to upload anything.
    // if it doesn't exist, let's create it
    if (targetFID === "f-uncat") {   
        var inboxFolder = await getFolderFromCatalog("f-uncat");
        if (isEmpty(inboxFolder)) {
            await newFolder("","Inbox","f-uncat");
        }
    }

    // add files to queue
    for (var did in uploadQueue) { uploadQueueOrder.push(did); }
    breadcrumb('[UPLOAD] Queued ' + uploadQueueOrder.length + " file(s) for upload");

    // run through the queue
    for (var index = 0; index < uploadQueueOrder.length; index+=2) {
        
        updateUploader(index, uploadQueueOrder.length);
        
        var upload1ID = uploadQueueOrder[index];
        var upload2ID = uploadQueueOrder[index+1];

        var uploadPromises = [];

        if (upload1ID) { uploadPromises.push(encryptAndUploadFile(upload1ID, targetFID)); }
        if (upload2ID) { uploadPromises.push(encryptAndUploadFile(upload2ID, targetFID)); }
        
        await Promise.all(uploadPromises);

        // update titles of folder every two uploads
        await refreshDOM();

    }
    
    // release wake lock to let device sleep
    disableWakeLock();

    await uploadQueueFinished(targetFID, willEmbed);

    return true;

}


/**
 * Encrypt & Upload a selected/dropped file
 * @param {string} uploadID Upload / Document ID
 * @param {string} [targetFID] target upload folder
 */
async function encryptAndUploadFile(uploadID, targetFID) {

    var upload = uploadQueue[uploadID];

    // odd, but there's a very very slim chance it could happen, so terminate to be safe. 
    if (!upload || isEmpty(upload)) { return false; }

    targetFID = targetFID || "f-uncat";

    // skip, because file is too large (or other error);
    if (upload.status) { return false; }

    breadcrumb('[UPLOAD] Processing ' + uploadID);

    activityHappened();

    




    //
    //
    // UPLOAD THE FILE
    //
    //

    var fileUpload, plaintextFileContents;
    if (upload.ext === "uecd") {
        // it's an UECD file, which is a stringified, plaintext quill delta. upload this like a regular document save
        plaintextFileContents = await readFileAs(upload.plaintextFile, "text");
        try {
            plaintextFileContents = JSON.parse(plaintextFileContents);
        } catch (e) {}
        fileUpload = await encryptAndUploadDocument(uploadID, plaintextFileContents, true);
    } else {
        // it's some other file format
        var fileBuffer = await readFileAs(upload.plaintextFile, "arrayBuffer");
        if (!fileBuffer) { return err("[UPLOAD] Couldn't read file as array buffer", error); }
        
        var fileCiphertext = await encryptUint8Array(new Uint8Array(fileBuffer), [theKey]);
        if (!fileCiphertext) { return err("[UPLOAD] Couldn't encrypt file", error); }
        
        fileUpload = await uploadFile(JSON.stringify(fileCiphertext), uploadID + ".crypteefile", true);
    }

    if (!fileUpload) { return err("[UPLOAD] Failed to upload file"); }
    if (fileUpload === "exceeded") { return err("[UPLOAD] Failed to upload file. Exceeded Storage Quota!"); }

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
            encryptedTitle = await encrypt(JSON.stringify(titleFromFilename(upload.plaintextName)), [theKey]);
        } else {
            encryptedTitle = await encrypt(JSON.stringify(upload.plaintextName), [theKey]);
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
    if (upload.ext === "uecd") {


        var docGen = parseInt(fileUpload.generation);
        
        var parsedPlaintextFileContents;
        try {
            parsedPlaintextFileContents = JSON.parse(plaintextFileContents);
        } catch (e) {}
        
        var docTags = [];
        
        if (parsedPlaintextFileContents) {
            docTags = await findAndEncryptDocumentTags(uploadID, parsedPlaintextFileContents);
        }

        var encryptedTags = docTags.tags;
        var decryptedTags = docTags.decryptedTags;
        
        metaSavedToServer = await setDocMeta(uploadID, {
            docid: uploadID, 
            fid : targetFID,
            generation : docGen, 
            tags : encryptedTags,
            title : encryptedStringifiedTitle
        });

        metaSavedToCatalog = await newDocInCatalog({
            docid: uploadID,
            fid : targetFID,
            generation : docGen,
            tags : encryptedTags,
            title : encryptedTitle.data,
            decryptedTags : decryptedTags, // for local catalog, to save a decryption cycle, we save the decrypted tags too
            decryptedTitle : titleFromFilename(upload.plaintextName), // for local catalog, to save a decryption cycle, we save the decrypted title too
        });

    } else { 

        metaSavedToServer = await setDocMeta(uploadID, {
            isfile : true,
            docid: uploadID, 
            fid : targetFID,
            mime : upload.type,
            title : encryptedStringifiedTitle
        });

        metaSavedToCatalog = await newDocInCatalog({
            isfile : true,
            docid: uploadID,            
            fid : targetFID,
            mime : upload.type,
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

    // done, once the second pair's upload is complete, we'll refresh dom
    return true;



    
    function err(msg, error) {
        error = error || {};
        error.uploadID = uploadID;
        handleError(msg, error);
        uploadQueue[uploadID].status = "error";
        $("#upload-"+uploadID).find(".status").html("error");
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
    } else {
        breadcrumb('[UPLOAD] Uploads completed with issues.');
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



    if (!issues) {
        uploadQueueOrder.forEach(did => { $("#upload-" + did).remove(); });
    } else {
        createPopup(`Failed to encrypt/upload some of your file(s).<br><button class="white bold" onclick="$('#panel-uploads').empty();  hideAllPopups();">okay</button>`, "error");
    }

    uploadQueue = {};
    uploadQueueOrder = [];

    stopDropzoneProgresses();
    updateUploader("", "");

    refreshDOM();

    return true;

}


