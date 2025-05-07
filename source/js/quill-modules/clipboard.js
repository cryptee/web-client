////////////////////////////////////////////////
////////////////////////////////////////////////
//
//  CLIPBOARD MODULE
//  Handles paste events for Quill editor
//  including markdown detection & conversion
//
////////////////////////////////////////////////
////////////////////////////////////////////////


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

        ////////////////////////////////////////////////
        //  MARKDOWN PASTE DETECTION
        //  If paste is plain-text only (no text/html),
        //  check if it looks like markdown and convert
        ////////////////////////////////////////////////

        var pastedAsMarkdown = false;

        if (e.clipboardData) {
            var hasHTML = e.clipboardData.getData('text/html');
            var plainText = e.clipboardData.getData('text/plain');

            // Only attempt markdown detection on plain-text-only pastes.
            // If text/html is present, the source app already provided rich formatting,
            // so we let Quill handle it normally (no double-parsing).
            if (!hasHTML && plainText && pastedTextLooksLikeMarkdown(plainText)) {
                e.preventDefault();
                var markdownHTML = convertMarkdownToClipboardHTML(plainText);
                this.container.innerHTML = markdownHTML;
                pastedAsMarkdown = true;
            }
        }

        if (!pastedAsMarkdown) {
            if (isFirefox && e.clipboardData) {
                var htmlData = e.clipboardData.getData('text/html');
                if (htmlData) { e.preventDefault(); this.container.innerHTML = htmlData; } else { this.container.focus(); }
            } else { this.container.focus(); }
        }

        this.quill.selection.update(Quill.sources.SILENT);

        setTimeout(function() {
            delta = delta.concat(this.quill.clipboard.convert()).delete(range.length);
            delta = cleanClipboardText(delta);
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

    /**
     * Handles copy and cut events. Reads the selected range from
     * Quill's delta to produce clean plain text (single newlines,
     * not the double newlines browsers generate from <p> blocks).
     * Sets both text/plain and text/html on the clipboard manually.
     * For cut events, also deletes the selected content.
     * 
     * Fixes: https://github.com/cryptee/web-client/issues/87
     * Root cause: https://github.com/slab/quill/issues/745
     * 
     * @param {ClipboardEvent} e - the copy or cut event
     */
    _proto.onCopy = function onCopy(e) {
        if (e.defaultPrevented || !this.quill.isEnabled()) { return; }

        var range = this.quill.getSelection();
        if (!range || range.length === 0) { return; }

        // plain text straight from the delta (source of truth - no double newlines)
        var plainText = this.quill.getText(range.index, range.length);

        // html from the DOM selection, purified before leaving the app
        var html = purifyHTML(getSelectedHTML());

        e.preventDefault();

        e.clipboardData.setData('text/plain', plainText);
        e.clipboardData.setData('text/html', html);

        // for cut events, delete the selected text afterward
        if (e.type === 'cut') {
            this.quill.deleteText(range.index, range.length, Quill.sources.USER);
        }
    };

    return CrypteeClipboard;
}(Clipboard);

Quill.register('modules/clipboard', CrypteeClipboard, true);


////////////////////////////////////////////////
////////////////////////////////////////////////
//
//  MARKDOWN DETECTION
//  Scores pasted plain text for markdown patterns.
//  High-signal patterns = structural syntax people
//  rarely use in casual plain text.
//  Low-signal patterns = could be casual text.
//
//  Threshold of 3+ avoids false positives on
//  normal text while catching real markdown.
//
////////////////////////////////////////////////
////////////////////////////////////////////////


/**
 * Determines whether a plain-text string looks like markdown by
 * scoring it against known structural patterns. Returns true if
 * the confidence score meets the threshold (>= 3).
 *
 * HIGH-SIGNAL (2 pts each) — things people almost never type casually:
 *   - ATX headings with space (## , ### , etc.)
 *   - Fenced code blocks (``` or ~~~)
 *   - Markdown links [text](url)
 *   - Markdown images ![alt](url)
 *   - Table rows (| col | col |)
 *   - Blockquotes (> at line start)
 *   - Task lists (- [ ] or - [x])
 *   - Horizontal rules (--- or *** or ___ on own line)
 *
 * LOW-SIGNAL (1 pt each) — common enough in casual text:
 *   - Unordered list items (- item or * item)
 *   - Bold (**text**)
 *   - Italic (*text* but not **)
 *   - Inline code (`text`)
 *   - Ordered list items (1. item)
 *   - Strikethrough (~~text~~)
 *
 * @param {string} plainText The plain text from clipboard
 * @returns {boolean} True if the text is likely markdown
 */
function pastedTextLooksLikeMarkdown(plainText) {
    if (!plainText || plainText.length < 4) { return false; }

    try {

        var markdownConfidenceScore = 0;

        ////////////////////////////////////////////////
        //  HIGH-SIGNAL PATTERNS (2 points each)
        ////////////////////////////////////////////////

        // ATX headings: ## or ### etc. with a space after hashes (not just a single #)
        // Using {2,6} so a single # (which could be a number sign) doesn't match
        if (/^#{2,6}\s+.+/m.test(plainText)) { markdownConfidenceScore += 2; }

        // Fenced code blocks: ``` or ~~~
        if (/^(`{3,}|~{3,})/m.test(plainText)) { markdownConfidenceScore += 2; }

        // Markdown links or images: [text](url) or ![alt](url)
        // Both are high-signal — no need to distinguish for scoring
        if (/!?\[.+?\]\(.+?\)/.test(plainText)) { markdownConfidenceScore += 2; }

        // Tables: lines with pipes like | col | col |
        if (/^\|?.+\|.+\|/m.test(plainText) && /^\|?[\s:]*[-]{3,}[\s:]*\|/m.test(plainText)) { markdownConfidenceScore += 2; }

        // Blockquotes: > at start of line
        if (/^>\s+.+/m.test(plainText)) { markdownConfidenceScore += 2; }

        // Task lists: - [ ] or - [x] or * [ ] or * [x]
        if (/^[\s]*[-*]\s\[(x|X|\s)?\]\s/m.test(plainText)) { markdownConfidenceScore += 2; }

        // Horizontal rules: --- or *** or ___ on their own line (3+ chars)
        if (/^\s*([-*_])\s*\1\s*\1[\s\1]*$/m.test(plainText)) { markdownConfidenceScore += 2; }


        ////////////////////////////////////////////////
        //  LOW-SIGNAL PATTERNS (1 point each)
        ////////////////////////////////////////////////

        // Unordered list items: - item or * item at line start
        if (/^[\s]*[-*+]\s+\S/m.test(plainText)) { markdownConfidenceScore += 1; }

        // Ordered list items: 1. item, 2. item, etc.
        if (/^[\s]*\d+\.\s+\S/m.test(plainText)) { markdownConfidenceScore += 1; }

        // Bold: **text**
        if (/\*\*[^*]+\*\*/.test(plainText)) { markdownConfidenceScore += 1; }

        // Italic: *text* (single asterisks, not double)
        if (/(?:^|[^*])\*[^*]+\*(?:[^*]|$)/.test(plainText)) { markdownConfidenceScore += 1; }

        // Inline code: `text` (single backticks, not triple)
        if (/(?:^|[^`])`[^`]+`(?:[^`]|$)/.test(plainText)) { markdownConfidenceScore += 1; }

        // Strikethrough: ~~text~~
        if (/~~[^~]+~~/.test(plainText)) { markdownConfidenceScore += 1; }


        return markdownConfidenceScore >= 3;

    } catch (e) {
        // If anything goes wrong with regex matching, fail silently.
        // Paste proceeds as normal plain text, no harm done.
        return false;
    }
}


