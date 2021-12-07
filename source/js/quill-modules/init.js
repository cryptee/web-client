////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 INITIALIZE QUILL EDITOR HERE.
////////////////////////////////////////////////
////////////////////////////////////////////////

var quill;
setSentryTag("quill-ver", Quill.version);

////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 HOTKEYS & SHORTCUTS
////////////////////////////////////////////////
////////////////////////////////////////////////

Quill.register('modules/markdownShortcuts', MarkdownShortcuts);

////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 FONTS AND TYPOGRAPHY
////////////////////////////////////////////////
////////////////////////////////////////////////

fontSizeStyle.whitelist = ['8px', '10px', '13px', '16px', '18px', '20px', '24px', '30px', '36px', '40px', '48px'];
Quill.register(fontSizeStyle, true);

Bold.tagName = 'b';
Quill.register(Bold, true);

Italic.tagName = 'i';
Quill.register(Italic, true);

// for splitting words use the "w" attribute
var WordAttribute = new Parchment.Attributor.Attribute('w', 'w', { scope: Parchment.Scope.INLINE });
Parchment.register(WordAttribute);
Quill.register(WordAttribute, true);


////////////////////////////////////////////////
////////////////////////////////////////////////
//	VENDOR SPECIFIC FIXES 
//  
//  uuggghhhhhhh
////////////////////////////////////////////////
////////////////////////////////////////////////

// https://github.com/cryptee/web-client/issues/48
function firefoxJustifiedTextFixHandler(range, context) {
    if (context.format.align === "justify" && context.prefix.length >= context.offset) {
        // this is the end of the paragraph / line, and user pressed space, quill will ignore this / delete this, so insert an extra space here. 
        // uuugghhh
        quill.insertText(range.index, ' ', 'user');
        return true;
    } else {
        return true;
    }
}

if (isFirefox) {
    // Yep. that's right. On firefox,  with justified text, at the end of the paragraph / line, spacebar doesn't work. 
    quillkeyboardbindings.justifiedTextSpacebarFixForFirefox = {
        key: ' ',
        handler: firefoxJustifiedTextFixHandler
    };
}


// https://github.com/cryptee/web-client/issues/129
function androidPredictiveKeyboardNewlineFix(delta, oldDelta, source) {
    if (!isAndroid) { return; }
    
    // if some text is selected, we replace the selected text with newline.
    // this doesn't cause a bug, so you can continue as expected. 
    var oldSelection = quill.getSelection();
    if (!oldSelection || isEmpty(oldSelection)) { return; }
    if (oldSelection.length > 0) { return; }

    if (!delta || isEmpty(delta)) { return; }
    if (!delta.ops) { return; }
    if (!delta.ops[1]) { return; }
    if (!delta.ops[1].insert) { return; }
    if (delta.ops[1].insert !== "\n") { return; }

    setTimeout(function () {
        var newSelection = quill.getSelection(); 

        // what happened is, we know we added a newline, but the selection index didn't change. 
        // so now we'll need to move the cursor, to make sure things continue to work without breaking.
        // fucking hell. 
        if (!newSelection || newSelection.index === oldSelection.index) {
            quill.setSelection(oldSelection.index + 1, 0);
        }
    }, 30);
}




var fonts = ['Arimo', 'Arial', 'Comic Sans MS', 'Courier', 'Georgia', 'Helvetica', 'Inter', 'Josefin Sans', 'Markazi', 'Palatino', 'Tahoma', 'Times New Roman', 'Verdana'];
var fontNames = [];
var fontStyles = "";
var fontOptions = "";

fonts.forEach(function(font) {
  var fontName = font.toLowerCase().replace(/\s/g, "-");
  var selected = "";
  if (fontName === "josefin-sans") { selected = "selected"; }

  fontNames.push(fontName);
  fontStyles += ".ql-snow .ql-picker.ql-font .ql-picker-label[data-value=" + fontName + "]::before, .ql-snow .ql-picker.ql-font .ql-picker-item[data-value=" + fontName + "]::before { content: '" + font + "'; font-family: '" + font + "', sans-serif; } .ql-font-" + fontName + "{ font-family: '" + font + "', sans-serif; }";
  fontOptions += `<option value="${fontName}" ${selected}>${font}</option>`;
});

