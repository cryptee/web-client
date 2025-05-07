////////////////////////////////////////////////
////////////////////////////////////////////////
//
//  CODE BLOCK FEATURES
//  floating copy + fold buttons for pre.ql-syntax
//  uses a single reusable floater, positioned via getBoundingClientRect
//
////////////////////////////////////////////////
////////////////////////////////////////////////

var codeBlockFloater = $('#code-block-floater');
var codeBlockFloaterCopyBtn = $('#code-block-floater-copy-btn');
var codeBlockFloaterFoldBtn = $('#code-block-floater-fold-btn');
var codeBlockFloaterActiveElement = null;
var codeBlockFloaterVisible = false;

// tracks which code blocks are currently folded
var foldedCodeBlocks = new WeakSet();


////////////////////////////////////////////////
////////////////////////////////////////////////
//
//  COPY
//
////////////////////////////////////////////////
////////////////////////////////////////////////

function handleCodeBlockCopy(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!codeBlockFloaterActiveElement) { return; }

    var text = codeBlockFloaterActiveElement.textContent || '';
    navigator.clipboard.writeText(text);
    codeBlockFloaterCopyBtn.addClass('copied');
    setTimeout(function () {
        codeBlockFloaterCopyBtn.removeClass('copied');
    }, 1500);
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//
//  FOLD / UNFOLD
//
////////////////////////////////////////////////
////////////////////////////////////////////////

function handleCodeBlockFold(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!codeBlockFloaterActiveElement) { return; }

    if (foldedCodeBlocks.has(codeBlockFloaterActiveElement)) {
        unfoldCodeBlock(codeBlockFloaterActiveElement);
    } else {
        foldCodeBlock(codeBlockFloaterActiveElement);
    }

    updateCodeBlockFloaterFoldIcon();
}

function foldCodeBlock(pre) {
    if (!pre) { return; }
    pre.scrollTop = 0;
    $(pre).addClass('folded');
    foldedCodeBlocks.add(pre);
}

function unfoldCodeBlock(pre) {
    if (!pre) { return; }
    $(pre).removeClass('folded');
    foldedCodeBlocks.delete(pre);
}

