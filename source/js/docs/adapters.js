////////////////////////////////////////////////
////////////////////////////////////////////////
// 
//	FILE VIEWER / 3RD PARTY VIEWING ADAPTERS
// 
//  IMAGES
//  AUDIO
//  VIDEO
//  PDF
//  EPUB / EBOOKS
//  
////////////////////////////////////////////////
////////////////////////////////////////////////

var previewerSupportedExtensions = ["jpg","jpeg","png","gif","svg","webp","mp3","mp4","mov","pdf","epub"];



/**
 * shows the file viewer
 */
function showFileViewer() {
    $("#file-viewer").removeClass("closed modified");
}

/**
 * Closes the file viewer
 * @param {Boolean} [forceCloseWithoutSavingChanges] 
 */
function closeFileViewer(forceCloseWithoutSavingChanges) {
    forceCloseWithoutSavingChanges = forceCloseWithoutSavingChanges || false;
    
    var ext = $("#file-viewer").attr("ext");
    if (!forceCloseWithoutSavingChanges && $("#file-viewer").hasClass("modified")) {
        breadcrumb('[PDF VIEWER] Warning about unsaved changes');
        createPopup(`
            <strong class="uppercase">UNSAVED CHANGES</strong>
            This ${ext} has unsaved changes. What would you like to do?
            <br><br><br>
            <b    class="clickable" onclick="saveChangesToPDFAndClose();">save changes &amp; close</b>
            <br><br><br>
            <span class="clickable" onclick="hidePopup('popup-save-file-changes'); closeFileViewer(true);">close without saving</span>
        `, "warning", "save-file-changes");
        return;
    }

    $("body").removeClass("split");
    $("#file-viewer").removeClass("reader maximized minimized modified");
    $("#file-viewer").addClass("closed");
    
    // revoke object URL of the file in the viewer
    revokeObjectURL(getObjURLOfFileInViewer());
    
    setTimeout(function () { 
        $("#file-viewer-content").empty(); 
    }, 550);
    
    activeFileID = "";
    
    if (PDFViewerApplication) { PDFViewerApplication = undefined; }
    if (pdfChangesInterval) { 
        clearInterval(pdfChangesInterval); 
        breadcrumb('[PDF VIEWER] Stopped listening for changes');
    }

    // refresh dom to reflect active file in recents/folder / remove name from file viewer
    refreshDOM();
}


function getObjURLOfFileInViewer() {
    var imgObjURL, audioObjURL, videoObjURL, pdfObjURL;
    
    try {
        imgObjURL   = $("#file-viewer-content").find("img").attr("src") || "";
        audioObjURL = $("#file-viewer-content").find("source").attr("src") || "";
        videoObjURL = $("#file-viewer-content").find("source").attr("src") || "";
        pdfObjURL   = $("#embeddedPDFViewer").attr("dataURL") || "";
    } catch (e) {}

    return imgObjURL || audioObjURL || videoObjURL || pdfObjURL;
}

/**
 * minimizes the file viewer
 */
function minimizeFileViewer() {
    $("body").removeClass("split");
    $("#file-viewer").removeClass("maximized");
    $("#file-viewer").toggleClass("minimized");
}


/**
 * minimizes the file viewer
 */
function maximizeFileViewer() {
    $("body").removeClass("split");
    $("#file-viewer").toggleClass("maximized");
}


$("#file-viewer-nav")[0].addEventListener('swiped-down', function(event) {
    var cantMinimize = $("#file-viewer").hasClass("maximized") || $("#file-viewer").hasClass("loading") || $("body").hasClass("split");
    if (cantMinimize) { return; }
    $("#file-viewer").addClass("minimized");
}); 

$("#file-viewer-nav")[0].addEventListener('swiped-up', function(event) {
    var cantMinimize = $("#file-viewer").hasClass("maximized") || $("#file-viewer").hasClass("loading") || $("body").hasClass("split");
    if (cantMinimize) { return; }
    $("#file-viewer").removeClass("minimized");
}); 



/**
 * minimizes the file viewer
 */
function splitFileViewer() {
    $("body").toggleClass("split");
    $("#file-viewer").removeClass("maximized");
}


/**
 * Shows / updates file viewer progress 
 */
function startFileViewerProgress() {
    $("#file-viewer").addClass("loading");
}


/**
 * Stops file viewer progress
 */
