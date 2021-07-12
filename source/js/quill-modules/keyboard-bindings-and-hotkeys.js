var quillkeyboardbindings = {
    enter: {
        key: Keyboard.keys.ENTER,
        shiftKey: null,
        altKey: null,
        metaKey: null,
        ctrlKey: null,
        handler: function (range, context) {
            if (tribute.isActive) {

                tribute.selectItemAtIndex(tribute.menuSelected);
                tribute.hideMenu();
                return false;

            } else {
                if (context.format.file) {

                    quill.insertText(range.index, '\n');

                } else if (context.format.tag) {

                    quill.insertText(range.index, '\n ');
                    quill.setSelection(range.index + 1, "silent");
                    quill.deleteText(range.index, 1);
                    quill.setSelection(range.index + 1, "silent");

                } else if (context.format.list) {

                    if (context.collapsed && context.empty && context.offset < 1) {
                        quill.format('list', false);
                    } else {
                        return true;
                    }

                } else if (context.format.blockquote) {

                    if (context.collapsed && context.empty && context.offset < 1) {
                        quill.format('blockquote', false);
                    } else {
                        return true;
                    }

                } else if (context.format.crypteetable || context.format.crypteetablecell || context.format.crypteetabledata) {
                    return handleTableEnter(range, context);
                } else {
                    return true;
                }
            }
        }
    },
    backspace: {
        key: Keyboard.keys.BACKSPACE,
        shiftKey: null,
        altKey: null,
        metaKey: null,
        ctrlKey: null,
        handler: function (range, context) {
            var selectedNode = getSelectedNode();
            
            // as stupid as this looks like, selected node could be nested ~7 - 8 elements deep. 
            // if something is:
            // 1) H1
            // 2) bold
            // 3) italic
            // 4) underline
            // 5) strikeout
            // 6) super/sub
            // 7) link (a)
            // you'd need at least 7 - 8 of these to make sure things are safe and still work, and tables won't break we have to do this stupidity.  
            var prevSibling = 
            selectedNode.previousSibling || 
            selectedNode.parentNode.previousSibling || 
            selectedNode.parentNode.parentNode.previousSibling || 
            selectedNode.parentNode.parentNode.parentNode.previousSibling || 
            selectedNode.parentNode.parentNode.parentNode.parentNode.previousSibling || 
            selectedNode.parentNode.parentNode.parentNode.parentNode.parentNode.previousSibling ||
            selectedNode.parentNode.parentNode.parentNode.parentNode.parentNode.parentNode.previousSibling ||
            selectedNode.parentNode.parentNode.parentNode.parentNode.parentNode.parentNode.parentNode.previousSibling;

            if (prevSibling) {
                if (!context.offset) {
                    if (prevSibling.tagName) {
                        if (prevSibling.tagName.toUpperCase() === "CRYPTEETABLE") {
                            return false;
                        }
                    }
                }
            }

            if (context.format.list) {
                if (context.collapsed && context.empty && !context.offset) {
                    quill.format('list', false);
                } else {
                    return true;
                }
            } else if (context.format.blockquote) {
                if (context.collapsed && context.empty && !context.offset) {
                    quill.format('blockquote', false);
                } else {
                    return true;
                }
            } else if (context.format['code-block']) {
                if (context.collapsed && context.empty && !context.offset) {
                    quill.format('code-block', false);
                } else {
                    return true;
                }
            } else if (doesSelectionHaveTables(range, context)) {
                return handleTableBackspace(range, context);
            } else {
                return true;
            }

        }
    },
    delete: {
        key: Keyboard.keys.DELETE,
        shiftKey: null,
        altKey: null,
        metaKey: null,
        ctrlKey: null,
        handler: function (range, context) {

            var selectedNode = getSelectedNode();
            
            // as stupid as this looks like, selected node could be nested ~7 - 8 elements deep. 
            // if something is:
            // 1) H1
            // 2) bold
            // 3) italic
            // 4) underline
            // 5) strikeout
            // 6) super/sub
            // 7) link (a)
            // you'd need at least 7 - 8 of these to make sure things are safe and still work, and tables won't break we have to do this stupidity.  

            var nextSibling = 
            selectedNode.nextSibling || 
            selectedNode.parentNode.nextSibling || 
            selectedNode.parentNode.parentNode.nextSibling || 
            selectedNode.parentNode.parentNode.parentNode.nextSibling || 
            selectedNode.parentNode.parentNode.parentNode.parentNode.nextSibling || 
            selectedNode.parentNode.parentNode.parentNode.parentNode.parentNode.nextSibling ||
            selectedNode.parentNode.parentNode.parentNode.parentNode.parentNode.parentNode.nextSibling ||
            selectedNode.parentNode.parentNode.parentNode.parentNode.parentNode.parentNode.parentNode.nextSibling;

            if (nextSibling) {
                if (!context.offset) {
                    if (nextSibling.tagName) {
                        if (nextSibling.tagName.toUpperCase() === "CRYPTEETABLE") {
                            return false;
                        }
                    }
                }
            }

            if (doesSelectionHaveTables(range, context)) {
                return handleTableDelete(range, context);
            } else {
                return true;
            }

        }
    },
    tab: {
        key: 9,
        shiftKey: null,
        altKey: null,
        metaKey: null,
        ctrlKey: null,
        handler: function (range, context) {
            if (isCursorInTable()) {
                return handleTableTab(range, context);
            } else {
                quill.insertText(range.index, '\t', 'user');
                quill.setSelection(range.index + 1);
            }
        }
    },
    up: {
        key: Keyboard.keys.UP,
        shiftKey: null,
        altKey: null,
        metaKey: null,
        ctrlKey: null,
        handler: function (range, context) {
            if (isCursorInTable()) {
                return handleTableUP(range, context);
            } else {
                if (doesSelectionHaveTables({index : range.index - 1, length : 1})) {
                    // there is a table before the current index, so enter table from correct position
                    handleUpIntoTheTable(range, context);
                } else {
                    return true;
                }
            }
        }
    },
    down: {
        key: Keyboard.keys.DOWN,
        shiftKey: null,
        altKey: null,
        metaKey: null,
        ctrlKey: null,
        handler: function (range, context) {
            if (isCursorInTable()) {
                return handleTableDOWN(range, context);
            } else {
                if (doesSelectionHaveTables({index : range.index + 1, length : 1})) {
                    // there is a table after the current index, so enter table from correct position
                    return handleDownIntoTheTable(range, context);
                } else {
                    return true;
                }
            }
        }
    },
    'list autofill': {
        key: ' ',
        collapsed: true,
        format: {
            list: false,
            crypteetable : false,
            crypteetablecell : false
        },
        prefix: /^\s*?(\d+\.|-|\*|\[ ?\]|\[x\])$/,
        handler: function (range, context) {
            var length = context.prefix.length;
            var line = quill.getLine(range.index)[0];
            var offset = quill.getLine(range.index)[1];
            if (line == undefined || line == null) { return true; }
            if (length == undefined || length == null) { return true; }
            if (offset > length) { return true; }
            var value;
            switch (context.prefix.trim()) {
                case '[]':
                case '[ ]':
                    value = 'unchecked';
                    break;
                case '[x]':
                    value = 'checked';
                    break;
                case '-':
                case '*':
                    value = 'bullet';
                    break;
                default:
                    value = 'ordered';
            }
            quill.insertText(range.index, ' ', Quill.sources.USER);
            quill.history.cutoff();
            var delta = new Delta().retain(range.index - offset)
                .delete(length + 1)
                .retain(line.length() - 2 - offset)
                .retain(1, { list: value });
            quill.updateContents(delta, Quill.sources.USER);
            quill.history.cutoff();
            quill.setSelection(range.index - length, Quill.sources.SILENT);
        }
    },
    'indent code-block': null,
    'outdent code-block': null
};

