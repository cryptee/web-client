

////////////////////////////////////////////////
////////////////////////////////////////////////
//	UPLOADS
////////////////////////////////////////////////
////////////////////////////////////////////////

var dragCounter = 0;
$("#dropzone-what").html("PHOTOS");

window.addEventListener('dragenter',    handleDragEnter,    false);
window.addEventListener('dragend',      handleDragEnd,      false);
window.addEventListener('dragleave',    handleDragLeave,    false);
window.addEventListener('dragover',     handleDragOver,     false);


if (!isCanvasBlocked()) {
    // ENABLE UPLOADS / DRAG & DROP IF CANVAS ISN'T BLOCKED

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

        traverseFiletreeTimeout = setTimeout(runUploadQueue, 100);

    } else if (item.isDirectory) {

        item.createReader().readEntries((entries) => {
            entries.forEach(traverseFileTree);
        });

    } else {
        // neither file, nor folder. ignore 

        traverseFiletreeTimeout = setTimeout(runUploadQueue, 100);
    }
}

var uploadQueue = {};
var uploadQueueOrder = [];
var maxFilesize = 50000000; // 50mb for now, due to technical limits
// var maxFilesize = 10000000; // 10mb for easy testing


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
    var pid  = "p-" + newUUID() + "-v3";
    
    if (formatSupport === "unsupported-format") {
        status = "unsupported format";
        handleError('[UPLOAD PHOTO] Unsupported Format (' + extension + ")", {}, "info");
    } else if (size > maxFilesize) { 
        status = "too large ( > 50mb )"; 
        handleError('[UPLOAD PHOTO] Too Large (' + size + ")", {}, "info");
    }
    
    uploadQueue[pid] = {
        plaintextFile : file,
        plaintextName : filename,
        support : formatSupport,
        ext : extension,
        size : size,
        type : type,
        status : status
    };

    $("#uploads").append(renderUpload(pid, filename, status));
}

function checkFormatSupport(extension) {
    // images we support and can view & convert in browsers natively
    if (extension.match(/^(jpg|jpeg|png|gif)$/i)) {
        return "supported-image-native";
    }

    // images we could try supporting, but need to convert for thumbnail first, and upload original alongside
    // TIFF,
    // CR2 & CR3 (Canon RAW)
    // NEF (Nikon RAW)
    // ARW (Sony RAW)
    // RAF (Fuji RAW)
    // 3FR & FFF (Hasselblad RAW)
    // DNG (Adobe RAW)

    // else if (extension.match(/^(tif|tiff|cr2|cr3|nef|arw|dng|3fr|fff)$/i)) {
    //   return "supported-image-utif";
    // }

    // // videos we support natively
    // else if (extension.match(/^(mp4)$/i)) {
    //   return "supported-video-native";
    // }

    // we don't support this yet, so don't upload to Photos.
    else { return "unsupported-format"; }
}



/**
 * Starts the upload queue when things are ready
 */