var node = document.createElement('style');
node.innerHTML = fontStyles;
document.body.appendChild(node);
$(".ql-font").append(fontOptions);

// Add fonts to whitelist

Font.whitelist = fontNames;
Quill.register(Font, true);


////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 EMBED / INSERT / ATTACHMENT HANDLERS 
////////////////////////////////////////////////
////////////////////////////////////////////////


var quillhandlers = {
  'link': function(value) {
    showEmbed("link");
  },
  'formula': function(value) {
    showEmbed("formula");
  },
  'video': function(value) {
    showEmbed("video");
  }
};

////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 BASE CONFIG
////////////////////////////////////////////////
////////////////////////////////////////////////


var quillBaseConfig = {
    modules: {
        formula: true,
        syntax: true,
        magicUrl: {
            globalRegularExpression: MagicURLRegex,
            urlRegularExpression: MagicURLRegex
        },
        markdownShortcuts: {},
        keyboard: {
            bindings: quillkeyboardbindings
        },
        history: {
            delay: 1000,
            maxStack: 500,
            userOnly: false
        }
    }
};


////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 EDITOR TOOLBAR, THEME, LAYOUT & BOUNDS
////////////////////////////////////////////////
////////////////////////////////////////////////

quillIcons.align['']            = renderIcon("align-left");
quillIcons.align.center         = renderIcon("align-center");
quillIcons.align.right          = renderIcon("align-right");
quillIcons.align.justify        = renderIcon("align-justify");

quillIcons.background           = renderIcon("mark-pen-fill");
quillIcons.blockquote           = renderIcon("double-quotes-l");
quillIcons.bold                 = renderIcon("bold");
quillIcons.clean                = renderIcon("format-clear");
quillIcons.code                 = renderIcon("code");
quillIcons['code-block']        = renderIcon("code-box-line");
quillIcons.color                = renderIcon("font-color");
// quillIcons.direction['']        = renderIcon("text-direction-l");
// quillIcons.direction.rtl        = renderIcon("text-direction-r");

quillIcons.formula              = renderIcon("functions");

quillIcons.header['1']          = renderIcon("h-1");
quillIcons.header['2']          = renderIcon("h-2");
quillIcons.header['3']          = renderIcon("h-3");

quillIcons.italic               = renderIcon("italic");
quillIcons.image                = renderIcon("image-line");

quillIcons['line-height']       = renderIcon("line-height");
quillIcons.indent['+1']         = renderIcon("indent-increase");
quillIcons.indent['-1']         = renderIcon("indent-decrease");
quillIcons.link                 = renderIcon("link-m");

quillIcons.list.bullet          = renderIcon("list-unordered");
quillIcons.list.check           = renderIcon("list-check-2");
quillIcons.list.ordered         = renderIcon("list-ordered");
quillIcons.script.sub           = renderIcon("subscript");
quillIcons.script.super         = renderIcon("superscript");

quillIcons.strike               = renderIcon("strikethrough");
quillIcons.table                = renderIcon("iconName");
quillIcons.underline            = renderIcon("underline");
quillIcons.video                = renderIcon("video-line");

var toolbarOptions = { handlers: quillhandlers };

if (isMobile) {
    toolbarOptions.container = '#mobileToolbar';
    quillBaseConfig.theme    = 'bubble';
    quillBaseConfig.bounds   = "#editorWrapper";
    quillIcons['code-block'] = renderIcon("code-s-slash-fill");

    initMobileToolbar();
} else {
    toolbarOptions.container = '#desktopToolbar';
    quillBaseConfig.theme = 'snow';
    
    if (!isipados) {
        quillBaseConfig.modules.imageResize = {};
    }
}

