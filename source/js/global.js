////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 ALL APP-WIDE GLOBAL VARIABLES / RE-USABLES
////////////////////////////////////////////////
////////////////////////////////////////////////

var noop = function(){}; // do nothing.

var winNav = window.navigator;
var vendorName = winNav.vendor;

////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 BROWSER, DEVICE, FEATURE DETECTION
////////////////////////////////////////////////
////////////////////////////////////////////////

var isMobile = false;
if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(navigator.userAgent) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(navigator.userAgent.substr(0,4))) isMobile = true;

var isSafari            = !!winNav.userAgent.match(/Version\/[\d\.]+.*Safari/);
var isFirefox           = winNav.userAgent.toLowerCase().indexOf('firefox') > -1;
var isChromium          = window.chrome;
var isOpera             = typeof window.opr !== "undefined";
var isIEedge            = winNav.userAgent.indexOf("Edge") > -1;
var isIOSChrome         = winNav.userAgent.match("CriOS");
var isInWebAppiOS       = (winNav.standalone === true);
var isInWebAppChrome    = (window.matchMedia('(display-mode: standalone)').matches);
var isios               = /iPad|iPhone|iPod/.test(winNav.userAgent) && !window.MSStream;
var isipados            = !!winNav.userAgent.match(/Version\/[\d\.]+.*Safari/) && (winNav.platform === "MacIntel") && (winNav.maxTouchPoints > 1);
var isAndroid           = winNav.userAgent.toLowerCase().indexOf("android") > -1;
var isTouch             = isTouchDevice() || isMobile || isios || isipados || isAndroid;
var isInstalled         = isInWebAppiOS || isInWebAppChrome;

var isGoogleChrome = false;
if (isIOSChrome) {
   // is Google Chrome on IOS
} else if ( isChromium !== null && typeof isChromium !== "undefined" && vendorName === "Google Inc." && isOpera === false && isIEedge === false ) {
   // is Google Chrome
   isGoogleChrome = true;
} else {
   // not Google Chrome
   isGoogleChrome = false;
}

if (isSafari) { $("body").addClass("safari"); }
if (isipados) { setSentryTag("ipados", "true"); }

function inIframe () {
  try {
      return window.self !== window.top;
  } catch (e) {
      return true;
  }
}

setSentryTag("in-iframe", inIframe());


function isRetina() { return window.devicePixelRatio > 1; }
setSentryTag("retina", isRetina());



function isTouchDevice() {
  const prefixes = ["", "-webkit-", "-moz-", "-o-", "-ms-"];
  const queries = prefixes.map(prefix => `(${prefix}touch-enabled)`);
  return window.matchMedia(queries.join(",")).matches;
}

function checkDOMRectBlocked() {
  var isItBlocked = true;

  try {
    Element.prototype.getClientRects();
  } catch(error) {
    isItBlocked = false;
  }

  return isItBlocked;
}

var isDOMRectBlocked = checkDOMRectBlocked();

setSentryTag("dom-rect-blocked", isDOMRectBlocked);




function checkFileAPIs() {
  // Check for the various File API support. thx blockers.. 
  if (window.File && window.FileReader && window.FileList && window.Blob) {
    // Great success! All the File APIs are supported.
    return true;
  } else {
    return false;
  }
}

var isFileAPIAvailable = checkFileAPIs();
setSentryTag("file-api-available", isFileAPIAvailable);




var canUploadFolders = false;
try {
  if (DataTransferItem.prototype.webkitGetAsEntry) {
    canUploadFolders = true;
  } else {
    canUploadFolders = false;
  }
} catch (e) {
  canUploadFolders = false;
}

setSentryTag("can-upload-folders", canUploadFolders);


// if (isAndroid && isFirefox) {
  // https://bugzilla.mozilla.org/show_bug.cgi?id=1456557
  // seriously. yeah. seriously firefox. WTF. 
//   $('input[type="file"]').removeAttr("multiple");
//   breadcrumb('Detected Firefox on Android. Multiple file selections for input elements will be disabled.');
//   setSentryTag("input-multiple-upload", "disabled");
// } else {
//   setSentryTag("input-multiple-upload", "enabled");
// }


if (window.MediaSource) {
  setSentryTag("media-source-api", "supported");
} else {
  setSentryTag("media-source-api", "unsupported");
}







///////////////////////////////////////////////////
///////////////////////////////////////////////////
// 	 GLOBAL HELPER FUNCTIONS, UTILITIES, CONVERTERS
///////////////////////////////////////////////////
///////////////////////////////////////////////////

/**
 * An async promise wrapper for FileReader's readAs (arrayBuffer / dataURL / text) to make it easier to use
 * @param {*} file the File
 * @param {('arrayBuffer'|'dataURL'|'text')} as how to read the file
 * @returns {Promise<*>} arrayBuffer / dataURL / text
 */
function readFileAs(file, as) {
  return new Promise((resolve, reject) => {
    var reader = new FileReader();

    reader.onload = function (readerEvent) {
      try {
        breadcrumb("[READ FILE] Done!");
        resolve(readerEvent.target.result);
      } catch (error) {
        breadcrumb("[READ FILE] Couldn't read file as " + as);
        resolve(null);
      }
    };

    if (as === "arrayBuffer") {
      breadcrumb("[READ FILE] Reading as array buffer ...");
      reader.readAsArrayBuffer(file);
    } 
    
    if (as === "dataURL") {
      breadcrumb("[READ FILE] Reading as data url ...");
      reader.readAsDataURL(file);
    }
    
    if (as === "text") {
      breadcrumb("[READ FILE] Reading as text ...");
      reader.readAsText(file);
    }
  });
}



