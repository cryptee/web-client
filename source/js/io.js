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
        idToken = await theUser.getIdToken();
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
 * This uploads a file
 * @param {string} rawTextContents Contents of the File
 * @param {string} filename Full name of the file (i.e. "12345.crypteefile")
 * @param {boolean} [inBackground] (for use in Docs) – if it's a background upload, progress bar isn't updated
 * @returns {Object} fileMeta
 * @returns {string} fileMeta.size The Filesize 
 * @returns {string} fileMeta.generation The File's Generation / Timecode 
 */
async function uploadFile(rawTextContents, filename, inBackground) {
    if (!rawTextContents) {
        handleError("[UPLOAD] Failed to upload, b64FileContent is missing!");
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
        idToken = await theUser.getIdToken();
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

    // for photos / thumbnails / lightbox images / pdfs etc , add a short cache to make it faster to load thumbnails while scrolling, since they're not versioned and won't change

    if (filename.endsWith("crypteefile")) { headers["cache-control"] = "private, max-age=86400"; }

    var uploadID = filename.replace(".", "").replace("-", "");

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
                ongoingUploads[uploadID] = { cancel : c };
            })
        });
    } catch (error) {
        if (axios.isCancel(error)) {
            return "aborted";
        } else {
            if (error.response) {
                if (error.response.status === 507) {
                    // out of storage
                    handleError("[UPLOAD] User exceeded storage quota!", { filename : filename }, "info");
                    updateRemainingStorage(0);
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

    delete ongoingUploads[uploadID];

    return fileMeta;
}

function uploadProgress(filename, loaded, total, inBackground) {
    
    var percentCompleted;
    inBackground = inBackground || false;

    filename = filename.replace(".crypteefile","").replace(".crypteedoc","");
    
    if (filename.startsWith("p-") || filename.startsWith("t-") || filename.startsWith("l-")) {
        
        // it's a photos upload, use the sum of all p + t + l for total.

        var pid = convertID(filename, "p");
        
        if (filename.startsWith("p-")) {
            $("#upload-" + pid).attr("origTotal", total);
            $("#upload-" + pid).attr("origLoaded", loaded);
        }
        
        if (filename.startsWith("t-")) {
            $("#upload-" + pid).attr("thumbTotal", total);
            $("#upload-" + pid).attr("thumbLoaded", loaded);
        }
        
        if (filename.startsWith("l-")) {
            $("#upload-" + pid).attr("lightTotal", total);
            $("#upload-" + pid).attr("lightLoaded", loaded);
        }
        
        var origTotal   = parseInt( ( $("#upload-" + pid).attr("origTotal")  || 0) );
        var thumbTotal  = parseInt( ( $("#upload-" + pid).attr("thumbTotal") || 0) );
        var lightTotal  = parseInt( ( $("#upload-" + pid).attr("lightTotal") || 0) );
        
        var origLoaded  = parseInt( ( $("#upload-" + pid).attr("origLoaded")  || 0) );
        var thumbLoaded = parseInt( ( $("#upload-" + pid).attr("thumbLoaded") || 0) );
        var lightLoaded = parseInt( ( $("#upload-" + pid).attr("lightLoaded") || 0) );
        
        var grandTotal = origTotal + thumbTotal + lightTotal;
        var grandLoaded = origLoaded + thumbLoaded + lightLoaded;

        percentCompleted = "%" + ((grandLoaded * 100) / grandTotal).toFixed(2).toString();

        $("#upload-" + pid).attr("status", "uploading");
        $("#upload-" + pid).find(".status").html(percentCompleted);
    } else {
        // it's a docs upload
        
        // upload is backgrounded mid-save, add to upload panel here
        if (filename !== activeDocID) { addSaveToUploadsPanel(filename); }
        
        percentCompleted = "%" + ((loaded * 100) / total).toFixed(2).toString();
        
        $("#upload-" + filename).find("progress").attr({ value : loaded, max : total });
        
        // it's a UI subtlety to make sure percentage matches the progress bar
        setTimeout(function () {
            $("#upload-" + filename).attr("status", percentCompleted);
            $("#upload-" + filename).find(".status").html(percentCompleted);
        }, 900);

        if (!inBackground) {
            updateRightProgress(loaded, total, "yellow");
        }
    }

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

    var uploadID = filename.replace(".", "").replace("-", "");

    if (ongoingUploads[uploadID]) {
        breadcrumb('[UPLOAD] Canceling: ' + uploadID);
        ongoingUploads[uploadID].cancel();
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

    var downloadID = filename.replace(".", "").replace("-", "");
    
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
                ongoingDownloads[downloadID] = { cancel : c };
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

    delete ongoingDownloads[downloadID];

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

    var downloadID = filename.replace(".", "").replace("-", "");

    if (ongoingDownloads[downloadID]) {
        ongoingDownloads[downloadID].cancel();
    }
}




function downloadProgress(filename, loaded, total) {
    // downloadProgress – Monitor all downloads' progresses using this function, both for docs & photos etc.
    // FOR POSTERITY IF YOU NEED IT.
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
            idToken = await theUser.getIdToken();
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