quillBaseConfig.modules.toolbar = toolbarOptions;
quill = new Quill('#editorWrapper', quillBaseConfig);
setSentryTag("quill-config", quillBaseConfig.theme);




////////////////////////////////////////////////////////
////////////////////////////////////////////////////////
// 	 PASTE HANDLING & CLIPBOARD MATCHERS FOR CUSTOM TAGS
////////////////////////////////////////////////////////
////////////////////////////////////////////////////////
function noOpenDocumentPopup() {
    createPopup("To paste things into the document editor, first create or open a document.<br><br>if you'd like to upload files, you can either drag and drop them onto the file explorer on the left side of your screen, or you may press the upload button after you navigated into a folder", "info");
}


// ANY OTHER TAG MATCHER
quill.clipboard.addMatcher(Node.ELEMENT_NODE, (node, delta) => {
    if (isCursorInTable()) {
        return handleTablePaste(node, delta);
    } else {
        var updatedDelta = updateTablesInDelta(node, delta);
        return updatedDelta;
    }
});

// 
// TODO – v3.2 – KEEP TESTING AND ENABLE PASTING TABLES WHEN READY
// Pasting tables from the open web is a tough one, and there are still many issues with it.
// Keep testing, and once you're confident it works, enable it. 
// 
// i.e. a page that still fails : 
// https://en.wikipedia.org/wiki/Jelly_bean
// 
// Select the heading / left contents table & right image & infobox, but not history, and it somehow fails.
//
//

// quill.clipboard.addMatcher('table', (node, delta) => { 
//     var convertedPurifiedTablesDelta = convertHTMLToDeltas(node.outerHTML);
//     console.log(delta);
//     console.log(convertedPurifiedTablesDelta);
//     return convertedPurifiedTablesDelta;
// });


// CRYPTEETABLE ELEMENT MATCHERS
quill.clipboard.addMatcher('crypteetable', (node, delta) =>     {  return delta; });
quill.clipboard.addMatcher('crypteetabledata', (node, delta) => {  return delta; });
quill.clipboard.addMatcher('crypteetablecell', (node, delta) => {  return delta; });

// TAG & FILE ELEMENT MATCHERS
quill.clipboard.addMatcher('crypteetag', (node, delta) =>       {  return delta; });
quill.clipboard.addMatcher('crypteefile', (node, delta) =>      {  return delta; });
quill.clipboard.addMatcher('crypteefolder', (node, delta) =>    {  return delta; });
quill.clipboard.addMatcher('crypteepagebreak', (node, delta) => {  return delta; });

// REGULAR SPAN / DIV ELEMENT MATCHERS
quill.clipboard.addMatcher('span', (node, delta) =>             {  return delta; });
quill.clipboard.addMatcher('div', (node, delta) =>              {  return delta; });

// IMAGE ELEMENT PASTE MATCHER
quill.clipboard.addMatcher('img', (node, delta) =>              { return handleExternalImages(node, delta); });





  

////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 TAGS AUTOCOMPLETE / TRIBUTE
////////////////////////////////////////////////
////////////////////////////////////////////////

var tribute = new Tribute({
    values: function (tag, callback) {
        checkOrAddTag(tag, callback);
    },
    selectTemplate: function (item) {
        return '<crypteetag>' + item.original.tag.replace("+ ", "") + '</crypteetag>';
    },
    menuItemTemplate: function (item) {
        return '<i class="ri-price-tag-3-fill"></i>' + item.string;
    },
    trigger: '#',
    lookup: "tag",
    allowSpaces: false,
    selectClass: 'tribute-selection'
});

tribute.attach(document.getElementsByClassName('ql-editor'));

function checkOrAddTag(tag, callback) {
    var format = quill.getFormat();
    if (format['code-block'] || format.blockquote || format.bold || format.header === 1 || format.header === 2) {
        tribute.hideMenu();
        callback([]);
        tribute.hideMenu();
    } else {
        // IF YOU'D LIKE TO, SOME DAY YOU CAN POPULATE MORE TAGS / AUTOCOMPLETE ITEMS HERE BY ADDING THEM TO THIS ARRAY
        var tagsArray = [];
        tagsArray.push({ 'tag': tag });
        callback(tagsArray);
    }
}




