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

function detectIE() {
    var ua = winNav.userAgent;
  
    var msie = ua.indexOf('MSIE ');
    if (msie > 0) {
      // IE 10 or older => return version number
      return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
    }
  
    var trident = ua.indexOf('Trident/');
    if (trident > 0) {
      // IE 11 => return version number
      var rv = ua.indexOf('rv:');
      return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
    }
  
    var edge = ua.indexOf('Edge/');
    if (edge > 0) {
      // Edge (IE 12+) => return version number
      return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
    }
  
    // other browser
    return false;
}

var isMSFT = false;
if (detectIE() !== false) {
  isMSFT = true;
  alert("We've detected that you're using Internet Explorer or Edge for your web browser. \n\nCrypt.ee relies on multiple cutting edge web encryption technologies, and sadly Internet Explorer and Edge don't have some of these features. \n\nBefore you proceed any further, we recommend that you download either Google Chrome or Firefox as a web browser for your computer, otherwise we can't promise that Crypt.ee will work in your current browser.");
}

function iosVersion() {
    if (/iP(hone|od|ad)/.test(navigator.platform)) {
        try { 
            var v = (navigator.appVersion).match(/OS (\d+)_(\d+)_?(\d+)?/);
            var ver = [parseInt(v[1], 10), parseInt(v[2], 10), parseInt(v[3] || 0, 10)];
            return ver;
        } catch (error) {
            return false;
        }
    }
}


if (isipados) { setSentryTag("ipados", "true"); }

function inIframe () {
  try {
      return window.self !== window.top;
  } catch (e) {
      return true;
  }
}

setSentryTag("in-iframe", inIframe());



function isRetina() {
  return window.devicePixelRatio > 1;
}

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
 * 
 * @param {String} string Parse a URL Slug
 */