/**
 * Cross compatible way to toggle fullscreen
 */
function toggleFullScreen() {
  var doc = window.document;
  var docEl = doc.documentElement;

  var requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
  var cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

  if(!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
    if (requestFullScreen) {
      requestFullScreen.call(docEl);
    }
  }
  else {
    if (cancelFullScreen) {
      cancelFullScreen.call(doc);
    }
  }
}

function exitFullscreen() {
  try {

    if (document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
      var cancelFullScreen = document.exitFullscreen || document.mozCancelFullScreen || document.webkitExitFullscreen || document.msExitFullscreen;
      if (cancelFullScreen) {
        cancelFullScreen.call(document);
      }
    }

  } catch (e) {}
}

/**
 * A way to throttle on-scroll events so that they don't happen too often.
 * @param {*} func 
 * @param {*} wait 
 */
function throttleScroll (func, wait) {
  var context, args, timeout, throttling, more, result;
  return function() {
    context = this; args = arguments;
    var later = function() {
      timeout = null;
      if (more) func.apply(context, args);
    };
    if (!timeout) timeout = setTimeout(later, wait);
    if (throttling) {
      more = true;
    } else {
      result = func.apply(context, args);
    }
    throttling = true;
    return result;
  };
}

/**
 * 
 * @param {String} urlParameter get given url parameter
 */
function getUrlParameter(urlParameter) {
  var sPageURL = decodeURIComponent(window.location.search.substring(1)),
      sURLVariables = sPageURL.split('&'),
      sParameterName,
      i;

  for (i = 0; i < sURLVariables.length; i++) {
      sParameterName = sURLVariables[i].split('=');

      if (sParameterName[0] === urlParameter) {
          return sParameterName[1] === undefined ? true : sParameterName[1];
      }
  }
}



/**
 * Extracts hashtags from a given string. (i.e. "we went to #paris for a #business-trip" etc...)
 * @param {string} string 
 * @returns {array} array of hashtags
 */