////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 MOBILE TOOLBAR BUTTONS / CLICK LISTENERS
////////////////////////////////////////////////
////////////////////////////////////////////////

function initMobileToolbar() {
    
    // switch body state to bubble mode
    $("body").addClass("bubble");

    // table is already a custom button so it's already good to go
    $("#desktopToolbar > .ql-formats > .ql-image").hide();
    $("#desktopToolbar > .ql-formats > .ql-list[value='bullet']").hide();
    $("#desktopToolbar > .ql-formats > .ql-list[value='check']").hide();
    $("#desktopToolbar > .ql-formats > .ql-list[value='ordered']").hide();
    $("#desktopToolbar > .ql-formats > .cryptee-new-table").hide();
    $("#desktopToolbar > .ql-formats > .cryptee-attachfile").hide();

    // add undo button
    $("#mobileToolbar").append(`<button class="ql-undo" title="Undo">${renderIcon('arrow-go-back-fill')}</button>`);

    // add listeners for undo
    $(".ql-undo").on("click", function () {
        quill.history.undo();
        quill.root.blur();
    });

    // move document action buttons to left
    $("#documentActionButtons").insertAfter("#desktopToolbar > .ql-formats:last-child");

    $("#documentActionButtons").prepend(`<button id="mobileSliderCaret" alt="Open Sidebar" onclick="toggleSidebarMenu();"><i class="ri-side-bar-fill"></i></button>`);
}



/**
 * This calculates and shows/hides the on-keyboard mobile toolbar only in mobile (bubble theme) and shrinks/expands the editor so that it's not behind the keyboard
 */
function updateVisibleViewport(range) {
    // only for mobile. 
    if (!isMobile) { return; } 
    
    // on android we don't need visualviewport, keyboard triggers window resize events
    if (isios || isipados) { 
        
        // STEP 1 – Move the Toolbar on iOS    
        var viewport = window.visualViewport || { height : window.innerHeight };
        var keyboardHeight = 0 - (window.innerHeight - viewport.height) + 16; // intentionally adding +1rem to the bottom more to pad for the cubic bezier not matching the ios keyboard spring animation
    
        $(".ql-tooltip").attr("style", `transform: translateY(${keyboardHeight}px)`);
        $(".ql-tooltip")[0].scrollTo({ left: 0, behavior : "smooth" });

        // STEP 2 – Determine if keyboard is opening / closing, so you can crop the editor, and fire keyboard opened / closed events
        cropEditorAccordingtoVisibleViewport();
        
    }

    // STEP 3 – SCROLL THE EDITOR TO THE CURSOR (EVEN IF IT'S BEHIND THE TOOLBAR / KEYBOARD)
    // now let's make the editor scroll to the selection while typing / when tapped on, and make sure it's not behind the keyboard.

    // this is to prevent regular viewport scrolls from triggering auto-scroll.
    // since those scrolls don't send a range, auto-scroll starts fighting regular user scrolls = and goes to quill.range.index = 0 = top of the doc.
    if (!range || isEmpty(range)) { return; }
    autoScrollWhileTyping(range);
}

var keyboardVisibilityTimeout;
var editorCropTimeout;
function cropEditorAccordingtoVisibleViewport() {
    // this is timed out by 20ms, because reporting is inconsistent across browsers if you measure right away. But seems to be working if you measure in a few ms.
    // we'll try to keep this under 33ms (30fps for best visual performance / calculation tradeoff)
    // If you go above 33ms, it looks croppy / choppy.
    if (isPaperMode()) { return; }

    clearTimeout(keyboardVisibilityTimeout);
    clearTimeout(editorCropTimeout);
    keyboardVisibilityTimeout = setTimeout(function () {

        var viewport = window.visualViewport || { height : window.innerHeight };
        var keyboardHeight = 0 - (window.innerHeight - viewport.height) + 16; // intentionally adding +1rem to the bottom more to pad for the cubic bezier not matching the ios keyboard spring animation    

            if (keyboardHeight > 0) {
                // keyboard hidden, so resize editor right away to prevent a 200ms cropped jumpy look.   
                $(".ql-editor").attr("style", `height: calc(100% - 5rem + ${keyboardHeight}px )`);
            } else {
                // keyboard will be in correct position 200ms later, crop the editor afterwards to prevent a 299ms cropped jumpy look.
                editorCropTimeout = setTimeout(function () {
                    $(".ql-editor").attr("style", `height: calc(100% - 5rem + ${keyboardHeight}px )`);
                }, 200);
            }
    }, 20);
}

