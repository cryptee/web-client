var theKey, encryptedStrongKey;
var encryptedKeycheck; // a timestamp encrypted with hashedKey to verify the hashedKey in offline mode.
var keyToRemember = JSON.parse(sessionStorage.getItem('key')); // hashedkey
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
var foldersCount;
var foldersOrderCountForCrosscheck;
var initialFolderCountSet = false;
var dataRef;
var metaRef;
var rootRef;
var foldersRef;
var minuteTimer;
var idleTime = 0;
var lastActivityTime = (new Date()).getTime();
var userPlan;

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

var connectedRef = db.ref(".info/connected");
connectedRef.on("value", function(snap) {
  // this limits these triggers to only happen after the key is entered to make sure we won't switch to online mode before they key screen. Sometimes this gets a false negative.
  if (theKey) {
    connectionStatus(snap.val(), false);
  }
});

var allowedStorage, usedStorage;
var decryptingFoldersTimeout;
var activeDocTitle;
var activeDocID;

var activeDocAttachments = [];



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

var sortableFoldersDesktopPreferences = {
  animation: 300, delay:0,
  handle: ".folder-header",
  chosenClass: "draggingFolder",
  scroll : $("#all-folders")[0],
  filter : ".archived",
  onStart: function (evt) {
    $('.afolder').addClass("folderDraggingActive");
	},
  onEnd: function (evt) {
    $('.folderDraggingActive').removeClass("folderDraggingActive");
    updateFolderIndexes();
	}
};

var sortableFoldersMobilePreferences = {
  animation: 300, delay:0,
  handle: ".folder-clicker-icon",
  chosenClass: "draggingFolder",
  scroll : $("#all-folders")[0],
  filter : ".archived",
  onStart: function (evt) {
    $('.afolder').addClass("folderDraggingActive");
	},
  onEnd: function (evt) {
    $('.folderDraggingActive').removeClass("folderDraggingActive");
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

var sortableDocsDesktopPreferences = {
  animation: 300, delay:0,
  group : "docs",
  handle: ".adoc",
  chosenClass: "draggingDoc",
  filter : ".activedoc, .docs-float-context, .docs-contextual-dropdown",
  sort: true,
  onStart: function (evt) {
    docIsBeingSorted = true;
		$(".docs-list").addClass("docDrop");
    $('.afolder').addClass("openForDrop");
	},
	onEnd: function (evt) {
    docIsBeingSorted = false;
		$(".docs-list").removeClass("docDrop");
    $('.afolder').removeClass("openForDrop");
    var fid = $("#" + evt.item.id).parents(".afolder").attr("id");
    updateDocIndexesOfFID(fid);
	},
  onAdd: function (evt) {
    moveDoc(evt.from.id, evt.item.id);
	}
};

var sortableDocsMobilePreferences = {
  animation: 300, delay:0,
  group : "docs",
  handle: ".exticon",
  chosenClass: "draggingDoc",
  filter : ".activedoc, .docs-contextual-dropdown",
  sort: true,
  onStart: function (evt) {
    docIsBeingSorted = true;
    $("#all-folders, body, html, .ql-editor, #docs-page-wrap").addClass("draggingStuff");
		$(".docs-list").addClass("docDrop");
    $('.afolder').addClass("openForDrop");
	},
	onEnd: function (evt) {
    docIsBeingSorted = false;
    $("#all-folders, body, html, .ql-editor, #docs-page-wrap").removeClass("draggingStuff");
		$(".docs-list").removeClass("docDrop");
    $('.afolder').removeClass("openForDrop");
    var fid = $("#" + evt.item.id).parents(".afolder").attr("id");
    updateDocIndexesOfFID(fid);
	},
  onAdd: function (evt) {
    moveDoc(evt.from.id, evt.item.id);
	}
};


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
  var items = e.clipboardData.items;
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
};


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
    context: { format: ['file', 'tag'] },
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
        } else {
          return true;
        }
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
$('html').click(function (event) {
  if ($(event.target).parents('html').length === 0) {
    quill.focus();
  }
  lastActivityTime = (new Date()).getTime();
});

$("#mobile-floating-undo").on("click", function(){
  quill.history.undo();
});

//////// HOTKEYS //////////