//////// HOTKEYS //////////

// OPEN RECENTS
key('alt+shift+r', function () {
    quill.blur();
    openSidebarMenu();
    hideRightClickDropdowns();
    hidePanels();
    $("#recentsButton").trigger("click");
    return false;
});

// OPEN FOLDERS
key('alt+shift+f', function () {
    quill.blur();
    openSidebarMenu();
    hideRightClickDropdowns();
    hidePanels();
    $("#foldersButton").trigger("click");
    return false;
});


// MINIMIZE / MAXIMIZE PREVIEW
key('alt+shift+m', function () {
    minimizeFileViewer();
    return false;
});

key('command+shift+o, ctrl+shift+o', function () {
    quill.blur();
    openSidebarMenu();
    hideRightClickDropdowns();
    hidePanels();
    $("#searchInput").trigger("focus");
    return false;
});

key('command+], ctrl+]', function () {
    quill.format('indent', '+1');
    return false;
});

key('command+[, ctrl+[', function () {
    quill.format('indent', '-1');
    return false;
});

key('command+s, ctrl+s', function () {
    saveDoc();
    return false;
});

key('command+shift+k, ctrl+shift+k', function () {
    showEmbed("formula");
    return false;
});

key('command+shift+6, ctrl+shift+6', function () {

    var curFormat = quill.getFormat();

    if (curFormat.list === "unchecked" || curFormat.list === "checked") {
        quill.removeFormat(getLastSelectionRange().index);
    } else {
        if (isMobile) {
            $("#checkbox-button").trigger("click");
        } else {
            $(".ql-list[value='check']").trigger("click");
        }
    }

    return false;
});

