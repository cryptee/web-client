

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
    $("#action-button").remove();
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
    if (formatSupport === "supported-image-libraw") { id = "p-" + newUUID() + "-v4"; }
    if (formatSupport === "supported-image-heic")   { id = "p-" + newUUID() + "-v4"; }
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
        $("#uploader-progress-wrapper").prepend(renderUpload(id, status));
    }
}

function checkFormatSupport(extension) {
    // images we support and can view & convert in browsers natively
    if (extension.match(/^(jpg|jpeg|png|gif|webp)$/i)) {
        return "supported-image-native";
    }

    // HEIC/HEIF formats
    else if (extension.match(/^(heic|heif)$/i)) {
        return "supported-image-heic";
    }

    // images we could try supporting, but need to convert for thumbnail first, and upload original alongside
    // TIFF,
    // CRW, CR2 & CR3 (Canon RAW)
    // NEF (Nikon RAW)
    // ARW (Sony RAW)
    // RAF (Fuji RAW)
    // 3FR & FFF (Hasselblad RAW)
    // DNG (Adobe RAW, Leica, Hasselblad, iPhone ProRAW, DJI etc)
    // ORF (Olympus RAW)
    // RW2 (Panasonic RAW)
    // RWL (Leica DLUX RAW)
    // PEF (Pentax RAW)
    // etc...

    else if (extension.match(/^(crw|cr2|cr3|nef|nrw|arw|srf|sr2|raf|orf|pef|raw|rw2|rwl|x3f|3fr|fff|iiq|mef|mos|dcr|k25|kdc|srw|erf|dng|bay|cap|eip|mdc|tif|tiff)$/i)) {
        return "supported-image-libraw";
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
    var numberOfHEICItemsInQueue = 0;
    var numberOfUploadableItemsInQueue = 0;
    var numberOfVideoItemsInQueue = 0;
    for (let id in uploadQueue) {
        let item = uploadQueue[id];
        if (item.support === "supported-image-libraw") { numberOfRAWItemsInQueue++; }
        if (item.support === "supported-video-native") { numberOfVideoItemsInQueue++; }
        if (item.support === "supported-image-heic")   { numberOfHEICItemsInQueue++; }
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

    // these are here to reduce memory consumption on low power mobile devices.
    // We can technically handle 4 just fine, but better safe than sorry. out-of-memory crashes are not fun

    if ((isAndroid || isios || isipados) && numberOfRAWItemsInQueue) { maxMemorySafeNumberOfParallelUploads = 1; }
    if ((isAndroid || isios || isipados)) { maxMemorySafeNumberOfParallelUploads = 3; }
    if (numberOfHEICItemsInQueue) { maxMemorySafeNumberOfParallelUploads = 3; }
    if ((isAndroid || isios || isipados) && numberOfHEICItemsInQueue) { maxMemorySafeNumberOfParallelUploads = 2; }

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
    const uploadIDs = Object.keys(uploadQueue);
    if (!uploadIDs.length) { return null; }

    // if we still have some uploads in the queue, check to see if they're being uploaded, and return a promise to upload them.
    let nextUploadID;
    for (const uploadID of uploadIDs.reverse()) {
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

    if (uploadQueue[nextUploadID].support === "supported-image-libraw") {
        return processEncryptAndUploadPhoto(nextUploadID);
    }

    if (uploadQueue[nextUploadID].support === "supported-image-heic") {
        return processEncryptAndUploadPhoto(nextUploadID);
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

        setTimeout(function () { hideUploader(); }, 1000);
    } else {
        breadcrumb('[UPLOAD] Uploads completed with issues.');
        $("#uploader-status-detail").html("<span onclick='toggleSkippedUploads();'>some file(s) were not uploaded. click here for more info.</span>");

        // if any one of the uploads weren't uploaded due to storage quota exceeded, show error state.
        for (var uploadID in uploadQueue) { if (uploadQueue[uploadID].status === "exceeded") { updateUploaderState("error"); } }

    }

    Object.keys(uploadQueue).forEach(k => {
        uploadQueue[k].plaintextFile = null;
        delete uploadQueue[k]
    });

    uploadQueueOrder.length = 0;

    if (aid && aid !== "home" && albums[aid] && !albums[aid].thumb) {
        var firstPhotoInAlbum = (albums[aid].photos || [])[0];
        await setAlbumCover(aid, firstPhotoInAlbum);
        refreshAlbumInDOM(aid);
    }

    await ifSharedAlbumChangedShowPopupAndUpdate(aid);

}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	CANVASES & PLAYERS
////////////////////////////////////////////////
////////////////////////////////////////////////



// we create a new set of canvases / players for each parallel upload to prevent foot race between canvases or players and avoid collision
var players = { 1 : {}, 2 : {}, 3 : {}, 4 : {} };

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
 */
async function processEncryptAndUploadPhoto(uploadID) {

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

    try {

        // generate thumbnails, generate dominant color and get date from exif using the original file (originalFile = upload.plaintextFile)
        var thumbsAndMeta = await generateThumbnailsAndMetaOfImageFile(upload.plaintextFile, upload.type, canvasNo, upload.support);

        if (isEmpty(thumbsAndMeta)) {
            return err("Failed to generate thumbnails / read meta.", { uploadID: uploadID }); // Use the local err function
        }

    } catch (error) {

        return err("Photo processing failed unexpectedly.", error);

    }

    return encryptAndUploadMedia(uploadID, upload, thumbsAndMeta, canvasNo);

    function err(msg, error) {

        error = error || {};
        error.uploadID = uploadID;
        handleError(msg, error);
        uploadQueue[uploadID].status = "error";
        uploadQueue[uploadID].plaintextFile = null; // Prevent holding onto the large file and release memory

        if (msg === "exceeded") {
            $("#uploader-skipped-list").append(renderSkippedUpload(uploadQueue[uploadID].plaintextName, "not enough storage space"));
            uploadQueue[uploadID].status = "exceeded";
        } else {
            $("#uploader-skipped-list").append(renderSkippedUpload(uploadQueue[uploadID].plaintextName, msg));
        }

        // Explicitly release canvas and nullify file reference if something goes wrong
        doneWithCanvas(canvasNo);

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
 * @param {String} supportType is the image support type i.e. native or libraw etc... so if it's RAW (i.e. DNG, TIFF, 3FR etc) we'll process it differently
 * @returns {Object} thumbnails object
 * @returns {string} thumbnails.lightbox B64 of Lightbox Size Image
 * @returns {string} thumbnails.thumbnail B64 of Thumbnail Size Image
 * @returns {string} thumbnails.dominant Dominant Color of Image
 * @returns {string} thumbnails.date Exif Date String
 */
async function generateThumbnailsAndMetaOfImageFile(originalFile, mimeType, canvasNo, supportType) {

    breadcrumb("[UPLOAD] Generating Thumbnails. Will use canvas no: " + canvasNo);

    var sizes = { "lightbox" : 2400, "thumbnail" : 768 };
    var qualities = { "lightbox": 0.9, "thumbnail": 0.5 };
    var uploadObject = { "lightbox" : {}, "thumbnail" : {}, "date" : "", "dominant" : "" };

    let isRAW = supportType === "supported-image-libraw";
    let isHEIC = supportType === "supported-image-heic";
    let extension = extensionFromFilename(originalFile.name || "");

    // read exif from original file (should take about 30ms, even for a 30mb file)
    var exif = await readEXIF(originalFile);

    let imgBitmap;
    let thumbnailBitmap;

    try {

        try {
            breadcrumb("[UPLOAD] Converting image file to image bitmap");

            if (supportType === "supported-image-libraw") {

                ({imgBitmap, exif} = await rawImgFileToImgBitmapWithLIBRAW(originalFile));

            } else if (supportType === "supported-image-heic") {

                if (isSafari) {
                    // safari supports heic files natively on both iOS and MacOS, so we can safely use this instead.
                    // there should be no need for external libraries, and it should perform 100x faster.
                    imgBitmap = await imgFileToImgBitmap(originalFile, exif);
                } else {
                    imgBitmap = await heicImgFileToImgBitmapWithHEICTO(originalFile, exif);
                }

            } else {

                if (isGIF(extension)) {
                    // For GIFs, create bitmap without resizing to get true dimensions and avoid memory errors.
                    imgBitmap = await createImageBitmap(originalFile);
                } else {
                    imgBitmap = await imgFileToImgBitmap(originalFile, exif);
                }

            }

        } catch (error) {
            handleError("[UPLOAD] Failed to convert image file to image bitmap", error);
            return {};
        }

        if (!imgBitmap) {
            handleError("[UPLOAD] Failed to read image");
            return {};
        }

        breadcrumb("[UPLOAD] Converted image file to image bitmap");

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
        }

        if (isHEIC) { uploadObject.heic = true; }

        var width = imgBitmap.width;
        var height = imgBitmap.height;

        for (var size in sizes) {

            // cycle through all sizes, and generate thumbnails (if the image is a gif, skip lightbox, since we'll play the original instead)
            if (size === "thumbnail" || (size === "lightbox" && !isGIF(extension))) {

                var maxWidthOrHeight = sizes[size]; // lightbox, thumbnail etc.

                let resizedImage = await imgFileToImgBitmap(imgBitmap, { width, height }, maxWidthOrHeight);
                uploadObject[size] = await imageBitmapToBlob(resizedImage, qualities[size], "image/jpeg");

                if (size === "thumbnail") {
                    thumbnailBitmap = resizedImage;
                } else {
                    resizedImage.close();
                }

            }


        }

        breadcrumb("[UPLOAD] Generated Thumbnails");

        // create off screen canvas for color thief
        const colorThiefCanvas = new OffscreenCanvas(thumbnailBitmap.width, thumbnailBitmap.height);
        const colorThiefCtx = colorThiefCanvas.getContext('2d');
        colorThiefCtx.drawImage(thumbnailBitmap, 0, 0);

        // get image dominant color using color thief
        var colorThief = new ColorThief();
        var dominantColor = colorThief.getColor(colorThiefCanvas, colorThiefCtx);
        uploadObject.dominant = dominantColor.toString();

        // clean up colorthief offscreen canvas
        colorThiefCtx.clearRect(0, 0, colorThiefCanvas.width, colorThiefCanvas.height);
        colorThiefCanvas.width = colorThiefCanvas.height = 0;

        breadcrumb("[UPLOAD] Generated Dominant");

        return uploadObject;

    } finally {

        // clean up image bitmaps
        if (imgBitmap) { imgBitmap.close(); }
        imgBitmap = null;

        if (thumbnailBitmap) { thumbnailBitmap.close(); }
        thumbnailBitmap = null;

    }

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

    try {

        var thumbsAndMeta = await generateThumbnailsAndMetaOfVideoFile(upload.plaintextFile, upload.type, canvasNo, playerNo);

        // Add a check here:
        if (isEmpty(thumbsAndMeta)) {
            return err("Failed to generate video thumbnails / read meta.", { uploadID: uploadID }); // Use the local err function
        }

    } catch (error) {
        return err("Video processing failed unexpectedly.", error);
    }

    return encryptAndUploadMedia(uploadID, upload, thumbsAndMeta, canvasNo, playerNo);

    function err(msg, error) {
        error = error || {};
        error.uploadID = uploadID;
        handleError(msg, error);
        uploadQueue[uploadID].status = "error";
        uploadQueue[uploadID].plaintextFile = null; // Prevent holding onto the large file and release memory early

        if (msg === "exceeded") {
            $("#uploader-skipped-list").append(renderSkippedUpload(uploadQueue[uploadID].plaintextName, "not enough storage space"));
            uploadQueue[uploadID].status = "exceeded";
        } else {
            $("#uploader-skipped-list").append(renderSkippedUpload(uploadQueue[uploadID].plaintextName, msg));
        }

        // Explicitly release canvas/player and nullify file reference if something goes wrong
        doneWithCanvas(canvasNo);
        doneWithPlayer(playerNo);

        if (remainingStorage <= 0) {
            updateRemainingStorage(remainingStorage);
        }

        return null;
    }
}



async function generateThumbnailsAndMetaOfVideoFile(originalFile, mimeType, canvasNo, playerNo) {

    breadcrumb("[UPLOAD] Generating Video Thumbnails. Will use canvas no: " + canvasNo + " and player no: " + playerNo);

    var sizes        = { "lightbox" : 1920, "thumbnail" : 480 };
    var qualities    = { "lightbox" : 0.75, "thumbnail" : 0.5 };
    var uploadObject = { "lightbox" : {  }, "thumbnail" : { }, "date" : { }, "dominant" : { } };

    // read last modified date from original video file
    var exifDate = "0000:00:00";
    if (originalFile.lastModified) { exifDate = dateToExif(originalFile.lastModified); }
    uploadObject.date = exifDate;

    breadcrumb('[UPLOAD] Preparing video player');

    // These resources must be cleaned up
    let video, source, blobURL, frameBitmap, thumbnailBitmap;

    try {

        // choose / create player
        if (!players[playerNo].video) {
            players[playerNo].video = document.createElement("video")
            players[playerNo].video.setAttribute("preload", "metadata")
        }

        // choose / create source
        if (!players[playerNo].source) {
            players[playerNo].source = document.createElement("source");
            players[playerNo].video.appendChild(players[playerNo].source);
        }

        video = players[playerNo].video;
        source = players[playerNo].source;

        // We don't want it to start playing yet, we also don't need it to be visible to user
        video.style.display = "none";
        video.autoplay = false;
        video.muted = true;
        video.loop = false;
        // video.currentTime = 1; // get frame at 1 second

        // on ios video needs to be set to autoplay for the uploads to work.
        if (isios || isipados) { video.autoplay = true; }

        try {
            blobURL = URL.createObjectURL(originalFile);
            source.setAttribute("src", blobURL);
        } catch (error) {
            revokeObjectURL(blobURL);
            handleError("[UPLOAD] Failed to get video object url", error);
            return {};
        }

        video.load();

        breadcrumb("[UPLOAD] Decoding video");

        try {
            // Wait for video metadata to load
            await new Promise((resolve, reject) => {
                video.addEventListener('loadedmetadata', resolve, { once: true });
                video.addEventListener('error', e => reject(e), { once: true });
            });

            if (!video.videoWidth || !video.videoHeight) {
                throw new Error("Video has invalid dimensions.");
            }

            // Seek to a point near the start, but not frame 0 which can be black.
            video.currentTime = Math.min(1, video.duration / 2);

            // Wait for the seek operation to complete
            await new Promise((resolve, reject) => {
                video.addEventListener('seeked', resolve, { once: true });
                video.addEventListener('error', e => reject(e), { once: true });
            });
        } catch (error) {
            revokeObjectURL(blobURL);
            handleError("[UPLOAD] Failed to decode video for thumbnailing", error);
            return {};
        }

        // Create a single offscreen canvas for the frame capture
        const frameCanvas = new OffscreenCanvas(video.videoWidth, video.videoHeight);
        const frameCtx = frameCanvas.getContext('2d');
        frameCtx.drawImage(video, 0, 0);

        // Get ImageBitmap directly from the canvas
        frameBitmap = await createImageBitmap(frameCanvas);

        // We can now dispose of the canvas
        frameCtx.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
        frameCanvas.width = frameCanvas.height = 0;

        for (var size in sizes) {
            try {
                const maxWidthOrHeight = sizes[size];
                const resizedBitmap = await imgFileToImgBitmap(frameBitmap, { width: frameBitmap.width, height: frameBitmap.height }, maxWidthOrHeight);
                uploadObject[size] = await imageBitmapToBlob(resizedBitmap, qualities[size], "image/jpeg");

                if (size === "thumbnail") {
                    thumbnailBitmap = resizedBitmap;
                } else {
                    resizedBitmap.close();
                }
            } catch (error) {
                handleError("[UPLOAD] Failed to generate video variant size: " + size, error);
            }
        }

        try {

            // Get dominant color from thumbnail
            const colorCanvas = new OffscreenCanvas(thumbnailBitmap.width, thumbnailBitmap.height);
            const colorCtx = colorCanvas.getContext('2d');
            colorCtx.drawImage(thumbnailBitmap, 0, 0);

            const colorThief = new ColorThief();
            uploadObject.dominant = colorThief.getColor(colorCanvas, colorCtx).toString();

            // Cleanup
            colorCtx.clearRect(0, 0, colorCanvas.width, colorCanvas.height);
            colorCanvas.width = colorCanvas.height = 0;

            breadcrumb("[UPLOAD] Generated Video Dominant");

        } catch (error) {
            handleError("[UPLOAD] Failed to generate video dominant color", error);
        }

    } finally {

        if (blobURL) { revokeObjectURL(blobURL); }
        if (thumbnailBitmap) { thumbnailBitmap.close(); }
        if (frameBitmap) { frameBitmap.close(); }
        video = null;
        source = null;

    }

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

        // clean up the plaintextFile from the uploadQueue to clear up memory
        uploadQueue[uploadID].plaintextFile = null;

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

        // if the photo is larger than 4mb, upload using chunks,
        // otherwise, upload in one go, this seems to save time
        // in signing & coordinating smaller uploads
        // we'll shave off approx 2-2.5s from the average save time of a photo under 4mb

        var originalUpload;
        if (originalEncryptedFile.size > 4000000) {
            originalUpload = await streamingUploadFile(originalEncryptedFile, uploadID + ".crypteefile");
        } else {
            originalUpload = await uploadFile(originalEncryptedFile, uploadID + ".crypteefile");
        }

        if (typeof originalUpload === "string") { return err(originalUpload); }
        originalToken = originalUpload.token;
    } catch (error) {
        return err("[UPLOAD] Failed to upload the encrypted original media", error);
    }

    if (!originalToken) { return err("[UPLOAD] Failed to upload the encrypted original media"); }
    originalEncryptedFile = null;

    try {
        var thumbnailUpload = await uploadFile(thumbnailEncryptedBlob, tid + ".crypteefile");
        if (typeof thumbnailUpload === "string") { return err(thumbnailUpload); }
        thumbnailToken = thumbnailUpload.token;
    } catch (error) {
        return err("[UPLOAD] Failed to upload the encrypted thumbnail media", error);
    }

    if (!thumbnailToken) { return err("[UPLOAD] Failed to upload the encrypted thumbnail media"); }
    thumbnailEncryptedBlob = null;

    if (lid) {
        try {
            var lightboxUpload = await uploadFile(lightboxEncryptedBlob, lid + ".crypteefile");
            if (typeof lightboxUpload === "string") { return err(lightboxUpload); }
            lightboxToken = lightboxUpload.token;
        } catch (error) {
            return err("[UPLOAD] Failed to upload the encrypted lightbox media", error);
        }

        if (lightboxToken) { lightboxEncryptedBlob = null; }
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

    // clean the item from queue entirely
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
        uploadQueue[uploadID].plaintextFile = null;

        originalEncryptedFile = null;
        thumbnailEncryptedBlob = null;
        lightboxEncryptedBlob = null;

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
 * This takes in a raw image (cr2, cr3, arw etc buffer) and converts it to an imgBitmap we can use to generate thumbnails using LIBRAW.
 * For more info on TIFF tags, follow this:
 * https://www.loc.gov/preservation/digital/formats/content/tiff_tags.shtml
 * Good luck! It's pure chaos out there.
 * @param {FileOrBlob} originalFile
 * @returns {Promise<ImageBitmap>} imgBitmap
 */
async function rawImgFileToImgBitmapWithLIBRAW(originalFile) {

    let rawImageBuffer = await blobToArrayBuffer(originalFile);

    // first init
    const librawid = libraw._libraw_init(0);

    breadcrumb("[RAW UNPACK] Initialized");

    // then alloc memory and set the image's buffer into memory
    const dataPtr = libraw._malloc(rawImageBuffer.byteLength);
    const dataHeap = new Uint8Array(libraw.HEAPU8.buffer, dataPtr, rawImageBuffer.byteLength);
    dataHeap.set(new Uint8Array(rawImageBuffer));
    breadcrumb("[RAW UNPACK] Allocated ");

    // open buffer
    const returnedcode = libraw._libraw_open_buffer(librawid, dataHeap.byteOffset, rawImageBuffer.byteLength);
    if(returnedcode) { errored(`[RAW UNPACK] Failed to open buffer, return code = ${returnedcode}`); return { imgBitmap : null, exif : null }; }
    breadcrumb("[RAW UNPACK] Opened buffer");
    // do not cleanup memory here, you'll corrupt the jpg

    // Unpack thumbnail
    const returnedcode2 = libraw._libraw_unpack_thumb(librawid);
    if(returnedcode2) { errored(`[RAW UNPACK] Failed to unpack thumbnail, return code = ${returnedcode2}`); return { imgBitmap : null, exif : null }; }
    breadcrumb("[RAW UNPACK] Unpacked thumbnail");

    // Get thumbnail
    const errmsg   = libraw._malloc(4);
    const thumbPtr = libraw._libraw_dcraw_make_mem_thumb(librawid, errmsg);
    const error    = libraw.HEAPU32[errmsg/4];

    if(!thumbPtr || error) { errored(`[RAW UNPACK] Failed to make thumbnail`, error); return { imgBitmap : null, exif : null }; }

    breadcrumb("[RAW UNPACK] Got thumbnail ");

    // Read the processed image struct - using proper offsets
    const view = new DataView(libraw.HEAPU8.buffer, thumbPtr);
    const dataSize = view.getUint32(12, true); // data_size at offset 12

    // Get the actual thumbnail data
    const thumbnail = new Uint8Array(libraw.HEAPU8.buffer, thumbPtr + 16, dataSize);
    let thumbFile = new File([thumbnail], "thumb.jpg", { type: "image/jpeg" });
    breadcrumb("[RAW UNPACK] Thumbnail Extracted");
    // do not cleanup memory here, you'll corrupt the jpg

    // all the exif we need from the RAW file is actually passed into the thumbnail now. yay wasm.
    let exif = await readEXIF(thumbFile);
    breadcrumb("[RAW UNPACK] EXIF Extracted");

    let imgBitmap = await imgFileToImgBitmap(thumbFile, exif);

    cleanse();

    return { imgBitmap , exif };

    function errored(msg, error) {
        error = error || {};
        handleError(msg, error);
        cleanse();
    }

    function cleanse() {
        try { if (librawid) { libraw._libraw_close(librawid); } } catch(e) {}
        try { if (thumbPtr) { libraw._free(thumbPtr); } } catch(e) {}
        try { if (errmsg)   { libraw._free(errmsg);} } catch(e) {}
        try { if (dataPtr)  { libraw._free(dataPtr); } } catch(e) {}
        try { rawImageBuffer = null; } catch (e) {}
        try { thumbFile = null; } catch (e) {}
    }

}

/**
 * This reads the jpg out of rawThumbnailData and determines its width/height using raw JPG headers.
 * @param {ArrayBuffer}
 * @returns
 */
function getJpegDimensions(rawThumbData) {
    let offset = 0;
    if (rawThumbData[0] !== 0xFF || rawThumbData[1] !== 0xD8) {
        breadcrumb("[RAW UNPACK] Invalid JPEG");
        return null;
    }

    offset += 2;
    while (offset < rawThumbData.length) {
        if (rawThumbData[offset] !== 0xFF) {
            console.log("[RAW UNPACK] Invalid JPEG marker");
            return null;
        }

        const marker = rawThumbData[offset + 1];
        if (marker === 0xC0 || marker === 0xC2) { // SOF0 or SOF2 marker
            const height = (rawThumbData[offset + 5] << 8) | rawThumbData[offset + 6];
            const width = (rawThumbData[offset + 7] << 8) | rawThumbData[offset + 8];
            return { width, height };
        }

        offset += ((rawThumbData[offset + 2] << 8) | rawThumbData[offset + 3]) + 2;
    }
    return null;
}

function readRAWIParamString(ptr, maxLength) {
    const bytes = new Uint8Array(libraw.HEAPU8.buffer, ptr, maxLength);
    const nullIndex = bytes.indexOf(0);
    return new TextDecoder().decode(bytes.slice(0, nullIndex >= 0 ? nullIndex : maxLength)).trim();
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//#region HEIC / HEIF CONVERSIONS
////////////////////////////////////////////////
////////////////////////////////////////////////



/**
 * This takes in a heic image (heic/heif) and converts it to a imgBitmap we can use to generate thumbnails
 * @param {FileOrBlob} originalFile
 * @param {*} exif
 * @returns {Promise<ImageBitmap>} imgBitmap
 */
async function heicImgFileToImgBitmapWithHEICTO(originalFile, exif) {

    breadcrumb("[UPLOAD] preprocessing & converting HEIC to ImageBitmap");

    // Verify if the file is actually a HEIC file or return null
    if (!await HeicTo.isHeic(originalFile)) {

        handleError("[UPLOAD] The file is not a valid HEIC/HEIF image, failed to create ImageBitmap");
        return null;

    }

    let jpegBlob = null;

    try {

        // Convert HEIC to JPEG with high-enough quality for thumbnails
        jpegBlob = await HeicTo({ blob: originalFile, type: "image/jpeg", quality: 0.8 });

        // Create an ImageBitmap from the converted JPEG
        const imgBitmap = await imgFileToImgBitmap(jpegBlob, exif);

        // Clean up the jpegBlob to free memory
        jpegBlob = null;

        return imgBitmap;

    } catch (error) {

        handleError("[UPLOAD] Failed to process HEIC image", error);
        return null;

    } finally {
        // Ensure jpegBlob is cleared even if an error occurs
        jpegBlob = null;
    }

}


//#endregion HEIC / HEIF CONVERSIONS
