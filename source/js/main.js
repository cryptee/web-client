var isMobile = false; //initiate as false
var freeUserQuotaInBytes = 100000000;



////////////////////////////////////////////////////
///////////////////   HELPERS    ///////////////////
////////////////////////////////////////////////////

// ES 6 BACKWARD COMP
function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }
function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }
function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

// device detection
if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(navigator.userAgent) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(navigator.userAgent.substr(0,4))) isMobile = true;

//JQUERY AJAX PROGRESS
!function(e){"function"==typeof define&&define.amd?define(["jquery"],e):"object"==typeof exports?module.exports=e(require("jquery")):e(jQuery)}(function(e){var n=e.ajax.bind(e);e.ajax=function(r,t){"object"==typeof r&&(t=r,r=void 0),t=t||{};var o;o=t.xhr?t.xhr():e.ajaxSettings.xhr(),t.xhr=function(){return o};var s=t.chunking||e.ajaxSettings.chunking;o.upload.onprogress=null;var i=n(r,t);return i.progress=function(e){var n=0;return o.addEventListener("progress",function(r){var t=[r],o="";3==this.readyState&&s&&(o=this.responseText.substr(n),n=this.responseText.length,t.push(o)),e.apply(this,t)},!1),this},i.uploadProgress=function(e){return o.upload&&o.upload.addEventListener("progress",function(n){e.apply(this,[n])},!1),this},i}});

// JOIN ARRAYS
Array.prototype.unique = function() {
  var a = this.concat();
  for(var i=0; i<a.length; ++i) {
      for(var j=i+1; j<a.length; ++j) {
          if(a[i] === a[j])
              a.splice(j--, 1);
      }
  }

  return a;
};

// Format Bytes

function formatBytes (bytes) {
   if (bytes === 0) { return '0 Bytes'; }
   var k = 1000,
       dm = 0,
       sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
       i = Math.floor(Math.log(bytes) / Math.log(k));
   return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// Time Since

function timeSince(epoch) {

    var seconds = Math.floor((new Date().getTime() - epoch) / 1000);
    var intervalType;

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

    if (interval > 1 || interval === 0) {
        intervalType += 's';
    }

    return interval + ' ' + intervalType;
}

// var array3 = array1.concat(array2).unique();

var isInWebAppiOS = (window.navigator.standalone === true);
var isInWebAppChrome = (window.matchMedia('(display-mode: standalone)').matches);
var isios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

if (isInWebAppiOS && isInWebAppChrome) {
  $("a").click(function (event) {
    var attr = $(this).attr('href');
    if (typeof attr !== typeof undefined && attr !== false) {
      event.preventDefault();
      window.location = $(this).attr("href");
    }
  });
}

// Data URI to Blob

function dataURIToBlob(dataURI) {
  var spacelessDataURI = dataURI.replace(/\s/g, ''); // ios doesn't accept spaces and crashes browser. like wtf apple. What. THE. FUCCK!!!
  var binStr = atob(spacelessDataURI.split(',')[1]),
    len = binStr.length,
    arr = new Uint8Array(len);

  for (var i = 0; i < len; i++) {
    arr[i] = binStr.charCodeAt(i);
  }

  return new Blob([arr]);
}

// REMOVE OBJ FROM ARRAY BY ATTR

var removeByAttr = function(arr, attr, value){
    var i = arr.length;
    while(i--){
       if( arr[i] && arr[i].hasOwnProperty(attr) && (arguments.length > 2 && arr[i][attr] === value ) ){
           arr.splice(i,1);
       }
    }
    return arr;
};

// TOGGLE FULLSCREEN

function toggleFullScreen() {
  var doc = window.document;
  var docEl = doc.documentElement;

  var requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
  var cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;

  if(!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
    requestFullScreen.call(docEl);
  }
  else {
    cancelFullScreen.call(doc);
  }
}

// OBJECT BYTESIZE CALCULATOR (SAY FOR EXAMPLE HOW MANY BYTES IS A STRING ETC. OR A DOCUMENT / OR A PHOTO B64 ETC.)
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



$.fn.extend({
    disable: function(state) {
        return this.each(function() {
            this.disabled = state;
        });
    }
});



//////// MODALS //////////

$(".modal-close").on('click', function(event) {
  $(this).parents(".modal").removeClass('is-active');
  $(this).parents(".modal").find('input').val("");
  $(this).parents(".modal").find('input').blur();
  $(this).parents(".modal").find("#ghost-folder-confirm-button").prop("disabled", true);
});

$(".modal-background").on('click', function(event) {
  if($(".modal.is-active:not(#key-modal)")){
    $(".modal.is-active:not(#key-modal)").removeClass('is-active');
    $(".modal.is-active").find("input").val("");
    $(".modal.is-active").find("input").blur();
  }
});



////////////////////////////////////////////////
//////////////// FIREBASE SETUP ////////////////
////////////////////////////////////////////////

var config = {
    apiKey: "AIzaSyBzI3Sr5lx_mhbmmlS8eehdUBfRXb7EyRk",
    authDomain: "cryptee-54307.firebaseapp.com",
    databaseURL: "https://cryptee-54307.firebaseio.com",
    projectId: "cryptee-54307",
    storageBucket: "cryptee-54307.appspot.com",
    messagingSenderId: "88760710137"
  };

firebase.initializeApp(config);
try { Raven.config('https://bbfa9a3a54234070bc0899a821e613b8@sentry.io/149319', { release: '1.0.0' }).install(); } catch (e) { }

var db = firebase.database();
var store = firebase.storage();
var noop = function(){}; // do nothing.
var tokenURL = "https://us-central1-cryptee-54307.cloudfunctions.net/auth";

///////////////////////////////////////////
//////////////// PGP SETUP ////////////////
///////////////////////////////////////////
try {
openpgp.initWorker({ path:'../js/lib/openpgp.worker.min.js' }); // set the relative web worker path
openpgp.config.aead_protect = true; // activate fast AES-GCM mode (not yet OpenPGP standard)
} catch (e) {}
///////////////////////////////////////////
//////////////// SET CURRENCIES  //////////
///////////////////////////////////////////

var previousCur = "";
$(document).ready(function() {
  var setCurrenciesInterval = setInterval(function () {
    if ($("#user-currency")[0]) {
      if ($("#user-currency")[0].innerText !== previousCur) {
        if ($("#user-currency")[0].innerText === "USD") {
          try { $('.additional-cur').html("$"); } catch (e) {}
          try { $('.cur').html("$"); } catch (e) {}
        } else {
          try { $('.additional-cur').html("€"); } catch (e) {}
          try { $('.cur').html("€"); } catch (e) {}
        }
        previousCur = $("#user-currency")[0].innerText;
        clearInterval(setCurrenciesInterval);
      }
    }
  }, 1000);
});

///////////////////////////////////////////
//////////////// REPORT BUGS /////////////
///////////////////////////////////////////

function reportBug () {
  var win = window.open("https://goo.gl/forms/8Jvy2wJrD8GsFUq43", '_blank');
  if (win) { win.focus(); }
}