key('command+shift+7, ctrl+shift+7', function () {
    var curFormat = quill.getFormat();
    if (curFormat.list === "ordered") {
        quill.removeFormat(getLastSelectionRange().index);
    } else {
        quill.format('list', 'ordered');
    }
    return false;
});

key('command+shift+8, ctrl+shift+8', function () {
    var curFormat = quill.getFormat();
    if (curFormat.list === "bullet") {
        quill.removeFormat(getLastSelectionRange().index);
    } else {
        quill.format('list', 'bullet');
    }
    return false;
});

key('command+shift+s, ctrl+shift+s', function () {
    $(".ql-strike").trigger("click");
    return false;
});

key('command+/, ctrl+/', function () {
    showModal('modal-hotkeys');
    return false;
});

key('command+., ctrl+.', function () {
    openSidebarMenu();
    return false;
});

key('command+\\, ctrl+\\', function () {
    if (!isCursorInTable()) {
        $(".ql-clean").trigger("click");
    }
    return false;
});

key('command+a, ctrl+a', function () {
    var toReturnOrNotTo = true;
    
    // if a selection exists, left panel is visible and editor doesn't have focus, 
    // and it's files in a folder (not recent since it would be selecting all docs) then select all visible files
    
    if (selections.length > 0 && !quill.hasFocus()) {
        $("#activeFolder").children(".doc").each(function (i, sel) {
            if (!$(sel).hasClass("selected")) {
                var seldid = $(sel).attr("did");
                toggleDocSelection(seldid);
            }
        });

        $("#results").children(".doc").each(function (i, sel) {
            if (!$(sel).hasClass("selected")) {
                var seldid = $(sel).attr("did");
                toggleDocSelection(seldid);
            }
        });
        toReturnOrNotTo = false;
    }

    return toReturnOrNotTo;
});


var quoteToggle = false;
key('command+shift+9, ctrl+shift+9', function () {
    if (quoteToggle) {
        quill.format('blockquote', false);
        quoteToggle = false;
    } else {
        quill.format('blockquote', true);
        quoteToggle = true;
    }
    return false;
});

var codeToggle = false;
key('command+shift+0, ctrl+shift+0', function () {
    if (codeToggle) {
        quill.format('code-block', false);
        codeToggle = false;
    } else {
        quill.format('code-block', true);
        codeToggle = true;
    }
    return false;
});

key('command+enter, ctrl+enter', function () {
    if (!isCursorInTable() && isPaperMode()) {
        $(".ql-pagebreak").trigger("click");
    }
    return false;
});

key('esc', function () {
    hidePanels();
    hideFloaters();
    clearSelections();
    hideRightClickDropdowns();
});

key('pageup', function(){
    if (isPaperMode()) {
        goToPrevPage();
    } else {
        var currentEditorScrollPos = $(".ql-editor").scrollTop();
        var scrollToPosition = currentEditorScrollPos - 128;
        if (scrollToPosition <= 0) { scrollToPosition = 0; }
        $(".ql-editor")[0].scrollTo({ top: scrollToPosition, left: 0, behavior: 'smooth' });
    }

    return false;
});

key('pagedown', function(){
    if (isPaperMode()) {
        goToNextPage();
    } else {
        var currentEditorScrollPos = $(".ql-editor").scrollTop();
        var scrollToPosition = currentEditorScrollPos + 128;
        $(".ql-editor")[0].scrollTo({ top: scrollToPosition, left: 0, behavior: 'smooth' });
    }
    
    return false;
});

/**
 * This function checks and determines whether if the user can quick load documents using the 123 hotkeys on the keyboard. i.e. if a doc is open, or if another input is in focus, it returns false.
 * @returns 
 */
function canQuickLoadWithHotkey() {
    if ( $('input:focus').length > 0 ) { return false; }
    if ( $('textarea:focus').length > 0 ) { return false; }
    if (!$("body").hasClass("no-doc")) { return false; }
    if (loadingDoc) { return false; }
    return true;
}

key('1', function () {
    if (!canQuickLoadWithHotkey()) { return; }
    $("#blank-editor-recents").children().eq(0).find(".name").trigger("click");
});

key('2', function () {
    if (!canQuickLoadWithHotkey()) { return; }
    $("#blank-editor-recents").children().eq(1).find(".name").trigger("click");
});

key('3', function () {
    if (!canQuickLoadWithHotkey()) { return; }
    $("#blank-editor-recents").children().eq(2).find(".name").trigger("click");
});