if (window.visualViewport) {
    window.visualViewport.addEventListener('scroll', function(){ updateVisibleViewport(); });
    window.visualViewport.addEventListener('resize', function(){ updateVisibleViewport(); });
}


/**
 * Soft keyboards don't send selection change while typing unless user moves the cursor. 
 * Meaning that we have to manually track the text-changes, look at the cursor position, and scroll editor accordingly
 * We can't just look at the selected paragraph, and see if it's offsetTop + height falls behind the keyboard :
 * Because user could be typing in the middle of the paragraph as well. So instead we need to get Quill cursor bounds and calculate a scroll based on that. 
 * @param {*} selectedNode 
 * @returns         
 */
function autoScrollWhileTyping(range) {

    // only for mobile (on desktops this breaks things like table insertions, copy paste, table new rows etc, and things start jumping around. on mobile due to screen size being small these are all better)
    if (!isMobile) { return; }

    // only for continuous mode
    if (isPaperMode()) { return; }

    setTimeout(function () {
        
        // first get quill's bounds
        range = range || getLastSelectionRange();
        if (!range || isEmpty(range)) { return; }
        
        // only while typing but not selecting text.
        // so if the range is > 0, stop.
        if (range.length > 0) { return; }

        var bounds; 
        try { bounds = quill.getBounds(range.index, range.length); } catch (e) {}
        bounds = bounds || { top : 0 };
        
        // now get keyboard toolbar's top offset
        var keyboardTopOffset = $("#mobileToolbar").offset().top;
        
        // now get editor's scrollTop offset
        var editorOffset = $(".ql-editor").scrollTop();

        // our cursor is at : editorOffset + bounds.top
        var cursorScrollOffset = editorOffset + bounds.top;

        // if we scroll the editor to cursorScrollOffset, 
        // selection / cursor will be at the very top of the screen.
        // and selection will be hidden behind the top toolbar. 
        // So we'll instead scroll to the (cursor - keyboard + 96), 
        // to keep the text 96px above the keyboard and scroll as the user types
        
        $('.ql-editor')[0].scrollTo({ top: cursorScrollOffset - keyboardTopOffset + 96, left: 0, behavior: 'smooth' });

    }, 300);

}




////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 QUILL FIXES / CHANGES / ENHANCEMENTS
////////////////////////////////////////////////
////////////////////////////////////////////////


$("#editorWrapper").on('touchstart', 'ul[data-checked="false"] > li, ul[data-checked="true"] > li', function (event) {
    event.stopPropagation();
    event.preventDefault();
});

$("#editorWrapper").on('touchstart', 'ul[data-checked="false"] > li, ul[data-checked="true"] > li', function (event) {
    event.stopPropagation();
    event.preventDefault();
});

////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 URL BOX / HYPERLINK BOX FOR MOBILE
////////////////////////////////////////////////
////////////////////////////////////////////////

function checkIfURLSelectedOnMobile() {
    if (!isMobile) { return; }

    try {
        var lastSelRange = getLastSelectionRange();
        var selectedFormat = quill.getFormat(lastSelRange);    
        if (selectedFormat.link) {
            showURLBox(selectedFormat.link);
        } else {
            hideURLBox();
        }
    } catch (e) {}

}

