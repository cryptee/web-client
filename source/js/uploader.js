////////////////////////////////////////////////
////////////////////////////////////////////////
//	SHOW / HIDE / UI
////////////////////////////////////////////////
////////////////////////////////////////////////

function showUploader() {
    if (!$("#uploader-wrapper").hasClass("show")) {
        breadcrumb('[UPLOAD] Showing Uploader');
        $("#uploader-wrapper").addClass("show");
        $("#uploader-status-detail").text("");
    }
}

function hideUploader() {
    breadcrumb('[UPLOAD] Hiding Uploader');
    $("#uploader-wrapper").removeClass("show");
    setTimeout(function () {
        $("#uploader-wrapper").removeClass("paused error interrupted skipped done");
        $("#uploader-progress-wrapper").empty();
        $("#uploader-skipped-list").empty();
    }, 500);
}

function toggleSkippedUploads() {
    $("#uploader-wrapper").toggleClass("skipped");
}

/**
 * Renders an upload with given id, name and status
 * @param {string} fileID upload fileID / photoID / docID etc (i.e. "p-12345.crypteefile" or "p-12345" etc)
 * @param {string} status upload info / status (i.e. "unsupported format" or "too large" etc)
 */
 function renderUpload(fileID, status) {
    status = status || "";
    var uploadID = filenameToUploadID(fileID);
    return `
    <div class="upload" prog="pending" id="${uploadID}" status="${status}">
        <b prog="90"></b>
        <b prog="80"></b>
        <b prog="70"></b>
        <b prog="60"></b>
        <b prog="50"></b>
        <b prog="40"></b>
        <b prog="30"></b>
        <b prog="20"></b>
        <b prog="10"></b>
        <b prog="0"></b>
        <b prog="e"></b>
    </div>`;
}

function renderSkippedUpload(plaintextFilename, status) {
    status = status || "";
    return `<small>
        <span>${plaintextFilename}</span>
        <span>${status}</span>
    </small>`;
}

/**
 * Assigns upload to a slot # to be displayed on screen
 * @param {String} filename (i.e. p-12345.crypteefile)
 * @param {Number} slotNo (can be 1 2 3 or 4)
 */
function assignUploadToSlotNo(filename, slotNo) {
    var uploadID = filenameToUploadID(filename);
    slotNo = parseInt(slotNo);
    $(`.upload[id="${uploadID}"]`).css("--slot", slotNo + "/" + (slotNo + 1) );
}

/**
 * Adds the filesize of original/thumbnail/lightbox sized photos to dom for accurate percentage calculation
 * @param {String} filename (i.e. p-12345.crypteefile)
 * @param {Number} bytesize The size in bytes (i.e. 1928367) 
 */
function addUploadVariantToUploader(filename, bytesize) {
    
    var variant = "";
    bytesize = bytesize || 0;
    
    var uploadID = filenameToUploadID(filename);
    
    var isOriginal  = uploadID.startsWith("p-") || uploadID.startsWith("v-") || uploadID.startsWith("r-");
    var isLightbox  = uploadID.startsWith("l-");
    var isThumbnail = uploadID.startsWith("t-");
    var isDocOrFile = uploadID.startsWith("d-");

    if (isOriginal)  { variant = "original";  }
    if (isLightbox)  { variant = "lightbox";  }
    if (isThumbnail) { variant = "thumbnail"; }
    if (isDocOrFile) { variant = "docorfile"; }

    if (!["original", "lightbox", "thumbnail", "docorfile"].includes(variant)) { 
        handleError("[UPLOADER] Invalid variant parameter!", {filename : filename}, "warning"); 
        return false; 
    }
    
    if (!bytesize) { 
        handleError("[UPLOADER] Photos upload filesize can't be zero!", {filename : filename}, "warning");  
        return false; 
    }
    
    // this makes it so that it's variant size agnostic t- / l- / p- / v- / r- are all going to choose the correct element
    uploadID = uploadID.split('-')[1] + "-" + uploadID.split('-')[2];
    $(`.upload[id$="${uploadID}"]`).attr(variant + "-bytesize", bytesize);

    updateUploadProgress(filename);
}


/**
 * Updates the total progress of an upload (calculates all variants etc)
 * @param {String} filename (i.e. "p-12345.cryptee")
 */