function stopFileViewerProgress() {
    $("#file-viewer").removeClass("loading minimized maximized");
    $("#file-viewer").find("#active-filename").removeAttr("progress");
}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	FILE VIEWER
////////////////////////////////////////////////
////////////////////////////////////////////////


/**
 * Prepares the file viewer, loads the file contents into the viewer, and displays stuff in the viewer
 * @param {Object} doc A Document Object 
 * @param {string} [filename] Optional filename (i.e. when we call this from an attachment, name of which may not be decrypted in the catalog)
 */
async function loadFileIntoFileViewer(doc, filename) {
    filename = filename || docName(doc);
    var ext = extensionFromFilename(filename);

    if (isSafari || isios || isipados) {$("#file-viewer-content").addClass("safari"); }
    if (isios || isipados) {$("#file-viewer-content").addClass("ios"); }

    breadcrumb('[LOAD FILE] – Supported Format (' + ext + ")");
    breadcrumb('[LOAD FILE] Preparing viewer for ' + doc.docid);
    $("#file-viewer-content").empty();
    $("#file-viewer").attr("ext", ext);

    // IMAGES
    if (["jpg","jpeg","png","gif","svg","webp"].includes(ext)) {
        try { 
            var imgDataURL = await downloadAndDecryptFile(doc.docid, null, "url", filename, doc.mime, null, doc, true); 
            await displayImageFile(doc, imgDataURL);
        } catch (error) { err(doc.docid, error); }
    }
    
    // AUDIO 
    else if (["mp3"].includes(ext)) {
        try { 
            var audioDataURL = await downloadAndDecryptFile(doc.docid, null, "url", filename, doc.mime, null, doc, true); 
            await displayAudioFile(doc, audioDataURL);
        } catch (error) { err(doc.docid, error); }
    }

    // VIDEO
    else if (["mp4","mov"].includes(ext)) {
        try { 
            var videoDataURL = await downloadAndDecryptFile(doc.docid, null, "url", filename, doc.mime, null, doc, true); 
            await displayVideoFile(doc, videoDataURL);
        } catch (error) { err(doc.docid, error); }
    }

    // PDF
    else if (["pdf"].includes(ext)) {
        try { 
            var pdfDataURL = await downloadAndDecryptFile(doc.docid, null, "url", filename, doc.mime, null, doc, true); 
            await displayPDFFile(doc, pdfDataURL);
        } catch (error) { err(doc.docid, error); }

    }

    // EPUB
    else if (["epub"].includes(ext)) {
        try { 
            var epubBlob = await downloadAndDecryptFile(doc.docid, null, "blob", filename, "application/epub+zip", null, doc, true); 
            await displayEPUBFile(doc, epubBlob);
        } catch (error) { err(doc.docid, error); }
    }

    // ZIP FILES
    // else if (["zip"].includes(ext)) {
    //     await displayZipFile(doc, fileContents);
    //
    //     already using this for epubs. just load it in docs.kit when you impletement it
    //     https://stuk.github.io/jszip/documentation/api_jszip/load_async.html
    // }

    activeFileID = doc.docid;
    showFileViewer();

    return true;

    function err(did, error) {
        var errObj = {};
        try { if (error) { errObj = error; } } catch (e) {}
        errObj.did = did;
        handleError("[LOAD FILE] Failed to download / decrypt file, got no contents.", errObj);
        createPopup(`Failed to load your file <b>${docName(doc)}</b>. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        failedToLoadFile(did);
        return false;
    }
}


/**
 * Displays an unsupported file download prompt in thew file viewer
 * @param {Object} doc A document Object 
 * @param {string} [filename] Optional filename (i.e. when we call this from an attachment, name of which may not be decrypted in the catalog)
 */
async function displayUnsupportedFile(doc, filename) {
    var did = doc.docid;
    filename = filename || docName(doc) || "";
    var ext = extensionFromFilename(filename);
    if (!ext) { 
        ext = "files with this extension"; 
    } else {
        ext = "<strong>" + ext + "</strong> files"; 
    }

    createPopup(
        `unfortunately cryptee can't preview / load ${ext} on your current device yet. 
        we're working around the clock to add support for more filetypes & formats.<br> 
        <button id="download-unsupported-file-button" class="white bold" onclick="downloadUnsupportedFile('${did}');">click here to download this file instead.</button>`, "info", "unsupported-file");
    return true;
}



/**
 * Displays an image file in the file viewer
 * @param {Object} doc A document Object 
 * @param {String} dataURL (Either a BlobURL or B64 DataURI) to be placed in img src tag
 */
async function displayImageFile(doc, dataURL) {
    $("#file-viewer-content").html(`<img src="${dataURL}"/>`);
    return true;
}



/**
 * Displays an audio file in the file viewer
 * @param {Object} doc A document Object 
 * @param {String} audioDataURL (Either a BlobURL or B64 DataURI) to be placed in audio src tag
 */
async function displayAudioFile(doc, audioDataURL) {
    
    var filename = docName(doc);
    var ext = extensionFromFilename(filename);
    var mime = doc.mime || "audio/" + ext;

    var chrome = isChromium;
    if (chrome) { chrome = "chrome"; } else { chrome = ""; }

    $('#file-viewer-content').html(`
        <audio controls controlsList="nodownload" class="${chrome}">
            <source src='${audioDataURL}' type="${mime}">
            <p>Looks like your browser does not support MP3 playback. Please download this file to hear it</p>
        </audio>
    `);

    return true;
}




/**
 * Displays a video file in the file viewer
 * @param {Object} doc A document Object 
 * @param {String} (Either a BlobURL or B64 DataURI) to be placed in video src tag 
 */
async function displayVideoFile(doc, videoDataURL) {

    var filename = docName(doc);
    var ext = extensionFromFilename(filename);
    var mime = doc.mime || "video/" + ext;

    var chrome = isChromium;
    if (chrome) { chrome = "chrome"; } else { chrome = ""; }

    $('#file-viewer-content').html(`
        <video controls controlsList="nodownload" class="${chrome}">
            <source src='${videoDataURL}' type="${mime}">
            <p>Looks like your browser does not support MP4 playback. Please download the file to hear it</p>
        </video>
    `);

    $("#file-viewer-content").attr("src", videoDataURL);

    return true;
}






/**
 * Displays an EPUB file in the file viewer
 * @param {Object} doc A document Object 
 * @param {*} epubBlob (Either a BlobURL or B64 DataURI) to be loaded to the epub reader 
 */
async function displayEPUBFile(doc, epubBlob) {
    var did = doc.docid;

    if (!doc.decryptedTitle) {
        // this means doc wasn't in catalog, and its last page / bookmarks aren't in catalog either. 
        // load its parent folder & decrypt it first.
        
        await getFolder(doc.fid);
        await decryptCatalog(); // this calls refresh dom

        // now we should have a doc with all the bookmarks & page etc in catalog
        doc = await getDocFromCatalog(did);
    }

    $('#file-viewer-content').html(`
        <iframe id="embeddedEPUBReader" src="../adapters/epub-reader/index.html">
            <p>Looks like your browser does not support displaying EPUB files. Please download the file to view it</p>
        </iframe>
    `);

    // prepare bookmarks / last page etc
    var lastZoom; 
    try {
        lastZoom = localStorage.getItem("epub-zoom") || 100;
    } catch (error) { lastZoom = 100; }

    var bookmarksObject = doc.bookmarks || {};
    var page = doc.page || "";
    var bookmarks = [];

    for (var b64Location in bookmarksObject) {
        try { 
            var location = atob(b64Location); 
            bookmarks.push(location);
        } catch (e) {}
    }

    var epubReaderFrame = document.getElementById('embeddedEPUBReader');
    epubReaderFrame.onload = function () {
        
        var rwindow = epubReaderFrame.contentWindow;

        rwindow.reader = rwindow.ePubReader(epubBlob, {
            replacements: 'blobUrl',
            bookmarks: bookmarks,
            previousLocationCfi: page
            // restore: true
            // optionally, you can look into this.
            // openAs : "binary" 
        });

        rwindow.reader.rendition.themes.fontSize(lastZoom + "%");
        $("#file-viewer").attr("zoom", lastZoom);
        $("#file-viewer").removeClass("epubLight");

        rwindow.reader.on("reader:page", function (location) {
            saveEPUBPage(did, location);
        });

        rwindow.reader.on("reader:bookmarked", function (location) {
            addEPUBBookmark(did, location);
        });

        rwindow.reader.on("reader:unbookmarked", function (bookmark, location) {
            deleteEPUBBookmark(did, location);
        });
    };

}


// var activeZipFile;

/**
 * Loads a zip file / similar compressed collection into the previewer.
 * @param {*} doc A document Object
 * @param {*} fileContents Contents of a zip file
 */

//  async function displayZipFile(doc, fileContents) {
    
//     var did = doc.docid;
//     var filename = docName(doc);
//     var ext = extensionFromFilename(filename);

//     var zip = new JSZip();
//     if (did.endsWith("-v3")) {
//         activeZipFile = await zip.loadAsync(fileContents);
//     } else {
//         activeZipFile = await zip.loadAsync(fileContents, {base64:true});
//     }

//     console.log(activeZipFile.files);
// }






////////////////////////////////////////////////
////////////////////////////////////////////////
//	
// PDF
//
////////////////////////////////////////////////
////////////////////////////////////////////////

var pdfChangesInterval;
var PDFViewerApplication;

/**
 * Displays a PDF file in the file viewer
 * @param {Object} doc A document Object 
 * @param {String} (Either a BlobURL or B64 DataURI) to be loaded into the PDF viewer 
 */
 async function displayPDFFile(doc, pdfDataURL) {

    // var did = doc.docid;
    // var filename = docName(doc);
    // var ext = extensionFromFilename(filename);
    // var modified = doc.modified;

    var dataURL = "";
    if (pdfDataURL.startsWith("blob:")) { dataURL = pdfDataURL; }

    $('#file-viewer-content').html(`
        <iframe id="embeddedPDFViewer" src="../adapters/pdfjs-2.12.313/web/cryptee-viewer.html" dataURL="${dataURL}">
            <p>Looks like your browser does not support PDFs. Please download the PDF to view it</p>
        </iframe>
    `);

    var pdfjsframe = document.getElementById('embeddedPDFViewer');

    return new Promise(function(resolve, reject) {
        pdfjsframe.onload = function() {

            PDFViewerApplication = pdfjsframe.contentWindow.PDFViewerApplication;
            PDFViewerApplication.open(pdfDataURL);
            breadcrumb('[PDF VIEWER] Started listening for changes');
            pdfChangesInterval = setInterval(checkPDFChanges, 1000);
            resolve();
            
        };
    });

}

/**
 * Every 1 second, checks the PDF in the previewer for changes
 */
async function checkPDFChanges() {
    var annotations; 
    var modified = false;
    try {
        annotations = await PDFViewerApplication.pdfDocument.annotationStorage;
    } catch (e) {}
    
    if (!annotations) { return; }
    
    modified = annotations._modified; 
    
    if (annotations.size > 0 && modified) {
        $("#file-viewer").addClass("modified");       
    } else {
        $("#file-viewer").removeClass("modified");
    }

}


var savingChangesToPDF = false;
async function saveChangesToPDF() {
    
    if (savingChangesToPDF) { return false; }

    $("#file-viewer").addClass("saving"); 
    $("#pdfSaveChanges").addClass("loading"); 
    hidePopup('popup-save-file-changes');
    
    savingChangesToPDF = true;

    var annotations; 

    try {
        annotations = await PDFViewerApplication.pdfDocument.annotationStorage;
    } catch (e) {}
    
    // nothing to save, abort
    if (!annotations) { return true; }
    if (annotations.size <= 0) { return true; }


    var filename = await getDocNameFromCatalog(activeFileID);
    if (!filename) { filename = "Document.pdf"; }

    //
    //
    // READ PDF FILE'S CONTENT AS A BUFFER
    //
    //
    var fileBuffer;
    try {
        breadcrumb('[PDF VIEWER] Attempting to save changes');
        breadcrumb('[PDF VIEWER] Reading PDF file buffer');
        
        // returns a buffer
        fileBuffer = await PDFViewerApplication.pdfDocument.saveDocument();
        breadcrumb('[PDF VIEWER] Read PDF file buffer.');
    } catch (error) {
        err('[PDF VIEWER] Failed to read PDF file buffer / saveDocument.', error);
        return;
    }
    
    activityHappened();
    if (!fileBuffer) { err(); return false; }



    // update uploader status
    var uploadID = filenameToUploadID(activeFileID + ".crypteefile");
    onUploadEncrypting(uploadID);

    // choose and lock a slot for this upload
    var slotNo = chooseAnAvailableSlot();
    assignUploadToSlotNo(uploadID, slotNo);

    var fileUpload; 
    if (activeFileID.endsWith("-v4")) {
        breadcrumb('[PDF VIEWER] Encrypting & Uploading V4 PDF Changes');
        fileUpload = await encryptAndUploadV4PDF(fileBuffer, uploadID);
    } else {
        breadcrumb('[PDF VIEWER] Encrypting & Uploading Legacy PDF Changes');
        fileUpload = await encryptAndUploadLegacyPDF(fileBuffer);
    }

    if (!fileUpload) { err(); return false; }
    var pdfGen = parseInt(fileUpload.generation);
    var pdfSize = parseInt(fileUpload.size);
    //
    //
    // SAVE ITS META
    //
    //

    var metaSavedToServer, metaSavedToCatalog;
    var pdfMeta = { size : pdfSize, modified : pdfGen || (new Date()).getTime() * 1000 };
    metaSavedToServer = await setDocMeta(activeFileID, pdfMeta);
    metaSavedToCatalog = await setDocMetaInCatalog(activeFileID, pdfMeta);
    activityHappened();

    // this is only a problem if the file isn't v3 / v4 – 
    // technically speaking, we can make do without the modified tag in non v3 / v4 files, 
    // so we won't abort here unnecessarily 
    // and won't panic the user
    if ((!metaSavedToServer || !metaSavedToCatalog) && !activeFileID.endsWith("-v3") && !activeFileID.endsWith("-v4")) {
        err('[PDF VIEWER] Failed to save v1/v2 PDF file meta to server or catalog.', error);
        return false;
    }

    $("#file-viewer").removeClass("saving");
    $("#file-viewer").removeClass("modified");
    $("#pdfSaveChanges").removeClass("loading");

    doneWithSlot(slotNo);

    savingChangesToPDF = false;

    return true;
    
    function err(msg, error) {
        msg = msg || "";
        if (msg) {
            handleError(msg, error);
            createPopup("Cryptee wasn't able to save / encrypt / upload your changes to this PDF. Chances are this means the PDF is write-protected, or there's some type of corruption. We recommend downloading this PDF and filling it out using another PDF editor.","error");
        }
        $("#file-viewer").removeClass("saving");
        $("#pdfSaveChanges").removeClass("loading");
        savingChangesToPDF = false;
    }

}

function saveChangesToPDFAndClose() {
    saveChangesToPDF().then((saved)=>{
        if (saved) {
            closeFileViewer(true);
        }
    });
}

/**
 * Encrypt and upload a legacy (v1,v2,v3) PDF file (mimics uploader.js encryptAndUploadFile)
 * @param {*} fileBuffer 
 * @returns fileUpload
 */
async function encryptAndUploadLegacyPDF(fileBuffer) {

    var fileCiphertext;
    try {
        fileCiphertext = await encryptUint8Array(new Uint8Array(fileBuffer), [theKey]);
    } catch (error) {
        err('[PDF VIEWER] Failed to encrypt PDF file', error);
        return;
    }  

    activityHappened();
    if (!fileCiphertext || isEmpty(fileCiphertext)) { err(); return false; }

    // 
    // UPLOAD FILE (WE WILL ALWAYS UPLOAD THESE AS IF THEY'RE V3, AND TAG THEM WITH A META : "modified" : timestamp)
    // WHEN OPENING PDFS WE'LL CHECK AND SEE IF THE FILE HAS "MODIFIED". IF IT DOES, WE'LL OPEN IT LIKE V3. 
    // 
    var fileUpload;

    try {
        fileUpload = await uploadFile(JSON.stringify(fileCiphertext), activeFileID + ".crypteefile", true);
    } catch (error) {
        err('[PDF VIEWER] Failed to upload encrypted PDF file', error);
        return false;
    }

    return fileUpload;

}

async function encryptAndUploadV4PDF(fileBuffer, uploadID) {
    
    // generate keys if necessary
    var fileKeys = [theKey];
    var { fileKey, wrappedKey } = await generateDocFileKeyIfNecessary(activeFileID); 
    if (fileKey && wrappedKey) { fileKeys.push(fileKey); }
    
    // v4 uploads are blobs/files, so let's turn that buffer into a file: 
    var plaintextPDFBlob = uInt8ArrayToBlob(new Uint8Array(fileBuffer), "application/pdf");

    var encryptedFile = await streamingEncrypt(plaintextPDFBlob, fileKeys);
    if (!encryptedFile) { return err("[PDF VIEWER] Couldn't encrypt v4 file"); }
    
    addUploadVariantToUploader(uploadID, encryptedFile.size);

    var fileUpload = await streamingUploadFile(encryptedFile, activeFileID + ".crypteefile", true);
    if (!fileUpload) { return err("[PDF VIEWER] Failed to upload v4 file"); }
    if (fileUpload === "exceeded") { return err("[PDF VIEWER] Failed to upload v4 file. Exceeded Storage Quota!"); }

    activityHappened();
}