function showURLBox(href) {
    $("#urlbox").find("a").attr("href", href);
    $("#urlbox").find("a").text(href.replace("https://", ""));
    if (isMobile) { 
        $("#urlbox").addClass("show"); 
        if (href.startsWith("http://") || href.startsWith("ftp://")) {
            $("#urlbox").addClass("insecure"); 
        }
    }
}

function hideURLBox() {
    if (isMobile) { 
        $("#urlbox").removeClass("show"); 
        $("#urlbox").removeClass("insecure");
    }
    $("#urlbox").find("a").attr("href", "");
    $("#urlbox").find("a").empty();
}

function copyURLFromURLBoxToClipboard() {
    var url = $("#urlbox").find("a").attr("href");
    navigator.clipboard.writeText(url);

    $("#urlbox-copy-button").addClass("copied");
    setTimeout(function () {
        $("#urlbox-copy-button").removeClass("copied");
    }, 3000);

}

////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 QUILL INDEX / RANGE / NODE SELECTORS
////////////////////////////////////////////////
////////////////////////////////////////////////

function getSelectedNode() {
    var nativeRange = quill.selection.getNativeRange();
    
    if (!nativeRange || isEmpty(nativeRange)) { return null; }
    
    if (!nativeRange.native || isEmpty(nativeRange.native)) { return null; }

    return nativeRange.native.commonAncestorContainer;
}

function getQuillIndexOfDOMNode(domNode) {
    var node = Quill.find(domNode);
    var indexOfDOMNode = quill.getIndex(node);
    return indexOfDOMNode;
}

function getLastSelectionRange() {
    if (lastSelectionRange) {
        return lastSelectionRange;
    } else {
        return quill.getSelection(true);
    }
}

/**
 * Returns the quill-child of the given node, so you can easily calculate only what's after it
 * @param {*} node 
 */
 function findDOMNodesParentInQuill(node) {
    
    var parentOfNodeThatIsQuillsChild = node;
    
    // looks like if we select all with cmd + a / ctrl + a
    // sometimes quill can return the "ql-editor" element itself.
    // in these cases we want the first child, so we can iterate from 0

    if (node.classList) {
        if (node.classList.contains("ql-editor")) {
            return parentOfNodeThatIsQuillsChild.children[0];
        }
    }

    if (node.parentNode) {
        if (!node.parentNode.classList.contains("ql-editor")) {
            parentOfNodeThatIsQuillsChild = findDOMNodesParentInQuill(node.parentNode);
        }
    }

    return parentOfNodeThatIsQuillsChild;
}


/**
 * This cycles through the selected range's operations & formats, and gets a list of selected elements like tables, files etc
 * Tags are already selectable & editable, so you don't need this for tags
 * @param {*} range Quill range
 * @returns {Object} selectedElements An object of selected custom elements in range i.e. tables, files etc
 * @returns {Array} selectedElements.tables All selected tables' ids.
 * @returns {Array} selectedElements.files  All selected files' ids.
 */
function getSelectedCustomElementsInRange(range) {
    var selectedContents = quill.getContents(range.index, range.length);
    var selectedElements = {
        tables : [],
        files : [],
        folders : [],
        pagebreaks : [],
        // etc
    };
    
    var opsAtIndex = selectedContents.ops;
    opsAtIndex.forEach(function(op) {
        if (op.attributes) {

            // TABLES
            if (op.attributes.crypteetable) {
                selectedElements.tables.push(op.attributes.crypteetable);
            }
            
            if (op.attributes.crypteetabledata) {
                selectedElements.tables.push(op.attributes.crypteetabledata.tableid);
            }

            // crypteefiles
            if (op.attributes.file) {
                selectedElements.files.push(op.attributes.file.did);
            }

            // crypteefolders
            if (op.attributes.folder) {
                selectedElements.folders.push(op.attributes.folder.fid);
            }

            // crypteepagebreaks
            if (op.insert.pagebreak) {
                selectedElements.pagebreaks.push(op.attributes.pgno);
            }

        }
    });

    return selectedElements;
}