async function runUploadQueue() {

    breadcrumb('[UPLOAD] Initializing');

    setTimeout(function () { hideDropzone(); }, 500);
    startProgressWithID("uploader-progress");
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

    var numberOfUploadableItemsInQueue = 0;
    for (var id in uploadQueue) {
        var item = uploadQueue[id];
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

    var uploadsHTML = [];

    for (var pid in uploadQueue) {
        uploadQueue[pid].aid = aid || "";
        uploadQueueOrder.push(pid);
        uploadsHTML.push(renderUpload(pid, uploadQueue[pid].plaintextName, uploadQueue[pid].status));
    }

    breadcrumb('[UPLOAD] Queued ' + uploadQueueOrder.length + " file(s) for upload");

    $("#uploader").addClass("uploading");
    $("#uploads").html(uploadsHTML.join(""));

    for (var index = 0; index < uploadQueueOrder.length; index+=2) {
        
        updateUploader(index, uploadQueueOrder.length);
        
        var upload1ID = uploadQueueOrder[index];
        var upload2ID = uploadQueueOrder[index+1];

        var uploadPromises = [];
        if (upload1ID) { uploadPromises.push(processEncryptAndUploadPhoto(upload1ID, 1)); }
        if (upload2ID) { uploadPromises.push(processEncryptAndUploadPhoto(upload2ID, 2)); }
        
        await Promise.all(uploadPromises);

        // update titles of folder every two uploads
        await updateAlbumTitles(aid);
    }

    // release wake lock to let device sleep
    disableWakeLock();

    uploadQueueFinished(aid);

}



/**
 * Things to do when the upload queue is completed
 * @param {string} aid Album ID
 */
async function uploadQueueFinished(aid) {

    var issues = false;
    if (Object.keys(uploadQueue).length >= 1) { issues = true; }

    if (!issues) {
        breadcrumb('[UPLOAD] Uploads completed without issues.');

        if (aid && aid === activeAlbumID) {
            sortThings(getCurrentSort());
        }

        hideUploader();
    } else {
        breadcrumb('[UPLOAD] Uploads completed with issues.');
        $("#uploader").removeClass("uploading");
        stopProgressWithID("uploader-progress");
    }

    uploadQueue = {};
    uploadQueueOrder = [];

    if (aid && aid !== "home" && !albums[aid].thumb) {
        var firstPhotoInAlbum = albums[aid].photos[0];
        await setAlbumCover(aid, firstPhotoInAlbum);
        refreshAlbumInDOM(aid);
    }

}


/**
 * Read file, generate thumbnails, extract EXIF, encrypt thumbnails / original, upload photo, set photo meta (i.e. exif ) 
 * @param {string} uploadID The Upload ID
 * @param {*} canvasNo Canvas to use for the upload
 */
async function processEncryptAndUploadPhoto(uploadID, canvasNo) {
    
    activityHappened();

    var upload = uploadQueue[uploadID];

    // skip, because file is either too large or uses an unsupported format etc
    if (upload.status) { return false; }

    // skip, because already exceeded storage.
    if (remainingStorage <= 0) { return err("exceeded"); }

    breadcrumb('[UPLOAD] Processing ' + uploadID);
    
    $("#upload-" + uploadID).attr("status", "uploading");
    $("#upload-" + uploadID).find(".status").html("encrypting");

    var originalBuffer;
    try {
        originalBuffer = await readFileAs(upload.plaintextFile, "arrayBuffer");
    } catch (error) {
        return err("[UPLOAD] Couldn't read file as array buffer", error);
    }

    activityHappened();

    // generate thumbnails, generate dominant color and get date from exif using the original buffer
    var thumbsAndMeta = await generateThumbnailsAndMetaOfImageFile(originalBuffer, upload.type, canvasNo);

    // encrypt original from buffer
    breadcrumb('[UPLOAD] Encrypting Original');

    var originalCiphertext; 
    try {
        originalCiphertext = await encryptUint8Array(new Uint8Array(originalBuffer), [theKey]);
    } catch (error) {
        return err("[UPLOAD] Couldn't encrypt original", error);
    }

    activityHappened();

    // encrypt thumbnail from b64
    var thumbnailCiphertext;
    try {
        thumbnailCiphertext = await encrypt(thumbsAndMeta.thumbnail, [theKey]);
    } catch (error) {
        return err("[UPLOAD] Couldn't encrypt thumbnail", error);
    }

    activityHappened();

    var tid = convertID(uploadID, "t");
    
    // encrypt lightbox from b64
    var lightboxCiphertext, lid;
    if (!isGIF(upload.ext)) {
        try {
            lightboxCiphertext = await encrypt(thumbsAndMeta.lightbox, [theKey]);
        } catch (error) {
            return err("[UPLOAD] Couldn't encrypt lightbox", error);
        }

        lid = convertID(uploadID, "l");
    }

    activityHappened();
    
    var originalToken, lightboxToken, thumbnailToken;

    try {
        var originalSize = bytesize(originalCiphertext) || 0;
        var thumbnailSize = bytesize(thumbnailCiphertext) || 0;
        var lightboxSize = bytesize(lightboxCiphertext) || 0;
        reflectUploadSize(uploadID, originalSize, thumbnailSize, lightboxSize);
    } catch (error) {}

    try {
        var originalUpload = await uploadFile(JSON.stringify(originalCiphertext), uploadID + ".crypteefile");
        if (originalUpload === "exceeded") { return err("exceeded"); }

        originalToken = originalUpload.token;
    } catch (error) {
        return err("[UPLOAD] Failed to upload original", error);
    }

    if (!originalToken) {
        return err("[UPLOAD] Failed to upload original");
    }

    try {
        var thumbnailUpload = await uploadFile(JSON.stringify(thumbnailCiphertext), tid + ".crypteefile");
        if (thumbnailUpload === "exceeded") { return err("exceeded"); }

        thumbnailToken = thumbnailUpload.token;
    } catch (error) {
        return err("[UPLOAD] Failed to upload thumbnail", error);
    }

    if (!thumbnailToken) {
        return err("[UPLOAD] Failed to upload thumbnail");
    }

    if (lid) {
        try {
            var lightboxUpload = await uploadFile(JSON.stringify(lightboxCiphertext), lid + ".crypteefile");
            if (lightboxUpload === "exceeded") { return err("exceeded"); }

            lightboxToken = lightboxUpload.token;
        } catch (error) {
            return err("[UPLOAD] Failed to upload lightbox", error);
        }
    }
    
    // write photo's meta 
    var photoMeta = { id : uploadID, pinky : thumbsAndMeta.dominant };

    if (originalToken)  { photoMeta.otoken = originalToken  || ""; }
    if (thumbnailToken) { photoMeta.ttoken = thumbnailToken || ""; }
    if (lightboxToken)  { photoMeta.ltoken = lightboxToken  || ""; }

    if (thumbsAndMeta.date) {
        photoMeta.date = thumbsAndMeta.date;
    
        try { photoMeta.year  = thumbsAndMeta.date.split(":")[0] || "";               } catch (error) {} 
        try { photoMeta.month = thumbsAndMeta.date.split(":")[1] || "";               } catch (error) {} 
        try { photoMeta.day   = thumbsAndMeta.date.split(":")[2].split(" ")[0] || ""; } catch (error) {} 
        try { photoMeta.time  = thumbsAndMeta.date.split(' ')[1] || "";               } catch (error) {} 
    }
    
    activityHappened();

    // write photo's meta and set titles to its album (upload.aid)
    var aid = upload.aid;

    try {
        await setPhotoMeta(aid, uploadID, photoMeta);
    } catch (error) {
        return err("[UPLOAD] Failed to set photo meta", error);
    }

    activityHappened();

    photos[uploadID] = photoMeta;
    photos[uploadID].decryptedTitle = upload.plaintextName;

    photos[uploadID].aid = aid;
    albums[aid].photos = albums[aid].photos || [];
    albums[aid].photos.push(uploadID);   

    $("#upload-" + uploadID).attr("status", "done");

    if (aid === activeAlbumID) {
        $("#albumContents").append(renderPhoto(uploadID));
        setTimeout(function () {
            setupIntersectionObserver($("#" + uploadID)[0]);
        }, 50);
    }

    delete uploadQueue[uploadID];

    // done, once the second pair's upload is complete, we'll update album titles
    return true;

    function err(msg, error) {
        error = error || {};
        error.uploadID = uploadID;
        handleError(msg, error);
        uploadQueue[uploadID].status = "error";
        $("#upload-"+uploadID).attr("status", "error");
        $("#upload-"+uploadID).find(".status").html("error");
        if (msg === "exceeded") { $("#upload-"+uploadID).find(".status").html("out of storage"); }
        
        if (remainingStorage <= 0) { updateRemainingStorage(remainingStorage); }
        return false;
    }
    
}


// we create a new set of canvases for each parallel upload to prevent foot race / canvas collision
var canvases = { 1 : {}, 2 : {} };

/**
 * Reads the image as an arraybuffer, and returns an object with thumbnails' base64 & dominant color 
 * @param {*} originalBuffer arrayBuffer for file
 * @param {string} mimeType mimetype of file (i.e. image/jpg etc )
 * @param {string} canvasNo which canvas to use for rescaling
 * @returns {Object} thumbnails object
 * @returns {string} thumbnails.lightbox B64 of Lightbox Size Image
 * @returns {string} thumbnails.thumbnail B64 of Thumbnail Size Image
 * @returns {string} thumbnails.dominant Dominant Color of Image
 * @returns {string} thumbnails.date Exif Date String
 */
async function generateThumbnailsAndMetaOfImageFile(originalBuffer, mimeType, canvasNo) {
    
    breadcrumb("[UPLOAD] Generating Thumbnails");

    var sizes = { "lightbox" : 1920, "thumbnail" : 768 };
    var qualities = { "lightbox": 0.7, "thumbnail": 0.4 };
    var uploadObject = { "lightbox" : "", "thumbnail" : "", "date" : "", "dominant" : "" };

    // read exif from original buffer (should take about 30ms, even for a 30mb file)
    var exif = await readEXIF(originalBuffer);

    var orientation;
    // if the browser won't handle orientation, and there's exif orientation data, use it to rotate pic.
    if (!browserWillHandleEXIFOrientation && exif.Orientation) { orientation = exif.Orientation; }
    
    var exifDate = extractExifDateTime(exif);
    if (exifDate) { uploadObject.date = exifDate; }

    canvases[canvasNo].resizedCanvas = canvases[canvasNo].resizedCanvas || document.createElement("canvas");
    canvases[canvasNo].resizedContext = canvases[canvasNo].resizedContext || canvases[canvasNo].resizedCanvas.getContext("2d");
    canvases[canvasNo].originalCanvas = canvases[canvasNo].originalCanvas || document.createElement("canvas");
    canvases[canvasNo].originalContext = canvases[canvasNo].originalContext || canvases[canvasNo].originalCanvas.getContext("2d");
    canvases[canvasNo].orientationCanvas = canvases[canvasNo].orientationCanvas || document.createElement("canvas");
    canvases[canvasNo].orientationContext = canvases[canvasNo].orientationContext || canvases[canvasNo].orientationCanvas.getContext("2d");

    var blob    = new Blob([originalBuffer], {type: mimeType});
    var img     = new Image();
    img.src     = (URL || webkitURL).createObjectURL(blob);
    
    try {
        breadcrumb("[UPLOAD] Decoding image");
        await img.decode();
        breadcrumb("[UPLOAD] Decoded image");
    } catch (error) {
        handleError("[UPLOAD] Failed to decode image.", error);
        return {};
    }

    var width = img.width;
    var height = img.height;

    canvases[canvasNo].orientationCanvas.width = width;
    canvases[canvasNo].orientationCanvas.height = height;

    if (orientation > 4) {
        canvases[canvasNo].orientationCanvas.width = height;
        canvases[canvasNo].orientationCanvas.height = width;
    }

    switch (orientation) {
        case 2:
            // horizontal flip
            canvases[canvasNo].orientationContext.translate(width, 0);
            canvases[canvasNo].orientationContext.scale(-1, 1);
            break;
        case 3:
            // 180° rotate left
            canvases[canvasNo].orientationContext.translate(width, height);
            canvases[canvasNo].orientationContext.rotate(Math.PI);
            break;
        case 4:
            // vertical flip
            canvases[canvasNo].orientationContext.translate(0, height);
            canvases[canvasNo].orientationContext.scale(1, -1);
            break;
        case 5:
            // vertical flip + 90 rotate right
            canvases[canvasNo].orientationContext.rotate(0.5 * Math.PI);
            canvases[canvasNo].orientationContext.scale(1, -1);
            break;
        case 6:
            // 90° rotate right
            canvases[canvasNo].orientationContext.rotate(0.5 * Math.PI);
            canvases[canvasNo].orientationContext.translate(0, -height);
            break;
        case 7:
            // horizontal flip + 90 rotate right
            canvases[canvasNo].orientationContext.rotate(0.5 * Math.PI);
            canvases[canvasNo].orientationContext.translate(width, -height);
            canvases[canvasNo].orientationContext.scale(-1, 1);
            break;
        case 8:
            // 90° rotate left
            canvases[canvasNo].orientationContext.rotate(-0.5 * Math.PI);
            canvases[canvasNo].orientationContext.translate(-width, 0);
            break;
    }

    canvases[canvasNo].orientationContext.drawImage(img, 0, 0);

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
            uploadObject[size] = canvases[canvasNo].resizedCanvas.toDataURL("image/jpeg", qualities[size]);
        }
    }

    breadcrumb("[UPLOAD] Generated Thumbnails");

    // generate dominant from thumbnails in canvas
    var colorThief = new ColorThief();
    var dominantColor = colorThief.getColor(canvases[canvasNo].resizedCanvas, canvases[canvasNo].resizedContext);
    uploadObject.dominant = dominantColor.toString();

    breadcrumb("[UPLOAD] Generated Dominant");

    return uploadObject;

}

