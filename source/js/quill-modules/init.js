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

var fonts = ['Alef', 'Arial', 'Comic Sans MS', 'Courier', 'Georgia', 'Helvetica', 'Josefin Sans', 'Markazi', 'Montserrat', 'Palatino', 'Tahoma', 'Times New Roman', 'Verdana'];
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

    initMobileTopToolbar();
} else {
    toolbarOptions.container = '#desktopToolbar';
    quillBaseConfig.theme = 'snow';
    
    if (!isipados) {
        quillBaseConfig.modules.imageResize = {};
    }
}

quillBaseConfig.modules.toolbar = toolbarOptions;
quill = new Quill('#editorWrapper', quillBaseConfig);





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

function initMobileTopToolbar() {
    
    // switch body state to bubble mode
    $("body").addClass("bubble");

    // table is already a custom button so it's already good to go
    $("#desktopToolbar > .ql-formats > .ql-image").append(quillIcons.image);
    $("#desktopToolbar > .ql-formats > .ql-list[value='bullet']").append(quillIcons.list.bullet);
    $("#desktopToolbar > .ql-formats > .ql-list[value='check']").append(quillIcons.list.check);
    $("#desktopToolbar > .ql-formats > .ql-list[value='ordered']").hide();

    // add undo button
    $("#desktopToolbar > .ql-formats:last-child").append(`<button class="ql-undo" title="Undo">${renderIcon('arrow-go-back-fill')}</button>`);

    // add listeners for bullet
    $(".ql-list[value='bullet']").on("click", function () {
        var format = quill.getFormat();
        if (format.list === "bullet") {
            quill.removeFormat(getLastSelectionRange().index);
        } else {
            quill.format('list', 'bullet');
        }
    });

    // add listeners for mobile checkbox
    $(".ql-list[value='check']").on("click", function () {
        var format = quill.getFormat();
        if (format.list === "checked") {
            quill.removeFormat(getLastSelectionRange().index);
        } else {
            quill.format('list', 'checked');
        }
    });

    // add listeners for undo
    $(".ql-undo").on("click", function () {
        quill.history.undo();
        quill.root.blur();
    });

    // add listeners for ql-image
    $("#desktopToolbar").on("click", '.ql-image', function () {
        $("#mobileToolbar > .ql-image").trigger("click");
    });

    // move document action buttons to left
    $("#documentActionButtons").insertAfter("#explorerButtons");
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
    $("#urlbox").find("a").html(href.replace("https://", ""));
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


////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 QUILL INDEX / RANGE / NODE SELECTORS
////////////////////////////////////////////////
////////////////////////////////////////////////

function getSelectedNode() {
    var nativeRange = quill.selection.getNativeRange();
    if (nativeRange) {
        return nativeRange.native.commonAncestorContainer;
    } else {
        return null;
    }
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

            // files
            if (op.attributes.file) {
                selectedElements.files.push(op.attributes.file.did);
            }

        }
    });

    return selectedElements;
}

























////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 QUILL CLICK LISTENER
////////////////////////////////////////////////
////////////////////////////////////////////////


$('.ql-editor').on('click', function (event) {

    // first item is a crypteefile (attachment, won't receive focus. add another p before)
    if ($(".ql-editor p:last-child crypteefile").length === 1) {
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
}, 100));



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
        selectTablesIfAnyInRange(range, oldRange, source);
        selectFilesIfAnyInRange(range, oldRange,source);
        
        if (range.length > 1) {
            selectionCounts();
        } else {
            updateCounts();
        }

        hidePanels("panel-docinfo");
        closeSidebarMenu();
    }
});




