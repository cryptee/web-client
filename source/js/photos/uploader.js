

////////////////////////////////////////////////
////////////////////////////////////////////////
//	UPLOADS
////////////////////////////////////////////////
////////////////////////////////////////////////

var maxFilesize = 500000000; // 500mb for now, will be increased as we test for edge cases
var maxParallelUploads = 4; // for now, let's start with 4 to see how it goes. 

var dragCounter = 0;

$("#dropzone-what").html("<span class='green'>PHOTOS &amp; VIDEOS</span>");
$("#dropzone-limit").html("up to " + formatBytes(maxFilesize) + " per file");

window.addEventListener('dragenter',    handleDragEnter,    false);
window.addEventListener('dragend',      handleDragEnd,      false);
window.addEventListener('dragleave',    handleDragLeave,    false);
window.addEventListener('dragover',     handleDragOver,     false);


if (!isCanvasBlocked()) {
    // ENABLE UPLOADS / DRAG & DROP IF CANVAS ISN'T BLOCKED

    document.getElementById('upload-input').addEventListener('click', enableWakeLock, false);
    document.getElementById('upload-input').addEventListener('change', handlePhotoSelect, false);

    // ONLY ENABLE DRAG & DROP IF USER CAN UPLOAD FOLDERS.
    // AS OF DATE THIS IS ONLY NOT SUPPORTED IN OPERA.
    // https://caniuse.com/mdn-api_datatransferitem_webkitgetasentry
    // THEY'LL NEED TO USE THE UPLOAD BUTTON INSTEAD. 
    // SORRY NOT SORRY. 

    if (canUploadFolders) {
        window.addEventListener('drop',     handlePhotosDrop,   false);
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
    $(".upload-button").remove();
    $("#upload-input").remove();
}


function handleDragEnter(evt) {
    if (dragCounter === 0 && theKey && isEmpty(uploadQueue)) { showDropzone(); }
    dragCounter++;
    evt.stopPropagation();
    evt.preventDefault();
}

function handleDragLeave(evt) {
    dragCounter--;
    if (dragCounter === 0 && theKey && isEmpty(uploadQueue)) { hideDropzone(); }
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

async function handlePhotosDrop (evt) {
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

    var items = evt.dataTransfer.items;
    for (let i = 0; i < items.length; i++) {
        let item = items[i].webkitGetAsEntry();
        if (item) { traverseFileTree(item); }
    }

    // this will run in traverseFileTree when it's done traversing. 
    // runUploadQueue();
}

async function handlePhotoSelect(evt) {
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
function traverseFileTree(item) {

    clearTimeout(traverseFiletreeTimeout);
    
    if (item.isFile) {
        
        item.file(addFileToUploadQueue);
        traverseFiletreeTimeout = setTimeout(runUploadQueue, 500);

    } else if (item.isDirectory) {

        var reader = item.createReader();
        readDirectoryEntries(reader);

    } else {
        
        // neither file, nor folder. ignore 
        traverseFiletreeTimeout = setTimeout(runUploadQueue, 500);

    }

    // https://stackoverflow.com/a/53058574/353276
    function readDirectoryEntries(reader) {
        reader.readEntries((entries) => {
            if (entries.length > 0) {
                entries.forEach(traverseFileTree);
                readDirectoryEntries(reader);
            }
        });
    }

}

var uploadQueue = {};
var uploadQueueOrder = [];

function addFileToUploadQueue(file) {
    var filename = (file.name || "").trim().toLowerCase(); // "photo.jpg"
    
    // ignore common BS files. 
    var ignoreList = [".ds_store", "desktop.ini", "icon"];
    if (ignoreList.includes(filename)) { return; }

    // gather necessary info
    var extension = extensionFromFilename(filename);
    var formatSupport = checkFormatSupport(extension);
    var status = "";
    var size = file.size; 
    var type = file.type;
    var id;
    
    if (formatSupport === "unsupported-format") {
        status = "unsupported format ( " + extension + " )";
        handleError('[UPLOAD PHOTO] Unsupported Format (' + extension + ")", {}, "info");
    } else if (size > maxFilesize) { 
        status = "too large ( over 500mb )"; 
        handleError('[UPLOAD PHOTO] Too Large (' + size + ")", {}, "info");
    }
    
    if (formatSupport === "supported-image-native") { id = "p-" + newUUID() + "-v4"; }
    if (formatSupport === "supported-image-utif")   { id = "p-" + newUUID() + "-v4"; }
    if (formatSupport === "supported-video-native") { id = "v-" + newUUID() + "-v4"; }
    if (formatSupport === "unsupported-format")     { id = "unsupported-" + newUUID() + "-v4"; }

    uploadQueue[id] = {
        plaintextFile : file,
        plaintextName : filename,
        support : formatSupport,
        ext : extension,
        size : size,
        type : type,
        status : status
    };

    if (status) { 
        $("#uploader-skipped-list").append(renderSkippedUpload(filename, status)); 
    } else {
        $("#uploader-progress-wrapper").append(renderUpload(id, status));
    }
}

function checkFormatSupport(extension) {
    // images we support and can view & convert in browsers natively
    if (extension.match(/^(jpg|jpeg|png|gif|webp)$/i)) {
        return "supported-image-native";
    }

    // images we could try supporting, but need to convert for thumbnail first, and upload original alongside
    // TIFF,
    // CR2 & CR3 (Canon RAW)
    // NEF (Nikon RAW)
    // ARW (Sony RAW)
    // RAF (Fuji RAW)
    // 3FR & FFF (Hasselblad RAW)
    // DNG (Adobe RAW, Leica etc)

    // else if (extension.match(/^(tif|tiff|cr2|cr3|nef|arw|dng|3fr|fff)$/i)) {
    //   return "supported-image-utif";
    // }

    // TIFF, DNG, 3FR (Leica & Hasselblad)
    else if (extension.match(/^(tif|tiff|dng|3fr|fff)$/i)) {
      return "supported-image-utif";
    }

    // // videos we support natively
    else if (extension.match(/^(mp4|mov)$/i)) {
      return "supported-video-native";
    }

    // we don't support this yet, so don't upload to Photos.
    else { return "unsupported-format"; }
}



/**
 * Starts the upload queue when things are ready
 */
async function runUploadQueue() {

    breadcrumb('[UPLOAD] Initializing');

    setTimeout(function () { hideDropzone(); }, 500);
    showUploader();

    // request wake lock to keep device awake
    enableWakeLock();
    
    // is there anything in the queue even ... maybe it's empty? 
    var numberOfItemsInQueue = Object.keys(uploadQueue).length; 
    if (numberOfItemsInQueue === 0) {
        uploadQueueFinished();
        return true;
    }

    // if there are files with issues / video files etc, they'll be added with a status message. 
    // if there isn't a status message, file is good to upload. 
    var numberOfRAWItemsInQueue = 0;
    var numberOfUploadableItemsInQueue = 0;
    for (let id in uploadQueue) {
        let item = uploadQueue[id];
        if (item.support === "supported-image-utif") { numberOfRAWItemsInQueue++; }
        if (!item.status) { numberOfUploadableItemsInQueue++; }
    }

    // so now that we've got incompatible files out of the way, 
    // do we have any items we can upload?
    if (numberOfUploadableItemsInQueue === 0) {
        uploadQueueFinished();
        return true;
    }

    // now that all files are in the queue, let's see which album we'll put them in. 
    var aid; 
    
    if (activeAlbumID === "favorites") {
        await loadAlbum("home");
    }

    if (activeAlbumID === "home") {
        // if user is in home folder, all photos will go into a new album
        aid = await newAlbum();
    } else {
        // if user's in an album, all photos will go into this album
        aid = activeAlbumID;
    }

    for (let id in uploadQueue) {
        uploadQueue[id].aid = aid || "";
        uploadQueueOrder.push(id);
    }

    breadcrumb('[UPLOAD] Queued ' + uploadQueueOrder.length + " file(s) for upload");

    let maxMemorySafeNumberOfParallelUploads = maxParallelUploads;
    if ((isAndroid || isios || isipados) && numberOfRAWItemsInQueue) { maxMemorySafeNumberOfParallelUploads = 1; }
    var promiseToUploadEverythingInQueue = new PromisePool(promiseToUploadNextInQueue, maxMemorySafeNumberOfParallelUploads);
    await promiseToUploadEverythingInQueue.start();

    // release wake lock to let device sleep
    disableWakeLock();

    uploadQueueFinished(aid);

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
    for (var uploadID in uploadQueue) { 
        
        if (uploadQueue[uploadID] && !uploadQueue[uploadID].uploading) {
            nextUploadID = uploadID; 
            break; 
        }

    }
    
    if (!nextUploadID) { return null; }

    
    // add this upload to active uploads right away so promise pool won't pick it up for upload again
    uploadQueue[nextUploadID].uploading = true;
    
    if (uploadQueue[nextUploadID].support === "supported-image-native") {
        return processEncryptAndUploadPhoto(nextUploadID);
    }

    if (uploadQueue[nextUploadID].support === "supported-image-utif") {
        return processEncryptAndUploadPhoto(nextUploadID, true);
    }
    
    if (uploadQueue[nextUploadID].support === "supported-video-native") {
        return processEncryptAndUploadVideo(nextUploadID);
    }
    
    // if the format isn't supported, it's okay we can skip this now
    if (uploadQueue[nextUploadID].support === "unsupported-format") { 
        return new Promise(function(resolve){ resolve(true); }); 
    }

}



/**
 * Things to do when the upload queue is completed
 * @param {string} aid Album ID
 */
async function uploadQueueFinished(aid) {

    var issues = false;
    if (Object.keys(uploadQueue).length >= 1) { issues = true; }

    $("#uploader-wrapper").addClass("done");

    if (!issues) {
        breadcrumb('[UPLOAD] Uploads completed without issues.');
        $("#uploader-status-detail").text("uploads completed without any issues");

        if (aid && aid === activeAlbumID) {
            sortThings(getCurrentSort());
            updateAlbumNavbar();
        }

        setTimeout(function () { hideUploader(); }, 500);
    } else {
        breadcrumb('[UPLOAD] Uploads completed with issues.');
        $("#uploader-status-detail").html("<span onclick='toggleSkippedUploads();'>some file(s) were not uploaded. click here for more info.</span>");

        // if any one of the uploads weren't uploaded due to storage quota exceeded, show error state.
        for (var uploadID in uploadQueue) { if (uploadQueue[uploadID].status === "exceeded") { updateUploaderState("error"); } }
    
    }

    uploadQueue = {};
    uploadQueueOrder = [];

    if (aid && aid !== "home" && !albums[aid].thumb) {
        var firstPhotoInAlbum = albums[aid].photos[0];
        await setAlbumCover(aid, firstPhotoInAlbum);
        refreshAlbumInDOM(aid);
    }

}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	CANVASES & PLAYERS
////////////////////////////////////////////////
////////////////////////////////////////////////



// we create a new set of canvases / players for each parallel upload to prevent foot race between canvases or players and avoid collision
var canvases = { 1 : {}, 2 : {}, 3 : {}, 4 : {} };
var players  = { 1 : {}, 2 : {}, 3 : {}, 4 : {} };


// we keep track of which canvas/player is in use, so thumbnail generators can pick a free one 
var canvasesInUse = { 1 : false, 2 : false, 3 : false, 4 : false };
var playersInUse  = { 1 : false, 2 : false, 3 : false, 4 : false };




/**
 * Chooses the first available canvas, marks it as in-use, and returns its no
 * @returns {Number} canvasNoToUse
 */
function chooseAnAvailableCanvas() {
    
    var canvasNoToUse;

    // pick next available canvas
    for (var canvasNo in canvasesInUse) {
        var isTaken = canvasesInUse[canvasNo];
        if (!isTaken) { canvasNoToUse = canvasNo; break; }
    }
    
    // mark canvas as taken
    canvasesInUse[canvasNoToUse] = true;
    
    return canvasNoToUse; 
}

function doneWithCanvas(canvasNo) { canvasesInUse[canvasNo] = false; }





/**
 * Chooses the first available player, marks it as in-use, and returns its no
 * @returns {Number} playerNoToUse
 */
function chooseAnAvailablePlayer() {
    
    var playerNoToUse;

    // pick next available player
    for (var playerNo in playersInUse) {
        var isTaken = playersInUse[playerNo];
        if (!isTaken) { playerNoToUse = playerNo; break; }
    }
    
    // mark player as taken
    playersInUse[playerNoToUse] = true;
    
    return playerNoToUse; 
}

function doneWithPlayer(playerNo) { playersInUse[playerNo] = false; }



////////////////////////////////////////////////
////////////////////////////////////////////////
//	UPLOAD PRE-PROCESSING
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Read file, generate thumbnails, extract EXIF, encrypt thumbnails / original, upload photo, set photo meta (i.e. exif ) 
 * @param {string} uploadID The Upload ID
 * @param {Boolean} isRAW Is the photo RAW (i.e. TIFF, DNG, 3FR etc)
 */
async function processEncryptAndUploadPhoto(uploadID, isRAW) {
    
    activityHappened();

    var upload = uploadQueue[uploadID];

    // skip, because file is either too large or uses an unsupported format etc
    if (!upload || isEmpty(upload)) { return null; }
    if (upload.status) { return null; }

    // skip, because already exceeded storage.
    if (remainingStorage <= 0) { return err("exceeded"); }

    breadcrumb('[UPLOAD] Processing ' + uploadID);
    
    // update uploader status
    onUploadEncrypting(uploadID);

    activityHappened();

    // choose and lock a canvas for this upload
    var canvasNo = chooseAnAvailableCanvas();
    assignUploadToSlotNo(uploadID, canvasNo);

    // looks like if we try to decode all 4 at the same time, sometimes browsers don't like it and throw errors. 
    // this is to make sure images never decode all at the same time. By the time we get to the 4th one, it's already 500ms past,
    // and 4th one should go through without any delays
    // in case if there's still issues, we have another 1000ms timeout in the generateThumbnailsAndMetaOfImageFile just to make sure
    var waitXMSBeforeDecodingImage = (canvasNo - 1) * 1000;
    if (waitXMSBeforeDecodingImage) { await promiseToWait(waitXMSBeforeDecodingImage); }

    // generate an additional fileKey for this photo (and its thumbnails etc)
    // var fileKeys = [theKey];
    // var { fileKey, wrappedKey } = await generateFileKey();
    // if (fileKey && wrappedKey) { fileKeys.push(fileKey); }

    // generate thumbnails, generate dominant color and get date from exif using the original file (originalFile = upload.plaintextFile)
    var thumbsAndMeta = await generateThumbnailsAndMetaOfImageFile(upload.plaintextFile, upload.type, canvasNo, isRAW);

    return encryptAndUploadMedia(uploadID, upload, thumbsAndMeta, canvasNo);

    function err(msg, error) {
        
        error = error || {};
        error.uploadID = uploadID;
        handleError(msg, error);
        uploadQueue[uploadID].status = "error";

        if (msg === "exceeded") {
            $("#uploader-skipped-list").append(renderSkippedUpload(uploadQueue[uploadID].plaintextName, "not enough storage space"));
            uploadQueue[uploadID].status = "exceeded";
        } else {
            $("#uploader-skipped-list").append(renderSkippedUpload(uploadQueue[uploadID].plaintextName, msg));
        }
        
        if (remainingStorage <= 0) { 
            updateRemainingStorage(remainingStorage); 
        }

        return null;
    }
    
}



/**
 * Reads the image as an arraybuffer, and returns an object with thumbnails' base64 & dominant color 
 * @param {File} originalFile the reference for the file that is being uploaded
 * @param {string} mimeType mimetype of file (i.e. image/jpg etc )
 * @param {Number} canvasNo which canvas we will be using for this upload
 * @param {Boolean} isRAW is the image RAW (i.e. DNG, TIFF, 3FR etc), if so we'll process it differently
 * @returns {Object} thumbnails object
 * @returns {string} thumbnails.lightbox B64 of Lightbox Size Image
 * @returns {string} thumbnails.thumbnail B64 of Thumbnail Size Image
 * @returns {string} thumbnails.dominant Dominant Color of Image
 * @returns {string} thumbnails.date Exif Date String
 */
async function generateThumbnailsAndMetaOfImageFile(originalFile, mimeType, canvasNo, isRAW) {
    
    breadcrumb("[UPLOAD] Generating Thumbnails. Will use canvas no: " + canvasNo);

    var sizes = { "lightbox" : 2048, "thumbnail" : 768 };
    var qualities = { "lightbox": 0.9, "thumbnail": 0.5 };
    var uploadObject = { "lightbox" : {}, "thumbnail" : {}, "date" : "", "dominant" : "" };

    // read exif from original file (should take about 30ms, even for a 30mb file)
    var exif = await readEXIF(originalFile);
    var orientation;
    // if the browser won't handle orientation, and there's exif orientation data, use it to rotate pic.
    if (!browserWillHandleEXIFOrientation && exif.Orientation) { orientation = exif.Orientation; }

    var exifDate = extractExifDateTime(exif);
    if (exifDate) { uploadObject.date = exifDate; }

    if (isRAW) {
        uploadObject.raw = true;
        uploadObject.exif = {
            "exif-make"        : exif.make,
            "exif-model"       : exif.model,
            "exif-lens"        : exif.lens,
            "exif-aperture"    : exif.aperture,
            "exif-exposure"    : exif.exposure,
            "exif-whitebal"    : exif.whitebal,
            "exif-iso"         : exif.iso,
        };

        // browsers can't seem to correct raw images' orientation
        if (exif.Orientation) { orientation = exif.Orientation; }
    }

    canvases[canvasNo].resizedCanvas = canvases[canvasNo].resizedCanvas || document.createElement("canvas");
    canvases[canvasNo].resizedContext = canvases[canvasNo].resizedContext || canvases[canvasNo].resizedCanvas.getContext("2d");
    canvases[canvasNo].originalCanvas = canvases[canvasNo].originalCanvas || document.createElement("canvas");
    canvases[canvasNo].originalContext = canvases[canvasNo].originalContext || canvases[canvasNo].originalCanvas.getContext("2d");
    canvases[canvasNo].orientationCanvas = canvases[canvasNo].orientationCanvas || document.createElement("canvas");
    canvases[canvasNo].orientationContext = canvases[canvasNo].orientationContext || canvases[canvasNo].orientationCanvas.getContext("2d");

    var img = new Image();

    var blobURL;

    if (isRAW) {

        try {
            breadcrumb("[UPLOAD] Converting RAW image file to array buffer");
            let rawImgBuffer = await blobToArrayBuffer(originalFile); 
            img = await rawImgBufferToImgBitmap(rawImgBuffer); 
            // technically this returns an ImageBitmap, 
            // but we only need width, and height for the purposes of this function, 
            // and ImageBitmaps can be fed into canvases directly the same way as well, so it's cross compatible.
        } catch (error) {
            handleError("[UPLOAD] Failed to read RAW image", error);
            return {};
        }

        if (!img) {
            handleError("[UPLOAD] Failed to read RAW image");
            return {};
        }

    } else {
        
        try {
            blobURL = URL.createObjectURL(originalFile);
            img.src = blobURL;
        } catch (error) {
            handleError("[UPLOAD] Failed to get image object url", error);
            return {};
        }
        
        var retryDecoding = false;
        
        try {
            breadcrumb("[UPLOAD] Decoding image");
            await img.decode();
            breadcrumb("[UPLOAD] Decoded image");
        } catch (error) {
            handleError("[UPLOAD] Failed to decode image. Will retry", error);
            retryDecoding = true;
        }
        
        if (retryDecoding) {
            
            // timeout 500ms and retry decoding.
            
            // Rarely, if you try to decode all 4 images simultaneously, decode may throw an error on low end devices.
            
            await promiseToWait(500);
    
            try {
                breadcrumb("[UPLOAD] Decoding image [again]");
                await img.decode();
                breadcrumb("[UPLOAD] Decoded image [on second try]");
            } catch (error) {
                handleError("[UPLOAD] Failed to decode image. [again]", error);
                revokeObjectURL(blobURL);
                return {};
            }
    
        }
        
    }
    
    let limMaxCanvasSize = limitCanvasSize(img.width, img.height);
    if (img.width !== limMaxCanvasSize.width || img.height !== limMaxCanvasSize.height) {
        breadcrumb("[UPLOAD] Limited max canvas size. Image was too large.");
    }

    var width = limMaxCanvasSize.width;
    var height = limMaxCanvasSize.height;

    canvases[canvasNo].orientationCanvas.width = width;
    canvases[canvasNo].orientationCanvas.height = height;

    if (orientation > 4) {
        canvases[canvasNo].orientationCanvas.width = height;
        canvases[canvasNo].orientationCanvas.height = width;
    }

    correctCanvasOrientationInOrientationContext(canvases[canvasNo].orientationContext, width, height, orientation);
    
    canvases[canvasNo].orientationContext.drawImage(img, 0, 0, img.width, img.height, 0, 0, width, height);    

    for (var size in sizes) { 
        // cycle through all sizes, and generate thumbnails (if the image is a gif, skip lightbox, since we'll play the original instead)
        if (size === "thumbnail" || (size === "lightbox" && mimeType.toLowerCase() !== "image/gif")) {
            var maxWidthOrHeight = sizes[size]; // lightbox, thumbnail etc. 
            var ratio = 1;
    
            if (canvases[canvasNo].orientationCanvas.width > maxWidthOrHeight) {
                ratio = maxWidthOrHeight / canvases[canvasNo].orientationCanvas.width;
            } else if (canvases[canvasNo].orientationCanvas.height > maxWidthOrHeight) {
                ratio = maxWidthOrHeight / canvases[canvasNo].orientationCanvas.height;
            }
    
            canvases[canvasNo].originalCanvas.width = canvases[canvasNo].orientationCanvas.width;
            canvases[canvasNo].originalCanvas.height = canvases[canvasNo].orientationCanvas.height;
    
            canvases[canvasNo].originalContext.drawImage(canvases[canvasNo].orientationCanvas, 0, 0, canvases[canvasNo].orientationCanvas.width, canvases[canvasNo].orientationCanvas.height, 0, 0, canvases[canvasNo].originalCanvas.width, canvases[canvasNo].originalCanvas.height);
    
            canvases[canvasNo].resizedCanvas.width = canvases[canvasNo].originalCanvas.width * ratio; // this canvas gets a reduced size
            canvases[canvasNo].resizedCanvas.height = canvases[canvasNo].originalCanvas.height * ratio;
    
            canvases[canvasNo].resizedContext.drawImage(canvases[canvasNo].originalCanvas, 0, 0, canvases[canvasNo].originalCanvas.width, canvases[canvasNo].originalCanvas.height, 0, 0, canvases[canvasNo].resizedCanvas.width, canvases[canvasNo].resizedCanvas.height);
            uploadObject[size] = await canvasToBlob(canvases[canvasNo].resizedCanvas, qualities[size], "image/jpeg");
        }
    }

    breadcrumb("[UPLOAD] Generated Thumbnails");

    // generate dominant from thumbnails in canvas
    var colorThief = new ColorThief();
    var dominantColor = colorThief.getColor(canvases[canvasNo].resizedCanvas, canvases[canvasNo].resizedContext);
    uploadObject.dominant = dominantColor.toString();

    breadcrumb("[UPLOAD] Generated Dominant");

    revokeObjectURL(blobURL);

    return uploadObject;

}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	VIDEO PRE-PROCESSING
////////////////////////////////////////////////
////////////////////////////////////////////////

async function processEncryptAndUploadVideo(uploadID) {
    
    activityHappened();

    var upload = uploadQueue[uploadID];

    // skip, because file is either too large or uses an unsupported format etc
    if (!upload || isEmpty(upload)) { return null; }
    if (upload.status) { return null; }

    // skip, because already exceeded storage.
    if (remainingStorage <= 0) { return err("exceeded"); }

    breadcrumb('[UPLOAD] Processing ' + uploadID);

    // update uploader status
    onUploadEncrypting(uploadID);

    // choose and lock a canvas for this upload
    var canvasNo = chooseAnAvailableCanvas();
    assignUploadToSlotNo(uploadID, canvasNo);

    // choose and lock a player for this upload
    var playerNo = chooseAnAvailablePlayer();

    // looks like if we try to decode all 4 at the same time, sometimes browsers don't like it and throw errors. 
    // this is to make sure images/videos never decode all at the same time. By the time we get to the 4th one, it's already 500ms past,
    // and 4th one should go through without any delays
    // in case if there's still issues, we have another 1000ms timeout in the generateThumbnailsAndMetaOfImageFile just to make sure
    var waitXMSBeforeDecodingImage = (canvasNo - 1) * 250;
    if (waitXMSBeforeDecodingImage) { await promiseToWait(waitXMSBeforeDecodingImage); }

    var thumbsAndMeta = await generateThumbnailsAndMetaOfVideoFile(upload.plaintextFile, upload.type, canvasNo, playerNo);

    return encryptAndUploadMedia(uploadID, upload, thumbsAndMeta, canvasNo, playerNo);

    function err(msg, error) {
        error = error || {};
        error.uploadID = uploadID;
        handleError(msg, error);
        uploadQueue[uploadID].status = "error";

        if (msg === "exceeded") {
            $("#uploader-skipped-list").append(renderSkippedUpload(uploadQueue[uploadID].plaintextName, "not enough storage space"));
            uploadQueue[uploadID].status = "exceeded";
        } else {
            $("#uploader-skipped-list").append(renderSkippedUpload(uploadQueue[uploadID].plaintextName, msg));
        }
        
        if (remainingStorage <= 0) { 
            updateRemainingStorage(remainingStorage); 
        }

        return null;
    }
}



async function generateThumbnailsAndMetaOfVideoFile(originalFile, mimeType, canvasNo, playerNo) {
    
    breadcrumb("[UPLOAD] Generating Video Thumbnails. Will use canvas no: " + canvasNo + " and player no: " + playerNo);

    var sizes        = { "lightbox" : 1920, "thumbnail" : 480, "thumbnail2" : 480, "thumbnail3" : 480 };
    var qualities    = { "lightbox" : 0.75, "thumbnail" : 5 };
    var uploadObject = { "lightbox" : {  }, "thumbnail" : { }, "date" : { }, "dominant" : { } };
    
    // read last modified date from original video file
    var exifDate = "0000:00:00"; 
    if (originalFile.lastModified) { exifDate = dateToExif(originalFile.lastModified); }
    uploadObject.date = exifDate;

    canvases[canvasNo].resizedCanvas = canvases[canvasNo].resizedCanvas || document.createElement("canvas");
    canvases[canvasNo].resizedContext = canvases[canvasNo].resizedContext || canvases[canvasNo].resizedCanvas.getContext("2d");
    canvases[canvasNo].originalCanvas = canvases[canvasNo].originalCanvas || document.createElement("canvas");
    canvases[canvasNo].originalContext = canvases[canvasNo].originalContext || canvases[canvasNo].originalCanvas.getContext("2d");
    canvases[canvasNo].orientationCanvas = canvases[canvasNo].orientationCanvas || document.createElement("canvas");
    canvases[canvasNo].orientationContext = canvases[canvasNo].orientationContext || canvases[canvasNo].orientationCanvas.getContext("2d");

    breadcrumb('[UPLOAD] Preparing video player');

    // choose / create player
    players[playerNo].video = players[playerNo].video || document.createElement("video");
    
    // choose / create source
    if (!players[playerNo].source) { 
        players[playerNo].source = document.createElement("source");
        players[playerNo].video.appendChild(players[playerNo].source);
    }

    var video = players[playerNo].video;
    var source = players[playerNo].source;

    // We don't want it to start playing yet, we also don't need it to be visible to user
    video.style.display = "none";
    video.autoplay = false;
    video.muted = true;
    video.loop = false;
    video.currentTime = 0.01; // load first frame (~30fps)
    
    var blobURL;

    try {
        blobURL = URL.createObjectURL(originalFile);
        source.setAttribute("src", blobURL);
    } catch (error) {
        handleError("[UPLOAD] Failed to get video object url", error);
        return {};
    }

    video.load();
    
    breadcrumb("[UPLOAD] Decoding video");

    // Video metadata is loaded
    await new Promise(resolve => video.addEventListener('loadedmetadata', resolve));
    await new Promise(resolve => video.addEventListener('loadeddata', resolve));

    var width = video.videoWidth;
    var height = video.videoHeight;
    var duration = video.duration;
    var thumbnailIncrement = duration / 3;

    try {
        canvases[canvasNo].orientationCanvas.width = width;
        canvases[canvasNo].orientationCanvas.height = height;
        // if (isFirefox && isAndroid) {
        //     const bitmap = await createImageBitmap(video);
        //     canvases[canvasNo].orientationContext.drawImage(bitmap, 0, 0);
        // } else {
            canvases[canvasNo].orientationContext.drawImage(video, 0, 0);
        // }
    } catch (error) {
        handleError("[UPLOAD] Failed to draw video to canvas", error);
    }

    var gif; 
    try {
        gif = new GIF({ workers: 3, quality: 5, workerScript : "../js/lib/gifjs-0.2.0/gif.worker.js" });
    } catch (error) {
        handleError("[UPLOAD] Failed to init GIF lib / workers", error);
    }
    
    for (var size in sizes) { 

        try {
            if (size.startsWith("thumbnail")) {
                video.currentTime += thumbnailIncrement;
                await new Promise(resolve => video.addEventListener('timeupdate', resolve, { once: true }));
                // if (isFirefox && isAndroid) {
                    // const bitmap = await createImageBitmap(video);
                    // canvases[canvasNo].orientationContext.drawImage(bitmap, 0, 0);
                // } else {
                    canvases[canvasNo].orientationContext.drawImage(video, 0, 0);
                // }
            }
    
            // cycle through all sizes, and generate thumbnails
            var maxWidthOrHeight = sizes[size]; // lightbox, thumbnail etc. 
            var ratio = 1;
    
            if (canvases[canvasNo].orientationCanvas.width > maxWidthOrHeight) {
                ratio = maxWidthOrHeight / canvases[canvasNo].orientationCanvas.width;
            } else if (canvases[canvasNo].orientationCanvas.height > maxWidthOrHeight) {
                ratio = maxWidthOrHeight / canvases[canvasNo].orientationCanvas.height;
            }
    
            canvases[canvasNo].originalCanvas.width = canvases[canvasNo].orientationCanvas.width;
            canvases[canvasNo].originalCanvas.height = canvases[canvasNo].orientationCanvas.height;
    
            canvases[canvasNo].originalContext.drawImage(canvases[canvasNo].orientationCanvas, 0, 0, canvases[canvasNo].orientationCanvas.width, canvases[canvasNo].orientationCanvas.height, 0, 0, canvases[canvasNo].originalCanvas.width, canvases[canvasNo].originalCanvas.height);
    
            canvases[canvasNo].resizedCanvas.width = canvases[canvasNo].originalCanvas.width * ratio; // this canvas gets a reduced size
            canvases[canvasNo].resizedCanvas.height = canvases[canvasNo].originalCanvas.height * ratio;
    
            canvases[canvasNo].resizedContext.drawImage(canvases[canvasNo].originalCanvas, 0, 0, canvases[canvasNo].originalCanvas.width, canvases[canvasNo].originalCanvas.height, 0, 0, canvases[canvasNo].resizedCanvas.width, canvases[canvasNo].resizedCanvas.height);
            
            if (size.startsWith("thumbnail") && gif) {
                gif.addFrame(canvases[canvasNo].resizedCanvas, { delay: 350, copy: true });
            } else {
                uploadObject[size] = await canvasToBlob(canvases[canvasNo].resizedCanvas, qualities[size], "image/jpeg");
            }            
        } catch (error) {
            handleError("[UPLOAD] Failed to generate video variant size: " + size, error);
        }

    }

    if (gif) {
        try {
            gif.render();
            uploadObject.thumbnail = await new Promise(resolve => gif.on('finished', resolve));
            breadcrumb("[UPLOAD] Generated Video Thumbnails");
        } catch (error) {
            handleError("[UPLOAD] Failed to generate video gif thumbnails", error);
        }
    }

    try {
        // generate dominant from thumbnails in canvas
        var colorThief = new ColorThief();
        var dominantColor = colorThief.getColor(canvases[canvasNo].resizedCanvas, canvases[canvasNo].resizedContext);
        uploadObject.dominant = dominantColor.toString();
        breadcrumb("[UPLOAD] Generated Video Dominant");
    } catch (error) {
        handleError("[UPLOAD] Failed to generate video dominant color", error);
    }
    
    revokeObjectURL(blobURL);
    video = null;
    source = null;

    return uploadObject;

}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	ENCRYPT AND UPLOAD MEDIA 
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Common media encrypt & uploader for a thumbnail, lightbox and original (used by both photos and videos)
 * @param {String} uploadID 
 * @param {Object} upload 
 * @param {Object} thumbsAndMeta 
 * @param {Number} canvasNo 
 * @param {Number} [playerNo] 
 * @returns 
 */
async function encryptAndUploadMedia(uploadID, upload, thumbsAndMeta, canvasNo, playerNo) {
    
    if (isEmpty(thumbsAndMeta) || !thumbsAndMeta.thumbnail || isEmpty(thumbsAndMeta.thumbnail)) {
        return err("[UPLOAD] Failed to generate thumbnails / read meta of media file.");
    }

    // generate an additional fileKey for this photo (and its thumbnails etc)
    var fileKeys = [theKey];
    var { fileKey, wrappedKey } = await generateFileKey();
    if (fileKey && wrappedKey) { fileKeys.push(fileKey); }

    // encrypt original file
    breadcrumb('[UPLOAD] Encrypting Original');

    var originalEncryptedFile; 
    
    try {
        originalEncryptedFile = await streamingEncrypt(upload.plaintextFile, fileKeys);
    } catch (error) {
        return err("[UPLOAD] Couldn't encrypt original media", error);
    }

    addUploadVariantToUploader(uploadID, originalEncryptedFile.size);
    activityHappened();

    // encrypt thumbnail blob
    var thumbnailEncryptedBlob;
    try {
        thumbnailEncryptedBlob = await streamingEncrypt(thumbsAndMeta.thumbnail, fileKeys);
    } catch (error) {
        return err("[UPLOAD] Couldn't encrypt thumbnail media", error);
    }

    var tid = convertID(uploadID, "t");
    addUploadVariantToUploader(tid, thumbnailEncryptedBlob.size);
    activityHappened();
    
    // encrypt lightbox from blob
    var lightboxEncryptedBlob, lid;

    if (!isGIF(upload.ext)) {
        try {
            lightboxEncryptedBlob = await streamingEncrypt(thumbsAndMeta.lightbox, fileKeys);
        } catch (error) {
            return err("[UPLOAD] Couldn't encrypt lightbox media", error);
        }

        lid = convertID(uploadID, "l");
        addUploadVariantToUploader(lid, lightboxEncryptedBlob.size);
        activityHappened();
    }

    var originalToken, lightboxToken, thumbnailToken;

    try {
        var originalUpload = await streamingUploadFile(originalEncryptedFile, uploadID + ".crypteefile");
        if (typeof originalUpload === "string") { return err(originalUpload); }
        originalToken = originalUpload.token;
    } catch (error) {
        return err("[UPLOAD] Failed to upload the encrypted original media", error);
    }

    if (!originalToken) { return err("[UPLOAD] Failed to upload the encrypted original media"); }

    try {
        var thumbnailUpload = await streamingUploadFile(thumbnailEncryptedBlob, tid + ".crypteefile");
        if (typeof thumbnailUpload === "string") { return err(thumbnailUpload); }
        thumbnailToken = thumbnailUpload.token;
    } catch (error) {
        return err("[UPLOAD] Failed to upload the encrypted thumbnail media", error);
    }

    if (!thumbnailToken) { return err("[UPLOAD] Failed to upload the encrypted thumbnail media"); }

    if (lid) {
        try {
            var lightboxUpload = await streamingUploadFile(lightboxEncryptedBlob, lid + ".crypteefile");
            if (typeof lightboxUpload === "string") { return err(lightboxUpload); }
            lightboxToken = lightboxUpload.token;
        } catch (error) {
            return err("[UPLOAD] Failed to upload the encrypted lightbox media", error);
        }
    }
    
    // write media's meta 
    var mediaMeta = { id : uploadID, pinky : thumbsAndMeta.dominant };
    if (thumbsAndMeta.exif) { mediaMeta = { ...mediaMeta, ...thumbsAndMeta.exif }; }
    if (thumbsAndMeta.raw)  { mediaMeta.raw = true; }

    if (originalToken)         { mediaMeta.otoken     = originalToken     || ""; }
    if (thumbnailToken)        { mediaMeta.ttoken     = thumbnailToken    || ""; }
    if (lightboxToken)         { mediaMeta.ltoken     = lightboxToken     || ""; }
    if (fileKey && wrappedKey) { mediaMeta.wrappedKey = wrappedKey        || ""; } // save the wrapped / encrypted fileKey

    if (thumbsAndMeta.date) {
        mediaMeta.date = thumbsAndMeta.date;
    
        try { mediaMeta.year  = thumbsAndMeta.date.split(":")[0] || "";               } catch (error) {} 
        try { mediaMeta.month = thumbsAndMeta.date.split(":")[1] || "";               } catch (error) {} 
        try { mediaMeta.day   = thumbsAndMeta.date.split(":")[2].split(" ")[0] || ""; } catch (error) {} 
        try { mediaMeta.time  = thumbsAndMeta.date.split(' ')[1] || "";               } catch (error) {} 
    }
    
    activityHappened();

    // write photo's meta and set titles to its album (upload.aid)
    var aid = upload.aid;

    try {
        await setPhotoMeta(aid, uploadID, mediaMeta);
    } catch (error) {
        return err("[UPLOAD] Failed to set photo's meta-information", error);
    }

    activityHappened();

    photos[uploadID] = mediaMeta;
    photos[uploadID].decryptedTitle = upload.plaintextName;

    try {
        photos[uploadID].aid = aid;
        albums[aid].photos = albums[aid].photos || [];
        albums[aid].photos.push(uploadID);   
    } catch (error) {
        // for some reason, sometimes, rarely, albums[aid] may be undefined, although album was created. 
        // still investigating what may cause this...
        handleError("[UPLOAD] Upload completed, but couldn't add photo to virtual album", error, "warning");
        createPopup("Unfortunately there was a problem adding and displaying the photos you've uploaded in an album. We recommend reloading this page and this issue should be resolved. Rarely, ad-blockers / content-blockers may cause issues like these during uploads.","error");
    }

    onUploadComplete();

    if (aid === activeAlbumID) {
        $("#albumContents").append(renderMedia(uploadID));
        setTimeout(function () {
            setupIntersectionObserver($("#" + uploadID)[0]);
        }, 50);
    }

    // done, update album titles
    await updateAlbumTitles(aid);
        
    delete uploadQueue[uploadID];

    // unlock canvas / player for the next upload
    doneWithCanvas(canvasNo);
    doneWithPlayer(playerNo);

    // all set here
    return true;

    function err(msg, error) {
        error = error || {};
        error.uploadID = uploadID;
        handleError(msg, error);
        uploadQueue[uploadID].status = "error";

        if (msg === "exceeded") {
            
            $("#uploader-skipped-list").append(renderSkippedUpload(uploadQueue[uploadID].plaintextName, "not enough storage space"));
            uploadQueue[uploadID].status = "exceeded";

        } else {
            
            $("#uploader-skipped-list").append(renderSkippedUpload(uploadQueue[uploadID].plaintextName, msg.replace("[UPLOAD] ", "")));
            
            // unlock canvas / player for the next upload if upload failed due to a reason other than exceed (i.e. failed to decode img)
            doneWithCanvas(canvasNo);
            doneWithPlayer(playerNo);
        }
        
        if (remainingStorage <= 0) { 
            updateRemainingStorage(remainingStorage); 
        }

        return null;
    }
    

}

/**
 * This takes in a raw image (dng, tiff etc buffer) and converts it to a data url we can use to generate thumbnails.
 * Courtesy of UTIF.bufferToURI()
 * @param {*} buffer 
 * @returns {Promise<ImageBitmap>} imgBitmap
 */
async function rawImgBufferToImgBitmap(buffer) {
    
    let ifds;
    try {
        ifds = UTIF.decode(buffer);  //console.log(ifds);
    } catch (error) {
        handleError("[UPLOAD] Failed to decode RAW buffer / ifds", error);
        return null;
    }

    let vsns = ifds;
    let ma = 0;
    let rawImgData = vsns[0]; 

    if (ifds[0].subIFD) { vsns = vsns.concat(ifds[0].subIFD); }

    for (let i = 0; i < vsns.length; i++) {
        let img = vsns[i];
        if (img["t258"] == null || img["t258"].length < 3) continue;
        let ar = img["t256"] * img["t257"];
        if (ar > ma) { ma = ar; rawImgData = img; }
    }

    try {
        UTIF.decodeImage(buffer, rawImgData, ifds);
    } catch (error) {
        handleError("[UPLOAD] Failed to decode RAW image buffer", error);
        return null;
    }

    ifds = null;

    let limMaxCanvasSize = limitCanvasSize(rawImgData.width, rawImgData.height);

    let rgba;
    try {
        rgba = UTIF.toRGBA8(rawImgData); 
    } catch (error) {
        handleError("[UPLOAD] Failed to extract rgba8 from RAW image", error);
        return null;
    }
    
    let imgd;
    try {
        imgd = new ImageData(new Uint8ClampedArray(rgba.buffer), rawImgData.width, rawImgData.height);
    } catch (error) {
        handleError("[UPLOAD] Failed to create RAW ImageData", error);
        return null;
    }
    
    rgba = null;

    let imgBitmap; 
    try {
        imgBitmap = await createImageBitmap(imgd, {
            resizeWidth: limMaxCanvasSize.width,
            resizeHeight: limMaxCanvasSize.height
        });
    } catch (error) {
        handleError("[UPLOAD] Failed to create RAW ImageBitmap", error);
        return null;
    }

    imgd = null;
    
    return imgBitmap;

}