/**
 * Reflects the upload progress / size in the uploader
 */
function reflectUploadSize(uploadID, originalSize, thumbnailSize, lightboxSize) {
    $("#upload-" + uploadID).attr("origTotal", originalSize);
    $("#upload-" + uploadID).attr("origLoaded", "0");

    $("#upload-" + uploadID).attr("thumbTotal", thumbnailSize);
    $("#upload-" + uploadID).attr("thumbLoaded", "0");

    $("#upload-" + uploadID).attr("lightTotal", lightboxSize);
    $("#upload-" + uploadID).attr("lightLoaded", "0");
}



/**
 * shows the uploader
 */
function showUploader() {
    breadcrumb('[UPLOAD] Showing Uploader');
    $("#uploader").addClass("show");
    $("#uploader").addClass("uploading");
}


/**
 * hides the uploader
 */
function hideUploader() {
    breadcrumb('[UPLOAD] Hiding Uploader');
    $("#uploader").removeClass("show");
    $("#uploader").removeClass("uploading");
    setTimeout(function () {
        $("#uploads").empty();
    }, 500);
}

/**
 * updates the uploader with the uploaded & total byte amounts to show the correct progress
 * @param {*} uploaded 
 * @param {*} total 
 */
function updateUploader(uploaded, total) {
    $("#uploader-progress").attr("value", uploaded);
    $("#uploader-progress").attr("max", total);

    $("#uploader-button").attr("uploaded", uploaded);
    $("#uploader-button").attr("total", total);
}

