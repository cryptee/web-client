var theKey, encryptedStrongKey;
var encryptedKeycheck; // a timestamp encrypted with hashedKey to verify the hashedKey in offline mode.

var keyToRemember = JSON.parse(sessionStorage.getItem('key')); // hashedkey

if (localStorage.getItem('memorizedKey')) {
  keyToRemember = JSON.parse(localStorage.getItem('memorizedKey')); // hashedKey
}

if (localStorage.getItem('emojiCryptedKey')) {
  if (JSON.parse(localStorage.getItem('emojiCryptedKey')) && !keyToRemember) {
    showEmojilock();
  }
}

var gotKey = false; // this prevents an early offline mode call from being made before key is typed.

if (localStorage.getItem("encryptedKeycheck")) {
  encryptedKeycheck = JSON.parse(localStorage.getItem("encryptedKeycheck")).data;
}
sessionStorage.removeItem('key');

var theUser;
var theUserID;
var theUsername;
var theEmail;
var theToken;
var dataRef;
var metaRef;
var rootRef;
var foldersRef;
var minuteTimer;
var idleTime = 0;
var lastActivityTime = (new Date()).getTime();
var userPlan;
var newAccount = false;

var lastSaved = (new Date()).getTime();
var lastScrollTop = 0;
var docChanged;
var currentGeneration;
var toolbarOptions = ['bold', 'italic', 'underline', 'strike'];
var saveUpload;

var idleInterval = setInterval(idleTimer, 1000);
var inactivityInterval = setInterval(inactiveTimer, 1000);
var everyFifteenSecondsInterval = setInterval(quarterMinutelyTimer, 15000);

var connected = true;
var startedOffline = false;
var connectivityMode = true; // true = online // false = offline

var offlineStorage = localforage.createInstance({ name: "offlineStorage" });
var offlineErrorStorage = localforage.createInstance({ name: "offlineErrorStorage" });
var storageDriver = localforage.driver();
setSentryTag("offline-driver", storageDriver);

var checkConnectionTimeout;
var connectedRef = db.ref(".info/connected");
connectedRef.on("value", function(snap) {
  // this limits these triggers to only happen after the key is entered 
  // to make sure we won't switch to online mode before they key screen. 
  // Sometimes this gets a false negative.
  if (theKey) {
    if (snap.val()) {
      breadcrumb("Sockets Got Connection.");
    } else {
      breadcrumb("Sockets Lost Connection.");
    }

    clearTimeout(checkConnectionTimeout);
    checkConnectionTimeout = setTimeout(function() {
      if (snap.val()) { 
        breadcrumb("Sockets Got Connection within/after 3 seconds. Will check server connection to confirm.");
      } else {
        breadcrumb("Sockets Lost Connection for 3 seconds. Will check server connection to decide.");
      }
      forceCheckConnection();
    }, 3000);
  }
});

var allowedStorage, usedStorage;
var decryptingFoldersTimeout;
var activeDocTitle;
var activeDocID;
var activeDocAttachments = [];

var activeFolderID;


var catalog = {"docs" : {}, "folders" : {}};
// catalog.docs , catalog.folders etc. this will carry ids, titles etc. former titles Obj and docs Array but better.

var encryptedCatalog = {"docs" : {}, "folders" : {}};
// this is what's loaded before the key's entered.
// it's basically an encrypted titles and tags object.
// these will be added the catalog once titles and tags in this are decrypted.

var catalogReadyForDecryption = false;
var bootCatalogDecrypted = false;
var titlesIndividuallyEncrypted = false; // "tie" = false/true in database
var lastOpenDocID;
var lastOpenDocPreloadedDelta = null;

var foldersOrderObject = {};
var activeFileContents;
var activeFileTitle;
var activeFileID;

var isSaving = false;
var settingsOpen = false;
var reauthenticated = false;
var retokening = false;
var initialLoadComplete = false;
var initialSyncComplete = false;
var docIsBeingSorted = false;
var numFilesLeftToBeUploaded = 0;
var fileUploadError = false;
var menuBeforeDrag;
var somethingDropped = false;

var isDocOutdated = false;
var menuClosedDueToOffline = false;
var desktopCutOffWidthPixel = 1065;

loadUserDetailsFromLS();
checkLatestVersion();

var sortableFoldersDesktopPreferences = {
  animation: 300,
  delay: 0,
  handle: ".afolder",
  chosenClass: "draggingFolder",
  scroll: $("#all-folders")[0],
  filter: ".archived",
  onStart: function(evt) {
    $(".afolder").addClass("folderDraggingActive");
  },
  onEnd: function(evt) {
    $(".folderDraggingActive").removeClass("folderDraggingActive");
    updateFolderIndexes();
  }
};

// var sortableFoldersMobilePreferences = {
//   animation: 300, 
//   delay:0,
//   handle: ".foldertab",
//   chosenClass: "draggingFolder",
//   scroll : $("#all-folders")[0],
//   filter : ".archived",
//   onStart: function (evt) {
//     $('.afolder').addClass("folderDraggingActive");
// 	},
//   onEnd: function (evt) {
//     $('.folderDraggingActive').removeClass("folderDraggingActive");
//     updateFolderIndexes();
// 	}
// };

if (isMobile) {
  $('#all-folders').on('touchstart', '.folder-clicker-icon', function(event) {
    $(this).parents(".afolder").addClass("aboutToDragFolder");
    $("#all-folders, body, html, .ql-editor, #docs-page-wrap").addClass("draggingStuff");
  });

  $('#all-folders').on('touchend', '.folder-clicker-icon', function(event) {
    $(this).parents(".afolder").removeClass("aboutToDragFolder");
    $("#all-folders").removeClass("draggingStuff");
    $("#all-folders, body, html, .ql-editor, #docs-page-wrap").removeClass("draggingStuff");
  });
}

////////////////////////////////////////////////////
///////////////// EDITOR INITIALIZE ////////////////
////////////////////////////////////////////////////
var markdownConverter = new showdown.Converter();

Quill.register('modules/markdownShortcuts', MarkdownShortcuts);

var Inline = Quill.import('blots/inline');
var Block = Quill.import('blots/block');
var BlockEmbed = Quill.import('blots/block/embed');

var fontSizeStyle = Quill.import('attributors/style/size');
fontSizeStyle.whitelist = ['8px', '10px', '13px', '16px', '18px', '20px', '24px', '30px', '36px', '40px', '48px'];
Quill.register(fontSizeStyle, true);


var DividerBlot = function (_BlockEmbed) {
  _inherits(DividerBlot, _BlockEmbed);
  function DividerBlot() {
    _classCallCheck(this, DividerBlot);
    return _possibleConstructorReturn(this, _BlockEmbed.apply(this, arguments));
  }
  return DividerBlot;
}(BlockEmbed);
DividerBlot.blotName = 'divider'; DividerBlot.tagName = 'hr';
Quill.register(DividerBlot);

$('.ql-hr').click(function () {
  var range = quill.getSelection(true);
  quill.insertText(range.index, '\n', Quill.sources.USER);
  quill.insertEmbed(range.index + 1, 'divider', true, Quill.sources.USER);
  quill.setSelection(range.index + 2, Quill.sources.SILENT);
});


var IMAGE_MIME_REGEX = /^image\/(p?jpeg|gif|png)$/i;

document.onpaste = function(e){
  if (e.clipboardData) {
    var items = e.clipboardData.items;
    if (items) {
      for (var i = 0; i < items.length; i++) {
        if (IMAGE_MIME_REGEX.test(items[i].type)) {
          processEmbedImage (items[i].getAsFile());
          return;
        }
        // else {
        //   processDroppedAttachment(items[i].getAsFile());
        //   return;
        // }
      }
      // Normal paste handling here
    }
  }
};


var Parchment = Quill.import('parchment');
var BaseImageFormat = Quill.import('formats/image');
var ImageFormatAttributesList = ['alt', 'height', 'width', 'style'];
var whitelisted_styles = ['display', 'float'];

var ImageFormat = function (_BaseImageFormat) {
  _inherits(ImageFormat, _BaseImageFormat);
  function ImageFormat() { _classCallCheck(this, ImageFormat); return _possibleConstructorReturn(this, (ImageFormat.__proto__ || Object.getPrototypeOf(ImageFormat)).apply(this, arguments)); }
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

var CrypteeFileBlot = function (_Inline) {
  _inherits(CrypteeFileBlot, _Inline);

  function CrypteeFileBlot() {
    _classCallCheck(this, CrypteeFileBlot);
    return _possibleConstructorReturn(this, _Inline.apply(this, arguments));
  }

  CrypteeFileBlot.create = function create(value) {
    var node = _Inline.create.call(this);
    node.setAttribute('did', value.did);
    node.setAttribute('filetitle', value.filetitle);
    return node;
  };

  CrypteeFileBlot.formats = function formats(node) {
    return {
      did: node.getAttribute('did'),
      filetitle: node.getAttribute('filetitle')
    };
  };

  return CrypteeFileBlot;
}(Inline);

CrypteeFileBlot.blotName = 'file';
CrypteeFileBlot.tagName = 'crypteefile';
Quill.register(CrypteeFileBlot);


var CrypteeTagBlot = function (_Inline2) {
  _inherits(CrypteeTagBlot, _Inline2);

  function CrypteeTagBlot() {
    _classCallCheck(this, CrypteeTagBlot);
    return _possibleConstructorReturn(this, _Inline2.apply(this, arguments));
  }

  CrypteeTagBlot.create = function create(value) {
    var node = _Inline2.create.call(this);
    return node;
  };

  return CrypteeTagBlot;
}(Inline);

CrypteeTagBlot.blotName = 'tag';
CrypteeTagBlot.tagName = 'crypteetag';
Quill.register(CrypteeTagBlot);



var Keyboard = Quill.import('modules/keyboard');

var quillkeyboardbindings = {
  enter: {
    key: Keyboard.keys.ENTER,
    handler: function(range, context) {
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
        
        } else {
          return true;
        }
      }
    }
  },
  backspace: {
    key: Keyboard.keys.BACKSPACE,
    handler: function(range, context) {
      if (context.format.list) {
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
      } else {
        return true;
      }
    }
  }
};

var quillhandlers = {
  'link': function(value) {
    showEmbed("link");
  },
  'formula': function(value) {
    showEmbed("formula");
  },
  'video': function(value) {
    showEmbed("video");
  },
  'image': function(value) {
    showAttachmentSelector("image");
  }
};

if (isMobile) {

  var toolbarOptions = {
    handlers: quillhandlers,
    container: '#mobile-toolbar'
  };

  var quill = new Quill('#docs-page-wrap', {
    modules: {
      formula: true,
      syntax: true,
      magicUrl: {
        globalRegularExpression: URLRegex,
        urlRegularExpression: URLRegex
      },
      markdownShortcuts: {},
      toolbar: toolbarOptions,
      keyboard: {
        bindings: quillkeyboardbindings
      }
    },
    theme: 'bubble',
    bounds : "#docs-page-wrap"
  });

} else {

  var toolbarOptions = {
    handlers: quillhandlers,
    container: '#editor-toolbar'
  };

  var quill = new Quill('#docs-page-wrap', {
    modules: {
      formula: true,
      syntax: true,
      magicUrl: {
        globalRegularExpression: URLRegex,
        urlRegularExpression: URLRegex
      },
      markdownShortcuts: {},
      toolbar: toolbarOptions,
      keyboard: {
        bindings: quillkeyboardbindings
      },
      imageResize: {}
    },
    theme: 'snow'
  });
}

quill.clipboard.addMatcher('img', function(node, delta) {
  return delta;
});

quill.clipboard.addMatcher('span', function(node, delta) {
  return delta;
});

quill.clipboard.addMatcher('div', function(node, delta) {
  return delta;
});

var tribute = new Tribute({
  values: function (tag, callback) {
    checkOrAddTag(tag, callback);
  },
  selectTemplate: function (item) {
    return '<crypteetag>' + item.original.tag.replace("+ ", "") + '</crypteetag>';
  },
  menuItemTemplate: function (item) {
    return '<span class="icon"><i class="fa fa-tag"></i></span>' + item.string;
  },
  trigger: '#',
  lookup : "tag",
  allowSpaces: false,
  selectClass: 'tribute-selection'
});
tribute.attach(document.getElementsByClassName('ql-editor'));

function checkOrAddTag(tag, callback) {
  if (quill.getFormat()['code-block']) {
    tribute.hideMenu();
    callback([]);
    tribute.hideMenu();
  } else {
    var docTagsArray = [];
    var tagsArray = [];
    Object.values(catalog.docs).forEach(function(doc){
      docTagsArray = docTagsArray.concat(doc.tags).unique();
    });
    docTagsArray.push('+ ' + tag);
    $.each(docTagsArray, function(i, tag) {
      if (tag !== "" && tag !== " " && tag !== undefined && tag !== null) {
        tagsArray.push({'tag' : tag});
      }
    });
    callback(tagsArray);
  }
}

$('.ql-editor').on('click', 'crypteetag', function(event) {
  if (!isMobile) {
    event.preventDefault();
  }
  $(this).remove();
});

$("#mobile-floating-list").on("click", function(){
  if (quill.getFormat().list === "bullet") {
    quill.removeFormat(quill.getSelection().index);
  } else {
    quill.format('list', 'bullet');
  }
});

$("#mobile-floating-check").on("click", function(){
  $("#checkbox-button").click();
});

$("#mobile-floating-picture").on("click", function(){
  showAttachmentSelector("image");
});

$("#mobile-floating-attach").on("click", function(){
  showAttachmentSelector(" ");
});

$("#docs-page-wrap").on('touchstart', 'ul[data-checked="false"] > li, ul[data-checked="true"] > li', function(event) {
  event.stopPropagation();
  event.preventDefault();
});

$("#docs-page-wrap").on('touchstart', 'ul[data-checked="false"] > li, ul[data-checked="true"] > li', function(event) {
  event.stopPropagation();
  event.preventDefault();
});

$('.ql-editor').on('click touchend', function(event) {
  if (event.target.tagName.toLowerCase() === 'a') {
    // event.preventDefault();
    showURLBox(event.target.href);
  } else {
    hideURLBox();
  }
  $(".document-contextual-dropdown").removeClass("open");
});

if (isios) { $("#docs-url-box").addClass("isios"); }
function showURLBox(href) {
  $("#docs-url-box").find("a").attr("href", href);
  $("#docs-url-box").find("a").html(href);
  if (isMobile) { $("#docs-url-box").addClass("is-visible"); }
}

function hideURLBox() {
  $("#docs-url-box").find("a").attr("href", "");
  $("#docs-url-box").find("a").html("");
  if (isMobile) { $("#docs-url-box").removeClass("is-visible"); }
}


// A RATHER HACKY WAY TO GET FOCUS TO QUILL IF THE DOCUMENT IS EMPTY.
// TRY TO FIND A BETTER WAY.
// MAKING ACTIVE DOC CONTENTS TALLER CAUSES SCROLL PROBLEMS
$('#docs-page-wrap').on("click", function (event) {
  if ($(event.target).parents('#docs-page-wrap').length === 0) {
    quill.focus();
  }
  lastActivityTime = (new Date()).getTime();
});

$("#mobile-floating-undo").on("click", function(){
  quill.history.undo();
});

//////// HOTKEYS //////////

// OPEN RECENTS
key('alt+shift+r', function(){
  if (connectivityMode) {
    quill.blur();
    showMenu();
    $("#recents-button").click();
    checkAndSaveDocIfNecessary();
  }
  return false;
});

// OPEN FOLDERS
key('alt+shift+f', function(){
  if (connectivityMode) {
    quill.blur();
    showMenu();
    $("#folders-button").click();
    checkAndSaveDocIfNecessary();
  }
  return false;
});