key('command+shift+o, ctrl+shift+o', function(){
  quill.blur();
  showMenu();
  $("#search-input").focus();
  checkAndSaveDocIfNecessary();
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

//////// DROPDOWNS //////////

$("#all-folders").on('click', '.dropdown-buttons', function(event) {
  var theDropdown = $(this).parents(".afolder").find(".folder-dropdown");
  var numOfFolders = $(".afolder").length;

  if (!theDropdown.hasClass("dropdown-open")){
    theDropdown.slideDown(300).addClass('dropdown-open');
      if ($(this).parents(".afolder").index() + 1 >= numOfFolders - 6) {
        setTimeout(function () {
          $("#all-folders").animate({ scrollTop: $("#all-folders")[0].scrollHeight }, "slow");
        }, 105);
      }
  } else {
    theDropdown.fadeOut(100).removeClass('dropdown-open');
  }


});

$(document).on('mouseup', function (e) {
    var container = $(".dropdowns");
    var dropdownButtons = $(".dropdown-buttons");
    if ((!container.is(e.target) && container.has(e.target).length === 0) && !dropdownButtons.is(e.target) && dropdownButtons.has(e.target).length === 0) {
      container.fadeOut(100).removeClass('dropdown-open');
      container.find(".sub-dropdown").fadeOut();
    }

    var contextualButtons = $(".document-contextual-button");
    var dcb = $("#doc-contextual-button");
    if (!contextualButtons.is(e.target) && contextualButtons.has(e.target).length === 0 && !dcb.is(e.target) && dcb.has(e.target).length === 0) {
      $(".document-contextual-button").addClass("docContextOff");
      $(".filesize-button, .mobile-floating-tools").removeClass('menuOpen');
    }

    var docsContextDropdown = $(".docs-contextual-dropdown");
    if (!docsContextDropdown.is(e.target) && docsContextDropdown.has(e.target).length === 0) {
      $(".docs-contextual-dropdown").fadeOut(300);
    }
});

function closeDropdownAfterSubButtonPress(buttonPressed) {
  var theDropdown = $(this).parents(".afolder").find(".folder-dropdown");
  theDropdown.fadeOut(100).removeClass('dropdown-open');
}

$("#all-folders").on('click', '.adoc-float-context', function(event) {
  var thisOne = $(this).parents(".adoc").find(".docs-contextual-dropdown");
  $(".docs-contextual-dropdown").not(thisOne).fadeOut(300);
  if (thisOne.is(':visible')) {
    thisOne.fadeOut(300);
  } else {
    thisOne.fadeIn(300);
    var numOfDocs = $(this).parents(".docs-list").children().length;
    if ($(this).parents(".adoc").index() + 1 >= numOfDocs - 4 && $(this).parents(".afolder").is(":last-child")) {
      setTimeout(function () {
        $("#all-folders").animate({ scrollTop: $("#all-folders")[0].scrollHeight }, "slow");
      }, 100);
    }
  }
});




///////  RESIZE & WINDOW MANAGEMENT & TOOLS ARRANGEMENT ///////

// MENU MOTION
var wrappersToMove = $("#docs-page-wrap, #editor-toolbar, #docs-left-top, #docs-left-center, #docs-left-bottom, #mobile-topbar, #docs-left-wrap, #docs-right-wrap");

if (!isMobile) {
  $("#docs-left-wrap").hover(function() {
    wrappersToMove.addClass("showLeft");
  }, function () {
    clearSearch();
    wrappersToMove.removeClass("showLeft");
  });

  $("#docs-right-wrap").hover(function() {
    if (dragCounter === 0) {
      // when nothing's being dragged to be dropped show right.
      // this may change one day so account for file drops.
      clearSearch();

      // wrappersToMove.addClass("showRight");

    }
  }, function () {
    wrappersToMove.removeClass("showRight");
  });
}


var thingsNeedResizing = "#help-button, #toolbar-container, #editor-toolbar, #docs-left-top, #docs-left-center, #docs-left-bottom, #docs-center-wrap, #docs-right-wrap, #mobile-topbar, #doc-contextual-buttons, #doc-contextual-button, #docs-page-wrap, #file-viewer, #all-folders, #main-progress, .filesize-button, .save-doc-button, #doc-top, #hamburger, .docs-float-context, .mobile-floating-tools";
function ww() { return $(window).width(); }

function arrangeTools () {
  // if (!isMobile) {
  if (isMobile) {
    //DESKTOP
    // if (ww() <= desktopCutOffWidthPixel) {
    //   hideMenu();
    // } else if (ww() > desktopCutOffWidthPixel){
    //   $(thingsNeedResizing).removeClass("menuOpen");
    //   $("#doc-top, #docs-page-wrap, #file-viewer").addClass("menuOpen");
    // }
  // } else {
    $("#hamburger").fadeIn(100);
  }
}

// $(window).resize(function(event) {
//   arrangeTools();
// });

$(window).on("load", function(event) {
  if (isMobile) {
    $("#mobile-toolbar, .mobile-floating-tools").removeClass("hidden");
    $(thingsNeedResizing).addClass("itsMobile");
    // $(".menu-hamburger").show();
    $(".save-doc-button").addClass("unavailable");
    $(".dropdown-save-button").show();
  } else {
    $(".filesize-button").addClass("desktop");
    if (isSafari) {
      $(thingsNeedResizing).addClass("itsSafari");
    }
  }

  // 767 to accommodate ipads / other portrait tablets
  if ($(window).width() > 767) {
    loadKeyModalBackground();
  } else {
    $(".modal-img-credit").hide();
  }
});

// Enable navigation prompt
window.onbeforeunload = function() {
  if (docChanged){
    return true;
  }
};

function firstLoadComplete() {
  // HERE WE HAVE TITLES, TAGS AND EVERYTHING BEING LOADED .
  // THIS IS THE LAST THING TO BE EXECUTED AFTER SIGN IN COMPLETE.
  if (!initialLoadComplete) {
    initialLoadComplete = true;

    updateRecentDocs();

    setTimeout(function () { // this is for UX
      $("#doc-contextual-buttons").show();
      if (!isMobile) {
        arrangeTools();
      } else {
        $("#hamburger").fadeIn(100);
        $("#close-menu-button").addClass("shown");
      }
      // YOU CAN NOW START OFFLINE SYNC HERE
      toSyncOrNotToSync();
    }, 1000);
  }
}

function showMenu () {
  // $(thingsNeedResizing).addClass("menuOpen");
  $("#help-button").addClass("shown");
  wrappersToMove.addClass("showLeft");
  $(".document-contextual-dropdown").removeClass("open");
  checkAndSaveDocIfNecessary();
}

function hideMenu () {
  // if (ww() <= desktopCutOffWidthPixel || isMobile) {
    // $(thingsNeedResizing).removeClass("menuOpen");
  // }
  $("#help-button").removeClass("shown");
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
  if ($(".showLeft").length === 1) {
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


function showFoldersProgress(status){
  $(".folders-status").html(status);
  $(".folders-status").addClass("shown");
}

function hideFoldersProgress(){
  $(".folders-status").removeClass("shown");
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

        dataRef.child("foldersCount").on('value', function(snapshot) {
          // dataRef.child("foldersOrder").once('value', function(orderSnap) {
          //   foldersOrderCountForCrosscheck = orderSnap.val().length;

          foldersCount = parseInt(snapshot.val());

          if (parseInt(foldersCount) === 0) {
            $(".first-folder-hint").fadeIn();
            $(".first-doc-hint").fadeIn();
          } else {
            $(".first-folder-hint").fadeOut();
            $(".first-doc-hint").fadeOut();
          }

          // this is to make sure below gets triggered once the folder count changes for the first time.
          // and to count and know when folders ref child_added below has finished adding all folders to Encrypted Catalog on boot
          if (initialFolderCountSet === false) {
            initialFolderCountSet = true;

            // this starts monitoring folders for child_added / removed to add/remove folders and docs to catalog or append them.
            // or starts monitoring meta, order complete etc.
            startUserSockets();
          }
        });

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





function checkForExistingUser (callback){
  callback = callback || noop;

  checkConnection (function(status){
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
      callback();
    }
  });

}





// THIS IS ONLY GOING TO GET CALLED IF THE USER IS ONLINE ON BOOT.
// SO IF "CONNECTED = TRUE"
// OTHERWISE WE WILL NOT CALL THIS ON BOOT.

var signinCompleteTries = 0;
function signInComplete () {

  showDocProgress("Loading Files &amp;<br> Folders");

  // WAIT UNTIL CATALOG IS READY TO START THIS. OTHERWISE KEEP CHECKING.
  // THIS IS A SUPER EDGE CASE SITUATION.
  // GOT CATALOG FOR ~115 ITEMS ON A SLOW ESTONIAN INTERNET IN LESS THAN 1 SEC.
  // THIS IS JUST IN CASE IF USER CAN SOMEHOW AUTO PRESS CHECK KEY, OR IT'S CALLED DUE TO BEING IN MEMORY.

  if (!catalogReadyForDecryption) {
    if (signinCompleteTries === 240) {
      dataRef.child("foldersOrder").once('value', function(orderSnap) {
        foldersOrderCountForCrosscheck = orderSnap.val().length;
        if (foldersOrderCountForCrosscheck !== foldersCount) {
          //  SEEMS LIKE THERE MIGHT BE A FOLDER COUNT PROBLEM.
          handleError(new Error('foldersCount: ' + foldersCount + " but folderOrders have: " + foldersOrderCountForCrosscheck + ' folders in uid: ' + theUserID));
          fixFoldersCount();
        }
      });
    }
    setTimeout(function(){
      signinCompleteTries++;
      signInComplete();
    }, 250);
  } else {
    // catalog ready - start decrypting all titles etc.

    showDocProgress("Decrypting Files &amp;<br> Folders");
    showFoldersProgress("Decrypting Files &amp;<br> Folders");

    decryptEncryptedCatalogItems(function(){
      // catalog decrypted and initialized

      // use "raw" items from ENCCATALOG, to append all docs and folders.
      // use plaintext titles from CATALOG.
      // since we already have them, we don't have to worry about calling server again

      var downloadDID = getUrlParameter("dlddid");
      if (downloadDID) {
        var dldTitle = titleOf(downloadDID) || "Cryptee Download";
        downloadFile(downloadDID, dldTitle, false, function(){
          history.pushState("", null, '/docs');
        });
      }

      loadLastOpenDoc();

    }); // </ decrypt catalog
  }
}





function startUserSockets () {

  if (typeof foldersCount !== 'undefined') {
    if (foldersCount === 0) {
      isCatalogReadyForDecryption();
    }
  }

  foldersRef.on('child_added', function(folder) {
    // add folder to dom & catalog.

    // This will add folders & docs's titles as well
    // In order to ensure isCatalog ReadyForDecryption is accurate.
    // but also handle doc titles (and overwrite these) in
    // folder sockets -> /docs child_added as well
    var folderObj = folder.val();
    if (folderObj.ghosttitles) {
      folderObj.title = null;
    }
    appendFolder(folderObj);

    // this adds all the socket listeners for the folder.
    startFolderSockets(folderObj);

    if (bootCatalogDecrypted) {

      if (folderObj.ghosttitles) {
        // GOT LEGACY GHOST FOLDER!!
        // THIS MEANS THIS GHOST FOLDER WAS CREATED BEFORE THE TITLES UPGRADE WAS MADE.
        // WHICH MEANS WE NEED TO DECRYPT THE GHOST TITLES, THEN E-ENCRYPT AND UPLOAD THEM INTO EACH DOC.

        var encryptedGhostTitlesObject = JSON.parse(folderObj.ghosttitles).data;
        openpgp.decrypt({ message: openpgp.message.readArmored(encryptedGhostTitlesObject), passwords: [theKey], format: 'utf8' }).then(function(plaintext) {
          var ghostTitlesObject = JSON.parse(plaintext.data);
          processLegacyGhostTitles(ghostTitlesObject, folderObj);
        });
      } else {
        decryptEncryptedCatalogItems();
      }
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

        if (allowedStorage > freeUserQuotaInBytes) {
          $("#upgrade-badge").stop( true, true ).fadeOut();
        } else {
          $("#upgrade-badge").stop( true, true ).fadeIn();
        }
      }

      saveUserDetailsToLS(theUsername, usedStorage, allowedStorage);
    }
  });

  dataRef.child("orderComplete").on('value', function(snapshot) {
    orderCompleteBool = snapshot.val();
    if (orderCompleteBool) {
      orderComplete();
      dataRef.update({"orderComplete" : ""});
    }
  });

  dataRef.child("preferences").on('value', function(snapshot) {
    gotPreferences(snapshot.val());
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

}



// all folders and docs are in encrypted catalog now.
// start sockets.

function startFolderSockets (folder) {
  var fid = folder.folderid;
  foldersRef.child(fid + "/docs").on('child_added', function(doc) {
    // add docs to dom & catalog.
    // (fid, did, doc, isfile) + gen etc. in the function
    appendDoc(doc.ref.parent.parent.key, doc.val().docid, doc.val(), doc.val().isfile);
  });

  foldersRef.child(fid + "/docs").on('child_removed', function(doc) {
    // remove doc from dom & catalog.
    deleteDocComplete(doc.ref.parent.parent.key, doc.val().docid);
  });

  foldersRef.child(fid + "/docs").on('child_changed', function(doc) {
    // update encrypted titles, tags and gen in catalog
    // update gen in dom
    updateDocTitleTagsAndGenInCatalog(doc.val());

    if (bootCatalogDecrypted) {
      // also calls decrypt catalog for title and tag changes.
      checkDocGeneration(doc.val());
    }
  });

  foldersRef.child(fid + "/archived").on('value', function(archiveBool) {
    // set folder archived status in dom & catalog
    setArchivedFolder(fid, archiveBool.val());
  });

  foldersRef.child(fid + "/title").on('value', function(encTitle) {

    if (catalog.folders[fid]) {
      catalog.folders[fid].encryptedTitle = encTitle.val();
    }

    if (bootCatalogDecrypted) {
      decryptEncryptedCatalogItems(function(){
        updateRecentDocs();
      });
    }

  });

  foldersRef.child(fid + "/count").on('value', function(docscount) {
    if (catalog.folders[fid]) {
      catalog.folders[fid].count = docscount.val();
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
      var folderDocs = document.getElementById('docs-of-' + fid);
      var sortableDocs;
      if (isMobile) {
        sortableDocs = Sortable.create(folderDocs, sortableDocsMobilePreferences);
      } else {
        sortableDocs = Sortable.create(folderDocs, sortableDocsDesktopPreferences);
      }
      sortDocsOfFID(fid, updateDocIndexesOfFID, fid);
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
  if (!$("#key-modal").hasClass("is-active")){
    showDocProgress("Checking Key");
  }

  var hashedKey, goodKey = true;
  if (key) {
    try {
      hashedKey = hashString(key);
    } catch (e) {
      goodKey = false;
      wrongKey ("Wide Character Error");
    }
  } else {
    hashedKey = keyToRemember;
  }

  if (goodKey) {
    if (connected) {
      // USER ONLINE. CHECK KEY FROM ONLINE, AND UPDATE OFFLINE COPY.

      openpgp.decrypt({ message: openpgp.message.readArmored(encryptedStrongKey), passwords: [hashedKey],  format: 'utf8' }).then(function(plaintext) {
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
        openpgp.decrypt({ message: openpgp.message.readArmored(encryptedKeycheck), passwords: [hashedKey],  format: 'utf8' }).then(function(plaintext) {
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
  } else {
    wrongKey ("Wide Character Error");
  }

}

function rightKey (plaintext, hashedKey) {

  hideKeyModal();
  keyToRemember = hashedKey;

  gotKey = true; // this prevents an early offline mode call from being made before key is typed.

  if (connected) {
    var theStrongKey = plaintext.data;
    theKey = theStrongKey;

    if (!titlesIndividuallyEncrypted) {
      console.log("Legacy Titles Detected. Upgrading.");
      upgradeLegacyTitles();
      // ONCE COMPLETED THIS WILL RESTART USING THE SAME METHOD WE USE IN OFFLINE -> ONLINE MODE SWITCH.
      // IT'LL REMEMBER KEY, AND RELOAD WINDOW. SO VISUALLY WON'T BE NOTICABLE.
    } else {
      signInComplete();
    }

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
  console.log("wrong key or ", error);
  sessionStorage.removeItem('key');
  showKeyModal();
  $('#key-status').html("Wrong key, please try again.");
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

function fixHomeDoc (callback, callbackParam){
  loadJSON ("../js/homedoc.json", function(jsonRes){
    var homeDelta = JSON.parse(jsonRes);
    rootRef = store.ref().child('/users/' + theUserID);
    var homeRef = rootRef.child("home.crypteedoc");
    homeDelta = JSON.stringify(homeDelta);

    openpgp.encrypt({ data: homeDelta, passwords: [theKey], armor: true }).then(function(ciphertext) {
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
          setTimeout(function(){ callback(callbackParam); }, 2000);
        });
    });
  });
}

function fixFilesAndFolders (did) {
  showDocProgress("This is taking too long...<br>One second. Going to ask the chef to see what's going on...");
  fixFolders(did);
}

function fixFolders (did) {
  foldersRef.once('value', function(snapshot) {
    var allFolders = snapshot.val();
    if (allFolders) {
      var allFoldersCount = Object.keys(allFolders).length;
      var foldersCountOnServer;
      dataRef.child("foldersCount").once('value', function(snapshot) {
        foldersCountOnServer = snapshot.val();
        if (foldersCountOnServer !== allFoldersCount) {
          dataRef.update({"foldersCount" : allFoldersCount});
          // folders should be fixed. Or there's not much we can do since the folder completely disappeared anyway
          // TODO FIX FILES, BY CHECKING IF THEY EXIST IN THE FIRST PLACE. USE
          // storageRef.child("file.png").getDownloadURL().then(onResolve, onReject);
          // TO SEE IF THEY EXIST ONE BY ONE IF YOU HAVE TO.
          fixFiles(did);
        } else {
          fixFiles(did);
        }
      });
    } else {
      fixFiles(did);
    }
  });
}

function fixFiles(did) {

  // GO THROUGH EVERY FILE,
  // AND MAKE SURE TITLES DON'T HAVE SOMETHING THAT DOESN'T EXIST IN DATABASE.

  dataRef.update({"lastOpenDocID" : "home"},function(){
    loadDoc("home", firstLoadComplete);
  });

  if (did) {
    if (did === "undefined") {
      // means that somehow a doc got undefined ID in the database.
      // First check if there's an actual undefined.cdoc or undefined.cfile in storage.
      // if there's one, rename both with a new ID, and updateTitles and tags to reflect changes.
      var fidWithUndefinedFile = $("#undefined").parents(".afolder").attr("id");
      handleError(new Error('Undefined Doc/File by uid: ' + theUserID + " in fid: " + fidWithUndefinedFile));
      showErrorBubble("An error occured while trying to open this file. Our team is informed. Sorry.", {});

      $("#" + did).find(".exticon").removeClass("is-loading");
      $(".recent-doc[did='"+did+"']").find(".recenticon").removeClass("is-loading");

      if (isMobile) {
        hideDocProgress(hideMenu);
      } else {
        hideDocProgress();
      }

    } else {
      var fidOfNotFoundDID = fidOfDID(did);
      handleError(new Error('Doc/File with did: ' + did + " in fid: " + fidOfNotFoundDID + ' not found by uid: ' + theUserID));
      // means that this docid(did) got a "storage/object-not-found" so sadly the best we can do is to delete this file now.
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

    foldersRef.child(fid + "/docs/" + did).update({ isfile : false },function(){
      $("#" + did).removeClass("itsAFile");
      $("#" + did).addClass("itsADoc");
      loadDoc(did);
    });

  }).catch(function(error) {
    if (error.code === 'storage/object-not-found') {
      // doc doesn't exist. maybe it's a file.
      fileRef.getMetadata().then(function(metadata) {
        // file exists.
        // likely thought was a doc got object-not-found, but it's a file and it exists
        // set type again and problem should be solved.

        foldersRef.child(fid + "/docs/" + did).update({ isfile : true },function(){
          $("#" + did).addClass("itsAFile");
          $("#" + did).removeClass("itsADoc");
          loadDoc(did);
        });
      }).catch(function(error) {
        if (error.code === 'storage/object-not-found') {
          // file doesn't exist either. uh oh.
          foldersRef.child(fid + "/docs/" + did).remove();
          foldersRef.child(fid + "/count").once('value', function(snapshot) {
            var fcount = snapshot.val();
            foldersRef.child(fid).update({"count" : fcount-1});
          });
        }
      });
    }
  });
}

function fixFoldersCount () {

  foldersRef.once('value', function(snapshot) {
    var allFolders = snapshot.val();
    if (allFolders) {
      var allFoldersCount = Object.keys(allFolders).length;
      var foldersCountOnServer;
      dataRef.child("foldersCount").once('value', function(snapshot) {
        foldersCountOnServer = snapshot.val();
        if (foldersCountOnServer !== allFoldersCount) {
          dataRef.update({"foldersCount" : allFoldersCount});
        }
      });
    }
  });
}

////////////////////////////////////////////////////////
/////////////////// CHECK GENERATION   /////////////////
////////////////////////////////////////////////////////

function checkDocGeneration (changedDoc) {
  var changedGenerationOnServer = changedDoc.generation;
  var changedDocumentID = changedDoc.docid;

  if (changedDocumentID === activeDocID) {
    if (changedGenerationOnServer !== currentGeneration) {
      // we have an outdated doc. show doc is outdated.
      isDocOutdated = true;
      showGenerationWarning();
    }
  }

  // reflect generation changes to dom
  $(".recent-doc[did='"+changedDocumentID+"']").attr("gen", changedGenerationOnServer / 1000);
  catalog.docs[changedDocumentID].gen = changedGenerationOnServer;

  offlineStorage.getItem(changedDocumentID).then(function (offlineDoc) {
    if (offlineDoc && changedDocumentID !== activeDocID) {
      toSyncOrNotToSync();
    }
  }).catch(function(error) {
      console.log("couldn't open offline file", error);
      handleError(error);
  });

  decryptEncryptedCatalogItems(function(){
    updateRecentDocs();
  });
}



function checkHomeGeneration (newHomeGen) {
  if (activeDocID === "home") {
    if (newHomeGen !== currentGeneration) {
      // we have an outdated home. show home is outdated.
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
  isDocOutdated = false;
  if (connectivityMode) {
    saveDoc();
  } else {
    saveOfflineDoc();
  }
  $(".outdated-save-message").fadeOut();
}

function dontSave () {
  docChanged = false;
  $(".outdated-save-message").fadeOut();
}

function loadNewest() {
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

  // add title, filetype, ext to catalog
  catalog.docs[did].name = dtitle;
  catalog.docs[did].ftype = filetypeFromFilename(dtitle);
  catalog.docs[did].icon = iconFromFilename(dtitle);
  delete catalog.docs[did].encryptedTitle;

  // reflect changes to dom (which means doc must be in dom before gotPlaintextDocTitle is called)
  $("#" + did).find(".doctitle").html(dtitle);

  $("#"+did).find(".exticon").find("i").removeClass("fa fa-fw fa-file-text-o").addClass(iconFromFilename(dtitle));

  var extension = dtitle.slice((dtitle.lastIndexOf(".") - 1 >>> 0) + 2);
  var dext = (extension || "crypteedoc");
  $("#" + did).attr("ext", dext);

  if (dext !== "crypteedoc") {
    $("#" + did).find(".context-make-doc-offline").hide();
  } else {
    $("#" + did).find(".context-make-doc-offline").show();
  }

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
      offlineStorage.setItem(did, updatedDoc);
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
  openpgp.encrypt({ data: plaintextTitle, passwords: [theKey], armor: true }).then(function(ciphertext) {
    var encryptedTitle = JSON.stringify(ciphertext);
    callback(encryptedTitle, id);
  });
}

// callback ( plaintextTitle, id )
function decryptTitle (id, encryptedTitle, callback) {
  callback = callback || noop;
  if (encryptedTitle !== ghostingTitle) {
    // not a folder being ghosted
    if (encryptedTitle.indexOf(folderTitleToSummon) > -1) {
      // it's a folder being summoned, reset it's title in db
      callback(summonedTitle, id);
      restoreSummonedTitle(id);
    } else {
      // nothing to do with ghosts, just a title
      var parsedEncryptedTitle = JSON.parse(encryptedTitle).data; //
      openpgp.decrypt({ message: openpgp.message.readArmored(parsedEncryptedTitle), passwords: [theKey], format: 'utf8' }).then(function(plaintext) {
        var plaintextTitle = JSON.parse(plaintext.data);
        callback(plaintextTitle, id);
      });
    }
  } else {
    // it's a folder being ghosted
    ghostingTitle = "";
    callback("Ghosting...", id);
  }
}

// returns fid from catalog;
function fidOfDID (did) {
  return catalog.docs[did].fid || null;
}

// returns title of did or fid intelligently
function titleOf (id) {
  var titleToReturn = null;
  if (id.indexOf('d-') > -1) {
    try { titleToReturn = catalog.docs[id].name; } catch(e) {}
    if (id === "home") { titleToReturn = "Home"; }
  } else {
    try { titleToReturn = catalog.folders[id].name; } catch(e) {}
    if (id === "f-uncat") { titleToReturn = "Inbox"; }
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

function restoreSummonedTitle (id) {
  setTimeout(function () {
    updateFolderTitle (id, JSON.stringify(summonedTitle), function(){
      summonedTitle = "";
      console.log("Folder successfully summoned");
    });
  }, 500);
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
  openpgp.encrypt({ data: plaintextTags, passwords: [theKey], armor: true }).then(function(ciphertext) {
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
      openpgp.decrypt({ message: openpgp.message.readArmored(parsedEncryptedTags), passwords: [theKey], format: 'utf8' }).then(function(plaintext) {
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

var totalDocsCountFromFoldersForBoot = 0;
var appendedDocsCountForBoot = 0;
function updateFolderInCatalog (folder) {
  var fid = folder.folderid;
  var farchived = folder.archived || false;
  var fcolor = folder.color;

  catalog.folders[fid] = catalog.folders[fid] || {};
  catalog.folders[fid].fid            = fid;
  catalog.folders[fid].archived       = farchived;
  catalog.folders[fid].encryptedTitle = folder.title;
  catalog.folders[fid].name           = "";
  catalog.folders[fid].color          = fcolor;
  catalog.folders[fid].count          = folder.count;

  if (folder.docs !== null && folder.docs !== undefined) {
    Object.values(folder.docs).forEach(function(doc) {
      updateDocInCatalog (fid, doc);
      totalDocsCountFromFoldersForBoot++;
    });
  }
  isCatalogReadyForDecryption();
}


function updateDocInCatalog (fid, doc) {
  var did = doc.docid;
  var isFile = doc.isfile || false;

  // either an encrypted string or a blank array, check for this when decrypting tags.
  var tags = doc.tags || [];

  catalog.docs[did] = catalog.docs[did] || {};

  catalog.docs[did].encryptedTitle  = doc.title;
  catalog.docs[did].encryptedTags   = tags;
  catalog.docs[did].name            = doc.name || "";
  catalog.docs[did].tags            = [];
  catalog.docs[did].fid             = fid;
  catalog.docs[did].did             = did;
  catalog.docs[did].gen             = doc.generation || 0;
  catalog.docs[did].fcolor          = catalog.folders[fid].color;
  catalog.docs[did].isfile          = isFile;
  isCatalogReadyForDecryption();
}

function isCatalogReadyForDecryption() {
  if (foldersCount === Object.keys(catalog.folders).length && appendedDocsCountForBoot >= totalDocsCountFromFoldersForBoot) {
    var sortableFolders;
    if (!isMobile) {
      sortableFolders = Sortable.create(document.getElementById('all-folders'), sortableFoldersDesktopPreferences);
    } else {
      sortableFolders = Sortable.create(document.getElementById('all-folders'), sortableFoldersMobilePreferences);
    }

    // This gets called in archive Folder once we get /archived on value in append Folder for the last folder using a timeout
    // sortFolders();
    if (catalogReadyForDecryption === false) {
      console.log("Catalog and DOM ready.");
    }
    catalogReadyForDecryption = true;
  }
}


function updateDocTitleTagsAndGenInCatalog(doc) {
  var did = doc.docid;
  catalog.docs[did].encryptedTitle = doc.title;
  catalog.docs[did].encryptedTags = doc.tags || [];
  catalog.docs[did].gen = doc.generation || 0;
}



function decryptEncryptedCatalogItems (callback) {
  callback = callback || noop;
  var startedDecryptingCatalog = (new Date()).getTime();
  var numberOfItemsToDecrypt = 0;
  var numberOfItemsDecrypted = 0;

  Object.keys(catalog.folders).forEach(function(fid) {
    if (catalog.folders[fid].encryptedTitle) {
      numberOfItemsToDecrypt++;
      decryptTitle(fid, catalog.folders[fid].encryptedTitle, function(plaintextTitle, forfid) {
        gotPlaintextFolderTitle(forfid, plaintextTitle, function(){
          numberOfItemsDecrypted++;
          isCatalogDecrypted();
        });
      });
    }
  });

  Object.keys(catalog.docs).forEach(function(did) {
    if (catalog.docs[did].encryptedTitle) {
      numberOfItemsToDecrypt++;
      decryptTitle(did, catalog.docs[did].encryptedTitle, function(plaintextTitle, fordid) {
        gotPlaintextDocTitle(fordid, plaintextTitle, function(){
          numberOfItemsDecrypted++;
          isCatalogDecrypted();
        });
      });
    }
    if (catalog.docs[did].encryptedTags) {
      numberOfItemsToDecrypt++;
      decryptTags(did, catalog.docs[did].encryptedTags, function(plaintextTags, fordid) {
        catalog.docs[did].tags = plaintextTags;
        numberOfItemsDecrypted++;
        isCatalogDecrypted();
      });
    }
  });

  if (numberOfItemsToDecrypt === 0) {
    isCatalogDecrypted();
  }

  function isCatalogDecrypted() {
    if (numberOfItemsDecrypted === numberOfItemsToDecrypt){
      var finishedDecryptingCatalog = (new Date()).getTime();
      bootCatalogDecrypted = true;
      callback();
    }
  }
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
  // IT COULD BE BECAUSE THE STATUS OF AN OPEN FOLDER IS BEING SAVED AFTER ITS DELETION. THEY DON'T SEEM TO COUNT TOWARDS THE FOLDERSCOUNT EITHER.
  // CHANCES ARE CLIENT WRITES OPEN/CLOSE STATUS AFTER CLOSURE. OR THERE'S A FOOT RACE. COULD BE FIXED AFTER ADDING DROPDOWNS INSTEAD OF DELETE BUTTONS (WHICH FALSELY TRIGGERED OPEN / CLOSE OCCASIONALLY)

  var fid = folder.folderid;
  var fcount = folder.count;
  var fopen = folder.open;
  var fcolor = folder.color;
  var farchived = folder.archived || false;

  var openClass = "-open";
  var colorClass = " ";
  var hiddenClass = "hidden";

  var uploadButton = '';
  if (isAPIAvailable()) {
    uploadButton =
    '<input class="folder-upload-input" type="file" id="upload-to-'+fid+'" name="files[]" multiple />' +
    '<label class="upload-to-folder-button clickable" for="upload-to-'+fid+'"><span class="icon"><i class="fa fa-cloud-upload"></i></span> Upload a File to Folder</label>';
  }

  if (fopen) { openClass = "-open"; hiddenClass = "";} else { openClass = ""; hiddenClass = "display:none;";}
  if (fcolor) { colorClass = fcolor; }

  var makeGhostButton = '<p class="make-ghost-folder-button clickable"><span class="icon"><i class="fa fa-eye-slash"></i></span> Make Ghost Folder</p>';
  var renameButton = '<p class="rename-folder-button clickable"><span class="icon"><i class="fa fa-i-cursor"></i></span> Rename Folder</p>';
  var archiveButton = '<p class="archive-folder-button clickable" onclick="archiveFolder(\''+fid+'\')"><span class="icon"><i class="fa fa-archive"></i></span> Archive Folder</p>';
  if (fid === "f-uncat") {
    makeGhostButton = '';
    renameButton = '';
    archiveButton = '';
  }

  var archived = "";
  if (farchived) {
    archived = "archived";
  }

  var folderCard =  '<div class="afolder card folder '+archived+'" id="'+fid+'" color=" '+colorClass+'" count="'+fcount+'" style="display:none;">'+
                      '<header class="card-header folder-header '+archived+'">'+
                        '<a class="card-header-icon card-folder-icon folder-clicker-icon"><span class="icon"><i style="color:'+colorClass+';" class="folder-icon fa fa-folder'+openClass+'"></i></span></a>'+
                        '<p class="card-header-title folder-title">Untitled Folder</p>'+
                        '<a title="Folder Actions" class="card-header-icon dropdown-buttons"><span class="icon"><i class="fa fa-ellipsis-v"></i></span></a>'+
                      '</header>'+
                      '<div class="notification dropdowns folder-dropdown">'+
                        uploadButton +
                        renameButton +
                        "<p class='notification invalid-foldername is-danger'>Folder name contains an invalid symbol or character. Please rename the folder and try again.</p>" +
                        '<p class="clickable color-folder-thing">'+
                          '<span class="icon"><i class="fa fa-paint-brush"></i></span>'+
                          '<span class="icon folder-color-select-button" color="#FFC0CB" ><i style="color:#FFC0CB;" class="fa fa-tint"></i></span>'+
                          '<span class="icon folder-color-select-button" color="#FF69B4" ><i style="color:#FF69B4;" class="fa fa-tint"></i></span>'+
                          '<span class="icon folder-color-select-button" color="#d9534f" ><i style="color:#d9534f;" class="fa fa-tint"></i></span>'+
                          '<span class="icon folder-color-select-button" color="#FF8C00" ><i style="color:#FF8C00;" class="fa fa-tint"></i></span>'+
                          '<span class="icon folder-color-select-button" color="#ffdd57" ><i style="color:#ffdd57;" class="fa fa-tint"></i></span>'+
                          '<span class="icon folder-color-select-button" color="#4bbf73" ><i style="color:#4bbf73;" class="fa fa-tint"></i></span>'+
                          '<span class="icon folder-color-select-button" color="#AAF0D1" ><i style="color:#AAF0D1;" class="fa fa-tint"></i></span>'+
                          '<span class="icon folder-color-select-button" color="#1f9bcf" ><i style="color:#1f9bcf;" class="fa fa-tint"></i></span>'+
                          '<span class="icon folder-color-select-button" color="#8A2BE2" ><i style="color:#8A2BE2;" class="fa fa-tint"></i></span>'+
                          '<span class="icon folder-color-select-button" color="#363636" ><i style="color:#363636;" class="fa fa-tint"></i></span>'+
                        '</p>'+
                        makeGhostButton +
                        archiveButton +
                        '<p class="delete-folder-button clickable"><span class="icon"><i class="fa fa-trash-o"></i></span> Delete Folder</p>'+
                        '<span class="delete-folder-buttons sub-dropdown"><p>Are you sure? Everything in this folder will be deleted as well.</p><br><a class="button is-success delete-folder-confirm">Yes Delete</a> <a class="button is-danger delete-folder-cancel">No Wait</a></span>'+
                      '</div>'+
                      '<div class="card-content folderClosable" style="'+hiddenClass+'">'+
                        '<aside class="menu">'+
                          '<ul class="menu-list">'+
                            '<li class="newDocInput"><div class="field has-addons"><p class="control new-document-icon"><label><span class="icon"><i class="fa fa-plus"></i></span></label></p><p class="control new-doc-input-control"><input class="new-doc-input input" type="text" placeholder="Create New Document"></p><p title="Upload File" class="control folder-upload-icon"><label class="upload-to-folder-button" for="upload-to-'+fid+'"><span class="icon clickable"><i class="fa fa-cloud-upload"></i></span></label></p></div></li>'+
                          '</ul>'+
                          '<ul class="menu-list docs-list" id="docs-of-'+fid+'">'+

                          '</ul>'+
                        '</aside>'+
                      '</div>'+
                    '</div>';

  if (!$( "#" + fid ).length) {
    // folder doesn't exist in dom, so add.
    $("#all-folders").prepend(folderCard);

    if (isAPIAvailable()) {
      document.getElementById(fid).addEventListener('drop', handleFileDrop, false);
      // if (fid !== "f-uncat") {
      document.getElementById('upload-to-'+fid).addEventListener('change', handleFileSelect, false);
      // }
    }

    $( "#" + fid ).slideDown();
  }

  updateFolderInCatalog(folder);
}







function filetypeFromFilename (filename) {
  var extension = filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
  var filetype;

  if (extension.match(/^(006|007|3DMF|3DX|8PBS|ABM|ABR|ADI|AEX|AI|AIS|ALBM|AMU|ARD|ART|ARW|ASAT|B16|BIL|BLEND|BLKRT|BLZ|BMC|BMC|BMP|BOB|BR4|BR5|C4|CADRG|CATPART|CCX|CDR|CDT|CDX|CGM|CHT|CM2|CMX|CMZ|COMICDOC|CPL|CPS|CPT|CR2|CSF|CV5|CVG|CVI|CVI|CVX|DAE|DCIM|DCM|DCR|DCS|DDS|DESIGN|DIB|DJV|DJVU|DNG|DRG|DRW|DRWDOT|DT2|DVL|DWB|DWF|DXB|EASM|EC3|EDP|EDRW|EDW|EMF|EPRT|EPS|EPSF|EPSI|EXR|FAC|FACE|FBM|FBX|FC2|FCZ|FD2|FH11|FHD|FIT|FLIC|FLM|FM|FPF|FS|FXG|GIF|GRAFFLE|GTX|HD2|HDZ|HPD|HPI|HR2|HTZ4|ICL|ICS|IDW|IEF|IGES|IGR|ILBM|ILM|IMA|IME|IMI|IMS|INDD|INDT|IPJ|IRF|ITC2|ITHMB|J2K|JIFF|JNG|JPEG|JPF|JPG|JPG2|JPS|JPW|JT|JWL|JXR|KDC|KODAK|KPG|LDA|LDM|LET|LT2|LTZ|LVA|LVF|LXF|MAC|MACP|MCS|MCZ|MDI|MGS|MGX|MIC|MIP|MNG|MPF|MPO|MTZ|MUR|MUR|NAV|NCR|NEU|NFF|NJB|NTC|NTH|ODI|ODIF|OLA|OPD|ORA|OTA|OTB|OTC|OTG|OTI|OVW|P21|P2Z|PAT|PC6|PC7|PCD|PCT|PCX|PDN|PEF|PI2|PIC|PIC|PICNC|PICTCLIPPING|PL0|PL2|PLN|PMB|PNG|POL|PP2|PPSX|PRW|PS|PS|PSB|PSD|PSF|PSG|PSP|PSPIMAGE|PSQ|PVL|PWD|PWS|PX|PXR|PZ2|PZ3|QTIF|QTZ|QXD|RIC|RLC|RLE|RW2|SDK|SDR|SEC|SFW|SIG|SKP|SLDASM|SLDDRW|SLDPRT|SNX|SRF|SST|SUN|SVG|SVGZ|TARGA|TCW|TCX|TEX|TGA|TIF|TIFF|TJP|TN|TPF|TPX|TRIF|TRX|U3D|UPX|URT|UTX|V00|V3D|VFS|VGA|VHD|VIS|VRL|VTX|WB1|WBC|WBD|WBZ|WEBP|WGS|WI|WMF|WNK|XDW|XIP|XSI|X_B|X_T|ZDL|ZIF|ZNO|ZPRF|ZT)$/i)) {
    filetype = "image photo foto";
  }
  if (extension.match(/^(pdf)$/i)) {
    filetype = "pdf adobe document";
  }
  if (extension.match(/^(ecd)$/i)) {
    filetype = "encrypted cryptee document";
  }
  if (extension.match(/^(c|cake|clojure|coffee|jsx|cpp|cs|css|less|scss|csx|gfm|git-config|go|gotemplate|java|java-properties|js|jquery|regexp|json|litcoffee|makefile|nant-build|objc|objcpp|perl|perl6|plist|python|ruby|rails|rjs|sass|shell|sql|mustache|strings|toml|yaml|git-commit|git-rebase|html|erb|gohtml|jsp|php|py|junit-test-report|shell-session|xml|xsl)$/i)) {
    filetype = "code script program";
  }
  if (extension.match(/^(7z|bz2|tar|gz|rar|zip|zipx|dmg|pkg|tgz|wim)$/i)) {
    filetype = "archive compress";
  }
  if (extension.match(/^(doc|dot|wbk|docx|docm|dotx|dotm|docb|apxl|pages)$/i)) {
    filetype = "office word microsoft document";
  }
  if (extension.match(/^(xls|xlt|xlm|xlsx|xlsm|xltx|xltm|xlsb|xla|xlam|xll|xlw|numbers)$/i)) {
    filetype = "office excel microsoft document";
  }
  if (extension.match(/^(ppt|pot|pps|pptx|pptm|potx|potm|ppam|ppsx|ppsm|sldx|sldm|key|keynote)$/i)) {
    filetype = "office powerpoint microsoft document";
  }
  if (extension.match(/^(3GA|AA|AA3|AAC|AAX|ABC|AC3|ACD|ACD|ACM|ACT|ADG|ADTS|AFC|AHX|AIF|AIFC|AIFF|AL|AMR|AMZ|AOB|APC|APE|APF|ATRAC|AU|AVR|AWB|AWB|BAP|BMW|CAF|CDA|CFA|CIDB|COPY|CPR|CWP|DAC|DCF|DCM|DCT|DFC|DIG|DSM|DSS|DTS|DTSHD|DVF|EFA|EFE|EFK|EFV|EMD|EMX|ENC|F64|FL|FLAC|FLP|FST|GNT|GPX|GSM|GSM|HMA|HTW|IFF|IKLAX|IMW|IMY|ITS|IVC|K26|KAR|KFN|KOE|KOZ|KOZ|KPL|KTP|LQT|M3U|M3U8|M4A|M4B|M4P|M4R|MA1|MID|MIDI|MINIUSF|MIO|MKA|MMF|MON|MP2|MP3|MPA|MPC|MPU|MP_|MSV|MT2|MTE|MTP|MUP|MXP4|MZP|NCOR|NKI|NRT|NSA|NTN|NWC|ODM|OGA|OGG|OMA|OMG|OMX|OTS|OVE|PCAST|PEK|PLA|PLS|PNA|PROG|PVC|QCP|R1M|RA|RAM|RAW|RAX|REX|RFL|RIF|RMJ|RNS|RSD|RSO|RTI|RX2|SA1|SBR|SD2|SFA|SGT|SID|SMF|SND|SNG|SNS|SPRG|SSEQ|SSND|SWA|SYH|SZ|TAP|TRM|UL|USF|USFLIB|USM|VAG|VMO|VOI|VOX|VPM|VRF|VYF|W01|W64|WAV|WMA|WPROJ|WRK|WUS|WUT|WWU|XFS|ZGR|ZVR)$/i)) {
    filetype = "sound audio song track vibe music voice record play tune phono phone capture";
  }
  if (extension.match(/^(264|3G2|3GP|3MM|3P2|60D|AAF|AEC|AEP|AEPX|AJP|AM4|AMV|ARF|ARV|ASD|ASF|ASX|AVB|AVD|AVI|AVP|AVS|AVS|AX|AXM|BDMV|BIK|BIX|BOX|BPJ|BUP|CAMREC|CINE|CPI|CVC|D2V|D3V|DAV|DCE|DDAT|DIVX|DKD|DLX|DMB|DM_84|DPG|DREAM|DSM|DV|DV2|DVM|DVR|DVR|DVX|DXR|EDL|ENC|EVO|F4V|FBR|FBZ|FCP|FCPROJECT|FLC|FLI|FLV|GTS|GVI|GVP|H3R|HDMOV|IFO|IMOVIEPROJ|IMOVIEPROJECT|IRCP|IRF|IRF|IVR|IVS|IZZ|IZZY|M1PG|M21|M21|M2P|M2T|M2TS|M2V|M4E|M4U|M4V|MBF|MBT|MBV|MJ2|MJP|MK3D|MKV|MNV|MOCHA|MOD|MOFF|MOI|MOV|MP21|MP21|MP4|MP4V|MPEG|MPG|MPG2|MQV|MSDVD|MSWMM|MTS|MTV|MVB|MVP|MXF|MZT|NSV|OGV|OGX|PDS|PGI|PIV|PLB|PMF|PNS|PPJ|PRPROJ|PRTL|PSH|PVR|PXV|QT|QTL|R3D|RATDVD|RM|RMS|RMVB|ROQ|RPF|RPL|RUM|RV|SDV|SFVIDCAP|SLC|SMK|SPL|SQZ|SUB|SVI|SWF|TDA3MT|THM|TIVO|TOD|TP0|TRP|TS|UDP|USM|VCR|VEG|VFT|VGZ|VIEWLET|VLAB|VMB|VOB|VP6|VP7|VRO|VSP|VVF|WD1|WEBM|WLMP|WMMP|WMV|WP3|WTV|XFL|XVID|ZM1|ZM2|ZM3|ZMV)$/i)) {
    filetype = "video film record play capture";
  }

  return filetype;
}

function extensionFromFilename (filename) {
  return filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
}

function iconFromFilename (filename) {
  var icon;
  var extension = filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);

  if (extension.match(/^(006|007|3DMF|3DX|8PBS|ABM|ABR|ADI|AEX|AI|AIS|ALBM|AMU|ARD|ART|ARW|ASAT|B16|BIL|BLEND|BLKRT|BLZ|BMC|BMC|BMP|BOB|BR4|BR5|C4|CADRG|CATPART|CCX|CDR|CDT|CDX|CGM|CHT|CM2|CMX|CMZ|COMICDOC|CPL|CPS|CPT|CR2|CSF|CV5|CVG|CVI|CVI|CVX|DAE|DCIM|DCM|DCR|DCS|DDS|DESIGN|DIB|DJV|DJVU|DNG|DRG|DRW|DRWDOT|DT2|DVL|DWB|DWF|DXB|EASM|EC3|EDP|EDRW|EDW|EMF|EPRT|EPS|EPSF|EPSI|EXR|FAC|FACE|FBM|FBX|FC2|FCZ|FD2|FH11|FHD|FIT|FLIC|FLM|FM|FPF|FS|FXG|GIF|GRAFFLE|GTX|HD2|HDZ|HPD|HPI|HR2|HTZ4|ICL|ICS|IDW|IEF|IGES|IGR|ILBM|ILM|IMA|IME|IMI|IMS|INDD|INDT|IPJ|IRF|ITC2|ITHMB|J2K|JIFF|JNG|JPEG|JPF|JPG|JPG2|JPS|JPW|JT|JWL|JXR|KDC|KODAK|KPG|LDA|LDM|LET|LT2|LTZ|LVA|LVF|LXF|MAC|MACP|MCS|MCZ|MDI|MGS|MGX|MIC|MIP|MNG|MPF|MPO|MTZ|MUR|MUR|NAV|NCR|NEU|NFF|NJB|NTC|NTH|ODI|ODIF|OLA|OPD|ORA|OTA|OTB|OTC|OTG|OTI|OVW|P21|P2Z|PAT|PC6|PC7|PCD|PCT|PCX|PDN|PEF|PI2|PIC|PIC|PICNC|PICTCLIPPING|PL0|PL2|PLN|PMB|PNG|POL|PP2|PPSX|PRW|PS|PS|PSB|PSD|PSF|PSG|PSP|PSPIMAGE|PSQ|PVL|PWD|PWS|PX|PXR|PZ2|PZ3|QTIF|QTZ|QXD|RIC|RLC|RLE|RW2|SDK|SDR|SEC|SFW|SIG|SKP|SLDASM|SLDDRW|SLDPRT|SNX|SRF|SST|SUN|SVG|SVGZ|TARGA|TCW|TCX|TEX|TGA|TIF|TIFF|TJP|TN|TPF|TPX|TRIF|TRX|U3D|UPX|URT|UTX|V00|V3D|VFS|VGA|VHD|VIS|VRL|VTX|WB1|WBC|WBD|WBZ|WEBP|WGS|WI|WMF|WNK|XDW|XIP|XSI|X_B|X_T|ZDL|ZIF|ZNO|ZPRF|ZT)$/i)) {
    icon = "fa fa-fw fa-file-image-o";
  }
  else if (extension.match(/^(pdf)$/i)) {
    icon = "fa fa-fw fa-file-pdf-o";
  }
  else if (extension.match(/^(c|cake|clojure|coffee|jsx|cpp|cs|css|less|scss|csx|gfm|git-config|go|gotemplate|java|java-properties|js|jquery|regexp|json|litcoffee|makefile|nant-build|objc|objcpp|perl|perl6|plist|python|ruby|rails|rjs|sass|shell|sh|sql|mustache|strings|toml|yaml|git-commit|git-rebase|html|erb|gohtml|jsp|php|py|junit-test-report|shell-session|xml|xsl)$/i)) {
    icon = "fa fa-fw fa-file-code-o";
  }
  else if (extension.match(/^(7z|bz2|tar|gz|rar|zip|zipx|dmg|pkg|tgz|wim)$/i)) {
    icon = "fa fa-fw fa-file-archive-o";
  }
  else if (extension.match(/^(doc|dot|wbk|docx|docm|dotx|dotm|docb|apxl|pages)$/i)) {
    icon = "fa fa-fw fa-file-word-o";
  }
  else if (extension.match(/^(xls|xlt|xlm|xlsx|xlsm|xltx|xltm|xlsb|xla|xlam|xll|xlw|numbers)$/i)) {
    icon = "fa fa-fw fa-file-excel-o";
  }
  else if (extension.match(/^(ppt|pot|pps|pptx|pptm|potx|potm|ppam|ppsx|ppsm|sldx|sldm|key|keynote)$/i)) {
    icon = "fa fa-fw fa-file-powerpoint-o";
  }
  else if (extension.match(/^(3GA|AA|AA3|AAC|AAX|ABC|AC3|ACD|ACD|ACM|ACT|ADG|ADTS|AFC|AHX|AIF|AIFC|AIFF|AL|AMR|AMZ|AOB|APC|APE|APF|ATRAC|AU|AVR|AWB|AWB|BAP|BMW|CAF|CDA|CFA|CIDB|COPY|CPR|CWP|DAC|DCF|DCM|DCT|DFC|DIG|DSM|DSS|DTS|DTSHD|DVF|EFA|EFE|EFK|EFV|EMD|EMX|ENC|F64|FL|FLAC|FLP|FST|GNT|GPX|GSM|GSM|HMA|HTW|IFF|IKLAX|IMW|IMY|ITS|IVC|K26|KAR|KFN|KOE|KOZ|KOZ|KPL|KTP|LQT|M3U|M3U8|M4A|M4B|M4P|M4R|MA1|MID|MIDI|MINIUSF|MIO|MKA|MMF|MON|MP2|MP3|MPA|MPC|MPU|MP_|MSV|MT2|MTE|MTP|MUP|MXP4|MZP|NCOR|NKI|NRT|NSA|NTN|NWC|ODM|OGA|OGG|OMA|OMG|OMX|OTS|OVE|PCAST|PEK|PLA|PLS|PNA|PROG|PVC|QCP|R1M|RA|RAM|RAW|RAX|REX|RFL|RIF|RMJ|RNS|RSD|RSO|RTI|RX2|SA1|SBR|SD2|SFA|SGT|SID|SMF|SND|SNG|SNS|SPRG|SSEQ|SSND|SWA|SYH|SZ|TAP|TRM|UL|USF|USFLIB|USM|VAG|VMO|VOI|VOX|VPM|VRF|VYF|W01|W64|WAV|WMA|WPROJ|WRK|WUS|WUT|WWU|XFS|ZGR|ZVR)$/i)) {
    icon = "fa fa-fw fa-file-audio-o";
  }
  else if (extension.match(/^(264|3G2|3GP|3MM|3P2|60D|AAF|AEC|AEP|AEPX|AJP|AM4|AMV|ARF|ARV|ASD|ASF|ASX|AVB|AVD|AVI|AVP|AVS|AVS|AX|AXM|BDMV|BIK|BIX|BOX|BPJ|BUP|CAMREC|CINE|CPI|CVC|D2V|D3V|DAV|DCE|DDAT|DIVX|DKD|DLX|DMB|DM_84|DPG|DREAM|DSM|DV|DV2|DVM|DVR|DVR|DVX|DXR|EDL|ENC|EVO|F4V|FBR|FBZ|FCP|FCPROJECT|FLC|FLI|FLV|GTS|GVI|GVP|H3R|HDMOV|IFO|IMOVIEPROJ|IMOVIEPROJECT|IRCP|IRF|IRF|IVR|IVS|IZZ|IZZY|M1PG|M21|M21|M2P|M2T|M2TS|M2V|M4E|M4U|M4V|MBF|MBT|MBV|MJ2|MJP|MK3D|MKV|MNV|MOCHA|MOD|MOFF|MOI|MOV|MP21|MP21|MP4|MP4V|MPEG|MPG|MPG2|MQV|MSDVD|MSWMM|MTS|MTV|MVB|MVP|MXF|MZT|NSV|OGV|OGX|PDS|PGI|PIV|PLB|PMF|PNS|PPJ|PRPROJ|PRTL|PSH|PVR|PXV|QT|QTL|R3D|RATDVD|RM|RMS|RMVB|ROQ|RPF|RPL|RUM|RV|SDV|SFVIDCAP|SLC|SMK|SPL|SQZ|SUB|SVI|SWF|TDA3MT|THM|TIVO|TOD|TP0|TRP|TS|UDP|USM|VCR|VEG|VFT|VGZ|VIEWLET|VLAB|VMB|VOB|VP6|VP7|VRO|VSP|VVF|WD1|WEBM|WLMP|WMMP|WMV|WP3|WTV|XFL|XVID|ZM1|ZM2|ZM3|ZMV)$/i)) {
    icon = "fa fa-fw fa-file-video-o";
  }
  else if (extension.match(/^(ecd|ECD|bdoc|BDOC)$/i)) {
    icon = "fa fa-fw fa-lock";
  }
  else {
    icon = "fa fa-fw fa-file-text-o";
  }

  return icon;
}

////////////////////////////////////
// APPEND _DOC INTO THE FOLDER //
////////////////////////////////////

function appendDoc (fid, did, doc, isfile) {
  var dclass = (isfile && "itsAFile") || "itsADoc";
  var fcolor;

  if (catalog.folders[fid]) {
    fcolor = catalog.folders[fid].color;
  } else {
    fcolor = "#363636";
  }

  var generation = doc.generation || 0;

  var title = "Untitled Document";
  if (catalog.docs[did]) {
    if (catalog.docs[did].name && catalog.docs[did].name !== "" && catalog.docs[did].name !== "Untitled Document") {
      title = catalog.docs[did].name;
    }
  }

  var ext = "crypteedoc";
  var iconClass = iconFromFilename(title);

  var offlineStatus = "Make Doc Available Offline";
  var offlineIconColor = "#FFF";
  var offlineClass = "false";
  var offlineButton = "";
  var offlineBadge = "<div class='offline-badge'></div>";

  var mobileClass = "";
  if (isMobile) { mobileClass = "itsMobile"; }

  var activeClass = "";
  if (activeDocID === did) { activeClass = " is-active activedoc "; }

  offlineStorage.getItem(did, function (err, offlineDoc) {
    if (err) { handleError(err); }
    if (offlineDoc) {
      offlineBadge = "<div class='offline-badge visible'></div>";
      offlineStatus = "Make Doc Online Only";
      offlineIconColor = "#000";
      offlineClass = "true";
    }
    if (!isfile) {
      offlineButton = '<p class="context-make-doc-offline"><span class="icon is-small"><span class="fa-stack fa-lg"><i class="fa fa-cloud fa-stack-1x" style=""></i><i class="fa fa-times fa-stack-2x text-danger" style="color: '+offlineIconColor+'; margin-top: 13px; font-size: 8px; margin-left:1px;"></i></span></span> &nbsp; <span class="status">'+offlineStatus+'</span></p>';
    }
    var doccard = "<li class='adoc "+dclass+"' id='"+ did +"' offline='"+offlineClass+"' ext='"+ext+"' style='display:none;'>"+

                    offlineBadge +

                    "<a class='"+activeClass+"'><span class='icon docicon exticon'><i class='"+iconClass+"'></i></span>"+
                       "<span class='icon uncheckedicon docicon'><i class='fa fa-fw fa-square-o'></i></span>"+
                       "<span class='icon checkedicon docicon'><i class='fa fa-fw fa-check-square-o'></i></span>"+
                       "<span class='docsize'></span><span class='doctitle'>"+title+"</span>"+
                       "<progress class='progress is-small docprogress' value='' max=''></progress>"+
                    "</a>"+

                    "<div class='tags docs-float-context has-addons "+mobileClass+"'>"+
                       "<span title='Quick Document Actions' class='adoc-float-context tag is-light'>"+
                          "<span class='icon is-small'><i class='fa fa-ellipsis-v fa-fw'></i></span>"+
                       "</span>"+
                    "</div>"+

                    '<div class="docs-contextual-dropdown">'+
                      offlineButton +
                      '<p class="context-rename-doc       adoc-float-rename"><span class="icon is-small"><i class="fa fa-fw fa-i-cursor"></i></span> &nbsp; Rename Document</p>'+
                      '<p class="context-delete-doc       adoc-float-delete"><span class="icon is-small"><i class="fa fa-fw fa-trash"></i></span> &nbsp; Delete Document</p>'+
                    '</div>'+
                  "</li>";

    if (!$("#docs-of-" + fid).find( "#" + did ).length) {
      // add doc to dom if it doesn't already exist.
      $("#docs-of-" + fid).prepend(doccard);
    }

    // slide down for a sexy reveal
    $("#docs-of-" + fid).find( "#" + did ).slideDown();

    appendedDocsCountForBoot++;
    updateDocInCatalog (fid, doc);

    if (bootCatalogDecrypted) {
      decryptEncryptedCatalogItems(function(){
        // now that new title / folder change is decrypted
        // update in catalog then update recents.
        try { catalog.docs[did].fname = titleOf(fid); } catch (e) {}
        updateRecentDocs();
      });
    }

  });
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







function updateDocIndexesOfFID (fid) {
  var newDocsOrderObject = {};
  $("#docs-of-"+fid).find(".adoc").each(function(index, theDoc) {
    newDocsOrderObject[index] = $(this).attr("id");
  });

  foldersRef.child(fid).update({"docsOrder" : newDocsOrderObject});
}

function sortDocsOfFID (fid, callback, callbackParam) {
  callback = callback || noop;
  foldersRef.child(fid + "/docsOrder").once('value', function(snapshot) {
    docsOrderObject = snapshot.val();
    if (docsOrderObject !== null) {
      $.each(docsOrderObject, function(index, did) {
        $("#" + did).attr("data-sort", index);
      });

      $("#docs-of-"+fid).find(".adoc").sort(function (a, b) {
        return ($(b).data('sort')) < ($(a).data('sort')) ? 1 : -1;
      }).appendTo("#docs-of-"+fid);
    }

    callback(callbackParam);
  });
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

function newFolder (callback, newFTitle, uuid){
  callback = callback || noop;
  uuid = uuid || newUUID();
  newFTitle = newFTitle || $("#new-folder-title").val().trim() || "Untitled Folder";
  $("#new-folder-button").removeClass("is-armed");

  var fid = "f-" + uuid;
  encryptTitle(fid, JSON.stringify(newFTitle), function(encryptedTitle){

    var fcount = 0;
    var folderData = {
      folderid : fid,
      count : fcount,
      open : true,
      title : encryptedTitle
    };

    foldersRef.child(fid).update(folderData , function(){
      dataRef.update({"foldersCount" : foldersCount+1});

      $("#new-folder-title").val("");
      updateFolderIndexes();

      $(".first-folder-hint").hide();
      $(".first-doc-hint").hide();

      callback(fid);
    });

  });
}














/////////////////////
// DELETE FOLDER //
/////////////////////


$('#all-folders').on('click', '.delete-folder-confirm', function(event) {
    deleteFolder($(this).parents(".afolder"));
    $(this).addClass("is-loading").prop("disabled", true).attr("disabled", true);
    $(this).parents(".afolder").find(".delete-folder-cancel").addClass("is-loading").prop("disabled", true).attr("disabled", true);
    $(this).parents(".afolder").find(".dropdowns > p, .dropdowns > label").hide();
    $(this).parents(".afolder").find(".delete-folder-buttons").css("margin-top", 0);
});

$('#all-folders').on('click', '.delete-folder-cancel', function(event) {
    $(this).parents(".afolder").find(".delete-folder-buttons").hide();
});

$('#all-folders').on('click', '.delete-folder-button', function(event) {
    $(this).parents(".afolder").find(".delete-folder-buttons").show().css("display", "block");
    var numOfFolders = $(".afolder").length;
    if ($(this).parents(".afolder").index() + 1 >= numOfFolders - 6) {
      setTimeout(function () {
        $("#all-folders").animate({ scrollTop: $("#all-folders")[0].scrollHeight }, "slow");
      }, 50);
    }
});



function deleteFolder (folderElement){
  var fid = folderElement.attr("id");
  var activeDID = activeDocID;

  showDocProgress("One Moment, deleting dolder.");

  var anyDocsFromThisFolderOpen = false;
  clearSelections();

  $("#" + fid).find(".adoc").each(function(index, doc) {
    var did = doc.id;
    if (activeDID === did) {
      // IF ANY OF THESE DOCS ARE CURRENTLY OPEN -~ hard close it.
      anyDocsFromThisFolderOpen = true;
    }

    var deletionRef;
    if ($(doc).hasClass("itsADoc")) {
      deletionRef = rootRef.child(did + ".crypteedoc");
    }

    if ($(doc).hasClass("itsAFile")) {
      deletionRef = rootRef.child(did + ".crypteefile");
    }

    $(".recent-doc[did='"+did+"']").remove();
    offlineStorage.removeItem(did).catch(function(err) {
      handleError(err);
    });
    if (deletionRef) {
      deletionRef.delete().then(function(){}).catch(function(error) {
        handleError(error);
      });
    }

  });

  foldersRef.child(fid).remove().then(function() {
    dataRef.update({"foldersCount" : foldersCount-1},function(){
      if (anyDocsFromThisFolderOpen){
        loadDoc("home");
      } else {
        hideDocProgress();
      }

      updateFolderIndexes();
    });
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











//////////////////////////////////
// OPEN & CLOSE FOLDER BUTTON //
//////////////////////////////////

function toggleFolderOpenClose(fid) {
  $("#" + fid).addClass("overflowhidden");
  $("#" + fid).find(".folder-icon").toggleClass('fa-folder-open').toggleClass('fa-folder');
  $("#" + fid).find(".folder-dropdown").fadeOut(100).removeClass('dropdown-open');

  if ($("#" + fid).find(".folderClosable").is(':visible')) {
    $("#" + fid).find(".folderClosable").slideUp(500, function() {
      // all hidden
      $("#" + fid).removeClass("overflowhidden");
      foldersRef.child(fid).update({open : false});
    });
  } else {
    $("#" + fid).find(".folderClosable").slideDown(500, function() {
      // all shown
      $("#" + fid).removeClass("overflowhidden");
      foldersRef.child(fid).update({open : true});
    });
  }
}

$('#all-folders').on('click', '.folder-clicker-icon, .folder-title', function(event) {
    var fid = $(this).parents(".afolder").attr("id");
    toggleFolderOpenClose(fid);
});


/////////////////////
//  ARCHIVE FOLDER  //
/////////////////////

var archiveSortTimer;
function setArchivedFolder(fid, archiveBool) {

  catalog.folders[fid].archived = archiveBool || false;

  $("#" + fid).find(".folder-dropdown").hide().removeClass('dropdown-open');
  if (archiveBool) {
    setTimeout(function () {
      $("#" + fid).addClass("archived");
      $("#" + fid).find(".folder-header").addClass("archived");
    }, 50);
  } else {
    setTimeout(function () {
      $("#" + fid).removeClass("archived");
      $("#" + fid).find(".folder-header").removeClass("archived");
    }, 50);
  }

  clearTimeout(archiveSortTimer);
  archiveSortTimer = setTimeout(function () {

    // this will insert the folder into the correct place.
    // also will call sort Folders for the first time after am I the last
    sortFolders();
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


$('#all-folders').on('click touchend', '.folder.archived', function(event) {
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


$('#all-folders').on('click', '.rename-folder-button', function(event) {
  var fid = $(this).parents(".afolder").attr("id");
  var folderOldName = $(this).parents(".afolder").find(".folder-title").text();
  $("#rename-folder-input").attr("placeholder", folderOldName).val(folderOldName);
  $("#rename-folder-modal").addClass('is-active').attr("fid", fid);
  $(".invalid-foldername").removeClass("shown");
  setTimeout(function () {
    $("#rename-folder-input").focus();
  }, 10);
});










/////////////////////
//  COLOR FOLDER //
/////////////////////

$('#all-folders').on('click', '.folder-color-select-button', function(event) {
  theColorPicker = $(this);
  closeDropdownAfterSubButtonPress(theColorPicker);
  var colorToAssign = $(this).attr("color");
  var fid = $(this).parents(".afolder").attr("id");
  foldersRef.child(fid).update({
    color : colorToAssign
  },function(error){
    if (!error) {
      theColorPicker.parents(".afolder").find(".folder-icon").css("color", colorToAssign);
    } else {
      handleError(error);
    }
  });
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


$('#all-folders').on('click', '.make-ghost-folder-button', function(event) {
  ghostFTitleToConfirm = $(this).parents(".afolder").find(".folder-title").text();

  try {
    var testHashingTheTitle = hashString(ghostFTitleToConfirm);
    fidToGhost = $(this).parents(".afolder").attr("id");
    $("#ghost-folder-confirm-input").attr("placeholder", ghostFTitleToConfirm);
    $(".invalid-foldername").removeClass("shown");
    saveDoc(prepareForGhostFolderModal);
  } catch (e) {
    $(".invalid-foldername").addClass("shown");
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
    ghostingTitle = hashString(ghostFTitleToConfirm);
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
              $(".recent-doc[did='"+ghostedDID+"']").remove();
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
}

var summonedTitle;
function summonGhostFolder () {
  $("#ghost-folder-summon-button").addClass("is-loading").prop("disabled", true).attr("disabled", true);
  $("#ghost-folder-input").prop('disabled', true);
  summonedTitle = $("#ghost-folder-input").val();
  folderTitleToSummon = hashString(summonedTitle);
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
    input.attr("placeholder", "Type in a New Document name here ...");
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



$('#all-folders').on('click', '.new-document-icon', function(event) {
  event.preventDefault();
  var ndInput = $(this).parents(".newDocInput").find('.new-doc-input');
  var newDTitle = ndInput.val().trim();
  if (newDTitle !== "") {
    if (usedStorage <= allowedStorage) {
      showDocProgress("Saving Current Document");
      $(".new-document-icon").removeClass("is-armed");
      saveDoc(newDoc, ndInput);
    } else {
      exceededStorage();
    }
  } else {
    ndInput.focus();
    ndInput.attr("placeholder", "Type in a New Document name here ...");
  }
});

$('#all-folders').on('keydown', '.new-doc-input', function(event) {
  var theinput = $(this);
  setTimeout(function(){
    if (theinput.val().trim() !== "") {
      $(".new-document-icon").addClass("is-armed");
    } else {
      $(".new-document-icon").removeClass("is-armed");
    }

    if (event.keyCode == 13 && theinput.val().trim() !== "") {
      if (usedStorage <= allowedStorage) {
        $(".new-document-icon").removeClass("is-armed");
        showDocProgress("Saving Current Document");
        saveDoc(newDoc, theinput);
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

      foldersRef.child(fid + "/count").once('value', function(snapshot) {
        var fcount = snapshot.val();
        var did = "d-" + newUUID();
        var tempGen = (new Date()).getTime() * 1000; // this will change anyway, but this allows for syncing devices to update this doc as recent.

        encryptTitle(did, JSON.stringify(recentNewDocTitle), function(encryptedTitle){

          var docData = { docid : did, fid : fid, generation : tempGen, title : encryptedTitle };

          foldersRef.child(fid).update({"count" : fcount+1});
          foldersRef.child(fid + "/docs/" + did).update(docData, function(){
            $("#f-uncat").attr("count", fcount + 1);
            input.val("");
            newDocCreated(did, fid, recentNewDocTitle);
            updateDocIndexesOfFID(fid);
          });

        });
      });
    }
  }
}




function newDoc (whichInput){
  showDocProgress("Creating New Document");
  var input = whichInput;
  if ($.trim(input.val()) !== ""){
    var dtitle = $.trim(input.val());
    var fid = input.parents(".afolder").attr("id");

    foldersRef.child(fid + "/count").once('value', function(snapshot) {
      var fcount = snapshot.val();
      var did = "d-" + newUUID();
      var tempGen = (new Date()).getTime() * 1000; // this will change anyway, but this allows for syncing devices to update this doc as recent.

      encryptTitle(did, JSON.stringify(dtitle), function(encryptedTitle){
        var docData = { docid : did, fid : fid, generation : tempGen, title : encryptedTitle };

        foldersRef.child(fid).update({"count" : fcount+1});
        foldersRef.child(fid + "/docs/" + did).update(docData, function(){
          input.parents(".afolder").attr("count", fcount + 1);
          input.val("");
          newDocCreated(did, fid, dtitle);
          updateDocIndexesOfFID(fid);
        });
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

  //old one isn't active anymore
  $(".activedoc").removeClass('is-active activedoc');

  //set new did active
  activeDocID = did;
  activeDocTitle = dtitle;

  $("#" + did + "> a").addClass("is-active activedoc");

  document.title = dtitle;
  $("#active-doc-title").html(dtitle);
  $("#active-doc-title-input").val(dtitle);
  $("#active-doc-title-input").attr("placeholder", dtitle);
  $("#" + did).find(".doctitle").html(dtitle);

  saveDoc(function(){
    dataRef.update({"lastOpenDocID" : did}, function(){
      if (isMobile) {
        hideDocProgress(hideMenu);
      } else {
        hideDocProgress();
      }
      $(".activerecentdoc").removeClass('activerecentdoc');
      $(".recent-doc[did='"+did+"']").addClass("activerecentdoc");
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

  if (delta) {
    if (delta.ops[1]) {
      theChange = delta.ops[1].attributes;
      if (quill.hasFocus() && theChange) {
        var qs = quill.getSelection().index;
        var bounds = quill.getBounds(qs);
        var quillHeight = $(".ql-editor").height();
        var quillScrollHeight = $(".ql-editor")[0].scrollHeight;

        if (bounds.bottom > quillHeight && !theChange.list) {
          $("body").stop().scrollTop(bounds.bottom);
          $(".ql-editor").scrollTop(quillScrollHeight);
        }
      }
    }
  }

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
  if (idleTime > 5) { // 5 secs
    checkAndSaveDocIfNecessary();
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
  $("#"+did).find(".docprogress").addClass("docprogress-visible");
  fileRef.getDownloadURL().then(function(docURL) {
    $.ajax({ url: docURL, type: 'GET',
        success: function(encryptedFileContents){
          $("#"+did).find(".docprogress").attr("max", "0");
          $("#"+did).find(".docprogress").attr("value", "0");
          $("#"+did).find(".docprogress").removeClass("docprogress-visible");
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
      $("#"+did).find(".docprogress").attr("max", e.total);
      $("#"+did).find(".docprogress").attr("value", e.loaded);
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








$("#all-offline").on('click', '.offline-doc', function(event) {
  var did = $(this).attr("did");
  var didToLoad = did;
  if (didToLoad !== "undefined" || didToLoad !== undefined) {
    if (didToLoad !== activeDocID) {
      prepareToLoadOfflineDoc(didToLoad);
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
});

$("#all-recent").on('click', '.recent-doc', function(event) {
  var did = $(this).attr("did");
  var didToLoad = did;
  if (didToLoad !== "undefined" && didToLoad !== undefined) {
    if (didToLoad !== activeDocID) {
      prepareToLoad (didToLoad);
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
});


$('#all-folders').on('click', '.adoc', function(event) {
  var selectionButtons = $(".icon");
  var dropdowns = $(".docs-contextual-dropdown");
  var context = $(".adoc-float-context ");
  if (!selectionButtons.is(event.target) && selectionButtons.has(event.target).length === 0 && !dropdowns.is(event.target) && dropdowns.has(event.target).length === 0 && !context.is(event.target) && context.has(event.target).length === 0) {
    var did = $(this).attr("id");
    var didToLoad = did;
    if (didToLoad !== "undefined" && didToLoad !== undefined) {
      if (didToLoad !== activeDocID) {
        prepareToLoad (didToLoad);
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
  }
});

function prepareToLoad (didToLoad) {
  clearSelections();
  var dtitle = $("#"+didToLoad).find(".doctitle").text();
  $("#"+didToLoad).find(".exticon").addClass("is-loading");
  $(".recent-doc[did='"+didToLoad+"']").find(".recenticon").addClass("is-loading");
  if ((didToLoad !== activeDocID) && (typeof didToLoad != 'undefined') && !isDocOutdated) {
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

  if ($("#" + did).hasClass("itsAFile")) {
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
          handleError(err);
      });

    }).catch(function(error) {
      var errorText;

      switch (error.code) {
        case 'storage/object-not-found':
          //  NOT CAPTURING THIS. BUT STILL WORRIED.
          errorText = "Seems like this doc doesn't exist or you don't have permission to open this doc. We're not sure how this happened.<br> Please try again shortly, or contact our support.<br> We're terribly sorry about this.";
          if (did === "home") {
            fixHomeDoc(loadDoc, "home");
          } else {
            handleError(error);
            errorText = "Seems like this doc doesn't exist or you don't have permission to open this doc. We're not sure how this happened.<br> Please try again shortly, or contact our support.<br> We're terribly sorry about this.";
            showDocProgress(errorText);
            fixFilesAndFolders(did);
          }
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
    openpgp.decrypt({ message: openpgp.message.readArmored(offlineEncryptedDelta),   passwords: [keyToRemember],  format: 'utf8' }).then(function(offlineCopyPlaintext) {
      var offlineCopyDecryptedText = offlineCopyPlaintext.data;
      quill.setContents(JSON.parse(offlineCopyDecryptedText));
      currentGeneration = offlineGeneration;
      docLoaded();
    });
  }

  function useOnlineCopy (delta) {
    var onlineEncryptedDelta = JSON.parse(delta).data;
    openpgp.decrypt({ message: openpgp.message.readArmored(onlineEncryptedDelta),   passwords: [theKey],  format: 'utf8' }).then(function(onlineCopyPlaintext) {
      var onlineCopyDecryptedText = onlineCopyPlaintext.data;
      quill.setContents(JSON.parse(onlineCopyDecryptedText));
      docLoaded();
    });
  }





  function docLoaded(){

    quill.history.clear();
    // if (initialLoadComplete) {
    //   quill.focus();
    // }
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

    //old one isn't active anymore
    $(".activedoc").removeClass('is-active activedoc');
    $(".activerecentdoc").removeClass('activerecentdoc');

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

    $("#" + did + "> a").addClass("is-active activedoc");
    $("#" + did).find(".exticon").removeClass("is-loading");

    $(".recent-doc[did='"+did+"']").addClass("activerecentdoc");
    $(".recent-doc[did='"+did+"']").find(".recenticon").removeClass("is-loading");
    //reset all progresses

    $('#main-progress').attr("value", "100").attr("max", "100").removeClass("is-danger is-warning").addClass("is-success");

    hideDocProgress(hideMenu);
    if (!isMobile) {
      quill.focus();
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
  openpgp.decrypt({ message: openpgp.message.readArmored(theEncryptedFileContents),   passwords: [theKey],  format: 'utf8' }).then(function(plaintext) {
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
      $("#" + did).find(".exticon").removeClass("is-loading");
      $(".recent-doc[did='"+did+"']").find(".recenticon").removeClass("is-loading");
      $(".activefile").removeClass("activefile");
      $("#" + did).addClass("activefile");

      $("#file-viewer").removeClass("unsupported is-info");
      $("#file-viewer").find(".is-info").removeClass("is-info").addClass("is-light");
    }

  });
}

function downloadFileToDisk (dtitle, did, decryptedContents, callback, callbackParam) {
  $(".activefile").removeClass("activefile");
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
    }, 10);
  }
}

function maximizeFileViewer () {
  if ($("#file-viewer").hasClass("minimized")) {
    quill.blur();
    $("#file-viewer").removeClass("minimized");
    $('#file-viewer-maximize-button').hide();
    $('#file-viewer-minimize-button').show();
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
  var iconClass = iconFromFilename(dtitle);
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

                  // this +1s the folder docscount (if it's new it'll just be 1)
                  foldersRef.child(fid + "/count").transaction(function(currentCount) {
                    return currentCount + 1;
                  }).then(function(){

                    // if folder didn't exist on server, until we just created it, this will plus up the folder count.
                    // say if it's the first uncat folder for example or if user deleted folder and was offline etc. idk weird shit happens.

                    if (!folderExists) {

                      // this +1s the folderscount
                      dataRef.child("foldersCount").transaction(function(curFoldersCount) {
                        return curFoldersCount + 1;
                      }).then(function(){

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

                      }).catch(function(err) {
                        handleError(err);
                      });
                    } else {
                      var docData = { docid : did, fid : fid };
                      foldersRef.child(fid + "/docs/" + did).update(docData, function(){
                        encryptAndUploadDoc(did, fid, callback, callbackParam);
                      });
                    }

                  }).catch(function(err) {
                    handleError(err);
                  });
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
  openpgp.encrypt({ data: plaintextDocDelta, passwords: [theKey], armor: true }).then(function(ciphertext) {
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

        // IF THIS DOC DIDN'T EXIST IN SERVER, WE HAVE JUST CREATED REFERENCES FOR IT + FOLDER COUNTS ETC. AND FILE ISN'T UPLOADED.
        // UH-OH. THIS WILL NEED TO BE CLEANED LATER ON BY A FIXER.
        if (usedStorage >= allowedStorage) {
          exceededStorage(callback, callbackParam);
        } else {
          $('#main-progress').attr("max", "100").attr("value", "100").removeClass("is-warning is-success is-info").addClass("is-danger");

          checkConnection (function(status){
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
      $(".recent-doc[did='"+did+"']").attr("gen", currentGeneration / 1000);
      $(".recent-doc[did='"+did+"']").find(".recent-doctime").html("Seconds ago");
      $(".recent-doc[did='"+did+"']").prependTo("#all-recent");
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
//   DELETE  _DOC    //
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
    $(".delete-status").removeClass("is-light is-warning is-danger").addClass("is-warning").html("<p class='title'>Delete Document</p><p class='subtitle is-6'>You're about to delete this document</p>");
  } else {
    $(".delete-status").removeClass("is-light is-warning is-danger").addClass("is-warning").html("<p class='title'>Delete Document</p><p class='subtitle is-6'>You're about to delete the offline copy of this document. This will <b>not</b> delete the online copy of this document if there is any. You will need to delete the online copy separately.</p>");
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
  $(".delete-status").removeClass("is-light is-warning is-danger").addClass("is-light").html("<p class='title'>Deleting ...</p>");

  var fid = fidOfDID(did);
  var docRef = rootRef.child(did + ".crypteedoc");

  // Delete the file
  docRef.delete().then(function() {
    // File deleted successfully
    foldersRef.child(fid + "/count").once('value', function(snapshot) {

      var fcount = snapshot.val();
      foldersRef.child(fid).update({"count" : fcount-1}, function(){
        $("#" + fid).attr("count", fcount-1);
        foldersRef.child(fid + "/docs/" + did).remove();
        hideDeleteDocModal();
        updateDocIndexesOfFID(fid);
      });

    });

  }).catch(function(error) {
    handleError(error);
    $(".delete-status").removeClass("is-light is-warning is-danger").addClass("is-danger").html("<p class='title'>Error Deleting Doc... Sorry.. Please Reload the page.</p>");
  });

}

function deleteDocComplete(fid, did, callback, callbackParam) {
  callback = callback || noop;

  $("#docs-of-" + fid + " > " + "#" + did).slideUp(300, function(){
    $("#docs-of-" + fid + " > " + "#" + did).remove();
  });

  $(".recent-doc[did='"+did+"'][fid='"+fid+"']").remove();

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

function moveDoc (from, did) {
  var fromFID = $("#" + from).parents(".afolder").attr("id");
  var toFID = $("#" + did).parents(".afolder").attr("id");

  foldersRef.child(fromFID + "/docs/" + did).once('value', function(snap)  {
    var theMovingDocsData = snap.val();
    theMovingDocsData.fid = toFID;

     foldersRef.child(toFID + "/docs/" + did).set( theMovingDocsData, function(error) {
          if( !error ) {

            foldersRef.child(fromFID + "/docs/" + did).remove();

            foldersRef.child(fromFID + "/count").once('value', function(snapshot) {
              var fcount = snapshot.val();
              foldersRef.child(fromFID).update({"count" : fcount-1});
            });

            foldersRef.child(toFID + "/count").once('value', function(snapshot) {
              var fcount = snapshot.val();
              foldersRef.child(toFID).update({"count" : fcount+1});
              $("#"+ from).parents(".afolder").attr("count", fcount - 1);
              $("#" + did).parents(".afolder").attr("count", fcount + 1);

              updateDocIndexesOfFID(fromFID);
              updateDocIndexesOfFID(toFID);

              offlineStorage.iterate(function(doc, gotDid, i) {
                if (doc) {
                  if (gotDid === did) {
                    var updatedDoc = doc;
                    updatedDoc.fname = JSON.parse(titleOf(toFID) || "Inbox");
                    updatedDoc.fid = toFID;
                    offlineStorage.setItem(did, updatedDoc).catch(function(err) {
                      handleError(err);
                    });
                  }
                }
              }).catch(function(err) {
                handleError(err);
              });

            });


          }
          else if( typeof(console) !== 'undefined' && console.error ) {  handleError(error); console.error(error); }
     });
  });
}








/////////////////////
//   RENAME _DOC  //
////////////////////

$("#all-folders").on('click touchend', '.adoc-float-rename', function(event) {
  var did = $(this).parents(".adoc").attr("id");
  if (activeDocID === did) { showRenameDocModal(); }
  else { showRenameInactiveDocModal(did); }
});

function showRenameInactiveDocModal (did) {
  clearSelections();
  $("#rename-inactive-doc-modal").addClass("is-active");
  $("#inactive-doc-title-input").attr("did", did);
  var inactiveTitle = $("#" + did).find(".doctitle").text();
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

      offlineStorage.iterate(function(doc, did, i) {
        if (doc) {
          if (did === inactiveDidToRename) {
            var updatedDoc = doc;
            updatedDoc.name = newDocName;
            offlineStorage.setItem(did, updatedDoc).catch(function(err) {
              handleError(err);
            });
          }
        }
      }).catch(function(err) {
        handleError(err);
      });

      $("#" + inactiveDidToRename).find(".doctitle").html(newDocName);
      $(".recent-doc[did='"+inactiveDidToRename+"']").find(".recent-doctitle").html(newDocName);
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

        offlineStorage.iterate(function(doc, did, i) {
          if (doc) {
            if (did === activeDocID) {
              var updatedDoc = doc;
              updatedDoc.name = newDocName;
              offlineStorage.setItem(did, updatedDoc).catch(function(err) {
                handleError(err);
              });
            }
          }
        }).catch(function(err) {
          handleError(err);
        });

        $("#" + activeDocID).find(".doctitle").html(newDocName);
        $(".activerecentdoc").find(".recent-doctitle").html(newDocName);
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
  $("#file-download-status").removeClass("is-dark is-light is-warning is-danger is-success").addClass("is-warning");
  $("#file-download-status").removeClass("showUploadStatus");
}




var selectedFiles = 0;
var selectedDocs = 0;
var selectionArray = [];

function clearSelections () {
  $('.checkedicon').hide();
  $('.exticon').show();
  selectedFiles = 0;
  selectedDocs = 0;
  selectionArray = [];
  toggleSelectionActions();
}

function toggleSelectionActions () {
  if (selectedFiles > 0 || selectedDocs > 0) {
    $('#selection-cancel-button').fadeIn(100);
    $('#new-folder-card').addClass("hiddenNewFolderCard");
    $("#selection-actions-card").removeClass("hiddenSelectionActions").delay(500).queue(function (next) { $(this).css('display', 'inline-block'); next(); });
  } else {
    $('#selection-cancel-button').fadeOut(100);
    $("#selection-actions-card").addClass("hiddenSelectionActions").stop().delay(500).hide();
    $('#new-folder-card').removeClass("hiddenNewFolderCard");
  }
  if (selectedDocs > 0) {
    $('#selection-download-button').fadeOut(100);
  } else {
    $('#selection-download-button').fadeIn(100);
  }
}

$('#all-folders').on('mouseenter', '.docicon', function(event) {
  var checkedicon = $(this).parents(".adoc").find(".checkedicon");
  var uncheckedicon = $(this).parents(".adoc").find(".uncheckedicon");
  var exticon = $(this).parents(".adoc").find(".exticon");
  var did = $(this).parents(".adoc").attr("id");

  if (exticon.is(":visible") && (did !== activeDocID)) {
    exticon.hide();
    uncheckedicon.css('display', 'inline-block');
  }
});

$('#all-folders').on('mouseleave', '.docicon', function(event) {
  var checkedicon = $(this).parents(".adoc").find(".checkedicon");
  var uncheckedicon = $(this).parents(".adoc").find(".uncheckedicon");
  var exticon = $(this).parents(".adoc").find(".exticon");
  var did = $(this).parents(".adoc").attr("id");

  if (uncheckedicon.is(":visible") && (did !== activeDocID)) {
    exticon.show();
    uncheckedicon.hide();
  }
});

$('#all-folders').on('click', '.uncheckedicon', function(event) {
  event.stopPropagation();
  event.preventDefault();
  var checkedicon = $(this).parents(".adoc").find(".checkedicon");
  var uncheckedicon = $(this).parents(".adoc").find(".uncheckedicon");
  var exticon = $(this).parents(".adoc").find(".exticon");
  var did = $(this).parents(".adoc").attr("id");
  var dtitle = $(this).parents(".adoc").find(".doctitle").text();
  var itsAFile = $(this).parents(".adoc").hasClass("itsAFile");
  var itsADoc = $(this).parents(".adoc").hasClass("itsADoc");

  if (did !== activeDocID) {
    uncheckedicon.hide();
    checkedicon.css('display', 'inline-block');

    if ($(this).parents(".adoc").hasClass("itsAFile")) {
      selectedFiles++;
    } else {
      selectedDocs++;
    }

    selectionArray.push({ did : did , dtitle : dtitle , itsADoc : itsADoc , itsAFile : itsAFile});
    toggleSelectionActions();
  }
});

$('#all-folders').on('click', '.checkedicon', function(event) {
  event.stopPropagation();
  event.preventDefault();
  var checkedicon = $(this).parents(".adoc").find(".checkedicon");
  var uncheckedicon = $(this).parents(".adoc").find(".uncheckedicon");
  var exticon = $(this).parents(".adoc").find(".exticon");
  var did = $(this).parents(".adoc").attr("id");

  if (did !== activeDocID) {
    checkedicon.hide();
    uncheckedicon.css('display', 'inline-block');

    if ($(this).parents(".adoc").hasClass("itsAFile")) {
      selectedFiles--;
    } else {
      selectedDocs--;
    }

    removeByAttr(selectionArray, "did", did);
    toggleSelectionActions();
  }
});


$('#selection-download-button').on('click', function(event) {
  downloadSelections();
});

$('#selection-cancel-button').on('click', function(event) {
  clearSelections();
});


var completedDownloads = 0;
var completedDeletions = 0;
function downloadSelections () {
  completedDownloads = 0;
  showFileDownloadStatus("is-warning", '<span class="icon is-small"><i class="fa fa-fw fa-circle-o-notch fa-spin"></i></span> &nbsp; <b>Decrypting &amp; Downloading</b><br>Please <b>do not</b> close this window until all downloads are complete');
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
  hideFileDownloadStatus();
  $("#selection-download-button > i").removeClass("fa-circle-o-notch fa-spin").addClass("fa-download");
  clearSelections();
}


var floatDelete = false;
$("#all-folders").on('click touchend', '.adoc-float-delete', function(event) {

  var did = $(this).parents(".adoc").attr("id");
  if (activeDocID === did) { showDeleteDocModal(); }
  else {

    var checkedicon = $(this).parents(".adoc").find(".checkedicon");
    var uncheckedicon = $(this).parents(".adoc").find(".uncheckedicon");
    var exticon = $(this).parents(".adoc").find(".exticon");
    var dtitle = $(this).parents(".adoc").find(".doctitle").text();
    var itsAFile = $(this).parents(".adoc").hasClass("itsAFile");
    var itsADoc = $(this).parents(".adoc").hasClass("itsADoc");

    if (did !== activeDocID) {
      uncheckedicon.hide(); exticon.hide();
      checkedicon.css('display', 'inline-block');

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
      foldersRef.child(fid + "/count").once('value', function(snapshot) {
        var fcount = snapshot.val();
        foldersRef.child(fid).update({"count" : fcount-1}, function(){
          $("#" + fid).attr("count", fcount-1);
          foldersRef.child(fid + "/docs/" + selection.did).remove();
          areDeletionsComplete(selection.did, fid);
        });
      });
    }).catch(function(error) {
      handleError(error);
      $(".delete-selections-status").removeClass("is-light is-warning is-danger").addClass("is-danger").html("<p class='title'>Error Deleting Doc... Sorry.. Please Reload the page.</p>");
    });

  });
}

function areDeletionsComplete (did, fid) {
  completedDeletions++;
  delete catalog.docs[did];
  $("#" + fid).find("#" + did).remove();
  $(".recent-doc[did='"+did+"']").remove();
  offlineStorage.removeItem(did).catch(function(err) {
    handleError(err);
  });
  if (selectionArray.length === completedDeletions) {
    hideDeleteSelectionsModal();
    clearSelections();
  }
}

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
  $("#file-upload-status").removeClass("is-dark is-light is-warning is-danger is-success").addClass("is-warning");
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
        var filename = files[i].name;
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
        processDroppedDoc(files[i], targetfid);
        numFilesLeftToBeUploaded++;
      }

      if (numFilesLeftToBeUploaded > 0) {
        var processingMessage = "Processing <b>" + numFilesLeftToBeUploaded.toString() + "</b> file(s)";
        showFileUploadStatus("is-warning", processingMessage);
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
        processDroppedDoc(files[i], targetfid);
        numFilesLeftToBeUploaded++;
      }

      if (numFilesLeftToBeUploaded > 0) {
        var processingMessage = "Processing <b>" + numFilesLeftToBeUploaded.toString() + "</b> file(s)";
        showFileUploadStatus("is-warning", processingMessage);
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

function processDroppedDoc (file, fid, callback, callbackParam) {
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
      showFileUploadStatus("is-warning", processingMessage);
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
  openpgp.encrypt({ data: plaintextFileContents, passwords: [theKey], armor: true }).then(function(ciphertext) {
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

function fileUploadComplete(fidToUpdateInDB, did, filename, callback, callbackParam) {
  numFilesLeftToBeUploaded--;

  callback = callback || noop;
  callbackParam = callbackParam || did;

  function saveToDB(fid) {
    encryptTitle(did, JSON.stringify(filename), function(encryptedTitle){
      foldersRef.child(fid + "/count").once('value', function(snapshot) {
        var fcount = snapshot.val();
        var docData = { docid : did, fid : fid, isfile : true, title : encryptedTitle };
        foldersRef.child(fid).update({"count" : fcount+1});
        foldersRef.child(fid + "/docs/" + did).update(docData, function(){
          $("#" + fid).attr("count", fcount + 1);
          decryptEncryptedCatalogItems();
          if (numFilesLeftToBeUploaded <= 0) {
            // all uploads complete
            hideFileUploadStatus();
            updateDocIndexesOfFID (fid);
          }

          callback(callbackParam);
        });
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
      var resultCard = '<div class="notification search-result" did="'+result.did+'"><span class="icon result-icon"><i class="'+result.icon+'"></i></span><p class="result-title">'+resultTitle+'</p><span class="result-tag">'+ match +'</span></div>';
      $("#results").append(resultCard);
    }
  });
}

$('#results').on('click', '.search-result', function(event) {
    var didToLoad = $(this).attr("did");
    var activeDID = activeDocID;
    // check the active ID first.
    if ((didToLoad !== activeDID) && (typeof didToLoad != 'undefined')) {
      clearSearch();
      saveDoc(loadDoc, didToLoad);
    }

    if (didToLoad === activeDID) {
      var theresult = $(this);
      theresult.css("background-color", "#4bbf73", "important"); theresult.css("color", "#fff", "important");
      setTimeout(function () { theresult.css("background-color", "#f5f5f5", "important"); theresult.css("color", "#000", "important"); }, 250);
      setTimeout(function () { theresult.css("background-color", "#4bbf73", "important"); theresult.css("color", "#fff", "important"); }, 500);
      setTimeout(function () { theresult.css("background-color", ""); theresult.css("color", ""); }, 750);

    }
});

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

$('#print-currentdoc').on('click', function(event) {
  hideExportDocModal();
  print();
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
    openpgp.encrypt({ data: plaintextDocDelta, passwords: [keyToUseForEncryption], armor: true }).then(function(ciphertext) {
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

      processDroppedDoc(file, targetfid, function(did){
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
      processDroppedDoc(files[i], targetfid);
      numFilesLeftToBeUploaded++;
    }

    if (numFilesLeftToBeUploaded > 0) {
      var processingMessage = "Processing <b>" + numFilesLeftToBeUploaded.toString() + "</b> file(s)";
      showFileUploadStatus("is-warning", processingMessage);
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
  openpgp.decrypt({ message: openpgp.message.readArmored(theEncryptedFileContents),   passwords: [theKey],  format: 'utf8' }).then(function(plaintext) {
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

    encryptAndUploadFile(xmlToEncrypt, fid, titleToUpload, function(did){
      numNotesUploaded++;
      if (numNotesUploaded === numOfNotesToUpload) {
        // ALL NOTES UPLOADED.
        hideModal("enoteimport-modal");
        console.log("All Notes Unpacked.");
        $("#" + parentDid).find(".exticon").removeClass("is-loading");
        $(".recent-doc[did='"+parentDid+"']").find(".recenticon").removeClass("is-loading");
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

  function prepareResource(resObj) {
    var recoJSON = x2js.xml_str2json( resObj.recognition );
    var hash;
    if (recoJSON) {
      hash = recoJSON.recoIndex._objID;
      contentsForHashes[hash] = resObj.data.__text;
      console.log("Added image", hash ,"to embed queue.");
    } else {
      var attachmentTitle = resObj["resource-attributes"]["file-name"];
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
    $(".activedoc").removeClass('is-active activedoc');
    $(".activerecentdoc").removeClass('activerecentdoc');
    //set new did active
    activeDocID = did;
    activeDocTitle = dtitle;

    $(".filesize-button").prop('onclick',null).off('click');

    $("#" + did + "> a").addClass("is-active activedoc");
    $("#" + did).find(".exticon").removeClass("is-loading");

    $(".recent-doc[did='"+did+"']").find(".recenticon").removeClass("is-loading");
    $(".recent-doc[did='"+did+"']").addClass("activerecentdoc");

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
          $("#" + activeDocID).find(".doctitle").html(newDocName);
          $("#" + did).removeClass("itsAFile");
          $("#" + did).addClass("itsADoc");

          // now that we've imported the file, and made it a crypteedoc, delete it.
          var fileRef = rootRef.child(did + ".crypteefile");
          fileRef.delete().then(function() {
            callback(callbackParam);
          });
        });
      });
    });
  } catch (e) {
    $("#" + did).find(".exticon").removeClass("is-loading");
    $(".recent-doc[did='"+did+"']").find(".recenticon").removeClass("is-loading");
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

    $(".activedoc").removeClass('is-active activedoc');
    $(".activerecentdoc").removeClass('activerecentdoc');

    //set new did active
    activeDocID = did;
    activeDocTitle = dtitle;

    $(".filesize-button").prop('onclick',null).off('click');

    $("#" + did + "> a").addClass("is-active activedoc");
    $("#" + did).find(".exticon").removeClass("is-loading");

    $(".recent-doc[did='"+did+"']").find(".recenticon").removeClass("is-loading");
    $(".recent-doc[did='"+did+"']").addClass("activerecentdoc");

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
          $("#" + activeDocID).find(".doctitle").html(newDocName);
          $("#" + did).removeClass("itsAFile");
          $("#" + did).addClass("itsADoc");

          // now that we've imported the file, and made it a crypteedoc, delete it.
          var fileRef = rootRef.child(did + ".crypteefile");
          fileRef.delete().then(function() {
            callback(callbackParam);
          });
        });
      });
    });

  } catch (e) {
    $("#" + did).find(".exticon").removeClass("is-loading");
    $(".recent-doc[did='"+did+"']").find(".recenticon").removeClass("is-loading");
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

  $("#" + crypteeDocForImportDID).find(".exticon").removeClass("is-loading");
  $(".recent-doc[did='"+crypteeDocForImportDID+"']").find(".recenticon").removeClass("is-loading");

  encryptedCrypteeDocForImport = null;
  crypteeDocForImportDID = null;
  crypteeDocForImportTitle = null;
  crypteeDocForImportSize = null;

  // CANCEL LOADDOC HERE IF YOU NEED TO DO MORE.

  if (error) {
    handleError(error);
    setTimeout(function () {
      showErrorBubble("Document seems corrupted.");
    }, 500);
  }

  crypteeDocImportCallback();
  crypteeDocImportCallback = null;
}

function importCrypteedoc (dtitle, did, decryptedContents, callback, docsize, callbackParam) {
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
    crypteeDocImportCallback = callback;

    processEncryptedCrypteedoc();
  } catch (e) {
    cancelImportingCrypteedoc(e);
  }
}

function processEncryptedCrypteedoc(retry) {
  retry = retry || false;
  $("#crypteedoc-modal-decrypt-button").find("i").removeClass("fa-unlock-alt").addClass("fa-cog fa-spin");

  var encryptedCrypteedocContents;
  var proceedWithDecrypt = false;
  var hadErrors;
  try {
    encryptedCrypteedocContents = JSON.parse(encryptedCrypteeDocForImport).data;
    proceedWithDecrypt = true;
  } catch (e) {
    hadErrors = e;
  }

  if (proceedWithDecrypt) {
    openpgp.decrypt({ message: openpgp.message.readArmored(encryptedCrypteedocContents),   passwords: [theKey, $("#crypteedoc-key-input").val().trim()],  format: 'utf8' }).then(function(decryptedCrypteedoc) {
      var plaintextCrypteedoc = decryptedCrypteedoc.data;
      processPlaintextCrypteedoc(plaintextCrypteedoc);
    }).catch(function(error){
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
  $(".activedoc").removeClass('is-active activedoc');
  $(".activerecentdoc").removeClass('activerecentdoc');
  //set new did active
  activeDocID = did;
  activeDocTitle = dtitle;

  $(".filesize-button").prop('onclick',null).off('click');

  $("#" + did + "> a").addClass("is-active activedoc");
  $("#" + did).find(".exticon").removeClass("is-loading");

  $(".recent-doc[did='"+did+"']").find(".recenticon").removeClass("is-loading");
  $(".recent-doc[did='"+did+"']").addClass("activerecentdoc");

  // always inherited from load doc.

  saveDoc(function (){
    // RENAME DOCUMENT AND REMOVE HTML NOW.
    var newDocName = dtitle.replace(/\.crypteedoc/g, '');
    encryptTitle(activeDocID, JSON.stringify(newDocName), function(encryptedTitle){
      foldersRef.child(fid + "/docs/" + did).update({ "isfile" : false, title : encryptedTitle }, function(){
        //set doc title in taskbar
        $("#active-doc-title").html(newDocName);
        $("#active-doc-title-input").val(newDocName);
        document.title = newDocName;
        $("#active-doc-title-input").attr("placeholder", newDocName);
        $("#" + activeDocID).find(".doctitle").html(newDocName);
        $("#" + did).removeClass("itsAFile");
        $("#" + did).addClass("itsADoc");

        // now that we've imported the file, and made it a crypteedoc, delete it.
        var fileRef = rootRef.child(did + ".crypteefile");
        fileRef.delete().then(function() {
          // IN THIS CASE THIS WILL JUST HIDE. NOTHING TO CANCEL ANYWAY YOU'RE ALL GOOD. DON'T WORRY.
          cancelImportingCrypteedoc();
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
    $(".left-views-scroller").removeClass("pos-0 pos-1 pos-2").addClass("pos-"+posToLoad);
    $(".left-view-controller-buttons").find(".left-nav-buttons").removeClass("active");
    $(this).addClass("active");
  }
});

function gensort(a,b) {
  if (a.gen < b.gen)
    return -1;
  if (a.gen > b.gen)
    return 1;
  return 0;
}

function updateRecentDocs() {
  var recentDocsArray = Object.values(catalog.docs);
  $("#all-recent").html("");
  recentDocsArray.sort(gensort);
  recentDocsArray.forEach(function(doc){
    if (doc.name && !doc.isfile && !isDIDinArchivedFID(doc.did)) {
      if ($(".recent-doc[did='"+doc.did+"']").length === 0) {
        $("#all-recent").prepend(renderRecentOrOfflineDoc(doc));

        offlineStorage.getItem(doc.did, function (err, offlineDoc) {
          if (offlineDoc) {
            $(".recent-doc[did='"+doc.did+"']").find(".offline-badge").addClass("visible");
            $("#"+doc.did).find(".offline-badge").addClass("visible");
          }
        });
      }
    }
  });

  hideFoldersProgress();
}

function renderRecentOrOfflineDoc (doc) {
  var isFile = doc.isfile || "false";
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
    active = "activerecentdoc";
  }

  if (doc.did === "home") {
    icon = "fa fa-fw fa-home";
  }

  var offlineOrRecent = "recent";
  var recentFolder;
  if (doc.fid === "f-uncat") {
    recentFolder = '&bull; Inbox';
  } else {
    recentFolder = '&bull; '+doc.fname;
  }
  var offlineBadge = '<span class="offline-badge"></span>';
  if (doc.content) {
    offlineOrRecent = "offline";
    recentFolder = "";
    offlineBadge = "";
  }


  var docElem =
  '<div class="'+offlineOrRecent+'-doc ' + active + '" did="'+ doc.did +'" fid="'+doc.fid+'" isfile="'+isFile+'" gen="'+ gen +'">'+
    '<span class="icon recenticon"><i class="' + icon + '"></i>'+ offlineBadge +'</span>'+
    '<p class="recent-doctitle">'+doc.name+'</p>'+
    '<p class="deets recent-docdeet">'+ since + ' ago ' + recentFolder + '</p>' +
  '</div>';

  return docElem;
}

//$(".recent-doc[did='"+didToLoad+"']").addClass("activerecentdoc");

function updateRecency() {
  if (initialLoadComplete) {
    Object.values(catalog.docs).forEach(function(doc){
      var gen, since;
      var stringGen = $(".recent-doc[did='"+doc.did+"']").attr("gen");
      if (stringGen !== "0" || stringGen !== "undefined") {
        gen = parseInt($(".recent-doc[did='"+doc.did+"']").attr("gen"));
      } else {
        gen = 0;
      }

      if (gen !== 0) {
        since = timeSince(gen);
      } else {
        since = "∞";
      }

      $(".recent-doc[did='"+doc.did+"']").find(".recent-doctime").html(since+ " ago");
    });
    if (!connectivityMode) {
      updateOfflineDocs();
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

function forceCheckConnection(){
  checkConnection (function(status){
    connectionStatus(status, true);
  });
}

function connectionStatus(status, forced) {
  connected = status; // boolean, true if connected

  if (gotKey) { // this prevents an early offline mode call from being made before key is typed.
    if (connected) {
      setTimeout(function () {
        checkConnection (function(secondCheck){
          if (secondCheck) {
            activateOnlineMode();
          }
        });
      }, 3000);
    } else {
      activateOfflineMode();
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

  openpgp.encrypt({ data: plaintextDocDelta, passwords: [keyToRemember], armor: true }).then(function(ciphertext) {
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

    openpgp.encrypt({ data: plaintextDocDelta, passwords: [keyToRemember], armor: true }).then(function(ciphertext) {
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
            $(".offline-doc[did='"+did+"']").attr("gen", gen / 1000);
            $(".offline-doc[did='"+did+"']").find(".recent-doctime").html("Seconds ago");
            $(".offline-doc[did='"+did+"']").prependTo("#all-offline");
          }

          docChanged = false;
          setTimeout(function () {
            $('#main-progress').attr("value", "30").removeClass("is-danger is-warning is-success is-info").addClass("is-info");
            updateOfflineDocs(callback, callbackParam);
          }, 150);
        }).catch(function (err) {

          showErrorBubble("Error saving document", err);
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

  $(".offline-doc[did='"+did+"']").find(".recenticon").addClass("is-loading");

  offlineStorage.getItem(did).then(function (doc) {
    showDocProgress("Loading " + doc.name);
    var theEncryptedDelta = JSON.parse(doc.content).data;
    openpgp.decrypt({ message: openpgp.message.readArmored(theEncryptedDelta),   passwords: [keyToRemember],  format: 'utf8' }).then(function(plaintext) {
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

      $(".activerecentdoc").removeClass('activerecentdoc');
      activeDocID = doc.did;
      activeDocTitle = doc.name;
      currentGeneration = doc.gen;

      $(".offline-doc[did='"+did+"']").addClass("activerecentdoc");
      $(".offline-doc[did='"+did+"']").find(".recenticon").removeClass("is-loading");

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


function updateOfflineDocs(callback, callbackParam) {
  callback = callback || noop;
  var offlineDocsArray = [];

  offlineStorage.iterate(function(doc, did, i) {
    offlineDocsArray.push(doc);
  }).then(function() {
      $("#all-offline").html("");
      offlineDocsArray.sort(gensort);
      offlineDocsArray.forEach(function(doc){
        if (doc.name && !doc.isfile) {
          if ($(".offline-doc[did='"+doc.did+"']").length === 0) {
            $("#all-offline").prepend(renderRecentOrOfflineDoc(doc));
          }
        }
      });
      hideFoldersProgress();
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

    $(".activedoc").removeClass('is-active activedoc');

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
      $(".activerecentdoc").removeClass('activerecentdoc');
      $(".recent-doc[did='"+did+"']").addClass("activerecentdoc");
      $(".offline-doc[did='"+did+"']").addClass("activerecentdoc");
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
//       $(".activerecentdoc").find(".recent-doctitle").html(newDocName);
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
    updateOfflineDocs(function(){

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
            openpgp.decrypt({ message: openpgp.message.readArmored(theStrongKeyEncryptedDelta), passwords: [theKey], format: 'utf8' }).then(function(plaintext) {
              plaintextDocDelta = plaintext.data;
              openpgp.encrypt({ data: plaintextDocDelta, passwords: [keyToRemember], armor: true }).then(function(ciphertext) {
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
  offlineStorage.removeItem(did).then(function() {
    updateOfflineDocs();
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
    if (windowVisible) {
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

    updateOfflineDocs(function(){
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
      if (!isMobile) {
        arrangeTools();
      } else {
        $("#hamburger").fadeIn(100);
      }
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
    openpgp.decrypt({ message: openpgp.message.readArmored(theEncryptedDelta), passwords: [keyToRemember],  format: 'utf8' }).then(function(plaintext) {
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
      console.log(err);
    }
    handleError(err);
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
  openpgp.encrypt({ data: plaintextDocDelta, passwords: [theKey], armor: true }).then(function(ciphertext) {
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
            // Doc already exists on server, no need to plus up the folder count or create folder or anything like that. just save it.
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

                  // this +1s the folder docscount (if it's new it'll just be 1)
                  foldersRef.child(fid + "/count").transaction(function(currentCount) {
                    return currentCount + 1;
                  }).then(function(){

                    // if folder didn't exist on server, until we just created it, this will plus up the folder count.
                    // say if it's the first uncat folder for example or if user deleted folder and was offline etc. idk weird shit happens.

                    if (!folderExists) {

                      // this +1s the folderscount
                      dataRef.child("foldersCount").transaction(function(curFoldersCount) {
                        return curFoldersCount + 1;
                      }).then(function(){

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

                      }).catch(function(err) {
                        handleError(err);
                      });
                    } else {
                      saveDocData();
                    }

                  }).catch(function(err) {
                    handleError(err);
                  });
                });
              });
            }
          });

        } else {
          var genToSyncUp = doc.gen || (new Date()).getTime() * 1000;
          dataRef.update({"homegeneration" : genToSyncUp}, function(){
            catalog.docs[doc.did].tags = dtags;
            catalog.docs[doc.did].gen = genToSyncUp;

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

  var tags = catalog.docs[did].tags || [];
  var fid = fidOfDID(did);
  var dtitle = titleOf(did);
  var fname = titleOf(fid);

  if (did === "home") {
    dtitle = "Home";
    fid = "f-uncat";
    fname = "Inbox";
  }

  ///////////////////////////////////////////////////////////////////////////
  ///////////////////////////////////////////////////////////////////////////

  docRef.getDownloadURL().then(function(docURL) {
    $.ajax({ url: docURL, type: 'GET',
        success: function(encryptedDocDelta){
          var theStrongKeyEncryptedDelta = JSON.parse(encryptedDocDelta).data;
          openpgp.decrypt({ message: openpgp.message.readArmored(theStrongKeyEncryptedDelta), passwords: [theKey], format: 'utf8' }).then(function(plaintext) {
            plaintextDocDelta = plaintext.data;
            openpgp.encrypt({ data: plaintextDocDelta, passwords: [keyToRemember], armor: true }).then(function(ciphertext) {
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
                showErrorBubble("Error saving "+dtitle+" during sync", err);
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
  error = err || "";
  message = message || "Error";

  var now = (new Date()).getTime().toString();
  offlineErrorStorage.setItem(now, error);

  $(".error-bubble-details").html(message + "&nbsp; <span onclick='hideErrorBubble();' class='icon is-small clickable'><i class='fa fa-close fa-fw'></i></span>");
  $("#error-bubble").addClass("errored");
}

function reportOfflineErrors () {
  offlineErrorStorage.iterate(function(syncerr, errtime, i) {
    handleError(syncerr);
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

$("#all-folders").on('click touchend', '.context-make-doc-offline', function(event) {
  var adoc = $(this).parents(".adoc");
  var did = adoc.attr("id");
  var offline = adoc.attr("offline");
  adoc.find(".docs-contextual-dropdown").fadeOut(300, function(){
    if (offline === "true") {
      // remove from offline
      removeOfflineDoc(did);

      adoc.attr("offline", "false");
      adoc.find(".fa-times").css({"color" : "#FFF"});
      adoc.find(".status").html("Make Doc Available Offline");
    } else {
      // add to offline
      makeOfflineDoc(did);

      adoc.attr("offline", "true");
      adoc.find(".fa-times").css({"color" : "#000"});
      adoc.find(".status").html( "Make Doc Online Only");
    }
  });
});

$(".dropdown-makeoffline-button").on('click', function(event) {

  // make active doc offline.
  makeOfflineDoc(activeDocID);
  $(".document-contextual-dropdown").removeClass("open");
});

$(".dropdown-makeonline-button").on('click', function(event) {

  // make active doc online only
  removeOfflineDoc(activeDocID);
  $(".document-contextual-dropdown").removeClass("open");
});




function docMadeAvailableOffline(did) {
  var adoc = $("#"+did);
  var offline = adoc.attr("offline");

  adoc.attr("offline", "true");
  adoc.find(".fa-times").css({"color" : "#000"});
  adoc.find(".status").html( "Make Doc Online Only");

  $(".recent-doc[did='"+did+"']").find(".offline-badge").addClass("visible");
  $("#"+did).find(".offline-badge").addClass("visible");

  if (activeDocID === did) {
    $(".dropdown-makeoffline-button").hide();
    $(".dropdown-makeonline-button").show();
  }
}

function docMadeOnlineOnly(did) {
  var adoc = $("#"+did);
  var offline = adoc.attr("offline");

  adoc.attr("offline", "false");
  adoc.find(".fa-times").css({"color" : "#FFF"});
  adoc.find(".status").html("Make Doc Available Offline");

  $(".recent-doc[did='"+did+"']").find(".offline-badge").removeClass("visible");
  $("#"+did).find(".offline-badge").removeClass("visible");

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
  $('.ql-editor').animate({ scrollTop: targetOffset - 75}, 1000);
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









//