function checkIfQuillDeltaHasAttributeWithKey(delta, key) {
    var hasAttribute = false;
    delta = delta || { ops : [] };
    delta.ops.forEach(function(op) {
        if (hasAttribute) { return; }
        if (op.attributes) { if (key in op.attributes) { hasAttribute = true; } }
    });
    return hasAttribute;
}

function checkIfQuillDeltaHasAnAPINewlineInsert(delta, source) {
    var hasAnAPINewlineInsert = false;
    
    delta = delta || { ops : [] };
    source = source || "user";
    
    if (source !== "api") { return false; }

    delta.ops.forEach(function(op) {
        if (hasAnAPINewlineInsert) { return; }
        if (op.insert) { if (op.insert === "\n") { hasAnAPINewlineInsert = true; } }
    });

    return hasAnAPINewlineInsert;
}





















////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 QUILL CLICK LISTENER
////////////////////////////////////////////////
////////////////////////////////////////////////


$('.ql-editor').on('click', function (event) {

    // first item is a crypteefile or crypteefolder (attachment, won't receive focus. add another p before)
    if ($(".ql-editor p:last-child crypteefile").length === 1 || $(".ql-editor p:last-child crypteefolder").length === 1) {
        $(".ql-editor").append("<p></p>");
    }

    // show remote image warning
    if (event.target.getAttribute("src") === "//:0") {
        showModal("modal-remote-images");
    }


    //////////////////
    //
    // removing this seems to fix the image resize bug (https://github.com/cryptee/web-client/issues/23) 
    // where the image handles won't show up if the image is taller than the viewport height.
    //
    // I think this force focus was here to fix a bug where quill won't receive focus if it's empty, (height = 0) way back in the Docs V1 days.
    // It seems okay now with the V2 layout, but leaving this note here just in case. 

    // quill.focus();

    //////////////////

    activityHappened(); 

    hideRightClickDropdowns();
    hidePanels();
});

$('.ql-editor').on('click', 'crypteefile', function (event) {
    var theFile = $(this);
    
    if (theFile.hasClass("error")) {
        theFile.remove();
        return;
    }

    event.preventDefault();
    var did = theFile.attr("did");
    var filename = theFile.attr("filetitle");
    
    // blur editor to hide soft keyboards
    quill.blur();

    // start doc/file/attachment loading progress
    startDocOrFileProgress(did);

    getDocFromCatalog(did).then((doc) => {
        if (!doc || isEmpty(doc)) {
            // doc doesn't exist in catalog. chances are it was an attachment, and it's ghosted with a folder or deleted etc. remove it.   
            theFile.removeClass("loading").addClass("error");
            createPopup("looks like this attachment doesn't exist anymore. Chances are it was deleted or ghosted in a folder. since your documents are encrypted, cryptee is mathematically unable to automatically remove these attachment-links once the original linked file is gone.", "error");
            return;
        }
        
        if (!isOnline() && !doc.offline) {
            showDocNotAvailableOfflinePopup();
            stopDocOrFileProgress(did);
            return;  
        }

        prepareToLoadDoc(did,filename);
    }); 

});


$('.ql-editor').on('click', 'crypteefolder', function (event) {
    var theFolder = $(this);
    
    if (theFolder.hasClass("error")) {
        theFolder.remove();
        return;
    }

    event.preventDefault();
    var fid = theFolder.attr("fid");
    
    // blur editor to hide soft keyboards
    quill.blur();

    getFolderFromCatalog(fid).then((folder) => {
        if (!folder || isEmpty(folder)) {
            // folder doesn't exist in catalog. chances are it was an attachment, and it's ghosted or deleted etc. remove it.   
            theFolder.removeClass("loading").addClass("error");
            createPopup("looks like this folder doesn't exist anymore. Chances are it was deleted or ghosted. since your documents are encrypted, cryptee is mathematically unable to automatically remove these attachment-links once the original linked folder is gone.", "error");
            return;
        }
        
        clearSearchOnlyIfNecessary();
        loadFolder(fid);

        $("#leftListWrapper").attr("show", "folder");
        setTimeout(function () {
            openSidebarMenu();
            hideRightClickDropdowns();
            hidePanels();
        }, 10);
    }); 

});