function updateUploadProgress(filename) {
    
    var uploadID = filenameToUploadID(filename);
    
    // this makes it so that it's variant size agnostic t- / l- / p- / v- / r- are all going to choose the correct element
    uploadID = uploadID.split('-')[1] + "-" + uploadID.split('-')[2];
    var uploadElem = $(`.upload[id$="${uploadID}"]`);

    // get bytesizes of each variant
    var originalBytesize  = parseInt(uploadElem.attr("original-bytesize")) || 0;  
    var lightboxBytesize  = parseInt(uploadElem.attr("lightbox-bytesize")) || 0;  
    var thumbnailBytesize = parseInt(uploadElem.attr("thumbnail-bytesize")) || 0;
    var docOrFileBytesize = parseInt(uploadElem.attr("docorfile-bytesize")) || 0;

    // get progresses of each variant (in %)
    var originalProgress  = parseFloat(uploadElem.attr("original-progress")) || 0;  
    var lightboxProgress  = parseFloat(uploadElem.attr("lightbox-progress")) || 0;  
    var thumbnailProgress = parseFloat(uploadElem.attr("thumbnail-progress")) || 0;
    var docOrFileProgress = parseFloat(uploadElem.attr("docorfile-progress")) || 0;

    // figure out how much of each variant is uploaded
    var originalUploadedBytes  = ((originalBytesize  * originalProgress) / 100) || 0;
    var lightboxUploadedBytes  = ((lightboxBytesize  * lightboxProgress) / 100) || 0;
    var thumbnailUploadedBytes = ((thumbnailBytesize * thumbnailProgress) / 100) || 0;
    var docOrFileUploadedBytes = ((docOrFileBytesize * docOrFileProgress) / 100) || 0;

    // find total uploaded bytes (sum of all upload variants)
    var uploadedBytesize = (originalUploadedBytes + lightboxUploadedBytes + thumbnailUploadedBytes + docOrFileUploadedBytes) || 0;
    
    // find total bytesize (sum of all upload variants)
    var totalBytesize    = (originalBytesize      + lightboxBytesize      + thumbnailBytesize      + docOrFileBytesize) || 0;

    // and from that, calculate the total percentage of this upload
    var totalPercentage  = ((100 * uploadedBytesize) / totalBytesize) || 0;

    // reflect it to dom
    uploadElem.attr("prog", padZeroes(parseInt(totalPercentage), 2));

    updateTotalUploadProgress();
    

}

function updateTotalUploadProgress() {
    
    var totalPercentage = 0;
    var numberOfUploads = $(".upload").length || 0;

    $(".upload").each(function(){
        
        var thisUploadProgress = $(this).attr("docorfile-progress") || $(this).attr("prog");

        var thisUploadPercentage = parseFloat(thisUploadProgress) || 0;

        if (thisUploadProgress === "done") { thisUploadPercentage = 100; } 

        var thisUploadIsXOfTotalPercentage = thisUploadPercentage / numberOfUploads;

        totalPercentage += thisUploadIsXOfTotalPercentage;

    });
    
    $("#uploader-status-detail").text(totalPercentage.toFixed(2) + "%");

}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	UPLOAD EVENTS
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Creates listeners for all upload-specific events and updates
 * @param {*} fileUpload 
 * @param {*} filename 
 * @param {*} filesize 
 */
 function subscribeToUploadEvents(fileUpload, filename, filesize) {
    
    filename = filename || "upload-" + newUUID() + "-v4";

    fileUpload.on('progress', progress => { onUploadProgress(fileUpload, filename, filesize, progress);   });
    fileUpload.on('success', () => {        onUploadSuccess(fileUpload, filename);                        });
    fileUpload.on('online', () => {         onUploaderOnline(fileUpload, filename);                       });
    fileUpload.on('offline', () => {        onUploaderOffline(fileUpload, filename);                      });
    
}

function onChunkSuccess(fileUpload, filename, info) {
    // var uploadID = filenameToUploadID(filename);

    var response = info.detail.response || {};
    var responseBody = response.body || "";
    
    var uploadMeta = {};
    
    try {
        uploadMeta = JSON.parse(responseBody);
    } catch (error) {
        handleError("[UPLOADER] Failed to parse uploadMeta from chunk upload response", error, "warning");
        return false;
    }

    // got the final upload's response
    if (uploadMeta && !isEmpty(uploadMeta) && uploadMeta.uploaded) { 
        return uploadMeta;
    }

    return false;

}

