var theKey, encryptedStrongKey;
var gotKey = false; // this prevents an early offline mode call from being made before key is typed.

var keyToRemember = JSON.parse(sessionStorage.getItem('key')); // hashedkey

if (localStorage.getItem('memorizedKey')) {
  keyToRemember = JSON.parse(localStorage.getItem('memorizedKey')); // hashedKey
}

var encryptedKeycheck; // a timestamp encrypted with hashedKey to verify the hashedKey in offline mode.
if (localStorage.getItem("encryptedKeycheck")) {
  encryptedKeycheck = JSON.parse(localStorage.getItem("encryptedKeycheck")).data;
}

sessionStorage.removeItem('key');

var offlineStorage = localforage.createInstance({ name: "offlineStorage" });
var offlineErrorStorage = localforage.createInstance({ name: "offlineErrorStorage" });
var encryptedIndexedCatalog = localforage.createInstance({ name: "encryptedIndexedCatalog" });
var storageDriver = localforage.driver();

var thereIsALocalEncryptedCatalog = false;
initalizeLocalCatalog();

var cloudfunctions = firebase.functions();

var foldersRef;
var minuteTimer;
var idleTime = 0;
var lastActivityTime = (new Date()).getTime();
var newAccount = false;

var lastSaved = (new Date()).getTime();
var lastScrollTop = 0;
var docChanged;
var currentGeneration;
var saveUpload;

var idleInterval = setInterval(idleTimer, 1000);
var inactivityInterval = setInterval(inactiveTimer, 1000);
var everyFifteenSecondsInterval = setInterval(quarterMinutelyTimer, 15000);

var connected = true;
var startedOffline = false;
var connectivityMode = true; // true = online // false = offline
var viewingMode = false;

setSentryTag("offline-driver", storageDriver);
setSentryTag("quill-ver", Quill.version);

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

var decryptingFoldersTimeout;
var activeDocTitle;
var activeDocID;
var activeDocAttachments = [];

var activeFolderID;


var catalog = {"docs" : {}, "folders" : {}};
// catalog.docs , catalog.folders etc. this will carry ids, titles etc. former titles Obj and docs Array but better.

var catalogReadyForDecryption = false;
var bootCatalogDecrypted = false;
var titlesIndividuallyEncrypted = false || JSON.parse(localStorage.getItem('tie')); // "tie" = false/true in database
var lastOpenDocID;
var lastOpenDocPreloadedDelta = null;

var foldersOrderObject = {};
var activeFileContents;
var activeFileTitle;
var activeFileID;

var isSaving = false;
var settingsOpen = false;
var firstDocLoadComplete = false;
var initialSyncComplete = false;
var initialDecryptComplete = false;
var docIsBeingSorted = false;
var numFilesLeftToBeUploaded = 0;
var fileUploadError = false;
var menuBeforeDrag;
var somethingDropped = false;

var isDocOutdated = false;
var menuClosedDueToOffline = false;
var desktopCutOffWidthPixel = 1097;

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
var markdownConverter = new showdown.Converter({
  ghCompatibleHeaderId:true,
  simplifiedAutoLink: true,
  excludeTrailingPunctuationFromURLs : true,
  strikethrough: true,
  tasklists: true
});

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
  if (range) {
    quill.insertText(range.index, '\n', Quill.sources.USER);  
    quill.insertEmbed(range.index + 1, 'divider', true, Quill.sources.USER);
    quill.setSelection(range.index + 2, Quill.sources.SILENT);
  }
});


