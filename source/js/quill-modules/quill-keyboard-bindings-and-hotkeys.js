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
                        this.quill.format('list', false);
                    } else {
                        return true;
                    }

                } else if (context.format.blockquote) {

                    if (context.collapsed && context.empty && context.offset < 1) {
                        this.quill.format('blockquote', false);
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
            var prevSibling = getSelectedNode().previousSibling;
            if (prevSibling) {
                if (!context.offset && prevSibling.tagName.toUpperCase() === "CRYPTEETABLE") {
                    return false;
                }
            }

            if (context.format.list) {
                if (context.collapsed && context.empty && !context.offset) {
                    this.quill.format('list', false);
                } else {
                    return true;
                }
            } else if (context.format.blockquote) {
                if (context.collapsed && context.empty && !context.offset) {
                    this.quill.format('blockquote', false);
                } else {
                    return true;
                }
            } else if (context.format['code-block']) {
                if (context.collapsed && context.empty && !context.offset) {
                    this.quill.format('code-block', false);
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

            var nextSibling = getSelectedNode().nextSibling;
            if (nextSibling) {
                if (!context.offset && nextSibling.tagName.toUpperCase() === "CRYPTEETABLE") {
                    return false;
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
    }
};

//////// HOTKEYS //////////

// OPEN RECENTS
key('alt+shift+r', function () {
    if (connectivityMode) {
        quill.blur();
        showMenu();
        $("#recents-button").click();
        checkAndSaveDocIfNecessary();
    }
    return false;
});

// OPEN FOLDERS
key('alt+shift+f', function () {
    if (connectivityMode) {
        quill.blur();
        showMenu();
        $("#folders-button").click();
        checkAndSaveDocIfNecessary();
    }
    return false;
});

// MINIMIZE / MAXIMIZE PREVIEW
key('alt+shift+m', function () {
    if (connectivityMode) {
        if ($("#file-viewer").hasClass("minimized")) {
            maximizeFileViewer();
        } else {
            minimizeFileViewer();
        }

        checkAndSaveDocIfNecessary();
    }
    return false;
});

key('command+shift+o, ctrl+shift+o', function () {
    if (connectivityMode) {
        quill.blur();
        showMenu();
        $("#search-input").focus();
        checkAndSaveDocIfNecessary();
    }
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
    if (connectivityMode) {
        if (!saveUploads[activeDocID]) {
            saveDoc(activeDocID);
        }
    } else {
        saveOfflineDoc();
    }
    return false;
});

key('command+shift+alt+s, ctrl+shift+alt+s', function () {
    exportAsHTML(null, true);
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
            $("#checkbox-button").click();
        } else {
            $(".ql-list[value='check']").click();
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
    $(".ql-strike").click();
    return false;
});

key('command+/, ctrl+/', function () {
    toggleHotkeys();
    return false;
});

key('command+., ctrl+.', function () {
    $("#hamburger").click();
    return false;
});

key('command+\\, ctrl+\\', function () {
    if (!isCursorInTable()) {
        $(".ql-clean").click();
    }
    return false;
});

key('command+a, ctrl+a', function () {
    var toReturnOrNotTo = true;
    // if a selection exists, left panel is visible and editor doesn't have focus, 
    // and it's files in a folder (not recent since it would be selecting all docs) then select all visible files
    if (selectionArray.length > 0 && $(".showLeft").length > 1 && !quill.hasFocus() && activeFolderID !== "root") {
        $("#all-active-folder-contents").children().each(function (i, sel) {
            if (!$(sel).hasClass("selected")) {
                var seldid = $(sel).attr("did");
                selectDoc(seldid);
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

key('esc', function () {
    if ($(".modal.is-active:not(#key-modal)")) {
        $(".modal.is-active:not(#key-modal)").removeClass('is-active');
        $(".modal.is-active").find("input").val("");
        $(".modal.is-active").find("input").blur();
    }
    checkAndSaveDocIfNecessary();
    clearSelections();
    hideRightClickMenu();
});