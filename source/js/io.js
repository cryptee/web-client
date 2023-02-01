////////////////////////////////////////////////
////////////////////////////////////////////////
//	
// SERVERS / FILES / CRUD / GET / POST / PUT
// ALL REQUESTS ... EVERYTHING
// ALL INPUT / OUTPUT TAKES PLACE HERE
// WHENEVER POSSIBLE OF COURSE ...
// 
////////////////////////////////////////////////
////////////////////////////////////////////////

var apiROOT = location.origin;
if (location.origin.startsWith("http://localhost") || location.origin.startsWith("https://localhost")) {
    apiROOT = "https://alfa.crypt.ee";
}

// For cancelling uploads / downloads
var CancelToken = axios.CancelToken;

////////////////////////////////////////////////
////////////////////////////////////////////////
//	AUTHENTICATED GET REQUEST SHORTCUT (API)
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Make an API call to /path with data
 * @param {string} path The API path (i.e. .../api/v3/keycheck)
 * @param {Object} [params] The Request Parameters
 * @param {Object} [data] The Request Data
 * @param {string} [method] The Request Method (it'll default to GET or POST if excluded, based on the availability of data)
 * @param {number} [timeout] The Request Timeout (it'll default to 30 seconds)
 * @returns {Object} response The Request Response
 */
async function api(path, params, data, method, timeout) {
    timeout = timeout || 30;

    if (!theUser) {
        handleError("[API] Can't make authenticated API call, theUser doesn't exist.");
        return false;
    }

    var idToken, apiResponse;
    
    // first get id token for getting auth for the api call

    try {
        idToken = await getIdTokenOnceAuthenticated();
        // breadcrumb("[API] Got ID Token");
    } catch (error) {
        handleError("[API] Can't call /"+path+", couldn't get ID token", error);
        return false;
    }

    // Now let's make the API call

    var apiURL = apiROOT + "/api/v3/" + path;
    
    var axiosConfig = {
        method: "GET",
        url: apiURL,
        headers: { 
            "Authorization": "Bearer " + idToken, 
            "Content-Type" : "application/x-www-form-urlencoded" 
        },
        timeout: timeout * 1000 // in case if shit hits the fan, this will fail in 30 seconds
    };

    if (data) {  
        axiosConfig.data = data; 
        axiosConfig.method = "POST";
        axiosConfig.headers["Content-Type"] = "application/json";
    }

    if (params) {  
        axiosConfig.params = params; 
    }

    if (method) {
        axiosConfig.method = method;
    }

    try {
        breadcrumb("[API] Requesting " + path);
        apiResponse = await axios(axiosConfig);
    } catch (error) {

        if (error.code === "ECONNABORTED") {
            // ECONNABORTED = aborted (i.e. when user navigates away from page before request is completed or when connection is timed out)
            // handleError("[API] Request to " + path + " timed out / aborted", error.response, "info");
        } else {
            handleError("[API] Request to " + path + " failed", error.response);
        }
        
        return false;
    }

    return apiResponse;
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	UPLOAD FILE
////////////////////////////////////////////////
////////////////////////////////////////////////

var ongoingUploads = {};


/**
 * This uploads a v3-doc / v3-file. (Now only in use for V3/Legacy docs & updated v3 files (i.e. pdfs), everything else is uploaded streaming)
 * @param {string} rawTextContents Contents of the File
 * @param {string} filename Full name of the file (i.e. "12345.crypteefile")
 * @param {boolean} [inBackground] (for use in Docs) – if it's a background upload, progress bar isn't updated
 * @returns {Object} fileMeta
 * @returns {string} fileMeta.size The Filesize 
 * @returns {string} fileMeta.generation The File's Generation / Timecode 
 */
async function uploadFile(rawTextContents, filename, inBackground) {
    if (!rawTextContents) {
        handleError("[UPLOAD] Failed to upload, content is missing!");
        return false;
    }

    if (!filename) {
        handleError("[UPLOAD] Failed to upload, filename is missing!");
        return false;
    }

    if (!theUserID) {
        handleError("[UPLOAD] Failed to upload, UID is missing!");
        return false;
    }

    var fileUpload, fileMeta, idToken;
    inBackground = inBackground || false;

    // first get id token for getting auth for the upload

    try {
        idToken = await getIdTokenOnceAuthenticated();
        // breadcrumb("[API] Got ID Token");
    } catch (error) {
        handleError("[API] Can't call /"+path+", couldn't get ID token", error);
        return false;
    }

    var uploadURL = apiROOT + "/api/upload";

    var uploadStarted = (new Date()).getTime();
    breadcrumb("[UPLOAD] Uploading " + filename);

    var headers = { 
        "Authorization": "Bearer " + idToken,
        "Content-Type": "application/octet-stream"
    };

    var uploadID = filenameToUploadID(filename);

    try {
        fileUpload = await axios({
            method: "post",
            url: uploadURL,
            params: { uid:  theUserID, file: filename },
            headers: headers,
            data: rawTextContents,
            onUploadProgress: function (progressEvent) {
                uploadProgress(filename, progressEvent.loaded, progressEvent.total, inBackground);
            },
            cancelToken: new CancelToken(function executor(c) {
                ongoingUploads[uploadID] = { abort : c };
            })
        });
    } catch (error) {
        if (axios.isCancel(error)) {
            return "aborted";
        } else {
            if (error.response) {
                if (error.response.status === 507) {
                    // out of storage
                    handleError("[UPLOAD] User doesn't have enough storage for this upload!", { filename : filename }, "info");
                    await getUpdatedRemainingStorage();
                    return "exceeded";
                } else {
                    // other error
                    error.response.filename = filename;
                    handleError("[UPLOAD] Upload failed with status: " + error.response.status, error.response, "warning");
                    return false;
                }
            } else {
                error.filename = filename;
                handleError("[UPLOAD] Failed to upload!", error);
                return false;
            }
        }
    }

    var uploadFinished = (new Date()).getTime();
    var uploadTime = uploadFinished - uploadStarted;

    fileMeta = fileUpload.data || {};
    
    if (!fileMeta.generation || !fileMeta.size || !fileMeta.token) {
        handleError("[UPLOAD AUTH] Upload Succeeded, but didn't get meta for file", { filename : filename });
        return false;
    }

    updateRemainingStorage(fileMeta.remainingStorage);

    var formattedFilesize = formatBytes(fileMeta.size);
    breadcrumb("[UPLOAD] Upload Complete. ( " + filename + " ) Took " + uploadTime + "ms to upload " + formattedFilesize);

    // mark doc upload = done
    $(`.upload[id="${uploadID}"]`).attr("prog", "done"); 

    // check if there's any other uploads left, or hide uploader
    onUploadComplete();
    
    delete ongoingUploads[uploadID];

    return fileMeta;
}

function uploadProgress(filename, loaded, total, inBackground) {
    
    var percentCompleted;
    inBackground = inBackground || false;

    var uploadID = filenameToUploadID(filename);

    addUploadVariantToUploader(filename, total);
    
    // document is backgrounded mid-save, show uploader now
    if (uploadID !== activeDocID) { showUploader(); }
    
    percentCompleted = ((loaded * 100) / total).toFixed(2).toString();
    $(`.upload[id="${uploadID}"]`).attr("docorfile-progress", percentCompleted);
    updateUploadProgress(filename);

    if (!inBackground) { updateRightProgress(loaded, total, "yellow"); }

    activityHappened();

}


/**
 * Cancels the upload of filename
 * @param {string} filename cancel uploading the file with filename
 */
function cancelUpload(filename) {
    if (!filename) { return false; }

    if (!filename.endsWith(".crypteefile") || !filename.endsWith(".crypteedoc")) {
        filename = filename + ".crypteefile";
    }

    var uploadID = filenameToUploadID(filename);

    if (ongoingUploads[uploadID]) {
        breadcrumb('[UPLOAD] Canceling: ' + uploadID);
        ongoingUploads[uploadID].abort();
    }
}













////////////////////////////////////////////////
////////////////////////////////////////////////
//	DOWNLOAD FILE
////////////////////////////////////////////////
////////////////////////////////////////////////

var ongoingDownloads = {};

/**
 * Gets a download authorization for the given filename.
 * @param {string} filename name of the file to download
 * @returns {Object} downloadAuth
 * @returns {string} downloadAuth.token the download token
 * @returns {string} downloadAuth.size the filesize
 * @returns {string} downloadAuth.generation the generation
 */
async function getDownloadAuth(filename) {
    if (!filename) {
        handleError("[DOWNLOAD AUTH] Can't sign download, filename is missing.");
        return false;
    }

    var downloadAuthResponse, downloadAuth;

    try {
        breadcrumb("[DOWNLOAD AUTH] Sending Auth Request");
        downloadAuthResponse = await api("download-auth", {file:filename});
    } catch (error) {
        handleError("[DOWNLOAD AUTH] Can't sign download, couldn't fetch download auth token", error);
        return false;
    }

    if (downloadAuthResponse.status === 200) {
        
        downloadAuth = downloadAuthResponse.data;

    } else if (downloadAuthResponse.status === 404) {
        // missingFile(filename); // TODO – v3.1 – missingFile(filename) – 
        breadcrumb("[DOWNLOAD AUTH] Download Auth Failed. Missing File.");
        return false;
    } else {
        handleError("[DOWNLOAD AUTH] Download Auth Failed. Couldn't get download token.");
        return false;
    }

    downloadAuth = downloadAuth || {};
    if (!downloadAuth.size || !downloadAuth.generation || !downloadAuth.token) {
        handleError("[DOWNLOAD AUTH] Can't sign download, download auth missing size, generation or token.");
        return false;
    }

    breadcrumb("[DOWNLOAD AUTH] Got downloadAuth");

    return downloadAuth;
}




/**
 * 
 * @param {string} filename The full name of the file to download (i.e. 12345.crypteedoc )
 * @param {string} [token] An optional download token, if not provided, we'll make a getDownloadAuth request to get it.
 * @param {boolean} [useStreamingDownload] Optionally, use the streaming download API (if the file is too large, and would need to be JSON parsed on client instead of server)
 * @returns {Promise<string>} ciphertext The Encrypted contents of the downloaded file
 */
async function downloadFile(filename, token, useStreamingDownload) {
    
    useStreamingDownload = useStreamingDownload || false;

    if (!filename) {
        handleError("[DOWNLOAD] Failed to download, filename is missing!");
        return false;
    }

    if (!filename.endsWith(".crypteefile") && !filename.endsWith(".crypteedoc")) {
        filename = filename + ".crypteefile";
    }
    
    if (!theUserID) {
        handleError("[DOWNLOAD] Failed to download, UID is missing!");
        return false;
    }

    cancelDownload(filename);

    if (!token) {
        breadcrumb('[DOWNLOAD] No Download Token provided, requesting download auth / token');
        // TODO – v3.1 – IF IT'S A THUMBNAIL / LIGHTBOX IMAGE, AND WE WERE MISSING TOKEN, ONE WE GET THIS, SAVE IT TO SERVER LATER TO SPEED THINGS UP
        try {
            var downloadAuth = await getDownloadAuth(filename);
            token = downloadAuth.token;
        } catch (error) {
            handleError("[DOWNLOAD] Failed to get download auth / token!");
            return false;
        }
    } else {
        // breadcrumb('[DOWNLOAD] Download Token provided');
    }

    // if we still couldn't get the token, abort sooner, since the next call will fail without a token
    if (!token) { return false; }

    var streamingDownload = "0";
    if (useStreamingDownload) { streamingDownload = "1"; }

    var downloadURL = apiROOT + "/api/download";

    var fileDownload;

    try {
        fileDownload = await axios({
            method: "get",
            url: downloadURL,
            params: {
                s: streamingDownload,
                u: theUserID,
                f: filename,
                t: token,
            },
            onDownloadProgress: function (progressEvent) {
                downloadProgress(filename, progressEvent.loaded, progressEvent.total);
            },
            cancelToken: new CancelToken(function executor(c) {
                ongoingDownloads[filename] = { abort : c };
            })
        });
    } catch (error) {
        if (axios.isCancel(error)) {
            return "aborted";
        } else {
            if (error.code !== "ECONNABORTED") {
                error.filename = filename;
                fileDownload = error.request;
                handleError("[DOWNLOAD] Failed to download!", error);
            }
        }
    }

    // main API had an emotional breakdown, because file is too large to json parse.
    // stream the file down, and parse it here instead.

    if (fileDownload.status === 422) {
        handleError("[DOWNLOAD] Download failed with status: 422", { filename : filename }, "warning");
        breadcrumb("[DOWNLOAD] Will try stream-downloading and parsing here instead");
        return await downloadFile(filename, token, true); // true to use streaming download.
    }

    if (fileDownload.status !== 200) {
        handleError("[DOWNLOAD] Download failed with status: " + fileDownload.status, { filename : filename }, "warning");
        return false;
    } 

    // if the file is too large, we'll terminate the regular download, and instead download the file using the streaming downloader.
    // this means the response will need to be JSON parsed on client, here.
    // because the response type is json, axios will do the parsing, so as hilarious as it sounds like, you just need to return data.data
    if (useStreamingDownload) {
        return fileDownload.data.data;
    }

    delete ongoingDownloads[filename];

    // breadcrumb("[DOWNLOAD] Downloaded. ( " + filename + " )");
    return fileDownload.data;
    
}




/**
 * Cancels the download of filename
 * @param {string} filename cancel downloading the file with filename
 */
function cancelDownload(filename) {
    if (!filename) {
        // likely an album without thumbnail
        return false;
    }

    if (!filename.endsWith(".crypteefile") || !filename.endsWith(".crypteedoc")) {
        filename = filename + ".crypteefile";
    }

    if (ongoingDownloads[filename]) {
        // for fetch & axios this is now abort as well
        try { ongoingDownloads[filename].abort(); } catch (e) {}
    }
}




function downloadProgress(filename, loaded, total) {
    // downloadProgress – Monitor all downloads' progresses using this function, both for docs & photos etc.
    // FOR POSTERITY IF YOU NEED IT.
    var progress = "";

    if (loaded) {
        loaded = formatBytes(loaded) + " / ";
    } else {
        loaded = "";
    }

    if (total) {
        total = formatBytes(total);
    } else {
        total = "unknown";
    }

    progress = loaded + total;

    if (
        $("#file-viewer").length && 
        $("#file-viewer").hasClass("loading") &&
        filename.endsWith(".crypteefile")
    ) {
        $("#active-filename").attr({ progress : progress });
    }

}












////////////////////////////////////////////////
////////////////////////////////////////////////
//	STREAMING UPLOAD FILE
////////////////////////////////////////////////
////////////////////////////////////////////////

var activeUploads = {};

/**
 * Streaming uploads a file, and returns uploadMeta
 * @param {*} blob 
 * @param {String} filename 
 * @param {Boolean} inBackground 
 * @returns uploadMeta
 */
async function streamingUploadFile(blob, filename, inBackground) {

    if (!blob) {
        handleError("[UPLOAD - STREAM] Failed to upload, file blob is missing!");
        return false;
    }

    if (!filename) {
        handleError("[UPLOAD - STREAM] Failed to upload, filename is missing!");
        return false;
    }

    if (!theUserID) {
        handleError("[UPLOAD - STREAM] Failed to upload, UID is missing!");
        return false;
    }

    var fileUpload, idToken, streamUploadMeta;
    inBackground = inBackground || false;

    var filesize = blob.size;

    // 
    // 
    // STEP 1 – GET ID TOKEN & GET AUTH'D FOR THE UPLOAD
    // 
    // 

    try {
        idToken = await getIdTokenOnceAuthenticated();
        // breadcrumb("[API] Got ID Token");
    } catch (error) {
        handleError("[API] Can't call /"+path+", couldn't get ID token", error);
        return false;
    }

    // 
    // 
    // STEP 2 – SEND STREAMING UPLOAD START COMMAND & WARM UP THE SERVER
    // 
    // 

    var startStreamingUploadURL = apiROOT + "/api/chupload";
    breadcrumb("[UPLOAD - STREAM] Stream uploading " + filename);

    var headers = { 
        "Authorization": "Bearer " + idToken,
        "Content-Type": "application/octet-stream"
    };

    var startBody = JSON.stringify({
        "mimeType": "application/json; charset=UTF-8",
        "text": `{"name":"users/${theUserID}/${filename}","contentType":"application/octet-stream"}`
    });
    
    var sendUploadStartCommand;

    try {
        sendUploadStartCommand = await axios({
            method: "post",
            data: startBody,
            headers: headers,
            url: startStreamingUploadURL,
            params: { uid: theUserID, file: filename, command : "start", length : filesize }
        });
    } catch (error) {
        if (axios.isCancel(error)) {
            return "aborted";
        } else {
            if (error.response) {
                if (error.response.status === 507) {
                    // out of storage
                    handleError("[UPLOAD - STREAM] User doesn't have enough storage for this upload!", { filename : filename }, "info");
                    await getUpdatedRemainingStorage();
                    return "exceeded";
                } else {
                    // other error
                    error.response.filename = filename;
                    handleError("[UPLOAD - STREAM] Upload failed with status: " + error.response.status, error.response, "warning");
                    return false;
                }
            } else {
                error.filename = filename;
                handleError("[UPLOAD - STREAM] Failed to upload!", error);
                return false;
            }
        }
    }

    streamUploadMeta = sendUploadStartCommand.data || {};

    if (!streamUploadMeta.id || !streamUploadMeta.status || !streamUploadMeta.chunkSize) {
        handleError("[UPLOAD – STREAM] Didn't get stream upload meta for streaming file upload", { filename : filename });
        return false;
    }

    breadcrumb('[UPLOAD – STREAM] Got stream upload meta for file. status: ' + streamUploadMeta.status + " chunk size: " + streamUploadMeta.chunkSize + " id: " + streamUploadMeta.id );

    var uploadURL = new URL(apiROOT + "/api/chupload");
    uploadURL.searchParams.set("uid", theUserID);
    uploadURL.searchParams.set("file", filename);
    uploadURL.searchParams.set("length", filesize);
    uploadURL.searchParams.set("upload_id", streamUploadMeta.id);
    uploadURL.searchParams.set("chunkSize", streamUploadMeta.chunkSize);

    uploadURL.searchParams.set("command", "upload");

    fileUpload = UpChunk.createUpload({
        method : "POST",
        headers : headers,
        endpoint: uploadURL.toString(),
        file: blobToFile(blob, filename),
        chunkSize: streamUploadMeta.chunkSize / 1024, // Uploads the file in ~x MB chunks. we get bytes from server. upchunk uses kilobytes. hence the 1024 division.
    });
    
    activeUploads[filename] = fileUpload;

    subscribeToUploadEvents(fileUpload, filename, filesize);

    return new Promise((resolve, reject) => {
        fileUpload.on('chunkSuccess', info => { 
            var uploadMeta = onChunkSuccess(fileUpload, filename, info);
            if (uploadMeta && !isEmpty(uploadMeta)) {

                var uploadID = filenameToUploadID(filename);
                
                if (location.pathname === "/docs") {
                    // mark doc upload = done
                    $(`.upload[id="${uploadID}"]`).attr("prog", "done"); 
                    
                    // check if there's any other uploads left, or hide uploader
                    onUploadComplete();
                }

                delete activeUploads[filename];

                resolve(uploadMeta);
                
            }
        });

        fileUpload.on('error', err => { 
            onUploadError(fileUpload, filename, err);
            delete activeUploads[filename];
            reject(new Error(err));
        });
    });

}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	STREAMING DOWNLOAD FILE
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * 
 * @param {*} filename The full name of the file to download (i.e. 12345.crypteedoc )
 * @param {*} [token] An optional download token, if not provided, we'll make a getDownloadAuth request to get it. 
 * @returns {Promise <*>} ciphertextStream The streaming encrypted contents of the downloaded file
 */
async function streamingDownloadFile(filename, token) {

    if (!filename) {
        handleError("[STREAMING DOWNLOAD] Failed to download, filename is missing!");
        return false;
    }

    if (!filename.endsWith(".crypteefile") && !filename.endsWith(".crypteedoc")) {
        filename = filename + ".crypteefile";
    }
    
    if (!theUserID) {
        handleError("[STREAMING DOWNLOAD] Failed to download, UID is missing!");
        return false;
    }

    cancelDownload(filename);
    
    ongoingDownloads[filename] = new AbortController();

    var fetchConfig = { signal : ongoingDownloads[filename].signal };
    var downloadURL = new URL(apiROOT + "/api/download");
    
    downloadURL.searchParams.set("s", "1"); // instruct server to use streaming download
    downloadURL.searchParams.set("u", theUserID);
    downloadURL.searchParams.set("f", filename);
    
    if (token) { 
        // set token if we have it, if not, server will grab it for us to save roundtrip time
        downloadURL.searchParams.set("t", token); 
    } else { 
        try {
            var idToken = await getIdTokenOnceAuthenticated();
            fetchConfig.headers = { "Authorization": "Bearer " + idToken };
            fetchConfig.withCredentials = true;
        } catch (error) {
            handleError("[STREAMING DOWNLOAD] Couldn't get ID token", error);
            return false;
        }
    }
    
    var fileDownload;

    try {
        fileDownload = await fetch(downloadURL, fetchConfig);
    } catch (error) {
        
        var aborted = (error.message || "").startsWith("The user aborted a request.");
        
        if (!aborted) {
            error.filename = filename;
            handleError("[STREAMING DOWNLOAD] Failed to download!", error);
        } else {
            console.log("[STREAMING DOWNLOAD] Aborted download", filename);
        }
        
        return false;
    }

    if (fileDownload.status !== 200) {
        handleError("[STREAMING DOWNLOAD] Download failed with status: " + fileDownload.status, { filename : filename }, "warning");
        return false;
    } 

    var size = fileDownload.headers.get("x-cryptee-size");
    downloadProgress(filename, null, size);

    breadcrumb("[STREAMING DOWNLOAD] Streaming ( " + filename + " )");

    return fileDownload.body;

}








/////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////
// 
//  DOWNLOAD AND DECRYPT FILE (STREAMING /W FALLBACK TO NORMAL)
//
//  STREAMING (OR NORMAL) DOWNLOADS &
//  STREAMING (OR NORMAL) DECRYPTS FILE
//  
//  IF FILE IS CRYPTEE-V1 OR CRYPTEE-V2 = REGULAR DOWNLOAD & REG DECRYPT
//  IF FILE IS CRYPTEE-V3   = REGULAR DOWNLOAD & BINARY DECRYPT
//  IF FILE IS CRYPTEE-V4   = STREAMING DOWNLOAD & STREAMING DECRYPT 
//  (HEADS UP : CRYPTEE-V4 USES OPENPGP V5+, MORE IN CRYPT.JS)
//
//  YOU ALWAYS HAVE TO SPECIFY THE TYPE OF OUTPUT YOU NEED
//  THIS FUNCTION HANDLES ALL DOWNLOADS AND DECRYPTIONS
//  AND OUTPUTS THE FILE IN ANY SHAPE & FORM YOU'D LIKE
//  IN ADDITION, IF FILE IS V4, YOU CAN CHOOSE TO DOWNLOAD/SAVE FILE
//  STRAIGHT FROM THE STREAM INSIDE THIS FUNCTION
//  THIS WAY WE KEEP THE FILE AS A STREAM FOR AS LONG AS WE CAN.
// 
/////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////


/**
 * Downloads & Decrypts a file, and returns a plaintext file in a given output format (i.e. Blob | File | BlobObjURL | DataURL etc)
 * @param {String} fileID  The full id/name of the file to download (i.e. d-12345-v3.crypteedoc )
 * @param {String} fileToken An optional download token, if not provided, we'll make a getDownloadAuth request to get it. 
 * @param {('file'|'blob'|'url'|'rawtext'|'saveas'|'crypteedoc')} outputFormat For V4/Streaming files URI gives a blob Object URI, and B64 datauri for everything else
 * @param {String} plaintextFilename 
 * @param {String} plaintextMimetype 
 * @param {String} fileKey 
 * @param {Object} doc (only to be used in docs if you need doc specific meta to decide how to decrypt older v2 / v3 files etc.)
 * @param {boolean} [inBackground] (only to be used in docs) optionally download & decrypt in background (i.e. files etc) this will not show body progress
 * @returns 
 */
async function downloadAndDecryptFile(fileID, fileToken, outputFormat, plaintextFilename, plaintextMimetype, fileKey, doc, inBackground) {
    
    fileKey = fileKey || false;
    fileToken = fileToken || false;
    outputFormat = outputFormat || false;
    
    // 
    // WARNINGS
    // 

    // make sure we have an output / action strategy
    if (!outputFormat) {
        handleError("[DOWNLOAD & DECRYPT] Can't download & decrypt without a plaintext output type or action.");
        return false;
    }

    // 
    // PREP
    // 

    breadcrumb('[DOWNLOAD & DECRYPT] [ ' + fileID + ' ] Commencing');
    
    var fileKeys = [theKey]; 
    if (fileKey) { 
        breadcrumb('[DOWNLOAD & DECRYPT] [ ' + fileID + ' ] Will use file key as well');
        fileKeys.push(fileKey); 
    }

    
    //
    // V4 / STREAMING
    // 

    // BLOB KINGDOM. 
    // EVERYTHING USES BLOBS & OBJECT URLS.

    if (fileID.endsWith("-v4")) {
        return downloadAndDecryptV4File(fileID, fileToken, outputFormat, plaintextFilename, plaintextMimetype, fileKeys, doc);
    } 
    
    
    // IF WE MADE IT HERE, THE FILE IS A V3, V2, OR OLDER, WE'LL USE REGULAR DOWNLOAD
    
    if (fileID.startsWith("p-") || fileID.startsWith("t-") || fileID.startsWith("l-")) {
        return downloadAndDecryptPhotos(fileID, fileToken, outputFormat, plaintextFilename, plaintextMimetype, fileKeys);
    } else {
        // DOCS / FILES ETC
        return downloadAndDecryptDocsAndFiles(fileID, fileToken, outputFormat, plaintextFilename, plaintextMimetype, fileKeys, doc, inBackground);
    }

    
    // FIRST, we'll try saving just regular blobs to see if this works – 
    // if it does, then we won't need streamsaver. 
    // if it doesn't, add outputFormat === "saveAs" / blob etc type of differentiator here. 

}





/**
 * Only for use in downloadAndDecryptFile
 */
async function downloadAndDecryptV4File(fileID, fileToken, outputFormat, plaintextFilename, plaintextMimetype, fileKeys, doc) {
    
    breadcrumb('[DOWNLOAD & DECRYPT] [ ' + fileID + ' ] Detected V4 File');
            
    // downloadFile automatically adds .crypteefile if there's no extension, so override for Cryptee Docs
    if (!isEmpty(doc) && !doc.isfile && !fileID.endsWith(".crypteedoc")) { fileID = fileID + ".crypteedoc"; }

    var plaintextBlob;

    try {

        // grab download stream
        var fileDownloadStream  = await streamingDownloadFile(fileID, fileToken);
        
        // pass stream to decrypt
        plaintextBlob           = await streamingDecrypt(fileDownloadStream, fileKeys, plaintextMimetype);
        
        // once we have the blob, remove it from ongoing downloads
        delete ongoingDownloads[fileID];
        
    } catch (error) {
        
        var mostLikelyAborted = (error.message || "").startsWith('readMessage: must pass options object');
        
        if (!mostLikelyAborted) {
            
            error.fileID = fileID;
            error.outputFormat = outputFormat;
            if (fileKeys.length > 1) { error.usingFileKey = true; }
            
            handleError("[DOWNLOAD & DECRYPT] Failed to download & decrypt v4 file", error);
            return false;
            
        } else {
            
            console.log("[DOWNLOAD & DECRYPT] Aborted downloading & decrypting v4 file", fileID);
            return "aborted";

        }

    }
    
    if (!plaintextBlob) {
        var err = { fileID : fileID, outputFormat : outputFormat };
        if (fileKeys.length > 1) { err.usingFileKey = true; }
        handleError("[DOWNLOAD & DECRYPT] Failed to download & decrypt v4 file", err);
        return false;
    }
    
    breadcrumb('[DOWNLOAD & DECRYPT] [ ' + fileID + ' ] V4 Decrypted & Downloaded. Returning: ' + outputFormat);

    if (outputFormat === "saveas")          { return saveAsOrShare(plaintextBlob, plaintextFilename); }
    else if (outputFormat === "file")       { return blobToFile(plaintextBlob, plaintextFilename);    }
    else if (outputFormat === "url")        { return URL.createObjectURL(plaintextBlob);              }
    else if (outputFormat === "rawtext")    { return await blobToText(plaintextBlob);                 }
    else if (outputFormat === "crypteedoc") { return await blobToJSON(plaintextBlob);                 }
    else { return plaintextBlob; } // otherwise, use blob

}


/**
 * Only for use in downloadAndDecryptFile
 */
async function downloadAndDecryptPhotos(fileID, fileToken, outputFormat, plaintextFilename, plaintextMimetype, fileKeys) {

    // breadcrumb('[DOWNLOAD & DECRYPT] [ ' + fileID + ' ] Detected V1/V2/V3 Photo');

    var encryptedFile;

    try {
        encryptedFile = await downloadFile(fileID, fileToken);
    } catch (error) {
        error.fileID = fileID;
        error.outputFormat = outputFormat;
        if (fileKeys.length > 1) { error.usingFileKey = true; }
        handleError("[DOWNLOAD & DECRYPT] Failed to download photo/file", error);
        return false;
    }

    if (!encryptedFile) {
        var err = { fileID : fileID, outputFormat : outputFormat };
        if (fileKeys.length > 1) { err.usingFileKey = true; }
        handleError("[DOWNLOAD & DECRYPT] Failed to download photo/file", err);
        return false;
    }

    // breadcrumb('[DOWNLOAD & DECRYPT] [ ' + fileID + ' ] Downloaded.');

    var plaintextBlob; 
    var decryptedFile;

    if (fileID.startsWith("p-") && fileID.endsWith("-v3")) {

        // original sized -v3 photo upload. we have the Uint8Array image in decryptedFile.data
        decryptedFile           = await decryptToBinary(encryptedFile, fileKeys); 
        var interpretedMimetype = getImageMimetypeFromUint8Array(decryptedFile.data);        
        plaintextBlob           = new Blob([decryptedFile.data], { type : interpretedMimetype });
        
        // breadcrumb('[DOWNLOAD & DECRYPT] [ ' + fileID + ' ] Decrypted.');

    } else {
        
        // it's a V1 & v2 upload, OR V3 thumb or lightbox, which are b64
        
        decryptedFile    = await decrypt(encryptedFile, fileKeys);

        // breadcrumb('[DOWNLOAD & DECRYPT] [ ' + fileID + ' ] Decrypted.');
        
        if (outputFormat === "url") {
            // breadcrumb('[DOWNLOAD & DECRYPT] [ ' + fileID + ' ] Returning: url');
            return decryptedFile.data;
        } else {
            plaintextBlob = await dataURIToBlob(decryptedFile.data);
        }

    }

    // breadcrumb('[DOWNLOAD & DECRYPT] [ ' + fileID + ' ] Returning: ' + outputFormat);

    if      (outputFormat === "file") { return blobToFile(plaintextBlob, plaintextFilename);    }
    else if (outputFormat === "url")  { return URL.createObjectURL(plaintextBlob);              }
    else { return plaintextBlob; }                                                               

}

/**
 * Only for use in downloadAndDecryptFile
 */
async function downloadAndDecryptDocsAndFiles(fileID, fileToken, outputFormat, plaintextFilename, plaintextMimetype, fileKeys, doc, inBackground) {

    breadcrumb('[DOWNLOAD & DECRYPT] [ ' + fileID + ' ] Detected V1/V2/V3 doc/file');

    if (!inBackground) { startRightProgress("decrypting..."); }

    var encryptedFile;

    // downloadFile automatically adds .crypteefile if there's no extension, so override for Cryptee Docs
    if (!isEmpty(doc) && !doc.isfile && !fileID.endsWith(".crypteedoc")) { fileID = fileID + ".crypteedoc"; }

    try {
        encryptedFile = await downloadFile(fileID, fileToken);
    } catch (error) {
        error.fileID = fileID;
        error.outputFormat = outputFormat;
        if (fileKeys.length > 1) { error.usingFileKey = true; }
        handleError("[DOWNLOAD & DECRYPT] Failed to download doc/file", error);
        return false;
    }

    if (!encryptedFile) {
        var err = { fileID : fileID, outputFormat : outputFormat };
        if (fileKeys.length > 1) { err.usingFileKey = true; }
        handleError("[DOWNLOAD & DECRYPT] Failed to download doc/file", err);
        return false;
    }

    // breadcrumb('[DOWNLOAD & DECRYPT] [ ' + fileID + ' ] Downloaded.');

    var plaintextBlob; 
    var decryptedFile;

    try {
        if (doc.isfile && (fileID.endsWith("-v3") || doc.modified)) {
            // it's a v3 file upload which is binary
            decryptedFile = await decryptToBinary(encryptedFile, fileKeys);
        } else {
            // it's a V1 & v2 upload, or a V3 doc upload which are b64 (docs etc.)
            decryptedFile = await decrypt(encryptedFile, fileKeys);
        }
    } catch (error) {
        error.fileID = fileID;
        error.outputFormat = outputFormat;
        if (fileKeys.length > 1) { error.usingFileKey = true; }
        handleError("[DOWNLOAD & DECRYPT] Failed to decrypt doc/file", error);
        return false;
    }

    // breadcrumb('[DOWNLOAD & DECRYPT] [ ' + fileID + ' ] Decrypted. Returning: ' + outputFormat);

    if (doc.isfile && (fileID.endsWith("-v3") || doc.modified)) {
        
        // it's a v3 file upload, we have the Uint8Array file in :
        // decryptedFile.data
        // and its mimetype in doc.mime;
        
        // if      (outputFormat === "uint8array") { return decryptedFile.data;                              }

        plaintextBlob = uInt8ArrayToBlob(decryptedFile.data, (doc.mime || plaintextMimetype));
        if      (outputFormat === "rawtext")    { return await blobToText(plaintextBlob);                 }
        else if (outputFormat === "saveas")     { return saveAsOrShare(plaintextBlob, plaintextFilename); }
        else if (outputFormat === "file")       { return blobToFile(plaintextBlob, plaintextFilename);    }
        else if (outputFormat === "url")        { return URL.createObjectURL(plaintextBlob);              }
        else { return plaintextBlob; } // otherwise blob                                                   

    } else {

        // it's a V1,V2,V3 doc upload = Stringified quill.getContents ... requires JSON.parsing.
        // OR 
        // it's a V1 & v2 file upload, which are b64, so now we have the B64 in decryptedContents.data;

        var isFile = false;
        var parsedDecryptedDocument;
        try {
            parsedDecryptedDocument = JSON.parse(decryptedFile.data);
            isFile = false;
        } catch (error) {
            parsedDecryptedDocument = decryptedFile.data;
            isFile = true;
        }

        if (!parsedDecryptedDocument) {
            var parseError = { fileID : fileID, outputFormat : outputFormat };
            if (fileKeys.length > 1) { parseError.usingFileKey = true; }
            handleError("[DOWNLOAD & DECRYPT] Failed to parse doc/file", parseError);
            return false;
        }

        if (!isFile && outputFormat === "crypteedoc") { 
            // it's a V1,V2,V3 doc upload = will return a quill.getContents JSON Obj
            return parsedDecryptedDocument; 
        }

        if (!isFile) { 
            // maybe we want a crypteedoc in another format but not a delta (i.e. when downloading as uecd), 
            // so if it's not a file, and output format isn't "crypteedoc"
            // then convert the json deltas into a blob to move forward from here. 
            plaintextBlob = jsonToBlob(parsedDecryptedDocument); 
        } else {
            // it's a V1 & v2 file upload, which are b64, so now we have the B64 in decryptedContents.data;
            plaintextBlob = await dataURIToBlob(decryptedFile.data);
        }
        
        if      (outputFormat === "saveas")     { return saveAsOrShare(plaintextBlob, plaintextFilename); }
        else if (outputFormat === "rawtext")    { return await blobToText(plaintextBlob);                 }
        else if (outputFormat === "file")       { return blobToFile(plaintextBlob, plaintextFilename);    }
        else if (outputFormat === "url")        { return URL.createObjectURL(plaintextBlob);              }
        else    { return plaintextBlob; }                                                                  
        

    }

}







































////////////////////////////////////////////////
///////////// CHECK CONNECTION /////////////////
////////////////////////////////////////////////

var retriedCheckConnection = 0;
/**
 * Checks connection 3 times, if third one fails, starts checking once, until it succeeds, then it resets. Each request times out to fail in 3 seconds.
 */
async function checkConnection() {

  var connected = false;
  var startTime = (new Date()).getTime(); // milliseconds cachebuster to make sure we don't get a cached result
  var checkConnectionURL = apiROOT + "/api/check?t=" + startTime;
  
  var connectionResponse = { status : 0 };
  try {
    connectionResponse = await axios({ url: checkConnectionURL, timeout: 3000 });
  } catch (error) {
    if (error.code === 'ECONNABORTED') {
      breadcrumb("[CONNECTIVITY] Connection timed out.");
    } else if (error.code) {
      breadcrumb("[CONNECTIVITY] Failed to connect due to other error : " + error.code);
    } else {
      breadcrumb("[CONNECTIVITY] Failed to connect. Likely internet disconnected.");
    }
    connected = false;
  }

  if (connectionResponse.status === 200) {
    
    if (retriedCheckConnection >= 1) {
      breadcrumb("[CONNECTIVITY] Re/Connected.");
    }
    
    $("body").removeClass("offline");
    retriedCheckConnection = 0;

    if (location.pathname === "/docs") {
        try {
            if (startedOffline) { 
                breadcrumb("[CONNECTIVITY] Switching to online mode");
                startOnline(); 
            }
        } catch (e) {}
    }

    return true;
    
  }

  if (retriedCheckConnection < 2) {
    breadcrumb("[CONNECTIVITY] Offline or can't reach APIs, trying again...");
    retriedCheckConnection++;
    connected = await checkConnection();
  }
  
  if (!connected) { $("body").addClass("offline"); }

  return connected;

}

window.addEventListener('offline', checkConnection);
window.addEventListener('online', checkConnection);




/**
 * Submit a form
 * @param {string} formName The API path (i.e. "help" for .../api/v3/forms-help)
 * @param {Object} data Form Data
 * @returns {Object} response The Form Response
 */
async function submitForm(formName, data) {

    var idToken, formResponse;
    
    // first get id token for getting auth for the api call

    if (theUser) {
        try {
            idToken = await getIdTokenOnceAuthenticated();
            // breadcrumb("[API] Got ID Token");
        } catch (error) {
            handleError("[API] Can't call /"+formName+", couldn't get ID token", error);
            return false;
        }
    }

    // Now let's make the API call

    var apiURL = apiROOT + "/api/v3/forms-" + formName;
    
    data.meta = collectDiagnosticsInfo();

    var axiosConfig = {
        method: "POST",
        url: apiURL,
        data : data,
        headers: { "Content-Type" : "application/json" },
        timeout: 30000 // in case if shit hits the fan, this will fail in 30 seconds
    };

    if (idToken) {
        axiosConfig.headers["Authorization"] = "Bearer " + idToken;
    }

    try {
        breadcrumb("[FORM SUBMISSION] Requesting " + formName);
        formResponse = await axios(axiosConfig);
    } catch (error) {
        handleError("[FORM SUBMISSION] Request to " + formName + " failed", error);
        return false;
    }

    return formResponse;

}



function collectDiagnosticsInfo() {
    var pltfrm = "web"; if (isInstalled) { pltfrm = "pwa"; }
    var resltn = $(window).width().toString() + "x" + $(window).height().toString();
    var locale = detectedLocale || "XX";
    return {
        resltn : resltn,
        pltfrm : pltfrm,
        locale : locale
    };
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	CHECK MIMETYPE VIA API
////////////////////////////////////////////////
////////////////////////////////////////////////

var detectedLocale;

/**
 * Requests a mimetype for a given extension from server so we don't have to store a gigantic mime db client side
 * @param {String} extension (i.e. "mp3") -> "audio/mpg"
 */
async function requestMIMEforExtension(extension) {
    
    var response;
    
    try {
        response = await axios.get(apiROOT + "/api/mime?ext=" + extension);
    } catch (e) {
        handleError("[REQ MIME] Failed to request mimetype for ext: " + extension, e);
    }

    if (response && response.data) {
        return response.data || null;
    } else {
        return null;
    }

}