// MINIMIZE / MAXIMIZE PREVIEW
key('alt+shift+m', function(){
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

key('command+shift+o, ctrl+shift+o', function(){
  if (connectivityMode) {
    quill.blur();
    showMenu();
    $("#search-input").focus();
    checkAndSaveDocIfNecessary();
  }
  return false;
});

key('command+\\, ctrl+\\', function(){
  $("#hamburger").click();
  return false;
});

key('command+], ctrl+]', function(){ quill.format('indent', '+1'); return false; });
key('command+[, ctrl+[', function(){ quill.format('indent', '-1'); return false; });
key('command+s, ctrl+s', function(){
  if (connectivityMode) {
    if (!isSaving) {
      saveDoc();
    }
  } else {
    saveOfflineDoc();
  }
  return false;
});
key('command+l, ctrl+l', function(){ showEmbed("formula"); return false; });
key('command+shift+6, ctrl+shift+6', function(){
  if (isMobile) {
    $("#checkbox-button").click();
  } else {
    $(".toolbar-scroller .ql-list[value='check']").click();
  }
  return false;
});
key('command+shift+7, ctrl+shift+7', function(){ quill.format('list', 'ordered'); return false; });
key('command+shift+8, ctrl+shift+8', function(){ quill.format('list', 'bullet'); return false; });
key('command+shift+s, ctrl+shift+s', function(){ $(".ql-strike").click(); return false; });
key('command+., ctrl+.', function(){ showAttachmentSelector(" "); return false; });
key('command+/, ctrl+/', function(){ toggleHotkeys(); return false; });

key('command+a, ctrl+a', function(){ 
  var toReturnOrNotTo = true;
  // if a selection exists, left panel is visible and editor doesn't have focus, 
  // and it's files in a folder (not recent since it would be selecting all docs) then select all visible files
  if (selectionArray.length > 0 && $(".showLeft").length > 1 && !quill.hasFocus() && activeFolderID !== "root") {
    $("#all-active-folder-docs").children().each(function(i, sel) {
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
key('command+shift+9, ctrl+shift+9', function(){
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
key('command+shift+0, ctrl+shift+0', function(){
  if (codeToggle) {
    quill.format('code-block', false);
    codeToggle = false;
  } else {
    quill.format('code-block', true);
    codeToggle = true;
  }
  return false;
});

key('esc', function(){
  if($(".modal.is-active:not(#key-modal)")){
    $(".modal.is-active:not(#key-modal)").removeClass('is-active');
    $(".modal.is-active").find("input").val("");
    $(".modal.is-active").find("input").blur();
  }
  checkAndSaveDocIfNecessary();
  clearSelections();
  hideRightClickMenu();
});

//////// MENU SWIPE FOR MOBILE //////////

$("body").on('swipeleft',  function(){
    if (isMobile) {
      // HIDE
      hideMenu();
    }
});

$("body").on('swiperight',  function(){
    if (isMobile) {
      // SHOW
      quill.blur();
      showMenu();
    }
});



///////////////////////////////////////////////////////////
///////////////////// RIGHT CLICK MENU  ///////////////////
///////////////////////////////////////////////////////////

// Trigger action when the contexmenu is about to be shown
$(document).on("contextmenu", function (e) {
  if ($(e.target).parents(".doc").length > 0 || $(e.target).is(".doc")) {
    e.preventDefault();
    if (selectionArray.length === 0) {
      showRightClickMenu("#doc-dropdown",e);
    } else {
      showRightClickMenu("#selections-dropdown",e);
    }
  }

  if ($(e.target).parents(".afolder").length > 0 || $(e.target).is(".afolder")) {
    e.preventDefault();
    showRightClickMenu("#folder-dropdown",e);
  }
  
  if ($(e.target).is("#all-active-folder-docs")) {
    e.preventDefault();
    showRightClickMenu("#folder-dropdown",e);
  }
});


// If the document is clicked somewhere
$(document).on("mousedown", function (e) {
  // If the right click menu is visible, 
  // clicked element is not the menu,
  // and the button isn't the ctx button
  if (
    $(".crypteedropdown").hasClass("shown") &&
    $(e.target).parents(".crypteedropdown").length <= 0 &&  
    $(e.target).parents(".docctx").length <= 0
  ) {
    hideRightClickMenu();
  }
});

function showRightClickMenu ( whichOne, event ) {
  var id = $(event.target).parents(".doc").attr("did") || $(event.target).parents(".afolder").attr("id") || $(event.target).attr("id") || $(event.target).attr("did");

  var x = event.pageX;
  var y = event.pageY;
  if (y > wh() - 250) {
    // tallest dropdown will be cutoff, 
    // so display it at lowest position instead;
    y = wh() - 250;
  }

  // IF IT'S NOT A SELECTIONS RIGHT CLICK MENU, CAPTURE THE ID OF THE DOCUMENT SELECTED
  if (selectionArray.length === 0) {
    if (!id.startsWith('f-') && !id.startsWith('d-')) {
      if (activeFolderID !== "root" && $(event.target).attr("id") === "all-active-folder-docs") {
        id = activeFolderID;
      }
    }

    if (id.startsWith('d-')) {
      $(".doc[did='"+id+"']").addClass("highlightedDoc");
    }
    prepareRightClickFunctions(id);
  } else {
    prepareRightClickSelectionFunctions();
  }

  $(whichOne).addClass("shown").css({
    top: y + "px",
    left: x + "px"
  }).attr("selectedID", id);
}

function hideRightClickMenu ( whichOne ) {
  whichOne = whichOne || ".crypteedropdown";
  $(whichOne).removeClass("shown").attr("selectedID", "");
  $(whichOne).find(".offlinecheckbox").prop("checked", false);
  $(".highlightedDoc").removeClass("highlightedDoc");
  clearSearch();
}

$("#all-folders").on('click', '.folder-dropdown-button', function(e) {
  showRightClickMenu("#folder-dropdown",e);
});

function rightClickedID() {
  return $(".crypteedropdown.shown").attr("selectedid");
}

function prepareRightClickFunctions (id) {
  // remove all disabled here, then add below
  $(".crypteedropdown").find("p").removeClass("disabled");
  if (id.indexOf("d-") > -1) {
    // doc
    prepareRightClickDocFunctions(id);
  } else {
    // folder
    prepareRightClickFolderFunctions(id);
  }
}

function prepareRightClickDocFunctions (id) {
  var dd = $("#doc-dropdown");
  catalog.docs[id] = catalog.docs[id] || {};
  var isFile = catalog.docs[id].isfile || false;

  var offlineDisabled = false;
  var downloadDisabled = false;
  var moveDisabled = false;
  var renameDisabled = false;
  
  if (isFile) {
    offlineDisabled = offlineDisabled || true;
  } else {
    downloadDisabled = downloadDisabled || true;
    offlineStorage.getItem(id, function (err, offlineDoc) {
      if (err) { handleError(err); }
      if (offlineDoc) { 
        dd.find(".offlinecheckbox").prop('checked', true);
      } else {
        dd.find(".offlinecheckbox").prop("checked", false);
      }
    });
  } 

  if (connectivityMode) {
    moveDisabled = moveDisabled || false;
    renameDisabled = renameDisabled || false;
    offlineDisabled = offlineDisabled || false;
  } else {
    moveDisabled = moveDisabled || true;
    renameDisabled = renameDisabled || true;
    offlineDisabled = offlineDisabled || true;
  }

  if (id === activeDocID || id === activeFileID) {
    moveDisabled = moveDisabled || true;
  } else {
    moveDisabled = moveDisabled || false;
  }
  
  if (moveDisabled) { dd.find(".move-button").addClass("disabled"); }
  if (renameDisabled) { dd.find(".rename-button").addClass("disabled"); }
  if (offlineDisabled) { dd.find(".offline-button").addClass("disabled"); }
  if (downloadDisabled) { dd.find(".download-button").addClass("disabled"); }
}


function prepareRightClickFolderFunctions (id) {
  var fd = $("#folder-dropdown");
  var areThereAnyOnlineOnlyDocs = false;
  var howManyDocs = 0;
  fd.find(".upload-file-button").find("label").attr("for", 'upload-to-' + id);
  
  var renameDisabled = false;
  var ghostDisabled = false;
  var archiveDisabled = false;
  
  if (id === "f-uncat") {
    renameDisabled = renameDisabled || true;
    ghostDisabled = ghostDisabled || true;
    archiveDisabled = archiveDisabled || true;
  } else {
    if (id === activeFolderID) {
      archiveDisabled = archiveDisabled || true;
    }
  }
  
  $.each(catalog.docs, function(did, doc){
    if (doc.fid === id) {
      howManyDocs++;
      if (!doc.isfile && !doc.isoffline) {
        areThereAnyOnlineOnlyDocs = true;
      }
    }
  }); 

  if (areThereAnyOnlineOnlyDocs) {
    fd.find(".offlinecheckbox").prop('checked', false);
  } else {
    fd.find(".offlinecheckbox").prop('checked', true);
  }

  if (howManyDocs === 0 || catalog.folders[id].archived) {
    renameDisabled = renameDisabled || true;
    ghostDisabled = ghostDisabled || true;
    archiveDisabled = archiveDisabled || true;
  }

  if (renameDisabled)   { fd.find(".rename-button").addClass("disabled");  }
  if (ghostDisabled)    { fd.find(".ghost-button").addClass("disabled");   }
  if (archiveDisabled)  { fd.find(".archive-button").addClass("disabled"); }  
}

function prepareRightClickSelectionFunctions () {
  var sd = $("#selections-dropdown");
  sd.find(".number-of-selections").html(selectionArray.length);

  var offlineDisabled = false;
  var downloadDisabled = false;
  var moveDisabled = false;
  var renameDisabled = false;

  if (selectedDocs > 0) {
    downloadDisabled = downloadDisabled || true;
  } else {
    downloadDisabled = downloadDisabled || false;
  }

  if (connectivityMode) {
    moveDisabled = moveDisabled || false;
    renameDisabled = renameDisabled || false;
    offlineDisabled = offlineDisabled || false;
  } else {
    moveDisabled = moveDisabled || true;
    renameDisabled = renameDisabled || true;
    offlineDisabled = offlineDisabled || true;
  }

  if (moveDisabled) { sd.find(".move-button").addClass("disabled"); }
  if (renameDisabled) { sd.find(".rename-button").addClass("disabled"); }
  if (offlineDisabled) { sd.find(".offline-button").addClass("disabled"); }
  if (downloadDisabled) { sd.find(".download-button").addClass("disabled"); }

}



///////  RESIZE & WINDOW MANAGEMENT & TOOLS ARRANGEMENT ///////

function isItSafeToHideMenu() {
  var safe = !$("#docs-left-wrap").find("input").is(':focus') && selectionArray.length <= 0 && 
             !$("#doc-dropdown").hasClass("shown") && !$("#folder-dropdown").hasClass("shown") && 
             !$("#selections-dropdown").hasClass("shown");
  return safe;
}

// MENU MOTION
var wrappersToMove = $("#docs-page-wrap, #editor-toolbar, #docs-left-top, #docs-left-center, #docs-left-bottom, #mobile-topbar, #docs-left-wrap, #docs-right-wrap");

if (!isMobile) {
  $("#docs-left-wrap").hover(function() {
    wrappersToMove.addClass("showLeft");
  }, function () {
    if ( isItSafeToHideMenu() ) {
      wrappersToMove.removeClass("showLeft");
    }
  });

  $("#docs-right-wrap").hover(function() {
    if (dragCounter === 0) {
      // when nothing's being dragged to be dropped show right.
      // this may change one day so account for file drops.
      updateCounts();
      // wrappersToMove.addClass("showRight");

    }
  }, function () {
    wrappersToMove.removeClass("showRight");
  });
}


var thingsNeedResizing = "#help-button, #hotkeys-button, #toolbar-container, #editor-toolbar, #docs-left-top, #docs-left-center, #docs-left-bottom, #docs-center-wrap, #docs-right-wrap, #mobile-topbar, #doc-contextual-buttons, #doc-contextual-button, #docs-page-wrap, #file-viewer, #all-folders, #main-progress, .filesize-button, .save-doc-button, #doc-top, #hamburger, .docs-float-context, .mobile-floating-tools";
function ww() { return $(window).width(); }
function wh() { return $(window).height(); }

function arrangeTools () {
  if (isMobile) {
    $("#hamburger").fadeIn(100);
    $("#close-menu-button").addClass("shown");
  } else {
    $("#help-button, #hotkeys-button").addClass("shown");
  }
}

$(window).on("load", function(event) {
  if (isMobile) {
    $("#mobile-toolbar, .mobile-floating-tools").removeClass("hidden");
    $(thingsNeedResizing).addClass("itsMobile");
    $(".save-doc-button").addClass("unavailable");
    $(".dropdown-save-button").show();
  } else {
    $(".filesize-button").addClass("desktop");
    if (isSafari) {
      $(thingsNeedResizing).addClass("itsSafari");
    }
  }

  // 767 to accommodate ipads / other portrait tablets
  if ($(window).width() <= 767) {
    $(".docs-body").removeClass("sideBySide");
  }
});

// Enable navigation prompt
window.onbeforeunload = function() {
  if (docChanged){
    return true;
  }
};

function lazyLoadUncriticalAssets() {
  [].forEach.call(document.querySelectorAll('img[lazy-src]'), function(img) {
    img.setAttribute('src', img.getAttribute('lazy-src'));
    img.onload = function() {
      img.removeAttribute('lazy-src');
    };
  });
}

function newUserHints() {
  if (Object.keys(catalog.folders).length > 0) {
    $(".first-folder-hint").slideUp();
  } else {
    $(".first-folder-hint").slideDown();
  }

  if (Object.keys(catalog.docs).length >= 1) {
    $(".first-doc-hint").slideUp();
  } else {
    $(".first-doc-hint").slideDown();
  }
}

function firstLoadComplete() {
  // HERE WE HAVE TITLES, TAGS AND EVERYTHING BEING LOADED .
  // THIS IS THE LAST THING TO BE EXECUTED AFTER SIGN IN COMPLETE.
  if (!initialLoadComplete) {
    initialLoadComplete = true;
    ttDecryptionQueueTimeout = 500;

    $(".firstLoad").removeClass("firstLoad");

    postLoadIntegrityChecks();
    lazyLoadUncriticalAssets();
    newUserHints();

    setTimeout(function () { // this is for UX
      $("#doc-contextual-buttons").show();
      arrangeTools();
      // YOU CAN NOW START OFFLINE SYNC HERE
      toSyncOrNotToSync();
    }, 1000);
  }
}

function showMenu () {
  if (isMobile) {
    $("#help-button, #hotkeys-button").addClass("shown");
  }
  wrappersToMove.addClass("showLeft");
  $(".document-contextual-dropdown").removeClass("open");
  checkAndSaveDocIfNecessary();
}

function hideMenu () {
  if (isMobile) {
    $("#help-button, #hotkeys-button").removeClass("shown");
    $(".filesize-button, .mobile-floating-tools").removeClass('menuOpen');
  }
  wrappersToMove.removeClass("showLeft");
  clearSearch();
}


function toggleHotkeys() {
  $("#hotkeys-modal").toggleClass("is-visible");
}

$("#close-menu-button").on('click', function(event) {
  hideMenu ();
});

$("#hamburger").on('click', function(event) {
  if ($(".showLeft").length > 1) {
    hideMenu();
  } else {
    // show the return button here for mobile.
    quill.blur();
    showMenu();
  }
});





////////////////////////////////////////////////////
///////////////// PROGRESS DIMMER   ////////////////
////////////////////////////////////////////////////

function showWindowProgress () {
  $("#nav-logo").attr("src", "../assets/loading-f5f5f5.gif");
}

function hideWindowProgress () {
  $("#nav-logo").attr("src", "../assets/cryptee-logo-b.svg");
}

function showDocProgress (status){
  $("#fileLoadingStatus > .message").html(status);
  $("#docs-center-wrap, #docs-left-wrap, #docs-right-wrap").addClass("is-loading");
}

function hideDocProgress (callback){
  callback = callback || noop;
  $("#docs-center-wrap, #docs-left-wrap, #docs-right-wrap").removeClass("is-loading");
  callback();
}

////////////////////////////////////////////////////
///////////////// DOC CONTEXTUAL MENU   ////////////
////////////////////////////////////////////////////

function toggleContextualMenu () {
  if (activeDocID !== "home") {
    $(".document-contextual-dropdown").toggleClass("open");
    $(".filesize-button, .mobile-floating-tools").toggleClass('menuOpen');
  }
}

////////////////////////////////////////////////////
////////////////// SIGN IN AND KEY /////////////////
////////////////////////////////////////////////////

function getToken() {
  if (!retokening) {
    retokening = true;
    firebase.auth().currentUser.getIdToken(true).then(function(idToken) {

      $.ajax({ url: tokenURL, type: 'POST',
          headers: { "Authorization": "Bearer " + idToken },
          contentType:"application/json; charset=utf-8",
          success: function(data){ gotToken(data); },
          error:function (xhr, ajaxOptions, thrownError){
              console.log(thrownError);
              retokening = false;
          }
      });
    }).catch(function(error) {
      if (error.code !== "auth/network-request-failed") {
        handleError(error);
      }
      console.log("error getting token");
      retokening = false;
    });
  }
}

function gotToken(tokenData) {
  var token = tokenData;
  firebase.auth().signInWithCustomToken(token).then(function(){
    retokening = false;
  }).catch(function(error) {
    if (error.code !== "auth/network-request-failed") {
      handleError(error);
    }
    // TODO CREATE SOME SORT OF ERROR HANDLING MECHANISM FOR TOKEN-SIGNIN ERRORS
    setTimeout(function () {
      retokening = false;
    }, 5000);
    console.log("error signing in with token");
  });
}

firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    //got user // if this is a reauth don't start process again.
    if (reauthenticated) {
      // console.log("reauthenticated");
    } else {
      reauthenticated = true;
      theUser = user;
      theUserID = theUser.uid;
      theUsername = theUser.displayName;
      theEmail = theUser.email;
      dataRef = db.ref().child('/users/' + theUserID + "/data/");
      metaRef = db.ref().child('/users/' + theUserID + "/meta/");
      homeGenerationRef = db.ref().child('/users/' + theUserID + "/data/homegeneration");
      foldersRef = db.ref().child('/users/' + theUserID + "/data/folders/");
      rootRef = store.ref().child('/users/' + theUserID);
      setSentryUser(theUserID);

      $('.username').html(theUsername || theEmail);

      checkForExistingUser(function(){
        if (getUrlParameter("dlddid") && connected) {
          $("#key-status").html("Enter your encryption key to start the download");
        }
        if (keyToRemember) {
          checkKey();
        } else {
          showKeyModal();
        }
        
        //timeout so that on Auth State Changed promise doesn't wait for start user sockets.
        setTimeout(function () {
          startUserSockets();
        }, 2);

      });
    }

    getToken();
    webAppURLController();
  } else {
    // no user. redirect to sign in IF NOT WEBAPP
    var downloadDID = getUrlParameter("dlddid");
    if (downloadDID) {
      webAppURLController("signin?redirect=docs&dlddid="+downloadDID);
    } else {
      webAppURLController("signin?redirect=docs");
    }
  }
}, function(error){
  if (error.code !== "auth/network-request-failed") {
    handleError(error);
  }
});




var keyModalConnectionTimer;
function checkForExistingUser (callback){
  callback = callback || noop;

  checkConnection(function(status){
    connected = status;

    if (connected){
      db.ref('/users/' + theUserID + "/data/keycheck").once('value').then(function(snapshot) {
        if (snapshot.val() === null) {
          window.location = "signup?status=newuser";
        } else {

          // this is only here to upgrade the legacy titles system to the new one.
          // Once all users have tie = true in their accounts, you can remove this upgrader.
          // until then additional burden of this is only 200ms.
          db.ref('/users/' + theUserID + "/data/tie").once('value').then(function(tieSnapshot) {
            if (tieSnapshot.val() === null) {
              titlesIndividuallyEncrypted = false;
            } else {
              titlesIndividuallyEncrypted = true;
            }

            encryptedStrongKey = JSON.parse(snapshot.val()).data; // or encrypted checkstring for legacy accounts
            callback();
          });

        }
      });
    } else {
      console.log("Starting Offline");
      startedOffline = true;

      keyModalConnectionTimer = setInterval(function () {
        forceCheckConnection();
      }, 1000);

      callback();
    }
  });

}





// THIS IS ONLY GOING TO GET CALLED IF THE USER IS ONLINE ON BOOT.
// SO IF "CONNECTED = TRUE"
// OTHERWISE WE WILL NOT CALL THIS ON BOOT.

function signInComplete () {
  
  // START DECRYPTING HERE.
  if (initialTTQueueReady) {
    breadcrumb("TT Decryption Queue : STARTING.");

    if (newAccount) {
      ttQueueCompleted();
    } else {
      startTTDecryptionQueue();
    }
    
    // load last open doc will get called in tt decryption queue complete

    // GRAB THE TITLE DIRECTLY IF THERE'S A PENDING DOWNLOAD. 
    var downloadDID = getUrlParameter("dlddid");
    if (downloadDID) {
      var dldTitle = titleOf(downloadDID) || "Cryptee Download";
      downloadFile(downloadDID, dldTitle, false, function(){
        history.pushState("", null, '/docs');
      });
    }

  } else {
    setTimeout(function () {
      signInComplete();
    }, 100);
  }
}



function startUserSockets () {
  /// CHECK IF IT'S A FRESH NEW ACOUNT WITH NO FOLDERS. 
  // even if user has anything in INBOX they'll go to into a folder. so 0 folders = fresh.
  foldersRef.orderByKey().limitToLast(1).once("value", function (snapshot) {
    if (!snapshot.val()) {
      // brand new account with nothing in it.
      newAccount = true;
      initialTTQueueReady = true;
    }
  });

  dataRef.child("lastOpenDocID").once('value', function(snapshot) {
    lastOpenDocID = snapshot.val();

    if (lastOpenDocID) {
      var docRef = rootRef.child(lastOpenDocID + ".crypteedoc");
      docRef.getDownloadURL().then(function(docURL) {
        $.ajax({ url: docURL, type: 'GET',
          success: function(encryptedDocDelta) {
            console.log("Preloaded last open doc");
            lastOpenDocPreloadedDelta = encryptedDocDelta;
          },
          error:function (xhr, ajaxOptions, thrownError){
            console.log("Couldn't preload last open doc:", thrownError);
          }
        });
      });
    }
  
  });

  foldersRef.on('child_added', function(folder) {
    // add folder to dom & catalog.

    // This will add folders & docs's titles as well
    // but also WILL handle doc titles (and overwrite these) in
    // folder sockets -> /docs child_added as well
    var folderObj = folder.val();
    if (folderObj.ghosttitles) { folderObj.title = null; }
    
    appendFolder(folderObj);
    // this adds all the socket listeners for the folder.
    startFolderSockets(folderObj.folderid);

    if (folderObj.ghosttitles) {
      // GOT LEGACY GHOST FOLDER!!
      // THIS MEANS THIS GHOST FOLDER WAS CREATED BEFORE THE TITLES UPGRADE WAS MADE.
      // WHICH MEANS WE NEED TO DECRYPT THE GHOST TITLES, THEN E-ENCRYPT AND UPLOAD THEM INTO EACH DOC.
      
      var encryptedGhostTitlesObject = JSON.parse(folderObj.ghosttitles).data;
      decrypt(encryptedGhostTitlesObject, [theKey]).then(function(plaintext) {
        var ghostTitlesObject = JSON.parse(plaintext.data);
        processLegacyGhostTitles(ghostTitlesObject, folderObj);
      });
    } else {
      gotEncryptedFoldertitle(folderObj.folderid, folderObj.title); 
    }

  });

  foldersRef.on('child_removed', function(folder) {
    // remove folder and its docs from dom & catalog.
    removeFolder(folder.val().folderid);
  });

  homeGenerationRef.on('value', function(gen) {
    var newHomeGen = gen.val();
    checkHomeGeneration(newHomeGen);
  });

  metaRef.on('value', function(userMeta) {
    if (userMeta.val() !== null) {
      allowedStorage = userMeta.val().allowedStorage || freeUserQuotaInBytes;
      usedStorage = userMeta.val().usedStorage || 0;
      $(".used-storage").html(formatBytes(usedStorage));
      $(".allowed-storage").html(formatBytes(allowedStorage));
      var paidOrNot = false; // to save into localstorage
      if (userMeta.val().hasOwnProperty("plan") && userMeta.val().plan !== "") {
        // paid user remove upgrade button
          var userPlan = userMeta.val().plan;
          // $("#upgrade-badge").fadeOut();
          $("#low-storage-warning").removeClass('showLowStorage viaUpgradeButton');
          closeExceededStorageModal();
        if (usedStorage >= allowedStorage){
          showBumpUpThePlan(true);
        } else if ((usedStorage >= allowedStorage * 0.8) && !huaLowStorage){
          if (allowedStorage <= freeUserQuotaInBytes) {
            showBumpUpThePlan(false);
          } else {
            if (usedStorage >= allowedStorage * 0.9) {
              showBumpUpThePlan(false);
            }
          }
        } else if (usedStorage <= (allowedStorage - 13000000000)){
          // this is 13GB because if user has 20GB, and using 7GB we'll downgrade to 10GB plan.
          bumpDownThePlan();
        }
      } else {

        if (usedStorage >= allowedStorage){
          $(".exceeded-storage").html(formatBytes(usedStorage + 100000 - allowedStorage));
          exceededStorage();
        } else if ((usedStorage >= allowedStorage * 0.8) && !huaLowStorage){
          quill.blur();
          $("#low-storage-warning").addClass('showLowStorage');
        }

        if (allowedStorage > paidUserThresholdInBytes) {
          $("#upgrade-badge").stop( true, true ).fadeOut();
          paidOrNot = true;
        } else {
          $("#upgrade-badge").stop( true, true ).fadeIn();
        }
      }

      saveUserDetailsToLS(theUsername, usedStorage, allowedStorage, paidOrNot);
      setSentryTag("availableStorage", formatBytes(allowedStorage - usedStorage));
    }
  });

  dataRef.child("preferences").on('value', function(snapshot) {
    gotPreferences(snapshot.val());
  });

}



// all folders and docs are in encrypted catalog now.
// start sockets.

function startFolderSockets (fid) {
  foldersRef.child(fid + "/docs").on('child_added', function(doc) {
    // add docs to catalog one by one.
    updateDocInCatalog (doc.ref.parent.parent.key, doc.val());
  });

  foldersRef.child(fid + "/docs").on('child_removed', function(doc) {
    // remove doc from dom & catalog.
    deleteDocComplete(doc.ref.parent.parent.key, doc.val().docid);
  });

  foldersRef.child(fid + "/docs").on('child_changed', function(doc) {
    // update encrypted titles, tags and gen in catalog
    // update gen in dom
    updateDocTitleTagsAndGenInCatalog(doc.val());
    checkDocGeneration(doc.val());
  });

  foldersRef.child(fid + "/archived").on('value', function(archiveBool) {
    // set folder archived status in dom & catalog
    setArchivedFolder(fid, archiveBool.val());
  });

  foldersRef.child(fid + "/title").on('value', function(encTitle) {
    if (encTitle.val()) {
      gotEncryptedFoldertitle(fid, encTitle.val());
    }
  });

}

function loadLastOpenDoc () {
  $("#main-progress, .progressButtons, .document-contextual-button, .filesize-button, .mobile-floating-tools, #doc-contextual-buttons, #toolbar-container").show();

  if (lastOpenDocID) {
    if (activeDocID) {
      if (activeDocID !== lastOpenDocID) {
        loadDoc(lastOpenDocID, firstLoadComplete, lastOpenDocID, lastOpenDocPreloadedDelta);
      }
    } else {
      loadDoc(lastOpenDocID, firstLoadComplete, lastOpenDocID, lastOpenDocPreloadedDelta);
    }
  } else {
    if (activeDocID) {
      if (activeDocID !== "home") {
        loadDoc("home", firstLoadComplete, "home");
      }
    } else {
      loadDoc("home", firstLoadComplete, "home");
    }
  }

}

function sortFolders () {
  dataRef.child("foldersOrder").once('value', function(snapshot) {
    foldersOrderObject = snapshot.val();
    $.each(foldersOrderObject, function(index, fid) {
      $("#" + fid).attr("data-sort", index);
    });

    $('.afolder').sort(function (a, b) {
      return ($(b).data('sort')) < ($(a).data('sort')) ? 1 : -1;
    }).prependTo('#all-folders');

    $(".afolder").each(function(folder){
      if ($(this).hasClass("archived")){
        $(this).insertAfter("#archiveDivider");
      }
    });
  });
}

function checkKey (key) {
  if (!$("#key-modal").hasClass("shown")){
    showDocProgress("Checking Key");
  } else {
    $("#key-modal-decrypt-button").addClass("is-loading");
  }
  
  if (key) {
    hashString(key).then(function(hashedKey){
      checkHashedKey(hashedKey);
    }).catch(function(error){
      wrongKey ("Wide Character Error");
    });
  } else {
    var hashedKey = keyToRemember;
    checkHashedKey(hashedKey);
  }

  function checkHashedKey(hashedKey) {
    if (connected) {
      // USER ONLINE. CHECK KEY FROM ONLINE, AND UPDATE OFFLINE COPY.
      decrypt(encryptedStrongKey, [hashedKey]).then(function(plaintext) {
        rightKey(plaintext, hashedKey);
      }).catch(function(error) {
        checkLegacyKey(dataRef, key, hashedKey, encryptedStrongKey, function(plaintext){
          rightKey(plaintext, hashedKey);
          // if it's wrong, wrongKey() will be called in checkLegacyKey in main.js
        });
      });
    } else {
      // USER OFFLINE. CHECK KEY FROM OFFLINE, AND START OFFLINE MODE.
      if (encryptedKeycheck) {
        decrypt(encryptedKeycheck, [hashedKey]).then(function(plaintext) {
          console.log("Used offline key.");
          rightKey(plaintext, hashedKey);
        }).catch(function(error) {
          wrongKey (error);
        });
      } else {
        showKeyModal();
        $('#key-status').html("<p class='subtitle'>We can't seem to verify your identity because you seem to be offline. In order to start using offline mode, you need to enter your key at least once when online on this device.</p>");
      }
    }
  }
  
}

function rightKey (plaintext, hashedKey) {
  clearInterval(keyModalConnectionTimer);
  $("#key-modal-decrypt-button").removeClass("is-loading");
  $("#key-status").removeClass("shown");
  $("#key-modal-signout-button").removeClass("shown");
  showDocProgress("Decrypting Files &amp; Folders<p class='cancel-loading'>this may take a second.</p>");
  

  hideKeyModal();

  keyToRemember = hashedKey;

  gotKey = true; // this prevents an early offline mode call from being made before key is typed.

  if (connected) {
    var theStrongKey = plaintext.data;
    theKey = theStrongKey;

    // cosmetic timeout to make sure key modal goes away smoothly
    setTimeout(function () {
      if (!titlesIndividuallyEncrypted) {
        console.log("Legacy Titles Detected. Upgrading.");
        upgradeLegacyTitles();
        // ONCE COMPLETED THIS WILL RESTART USING THE SAME METHOD WE USE IN OFFLINE -> ONLINE MODE SWITCH.
        // IT'LL REMEMBER KEY, AND RELOAD WINDOW. SO VISUALLY WON'T BE NOTICABLE.
      } else {
        signInComplete();
      }
    }, 250);

  } else {
    hideDocProgress();
    activateOfflineMode ();
  }

  newEncryptedKeycheck(hashedKey,function(newKeycheck){
    // here we encrypt a timestamp using the hashedKey, and save this to localstore.
    // we will use this when we're offline to verify the entered encryption key is correct.
    encryptedKeycheck = newKeycheck;
    localStorage.setItem("encryptedKeycheck", encryptedKeycheck);
  });

}

function wrongKey (error) {
  setTimeout(function () {
    $("#key-modal-decrypt-button").removeClass("is-loading");
  }, 1000);
  console.log("wrong key or ", error);
  sessionStorage.removeItem('key');
  showKeyModal();
  $('#key-status').html('<span class="icon"><i class="fa fa-exclamation-triangle fa-fw fa-sm" aria-hidden="true"></i></span> Wrong key, please try again.');
  $("#key-status").addClass("shown");
  $("#key-modal-signout-button").addClass("shown");
}

function keyModalApproved (){
  $('#key-status').html("Checking key");
  var key = $('#key-input').val();
  checkKey(key);
}


$("#key-input").on('keydown', function (e) {
  setTimeout(function(){
    lastActivityTime = (new Date()).getTime();
    if (e.keyCode == 13) {
      keyModalApproved ();
    }
  },50);
});



////////////////////////////////////////////////////
/////////////////// ERROR HANDLING  ////////////////
////////////////////////////////////////////////////

function checkCatalogIntegrity () {
  var undefinedFolder = false;
  var undefinedDoc = false;

  breadcrumb("Catalog Integrity Check : STARTED");

  //check for undefined folders in the catalog
  Object.keys(catalog.folders).forEach(function(key){
    if (key === "undefined") {
      // there is an undefined folder.
      undefinedFolder = true;
      breadcrumb("Catalog Integrity Check : found undefined folder");
    }
  });

  //check for undefined docs in the catalog
  Object.keys(catalog.docs).forEach(function(key){
    if (key === "undefined") {
      // there is an undefined doc.
      undefinedDoc = true;
      breadcrumb("Catalog Integrity Check : found undefined doc");
    }
  });

  // fix the undefined folder if you found any
  if (undefinedFolder) {
    fixUndefinedFolder();
  } 

  //fix the undefined doc if you found any
  if (undefinedDoc) {
    // 
  } 

  if (!undefinedDoc && !undefinedFolder) {
    breadcrumb("catalog integrity check : PASSED");
  } else {
    breadcrumb("catalog integrity check : FAILED");
  }
}

function fixHomeDoc (callback, callbackParam){
  loadJSON ("../js/homedoc.json", function(jsonRes){
    var homeDelta = JSON.parse(jsonRes);
    rootRef = store.ref().child('/users/' + theUserID);
    var homeRef = rootRef.child("home.crypteedoc");
    homeDelta = JSON.stringify(homeDelta);

    encrypt(homeDelta , [theKey]).then(function(ciphertext) {
        var encryptedDocDelta = JSON.stringify(ciphertext);

        var homeUpload = homeRef.putString(encryptedDocDelta);
        homeUpload.on('state_changed', function(snapshot){
          switch (snapshot.state) {
            case firebase.storage.TaskState.PAUSED: // or 'paused'
              break;
            case firebase.storage.TaskState.RUNNING: // or 'running'
              break;
          }
        }, function(error) {
          handleError(error);
          console.log("CREATE HOME FAILED. RETRYING IN 2 SECOND. Error: ", error);
          setTimeout(function(){ fixHomeDoc(); }, 2000);
        }, function() {
          breadcrumb("Home doc fixed. Continuing.");
          setTimeout(function(){ callback(callbackParam); }, 2000);
        });
    });
  });
}

function fixFilesAndFolders (did) {
  if (did) {
    breadcrumb("Attempting to fix files and folders. Trigger: " + did);
  } else {
    breadcrumb("Attempting to fix files and folders.");
  }
  showDocProgress("One moment please<br>Our system has detected an error<br>and it's self-repairing.");
  fixFolders(did);
}

function fixFolders (did) {
  var isThereAnUndefinedFolder = false;
  foldersRef.once('value', function(snapshot) {
    var allFolders = snapshot.val();
    breadcrumb("Got folders from server.");
    if (allFolders) {
      Object.keys(allFolders).forEach(function(fid){
        if (fid === "undefined" || fid === undefined) {
          // there is an undefined folder. fix it below.
          isThereAnUndefinedFolder = true;
        }
      });

      if (isThereAnUndefinedFolder) {
        breadcrumb("Detected 'undefined' folder key in database. Will attempt to fix.");
        fixUndefinedFolder(did); // passing did for future to pass into fixFiles
      } else {
        fixFiles(did);
      }
     
    } else {
      fixFiles(did);
    }
  });
}


function fixUndefinedFolder (did) {
  var newFID = "f-" + newUUID();
  foldersRef.child("undefined").on('value', function(folder) {
    var undefinedFolderContents = folder.val();

    if (undefinedFolderContents !== null) {
      Object.keys(undefinedFolderContents.docs).forEach(function(docid){
        undefinedFolderContents.docs[docid].fid = newFID;
      });

      foldersRef.child(newFID).update(undefinedFolderContents, function(error){
        if (!error) {
          dataRef.child("foldersOrder").once('value', function(foldersOrder) {
            var fOrderObj = foldersOrder.val();
            fOrderObj = fOrderObj || {};
            Object.keys(fOrderObj).forEach(function(index){
              if (fOrderObj[index] === "undefined" || fOrderObj[index] === undefined) {
                fOrderObj[index] = newFID;
              }
            });

            dataRef.update({"foldersOrder" : fOrderObj}, function(error){
              if (!error) {
                foldersRef.child("undefined").remove().then(function() {
                  console.log("Fixed UID: "+ theUserID + "'s undefined folder");
                  breadcrumb("Fixed undefined folder");
                  if (did) { fixFiles(did, newFID); }
                });
              } else {
                if (did) { fixFiles(did); }
              }
            });
          });
        } else {
          breadcrumb("Couldn't fix undefined folder.");
          handleError(new Error('uid: ' + theUserID + "had undefined folder, can't create replacement."));
          console.log(error);
        }
      });
    } else {
      breadcrumb('uid: ' + theUserID + "has undefined folder with no contents. will attempt to delete");

      foldersRef.child("undefined").remove().then(function() {
        console.log("Deleted UID: "+ theUserID + "'s undefined folder");
        breadcrumb("Deleted undefined folder");
      });
    }

  }, function(error) {
    breadcrumb('uid: ' + theUserID + "had undefined folder, can't read contents.");
    handleError(error);
  });
}

function fixFiles(did, newFID) {
  newFID = newFID || null;
  
  dataRef.update({"lastOpenDocID" : "home"},function(){
    loadDoc("home", firstLoadComplete);
  });

  if (did) {
    if (did === "undefined") {
      breadcrumb("Detected undefined doc.");
      
      // means that somehow a doc got undefined ID in the database.
      // First check if there's an actual undefined.cdoc or undefined.cfile in storage.
      // if there's one, rename both with a new ID, and updateTitles and tags to reflect changes.
      var fidWithUndefinedFile = $("#undefined").parents(".afolder").attr("id");
      if (fidWithUndefinedFile === "undefined") {
        fidWithUndefinedFile = newFID || "undefined";
      }

      handleError(new Error('Undefined Doc/File by uid: ' + theUserID + " in fid: " + fidWithUndefinedFile));
      showErrorBubble("An error occured while trying to open this file. Our team is informed. Sorry.", {});

      stopLoadingSpinnerOfDoc(did);

      if (isMobile) {
        hideDocProgress(hideMenu);
      } else {
        hideDocProgress();
      }

    } else {
      breadcrumb(did + " got object-not-found. Not sure if doc or file. Attempting to fix or worst case will delete.");
      // means that this docid(did) got a "storage/object-not-found" so either we thought it was a file and it was a doc vice versa,
      // or it doesn't exist at all and sadly the best we can do is to delete this file now.
      verifyDocExistsOrDelete(did);
    }
  }
}

function verifyDocExistsOrDelete(did) {
  var fid = fidOfDID(did);
  var docRef = rootRef.child(did + ".crypteedoc");
  var fileRef = rootRef.child(did + ".crypteefile");

  docRef.getMetadata().then(function(metadata) {
    // doc exists ??
    // likely thought was a file got object-not-found, but it's a doc and it exists
    // set type again and problem should be solved.
    breadcrumb(did + " was thought to be a File, but is a Doc. Fixing.");

    foldersRef.child(fid + "/docs/" + did).update({ isfile : false },function(){
      breadcrumb("Fixed " + did + " and it's now a Doc.");
      catalog.docs[did] = catalog.docs[did] || {};
      catalog.docs[did].isfile = false;
      loadDoc(did);
    });

  }).catch(function(error) {
    if (error.code === 'storage/object-not-found') {
      // doc doesn't exist. maybe it's a file.
      fileRef.getMetadata().then(function(metadata) {
        // file exists.
        // likely thought was a doc got object-not-found, but it's a file and it exists
        // set type again and problem should be solved.
        breadcrumb(did + " was thought to be a Doc, but is a File. Fixing.");

        foldersRef.child(fid + "/docs/" + did).update({ isfile : true },function(){
          breadcrumb("Fixed " + did + " and it's now a File.");
          catalog.docs[did] = catalog.docs[did] || {};
          catalog.docs[did].isfile = true;
          loadDoc(did);
        });
      }).catch(function(error) {
        if (error.code === 'storage/object-not-found') {
          // file doesn't exist either. uh oh.
          handleError(new Error('did: ' + did + " in fid: " + fid + ' was not found by uid: ' + theUserID + " not found in storage - so deleted references."));
          foldersRef.child(fid + "/docs/" + did).remove();
        }
      });
    }
  });
}

var postLoadIntegrityChecksComplete = false;
function postLoadIntegrityChecks () {
  breadcrumb("Post Load Catalog Integrity Check : STARTING");
  if (corruptTitlesToFix.length > 0) {
    corruptTitlesToFix.forEach(function(id){
      fixCorruptedTitle(id);
    });
  } else {
    postLoadIntegrityChecksComplete = true;
    breadcrumb("Post Load Catalog Integrity Check : PASSED");
  }
}

var corruptTitlesToFix = [];
function fixCorruptedTitle(id) {
  // THIS MEANS WE GOT A TITLE THAT'S NOT CORRECTLY ENCRYTPED OR NOT ENCRYPTED OR NOT ARMORED CORRECTLY
  // MOST LIKELY AN ISSUE FROM GHOST TITLE RETRIEVAL WITH MULTIPLE DEVICES.

  if (id) {
    if (id.indexOf('d-') > -1) {
      // it's a doc title to fix.
      breadcrumb("Found Corrupted Title for did: " + id + ", will re-encrypt as Untitled.");
      updateDocTitle(id, JSON.stringify("Untitled Document"));
    } else {
      // it's a folder title to fix.
      breadcrumb("Found Corrupted Title for fid: " + id + ", will re-encrypt as Untitled.");
      updateFolderTitle (id, JSON.stringify("Untitled Folder"));
    }
  }
}










////////////////////////////////////////////////////////
/////////////////// CHECK GENERATION   /////////////////
////////////////////////////////////////////////////////

function checkDocGeneration (changedDoc) {
  var changedGenerationOnServer = changedDoc.generation;
  var changedDocumentID = changedDoc.docid;
  var isFile = changedDoc.isfile || false;

  if (changedDocumentID === activeDocID) {
    if (changedGenerationOnServer !== currentGeneration) {
      // we have an outdated doc. show doc is outdated.
      isDocOutdated = true;
      breadcrumb("Displaying Outdated Doc Warning for " + activeDocID);
      showGenerationWarning();
    }
  }

  // just to be safe. 
  catalog.docs[changedDocumentID] = catalog.docs[changedDocumentID] || {};

  // reflect generation changes to dom & catalog
  $(".doc[did='"+changedDocumentID+"']").attr("gen", changedGenerationOnServer / 1000);
  catalog.docs[changedDocumentID].gen = changedGenerationOnServer;

  // reflect isfile changes to catalog
  catalog.docs[changedDocumentID].isfile = isFile;

  offlineStorage.getItem(changedDocumentID).then(function (offlineDoc) {
    if (offlineDoc && changedDocumentID !== activeDocID) {
      toSyncOrNotToSync();
    }
  }).catch(function(error) {
    console.log("couldn't open offline file", error);
    handleError(error);
  });
}



function checkHomeGeneration (newHomeGen) {
  if (activeDocID === "home") {
    if (newHomeGen !== currentGeneration) {
      // we have an outdated home. show home is outdated.
      breadcrumb("Displaying Outdated HomeDoc Warning");
      isDocOutdated = true;
      showGenerationWarning();
    }
  }
}

function showGenerationWarning () {
  $(".loading-message").fadeOut();
  $(".outdated-message").fadeIn();
  $(".filesize-button > .button").addClass("is-danger");
  $("#filesize").html("Outdated").css("color", "#fff");
  $("#filesize").css("cursor", "pointer");

  $(".filesize-button").on('click', function(event) {
    showGenerationWarning();
  });
}

function hideGenerationWarning () {
  $(".outdated-message").fadeOut();
}

function saveAnyway (){
  breadcrumb("Saving outdated doc anyway");
  isDocOutdated = false;
  if (connectivityMode) {
    saveDoc();
  } else {
    saveOfflineDoc();
  }
  $(".outdated-save-message").fadeOut();
}

function dontSave () {
  breadcrumb("Not saving outdated doc");
  docChanged = false;
  $(".outdated-save-message").fadeOut();
}

function loadNewest() {
  breadcrumb("Loading the newest version of outdated doc");
  isDocOutdated = false;
  loadDoc(activeDocID);
}



////////////////////////////////////////////////////
//////////////////   LOAD TITLES    ////////////////
////////////////////////////////////////////////////

// old titles format
// {
//   folders : {
//     '111' : 'folder test',
//     '222' : 'folder test2'
//   },
//   docs : {
//     'd111' : 'doc test',
//     'd222' : 'doc test2'
//   }
// }

function gotPlaintextDocTitle (did, plaintextTitle, callback) {
  callback = callback || noop;

  var dtitle = plaintextTitle || "Document";
  try { dtitle = JSON.parse(plaintextTitle); } catch (e) {}
  dtitle = dtitle + "";// this is to make sure if it's a number, it becomes a string.

  // add title, filetype, ext to catalog
  catalog.docs[did] = catalog.docs[did] || {};
  catalog.docs[did].name = dtitle;
  catalog.docs[did].ftype = extractFromFilename(dtitle, "filetype");
  catalog.docs[did].icon = extractFromFilename(dtitle, "icon");
  delete catalog.docs[did].encryptedTitle;

  // reflect changes to dom (which means doc must be in dom before gotPlaintextDocTitle is called)

  updateDocTitleInDOM(did, dtitle);

  var extension = dtitle.slice((dtitle.lastIndexOf(".") - 1 >>> 0) + 2);

  if (did === activeDocID) {
    document.title = dtitle;
    $('#active-doc-title-input').val(dtitle);
    $('#active-doc-title-input').attr("placeholder", dtitle);
    activeDocTitle = dtitle;
  }

  if (did === activeFileID) {
    $("#file-viewer-title").html(dtitle);
  }

  offlineStorage.getItem(did).then(function (offlineDoc) {
    if (offlineDoc) {
      var updatedDoc = offlineDoc;
      updatedDoc.name = dtitle;
      offlineStorage.setItem(did, updatedDoc).catch(function(err) {
        handleError(err);
      });
    }
  }).catch(function(err) {
    handleError(err);
  });

  callback();

}


function gotPlaintextFolderTitle (fid, plaintextTitle, callback) {
  callback = callback || noop;

  var ftitle = plaintextTitle;

  // add title to catalog
  catalog.folders[fid] = catalog.folders[fid] || {};
  catalog.folders[fid].name = ftitle;
  delete catalog.folders[fid].encryptedTitle;

  Object.values(catalog.docs).forEach(function(doc){
    if (doc.fid === fid) {
      catalog.docs[doc.did] = catalog.docs[doc.did] || {};
      catalog.docs[doc.did].fname = ftitle;
    }
  });

  // reflect changes to dom (which means folder must be in dom before got FolderTitle is called)
  var titleToUse = ftitle;
  try {titleToUse = JSON.parse(ftitle); } catch (e) {}
  $("#" + fid).find(".folder-title").html(titleToUse);

  callback();
}


function updateDocTitle (id, plaintextTitle, callback, callbackParam) {
  callback = callback || noop;
  // encrypt plaintext, write to db
  encryptTitle(id, plaintextTitle, function(encryptedTitle, did){
    var fid = fidOfDID(did);
    foldersRef.child(fid + "/docs/" + did).update({"title" : encryptedTitle}, function(error) {
      if (error) { handleError(error); }
      callback(callbackParam);
    });
  });
}


function updateFolderTitle (id, plaintextTitle, callback, callbackParam) {
  callback = callback || noop;
  // encrypt plaintext, write to db
  encryptTitle(id, plaintextTitle, function(encryptedTitle, fid){
    foldersRef.child(fid).update({"title" : encryptedTitle}, function(error) {
      if (error) { handleError(error); }
      callback(callbackParam);
    });
  });
}



/////////////////////////////////////////////////////
// TITLE HELPERS & SELECTION HELPERS
// for convenience to use in gotTitle and updateTitle
// for both docs and folders.
/////////////////////////////////////////////////////

// callback ( encryptedTitle, id )
function encryptTitle (id, plaintextTitle, callback) {
  callback = callback || noop;
  encrypt(plaintextTitle, [theKey]).then(function(ciphertext) {
    var encryptedTitle = JSON.stringify(ciphertext);
    callback(encryptedTitle, id);
  });
}

// callback ( plaintextTitle, id )
function decryptTitle (id, encryptedTitle, callback) {
  callback = callback || noop;
  if (encryptedTitle) {
    if (encryptedTitle !== ghostingTitle) {
      // not a folder being ghosted
      if (encryptedTitle.indexOf(folderTitleToSummon) > -1) {
        // it's a folder being summoned, reset its title in db
        if (summonedTitle) {
          if (summonedTitle !== "") {
            var tempSummonedTitle = summonedTitle;
            restoreSummonedTitle(id, function(){
              callback(tempSummonedTitle, id);
            });
          }
        }
      } else {
        // nothing to do with ghosts, just a title
        var parsedEncryptedTitle;
        try {
          parsedEncryptedTitle = JSON.parse(encryptedTitle).data;
        } catch (error) {
          if (!postLoadIntegrityChecksComplete) {
            handleError(new Error("uid: " + theUserID + " has corrupted title in " + id));
          } else {
            // chances are very high that this is a retrieved ghost thats title is trying to be read with every doc right now.
          }
        }

        if (parsedEncryptedTitle) {
          decrypt(parsedEncryptedTitle, [theKey]).then(function(plaintext) {
            var plaintextTitle = JSON.parse(plaintext.data);
            callback(plaintextTitle, id);
          }).catch(function(error) {
            if (!postLoadIntegrityChecksComplete) {
              corruptTitlesToFix.push(id);
            }
            callback("Untitled", id);
            handleError(error);
          });
        } else {
          if (!postLoadIntegrityChecksComplete) {
            corruptTitlesToFix.push(id);
          }
          callback("Untitled", id);
        }
      }
    } else {
      // it's a folder being ghosted
      ghostingTitle = "";
      callback("Ghosting...", id);
    }
  } else {
    // encryptedTitle is undefined;
    breadcrumb(id + " has undefined encryptedTitle");
    callback("Untitled", id);
  }
}

function gotEncryptedDocTitle(did, encryptedTitle) {
  
  var decryptionOperation = function() {
    decryptTitle(did, encryptedTitle, function(plaintextTitle, fordid) {
      totalTTInDecryptionQueue--;
      checkIfTTDecryptionQueueComplete();
      try {
        catalog.docs[did] = catalog.docs[did] || {};
        catalog.docs[did].fname = titleOf(fid); 
      } catch (e) {}
      gotPlaintextDocTitle(fordid, plaintextTitle);
      refreshOnlineDocs();
    });
  };
  
  if (!tempTTDecryptionQueue.docs[did] && decryptionOperation) {
    tempTTDecryptionQueue.docs[did] = decryptionOperation;
    addedOperationToTTDecryptionQueue();
  }

}

function gotEncryptedDocTags(did, encryptedTags) {
    
  var decryptionOperation = function() {
    decryptTags(did, encryptedTags, function(plaintextTags, fordid) {
      totalTTInDecryptionQueue--;
      checkIfTTDecryptionQueueComplete();
      catalog.docs[did] = catalog.docs[did] || {};
      catalog.docs[did].tags = plaintextTags;
      refreshOnlineDocs();
    });
  };  
  
  if (!tempTTDecryptionQueue.tags[did] && decryptionOperation) {
    tempTTDecryptionQueue.tags[did] = decryptionOperation;
    addedOperationToTTDecryptionQueue();
  }
  
}

function gotEncryptedFoldertitle(fid, encryptedTitle) {
  
  var decryptionOperation = function() {
    decryptTitle(fid, encryptedTitle, function(plaintextTitle, forfid) {
      totalTTInDecryptionQueue--;
      checkIfTTDecryptionQueueComplete();
      gotPlaintextFolderTitle(forfid, plaintextTitle, function(){
        Object.keys(catalog.docs).forEach(function(did) {
          if (catalog.docs[did].fid === fid) {
            catalog.docs[did] = catalog.docs[did] || {};
            catalog.docs[did].fname = plaintextTitle;
          }
          refreshOnlineDocs();
        });
      });
    });
  };

  if (!tempTTDecryptionQueue.folders[fid] && decryptionOperation) {
    tempTTDecryptionQueue.folders[fid] = decryptionOperation;
    addedOperationToTTDecryptionQueue();
  }
}


// FIRST SET ALL OPERATIONS TO AN OBJECT, SINCE WE'RE GOING TO GET DOCS TWICE,
// ONE FROM FOLDER ON VALUE, ANOTHER FROM FOLDER/DOC CHILD_ADDED, THIS WILL CUT DOWN
// OPERATIONS ON DOC TITLES & TAGS BY HALF. 

// {
//   "docs" : {
//     "id" : decryptionOperation,
//     "id" : decryptionOperation
//   },
//   "tags" : {
//     "id" : decryptionOperation,
//     "id" : decryptionOperation
//   },
//   "folders" : {
//     "id" : decryptionOperation,
//     "id" : decryptionOperation
//   }
// }

// THEN SET THESE TO A FLAT ARRAY AND ITERATE THAT INSTEAD.

var tempTTDecryptionQueue = { "docs" : {}, "tags" : {}, "folders" : {} };
var ttDecryptionQueueTimeout;
var finalTTDecryptionQueue = [];
var totalTTInDecryptionQueue = 0;
var startedTTQueue;
var completedTTQueue;
var initialTTQueueReady = false;

// 100 ms for boot, 500 for later to make sure 
// folder child change & doc title change can get added into queue intelligently.
var ttDecryptionQueueTimeout = 100; 

function addedOperationToTTDecryptionQueue() {
  clearTimeout(ttDecryptionQueueTimeout);
  ttDecryptionQueueTimeout = setTimeout(function () {
    
    Object.keys(tempTTDecryptionQueue.docs).forEach(function(did){
      finalTTDecryptionQueue.push(tempTTDecryptionQueue.docs[did]);
      delete tempTTDecryptionQueue.docs[did];
      totalTTInDecryptionQueue++;
    });

    Object.keys(tempTTDecryptionQueue.tags).forEach(function(did){
      finalTTDecryptionQueue.push(tempTTDecryptionQueue.tags[did]);
      delete tempTTDecryptionQueue.tags[did];
      totalTTInDecryptionQueue++;
    });
    
    Object.keys(tempTTDecryptionQueue.folders).forEach(function(fid){
      finalTTDecryptionQueue.push(tempTTDecryptionQueue.folders[fid]);
      delete tempTTDecryptionQueue.folders[fid];
      totalTTInDecryptionQueue++;
    });
    
    // now we have a flat decryption queue at hand. 
    // in finalTTFDecryptionQueue. so run that one.
    
    if (!initialLoadComplete) {
      setSentryTag("titles-count", totalTTInDecryptionQueue);
      breadcrumb("TT Decryption Queue : READY.");
      initialTTQueueReady = true;
    } else {
      // we already have the key, keep moving
      startTTDecryptionQueue();
    }
    
  }, ttDecryptionQueueTimeout);
}

function startTTDecryptionQueue() {
  startedTTQueue = (new Date()).getTime();
  breadcrumb("TT Decryption Queue : Decrypting " + totalTTInDecryptionQueue + " titles & tags");
  while (finalTTDecryptionQueue.length > 0) {
    (finalTTDecryptionQueue.shift())();   
  }
}

function checkIfTTDecryptionQueueComplete() {
  completedTTQueue = (new Date()).getTime();
  if (totalTTInDecryptionQueue === 0) {
    ttQueueCompleted();
  }
}

function ttQueueCompleted() {
  // ALL TITLES IN QUEUE DECRYPTED
  breadcrumb("TT Decryption Queue : DONE. Decrypted in " + (completedTTQueue - startedTTQueue) + "ms");
  checkCatalogIntegrity();
  
  // if this is first boot, load last open doc now.
  if (!initialLoadComplete) {
    setSentryTag("titles-decryption-speed", (completedTTQueue - startedTTQueue) + "ms");
    loadLastOpenDoc();
  }

  // since queue complete will get called even after adding a new doc / folder:
  newUserHints();
}







// returns fid from catalog;
function fidOfDID (did) {
  var fidToReturn = null;
  if (catalog.docs[did]) {
    if (catalog.docs[did].fid) {
      fidToReturn = catalog.docs[did].fid;
    }
  }
  
  return fidToReturn;
}

// returns title of did or fid intelligently
function titleOf (id) {
  var titleToReturn = null;
  if (id) {
    if (id.indexOf('d-') > -1) {
      try { titleToReturn = catalog.docs[id].name; } catch(e) {}
      if (id === "home") { titleToReturn = "Home"; }
    } else {
      try { titleToReturn = catalog.folders[id].name; } catch(e) {}
      if (id === "f-uncat") { titleToReturn = "Inbox"; }
    }
  }
  return titleToReturn;
}

// returns array
function docsOfFID (fid) {
  var docsToReturn = [];
  Object.values(catalog.docs).forEach(function(doc){
    if (doc.fid === fid) {
      docsToReturn.push(doc.did);
    }
  });
  return docsToReturn;
}

function activeFileFolder() {
  var fid;
  if (activeDocID === "home") {
    fid = "f-uncat";
  } else {
    try {
      fid = catalog.docs[activeDocID].fid;
    } catch (e) {
      fid = null;
    }
  }
  return fid;
}

function isDIDinArchivedFID (did) {
  var archived = false;
  var fid = fidOfDID(did);
  if (catalog.folders[fid]) {
    if (catalog.folders[fid].archived) {
      archived = true;
    }
  }
  return archived;
}

function restoreSummonedTitle (id, callback) {
  updateFolderTitle (id, JSON.stringify(summonedTitle), function(){
    summonedTitle = "";
    console.log("Folder successfully summoned");
    callback();
  });
}

function processLegacyGhostTitles(plaintextGhostTitlesObject, folder) {
  var fid = folder.folderid;
  var ghostedFolderName = plaintextGhostTitlesObject.fname;
  var numberOfDocs = Object.keys(plaintextGhostTitlesObject.docs).length;
  var numberUpgraded = 0;

  // folder is already appended in the child_added. encrypt its title here.
    encryptTitle (fid, ghostedFolderName, function(encryptedFolderTitle) {

      // now cycle through all docs' titles in the ghost titles object.
      $.each(plaintextGhostTitlesObject.docs, function(did, dtitle) {

        // encrypt title of doc.
        encryptTitle (did, dtitle, function(encryptedTitle, theDID) {

          // set encrypted title to db.
          foldersRef.child(fid + "/docs/" + theDID).update({"title" : encryptedTitle}, function(){

            // These will trigger the function : update Doc Title Tags And Gen In Catalog

            numberUpgraded++;
            if (numberUpgraded === numberOfDocs) {

              // last step here is to delete this folder's ghostitles key.
              // all docs upgraded

              updateFolderIndexes();
              foldersRef.child(fid).update({"ghosttitles" : null, "title" : encryptedFolderTitle});

            }
          }).catch(function(error) {
            handleError(error);
          });

        });
      });
    });

}


/////////////////////////////////////////////////////
// TAGS HELPERS
/////////////////////////////////////////////////////

// callback ( encryptedTagsArray, did )
function encryptTags (did, plaintextTagsArray, callback) {
  callback = callback || noop;
  var plaintextTags = JSON.stringify(plaintextTagsArray);
  encrypt(plaintextTags, [theKey]).then(function(ciphertext) {
    var encryptedTagsArray = JSON.stringify(ciphertext);
    callback(encryptedTagsArray, did);
  });
}

// callback ( plaintextTagsArray, did )
function decryptTags (did, encryptedTagsArray, callback) {
  callback = callback || noop;

  if (encryptedTagsArray) {
    if (encryptedTagsArray !== [] && encryptedTagsArray !== "[]" && typeof encryptedTagsArray === 'string') {
      var parsedEncryptedTags = JSON.parse(encryptedTagsArray).data; //
      decrypt(parsedEncryptedTags, [theKey]).then(function(plaintext) {
        var plaintextTagsArray = JSON.parse(plaintext.data);
        callback(plaintextTagsArray, did);
      }).catch(function(error){
        handleError(error);
        callback([], did);
      });
    } else {
      callback([], did);
    }
  } else {
    callback([], did);
  }

}

function updateActiveTags () {
  var activeDocTags = [];
  $('crypteetag').each(function(index, el) {
    var tagContent = $(this).text().replace("&nbsp;", "");
    activeDocTags.push(tagContent);
  });
  catalog.docs[activeDocID] = catalog.docs[activeDocID] || {};
  catalog.docs[activeDocID].tags = activeDocTags;
}

////////////////////////////////////////////////////////////
//////////////////   CATALOG OPERATIONS    /////////////////
////////////////////////////////////////////////////////////


// CATALOG FORMAT
// {
//   folders : {
//     'fid-111' : { name : "a folder" },
//     'fid-222' ...
//   },
//   docs : {
//     'did-111' : { name : "a doc or file", fid : fid, did : did, fcolor : fcolor, gen : generation, isfile : isfile, tags : tags },
//     'did-222' : 'doc test2'
//   }
// }

// populate encryptedCatalog.

function updateFolderInCatalog (folder) {
  var fid = folder.folderid;
  var farchived = folder.archived || false;
  var fcolor = folder.color;

  catalog.folders[fid] = catalog.folders[fid] || {};
  catalog.folders[fid].fid            = fid;
  catalog.folders[fid].archived       = farchived;
  catalog.folders[fid].name           = "";
  catalog.folders[fid].color          = fcolor;
  catalog.folders[fid].sortdocs       = folder.sortdocs;

  if (folder.docs !== null && folder.docs !== undefined) {
    Object.values(folder.docs).forEach(function(doc) {
      updateDocInCatalog (fid, doc);
    });
  }

  gotEncryptedFoldertitle(fid, folder.title);
}


function updateDocInCatalog (fid, doc) {
  var did = doc.docid;
  var isFile = doc.isfile || false;
  var isOffline = doc.isoffline || false;

  // either an encrypted string or a blank array, check for this when decrypting tags.
  var tags = doc.tags || [];

  catalog.folders[fid] = catalog.folders[fid] || {};
  catalog.docs[did] = catalog.docs[did] || {};
  catalog.docs[did].name            = doc.name || "";
  catalog.docs[did].tags            = [];
  catalog.docs[did].fid             = fid;
  catalog.docs[did].did             = did;
  catalog.docs[did].gen             = doc.generation || 0;
  catalog.docs[did].fcolor          = catalog.folders[fid].color || "#363636";
  catalog.docs[did].isfile          = isFile;
  catalog.docs[did].isoffline       = isOffline;

  gotEncryptedDocTitle(did, doc.title);
  gotEncryptedDocTags(did, tags);
}


function updateDocTitleTagsAndGenInCatalog(doc) {
  var did = doc.docid;
  var tags = doc.tags || [];

  catalog.docs[did].gen = doc.generation || 0;

  gotEncryptedDocTitle(did, doc.title);
  gotEncryptedDocTags(did, tags);
}



////////////////////////////////////////////////////
////////////////// FOLDER ACTIONS ////////////////
////////////////////////////////////////////////////

/////////////////////
// APPEND FOLDER //
/////////////////////

function appendFolder (folder){
  // THIS SHOULD BE RESOLVED WITH DROPDOWNS, AND LATEST TITLE UPGRADE ---- LEAVING HERE FOR POSTERITY FOR A MONTH JUST IN CASE. ----
  // TODO IF YOU GET AN ERROR FOR TITLE NOT FOUND / OTHER SHIT NOT FOUND ETC. THERE ARE SOME FOLDERS IN FIREBASE THAT ONLY HAVE OPEN/CLOSE PROPERTIES.
  // IT COULD BE BECAUSE THE STATUS OF AN OPEN FOLDER IS BEING SAVED AFTER ITS DELETION. 
  // CHANCES ARE CLIENT WRITES OPEN/CLOSE STATUS AFTER CLOSURE. 
  // OR THERE is / was A FOOT RACE. COULD BE FIXED AFTER ADDING DROPDOWNS INSTEAD OF DELETE BUTTONS (WHICH FALSELY TRIGGERED OPEN / CLOSE OCCASIONALLY)

  var fid = folder.folderid;
  var fopen = folder.open;
  var fcolor = folder.color;
  var farchived = folder.archived || false;
  var flogo = folder.logo || false;

  var openClass = "";
  var colorClass = " #363636";
  var hiddenClass = "hidden";

  var uploadButton = '';
  if (isAPIAvailable()) {
    uploadButton = '<input class="folder-upload-input" type="file" id="upload-to-'+fid+'" name="files[]" multiple />';
  }

  if (fopen) { openClass = ""; hiddenClass = "";} else { openClass = "collapsed"; hiddenClass = "display:none;";}
  if (fcolor) { colorClass = fcolor; }

  var archived = "";
  if (farchived) { 
    archived = "archived"; 
  }

  var withlogo = "";
  var logotag = "";
  if (flogo) { 
    withlogo = "withlogo"; 
    logotag = '<img class="folderlogo" src="logo.png">';
  }

  var folderCard =  
  '<div class="afolder ' + archived + ' ' + withlogo + ' '+ openClass +'" id="'+fid+'" style="display:none;">'+
    logotag +
    '<img class="foldertab" src="../assets/foldertab.svg" draggable="false"></img>'+
    '<div class="foldercolor" style="color:'+colorClass+';"></div>'+
    '<div class="folderactions">'+
        '<span class="icon folder-dropdown-button"><i class="fa fa-fw fa-ellipsis-v"></i></span> &nbsp;'+
        uploadButton +
    '</div>'+
    '<div class="folder-card">'+
        '<h2 class="folder-title"></h2>'+
        '<div class="folderrecents" style="' + hiddenClass +'"></div>'+
    '</div>'+
  '</div>';

  if (!$( "#" + fid ).length) {
    // folder doesn't exist in dom, so add.
    $("#all-folders").prepend(folderCard);

    // this is here to make sure these uFI is 
    // only called if the user created a new doc on this machine
    // and not on another machine – otherwise we're double writing uFI, 
    // and a race condition will happen
    // this gets nullified in setArchivedFolder (after it's initialized in folder sockets)

    if (brandNewFID) { 
      if (brandNewFID === fid) {
        updateFolderIndexes();
        $(".folders-new-folder").removeClass("is-loading");
      }
    }
    
    if (isAPIAvailable()) {
      document.getElementById(fid).addEventListener('drop', handleFileDrop, false);
      document.getElementById('upload-to-'+fid).addEventListener('change', handleFileSelect, false);
    }

    // somehow this is needed for the animation. 
    // I'm assuming dom takes time to prepend the foldercard somehow.
    setTimeout(function () { $( "#" + fid ).slideDown(300); }, 50); 
    
  }

  updateFolderInCatalog(folder);

  var sortableFolders;
  if (!isMobile && !isDOMRectBlocked) {
    sortableFolders = Sortable.create(document.getElementById('all-folders'), sortableFoldersDesktopPreferences);
  } 
}





function extractFromFilename (filename, whatToExtract) {
  filename = filename + ""; // this is to make sure if it's a number, it becomes a string.
  
  var extension = filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
  var icon = "fa fa-fw fa-file-text-o";
  var filetype = null;
  var extract;

  if (extension.match(/^(006|007|3DMF|3DX|8PBS|ABM|ABR|ADI|AEX|AI|AIS|ALBM|AMU|ARD|ART|ARW|ASAT|B16|BIL|BLEND|BLKRT|BLZ|BMC|BMC|BMP|BOB|BR4|BR5|C4|CADRG|CATPART|CCX|CDR|CDT|CDX|CGM|CHT|CM2|CMX|CMZ|COMICDOC|CPL|CPS|CPT|CR2|CSF|CV5|CVG|CVI|CVI|CVX|DAE|DCIM|DCM|DCR|DCS|DDS|DESIGN|DIB|DJV|DJVU|DNG|DRG|DRW|DRWDOT|DT2|DVL|DWB|DWF|DXB|EASM|EC3|EDP|EDRW|EDW|EMF|EPRT|EPS|EPSF|EPSI|EXR|FAC|FACE|FBM|FBX|FC2|FCZ|FD2|FH11|FHD|FIT|FLIC|FLM|FM|FPF|FS|FXG|GIF|GRAFFLE|GTX|HD2|HDZ|HPD|HPI|HR2|HTZ4|ICL|ICS|IDW|IEF|IGES|IGR|ILBM|ILM|IMA|IME|IMI|IMS|INDD|INDT|IPJ|IRF|ITC2|ITHMB|J2K|JIFF|JNG|JPEG|JPF|JPG|JPG2|JPS|JPW|JT|JWL|JXR|KDC|KODAK|KPG|LDA|LDM|LET|LT2|LTZ|LVA|LVF|LXF|MAC|MACP|MCS|MCZ|MDI|MGS|MGX|MIC|MIP|MNG|MPF|MPO|MTZ|MUR|MUR|NAV|NCR|NEU|NFF|NJB|NTC|NTH|ODI|ODIF|OLA|OPD|ORA|OTA|OTB|OTC|OTG|OTI|OVW|P21|P2Z|PAT|PC6|PC7|PCD|PCT|PCX|PDN|PEF|PI2|PIC|PIC|PICNC|PICTCLIPPING|PL0|PL2|PLN|PMB|PNG|POL|PP2|PPSX|PRW|PS|PS|PSB|PSD|PSF|PSG|PSP|PSPIMAGE|PSQ|PVL|PWD|PWS|PX|PXR|PZ2|PZ3|QTIF|QTZ|QXD|RIC|RLC|RLE|RW2|SDK|SDR|SEC|SFW|SIG|SKP|SLDASM|SLDDRW|SLDPRT|SNX|SRF|SST|SUN|SVG|SVGZ|TARGA|TCW|TCX|TEX|TGA|TIF|TIFF|TJP|TN|TPF|TPX|TRIF|TRX|U3D|UPX|URT|UTX|V00|V3D|VFS|VGA|VHD|VIS|VRL|VTX|WB1|WBC|WBD|WBZ|WEBP|WGS|WI|WMF|WNK|XDW|XIP|XSI|X_B|X_T|ZDL|ZIF|ZNO|ZPRF|ZT)$/i)) {
    filetype = "image photo foto";
    icon = "fa fa-fw fa-file-image-o";
  }
  if (extension.match(/^(pdf)$/i)) {
    filetype = "pdf adobe document";
    icon = "fa fa-fw fa-file-pdf-o";
  }
  if (extension.match(/^(ecd)$/i)) {
    filetype = "encrypted cryptee document";
    icon = "fa fa-fw fa-lock";
  }
  if (extension.match(/^(c|cake|clojure|coffee|jsx|cpp|cs|css|less|scss|csx|gfm|git-config|go|gotemplate|java|java-properties|js|jquery|regexp|json|litcoffee|makefile|nant-build|objc|objcpp|perl|perl6|plist|python|ruby|rails|rjs|sass|shell|sql|mustache|strings|toml|yaml|git-commit|git-rebase|html|erb|gohtml|jsp|php|py|junit-test-report|shell-session|xml|xsl)$/i)) {
    filetype = "code script program";
    icon = "fa fa-fw fa-file-code-o";
  }
  if (extension.match(/^(7z|bz2|tar|gz|rar|zip|zipx|dmg|pkg|tgz|wim)$/i)) {
    filetype = "archive compress";
    icon = "fa fa-fw fa-file-archive-o";
  }
  if (extension.match(/^(doc|dot|wbk|docx|docm|dotx|dotm|docb|apxl|pages)$/i)) {
    filetype = "office word microsoft document";
    icon = "fa fa-fw fa-file-word-o";
  }
  if (extension.match(/^(xls|xlt|xlm|xlsx|xlsm|xltx|xltm|xlsb|xla|xlam|xll|xlw|numbers)$/i)) {
    filetype = "office excel microsoft document";
    icon = "fa fa-fw fa-file-excel-o";
  }
  if (extension.match(/^(ppt|pot|pps|pptx|pptm|potx|potm|ppam|ppsx|ppsm|sldx|sldm|key|keynote)$/i)) {
    filetype = "office powerpoint microsoft document";
    icon = "fa fa-fw fa-file-powerpoint-o";
  }
  if (extension.match(/^(3GA|AA|AA3|AAC|AAX|ABC|AC3|ACD|ACD|ACM|ACT|ADG|ADTS|AFC|AHX|AIF|AIFC|AIFF|AL|AMR|AMZ|AOB|APC|APE|APF|ATRAC|AU|AVR|AWB|AWB|BAP|BMW|CAF|CDA|CFA|CIDB|COPY|CPR|CWP|DAC|DCF|DCM|DCT|DFC|DIG|DSM|DSS|DTS|DTSHD|DVF|EFA|EFE|EFK|EFV|EMD|EMX|ENC|F64|FL|FLAC|FLP|FST|GNT|GPX|GSM|GSM|HMA|HTW|IFF|IKLAX|IMW|IMY|ITS|IVC|K26|KAR|KFN|KOE|KOZ|KOZ|KPL|KTP|LQT|M3U|M3U8|M4A|M4B|M4P|M4R|MA1|MID|MIDI|MINIUSF|MIO|MKA|MMF|MON|MP2|MP3|MPA|MPC|MPU|MP_|MSV|MT2|MTE|MTP|MUP|MXP4|MZP|NCOR|NKI|NRT|NSA|NTN|NWC|ODM|OGA|OGG|OMA|OMG|OMX|OTS|OVE|PCAST|PEK|PLA|PLS|PNA|PROG|PVC|QCP|R1M|RA|RAM|RAW|RAX|REX|RFL|RIF|RMJ|RNS|RSD|RSO|RTI|RX2|SA1|SBR|SD2|SFA|SGT|SID|SMF|SND|SNG|SNS|SPRG|SSEQ|SSND|SWA|SYH|SZ|TAP|TRM|UL|USF|USFLIB|USM|VAG|VMO|VOI|VOX|VPM|VRF|VYF|W01|W64|WAV|WMA|WPROJ|WRK|WUS|WUT|WWU|XFS|ZGR|ZVR)$/i)) {
    filetype = "sound audio song track vibe music voice record play tune phono phone capture";
    icon = "fa fa-fw fa-file-audio-o";
  }
  if (extension.match(/^(264|3G2|3GP|3MM|3P2|60D|AAF|AEC|AEP|AEPX|AJP|AM4|AMV|ARF|ARV|ASD|ASF|ASX|AVB|AVD|AVI|AVP|AVS|AVS|AX|AXM|BDMV|BIK|BIX|BOX|BPJ|BUP|CAMREC|CINE|CPI|CVC|D2V|D3V|DAV|DCE|DDAT|DIVX|DKD|DLX|DMB|DM_84|DPG|DREAM|DSM|DV|DV2|DVM|DVR|DVR|DVX|DXR|EDL|ENC|EVO|F4V|FBR|FBZ|FCP|FCPROJECT|FLC|FLI|FLV|GTS|GVI|GVP|H3R|HDMOV|IFO|IMOVIEPROJ|IMOVIEPROJECT|IRCP|IRF|IRF|IVR|IVS|IZZ|IZZY|M1PG|M21|M21|M2P|M2T|M2TS|M2V|M4E|M4U|M4V|MBF|MBT|MBV|MJ2|MJP|MK3D|MKV|MNV|MOCHA|MOD|MOFF|MOI|MOV|MP21|MP21|MP4|MP4V|MPEG|MPG|MPG2|MQV|MSDVD|MSWMM|MTS|MTV|MVB|MVP|MXF|MZT|NSV|OGV|OGX|PDS|PGI|PIV|PLB|PMF|PNS|PPJ|PRPROJ|PRTL|PSH|PVR|PXV|QT|QTL|R3D|RATDVD|RM|RMS|RMVB|ROQ|RPF|RPL|RUM|RV|SDV|SFVIDCAP|SLC|SMK|SPL|SQZ|SUB|SVI|SWF|TDA3MT|THM|TIVO|TOD|TP0|TRP|TS|UDP|USM|VCR|VEG|VFT|VGZ|VIEWLET|VLAB|VMB|VOB|VP6|VP7|VRO|VSP|VVF|WD1|WEBM|WLMP|WMMP|WMV|WP3|WTV|XFL|XVID|ZM1|ZM2|ZM3|ZMV)$/i)) {
    filetype = "video film record play capture";
    icon = "fa fa-fw fa-file-video-o";
  }

  if (whatToExtract === "icon") {
    extract = icon;
  }

  if (whatToExtract === "filetype") {
    extract = filetype;
  }

  return extract;
}

function extensionFromFilename (filename) {
  filename = filename + ""; // this is to make sure if it's a number, it becomes a string.
  return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
}

//////////////////
// DRAG  FOLDER //
//////////////////

function updateFolderIndexes () {

  var newFoldersOrderObject = {};
  $(".afolder").each(function(index, theFolder) {
    newFoldersOrderObject[index] = $(this).attr("id");
  });

  if (newFoldersOrderObject !== foldersOrderObject) {
    dataRef.update({"foldersOrder" : newFoldersOrderObject});
    foldersOrderObject = newFoldersOrderObject;
  }

}





////////////////////////////////
// SORT DOCS IN ACTIVE FOLDER //
////////////////////////////////
function updateNextSortOfActiveFolder (sortType) {
  if (sortType === "azasc") {
    $("#sort-active-folder-button").attr("nextSort", "azdesc");
  } 
  
  if (sortType === "azdesc") {
    $("#sort-active-folder-button").attr("nextSort", "genasc");
  } 
  
  if (sortType === "genasc") { 
    $("#sort-active-folder-button").attr("nextSort", "gendesc");
  } 
  
  if (sortType === "gendesc") {
    $("#sort-active-folder-button").attr("nextSort", "azasc");
  } 
}

function toggleActiveFolderSortButton() {
  var sortType = $("#sort-active-folder-button").attr("nextSort");
  
  updateNextSortOfActiveFolder(sortType);
  sortDocsOfActiveFolder(sortType);
  saveActiveFolderSort(sortType);
}


function saveActiveFolderSort (sortType) {
  catalog.folders[activeFolderID].sortdocs = sortType;
  foldersRef.child(activeFolderID).update({"sortdocs" : sortType});
}

function refreshFolderSort (fid) {
  if (fid === activeFolderID) {
    var sortType = $("#sort-active-folder-button").attr("nextSort");
    sortDocsOfActiveFolder(sortType);
  }
}

function lowercaseTitleOfDoc (doc) {
  return $(doc).find('.doctitle').text().toLowerCase();
}

function sortDocsOfActiveFolder (sortType) {
  var aafd = $("#all-active-folder-docs");


  if (sortType === "azasc") {

    aafd.find(".doc").sort(function (a, b) {
      return naturalSort(lowercaseTitleOfDoc(a), lowercaseTitleOfDoc(b));
    }).appendTo("#all-active-folder-docs");
    $("#sort-active-folder-button").removeClass("fa-sort-alpha-asc fa-sort-alpha-desc fa-sort-amount-asc fa-sort-amount-desc").addClass("fa-sort-alpha-asc");

  } 
  

  if (sortType === "azdesc") {

    aafd.find(".doc").sort(function (a, b) {
      return naturalSort (lowercaseTitleOfDoc(b), lowercaseTitleOfDoc(a));
    }).appendTo("#all-active-folder-docs");
    $("#sort-active-folder-button").removeClass("fa-sort-alpha-asc fa-sort-alpha-desc fa-sort-amount-asc fa-sort-amount-desc").addClass("fa-sort-alpha-desc");

  } 
  

  if (sortType === "genasc") { 

    aafd.find(".doc").sort(function (a, b) {
      return ($(b).attr('gen')) > ($(a).attr('gen')) ? 1 : -1;
    }).appendTo("#all-active-folder-docs");
    $("#sort-active-folder-button").removeClass("fa-sort-alpha-asc fa-sort-alpha-desc fa-sort-amount-asc fa-sort-amount-desc").addClass("fa-sort-amount-asc");

  } 


  if (sortType === "gendesc") {
    
    aafd.find(".doc").sort(function (a, b) {
      return ($(b).attr('gen')) < ($(a).attr('gen')) ? 1 : -1;
    }).appendTo("#all-active-folder-docs");
    $("#sort-active-folder-button").removeClass("fa-sort-alpha-asc fa-sort-alpha-desc fa-sort-amount-asc fa-sort-amount-desc").addClass("fa-sort-amount-desc");

  }


}







//////////////////
// NEW FOLDER //
//////////////////
$('#new-folder-button').on('click', function(event) {
  event.preventDefault();
  var newFTitle = $("#new-folder-title").val().trim();
  if (newFTitle !== "") {
    newFolder();
  } else {
    $("#new-folder-title").attr("placeholder", "Type in a New Folder name here ...");
  }
});

$('#new-folder-title').on('keydown', function(event) {
  setTimeout(function(){
    $("#new-folder-title").attr("placeholder", "Create New Folder");
    var newFTitle = $("#new-folder-title").val().trim();
    if (newFTitle !== "") {
      $("#new-folder-button").addClass("is-armed");
      if (event.keyCode == 13) {
        newFolder();
      }
    } else {
      $("#new-folder-button").removeClass("is-armed");
    }
  },50);
});

var brandNewFID;
function newFolder (callback, newFTitle, uuid) {
  callback = callback || noop;

  $(".folders-new-folder").addClass("is-loading");
  uuid = uuid || newUUID();
  newFTitle = newFTitle || $("#new-folder-title").val().trim() || "Untitled Folder";
  $("#new-folder-button").removeClass("is-armed");

  var fid = "f-" + uuid;
  
  // we're setting a brandNewFID here,
  // so that in append Folder we can call updateFolderIndexes.
  /// and we can call sortFolders() accordingly;
  // we don't want uFI getting called 100 times in initialLoad.
  // and we don't want it getting called if another device adds a folder
  // since that device will update the indexes.
  // after uFI is called, and we get archived status of folder 
  // and null-ify the brandNewFID in there.
  brandNewFID = fid;
  
  encryptTitle(fid, JSON.stringify(newFTitle), function(encryptedTitle){

    var folderData = {
      folderid : fid,
      open : true,
      title : encryptedTitle
    };

    foldersRef.child(fid).update(folderData , function(){
      $("#new-folder-title").val("");
      callback(fid);
    });

  });
}














/////////////////////
// DELETE FOLDER //
/////////////////////

$('#folder-dropdown').on('click', '.delete-button', function(event) {
  var fidToDelete = rightClickedID();
  $("#delete-folder-modal").attr("fidToDelete", fidToDelete);
  showModal("delete-folder-modal");
});

$('#delete-folder-modal').on('click', '.delete-folder-confirm', function(event) {
  var fid = $("#delete-folder-modal").attr("fidToDelete");
  progressModal("delete-folder-modal");
  deleteFolder(fid);
});

function deleteFolder (fid){
  var activeDID = activeDocID;

  showDocProgress("One Moment, deleting dolder.");

  var anyDocsFromThisFolderOpen = false;
  clearSelections();

  docsOfFID(fid).forEach(function(did) {
    if (activeDID === did) {
      // IF ANY OF THESE DOCS ARE CURRENTLY OPEN -~ hard close it.
      anyDocsFromThisFolderOpen = true;
    }

    var deletionRef;
    if (catalog.docs[did].isfile) {
      deletionRef = rootRef.child(did + ".crypteefile");
    } else {
      deletionRef = rootRef.child(did + ".crypteedoc");
    }

    removeDocFromDOM(did);
    offlineStorage.removeItem(did).catch(function(err) {
      handleError(err);
    });
    if (deletionRef) {
      deletionRef.delete().then(function(){}).catch(function(error) {
        handleError(error);
      });
    }

  });

  if (activeFolderID === fid) {
    $("#folders-button").click();
  }

  foldersRef.child(fid).remove().then(function() {
    if (anyDocsFromThisFolderOpen){
      loadDoc("home");
    } else {
      hideDocProgress();
    }

    updateFolderIndexes();
    $("#delete-folder-modal").attr("fidToDelete", "");
    hideModal("delete-folder-modal");  
  }).catch(function(error) {
    handleError(error);
    showDocProgress("Error deleting folder. Please reload page and try again.");
  });

}

function removeFolder (fid){
  setTimeout(function(){
    $("#" + fid).slideUp('500', function(){
      $("#" + fid).remove();

      offlineStorage.iterate(function(doc, gotDid, i) {
        if (doc.fid === fid) {
          removeOfflineDoc(doc.did);
        }
      }).catch(function(err) {
        showErrorBubble("Error deleting offline document", err);
        handleError(err);
      });

      delete catalog.folders[fid];
      var arrayOfDocsToCheckForFID = Object.values(catalog.docs);
      arrayOfDocsToCheckForFID.forEach(function(doc){
        if (doc.fid === fid) {
          delete catalog.docs[doc.did];
        }
      });

      updateFolderIndexes();
    });
  }, 500);
}











///////////////////////////////////////
// OPEN FOLDER & CLOSE FOLDER BUTTON //
///////////////////////////////////////

function toggleFolderOpenClose(fid) {
  if (!$("#" + fid).hasClass("collapsed")) {
    setTimeout(function () {
      $("#" + fid).find(".folderrecents").slideUp(300, function() {
        // all hidden
        foldersRef.child(fid).update({open : false});
        $("#" + fid).addClass("collapsed");
      });
    }, 10);
  } else {
    setTimeout(function () {
      $("#" + fid).find(".folderrecents").slideDown(300, function() {
        // all shown
        foldersRef.child(fid).update({open : true});
        $("#" + fid).removeClass("collapsed");
      });
    }, 10);
  }
}

$('#all-folders').on('click', '.foldertab, .foldercolor', function(event) {
    var fid = $(this).parents(".afolder").attr("id");
    toggleFolderOpenClose(fid);
});


//////////////////////
//  ARCHIVE FOLDER  //
//////////////////////

var archiveSortTimer;
function setArchivedFolder(fid, archiveBool) {

  catalog.folders[fid].archived = archiveBool || false;

  if (archiveBool) {
    setTimeout(function () {
      $("#" + fid).addClass("archived");
    }, 50);
  } else {
    setTimeout(function () {
      $("#" + fid).removeClass("archived");
    }, 50);
  }

  clearTimeout(archiveSortTimer);
  archiveSortTimer = setTimeout(function () {

    // this will insert the folder into the correct place.
    // also will call sort Folders for the first time after am I the last

    // this is to make sure sortFolders is only called in actions that aren't new folders,
    // and actions (that aren't new folders, and that aren't from this machine.)

    if (brandNewFID) {
      if (brandNewFID !== fid) { 
        sortFolders();
        brandNewFID = null;
      }
    } else {
      sortFolders();
    }
    
  }, 500);
}

$("#archiveDivider").on('click', function(event) {
  $("#archiveDivider").toggleClass("open");
  if ($("#archiveDivider").hasClass("open")) {
    $("#all-folders").animate({ scrollTop: $("#all-folders")[0].scrollHeight }, "slow");
  }
});

function archiveFolder(fid) {
  foldersRef.child(fid).update({archived : true});
}

$('#folder-dropdown').on('click touchend', '.archive-button', function(event) {
  var fid = rightClickedID();
  foldersRef.child(fid).update({archived : true});
  hideRightClickMenu('#folder-dropdown');
});

$('#all-folders').on('click touchend', '.afolder.archived', function(event) {
  var fid = $(this).attr("id");
  foldersRef.child(fid).update({archived : null});
});

/////////////////////
//  RENAME FOLDER  //
/////////////////////

$('#rename-folder-input').on('keydown', function(event) {
  var folderNewName = $('#rename-folder-input').val().trim();
  var folderOldName = $('#rename-folder-input').attr("placeholder");

  $(".rename-status").removeClass("is-danger is-warning is-dark is-success").addClass("is-dark");
  $(".rename-status > .title").html("Rename Folder");

  if (event.keyCode == 13) {
    setTimeout(function(){
      renameFolderConfirmed();
    },50);
  }

  if (event.keyCode == 27) {
    setTimeout(function(){
      hideRenameFolderModal();
    },50);
  }
});

function hideRenameFolderModal() {
  $(".rename-status").removeClass("is-danger is-warning is-dark is-success").addClass("is-dark");
  $(".rename-status > .title").html("Rename Folder");
  $("#rename-folder-input").val("");
  $("#rename-folder-input").blur();
  $("#rename-folder-modal").removeClass('is-active');
}

function renameFolderConfirmed() {
  var folderNewName = $('#rename-folder-input').val().trim();
  var folderOldName = $('#rename-folder-input').attr("placeholder");
  var fid = $("#rename-folder-modal").attr("fid");
  if (folderNewName !== folderOldName) {
    $(".rename-status").removeClass("is-danger is-warning is-dark is-success").addClass("is-warning");
    $(".rename-status > .title").html("Renaming ... ");

    updateFolderTitle (fid, JSON.stringify(folderNewName), function(){

      $(".rename-status").removeClass("is-danger is-warning is-dark is-success").addClass("is-success");

      offlineStorage.iterate(function(doc, did, i) {
        if (doc) {
          if (doc.fid === fid) {
            var updatedDoc = doc;
            updatedDoc.fname = folderNewName;
            offlineStorage.setItem(did, updatedDoc);
          }
        }
      }).catch(function(err) {
        handleError(err);
      });

      setTimeout(function(){ // more for UX
        $("#" + fid).find(".folder-title").html(folderNewName);
        hideRenameFolderModal();
      }, 1000);
    });
  }
}


$('#folder-dropdown').on('click', '.rename-button', function(event) {
  var fid = rightClickedID();
  var folderOldName = titleOf(fid);
  $("#rename-folder-input").attr("placeholder", folderOldName).val(folderOldName);
  $("#rename-folder-modal").addClass('is-active').attr("fid", fid);
  $(".invalid-foldername").removeClass("shown");
  setTimeout(function () {
    $("#rename-folder-input").focus();
    hideRightClickMenu();
  }, 10);
});










/////////////////////
//  COLOR FOLDER //
/////////////////////

$('#folder-dropdown').on('click', 'span[color]', function(event) {
  theColorPicker = $(this);
  var colorToAssign = $(this).attr("color");
  var fid = rightClickedID();
  foldersRef.child(fid).update({
    color : colorToAssign
  },function(error){
    if (!error) {
      $("#" + fid).find(".foldercolor").css("color", colorToAssign);
    } else {
      handleError(error);
    }
  });
  hideRightClickMenu();
});



////////////////////////////
//     GHOST FOLDERS   ///
////////////////////////////

var ghostFTitleToConfirm;
var fidToGhost;
var ghostHelpHTML = '<h4 id="ghost-folder-help">?</h4>';
var folderTitleToSummon;

function showGhostFolderHelp (){
  $('#ghost-info-modal').addClass("is-active");
}

$("#ghost-folder-help").on('click', function(event) {
  showGhostFolderHelp();
});


$('#folder-dropdown').on('click', '.ghost-button', function(event) {
  fidToGhost = rightClickedID();
  ghostFTitleToConfirm = titleOf(fidToGhost);
  
  // DON'T CLOSE THE DROPDOWN FOR THIS ONE. 
  // JUST TO BE SUUUPER SAFE THAT THE FID IS PASSED CORRECTLY INTO THE HASHER
  // IT'LL BE CLOSED ON ANY OTHER CLICK ANYWAY

  // this is to test hashing the title to see if it has any invalid / wide / unsupported / unhashable characters
  hashString(ghostFTitleToConfirm).then(function(testHashingTheTitle){    
    $("#ghost-folder-confirm-input").attr("placeholder", ghostFTitleToConfirm);
    $(".invalid-foldername").removeClass("shown");
    saveDoc(prepareForGhostFolderModal);
    $("#folders-button").click();
  }).catch(function(e){
    $(".invalid-foldername").addClass("shown");
  });
});

function prepareForGhostFolderModal() {
  if (activeDocID !== "home") {
    loadDoc("home", showGhostModal);
  } else {
    showGhostModal();
  }
}

function showGhostModal() {
  $('#ghost-folder-modal').addClass("is-active");
  setTimeout(function () {
    $("#ghost-folder-confirm-input").focus();
  }, 10);
}

$("#ghost-folder-confirm-button").on('click', function(event) {
  makeGhostFolder();
});

$("#ghost-folder-confirm-input").on('keydown', function(event) {
  setTimeout(function () {
    var valueTyped = $("#ghost-folder-confirm-input").val();
    if (valueTyped === ghostFTitleToConfirm) {
      $("#ghost-folder-confirm-button").prop("disabled", false).attr("disabled", false);
    } else {
      $("#ghost-folder-confirm-button").prop("disabled", true).attr("disabled", true);
    }

    if (event.keyCode == 27) {
      $("#ghost-folder-confirm-button").prop("disabled", true).attr("disabled", true);
      $("#ghost-folder-confirm-input").val("");
      $("#ghost-folder-confirm-input").blur();
      $("#ghost-folder-modal").removeClass('is-active');
    }
  }, 50);
});

var ghostingTitle = "A Ghosting Folder Title"; // this is set to something weird so that in decrypt title something won't accidentally match.
function makeGhostFolder () {
  $("#ghost-folder-confirm-button").addClass("is-loading").prop("disabled", true).attr("disabled", true);
  hashString(ghostFTitleToConfirm).then(function(theGhostingTitle){
    ghostingTitle = theGhostingTitle;
    foldersRef.child(fidToGhost).update({"title" : ghostingTitle}, function(error){
      if (!error) {
        dataRef.update({"makeghost" : fidToGhost});
        dataRef.child("makeghost").on('value', function(snapshot) {
          if (snapshot === undefined || !snapshot.val() || snapshot.val() === "" || snapshot.val() === " "){
            //successfully erased ghost. close modal.
            $("#ghost-folder-confirm-button").prop("disabled", true).attr("disabled", true);
            $("#ghost-folder-modal").removeClass('is-active');
            $("#ghost-folder-confirm-button").removeClass("is-loading");
            $("#ghost-folder-confirm-input").val("");
            $("#ghost-folder-confirm-input").blur();

            delete catalog.folders[fidToGhost];

            docsOfFID(fidToGhost).forEach(function(ghostedDID){
              removeDocFromDOM(ghostedDID);
              delete catalog.docs[ghostedDID];
              offlineStorage.removeItem(ghostedDID).catch(function(err) {
                handleError(err);
              });
            });

            updateFolderIndexes();
          }
        });
      }
    });
  }).catch(function(e){
    handleError(e);
  });
}

var summonedTitle;
function summonGhostFolder () {
  $("#ghost-folder-summon-button").addClass("is-loading").prop("disabled", true).attr("disabled", true);
  $("#ghost-folder-input").prop('disabled', true);
  summonedTitle = $("#ghost-folder-input").val();
  hashString(summonedTitle).then(function(theFolderTitleToSummon){
    folderTitleToSummon = theFolderTitleToSummon;
    $("#ghost-info-modal").find(".fa-eye").removeClass("fa-eye").addClass("fa-cog fa-spin fa-fw");

    dataRef.update({"summonghost" : folderTitleToSummon}, function(error){
      handleError(error);
    });

    dataRef.child("summonghost").on('value', function(snapshot) {
      if (snapshot === undefined || snapshot === null || !snapshot.val() || snapshot.val() === "" || snapshot.val() === " "){
        $("#ghost-info-modal").find(".fa-cog").addClass("fa-eye").removeClass("fa-cog fa-spin fa-fw");
        $("#ghost-folder-input").val("");
        $(".ghost-folder-info").html('<i class="fa fa-question"></i>');
        $("#ghost-folder-summon-button").removeClass("is-loading").prop("disabled", false).attr("disabled", false);
        $("#ghost-folder-input").prop('disabled', false);
        hideModal("ghost-info-modal");
      }
    });
  }).catch(function(e){
      handleError(e);
  });
}

$("#ghost-folder-input").on('keydown keypress paste copy cut change', function(event) {
  setTimeout(function(){
    if (event.keyCode == 13 && $("#ghost-folder-input").val().trim() !== "") {
      summonGhostFolder();
    }
    if ($("#ghost-folder-input").val().trim() !== "") {
      $("#ghost-folder-summon-button").prop("disabled", false).attr("disabled", false);
      $(".ghost-folder-info").html('<i class="fa fa-magic" id="ghost-folder-summon-icon"></i>');
    } else {
      $("#ghost-folder-summon-button").prop("disabled", true).attr("disabled", true);
      $(".ghost-folder-info").html('<i class="fa fa-question"></i>');
    }
    if (event.keyCode == 27) {
      $("#ghost-folder-input").val(""); $(".ghost-folder-info").html('<i class="fa fa-question"></i>');
    }
  },50);
});

$("#ghost-folder-summon-button").on('click', function(event) {
  event.preventDefault();
  /* Act on the event */
  if (!$("#ghost-folder-icon").find("i").hasClass("fa-cog")) {
    if ($("#ghost-folder-input").val().trim() !== "") {
      folderTitleToSummon = $("#ghost-folder-input").val();
      summonGhostFolder();
    }
  }
});

// $('#ghost-folder').on('click', ".fa-question",function(event) {
//   event.preventDefault();
//   showGhostFolderHelp();
// });

function whatisaghost() {
  $(".whatisaghost, .summonghostfield").slideToggle(500);
}


///////////////////////
///// LOAD FOLDER /////
///////////////////////
$("#all-folders").on('click', '.folder-card', function(e) {
  var fid = $(this).parents(".afolder").attr("id");
  var archived = catalog.folders[fid].archived;
  if (!$(e.target).is(".folderrecent") && $(e.target).parents(".folderrecent").length === 0) {
    if (!archived) {
      loadFolder(fid);
    } else {
      foldersRef.child(fid).update({archived : null});
    }
  }
});

$("#all-folders").on('click', '.folder-title', function(e) {
  var fid = $(this).parents(".afolder").attr("id");
  var archived = catalog.folders[fid].archived;
  if (!archived) {
    loadFolder(fid);
  } else {
    foldersRef.child(fid).update({archived : null});
  }
});

function loadFolder (fid) {
  // START ANIMATING FOLDER FOR 0.25S
  // YOU HAVE LESS THAN THAT TO POPULATE THE DOCS. 
  var folder = $("#" + fid);
  folder.addClass("is-active");
  $("#all-active-folder-docs").html("");
  $("#active-folder-upload-button").find("label").attr("for", "upload-to-" + fid);
  // RENDER & APPEND DOCS OF FID TO ACTIVE FOLDER DOCS
  loadFolderDocs(fid);
  
  // THIS WILL TAKE 0.75S IN TOTAL.
  loadLeftViewPos("2");
}

function closeActiveFolder () {
  //remove docs from dom after 0.5s to acommodate the opacity animation;
  setTimeout(function () {
    // REMOVE DOCS FROM ACTIVE FOLDER DOM
    $("#all-active-folder-docs").html("");
    $("#active-folder-upload-button").find("label").attr("for", "");
    activeFolderID = "root";
  }, 510);

  // remove active folder class with a delay to make it inactive after the scroll animation is complete
  setTimeout(function () {
    $(".afolder.is-active").removeClass("is-active"); 
  }, 400);	
}

function loadFolderDocs (fid) {
  var allDocsArray = Object.values(catalog.docs);

  allDocsArray.sort(gensort); // SORT BASED ON RECENCY
  allDocsArray.forEach(function(doc){
    if (doc.name && doc.fid === fid) {
      $("#all-active-folder-docs").prepend(renderDoc(doc, "activefolder"));
      
      if (isDocSelected(doc.did)) {
        $(".doc[did='" + doc.did + "']").addClass("selected");
      }

      if (doc.isoffline) {
        addOfflineBadgeToDoc(doc.did);
      }
    }
  });

  var sortType = catalog.folders[fid].sortdocs || "azasc";
  updateNextSortOfActiveFolder(sortType);
  sortDocsOfActiveFolder (sortType);
  
  activeFolderID = fid;
}







////////////////////////////////////////////////////
////////////////// DOC ACTIONS ////////////////
////////////////////////////////////////////////////


//////////////////////
///// HELPERS ////////
//////////////////////

function startLoadingSpinnerOfDoc (did) {
  $(".doc[did='"+did+"']").find(".docicon").addClass("is-loading");
}

function stopLoadingSpinnerOfDoc (did) {
  $(".doc[did='" + did + "']").find(".docicon").removeClass("is-loading");
}

function highlightActiveDoc (did) {
  $(".activedoc").removeClass('activedoc');
  $(".doc[did='"+did+"']").addClass("activedoc");

  $(".folderrecent.active").removeClass('active');
  $(".folderrecent[did='"+did+"']").addClass("active");
}

function addOfflineBadgeToDoc (did) {
  $(".doc[did='"+did+"']").find(".offline-badge").addClass("visible");
}

function removeOfflineBadgeOfDoc (did) {
  $(".doc[did='" + did + "']").find(".offline-badge").removeClass("visible");
}

function removeDocFromDOM (did, fid) {
  fid = fid || null;
  if (fid) {
    $(".doc[did='"+did+"'][fid='"+fid+"']").remove();
  } else {
    $(".doc[did='" + did + "']").remove();
  }
  $(".folderrecent[did='"+did+"']").remove();
}

function doesDocExistInDOM (did, where) {
  var doesit = false;

  if (where) {
    if ($(where).find(".doc[did='"+did+"']").length > 0) {
      doesit = true;
    } else {
      doesit = false;
    }
  } else {
    if ($(".doc[did='"+did+"']").length > 0) {
      doesit = true;
    } else {
      doesit = false;
    }
  }
  return doesit;
}


function updateDocTitleInDOM(did, newtitle) {
  $(".folderrecent[did='" + did + "']").html('<span class="icon"><i class="fa fa-fw fa-clock-o"></i></span> ' + newtitle);
  $(".folderrecent.active[did='" + did + "']").html('<span class="icon"><i class="fa fa-fw fa-caret-right"></i></span> ' + newtitle);

  $(".doc[did='"+did+"']").find(".doctitle").html(newtitle);
  $(".doc[did='"+did+"']").find("i").removeClass("fa fa-fw fa-file-text-o").addClass(extractFromFilename(newtitle, "icon"));
}

//////////////////////
// NEW _DOC BUTTON //
//////////////////////

$('.offline-info-new-doc').on('click', '.icon', function(event) {
  event.preventDefault();
  var input = $("#offline-info-new-doc-input");
  var title = input.val().trim();
  if (title !== "") {
    hideNoOfflineDocs ();
    showDocProgress("Saving Current Document");
    $(".offline-info-new-doc > .icon > i").removeClass("is-armed");
    if (activeDocID) {
      saveOfflineDoc(newOfflineDoc, input);
    } else {
      newOfflineDoc(input);
    }
  } else {
    input.focus();
    input.attr("placeholder", "Type in a New Document name here ...");
  }
});

$('#offline-info-new-doc-input').on('keydown', function(event) {
  var theinput = $(this);
  setTimeout(function(){
    if (theinput.val().trim() !== "") {
      $(".offline-info-new-doc > .icon > i").addClass("is-armed");
    } else {
      $(".offline-info-new-doc > .icon > i").removeClass("is-armed");
    }

    if (event.keyCode == 13 && theinput.val().trim() !== "") {
      $(".offline-info-new-doc > .icon > i").removeClass("is-armed");
      hideNoOfflineDocs ();
      showDocProgress("Saving Current Document");
      if (activeDocID) {
        saveOfflineDoc(newOfflineDoc, theinput);
      } else {
        newOfflineDoc(theinput);
      }
    }
  },50);
});


$('.offline-new-doc').on('click', '.icon', function(event) {
  event.preventDefault();
  var input = $("#offline-new-doc-input");
  var title = input.val().trim();
  if (title !== "") {
    showDocProgress("Saving Current Document");
    $(".offline-new-doc > .icon > i").removeClass("is-armed");
    if (activeDocID) {
      saveOfflineDoc(newOfflineDoc, input);
    } else {
      newOfflineDoc(input);
    }
  } else {
    input.focus();
    input.attr("placeholder", "Type in a New Document name here ...");
  }
});

$('#offline-new-doc-input').on('keydown', function(event) {
  var theinput = $(this);
  setTimeout(function(){
    if (theinput.val().trim() !== "") {
      $(".offline-new-doc > .icon > i").addClass("is-armed");
    } else {
      $(".offline-new-doc > .icon > i").removeClass("is-armed");
    }

    if (event.keyCode == 13 && theinput.val().trim() !== "") {
      $(".offline-new-doc > .icon > i").removeClass("is-armed");
      showDocProgress("Saving Current Document");
      if (activeDocID) {
        saveOfflineDoc(newOfflineDoc, theinput);
      } else {
        newOfflineDoc(theinput);
      }
    }
  },50);
});



$('.recent-new-doc').on('click', '.icon', function(event) {
  event.preventDefault();
  var input = $("#recent-new-doc-input");
  var title = input.val().trim();
  if (title !== "") {
    if (usedStorage <= allowedStorage) {
      showDocProgress("Saving Current Document");
      $(".recent-new-doc > .icon > i").removeClass("is-armed");
      saveDoc(newRecentDoc);
    } else {
      exceededStorage();
    }
  } else {
    input.focus();
    input.attr("placeholder", "Type in a new doc name...");
  }
});

$('#recent-new-doc-input').on('keydown', function(event) {
  var theinput = $(this);
  setTimeout(function(){
    if (theinput.val().trim() !== "") {
      $(".recent-new-doc > .icon > i").addClass("is-armed");
    } else {
      $(".recent-new-doc > .icon > i").removeClass("is-armed");
    }

    if (event.keyCode == 13 && theinput.val().trim() !== "") {
      if (usedStorage <= allowedStorage) {
        $(".recent-new-doc > .icon > i").removeClass("is-armed");
        showDocProgress("Saving Current Document");
        saveDoc(newRecentDoc);
      } else {
        exceededStorage();
      }
    }
  },50);
});


function newRecentDoc () {

  showDocProgress("Creating New Document");

  // first check if uncategorized folder exists

  foldersRef.child("f-uncat").once('value', function(uncatShot) {
  	if (uncatShot.val() !== null) {
      // if yes, save new doc into it.
      createRecentDoc ();
    } else {
      newFolder(function(){
        // if not create uncat folder for the first time.
        createRecentDoc ();
      }, "Inbox", "uncat");
    }
  });

  function createRecentDoc () {
    var input = $("#recent-new-doc-input");
    var recentNewDocTitle = input.val().trim();
    var fid = "f-uncat";
    if (recentNewDocTitle !== "") {
      var did = "d-" + newUUID();
      var tempGen = (new Date()).getTime() * 1000; // this will change anyway, but this allows for syncing devices to update this doc as recent.
      encryptTitle(did, JSON.stringify(recentNewDocTitle), function(encryptedTitle){
        var docData = { docid : did, fid : fid, generation : tempGen, title : encryptedTitle };
        foldersRef.child(fid + "/docs/" + did).update(docData, function(){
          input.val("");
          newDocCreated(did, fid, recentNewDocTitle);
          refreshFolderSort(fid);
        });
      });
    }
  }
}


$('.active-folder-new-doc').on('click', '.left-button', function (event) {
  event.preventDefault();
  var input = $("#active-folder-new-doc-input");
  var title = input.val().trim();
  if (title !== "") {
    if (usedStorage <= allowedStorage) {
      showDocProgress("Saving Current Document");
      $(".active-folder-new-doc > .icon > i").removeClass("is-armed");
      saveDoc(newActiveFolderDoc);
    } else {
      exceededStorage();
    }
  } else {
    input.focus();
    input.attr("placeholder", "Type in a new doc name...");
  }
});

$('#active-folder-new-doc-input').on('keydown', function (event) {
  var theinput = $(this);
  setTimeout(function () {
    if (theinput.val().trim() !== "") {
      $(".active-folder-new-doc > .icon > i").addClass("is-armed");
    } else {
      $(".active-folder-new-doc > .icon > i").removeClass("is-armed");
    }

    if (event.keyCode == 13 && theinput.val().trim() !== "") {
      if (usedStorage <= allowedStorage) {
        $(".active-folder-new-doc > .icon > i").removeClass("is-armed");
        showDocProgress("Saving Current Document");
        saveDoc(newActiveFolderDoc);
      } else {
        exceededStorage();
      }
    }
  }, 50);
});


function newActiveFolderDoc () {

  showDocProgress("Creating New Document");

  // first check if uncategorized folder exists

  var input = $("#active-folder-new-doc-input");
  var activeFolderNewDocTitle = input.val().trim();
  var fid = activeFolderID;
  if (activeFolderNewDocTitle !== "") {
    var did = "d-" + newUUID();
    var tempGen = (new Date()).getTime() * 1000; // this will change anyway, but this allows for syncing devices to update this doc as recent.

    encryptTitle(did, JSON.stringify(activeFolderNewDocTitle), function(encryptedTitle){
      var docData = { docid : did, fid : fid, generation : tempGen, title : encryptedTitle };
      foldersRef.child(fid + "/docs/" + did).update(docData, function(){
        input.val("");
        newDocCreated(did, fid, activeFolderNewDocTitle);
        refreshFolderSort(fid);
      });
    });
  }
  
}




function newDoc (whichInput){
  showDocProgress("Creating New Document");
  var input = whichInput;
  if ($.trim(input.val()) !== ""){
    var dtitle = $.trim(input.val());
    var fid = input.parents(".afolder").attr("id");
    var did = "d-" + newUUID();
    var tempGen = (new Date()).getTime() * 1000; // this will change anyway, but this allows for syncing devices to update this doc as recent.

    encryptTitle(did, JSON.stringify(dtitle), function(encryptedTitle){
      var docData = { docid : did, fid : fid, generation : tempGen, title : encryptedTitle };

      foldersRef.child(fid + "/docs/" + did).update(docData, function(){
        input.val("");
        newDocCreated(did, fid, dtitle);
        refreshFolderSort(fid);
      });
    });
  }
}

function newDocCreated (did, fid, dtitle) {
  quill.setText('\n');
  if (userPreferences.docs.direction === "rtl") {
    quill.format('direction', 'rtl');
    quill.format('align', 'right');
  } else {
    quill.format('direction', 'ltr');
    quill.format('align', 'left');
  }

  idleTime = 0;
  lastSaved = (new Date()).getTime();
  docChanged = true;

  $("#homedoc").prop("disabled", false).attr("disabled", false);
  $("#homedoc").removeClass("is-dark");
  $("#doc-contextual-button").fadeIn(100);

  //set new did active
  activeDocID = did;
  activeDocTitle = dtitle;

  document.title = dtitle;
  $("#active-doc-title").html(dtitle);
  $("#active-doc-title-input").val(dtitle);
  $("#active-doc-title-input").attr("placeholder", dtitle);

  updateDocTitleInDOM(did, dtitle);
  
  saveDoc(function(){
    dataRef.update({"lastOpenDocID" : did}, function(){
      if (isMobile) {
        hideDocProgress(hideMenu);
      } else {
        hideDocProgress();
      }

      //old one isn't active anymore
      highlightActiveDoc(did);
    });
  });
}












/////////////////////////////////////
// _DOC INPUT CHANGE & AUTOSAVE   //
/////////////////////////////////////


quill.on('text-change', function(delta, oldDelta, source) {
  $('#main-progress').attr("value", "0").attr("max", "100").removeClass('is-success');

  lastActivityTime = (new Date()).getTime();
  idleTime = 0;
  docChanged = true;

  // if (delta) {
  //   if (delta.ops[1]) {
  //     theChange = delta.ops[1].attributes;
  //     if (quill.hasFocus() && theChange) {
  //       var qs = quill.getSelection().index;
  //       var bounds = quill.getBounds(qs);
  //       var quillHeight = $(".ql-editor").height();
  //       var quillScrollHeight = $(".ql-editor")[0].scrollHeight;

  //       if (bounds.bottom > quillHeight && !theChange.list) {
  //         $("body").stop().scrollTop(bounds.bottom);
  //         $(".ql-editor").scrollTop(quillScrollHeight);
  //       }
  //     }
  //   }
  // }

});

quill.on('selection-change', function(range) {
  if (!range) {
    // CURSOR LEFT EDITOR, TRIGGER AUTOSAVE
    checkAndSaveDocIfNecessary();
  } else {
    hideMenu();
  }
});

function idleTimer () {
  idleTime++;
  if (connectivityMode) {
    if (idleTime > 5) { // 5 secs if online
      checkAndSaveDocIfNecessary();
    }
  } else {
    if (idleTime > 1) { // 1 sec if offline
      checkAndSaveDocIfNecessary();
    }
  }
  
}

function inactiveTimer () {
  var now = (new Date()).getTime();
  var timeoutAmount = userPreferences.general.inactivityTimeout * 60000; // default is 30 mins

  if (timeoutAmount !== 0) {
    if (now - lastActivityTime > timeoutAmount) {
      inactivityTimeout();
    }
  }
}

function quarterMinutelyTimer () {
  updateRecency();
}






//////////////////////////
//   CLICK LOAD HOME    //
//////////////////////////

$('#homedoc').on('click', function(event) {
  loadHomeDoc ();
});

function loadHomeDoc (){
  if (activeDocID !== "home") {
    showDocProgress("Loading Home Document");
    prepareToLoad ("home");
  } else {
    if (isMobile) {
      hideDocProgress(hideMenu);
    } else {
      hideDocProgress();
    }
  }
}

function cancelLoading () {
  loadHomeDoc();
}






















////////////////////////
//   LOAD DOC & FILE  //
////////////////////////

function downloadFile (did, dtitle, preview, callback, callbackParam) {
  var fileRef = rootRef.child(did + ".crypteefile");
  var docElem = $(".doc[did='"+did+"']");
  docElem.find(".docprogress").addClass("docprogress-visible");
  fileRef.getDownloadURL().then(function(docURL) {
    $.ajax({ url: docURL, type: 'GET',
        success: function(encryptedFileContents){
          docElem.find(".docprogress").attr("max", "0");
          docElem.find(".docprogress").attr("value", "0");
          docElem.find(".docprogress").removeClass("docprogress-visible");
          fileLoaded(did, dtitle, encryptedFileContents, preview, callback, callbackParam);
        },
        error:function (xhr, ajaxOptions, thrownError){
          console.log(thrownError);
          var errorText = "One moment please";
          showDocProgress(errorText);
          window.location.reload();
        }
    }).progress(function(e) {
      var loadedSize = formatBytes(e.loaded);
      var totalSize = formatBytes(e.total);
      docElem.find(".docprogress").attr("max", e.total);
      docElem.find(".docprogress").attr("value", e.loaded);
    });

  }).catch(function(error) {
    var errorText;
    handleError(error);
    switch (error.code) {
      case 'storage/object-not-found':
        errorText = "Seems like this file doesn't exist or you don't have permission to open this doc. <br>We're not sure how this happened.<br> Please try again shortly, or contact our support. <br>We're terribly sorry about this.";
        // File or doc doesn't exist at all ~ shit. alright let's try to repair things.
        // Chances are we've got a problem.
        showDocProgress(errorText);
        fixFilesAndFolders(did);
        break;
      case 'storage/unauthorized':
        errorText = "Seems like this file doesn't exist or you don't have permission to open this doc. <br>We're not sure how this happened.<br> Please try again shortly, or contact our support. <br>We're terribly sorry about this.";
        // File or doc doesn't exist at all ~ shit. alright let's try to repair things.
        // Chances are we've got a problem.
        showDocProgress(errorText);
        fixFilesAndFolders();
        break;
      case 'storage/canceled':
        errorText = "A strange error happened while trying to load this file. It might be because you may have closed your browser while this doc was being saved";
        showDocProgress(errorText);
        break;
      case 'storage/unknown':
        errorText = "We can't seem to load this file. It's a mystery why. Somehow our servers are acting. Please try again shortly, or contact our support. We're terribly sorry about this.";
        showDocProgress(errorText);
        break;
    }
  });
}








$("#docs-left-wrap").on("click", ".doc, .folderrecent", function(e) {
  var did = $(this).attr("did");
  var selection = $(this);
  var shifted = e.shiftKey;
  if (!$(e.target).is("i") && !$(e.target).is(".offline-badge") && !$(e.target).is(".icon")) {
    // NOT THE ICON. LOAD DOC.
    var offlineDoc = false;
    if ($(e.target).parents("#all-offline").length > 0) {
      offlineDoc = true;
    }

    var didToLoad = did;
    if (didToLoad !== "undefined" || didToLoad !== undefined) {
      if (didToLoad !== activeDocID) {
        if (!offlineDoc) {
          prepareToLoad (didToLoad);
        } else {
          prepareToLoadOfflineDoc (didToLoad);
        }
      } else {
        if (isMobile) {
          hideDocProgress(hideMenu);
        } else {
          hideDocProgress();
        }
      }
    } else {
      fixFilesAndFolders(didToLoad);
    }
    
  } else {
    // IT'S THE ICON check if it's CTX or SELECTION.
    if (!$(e.target).is(".docctx") && !$(e.target).is(".fa-ellipsis-v")) {
      if (shifted) {
        var shiftSel = selection.prevUntil(".selected", ".doc");
        shiftSel.each(function(i, sel) {
          var seldid = $(sel).attr("did");
          toggleDocSelection(seldid);
        });
        toggleDocSelection(did);
      } else {
        toggleDocSelection(did);
      }
    } else {
      var eventToPass = e;
      if (selection.parents("#all-recent").length) {
        eventToPass.pageX = 86;
      } else {
        eventToPass.pageX = 73;
      }
      if (!$("#doc-dropdown[selectedid='"+did+"']").hasClass("shown")) {
        showRightClickMenu("#doc-dropdown",eventToPass);
      } else {
        hideRightClickMenu();
      }
    }
    
  }
});

function prepareToLoad (didToLoad) {
  clearSelections();
  startLoadingSpinnerOfDoc(didToLoad);
  if ((didToLoad !== activeDocID) && (typeof didToLoad != 'undefined') && !isDocOutdated) {
    clearSearch();
    saveDoc(loadDoc, didToLoad);
  } else {
    if (isDocOutdated) {
      loadDoc(didToLoad);
    }
  }
}

function loadDoc (did, callback, callbackParam, preloadedEncryptedDeltas){
  callback = callback || noop;
  preloadedEncryptedDeltas = preloadedEncryptedDeltas || null;

  $(".outdated-message").fadeOut();
  $(".outdated-save-message").fadeOut();

  //get necessary variables
  var itsAFile = false;
  var itsADoc = false;
  var offlineGeneration = 0;
  var docsize;
  
  catalog.docs[did] = catalog.docs[did] || {};

  if (catalog.docs[did].isfile) {
    itsAFile = true;
  } else {
    itsADoc = true;
  }

  var dtitle = titleOf(did) || "Home";

  if (itsADoc) {
    //DOWNLOAD _DOC

    //loading indicator
    if (dtitle) {
      showDocProgress("Loading " + dtitle + "<p class='cancel-loading' onclick='cancelLoading();'>Cancel</p>");
    } else {
      showDocProgress("Loading Home");
    }

    var docRef = rootRef.child(did + ".crypteedoc");
    docRef.getMetadata().then(function(metadata) {

      docsize = metadata.size;
      currentGeneration = metadata.generation;
      var onlineGeneration = currentGeneration;

      offlineStorage.getItem(did).then(function (offlineDoc) {
        if (offlineDoc) {
          offlineGeneration = offlineDoc.gen;
          if (offlineGeneration > onlineGeneration) {
            // decrypt offline copy and use that instead. it's newer.
            useOfflineCopy(offlineDoc.content);
          } else if (offlineGeneration === onlineGeneration) {
            // decrypt offline copy and use that instead to save time. it's the same.
            useOfflineCopy(offlineDoc.content);
          } else {
            // use online copy, it's newer.
            downloadOnlineCopy();
          }

          // HIDE THE DROPDOWN MAKE OFFLINE / show make ONLINE BUTTON
          $(".dropdown-makeoffline-button").hide();
          $(".dropdown-makeonline-button").show();
        } else {
          // use online copy, there's no offline one.
          downloadOnlineCopy();

          $(".dropdown-makeoffline-button").show();
          $(".dropdown-makeonline-button").hide();
          // SHOW THE DROPDOWN MAKE OFFLINE / HIDE make ONLINE BUTTON
        }
      }).catch(function(error) {
          console.log("LOAD ERROR", error);
          handleError(error);
      });

    }).catch(function(error) {
      var errorText;

      switch (error.code) {
        case 'storage/object-not-found':
          //  DOC DOESN'T EXIST AT ALL. OH. OKAY .... 
          if (did === "home") {
            breadcrumb("Couldn't find home doc. Attempting to fix.");
            fixHomeDoc(loadDoc, "home");
          } else {  
            breadcrumb("Couldn't find doc. Attempting to fix.");          
            showDocProgress("One moment please<br>Our system has detected an error<br>and it's self-repairing.");
            fixFilesAndFolders(did);
          }
          handleError(error);
          break;
        case 'storage/unauthorized':
          handleError(error);
          errorText = "Seems like this doc doesn't exist or you don't have permission to open this doc. We're not sure how this happened.<br> Please try again shortly, or contact our support.<br> We're terribly sorry about this.";
          showDocProgress(errorText);
          break;
        case 'storage/canceled':
          handleError(error);
          errorText = "A strange error happened while trying to load this doc. It might be because you may have closed your browser while this doc was being saved";
          showDocProgress(errorText);
          break;
        case 'storage/unknown':
          handleError(error);
          errorText = "We can't seem to load this doc. It's a mystery why. Somehow our servers are acting. Please try again shortly, or contact our support. We're terribly sorry about this.";
          showDocProgress(errorText);
          break;
      }
    });

  } else {
    // IT'S A FILE. LOAD PREVIEWER INSTEAD.
    var preview = true;
    downloadFile(did, dtitle, preview, callback, callbackParam);
  }





  function downloadOnlineCopy() {
    if (preloadedEncryptedDeltas) {
      useOnlineCopy(preloadedEncryptedDeltas);
    } else {
      docRef.getDownloadURL().then(function(docURL) {
        $.ajax({ url: docURL, type: 'GET',
          success: function(encryptedDocDelta){
            //LOAD _DOC WITH DID
            useOnlineCopy(encryptedDocDelta);
          },
          error:function (xhr, ajaxOptions, thrownError){
            console.log(thrownError);
            var errorText = "One moment please";
            showDocProgress(errorText);
            window.location.reload();
          }
        });
      });
    }
  }

  function useOfflineCopy (delta) {
    var offlineEncryptedDelta = JSON.parse(delta).data;
    decrypt(offlineEncryptedDelta, [keyToRemember]).then(function(offlineCopyPlaintext) {
      var offlineCopyDecryptedText = offlineCopyPlaintext.data;
      quill.setContents(JSON.parse(offlineCopyDecryptedText));
      currentGeneration = offlineGeneration;
      docLoaded();
    });
  }

  function useOnlineCopy (delta) {
    var onlineEncryptedDelta = JSON.parse(delta).data;
    decrypt(onlineEncryptedDelta, [theKey]).then(function(onlineCopyPlaintext) {
      var onlineCopyDecryptedText = onlineCopyPlaintext.data;
      quill.setContents(JSON.parse(onlineCopyDecryptedText));
      docLoaded();
    });
  }





  function docLoaded(){
    
    quill.history.clear();
    $(".ql-editor").scrollTop(0);
    dataRef.update({"lastOpenDocID" : did});
    sessionStorage.setItem('session-last-did', JSON.stringify(did));

    var milliseconds = (new Date()).getTime();
    sessionStorage.setItem('session-last-loaded', JSON.stringify(milliseconds));

    idleTime = 0;
    lastSaved = (new Date()).getTime();
    docChanged = false;
    isDocOutdated = false;

    if (did !== "home"){
      $("#homedoc").prop("disabled", false).attr("disabled", false);
      $("#homedoc").removeClass("is-dark");
      $("#doc-contextual-button").fadeIn(100);
    } else {
      dtitle = "Home";
      $("#homedoc").addClass("is-dark");
      $("#homedoc").prop("disabled", true).attr("disabled", true);

      $(".document-contextual-button").addClass("docContextOff");
      $(".filesize-button, .mobile-floating-tools").addClass('menuOpen');
      $("#doc-contextual-button").fadeOut(100);
    }

    

    //set new did active
    activeDocID = did;
    activeDocTitle = dtitle;

    var filesize = formatBytes(docsize);
    $("#filesize").html(filesize);
    $("#filesize").attr("size", filesize);
    $(".filesize-button > .button").removeClass("is-danger");
    $("#filesize").css("color", "#888");
    $("#filesize").css("cursor", "default");
    $(".filesize-button").prop('onclick',null).off('click');

    //old one isn't active anymore
    refreshOnlineDocs();
    highlightActiveDoc(did);

    stopLoadingSpinnerOfDoc(did);
    //reset all progresses

    $('#main-progress').attr("value", "100").attr("max", "100").removeClass("is-danger is-warning").addClass("is-success");

    if (isMobile) {
      hideDocProgress(hideMenu);
    } else {
      hideDocProgress();
    }

    //set doc title in taskbar
    $("#active-doc-title").html(dtitle);
    $("#active-doc-title-input").val(dtitle);
    document.title = dtitle;
    $("#active-doc-title-input").attr("placeholder", dtitle);
    generateSections();
    // always inherited from load doc.
    callback(callbackParam);

  }

}













function fileLoaded (did, dtitle, encryptedFileContents, preview, callback, callbackParam) {
  var theEncryptedFileContents = JSON.parse(encryptedFileContents).data;
  decrypt(theEncryptedFileContents, [theKey]).then(function(plaintext) {
      var decryptedContents = plaintext.data;
      if (isMobile) {
        hideDocProgress(hideMenu);
      } else {
        hideDocProgress();
      }

      if (preview) { // IT'S A PREVIEW, DISPLAY FILE VIEWER.

        previewController (dtitle, did, decryptedContents, callback, callbackParam);

      } else { // NOT PREVIEW DOWNLOAD

        downloadFileToDisk(dtitle, did, decryptedContents, callback, callbackParam);

      }
  });
}

function previewController (dtitle, did, decryptedContents, callback, callbackParam) {
  var ext = extensionFromFilename(dtitle);
  var resetFileViewer;
  var filesize;

  var fileRef = rootRef.child(did + ".crypteefile");
  fileRef.getMetadata().then(function(metadata) {
    filesize = metadata.size;

    if (isios) {
      if (isInWebAppiOS) {
        var urlToPass = "https://flare.crypt.ee/docsdld?dlddid=" + did;
        $("#active-file-download-button").attr("href", urlToPass);
      } else {
        $("#active-file-download-button").attr("href", decryptedContents);
      }
      $("#active-file-download-button").addClass("openInSafari");
      $("#active-file-download-button").attr("target", "_blank");
    }

    if (ext.match(/^(jpg|jpeg|png|gif|svg|webp)$/i)) {
      displayImageFile(dtitle, did, decryptedContents, callback, filesize, callbackParam);
      resetFileViewer = true;
    }
    else if (ext.match(/^(mp3)$/i)) {
      displayAudioFile(dtitle, did, decryptedContents, callback, filesize, callbackParam, ext);
      resetFileViewer = true;
    }
    else if (ext.match(/^(mp4|mov)$/i)) {
      displayMP4File(dtitle, did, decryptedContents, callback, filesize, callbackParam);
      resetFileViewer = true;
    }
    else if (ext.match(/^(pdf)$/i)) {
      // displayPDFNatively(dtitle, did, decryptedContents, callback, filesize, callbackParam);
      displayPDFWithPDFjs(dtitle, did, decryptedContents, callback, filesize, callbackParam);
      resetFileViewer = true;
    }
    else if (ext.match(/^(htm|html)$/i)) {
      importHTMLDocument(dtitle, did, decryptedContents, callback, filesize, callbackParam, null);
      resetFileViewer = false;
    }
    else if (ext.match(/^(enex)$/i)) {
      importEvrntDocument(dtitle, did, decryptedContents, callback, filesize, callbackParam);
      resetFileViewer = false;
    }
    else if (ext.match(/^(txt|md)$/i)) {
      importTxtOrMarkdownDocument(dtitle, did, decryptedContents, callback, filesize, callbackParam);
      resetFileViewer = false;
    }
    else if (ext.match(/^(crypteedoc|ecd)$/i)) {
      importCrypteedoc(dtitle, did, decryptedContents, callback, filesize, callbackParam);
      resetFileViewer = false;
    }
    else {
      displayUnsupportedFile(dtitle, did, decryptedContents, callback, filesize, callbackParam);
      resetFileViewer = true;
    }

    if (resetFileViewer) {
      stopLoadingSpinnerOfDoc(did);

      $("#file-viewer").removeClass("unsupported is-info");
      $("#file-viewer").find(".is-info").removeClass("is-info").addClass("is-light");
    }

  });
}

function downloadFileToDisk (dtitle, did, decryptedContents, callback, callbackParam) {
  if (!isios) {
    saveAs(dataURIToBlob(decryptedContents), dtitle);
  } else {
    if (!isInWebAppiOS) {
      window.location = decryptedContents;
    }
  }
  callback(callbackParam);
}

if (!isios) {
  $("#active-file-download-button").on("click", function(){
    downloadActiveFile ();
  });
}

function downloadActiveFile () {
  if (!isios) {
    saveAs(dataURIToBlob(activeFileContents), activeFileTitle);
  }
  else {
    if (!isInWebAppiOS) {
      window.open(activeFileContents,'_blank');
    }

    // else {
    //   var urlToPass = location.origin + "/docs?dlddid=" + activeFileID;
    //   var downloadFrame = document.getElementById('downloadFrame');
    //   var iframeDoc = downloadFrame.contentDocument || downloadFrame.contentWindow.document;
    //   var a = iframeDoc.createElement('a');
    //   a.setAttribute("href", urlToPass);
    //   a.setAttribute("target", "_blank");
    //   var dispatch = iframeDoc.createEvent("HTMLEvents");
    //   dispatch.initEvent("click", true, true);
    //   a.dispatchEvent(dispatch);
    // }
  }
}

function showFileViewer (callback, callbackParam) {
  quill.blur();
  checkAndSaveDocIfNecessary();
  $("#file-viewer").show();
  if (isMobile) { hideMenu(); }
  callback(callbackParam);
  maximizeFileViewer();
}

$('#file-viewer-minimize-button').on('click',  function(event) {
  event.preventDefault();
  minimizeFileViewer();
});

$('#file-viewer-maximize-button').on('click', function(event) {
  if ($("#file-viewer").hasClass("minimized")) {
    event.preventDefault();
    maximizeFileViewer();
  }
});

$('#file-viewer-header').on('click', function(event) {
  if ($("#file-viewer").hasClass("minimized")) {
    event.preventDefault();
    maximizeFileViewer();
  }
});

function minimizeFileViewer() {
  if (!$("#file-viewer").hasClass("minimized")) {
    if (!isMobile) { quill.focus(); }
    setTimeout(function () {
      $("#file-viewer").addClass("minimized");
      $('#file-viewer-minimize-button').hide();
      $('#file-viewer-maximize-button').show();
      $(".docs-body").removeClass("sideBySide");
    }, 10);
  }
}

function maximizeFileViewer () {
  if ($("#file-viewer").hasClass("minimized")) {
    quill.blur();
    $("#file-viewer").removeClass("minimized");
    $('#file-viewer-maximize-button').hide();
    $('#file-viewer-minimize-button').show();
    $(".docs-body").removeClass("sideBySide");
    checkAndSaveDocIfNecessary();
 }
}

function hideFileViewer () {

  activeFileContents = "";
  activeFileTitle = "";
  activeFileID = "";
  $("#file-viewer").hide();
  $("#doc-top, #docs-page-wrap").show();
  $(".activefile").removeClass("activefile");
}

function sideBySideFileViewer() {
  $(".docs-body").toggleClass("sideBySide");
}

function displayImageFile (dtitle, did, decryptedContents, callback, filesize, callbackParam) {
  activeFileContents = decryptedContents;
  activeFileTitle = dtitle;
  activeFileID = did;

  $('#file-viewer').addClass("loading-contents");
  setTimeout(function () {
    $("#file-viewer").width("9999");
    $("#file-viewer").height("9999");

    $('#file-viewer-contents').html($('<img>',{id:did , src: decryptedContents}));
    $("#file-viewer-title").html(dtitle);
    $("#file-viewer-filesize").html(formatBytes(filesize));

    showFileViewer (callback, callbackParam);

    setTimeout(function () {
      var imgH = $("img#"+did).height() + "px";
      var imgW = $("img#"+did).width() + "px";
      var size = "calc("+imgH+" + 3rem)";
      $("#file-viewer").css({ "height" : size});
      $("#file-viewer").css({ "width" : imgW});
      setTimeout(function () { $("#file-viewer").removeClass("loading-contents"); }, 250);
    }, 100);
  }, 250);

}

function displayPDFNatively (dtitle, did, decryptedContents, callback, filesize, callbackParam) {
  decryptedContents = sanitizeB64(decryptedContents);
  activeFileContents = decryptedContents;
  activeFileTitle = dtitle;
  activeFileID = did;

  $('#file-viewer').addClass("loading-contents");

  setTimeout(function () {

    $("#file-viewer").width("9999");
    $("#file-viewer").height("9999");

    var pdfData = "data:application/pdf;base64," + decryptedContents;
    $('#file-viewer-contents').html('<iframe src='+decryptedContents+' type="application/pdf"><p>It seems your browser does not support PDFs. Please download the PDF to view it</p></iframe>');
    $("#file-viewer-title").html(dtitle);
    $("#file-viewer-filesize").html(formatBytes(filesize));

    showFileViewer (callback, callbackParam);

    setTimeout(function () { $("#file-viewer").removeClass("loading-contents"); }, 250);

  }, 250);

}

function displayPDFWithPDFjs (dtitle, did, decryptedContents, callback, filesize, callbackParam) {
  decryptedContents = sanitizeB64(decryptedContents);
  activeFileContents = decryptedContents;
  activeFileTitle = dtitle;
  activeFileID = did;

  $('#file-viewer').addClass("loading-contents");

  setTimeout(function () {

    $("#file-viewer").width("9999");
    $("#file-viewer").height("9999");

    // var pdfData = "data:application/pdf;base64," + decryptedContents;
    // var pdfData = decodeBase64(decryptedContents);
    $('#file-viewer-contents').html('<iframe id="embeddedPDFViewer" src="../pdf/viewer.html"><p>It seems your browser does not support PDFs. Please download the PDF to view it</p></iframe>');

    var pdfjsframe = document.getElementById('embeddedPDFViewer');
    pdfjsframe.onload = function() {
      var pdfData = base64ToUint8Array(decryptedContents);
      pdfjsframe.contentWindow.PDFViewerApplication.open(pdfData);
    };


    $("#file-viewer-title").html(dtitle);
    $("#file-viewer-filesize").html(formatBytes(filesize));

    showFileViewer (callback, callbackParam);

    setTimeout(function () { $("#file-viewer").removeClass("loading-contents"); }, 250);

  }, 250);

}

function displayAudioFile (dtitle, did, decryptedContents, callback, filesize, callbackParam, ext) {
  decryptedContents = sanitizeB64(decryptedContents);
  activeFileContents = decryptedContents;
  activeFileTitle = dtitle;
  activeFileID = did;

  $('#file-viewer').addClass("loading-contents");

  setTimeout(function () {
    $("#file-viewer").width("9999");
    $("#file-viewer").height("9999");

    $('#file-viewer-contents').html('<audio id="'+did+'" controls controlsList="nodownload"><source src='+ decryptedContents +' type="audio/'+ext+'"><p>It seems your browser does not support MP3 playback. Please download the file to hear it</p></audio>');
    $("#file-viewer-title").html(dtitle);
    $("#file-viewer-filesize").html(formatBytes(filesize));

    showFileViewer (callback, callbackParam);

    setTimeout(function () {
      var audioH = $("audio#"+did).height() + "px";
      var audioW = $("audio#"+did).width() + "px";
      var size = "calc("+audioH+" + 3rem)";
      $("#file-viewer").css({ "height" : size});
      $("#file-viewer").css({ "width" : audioW});
      setTimeout(function () { $("#file-viewer").removeClass("loading-contents"); }, 250);
    }, 100);
  }, 250);
}

function displayMP4File (dtitle, did, decryptedContents, callback, filesize, callbackParam) {
  decryptedContents = sanitizeB64(decryptedContents);
  activeFileContents = decryptedContents;
  activeFileTitle = dtitle;
  activeFileID = did;

  $('#file-viewer').addClass("loading-contents");
  setTimeout(function () {
    $("#file-viewer").width("9999");
    $("#file-viewer").height("9999");

    $('#file-viewer-contents').html('<video id="'+did+'" controls controlsList="nodownload"><source src='+decryptedContents+' type="video/mp4"><p>It seems your browser does not support MP3 playback. Please download the file to hear it</p></video>');
    $("#file-viewer-title").html(dtitle);
    $("#file-viewer-filesize").html(formatBytes(filesize));

    showFileViewer (callback, callbackParam);

    setTimeout(function () {
      var vidH = $("video#"+did).height() + "px";
      var vidW = $("video#"+did).width() + "px";
      var size = "calc("+vidH+" + 3rem)";
      $("#file-viewer").css({ "height" : size});
      $("#file-viewer").css({ "width" : vidW});
      setTimeout(function () { $("#file-viewer").removeClass("loading-contents"); }, 250);
    }, 100);
  }, 250);
}

function displayUnsupportedFile (dtitle, did, decryptedContents, callback, filesize, callbackParam) {

  activeFileContents = decryptedContents;
  activeFileTitle = dtitle;
  activeFileID = did;
  var iconClass = extractFromFilename(dtitle, "icon");
  var b64OfFile = decryptedContents.replace("data:", "data:application/octet-stream");

  $('#file-viewer').addClass("loading-contents");

  setTimeout(function () {

    $("#file-viewer").find(".is-light").addClass("is-info");
    $("#file-viewer").addClass("unsupported is-info");
    $("#file-viewer-title").html(dtitle);
    $("#file-viewer-filesize").html(formatBytes(filesize));

  if (isios) {
    if (isInWebAppiOS) {
      $('#file-viewer-contents').html('<a class="unsupported-file-preview clickable openInSafari" href="https://flare.crypt.ee/docsdld?dlddid='+did+'" target="_blank"><p><b>'+dtitle+'</b></p><span class="icon is-large"><i class="fa fa-download"></i></span><br><p class="deets">Unfortunately it isn\'t possible to preview this filetype on your device in browser/app yet. Click here to download/open the file.</p></a>');
    } else {
      $('#file-viewer-contents').html('<a class="unsupported-file-preview clickable openInSafari" href="'+decryptedContents+'" target="_blank"><p><b>'+dtitle+'</b></p><span class="icon is-large"><i class="fa fa-download"></i></span><br><p class="deets">Unfortunately it isn\'t possible to preview this filetype on your device in browser/app yet. Click here to download/open the file.</p></a>');
    }
  } else {
    // not ios continue.
    $('#file-viewer-contents').html('<span class="unsupported-file-preview clickable"><p><b>'+dtitle+'</b></p><span class="icon is-large"><i class="fa fa-download"></i></span><br><p class="deets">Unfortunately it isn\'t possible to preview this filetype on your device in browser/app yet. Click here to download/open the file.</p></span>');

    $("#file-viewer").on('click', '.unsupported-file-preview', function(event) {
      event.preventDefault();
      downloadActiveFile();
    });
  }

    showFileViewer (callback, callbackParam);

    setTimeout(function () { $("#file-viewer").removeClass("loading-contents"); }, 250);

  }, 250);
}

















//////////////////////////////
//   SAVE & CLOSE  _DOC    //
//////////////////////////////

function closeDoc (){
  $(".document-contextual-dropdown").removeClass("open");
  if (!isSaving) {
    saveDoc(loadDoc, "home");
  } else if (isSaving){
    alert("The doc is currently being saved, please close after it's done saving");
  }
}


//////////////////////
//   SAVE  _DOC    //
//////////////////////

// CHECKS CONNECTION, IF DOC HAS CHANGEd, AND IF ITS NOT SAVING, SAVE THE CORRECT WAY (ONLINE OR OFFLINE);

function checkAndSaveDocIfNecessary () {
  if (docChanged && !isSaving) {
    if (connectivityMode) {
      if (!isSaving) {
        saveDoc();
      }
    } else {
      saveOfflineDoc();
    }
  }
}

$(".save-doc-button, .dropdown-save-button").on('click', function(event) {
  $(".document-contextual-dropdown").removeClass("open");
  if (connectivityMode) {
    if (!isSaving) {
      saveDoc();
    }
  } else {
    saveOfflineDoc();
  }
});

function saveDoc (callback, callbackParam){

    did = activeDocID;
    callback = callback || noop;

    // DO THE ENCRYPT & UPLOAD ONLY IF _DOC ACTUALLY DID CHANGE.
    // OTHERWISE PRETEND SAVE FOR UX. _DOC IS ALREADY SAVED.

    if (docChanged && !isDocOutdated) {

        if (isSaving && saveUpload !== undefined) {
          saveUpload.cancel();
        } else {
          isSaving = true;
        }

        var fid;
        if (did !== "home") {
          fid = fidOfDID(did) || "f-uncat";
          updateActiveTags();
        }


        if (callbackParam) {
          showDocProgress("Saving");
        }

        if (!callback) {
          $('#main-progress').attr("max", "0").attr("value", "100").removeClass("is-danger is-warning is-success").addClass("is-warning");
        }

        if (did !== "home") {
          foldersRef.child(fid + "/docs/" + did).once('value', function(snapshot) {
            if (snapshot.val() === null) {
              // doc deleted from server, but still open somehow. Could be because the user went offline.
              // it came back online, and tried to save, and if it does save it would/could fuck things up in backend.

              // start by making sure crucial folder details are there first.
              // this is harmless if folder already exists, and if it doesn't this will create an uncat folder :)

              foldersRef.child(fid).once('value', function(doesItExistSnapshot) {
                var folderExists = false;
                if (doesItExistSnapshot.val() !== null) {
                  folderExists = true;
                }

                foldersRef.child(fid).update({folderid: fid}, function() {

                  // if folder didn't exist on server, until we just created it.
                  // say if it's the first uncat folder for example or if user deleted folder and was offline etc. idk weird shit happens.

                  if (!folderExists) {

                    var fnameToPatch;
                    if (did !== "home") {
                      var fidToPatch  = fidOfDID(did);
                      fnameToPatch    = titleOf(fidToPatch);
                    }

                    // set folder title too and we should be good to go.
                    // if it's a new uncat folder set title here, if it's an existing file's folder no need to touch this.
                    var folderTitleToUpdate;
                    if (fid === "f-uncat") {
                      folderTitleToUpdate = JSON.stringify("Inbox");
                    } else {
                      folderTitleToUpdate = JSON.stringify(fnameToPatch);
                    }

                    updateFolderTitle (fid, folderTitleToUpdate, function(){
                      var docData = { docid : did, fid : fid };
                      foldersRef.child(fid + "/docs/" + did).update(docData, function(){
                        encryptAndUploadDoc(did, fid, callback, callbackParam);
                      });
                    });
                    
                  } else {
                    var docData = { docid : did, fid : fid };
                    foldersRef.child(fid + "/docs/" + did).update(docData, function(){
                      encryptAndUploadDoc(did, fid, callback, callbackParam);
                    });
                  }

                });
              });

            } else {
              encryptAndUploadDoc(did, fid, callback, callbackParam);
            }
          });
        } else {
          //oh it's just the home doc, carry on.
          encryptAndUploadDoc(did, fid, callback, callbackParam);
        }

    } else {
      if (isDocOutdated) {
        $(".loading-message").fadeOut();
        $(".outdated-save-message").fadeIn();
      } else {
        saveComplete(did, callback, callbackParam);
      }
    }

}


function encryptAndUploadDoc(did, fid, callback, callbackParam) {
  var docRef = rootRef.child(did + ".crypteedoc");
  var totalBytes;
  var plaintextDocDelta = JSON.stringify(quill.getContents());
  encrypt(plaintextDocDelta, [theKey]).then(function(ciphertext) {
      var encryptedDocDelta = JSON.stringify(ciphertext);
      saveUpload = docRef.putString(encryptedDocDelta);
      saveUpload.on('state_changed', function(snapshot){
        $('#main-progress').attr("max", snapshot.totalBytes).removeClass("is-danger is-success is-info").addClass("is-warning");
        $('#main-progress').attr("value", snapshot.bytesTransferred);
        totalBytes = snapshot.totalBytes;
        var filesize = formatBytes(totalBytes);
        $("#filesize").html(filesize);
        $("#filesize").attr("size", filesize);
        lastActivityTime = (new Date()).getTime();
        switch (snapshot.state) { case firebase.storage.TaskState.PAUSED: break; case firebase.storage.TaskState.RUNNING: break; }
        // if (snapshot.bytesTransferred === totalBytes) {
        //   saveUploadComplete(did, totalBytes, callback, callbackParam);
        // }
      }, function(error) {

        // IF THIS DOC DIDN'T EXIST IN SERVER, WE HAVE JUST CREATED REFERENCES FOR IT. AND FILE ISN'T UPLOADED.
        // UH-OH. THIS WILL NEED TO BE CLEANED LATER ON BY A FIXER.
        if (usedStorage >= allowedStorage) {
          exceededStorage(callback, callbackParam);
        } else {
          $('#main-progress').attr("max", "100").attr("value", "100").removeClass("is-warning is-success is-info").addClass("is-danger");

          checkConnection(function(status){
            if (status) {
              showErrorBubble("Error saving document, will retry again shortly.");
              console.log("SAVE FAILED. RETRYING IN 5 SECONDS.");
              setTimeout(function(){
                saveDoc(callback, callbackParam);
              }, 5000);
            } else {
              activateOfflineMode();
              showErrorBubble("Document will be uploaded when you're back online.");
            }
          });
        }
      }, function (){
        /// UPLOAD COMPLETE.
        saveUploadComplete(did, totalBytes, callback, callbackParam);
      });
  });
}


function saveUploadComplete(did, dsize, callback, callbackParam) {

  callback = callback || noop;

  var tagsOfDoc = [];
  if (catalog.docs[activeDocID]) {
    tagsOfDoc = catalog.docs[activeDocID].tags || []; // this is updated in update active tags in save
  }

  var docRef = rootRef.child(did + ".crypteedoc");
  docRef.getMetadata().then(function(metadata) {
    currentGeneration = metadata.generation;

    if (did !== "home") {
      catalog.docs[did].gen = currentGeneration;
      $(".doc[did='"+did+"']").attr("gen", currentGeneration / 1000);
      $(".doc[did='"+did+"']").find(".doctime").html("Seconds ago");
      $(".doc[did='"+did+"']").prependTo("#all-recent");
      var fid = fidOfDID(did);
      encryptTitle(did, JSON.stringify(activeDocTitle), function(encryptedTitle){
        encryptTags(did, tagsOfDoc, function(encryptedTagsArray) {
          var docData = { "generation" : currentGeneration, title : encryptedTitle, tags : encryptedTagsArray };
          foldersRef.child(fid + "/docs/" + did).update(docData, function(){
            saveComplete(did, callback, callbackParam);
          });
        });
      });
    } else {
      dataRef.update({"homegeneration" : currentGeneration}, function(){
        saveComplete(did, callback, callbackParam);
      });
    }



  }).catch(function(err) {
    console.log("can't get metadata", err);
  });
}

function saveComplete(did, callback, callbackParam){

  setTimeout(function () { $('#main-progress').attr("max", "100").attr("value", "100").removeClass("is-warning is-danger is-info").addClass("is-success"); }, 500);
  callback = callback || noop;
  lastSaved = (new Date()).getTime();
  idleTime = 0;
  docChanged = false;
  isSaving = false;
  isDocOutdated = false;

  $(".filesize-button > .button").removeClass("is-danger");
  $("#filesize").css("color", "#888");
  $("#filesize").css("cursor", "default");
  $(".filesize-button").prop('onclick',null).off('click');
  generateSections();

  offlineStorage.getItem(did).then(function (offlineDoc) {
    if (offlineDoc) {
      alsoSaveDocOffline(did, function(){
        callback(callbackParam);
      });
    } else {
      callback(callbackParam);
    }
  }).catch(function(err) {
    handleError(err);
  });
}







































////////////////////////
//    DELETE _DOC     //
////////////////////////

// $('.delete-doc-button').popup({
//   popup: '.delete-doc-popup',
//   on    : 'click',
//   transition : "fade down",
//   position    : 'bottom right',
//   variation : 'basic'
// });

function showDeleteDocModal() {
  $(".document-contextual-dropdown").removeClass("open");
  clearSelections();
  if (connectivityMode) {
    $("#delete-doc-modal").find(".delete-status").removeClass("is-light is-warning is-danger").addClass("is-warning").html("<p class='title'>Delete Document</p><p class='subtitle is-6'>You're about to delete this document</p>");
  } else {
    $("#delete-doc-modal").find(".delete-status").removeClass("is-light is-warning is-danger").addClass("is-warning").html("<p class='title'>Delete Document</p><p class='subtitle is-6'>You're about to delete the offline copy of this document. This will <b>not</b> delete the online copy of this document if there is any. You will need to delete the online copy separately.</p>");
  }
  $("#delete-doc-modal").addClass("is-active");
}

function hideDeleteDocModal() {
  $("#delete-doc-modal").removeClass("is-active");
}

$(".delete-doc-confirm").on('click', function(event) {
  event.preventDefault();
  if (connectivityMode) {
    deleteDoc(activeDocID);
  } else {
    deleteOfflineDoc(activeDocID);
  }
});

function deleteDoc (did){
  $("#delete-doc-modal").find(".delete-status").removeClass("is-light is-warning is-danger").addClass("is-light").html("<p class='title'>Deleting ...</p>");

  var fid = fidOfDID(did);
  var docRef = rootRef.child(did + ".crypteedoc");

  // Delete the file
  docRef.delete().then(function() {
    // File deleted successfully
  
    foldersRef.child(fid + "/docs/" + did).remove();
    hideDeleteDocModal();
    refreshFolderSort(fid);
  
  }).catch(function(error) {
    handleError(error);
    $("#delete-doc-modal").find(".delete-status").removeClass("is-light is-warning is-danger").addClass("is-danger").html("<p class='title'>Error Deleting Doc... Sorry.. Please Reload the page.</p>");
  });

}

function deleteDocComplete(fid, did, callback, callbackParam) {
  callback = callback || noop;

  removeDocFromDOM(did, fid);

  if (catalog.docs[did]) {
    if (catalog.docs[did].fid === fid) {
      // if doc didn't move, and it's ONLY deleted.
      delete catalog.docs[did];

      if ( did === activeFileID ) { hideFileViewer (); }
      if ( did === activeDocID ) { loadDoc("home"); }
    } else {
      // doc moved
    }
  } else {
    if ( did === activeFileID ) { hideFileViewer (); }
    if ( did === activeDocID ) { loadDoc("home"); }
  }
}

/////////////////////
//   MOVE _DOC  //
////////////////////

function moveDoc (fromFID, toFID, did, callback, callbackParam) {
  callback = callback || noop;
  if (fromFID && toFID && did) {
    if (fromFID === toFID) {
      callback(callbackParam);
    } else {
      foldersRef.child(fromFID + "/docs/" + did).once('value', function(snap)  {
        var theMovingDocsData = snap.val();
        theMovingDocsData.fid = toFID;

        foldersRef.child(toFID + "/docs/" + did).set( theMovingDocsData, function(error) {
          if ( !error ) {

            foldersRef.child(fromFID + "/docs/" + did).remove();

            refreshFolderSort(fromFID);
            callback(callbackParam);

            offlineStorage.getItem(did).then(function (offlineDoc) {
              if (offlineDoc) {
                var updatedDoc = offlineDoc;
                try {
                  // in case if JSON parse fails
                  updatedDoc.fname = JSON.parse(titleOf(toFID)) || "Inbox";
                } catch(e) {
                  updatedDoc.fname = titleOf(toFID) || "Inbox";
                }
                updatedDoc.fid = toFID;
                offlineStorage.setItem(did, updatedDoc).catch(function(err) {
                  handleError(err);
                });
              }
            }).catch(function(err) {
              handleError(err);
            });

          }
          else if( typeof(console) !== 'undefined' && console.error ) {  handleError(error); console.error(error); }
        });
      });
    } 
  }
}

$("#doc-dropdown").on('click', ".move-button", function(event) {
  var did = rightClickedID();
  if (!isDocSelected(did)) {
    selectDoc(did);
  }
  prepareMoveModal();
}); 

$("#selections-dropdown").on('click', ".move-button", function(event) {
  prepareMoveModal();
}); 

function prepareMoveModal() {
  // PREPARE THE MODAL. 
  $("#docs-move-folders-list").addClass("is-loading");
  $("#docs-move-folders-list").find("div").remove();
  
  $.each(catalog.folders, function(fid, folder){
    if (fid !== "f-uncat" && fid !== "undefined") {
      var ftitle = folder.name;
      $("#docs-move-folders-list").append('<div class="column move-folder is-half" fname="'+ftitle+'"><button fid="'+fid+'" class="button is-fullwidth docs-move-folders-list-item"><span class="icon is-small"><i class="fa fa-folder"></i></span><span>'+ftitle+'</span></button></div>');
    }
  });

  $('.move-folder').sort(function(a, b) {
    if ($(a).attr("fname").toLowerCase() < $(b).attr("fname").toLowerCase()) {
      return -1;
    } else {
      return 1;
    }
  }).appendTo('#docs-move-folders-list');

  $("#docs-move-folders-list").removeClass("is-loading");
  showModal("docs-move-selections-modal");
  hideRightClickMenu();
}

$("#docs-move-selections-modal").on('click', '.docs-move-folders-list-item', function(event) {
  event.preventDefault();
  $(".docs-move-folders-list-item.is-active").removeClass("is-active");
  $(this).addClass("is-active");
  $("#docs-move-selections-modal").find(".is-success").attr("disabled", false).prop("disabled", false);
});

var numDocsToMove = 0;
var numDocsMoved = 0
function moveFolderSelectionMade () {
  var toFID = $(".docs-move-folders-list-item.is-active").attr("fid");
  progressModal("docs-move-selections-modal");
  numDocsToMove = selectionArray.length;
  numDocsMoved = 0;
  setTimeout(function () {
    selectionArray.forEach(function(sel){
      var selID = sel.did;
      var fromFID = fidOfDID(selID);
      moveDoc(fromFID, toFID, selID, function(){
        numDocsMoved++;
        if (numDocsMoved >= numDocsToMove) {
          hideModal("docs-move-selections-modal");
          clearSelections();
        }
      });
    });
  }, 300);
}

/////////////////////
//   RENAME _DOC   //
/////////////////////

$("#doc-dropdown").on('click touchend', '.rename-button', function(event) {
  var did = rightClickedID();
  if (activeDocID === did) { showRenameDocModal(); }
  else { showRenameInactiveDocModal(did); }
  hideRightClickMenu();
});

function showRenameInactiveDocModal (did) {
  clearSelections();
  $("#rename-inactive-doc-modal").addClass("is-active");
  $("#inactive-doc-title-input").attr("did", did);
  var inactiveTitle = titleOf(did);
  $("#inactive-doc-title-input").val(inactiveTitle);
  $("#inactive-doc-title-input").attr("placeholder", inactiveTitle);
  setTimeout(function () { $("#inactive-doc-title-input").focus(); }, 10);
}

function hideRenameInactiveDocModal () {
  $(".rename-doc-status").removeClass("is-danger is-warning is-dark is-success").addClass("is-dark");
  $(".rename-doc-status > .title").html("Type in a new name below");
  $("#rename-inactive-doc-modal").removeClass("is-active");
  $("#inactive-doc-title-input").blur();
}

function renameInactiveDoc () {
  var inactiveDidToRename = $("#inactive-doc-title-input").attr("did");
  var theInput = $('#inactive-doc-title-input');
  var newDocName = $('#inactive-doc-title-input').val().trim();
  var oldDocName = $('#inactive-doc-title-input').attr("placeholder");
  var fid = fidOfDID(inactiveDidToRename);
  if (newDocName !== oldDocName) {
    $(".rename-doc-status").removeClass("is-danger is-warning is-dark is-success").addClass("is-warning");
    $(".rename-doc-status > .title").html("Renaming ... ");

    updateDocTitle (inactiveDidToRename, JSON.stringify(newDocName), function(){
      theInput.val(newDocName);
      theInput.attr("placeholder", newDocName);

      offlineStorage.getItem(inactiveDidToRename).then(function (offlineDoc) {
        if (offlineDoc) {
          var updatedDoc = offlineDoc;
          updatedDoc.name = newDocName;
          offlineStorage.setItem(inactiveDidToRename, updatedDoc).catch(function(err) {
            handleError(err);
          });
        }
      }).catch(function(err) {
        handleError(err);
      });

      updateDocTitleInDOM(inactiveDidToRename, newDocName);
      
      if (inactiveDidToRename === activeFileID) { $("#file-viewer-title").html(newDocName);}
      $(".rename-doc-status").removeClass("is-danger is-warning is-dark is-success").addClass("is-success");
      $(".rename-doc-status > .title").html("Done");
      setTimeout(function(){ hideRenameInactiveDocModal(); }, 1000);
    });

  } else{
    hideRenameDocModal();
  }

}

function hideRenameDocModal () {
  $(".rename-doc-status").removeClass("is-danger is-warning is-dark is-success").addClass("is-dark");
  $(".rename-doc-status > .title").html("Type in a new name below");
  $("#rename-doc-modal").removeClass("is-active");
  $("#active-doc-title-input").blur();
}

function showRenameDocModal () {
  $(".document-contextual-dropdown").removeClass("open");
  clearSelections();
  $("#rename-doc-modal").addClass("is-active");
  setTimeout(function () {
    $("#active-doc-title-input").focus();
  }, 10);
}

$('#active-doc-title-input').on('keydown', function(event) {
  setTimeout(function(){
    if (event.keyCode == 13) {
      renameDoc();
    } else if (event.keyCode == 27) {
       var oldDocName = $('#active-doc-title-input').attr("placeholder");
       $('#active-doc-title-input').val(oldDocName);
       hideRenameDocModal();
    }
  },50);
});

$('#inactive-doc-title-input').on('keydown', function(event) {
  setTimeout(function(){
    if (event.keyCode == 13) {
      renameInactiveDoc ();
    } else if (event.keyCode == 27) {
       var oldDocName = $('#inactive-doc-title-input').attr("placeholder");
       $('#inactive-doc-title-input').val(oldDocName);
       hideRenameInactiveDocModal ();
    }
  },50);
});

function renameDoc () {

  var theInput = $('#active-doc-title-input');
  var newDocName = theInput.val().trim();
  var oldDocName = theInput.attr("placeholder");

  if (newDocName !== oldDocName) {
    $(".rename-doc-status").removeClass("is-danger is-warning is-dark is-success").addClass("is-warning");
    $(".rename-doc-status > .title").html("Renaming ... ");

    // if (connectivityMode) {
      // RENAME ONLINE
      updateDocTitle(activeDocID, JSON.stringify(newDocName), function(){
        document.title = newDocName;
        theInput.val(newDocName);
        theInput.attr("placeholder", newDocName);
        activeDocTitle = newDocName;

        offlineStorage.getItem(activeDocID).then(function (offlineDoc) {
          if (offlineDoc) {
            var updatedDoc = offlineDoc;
            updatedDoc.name = newDocName;
            offlineStorage.setItem(activeDocID, updatedDoc).catch(function(err) {
              handleError(err);
            });
          }
        }).catch(function(err) {
          handleError(err);
        });

        updateDocTitleInDOM(activeDocID, newDocName);
        
        $(".rename-doc-status").removeClass("is-danger is-warning is-dark is-success").addClass("is-success");
        $(".rename-doc-status > .title").html("Done");
        setTimeout(function(){
          hideRenameDocModal();
        }, 1000);
      });
    // } else {
    //   // RENAME OFFLINE
    //   renameOfflineDoc(newDocName);
    // }


  } else{
    hideRenameDocModal();
  }
}



/////////////////////
//   SELECT _DOC  //
////////////////////


function showFileDownloadStatus(color, message) {
  $(".download-status-message").html(message);
  $("#file-download-status").removeClass("is-dark is-light is-warning is-danger is-success").addClass(color);
  $("#file-download-status").addClass("showUploadStatus");
}

function hideFileDownloadStatus() {
  $("#file-download-status").removeClass("is-dark is-light is-warning is-danger is-success").addClass("is-light");
  $("#file-download-status").removeClass("showUploadStatus");
}




var selectedFiles = 0;
var selectedDocs = 0;
var selectionArray = [];

function clearSelections () {
  $(".doc.selected").removeClass("selected");
  selectedFiles = 0;
  selectedDocs = 0;
  selectionArray = [];
  toggleSelectionActions();
}

function toggleSelectionActions () {
  if (selectedFiles > 0 || selectedDocs > 0) {
    $("#selections-wrapper").addClass("shown");
    $(".number-of-selections").html(selectionArray.length);
  } else {
    $("#selections-wrapper").removeClass("shown");
    //for ux we change the number slightly late if it's 0;
    setTimeout(function () { $(".number-of-selections").html(selectionArray.length); }, 500);
  }
  
  
}

function isDocSelected(did) {
  var selected = false;
  
  selectionArray.forEach(function(selection){
    if (selection.did === did) {
      selected = true;
    }
  });

  return selected;
}

function toggleDocSelection(did) {
  if (did) {
    var selected = isDocSelected(did);
    
    if (did !== activeDocID) { 
      if (!selected) {
        // doc wasn't selected. now select it.
        selectDoc(did);
      } else {
        // doc was selected. unselect it. 
        unselectDoc(did);
      }
    }
  }
}

function selectDoc (did) {
  if (did !== activeDocID) { 
    var doc = catalog.docs[did];
    var docElem = $(".doc[did='" + did + "']");
    var dtitle = titleOf(did);
    var itsAFile = doc.isfile || false;
    var itsADoc = !doc.isfile || true;

    if (itsAFile) { selectedFiles++; } else { selectedDocs++; }
    selectionArray.push({ did : did , dtitle : dtitle , itsADoc : itsADoc , itsAFile : itsAFile});
    docElem.addClass("selected");
    toggleSelectionActions();
  }
}

function unselectDoc (did) {
  var doc = catalog.docs[did];
  var docElem = $(".doc[did='" + did + "']");
  var itsAFile = doc.isfile || false;

  if (itsAFile) { selectedFiles--; } else { selectedDocs--; }
  removeByAttr(selectionArray, "did", did);
  docElem.removeClass("selected");
  toggleSelectionActions();
}

$('#selection-download-button').on('click', function(event) {
  downloadSelections();
  hideRightClickMenu();
});

$('#selection-cancel-button').on('click', function(event) {
  clearSelections();
  hideRightClickMenu();
});


var completedDownloads = 0;
var completedDeletions = 0;
function downloadSelections () {
  completedDownloads = 0;
  showFileDownloadStatus("is-light", '<span class="icon is-small"><i class="fa fa-fw fa-circle-o-notch fa-spin"></i></span> &nbsp; <b>Decrypting &amp; Downloading</b><br>Please <b>do not</b> close this window until all downloads are complete.');
  $("#selection-download-button > i").removeClass("fa-download").addClass("fa-circle-o-notch fa-spin");
  $.each(selectionArray, function(index, selection) {
    $("#file-download-status").append("<br><span id='dld-" + selection.did + "'>" + selection.dtitle + "</span>");
    var preview = false;
    downloadFile(selection.did, selection.dtitle, preview, areDownloadsComplete, selection.did);
  });
}

function areDownloadsComplete (did) {
  completedDownloads++;
  $("#dld-"+did).remove();
  if (selectionArray.length === completedDownloads) {
    downloadsComplete();
  }
}

function downloadsComplete () {
  hideWindowProgress();
  hideFileDownloadStatus();
  $("#selection-download-button > i").removeClass("fa-circle-o-notch fa-spin").addClass("fa-download");
  clearSelections();
}


var floatDelete = false;
$("#doc-dropdown").on('click touchend', '.delete-button', function(event) {
  
  var did = rightClickedID();
  if (activeDocID === did) { showDeleteDocModal(); }
  else {
    catalog.docs[did] = catalog.docs[did] || {};
    var dtitle = titleOf(did);
    var itsAFile = catalog.docs[did].isfile || false;
    var itsADoc = !catalog.docs[did].isfile || true;

    if (did !== activeDocID) {

      if (itsAFile) {
        selectedFiles++;
      } else {
        selectedDocs++;
      }

      selectionArray.push({ did : did , dtitle : dtitle , itsADoc : itsADoc , itsAFile : itsAFile});
      toggleSelectionActions();
    }

    floatDelete = true;
    showDeleteSelectionsModal();
    hideRightClickMenu();
  }
});


$("#doc-dropdown").on('click touchend', '.download-button', function(event) {
  catalog.docs[did] = catalog.docs[did] || {};
  var did = rightClickedID();
  var dtitle = titleOf(did);
  var itsAFile = catalog.docs[did].isfile || false;
  var itsADoc = !catalog.docs[did].isfile || true;

  if (itsAFile) {
    showWindowProgress();
    selectedFiles++;
    selectionArray.push({ did : did , dtitle : dtitle , itsADoc : itsADoc , itsAFile : itsAFile});
    toggleSelectionActions();
    downloadSelections();
    hideRightClickMenu();
  }

});


function hideDeleteSelectionsModal () {
  $("#delete-selections-modal").find(".button").removeClass("is-loading").prop("disabled", false).attr("disabled", false);
  $('#delete-selections-modal').removeClass("is-active");
  if (floatDelete) { clearSelections(); floatDelete = false; }
}

$('#selection-delete-button').on('click', function(event) {
  showDeleteSelectionsModal();
});

function showDeleteSelectionsModal () {
  $(".documents-to-be-deleted").html("");
  $.each(selectionArray, function(index, selection) {
    if (index < selectionArray.length - 1) {
      $(".documents-to-be-deleted").append(selection.dtitle + ", ");
    } else {
      $(".documents-to-be-deleted").append(selection.dtitle);
    }
  });
  $('#delete-selections-modal').addClass("is-active");
}

function deleteSelections () {
  $("#delete-selections-modal").find(".button").addClass("is-loading").prop("disabled", true).attr("disabled", true);
  completedDeletions = 0;
  $.each(selectionArray, function(index, selection) {

    if (connectivityMode) { 

      var fid = fidOfDID(selection.did);
      if (selection.did === activeFileID) {
        hideFileViewer ();
      }

      var deletionRef;
      if (selection.itsADoc) {
        deletionRef = rootRef.child(selection.did + ".crypteedoc");
      }

      if (selection.itsAFile) {
        deletionRef = rootRef.child(selection.did + ".crypteefile");
      }

      deletionRef.delete().then(function() {   
        foldersRef.child(fid + "/docs/" + selection.did).remove();
        areDeletionsComplete(selection.did, fid);
      }).catch(function(error) {
        handleError(error);
        $(".delete-selections-status").removeClass("is-light is-warning is-danger").addClass("is-danger").html("<p class='title'>Error Deleting Doc... Sorry.. Please Reload the page.</p>");
      });
      
    } else {
      deleteOfflineDoc(selection.did);
    }

  });

  if (!connectivityMode) {
    hideDeleteSelectionsModal();
    clearSelections();
  }
}

function areDeletionsComplete (did, fid) {
  completedDeletions++;
  delete catalog.docs[did];
  removeDocFromDOM(did);
  offlineStorage.removeItem(did).catch(function(err) {
    handleError(err);
  });
  if (selectionArray.length === completedDeletions) {
    hideDeleteSelectionsModal();
    clearSelections();
  }
}

$("#selections-wrapper").on('click', function(event) {
  var eventToPass = event;
  event.pageX = 8;
  event.pageY = 248;
  showRightClickMenu("#selections-dropdown",eventToPass);
});

///////////////////////////////////////////////////
////////////////// FILE UPLOAD ////////////////////
///////////////////////////////////////////////////

function showFileUploadStatus(color, message) {
  if (color === "is-danger") { $("body").removeClass("disable-clicks"); }
  $("#file-upload-progress").attr("value", "0");
  $(".upload-status-message").html(message);
  $("#file-upload-status").removeClass("is-dark is-light is-warning is-danger is-success").addClass(color);
  $("#file-upload-status").addClass("showUploadStatus");
}

function hideFileUploadStatus() {
  $("#file-upload-status").removeClass("is-dark is-light is-warning is-danger is-success").addClass("is-light");
  $("#file-upload-status").removeClass("showUploadStatus");
}

window.addEventListener('dragenter', handleDragEnter, false);
window.addEventListener('dragend', handleDragEnd, false);
window.addEventListener('dragleave', handleDragLeave, false);
window.addEventListener('dragover', handleDragOver, false);
document.getElementById('docs-page-wrap').addEventListener('drop', handleAttachmentDrop, false);

function isAPIAvailable() {
  // Check for the various File API support.
  if (window.File && window.FileReader && window.FileList && window.Blob) {
    // Great success! All the File APIs are supported.
    return true;
  } else {
    return false;
  }
}

function handleAttachmentDrop(evt) {
  evt.stopPropagation();
  evt.preventDefault();

  if (isAPIAvailable()) {
    if (connectivityMode) {
      var files = evt.dataTransfer.files;

      for (var i = 0; i < files.length; i++) {
        var file = files[i];
        var filename = files[i].name + ""; // this is to make sure it's a string, even if it receives a number for some random reason.
        var extension = filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
        if (extension.match(/^(JPEG|JPG|PNG|GIF)$/i)) {
          embedDroppedImage(file);
        } else {
          embedDroppedAttachment(file);
        }
      }
    } else {
      showFileUploadStatus("is-danger", "Unfortunately this feature is only available when you're online.");
    }
  } else {
    showFileUploadStatus("is-danger", "Unfortunately your browser or device does not support File API, which is what allows us to encrypt files on your device. Therefore we can't upload your file.");
  }
}

function handleFileDrop(evt) {
  evt.stopPropagation();
  evt.preventDefault();

  dragCounter = 0;
  somethingDropped = true;

  var targetFolder = $(evt.target).parents(".afolder");
  targetFolder.removeClass("fileDropFolder");
  var targetfid = targetFolder.attr("id");

  if (isAPIAvailable()) {

    if (connectivityMode) {

      var files = evt.dataTransfer.files;

      numFilesLeftToBeUploaded = 0;
      fileUploadError = false;

      for (var i = 0; i < files.length; i++) {
        processDroppedFile(files[i], targetfid);
        numFilesLeftToBeUploaded++;
      }

      if (numFilesLeftToBeUploaded > 0) {
        var processingMessage = "Processing <b>" + numFilesLeftToBeUploaded.toString() + "</b> file(s)";
        showFileUploadStatus("is-light", processingMessage);
      }

    } else {
      showFileUploadStatus("is-danger", "Unfortunately this feature is only available when you're online.");
    }
  } else {
    showFileUploadStatus("is-danger", "Unfortunately your browser or device does not support File API, which is what allows us to encrypt files on your device. Therefore we can't upload your file.");
  }

}

function handleFileSelect(evt) {
  evt.stopPropagation();
  evt.preventDefault();

  dragCounter = 0;
  somethingDropped = true;

  var targetFolder = $(evt.target).parents(".afolder");
  targetFolder.removeClass("fileDropFolder");
  var targetfid = targetFolder.attr("id");

  if (isAPIAvailable()) {

    if (connectivityMode) {

      var files = evt.target.files;

      numFilesLeftToBeUploaded = 0;
      fileUploadError = false;

      for (var i = 0; i < files.length; i++) {
        processDroppedFile(files[i], targetfid);
        numFilesLeftToBeUploaded++;
      }

      if (numFilesLeftToBeUploaded > 0) {
        var processingMessage = "Processing <b>" + numFilesLeftToBeUploaded.toString() + "</b> file(s)";
        showFileUploadStatus("is-light", processingMessage);
      }

    } else {
      showFileUploadStatus("is-danger", "Unfortunately this feature is only available when you're online.");
    }

  } else {
    setTimeout(function () {
      showFileUploadStatus("is-danger", "Unfortunately your browser or device does not support File API, which is what allows us to encrypt files on your device. Therefore we can't upload your file.");
    }, 10000);
  }
}


var dragCounter = 0;
var menuBeforeDrag;

function handleDragEnter(evt) {
  if (dragCounter === 0) {
    if (connectivityMode) {
      $(".showRight").removeClass("showRight");
      if ($(".showLeft").length === 0) {
        // MENU WAS OFF SO SHOW IT
        menuBeforeDrag = false;
        showMenu();
      } else {
        menuBeforeDrag = true;
      }
      $("#folders-button").click();
    }
  }

  dragCounter++;

  evt.stopPropagation();
  evt.preventDefault();
  var afolder = $(".afolder");
  if (afolder.has(evt.target).length !== 0) {
    var targetFolder = $(evt.target).parents(".afolder");
    targetFolder.removeClass("fileDropFolder");
  }
}

function handleDragLeave(evt) {
  dragCounter--;
  if (dragCounter === 0) {
    if (connectivityMode) {
      if (!menuBeforeDrag) {
        hideMenu();
        menuBeforeDrag = false;
      }
    }
  }

  evt.stopPropagation();
  evt.preventDefault();
  var afolder = $(".afolder");
  if (afolder.has(evt.target).length !== 0) {
    var targetFolder = $(evt.target).parents(".afolder");
    targetFolder.removeClass("fileDropFolder");
  }
}


function handleDragEnd(evt) {
  evt.stopPropagation();
  evt.preventDefault();
  var afolder = $(".afolder");
  if (afolder.has(evt.target).length !== 0) {
    var targetFolder = $(evt.target).parents(".afolder");
    targetFolder.removeClass("fileDropFolder");
  }
}

function handleDragOver(evt) {
  evt.stopPropagation();
  evt.preventDefault();
  evt.dataTransfer.dropEffect = 'copy';
  var afolder = $(".afolder");
  if (afolder.has(evt.target).length !== 0) {
    var targetFolder = $(evt.target).parents(".afolder");
    targetFolder.addClass("fileDropFolder");
  }
}

function showFileUploadInfo(evt) {
  dragCounter = 0;
  var afolder = $(".afolder");
  if (afolder.has(evt.target).length === 0) {
    evt.stopPropagation();
    evt.preventDefault();

    if ($(".afolder").length > 0) {
      $('.afolder').addClass("fileDropFolder");

      showFileUploadStatus("is-info", "You can drop files onto your folders to upload.");
      setTimeout(function () {
        hideFileUploadStatus();
      }, 3000);

      setTimeout(function () {
        $('.afolder').removeClass("fileDropFolder");
      }, 250);
      setTimeout(function () {
        $('.afolder').addClass("fileDropFolder");
      }, 500);
      setTimeout(function () {
        $('.afolder').removeClass("fileDropFolder");
      }, 750);

    } else {
      showFileUploadStatus("is-info", "Once you create folders, you can drag and drop your files onto them to upload.");
      setTimeout(function () {
        hideFileUploadStatus();
      }, 3000);
    }
  }
}

function processDroppedFile (file, fid, callback, callbackParam) {
  callback = callback || noop;

  var reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onloadend = function(){
    var base64FileContents = reader.result;

    try {
      var filename = file.name;
      var filesize = file.size;

      //THIS LINE IS TO MAKE SURE FILE HAS SOME CONTENTS AND MAKE THIS "TRY" FAIL IF IT'S EMPTY, LIKE WHEN IT IS A FOLDER.
      var fileContents = base64FileContents.substr(base64FileContents.indexOf(',')+1);
      //

      encryptAndUploadFile(base64FileContents, fid, filename, callback, callbackParam);

      var processingMessage = "Encrypting <b>" + numFilesLeftToBeUploaded.toString() + "</b> file(s)";
      showFileUploadStatus("is-light", processingMessage);
    } catch (e) {
      fileUploadError = true;
      showFileUploadStatus("is-danger", "Error. You have tried uploading an <b>empty file</b> or <b>folder</b>. Currently we intentionally do not to support uploading folders or its contents as they can reveal identifiable information about your computer. We suggest that you compress folders before uploading instead. We know this is a major inconvenience, and we're working on finding a solution. <b>If you have selected any files that are not in folders, those are being uploaded.</b>");
    }

  };
  reader.onerror = function(err){
    fileUploadError = true;
    // handleError(err); // this is not helping anything and only causing anxiety disorder.
    showFileUploadStatus("is-danger", "Error. Seems like we're having trouble reading your file. This is most likely a problem we need to fix, and rest assured we will.");
  };
}

function encryptAndUploadFile(fileContents, fid, filename, callback, callbackParam) {
  callback = callback || noop;

  var did = "d-" + newUUID();
  var docRef = rootRef.child(did + ".crypteefile");
  var totalBytes;
  var plaintextFileContents = fileContents;
  encrypt(plaintextFileContents, [theKey]).then(function(ciphertext) {
      var encryptedTextFile = JSON.stringify(ciphertext);
      var fileUpload = docRef.putString(encryptedTextFile);
      fileUpload.on('state_changed', function(snapshot){
        if (!fileUploadError) {
          var processingMessage = "Uploading file(s)";
          showFileUploadStatus("is-light", processingMessage);
        }

        if ($('#upload-' + did).length === 0) {
          var uploadElem =
          '<div class="upload" id="upload-'+did+'">'+
            '<progress class="progress is-small" value="'+snapshot.bytesTransferred+'" max="'+snapshot.totalBytes+'"></progress>'+
            '<p class="deets fn">'+filename+'</p>'+
            '<p class="deets fs">('+formatBytes(snapshot.bytesTransferred) + "/" + formatBytes(snapshot.totalBytes)+')</p>'+
          '</div>';
          $("#upload-status-contents").append(uploadElem);
        } else {
          $("#upload-"+did).find("progress").attr("value", snapshot.bytesTransferred);
          $("#upload-"+did).find(".fs").html("("+formatBytes(snapshot.bytesTransferred) + "/" + formatBytes(snapshot.totalBytes)+")");
        }

        lastActivityTime = (new Date()).getTime();
        switch (snapshot.state) { case firebase.storage.TaskState.PAUSED: break; case firebase.storage.TaskState.RUNNING: break; }
        // if (snapshot.bytesTransferred === snapshot.totalBytes) {
        //   $("#upload-"+did).remove();
        //   fileUploadComplete(fid, did, filename, callback, callbackParam);
        // }
      }, function(error) {
        if (usedStorage >= allowedStorage) {
          showFileUploadStatus("is-danger", "Error uploading your file(s). Looks like you've already ran out of storage. Please consider upgrading or deleting something else.<br><br><a class='button is-light' onclick='hideFileUploadStatus();'>Close</a>");
          exceededStorage(callback, callbackParam);
        } else {
          handleError(error);
          var uploadElem =
          '<div class="upload" id="upload-'+did+'">'+
            '<progress class="progress is-small is-danger" value="100" max="100"></progress>'+
            '<p class="deets"><b class="fn">'+filename+'</b> (<span class="fs">Error</span>)</p>'+
          '</div>';
          $("#upload-status-contents").append(uploadElem);
        }
      }, function (){
        // upload complete
        $("#upload-"+did).remove();
        fileUploadComplete(fid, did, filename, callback, callbackParam);
      });
  });
}

var uploadCompleteTimeout;
function fileUploadComplete(fidToUpdateInDB, did, filename, callback, callbackParam) {
  numFilesLeftToBeUploaded--;

  callback = callback || noop;
  callbackParam = callbackParam || did;

  function saveToDB(fid) {
    encryptTitle(did, JSON.stringify(filename), function(encryptedTitle){
      var docData = { docid : did, fid : fid, isfile : true, title : encryptedTitle };
      
      foldersRef.child(fid + "/docs/" + did).update(docData, function(){
        gotEncryptedDocTitle(did, encryptedTitle);

        // if there's no queue, this should go through since it'll be smaller than 0
        // if there's a queue, this will wait until the queue is complete.

        clearTimeout(uploadCompleteTimeout);
        if (numFilesLeftToBeUploaded <= 0) {
          // to assure this remains as 0 even if it's a queue upload
          numFilesLeftToBeUploaded = 0;

          refreshFolderSort (fid);
          showFileUploadStatus("is-light", "Processing Uploads");
          uploadCompleteTimeout = setTimeout(function () {
            // to buffer for the time in between items getting added to queue.
            hideFileUploadStatus();
          }, 2500);
        }

        // if there's a queue, proceed with the next one in queue
        if (activeUploadsInQueue > 0) {
          activeUploadsInQueue--;
          setTimeout(function () {
            // this is to not overwhelm the database, and give time
            // for things to sync back to client
            // (like files appearing -syncing back- into the list of folders etc.)
            nextInQueue();
          }, 930);

          // this is intentionally 930 not 1 second to make sure it doesn't overlap with previous timeout easily.
          // there's no race condition, but it's just a cosmetics thing.

        } else {
          // to assure this remains as 0 even if queue goes negative for some reason
          activeUploadsInQueue = 0;
        }

        callback(callbackParam);
      });
      
    });
  }

  if (fidToUpdateInDB !== undefined && fidToUpdateInDB !== null && fidToUpdateInDB !== "") {
    saveToDB(fidToUpdateInDB);
  } else {
    newFolder(function(newFolderFID){
      saveToDB(newFolderFID);
    });
  }
}


var uploadQueue = [];
var startQueueTimeout;
var activeUploadsInQueue = 0;
var maxItemsInQueue = 4;
function queueFileForEncryptAndUpload (base64FileContents, fid, filename, callback, callbackParam) {

  uploadQueue.push({
    data : base64FileContents,
    fid : fid,
    name : filename,
    cb : callback,
    cbp : callbackParam,
    processed : false
  });

  clearTimeout(startQueueTimeout);
  startQueueTimeout = setTimeout(function () {
    console.info("Starting upload queue");
    nextInQueue ();
  }, 500);
}

function nextInQueue () {
  uploadQueue.forEach(function(upload, index) {
    if ( !upload.processed && (activeUploadsInQueue < maxItemsInQueue) ) {
      uploadQueue[index].processed = true;
      activeUploadsInQueue++;
      numFilesLeftToBeUploaded++;
      encryptAndUploadFile(upload.data, upload.fid, upload.name, upload.cb, upload.cbp);
    }
  });
}













///////////////////////////////////////////////////
////////////////// SEARCH /////////////////////////
///////////////////////////////////////////////////

var currentResultSelection = 0;

var searchOptions = {
  shouldSort: true,
  threshold: 0.4,
  location: 0,
  distance: 100,
  maxPatternLength: 32,
  minMatchCharLength: 1,
  includeMatches: true,
  keys: [ "ftype", "name", "fname", "ftype", "tags"  ]
};

$("#search-input").on("keydown", function(event) {
  // ios 11 compatiblity. we can't trigger shit with keyup and keydown fires before character is in input.
  setTimeout(function(){

    if (event.keyCode === 27) {
      event.preventDefault();
      clearSearch();
    } else if (event.keyCode === 38) {
      event.preventDefault();
      moveSearchUp();
    } else if (event.keyCode === 40) {
      event.preventDefault();
      moveSearchDown();
    } else if (event.keyCode === 8 && $("#search-input").val().trim() === "") {
      event.preventDefault();
      clearSearch();
    } else if (event.keyCode === 13) {
      event.preventDefault();
      if ($( ".highlightedResult" ).length > 0) {
          // open selection.
          var didToLoad = $( ".highlightedResult" ).attr("did");
          var activeDID = activeDocID;
          if ((didToLoad !== activeDID) && (typeof didToLoad != 'undefined')) {
            clearSearch();
            currentResultSelection = 0;
            saveDoc(loadDoc, didToLoad);
          }
      }
    } else {
      currentResultSelection = 0;
      search($("#search-input").val().trim());
    }

    if ($("#search-input").val().trim() === "") {
      clearSearch();
    }
  }, 50);
});

function search (term){
  $("#search-button-icon").addClass("fa-close").removeClass("fa-search");
  var fuse = new Fuse(Object.values(catalog.docs), searchOptions);
  var results = fuse.search(term);
  displaySearchResults(results, term);
}

function clearSearch () {
  $("#search-button-icon").removeClass("fa-close").addClass("fa-search");
  $("#results").html("");
  $("#search-input").val("");
  $("#results").hide();
  currentResultSelection = 0;
}

function displaySearchResults (results, term) {
  $("#results").html("");
  $("#results").show();

  $.each(results, function(i, rslt) {
    var result = rslt.item;
    var match = "";
    var matchedTag = false;
    var resultTitle = result.name;
    if (resultTitle) {
      $.each(rslt.matches, function(i, mtch) {
        if (mtch.key === "fname") {
          match = match + '<p class="tag is-white result-folder"><span class="icon"><i class="fa fa-folder" style="color:'+result.fcolor+'"></i></span> '+result.fname+'</p>';
        }

        if (mtch.key === "tags") {
          if (!matchedTag) {
            $.each(result.tags, function(i, tag) {
              match = match + '<p class="tag is-white result-folder"><span class="icon"><i class="fa fa-tag"></i></span>'+tag+'</p>';
            });
          }
          matchedTag = true;
        }

        if (mtch.key === "name") {
          var pair = mtch.indices.shift();
          var resultname = [];
          // Build the formatted string
          for (var j = 0; j < resultTitle.length; j++) {
            var char = resultTitle.charAt(j);
            if (pair && j == pair[0]) {
              resultname.push('<u>');
            }
            resultname.push(char);
            if (pair && j == pair[1]) {
              resultname.push('</u>');
              pair = mtch.indices.shift();
            }
          }
          resultTitle = resultname.join('');
        }
      });
      var resultCard = 
      '<div class="notification doc search-result" did="'+result.did+'">'+
        '<span class="icon result-icon"><i class="'+result.icon+'"></i></span>'+
        '<p class="result-title">'+resultTitle+'</p>'+
        '<span class="result-tag">'+ match +'</span>'+
      '</div>';
      $("#results").append(resultCard);
    }
  });
}

function moveSearchUp () {

  if (currentResultSelection === 0) {
    $( ".search-result" ).first().removeClass('is-dark highlightedResult');
  } else {
    $( ".highlightedResult" ).removeClass('is-dark highlightedResult').prev().addClass('is-dark highlightedResult');
    currentResultSelection--;
  }
}

function moveSearchDown () {
  if (currentResultSelection === 0) {
    $( ".search-result" ).first().addClass('is-dark highlightedResult');
    currentResultSelection++;
  } else {
    $( ".highlightedResult" ).removeClass('is-dark highlightedResult').next().addClass('is-dark highlightedResult');
    currentResultSelection++;
  }
}

$("#search-button-icon").on('click', function(event) {
  if (isMobile) {
    showMenu();
  }
  $("#search-input").focus();
}); 

///////////////////////////////////////////////////
////////////////// SETTINGS ///////////////////////
///////////////////////////////////////////////////

$("#settings-button").on('click', function(event) {
  event.preventDefault();
  showDocProgress("Saving your doc, will open the account settings shortly.");
  saveDoc(openSettings);
});

function openSettings (){
  window.location = 'account';
}

function openSettingsUpgrade (){
  window.location = 'account?action=upgrade';
}

///////////////////////////////////////////////////
//////////////////  UPGRADE ///////////////////////
///////////////////////////////////////////////////

$("#upgrade-badge").on('click', function(event) {
  if (connectivityMode) {
    saveDoc(openSettingsUpgrade);
  } else {
    saveOfflineDoc(openSettingsUpgrade);
  }
});

////






///////////////////////////////////////////////////////////
////////////////// STORAGE HELPERS ///////////////////////
//////////////////////////////////////////////////////////

function exceededStorage(callback, callbackParam) {
  getToken();
  if (!huaExceededStorage) {
    $("#exceeded-modal").addClass("is-active");
  }
}

function closeExceededStorageModal () {
  $("#exceeded-modal").removeClass("is-active");
  huaExceededStorage = true;
}

function howMuchStorageLeft() {
  if (allowedStorage > usedStorage) {
    bytesLeft = allowedStorage - usedStorage;
    storageLeft = formatBytes(bytesLeft);
    return storageLeft;
  } else {
    bytesLeft = allowedStorage - usedStorage;
    storageLeft = "-" + formatBytes(Math.abs(bytesLeft));
    return storageLeft;
  }
}

$("#low-storage-warning > .notification > .delete").on('click', function(event) {
  $("#low-storage-warning").removeClass('showLowStorage viaUpgradeButton');
  huaLowStorage = true;
});




///////////////////////////////////////////////////////////
////////////////// HELP BUTTON ///////////////////////
//////////////////////////////////////////////////////////

$('#help').on('click', function(event) {
  event.preventDefault();
  if (!isInWebAppiOS) {
    var win = window.open("https://cryptee.kayako.com", '_blank');
    if (win) { win.focus(); }
  } else {
    var urlToPass = "https://cryptee.kayako.com";
    var downloadFrame = document.getElementById('downloadFrame');
    var iframeDoc = downloadFrame.contentDocument || downloadFrame.contentWindow.document;
    var a = iframeDoc.createElement('a');
    a.setAttribute("href", urlToPass);
    a.setAttribute("target", "_blank");
    var dispatch = iframeDoc.createEvent("HTMLEvents");
    dispatch.initEvent("click", true, true);
    a.dispatchEvent(dispatch);
  }
});







///////////////////////////////////////////////////////////
////////////////// EXPORT DOCUMENT  ///////////////////////
///////////////////////////////////////////////////////////

function showExportDocModal() {
  $(".document-contextual-dropdown").removeClass("open");
  $("#export-doc-modal").addClass("is-active");
}

function hideExportDocModal() {
  $("#export-doc-modal").removeClass("is-active");
}

$('#export-currentdoc-as-pdf-A4').on('click', function(event) {
  exportAsPDF(activeDocID, "a4");
});

$('#export-currentdoc-as-pdf-USL').on('click', function(event) {
  exportAsPDF(activeDocID, "letter");
});

$('#export-currentdoc-as-html').on('click', function(event) {
  exportAsHTML(activeDocID);
});

$("export-currentdoc-as-crypteedoc").on('click', function(event) {
  exportAsCrypteedoc(activeDocID);
});

if (window.print) {
  setSentryTag("printing", "yes");
  $('#print-currentdoc').show();
} else {
  setSentryTag("printing", "no");
  $('#print-currentdoc').hide();
}

$('#print-currentdoc').on('click', function(event) {
  hideExportDocModal();
  if (window.print) {
    print();
  }
});
	
function exportAsPDF(did, pagesize) {
  $('.pdf-export-icon').removeClass("fa-file-pdf-o").addClass("fa-spinner fa-spin");
  if (did === activeDocID) {
    var element = $(".ql-editor").get()[0];
    html2pdf(element, {
      margin:       1,
      filename:     activeDocTitle + ".pdf",
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { dpi: 300, letterRendering: true },
      jsPDF:        { unit: 'in', format: pagesize, orientation: 'portrait' }
    }, function(){
      $('.pdf-export-icon').removeClass("fa-spinner fa-spin").addClass("fa-file-pdf-o");
    });
  }
}

function exportAsRTF(did) {
  if (did === activeDocID) {
    var element = $(".ql-editor").html();
    var contents = html2rtf(element);
    var title = activeDocTitle + ".rtf";
    var blob = new Blob([contents], {type: "text/rtf;charset=utf-8"});
    saveAs(blob, title);
    hideExportDocModal();
  }
}

function exportAsHTML(did) {
  if (did === activeDocID) {
    var contents = $(".ql-editor").html();
    var title = activeDocTitle + ".html";
    var blob = new Blob([contents], {type: "text/html;charset=utf-8"});
    saveAs(blob, title);
    hideExportDocModal();
  }
}


// currently android only due to how the saveAs mechanism works.
// since we can't pass the encrypted file / Blob to a Safari browser
// this is the only way. Maybe when the Share API is implemented we can use that in iOS.

function exportActiveDocAsCrypteedoc() {
  hideExportDocModal();
  exportAsCrypteedoc(activeDocID);
}

function exportAsCrypteedoc(did) {
  if (did === activeDocID) {
    $("#crypteedoc-modal-decrypt-button").find("i").removeClass("fa-lock").addClass("fa-cog fa-spin");

    var plaintextDocDelta = JSON.stringify(quill.getContents());
    var keyToUseForEncryption = $("#crypteedoc-export-key-input").val().trim();
    encrypt(plaintextDocDelta, [keyToUseForEncryption]).then(function(ciphertext) {
      var encryptedDocDelta = JSON.stringify(ciphertext);

      var title = activeDocTitle + ".ecd";
      var blob = new Blob([encryptedDocDelta], {type: "application/json;charset=utf-8"});
      saveAs(blob, title);
      $("#crypteedoc-modal-decrypt-button").find("i").removeClass("fa-cog fa-spin").addClass("fa-lock");
      hideModal("crypteedoc-export-modal");
      $("#crypteedoc-export-key-input").val("");
    });
  }
}


///////////////////////////////////////////////////////////
////////////////// QUILL EMBED CONTROLLER  ////////////////
///////////////////////////////////////////////////////////

var activeEmbed, embedRange;
function showEmbed(embed) {
  embedRange = quill.getSelection();
  activeEmbed = embed;
  var modalTitle, placeholder;
  if (embed === "formula"){
    modalTitle = "Add Formula";
    placeholder = "e=mc^2";
    $("#embed-input").val("");
  } else if (embed === "link") {
    modalTitle = "Enter Link";
    var curUrl = $("#docs-url-box").find("a").attr("href").trim();
    if (curUrl !== "") {
      placeholder = curUrl;
      $("#embed-input").val(curUrl);
    } else {
      placeholder = "https://crypt.ee";
      $("#embed-input").val("");
    }
  } else if (embed === "video") {
    modalTitle = "Enter Video URL";
    placeholder = "https://www.youtube.com/embed/dQw4w9WgXcQ";
    $("#embed-input").val("");
  }
  $("#embed-modal").find(".title").html(modalTitle);
  $("#embed-input").attr("placeholder", placeholder);
  $("#embed-modal").addClass("is-active");
  setTimeout(function () {
    $("#embed-input").focus();
  }, 50);
}

function confirmEmbed() {
  if (activeEmbed === "formula"){
    quill.insertEmbed(embedRange.index, 'formula', $("#embed-input").val());
  } else if (activeEmbed === "link") {
    quill.format('link', $("#embed-input").val());
  } else if (activeEmbed === "video") {
    quill.insertEmbed(embedRange.index, 'video', $("#embed-input").val());
  }
  hideEmbed();
}

function hideEmbed() {
  $("#embed-modal").removeClass("is-active");
  quill.focus();
}

$("#embed-input").on('keydown', function (e) {
  setTimeout(function(){
    if (e.keyCode === 13 && $("#embed-input").val().trim() !== "") { confirmEmbed(); }
    if (e.keyCode === 27) { hideEmbed(); }
  },50);
});





///////////////////////////////////////////////////////////
/////////////// QUILL ATTACHMENT CONTROLLER  //////////////
///////////////////////////////////////////////////////////
var selectedAttachmentFiles;
document.getElementById('attach-from-device-button').addEventListener('change', attachmentSelectedFromDevice, false);

$('#attach-image-from-cryptee-button').on('click', function(event) {
  event.preventDefault();
  showCrypteeSelector();
});

function showAttachmentSelector (filetype) {
  $("#attachment-search-input").attr("filetype", filetype);
  if (filetype === "image") {
    $("#attachment-source-box").find(".title").html("Add Image");
    $("#attach-from-device-label").show();
    $("#attach-image-from-cryptee-button").show();
  } else {
    $("#attachment-source-box").find(".title").html("Attach File from Cryptee");
    $("#attach-from-device-label").hide();
    $("#attach-image-from-cryptee-button").hide();
    showCrypteeSelector();
  }

  $("#attachment-modal").addClass("is-active");
  $("#attachment-modal").find(".image-selection-preview").css("background-image", 'none');
  $(".image-selection-preview").hide();
}

function hideAttachmentSelector () {
  $("#attachment-modal").removeClass("is-active");
  $("#attachment-target-box").hide();
  $("#attachment-modal").find(".image-selection-preview").css("background-image", 'none');
  $(".image-selection-preview").hide();
  $("#attach-from-device-button").val("");
  quill.focus();
}

function attachmentSelectedFromDevice (event) {
  event.stopPropagation();
  event.preventDefault();
  selectedAttachmentFiles = event.target.files;

  if (event.target.files.length === 1) {
    var file = event.target.files[0];
    var reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = function(){
      var base64FileContents = reader.result;
      $(".image-selection-preview").show();
      $("#attachment-modal").find(".image-selection-preview").css("background-image", 'url(' + base64FileContents + ')');
    };
    reader.onerror = function(err){
      fileUploadError = true;
      handleError(err);
      $(".image-selection-preview").hide();
      showFileUploadStatus("is-danger", "Error. Seems like we're having trouble reading your image. This is most likely a problem we need to fix, and rest assured we will.");
    };
  }
  showAttachmentTargetBox();
}

function embedSelectedImages (selectedAttachmentFiles) {
  var files = selectedAttachmentFiles;
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    processEmbedImage(file);
  }
}

function embedDroppedImage (file) {
  dragCounter = 0;
  somethingDropped = true;
  processEmbedImage(file);
}

function embedDroppedAttachment (file) {
  dragCounter = 0;
  somethingDropped = true;
  processDroppedAttachment(file);
}

function processEmbedImage (file) {
  quill.focus();
  embedRange = quill.getSelection();
  var reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onloadend = function(){
    var base64FileContents = reader.result;
    try {
      var filename = file.name;
      //THIS LINE IS TO MAKE SURE FILE HAS SOME CONTENTS AND MAKE THIS "TRY" FAIL IF IT'S EMPTY, LIKE WHEN IT IS A FOLDER.
      var fileContents = base64FileContents.substr(base64FileContents.indexOf(',')+1);
      var imageTag = "<img src='"+base64FileContents+"' class='embedded-image'/>";
      quill.clipboard.dangerouslyPasteHTML(embedRange.index, imageTag);
      hideAttachmentSelector();
    } catch (e) {}
  };
  reader.onerror = function(err){
    fileUploadError = true;
    handleError(err);
    showFileUploadStatus("is-danger", "Error. Seems like we're having trouble reading your image. This is most likely a problem we need to fix, and rest assured we will.");
  };
}



function processDroppedAttachment (file) {
  quill.focus();
  embedRange = quill.getSelection();
  var reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onloadend = function(){
    var base64FileContents = reader.result;
    try {
      var filename = file.name;
      //THIS LINE IS TO MAKE SURE FILE HAS SOME CONTENTS AND MAKE THIS "TRY" FAIL IF IT'S EMPTY, LIKE WHEN IT IS A FOLDER.
      var fileContents = base64FileContents.substr(base64FileContents.indexOf(',')+1);

      var targetfid;

      if (activeDocID === "home") {
        targetfid = "f-uncat";
      } else {
        targetfid = activeFileFolder();
      }

      processDroppedFile(file, targetfid, function(did){
        attachCrypteeFile (filename, did);
      });

    } catch (e) {}
  };
  reader.onerror = function(err){
    fileUploadError = true;
    handleError(err);
    showFileUploadStatus("is-danger", "Error. Seems like we're having trouble reading your image. This is most likely a problem we need to fix, and rest assured we will.");
  };
}



function uploadSelectionsToCurrentFolder (selectedAttachmentFiles) {
  var targetfid = activeFileFolder();

  if (isAPIAvailable()) {

    var files = selectedAttachmentFiles;

    numFilesLeftToBeUploaded = 0;
    fileUploadError = false;

    for (var i = 0; i < files.length; i++) {
      processDroppedFile(files[i], targetfid);
      numFilesLeftToBeUploaded++;
    }

    if (numFilesLeftToBeUploaded > 0) {
      var processingMessage = "Processing <b>" + numFilesLeftToBeUploaded.toString() + "</b> file(s)";
      showFileUploadStatus("is-light", processingMessage);
    }

  } else {
    showFileUploadStatus("is-danger", "Unfortunately your browser or device does not support File API, which is what allows us to encrypt files on your device. Therefore we can't upload your file.");
  }
}


function showAttachmentTargetBox () {
  $("#attachment-target-box").show();
}


$('#embed-attachment-inline-button').on('click', function(event) {
  event.preventDefault();
  embedSelectedImages(selectedAttachmentFiles);
});

$('#embed-and-upload-attachment-button').on('click', function(event) {
  event.preventDefault();
  embedSelectedImages(selectedAttachmentFiles);
  uploadSelectionsToCurrentFolder(selectedAttachmentFiles);
});

$('#upload-attachment-button').on('click', function(event) {
  event.preventDefault();
  uploadSelectionsToCurrentFolder(selectedAttachmentFiles);
  hideAttachmentSelector();
});

$('.ql-attachfile').on('click', function(event) {
  event.preventDefault();
  showAttachmentSelector(" ");
});













function hideCrypteeSelector () {
  $('.attachment-selector').hide();
}

function showCrypteeSelector () {
  clearAttachmentSearch();
  $('.attachment-selector').show();
  setTimeout(function () {
    $("#attachment-search-input").focus();
  }, 25);
}

$("#attachment-search-input").on('keydown', function (e) {
  setTimeout(function(){
    var filetype = $("#attachment-search-input").attr("filetype");
    if (e.keyCode === 27) {
      if ($("#attachment-search-input").val().trim() === "") {
        hideCrypteeSelector ();
      } else {
        clearAttachmentSearch();
      }
    } else {
      attachmentSearch($("#attachment-search-input").val().trim(), filetype);
    }
  },50);
});

function attachmentSearch (term, filetype) {
  var attachmentSearchOptions = {
    shouldSort: true,
    threshold: 0.1,
    location: 0,
    distance: 100,
    maxPatternLength: 32,
    minMatchCharLength: 1,
    keys: [ "ftype", "name", "fname", "tags"  ]
  };
  var fuse = new Fuse(Object.values(catalog.docs), attachmentSearchOptions);
  var results = fuse.search(term);
  displayAttachmentSearchResults(results, filetype);
}

function displayAttachmentSearchResults (results, filetype) {
  $("#attachment-results").html("");

  $.each(results, function(i, result){
    result.ftype = result.ftype || "";
    if (result.ftype.indexOf(filetype) !== -1 || (filetype !== "image" && result.ftype === "")) {
      var folderColor = result.fcolor;
      if ( result.fcolor === " #363636" || result.fcolor === "#363636" ) { folderColor = "#000"; }
      var folderCard = '<p class="attachment-result-folder column is-11" id="attachment-result-'+result.fid+'"><span class="icon"><i class="fa fa-folder" style="color:'+folderColor+'"></i></span> '+result.fname+'</p>';
      var theResultFolder = $("#attachment-result-" + result.fid);
      if (theResultFolder.length <= 0) {
        $("#attachment-results").append(folderCard);
      }
    }
  });

  $.each(results, function(i, result){
    result.ftype = result.ftype || "";
    if (result.ftype.indexOf(filetype) !== -1 || (filetype !== "image" && result.ftype === "")) {
      var theResultFolder = $("#attachment-result-" + result.fid);
      var resultCard = '<div class="attachment-result column is-half" did="'+result.did+'"><span class="icon docicon exticon"><i class="'+result.icon+'"></i></span><span class="doctitle">'+result.name+'</span></div>';
      theResultFolder.after(resultCard);
    }
  });

}

function clearAttachmentSearch () {
  $("#attachment-search-input").val('');
  $("#attachment-results").html("");
}






$("#attachment-results").on('click', '.attachment-result', function(event) {
  event.preventDefault();

  var filetype = $("#attachment-search-input").attr("filetype");
  var didToAttach = $(this).attr("did");
  var attachmentTitle = $(this).find(".doctitle").text();

  if (filetype === "image") {
    downloadAttachment(attachmentTitle, didToAttach);
  } else {
    attachCrypteeFile(attachmentTitle, didToAttach);
  }
  hideAttachmentSelector();
  showFileUploadStatus("is-info", "Attaching " + attachmentTitle + " to document.");
});

function downloadAttachment (attachmentTitle, did) {
  var fileRef = rootRef.child(did + ".crypteefile");
  fileRef.getDownloadURL().then(function(docURL) {
    $.ajax({ url: docURL, type: 'GET',
        success: function(encryptedFileContents){
          attachmentLoaded(did, encryptedFileContents, attachmentTitle);
        },
        error:function (xhr, ajaxOptions, thrownError){
          console.log(thrownError);
          var errorText = "One moment please";
          showDocProgress(errorText);
          window.location.reload();
        }
    });

  }).catch(function(error) {
    var errorText;
    handleError(error);
    switch (error.code) {
      case 'storage/object-not-found':
        errorText = "Seems like this file doesn't exist or you don't have permission to open this doc.<br> We're not sure how this happened.<br> Please try again shortly, or contact our support.<br> We're terribly sorry about this.";
        // File or doc doesn't exist at all ~ shit. alright let's try to repair things.
        // Chances are we've got a problem.
        showDocProgress(errorText);
        fixFilesAndFolders(did);
        break;
      case 'storage/unauthorized':
        errorText = "Seems like this file doesn't exist or you don't have permission to open this doc.<br> We're not sure how this happened.<br> Please try again shortly, or contact our support.<br> We're terribly sorry about this.";
        // File or doc doesn't exist at all ~ shit. alright let's try to repair things.
        // Chances are we've got a problem.
        showDocProgress(errorText);
        fixFilesAndFolders();
        break;
      case 'storage/canceled':
        errorText = "A strange error happened while trying to load this file. It might be because you may have closed your browser while this doc was being saved";
        showDocProgress(errorText);
        break;
      case 'storage/unknown':
        errorText = "We can't seem to load this file. It's a mystery why. Somehow our servers are acting. Please try again shortly, or contact our support. We're terribly sorry about this.";
        showDocProgress(errorText);
        break;
    }
  });
}


function attachmentLoaded (did, encryptedFileContents, attachmentTitle) {
  var theEncryptedFileContents = JSON.parse(encryptedFileContents).data;
  decrypt(theEncryptedFileContents, [theKey]).then(function(plaintext) {
      var decryptedContents = plaintext.data;
      var ext = extensionFromFilename(attachmentTitle);
      if (ext.match(/^(jpg|jpeg|png|gif|svg|webp)$/i)) {
        attachImageFile(decryptedContents);
      }
  });
}

function attachImageFile (b64ImageToEmbed) {
  quill.focus();
  setTimeout(function () {
    embedRange = quill.getSelection();
    var imageTag = "<img src='"+b64ImageToEmbed+"' class='embedded-image'/>";
    quill.clipboard.dangerouslyPasteHTML(embedRange.index, imageTag);
    hideFileUploadStatus();
  }, 50);
}



function attachCrypteeFile (attachmentTitle, did) {
  quill.focus();
  setTimeout(function () {
    embedRange = quill.getSelection();
    var attachmentTag = "<crypteefile did='"+did+"' filetitle='"+attachmentTitle+"'>&#xf0c6;</crypteefile><p><br></p>";
    quill.clipboard.dangerouslyPasteHTML(embedRange.index, attachmentTag);
    quill.setSelection(embedRange.index + 2, "silent");
    hideFileUploadStatus();
  }, 50);
}

$('.ql-editor').on('click', 'crypteefile', function(event) {
  var theFile = $(this);
  if (!theFile.hasClass("error")) {
    event.preventDefault();
    var did = theFile.attr("did");
    var fileTitle = theFile.attr("filetitle");
    theFile.addClass("loading");

    var preview = true;

    var fileRef = rootRef.child(did + ".crypteefile");
    var docRef = rootRef.child(did + ".crypteedoc");

    // just to check file exists
    fileRef.getDownloadURL().then(function(url) {
      loadDoc(did, attachmentLoadComplete, did);
    }).catch(function(error){
      docRef.getDownloadURL().then(function(url) {
        loadDoc(did, attachmentLoadComplete, did);
      }).catch(function(error){
        theFile.removeClass("loading").addClass("error");
      });
    });
  } else {
    theFile.remove();
  }
});

function attachmentLoadComplete(did) {
  $("crypteefile[did='"+did+"']").removeClass("loading");
}





///////////////////////////////////////////////////////////
//////////////////  IMPORT Evrnt DOCUMENT   ////////////////
///////////////////////////////////////////////////////////

function unpackENEXFile (enoteJSON, dtitle, did, decryptedContents, callback, docsize, callbackParam) {
  var fid = fidOfDID(did);
  var x2js = new X2JS();
  var numOfNotesToUpload = 0;
  var numNotesUploaded = 0;
  var parentDid = did;
  enoteJSON['en-export'].note.forEach(function(note){
    var noteToUpload = { "en-export" : { "note" : note } };
    var xmlToEncrypt = x2js.json2xml_str(noteToUpload);
    var titleToUpload = note.title + ".enex";
    numOfNotesToUpload++;

    // CONVERT THIS TO A QUEUE. MAYBE MAKE IT 3 AT A TIME AND MAKE IT KINDA LIKE PHOTOS. OTHERWISE THIS OPENS THE FLOODGATES.
    queueFileForEncryptAndUpload(xmlToEncrypt, fid, titleToUpload, function(did){
      numNotesUploaded++;
      if (numNotesUploaded === numOfNotesToUpload) {
        // ALL NOTES UPLOADED.
        numNotesUploaded = 0;
        numOfNotesToUpload = 0;
        hideModal("enoteimport-modal");
        console.log("All Notes Unpacked.");
        stopLoadingSpinnerOfDoc(parentDid);
      }
    });
  });
}



// Importer from Evrnt using ENEX files with an enml-js parser

function importEvrntDocument (dtitle, did, decryptedContents, callback, docsize, callbackParam) {
  var spacelessDataURI = decryptedContents.replace(/\s/g, ''); // ios doesn't accept spaces and crashes browser. like wtf apple. What. THE. FUCCK!!!
  var rawENML;
  try {
    rawENML = decodeBase64Unicode(spacelessDataURI.split(',')[1]);
  } catch (e) {
    // if it's extracted by cryptee, it won't be B64 encoded.
    rawENML = decryptedContents;
  }

  var fid = fidOfDID(did);

  var x2js = new X2JS();
  var enoteJSON = x2js.xml_str2json( rawENML );

  var singleENEX = true; // false means there's more than one note exported.
  if (enoteJSON) {
    if (enoteJSON['en-export'].note.length) { singleENEX = false; }

    if (!singleENEX) {
      console.log("Got a multi-note export. Unpacking.");
      showModal("enoteimport-modal");
      // SHORT CIRCUIT HERE. WE GOTTA OPEN THIS ONE UP.
      return unpackENEXFile (enoteJSON, dtitle, did, decryptedContents, callback, docsize, callbackParam);
    } else {
      console.log("Got EN export file. Importing.");
    }

    var enoteContent = enoteJSON['en-export'].note.content;
    var enoteTitle = enoteJSON['en-export'].note.title;
    var enoteResources = enoteJSON['en-export'].note.resource;
    var $html = $('<div />',{html:enoteContent});
    var contentsForHashes = [];
    var attachments = {};
    var numAttachments = 0;
    var numCompletedAttachmentUploads = 0;

    if (enoteResources) {
      try {
        enoteResources.forEach(function(resObj){
          prepareResource(resObj);
        });
      } catch (e) {
        // not an array so there's only one resource.
        prepareResource(enoteResources);
      }


      // attachments are in attachments object now. start uploading. then it'll call replace elements
      startUploadingAttachments();

    } else {
      // no resources, start replacing elements then import.
      replaceElements();
    }
  } else {
    showErrorBubble("Error reading Evernote XML File.");
    callback(callbackParam);
  }

  function prepareResource(resObj) {
    var recoJSON = x2js.xml_str2json( resObj.recognition );
    var hash;
    if (recoJSON) {
      hash = recoJSON.recoIndex._objID;
      contentsForHashes[hash] = resObj.data.__text;
      console.log("Added image", hash ,"to embed queue.");
    } else {
      var attachmentTitle = "Untitled Evernote Note";
      if (resObj["resource-attributes"]) {
        attachmentTitle = resObj["resource-attributes"]["file-name"];
      }

      var attachmentType = resObj.mime;
      var attachmentContent = resObj.data.__text.replace(/\n/g, "");
      if (attachmentContent.indexOf("data:") === -1 ) {
        attachmentContent = "data:"+attachmentType+";base64," + attachmentContent;
      }
      var attachmentUUID = newUUID();
      attachments[attachmentUUID] = {title : attachmentTitle, type : attachmentType, content : attachmentContent, uuid : attachmentUUID};
      console.log("Added attachment", attachmentTitle ,"to upload queue.");
    }
  }

  function startUploadingAttachments() {
    var attachmentsToUpload = Object.keys(attachments);
    attachmentsToUpload.forEach(function(aid){
      numAttachments++;
      var attachment = attachments[aid];

      encryptAndUploadFile(attachment.content, fid, attachment.title, function(did){
        var attachmentTag = "<crypteefile did='"+did+"' filetitle='"+attachment.title+"'>&#xf0c6;</crypteefile><p><br></p>";
        $html.append(attachmentTag);
        numCompletedAttachmentUploads++;
        if (numCompletedAttachmentUploads === numAttachments) {
          // ALL ATTACHMENTS UPLOADED + APPENDED TO DOCUMENT HTML.
          // now embed images then we're all set.

          replaceElements();
        }
      });
    });

    if (attachmentsToUpload.length === 0) {
      // there are no attachments. but there is embed content, so moving on
      replaceElements();
    }
  }


  function replaceElements() {
    // REPLACE EN-MEDIA EN-TODO WITH WHATEVER THEY ACTUALLY ARE.
    // IMG if it's a type image etc.
    // OTHERWISE CRYPTEEFILE-ATTACHMENT

    $html.find("en-media").replaceWith(function(){
      var whatToReturn;
      if ($(this).attr("type").indexOf("image") !== -1) {
        whatToReturn = this.outerHTML.replace("<en-media", "<img");
      }
      return whatToReturn;
    });

    // IF THERE ARE EMBEDDED IMAGES, EMBED THEM.
    // WE'RE TRUSTING THAT THE IMAGES HAVE A RECOGNITION OBJ. IF THEY DON'T THEY'LL SHOW UP EMPTY
    // but they will be added as an attachment and uploaded.

    $html.find('img').each(function(){
      var hash = $(this).attr("hash");
      if (contentsForHashes[hash]) {
        $(this).attr("src", "data:image/png;base64," + contentsForHashes[hash]);
      } else {
        // not an image.
      }
    });

    // all images embedded.

    /// NOW LET'S FETCH THE TODOS.

    $html.find('span:has(en-todo)').each(function() {
      var checkedBool = $(this).find("en-todo").attr("checked");
      var checkboxContent = $(this).html();
      $(this).replaceWith( "<ul data-checked='"+checkedBool+"'><li>" + checkboxContent + "</li></ul>" );
    });

    // NOW CODEBLOCKS


    $html.find('div').each(function() {
      if ($(this)[0].outerHTML.indexOf('-en-codeblock') > -1) {
        var codeblockContent = $(this).html();
        $(this).replaceWith( "<pre class='ql-syntax' spellcheck='false'>" + codeblockContent + "</pre>" );
      }
    });

    prepCompleteReadyToImport();
  }

  function prepCompleteReadyToImport() {
    var rawHTML = $html.html();
    importHTMLDocument(enoteTitle, did, decryptedContents, callback, docsize, callbackParam, rawHTML);
  }
}

///////////////////////////////////////////////////////////
//////////////////  IMPORT HTML DOCUMENT   ////////////////
///////////////////////////////////////////////////////////

// Importer from HTML using (which can import from Bear & Evrnt or anything else HTML)

function importHTMLDocument (dtitle, did, decryptedContents, callback, docsize, callbackParam, rawHTML) {
  var spacelessDataURI = decryptedContents.replace(/\s/g, ''); // ios doesn't accept spaces and crashes browser. like wtf apple. What. THE. FUCCK!!!
  try {
    rawHTML = rawHTML || decodeBase64Unicode(spacelessDataURI.split(',')[1]);
    var fid = fidOfDID(did);

    quill.setText('\n');
    quill.clipboard.dangerouslyPasteHTML(1, rawHTML);
    quill.history.clear();

    dataRef.update({"lastOpenDocID" : did});
    sessionStorage.setItem('session-last-did', JSON.stringify(did));

    var milliseconds = (new Date()).getTime();
    sessionStorage.setItem('session-last-loaded', JSON.stringify(milliseconds));

    $("#homedoc").prop("disabled", false).attr("disabled", false);
    $("#homedoc").removeClass("is-dark");
    $("#doc-contextual-button").fadeIn(100);
    
    //set new did active
    activeDocID = did;
    activeDocTitle = dtitle;

    $(".filesize-button").prop('onclick',null).off('click');

    stopLoadingSpinnerOfDoc(did);

    highlightActiveDoc(did);

    // always inherited from load doc.

    saveDoc(function (){
      // RENAME DOCUMENT AND REMOVE HTML NOW.
      var newDocName = dtitle.replace(/\.html/g, '');
      encryptTitle(activeDocID, JSON.stringify(newDocName), function(encryptedTitle){
        foldersRef.child(fid + "/docs/" + did).update({ "isfile" : false, title : encryptedTitle }, function(){
          //set doc title in taskbar
          $("#active-doc-title").html(newDocName);
          $("#active-doc-title-input").val(newDocName);
          document.title = newDocName;
          $("#active-doc-title-input").attr("placeholder", newDocName);

          updateDocTitleInDOM(activeDocID, newDocName);

          catalog.docs[did] = catalog.docs[did] || {};
          catalog.docs[did].isfile = false;

          // now that we've imported the file, and made it a crypteedoc, delete it.
          var fileRef = rootRef.child(did + ".crypteefile");
          fileRef.delete().then(function() {
            callback(callbackParam);
          });
        });
      });
    });
  } catch (e) {
    stopLoadingSpinnerOfDoc(did);
    showErrorBubble("Sorry, can't import file. Are you sure this is an html file?", e);
    callback(callbackParam);
  }
}




///////////////////////////////////////////////////////////
//////////  IMPORT TEXT OR MARKDOWN DOCUMENT   ////////////
///////////////////////////////////////////////////////////

function importTxtOrMarkdownDocument (dtitle, did, decryptedContents, callback, filesize, callbackParam) {
  var spacelessDataURI = decryptedContents.replace(/\s/g, ''); // ios doesn't accept spaces and crashes browser. like wtf apple. What. THE. FUCCK!!!
  try {
    var rawTXT = decodeBase64Unicode(spacelessDataURI.split(',')[1]);
    var rawHTML = markdownConverter.makeHtml(rawTXT).split("\n").join("<br>");
    var fid = fidOfDID(did);

    quill.setText('\n');
    quill.clipboard.dangerouslyPasteHTML(1, rawHTML);
    quill.history.clear();

    dataRef.update({"lastOpenDocID" : did});
    sessionStorage.setItem('session-last-did', JSON.stringify(did));

    var milliseconds = (new Date()).getTime();
    sessionStorage.setItem('session-last-loaded', JSON.stringify(milliseconds));

    $("#homedoc").prop("disabled", false).attr("disabled", false);
    $("#homedoc").removeClass("is-dark");
    $("#doc-contextual-button").fadeIn(100);

    //set new did active
    activeDocID = did;
    activeDocTitle = dtitle;

    $(".filesize-button").prop('onclick',null).off('click');

    stopLoadingSpinnerOfDoc(did);
    highlightActiveDoc(did);

    // always inherited from load doc.

    saveDoc(function (){
      // RENAME DOCUMENT AND REMOVE HTML NOW.
      var newDocName = dtitle.replace(/\.md/g, '').replace(/\.txt/g, '');
      encryptTitle(activeDocID, JSON.stringify(newDocName), function(encryptedTitle){
        foldersRef.child(fid + "/docs/" + did).update({ "isfile" : false, title : encryptedTitle }, function(){
          //set doc title in taskbar
          $("#active-doc-title").html(newDocName);
          $("#active-doc-title-input").val(newDocName);
          document.title = newDocName;
          $("#active-doc-title-input").attr("placeholder", newDocName);
          updateDocTitleInDOM(activeDocID, newDocName);
          catalog.docs[did] = catalog.docs[did] || {};
          catalog.docs[did].isfile = false;

          // now that we've imported the file, and made it a crypteedoc, delete it.
          var fileRef = rootRef.child(did + ".crypteefile");
          fileRef.delete().then(function() {
            callback(callbackParam);
          });
        });
      });
    });

  } catch (e) {
    stopLoadingSpinnerOfDoc(did);
    showErrorBubble("Sorry, can't import file. Are you sure this is a text/markdown file?", e);
    callback(callbackParam);
  }
}


///////////////////////////////////////////////////////////
///////////////////  IMPORT CRYPTEEDOC   //////////////////
///////////////////////////////////////////////////////////

var encryptedCrypteeDocForImport;
var crypteeDocForImportDID;
var crypteeDocForImportTitle;
var crypteeDocForImportSize;
var crypteeDocImportCallback;

function cancelImportingCrypteedoc (error) {
  error = error || false;

  hideModal("crypteedoc-import-modal");
  $("#crypteedoc-key-input").val("");
  $("#crypteedoc-modal-decrypt-button").removeClass("is-success is-danger");
  $("#crypteedoc-modal-decrypt-button").find("i").removeClass("fa-cog fa-spin").addClass("fa-unlock-alt");

  stopLoadingSpinnerOfDoc(crypteeDocForImportDID);

  encryptedCrypteeDocForImport = null;
  crypteeDocForImportDID = null;
  crypteeDocForImportTitle = null;
  crypteeDocForImportSize = null;

  // CANCEL LOAD DOC HERE IF YOU NEED TO DO MORE.

  if (error) {
    handleError(error);
    setTimeout(function () {
      showErrorBubble("Document seems corrupted.");
    }, 500);
  }

  crypteeDocImportCallback = crypteeDocImportCallback || noop;
  crypteeDocImportCallback();
  crypteeDocImportCallback = null;
}

function importCrypteedoc (dtitle, did, decryptedContents, callback, docsize, callbackParam) {
  breadcrumb('Starting to import ECD');
  var spacelessDataURI = decryptedContents.replace(/\s/g, ''); // ios doesn't accept spaces and crashes browser. like wtf apple. What. THE. FUCCK!!!
  try {
    var rawCrypteedoc = decodeBase64Unicode(spacelessDataURI.split(',')[1]);
    // decryptedContents  IS ACTUALLY ENCRYPTED, AND LIKELY USING A DIFFERENT KEY.
    // SO FIRST TRY CURRENT KEY, FAIL, AND ASK FOR ANOTHER KEY.

    // (technically shit's double encrypted.)
    encryptedCrypteeDocForImport = rawCrypteedoc;
    // this is inefficient yes. But if this wasn't the case, we'd need to allow ".crypteefile" uploads to go through without encryption.
    // which means that someone could simply rename a .jpg file, and upload without encryption too. not cool.
    // we don't want to know shit. let's just leave it at that.

    crypteeDocForImportDID = did;
    crypteeDocForImportTitle = dtitle;
    crypteeDocForImportSize = docsize;
    crypteeDocImportCallback = callback || noop;

    processEncryptedCrypteedoc();
  } catch (e) {
    breadcrumb('ECD import : failed due to encoding');
    cancelImportingCrypteedoc(e);
  }
}

function processEncryptedCrypteedoc(retry) {
  retry = retry || false;
  breadcrumb('ECD Import : Processing');
  $("#crypteedoc-modal-decrypt-button").find("i").removeClass("fa-unlock-alt").addClass("fa-cog fa-spin");

  var encryptedCrypteedocContents;
  var proceedWithDecrypt = false;
  var hadErrors;
  try {
    encryptedCrypteedocContents = JSON.parse(encryptedCrypteeDocForImport).data;
    proceedWithDecrypt = true;
  } catch (e) {
    breadcrumb('ECD Import : Failed to JSON parse ECD contents.');
    hadErrors = e;
  }

  if (proceedWithDecrypt) {
    breadcrumb('ECD Import : Starting to decrypt ECD contents, testing current key and inputted key');
    decrypt(encryptedCrypteedocContents, [theKey, $("#crypteedoc-key-input").val().trim()]).then(function(decryptedCrypteedoc) {
      var plaintextCrypteedoc = decryptedCrypteedoc.data;
      processPlaintextCrypteedoc(plaintextCrypteedoc);
    }).catch(function(error){
      breadcrumb('Both failed. Must be a user error');
      $("#crypteedoc-modal-decrypt-button").find("i").removeClass("fa-cog fa-spin").addClass("fa-unlock-alt");
      showCrypteedocImportModal();
    });
  } else {
    cancelImportingCrypteedoc (hadErrors);
  }
}

function showCrypteedocImportModal () {
  if ($("#crypteedoc-key-status").attr("retry") !== "true") {
    $("#crypteedoc-key-status").html("Different Key Required").attr("retry", "true");
  } else {
    $("#crypteedoc-key-status").html("Wrong Key. Try again ...").attr("retry", "true");
    $("#crypteedoc-modal-decrypt-button").removeClass("is-light is-success").addClass("is-danger");
  }

  showModal("crypteedoc-import-modal");
  setTimeout(function () {
    $("#crypteedoc-key-input").focus();
  }, 100);
}

$("#crypteedoc-modal-decrypt-button").on('click', function(event) {
  if ($("#crypteedoc-key-status").attr("retry") === "true") {
    processEncryptedCrypteedoc(true);
  } else {
    processEncryptedCrypteedoc(false);
  }
});

$("#crypteedoc-key-input").on('keydown keypress paste copy cut change', function(event) {
  setTimeout(function(){
    if ($("#crypteedoc-key-input").val().trim() !== "") {
      $("#crypteedoc-modal-decrypt-button").removeClass("is-light is-danger").addClass("is-success");
      if (event.keyCode == 13) {
        if ($("#crypteedoc-key-status").attr("retry") === "true") {
          processEncryptedCrypteedoc(true);
        } else {
          processEncryptedCrypteedoc(false);
        }
      }
    } else {
      $("#crypteedoc-modal-decrypt-button").removeClass("is-success is-danger").addClass("is-light");
    }

    if (event.keyCode == 27) { cancelImportingCrypteedoc (); }
  },50);
});

function processPlaintextCrypteedoc (plaintextCrypteedoc) {
  breadcrumb('ECD Import : Starting to import & set plaintext ECD contents');
  $("#crypteedoc-key-status").html("Decrypting &amp; Importing");

  var did = crypteeDocForImportDID;
  var dtitle = crypteeDocForImportTitle;
  var docsize = crypteeDocForImportSize;
  var fid = fidOfDID(did);

  quill.setText('\n');
  quill.setContents(JSON.parse(plaintextCrypteedoc));
  quill.history.clear();

  dataRef.update({"lastOpenDocID" : did});
  sessionStorage.setItem('session-last-did', JSON.stringify(did));

  var milliseconds = (new Date()).getTime();
  sessionStorage.setItem('session-last-loaded', JSON.stringify(milliseconds));

  $("#homedoc").prop("disabled", false).attr("disabled", false);
  $("#homedoc").removeClass("is-dark");
  $("#doc-contextual-button").fadeIn(100);
  
  //set new did active
  activeDocID = did;
  activeDocTitle = dtitle;

  $(".filesize-button").prop('onclick',null).off('click');

  stopLoadingSpinnerOfDoc(did);
  highlightActiveDoc(did);

  // always inherited from load doc.

  saveDoc(function (){
    breadcrumb('ECD Import : Saved ECD Imported Doc, will encrypt Title');
    // RENAME DOCUMENT AND REMOVE HTML NOW.
    var newDocName = dtitle.replace(/\.crypteedoc/g, '').replace(/\.ecd/g, '');
    encryptTitle(activeDocID, JSON.stringify(newDocName), function(encryptedTitle){
      breadcrumb('ECD Import : Encrypted ECD Title, will set to db');
      foldersRef.child(fid + "/docs/" + did).update({ "isfile" : false, title : encryptedTitle }, function(){
        //set doc title in taskbar
        $("#active-doc-title").html(newDocName);
        $("#active-doc-title-input").val(newDocName);
        document.title = newDocName;
        $("#active-doc-title-input").attr("placeholder", newDocName);
        updateDocTitleInDOM(activeDocID, newDocName);
        catalog.docs[did] = catalog.docs[did] || {};
        catalog.docs[did].isfile = false;
        
        // now that we've imported the file, and made it a crypteedoc, delete it.
        breadcrumb('ECD Import : Title set, will delete old references');
        var fileRef = rootRef.child(did + ".crypteefile");
        fileRef.delete().then(function() {
          breadcrumb('ECD Import : Old references deleted.');
          // IN THIS CASE THIS WILL JUST HIDE. NOTHING TO CANCEL ANYWAY YOU'RE ALL GOOD. DON'T WORRY.
          cancelImportingCrypteedoc();
          breadcrumb('ECD Import : Completed.');
        }).catch(function(e){
          if (e.code !== "storage/object-not-found") {
            handleError(e);
          }
        });
      });
    });
  });
}


























///////////////////////////////////////////////////////////
/////////////////  LEFT VIEW CONTROLLER   /////////////////
///////////////////////////////////////////////////////////

$(".left-view-controller-buttons").on('click', '.left-nav-buttons', function(event) {
  if ($(this).attr("id") !== "homedoc") {
    var posToLoad = $(this).attr("pos");
    loadLeftViewPos(posToLoad);
    $(this).addClass("active");
    closeActiveFolder();
    if (isMobile) {
      showMenu();
    }
  }
});

function loadLeftViewPos (posToLoad) {
  $(".left-views-scroller").removeClass("pos-0 pos-1 pos-2 pos-3").addClass("pos-"+posToLoad);
  $(".left-view-controller-buttons").find(".left-nav-buttons").removeClass("active");
}

function gensort(a,b) {
  if (a.gen < b.gen)
    return -1;
  if (a.gen > b.gen)
    return 1;
  return 0;
}

var refreshOnlineDocsTimer;

function refreshOnlineDocs () {
  clearTimeout(refreshOnlineDocsTimer);
  refreshOnlineDocsTimer = setTimeout(function () {
    refresh();
  }, 100);

  function refresh() {
    var allDocsArray = Object.values(catalog.docs);

    // let's get 6 months ago (and exclude anything older than that)
    var curDate = new Date(); 
    curDate.setMonth(curDate.getMonth() - 6);
    curDate.setHours(0, 0, 0);
    curDate.setMilliseconds(0);
    var sixMoAgo = curDate.getTime();

    $("#all-recent").html("");
    $(".folderrecents").html("");
    $("#all-active-folder-docs").html("");

    allDocsArray.sort(gensort);
    allDocsArray.forEach(function(doc){
      if (doc.did !== undefined) {
        // ADD DOC TO RECENTS
        if (doc.name && !doc.isfile && !isDIDinArchivedFID(doc.did) && doc.gen / 1000 > sixMoAgo) {
          if (!doesDocExistInDOM(doc.did, "#all-recent")) {
            $("#all-recent").prepend(renderDoc(doc, "recent"));
          }
        }

        // ADD DOC TO ACTIVE FOLDER LIST
        if (!doesDocExistInDOM(doc.did, "#all-active-folder-docs") && doc.fid === activeFolderID) {
          $("#all-active-folder-docs").prepend(renderDoc(doc, "activefolder"));
        }

        // ADD OFFLINE BADGE
        offlineStorage.getItem(doc.did, function (err, offlineDoc) {
          catalog.docs[doc.did] = catalog.docs[doc.did] || {};
          if (offlineDoc) { 
            addOfflineBadgeToDoc(doc.did); 
            catalog.docs[doc.did].isoffline = true; 
          } else { 
            catalog.docs[doc.did].isoffline = false; 
          }
        });
      }
    });

    // fill the recent docs in folders now. (reverse order) 
    allDocsArray.reverse();
    allDocsArray.forEach(function(doc){
      if (doc.did !== undefined) {
        // ADD DOC TO RECENTS
        if (doc.name && !doc.isfile && !isDIDinArchivedFID(doc.did) && doc.gen / 1000 > sixMoAgo) {
          renderAndPrependFolderRecentDoc(doc);
        }
      }
    });

    if (activeFolderID !== undefined && activeFolderID !== "root") {
      var activeFolderSort = catalog.folders[activeFolderID].sortdocs;
      if (activeFolderSort) {
        sortDocsOfActiveFolder(activeFolderSort);
      }
    }
  }
  
}





function renderDoc (doc, type) {
  var isFile = doc.isfile;
  var icon = doc.icon || "fa fa-fw fa-file-text-o";
  var gen, since;

  if (doc.gen !== 0) {
    gen = doc.gen / 1000;
    since = timeSince(gen);
  } else {
    gen = 0;
    since = "∞";
  }

  var active = "";
  if (doc.did === activeDocID) {
    active = "activedoc";
  }

  if (doc.did === "home") {
    icon = "fa fa-fw fa-home";
  }

  
  var recentFolder;
  if (doc.fid === "f-uncat") {
    recentFolder = '&bull; Inbox';
  } else {
    recentFolder = '&bull; '+ (titleOf(doc.fid) || "");
  }

  var offlineBadge = '<span class="offline-badge"></span>';
  if (doc.content) {
    recentFolder = "";
    offlineBadge = "";
  }

  var deets = ""; 
  if (type !== "activefolder") {
    deets = '<p class="deets docdeet">'+ since + ' ago ' + recentFolder + '</p>';
  }

  var progress = "";
  if (isFile) {
    progress = '<progress class="progress is-small docprogress" value="" max=""></progress>';
  }

  var context = '<span class="icon docctx"><i class="fa fa-fw fa-ellipsis-v"></i></span>';

  var docElem =
  '<div class="doc ' + active + '" did="'+ doc.did +'" fid="'+doc.fid+'" gen="'+ gen +'">'+
    '<span class="icon docicon"><i class="' + icon + '"></i>'+ offlineBadge +'</span>'+
    '<p class="doctitle">'+doc.name+'</p>'+
    deets +
    progress +
    context +
  '</div>';

  return docElem;
}

function renderAndPrependFolderRecentDoc(doc) {
  var fid = doc.fid;
  var did = doc.did;
  var name = doc.name;
  var active = "";

  var icon = "<span class='icon'><i class='fa fa-fw fa-clock-o'></i></span>";
  if (did === activeDocID) {
    icon = "<span class='icon'><i class='fa fa-fw fa-caret-right'></i></span>";
    active = " active";
  }

  var docElem = "<p class='folderrecent" + active + "' did='" + did +"'>" + name + "</p>";
  
  var folder = $("#" + fid);
  var frecentsArray = folder.find(".folderrecent");
  // folder can have max 3 recents, and as long as this doc isn't already in the recents, add it.
  if (frecentsArray.length < 3 && folder.find(".folderrecent[did='" + did + "']").length <= 0) {
    folder.find(".folderrecents").append(docElem);
  }
}

function updateRecency() {
  if (initialLoadComplete) {
    Object.values(catalog.docs).forEach(function(doc){
      var gen, since;
      var stringGen = $(".doc[did='"+doc.did+"']").attr("gen");
      if (stringGen !== "0" || stringGen !== "undefined") {
        gen = parseInt($(".doc[did='"+doc.did+"']").attr("gen"));
      } else {
        gen = 0;
      }

      if (gen !== 0) {
        since = timeSince(gen);
      } else {
        since = "∞";
      }

      $(".doc[did='"+doc.did+"']").find(".doctime").html(since+ " ago");
    });
    if (!connectivityMode) {
      refreshOfflineDocs();
    }
  }
}







////////////////////////////////////////////////////////
/////////////////// CONNECTION STATUS  /////////////////
////////////////////////////////////////////////////////

var windowVisible;
document.addEventListener('visibilityChange', handleVisibilityChange, false);

$(window).on("focus", function () {
  forceCheckConnection();
  windowVisible = true;
});

$(window).on("blur", function () {
  windowVisible = false;
});

function handleVisibilityChange() {
  if (document[hidden]) {
    // hidden
    windowVisible = false;
  } else {
    // shown
    forceCheckConnection();
    windowVisible = true;
  }
}

function forceCheckConnection (){
  checkConnection(function(status){
    connectionStatus(status);
  });
}

function connectionStatus(status) {
  connected = status; // boolean, true if connected

  if (gotKey) { // this prevents an early offline mode call from being made before key is typed.
    if (connected) {
      setTimeout(function () {
        checkConnection(function(secondCheck){
          if (secondCheck) {
            activateOnlineMode();
          }
        });
      }, 1000);
    } else {
      activateOfflineMode();
    }
  } else {
    if (startedOffline && connected) {
      window.location.reload();
    }
  }

}









///////////////////////////////////////////////////////////
///////////////////  WIP OFFLINE MODE  ////////////////////
///////////////////////////////////////////////////////////

// offline data model

// var offlineData = {
//   did1 : offlineDocObject,
//   did2 : offlineDocObject
//   ...
// };

// var offlineDocObject = {
//   did : did, // "d-1234567890"
//   name : name, // "An Offline Document"
//   content : encryptedDocDelta, // serialized Quill Deltas
//   gen : gen, // "savetime"
//   fid : fid, // fid to upload to once online
//   tags : tags // ["tag1, "tag2", "tag3"]
// };

// EACH offlineDocObject will have deltas encrypted using the user's hashed key (keyToRemember) directly.
// since we won't have access to the strong key (theKey) until we go online.
// when online, during upload, you will decrypt the encryptedDocDelta using hashedKey, then re-encrypt it using theStrongKey.

// IF THE USER HAD THE DOC OPEN AND WENT OFFLINE MID-EDITING,
// DOC WILL NOW BE SAVED TO OFFLINE STORAGE PENDING UPLOAD.

// before the upload we check if the DID already exists.
// If DID already exists, then we check generation of the online one, and the offline one.
// Display user a message and say :
// "Your offline copy seems older than your online copy, which one would you like to use? If you choose offline, this will overwrite the online copy."
// OR
// "Your online copy seems older than your offline copy, would you like to proceed with uploading the offline copy? This will overwrite the online copy."


function alsoSaveDocOffline (did, callback) {
  callback = callback || noop;
  var name = activeDocTitle;
  var plaintextDocDelta = JSON.stringify(quill.getContents());
  var gen = currentGeneration;
  var fid = activeFileFolder() || "f-uncat";
  var fname = titleOf(fid) || "Inbox";
  var tags = [];
  $('crypteetag').each(function(index, el) {
    var tagContent = $(this).text().replace("&nbsp;", "");
    tags.push(tagContent);
  });

  encrypt(plaintextDocDelta, [keyToRemember]).then(function(ciphertext) {
    var encryptedDocDelta = JSON.stringify(ciphertext);
    var offlineDocObject = {
      did : did, // "d-1234567890"
      name : name, // "An Offline Document"
      content : encryptedDocDelta, // serialized Quill Deltas
      gen : gen, // "savetime"
      fid : fid, // fid to upload to once online
      fname : fname,
      tags : tags // ["tag1, "tag2", "tag3"]
    };

    offlineStorage.setItem(did, offlineDocObject).then(function () {
      // offline doc saved
      callback();
    }).catch(function(err) {
      if (err.code === 22) {
        // USER EXCEEDED STORAGE QUOTA. 
        breadcrumb("Exceeded Storage Quota. (" + storageDriver + ")");
        showWarningModal("offline-storage-full-modal");
      }
      handleError(err);
    });
  });
}






function saveOfflineDoc (callback, callbackParam) {
  callback = callback || noop;

  if (callbackParam) {
    showDocProgress("Saving Offline");
  }


  $('#main-progress').attr("max", "30").attr("value", "0").removeClass("is-danger is-warning is-success is-info");
  $("#filesize").html("Offline").css("color", "#fff");

  var did = activeDocID || "d-" + newUUID();
  var name = activeDocTitle || "An Offline Document";
  var plaintextDocDelta = JSON.stringify(quill.getContents());
  var gen, fid, fname;
  if (docChanged) {
    gen = (new Date()).getTime() * 1000;
    currentGeneration = gen;
  } else {
    gen = currentGeneration;
  }

  offlineStorage.getItem(did).then(function (doc) {
    if (doc) {
      fid = doc.fid;
      fname = doc.fname;
    } else {
      fid = activeFileFolder() || "f-uncat";
      var folderTitle = titleOf(fid);
      fname = folderTitle || "Inbox";
    }

    var tags = [];
    $('crypteetag').each(function(index, el) {
      var tagContent = $(this).text().replace("&nbsp;", "");
      tags.push(tagContent);
    });

    encrypt(plaintextDocDelta, [keyToRemember]).then(function(ciphertext) {
      var encryptedDocDelta = JSON.stringify(ciphertext);

      var offlineDocObject = {
        did : did, // "d-1234567890"
        name : name, // "An Offline Document"
        content : encryptedDocDelta, // serialized Quill Deltas
        gen : gen, // "savetime"
        fid : fid, // fid to upload to once online
        fname : fname,
        tags : tags // ["tag1, "tag2", "tag3"]
      };

      setTimeout(function () {
        $('#main-progress').attr("value", "15");
        offlineStorage.setItem(did, offlineDocObject).then(function () {
          // offline doc saved
          if (docChanged) {
            $(".doc[did='"+did+"']").attr("gen", gen / 1000);
            $(".doc[did='"+did+"']").find(".doctime").html("Seconds ago");
            $(".doc[did='"+did+"']").prependTo("#all-offline");
          }

          docChanged = false;
          setTimeout(function () {
            $('#main-progress').attr("value", "30").removeClass("is-danger is-warning is-success is-info").addClass("is-info");
            refreshOfflineDocs(callback, callbackParam);
          }, 150);
        }).catch(function (err) {

          if (err.code === 22) {
            // USER EXCEEDED STORAGE QUOTA. 
            breadcrumb("Exceeded Storage Quota. (" + storageDriver + ")");
            showWarningModal("offline-storage-full-modal");
          } else {
            showErrorBubble("Error saving document", err);
          }
          
          handleError(err);
        });
      }, 150);

    }).catch(function (err) {
      showErrorBubble("Error encrypting while saving document", err);
      handleError(err);
    });

  }).catch(function(err) {
    handleError(err);
  });
}

function prepareToLoadOfflineDoc (did) {

  saveOfflineDoc(loadOfflineDoc, did);

}

function loadOfflineDoc (did, callback, callbackParam) {
  callback = callback || noop;

  startLoadingSpinnerOfDoc(did);

  offlineStorage.getItem(did).then(function (doc) {
    showDocProgress("Loading " + doc.name);
    var theEncryptedDelta = JSON.parse(doc.content).data;
    decrypt(theEncryptedDelta, [keyToRemember]).then(function(plaintext) {
      var decryptedText = plaintext.data;
      quill.setContents(JSON.parse(decryptedText));
      quill.history.clear();

      sessionStorage.setItem('session-last-did', JSON.stringify(did));
      var milliseconds = (new Date()).getTime();
      sessionStorage.setItem('session-last-loaded', JSON.stringify(milliseconds));
      idleTime = 0;
      lastSaved = (new Date()).getTime();
      docChanged = false;

      if (doc.did !== "home"){
        $("#homedoc").prop("disabled", false).attr("disabled", false);
        $("#homedoc").removeClass("is-dark");
        $("#doc-contextual-button").fadeIn(100);
      } else {
        $("#homedoc").addClass("is-dark");
        $("#homedoc").prop("disabled", true).attr("disabled", true);

        $(".document-contextual-button").addClass("docContextOff");
        $(".filesize-button, .mobile-floating-tools").addClass('menuOpen');
        $("#doc-contextual-button").fadeOut(100);
      }

      
      activeDocID = doc.did;
      activeDocTitle = doc.name;
      currentGeneration = doc.gen;

      stopLoadingSpinnerOfDoc(did);
      highlightActiveDoc(did);

      $('#main-progress').attr("value", "30").attr("max", "30").removeClass("is-danger is-warning is-success is-info").addClass("is-info");

      $("#active-doc-title").html(doc.name);
      $("#active-doc-title-input").val(doc.name);
      document.title = doc.name;
      $("#active-doc-title-input").attr("placeholder", doc.name);

      if (isMobile) {
        hideDocProgress(hideMenu);
      } else {
        hideDocProgress();
      }

      callback(callbackParam);
    }).catch(function (err) {
      showErrorBubble("Error decrypting while saving document", err);
      handleError(err);
    });
  }).catch(function (err) {
    showErrorBubble("Error loading document", err);
    handleError(err);
  });
}


function refreshOfflineDocs(callback, callbackParam) {
  callback = callback || noop;
  var offlineDocsArray = [];

  offlineStorage.iterate(function(doc, did, i) {
    offlineDocsArray.push(doc);
  }).then(function() {
      $("#all-offline").html("");
      offlineDocsArray.sort(gensort);
      offlineDocsArray.forEach(function(doc){
        if (doc.name && !doc.isfile) {
          if (!doesDocExistInDOM(doc.did, "#all-offline")) {
            $("#all-offline").prepend(renderDoc(doc, "offline"));
          }
        }
      });
      callback(callbackParam);
  }).catch(function(err) {
    showErrorBubble("Error getting offline documents", err);
    handleError(err);
  });
}

function newOfflineDoc (input) {
  var title = input.val().trim();
  showDocProgress("Creating New Offline Document");
  if (title !== "") {
    var did = "d-" + newUUID();
    var tempGen = (new Date()).getTime() * 1000;

    quill.setText('\n');
    idleTime = 0;
    lastSaved = (new Date()).getTime();
    docChanged = true;

    $("#homedoc").prop("disabled", false).attr("disabled", false);
    $("#homedoc").removeClass("is-dark");
    $("#doc-contextual-button").fadeIn(100);

    $("#active-doc-title").html(title);
    $("#active-doc-title-input").val(title);
    $("#active-doc-title-input").attr("placeholder", title);

    activeDocID = did;
    activeDocTitle = title;
    document.title = title;
    input.val("");

    saveOfflineDoc(function(){
      if (isMobile) {
        hideDocProgress(hideMenu);
      } else {
        hideDocProgress();
      }
      highlightActiveDoc(did);
      hideNoOfflineDocs();
    });
  }
}

// function renameOfflineDoc(newDocName) {
//   var theInput = $('#active-doc-title-input');
//
//   offlineStorage.getItem(activeDocID).then(function (doc) {
//     var newDocObj = doc;
//     newDocObj.name = newDocName;
//     offlineStorage.setItem(activeDocID, newDocObj).then(function () {
//
//       document.title = newDocName;
//       theInput.val(newDocName);
//       theInput.attr("placeholder", newDocName);
//       activeDocTitle = newDocName;
//
//       $("#" + activeDocID).find(".doctitle").html(newDocName);
//       $(".activedoc").find(".doctitle").html(newDocName);
//
//       $(".rename-doc-status").removeClass("is-danger is-warning is-dark is-success").addClass("is-success");
//       $(".rename-doc-status > .title").html("Done");
//
//       setTimeout(function(){
//         hideRenameDocModal();
//       }, 1000);
//
//     }).catch(function (err) {
//       showErrorBubble("Error saving the new title of offline document", err);
//     });
//   }).catch(function (err) {
//     showErrorBubble("Error renaming offline document", err);
//   });
// }

function deleteOfflineDoc(did) {
  offlineStorage.removeItem(did).then(function() {
    refreshOfflineDocs(function(){

      var offlineDocsArray = [];
      offlineStorage.iterate(function(doc, gotDid, i) {
        offlineDocsArray.push(doc);
      }).then(function() {
          offlineDocsArray.sort(gensort);
          if (offlineDocsArray[0]) {
            loadOfflineDoc(offlineDocsArray[0].did, function(){
              hideDeleteDocModal();
            });
          } else {
            showNoOfflineDocs();
            hideDeleteDocModal();
            activeDocID = null;
            activeDocTitle = null;
            document.title = "Cryptee | Offline Docs";
          }
      }).catch(function(err) {
        showErrorBubble("Error deleting offline document", err);
        handleError(err);
      });

    });
  }).catch(function(err) {
    showErrorBubble("Error deleting offline document", err);
    handleError(err);
  });
}

function makeOfflineDoc(did) {
  breadcrumb("Making " + did + " offline.");
  did = did || noop;
  var plaintextDocDelta;
  var tags = catalog.docs[did].tags || [];
  var fid = fidOfDID(did);
  var dtitle = titleOf(did);
  var fname = titleOf(fid);
    
  var docRef = rootRef.child(did + ".crypteedoc");
  docRef.getMetadata().then(function(metadata) {
    var onlineGen = metadata.generation;

    docRef.getDownloadURL().then(function(docURL) {
      $.ajax({ url: docURL, type: 'GET',
          success: function(encryptedDocDelta){
            var theStrongKeyEncryptedDelta = JSON.parse(encryptedDocDelta).data;
            decrypt(theStrongKeyEncryptedDelta, [theKey]).then(function(plaintext) {
              plaintextDocDelta = plaintext.data;
              encrypt(plaintextDocDelta, [keyToRemember]).then(function(ciphertext) {
                var hashKeyEncryptedDocDelta = JSON.stringify(ciphertext);

                var offlineDocObject = {
                  did : did, // "d-1234567890"
                  name : dtitle, // "An Offline Document"
                  content : hashKeyEncryptedDocDelta, // serialized Quill Deltas
                  gen : onlineGen, // "savetime"
                  fid : fid, // fid to upload to once online
                  fname : fname, // foldername
                  tags : tags // ["tag1, "tag2", "tag3"]
                };

                offlineStorage.setItem(did, offlineDocObject).then(function () {
                  // done
                  docMadeAvailableOffline(did);
                }).catch(function(err) {
                  if (err.code === 22) {
                    // USER EXCEEDED STORAGE QUOTA. 
                    breadcrumb("Exceeded Storage Quota. (" + storageDriver + ")");
                    showWarningModal("offline-storage-full-modal");
                  }
                  handleError(err);
                });
              }).catch(function(err) {
                showErrorBubble("Error with encryption of "+dtitle+" during download", err);
                handleError(err);
              });
            }).catch(function(err) {
              showErrorBubble("Error with encryption of "+dtitle+" during download", err);
              handleError(err);
            });
          },
          error:function (xhr, ajaxOptions, thrownError){
            showErrorBubble("Error getting "+dtitle+" for download", thrownError);
            handleError(thrownError);
          }
      });

    }).catch(function(err) {
      showErrorBubble("Error getting "+dtitle+" for download", err);
      handleError(err);
    });
  });
}

function removeOfflineDoc(did) {
  breadcrumb("Making " + did + " online only.");
  offlineStorage.removeItem(did).then(function() {
    refreshOfflineDocs();
    docMadeOnlineOnly(did);
  }).catch(function(err) {
    showErrorBubble("Error deleting offline document", err);
    handleError(err);
  });
}












var checkConnectionEvery10Seconds;

function activateOnlineMode () {
  if (!connectivityMode) {
    console.log("Activating Online Mode");

    // this is unnecessary because we don't handle a state in which getting connectivity back changes anything.
    // connectivityMode = true;
    if (windowVisible || isios) {
      showGotConnectionBubble();
    } else {
      restartToOnlineMode();
    }
  }
}







function activateOfflineMode () {
  if (connectivityMode) {
    console.log("Activating Offline Mode");
    connectivityMode = false;
    checkConnectionEvery10Seconds = setInterval(function () {
      forceCheckConnection();
    }, 10000);

    // ADD A NOTIFICATION SOMEWHERE TO TELL USERS THAT THIS COULD SHOW UP DUE TO CORPORATE
    // FIREWALLS BLOCKING CONNECTIONS OR AN EXTENSION BLOCKING CONNECTIONS ETC.

    refreshOfflineDocs(function(){
      $("#offline-button").click();
      $("#search-bar, .onlineLeftButtons").addClass("is-unavailable");
      setTimeout(function () {
        $(".offlineLeftButtons").removeClass("is-unavailable");
      }, 550);

      $("#main-progress").removeClass('is-success is-warning').addClass('is-info');
      $(".filesize-button > .button").addClass("is-info");
      $("#filesize").html("Offline").css("color", "#fff");

      $(".is-hidden-offline, .left-views-container").addClass("offline");

      if (!activeDocID) {
        // IF IT'S A FRESH BOOT, AND NO DOCUMENT IS OPEN YET,
        // TRY OPENING THE LATEST OFFLINE DOC IF IT EXISTS.
        $("#main-progress, .progressButtons, .document-contextual-button, .filesize-button, .mobile-floating-tools, #doc-contextual-buttons, #toolbar-container").show();

        var offlineDocsArray = [];
        offlineStorage.iterate(function(doc, did, i) {
          offlineDocsArray.push(doc);
        }).then(function() {
            offlineDocsArray.sort(gensort);
            if (offlineDocsArray[0]) {
              loadOfflineDoc(offlineDocsArray[0].did, offlineInitComplete);
            } else {
              showNoOfflineDocs();
              offlineInitComplete();
            }
        }).catch(function(err) {
            showErrorBubble("Error getting offline documents", err);
            handleError(err);
        });

      } else {
        // SAVE OPEN DOCUMENT AS OFFLINE.
        saveOfflineDoc();

      }
    });
  }
}

function offlineInitComplete (){
  if (!initialLoadComplete) {
    setTimeout(function () {
      arrangeTools();
    }, 1000);
  }
}

function showSyncingProgress(val, max) {
  val = val || 100;
  max = max || 100;
  $('#sync-progress-bar').attr("value", val).attr("max", max);
  $("#sync-progress").addClass("syncing");
}

function hideSyncingProgress() {
  $("#sync-progress").removeClass("syncing done");
}

function toSyncOrNotToSync (callback, callbackParam){
  callback = callback || noop;

  offlineStorage.length().then(function(numberOfOfflineDocs) {
    if (numberOfOfflineDocs > 0) {
      prepareForSync(numberOfOfflineDocs, callback, callbackParam);
    } else {
      callback(callbackParam);
    }
  }).catch(function(err) {
    handleError(err);
  });
}

function prepareForSync(numberOfOfflineDocs, callback, callbackParam) {
  callback = callback || noop;
  var offlineDocObjectsReadyToSync = {};

  showSyncingProgress(0, numberOfOfflineDocs);
  offlineStorage.iterate(function(doc, did, docNo) {
    var theEncryptedDelta = JSON.parse(doc.content).data;
    decrypt(theEncryptedDelta, [keyToRemember]).then(function(plaintext) {
      var decryptedDelta = plaintext.data;
      doc.content = decryptedDelta;
      offlineDocObjectsReadyToSync[did] = doc;
      if (docNo === numberOfOfflineDocs) {
        // GOT THE LAST ONE DECRYPTED TOO, START ENUMERATING
        enumerateForSync(offlineDocObjectsReadyToSync, callback, callbackParam);
      }
    }).catch(function(err) {
      offlineStorage.removeItem(did);
      showErrorBubble("Error decrypting offline doc(s), removed for security.", err);
      handleError(err);
      syncCompleted(callback, callbackParam);
    });
  }).catch(function(err) {
    showErrorBubble("Error getting offline documents to sync", err);
    handleError(err);
    syncCompleted(callback, callbackParam);
  });

}

var numberOfDocsToSync = 0;
var numberOfDocsCompletedSync = 0;
function enumerateForSync (offlineDocObjectsReadyToSync, callback, callbackParam) {
  callback = callback || noop;

  // now we have unencrypted content updated offlineDocs in this object.
  // use this object to check for generations in server, and update them one by one if the server is outdated.

  var didsToSync = Object.keys(offlineDocObjectsReadyToSync);
  numberOfDocsToSync = didsToSync.length;

  didsToSync.forEach(function(did){
    var docToCheck = offlineDocObjectsReadyToSync[did];
    compareDocGensForSync(docToCheck, callback, callbackParam);
  });

}

function compareDocGensForSync(doc, callback, callbackParam) {
  callback = callback || noop;
  var did = doc.did;
  var offlineGen = doc.gen;
  var onlineGen;
  var docRef = rootRef.child(did + ".crypteedoc");
  docRef.getMetadata().then(function(metadata) {
    onlineGen = metadata.generation;
    if (onlineGen < offlineGen) {
      // OFFLINE IS NEWER. UPLOAD OFFLINE TO ONLINE
      upSyncOfflineDoc(doc, docRef, callback, callbackParam);
    } else if (onlineGen > offlineGen) {
      // ONLINE IS NEWER. DOWNLOAD ONLINE TO OFFLINE
      downSyncOnlineDoc(doc, docRef, onlineGen, callback, callbackParam);
    } else {
      // THEY'RE THE SAME. SKIP.
      skipSyncingDoc(callback, callbackParam);
    }
  }).catch(function(err) {
    if (err.code === "storage/object-not-found") {
      // online doc doesn't exist. upload and create it.
      upSyncOfflineDoc(doc, docRef, callback, callbackParam);
    } else {
      skipSyncingDoc(callback, callbackParam);
      showErrorBubble("Error getting version of "+doc.name+" for sync", err);
      handleError(err);
    }
  });
}

function upSyncOfflineDoc (doc, docRef, callback, callbackParam) {
  callback = callback || noop;
  var did = doc.did;
  var fid = doc.fid;
  var fname = doc.fname;
  var plaintextDocDelta = doc.content;
  var dtitle = doc.name;
  var dtags = doc.tags || [];
  encrypt(plaintextDocDelta, [theKey]).then(function(ciphertext) {
      var encryptedDocDelta = JSON.stringify(ciphertext);
      var syncUpload = docRef.putString(encryptedDocDelta);
      syncUpload.on('state_changed', function(snapshot){
        // if (snapshot.bytesTransferred === snapshot.totalBytes) {
        //   // UPLOAD COMPLETE USED TO BE HERE
        // }
      }, function(error) {
        if (usedStorage >= allowedStorage) {
          skipSyncingDoc (callback, callbackParam);
          exceededStorage(callback, callbackParam);
        } else {
          forceCheckConnection();
          setTimeout(function(){
            upSyncOfflineDoc (doc, docRef, callback, callbackParam);
          }, 3000);
        }
      }, function (){
        // UPLOAD COMPLETE

        if (did !== "home") {

          foldersRef.child(fid + "/docs/" + did).once('value', function(onlineDocSnap) {
            // Doc already exists on server, no need to create folder or anything like that. just save it.
            if (onlineDocSnap.val()) {
              saveDocData();
            } else {
              // doc is new, or doesn't exist on server anymore.

              // start by making sure crucial folder details are there first.
              // this is harmless if folder already exists, and if it doesn't this will create an uncat folder :)

              foldersRef.child(fid).once('value', function(doesItExistSnapshot) {
                var folderExists = false;
                if (doesItExistSnapshot.val() !== null) {
                  folderExists = true;
                }

                foldersRef.child(fid).update({folderid: fid} , function(){
                  // if folder didn't exist on server, until we just created it.
                  // say if it's the first uncat folder for example or if user deleted folder and was offline etc. idk weird shit happens.

                  if (!folderExists) {

                      // set folder title too and we should be good to go.
                      // if it's a new uncat folder set title here, if it's an existing file's folder no need to touch this.
                      var folderTitleToUpdate;
                      if (fid === "f-uncat") {
                        folderTitleToUpdate = JSON.stringify("Inbox");
                      } else {
                        fNameToUpdate = titleOf(fid) || doc.fname || "Inbox";
                        folderTitleToUpdate = JSON.stringify(fNameToUpdate);
                      }

                      updateFolderTitle (fid, folderTitleToUpdate, function(){
                        saveDocData();
                      });

                  } else {
                    saveDocData();
                  }
                });
              });
            }
          });

        } else {
          var genToSyncUp = doc.gen || (new Date()).getTime() * 1000;
          dataRef.update({"homegeneration" : genToSyncUp}, function(){
            if (catalog.docs.home) {

              // this is so ugly and so terrible, but seems like it could fix the issue. 
              // for some reason home isn't in catalog. This is only going to be a problem until the next boot.
              // since the generation is already updated + tags aren't as critically important for any operations

              catalog.docs.home.tags = dtags;
              catalog.docs.home.gen = genToSyncUp;
            }

            doneSyncingDoc (callback, callbackParam);
          }).catch(function(err) {
            skipSyncingDoc(callback, callbackParam);
            showErrorBubble("Error setting generation of "+doc.name+" during sync", err);
            handleError(err);
          });
        }

      });
  }).catch(function(err) {
    skipSyncingDoc(callback, callbackParam);
    showErrorBubble("Error encrypting "+doc.name+" during sync", err);
    handleError(err);
  });

  function saveDocData () {
    var genToSyncUp = doc.gen || (new Date()).getTime() * 1000;
    encryptTitle(did, JSON.stringify(dtitle), function(encryptedTitle){
      encryptTags(did, dtags, function(encryptedTagsArray) {
        var docData = { docid : did, fid : fid, generation : genToSyncUp, title : encryptedTitle, tags : encryptedTagsArray };
        foldersRef.child(fid + "/docs/" + did).update(docData, function(){
          
          // in case if catalog.docs[doc.did] is undefined
          catalog.docs[doc.did] = catalog.docs[doc.did] || {};
          catalog.docs[doc.did].tags = dtags;
          catalog.docs[doc.did].gen = genToSyncUp;

          doneSyncingDoc (callback, callbackParam);
        }).catch(function(err) {
          skipSyncingDoc(callback, callbackParam);
          showErrorBubble("Error setting generation of "+doc.name+" during sync", err);
          handleError(err);
        });
      });
    });
  }

}

function downSyncOnlineDoc (doc, docRef, onlineGen, callback, callbackParam) {
  callback = callback || noop;
  var did = doc.did;
  var newGenToSet = onlineGen;
  var plaintextDocDelta;

  ///////////////////////////////////////////////////////////////////////////
  // GET THESE FROM CATALOG. THESE SHOULD BE IN MEMORY NOW. //
  ///////////////////////////////////////////////////////////////////////////

  var tags;
  if (catalog.docs[did]) {
    tags = catalog.docs[did].tags || [];
  } else {
    tags = [];
  }

  var fid;
  var dtitle;
  var fname;

  if (did === "home") {
    dtitle = "Home";
    fid = "f-uncat";
    fname = "Inbox";
  } else {
    fid = fidOfDID(did);
    dtitle = titleOf(did);
    fname = titleOf(fid);
  }

  ///////////////////////////////////////////////////////////////////////////
  ///////////////////////////////////////////////////////////////////////////

  docRef.getDownloadURL().then(function(docURL) {
    $.ajax({ url: docURL, type: 'GET',
        success: function(encryptedDocDelta){
          var theStrongKeyEncryptedDelta = JSON.parse(encryptedDocDelta).data;
          decrypt(theStrongKeyEncryptedDelta, [theKey]).then(function(plaintext) {
            plaintextDocDelta = plaintext.data;
            encrypt(plaintextDocDelta, [keyToRemember]).then(function(ciphertext) {
              var hashKeyEncryptedDocDelta = JSON.stringify(ciphertext);

              var offlineDocObject = {
                did : did, // "d-1234567890"
                name : dtitle, // "An Offline Document"
                content : hashKeyEncryptedDocDelta, // serialized Quill Deltas
                gen : newGenToSet, // "savetime"
                fid : fid, // fid to upload to once online
                fname : fname, // foldername
                tags : tags // ["tag1, "tag2", "tag3"]
              };

              offlineStorage.setItem(did, offlineDocObject).then(function () {
                doneSyncingDoc (callback, callbackParam);
              }).catch(function(err) {
                skipSyncingDoc(callback, callbackParam);
                if (err.code === 22) {
                  // USER EXCEEDED STORAGE QUOTA. 
                  breadcrumb("Exceeded Storage Quota. (" + storageDriver + ")");
                  showWarningModal("offline-storage-full-modal");
                } else {
                  showErrorBubble("Error saving "+dtitle+" during sync", err);
                }
                handleError(err);
              });
            }).catch(function(err) {
              skipSyncingDoc(callback, callbackParam);
              showErrorBubble("Error with encryption of "+dtitle+" during sync", err);
              handleError(err);
            });
          }).catch(function(err) {
            skipSyncingDoc(callback, callbackParam);
            showErrorBubble("Error with encryption of "+dtitle+" during sync", err);
            handleError(err);
          });
        },
        error:function (xhr, ajaxOptions, thrownError){
          skipSyncingDoc(callback, callbackParam);
          showErrorBubble("Error getting "+dtitle+" for sync", thrownError);
          handleError(thrownError);
        }
    });

  }).catch(function(err) {
    skipSyncingDoc(callback, callbackParam);
    showErrorBubble("Error getting "+dtitle+" for sync", err);
    handleError(err);
  });

}








function skipSyncingDoc (callback, callbackParam) {
  callback = callback || noop;
  doneSyncingDoc (callback, callbackParam);
}

function doneSyncingDoc (callback, callbackParam) {
  callback = callback || noop;
  numberOfDocsCompletedSync++;
  showSyncingProgress(numberOfDocsCompletedSync, numberOfDocsToSync);
  if (numberOfDocsCompletedSync === numberOfDocsToSync) {
    upSyncAndDownSyncComplete (callback, callbackParam);
  }
}

function upSyncAndDownSyncComplete (callback, callbackParam) {
  callback = callback || noop;
  updateFolderIndexes();
  syncCompleted (callback, callbackParam);
}

function syncCompleted (callback, callbackParam) {
  callback = callback || noop;

  showSyncingProgress(); // this will receive 100 / 100 since it's already complete.
  $("#sync-progress").addClass("done");
  $(".sync-details").html("Sync Complete");
  setTimeout(function () {
    hideSyncingProgress();
  }, 7500);
  numberOfDocsToSync = 0;
  numberOfDocsCompletedSync = 0;
  initialSyncComplete = true;
  callback(callbackParam);
  reportOfflineErrors();
}

var syncErrors = [];
function showErrorBubble(message, err) {
  // serialize and deserialize to remove functions from err object, localforage can't save functions in objects.
  var errorObj;
  if (err) {
    errorObj = JSON.parse(JSON.stringify(err));
  } else {
    errorObj = null;
  }

  error = errorObj || "";
  message = message || "Error";

  var now = (new Date()).getTime().toString();
  offlineErrorStorage.setItem(now, error);

  $(".error-bubble-details").html(message + "&nbsp; <span onclick='hideErrorBubble();' class='icon is-small clickable'><i class='fa fa-close fa-fw'></i></span>");
  $("#error-bubble").addClass("errored");
}

function reportOfflineErrors () {
  offlineErrorStorage.iterate(function(syncerr, errtime, i) {
    handleError(syncerr, "offline");
  }).then(function() {
    // Reported all offline errors.
    try { offlineErrorStorage.clear(); } catch (e) {}
  }).catch(function(err) {
    handleError(err);
  });
}

function hideErrorBubble() {
  $("#error-bubble").removeClass("errored");
  setTimeout(function () {
    $(".error-bubble-details").html("");
  }, 5000);
}

function showGotConnectionBubble () {
  $("#got-connection").addClass("connected");
}

function restartToOnlineMode () {
  saveOfflineDoc(function(){
    sessionStorage.setItem("key", JSON.stringify(keyToRemember));
    window.location.reload();
  });
}

function showNoOfflineDocs () {
  $("#no-offline-docs-to-show").addClass("shown");
}

function hideNoOfflineDocs () {
  $("#no-offline-docs-to-show").removeClass("shown");
}

$("#doc-dropdown").on('click touchend', '.offlinecheckbox', function(event) {
  var did = rightClickedID();
  var offline = catalog.docs[did].isoffline;
  
  if (offline) {
    // remove from offline
    removeOfflineDoc(did);
  } else {
    // add to offline
    makeOfflineDoc(did);
  }

  hideRightClickMenu();
});

$("#doc-dropdown").on('click', '.offline-button', function(event) {
  if (!$(event.target).is(".crypteecheckbox")) {
    $("#doc-dropdown").find(".offlinecheckbox").click();
  }
});

$("#folder-dropdown").on('click touchend', '.offlinecheckbox', function(event) {
  var fid = rightClickedID();
  
  var checked = $("#folder-dropdown").find(".offlinecheckbox").prop("checked");
  
  // timeout to make sure checkbox is selected or unselected.
  setTimeout(function () {
     $.each(catalog.docs, function(did, doc){
      if (doc.fid === fid && !doc.isfile) {
        if (checked) {
          if (!doc.isoffline) {
            makeOfflineDoc(did);
          }
        } else {
          removeOfflineDoc(did);
        }
      }
    });  
    hideRightClickMenu();
  }, 50);

});

$("#folder-dropdown").on('click', '.offline-button', function(event) {
  if (!$(event.target).is(".crypteecheckbox")) {
    $("#folder-dropdown").find(".offlinecheckbox").click();
  }
});

function docMadeAvailableOffline(did) {
  catalog.docs[did] = catalog.docs[did] || {};
  catalog.docs[did].isoffline = true;
  breadcrumb("Made " + did + " offline.");
  addOfflineBadgeToDoc(did);

  if (activeDocID === did) {
    $(".dropdown-makeoffline-button").hide();
    $(".dropdown-makeonline-button").show();
  }
}

function docMadeOnlineOnly(did) {
  catalog.docs[did] = catalog.docs[did] || {};
  catalog.docs[did].isoffline = false;
  breadcrumb("Made " + did + " online only.");
  removeOfflineBadgeOfDoc(did);
  
  if (activeDocID === did) {
    $(".dropdown-makeoffline-button").show();
    $(".dropdown-makeonline-button").hide();
  }
}













///////////////////////////////////////////////////////////
/////////////////////// SECTIONS  /////////////////////////
///////////////////////////////////////////////////////////

var sectionsArray = [];
var sectionsIndex = 0;
function generateSections () {
  sectionsArray = [];
  sectionsIndex = 0;
  $("#doc-sections").html("");
  $(".ql-editor").children().each(function(i,section){
    var tagName = $(section).prop("tagName");
    if (tagName === "H1" || tagName === "H2" || tagName === "H3") {
      var sectionText = $(section).text();
      if (sectionText.trim() !== "") {
        $("#doc-sections").append('<p class="docsection '+tagName+'" index="'+sectionsIndex+'">'+ sectionText +'</p>');
        sectionsArray.push($(section));
        sectionsIndex++;
      }
    }
  });
}

$("#doc-sections").on('click', '.docsection', function() {
  var targetIndex = $(this).attr("index");
  targetSection = sectionsArray[targetIndex];
  var targetOffset = targetSection[0].offsetTop;
  $(targetSection[0]).addClass("highlighted");
  setTimeout(function () { $(targetSection[0]).removeClass("highlighted"); }, 2000);
  $('.ql-editor').animate({ scrollTop: targetOffset - 75}, 750);
});

var quillScrollTimeout;
$(".ql-editor").on('scroll', throttleScroll(function(event) {
  lastActivityTime = (new Date()).getTime();
  clearTimeout(quillScrollTimeout);
  quillScrollTimeout = setTimeout(function() {
    sectionsArray.forEach(function(section, i){
      if (isScrolledIntoView(section[0])) {
        $(".docsection[index='"+i+"']").addClass("inview");
      } else {
        $(".docsection[index='"+i+"']").removeClass("inview");
      }
    });
	}, 300);
}, 100));

///////////////////////////////////////////////////////////
///////////////////// WORD COUNT  /////////////////////////
///////////////////////////////////////////////////////////


function wordCount() {
  var text = quill.getText().trim();
  // Splitting empty text returns a non-empty array
  var count = text.length > 0 ? text.split(/\s+/).length : 0;
  return count;
}

function charCount() {
  var text = quill.getText().trim();
  var count = text.length;
  return count;
}

function updateCounts() {
  var words = wordCount();
  var chars = charCount();

  var wCountString = words + " " + "word";
  if (words !== 1) { wCountString += 's'; }

  var cCountString = chars + " " + "char";
  if (chars !== 1) { cCountString += 's'; }

  $("#word-count").html(wCountString);
  $("#char-count").html(cCountString);
}
















//