/**
 * Converts a markdown string to sanitized HTML suitable for pasting
 * into the Quill editor. Uses showdown for md→HTML, then purifies
 * with DOMPurify and runs fortifyHTML for Cryptee table compat etc.
 *
 * @param {string} markdownText Raw markdown string
 * @returns {string} Purified HTML string
 */
function convertMarkdownToClipboardHTML(markdownText) {
    var clipboardMarkdownConverter = new showdown.Converter({
        excludeTrailingPunctuationFromURLs : true,
        ghCompatibleHeaderId : true,
        simplifiedAutoLink : true,
        simpleLineBreaks : true,
        strikethrough : true,
        tasklists : true,
        tables : true
    });

    var rawHTML = clipboardMarkdownConverter.makeHtml(markdownText);

    // Purify before DOM manipulation (same pattern as importers.js)
    var purifiedHTML = purifyHTML(rawHTML);

    // Convert HTML tables to Cryptee tables, fix img sources, etc.
    var crypteeHTML = fortifyHTML(purifiedHTML);

    // Second purification pass after DOM modifications
    var finalHTML = purifyHTML(crypteeHTML);

    return finalHTML;
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//
//  DOCUMENT-LEVEL PASTE HANDLER
//  Handles image pastes, and gates paste events
//  for inputs vs. the editor
//
////////////////////////////////////////////////
////////////////////////////////////////////////


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


////////////////////////////////////////////////
////////////////////////////////////////////////
//
//  CLIPBOARD TEXT CLEANUP
//  Strips unwanted formatting from pasted deltas
//
////////////////////////////////////////////////
////////////////////////////////////////////////


/**
 * Clones the current browser DOM selection as an HTML string.
 * Used during copy/cut to preserve rich formatting for paste
 * into other rich text targets (Google Docs, Word, etc).
 * 
 * Fixes: https://github.com/cryptee/web-client/issues/87
 * Root cause: https://github.com/slab/quill/issues/745
 * 
 * @returns {string} HTML string of the current selection
 */
function getSelectedHTML() {
    var selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) { return ''; }

    var range = selection.getRangeAt(0);
    var container = document.createElement('div');
    container.appendChild(range.cloneContents());
    return container.innerHTML;
}


/**
 * Removes unwanted style attributes (background, color, size, font)
 * from pasted content deltas so pastes look consistent with the doc.
 * @param {*} delta Quill delta from clipboard
 * @returns {*} delta Cleaned delta
 */
function cleanClipboardText(delta) {

    for (var i in delta.ops) {
        var op = delta.ops[i];
        if (op.attributes) {
            delete op.attributes.background;
            delete op.attributes.color;
            delete op.attributes.size;
            delete op.attributes.font;
        }
    }

    return delta;

}