function onUploadProgress(fileUpload, filename, filesize, progress) {
    
    var uploadID = filenameToUploadID(filename);
    
    var filePercentage = progress.detail;
    
    var isOriginal  = uploadID.startsWith("p-") || uploadID.startsWith("v-") || uploadID.startsWith("r-");
    var isLightbox  = uploadID.startsWith("l-");
    var isThumbnail = uploadID.startsWith("t-");
    var isDocOrFile = uploadID.startsWith("d-");
    
    var shortPercentage = filePercentage.toFixed(2);

    // this makes it so that it's variant size agnostic t- / l- / p- / v- / r- are all going to choose the correct element
    uploadID = uploadID.split('-')[1] + "-" + uploadID.split('-')[2];
    var uploadElem = $(`.upload[id$="${uploadID}"]`);
    
    if (isOriginal)  { uploadElem.attr("original-progress",  shortPercentage); }
    if (isLightbox)  { uploadElem.attr("lightbox-progress",  shortPercentage); }
    if (isThumbnail) { uploadElem.attr("thumbnail-progress", shortPercentage); }
    if (isDocOrFile) { uploadElem.attr("docorfile-progress", shortPercentage); }
    
    updateUploadProgress(filename);

}




function onUploadError(fileUpload, filename, error) {
    error = error || {};
    error.filename = filename;
    handleError("[UPLOADER] Failed to upload file entirely", error, "warning");
    fileUpload.abort();
    updateUploaderState("error");
    // TODO ADD FUTHER INFO FOR USER HANDLING
}


/**
 * Updates upload's status to encrypting
 * @param {String} filename (pid, did, i.e. "p-12345" or "p-12345.crypteefile" etc)
 */
function onUploadEncrypting(filename) {
    var uploadID = filenameToUploadID(filename);
    $("#upload-" + uploadID).attr("prog", "encrypting");
}

function onUploadSuccess(fileUpload, filename) {
    var uploadID = filenameToUploadID(filename);
    breadcrumb(`[UPLOADER] [ ${filename} ] Uploaded!`);
}

/**
 * Called by uploader, when an upload is complete. After 2s, Checks to see if there's an upload in the uploader, and if not hides uploader. 
 */
function onUploadComplete() {
    setTimeout(function () {
        var noUploads = $(".upload[prog]").not("[prog='100']").length;
        if (noUploads <= 0) { hideUploader(); }
    }, 2000);
}

function onUploaderOnline(fileUpload, filename) {
    breadcrumb(`[UPLOADER] [ ${filename} ] Resuming Upload – Client back online!`);
    resumeUploads();
    updateUploaderState();
}

function onUploaderOffline(fileUpload, filename) {
    breadcrumb(`[UPLOADER] [ ${filename} ] Upload Interrupted – Client offline!`);
    pauseUploads();
    updateUploaderState("interrupted");
}



/**
 * Updates the uploader's state to a given state, i.e. paused (or removes all state if you leave state empty)
 * @param {('paused'|'interrupted'|'error'|'')} state 
 */
function updateUploaderState(state) {
    state = state || "";
    $("#uploader-wrapper").removeClass("paused interrupted error");
    if (state) { $("#uploader-wrapper").addClass(state); }
}


function pauseUploads() {
    breadcrumb('[UPLOADER] PAUSED.');
    for (var uploadFilename in activeUploads) {
        var upload = activeUploads[uploadFilename];
        upload.pause();
    }

    updateUploaderState("paused");
}

function resumeUploads() {
    breadcrumb('[UPLOADER] RESUMING...');
    for (var uploadFilename in activeUploads) {
        var upload = activeUploads[uploadFilename];
        upload.resume();
    }
    
    updateUploaderState();
}

function clickedUploaderActionButton() {
    var isError = $("#uploader-wrapper").hasClass("error");
    var isPaused = $("#uploader-wrapper").hasClass("paused");
    var isInterrupted = $("#uploader-wrapper").hasClass("interrupted");
    var isSkipped = $("#uploader-wrapper").hasClass("skipped");

    if (isPaused || isInterrupted) { 
        resumeUploads(); 
        return;
    }

    if (isSkipped) {
        toggleSkippedUploads();
        return;
    }
    
    if (isError) { 
        goToUpgrade();
        return;
    }

    pauseUploads();
}