function parseSlug(string) {
  return string.replace(/-/g, " ").replace(".html", "");
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
 * 
 * @param {String} string Create a URL slug like a-url-slug from a string like "A URL Slug"
 */
function slugify(string) {
  var a = 'àáäâãåăæçèéëêǵḧìíïîḿńǹñòóöôœṕŕßśșțùúüûǘẃẍÿź·/_,:;';
  var b = 'aaaaaaaaceeeeghiiiimnnnoooooprssstuuuuuwxyz------';
  var p = new RegExp(a.split('').join('|'), 'g');

  return string.toString().toLowerCase()
    .replace("</strong>","")
    .replace("<strong>", "")
    .replace(/\//g, "-")
    .replace(/&nbsp;/g, "")
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(p, function(c) { b.charAt(a.indexOf(c))}) // Replace special characters
    .replace(/&/g, '-and-') // Replace & with 'and'
    .replace(/[^\w\-]+/g, '') // Remove all non-word characters
    .replace(/\-\-+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
}

/**
 * 
 * @param {string} str converts string to base64 url
 */
function stringToB64URL(str) {
  return btoa(encodeURI(str)).replace("/", "_");
}

/**
 * 
 * @param {string} str converts base64 url to string
 */
function b64URLToString(str) {
  return decodeURI(atob(str.replace("_", "/")));
}



/**
 * converts dataURI to Blob
 * @param {string} dataURI
 */
function dataURIToBlob(dataURI) {
  var spacelessDataURI = dataURI.replace(/\s/g, ''); // ios doesn't accept spaces and crashes browser. like wtf apple. What. THE. FUCCK!!!
  var binStr = decodeBase64(spacelessDataURI.split(',')[1]),
    len = binStr.length,
    arr = new Uint8Array(len);

  for (var i = 0; i < len; i++) {
    arr[i] = binStr.charCodeAt(i);
  }

  var typeAndCharset = spacelessDataURI.substring(spacelessDataURI.indexOf(":")+1, spacelessDataURI.indexOf(";base64"));
  return new Blob([arr], {type : typeAndCharset});
}


/**
 * converts a dataURI to a File object
 * @param {string} dataURI 
 * @param {string} filename 
 */
function dataURIToFile(dataURI, filename) {
  // a blob is almost a File()... we just need two more properties, and we can add them in blobToFile
  return blobToFile(dataURIToBlob(dataURI), filename);
}


/**
 * converts a blob to a File object
 * @param {*} blob 
 * @param {string} filename 
 */
function blobToFile(blob, filename) {
  // a blob is almost a File()... we just need two more properties
  blob.lastModifiedDate = new Date();
  blob.name = filename;
  return blob;
}



/**
 * Creates a blob using a uInt8Array & mimetype
 * @param {*} buffer 
 * @param {*} mimetype
 */
function uInt8ArrayToBlob(buffer, mimetype) {
  return new Blob([buffer], {type : mimetype});
}



/**
 * Takes a blob, and returns an img src settable, objectURL
 * @param {*} blob a blob
 */
function blobToObjectURL(blob) {
  return (URL || webkitURL).createObjectURL(blob);
}

/**
 * Converts an arraybuffer to uint8array
 * @param {*} buffer 
 */
function arrayBufferToUint8Array(buffer) {
  return new Uint8Array([buffer]);
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
 * 
 * @param {string} base64 sanitizes Base64 to make it Web Safe
 */
function sanitizeB64(base64) {
  return base64.replace(/\n/g, "").replace(/\s/g, '');
}


/**
 * 
 * @param {string} s decode base64 (to be used instead of atob)
 */
var decodeBase64 = function(s) {
    var e={},i,b=0,c,x,l=0,a,r='',w=String.fromCharCode,L=s.length;
    var A="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for(i=0;i<64;i++){e[A.charAt(i)]=i;}
    for(x=0;x<L;x++){
        c=e[s.charAt(x)];b=(b<<6)+c;l+=6;
        while(l>=8){((a=(b>>>(l-=8))&0xff)||(x<(L-2)))&&(r+=w(a));}
    }
    return r;
};

function decodeBase64Unicode(str) {
    return decodeURIComponent(Array.prototype.map.call(atob(str), function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}


/**
 * Converts a uint8Array to a decoded string (i.e. a uint8Array html file to raw html string)
 * @param {*} uint8Array 
 */
function decodeUint8Array(uint8Array) {
  return new TextDecoder("utf-8").decode(uint8Array);
}


/**
 * Converts a dataURI to a UINT8 Array
 * @param {string} dataURI
 * @returns {*} UINT8ARRAY
 */
function convertDataURIToBinary(dataURI) {
  var b64Marker = ';base64,';
  var base64Index = dataURI.indexOf(b64Marker) + b64Marker.length;
  var base64 = dataURI.substring(base64Index);
  var raw = window.atob(base64);
  var rawLength = raw.length;
  var array = new Uint8Array(new ArrayBuffer(rawLength));

  for(var i = 0; i < rawLength; i++) {
    array[i] = raw.charCodeAt(i);
  }
  return array;
}

function dec2hex (dec) {
  return ('0' + dec.toString(16)).substr(-2);
}





/**
 * Remove an Object from Array by Attribute
 * @param {Array} arr 
 * @param {*} attr 
 * @param {*} value 
 */
function removeByAttr(arr, attr, value){
  var i = arr.length;
  while(i--){
     if( arr[i] && arr[i].hasOwnProperty(attr) && (arguments.length > 2 && arr[i][attr] === value ) ){
         arr.splice(i,1);
     }
  }
  return arr;
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
 * Lazy loading for all uncritical media assets. It checks for images that have [lazy-src] and replaces it with [src] to load them. 
 */
function lazyLoadUncriticalAssets() {
  [].forEach.call(document.querySelectorAll('img[lazy-src]'), function(img) {
    img.setAttribute('src', img.getAttribute('lazy-src'));
    img.onload = function() {
      img.removeAttribute('lazy-src');
    };
  });
}

/**
 * Loads any given URL in a popup (i.e. Paddle's change payment method popup)
 * @param {string} url pop-up URL
 * @param {string} title pop-up title
 * @param {number} w popup width
 * @param {number} h popup height
 */
function popupLoadURL(url, title, w, h) {
  // Fixes dual-screen position                         Most browsers      Firefox
  var dualScreenLeft = window.screenLeft != undefined ? window.screenLeft : screen.left;
  var dualScreenTop = window.screenTop != undefined ? window.screenTop : screen.top;

  var width = window.innerWidth ? window.innerWidth : document.documentElement.clientWidth ? document.documentElement.clientWidth : screen.width;
  var height = window.innerHeight ? window.innerHeight : document.documentElement.clientHeight ? document.documentElement.clientHeight : screen.height;

  var left = ((width / 2) - (w / 2)) + dualScreenLeft;
  var top = ((height / 2) - (h / 2)) + dualScreenTop;
  var newWindow = window.open(url, title, 'scrollbars=yes, width=' + w + ', height=' + h + ', top=' + top + ', left=' + left);

  // Puts focus on the newWindow
  if (newWindow) {
    if (window.focus) {
      newWindow.focus();
    }
  }
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
 * Is Element Scrolled Into View
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
      // var isVisible = (elemTop >= 0) && (elemBottom <= window.innerHeight);
      
      // Partially visible elements return true:
      var isVisible = elemTop < window.innerHeight && elemBottom >= 0;
      return isVisible;
    } else {
      return false;
    }
  } else {
    return false;
  }
}

/**
 * Determines whether if a click event was inside the given element(s) or not.
 * @param {*} event the click event
 * @param {array|string} elementSelectors string ('.box') or array of strings ['.box','#circle'] etc. 
 */
function isClickInside(event, elementSelectors) {
  var clickInside = false;
  if (typeof elementSelectors === "string") { elementSelectors = [elementSelectors]; }
  elementSelectors.forEach(element => {
    clickInside = clickInside || $(element)[0].contains(event.target);
  });
  return clickInside;
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



////////////////////////////////////////////////
////////////////////////////////////////////////
//	BROWSER EXIF ORIENTATION TREATMENT
////////////////////////////////////////////////
////////////////////////////////////////////////



var browserWillHandleEXIFOrientation;

// https://github.com/blueimp/JavaScript-Load-Image/commit/1e4df707821a0afcc11ea0720ee403b8759f3881
// Check if browser supports automatic image orientation
function determineBrowserEXIFOrientationTreatment() {
    // black 2x1 JPEG, with the following meta information set - EXIF Orientation: 6 (Rotated 90° CCW)
    var testImageURL =
        'data:image/jpeg;base64,/9j/4QAiRXhpZgAATU0AKgAAAAgAAQESAAMAAAABAAYAAAA' +
        'AAAD/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBA' +
        'QEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE' +
        'BAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAf/AABEIAAEAAgMBEQACEQEDEQH/x' +
        'ABKAAEAAAAAAAAAAAAAAAAAAAALEAEAAAAAAAAAAAAAAAAAAAAAAQEAAAAAAAAAAAAAAAA' +
        'AAAAAEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8H//2Q==';
    var img = document.createElement('img');
    img.onload = function () {
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
    };
    img.src = testImageURL;
}

determineBrowserEXIFOrientationTreatment();





////////////////////////////////////////////////
////////////////////////////////////////////////
//	READ EXIF
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Reads an arrayBuffer, and returns all the exif we need
 * @param {*} originalBuffer arrayBuffer for file
 * @returns {Object} exif
 */
async function readEXIF(originalBuffer) {
    
  var tags = {}; 
  var exif = {};

  if (!originalBuffer) { return exif; }

  try {
      breadcrumb('[EXIF READER] Reading ...');
      tags = ExifReader.load(originalBuffer);
  } catch (error) {
      breadcrumb("[EXIF READER] Failed to load tags", error);
      return exif;
  }

  if (isEmpty(tags)) { return exif; }

  if (tags.DateTime)          { exif.DateTime             = tags.DateTime.value[0] || "";            }
  if (tags.DateTimeDigitized) { exif.DateTimeDigitized    = tags.DateTimeDigitized.value[0] || "";   }
  if (tags.DateTimeOriginal)  { exif.DateTimeOriginal     = tags.DateTimeOriginal.value[0] || "";    }
  if (tags.Orientation)       { exif.Orientation          = tags.Orientation.value[0] || "";         }
  
  return exif;

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
//	WAKE LOCK
////////////////////////////////////////////////
////////////////////////////////////////////////

// https://web.dev/wake-lock/

// Check if screen Wake Lock API supported

var isWakelockSupported = false;

try {
  if ('wakeLock' in navigator) { 
    isWakelockSupported = true; 
  }
} catch (error) {}

setSentryTag("wakeLockSupported", isWakelockSupported);

// The wake lock sentinel.
var wakeLock = null;

/**
 * ENABLES / REQUESTS WAKE LOCK TO KEEP DEVICE AWAKE (I.E. DURING UPLOADS)
 */
async function enableWakeLock() {
  if (isWakelockSupported && !wakeLock) {

    try {
      wakeLock = await navigator.wakeLock.request('screen');
      breadcrumb('[WAKE LOCK] Requested');
      return true; 
    } catch (error) {
      breadcrumb('[WAKE LOCK] Failed / Rejected');
      return false;
    }
    
  } else {
    return false;
  }
}

/**
 * RELEASES WAKE LOCK TO LET DEVICE SLEEP
 */
function disableWakeLock() {
  if (isWakelockSupported && wakeLock) {
  
    wakeLock.release();
    wakeLock = null;
    breadcrumb('[WAKE LOCK] Released');
    
  }
}



/////////////////////////////////////////////////////////////////////////////////
//////////////// OPENPGPJS SETUP ////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////

var cryptoThreadsCount = 1;
var multithreadedCrypto = false;

if (navigator.hardwareConcurrency && canUseWorkers) {
  cryptoThreadsCount = navigator.hardwareConcurrency;
  setSentryTag("cryptoThreadsCount", cryptoThreadsCount);
}

try {
  openpgp.config.aead_protect = true; // activate fast AES-GCM mode (not yet OpenPGP standard)
  openpgp.config.aead_protect_version = 0;
  openpgp.initWorker({path: '../js/lib/openpgpjs/openpgp.worker-4.5.3.min.js', n :cryptoThreadsCount }); // set the relative web worker path
} catch (e) {
  breadcrumb("Problem initializing openpgp in main js, failed in try/catch.");
  handleError("Problem initializing openpgp in main js, failed in try/catch.", e, "warning");
}

if (!openpgp) {
  breadcrumb("Problem initializing openpgp in main js.");
  handleError("Problem initializing openpgp in main js, openpgp is undefined.", {}, "warning");
} else {
  var openpgpversion = openpgp.config.versionstring.split("v")[1];
  setSentryTag("openpgp-ver", openpgpversion);

  if (cryptoThreadsCount >= 2 && canUseWorkers) {
    breadcrumb("[OpenPGPjs] Using " + cryptoThreadsCount + " worker thread(s)");
    breadcrumb("[OpenPGPjs] Bypassing native WebCrypto for better multi-threaded performance");
    openpgp.config.use_native = false;
    multithreadedCrypto = true;
  } else {
    breadcrumb("[OpenPGPjs] Using " + cryptoThreadsCount + " worker thread(s), with native WebCrypto");
  }

}


/////////////////////////////////////////
// ENCRYPT PLAINTEXT USING KEYS
//                               
// A DROP-IN, SHORTHAND REPLACEMENT FOR    
// OPENPGPJS's .encrypt
// WORKS STARTING WITH OPENPGPJS V4.4.1
//////////////////////////////////////////

/**
 * Encrypts given plaintext string with the given keys, returns a promise with ciphertext
 * @param {string} plaintext 
 * @param {array} keys 
 * @returns {promise} promise with ciphertext
 */
function encrypt(plaintext, keys) {
  return new Promise(function (resolve, reject) {

    var options = {
      message: openpgp.message.fromText(plaintext),
      passwords: keys,
      armor: true
    };

    openpgp.encrypt(options).then(function (ciphertext) {
      resolve(ciphertext);
    }).catch(function (error) {
      reject(error);
    });

  });
}

/////////////////////////////////////////
// DECRYPT CIPHERTEXT USING KEYS
//                               
// A DROP-IN, SHORTHAND REPLACEMENT FOR    
// OPENPGPJS's .decrypt
// WORKS STARTING WITH OPENPGPJS V4.4.1
//////////////////////////////////////////

/**
 * Decrypts given ciphertext string with the given keys, returns a promise with plaintext
 * @param {string} ciphertext 
 * @param {array} keys 
 * @returns {promise} promise with plaintext
 */
function decrypt(ciphertext, keys) {
  return new Promise(function (resolve, reject) {
    openpgp.message.readArmored(ciphertext).then(function (msg) {

      var options = {
        message: msg,
        passwords: keys,
        format: 'utf8'
      };

      openpgp.decrypt(options).then(function (plaintext) {
        resolve(plaintext);
      }).catch(function (error) {
        reject(error);
      });

    });
  });
}

/////////////////////////////////////////////////////////////
// ENCRYPT Uint8Array USING KEYS
//
// TAKES IN A UINT8ARRAY
// RETURNS A Uint8Array
/////////////////////////////////////////////////////////////

/**
 * Encrypts the plaintext Uint8Array with the given keys, returns a promise with ciphertext Uint8Array 
 * @param {Uint8Array} plaintext
 * @param {array} keys 
 * @returns {promise} promise with ciphertext uint8array
 */
function encryptUint8Array(plaintext, keys) {
  return new Promise(function (resolve, reject) {
    var options = {
      message: openpgp.message.fromBinary(plaintext),
      passwords: keys,
      // armor: false
      armor: true
    };

    openpgp.encrypt(options).then(function(ciphertext) {
      // resolve(ciphertext.message.packets.write()); //ciphertext Uint8Array
      resolve(ciphertext); // ciphertext 
    }).catch(function (error) {
      reject(error);
    });
  });
}



/////////////////////////////////////////
// DECRYPT CIPHERTEXT TO UINT8ARRAY USING KEYS
//                               
// TAKES IN A CIPHERTEXT    
// AND RETURNS A UINT8ARRAY
//////////////////////////////////////////

/**
 * Decrypts given ciphertext string with the given keys, returns a promise with ciphertext Uint8Array
 * @param {string} ciphertext 
 * @param {array} keys 
 * @returns {promise} promise with plaintext
 */
function decryptToBinary(ciphertext, keys) {
  return new Promise(function (resolve, reject) {
    openpgp.message.readArmored(ciphertext).then(function (msg) {

      var options = {
        message: msg,
        passwords: keys,
        format: 'binary'
      };

      openpgp.decrypt(options).then(function (plaintext) {
        resolve(plaintext);
      }).catch(function (error) {
        reject(error);
      });

    });
  });
}




/////////////////////////////////////////////////////////////
// HASH A STRING
// 
/////////////////////////////////////////////////////////////

/**
 * Hashes a string using SHA 256 or 512
 * @param {string} str string to hash
 * @param {('256'|'512'))} strength SHA256 OR SHA512
 * @returns {promise} – promise with hashed string
 */
function hashString (str, strength) {
  return new Promise(function (resolve, reject) {
    var uinta = openpgp.util.str_to_Uint8Array(str);
    var algo = openpgp.crypto.hash.sha256(uinta);
    strength = strength || "256";
    if (strength === "512") { 
      algo = openpgp.crypto.hash.sha512(uinta); 
    }
    algo.then(function (hashedUintA) {
      var hashedStr = openpgp.util.Uint8Array_to_str(hashedUintA);
      var hashedHex = openpgp.util.str_to_hex(hashedStr);
      var result = hashedHex.split(" ").join("").split("\n").join("");
      resolve(result);
    }).catch(function (error) {
      reject(error);
    });
  });
}

/**
 * generates a strong key
 * @returns {string} – a cryptographically strong string that can be used as a key
 */
function generateStrongKey() {
  var arr = new Uint8Array(1024);
  crypto.getRandomValues(arr);
  return Array.from(arr, dec2hex).join('');
}






/////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////




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
// 	 OTHER
////////////////////////////////////////////////
////////////////////////////////////////////////

$("a").on('click', function (event) {
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