////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 QUILL SCROLL LISTENER
////////////////////////////////////////////////
////////////////////////////////////////////////

$(".ql-editor").on('scroll', throttleScroll(function (event) {
    activityHappened();

    hideRightClickDropdowns();
    hidePanels();

    hideTableContextualButton();
    hideTableContextualDropdown();

    updateVisibleViewport();

    checkIfPageChanged();
}, 100));

// background-attachment:local is broken in Safari..... and apple hasn't fixed for 2+ years. 
// https://bugs.webkit.org/show_bug.cgi?id=219324 
// it seems like a hacky way to make it work is to disable/re-enable the background quickly
// and set it to a color super close to the original, forcing the engine to re-render the bg
// so that's what we do here. by triggering a fuck ton of scroll css update events. 
// fuck you apple for underfunding the safari team.

if (isSafari) {
    breadcrumb("[PAPER MODE] Using Safari Background Attachment Local Override");
    $(".ql-editor").addClass('safari');
    $(".ql-editor").on('scroll', function() {
        if (isPaperMode()) {
            $(".ql-editor").addClass("safari-bg-hack");
            // this should be good even for 120fps = <8.333ms/frame devices with promotion etc like ipad pros / iphone 13s etc 
            setTimeout(function () { $(".ql-editor").removeClass("safari-bg-hack"); }, 5);
        }    
    });
}

// in CSS multicol last page's contents are aligned flush to right, with no right-padding.
// on Chromium / WebKit etc, we solve this by adding margin-bottom to the last element,
// on Firefox, we need this hack to solve the same problem.

// thanks Violet for this hack 
// https://stackoverflow.com/questions/51344754/giving-right-padding-to-overflowing-css-multi-column-layouts 
if (isFirefox) {
    breadcrumb("[PAPER MODE] Using Firefox last-page override with pseudo-after element");
    $(".ql-editor").addClass('firefox');
}

////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 QUILL TEXT & SELECTION CHANGE LISTENERS
////////////////////////////////////////////////
////////////////////////////////////////////////



var lastSelectionRange = {index: 0, length : 0};
var zeroSelectionRange = {index: 0, length : 0};



quill.on('text-change', function (delta, oldDelta, source) {
    
    somethingChanged();
    
    lastSelectionRange = quill.getSelection() || zeroSelectionRange;
    
    preventTableFromBreaking(delta, oldDelta, source);
    checkIfTableHasFocus();
    checkIfDocumentHasRemoteImages();
    
    androidPredictiveKeyboardNewlineFix(delta, oldDelta, source);

    if (isMobile) { autoScrollWhileTyping(); }
    
    // Everything after this point is for paper mode
    if (!isPaperMode()) { return; }
    
    setTimeout(function () {
        var selectedNode = getSelectedNode();
        calculatePaperOverflow(selectedNode);
        setTimeout(function () { calculatePaperOverflow(selectedNode); }, 250);
    }, 250);

});






quill.on('selection-change', function (range, oldRange, source) {
    if (!range) {
        // CURSOR LEFT EDITOR
        hideTableContextualButton();
        hideTableContextualDropdown();
    } else {
        lastSelectionRange = range;

        checkIfTableHasFocus();
        checkIfURLSelectedOnMobile();
        
        selectPageBreaksIfAnyInRange(range, oldRange, source);
        selectFoldersIfAnyInRange(range, oldRange, source);
        selectTablesIfAnyInRange(range, oldRange, source);
        selectFilesIfAnyInRange(range, oldRange, source);
        
        if (range.length > 1) {
            selectionCounts();
        } else {
            updateCounts();
        }

        hidePanels("panel-docinfo");
        closeSidebarMenu();
    }

    updateVisibleViewport(range); // this will also call autoScrollWhileTyping
});