function extractHashtags(string) {
  // sort tags based on tag-length. here's why. 
  // if you write "#paris #paris2019", paris will replace the tag with <i>paris</i> <i>paris</i>2019, making "2019" get ignored in the highlighter
  // if you start from the longest tag, this won't be a problem
  string = string.toLowerCase();
  return (string.match(/#[A-Za-zÀ-ÿ0-9]*/g) || []).sort(function(a, b){ return b.length - a.length; });
}


/**
 * 
 * @param {String} email check if given string is an email address matching with regex.
 */
function isEmail(email) {
  var regex = /^([a-zA-Z0-9_.+-])+\@(([a-zA-Z0-9-])+\.)+([a-zA-Z0-9]{2,4})+$/;
  return regex.test(email);
}

/**
 * 
 * @param {string} date check if date format is valid (YYYY-MM-DD)
 */
function isValidDate(date) {
  return date.match(/([12]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))/);
}


/**
 * 
 * @param {number|string} bytes format a given amount of bytes i.e. 1000 = 1 KB or "1000000" = 1 MB etc
 */
function formatBytes (bytes) {
  bytes = bytes || 0;
  bytes = parseInt(bytes);
  if (bytes <= 0) { return '0 MB'; }
  var k = 1000,
      dm = 1,
      sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
      i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}


/**
 * OBJECT BYTESIZE CALCULATOR (SAY FOR EXAMPLE HOW MANY BYTES IS A STRING ETC. OR A DOCUMENT / OR A PHOTO B64 ETC.)
 * @param {*} object 
 */
function bytesize( object ) {

  var objectList = [];
  var stack = [ object ];
  var bytes = 0;

  while ( stack.length ) {
      var value = stack.pop();

      if ( typeof value === 'boolean' ) {
          bytes += 4;
      }
      else if ( typeof value === 'string' ) {
          bytes += value.length * 2;
      }
      else if ( typeof value === 'number' ) {
          bytes += 8;
      }
      else if
      (
          typeof value === 'object' && objectList.indexOf( value ) === -1
      )
      {
          objectList.push( value );

          for( var i in value ) {
              stack.push( value[ i ] );
          }
      }
  }
  return bytes;
}

/**
 * Pads a given number to given noDigits (i.e. num = 5, digits = 2 = 05)
 * @param {Number} num 
 * @param {Number} digits 
 * @returns paddedString
 */
function padZeroes(num, digits){ return String(num).padStart(digits, '0'); }

/**
 * 
 * @param {number} unixtime amount of time that has passed since given unix time. returns string like : 2 years or 5 days etc.
 */
function timeSince(unixtime) {

  var seconds = Math.floor((new Date().getTime() - (unixtime / 1000)) / 1000);
  var intervalType = "";

  var interval = Math.floor(seconds / 31536000);
  if (interval >= 1) {
    intervalType = 'year';
  } else {
    interval = Math.floor(seconds / 2592000);
    if (interval >= 1) {
      intervalType = 'month';
    } else {
      interval = Math.floor(seconds / 86400);
      if (interval >= 1) {
        intervalType = 'day';
      } else {
        interval = Math.floor(seconds / 3600);
        if (interval >= 1) {
          intervalType = "hour";
        } else {
          interval = Math.floor(seconds / 60);
          if (interval >= 1) {
            intervalType = "minute";
          } else {
            interval = seconds;
            intervalType = "second";
          }
        }
      }
    }
  }

  if (interval > 1) {
    intervalType += 's';
  }

  if (typeof unixtime !== "number" || interval <= 0) {
    interval = 0;
    intervalType += 's';
  }

  return interval + ' ' + intervalType;
}



/**
 * converts a dataURI to a File object by using fetch and a blob
 * @param {string} dataURI 
 * @param {string} filename 
 * @returns {Promise <File>}
 */
async function dataURIToFile(dataURI, filename) {
  // a blob is almost a File()... we just need two more properties, and we can add them in blobToFile
  var blob = await dataURIToBlob(dataURI);
  return blobToFile(blob, filename);
}

/**
 * Converts a dataURI to a Blob
 * @param {String} dataURI 
 * @returns {Promise <Blob>}
 */
async function dataURIToBlob(dataURI) {
  var spacelessDataURI = dataURI.replace(/\n/g, "").replace(/\s/g, ''); // ios doesn't accept spaces and crashes browser. like wtf apple. What. THE. FUCCK!!! (also adding newlines just in case)
  return (await fetch(spacelessDataURI)).blob(); 
}

/**
 * converts a blob to a File object
 * @param {*} blob 
 * @param {string} filename 
 */
function blobToFile(blob, filename) {
  // a blob is almost a File()... we just need two more properties
  return new File([blob], filename , { type:blob.type, lastModified:new Date().getTime() } )
}


/**
 * Takes in a blob, and converts it to a stream we can use as plaintext source which we can later encrypt
 * @param {*} blob 
 * @returns {*} stream
 */
 function blobToStream(blob) {
  return blob.stream ? blob.stream() : new Response(blob).body;
}


/**
 * Creates a blob using a uInt8Array & mimetype
 * @param {*} uInt8Array 
 * @param {*} mimetype
 */
function uInt8ArrayToBlob(uInt8Array, mimetype) {
  return new Blob([uInt8Array], {type : mimetype});
}



/**
 * Converts a JSON Object to a Blob
 * @param {Object} jsonObject 
 * @returns {Blob} A Blob containing the JSON Object in UTF-8 with application/json mimetype
 */
function jsonToBlob(jsonObject) {
  var str = JSON.stringify(jsonObject);
  var bytes = new TextEncoder().encode(str);
  return new Blob([bytes], { type: "application/json;charset=utf-8" });
}

/**
 * Gets the array buffer of a Blob. For performance, it uses blob.arrayBuffer() which is async, therefore this returns a promise.
 * @param {Blob} blob 
 * @returns {Promise <ArrayBuffer>}
 */
async function blobToArrayBuffer(blob) {
  return await blob.arrayBuffer();
}

/**
 * Gets the raw textual contents of a Blob. For performance, it uses blob.text() which is async, therefore this returns a promise.
 * @param {Blob} blob 
 * @returns {Promise <String>} Extracted Raw Text
 */
async function blobToText(blob) { 

  var textContents;
  
  try {
    textContents = await blob.text();
  } catch (error) {
    handleError("[BLOB TO TEXT] Failed to get TEXT from Blob via blob.text, using filereader", error, "warning");
    textContents = await readFileAs(blob, "text");
  }

  return textContents; 
  
}

/**
 * Gets the JSON contents of a Blob. For performance, it uses blob.text() which is async, therefore this returns a promise.
 * @param {Blob} blob 
 * @returns {Promise <Object>} Extracted JSON Object
 */
async function blobToJSON(blob) { 
  
  var textContents;
  var jsonContents;
  var blobToTextFailed = false;
  
  try {
    textContents = await blob.text();
    jsonContents = JSON.parse(textContents);
  } catch (error) {
    handleError("[BLOB TO JSON] Failed to get JSON from Blob via blob.text, will use filereader", error, "warning");
    blobToTextFailed = true;
    jsonContents = {};
  }
  
  if (blobToTextFailed) {
    try {
      textContents = await readFileAs(blob, "text");
      jsonContents = JSON.parse(textContents);
    } catch (error) {
      handleError("[BLOB TO JSON] Failed to get JSON from Blob via file reader too, aborting!", error);
      jsonContents = {};
    }
  }

  return jsonContents;
  
}


/**
 * Revokes an object's URL once we're done with it (i.e. after image is loaded on the page), with error handling built in to save repetition in codebase.
 * @param {String} url 
 */
function revokeObjectURL(url) { 
  try { URL.revokeObjectURL(url); } catch (e) {}
}





function getImageMimetypeFromUint8Array(uInt8Array) {
  var arr = (uInt8Array).subarray(0, 4);
  var header = "";
  var type = "";
  for (var i = 0; i < arr.length; i++) { header += arr[i].toString(16); }

  switch (header) {
    case "89504e47":
      type = "image/png";
      break;
    case "47494638":
      type = "image/gif";
      break;
    case "ffd8ffdb":
    case "ffd8ffe0":
    case "ffd8ffe1":
    case "ffd8ffe2":
    case "ffd8ffe3":
    case "ffd8ffe8":
      type = "image/jpeg";
      break;
    case "52494646":
    case "42505650":
      type = "image/webp";
      break;
    default:
      type = "";
      break;
  }

  return type;
}

/**
 * Creates an image blob from the canvas using the provided parameters. 
 * @param {*} canvas Canvas Element to Use
 * @param {number} quality (0 - 1)
 * @param {('image/jpeg'|'image/png')} [format] defaults to image/jpeg  
 * @returns {Promise <Blob>} imageBlob
 */
async function canvasToBlob(canvas, quality, format) {
  
  format = format || "image/jpeg";

  breadcrumb('[CANVAS TO BLOB] Converting canvas to blob ...');

  // safari doesn't support toBlob (or it does but doesn't have the quality parameter.)
  // ugh. so we need to detect all safaris an others on iOS and convert to blob through dataURL.
  if (isios || isipados || isSafari) {
    breadcrumb('[CANVAS TO BLOB] Detected Safari. Will use fallback to .toDataURL().');
    // takes about 60ms for a 15mb test img on dev machines
    return dataURIToBlob(canvas.toDataURL(format, quality));
  } else {
    breadcrumb('[CANVAS TO BLOB] Detected non-Safari. Will use native toBlob().');
    // takes about 40ms for a 15mb test img on dev machines
    return new Promise(resolve => canvas.toBlob(resolve, format, quality));
  }

}

/**
 * Helps us calculate the maximum allowed canvas size, and creates an aspect ratio accurate max canvas size we can use.
 * We need this because iOS Safari limits max total canvas size to 16777216px (w*h), this is so that we can generate
 * thumbnails etc without any issues however large photos may be. 
 * @param {Number} width 
 * @param {Number} height 
 * @returns {Object} sizes
 * @returns {Object} sizes.width
 * @returns {Object} sizes.height
 */
function limitCanvasSize(width, height) {

  // For now limiting to 2048 x 2048 (iOS max size is 4096x4096, but since we don't need more, we'll stick with this. prob better for mem use), 
  let maximumPixels = 4194304;

  const requiredPixels = width * height;
  if (requiredPixels <= maximumPixels) return { width, height };

  const scalar = Math.sqrt(maximumPixels) / Math.sqrt(requiredPixels);
  return {
      width: Math.floor(width * scalar),
      height: Math.floor(height * scalar),
  };

}


/**
 * Escapes HTML Characters in a given string. i.e. things like (> < & etc etc)
 * @param {String} string html string to escape characters
 */
function escapeHTML(string) { 
  return String(string)
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/'/g, "&#039;")
  .replace(/"/g, "&quot;"); 
}

/**
 * UNESCAPE HTML Characters in a given string. i.e. things like (&amp; -> & etc etc)
 * @param {String} string html string to escape characters
 */
function unescapeHTML(string) { 
  return String(string)
  .replace(/&amp;/g, "&")
  .replace(/&#38;/g, "&") 
  .replace(/&lt;/g, "<")
  .replace(/&#60;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&#62;/g, ">")
  .replace(/&apos;/g, "'") 
  .replace(/&#39;/g, "'") 
  .replace(/&quot;/g, '"')
  .replace(/&34;/g, '"');
}

/**
 * Escapes Template HTML Strings (This is a Tagged Template Function)
 * WONT WORK IF TEMPLATE STRING HAS INLINE FUNCTIONS LIKE ONCLICK ETC IN THEM
 * from https://developers.google.com/web/updates/2015/01/ES6-Template-Strings
 * Thanks to Andrea Giammarchi
 * @param {*} pieces 
 * @returns 
 */
 function escapeTemplateHTML(pieces) {
  var util = (function () {
    var reEscape = /[&<>'"]/g;
    var reUnescape = /&(?:amp|#38|lt|#60|gt|#62|apos|#39|quot|#34);/g;
    var oEscape = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    };
    var oUnescape = {
      '&amp;': '&',
      '&#38;': '&',
      '&lt;': '<',
      '&#60;': '<',
      '&gt;': '>',
      '&#62;': '>',
      '&apos;': "'",
      '&#39;': "'",
      '&quot;': '"',
      '&#34;': '"'
    };
    var fnEscape = function (m) { return oEscape[m]; };
    var fnUnescape = function (m) { return oUnescape[m]; };
    var replace = String.prototype.replace;

    return (Object.freeze || Object)({
      escape: function escape(s) { 
        if (!s) { return ""; } 
        return replace.call(s, reEscape, fnEscape); 
      },
      unescape: function unescape(s) { 
        if (!s) { return ""; } 
        return replace.call(s, reUnescape, fnUnescape);
      }
    });
  }());

  var result = pieces[0];
  var substitutions = [].slice.call(arguments, 1);
  for (var i = 0; i < substitutions.length; ++i) { result += util.escape(substitutions[i]) + pieces[i + 1]; }

  return result;
}

/**
 * Strips html entities / characters from html string. (i.e. removes > or < etc)
 * @param {String} string html string to strip html entities from
 */
function stripHTMLEntities(string) { return String(string).replace(/&/g, "").replace(/</g, "").replace(/>/g, "").replace(/"/g, "").replace(/'/g, "").replace(/\//g, ""); }






function dec2hex (dec) {
  return ('0' + dec.toString(16)).substr(-2);
}



/**
 * Deletes an item from the array using splice
 * @param {Array} array 
 * @param {*} itemToRemove 
 */
function deleteFromArray(array, itemToRemove) {
  var index = array.indexOf(itemToRemove);
  if (index > -1) { array.splice(index, 1); }
}


/**
 * Determine if an array contains one or more items from another array.
 * @param {Array} haystack (the array to search)
 * @param {Array} needles (array of items to check for in the haystack)
 */
function findOne(haystack, needles) {
  return needles.some(function (v) {
    return haystack.indexOf(v) >= 0;
  });
}






/**
 * Generate new UUID (often used for things like unique doc or folder IDs)
 * @param {number} len length of the UUID
 */
function newUUID (len) {
  var arr = new Uint8Array((len || 32) / 2);
  crypto.getRandomValues(arr);
  return Array.from(arr, dec2hex).join('');
}


/**
 * Is Element Scrolled Into View & Fully Visible
 * @param {*} el element
 */
function isScrolledIntoView(el) {
  if (el !== undefined) {
    var rect;
    try {
      rect = el.getBoundingClientRect();
    } catch (error) {
      return false;
    }
    
    if (rect) {
      var elemTop = rect.top;
      var elemBottom = rect.bottom;
      
      // Only completely visible elements return true:
      var isVisible = (elemTop >= 0) && (elemBottom <= window.innerHeight);
      
      // Partially visible elements return true:
      // var isVisible = elemTop < window.innerHeight && elemBottom >= 0;
      return isVisible;
    } else {
      return false;
    }
  } else {
    return false;
  }
}




/**
 * Clamps a number between the given values (i.e. -50, 0, 100 = 0)
 * @param {*} num 
 * @param {*} min 
 * @param {*} max 
 * @returns 
 */
function clamp(num, min, max) { 
  return Math.min(Math.max(num, min), max); 
}





/**
 * We don't like cookies. Nobody likes cookies. So we delete them all. On all page loads. Even if a partner, like Paddle or their JS files leave a cookie, it'll be deleted on each pageload.
 */
function deleteAllCookies() {
  var cookies = document.cookie.split(";");
  for (var i = 0; i < cookies.length; i++) {
      var cookie = cookies[i];
      var eqPos = cookie.indexOf("=");
      var name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
      document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }
}
deleteAllCookies();

/**
 * A quick remix icon renderer to save precious kilobytes, pass in the remix icon name and it'll return the icon tag
 * @param {string} iconName remix icon name ri- iconName (i.e. "bold")
 * @returns {string} icon element string i.e. '<i class="ri-bold"></i>'
 */
function renderIcon(iconName) {
  return `<i class="ri-${iconName}"></i>`;
}

/**
 * Checks if an object is empty, returns true if empty
 * @param {Object} obj the object to check 
 */
function isEmpty(obj) {
  if (!obj) { return true; }
  return Object.keys(obj).length === 0 && obj.constructor === Object;
}

/**
 * a global string.replace shortcut with regex safety built in
 * @param {string} str String to replace things in
 * @param {string} find things to replace
 * @param {string} replace replace with
 */
function replaceAll(str, find, replace) {
  return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
}

function escapeRegExp(string) {
  return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

/**
 * Extracts extension (i.e. jpg) from Filename (i.e. photo.jpg)
 * @param {string} filename a full filename i.e. photo.jpg
 * @returns {string} extension an extension (i.e. jpg) in lowercase
 */
function extensionFromFilename (filename) {
  return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2).toLowerCase();
}

/**
 * Extracts title (i.e. photo123) from filename (i.e. photo123.jpg)
 * @param {string} filename a full filename i.e. photo123.jpg
 * @returns {string} title a title (i.e. photo123) in lowercase
 */
function titleFromFilename (filename) {
  var extension = "." + extensionFromFilename(filename);
  var titleToReturn = (filename.substring(0,filename.lastIndexOf(extension)) + '');
  if (titleToReturn === "") { titleToReturn = filename; }
  return titleToReturn;
}

/**
 * checks if a file extension is gif or not.
 * @param {string} extension file extension
 */
function isGIF(extension) {
  return extension.match(/^(gif)$/i);
}

function isOnline() {
  return !$("body").hasClass("offline");
}


/**
 * Converts a filename and tries to extract mimetype from server using extension, locally or worst case from the server. 
 * Security and privacy of this heavily depends on the quality of "extensionFromFilename" if it can't determine an extension from filename
 * and instead passes a portion of the filename as the extension, we would be sending that to server.
 * there is no solution to this problem, and we have to assume that the portion of a filename after the last dot is the extension. 
 * so if a user has a filename like : "A.Long.Weird.Document", we'll send "Document" to server. 
 * Though in Cryptee Docs, we store and use the actual mimetype of the file, so this is less of a concern for that. 
 * Writing this only for future reference, as we don't have anything to worry about at the moment.
 * @param {String} filename (i.e. voice memo.mp3 )
 * @returns {Promise <String>} mimetype
 */
async function mimetypeFromFilename(filename) {
  
  var mimetype;

  if (!filename) { return null; };
  
  var ext = extensionFromFilename(filename);
  
  if (!ext) { return null; }

  // common ones to save 200ms roundtrip time
  // image
  if (ext === "jpg" || ext === "jpeg") { mimetype = "image/jpeg";       }
  if (ext === "png")                   { mimetype = "image/png";        }
  if (ext === "gif")                   { mimetype = "image/gif";        }
  if (ext === "webp")                  { mimetype = "image/webp";       }

  // audio
  if (ext === "mp3")                   { mimetype = "audio/mpeg";       }
  if (ext === "wav")                   { mimetype = "audio/x-wav";      }
  
  // video
  if (ext === "mp4" || ext === "mov")  { mimetype = "video/mp4";        }

  // other
  if (ext === "pdf")                   { mimetype = "application/pdf";  }
  if (ext === "zip")                   { mimetype = "application/zip";  }

  if (!mimetype) {
    mimetype = await requestMIMEforExtension(ext);
  }

  return mimetype || null;

}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	BROWSER EXIF ORIENTATION TREATMENT
////////////////////////////////////////////////
////////////////////////////////////////////////



var browserWillHandleEXIFOrientation = false;

// https://github.com/blueimp/JavaScript-Load-Image/commit/1e4df707821a0afcc11ea0720ee403b8759f3881
// Check if browser supports automatic image orientation
async function determineBrowserEXIFOrientationTreatment() {
    
    var img = new Image();
    
    // black 2x1 JPEG, with the following meta information set - EXIF Orientation: 6 (Rotated 90° CCW)
    img.src = 'data:image/jpeg;base64,/9j/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAYAAAAAAAD/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAf/AABEIAAEAAgMBEQACEQEDEQH/xABKAAEAAAAAAAAAAAAAAAAAAAALEAEAAAAAAAAAAAAAAAAAAAAAAQEAAAAAAAAAAAAAAAAAAAAAEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8H//2Q==';

    try {
      breadcrumb("[EXIF Orientation] Decoding test image");
      await img.decode();
      breadcrumb("[EXIF Orientation] Decoded test image");
    } catch (error) {
      breadcrumb("[EXIF Orientation] Failed to decode test image");
      return {};
    }

    // Check if browser supports automatic image orientation:
    browserWillHandleEXIFOrientation = img.width === 1 && img.height === 2;
    
    if (browserWillHandleEXIFOrientation) {
      // true == browser supports = don't rotate in js
      breadcrumb('[EXIF Orientation] Will be handled by Browser');
      setSentryTag("browser-handles-exif-orientation", "yes");
    } else {
      // false == browser doesn't support = rotate in js
      breadcrumb('[EXIF Orientation] Will be handled by Cryptee');
      setSentryTag("browser-handles-exif-orientation", "no");
    }

}

function correctCanvasOrientationInOrientationContext(orientationContext, w, h, orientation) {
  switch (orientation) {
    case 2:
      // horizontal flip
      orientationContext.translate(w, 0);
      orientationContext.scale(-1, 1);
      break;
    case 3:
      // 180° rotate left
      orientationContext.translate(w, h);
      orientationContext.rotate(Math.PI);
      break;
    case 4:
      // vertical flip
      orientationContext.translate(0, h);
      orientationContext.scale(1, -1);
      break;
    case 5:
      // vertical flip + 90 rotate right
      orientationContext.rotate(0.5 * Math.PI);
      orientationContext.scale(1, -1);
      break;
    case 6:
      // 90° rotate right
      orientationContext.rotate(0.5 * Math.PI);
      orientationContext.translate(0, -h);
      break;
    case 7:
      // horizontal flip + 90 rotate right
      orientationContext.rotate(0.5 * Math.PI);
      orientationContext.translate(w, -h);
      orientationContext.scale(-1, 1);
      break;
    case 8:
      // 90° rotate left
      orientationContext.rotate(-0.5 * Math.PI);
      orientationContext.translate(-w, 0);
      break;
  }
}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	READ EXIF
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Reads an arrayBuffer, and returns all the exif we need
 * @param {*} fileOrFileBuffer arrayBuffer for file
 * @returns {Promise <Object>} exif
 */
async function readEXIF(fileOrFileBuffer) {
    
  var tags = {}; 
  var exif = {};

  if (!fileOrFileBuffer) { return exif; }

  try {
      breadcrumb('[EXIF READER] Reading ...');
      if (fileOrFileBuffer instanceof File) {
        // file api is async
        tags = await ExifReader.load(fileOrFileBuffer);
      } else {
        // buffer api is sync
        tags = ExifReader.load(fileOrFileBuffer);
      }
  } catch (error) {
      breadcrumb("[EXIF READER] Failed to load tags", error);
      return exif;
  }

  if (isEmpty(tags)) { return exif; }

  if (tags.DateTime)          { exif.DateTime             = tags.DateTime.value[0] || "";                              }
  if (tags.DateTimeDigitized) { exif.DateTimeDigitized    = tags.DateTimeDigitized.value[0] || "";                     }
  if (tags.DateTimeOriginal)  { exif.DateTimeOriginal     = tags.DateTimeOriginal.value[0] || "";                      }
  if (tags.Orientation)       { exif.Orientation          = tags.Orientation.value || tags.Orientation.value[0] || ""; }

  let make     = ((tags.Make || {}).value || [])[0] || (tags.Make || {}).description || "Unknown";
  let model    = ((tags.Model || {}).value || [])[0] || (tags.Model || {}).description || "Unknown";
  let lens     = (tags.FocalLength || {}).description || "Unknown";
  
  let aperture = (tags.FNumber || {}).description || (tags.ApertureValue || {}).description || "Unknown";
  let exposure = (tags.ExposureTime || {}).description || "Unknown";
  let whitebal = (tags.WhiteBalance || {}).description || "Unknown";
  let iso      = (tags.ISOSpeed || {}).description || (tags.ISOSpeedRatings || {}).description || "Unknown";
  
  exif.make = make;
  exif.model = model;
  exif.lens = lens;
  exif.aperture = aperture;
  exif.exposure = exposure;
  exif.whitebal = whitebal;
  exif.iso = iso;

  breadcrumb('[EXIF READER] Read!');

  return exif;

}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	UPLOAD RELATED HELPERS
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Takes in a filename, and returns an upload ID that can be used in the dom
 * @param {String} filename (i.e. d-12345.crypteefile)
 * @returns {String} uploadID (i.e. d-12345)
 */
function filenameToUploadID(filename) {
  return (filename || "").split(".")[0];
}

////////////////////////////////////////////////////
/////////////////   CONSOLE GUARD   ////////////////
////////////////////////////////////////////////////

if (env === "prod") {
  var warningTitleCSS = 'color:red; font-size:60px; font-weight: 700; font-family:Josefin Sans;';
  var warningDescCSS = 'font-size: 18px; font-family:Josefin Sans; font-weight : 350';
  console.log("%cSTOP! \n%cthis is a browser feature intended for developers. \n\nif someone told you to copy and paste something here to enable a cryptee feature or \"hack\" someone's account, it is a scam and will give them access to your cryptee account.", warningTitleCSS, warningDescCSS);
}




////////////////////////////////////////////////////
////////////// INACTIVITY TIMEOUT //////////////////
////////////////////////////////////////////////////

var lastActivityTime;

function activityHappened() {
  lastActivityTime = (new Date()).getTime();
}

function inactiveTimer () {
  var now = (new Date()).getTime();
  var timeoutAmount;
  if (inactivityTimeoutInMinutes === 0) { return; }

  if (inactivityTimeoutInMinutes) {
    timeoutAmount = inactivityTimeoutInMinutes * 60000; // default is 30 mins
  } else {
    timeoutAmount = 30 * 60000; // default is 30 mins
  }

  if (timeoutAmount !== 0) {
    if (now - lastActivityTime > timeoutAmount) {
      inactivityTimeout();
    }
  }
}


/**
 * INACTIVITY TIMEOUT THAT REMOVES THE KEY FROM SESSION STORAGE. IT'S USER SETTABLE, AND CURRENT DEFAULT IS 30 MINUTES.
 */
function inactivityTimeout () {
  if (theKey !== "" && theKey !== undefined && theKey !== null) {
    sessionStorage.removeItem('key');
    window.location.reload();
  }
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	PROMISE TIMEOUT
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * a quick timeout implementation for promises, so that we can continue flow even if a promise is left unresolved
 * @param {*} promise 
 * @param {*} ms 
 */
function promiseTimeout(promise, ms){

  return Promise.race([promise, promiseToWait(ms) ]);
  
}



/**
 * setTimeout, but with a promise. 
 * so you can use it like await helpers.promiseToWait(1000);
 * and the code in the next line will be executed 1s later.
 * @param {Number} ms
 * @param {*} callbackPromiseParamPassthrough
 * @returns {Promise}
 */
function promiseToWait(ms, callbackPromiseParamPassthrough) {
  let passthroughParam = callbackPromiseParamPassthrough;
  return new Promise(resolve => setTimeout(function () {
    resolve(passthroughParam);
  }, ms));
}






////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 SEARCH HELPERS
////////////////////////////////////////////////
////////////////////////////////////////////////


/**
 * Underlines search results returned by fuse
 * @param {*} indices 
 * @param {*} string 
 */
function underlineSearchResult(indices,string) {
  var pair = indices.shift();
  var formattedString = string;
  var resultname = [];
  // Build the formatted string
  for (var j = 0; j < string.length; j++) {
    var char = string.charAt(j);
    if (pair && j == pair[0]) {
      resultname.push('<u>');
    }
    resultname.push(char);
    if (pair && j == pair[1]) {
      resultname.push('</u>');
      pair = indices.shift();
    }
  }
  formattedString = resultname.join('');
  return formattedString;
}









////////////////////////////////////////////////
////////////////////////////////////////////////
//	ZEPTO POLYFILLS
////////////////////////////////////////////////
////////////////////////////////////////////////


// polyfill Zepto with outerHeight / outerWidth etc
(function ($) {
  ['width', 'height'].forEach(function (dimension) {
      var Dimension = dimension.replace(/./, function (m) { return m[0].toUpperCase(); });
      $.fn['outer' + Dimension] = function (margin) {
          var elem = this;
          if (!elem) { return null; }
          
          var size = elem[dimension]();
          var sides = { 'width': ['left', 'right'], 'height': ['top', 'bottom'] };
          sides[dimension].forEach(function (side) {
              if (margin) size += parseFloat(elem.css('margin-' + side), 10);
          });
          return size;
          
      };
  });
})(Zepto);


/**
 * Gets the scrollbar width if it's visible
 * @returns {Number} scrollbarWidth
 */
function getScrollbarWidth() {

  // Creating invisible container
  const outer = document.createElement('div');
  outer.style.visibility = 'hidden';
  outer.style.overflow = 'scroll'; // forcing scrollbar to appear
  outer.style.msOverflowStyle = 'scrollbar'; // needed for WinJS apps
  document.body.appendChild(outer);

  // Creating inner element and placing it in the container
  const inner = document.createElement('div');
  outer.appendChild(inner);

  // Calculating difference between container's full width and the child width
  const scrollbarWidth = (outer.offsetWidth - inner.offsetWidth);

  // Removing temporary elements from the DOM
  outer.parentNode.removeChild(outer);

  return scrollbarWidth;

}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	WEB SHARE WRAPPER
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Saves a file, or opens the share dialog for user to conveniently save / share it depending on OS. 
 * On iOS and Android PWAs shows share dialog. On desktop PWA, this will download regularly. 
 * @param {*} blob 
 * @param {String} filename (full filename with extension i.e. : "file.pdf")
 * @param {Boolean} [forceSaveAs] forces save as and disables sharing if passed (i.e. with multiple / bulk downloads)
 * @param {Boolean} [shareText] passes on additional text to the share modal
 */
async function saveAsOrShare(blob, filename, forceSaveAs, shareText) {
  var willShare = false;
  forceSaveAs = forceSaveAs || false;
  var shareObject = {};
  
  if (!blob || !filename) { 
    handleError("[SAVE OR SHARE] Can't save or share without a blob or filename. aborting.");
    return false; 
  }
  // if we're not forcing a saveAs
  // if device has web share API enabled,
  // if it's iOS PWA or Android PWA (if we're in the browser, it'll download to the default download folder anyhow so this is only for the PWA.)

  if (!forceSaveAs && navigator.share && navigator.canShare && (isAndroid || isios || isipados) && isInstalled) { 
    
    try {

      // convert the blob to file, then put it in the files array. 
      // we'll always share one file at a time for better compat. 
      
      var fileType = await mimetypeFromFilename(filename) || "text/plain";

      shareObject = { title: filename, files: [ new File([blob], filename, { type: fileType }) ] };
      
      if (shareText) { shareObject.text = shareText; }
      
    } catch (e) {
      console.error(e);
      handleError("[SAVE OR SHARE] Failed to load file into files array, will use saveAs as fallback", e, "warning");
    }

    try {
      
      // if this device and browser's APIs allow sharing this filetype, 
      // we'll use share dialog instead of download
      if (navigator.canShare(shareObject)) { 
        willShare = true; 
        breadcrumb("[SAVE OR SHARE] Supported system and filetype, will use native share modal");
      }
      
    } catch (error) {
      console.error(error);
      handleError("[SAVE OR SHARE] Failed to check if filetype can be shared, will use saveAs as fallback", error, "warning");
    }

  }
  
  if (!willShare) {

    breadcrumb("[SAVE OR SHARE] Saving as...");
    saveAs(blob, filename);

  } else {
    
    try {
    
      breadcrumb("[SAVE OR SHARE] Displaying native share modal.");
      await navigator.share(shareObject);
    
    } catch (error) {

      error.filetype = blob.type;
      error.extension = extensionFromFilename(filename);
      
      // if user didn't abort the share modal themselves, and we had some other error, use saveAs fallback instead.
      if (error.name !== "AbortError") {
        console.error(error);
        handleError("[SAVE OR SHARE] Failed to share from navigator, will saveAs instead", error, "warning");
        saveAs(blob, filename);
      }

    }

  }
  
}

////////////////////////////////////////////////
////////////////////////////////////////////////
//	MEDIA SESSION API WRAPPER
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Sets the native media controller UI properties for audio/video playback
 * @param {String} title 
 * @param {String} artworkURL 
 * @param {String} artworkMimetype (i.e. image/jpg)
 * @param {String} [artist] 
 * @param {String} [album]
 */
function setMediaSessionAPIMetadata(title, artworkURL, artworkMimetype, artist, album) {
  if (!'mediaSession' in navigator) { return null; }

  title = title || "";
  artist = artist || "";
  album = album || "";
  artworkURL = artworkURL || "";
  artworkMimetype = artworkMimetype || "";

  if (!title && !artworkURL && !artworkMimetype) { return null; }

  var mediaMetadata = {
    title: title,
    artwork: [ { src: artworkURL, sizes: '512x512', type: artworkMimetype } ]
  };

  if (artist) { mediaMetadata.artist = artist; }
  if (album) { mediaMetadata.album = album; }

  try {
    navigator.mediaSession.metadata = new MediaMetadata(mediaMetadata);
  } catch (e) {
    handleError("[MEDIA SESSION] API likely not supported", e, "warning");
  }

}




////////////////////////////////////////////////
////////////////////////////////////////////////
//	LAZY LOAD / PRELOAD ALL EDITOR ASSETS LIKS CSS, JS ETC 
//  AFTER THE REST OF THE APP HAS LOADED
////////////////////////////////////////////////
////////////////////////////////////////////////

let uncriticalAssetsLazyLoadStartTime;
let uncriticalAssetsLazyLoadEndTime;
$(window).on("load", function () {
  uncriticalAssetsLazyLoadStartTime = Date.now();
  breadcrumb('[LAZY LOADER] LOADING UNCRITICAL ASSETS...');
  lazyLoadUncriticalAssets();
});

function lazyLoadUncriticalAssets() {
  $("link[loadafter='windowload']").each(function () {
    let href = $(this).attr("lazyhref");
    $(this).attr("href", href);
    $(this).removeAttr("lazyhref");
    $(this).removeAttr("loadafter");
    breadcrumb('[LAZY LOADER] LOADING STYLE: ' + href);
  });

  const script = $("script[loadafter='windowload']")[0]; // since we'll keep calling this function each time the prev script loads, this will always give us the current one.

  if (script) {
    let src = $(script).attr("lazysrc");
    $(script).removeAttr("lazysrc");
    $(script).removeAttr("loadafter");
    $(script).on("load", lazyLoadUncriticalAssets);
    $(script).attr("src", src);
    breadcrumb('[LAZY LOADER] LOADING SCRIPT: ' + src);
  } else {
    uncriticalAssetsLazyLoadEndTime = Date.now();
    let lazyLoadTook = (uncriticalAssetsLazyLoadEndTime - uncriticalAssetsLazyLoadStartTime);
    breadcrumb('[LAZY LOADER] LOADED ALL ASSETS. TOOK ' + lazyLoadTook + "MS");
    setSentryTag("assets-lazy-loaded-time-ms", lazyLoadTook);
  }
    
}



////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 OTHER
////////////////////////////////////////////////
////////////////////////////////////////////////

$("a").on('touchstart mousedown', function (event) {
  var href = $(this).attr('href');

  if ($(this).hasClass("rememberKey") && keyToRemember) {
    sessionStorage.setItem("key", JSON.stringify(keyToRemember));
  }

  if (!isInstalled) { return; }
  if ($(this).hasClass("external")) { return; }

  if (typeof href !== typeof undefined && href !== false) {
    event.preventDefault();
    // this is to ensure back swipe gesture is disabled in PWAs (especially on iOS)
    // this makes sure there's no history = no back gesture.
    window.location.replace(href);
  }

});


