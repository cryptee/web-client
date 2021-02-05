var ImageFormatAttributesList = ['alt', 'height', 'width', 'style', 'extsrc', 'extalt', 'draggable'];
var whitelisted_styles = ['display', 'float', "margin"];

var ImageFormat = function (_BaseImageFormat) {
    _inherits(ImageFormat, _BaseImageFormat);

    function ImageFormat() {
        _classCallCheck(this, ImageFormat);
        return _possibleConstructorReturn(this, (ImageFormat.__proto__ || Object.getPrototypeOf(ImageFormat)).apply(this, arguments));
    }
    _createClass(ImageFormat, [{
        key: 'format',
        value: function format(name, value) {
            if (ImageFormatAttributesList.indexOf(name) > -1) {
                if (value) {
                    if (name === 'style') {
                        value = this.sanitize_style(value);
                    }
                    this.domNode.setAttribute(name, value);
                } else {
                    this.domNode.removeAttribute(name);
                }
            } else {
                _get(ImageFormat.prototype.__proto__ || Object.getPrototypeOf(ImageFormat.prototype), 'format', this).call(this, name, value);
            }
        }
    }, {
        key: 'sanitize_style',
        value: function sanitize_style(style) {
            var style_arr = style.split(";");
            var allow_style = "";
            style_arr.forEach(function (v, i) {
                if (whitelisted_styles.indexOf(v.trim().split(":")[0]) !== -1) {
                    allow_style += v + ";";
                }
            });
            return allow_style;
        }
    }], [{
        key: 'formats',
        value: function formats(domNode) {
            return ImageFormatAttributesList.reduce(function (formats, attribute) {
                if (domNode.hasAttribute(attribute)) {
                    formats[attribute] = domNode.getAttribute(attribute);
                }
                return formats;
            }, {});
        }
    }]);

    return ImageFormat;
}(BaseImageFormat);

Quill.register(ImageFormat, true);




////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////
//
//  HANDLE EXTERNAL / INSECURE IMAGES
//
////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////

// When users copy paste / import images from the web into the editor, images are pasted as <img src="site.com/img.jpg"/> tags. 
// These get pasted into the editor as-is, using the url as the image source. Causing a bunch of major problems.
//
// 1) If images are from insecure URLs, users browser will display an insecure warning on Cryptee's page.
// 2) Adblockers / Connection trackers will show Cryptee making outgoing connections to these sites, confusing them to think Cryptee itself made these requests
// 3) Images could track users on server side by watching when they're loaded. 
// 4) These may contain onload triggers / other executable triggers which our XSS filters may fail to strip.
// 5) Since embedded images would need to be accessible offline, but without internet we wouldn't be able to fetch them, this causes offline availability problems as well. 
// 6) Finally, images could come from Evernote imports / markdown imports / html imports, and not just copy / paste. So even if we filter for things well on paste, others don't. 
// .... I'm looking at you Evernote .... 

// so we'll have to do what email apps do. show a warning about external images. 
// if user clicks : "display", we'll display these images.

// the only way around these issues is to download the images, and use b64 instead of their URLs.
// But we can't do this on clientside. if the images don't have CORS support, then we can't call getImageData() or toBlob() etc,
// or we'll get a tainted canvas. 

// so the only solution is to proxy the request to the images.
// And this is quite privacy-invasive. 

function handleExternalImages(node, delta) {
    try {
        var img = $(node);
        var src = img.attr("src") || "";
        var alt = img.attr("alt") || "";
        
        if (!src) { return delta; }
    
        if (!src.startsWith("data:") && src !== "//:0") {
            delete delta.ops[0].attributes.style;
            
            delta.ops[0].attributes.extsrc = src;
            delta.ops[0].attributes.extalt = alt;
            
            delta.ops[0].insert.image = "//:0";          // src
            delta.ops[0].attributes.alt = "";            // alt
            delta.ops[0].attributes.draggable = "false";
            
            breadcrumb("[INSECURE IMAGES] Showing insecure images warning.");
            showModal("modal-remote-images");
        }
    } catch (error) {}

    return delta;
}


$("#remoteImagesButton").on('click', function(event) {
    var state = $("#remoteImagesButton").attr("remoteimages");
    if (state === "loaded") {
        // block insecure images here
        $('.ql-editor').find('img').each(blockInsecureImage);
    } else {
        showModal("modal-remote-images");
    }
}); 

function loadInsecureImages() {
    $('img[extsrc][src="//:0"').each(function(){
        var extsrc = $(this).attr("extsrc");
        $(this).attr("src", extsrc);
        $(this).attr("extsrc", "//:0");
        
        var extalt = $(this).attr("extalt");
        $(this).attr("alt", extalt);
        $(this).attr("extalt", "");

        $(this).removeAttr("draggable");
    });
}

/**
 * A function to block insecure images, 
 * to be used in $.each like$('img[extsrc]').each(blockInsecureImage);
 * @param {*} index 
 * @param {*} imgElement 
 */
function blockInsecureImage(index, imgElement) {
    var src = $(imgElement).attr("src");
    if (src.startsWith("data:") || src === "//:0") { return; }

    $(imgElement).attr("src", "//:0");
    $(imgElement).attr("extsrc", src);
    
    var alt = $(imgElement).attr("alt");
    $(imgElement).attr("alt", "");
    $(imgElement).attr("extalt", alt);

    $(imgElement).attr("draggable", "false");
}

function checkIfDocumentHasRemoteImages() {
    var visibleInsecureImages = false;
    var numberOfRemoteImages = $('img[extsrc]').length;
    
    $('img[extsrc]').each(function(){
        var src = $(this).attr("src") || "";
        if (src !== "//:0") { visibleInsecureImages = true; }
    });
    
    var hasRemoteImages = (numberOfRemoteImages > 0);
    $("#panel-button-docinfo").toggleClass("warning", hasRemoteImages);
    $("#remoteImagesButton").toggle(hasRemoteImages);

    if (visibleInsecureImages) {
        $("#remoteImagesButton").attr("remoteimages", "loaded");
    } else {
        $("#remoteImagesButton").attr("remoteimages", "hidden");
    }
}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	IMAGE SELECTED
////////////////////////////////////////////////
////////////////////////////////////////////////

function isSelectedImage() {
    return $(".imageResizeOverlay").length;
}
