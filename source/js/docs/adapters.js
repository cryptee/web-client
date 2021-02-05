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
    $("#file-viewer").removeClass("closed");
}

/**
 * hides the file viewer
 */
function closeFileViewer() {
    $("body").removeClass("split");
    $("#file-viewer").removeClass("reader maximized minimized");
    $("#file-viewer").addClass("closed");
    
    setTimeout(function () {
        $("#file-viewer-content").empty();
    }, 550);
    
    activeFileID = "";
    
    // refresh dom to reflect active file in recents/folder / remove name from file viewer
    refreshDOM();
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


$("#file-viewer-nav").on('swipeDown', function(event) {
    var cantMinimize = $("#file-viewer").hasClass("maximized") || $("#file-viewer").hasClass("loading") || $("body").hasClass("split");
    if (cantMinimize) { return; }
    $("#file-viewer").addClass("minimized");
}); 

$("#file-viewer-nav").on('swipeUp', function(event) {
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
 * starts file viewer progress
 */
function startFileViewerProgress() {
    $("#file-viewer").addClass("loading");
}


/**
 * stops file viewer progress
 */
function stopFileViewerProgress() {
    $("#file-viewer").removeClass("loading minimized maximized");
}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	FILE VIEWER
////////////////////////////////////////////////
////////////////////////////////////////////////


/**
 * Prepares the file viewer, loads the file contents into the viewer, and displays stuff in the viewer
 * @param {*} fileContents Plaintext / Uint8Array contents of file
 * @param {Object} doc A Document Object 
 * @param {string} [filename] Optional filename (i.e. when we call this from an attachment, name of which may not be decrypted in the catalog)
 */
async function loadFileIntoFileViewer(doc, fileContents, filename) {
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
        await displayImageFile(doc, fileContents);
    }
    
    // AUDIO 
    else if (["mp3"].includes(ext)) {
        await displayAudioFile(doc, fileContents);
    }

    // VIDEO
    else if (["mp4","mov"].includes(ext)) {
        await displayVideoFile(doc, fileContents);
    }

    // PDF
    else if (["pdf"].includes(ext)) {
        await displayPDFFile(doc, fileContents);
    }

    // EPUB
    else if (["epub"].includes(ext)) {
        await displayEPUBFile(doc, fileContents);
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

    handleError('[PREVIEW] – Unsupported Format (' + ext + ")", { did : did }, "info");

    createPopup(
        `unfortunately cryptee can't preview / load ${ext} on your current device yet. 
        we're working around the clock to add support for more filetypes & formats.<br> 
        <button id="download-unsupported-file-button" class="white bold" onclick="downloadUnsupportedFile('${did}');">click here to download this file instead.</button>`, "info", "unsupported-file");
    return true;
}



/**
 * Displays an image file in the file viewer
 * @param {Object} doc A document Object 
 * @param {*} plaintextContents 
 */
async function displayImageFile(doc, plaintextContents) {
    var did = doc.docid;
    
    var imgDataURL;
    if (did.endsWith("-v3")) {
        imgDataURL = blobToObjectURL(uInt8ArrayToBlob(plaintextContents, doc.mime));
    } else {
        imgDataURL = plaintextContents;
    }

    imgDataURL = sanitizeB64(imgDataURL);

    $("#file-viewer-content").html(`<img src="${imgDataURL}"/>`);
    return true;
}



/**
 * Displays an audio file in the file viewer
 * @param {Object} doc A document Object 
 * @param {*} plaintextContents 
 */
async function displayAudioFile(doc, plaintextContents) {
    
    var did = doc.docid;
    var filename = docName(doc);
    var ext = extensionFromFilename(filename);

    var audioDataURL;
    if (did.endsWith("-v3")) {
        audioDataURL = blobToObjectURL(uInt8ArrayToBlob(plaintextContents, doc.mime));
    } else {
        audioDataURL = plaintextContents;
    }

    var chrome = isChromium;
    if (chrome) { chrome = "chrome"; } else { chrome = ""; }

    audioDataURL = sanitizeB64(audioDataURL);

    $('#file-viewer-content').html(`
        <audio controls controlsList="nodownload" class="${chrome}">
            <source src='${audioDataURL}' type="audio/${ext}">
            <p>Looks like your browser does not support MP3 playback. Please download this file to hear it</p>
        </audio>
    `);

    return true;
}




/**
 * Displays a video file in the file viewer
 * @param {Object} doc A document Object 
 * @param {*} plaintextContents 
 */
async function displayVideoFile(doc, plaintextContents) {

    var did = doc.docid;
    var filename = docName(doc);
    var ext = extensionFromFilename(filename);

    var videoDataURL;
    if (did.endsWith("-v3")) {
        videoDataURL = blobToObjectURL(uInt8ArrayToBlob(plaintextContents, doc.mime));
    } else {
        videoDataURL = plaintextContents;
    }

    var chrome = isChromium;
    if (chrome) { chrome = "chrome"; } else { chrome = ""; }

    videoDataURL = sanitizeB64(videoDataURL);

    $('#file-viewer-content').html(`
        <video controls controlsList="nodownload" class="${chrome}">
            <source src='${videoDataURL}' type="video/mp4">
            <p>Looks like your browser does not support MP4 playback. Please download the file to hear it</p>
        </video>
    `);

    return true;
}



/**
 * Displays a PDF file in the file viewer
 * @param {Object} doc A document Object 
 * @param {*} plaintextContents 
 */
async function displayPDFFile(doc, plaintextContents) {

    var did = doc.docid;
    var filename = docName(doc);
    var ext = extensionFromFilename(filename);
    
    $('#file-viewer-content').html(`
        <iframe id="embeddedPDFViewer" src="../adapters/pdfjs-2.5.207/web/cryptee-viewer.html">
            <p>Looks like your browser does not support PDFs. Please download the PDF to view it</p>
        </iframe>
    `);

    var pdfjsframe = document.getElementById('embeddedPDFViewer');

    return new Promise(function(resolve, reject) {
        pdfjsframe.onload = function() {
            if (did.endsWith("-v3")) {
                // already a uint8array so use it
                pdfjsframe.contentWindow.PDFViewerApplication.open(plaintextContents);
            } else {
                // it's a b64, sanitize and convert to uint8array
                pdfjsframe.contentWindow.PDFViewerApplication.open(convertDataURIToBinary(sanitizeB64(plaintextContents)));
            }
            resolve();
        };
    });

}





/**
 * Displays an EPUB file in the file viewer
 * @param {Object} doc A document Object 
 * @param {*} plaintextContents 
 */
async function displayEPUBFile(doc, plaintextContents) {
    var did = doc.docid;

    if (!doc.decryptedTitle) {
        // this means doc wasn't in catalog, and its last page / bookmarks aren't in catalog either. 
        // load its parent folder & decrypt it first.
        
        await getFolder(doc.fid);
        await decryptCatalog(); // this calls refresh dom

        // now we should have a doc with all the bookmarks & page etc in catalog
        doc = await getDocFromCatalog(did);
    }

    var filename = docName(doc);
    var ext = extensionFromFilename(filename);

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
    bookmarks = [];

    for (var b64Location in bookmarksObject) {
        try { 
            var location = atob(b64Location); 
            bookmarks.push(location);
        } catch (e) {}
    }

    var epubReaderFrame = document.getElementById('embeddedEPUBReader');
    epubReaderFrame.onload = function () {
        
        var rwindow = epubReaderFrame.contentWindow;

        var epubBlob;
        if (did.endsWith("-v3")) { 
            epubBlob = uInt8ArrayToBlob(plaintextContents,"application/epub+zip");
        } else {
            epubBlob = uInt8ArrayToBlob(convertDataURIToBinary(sanitizeB64(plaintextContents)),"application/epub+zip");
        }
        
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