function updateCodeBlockFloaterFoldIcon() {
    if (!codeBlockFloaterActiveElement) { return; }

    if (foldedCodeBlocks.has(codeBlockFloaterActiveElement)) {
        codeBlockFloaterFoldBtn.addClass('folded');
        codeBlockFloaterFoldBtn.attr('title', 'Unfold code');
    } else {
        codeBlockFloaterFoldBtn.removeClass('folded');
        codeBlockFloaterFoldBtn.attr('title', 'Fold code');
    }
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//
//  SHOW / HIDE / POSITION FLOATER
//
////////////////////////////////////////////////
////////////////////////////////////////////////

function showCodeBlockFloater(pre) {
    if (!pre) { return; }

    codeBlockFloaterActiveElement = pre;
    positionCodeBlockFloater();
    updateCodeBlockFloaterFoldIcon();
    codeBlockFloater.addClass('shown');
    codeBlockFloaterVisible = true;
}

function hideCodeBlockFloater() {
    codeBlockFloater.removeClass('shown');
    codeBlockFloaterVisible = false;
    codeBlockFloaterActiveElement = null;
}

function positionCodeBlockFloater() {
    if (!codeBlockFloaterActiveElement) { return; }

    var rect = codeBlockFloaterActiveElement.getBoundingClientRect();
    var scrollY = window.scrollY || window.pageYOffset;
    var scrollX = window.scrollX || window.pageXOffset;

    // flush to top-right corner of the code block. inset is handled in CSS.
    var x = rect.right + scrollX;
    var y = rect.top + scrollY;

    codeBlockFloater.css({
        "--x": x + "px",
        "--y": y + "px"
    });
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//
//  DETECT CODE BLOCKS (DESKTOP – MOUSE)
//
////////////////////////////////////////////////
////////////////////////////////////////////////

function codeBlockMouseOverHandler(e) {
    var pre = $(e.target).closest('pre.ql-syntax');
    if (pre.length) {
        showCodeBlockFloater(pre[0]);
    }
}

function codeBlockMouseOutHandler(e) {
    var pre = $(e.target).closest('pre.ql-syntax');
    if (!pre.length) { return; }

    var related = e.relatedTarget;

    // don't hide if moving to the floater itself
    if (related && (related === codeBlockFloater[0] || codeBlockFloater[0].contains(related))) {
        return;
    }

    // don't hide if moving to another element inside the same pre
    if (related && pre[0].contains(related)) {
        return;
    }

    hideCodeBlockFloater();
}

function codeBlockFloaterMouseLeaveHandler(e) {
    var related = e.relatedTarget;

    // don't hide if moving back into the active code block
    if (related && codeBlockFloaterActiveElement && codeBlockFloaterActiveElement.contains(related)) {
        return;
    }

    hideCodeBlockFloater();
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//
//  DETECT CODE BLOCKS (MOBILE – SELECTION)
//
////////////////////////////////////////////////
////////////////////////////////////////////////

function checkIfCodeBlockHasFocus() {
    // called from selection-change handler in init.js
    try {
        var format = quillSafelyGetFormat();
        if (format && format['code-block']) {
            var node = getSelectedNode();
            if (!node) { return; }

            // walk up to find the pre.ql-syntax
            var pre = $(node).closest('pre.ql-syntax');
            if (!pre.length && node.parentNode) {
                pre = $(node.parentNode).closest('pre.ql-syntax');
            }

            if (pre.length) {
                showCodeBlockFloater(pre[0]);
                return;
            }
        }

        // cursor isn't in a code block
        if (codeBlockFloaterVisible) {
            hideCodeBlockFloater();
        }
    } catch (e) {}
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//
//  REPOSITION ON SCROLL / RESIZE
//
////////////////////////////////////////////////
////////////////////////////////////////////////

function repositionCodeBlockFloaterIfNeeded() {
    if (!codeBlockFloaterVisible || !codeBlockFloaterActiveElement) { return; }

    // check if the active code block is still in the DOM
    if (!document.body.contains(codeBlockFloaterActiveElement)) {
        hideCodeBlockFloater();
        return;
    }

    positionCodeBlockFloater();
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//
//  INIT
//
////////////////////////////////////////////////
////////////////////////////////////////////////


////////////////////////////////////////////////
////////////////////////////////////////////////
//
//  ORPHANED SYNTAX HIGHLIGHT CLEANUP
//  when code-block is toggled off, hljs spans survive inside <p> tags.
//  this strips them so colors don't "infect" normal text.
//  called from the text-change listener in init.js
//
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Checks if a Quill delta indicates code-block formatting was removed,
 * and if so, strips any orphaned hljs/syntax spans that ended up inside
 * regular paragraph tags instead of pre.ql-syntax.
 * @param {Object} delta - the Quill delta from a text-change event
 */
function cleanupOrphanedSyntaxHighlightingIfNecessary(delta) {
    try {
        if (!delta || !delta.ops) { return; }

        var codeBlockWasRemoved = false;

        for (var i = 0; i < delta.ops.length; i++) {
            var op = delta.ops[i];
            if (op.attributes && op.attributes['code-block'] === null) {
                codeBlockWasRemoved = true;
                break;
            }
        }

        if (!codeBlockWasRemoved) { return; }

        breadcrumb('[CODE BLOCK] code-block removed, checking for orphaned syntax spans');

        // any hljs/token span inside a <p> is orphaned - unwrap it
        var orphanedSpans = document.querySelectorAll('.ql-editor p [class*="hljs"], .ql-editor p .ql-token');
        if (!orphanedSpans.length) { return; }

        breadcrumb('[CODE BLOCK] stripping ' + orphanedSpans.length + ' orphaned hljs spans');

        for (var s = 0; s < orphanedSpans.length; s++) {
            var span = orphanedSpans[s];
            var parent = span.parentNode;
            while (span.firstChild) { parent.insertBefore(span.firstChild, span); }
            parent.removeChild(span);
        }

        quill.update('silent');
    } catch (e) {}
}


function initCodeBlockFeatures() {

    // button click handlers
    codeBlockFloaterCopyBtn.on('click touchend', handleCodeBlockCopy);
    codeBlockFloaterFoldBtn.on('click touchend', handleCodeBlockFold);

    // desktop: mouse-based detection via event delegation on the editor
    $('.ql-editor').on('mouseover', codeBlockMouseOverHandler);
    $('.ql-editor').on('mouseout', codeBlockMouseOutHandler);

    // floater itself needs mouseleave handling
    codeBlockFloater.on('mouseleave', codeBlockFloaterMouseLeaveHandler);

    // reposition on scroll / resize
    $('#editorWrapper').on('scroll', repositionCodeBlockFloaterIfNeeded);
    $(window).on('scroll', repositionCodeBlockFloaterIfNeeded);
    $(window).on('resize', repositionCodeBlockFloaterIfNeeded);
}
