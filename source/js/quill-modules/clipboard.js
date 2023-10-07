var CrypteeClipboard = function (_Clipboard) {
    _inherits(CrypteeClipboard, _Clipboard);

    function CrypteeClipboard() {
        _classCallCheck(this, CrypteeClipboard);
        return _possibleConstructorReturn(this, _Clipboard.apply(this, arguments));
    }

    var _proto = CrypteeClipboard.prototype;

    // https://github.com/quilljs/quill/pull/2116
    // Firefox has issues pasting embed / block elements like embed videos or crypteetags, or crypteetables. 
    // For some reason, Firefox strips iframe elements from content pasted into a contentEditable div. 
    // this is is a workaround to fix that.

    _proto.onPaste = function onPaste(e) {
        if (e.defaultPrevented || !this.quill.isEnabled()) return;
        var range = this.quill.getSelection();
        var delta = new Delta().retain(range.index);
        var scrollTop = this.quill.scrollingContainer.scrollTop;
        var scrollLeft = this.quill.scrollingContainer.scrollLeft;
        
        if (isFirefox) {
            if (e.clipboardData) {
                if (e.clipboardData.getData('text/html')) {
                
                    e.preventDefault();
                    this.container.innerHTML = e.clipboardData.getData('text/html');
                
                } else { this.container.focus(); }
            } else { this.container.focus(); }
        } else { this.container.focus(); }
    
        this.quill.selection.update(Quill.sources.SILENT);

        setTimeout(function() {
            delta = delta.concat(this.quill.clipboard.convert()).delete(range.length);
            delta = processColorsInDelta(delta);
            // console.log(delta);
            this.quill.updateContents(delta, Quill.sources.USER);
            // range.length contributes to delta.length()
            this.quill.setSelection(delta.length() - range.length, Quill.sources.SILENT);
            if (isPaperMode()) {
                this.quill.scrollingContainer.scrollLeft = scrollLeft;
            } else {
                this.quill.scrollingContainer.scrollTop = scrollTop;
            }
            this.quill.focus();
        }, 1);
    };

    return CrypteeClipboard;
}(Clipboard);

Quill.register('modules/clipboard', CrypteeClipboard, true);

$(document).on('paste', function(e) {
    
    // 
    // CONDITIONS TO ALLOW REGULAR PASTE AND RETURN
    // 

    // this means the key screen is visible, and user's trying to paste to the key screen.
    if (!theKey) { return true; }
    
    // allow paste into the new doc name input
    if ($("#new-doc-input").is(":focus")) { return true; }
    
    // allow paste into the copy doc name input
    if ($("#copy-doc-input").is(":focus")) { return true; }
    
    // allow paste into the new folder name input
    if ($("#new-folder-input").is(":focus")) { return true; }
    
    // allow paste into the rename doc/folder input
    if ($("#rename-input").is(":focus")) { return true; }

    // allow paste into the search input
    if ($("#searchInput").is(":focus")) { return true; }
    
    var clipboardData = (e.originalEvent || e).clipboardData;
    if (!clipboardData) { return false; }
    
    var files = clipboardData.files;
    if (!files) { return false; }

    if (!activeDocID) { 
        noOpenDocumentPopup();
        return false; 
    }

    // 
    // CONDITIONS TO HANDLE QUILL PASTE
    // 

    var lastSelectionRangeIndex = getLastSelectionRange().index;

    var hasRichText = e.clipboardData.getData('text/html') && e.clipboardData.getData('text/plain');

    for (var i = 0; i < files.length; i++) {
        if (!hasRichText && files[i].type.includes("image")) {     
                        
            processEmbedImage(files[i], lastSelectionRangeIndex);

            // to prevent image from pasting twice (it fires twice for some reason)
            e.preventDefault();
        }

        // you can handle other pasted things here
    }
}); 

/**
 * This removes dark mode's background-color = #121212 and color : #FFFFFF from deltas in clipboard if there's any
 * @param {*} delta 
 */
function processColorsInDelta(delta) {
    
    delta.ops.forEach(function(op) {
        if (op.attributes) {
            if (shouldColorBeExcludedFromPaste(op.attributes.background)) { delete op.attributes.background; }
            if (shouldColorBeExcludedFromPaste(op.attributes.color))      { delete op.attributes.color; }
        } 
    });

    return delta;

}

function shouldColorBeExcludedFromPaste(colorCode) {
    colorCode = colorCode || "";
    if (!colorCode) { return false; }

    colorCode = colorCode.toLowerCase();
    let excludedColorCodes = ["#000", "#000000", "#121212", "#fff", "#ffffff", "#f5f5f5", "black", "white"];
    
    if (excludedColorCodes.includes(colorCode)) {
        return true;
    } else {
        return false;
    }
}