var IMAGE_MIME_REGEX = /^image\/(p?jpeg|gif|png)$/i;
document.onpaste = function(e){
  if (e.clipboardData) {
    var items = e.clipboardData.items;
    if (items) {
      for (var i = 0; i < items.length; i++) {        
        if (IMAGE_MIME_REGEX.test(items[i].type)) {        
          processEmbedImage (items[i].getAsFile());
          // to prevent image from pasting twice (it fires twice for some reason)
          e.preventDefault();
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
    node.contentEditable = 'false';
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
    node.contentEditable = 'false';
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
      } else if (context.format['code-block']) {
        if (context.collapsed && context.empty && context.offset < 1) {
          this.quill.format('code-block', false);
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


var fonts = ['Alef', 'Arial', 'Comic Sans MS', 'Courier', 'Georgia', 'Helvetica', 'Markazi', 'Montserrat', 'Palatino', 'Tahoma', 'Times New Roman', 'Verdana'];
var fontNames = [];
var fontStyles = "";
var fontOptions = "";

fonts.forEach(function(font) {
  var fontName = font.toLowerCase().replace(/\s/g, "-");
  fontNames.push(fontName);
  fontStyles += ".ql-snow .ql-picker.ql-font .ql-picker-label[data-value=" + fontName + "]::before, .ql-snow .ql-picker.ql-font .ql-picker-item[data-value=" + fontName + "]::before { content: '" + font + "'; font-family: '" + font + "', sans-serif; } .ql-font-" + fontName + "{ font-family: '" + font + "', sans-serif; }";
  fontOptions += "<option value='"+fontName+"'>"+ font +"</option>";
});

var node = document.createElement('style');
node.innerHTML = fontStyles;
document.body.appendChild(node);
$(".ql-font").append("<option value='sans-serif' selected>Default</option>");
$(".ql-font").append(fontOptions);

// Add fonts to whitelist
var Font = Quill.import('formats/font');
Font.whitelist = fontNames;
Quill.register(Font, true);

var quillBaseConfig = {
  modules: {
    formula: true,
    syntax: true,
    magicUrl: {
      globalRegularExpression: URLRegex,
      urlRegularExpression: URLRegex
    },
    markdownShortcuts: {},
    keyboard: {
      bindings: quillkeyboardbindings
    }
  }
};

if (isMobile) {

  var toolbarOptions = {
    handlers: quillhandlers,
    container: '#mobile-toolbar'
  };

  quillBaseConfig.modules.toolbar = toolbarOptions;
  quillBaseConfig.theme = 'bubble';
  quillBaseConfig.bounds = "#docs-page-wrap";

  var quill = new Quill('#docs-page-wrap', quillBaseConfig);

} else {

  var toolbarOptions = {
    handlers: quillhandlers,
    container: '#editor-toolbar'
  };

  quillBaseConfig.modules.toolbar = toolbarOptions;  
  quillBaseConfig.theme = 'snow';
  if (!isipados) {
    quillBaseConfig.modules.imageResize = {};
  }

  var quill = new Quill('#docs-page-wrap', quillBaseConfig);
}

quill.clipboard.addMatcher('img', function(node, delta) { 
  var src = $(node).attr("src");
  if (src) {
    if (src.startsWith("http:")) {
      // TODO : CONSIDER ADDING A "PASTE ANYWAY POPUP"
      breadcrumb('[Clipboard] Detected insecure image element!');
      showErrorBubble("Detected an image from an insecure source. For your own safety, please copy paste the image itself.");
      return {ops : [{insert:""}]};
    } else {
      return delta; 
    }
  } else {
    return delta; 
  }
});
quill.clipboard.addMatcher('span', function(node, delta) { return delta; });
quill.clipboard.addMatcher('div', function(node, delta) { return delta; });

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
  if (quill.getFormat()['code-block'] || quill.getFormat().blockquote || quill.getFormat().bold || quill.getFormat().header === 1 || quill.getFormat().header === 2) {
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

$('.ql-editor').on('click', function(event) {
  if (event.target.tagName.toLowerCase() === 'a') {
    // event.preventDefault();
    showURLBox(event.target.href);
  } else {
    hideURLBox();
  }

  if ($(".ql-editor p:last-child crypteefile").length === 1) {
    // first item is a crypteefile (attachment, won't receive focus. add another p before)
    $(".ql-editor").append("<p></p>");
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

  lastActivityTime = (new Date()).getTime();

  $(".document-contextual-dropdown").removeClass("open");
});

if (isios) { $("#docs-url-box").addClass("isios"); }
function showURLBox(href) {
  $("#docs-url-box").find("a").attr("href", href);
  $("#docs-url-box").find("a").html(href);
  if (isMobile) { $("#docs-url-box").addClass("is-visible"); }
}

function hideURLBox() {
  if (isMobile) { $("#docs-url-box").removeClass("is-visible"); }
  $("#docs-url-box").find("a").attr("href", "");
  $("#docs-url-box").find("a").html("");
}

$("#mobile-floating-undo").on("click", function(){
  quill.history.undo();
  quill.root.blur();
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

key('command+shift+alt+s, ctrl+shift+alt+s', function(){
  exportAsHTML(null, true);
  return false;
});

key('command+shift+k, ctrl+shift+k', function(){ 
  showEmbed("formula"); 
  return false; 
});

key('command+shift+6, ctrl+shift+6', function(){

  var curFormat = quill.getFormat();
  var range = quill.getSelection();

  if (curFormat.list === "unchecked" || curFormat.list === "checked") {
    quill.removeFormat(range.index);
  } else {
    if (isMobile) {
      $("#checkbox-button").click();
    } else {
      $(".ql-list[value='check']").click();
    }
  }

  return false;
});

key('command+shift+7, ctrl+shift+7', function(){ 
  var curFormat = quill.getFormat();
  var range = quill.getSelection();
  if (curFormat.list === "ordered") {
    quill.removeFormat(range.index);
  } else {
    quill.format('list', 'ordered');
  }
  return false; 
});

key('command+shift+8, ctrl+shift+8', function(){ 
  var curFormat = quill.getFormat();
  var range = quill.getSelection();
  if (curFormat.list === "bullet") {
    quill.removeFormat(range.index);
  } else {
    quill.format('list', 'bullet');
  }
  return false; 
});

key('command+shift+s, ctrl+shift+s', function(){ 
  $(".ql-strike").click(); 
  return false;
});

key('command+/, ctrl+/', function(){ 
  toggleHotkeys(); 
  return false; 
});

key('command+., ctrl+.', function(){
  $("#hamburger").click();
  return false;
});

key('command+\\, ctrl+\\', function(){
  $(".ql-clean").click();
  return false;
});

key('command+a, ctrl+a', function(){ 
  var toReturnOrNotTo = true;
  // if a selection exists, left panel is visible and editor doesn't have focus, 
  // and it's files in a folder (not recent since it would be selecting all docs) then select all visible files
  if (selectionArray.length > 0 && $(".showLeft").length > 1 && !quill.hasFocus() && activeFolderID !== "root") {
    $("#all-active-folder-contents").children().each(function(i, sel) {
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
    if (isMobile || isipados) {
      // HIDE
      hideMenu();
    }
});

$("body").on('swiperight',  function(){
    if (isMobile || isipados) {
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
  
  if ($(e.target).is("#all-active-folder-contents")) {
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
  var id = $(event.target).parents(".doc").attr("did") || $(event.target).parents(".afolder").attr("id") || $(event.target).parents(".afolder").attr("fid") || $(event.target).attr("id") || $(event.target).attr("did");
  var decrypting = false;

  var x = event.pageX;
  var y = event.pageY;
  if (y > wh() - 260) {
    // tallest dropdown will be cutoff, 
    // so display it at lowest position instead;
    y = wh() - 260;
  }

  // IF IT'S NOT A SELECTIONS RIGHT CLICK MENU, CAPTURE THE ID OF THE DOCUMENT SELECTED
  if (selectionArray.length === 0) {
    if (!id.startsWith('f-') && !id.startsWith('d-')) {
      if (activeFolderID !== "root" && $(event.target).attr("id") === "all-active-folder-contents") {
        id = activeFolderID;
      }
    }

    if (id.startsWith('d-')) {
      var docElem = $(".doc[did='"+id+"']");
      if (docElem.hasClass("decrypting")) {
        decrypting = true;
      }

      if (!decrypting) {
        docElem.addClass("highlightedDoc");
      }
      
      // docs
      if (x > ww() - 210) {
        // make sure dropdown never shows up too far right on mobile devices with small screens.
        x = ww() - 210;
      }
    } else {
      
      //folders 
      if (x > ww() - 250) {
        // make sure dropdown never shows up too far right on mobile devices with small screens.
        x = ww() - 250;
      }
    }

    prepareRightClickFunctions(id);
  } else {
    prepareRightClickSelectionFunctions();
  }

  if (!decrypting) {
    $(whichOne).addClass("shown").css({
      top: y + "px",
      left: x + "px"
    }).attr("selectedID", id);
  }
}

function hideRightClickMenu ( whichOne ) {
  whichOne = whichOne || ".crypteedropdown";
  $(whichOne).removeClass("shown").attr("selectedID", "");
  $(whichOne).find(".offlinecheckbox").prop("checked", false);
  $(".highlightedDoc").removeClass("highlightedDoc");
}

$("#all-folders, #results").on('click', '.folder-dropdown-button', function(e) {
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
  var title = catalog.docs[id].name || "Untitled Document";
  var ext = (extensionFromFilename(title) || "").toLowerCase();

  var offlineDisabled = false;
  var downloadDisabled = false;
  var moveDisabled = false;
  var renameDisabled = false;
  var attachDisabled = false;
  
  if (isFile) {
    offlineDisabled = offlineDisabled || true;
  } else {
    downloadDisabled = downloadDisabled || true;
    offlineStorage.getItem(id, function (err, offlineDoc) {
      if (err) { 
        err.isFile = isFile;
        err.did = did;
        handleError("Error getting offline document from storage", err); 
      }
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
    // moveDisabled = moveDisabled || true;
    attachDisabled = attachDisabled || true;
  } else {
    attachDisabled = attachDisabled || false;
    // moveDisabled = moveDisabled || false;
  }

  if (id === activeDocID) {
    attachDisabled = attachDisabled || true;
  } else {
    attachDisabled = attachDisabled || false;
  }
  
  if (["jpg", "jpeg", "png", "gif"].indexOf(ext) !== -1) {
    dd.find(".embed-button").show();
  } else {
    dd.find(".embed-button").hide();
  }

  if (moveDisabled)     { dd.find(".move-button").addClass("disabled"); }
  if (renameDisabled)   { dd.find(".rename-button").addClass("disabled"); }
  if (offlineDisabled)  { dd.find(".offline-button").addClass("disabled"); }
  if (downloadDisabled) { dd.find(".download-button").addClass("disabled"); }
  if (attachDisabled)   { dd.find(".attach-button").addClass("disabled"); }
}


function prepareRightClickFolderFunctions (id) {
  var fd = $("#folder-dropdown");
  var areThereAnyOnlineOnlyDocs = false;
  var howManyDocs = 0;
  fd.find(".upload-file-button").find("label").attr("for", 'upload-to-' + id);
  
  var renameDisabled = false;
  var ghostDisabled = false;
  var archiveDisabled = false;
  var moveDisabled = false;
  
  if (id === "f-uncat") {
    renameDisabled = renameDisabled || true;
    ghostDisabled = ghostDisabled || true;
    archiveDisabled = archiveDisabled || true;
    moveDisabled = moveDisabled || true;
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
    if (howManyDocs > 0) {
      fd.find(".offlinecheckbox").prop('checked', true);
    } else {
      fd.find(".offlinecheckbox").prop('checked', false);
    }
  }

  if (howManyDocs === 0 || catalog.folders[id].archived) {
    // renameDisabled = renameDisabled || true;
    ghostDisabled = ghostDisabled || true;
    archiveDisabled = archiveDisabled || true;
  }

  if (renameDisabled)   { fd.find(".rename-button").addClass("disabled");  }
  if (ghostDisabled)    { fd.find(".ghost-button").addClass("disabled");   }
  if (archiveDisabled)  { fd.find(".archive-button").addClass("disabled"); }
  if (moveDisabled)     { fd.find(".move-button").addClass("disabled"); }  
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
    if (!viewingMode) {
      wrappersToMove.addClass("showLeft");
      hideWebClips();
    }
  }, function () {
    if ( isItSafeToHideMenu() ) {
      if (!viewingMode) {
        wrappersToMove.removeClass("showLeft");
      }
    }
  });

  $("#docs-right-wrap").hover(function() {
    if (dragCounter === 0) {
      updateCounts();
      // don't forget to account for file drops just in case.

    }
  }, function () {
    if (!viewingMode) {
      // wrappersToMove.removeClass("showRight");
    }
  });
}


var thingsNeedResizing = "#help-button, #hotkeys-button, #webclips-button, #toolbar-container, #editor-toolbar, #docs-left-top, #docs-left-center, #docs-left-bottom, #docs-center-wrap, #docs-right-wrap, #mobile-topbar, #doc-contextual-buttons, #doc-contextual-button, #docs-page-wrap, #file-viewer, #all-folders, #main-progress, .filesize-button, .save-doc-button, #doc-top, #hamburger, .docs-float-context, .mobile-floating-tools";
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
    $("#viewing-mode-button").hide();
  } else {
    $("#viewing-mode-button").show();
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

function newUserHints() {
  if (Object.keys(catalog.folders).length > 0) {
    $(".first-folder-hint").slideUp();
  } else {
    $(".first-folder-hint").slideDown();
  }

  var dids = Object.keys(catalog.docs);
  var catalogHasHome = dids.includes("home");
  var numberOfDocs = dids.length;
  if (catalogHasHome) { numberOfDocs = dids.length - 1; }

  if (numberOfDocs >= 1) {
    $(".first-doc-hint").slideUp();
  } else {
    $(".first-doc-hint").slideDown();
  }
}

function firstDocLoaded() {
  // FINISHED LOADING THE "LAST OPEN DOC"
  // DISPLAYED UI. 

  // IF WE STARTED WITH A LOCAL CATALOG, WE'LL NOW SHOW THE SYNC BANNER, AND START UPDATING LOCAL CATALOG WITH CHANGES. 
  // IF WE STARTED WITHOUT A LOCAL CATALOG, WE ALREADY HAVE ALL TITLES IN THE CATALOG AND WE'RE READY. 

  // THIS IS THE LAST STEP TO BE EXECUTED AFTER "SIGN IN COMPLETE".

  if (!firstDocLoadComplete) {
    breadcrumb('First Doc Loaded');
    firstDocLoadComplete = true;

    $(".firstLoad").removeClass("firstLoad");

    newUserHints();
    updateArchivedFolders();
    logTimeEnd("Time Until UI"); // if key is not in memory this includes user typing time.

    setTimeout(function () { // this is for UX
      $("#doc-contextual-buttons").show();
      arrangeTools();

      if (thereIsALocalEncryptedCatalog) {
        runTTQueueFromIndex(0);
      } else {
        updateLocalCatalog();
      }
      
    }, 1000);
  }
}

function showMenu () {
  if (!viewingMode) {
    if (isMobile) {
      $("#help-button, #hotkeys-button").addClass("shown");
    }
    wrappersToMove.addClass("showLeft");
    hideWebClips();
    $(".document-contextual-dropdown").removeClass("open");
    checkAndSaveDocIfNecessary();
  }
}

function hideMenu () {
  if (!viewingMode) {
    if (isMobile) {
      $("#help-button, #hotkeys-button").removeClass("shown");
      $(".filesize-button, .mobile-floating-tools").removeClass('menuOpen');
    }
    wrappersToMove.removeClass("showLeft");
    clearSearch();
    hideRightClickMenu();
  }
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

function toggleViewingMode() {
  $("body").toggleClass("viewing-mode");
  $(".document-contextual-dropdown").removeClass("open");
  
  if (viewingMode) {
    viewingMode = false;
    quill.enable();
    $("#viewing-mode-label").html("Viewing Mode");
  } else {
    viewingMode = true;
    quill.disable();
    clearSearch();
    clearSelections();
    $("#viewing-mode-label").html("Editing Mode");
  }
}

// lock document
var editLock = false;
function toggleEditLock() {
  $(".document-contextual-dropdown").removeClass("open");
  var did = activeDocID;
  if (editLock) {
    unlockEditor();
    updateEditLock(did, false);
  } else {
    lockEditor();
    updateEditLock(did, true);
  }
}

function updateEditLock(did, lock, callback, callbackParam) {
  if (did) {
    lock = lock || false;
    callback = callback || noop;
    var fid = fidOfDID(did);
    if (fid) {
      foldersRef.child(fid + "/docs/" + did).update({"islocked" : lock}, function(error) {
        if (error) { 
          error.did = did;
          error.fid = fid;
          handleError("Error locking doc", error); 
        } else {
          catalog.docs[did] = catalog.docs[did] || {};
          catalog.docs[did].islocked = lock;
          updateLocalCatalog();
        }
        callback(callbackParam);
      });
    } else {
      handleError("Can't lock doc without fid"); 
      callback(callbackParam);
    }
  } else {
    handleError("Can't lock doc without did"); 
    callback(callbackParam);
  }
}

function lockEditor() {
  editLock = true;
  quill.disable();
  clearSearch();
  clearSelections();
  $("#edit-lock-label").html("Unlock Edits");
  $(".docs-body").addClass("edits-locked");
}

function unlockEditor() {
  editLock = false;
  quill.enable();
  $("#edit-lock-label").html("Lock Edits");
  $(".docs-body").removeClass("edits-locked");
}

$("#editor-toolbar").on('click', function(event) {
  if (editLock) {
    unlockEditor(activeDocID);
  }
}); 

$("#mobile-topbar").on('click', function(event) {
  if (editLock && !$(event.target).is(".document-contextual-dropdown") && $(event.target).parents(".document-contextual-dropdown").length === 0 && !$(event.target).is("#doc-contextual-button") && $(event.target).parents("#doc-contextual-button").length === 0 && !$(event.target).is("#hamburger") && $(event.target).parents("#hamburger").length === 0) {
    unlockEditor(activeDocID);
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

function bootStepComplete(step) {
  var numberOfSteps = 4;
  $('#main-progress').attr("max", numberOfSteps).attr("value", step).removeClass("is-danger is-warning is-success");

  if (step >= numberOfSteps) {
    $('#main-progress').attr("max", "100").attr("value", "100").removeClass("is-danger is-warning is-success").addClass("is-success");
  }
}

////////////////////////////////////////////////////
///////////////// DOC CONTEXTUAL MENU   ////////////
////////////////////////////////////////////////////

function toggleContextualMenu () {
  
  $(".document-contextual-dropdown").toggleClass("open");
  $(".filesize-button, .mobile-floating-tools").toggleClass('menuOpen');
  
}

function prepareDocContextualButton(did) {
  if (did === "home") {
  
    $(".document-contextual-dropdown").find("p").addClass("homedoc");
    $(".document-contextual-dropdown").find("hr").addClass("homedoc");

    $("#homedoc").prop("disabled", true).attr("disabled", true);
    // $("#doc-contextual-button").fadeOut(100);
    $("#homedoc").addClass("is-dark");
  
  } else {
    
    $(".document-contextual-dropdown").find("p").removeClass("homedoc");
    $(".document-contextual-dropdown").find("hr").removeClass("homedoc");

    $("#homedoc").prop("disabled", false).attr("disabled", false);
    // $("#doc-contextual-button").fadeIn(100);
    $("#homedoc").removeClass("is-dark");
  
  }
}




////////////////////////////////////////////////////
////////////////// SIGN IN AND KEY /////////////////
////////////////////////////////////////////////////

// takes about 1000ms
logTimeStart("Authenticating");
logTimeStart("Time Until UI");

firebase.auth().onAuthStateChanged(function(user) {
  if (user) {
    //got user
    
    bootStepComplete(1);
    logTimeEnd("Authenticating");
    
    createUserDBReferences(user);

    logTimeStart("Checking User & Getting Keycheck");
    checkForExistingUser(function(){
      if (keyToRemember) {
        checkKey();
      } else {
        bootStepComplete(4);
        showKeyModal();
      }
    });

    //timeout so that on Auth State Changed promise doesn't wait for start user sockets.
    setTimeout(function () {
      startUserSockets();
    }, 2);
    

    getToken();
    webAppURLController();
  } else {
    // no user. redirect to sign in IF NOT WEBAPP
    webAppURLController("signin?redirect=docs");
  }
}, function(error){
  if (error) {
    if (error.code !== "auth/network-request-failed") {
      handleError("Error Authenticating", error);
    }
  }
});




var keyModalConnectionTimer;
function checkForExistingUser (callback){
  callback = callback || noop;

  // USING NAVIGATOR ONLINE TO SAVE TIME ON BOOT. 
  // NOT USING CHECK CONNECTION FIRST, BECAUSE IF MOBILE DEVICE IS OFFLINE,
  // THIS IS GOING TO TAKE 2 - 3 SECONDS AND MULTIPLE TRIES TO BOOT.

  // IF DEVICE IS ONLINE, IT'LL TAKE 1.5 SECONDS TO CONFIRM CAUSING A ROUNDTRIP DELAY.
  // INSTEAD WILL WAIT TILL THE DATABASE CALL FAILS. SHOULD SPEED UP ONLINE BOOT TIME.

  if (navigator.onLine) {

    // Takes about 500 - 750ms. DO NOT store this in localstorage to save time. 
    // if user changes their encryption key, and this is in localstorage,
    // old key would still allow access to the strongKey. 
    // Effectively rendering changing encryption key useless 
    if (theUserID) {
      db.ref('/users/' + theUserID + "/data/keycheck").once('value').then(function(snapshot) {
        if (snapshot.val() === null) {
          window.location = "signup?status=newuser";
        } else {

          // this is only here to upgrade the legacy titles system to the new one.
          // Once all users have tie = true in their accounts, you can remove this upgrader.
          // until then additional burden of this is only 200ms ONCE on each device.
          // after checking this once, we store it in localStorage, 
          // and should only be asked if localStorage is cleared
          bootStepComplete(2);
          logTimeEnd("Checking User & Getting Keycheck");
          if (!titlesIndividuallyEncrypted) {
            logTimeStart("Getting TIE");
            db.ref('/users/' + theUserID + "/data/tie").once('value').then(function(tieSnapshot) {
              if (tieSnapshot.val() === null) {
                titlesIndividuallyEncrypted = false;
              } else {
                titlesIndividuallyEncrypted = true;
                localStorage.setItem("tie", titlesIndividuallyEncrypted);
              }
              
              encryptedStrongKey = JSON.parse(snapshot.val()).data; // or encrypted checkstring for legacy accounts
              bootStepComplete(3);
              logTimeEnd("Getting TIE");
              callback();
            });
          } else {
            encryptedStrongKey = JSON.parse(snapshot.val()).data; // or encrypted checkstring for legacy accounts
            callback();
          }

        }
      }).catch(function(error){
        if (error) {
          if (error.code !== "auth/network-request-failed") {
            noNetwork();
          }
        }
      });
    } else {
      window.location = "signin";
    }
  } else {
    noNetwork();
  }
  

  function noNetwork() {
    console.log("Starting Offline");
    startedOffline = true;

    keyModalConnectionTimer = setInterval(function () {
      forceCheckConnection();
    }, 1000);

    callback();
  }
}




var localCatalogExists = false;

// THIS IS ONLY GOING TO GET CALLED IF THE USER IS ONLINE ON BOOT.
// SO IF "CONNECTED = TRUE"
// OTHERWISE WE WILL NOT CALL THIS ON BOOT.

function signInComplete () {
  
  // START DECRYPTING HERE.
  if (initialTTQueueReady) {
    if (newAccount) {
      ttQueueCompleted();
    } else {
      if (thereIsALocalEncryptedCatalog) {
        localCatalogExists = true;
        loadLocalCatalog(function(){
          loadLastOpenDoc();
        });
      } else {
        localCatalogExists = false;
        breadcrumb("Local Catalog : CREATING.");
        runTTQueueFromIndex(0);
      }
    }
    
    // load last open doc will get called in tt decryption queue complete

  } else {
    setTimeout(function () {
      signInComplete();
    }, 100);
  }
}


function startUserSockets () {
  logTimeStart('Loading User Data & Titles');
  /// CHECK IF IT'S A FRESH NEW ACOUNT WITH NO FOLDERS. 
  // even if user has anything in INBOX they'll go to into a folder. so 0 folders = fresh.
  foldersRef.orderByKey().limitToLast(1).once("value", function (snapshot) {
    if (!snapshot.val()) {
      // brand new account with nothing in it.
      newAccount = true;
      initialTTQueueReady = true;
    }
  });

  preloadLastOpenDoc();

  foldersRef.on('child_added', function(folder) {
    // add folder to dom & catalog.

    // This will add folders & docs's titles as well
    // but also WILL handle doc titles (and overwrite these) in
    // folder sockets -> /docs child_added as well
    var folderObj = folder.val();
    if (folderObj.ghosttitles) { folderObj.title = null; }
    
    appendFolder(folderObj, folder.key);
    // this adds all the socket listeners for the folder.
    startFolderSockets(folder.key); //folderid = folder.key (we're getting it from snapshot)

    if (folderObj.ghosttitles) {
      // GOT LEGACY GHOST FOLDER!!
      // THIS MEANS THIS GHOST FOLDER WAS CREATED BEFORE THE TITLES UPGRADE WAS MADE.
      // WHICH MEANS WE NEED TO DECRYPT THE GHOST TITLES, THEN E-ENCRYPT AND UPLOAD THEM INTO EACH DOC.
      
      var encryptedGhostTitlesObject = JSON.parse(folderObj.ghosttitles).data;
      decrypt(encryptedGhostTitlesObject, [theKey]).then(function(plaintext) {
        var ghostTitlesObject = JSON.parse(plaintext.data);
        processLegacyGhostTitles(ghostTitlesObject, folderObj);
      });
    }

  });

  foldersRef.on('child_removed', function(folder) {
    // remove folder and its docs from dom & catalog.
    //folderid = folder.key (we're getting it from snapshot)
    removeFolder(folder.key);
  });

  homeGenerationRef.on('value', function(gen) {
    var newHomeGen = gen.val();
    checkHomeGeneration(newHomeGen);
  });

  metaRef.on('value', function(userMeta) { gotMeta(userMeta); });
  dataRef.child("preferences").on('value', function(snapshot) { gotPreferences(snapshot.val()); });
  dataRef.child("clips").orderByKey().on('value', function(snapshot) { gotWebclips(snapshot.val()); });
  lazyLoadUncriticalAssets();
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
    // update encrypted titles & tags
    // the following will skip the addedEncryptedItemsToInMemoryCatalog and mark for decrypt there.
    // because we want these changes to go through immediately. 
    updateDocTitlesAndTagsInCatalog(doc.val());
    
    // update gen and other meta in catalog & dom
    updateDocMetaInCatalog(doc.val());
  });

  foldersRef.child(fid + "/archived").on('value', function(archiveBool) {
    // set folder archived status in dom & catalog
    setArchivedFolder(fid, archiveBool.val());
  });

  foldersRef.child(fid + "/title").on('value', function(encTitle) {
    if (encTitle.val()) {
      // this skips the addedEncryptedItemsToInMemoryCatalog and mark for decrypt there.
      // because we want these changes to go through immediately. 
      processEncryptedFolderTitle(fid, encTitle.val());
    }
  });

  foldersRef.child(fid + "/parent").on('value', function(parentFID) {
    // set folder parent status in dom & catalog
    folderMoved(fid, parentFID.val());
  });
}

var loadLastOpenDocWaiting = false;
function loadLastOpenDoc (waitingPreloadToDownload) {
  if (!waitingPreloadToDownload) {
    breadcrumb('Loading Last Open Document...');
  } else {
    if (!loadLastOpenDocWaiting) {
      loadLastOpenDocWaiting = true;
      breadcrumb('Waiting Last Open Document preload to complete...');
    }
  }
  $("#main-progress, .progressButtons, .filesize-button, .mobile-floating-tools, #doc-contextual-buttons, #toolbar-container").show();

  if (lastOpenDocID) {
    if (activeDocID) {
      if (activeDocID !== lastOpenDocID) {
        if (lastOpenDocPreloadedDelta) {
          loadDoc(lastOpenDocID, firstDocLoaded, lastOpenDocID, lastOpenDocPreloadedDelta);
        } else {
          setTimeout(function () {
            loadLastOpenDoc(true);
          }, 100);
        }
      }
    } else {
      if (lastOpenDocPreloadedDelta) {
        loadDoc(lastOpenDocID, firstDocLoaded, lastOpenDocID, lastOpenDocPreloadedDelta);
      } else {
        setTimeout(function () {
          loadLastOpenDoc(true); 
        }, 100);
      }
    }
  } else {
    if (activeDocID) {
      if (activeDocID !== "home") {
        loadDoc("home", firstDocLoaded, "home");
      }
    } else {
      loadDoc("home", firstDocLoaded, "home");
    }
  }

}

function preloadLastOpenDoc() {
  dataRef.child("lastOpenDocID").once('value', function(snapshot) {
    lastOpenDocID = snapshot.val();
    preload();
  });

  function preload() {
    if (lastOpenDocID && !startedOffline) {
      breadcrumb("PRELOAD: Fetching Generation");
      getFileMeta(lastOpenDocID + ".crypteedoc").then(function(preloadMeta) {
        var preloadGeneration = preloadMeta.generation;
        var preloadToken = preloadMeta.token;
        breadcrumb("PRELOAD: Got Server Generation");
        breadcrumb("PRELOAD: Checking For Offline Copy");
        offlineStorage.getItem(lastOpenDocID).then(function (offlineDoc) {
          if (offlineDoc) {
            var offlineGeneration = offlineDoc.gen;
            if (offlineGeneration > preloadGeneration) {
              // decrypt offline copy and use that instead. it's newer.
              breadcrumb("PRELOAD: Found Up-To Date Offline Copy.");
              breadcrumb("PRELOAD: Will Use Offline Copy to Preload.");

              lastOpenDocPreloadedDelta = offlineDoc.content;

            } else if (offlineGeneration === preloadGeneration) {
              // decrypt offline copy and use that instead to save time. it's the same.
              breadcrumb("PRELOAD: Found Up-To Date Offline Copy.");
              breadcrumb("PRELOAD: Will Use Offline Copy to Preload.");

              lastOpenDocPreloadedDelta = offlineDoc.content;

            } else {
              // preload online copy, it's newer.
              breadcrumb("PRELOAD: Offline Copy Out Of Date.");
              breadcrumb("PRELOAD: Fetching Online Copy.");
              $.ajax({ url: parsedDocURL(lastOpenDocID + ".crypteedoc", preloadToken), type: 'GET',
                success: function(encryptedDocDelta) {
                  breadcrumb("PRELOAD: Loaded Online Copy.");
                  lastOpenDocPreloadedDelta = encryptedDocDelta;
                },
                error:function (xhr, ajaxOptions, thrownError){
                  breadcrumb("PRELOAD: Couldn't preload. Doc likely deleted. Will try Home Doc.");
                  if (loadLastOpenDocWaiting) {
                    loadDoc("home", firstDocLoaded, "home");
                  } else {
                    lastOpenDocID = "home";
                    dataRef.update({"lastOpenDocID" : "home"});
                    preload();
                  }
                }
              });
            }

          } else {

            breadcrumb("PRELOAD: No Offline Copy Found");
            $.ajax({ url: parsedDocURL(lastOpenDocID + ".crypteedoc", preloadToken), type: 'GET',
              success: function(encryptedDocDelta) {
                breadcrumb("Preloaded last open doc");
                lastOpenDocPreloadedDelta = encryptedDocDelta;
              },
              error:function (xhr, ajaxOptions, thrownError){
                if (lastOpenDocID !== "home") {
                  breadcrumb("PRELOAD: Couldn't preload. Doc likely deleted. Will try Home Doc.");
                  if (loadLastOpenDocWaiting) {
                    loadDoc("home", firstDocLoaded, "home");
                  } else {
                    lastOpenDocID = "home";
                    dataRef.update({"lastOpenDocID" : "home"});
                    preload();
                  }
                } else {
                  handleError("PRELOAD AJAX: Couldn't preload home, likely deleted.");
                }
                
              }
            });

          }
        });
      }).catch(function(error){
        if (lastOpenDocID !== "home") {
          breadcrumb("PRELOAD: Couldn't preload. Doc likely deleted. Will try Home Doc.");
          if (loadLastOpenDocWaiting) {
            loadDoc("home", firstDocLoaded, "home");
          } else {
            lastOpenDocID = "home";
            dataRef.update({"lastOpenDocID" : "home"});
            preload();
          }
        } else {
          handleError("PRELOAD META: Couldn't preload home, likely deleted.", error);
        }
      });
    }
  }
}



function sortFolders () {
  dataRef.child("foldersOrder").once('value', function(snapshot) {
    foldersOrderObject = snapshot.val();
    var numberOfArchivedFolders = 0;

    $.each(foldersOrderObject, function(index, fid) {
      $("#" + fid).attr("data-sort", index);
    });

    $('.afolder').sort(function (a, b) {
      return ($(b).data('sort')) < ($(a).data('sort')) ? 1 : -1;
    }).prependTo('#all-folders');

    $(".afolder").each(function(folder){
      if ($(this).hasClass("archived")){
        numberOfArchivedFolders++;
        $(this).insertAfter("#archiveDivider");
      }
    });

    if (numberOfArchivedFolders > 0) {
      $("#archiveDivider").slideDown();
    } else {
      $("#archiveDivider").slideUp();
    }

  });
}

function updateArchivedFolders() {
  var numberOfArchivedFolders = 0;
  var fids = Object.keys(catalog.folders);
  fids.forEach(function(fid){
    if (catalog.folders[fid].archived) {
      numberOfArchivedFolders++;
    }
  });
  if (numberOfArchivedFolders > 0) {
    $("#archiveDivider").slideDown();
  } else {
    $("#archiveDivider").slideUp();
  }
}

function checkKey (key) {
  bootStepComplete(4);
  logTimeStart("Checking Key");
  if (!$("#key-modal").hasClass("shown")){
    showDocProgress("Checking Key");
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
    if (connected && navigator.onLine && encryptedStrongKey) {
      // BROWSER REPORTS USER IS ONLINE. 
      // IF YOU GOT THE strongKey = you are actually online. 
      
      // FIRST CHECK KEY FROM ONLINE, AND UPDATE OFFLINE COPY.
      decrypt(encryptedStrongKey, [hashedKey]).then(function(plaintext) {
        rightKey(plaintext, hashedKey);
      }).catch(function(error) {
        checkLegacyKey(dataRef, key, hashedKey, encryptedStrongKey, function(plaintext){
          rightKey(plaintext, hashedKey);
          // if it's wrong, wrongKey() will be called in checkLegacyKey in main.js
        });
      });
    } else {
      // USER LIKELY OFFLINE. 
      // FIRST CHECK IF MEMORIZE KEY EXISTS, AND USE THAT.
      // OTHERWISE, 
      // CHECK KEY FROM OFFLINE, AND START OFFLINE MODE.
      
      if (keyToRemember) {
        console.log("Used memorized key.");
        rightKey("", keyToRemember);
      } else {
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
  
}

function rightKey (plaintext, hashedKey) {
  logTimeEnd("Checking Key");
  clearInterval(keyModalConnectionTimer);
  $("#key-modal-decrypt-button").removeClass("is-loading");
  $("#key-status").removeClass("shown");
  $("#key-modal-signout-button").removeClass("shown");
  showDocProgress("Decrypting Files &amp; Folders<p class='cancel-loading'>this may take a few seconds.</p>");
  

  hideKeyModal();

  keyToRemember = hashedKey;

  gotKey = true; // this prevents an early offline mode call from being made before key is typed.
    
  if (connected && navigator.onLine) {
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

    decryptClipperKeys();

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

////////////////////////////////////////////////////
/////////////////// ERROR HANDLING  ////////////////
////////////////////////////////////////////////////

function checkCatalogIntegrity () {
  var undefinedFolder = false;
  var undefinedDoc = false;

  breadcrumb("Catalog Integrity Check (PRE): STARTED");

  //check for undefined folders in the catalog
  Object.keys(catalog.folders).forEach(function(key){
    if (key === "undefined") {
      // there is an undefined folder.
      undefinedFolder = true;
      breadcrumb("Catalog Integrity Check (PRE): found undefined folder");
    }
  });

  //check for undefined docs in the catalog
  Object.keys(catalog.docs).forEach(function(key){
    if (key === "undefined") {
      // there is an undefined doc.
      undefinedDoc = true;
      breadcrumb("Catalog Integrity Check (PRE): found undefined doc");
      handleError("Found Undefined Doc in Catalog PRE-CHECK");
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
    breadcrumb("Catalog Integrity Check (PRE): PASSED");
  } else {
    breadcrumb("Catalog Integrity Check (PRE): FAILED");
  }
}

function fixHomeDoc (callback, callbackParam){
  if (theKey) {
    callback = callback || noop;
    $.get({url:"../js/homedoc.json", dataType:"text"}, function(jsonRes){
      if (jsonRes) {  
        var homeDelta = JSON.parse(jsonRes);
        rootRef = store.ref().child('/users/' + theUserID);
        var homeDocRef = rootRef.child("home.crypteedoc");
        homeDelta = JSON.stringify(homeDelta);

        encrypt(homeDelta , [theKey]).then(function(ciphertext) {
            var encryptedDocDelta = JSON.stringify(ciphertext);

            var homeUpload = homeDocRef.putString(encryptedDocDelta);
            homeUpload.on('state_changed', function(snapshot){
              switch (snapshot.state) {
                case firebase.storage.TaskState.PAUSED: // or 'paused'
                  break;
                case firebase.storage.TaskState.RUNNING: // or 'running'
                  break;
              }
            }, function(error) {
              handleError("Error Re-Creating Homedoc", error);
              console.log("CREATE HOME FAILED. RETRYING IN 2 SECOND. Error: ", error);
              setTimeout(function(){ fixHomeDoc(callback, callbackParam); }, 2000);
            }, function() {
              breadcrumb("Home doc fixed. Continuing.");
              setTimeout(function(){ callback(callbackParam); }, 2000);
            });
        });
      } else {
        handleError("Error getting homedoc JSON for re-creating homedoc");
      }
    }).fail(function() {
      handleError("Error getting homedoc JSON for re-creating homedoc");
    });
  }
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
          handleError("Couldn't fix/re-create/replace undefined folder.", error);
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
    handleError("Found undefined folder, couldn't read contents", error);
  });
}

function fixFiles(did, newFID) {
  newFID = newFID || null;
  
  dataRef.update({"lastOpenDocID" : "home"},function(){
    loadDoc("home", firstDocLoaded);
  });

  if (did) {
    if (did === "undefined") {
      breadcrumb("Detected undefined doc.");
      
      // means that somehow a doc got undefined ID in the database.
      // First check if there's an actual undefined.cdoc or undefined.cfile in storage.
      // if there's one, rename both with a new ID, and updateTitles and tags to reflect changes.
      var fidWithUndefinedFile = $(".doc[did='undefined']").attr("fid");
      if (fidWithUndefinedFile === "undefined") {
        fidWithUndefinedFile = newFID || "undefined";
      }

      handleError("Undefined Doc/File", {"uid" : theUserID, "fid" : fidWithUndefinedFile});
      showErrorBubble("An error occured while trying to open this file. Please contact our support. Sorry.", {});

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
      updateLocalCatalog();
      loadDoc(did);
    });

  }).catch(function(error) {
    if (error) {
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
            updateLocalCatalog();
            loadDoc(did);
          });
        }).catch(function(err) {
          if (err) {
            err.did = did;
            err.fid = fid;
            if (err.code === 'storage/object-not-found') {
              // file doesn't exist either. uh oh.
              handleError("Doc/File not found, so deleted references", err);
              foldersRef.child(fid + "/docs/" + did).remove();
              refreshOnlineDocs(true);
            } else {
              handleError("Error while verifying doc/file exists", err);
            }
          } else {
            handleError("Error while verifying doc/file exists");
          }
        });
      }
    }
  });
}

var postLoadIntegrityChecksComplete = false;
function postLoadIntegrityChecks () {
  breadcrumb("Catalog Integrity Check (POST) : STARTED");
  if (corruptTitlesToFix.length > 0) {
    corruptTitlesToFix.forEach(function(id){
      fixCorruptedTitle(id);
    });
  } else {
    postLoadIntegrityChecksComplete = true;
    breadcrumb("Catalog Integrity Check (POST) : PASSED");
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
      if (id === "f-uncat"){
        updateFolderTitle (id, JSON.stringify("Inbox"));
      } else {
        breadcrumb("Found Corrupted Title for fid: " + id + ", will re-encrypt as Untitled.");
        updateFolderTitle (id, JSON.stringify("Untitled Folder"));
      }
    }
  }
}










////////////////////////////////////////////////////////
/////////////////// CHECK GENERATION   /////////////////
////////////////////////////////////////////////////////

function updateDocMetaInCatalog (changedDoc) {
  var changedGenerationOnServer = changedDoc.generation || 0;
  var changedDocumentID = changedDoc.docid;
  var isFile = changedDoc.isfile || false;
  var isLocked = changedDoc.islocked || false;

  catalog.docs[changedDocumentID] = catalog.docs[changedDocumentID] || {};

  var imported = catalog.docs[changedDocumentID].imported;

  if (changedDocumentID === activeDocID) {
    if (changedGenerationOnServer !== currentGeneration) {
      // we have an outdated doc. show doc is outdated.
      isDocOutdated = true;
      breadcrumb("Displaying Outdated Doc Warning for " + activeDocID);
      if (!imported) {
        showGenerationWarning();
      } else {
        catalog.docs[changedDocumentID].imported = null;
      }
    }
  }

  // reflect generation changes to dom & catalog
  $(".doc[did='"+changedDocumentID+"']").attr("gen", changedGenerationOnServer / 1000);
  catalog.docs[changedDocumentID].gen = changedGenerationOnServer;

  // reflect isfile changes to catalog
  catalog.docs[changedDocumentID].isfile = isFile;

  // reflect lock changes to catalog
  catalog.docs[changedDocumentID].islocked = isLocked;


  updateLocalCatalog();
  offlineStorage.getItem(changedDocumentID).then(function (offlineDoc) {
    if (offlineDoc && changedDocumentID !== activeDocID) {
      toSyncOrNotToSync();
    }
  }).catch(function(error) {
    console.log("couldn't open offline file", error);
    error.did = changedDocumentID;
    handleError("Error getting offline document from storage", error); 
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
  hideGenerationWarning();
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
  updateLocalCatalog();
  // reflect changes to dom (which means doc must be in dom before gotPlaintext DocTitle is called)

  updateDocTitleInDOM(did, dtitle);

  var extension = dtitle.slice((dtitle.lastIndexOf(".") - 1 >>> 0) + 2);

  if (did === activeDocID) {
    document.title = dtitle;
    $('#active-doc-title-input').val(dtitle);
    $('#active-doc-title-input').attr("placeholder", dtitle);
    activeDocTitle = dtitle;
  }

  offlineStorage.getItem(did).then(function (offlineDoc) {
    if (offlineDoc) {
      var updatedDoc = offlineDoc;
      updatedDoc.name = dtitle;
      offlineStorage.setItem(did, updatedDoc).catch(function(err) {
        if (err) {
          err.did = did;
          handleError("Error setting offline document to storage", err, "warning"); 
        }
      });
    }
  }).catch(function(err) {
    err.did = did;
    handleError("Error getting offline document from storage", err); 
  });

  callback();

}


function gotPlaintextFolderTitle (fid, plaintextTitle, callback) {
  callback = callback || noop;

  var ftitle = plaintextTitle;

  // add title to catalog
  catalog.folders[fid] = catalog.folders[fid] || {};
  catalog.folders[fid].name = ftitle;

  Object.values(catalog.docs).forEach(function(doc){
    if (doc.fid === fid) {
      catalog.docs[doc.did] = catalog.docs[doc.did] || {};
      catalog.docs[doc.did].fname = ftitle;
    }
  });

  updateLocalCatalog();
  // reflect changes to dom (which means folder must be in dom before got FolderTitle is called)
  var titleToUse = ftitle;
  try {titleToUse = JSON.parse(ftitle); } catch (e) {}
  $("#" + fid).find(".folder-title").html(titleToUse);
  $("#" + fid).find(".subfoldertitle").html(titleToUse);

  callback();
}


function updateDocTitle (id, plaintextTitle, callback, callbackParam) {
  callback = callback || noop;
  // encrypt plaintext, write to db
  encryptTitle(id, plaintextTitle, function(encryptedTitle, did){
    var fid = fidOfDID(did);
    foldersRef.child(fid + "/docs/" + did).update({"title" : encryptedTitle}, function(error) {
      if (error) { 
        error.did = did;
        error.fid = fid;
        handleError("Error updating doc/file title", error); 
      }
      callback(callbackParam);
    });
  });
}


function updateFolderTitle (id, plaintextTitle, callback, callbackParam) {
  callback = callback || noop;
  // encrypt plaintext, write to db
  gotPlaintextFolderTitle(id, plaintextTitle);
  encryptTitle(id, plaintextTitle, function(encryptedTitle, fid){
    foldersRef.child(fid).update({"title" : encryptedTitle}, function(error) {
      if (error) { 
        error.fid = fid;
        handleError("Error updating folder title", error); 
      }
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
            error.titleID = id;
            handleError("Caught corrupted title", error);
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
            error.itemid = id;
            handleError("Error decrypting title, passing Untitled", error);
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
    if (id !== "home") {
      breadcrumb(id + " has undefined encryptedTitle");
      callback("Untitled", id);
    }
  }
}



function decryptDocTitleIfNecessary(id, callback, callbackParam) {
  callback = callback || noop;
  var decrypt = true;

  if (catalog.docs[id].name) {
    if (catalog.docs[id].name !== "" && 
        catalog.docs[id].name !== "Untitled Document" && 
        catalog.docs[id].name !== stringifiedUntitledDocument
        ) {
      decrypt = false; // already exists. no need to decrypt.
    } 
  }

  if (decrypt) {
    breadcrumb('[Force Decrypt Title] – Doc title needs force decrypting. (' + id + ")");

    if (catalog.docs[id].encryptedTitle) {
      var encryptedTitle = catalog.docs[id].encryptedTitle;
      decryptTitle(id, encryptedTitle, function(plaintextTitle, fordid) {
        try { catalog.docs[id].fname = titleOf(catalog.docs[id].fid); } catch (e) {}
        gotPlaintextDocTitle(fordid, plaintextTitle, function(){
          breadcrumb('[Force Decrypt Title] – Doc title force decrypted. (' + id + ")");
          callback(callbackParam);
        });
      });
    } else {
      breadcrumb('[Force Decrypt Title] – Doc does not have title, cannot force decrypt title. (' + id + ")");
      callback(callbackParam);
    }

  } else {
    breadcrumb('[Force Decrypt Title] – Doc already decrypted, using existing title. (' + id + ")");
    callback(callbackParam);
  }

}

// This will decide what (titles / tags) needs to be decrypted during : 
// INITIAL BOOT 
// LOADING / OPENING FOLDERS 
// ARCHIVING / UNARCHIVING FOLDERS
// SEARCHING 

// forceEverything = this will decrypt everything. This is for search indexing. 
// forceFID = this will decrypt all docs of a specific folder. 

// General Rule : 

// FOLDERS
// Mark all folder titles for decryption. 

// DOCS
// Mark titles and tags of docs up to 6mo ago (MAX 100) for decryption
// Skip files since they're not in recents. 
// Skip docs in archived folders. 

// OVERRIDES
// Trigger ForceFID for unarchiving folders, and loading(opening) folders.
// Trigger forceEverything for Search since it needs everything. 

function decideWhatToDecryptInCatalog (forceFID, forceEverything) {
  var howManyRecentMonthsAgo = recentMonthsAgo();
  
  forceEverything = forceEverything || false;
  forceFID = forceFID || null; 

  var maxNumberOfRecentDocs = 100;
  var maxNumberOfRecentFiles = 10;
  var numberOfRecentDocs = 0;
  var numberOfRecentFiles = 0;

  //////////////////
  //  FOLDERS
  //////////////////

  // FOLDER TITLES ARE ADDED TO QUEUE IN FOLDER SOCKETS WITH :
  // foldersRef.child(fid + "/title").on('value', function(encTitle)
  // AND WILL ALWAYS BE ADDED TO QUEUE.
  
  // $.each(catalog.folders, function(fid, folder){
  //   catalog.folders[fid].decryptTitle = true;
  // });

  // you could save more time by skipping archived folder titles in the future
  // for now, even if there's 100 folders, this is still quick enough. 
  
  //////////////////
  //  DOCS
  //////////////////

  $.each(catalog.docs, function(did, doc) {
    if (did !== "home") { 
      if (forceEverything) {
        catalog.docs[did].decryptTitle = true;
        catalog.docs[did].decryptTags = true;
      } else {

        var fid = fidOfDID(did);
        if (fid) {
          if (forceFID) {
            if (fid === forceFID) {
              catalog.docs[did].decryptTitle = true;
            }
          } else {  
            if (!doc.isfile && !isDIDinArchivedFID(doc.did) && doc.gen / 1000 > howManyRecentMonthsAgo) {
              if (numberOfRecentDocs <= maxNumberOfRecentDocs) {
                numberOfRecentDocs++;
                catalog.docs[did].decryptTitle = true;
              }
            } 
            else {
              if (doc.isfile && !isDIDinArchivedFID(doc.did)) {
                if (numberOfRecentFiles <= maxNumberOfRecentFiles) {
                  numberOfRecentFiles++;
                  catalog.docs[did].decryptTitle = true;
                }
              }
            }
          }
        }

      }
    }

  });

  ////////////////////////////////////////////////////////////////////////////////// 
  //  ALL NECESSARY ITEMS MARKED FOR DECRYPTION
  //  YOU'RE DONE HERE. DECRYPTION QUEUE WILL BE STARTED ELSEWHERE.
  //////////////////////////////////////////////////////////////////////////////////

  addAllMarkedItemsInCatalogToTTDecryptionQueue();

}

function addAllMarkedItemsInCatalogToTTDecryptionQueue() {
  // $.each(catalog.folders, function(fid, folder){
  //   if (folder.decryptTitle) {
  //     processEncryptedFolderTitle(fid, folder.title);
  //   }
  // });

  $.each(catalog.docs, function(did, doc) {
    if (doc.decryptTitle) {
      if (doc.encryptedTitle) {
        processEncryptedDocTitle(did, doc.encryptedTitle);
      }
    }
    
    if (doc.decryptTags) {
      var tags = doc.encryptedTags || [];
      processEncryptedDocTags(did, tags);
    }
  });
}










function processEncryptedDocTitle(did, encryptedTitle) {
  
  var decryptionOperation = function(index) {
    catalog.docs[did] = catalog.docs[did] || {};

    if (localCatalogExists && decryptedTitleExistsInLocalCatalog(did, encryptedTitle)) {
        var plaintextTitle = catalog.docs[did].name;
        totalTTInDecryptionQueue--;
        runTTQueueFromIndex(index);
        try { catalog.docs[did].fname = titleOf(catalog.docs[did].fid); } catch (e) {}
        gotPlaintextDocTitle(did, plaintextTitle); // this also updates local catalog
        try { delete catalog.docs[did].decryptTitle; } catch (e) {}
    } else {
      decryptTitle(did, encryptedTitle, function(plaintextTitle, fordid) {
        totalTTInDecryptionQueue--;
        runTTQueueFromIndex(index);
        catalog.docs[did] = catalog.docs[did] || {};
        try { catalog.docs[did].fname = titleOf(catalog.docs[did].fid); } catch (e) {}
        gotPlaintextDocTitle(fordid, plaintextTitle); // this also updates local catalog
        try { delete catalog.docs[did].decryptTitle; } catch (e) {}
      });
    }
  };
  
  if (!tempTTDecryptionQueue.docs[did] && decryptionOperation) {
    tempTTDecryptionQueue.docs[did] = decryptionOperation;
    addedOperationToTTDecryptionQueue();
  }

}

function processEncryptedDocTags(did, encryptedTags) {

  var decryptionOperation = function(index) {
    catalog.docs[did] = catalog.docs[did] || {};

    if (localCatalogExists && decryptedTagsExistInLocalCatalog(did, encryptedTags)) {
      var plaintextTags = catalog.docs[did].tags;
      totalTTInDecryptionQueue--;
      runTTQueueFromIndex(index);
      catalog.docs[did].tags = plaintextTags;
      try { delete catalog.docs[did].decryptTags; } catch (e) {}

    } else {
      decryptTags(did, encryptedTags, function(plaintextTags, fordid) {
        totalTTInDecryptionQueue--;
        runTTQueueFromIndex(index);
        catalog.docs[did] = catalog.docs[did] || {};
        catalog.docs[did].tags = plaintextTags;
        try { delete catalog.docs[did].decryptTags; } catch (e) {}

        updateLocalCatalog();

      });
    }
  };  
  
  if (!tempTTDecryptionQueue.tags[did] && decryptionOperation) {
    tempTTDecryptionQueue.tags[did] = decryptionOperation;
    addedOperationToTTDecryptionQueue();
  }
  
}

function processEncryptedFolderTitle(fid, encryptedTitle) {  
  var decryptionOperation = function(index) {
    if (localCatalogExists && decryptedTitleExistsInLocalCatalog(fid, encryptedTitle)) {
      var plaintextTitle = catalog.folders[fid].name;
      totalTTInDecryptionQueue--;
      runTTQueueFromIndex(index);
      gotPlaintextFolderTitle(fid, plaintextTitle, function(){
        // this also updated local catalog

        try { delete catalog.folders[fid].decryptTitle; } catch (e) {}
        Object.keys(catalog.docs).forEach(function(did) {
          if (catalog.docs[did].fid === fid) {
            catalog.docs[did] = catalog.docs[did] || {};
            catalog.docs[did].fname = plaintextTitle;
          }
        });
      });

    } else {
      decryptTitle(fid, encryptedTitle, function(plaintextTitle, forfid) {
        totalTTInDecryptionQueue--;
        runTTQueueFromIndex(index);
        gotPlaintextFolderTitle(forfid, plaintextTitle, function(){
          // this also updated local catalog

          try { delete catalog.folders[fid].decryptTitle; } catch (e) {}
          Object.keys(catalog.docs).forEach(function(did) {
            if (catalog.docs[did].fid === fid) {
              catalog.docs[did] = catalog.docs[did] || {};
              catalog.docs[did].fname = plaintextTitle;
            }
          });
        });

      });
    }
  };

  if (!tempTTDecryptionQueue.folders[fid] && decryptionOperation) {
    tempTTDecryptionQueue.folders[fid] = decryptionOperation;
    addedOperationToTTDecryptionQueue();
  }
}

var stringifiedUntitledDocument = JSON.stringify("Untitled Document");
var stringifiedUntitledFolder = JSON.stringify("Untitled Folder");
function decryptedTitleExistsInLocalCatalog(id, encryptedTitle) {
  var exists = false;
  
  if (id) {
    if (id.startsWith('d-')) {
      // doc
      // ughhh if either one of these are undefined or null it'll throw a tantrum.
      // hence the nested IFs.
      if (catalog.docs[id]) {
        if (catalog.docs[id].name) {
          if (catalog.docs[id].encryptedTitle) {
            if (catalog.docs[id].encryptedTitle === encryptedTitle && 
                catalog.docs[id].name !== "" && 
                catalog.docs[id].name !== "Untitled Document" && 
                catalog.docs[id].name !== stringifiedUntitledDocument
                ) {
              exists = true;
            }
          }
        }
      }
    } else {
      // folder
      // ughhh if either one of these are undefined or null it'll throw a tantrum.
      // hence the nested IFs.
      if (catalog.folders[id]) {
        if (catalog.folders[id].name) {
          if (catalog.folders[id].encryptedTitle){
            if (catalog.folders[id].encryptedTitle === encryptedTitle && 
                catalog.folders[id].name !== "" && 
                catalog.folders[id].name !== "Untitled Folder" &&
                catalog.folders[id].name !== stringifiedUntitledFolder
                ) {
              exists = true;
            }
          }
        }
      }
    }
  }

  return exists;
}

function decryptedTagsExistInLocalCatalog(did, encryptedTags) {
  var exists = false;
  
  // ughhh if either one of these are undefined or null it'll throw a tantrum.
  // hence the nested IFs.
  if (did) {
    if (catalog.docs[did]) {
      if (catalog.docs[did].tags) {
        if (catalog.docs[did].encryptedTags) {
          if (catalog.docs[did].encryptedTags === encryptedTags &&
              // catalog.docs[did].tags !== [] && // keeping for posterity, this pretty much forced a tag decrypt on boot, since tags can be empty, and an empty array could be stringified and encrypted
              // catalog.docs[did].tags.length !== 0 && // keeping for posterity, this pretty much forced a tag decrypt on boot, since tags can be empty, and an empty array could be stringified and encrypted
              catalog.docs[did].tags !== undefined &&
              catalog.docs[did].tags !== null
              ) {
            exists = true;
          }
        }
      }
    }
  }

  return exists;
}

/////////////////////////////////////////////////////
// INIT DECRYPTION QUEUE
/////////////////////////////////////////////////////

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

// 1000 ms for boot to make sure 
// folder child change & doc title change can get added into queue intelligently,
// without repetition and even under bad network conditions

var ttDecryptionQueueTimeoutValue = 1000; 

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

    if (!initialDecryptComplete) {
      setSentryTag("titles-count", totalTTInDecryptionQueue);
      breadcrumb("[TT Decryption Queue] : READY (" + totalTTInDecryptionQueue + " items)");
      initialTTQueueReady = true;
      logTimeEnd('Loading User Data & Titles');
    } else {
      // we already have the key, keep moving
      runTTQueueFromIndex(0);
    }
    
  }, ttDecryptionQueueTimeoutValue);
}

function runTTQueueFromIndex(index) {
  index = index || 0;
  var total = finalTTDecryptionQueue.length;

  if (index === 0) {
    startedTTQueue = (new Date()).getTime();
    breadcrumb("[TT Decryption Queue] : DECRYPTING (" + totalTTInDecryptionQueue + " items)");
    logTimeStart('Decrypting Online Catalog');
  }

  if (!initialDecryptComplete) {
    showSyncingProgress((index+1), total);
  }
  
  if (indexingInProgress) {
    updateSearchProgress((index+1), total);
  }

  if (typeof finalTTDecryptionQueue[index] === "function") {
    finalTTDecryptionQueue[index](index+1);
  }
  
  if ((index + 1) === total) {
    completedTTQueue = (new Date()).getTime();
    ttQueueCompleted();
    totalTTInDecryptionQueue = 0;
  }
    
}

function ttQueueCompleted() {
  finalTTDecryptionQueue = [];

  // ALL TITLES IN QUEUE DECRYPTED
  breadcrumb("[TT Decryption Queue] : DONE. Decrypted in " + (completedTTQueue - startedTTQueue) + "ms");
  logTimeEnd('Decrypting Online Catalog');
  checkCatalogIntegrity();
  
  $("#sync-progress").addClass("done");
  $(".sync-details").html("Sync Complete");
  setTimeout(function () {
    hideSyncingProgress();
  }, 2500);
  
  // if this is first boot, load last open doc now.
  if (!initialDecryptComplete) {
    initialDecryptComplete = true;
    setSentryTag("titles-decryption-speed", (completedTTQueue - startedTTQueue) + "ms");
    if (!thereIsALocalEncryptedCatalog) {
      loadLastOpenDoc();
    } else {
      if (Object.keys(catalog.docs).length <= 1) {
        loadLastOpenDoc();
      }
    }
    // YOU CAN NOW START OFFLINE SYNC HERE
    toSyncOrNotToSync();

    postLoadIntegrityChecks();
    
    refreshOnlineDocs();
  } else {
    updateLocalCatalog(function(){  
      refreshOnlineDocs();
    });
  }

  if (indexingInProgress) {
    indexingInProgress = false;
    searchIndexReady = true;
    updateSearchProgress(100,100);
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

// returns fid from catalog;
function parentOfFID (fid) {
  var fidToReturn = null;
  if (catalog.folders[fid]) {
    if (catalog.folders[fid].parent) {
      fidToReturn = catalog.folders[fid].parent;
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

// returns array of dids
function docsOfFID (fid) {
  var docsToReturn = [];
  Object.values(catalog.docs).forEach(function(doc){
    if (doc.fid === fid) {
      docsToReturn.push(doc.did);
    }
  });
  return docsToReturn;
}

// returns array of fids
function subfoldersOfFID (fid) {
  var foldersToReturn = [];
  Object.values(catalog.folders).forEach(function(folder){
    if (folder.parent) {
      if (folder.parent === fid) {
        foldersToReturn.push(folder.fid);
      }
    }
  });
  return foldersToReturn;
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
            error.did = did;
            error.fid = fid;
            handleError("Error setting legacy ghost titles to db", error);
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
  if (plaintextTagsArray.length) {
    var plaintextTags = JSON.stringify(plaintextTagsArray);
    encrypt(plaintextTags, [theKey]).then(function(ciphertext) {
      var encryptedTagsArray = JSON.stringify(ciphertext);
      callback(encryptedTagsArray, did);
    });
  } else {
    callback("[]", did);
  }
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
        handleError("Error decrypting tags",error);
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
  updateLocalCatalog();
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


function updateFolderInCatalog (folder, fid) {

  catalog.folders[fid] = catalog.folders[fid] || {};
  catalog.folders[fid].fid            = fid;
  catalog.folders[fid].archived       = folder.archived || false;
  catalog.folders[fid].name           = "";
  catalog.folders[fid].encryptedTitle = folder.title;
  catalog.folders[fid].color          = folder.color;
  catalog.folders[fid].sortdocs       = folder.sortdocs;

  if (folder.docs !== null && folder.docs !== undefined) {
    Object.values(folder.docs).forEach(function(doc) {
      updateDocInCatalog (fid, doc);
    });
  }

  if (folder.parent !== null && folder.parent !== undefined) {
    catalog.folders[fid].parent = folder.parent;
  }

  if (fid === "f-uncat") {
    catalog.folders[fid].name = "Inbox";
  }

  // 
  // FOLDER TITLES ARE ADDED TO QUEUE IN FOLDER SOCKETS WITH :
  // foldersRef.child(fid + "/title").on('value', function(encTitle)
  // AND WILL ALWAYS BE ADDED TO QUEUE.
  // 

  // addedEncryptedItemsToInMemoryCatalog(); 
}

function updateDocInCatalog (fid, doc) {
  var did = doc.docid;
  var isFile = doc.isfile || false;
  var isLocked = doc.islocked || false;
  var isOffline = doc.isoffline || false;

  // either an encrypted string or a blank array, check for this when decrypting tags.
  var tags = doc.tags || [];

  catalog.folders[fid] = catalog.folders[fid] || {};
  catalog.docs[did] = catalog.docs[did] || {};
  
  catalog.docs[did].encryptedTitle	= doc.title;
  catalog.docs[did].name            = doc.name || "";
  
  catalog.docs[did].encryptedTags	  = tags;
  catalog.docs[did].tags            = [];
  
  catalog.docs[did].fid             = fid;
  catalog.docs[did].did             = did;
  catalog.docs[did].gen             = parseInt(doc.generation) || 0;
  catalog.docs[did].fcolor          = catalog.folders[fid].color || "#363636";
  catalog.docs[did].isfile          = isFile;
  catalog.docs[did].islocked        = isLocked;
  catalog.docs[did].isoffline       = isOffline;
  
  addedEncryptedItemsToInMemoryCatalog();
}


function updateDocTitlesAndTagsInCatalog(doc) {

  // this "doc" comes from server. So: 
  // tags = encryptedTags
  // title = encryptedTitle 

  var did = doc.docid;
  var tags = doc.tags || [];

  // this skips the addedEncryptedItemsToInMemoryCatalog and mark for decrypt there.
  // because we want these changes to go through immediately. 

  processEncryptedDocTitle(did, doc.title);
  processEncryptedDocTags(did, tags);
}

/////////////////////////////////////////////////////
// EXPERIMENTAL FAST BOOT & LOCAL CATALOG
/////////////////////////////////////////////////////

// this is called everytime after we've added something encrypted to in-memory catalog. 
// so either an encrypted folder title, doc title, or tag.
// once all additions are written to the in-memory catalog object,
// we will trigger a decision algorithm to decide what needs to be decrypted from the in-memory catalog. 

var inMemoryCatalogTimeout;
logTimeStart("In-Memory Catalog Ready.");
function addedEncryptedItemsToInMemoryCatalog(callback) {
  callback = callback || noop;
  clearTimeout(inMemoryCatalogTimeout);
  inMemoryCatalogTimeout = setTimeout(function () {
    catalogReadyForDecryption = true;
    logTimeEnd("In-Memory Catalog Ready.");
    decideWhatToDecryptInCatalog();
  }, 500);
}


// if hundreds of docs are getting added to local catalog, 
// timeout ensures we encrypt & write local catalog only once.
var updateLocalCatalogTimeout;
var localForageIDBErrorTimeout;
function updateLocalCatalog (callback) {
  callback = callback || noop;
  if (firstDocLoadComplete) {
    clearTimeout(updateLocalCatalogTimeout);
    updateLocalCatalogTimeout = setTimeout(function () {
      breadcrumb("Local Catalog : STARTING UPDATE.");
      var jsonCatalog = JSON.stringify(catalog);
      encrypt(jsonCatalog, [theKey]).then(function(ciphertext) {
        var encryptedCatalog = JSON.stringify(ciphertext);

        encryptedIndexedCatalog.setItem("encat", encryptedCatalog).then(function(value) {
          clearTimeout(localForageIDBErrorTimeout);
          breadcrumb("Local Catalog : FINISHED UPDATE.");
          refreshOnlineDocs();
          callback();
        }).catch(function(err) {
          if (err) { 
            handleError("Error saving to IDB in updateLocalCatalog", err);
          }
        });

        localForageIDBErrorTimeout = setTimeout(function () {
          breadcrumb("Local Catalog : FINISHED WITH ERRORS. [IDB Request Not Finished]");
          refreshOnlineDocs();
          callback();
        }, 1000);
        
      }).catch(function(error) {
        handleError("Error encrypting in updateLocalCatalog", error);
      });
    }, 500);
  } else {
    refreshOnlineDocs();
    callback();
  }
}


// THIS WILL HAVE AN ASYNC DECRYPT OP. BEWARE. 
// WHICH COULD CAUSE A FOOTRACE.
// IF NOT HANDLED CORRECTLY, THIS IS ASKING FOR TROUBLE. BEWARE.
// YOU COULD TECHNICALLY LOAD THIS BEFORE BOOT. 
// THIS WOULD LOAD ALL TITLES, WHILE WAITING SERVER ONES TO BE DECRYPTED.
// NOT SURE HOW BAD THE BACKLOG OF 10000+ DECRYPTION OPERATIONS WOULD BE THO.
var localCatalogLoadStarted;

function loadLocalCatalog(callback) {
  callback = callback || noop;
  breadcrumb("Local Catalog : LOADING...");
  
  localCatalogLoadStarted = (new Date()).getTime();

  logTimeStart('Loading Local Catalog');
  encryptedIndexedCatalog.getItem('encat').then(function(encryptedCatalog) {  
    logTimeEnd('Loading Local Catalog');

    logTimeStart('Decrypting Local Catalog');
    var parsedEncryptedCatalog = JSON.parse(encryptedCatalog).data;
    decrypt(parsedEncryptedCatalog, [theKey]).then(function(plaintext) {
      var plaintextLocalCatalog = JSON.parse(plaintext.data);

      // SO HERE COMES A SUPER EDGE CASE BUT VERY REAL PROBLEM THAT HAPPENED.

      // IF DEVICE 1 WAS OFFLINE, AND DEVICE 2 DELETED A FOLDER / DOC ETC. 
      // DEVICE 1 ENCRYPTED CATALOG WOULD NEVER GET THE "DELETE" ACTION REFLECTED
      // SINCE WE ONLY DELETE STUFF FROM CATALOG WITH A "CHILD_REMOVED"
      // SO ENCRYPTED CATALOG WOULD ADD THE ONCE DELETED ITEM TO IN MEMORY CATALOG
      // AND SINCE IT'S NOT DELETED, IT'LL KEEP GETTING SAVED TO LOCAL CATALOG FOREVER. 
      
      // TO PREVENT THIS, WE'RE NOT RESTORING THE ENCRYPTED LOCAL CATALOG AS IS. 
      // don't do     catalog = plaintextCatalog;     basically

      // SINCE THIS FUNCTION IS ONLY CALLED AFTER THE INITIAL DECRYPT QUEUE IS READY,
      // GO THROUGH THE FRESHLY-FETCHED-ONLINE-CATALOG ONE BY ONE, 
      // AND MERELY TAKE TITLES FROM THE ENCRYPTED CATALOG AND ADD TO THE IN MEMORY CATALOG.
      // THIS WAY YOU'RE GOING TO HAVE AN UP TO DATE CATALOG TREE FROM THE SERVER
      // BUT ONLY REFLECT THE DECRYPTED TITLES ETC. FROM LOCAL ENCRYPTED CATALOG.

      Object.keys(catalog.docs).forEach(function(did){
        if (plaintextLocalCatalog.docs[did]) {
          // catalog.docs[did] = plaintextLocalCatalog.docs[did];
          catalog.docs[did].name = plaintextLocalCatalog.docs[did].name;
          catalog.docs[did].encryptedTitle = plaintextLocalCatalog.docs[did].encryptedTitle;
          
          catalog.docs[did].tags = plaintextLocalCatalog.docs[did].tags;
          catalog.docs[did].encryptedTags = plaintextLocalCatalog.docs[did].encryptedTags;
          
          catalog.docs[did].gen = parseInt(plaintextLocalCatalog.docs[did].gen) || 0;
        }
      });
      
      Object.keys(catalog.folders).forEach(function(fid){
        if (plaintextLocalCatalog.folders[fid]) {
          // catalog.folders[fid] = plaintextLocalCatalog.folders[fid];
          catalog.folders[fid].name = plaintextLocalCatalog.folders[fid].name;
          catalog.folders[fid].encryptedTitle = plaintextLocalCatalog.folders[fid].encryptedTitle;
          var titleToUse = titleOf(fid);
          try {titleToUse = JSON.parse(ftitle); } catch (e) {}
          $("#" + fid).find(".folder-title").html(titleToUse);
          $("#" + fid).find(".subfoldertitle").html(titleToUse);
        }
      });

      var localCatalogLoadFinished = (new Date()).getTime();
      var catalogSpeed = (localCatalogLoadFinished - localCatalogLoadStarted) + "ms";
      var catalogSize = formatBytes(bytesize(encryptedCatalog));

      setSentryTag("local-catalog-speed", catalogSpeed);
      setSentryTag("local-catalog-size", catalogSize);
      logTimeEnd('Decrypting Local Catalog');
      breadcrumb("Local Catalog : LOADED "+catalogSize+" in " + catalogSpeed);
      refreshOnlineDocs(true); // force refresh online docs.

      callback();
    }).catch(function(err) {
      // couldn't decrypt / load local catalog. shit. remove local catalog, and force restart.
      loadLocalCatError("Error decrypting local catalog", err);
    });

  }).catch(function(err) {
    // couldn't decrypt / load local catalog. shit. remove local catalog, and force restart.
    loadLocalCatError("Error loading local catalog.", err);
  });

  function loadLocalCatError(msg, err) {
    handleError(msg, err);

    // giving 5 seconds for sentry to send error
    setTimeout(function () {
        
      // set key in preperation for restart
      sessionStorage.setItem("key", JSON.stringify(keyToRemember));

      // remove catalog, then restart
      encryptedIndexedCatalog.removeItem('encat').then(function() {
        window.location.reload();
      }).catch(function(err) {
        window.location.reload();  
      });
    
    }, 5000);
  }
}

function initalizeLocalCatalog() {
  encryptedIndexedCatalog.getItem('encat', function(err, cat) {
    if (!cat || err) {
      breadcrumb("[Local Catalog] Not found in IDB. Will check LS.");
      var encryptedCatalogInLS = localStorage.getItem("encryptedCatalog");
      if (encryptedCatalogInLS) {
        breadcrumb("[Local Catalog] Found in LS. Moving to IDB.");
        encryptedIndexedCatalog.setItem("encat", encryptedCatalogInLS).then(function(value) {
          breadcrumb('[Local Catalog] Moved to IDB.');
          localStorage.removeItem('encryptedCatalog');
          breadcrumb('[Local Catalog] Removed from LS.');
          thereIsALocalEncryptedCatalog = true;
        }).catch(function(err) {
          if (err) { 
            handleError("Error porting ls offline catalog to idb", err); 
          }
        });
      } else {
        breadcrumb("[Local Catalog] Not in LS either. Will create.");
      }
    } else {
      if (cat) { thereIsALocalEncryptedCatalog = true; }
    }
  });
}

////////////////////////////////////////////////////
//////////////////  BATCH DELETIONS  ///////////////
////////////////////////////////////////////////////

// deletionsObject = {
//   fid12345 : {
//     did12345 : "did12345.crypteefile",
//     did67890 : "did67890.crypteedoc"
//   }, 
// }

var batchDeleteFiles = cloudfunctions.httpsCallable('batchDeleteFiles');
function batchDeleteItems(deletionsObject, callback, errorCallback) {
  callback = callback || noop;
  errorCallback = errorCallback || noop;
  breadcrumb('[BATCH DELETE] Starting...');
  if (deletionsObject) { 
    batchDeleteFiles({ type: "docs", deletions : deletionsObject }).then(function (result) {
      var functionResponse = result.data;
      if (functionResponse) {
        if (functionResponse.status === "done") {
          // all set. docs/files deleted.
          breadcrumb('[BATCH DELETE] Done.');
          callback();
        }
      }
    }).catch(function (error) {
      handleError("Error deleting docs/files", error);
      errorCallback(error);
    }); 
  }
}


////////////////////////////////////////////////////
////////////////// FOLDER ACTIONS ////////////////
////////////////////////////////////////////////////

function renderFolder (folder, fid, type) {
  type = type || "regular";

  var fopen = folder.open;
  var fcolor = folder.color;
  var farchived = folder.archived || false;
  var flogo = folder.logo || false;
  catalog.folders[fid] = catalog.folders[fid] || {};
  var fname = catalog.folders[fid].name || '<span class="icon"><i class="fa fa-cog fa-spin fa-fw"></i></span> Decrypting...';

  var openClass = "";
  var colorClass = " #363636";
  var hiddenClass = "hidden";

  if (fopen) { openClass = ""; hiddenClass = "";} else { openClass = "collapsed"; hiddenClass = "display:none;";}
  if (type === "search") { openClass = "collapsed"; hiddenClass = "display:none;"; }
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

  var displayNone = "";
  var folderIDAttr = "";
  if (type === "regular") {
    displayNone = ' style="display:none;"';
    folderIDAttr = ' id="' + fid + '"';
  }

  var fidAttr = ' fid="' + fid + '" ';

  var folderCard =  
  '<div class="afolder ' + archived + ' ' + withlogo + ' '+ openClass + ' " ' + folderIDAttr + fidAttr + displayNone + '>' +
    logotag +
    '<img class="foldertab" src="../assets/foldertab.svg" draggable="false"></img>'+
    '<div class="foldercolor" style="color:'+colorClass+';"></div>'+
    '<div class="folderactions">'+
        '<span class="icon folder-dropdown-button"><i class="fa fa-fw fa-ellipsis-v"></i></span> &nbsp;'+
    '</div>'+
    '<div class="folder-card">'+
        '<h2 class="folder-title">'+fname+'</h2>'+
        '<div class="folderrecents" style="' + hiddenClass +'"></div>'+
    '</div>'+
  '</div>';

  return folderCard;
}


function renderSubFolder(folder, animate) {
  animate = animate || false;

  var fid = folder.fid || folder.folderid;
  catalog.folders[fid] = catalog.folders[fid] || {};
  
  var fcolor = folder.color;
  var fname = catalog.folders[fid].name || '<span class="icon"><i class="fa fa-cog fa-spin fa-fw"></i></span> Decrypting...';
  var colorClass = " #363636";
  if (fcolor) { colorClass = fcolor; }
  var folderIDAttr = ' id="' + fid + '"';
  var fidAttr = ' fid="' + fid + '" ';

  var displayNone = "";
  var newFolderClass = "";
  if (animate) {
    displayNone = ' style="display:none;"';
    newFolderClass = ' newfolder ';
  }

  var folderCard =  
  '<div class="afolder subfolder ' + newFolderClass + '" ' + folderIDAttr + fidAttr + displayNone + ' gen="0">' +
    '<span class="icon foldericon"><i class="fa fa-folder" style="color:'+colorClass+';"></i></span>'+
    '<p class="subfoldertitle">'+fname+'</p>'+
    '<span class="icon folderctx"><i class="fa fa-fw fa-ellipsis-v"></i></span>'+
  '</div>';

  return folderCard;
}

function renderMoveFolderItem(folder, targetModal) {
  var fid = folder.fid;
  var ftitle = folder.name;
  var fcolor = folder.color;
  var parent = folder.parent;
  var colorClass = " #363636";
  var type = " ";
  if (fcolor) { colorClass = fcolor; }
  if (parent) { 
    type = " move-subfolder "; 
  } else {
    type = " move-folder is-half ";
  }

  var disallowed = "";
  var icon = '<span class="icon is-small"><i class="fa fa-folder" style="color:'+colorClass+';"></i></span>';

  targetModal = targetModal || $("#docs-move-selections-modal"); // move-folder || move-docs-modal

  if (targetModal.attr("id") === "docs-move-folder-modal" || $("#docs-move-folder-modal").hasClass("is-active")) {  
    if (selectedFIDtoMove) {
      if (selectedFIDtoMove === fid) {
        // this folder is the one moving. We must make it disallowed.
        disallowed = "disallowed";
        icon = 
        '<span class="icon is-small">'+
          '<span class="fa-fw fa-stack fa-lg" style=" margin-left:-14px; margin-top: -6px; ">'+
              '<i class="fa fa-folder fa-stack-1x" style="color:'+colorClass+';"></i>'+
              '<i class="fa fa-arrow-left fa-stack-2x text-danger" style="color: #FFF; margin-top: 13px; font-size: 8px;"></i>'+
          '</span>'+
        '</span>';
      }
    }
  }

  var folderCard = 
  '<div class="column '+type+'" fname="'+ftitle+'">'+
    '<button fid="'+fid+'" class="button is-fullwidth docs-move-folders-list-item '+disallowed+'">'+
      icon+
      '<span class="movefoldertitle">'+ftitle+'</span>'+
    '</button>'+
  '</div>';

  return folderCard;
}


/////////////////////
// APPEND FOLDER //
/////////////////////

function appendFolder (folder, fid, moved){
  moved = moved || false;

  // THIS SHOULD BE RESOLVED WITH DROPDOWNS, AND LATEST TITLE UPGRADE ---- LEAVING HERE FOR POSTERITY FOR A WHILE JUST IN CASE. ----
  // TODO IF YOU GET AN ERROR FOR TITLE NOT FOUND / OTHER SHIT NOT FOUND ETC. THERE ARE SOME FOLDERS IN FIREBASE THAT ONLY HAVE OPEN/CLOSE PROPERTIES.
  // IT COULD BE BECAUSE THE STATUS OF AN OPEN FOLDER IS BEING SAVED AFTER ITS DELETION. 
  // CHANCES ARE CLIENT WRITES OPEN/CLOSE STATUS AFTER CLOSURE. 
  // OR THERE is / was A FOOT RACE. COULD BE FIXED AFTER ADDING DROPDOWNS INSTEAD OF DELETE BUTTONS (WHICH FALSELY TRIGGERED OPEN / CLOSE OCCASIONALLY)
  
  if (!$( "#" + fid ).length) {
    
    if (!folder.parent) {   
      // not a subfolder   
      // folder doesn't exist in dom, so add.
      $("#all-folders").prepend(renderFolder(folder, fid));
    } else {
      // it's a subfolder
      if (folder.parent === activeFolderID) {
        // and its parent is currently active, so render it.
        $("#all-active-folder-contents").prepend(renderSubFolder(folder, true));
      }
    }

    if (!folder.parent) {
      // not a subfolder. 

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
    }

    var uploadInput = '';
    if (isAPIAvailable()) {
      if (isAndroid && isFirefox) {
        // https://bugzilla.mozilla.org/show_bug.cgi?id=1456557
        // seriously. yeah. seriously firefox. WTF. 
        uploadInput = '<input class="folder-upload-input" type="file" id="upload-to-'+fid+'" name="files[]" />';
      } else {
        uploadInput = '<input class="folder-upload-input" type="file" id="upload-to-'+fid+'" name="files[]" multiple />';
      }

      $("#all-folders-upload-inputs").append(uploadInput);
      var inputElement = document.getElementById('upload-to-'+fid);
      if (inputElement) {
        inputElement.addEventListener('change', handleFileSelect, false);
      }
    }

    if (!folder.parent || (folder.parent && folder.parent === activeFolderID)) {
      // not a subfolder, or a subfolder and its parent is currently active. 

      if (isAPIAvailable()) {
        var folderElementForDrop = document.getElementById(fid);
        if (folderElementForDrop) {
          folderElementForDrop.addEventListener('drop', handleFileDrop, false);
        }
      }

      // somehow this is needed for the animation. 
      // I'm assuming dom takes time to prepend the foldercard somehow.
      setTimeout(function () { 
        $( "#" + fid ).slideDown(300); 
      }, 50); 

    }

  }

  if (!moved) {
    updateFolderInCatalog(folder, fid);
  }

  var sortableFolders;
  if (!isMobile && !isDOMRectBlocked && !isipados) {
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

  if (newFoldersOrderObject) {
    if (newFoldersOrderObject !== foldersOrderObject) {
      dataRef.update({"foldersOrder" : newFoldersOrderObject});
      foldersOrderObject = newFoldersOrderObject;
    }
  }

}





////////////////////////////////
// SORT DOCS IN ACTIVE FOLDER //
////////////////////////////////

function gensort(a,b) {
  if (a.gen < b.gen)
    return -1;
  if (a.gen > b.gen)
    return 1;
  return 0;
}

// sortType = current Sort
// sortNext = sort by when clicked.

function updateSortTypeOfActiveFolder (sortType) {
  var aafd = $("#all-active-folder-contents");
  $("#sort-active-folder-button").attr("sortType", sortType);

  if (sortType === "azasc") {
    $("#sort-active-folder-button").removeClass("fa-sort-alpha-asc fa-sort-alpha-desc fa-sort-amount-asc fa-sort-amount-desc").addClass("fa-sort-alpha-asc");
    $("#sort-active-folder-button").attr("sortNext", "azdesc");
  } 
  
  if (sortType === "azdesc") {
    $("#sort-active-folder-button").removeClass("fa-sort-alpha-asc fa-sort-alpha-desc fa-sort-amount-asc fa-sort-amount-desc").addClass("fa-sort-alpha-desc");
    $("#sort-active-folder-button").attr("sortNext", "genasc");
  } 
  
  if (sortType === "genasc") { 
    $("#sort-active-folder-button").removeClass("fa-sort-alpha-asc fa-sort-alpha-desc fa-sort-amount-asc fa-sort-amount-desc").addClass("fa-sort-amount-asc");
    $("#sort-active-folder-button").attr("sortNext", "gendesc");
  } 

  if (sortType === "gendesc") {
    $("#sort-active-folder-button").removeClass("fa-sort-alpha-asc fa-sort-alpha-desc fa-sort-amount-asc fa-sort-amount-desc").addClass("fa-sort-amount-desc");
    $("#sort-active-folder-button").attr("sortNext", "azasc");
  }

  aafd.attr("sort", sortType);
}

function toggleActiveFolderSortButton() {
  var sortNext = $("#sort-active-folder-button").attr("sortNext");
  sortContentsOfActiveFolder(sortNext);
  saveActiveFolderSort(sortNext);
}


function saveActiveFolderSort (sortType) {
  catalog.folders[activeFolderID] = catalog.folders[activeFolderID] || {};
  catalog.folders[activeFolderID].sortdocs = sortType;
  updateLocalCatalog();
  foldersRef.child(activeFolderID).update({"sortdocs" : sortType});
}

function refreshFolderSort (fid) {
  if (fid === activeFolderID) {
    var sortType = $("#sort-active-folder-button").attr("sortType");
    sortContentsOfActiveFolder(sortType);
  }
}

function lowercaseTitleOfFolderContents (docOrSubfolder) {
  return $(docOrSubfolder).find('.doctitle').text().toLowerCase() || $(docOrSubfolder).find('.subfoldertitle').text().toLowerCase();
}

function sortContentsOfActiveFolder (sortType) {
  var aafd = $("#all-active-folder-contents");

  if (sortType === "azasc") {
    aafd.children().not(".newfolder").sort(function (a, b) {
      return naturalSort(lowercaseTitleOfFolderContents(a), lowercaseTitleOfFolderContents(b));
    }).appendTo("#all-active-folder-contents");
  } 
  

  if (sortType === "azdesc") {
    aafd.children().not(".newfolder").sort(function (a, b) {
      return naturalSort (lowercaseTitleOfFolderContents(b), lowercaseTitleOfFolderContents(a));
    }).appendTo("#all-active-folder-contents");
  } 
  

  if (sortType === "genasc") { 
    aafd.find(".doc").sort(function (a, b) {
      return ($(b).attr('gen')) > ($(a).attr('gen')) ? 1 : -1;
    }).appendTo("#all-active-folder-contents");
  } 


  if (sortType === "gendesc") {
    aafd.find(".doc").sort(function (a, b) {
      return ($(b).attr('gen')) < ($(a).attr('gen')) ? 1 : -1;
    }).appendTo("#all-active-folder-contents");
  }

  updateSortTypeOfActiveFolder(sortType);
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
    $("#new-folder-title").attr("placeholder", "Type in a new folder name here...");
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
function newFolder (callback, newFTitle, uuid, parentFID) {
  callback = callback || noop;
  parentFID = parentFID || null;

  if (!parentFID) {
    $(".folders-new-folder").addClass("is-loading");
  } else {

  }
  
  uuid = uuid || newUUID();
  newFTitle = newFTitle || $("#new-folder-title").val().trim() || "Untitled Folder";
  $("#new-folder-button").removeClass("is-armed");
  var availableColors = ["#d9534f","#FF8C00","#ffdd57","#4bbf73","#1f9bcf","#8A2BE2"];
  var randomColor = availableColors[Math.floor(Math.random() * availableColors.length)];
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
  
  // save the folder title to catalog here, so that in append folder you can display it already.
  gotPlaintextFolderTitle(fid, newFTitle);

  encryptTitle(fid, JSON.stringify(newFTitle), function(encryptedTitle){

    var folderData = {
      folderid : fid,
      open : true,
      title : encryptedTitle,      
      color : randomColor
    };

    if (parentFID) {
      folderData.parent = parentFID;
    }

    foldersRef.child(fid).update(folderData , function(){
      $("#new-folder-title").val("");
      callback(fid);
    });

  });
}

$("#active-folder-new-folder-button").on('click', function(e) {
  $("#active-folder-new-folder-button").addClass("creating");
  newSubFolder();
}); 

function newSubFolder() {
  var parentFID = activeFolderID;
  newFolder(function(){
    // show folder 
    $("#active-folder-new-folder-button").removeClass("creating");
  }, "New Folder", null, parentFID);
}












/////////////////////
// DELETE FOLDER //
/////////////////////

$('#folder-dropdown').on('click', '.delete-button', function(event) {
  var fidToDelete = rightClickedID();
  $("#delete-folder-modal").attr("fidToDelete", fidToDelete);
  $("#willdelete-foldername").html("");
  $("#willdelete-foldername").html(titleOf(fidToDelete));
  showModal("delete-folder-modal");
});

$('#delete-folder-modal').on('click', '.delete-folder-confirm', function(event) {
  var fid = $("#delete-folder-modal").attr("fidToDelete");
  deleteFolder(fid);
});


function deleteFolder (fid){
  var activeDID = activeDocID;

  progressModal("delete-folder-modal");

  var anyDocsFromThisFolderOpen = false;
  clearSelections();

  subfoldersOfFID(fid).forEach(function(subFID){
    deleteFolder(subFID);
  });

  var deletionsObject = {};
  deletionsObject[fid] = {};

  docsOfFID(fid).forEach(function(did) {
    if (activeDID === did) {
      // IF ANY OF THESE DOCS ARE CURRENTLY OPEN -~ hard close it.
      anyDocsFromThisFolderOpen = true;
    }

    if (catalog.docs[did].isfile) {
      deletionsObject[fid][did] = did + ".crypteefile";
    } else {
      deletionsObject[fid][did] = did + ".crypteedoc";
    }

    removeDocFromDOM(did);

    offlineStorage.removeItem(did).catch(function(err) {
      if (err) {
        err.did = did;
        handleError("Error removing offline document from storage", err); 
      }
    });
  });
  
  batchDeleteItems(deletionsObject, function() {
    unprogressModal("delete-folder-modal");

    foldersRef.child(fid).remove().then(function() {
      if (anyDocsFromThisFolderOpen){
        loadDoc("home");
      }
      
      if (activeFolderID === fid) {
        $("#folders-button").click();
      }

      updateFolderIndexes();
      $("#delete-folder-modal").attr("fidToDelete", "");
      hideModal("delete-folder-modal");  
    }).catch(function(error) {
      error.fid = fid;
      handleError("Error deleting folder", error);
    });

  }, function() {
    unprogressModal("delete-folder-modal");
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
        showErrorBubble("Error deleting some offline documents", err);
        if (err) {
          err.fid = fid;
          handleError("Error iterating offline documents", err); 
        }
      });

      delete catalog.folders[fid];
      var arrayOfDocsToCheckForFID = Object.values(catalog.docs);
      arrayOfDocsToCheckForFID.forEach(function(doc){
        if (doc.fid === fid) {
          delete catalog.docs[doc.did];
        }
      });
      
      updateLocalCatalog();
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
  updateLocalCatalog();

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

    refreshOnlineDocs();
    
  }, 500);
}

$("#archiveDivider").on('click', function(event) {
  $("#archiveDivider").toggleClass("open");
  if ($("#archiveDivider").hasClass("open")) {
    $("#all-folders").animate({ scrollTop: $("#all-folders")[0].scrollHeight }, "slow");
  }
});

function archiveFolder(fid) {
  foldersRef.child(fid).update({parent : null},function(error){
    setTimeout(function () {
      foldersRef.child(fid).update({archived : true});
    }, 200);
  });
}

function unarchiveFolder(fid) {
  foldersRef.child(fid).update({archived : null});
}


$('#folder-dropdown').on('click', '.archive-button', function(event) {
  var fid = rightClickedID();
  archiveFolder(fid);
  hideRightClickMenu('#folder-dropdown');
});

$('#all-folders').on('click', '.afolder.archived', function(event) {
  var fid = $(this).attr("id");
  unarchiveFolder(fid);
});

/////////////////////
//  RENAME FOLDER  //
/////////////////////

$('#rename-folder-input').on('keydown', function(event) {
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
  $(".rename-status > .title").html("Rename Folder");
  $("#rename-folder-input").val("");
  $("#rename-folder-input").blur();
  $("#rename-folder-modal").removeClass('is-active');
  hideModal("rename-folder-modal");
}

function renameFolderConfirmed() {
  var folderNewName = $('#rename-folder-input').val().trim();
  var folderOldName = $('#rename-folder-input').attr("placeholder");
  var fid = $("#rename-folder-modal").attr("fid");
  if (folderNewName !== folderOldName) {
    $(".rename-status > .title").html("Renaming ... ");
    progressModal("rename-folder-modal");

    updateFolderTitle (fid, JSON.stringify(folderNewName), function(){

      offlineStorage.iterate(function(doc, did, i) {
        if (doc) {
          if (doc.fid === fid) {
            var updatedDoc = doc;
            updatedDoc.fname = folderNewName;
            offlineStorage.setItem(did, updatedDoc);
          }
        }
      }).catch(function(err) {
        err.fid = fid;
        handleError("Error iterating offline documents", err);
      });
      
      setTimeout(function(){ // more for UX
        $("#" + fid).find(".folder-title").html(folderNewName);
        $("#" + fid).find(".subfoldertitle").html(folderNewName);
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
//  COLOR FOLDER   //
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
      $("#" + fid).find(".foldericon > i").css("color", colorToAssign);
      catalog.folders[fid] = catalog.folders[fid] || {};
      catalog.folders[fid].color = colorToAssign;
      updateLocalCatalog();
    } else {
      handleError("Error setting folder color", error);
    }
  });
  hideRightClickMenu();
});



/////////////////////
//   MOVE FOLDER   //
/////////////////////

function moveFolder(fid, toFID) {
  // "fromFID" and "toFID" are technically just "folder.parent";
  toFID = toFID || null;
  if (fid) {    
    if (fid !== toFID) {

      foldersRef.child(fid).update({
        parent : toFID
      },function(error){
        // the rest we'll capture in folderMoved

        if (error) {
          error = error || {};
          error.movedFID = fid;
          error.toFID = toFID;
          handleError("Error moving folder to parent.", error);
        }
      });

    }
  } 
  hideRightClickMenu();
}

function folderMoved(fid, toFID) {
  selectedFIDtoMove = null;
  
  catalog.folders[fid] = catalog.folders[fid] || {};

  var oldParent = catalog.folders[fid].parent || null;
  var newParent = toFID;
  
  catalog.folders[fid].parent = toFID;
  
  updateLocalCatalog();

  if (firstDocLoadComplete) {
    if (oldParent !== newParent) {

      // this is to ignore the initial socket calls.
      // which means that folderMoved will only fire if user moves a folder after the UI is ready.
      // this also means, if you move a folder on device 2, while device 1 is on lockscreen, move will be ignored on device 1.
      // in a rare scenario, this could result in temporarily missing files / folders.
      
      if ($( "#" + fid ).length) {  
        // already in dom
        // which means it's likely a sub from active folder to inactive.
        // or a root folder moving to sub.
        // or a new sub folder.
        
        $( "#" + fid ).slideUp(300, function() {
          $( "#" + fid ).remove();
          setTimeout(function () {
            appendFolder(catalog.folders[fid], fid, true);
          }, 50);
        });

      } else {
        // not in dom, 
        // which means it's a sub from inactive folder to active folder.
        // (most likely will happen on real-time sync scenarios with 2 devices)      
        appendFolder(catalog.folders[fid], fid, true);
      }

    }
    
    hideModal("docs-move-folder-modal");
  }
}

var selectedFIDtoMove;
function moveFolderSelectionMade() {
  catalog.folders[selectedFIDtoMove] = catalog.folders[selectedFIDtoMove] || {};
  
  var toFID = $(".docs-move-folders-list-item.is-active").attr("fid");
  var fromFID = catalog.folders[selectedFIDtoMove].parent;

  if (selectedFIDtoMove !== toFID && toFID !== fromFID) {
    progressModal("docs-move-folder-modal");
    moveFolder(selectedFIDtoMove, toFID);
  }
}

$("#folder-dropdown").on('click', ".move-button", function(event) {
  selectedFIDtoMove = rightClickedID();
  prepareMoveModal("folder");
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
  
  // folder has subfolders. don't allow ghosting. 
  if (subfoldersOfFID(fidToGhost).length > 0) {
    $("#cant-ghost-folder").show();
    $("#ghost-folder-modal").find(".ghost-status").hide();
    showGhostModal();
  } else {
    $("#cant-ghost-folder").hide();
    $("#ghost-folder-modal").find(".ghost-status").show();
  

    // this is to test hashing the title to see if it has any invalid / wide / unsupported / unhashable characters
    hashString(ghostFTitleToConfirm).then(function(testHashingTheTitle){    
      $("#ghost-folder-confirm-input").attr("placeholder", ghostFTitleToConfirm);
      $(".invalid-foldername").removeClass("shown");
      saveDoc(prepareForGhostFolderModal);
      $("#folders-button").click();
    }).catch(function(e){
      $(".invalid-foldername").addClass("shown");
    });

  }

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
    foldersRef.child(fidToGhost).update({"title" : ghostingTitle, parent : null}, function(error){
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
            ghostingTitle = "A Ghosting Folder Title"; // this is set to something weird so that in decrypt title something won't accidentally match.

            docsOfFID(fidToGhost).forEach(function(ghostedDID){
              removeDocFromDOM(ghostedDID);
              delete catalog.docs[ghostedDID];
              offlineStorage.removeItem(ghostedDID).catch(function(err) {
                if (err) {
                  err.fid = fidToGhost;
                  err.did = ghostedDID;
                  handleError("Error iterating offline documents", err);
                }
              });
            });

            updateLocalCatalog();
            updateFolderIndexes();
          }
        });
      }
    });
  }).catch(function(e){
    handleError("Error hashing title in makeGhostFolder", e);
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
      if (error) {
        handleError("Error while requesting to summon ghost folder", error);
      }
    });

    dataRef.child("summonghost").on('value', function(snapshot) {
      if (snapshot === undefined || snapshot === null || !snapshot.val() || snapshot.val() === "" || snapshot.val() === " "){
        $("#ghost-info-modal").find(".fa-cog").addClass("fa-eye").removeClass("fa-cog fa-spin fa-fw");
        $("#ghost-folder-input").val("");
        $("#ghost-folder-summon-button").removeClass("is-loading").prop("disabled", false).attr("disabled", false);
        $("#ghost-folder-input").prop('disabled', false);
        summoning = false;
        hideModal("ghost-info-modal");
      }
    });
  }).catch(function(e){
    handleError("Error hashing title in summonGhostFolder", e);
  });
}

var summoning = false; // otherwise this fires twice, causing the server to send permission denied.
$("#ghost-folder-input").on('keydown keypress paste copy cut change', function(event) {
  setTimeout(function(){
    if (event.keyCode == 13 && $("#ghost-folder-input").val().trim() !== "") {
      if(!summoning) {
        summoning = true;
        summonGhostFolder();
      }
    }
    if ($("#ghost-folder-input").val().trim() !== "") {
      $("#ghost-folder-summon-button").prop("disabled", false).attr("disabled", false);
    } else {
      $("#ghost-folder-summon-button").prop("disabled", true).attr("disabled", true);
    }
    if (event.keyCode == 27) {
      $("#ghost-folder-input").val("");
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
$("#all-folders, #results").on('click', '.folder-card', function(e) {
  var fid = $(this).parents(".afolder").attr("id") || $(this).parents(".afolder").attr("fid");
  var isItASearchResult = $(this).parents("#results").length;

  catalog.folders[fid] = catalog.folders[fid] || {};
  var archived = catalog.folders[fid].archived || null;
  if (!$(e.target).is(".folderrecent") && $(e.target).parents(".folderrecent").length === 0) {
    if (!archived) {
      if (isItASearchResult) { clearSearch(); }
      loadFolder(fid);
    } else {
      foldersRef.child(fid).update({archived : null});
    }
  }
});

$("#all-folders, #results").on('click', '.folder-title', function(e) {
  var fid = $(this).parents(".afolder").attr("id") || $(this).parents(".afolder").attr("fid");
  var isItASearchResult = $(this).parents("#results").length;

  catalog.folders[fid] = catalog.folders[fid] || {};
  var archived = catalog.folders[fid].archived || null;
  if (!archived) {
    if (isItASearchResult) { clearSearch(); }
    loadFolder(fid);
  } else {
    foldersRef.child(fid).update({archived : null});
  }
});

$("#all-active-folder-contents").on('click', '.subfolder', function(e) {
  if (!$(e.target).is(".folderctx") && $(e.target).parents(".folderctx").length === 0) {
    var fid = $(this).attr("id");
    loadFolder(fid, true);
  }
});

function loadFolder (fid, animate) {
  animate = animate || false;
  // START ANIMATING FOLDER FOR 0.25S
  // YOU HAVE LESS THAN THAT TO POPULATE THE DOCS. 
  var folder = $("#" + fid);
  folder.addClass("is-active");

  if (animate) {
    $("#all-active-folder-contents, #active-folder-back, .active-folder.foldertab").fadeOut(250, function() {
      $("#all-active-folder-contents").html("");
      $("#active-folder-upload-button").find("label").attr("for", "upload-to-" + fid);
      // RENDER & APPEND DOCS OF FID TO ACTIVE FOLDER DOCS
      loadFolderContents(fid, animate);
    });
  } else {
    $("#all-active-folder-contents").html("");
    $("#active-folder-upload-button").find("label").attr("for", "upload-to-" + fid);
    // RENDER & APPEND DOCS OF FID TO ACTIVE FOLDER DOCS
    loadFolderContents(fid, animate);
  }

  // THIS WILL TAKE 0.75S IN TOTAL.
  loadLeftViewPos("2");
}

function closeActiveFolder () {
  //remove docs from dom after 0.5s to acommodate the opacity animation;
  setTimeout(function () {
    // REMOVE DOCS FROM ACTIVE FOLDER DOM
    $("#all-active-folder-contents").html("");
    $("#active-folder-upload-button").find("label").attr("for", "");
    activeFolderID = "root";
  }, 510);

  // remove active folder class with a delay to make it inactive after the scroll animation is complete
  setTimeout(function () {
    $(".afolder.is-active").removeClass("is-active"); 
  }, 400);	
}

var activeFolderParent = null;

function loadFolderContents (fid, animate) {
  var allDocsArray = Object.values(catalog.docs);

  allDocsArray.sort(gensort); // SORT BASED ON RECENCY
  allDocsArray.forEach(function(doc){
    if (doc.fid === fid) {
      $("#all-active-folder-contents").prepend(renderDoc(doc, "activefolder"));
      
      if (isDocSelected(doc.did)) {
        $(".doc[did='" + doc.did + "']").addClass("selected");
      }

      if (doc.isoffline) {
        addOfflineBadgeToDoc(doc.did);
      }
    }
  });

  var allFoldersArray = Object.values(catalog.folders);
  allFoldersArray.forEach(function(folder){
    if (folder.parent === fid) {
      $("#all-active-folder-contents").append(renderSubFolder(folder));
    }
  });

  catalog.folders[fid] = catalog.folders[fid] || {};
  var sortType = catalog.folders[fid].sortdocs || "azasc";
  sortContentsOfActiveFolder (sortType);
  if (!indexingInProgress) {
    decideWhatToDecryptInCatalog(fid);
  }
  activeFolderID = fid;

  if (catalog.folders[fid].parent) {
    activeFolderParent = catalog.folders[fid].parent;
  } else {
    activeFolderParent = null;
  }

  if (animate) {
    $("#all-active-folder-contents, #active-folder-back, .active-folder.foldertab").fadeIn(250);
  }
}



function loadParentFolder() {
  var parentFID = activeFolderParent || null;
  if (parentFID) {
    if (parentFID !== "root") {
      loadFolder(parentFID, true);
    } else {
      $('#folders-button').click();
    }
  } else {
    $('#folders-button').click();
  }
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
  $(".folderrecent[did='" + did + "']").html('<span class="icon"><i class="fa fa-fw fa-clock-o"></i></span>' + newtitle);
  $(".folderrecent.active[did='" + did + "']").html('<span class="icon"><i class="fa fa-fw fa-caret-right"></i></span>' + newtitle);

  $(".doc[did='"+did+"']").find(".doctitle").html(newtitle);
  $(".doc[did='"+did+"']").find(".docicon").find("i").removeClass("fa fa-fw fa-file-text-o").addClass(extractFromFilename(newtitle, "icon"));

  if (did === activeFileID) { $("#file-viewer-title").html(newtitle);}
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


$('#active-folder-new-doc-button').on('click', function (event) {
  event.preventDefault();
  if (usedStorage <= allowedStorage) {
    showDocProgress("Saving Current Document");
    saveDoc(newActiveFolderDoc);
  } else {
    exceededStorage();
  }
});


function newActiveFolderDoc () {

  showDocProgress("Creating New Document");

  // first check if uncategorized folder exists

  var activeFolderNewDocTitle = "New Document";
  var fid = activeFolderID;
  if (activeFolderNewDocTitle !== "") {
    var did = "d-" + newUUID();
    var tempGen = (new Date()).getTime() * 1000; // this will change anyway, but this allows for syncing devices to update this doc as recent.

    encryptTitle(did, JSON.stringify(activeFolderNewDocTitle), function(encryptedTitle){
      var docData = { docid : did, fid : fid, generation : tempGen, title : encryptedTitle };
      foldersRef.child(fid + "/docs/" + did).update(docData, function(){
        
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

  unlockEditor();

  //set new did active
  activeDocID = did;
  activeDocTitle = dtitle;

  document.title = dtitle;
  $("#active-doc-title").html(dtitle);
  $("#active-doc-title-input").val(dtitle);
  $("#active-doc-title-input").attr("placeholder", dtitle);

  updateDocTitleInDOM(did, dtitle);
  prepareDocContextualButton(did);
  
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
    if (idleTime > 3) { // 3 secs if online
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
  var timeoutAmount;
  if (userPreferences) {
    timeoutAmount = userPreferences.general.inactivityTimeout * 60000; // default is 30 mins
  } else {
    timeoutAmount = 30 * 60000; // default is 30 mins
  }

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
  var docElem = $(".doc[did='"+did+"']");
  docElem.find(".docprogress").addClass("docprogress-visible");
  getFileMeta(did + ".crypteefile").then(function(metadata){
    $.ajax({ url: parsedDocURL(did + ".crypteefile", metadata.token), type: 'GET',
      success: function(encryptedFileContents){
        docElem.find(".docprogress").attr("max", "0");
        docElem.find(".docprogress").attr("value", "0");
        docElem.find(".docprogress").removeClass("docprogress-visible");
        fileLoaded(did, dtitle, encryptedFileContents, preview, callback, callbackParam);
      },
      error:function (xhr, ajaxOptions, thrownError){
        console.log(thrownError);
        showDocProgress("One moment please");
        window.location.reload();
      }
    }).progress(function(e) {
      var loadedSize = formatBytes(e.loaded);
      var totalSize = formatBytes(e.total);
      docElem.find(".docprogress").attr("max", e.total);
      docElem.find(".docprogress").attr("value", e.loaded);
    });
  }).catch(function(e){
    handleError("Error Downloading File", e);
    // File or doc doesn't exist at all ~ shit. alright let's try to repair things.
    // Chances are we've got a problem.
    showDocProgress("Seems like this file doesn't exist or you don't have permission to open it. <br>We're not sure how this happened.<br> Please try again shortly, or contact our support. <br>We're terribly sorry about this.");
    fixFilesAndFolders(did);
  });
}








$("#docs-left-wrap").on("click", ".doc, .folderrecent", function(e) {
  var did = $(this).attr("did");
  var selection = $(this);
  var shifted = e.shiftKey;
  var decrypting = $(this).hasClass("decrypting");
  
  if (!decrypting) {  
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
  }
});

$("#docs-left-wrap").on("click", ".folderctx", function(e) {
  var fid = $(this).parents(".afolder").attr("id");
  var selection = $(this);
  var eventToPass = e;
  if (selection.parents("#all-recent").length) {
    eventToPass.pageX = 86;
  } else {
    eventToPass.pageX = 73;
  }
  if (!$("#folder-dropdown[selectedid='"+fid+"']").hasClass("shown")) {
    showRightClickMenu("#folder-dropdown",eventToPass);
  } else {
    hideRightClickMenu();
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
  
  if (did) {
    breadcrumb('[LOAD] – Loading ' + did);
  }
  
  $(".outdated-message").fadeOut();
  $(".outdated-save-message").fadeOut();

  //get necessary variables
  var itsAFile = false;
  var itsADoc = false;
  var offlineGeneration = 0;
  var docsize;
  var token;
  
  catalog.docs[did] = catalog.docs[did] || {};

  if (catalog.docs[did].isfile) {
    itsAFile = true;
  } else {
    itsADoc = true;
  }

  var dtitle; 
  if (did === "home") {
    dtitle = "Home Document";
  } else {
    dtitle = titleOf(did) || "Document";
  }

  if (itsADoc) {
    //DOWNLOAD _DOC

    //loading indicator
    if (dtitle) {
      showDocProgress("Loading " + dtitle + "<p class='cancel-loading clickable' onclick='cancelLoading();'>Cancel</p>");
    } else {
      showDocProgress("Loading Document ...");
    }

    getFileMeta(did + ".crypteedoc").then(function(metadata){      
      docsize = metadata.size;
      currentGeneration = metadata.generation;
      token = metadata.token;

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
            downloadOnlineCopy(token);
          }

          // HIDE THE DROPDOWN MAKE OFFLINE / show make ONLINE BUTTON
          $(".dropdown-makeoffline-button").hide();
          $(".dropdown-makeonline-button").show();
        } else {
          // use online copy, there's no offline one.
          downloadOnlineCopy(token);

          $(".dropdown-makeoffline-button").show();
          $(".dropdown-makeonline-button").hide();
          // SHOW THE DROPDOWN MAKE OFFLINE / HIDE make ONLINE BUTTON
        }
      }).catch(function(error) {
        error.did = did;
        handleError("Error getting offline document from storage", error);
      });

    }).catch(function(error) {
      if (connected && navigator.onLine) {
        if (did === "home") {
          breadcrumb("Couldn't find home doc. Attempting to fix.");
          fixHomeDoc(loadDoc, "home");
        } else {  
          breadcrumb("Couldn't find doc. Attempting to fix.");          
          showDocProgress("One moment please<br>Our system has detected an error<br>and it's self-repairing.");
          fixFilesAndFolders(did);
        }
        handleError("Error Loading Doc/File", error);
      }
    });

  } else {
    // IT'S A FILE. LOAD PREVIEWER INSTEAD.
    var preview = true;
    downloadFile(did, dtitle, preview, callback, callbackParam);
  }





  function downloadOnlineCopy(token) {
    breadcrumb('[LOAD] – Downloading Online Copy');
    if (preloadedEncryptedDeltas) {      
      var parsedDelta = preloadedEncryptedDeltas; 
      try {
        parsedDelta = JSON.parse(preloadedEncryptedDeltas).data;
      } catch (error) {}
      
      useOnlineCopy(parsedDelta);
    } else {
      var preParsedURL = parsedDocURL(did + ".crypteedoc", token);
      $.ajax({ url: preParsedURL, type: 'GET',
        success: function(parsedEncryptedDocDelta){
          useOnlineCopy(parsedEncryptedDocDelta);
        },
        error:function (xhr, ajaxOptions, thrownError){
          console.log(thrownError);
          showDocProgress("One moment please");
          window.location.reload();
        }
      });
    }
  }

  function useOfflineCopy (delta) {
    breadcrumb('[LOAD] – Using Offline Copy');
    if (keyToRemember) {
      var offlineEncryptedDelta = JSON.parse(delta).data;
      decrypt(offlineEncryptedDelta, [keyToRemember]).then(function(offlineCopyPlaintext) {
        var offlineCopyDecryptedText = offlineCopyPlaintext.data;
        quill.setContents(JSON.parse(offlineCopyDecryptedText));
        currentGeneration = offlineGeneration;
        docLoaded();
      }).catch(function(e){
        loadHomeDoc();
      });
    } else {
      // tried loading offline, but there was no keyToRemember. 
      // Now. this means there's a newer offlien copy, but we can't decrypt this.
      // Skip to loading home, and hope that keyToRemember gets set. This will pass the responsibility to upsync offline docs. 
      // if the key gets set, we're good. 
      // if not, upsync decides what happens. 
      // likely will get deleted automatically since it won't be possible to decrypt if you can't get the key.
      loadHomeDoc();
    }
  }

  function useOnlineCopy (parsedOnlineEncryptedDelta) {
    breadcrumb('[LOAD] – Using Online Copy');
    decrypt(parsedOnlineEncryptedDelta, [theKey]).then(function(onlineCopyPlaintext) {
      var onlineCopyDecryptedText = onlineCopyPlaintext.data;
      quill.setContents(JSON.parse(onlineCopyDecryptedText));
      docLoaded();
    });
  }





  function docLoaded(){
    breadcrumb('[LOAD] – Running post-load operations');

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

    if (did === "home"){
      dtitle = "Home";
    }

    if (catalog.docs[did].islocked) {
      lockEditor();
    } else {
      unlockEditor();
    }

    prepareDocContextualButton(did);

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
    checkAttachmentsOfDocument();

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
    breadcrumb('[LOAD] – Finished Loading: ' + did);
    callback(callbackParam);

  }

}










function fileLoaded (did, dtitle, encryptedFileContents, preview, callback, callbackParam) {
  decrypt(encryptedFileContents, [theKey]).then(function(plaintext) {
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

  getFileMeta(did + ".crypteefile").then(function(metadata) {
    filesize = metadata.size;

    if (isios) {
      // if (isInWebAppiOS) {
      //   var urlToPass = "https://flare.crypt.ee/docsdld?dlddid=" + did;
      //   $("#active-file-download-button").attr("href", urlToPass);
      // } else {
        $("#active-file-download-button").attr("href", decryptedContents);
      // }
      $("#active-file-download-button").addClass("openInSafari");
      $("#active-file-download-button").attr("target", "_blank");
    }

    if (ext.match(/^(jpg|jpeg|png|gif|svg|webp)$/i)) {
      breadcrumb('[PREVIEW] – Supported Format (' + ext + ")");
      displayImageFile(dtitle, did, decryptedContents, callback, filesize, callbackParam);
      resetFileViewer = true;
    }
    else if (ext.match(/^(mp3)$/i)) {
      breadcrumb('[PREVIEW] – Supported Format (' + ext + ")");
      displayAudioFile(dtitle, did, decryptedContents, callback, filesize, callbackParam, ext);
      resetFileViewer = true;
    }
    else if (ext.match(/^(mp4|mov)$/i)) {
      breadcrumb('[PREVIEW] – Supported Format (' + ext + ")");
      displayMP4File(dtitle, did, decryptedContents, callback, filesize, callbackParam);
      resetFileViewer = true;
    }
    else if (ext.match(/^(pdf)$/i)) {
      breadcrumb('[PREVIEW] – Supported Format (' + ext + ")");
      // displayPDFNatively(dtitle, did, decryptedContents, callback, filesize, callbackParam);
      displayPDFWithPDFjs(dtitle, did, decryptedContents, callback, filesize, callbackParam);
      resetFileViewer = true;
    }
    else if (ext.match(/^(htm|html)$/i)) {
      breadcrumb('[PREVIEW] – Supported Format (' + ext + ")");
      importHTMLDocument(dtitle, did, decryptedContents, callback, filesize, callbackParam, null, null);
      resetFileViewer = false;
    }
    else if (ext.match(/^(enex)$/i)) {
      breadcrumb('[PREVIEW] – Supported Format (' + ext + ")");
      importEvrntDocument(dtitle, did, decryptedContents, callback, filesize, callbackParam);
      resetFileViewer = false;
    }
    else if (ext.match(/^(txt|md)$/i)) {
      breadcrumb('[PREVIEW] – Supported Format (' + ext + ")");
      importTxtOrMarkdownDocument(dtitle, did, decryptedContents, callback, filesize, callbackParam);
      resetFileViewer = false;
    }
    else if (ext.match(/^(crypteedoc|ecd)$/i)) {
      breadcrumb('[PREVIEW] – Supported Format (' + ext + ")");
      importCrypteedoc(dtitle, did, decryptedContents, callback, filesize, callbackParam);
      resetFileViewer = false;
    }
    else {
      handleError('[PREVIEW] – Unsupported Format (' + ext + ")", { did : did }, "info");
      displayUnsupportedFile(dtitle, did, decryptedContents, callback, filesize, callbackParam);
      resetFileViewer = true;
    }

    if (resetFileViewer) {
      stopLoadingSpinnerOfDoc(did);

      $("#file-viewer").removeClass("unsupported");
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
  
  if (isios) {
    if (!isInWebAppiOS || isipados) {
      window.open(activeFileContents,'_blank');
    } else {
      // this is handled in previewController
    }
  } else {
    if (!isipados) {
      saveAs(dataURIToBlob(activeFileContents), activeFileTitle);
    } else {
      window.open(activeFileContents,'_blank');
    }
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
  $(".docs-body").removeClass("sideBySide");
}

function sideBySideFileViewer() {
  $(".docs-body").toggleClass("sideBySide");
}

function setActiveFile(decryptedContents, dtitle, did) {
  activeFileContents = decryptedContents;
  activeFileTitle = dtitle;
  activeFileID = did;

  $(".activefile").removeClass("activefile");
  $(".doc[did='"+did+"']").addClass("activefile");
}

function displayImageFile (dtitle, did, decryptedContents, callback, filesize, callbackParam) {
  setActiveFile(decryptedContents, dtitle, did);
  
  $("#file-viewer-sidebyside-button").show();
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
  setActiveFile(decryptedContents, dtitle, did);

  $("#file-viewer-sidebyside-button").show();
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
  setActiveFile(decryptedContents, dtitle, did);

  $("#file-viewer-sidebyside-button").show();
  $('#file-viewer').addClass("loading-contents");

  setTimeout(function () {

    $("#file-viewer").width("9999");
    $("#file-viewer").height("9999");

    // var pdfData = "data:application/pdf;base64," + decryptedContents;
    // var pdfData = decodeBase64(decryptedContents);
    $('#file-viewer-contents').html('<iframe id="embeddedPDFViewer" src="../pdf/viewer.html"><p>It seems your browser does not support PDFs. Please download the PDF to view it</p></iframe>');

    var pdfjsframe = document.getElementById('embeddedPDFViewer');
    pdfjsframe.onload = function() {
      var pdfData = convertDataURIToBinary(decryptedContents);
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
  setActiveFile(decryptedContents, dtitle, did);

  $("#file-viewer-sidebyside-button").hide();
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
  setActiveFile(decryptedContents, dtitle, did);
  
  $("#file-viewer-sidebyside-button").show();
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

  setActiveFile(decryptedContents, dtitle, did);

  var iconClass = extractFromFilename(dtitle, "icon");
  var b64OfFile = decryptedContents.replace("data:", "data:application/octet-stream");

  $("#file-viewer-sidebyside-button").hide();
  $('#file-viewer').addClass("loading-contents");

  setTimeout(function () {

    
    $("#file-viewer").addClass("unsupported");
    $("#file-viewer-title").html(dtitle);
    $("#file-viewer-filesize").html(formatBytes(filesize));

  if (isios && !isInWebAppiOS) {
    $('#file-viewer-contents').html('<a class="unsupported-file-preview clickable openInSafari" href="'+decryptedContents+'" target="_blank"><p><b>'+dtitle+'</b></p><span class="icon is-large"><i class="fa fa-download"></i></span><br><p class="deets">Unfortunately it isn\'t possible to preview this filetype on your device in browser/app yet. Click here to download/open the file.</p></a>');
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

    if (docChanged && !isDocOutdated && typeof did != 'undefined') {

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
        if (typeof did != 'undefined') {
          saveComplete(did, callback, callbackParam);
        } else {
          // chances are the user clicked "cancel loading" before the first doc loaded.
          // so the activeDocID is undefined.
          callback(callbackParam);
        }
      }
    }

}


function encryptAndUploadDoc(did, fid, callback, callbackParam) {
  var docRef = rootRef.child(did + ".crypteedoc");
  var totalBytes;
  var plaintextDocDelta = JSON.stringify(quill.getContents());
  breadcrumb("[SAVE] – Encrypting " + did);
  encrypt(plaintextDocDelta, [theKey]).then(function(ciphertext) {
      var encryptedDocDelta = JSON.stringify(ciphertext);
      saveUpload = docRef.putString(encryptedDocDelta);
      breadcrumb("[SAVE] – Uploading " + did);
      saveUpload.on('state_changed', function(snapshot){
        $('#main-progress').attr("max", snapshot.totalBytes).removeClass("is-danger is-success is-info").addClass("is-warning");
        $('#main-progress').attr("value", snapshot.bytesTransferred);
        totalBytes = snapshot.totalBytes;
        var filesize = formatBytes(totalBytes);
        $("#filesize").html(filesize);
        $("#filesize").attr("size", filesize);
        lastActivityTime = (new Date()).getTime();
        switch (snapshot.state) { case firebase.storage.TaskState.PAUSED: break; case firebase.storage.TaskState.RUNNING: break; }
      }, function(error) { err(error); });
      saveUpload.then(function(snap){
        saveUploadComplete(did, snap.metadata, callback, callbackParam);
      }).catch(function(error) { err(error); });
  });

  function err(error) {
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
    
  }
}


function saveUploadComplete(did, metadata, callback, callbackParam) {
  callback = callback || noop;

  breadcrumb("[SAVE] – Upload Completed " + did);

  var tagsOfDoc = [];
  if (catalog.docs[activeDocID]) {
    tagsOfDoc = catalog.docs[activeDocID].tags || []; // this is updated in update active tags in save
  }

  currentGeneration = metadata.generation;

  if (did !== "home") {
    catalog.docs[did].gen = currentGeneration;
    updateLocalCatalog();

    $(".doc[did='"+did+"']").attr("gen", currentGeneration / 1000);
    $(".doc[did='"+did+"']").find(".doctime").html("Seconds ago");
    $(".doc[did='"+did+"']").prependTo("#all-recent");
    var fid = fidOfDID(did);
    breadcrumb("[SAVE] – Encrypting Title & Tags " + did);
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

}

function saveComplete(did, callback, callbackParam){
  breadcrumb("[SAVE] – Saved " + did);

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
    err.did = did;
    handleError("Error getting offline document from storage", err);
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
    $("#delete-doc-modal").find(".subtitle").html("You're about to delete the currently open document");
  } else {
    $("#delete-doc-modal").find(".subtitle").html("You're about to delete the offline copy of the currently open document. This will <b>not</b> delete the online copy of this document if there is any. You will need to delete the online copy separately.");
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
  $("#delete-doc-modal").find(".subtitle").html("Deleting ...");

  var fid = fidOfDID(did);
  var docRef = rootRef.child(did + ".crypteedoc");

  // Delete the file
  docRef.delete().then(function() {
    // File deleted successfully
  
    foldersRef.child(fid + "/docs/" + did).remove();
    hideDeleteDocModal();
    refreshFolderSort(fid);
  
  }).catch(function(error) {
    if (error) {
      if (error.code === "storage/object-not-found") {
        delete catalog.docs[did];
        updateLocalCatalog();
      } else {
        handleError("Error Deleting File", error);
        $("#delete-doc-modal").find(".title").html("Error Deleting Doc... Sorry.. Please Reload the page.");
      }
    } else {
      handleError("Error Deleting File", error);
      $("#delete-doc-modal").find(".title").html("Error Deleting Doc... Sorry.. Please Reload the page.");
    }
  });

}

function deleteDocComplete(fid, did, callback, callbackParam) {
  callback = callback || noop;

  removeDocFromDOM(did, fid);

  if (catalog.docs[did]) {
    if (catalog.docs[did].fid === fid) {
      // if doc didn't move, and it's ONLY deleted.
      delete catalog.docs[did];
      updateLocalCatalog();
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





//////////////////////////////////
//   COPY DOC /// DUPLICATE DOC //
//////////////////////////////////
// use "copy" for user facing terms
// use "duplicate" in code. 
// this is to ensure the term "copy" isn't misused in code in any way

function duplicateDoc (did, callback, callbackParam) {
  callback = callback || noop;
  if (did) {
      
    showSyncingProgress(0, 1, "Copying Document...");
    startLoadingSpinnerOfDoc(did);

    // old doc meta. 
    var fid = fidOfDID(did) || "f-uncat";
    var docTitle;
    if (did === "home") {
      docTitle = "Home Document";
    } else {
      docTitle = titleOf(did) || "Untitled Document";
    }

    // new doc meta 
    var dupDID = "d-" + newUUID();
    var newGen = (new Date()).getTime() * 1000; // this will change anyway, but this allows for syncing devices to update this doc as recent.
    
    var newTitle;
    var docRef;
    var dupRef;
    var docData = {};

    catalog.docs[did] = catalog.docs[did] || {};

    if (catalog.docs[did].isfile) {
      docRef = rootRef.child(did + ".crypteefile");
      dupRef = rootRef.child(dupDID + ".crypteefile");

      var extension = docTitle.slice((docTitle.lastIndexOf(".") - 1 >>> 0) + 2);
      
      // remove extension
      var fileTitle = docTitle.replace("." + extension, "");
      
      // now add it back
      newTitle = fileTitle + " (Copy)." + extension;
      docData.isfile = true;

    } else {
      docRef = rootRef.child(did + ".crypteedoc");
      dupRef = rootRef.child(dupDID + ".crypteedoc");
      newTitle = docTitle + " (Copy)";
    }

    if (fid === "f-uncat") {
      // first check to see if the uncat folder exists, otherwise you'd be fucked.
      foldersRef.child("f-uncat").once('value', function(uncatShot) {
        if (uncatShot.val() !== null) {
          // if yes, save new doc into it.
          createDuplicate();
        } else {
          newFolder(function(){
            // if not create uncat folder for the first time.
            createDuplicate();
          }, "Inbox", "uncat");
        }
      });
    } else {
      createDuplicate();
    }

  } else {
    showErrorBubble("Error copying document");
    hideSyncingProgress();
  }

  function createDuplicate() {  
  
    breadcrumb("[DUPLICATE DOC] – Downloading Original " + did + " -> " + dupDID);

    docRef.getDownloadURL().then(function(docURL) {
      $.ajax({ url: docURL, type: 'GET',
        success: function(encryptedDocDelta){
          
          breadcrumb("[DUPLICATE DOC] – Uploading Duplicate " + did + " -> " + dupDID);
          
          var dupUpload = dupRef.putString(encryptedDocDelta);
          dupUpload.on('state_changed', function(snapshot){  
          
            lastActivityTime = (new Date()).getTime();
            switch (snapshot.state) { case firebase.storage.TaskState.PAUSED: break; case firebase.storage.TaskState.RUNNING: break; }
            showSyncingProgress((snapshot.bytesTransferred * 2), (snapshot.totalBytes * 2), "Copying Document...");
          }, function(error) {
            if (usedStorage >= allowedStorage) {
              exceededStorage(callback, callbackParam);
            } else {      
              checkConnection(function(status){
                if (status) {
                  erroredOut("Error uploading duplicate doc", error, fid, did, dupDID);
                }
              });
            }
          }, function (){

            breadcrumb("[DUPLICATE DOC] – Encrypting Duplicate Title " + did + " -> " + dupDID);
            
            encryptTitle(dupDID, JSON.stringify(newTitle), function(encryptedTitle){
              docData.docid = dupDID;
              docData.fid = fid;
              docData.generation = newGen;
              docData.title = encryptedTitle;
              
              foldersRef.child(fid + "/docs/" + dupDID).update(docData, function(){
                
                refreshFolderSort(fid);
                breadcrumb("[DUPLICATE DOC] – DONE. " + did + " -> " + dupDID);
                stopLoadingSpinnerOfDoc(did);
                
                showSyncingProgress(); // this will receive 100 / 100 since it's already complete.
                $("#sync-progress").addClass("done");
                setTimeout(function () {
                  hideSyncingProgress();
                }, 5000);

                callback(callbackParam);

              }).catch(function(error) {
                erroredOut("Error setting duplicate doc data in folder", error, fid, did, dupDID);
              });
            });

          });
        },
        error:function (xhr, ajaxOptions, error){
          erroredOut("Error downloading original doc for duplication", error, fid, did);
        }
      }).progress(function(e) {
        showSyncingProgress(e.loaded, (e.total * 2), "Copying Document...");
      });
  
    }).catch(function(error) {
      erroredOut("Error getting doc url to for duplication", error, fid, did);
    });

  }

  function erroredOut(msg, error, fid, did, dupDID) {
    if (dupDID) { error.dupDID = dupDID; }
    error.did = did;
    error.fid = fid;
    handleError(msg, error);
    hideSyncingProgress();
    stopLoadingSpinnerOfDoc(did);
    showErrorBubble("Error copying document");
  }
}


$("#doc-dropdown").on('click', ".duplicate-button", function(event) {
  var did = rightClickedID();
  duplicateDoc(did);
  hideRightClickMenu();
}); 

$(".document-contextual-dropdown").on('click', ".duplicate-button", function(event) {
  saveDoc(function(){
    duplicateDoc(activeDocID);
    toggleContextualMenu();
  });
}); 




/////////////////////
//   MOVE _DOC  //
////////////////////

function moveDoc (fromFID, toFID, did, callback, callbackParam) {
  breadcrumb("[MOVE] Moving " + did + " from " + fromFID + " to " + toFID);
  callback = callback || noop;
  if (fromFID && toFID && did) {
    if (fromFID === toFID) {
      breadcrumb("[MOVE] It was the same folder. Skipped moving.");
      callback(callbackParam);
    } else {
      foldersRef.child(fromFID + "/docs/" + did).once('value', function(snap)  {
        var theMovingDocsData = snap.val();
        if (theMovingDocsData) {
          theMovingDocsData.fid = toFID;

          foldersRef.child(toFID + "/docs/" + did).set( theMovingDocsData, function(error) {
            if ( !error ) {

              foldersRef.child(fromFID + "/docs/" + did).remove();

              breadcrumb("[MOVE] Moved " + did + " from " + fromFID + " to " + toFID);
              
              /// DOC IS ALREADY UPDATED IN CATALOG! 
              /// USE THE TITLE PRE-MOVE AND CREATE DOC 
              /// IN THE TREE NOW TO SAVE WAITING TIME.
              
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
                    err.did = did;
                    handleError("Error setting offline document to storage", err, "warning");
                  });
                }
              }).catch(function(err) {
                err.did = did;
                handleError("Error getting offline document from storage", err);
              });

            }
            else if( typeof(console) !== 'undefined' && console.error ) {  
              handleError("Error setting moving doc's data", error); console.error(error); 
            }
          });

        } else {
          callback(callbackParam);
        }
      });
    } 
  }
}

$("#doc-dropdown").on('click', ".move-button", function(event) {
  var did = rightClickedID();
  if (!isDocSelected(did)) {
    selectDoc(did);
  }
  prepareMoveModal("docs");
}); 

function moveActiveDocument() {
  clearSelections();
  if (!isDocSelected(activeDocID)) {
    selectDoc(activeDocID);
  }
  prepareMoveModal("docs");
}

$("#selections-dropdown").on('click', ".move-button", function(event) {
  prepareMoveModal("docs");
}); 

function prepareMoveModal(type) {
  // PREPARE THE MODAL. 
  var targetModal; 
  if (type === "docs") {
    targetModal = $("#docs-move-selections-modal");
  } else {
    targetModal = $("#docs-move-folder-modal");
  }

  $(".docs-move-folders-list").addClass("is-loading");
  $(".docs-move-folders-list").find("div").remove();

  var parentsWithChildren = {};

  // first add all the folders in root, and get all parents with children in root
  $.each(catalog.folders, function(fid, folder){
    if (fid !== "f-uncat" && fid !== "undefined" && !folder.archived) {
      if (!folder.parent) {
        targetModal.find(".docs-move-folders-list").append(renderMoveFolderItem(folder, targetModal));
      } else {
        parentsWithChildren[folder.parent] = (parentsWithChildren[folder.parent] || 0) + 1;
      }
    }
  });

  $.each(parentsWithChildren, function(fid, numChildren){
    var folderElement = targetModal.find(".docs-move-folders-list-item[fid='"+fid+"']");
    if (!folderElement.find(".number-of-children").length) {
      var icon = '<span class="number-of-children"><span class="icon is-small"><i class="fa fa-caret-right"></i></span></span>';
      folderElement.append(icon);
    } 
  });

  $('.move-folder').sort(function(a, b) {
    if ($(a).attr("fname").toLowerCase() < $(b).attr("fname").toLowerCase()) {
      return -1;
    } else {
      return 1;
    }
  }).appendTo('.docs-move-folders-list');

  $(".docs-move-folders-list").removeClass("is-loading");

  if (type === "docs") {
    showModal("docs-move-selections-modal");
  } else {
    showModal("docs-move-folder-modal");
  }

  hideRightClickMenu();
}

// SELECT & OPEN FOLDER
$(".move-items-modal").on('click', '.docs-move-folders-list-item', function(event) {
  event.preventDefault();
  $(".docs-move-folders-list-item.is-active").removeClass("is-active");
  $(this).addClass("is-active");
  $(".move-items-modal").find(".is-success").attr("disabled", false).prop("disabled", false);

  var selectedFID = $(this).attr("fid");
  var children = [];
  var parentsWithChildren = {};

  // check if it has children folders
  $.each(catalog.folders, function(fid, folder){
    if (fid !== "f-uncat" && fid !== "undefined" && !folder.archived && folder.parent) {
      if (folder.parent === selectedFID) {
        children.push(folder);
      }
      parentsWithChildren[folder.parent] = (parentsWithChildren[folder.parent] || 0) + 1;
    }
  });

  // has children, so open folder to see children.
  if (children.length > 0) {
    if ($(this).hasClass("is-open")) {
      closeMoveFolder(selectedFID);
    } else {
      openMoveFolder(selectedFID, children, parentsWithChildren);
    }
  }

});

// deselect folder (only for move folders and not for move files)
$("#docs-move-folder-modal").on('click', '.docs-move-folders-list', function(event) {
  event.preventDefault();
  if ($(event.target).parents(".docs-move-folders-list-item").length <= 0 || $(event.target).hasClass("docs-move-folders-list")) {
    $(".docs-move-folders-list-item.is-active").removeClass("is-active");
    closeMoveFolder();
  }
});



// // OPEN FOLDER IN MOVE MODAL TO SEE OTHER FOLDERS IN IT
// $(".move-items-modal").on('click', '.docs-move-folders-list-item.is-active', function(event) {
//   event.preventDefault();


// });

function openMoveFolder(fid, children, parentsWithChildren) {
  $(".docs-move-folders-list-item.is-active").addClass("is-open");
  $(".docs-move-folders-list-item:not(.is-open)").addClass("is-not-open");

  $.each(children, function(i, folder){
    $(".docs-move-folders-list-item.is-active.is-open").after(renderMoveFolderItem(folder));
  });

  $.each(parentsWithChildren, function(fid, numChildren){
    var folderElement = $(".move-items-modal").find(".docs-move-folders-list-item[fid='"+fid+"']");
    if (!folderElement.find(".number-of-children").length) {
      var icon = '<span class="number-of-children"><span class="icon is-small"><i class="fa fa-caret-right"></i></span></span>';
      folderElement.append(icon);
    } 
  });

  setTimeout(function () {
    $(".move-subfolder").slideDown(300);

    // scroll to child
    
    setTimeout(function () {
      if ($(".is-open").parent().position()){
        var offsetFromTop = $(".is-open").parent().position().top;
        $(".docs-move-folders-list").animate({ scrollTop: offsetFromTop }, 500);
      }
    }, 50);

  }, 10);
}

function closeMoveFolder(fid) {
  var openFolder;
  if (fid) {
    openFolder = $(".docs-move-folders-list-item.is-open[fid='"+fid+"']");
  } else {
    openFolder = $(".docs-move-folders-list-item.is-open");
  }
  
  openFolder.siblings(".move-subfolder").slideUp(300, function(){
    openFolder.siblings(".move-subfolder").remove();
    openFolder.siblings(".is-not-open").removeClass("is-not-open");
    openFolder.parent().siblings().find(".is-not-open").removeClass("is-not-open");
    openFolder.removeClass("is-open");
  });
}





var numDocsToMove = 0;
var numDocsMoved = 0;
function moveDocFolderSelectionMade () {
  var toFID = $(".docs-move-folders-list-item.is-active").attr("fid");
  if (toFID) { 
    progressModal("docs-move-selections-modal");
    numDocsToMove = selectionArray.length;
    numDocsMoved = 0;
    
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
  }
}

/////////////////////
//   RENAME _DOC   //
/////////////////////

$("#doc-dropdown").on('click', '.rename-button', function(event) {
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
    $(".rename-doc-status > .title").html("Renaming ... ");

    updateDocTitleInDOM(inactiveDidToRename, newDocName);

    updateDocTitle (inactiveDidToRename, JSON.stringify(newDocName), function(){
      theInput.val(newDocName);
      theInput.attr("placeholder", newDocName);

      offlineStorage.getItem(inactiveDidToRename).then(function (offlineDoc) {
        if (offlineDoc) {
          var updatedDoc = offlineDoc;
          updatedDoc.name = newDocName;
          offlineStorage.setItem(inactiveDidToRename, updatedDoc).catch(function(err) {
            err.did = did;
            handleError("Error setting offline document to storage", err, "warning");
          });
        }
      }).catch(function(err) {
        err.did = did;
        handleError("Error getting offline document from storage", err);
      });

      $(".rename-doc-status > .title").html("Done");
      setTimeout(function(){ hideRenameInactiveDocModal(); }, 1000);
    });

  } else{
    hideRenameDocModal();
  }

}

function hideRenameDocModal () {
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
    $(".rename-doc-status > .title").html("Renaming ... ");

    // if (connectivityMode) {
      // RENAME ONLINE
      updateDocTitleInDOM(activeDocID, newDocName);

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
              err.did = did;
              handleError("Error setting offline document to storage", err, "warning");
            });
          }
        }).catch(function(err) {
          err.did = did;
          handleError("Error getting offline document from storage", err);
        });
        
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
    
    
    if (!selected) {
      // doc wasn't selected. now select it.
      selectDoc(did);
    } else {
      // doc was selected. unselect it. 
      unselectDoc(did);
    }
    
  }
}

function selectDoc (did) {
  var dtitle = titleOf(did); // to see if it's being decrypted.
  var docElem = $(".doc[did='" + did + "']");

  if (dtitle && !docElem.hasClass("decrypting")) { 
    var doc = catalog.docs[did];
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
var downloadQueue = [];
function downloadSelections () {
  completedDownloads = 0;
  showFileDownloadStatus("is-light", '<span class="icon is-small"><i class="fa fa-fw fa-circle-o-notch fa-spin"></i></span> &nbsp; <b>Decrypting &amp; Downloading</b><br>Please <b>do not</b> close this window until all downloads are complete.');
  $("#selection-download-button > i").removeClass("fa-download").addClass("fa-circle-o-notch fa-spin");
  $.each(selectionArray, function(index, selection) {
    $("#file-download-status").append("<br><span id='dld-" + selection.did + "'>" + selection.dtitle + "</span>");
    downloadQueue.push({
      "filename" : selection.dtitle,
      "did" : selection.did
    });
  });
  runDownloadQueue(0);
}

function runDownloadQueue(index) {
  if (downloadQueue[index]) {
    var nextInLine = index + 1;
    downloadFile(downloadQueue[index].did, downloadQueue[index].filename, false, function(){
      completedDownloads++;
      if (downloadQueue[index]) {
        $("#dld-"+downloadQueue[index].did).remove();
      }
      runDownloadQueue(nextInLine);
    });
  } else {
    downloadQueue = [];
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
$("#doc-dropdown").on('click', '.delete-button', function(event) {
  
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


$("#doc-dropdown").on('click', '.download-button', function(event) {
  var did = rightClickedID();
  var dtitle = titleOf(did);

  catalog.docs[did] = catalog.docs[did] || {};
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
    var docElement = "<span class='docToBeDeleted'>"+selection.dtitle+"</span>"
    $(".documents-to-be-deleted").append(docElement);
  });
  $('#delete-selections-modal').addClass("is-active");
}

function deleteSelections () {
  $("#delete-selections-modal").find(".button").addClass("is-loading").prop("disabled", true).attr("disabled", true);
  var deletionsObject = {};
  var didsToDelete = [];
  $.each(selectionArray, function(index, selection) {

    if (connectivityMode) { 

      var did = selection.did;
      var fid = fidOfDID(did);
      
      deletionsObject[fid] = deletionsObject[fid] || {};
      didsToDelete.push(did);

      if (did === activeFileID) {
        hideFileViewer ();
      }

      if (selection.itsADoc) { deletionsObject[fid][did] = did + ".crypteedoc"; }
      if (selection.itsAFile) { deletionsObject[fid][did] = did + ".crypteefile"; }

    } else {
      deleteOfflineDoc(selection.did);
    }

  });

  if (connectivityMode) {
    batchDeleteItems(deletionsObject, function() {
      allSelectionsDeleted(didsToDelete);
    }, function() {
      $(".delete-selections-status").find(".title").html("Error Deleting Doc(s)");
      $(".delete-selections-status").find(".subtitle").html("Please reload the page and try again.");  
    });
  } else {
    hideDeleteSelectionsModal();
    clearSelections();
  }
}

function allSelectionsDeleted (dids) {
  dids.forEach(function(did) {
    delete catalog.docs[did];
    removeDocFromDOM(did);
    offlineStorage.removeItem(did).catch(function(err) {
      if (err) {
        err.did = did;
        handleError("Error removing offline document from storage", err);
      }
    });
  });
  
  hideDeleteSelectionsModal();
  clearSelections();
  updateLocalCatalog();
}

$("#selections-wrapper").on('click', function(event) {
  var eventToPass = event;
  if (searchVisible) {
    event.pageX = 6;
    event.pageY = 60;
  } else {
    event.pageX = 7;
    event.pageY = 55;
  }
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
document.getElementById('all-active-folder-contents').addEventListener('drop', handleFileDrop, false);

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
      showErrorBubble("Unfortunately this feature is only available when you're online.");
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
  
  var targetFolder, targetfid;
  
  if ($(evt.target).parents(".afolder")) {
    targetFolder = $(evt.target).parents(".afolder");
    targetFolder.removeClass("fileDropFolder");
    targetfid = targetFolder.attr("id");
  } 
  
  if ($(evt.target).parents("#all-active-folder-contents").length > 0 || $(evt.target).attr("id") === "all-active-folder-contents") {
    targetfid = activeFolderID;
    $("#all-active-folder-contents").removeClass("fileDropFolder"); 
  }
  
  if (targetfid) {   
    
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

  } else {
    showFileUploadStatus("is-info", "You can drop files onto your folders to upload.");
  }

}

function handleFileSelect(evt) {
  evt.stopPropagation();
  evt.preventDefault();

  dragCounter = 0;
  somethingDropped = true;

  var targetfid = $(evt.target).attr("id").replace("upload-to-", "");
  $("#" + targetfid).removeClass("fileDropFolder");
  $("#all-active-folder-contents").removeClass("fileDropFolder");
  
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

      if (activeFolderID === "root") {
        $("#folders-button").click();
      }
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

  if ($(evt.target).parents("#all-active-folder-contents").length > 0 || $(evt.target).attr("id") === "all-active-folder-contents") {
    $("#all-active-folder-contents").removeClass("fileDropFolder"); 
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
  if ($(evt.target).parents("#all-active-folder-contents").length > 0 || $(evt.target).attr("id") === "all-active-folder-contents") {
    $("#all-active-folder-contents").removeClass("fileDropFolder"); 
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
  if ($(evt.target).parents("#all-active-folder-contents").length > 0 || $(evt.target).attr("id") === "all-active-folder-contents") {
    $("#all-active-folder-contents").removeClass("fileDropFolder"); 
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
  if ($(evt.target).parents("#all-active-folder-contents").length > 0 || $(evt.target).attr("id") === "all-active-folder-contents") {
    $("#all-active-folder-contents").addClass("fileDropFolder"); 
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
      $("#all-active-folder-contents").addClass("fileDropFolder");

      showFileUploadStatus("is-info", "You can drop files onto your folders to upload.");
      setTimeout(function () {
        hideFileUploadStatus();
      }, 3000);

      setTimeout(function () {
        $('.afolder').removeClass("fileDropFolder");
        $("#all-active-folder-contents").removeClass("fileDropFolder");
      }, 250);
      setTimeout(function () {
        $('.afolder').addClass("fileDropFolder");
        $("#all-active-folder-contents").addClass("fileDropFolder");
      }, 500);
      setTimeout(function () {
        $('.afolder').removeClass("fileDropFolder");
        $("#all-active-folder-contents").removeClass("fileDropFolder");
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
      showFileUploadStatus("is-danger", "Error. You have tried uploading an <b>empty file</b> or <b>folder</b>. Currently we intentionally do not support uploading folders or its contents as they can reveal identifiable information about your computer. We suggest that you compress folders before uploading instead. We know this is a major inconvenience, and we're working on finding a solution. <b>If you have selected any files that are not in folders, those are being uploaded.</b>");
    }

  };
  reader.onerror = function(err){
    fileUploadError = true;
    // handleError("", err); // this is not helping anything and only causing anxiety disorder.
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
          handleError("Error Uploading File", error);
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

        // this skips the addedEncryptedItemsToInMemoryCatalog and mark for decrypt there.
        // because we want these changes to go through immediately. 
        processEncryptedDocTitle(did, encryptedTitle);

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
var searchIndexReady = false;
var indexingInProgress = false;
var searchVisible = false;

var searchOptions = {
  shouldSort: true,
  threshold: 0.4,
  location: 0,
  distance: 100,
  maxPatternLength: 32,
  minMatchCharLength: 1,
  includeMatches: true,
  keys: [ "ftype", "name", "fname", "tags"  ]
};


// This will ensure that every file, folder, tag etc are all decrypted. 
// folders are decrypted by default. So check for remaining files here. 
// once it's ready, it will always be sync'ed and ready in the future. 
// it's a fast boot thing. 

function searchProgress(progress) {
  if (progress) {
    $("#search-bar").addClass("indexing");
  } else {
    if (!indexingInProgress) {
      $("#search-bar").removeClass("indexing");
    }
  }
}

function updateSearchProgress(min,max) {
  $("#search-progress").attr("value", min);
  $("#search-progress").attr("max", max);
  if (min === max) {
    searchProgress(false); 
  } else {
    searchProgress(true); 
  }
}

function prepareSearchIndex() {
  if (!searchIndexReady) {

    var dids = Object.keys(catalog.docs);
    var maxNumberOfThings = dids.length * 2; // * 2 for tags
    updateSearchProgress(0,maxNumberOfThings);

    var catalogHasHome = dids.includes("home");
    var numberOfDocs = dids.length;
    if (catalogHasHome) { numberOfDocs = dids.length - 1; }
    if (numberOfDocs >= 1) {
      breadcrumb('Starting to prepare search index');
      indexingInProgress = true;
      decideWhatToDecryptInCatalog(null, true);
    } else {
      updateSearchProgress(maxNumberOfThings,maxNumberOfThings);
      searchProgress(false);
      searchIndexReady = true;
    }
    
  }
}

$("#search-input").on("keydown", function(event) {
  // ios 11 compatiblity. we can't trigger shit with keyup and keydown fires before character is in input.
  setTimeout(function(){

    if (event.keyCode === 27) {
      event.preventDefault();
      clearSearch();
    } else if (event.keyCode === 37 || event.keyCode === 39) {
      event.preventDefault();
    } else if (event.keyCode === 38) {
      event.preventDefault();
      moveSearchUp();
    } else if (event.keyCode === 40) {
      event.preventDefault();
      moveSearchDown();
    } else if (event.keyCode === 91) {
      event.preventDefault();
    } else if (event.keyCode === 93) {
      event.preventDefault();
    } else if (event.keyCode === 16) {
      event.preventDefault();
    } else if (event.keyCode === 17) {
      event.preventDefault();
    } else if (event.keyCode === 18) {
      event.preventDefault();
    } else if (event.keyCode === 20) {
      event.preventDefault();
    } else if (event.keyCode === 9) {
      event.preventDefault();
    } else if (event.keyCode === 13) {
      event.preventDefault();
      if ($( ".highlightedResult" ).length > 0) {
        // open selection.
        
        if ($( ".highlightedResult" ).hasClass("doc")) {
          // doc or file
          $( ".highlightedResult" ).click();
        } else {
          // folder
          $( ".highlightedResult" ).find(".folder-card").click();
        }

        currentResultSelection = 0;
        clearSearch();
      }
    } else {
      currentResultSelection = 0;

      if ($("#search-input").val().trim() === "") {
        clearSearch();
      } else {
        search($("#search-input").val().trim());
      }
    }

  }, 50);
});

$("#search-input").on('focus', function(event) {
  prepareSearchIndex();
}); 

var indexingSearchTimeout; 
var searchTypeTimeout;
function search (term){
  searchProgress(true);
  clearTimeout(searchTypeTimeout);
  searchTypeTimeout = setTimeout(function () {
       
    if (indexingInProgress || !initialDecryptComplete) {
      clearTimeout(indexingSearchTimeout);
      indexingSearchTimeout = setTimeout(function () {
        search(term);
      }, 100);
    } else {
      $("#search-button-icon").addClass("fa-close").removeClass("fa-search");
      var fuse = new Fuse(Object.values(catalog.docs), searchOptions);
      var results = fuse.search(term);
      displaySearchResults(results, term);
    }

  }, 100);
}

var clearSearchTimeout;
function clearSearch () {
  $("#results > div").removeClass("loaded");
  clearTimeout(displayResultsTimeout);
  clearSearchTimeout = setTimeout(function () {
    $("#search-button-icon").removeClass("fa-close").addClass("fa-search");
    $("#results").html("");
    $("#search-input").val("");
    $("#results").fadeOut();
    searchProgress(false);
  }, 500);
  searchVisible = false;
  currentResultSelection = 0;
  clearSelections();
}

var displayResultsTimeout;
function displaySearchResults (results, term) {
  $("#results > div").removeClass("loaded");
  clearTimeout(displayResultsTimeout);
  clearTimeout(clearSearchTimeout);
  displayResultsTimeout = setTimeout(function () {
    clearTimeout(clearSearchTimeout);
    $("#results").html("");
    $("#results").fadeIn();
    searchVisible = true;

    $.each(results, function(i, rslt) {
      var result = rslt.item;
      var resultCard;
      var matchingTag = "";
      var matchedTag = false;
      var matchedName = false;
      var matchedFolder = false;
      var matchedFolderObj;
      var resultTitle = result.name;

      var active = "";
      if (result.did === activeDocID) {
        active = " activedoc";
      }

      if (resultTitle) {
        $.each(rslt.matches, function(i, mtch) {
          if (mtch.key === "fname") {
            matchedFolder = true;
          }

          if (mtch.key === "tags") {
            if (!matchedTag) {
              $.each(result.tags, function(i, tag) {
                if (mtch.value === tag) {
                  matchingTag = '<span class="result-tag"><span class="icon"><i class="fa fa-tag"></i></span>'+underlineSearchResult(mtch.indices,tag)+' </span>';
                }
              });
            }
            matchedTag = true;
          }

          if (mtch.key === "name") {
            resultTitle = underlineSearchResult(mtch.indices,resultTitle);
            matchedName = true;
          }
        });

        if (matchedTag || matchedName) {
          resultCard = renderDoc(result, "search", matchingTag);
          $("#results").append(resultCard);
        }
        
        if (matchedFolder) {
          if ($("#results > .afolder[fid='"+result.fid+"']").length <= 0) {
            var theMatchingFolder = catalog.folders[result.fid];
            if (theMatchingFolder) {
              if (!theMatchingFolder.archived) {
                resultCard = renderFolder(theMatchingFolder, result.fid, "search");
              }
            }
            $("#results").append(resultCard);
          }
        }

      }
    });

    $("#results > div").each(function(i) {
      var result = $(this);
      setTimeout(function () {
        if (result.length > 0) {
          result.addClass("loaded");
        }
      }, i * 40);
    });

    searchProgress(false);
  }, 500);

}

function moveSearchUp () {

  if (currentResultSelection === 0) {
    $( "#results" ).children().first().removeClass('highlightedResult');
  } else {
    $( ".highlightedResult" ).removeClass('highlightedResult').prev().addClass('highlightedResult');
    currentResultSelection--;
  }

  // skip already open doc
  if ($( ".highlightedResult" ).hasClass("activedoc")) {
    moveSearchUp();
  }
}

function moveSearchDown () {
  if ($( "#results" ).children().length === 1 && $( "#results" ).children().first().hasClass("activedoc") ) {
    // this causes infinite loop. keeping it here for a lesson for future. 
    // if the only result is the active doc, and you press "down", since we skip the active doc, it starts an infinite loop.
    // yay
  } else {
    if (currentResultSelection === 0) {
      $( "#results" ).children().first().addClass('highlightedResult');
      currentResultSelection++;
    } else {
      var highres = $( ".highlightedResult" ).removeClass('highlightedResult');
      var nextres = highres.next();
      if (nextres.length > 0) {
        highres.next().addClass('highlightedResult');
        currentResultSelection++;
      } else {
        currentResultSelection = 1;
        $( "#results" ).children().first().addClass('highlightedResult');
      }
    }
  
    // skip already open doc
    if ($( ".highlightedResult" ).hasClass("activedoc")) {
      moveSearchDown();
    }
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
  showPlans();
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
////////////////// EXPORT DOCUMENT  ///////////////////////
///////////////////////////////////////////////////////////

function showExportDocModal() {
  $(".document-contextual-dropdown").removeClass("open");
  showFlyingModal("export-doc-modal");
}

function hideExportDocModal() {
  hideActiveFlyingModal();
}

$('#export-currentdoc-as-html').on('click', function(event) {
  if (event.altKey) {
    exportAsHTML(activeDocID, true);
  } else {
    exportAsHTML(activeDocID, false);
  }
});

$('#export-currentdoc-as-markdown').on('click', function(event) {
  exportAsMarkdown();
});

$('#export-currentdoc-as-docx').on('click', function(event) {
  exportAsWord();
});

$("export-currentdoc-as-crypteedoc").on('click', function(event) {
  exportAsCrypteedoc(activeDocID);
});

if (window.print) {
  setSentryTag("printing", "yes");
  $('#print-currentdoc').show();
  $('#print-doc-button').show();
} else {
  setSentryTag("printing", "no");
  $('#print-currentdoc').hide();
  $('#print-doc-button').hide();
}

$('#print-currentdoc').on('click', function(event) {
  hideExportDocModal();
  if (window.print) {
    print();
  }
});

function exportAsHTML(did, useSectionTitleForExport) {
  did = did || activeDocID;
  useSectionTitleForExport = useSectionTitleForExport || false;
  
  var sectTitle;
  if (sectionsArray[0]) {
    sectTitle = stringToB64URL(sectionsArray[0].html()) + ".html";
  } else {
    sectTitle = activeDocTitle + ".html";
  }

  if (did === activeDocID) {
    var contents = $(".ql-editor").html();
    var title;
    if (useSectionTitleForExport) {
      title = sectTitle;
    } else {
      title = activeDocTitle + ".html";
    }
    var blob = new Blob([contents], {type: "text/html;charset=utf-8"});
    saveAs(blob, title);
    hideExportDocModal();
  }
}

function exportAsMarkdown() {
  var htmlContents = $(".ql-editor").html();
  var markdown = markdownConverter.makeMarkdown(htmlContents);
  var blob = new Blob([markdown], {type: "text/markdown; charset=UTF-8"});
  var title = activeDocTitle + ".md";
  saveAs(blob, title);
  hideExportDocModal();
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

function exportAsWord() {
  var wordDoc = htmlToDocx($(".ql-editor").contents(), activeDocTitle);
  var title = (activeDocTitle || "Document") + ".docx";

  if (wordDoc) {
    Packer.toBlob(wordDoc).then(function(blob) {
      saveAs(blob, title);
      hideExportDocModal();
    });
  } else {
    handleError("Couldn't find a wordDoc to export");
    showErrorBubble("Error Exporting to Word Document");
    hideExportDocModal();
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
  var erroredOut = false;
  if (activeEmbed === "formula"){
    try {
      quill.insertEmbed(embedRange.index, 'formula', $("#embed-input").val());
    } catch (error) {
      erroredOut = true;
      var errorMessage = error.message.replace("KaTeX parse error: ", "");
      $("#embed-modal-error").html(errorMessage);
      $("#embed-modal-status").removeClass("is-white").addClass("is-danger");
    }
  } else if (activeEmbed === "link") {
    quill.format('link', $("#embed-input").val());
  } else if (activeEmbed === "video") {
    quill.insertEmbed(embedRange.index, 'video', $("#embed-input").val());
  }
  if (!erroredOut) {
    hideEmbed();
  }
}

function hideEmbed() {
  $("#embed-modal-status").addClass("is-white").removeClass("is-danger");
  $("#embed-modal-error").html("");
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

function showAttachmentSelector (filetype) {
  $("#attachment-source-box").show();
  if (filetype === "image") {
    $("#attachment-source-box").find(".title").html("Add Image");
    $("#attach-from-device-label").show();
    $("#embed-how-to").show();
    $("#attach-how-to").hide();
  } else {
    $("#attachment-source-box").find(".title").html("Attach File from Cryptee");
    $("#attach-from-device-label").hide();
    $("#embed-how-to").hide();
    $("#attach-how-to").show();
  }

  $("#attachment-modal").addClass("is-active");
  $(".image-selection-preview").css("background-image", 'none');
  $(".image-selection-preview").hide();
}

function hideAttachmentSelector () {
  $("#attachment-modal").removeClass("is-active");
  $("#attachment-target-box").hide();
  $("#attachment-target-box").removeClass("shown");
  $(".image-selection-preview").css("background-image", 'none');
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
      $(".image-selection-preview").css("background-image", 'url(' + base64FileContents + ')');
      $("#attachment-source-box").fadeOut(500,function(){
        $(".image-selection-preview").fadeIn(500);
        $("#attachment-target-box").show();
        setTimeout(function () {
          $("#attachment-target-box").addClass("shown");
        }, 250);
      });
    };
    reader.onerror = function(err){
      fileUploadError = true;
      handleError("Error reading selected attachment from device", err);
      $(".image-selection-preview").hide();
      $("#attachment-source-box").show();
      showFileUploadStatus("is-danger", "Error. Seems like we're having trouble reading your image. This is most likely a problem we need to fix, and rest assured we will.");
    };
  }
  
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
  try {
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
      handleError("Error reading image in processEmbedImage", err);
      showFileUploadStatus("is-danger", "Error. Seems like we're having trouble reading this file. This is most likely a problem we need to fix, and rest assured we will.");
    };
  } catch (error) {
    fileUploadError = true;
    handleError("Error reading image in processEmbedImage", err);
    showFileUploadStatus("is-danger", "Error. Seems like we're having trouble reading this file. This is most likely a problem we need to fix, and rest assured we will.");
  }
  
}



function processDroppedAttachment (file) {
  try {
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
      handleError("Error reading dropped attachment", err);
      showFileUploadStatus("is-danger", "Error. Seems like we're having trouble reading this file. This is most likely a problem we need to fix, and rest assured we will.");
    };
  } catch (error) {
    fileUploadError = true;
    handleError("Error reading dropped attachment", err);
    showFileUploadStatus("is-danger", "Error. Seems like we're having trouble reading this file. This is most likely a problem we need to fix, and rest assured we will.");
  }

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













$("#doc-dropdown").on('click', '.attach-button', function(event) {
  event.preventDefault();
  var did = rightClickedID();
  catalog.docs[did] = catalog.docs[did] || {};
  var title = catalog.docs[did].name || "Untitled Document";
 
  attachCrypteeFile(title, did);
  
  hideRightClickMenu();
  showFileUploadStatus("is-info", "Attaching " + title + " to document.");
});

$("#doc-dropdown").on('click', '.embed-button', function(event) {
  event.preventDefault();
  var did = rightClickedID();
  catalog.docs[did] = catalog.docs[did] || {};
  var title = catalog.docs[did].name || "Untitled Document";

  downloadAttachment(title, did);
  
  hideRightClickMenu();
  showFileUploadStatus("is-info", "Embedding " + title + " to document.");
});

function downloadAttachment (attachmentTitle, did) {
  getFileMeta(did + ".crypteefile").then(function(metadata){
    var token = metadata.token;
    $.ajax({ url: parsedDocURL(did + ".crypteefile", token), type: 'GET',
      success: function(encryptedFileContents){
        attachmentLoaded(did, encryptedFileContents, attachmentTitle);
      },
      error:function (xhr, ajaxOptions, thrownError){
        console.log(thrownError);
        showDocProgress("One moment please");
        window.location.reload();
      }
    });
  }).catch(function(e){
    // File or doc doesn't exist at all ~ shit. alright let's try to repair things.
    // Chances are we've got a problem.
    showDocProgress("Seems like this file doesn't exist or you don't have permission to open it.<br> We're not sure how this happened.<br> Please try again shortly, or contact our support.<br> We're terribly sorry about this.");
    fixFilesAndFolders(did);
    handleError("Error Downloading Attachment", e);
  }); 
}

function attachmentLoaded (did, encryptedFileContents, attachmentTitle) {
  decrypt(encryptedFileContents, [theKey]).then(function(plaintext) {
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

    var filename = did + ".crypteedoc";
    if (catalog.docs[did]) {
      if (catalog.docs[did].isfile) {
        filename = did + ".crypteefile";
      }
      loadDoc(did, attachmentLoadComplete, did);
    } else {
      theFile.removeClass("loading").addClass("error");
    }

  } else {
    theFile.remove();
  }
});

function attachmentLoadComplete(did) {
  $("crypteefile[did='"+did+"']").removeClass("loading");
}

function checkAttachmentsOfDocument() {
  
  // add attachments to decryption queue. 
  $("crypteefile").each(function(i){
    var attachmentID = $(this).attr("did");
    if (attachmentID) { 
      breadcrumb('[LOAD] – Checking Linked Attachment (' + attachmentID + ")");
      decryptAttachmentTitleIfNecessary(attachmentID);
    }
  });

}

function decryptAttachmentTitleIfNecessary(id) {
  var decrypt = true;
  if (catalog.docs[id]) {
    if (catalog.docs[id].name) {
      if (catalog.docs[id].name !== "" && 
          catalog.docs[id].name !== "Untitled Document" && 
          catalog.docs[id].name !== stringifiedUntitledDocument
          ) {
        decrypt = false; // already exists. no need to decry;t.
      } 
    }
  
    if (decrypt) {
      breadcrumb('[LOAD] – Attachment needs decrypting, adding to queue. (' + id + ")");

      if (catalog.docs[id].encryptedTitle) {
        processEncryptedDocTitle(id, catalog.docs[id].encryptedTitle);
      }

      if (!catalog.docs[id].isfile) {
        var tags = catalog.docs[id].encryptedTags || [];
        processEncryptedDocTags(id, tags);
      }
    } else {
      breadcrumb('[LOAD] – Attachment already decrypted. (' + id + ")");
    }

  } else {
    // Likely ghosted. Skipped.
    breadcrumb('[LOAD] – Attachment was not in catalog. Skipping. (' + id + ")");
  }
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
    var enoteUpdated = enoteJSON['en-export'].note.updated;
    var enoteUpdatedGeneration = enexTimeToGen(enoteUpdated) || null; // this is a js epoch

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
      var attachmentContent;
      if (resObj.data.__text) {
        attachmentContent = resObj.data.__text.replace(/\n/g, "");
      } else {
        attachmentContent = "";
      }
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
    importHTMLDocument(enoteTitle, did, decryptedContents, callback, docsize, callbackParam, rawHTML, enoteUpdatedGeneration);
  }
}

function enexTimeToGen(enoteTime) {
  if (enoteTime) {
    var enoteUpdatedYear = enoteTime.substring(0,4);
    var enoteUpdatedMonth = enoteTime.substring(4,6);
    var enoteUpdatedDay = enoteTime.substring(6,8);
    var enoteUpdatedHour = enoteTime.substring(9,11);
    var enoteUpdatedMinute = enoteTime.substring(11,13);
    var enoteUpdatedSecond = enoteTime.substring(13,15);
    var enoteParsedDate = new Date(enoteUpdatedYear, enoteUpdatedMonth-1, enoteUpdatedDay, enoteUpdatedHour, enoteUpdatedMinute, enoteUpdatedSecond);
    return enoteParsedDate.getTime();
  } else {
    return null;
  }
}

///////////////////////////////////////////////////////////
//////////////////  IMPORT HTML DOCUMENT   ////////////////
///////////////////////////////////////////////////////////

// Importer from HTML using (which can import from Bear & Evrnt or anything else HTML)

function importHTMLDocument (dtitle, did, decryptedContents, callback, docsize, callbackParam, rawHTML, gen) {
  var spacelessDataURI = decryptedContents.replace(/\s/g, ''); // ios doesn't accept spaces and crashes browser. like wtf apple. What. THE. FUCCK!!!
  var erroredDecoding = false;
  try {
    rawHTML = rawHTML || decodeBase64Unicode(spacelessDataURI.split(',')[1]);
  } catch (e) {
    erroredDecoding = true;
    errImporting(e);
  }
  
  if (!erroredDecoding) {
    var fid = fidOfDID(did);

    quill.setText('\n');
    quill.clipboard.dangerouslyPasteHTML(1, rawHTML);
    quill.history.clear();

    var milliseconds = (new Date()).getTime();
    sessionStorage.setItem('session-last-loaded', JSON.stringify(milliseconds));

    $("#homedoc").prop("disabled", false).attr("disabled", false);
    $("#homedoc").removeClass("is-dark");
    $("#doc-contextual-button").fadeIn(100);
    
    //set new did active
    activeDocID = did;
    activeDocTitle = dtitle;

    $(".filesize-button").prop('onclick',null).off('click');

    // always inherited from load doc.

    saveDoc(function (){
      // RENAME DOCUMENT AND REMOVE HTML NOW.
      var newDocName = dtitle.replace(/\.html/g, '');
      var docObj = { "isfile" : false };
      catalog.docs[did] = catalog.docs[did] || {};
      catalog.docs[did].imported = true;

      if (gen) { docObj.generation = gen; } // this is the original date from enex file if it exists
      encryptTitle(activeDocID, JSON.stringify(newDocName), function(encryptedTitle){
        docObj.title = encryptedTitle;
        foldersRef.child(fid + "/docs/" + did).update(docObj, function(){
          //set doc title in taskbar
          $("#active-doc-title").html(newDocName);
          $("#active-doc-title-input").val(newDocName);
          document.title = newDocName;
          $("#active-doc-title-input").attr("placeholder", newDocName);

          updateDocTitleInDOM(activeDocID, newDocName);

          catalog.docs[did].isfile = false;
          if (gen) { catalog.docs[did].gen = gen; } // this is the original date from enex file if it exists
          updateLocalCatalog();

          // now that we've imported the file, and made it a crypteedoc, delete it.
          var fileRef = rootRef.child(did + ".crypteefile");
          fileRef.delete().then(function() {

            dataRef.update({"lastOpenDocID" : did});
            sessionStorage.setItem('session-last-did', JSON.stringify(did)); 
            
            stopLoadingSpinnerOfDoc(did);
            highlightActiveDoc(did);

            callback(callbackParam);
          });
        }).catch(function(error) {
          stopLoadingSpinnerOfDoc(did);
          showErrorBubble("Sorry, can't import file.", error);
          callback(callbackParam);
        });
      });
    });
  } else {
    errImporting({});
  }

  function errImporting(e) {
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
  var erroredDecoding = false;
  var rawHTML;
  try {
    var rawTXT = decodeBase64Unicode(spacelessDataURI.split(',')[1]);
    rawHTML = markdownConverter.makeHtml(rawTXT).split("\n").join("<br>");
  } catch (e) {
    erroredDecoding = true;
    errImporting(e);
  }

  if (!erroredDecoding) {
    var fid = fidOfDID(did);

    quill.setText('\n');
    quill.clipboard.dangerouslyPasteHTML(1, rawHTML);
    quill.history.clear();

    var milliseconds = (new Date()).getTime();
    sessionStorage.setItem('session-last-loaded', JSON.stringify(milliseconds));

    $("#homedoc").prop("disabled", false).attr("disabled", false);
    $("#homedoc").removeClass("is-dark");
    $("#doc-contextual-button").fadeIn(100);

    //set new did active
    activeDocID = did;
    activeDocTitle = dtitle;

    $(".filesize-button").prop('onclick',null).off('click');

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
          updateLocalCatalog();

          // now that we've imported the file, and made it a crypteedoc, delete it.
          var fileRef = rootRef.child(did + ".crypteefile");
          fileRef.delete().then(function() {

            dataRef.update({"lastOpenDocID" : did});
            sessionStorage.setItem('session-last-did', JSON.stringify(did));

            stopLoadingSpinnerOfDoc(did);
            highlightActiveDoc(did);

            callback(callbackParam);
          });
        });
      });
    });

  } else {
    errImporting({});
  }

  function errImporting(e) {
    stopLoadingSpinnerOfDoc(did);
    showErrorBubble("Sorry, can't import file. Are you sure this is an html file?", e);
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
    // this error gets the did from the previous function 
    handleError("Error importing ECD file", error);
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
    e.did = did;
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

  var milliseconds = (new Date()).getTime();
  sessionStorage.setItem('session-last-loaded', JSON.stringify(milliseconds));

  $("#homedoc").prop("disabled", false).attr("disabled", false);
  $("#homedoc").removeClass("is-dark");
  $("#doc-contextual-button").fadeIn(100);
  
  //set new did active
  activeDocID = did;
  activeDocTitle = dtitle;

  $(".filesize-button").prop('onclick',null).off('click');

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
        updateLocalCatalog();

        // now that we've imported the file, and made it a crypteedoc, delete it.
        breadcrumb('ECD Import : Title set, will delete old references');
        var fileRef = rootRef.child(did + ".crypteefile");
        fileRef.delete().then(function() {
          breadcrumb('ECD Import : Old references deleted.');
          dataRef.update({"lastOpenDocID" : did});
          sessionStorage.setItem('session-last-did', JSON.stringify(did));

          stopLoadingSpinnerOfDoc(did);
          highlightActiveDoc(did);
          
          // IN THIS CASE THIS WILL JUST HIDE. NOTHING TO CANCEL ANYWAY YOU'RE ALL GOOD. DON'T WORRY.
          cancelImportingCrypteedoc();
          breadcrumb('ECD Import : Completed.');
        }).catch(function(e){
          if (e.code !== "storage/object-not-found") {
            handleError("Error Importing ECD", e);
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

  if ($(this).attr("id") === "recents-button") {
    userPreferences.docs.opentab = "recents";
    dataRef.update({"preferences" : userPreferences});
  }

  if ($(this).attr("id") === "folders-button") {
    userPreferences.docs.opentab = "folders";
    dataRef.update({"preferences" : userPreferences});
  }

  activeFolderParent = null;
});

function loadLeftViewPos (posToLoad) {
  $(".left-views-scroller").removeClass("pos-0 pos-1 pos-2 pos-3").addClass("pos-"+posToLoad);
  $(".left-view-controller-buttons").find(".left-nav-buttons").removeClass("active");
}

function recentMonthsAgo() {
  var curDate = new Date(); 
  curDate.setMonth(curDate.getMonth() - monthsOfRecentDocsPreference); // this comes from preferences.js and loaded from localStorage
  curDate.setHours(0, 0, 0);
  curDate.setMilliseconds(0);
  var howManyRecentMonthsAgo = curDate.getTime();
  return howManyRecentMonthsAgo;
}

var refreshOnlineDocsTimer;
function refreshOnlineDocs (force) {
  
  force = force || false;
  if (force) { refresh(); }

  clearTimeout(refreshOnlineDocsTimer);
  refreshOnlineDocsTimer = setTimeout(function () {
    refresh();
  }, 500);

  function refresh() {
    breadcrumb('Refreshing Online Docs');
    var allDocsArray = Object.values(catalog.docs);

    // let's get 6 months ago (and exclude anything older than that)
    var howManyRecentMonthsAgo = recentMonthsAgo();

    $("#all-recent").html("");
    $(".folderrecents").html("");
    $("#all-active-folder-contents").find(".doc").remove();

    allDocsArray.sort(gensort);
    allDocsArray.forEach(function(doc){
      if (doc.did !== undefined) {
        // ADD DOC TO RECENTS
        // this uses the same algorithm as the decrypt-decision maker on boot. 
        // with the exception that the on boot, we don't allow more than 100 recents to be loaded.
        // this accounts for that using the doc.name. if the doc doesn't have a name, it won't add to recents or to folder recents;

        if (doc.name && !doc.isfile && !isDIDinArchivedFID(doc.did) && doc.gen / 1000 > howManyRecentMonthsAgo) {
          if (!doesDocExistInDOM(doc.did, "#all-recent")) {
            $("#all-recent").prepend(renderDoc(doc, "recent"));
          }
        }

        // ADD DOC TO ACTIVE FOLDER LIST
        if (!doesDocExistInDOM(doc.did, "#all-active-folder-contents") && doc.fid === activeFolderID) {
          $("#all-active-folder-contents").prepend(renderDoc(doc, "activefolder"));
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
        // this uses the same algorithm as the decrypt-decision maker on boot. 
        // with the exception that the on boot, we don't allow more than 100 recents to be loaded.
        // this accounts for that using the doc.name. if the doc doesn't have a name, it won't add to recents or to folder recents;

        if (doc.name && !doc.isfile && !isDIDinArchivedFID(doc.did) && doc.gen / 1000 > howManyRecentMonthsAgo) {
          renderAndPrependFolderRecentDoc(doc);
        }
      }
    });

    if (activeFolderID !== undefined && activeFolderID !== "root") {
      catalog.folders[activeFolderID] = catalog.folders[activeFolderID] || {};
      var activeFolderSort = catalog.folders[activeFolderID].sortdocs || "azasc";
      if (activeFolderSort) {
        sortContentsOfActiveFolder(activeFolderSort);
      }
    }
  }
  
}





function renderDoc (doc, type, extra) {
  extra = extra || "";

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
    active = " activedoc";
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

  // ~ sorts after z
  var decrypting = "";
  var docTitle = '<p class="doctitle">~ DECRYPTING DOC</p>';
  if (doc.name) {
    docTitle = '<p class="doctitle">'+doc.name+'</p>';
  } else {
    decrypting = " decrypting";
  }

  var selected = "";
  if (isDocSelected(doc.did)) {
    selected = " selected";
  }
  
  var deets = ""; 
  if (type === "recent" || type === "offline") {
    deets = '<p class="deets docdeet">'+ since + ' ago ' + recentFolder + '</p>';
  }

  var searchResult = "";
  if (type === "search") {
    searchResult = " search-result";
  }

  var progress = "";
  if (isFile) {
    progress = '<progress class="progress is-small docprogress" value="" max=""></progress>';
  }

  var context = '<span class="icon docctx"><i class="fa fa-fw fa-ellipsis-v"></i></span>';

  var docElem =
  '<div class="doc ' + active + decrypting + selected + searchResult +'" did="'+ doc.did +'" fid="'+doc.fid+'" gen="'+ gen +'">'+
    '<span class="icon docicon"><i class="' + icon + '"></i>'+ offlineBadge +'</span>'+
    docTitle+
    deets +
    progress +
    context +
    extra +
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

  var docElem = "<p class='folderrecent" + active + "' did='" + did +"'>" + icon + name + "</p>";
  
  var folder = $("#" + fid);
  var frecentsArray = folder.find(".folderrecent");
  // folder can have max 3 recents, and as long as this doc isn't already in the recents, add it.
  if (frecentsArray.length < 3 && folder.find(".folderrecent[did='" + did + "']").length <= 0) {
    folder.find(".folderrecents").append(docElem);
  }
}

function updateRecency() {
  if (firstDocLoadComplete) {
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

function decryptedRenderedDoc(did) {
  $(".doc[did='" + did + "']").removeClass("decrypting");
}





////////////////////////////////////////////////////////
/////////////////// CONNECTION STATUS  /////////////////
////////////////////////////////////////////////////////

var windowVisible;
document.addEventListener('visibilityChange', handleVisibilityChange, false);

$(window).on("focus", function () {
  forceCheckConnection();
  checkLatestVersion();
  windowVisible = true;
});

$(window).on("blur", function () {
  windowVisible = false;
});

function handleVisibilityChange() {
  if (document.hidden) {
    // hidden
    windowVisible = false;
  } else {
    // shown
    forceCheckConnection();
    checkLatestVersion();
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
          } else {
            activateOfflineMode();
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
      if (err) {
        if (err.code === 22) {
          // USER EXCEEDED STORAGE QUOTA. 
          breadcrumb("Exceeded Storage Quota. (" + storageDriver + ")");
          showFlyingModal("offline-storage-full-modal");
        }
        err.did = did;
        handleError("Error setting offline document to storage", err, "warning");
      }
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
            generateSections();
            refreshOfflineDocs(callback, callbackParam);
          }, 150);
        }).catch(function (err) {
          if (err) {
            if (err.code === 22) {
              // USER EXCEEDED STORAGE QUOTA. 
              breadcrumb("Exceeded Storage Quota. (" + storageDriver + ")");
              showFlyingModal("offline-storage-full-modal");
            } else {
              showErrorBubble("Error saving document", err);
            }
          } else {
            showErrorBubble("Error saving document");
          }
          
          err.did = did;
          handleError("Error setting offline document to storage", err, "warning");
        });
      }, 150);

    }).catch(function (err) {
      showErrorBubble("Error encrypting while saving offline document", err);
      err.did = did;
      handleError("Error encrypting while saving offline document", err);
    });

  }).catch(function(err) {
    err.did = did;
    handleError("Error getting offline document from storage", err);
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

      prepareDocContextualButton(doc.did);
      
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

      generateSections();

      if (isMobile) {
        hideDocProgress(hideMenu);
      } else {
        hideDocProgress();
      }

      callback(callbackParam);
    }).catch(function (err) {
      showErrorBubble("Error decrypting while loading offline document", err);
      err.did = did;
      handleError("Error decrypting while loading offline document", err);
    });
  }).catch(function (err) {
    showErrorBubble("Error loading document", err);
    err.did = did;
    handleError("Error getting offline document from storage", err);
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
    err.fid = fid;
    showErrorBubble("Error refreshing offline documents", err);
    handleError("Error iterating offline documents", err);
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
        err.fid = fid;
        showErrorBubble("Error deleting offline document", err);
        handleError("Error iterating offline documents", err);
      });

    });
  }).catch(function(err) {
    err.did = did;
    showErrorBubble("Error removing offline document", err);
    handleError("Error removing offline document from storage", err);
  });
}

function makeOfflineDoc(did) {
  if (did) {  
    breadcrumb("Making " + did + " offline.");
    did = did || noop;
    var plaintextDocDelta;
    catalog.docs[did] = catalog.docs[did] || {};
    var tags = catalog.docs[did].tags || [];
    var fid = fidOfDID(did);
    var dtitle = titleOf(did);
    var fname = titleOf(fid);
      
    getFileMeta(did + ".crypteedoc").then(function(metadata) {
      var onlineGen = metadata.generation;
      $.ajax({ url: parsedDocURL(did + ".crypteedoc", metadata.token), type: 'GET',
          success: function(theStrongKeyEncryptedDelta){
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
                  if (err) {
                    if (err.code === 22) {
                      // USER EXCEEDED STORAGE QUOTA. 
                      breadcrumb("Exceeded Storage Quota. (" + storageDriver + ")");
                      showFlyingModal("offline-storage-full-modal");
                    }
                    err.did = did;
                    handleError("Error setting offline document to storage", err, "warning");
                  }
                });
              }).catch(function(err) {
                err.did = did;
                err.fid = fid;
                showErrorBubble("Error with encryption of "+dtitle+" during download");
                handleError("Error re-ncrypting doc during makeOffline dowload", err);
              });
            }).catch(function(err) {
              err.did = did;
              err.fid = fid;
              showErrorBubble("Error with encryption of "+dtitle+" during download");
              handleError("Error decrypting doc during makeOffline dowload", err);
            });
          },
          error:function (xhr, ajaxOptions, thrownError){
            thrownError.did = did;
            showErrorBubble("Couldn't download "+dtitle+". Please try again.");
            handleError("Error downloading document to make offline", thrownError);
          }
      });
    });
  }
}

function removeOfflineDoc(did) {
  breadcrumb("Making " + did + " online only.");
  offlineStorage.removeItem(did).then(function() {
    refreshOfflineDocs();
    docMadeOnlineOnly(did);
  }).catch(function(err) {
    err.did = did;
    showErrorBubble("Error deleting offline document");
    handleError("Error removing offline document from storage", err);
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

      $('#main-progress').attr("max", "0").attr("value", "100").removeClass('is-success is-warning').addClass('is-info');
      $(".filesize-button > .button").addClass("is-info");
      $("#filesize").html("Offline").css("color", "#fff");

      $(".is-hidden-offline, .left-views-container").addClass("offline");

      if (!activeDocID) {
        // IF IT'S A FRESH BOOT, AND NO DOCUMENT IS OPEN YET,
        // TRY OPENING THE LATEST OFFLINE DOC IF IT EXISTS.
        $("#main-progress, .progressButtons, .filesize-button, .mobile-floating-tools, #doc-contextual-buttons, #toolbar-container").show();

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
          handleError("Error iterating offline documents", err);
        });

      } else {
        // SAVE OPEN DOCUMENT AS OFFLINE.
        saveOfflineDoc();

      }
    });
  }
}

function offlineInitComplete (){
  if (!firstDocLoadComplete) {
    setTimeout(function () {
      arrangeTools();
    }, 1000);
  }
}

function showSyncingProgress(val, max, msg) {
  if (!thereIsALocalEncryptedCatalog) {
    msg = msg || "Syncing Device...";
  } else {
    msg = msg || "Syncing...";
  }

  val = val || 100;
  max = max || 100;

  $('#sync-progress-bar').attr("value", val).attr("max", max);
  $("#sync-progress").addClass("syncing");
  $(".sync-details").html(msg);
}

function hideSyncingProgress() {
  $("#sync-progress").removeClass("syncing done");
  setTimeout(function () {
    $('#sync-progress-bar').attr("value", 0).attr("max", 0);
  }, 1000);
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
    handleError("Error getting length of offline documents from storage", err);
  });
}

function prepareForSync(numberOfOfflineDocs, callback, callbackParam) {
  callback = callback || noop;
  var offlineDocObjectsReadyToSync = {};

  showSyncingProgress(0, numberOfOfflineDocs, "Syncing Offline Docs...");
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
      err.did = did;
      offlineStorage.removeItem(did);
      showErrorBubble("Error decrypting offline doc(s), removed for security.", err);
      handleError("Error decrypting offline doc(s), removed for security.", err);
      syncCompleted(callback, callbackParam);
    });
  }).catch(function(err) {
    showErrorBubble("Error getting offline documents to sync", err);
    handleError("Error iterating offline documents", err);
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
  getFileMeta(did + ".crypteedoc").then(function(metadata) {
    onlineGen = metadata.generation;
    if (onlineGen < offlineGen) {
      // OFFLINE IS NEWER. UPLOAD OFFLINE TO ONLINE
      upSyncOfflineDoc(doc, docRef, callback, callbackParam);
    } else if (onlineGen > offlineGen) {
      // ONLINE IS NEWER. DOWNLOAD ONLINE TO OFFLINE
      downSyncOnlineDoc(doc, metadata, callback, callbackParam);
    } else {
      // THEY'RE THE SAME. SKIP.
      skipSyncingDoc(callback, callbackParam);
    }
  }).catch(function(err) {
    // online doc doesn't exist. upload and create it.
    upSyncOfflineDoc(doc, docRef, callback, callbackParam);
  });
}

function upSyncOfflineDoc (doc, docRef, callback, callbackParam) {
  callback = callback || noop;
  var did = doc.did;
  var fid = doc.fid || "f-uncat";
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
              updateLocalCatalog();
            }

            doneSyncingDoc (callback, callbackParam);
          }).catch(function(err) {
            err.did = did;
            err.fid = fid;
            skipSyncingDoc(callback, callbackParam);
            showErrorBubble("Error setting generation of "+doc.name+" during sync");
            handleError("Error setting generation of doc during offline upsync", err);
          });
        }

      });
  }).catch(function(err) {
    err.did = did;
    err.fid = fid;
    skipSyncingDoc(callback, callbackParam);
    showErrorBubble("Error encrypting "+doc.name+" during sync");
    handleError("Error encrypting doc during offline upsync", err);
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
          updateLocalCatalog();

          doneSyncingDoc (callback, callbackParam);
        }).catch(function(err) {
          err.did = did;
          err.fid = fid;
          skipSyncingDoc(callback, callbackParam);
          showErrorBubble("Error setting generation of "+doc.name+" during sync");
          handleError("Error setting generation of doc during offline upsync", err);
        });
      });
    });
  }

}

function downSyncOnlineDoc (doc, metadata, callback, callbackParam) {
  callback = callback || noop;
  var did = doc.did;
  var onlineGen = metadata.generation;
  var newGenToSet = onlineGen;
  var plaintextDocDelta;

  ///////////////////////////////////////////////////////////////////////////
  // GET THESE FROM CATALOG. THESE SHOULD BE IN MEMORY NOW. //
  ///////////////////////////////////////////////////////////////////////////

  decryptDocTitleIfNecessary(did, function() {
    // since we're not decrypting all docs' titles on boot, 
    // there's a small but non-zero chance that titleOf DID will be unencrypted.
    // this function is there to ensure it's decrypted & set to catalog.
    // so if it's there, this will just continue. 
    // if it's not there, it'll decrypt and set to catalog then continue.    
    // so we can make sure confidently that titleOf will actually have the title.
    // worst case it'll have "Untitled Document" for Downsync. 

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

    $.ajax({ url: parsedDocURL(did + ".crypteedoc", metadata.token), type: 'GET',
      success: function(strongKeyEncryptedDelta){
        decrypt(strongKeyEncryptedDelta, [theKey]).then(function(plaintext) {
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
              if (err) {
                if (err.code === 22) {
                  // USER EXCEEDED STORAGE QUOTA. 
                  breadcrumb("Exceeded Storage Quota. (" + storageDriver + ")");
                  showFlyingModal("offline-storage-full-modal");
                } else {
                  showErrorBubble("Error saving "+dtitle+" during sync");
                }
                err.fid = fid;
                err.did = did;
                handleError("Error saving doc title during offline downsync", err, "warning");
              } else {
                showErrorBubble("Error saving "+dtitle+" during sync");
              }
            });
          }).catch(function(err) {
            err.fid = fid;
            err.did = did;
            skipSyncingDoc(callback, callbackParam);
            showErrorBubble("Error with encryption of "+dtitle+" during sync");
            handleError("Error re-encrypting doc during offline downsync", err);
          });
        }).catch(function(err) {
          err.fid = fid;
          err.did = did;
          skipSyncingDoc(callback, callbackParam);
          showErrorBubble("Error with encryption of "+dtitle+" during sync");
          handleError("Error decrypting doc during offline downsync", err);
        });
      },
      error:function (xhr, ajaxOptions, thrownError){
        skipSyncingDoc(callback, callbackParam);
        thrownError.did = did;
        showErrorBubble("Error getting "+dtitle+" for sync");
        handleError("Error downloading document to make offline", thrownError, 'warning');
      }
    });

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
  }, 5000);
  numberOfDocsToSync = 0;
  numberOfDocsCompletedSync = 0;
  initialSyncComplete = true;
  callback(callbackParam);
  reportOfflineErrors();
}

var syncErrors = [];
function showErrorBubble(message, err) {
  // serialize and deserialize to remove functions from err object, localforage can't save functions in objects.
  if (err) {
    var errorObj = JSON.parse(JSON.stringify(err));
    errorObj.errorTitle = message;
    var now = (new Date()).getTime().toString();
    offlineErrorStorage.setItem(now, errorObj);
  }
  
  message = message || "Error";
  $(".error-bubble-details").html(message + "&nbsp; <span onclick='hideErrorBubble();' class='icon is-small clickable'><i class='fa fa-close fa-fw'></i></span>");
  $("#error-bubble").addClass("errored");
}

function reportOfflineErrors () {
  offlineErrorStorage.iterate(function(syncerr, errtime, i) {
    handleOfflineError(syncerr.errorTitle, syncerr);
  }).then(function() {
    // Reported all offline errors.
    try { offlineErrorStorage.clear(); } catch (e) {}
  }).catch(function(err) {
    handleError("Error iterating or reporting offline errors.", err);
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

$("#doc-dropdown").on('click', '.offlinecheckbox', function(event) {
  var did = rightClickedID();
  catalog.docs[did] = catalog.docs[did] || {};
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

$(".dropdown-makeoffline-button").on('click', function(event) {
  makeOfflineDoc(activeDocID);
  $(".document-contextual-dropdown").removeClass("open");
});

$(".dropdown-makeonline-button").on('click', function(event) {
  removeOfflineDoc(activeDocID);
  $(".document-contextual-dropdown").removeClass("open");
});

$("#doc-dropdown").on('click', '.offline-button', function(event) {
  if (!$(event.target).is(".crypteecheckbox")) {
    $("#doc-dropdown").find(".offlinecheckbox").click();
  }
});

$("#folder-dropdown").on('click', '.offlinecheckbox', function(event) {
  var fid = rightClickedID();
  
  var checked = $("#folder-dropdown").find(".offlinecheckbox").prop("checked");
  
  // timeout to make sure checkbox is selected or unselected.
  setTimeout(function () {
    if (checked) {
      makeOfflineFolder(fid);
    } else {
      makeOnlineFolder(fid);
    }
  
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
  updateLocalCatalog();

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
  updateLocalCatalog();

  breadcrumb("Made " + did + " online only.");
  removeOfflineBadgeOfDoc(did);
  
  if (activeDocID === did) {
    $(".dropdown-makeoffline-button").show();
    $(".dropdown-makeonline-button").hide();
  }
}

function makeOfflineFolder(fid) {
  docsOfFID(fid).forEach(function(did){
    var doc = catalog.docs[did];
    if (!doc.isfile && !doc.isoffline) {
      makeOfflineDoc(did);
    }
  });

  // check subfolders and make them offline too. 
  
  subfoldersOfFID(fid).forEach(function(subFID){
    makeOfflineFolder(subFID);
  });

}

function makeOnlineFolder(fid) {
  docsOfFID(fid).forEach(function(did){
    var doc = catalog.docs[did];
    if (!doc.isfile) {
      removeOfflineDoc(did);
    }
  });

  // check subfolders and make them online too.

  subfoldersOfFID(fid).forEach(function(subFID){
    makeOnlineFolder(subFID);
  });
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

  $(".document-contextual-dropdown").removeClass("open");
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














///////////////////////////////////////////////////////////
////////////////////. WEB CLIPS .//////////////////////////
///////////////////////////////////////////////////////////

var clips = {};
var clippers = {};
var clipperKeys = [];
var webclipsOpen = false;

function showWebClips() {
  if (!viewingMode) {
    webclipsOpen = true;
    $("#docs-sections-wrapper, #doc-counts").fadeOut(300);
    wrappersToMove.addClass("showRight");
    hideMenu();
    $("#docs-webclips-wrapper").addClass("is-active is-loading");
    $(".document-contextual-dropdown").removeClass("open");
    $("#webclips-button").removeClass("shown");
    checkAndSaveDocIfNecessary();
    fetchWebclips();
  }
}

function hideWebClips() {
  if (!viewingMode) {
    webclipsOpen = false;
    $("#docs-sections-wrapper, #doc-counts").fadeIn(300);
    $("#docs-webclips-wrapper").removeClass("is-active");
    if (Object.keys(clips).length > 0) {
      $("#webclips-button").addClass("shown");
    }

    wrappersToMove.removeClass("showRight");
    setTimeout(function () {
      $("#webclips").html("");
    }, 500);
    
    // clearSearch();
  }
}

function gotWebclips(snap) {
  // THESE ARE ONLY POINTERS.
  if (snap) {
    $.each(snap, function(time, wcid){
      if (!clips[wcid]) {
        var clipRef = rootRef.child("wc-" + wcid + ".crypteeclip");
        clips[wcid] = { "time" : time, "ref" : clipRef };
      }
    });

    if (webclipsOpen) {
      // if it's already open
      fetchWebclips();
    } else {
      // if it's not already open, and there's clips,
      if (Object.keys(clips).length > 0) {
        $("#webclips-button").addClass("shown");
      }
    }
  }
}

function fetchWebclips() {
  // GET ALL WEBCLIPS.

  if (clippers && clipperKeys.length > 0) {
    if (Object.keys(clips).length > 0) {
      startDownloadingClips();
    } else {
      console.log("No clips found!");
    }
  } else {
    console.log("No clippers found!");    
  }
}

var loadingClipperKeys = true;
function decryptClipperKeys() {
  dataRef.child("clippers").once('value', function(snapshot) { 
    clippers = snapshot.val();
    loadingClipperKeys = false;
    if (clippers) {
      $.each(clippers, function(clipperid, clipper){
        var encryptedClipperKey = JSON.parse(clipper.key).data;
        decrypt(encryptedClipperKey, [theKey]).then(function(plaintext) {
          clipperKeys.push(plaintext.data);        
        });
      });
    }
  });
}

function startDownloadingClips() {
  if (!loadingClipperKeys) {
    if (clips) {   
      if (clippers) {
        if (clipperKeys) {
          if (clipperKeys.length === Object.keys(clippers).length) {
            // keys loaded startDecryption
            /// GET CLIPS FROM STORAGE, AND USE [clipperKeys] array in decrypt
            $.each(clips, function(wcid, clip){
              if (!clip.data) {
                downloadClip(clip, wcid);
              } else {
                gotWebclip(clip.data, wcid);
              }
            });
            
          } else { 
            // keys not loaded yet, wait until it's loaded & ready to use.
            setTimeout(function () { startDownloadingClips(); }, 1000);
          }
        } else { handleError("No clipper keys found!"); }
      } else { handleError("No clippers found!"); }
    } else { handleError("No clips found!"); }
  } else {
    // keys not loaded yet, wait until it's loaded & ready to use.
    setTimeout(function () { startDownloadingClips(); }, 1000);
  }
}


function downloadClip(clip, wcid) {
  clip.ref.getDownloadURL().then(function(clipURL) {
    $.ajax({ 
      url: clipURL, 
      type: 'GET',
      success: function(encWC) {
        var encryptedWebclip = JSON.parse(encWC).data;
        decrypt(encryptedWebclip, clipperKeys).then(function(plaintext) {
          plaintextWCData = plaintext.data;
          gotWebclip(plaintextWCData, wcid);
        }).catch(function(err) {
          err.wcid = wcid;
          showErrorBubble("Error decrypting a webclip");
          handleError("Error decrypting a webclip", err);
        });
      },
      error:function (xhr, ajaxOptions, err){
        err.wcid = wcid;
        showErrorBubble("Error downloading a webclip");
        handleError("Error downloading a webclip", err);
      }
    });

  }).catch(function(err) {
    err.wcid = wcid;
    showErrorBubble("Error downloading a webclip");
    handleError("Error downloading a webclip", err);
  });

}

function gotWebclip(clipData, wcid) {
  $("#docs-webclips-wrapper").removeClass("is-loading");
  clips[wcid].data = clipData;

  var clip = JSON.parse(clipData);

  if (clip.cliptype === "selection") {
    gotSelectionWC(clip, wcid);
  } else if (clip.cliptype === "link") {
    gotLinkWC(clip, wcid);
  } else if (clip.cliptype === "image") {
    gotImageWC(clip, wcid);
  } else {
    gotPageWC(clip, wcid);
  }
}

function gotSelectionWC (data, wcid) {
  var renderedClip = renderSelectionClip(data, wcid);
  if ($("#wc-"+wcid).length <= 0) {
    $("#webclips").prepend(renderedClip);
    $("#wc-"+wcid).slideDown(500, function(){
      $("#wc-"+wcid).removeClass("adding");
    });
  }
}

function gotLinkWC (data, wcid) {
  var renderedClip = renderLinkClip(data, wcid);
  if ($("#wc-"+wcid).length <= 0) {
    $("#webclips").prepend(renderedClip);
    $("#wc-"+wcid).slideDown(500, function(){
      $("#wc-"+wcid).removeClass("adding");
    });
  }
}

function gotImageWC (data, wcid) {
  var renderedClip = renderImageClip(data, wcid);
  if ($("#wc-"+wcid).length <= 0) {
    $("#webclips").prepend(renderedClip);
    $("#wc-"+wcid).slideDown(500, function(){
      $("#wc-"+wcid).removeClass("adding");
    });
  }
}

function gotPageWC (data, wcid) {
  // console.log(data);
  var renderedClip = renderPageClip(data, wcid);
  if ($("#wc-"+wcid).length <= 0) {
    $("#webclips").prepend(renderedClip);
    $("#wc-"+wcid).slideDown(500, function(){
      $("#wc-"+wcid).removeClass("adding");
    });
  }
}






function renderSelectionClip(data, wcid) {
  var clipContent = data.selectionText;
  var clipURL = data.pageUrl;

  var clipTemplate = 
  '<div class="wclipcard adding" id="wc-' + wcid + '" type="selection">'+
    '<div class="wclip-summary">'+
      '<p class="wc-content">'+
        clipContent +
      '</p>'+
    '</div>'+
    '<div class="wclip-actions">'+
      '<div class="wclip-action wclip-insert-button">'+
        '<span class="icon"><i class="fa fa-fw fa-puzzle-piece"></i></span>'+
        '<span>Insert</span>'+
      '</div>'+
      '<div class="wclip-action wclip-delete-button">'+
        '<span class="icon"><i class="fa fa-fw fa-trash-o"></i></span>'+
      '</div>'+
    '</div>'+
    // '<p class="wclip-url">' + clipURL + '</p>' +
  '</div>';

  return clipTemplate;
}







function renderImageClip(data, wcid) {
  var clipURL = data.location;
  var parsedB64 = JSON.parse(data.b64);
  
  var clipTemplate = 
  '<div class="wclipcard adding" id="wc-' + wcid + '" type="image">'+
    '<img src="'+parsedB64+'">' +
    '<div class="wclip-actions">'+
      '<div class="wclip-action wclip-insert-button">'+
        '<span class="icon"><i class="fa fa-fw fa-puzzle-piece"></i></span>'+
        '<span>Insert</span>'+
      '</div>'+
      '<div class="wclip-action wclip-delete-button">'+
        '<span class="icon"><i class="fa fa-fw fa-trash-o"></i></span>'+
      '</div>'+
    '</div>'+
    // '<p class="wclip-url">' + clipURL + '</p>' +
  '</div>';

  return clipTemplate;
}







function renderLinkClip(data, wcid) {
  var linkURL = data.linkUrl;

  var clipTemplate = 
  '<div class="wclipcard adding" id="wc-' + wcid + '" type="link">'+
    '<div class="wclip-summary">'+
      '<p class="wc-content">'+
        linkURL +
      '</p>'+
    '</div>'+
    '<div class="wclip-actions">'+
      '<div class="wclip-action wclip-insert-button">'+
        '<span class="icon"><i class="fa fa-fw fa-puzzle-piece"></i></span>'+
        '<span>Insert</span>'+
      '</div>'+
      '<div class="wclip-action wclip-delete-button">'+
        '<span class="icon"><i class="fa fa-fw fa-trash-o"></i></span>'+
      '</div>'+
    '</div>' +
  '</div>';

  return clipTemplate;
}





function renderPageClip(data, wcid) {  
  var clipTitle = "";
  if (data.title) {
    clipTitle = '<p class="wclip-title"><b>'+data.title+'</b></p>';
  }

  var clipContent = "";
  var leContent = data.excerpt || data.content || undefined;

  if (leContent) {
    clipContent = '<div class="wclip-content">' + leContent + '</div>';
  }

  var leadImg = '';
  if (data.leadImg) {
    leadImg = '<img src="'+data.leadImg+'">';
  }

  // var clipURL = "";
  // if (data.url) {
  //   clipURL = '<p class="wclip-url">' + data.url + '</p>';
  // }
  
  var clipTemplate = 
  '<div class="wclipcard adding" id="wc-' + wcid + '" type="page">'+
    leadImg +
    '<div class="wclip-summary">'+
      clipTitle +
      clipContent +
    '</div>'+
    '<div class="wclip-actions">'+
      '<div class="wclip-action wclip-insert-button">'+
        '<span class="icon"><i class="fa fa-fw fa-puzzle-piece"></i></span>'+
        '<span>Insert</span>'+
      '</div>'+
      '<div class="wclip-action wclip-delete-button">'+
        '<span class="icon"><i class="fa fa-fw fa-trash-o"></i></span>'+
      '</div>'+
    '</div>'+
    // clipURL +
  '</div>';
  
  return clipTemplate;
}


$("#webclips").on('click', ".wclip-delete-button", function(event) {
  var wcid = $(this).parents(".wclipcard").attr("id");
  var clip = clips[wcid.replace("wc-", "")];
  var time = clip.time; 

  clip.ref.delete().then(function() {
    dataRef.child("clips/" + time).remove().then(function() {
      $("#" + wcid).remove();
      delete clips[wcid.replace("wc-", "")];
      
      if (Object.keys(clips).length <= 0) {
        // this was the last webclip. hide button and close webclips.
        hideWebClips();
        $("#webclips-button").removeClass("shown");
        quill.focus();
      }
    });
  });
  $("#" + wcid).addClass("deleting");
  setTimeout(function () {
    $("#" + wcid).slideUp(500);
  }, 300);
}); 




$("#webclips").on('click', ".wclip-insert-button", function(event) {
  var wcid = $(this).parents(".wclipcard").attr("id").replace("wc-", "");
  var clip = JSON.parse(clips[wcid].data);
  var range = quill.getSelection(true);
  var index = range.index;


  if (clip.cliptype === "link") {
    var linkTag = '<a target="_blank" rel="noopener" href="'+clip.linkUrl+'">'+clip.linkUrl+'</a>';
    quill.clipboard.dangerouslyPasteHTML(index, linkTag);
  } 

  else if (clip.cliptype === "selection") {
    quill.clipboard.dangerouslyPasteHTML(index, clip.selectionText);
  } 

  else if (clip.cliptype === "image") {
    var parsedB64 = JSON.parse(clip.b64);
    var imageTag = "<img src='"+parsedB64+"' class='embedded-image'/>";
    quill.clipboard.dangerouslyPasteHTML(index, imageTag);
  } 
  
  else {
    var leadImg = "";
    if (clip.leadImg) {
      leadImg = '<img src="'+clip.leadImg+'">';
    }

    var clipContent = clip.content;

    var clipHTML = 
    '<h1>'+clip.title+'</h1>'+ 
    leadImg + 
    "<div>"+clipContent+"</div>";

    quill.clipboard.dangerouslyPasteHTML(index, clipHTML);
  } 

}); 





































//
