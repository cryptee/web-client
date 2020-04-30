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
            this.quill.updateContents(delta, Quill.sources.USER);
            // range.length contributes to delta.length()
            this.quill.setSelection(delta.length() - range.length, Quill.sources.SILENT);
            this.quill.scrollingContainer.scrollTop = scrollTop;
            this.quill.focus();
        }, 1);
    };

    return CrypteeClipboard;
}(Clipboard);

Quill.register('modules/clipboard', CrypteeClipboard, true);