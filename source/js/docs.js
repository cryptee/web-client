var theKey;
var keyToRemember = JSON.parse(sessionStorage.getItem('key')); // hashedkey
sessionStorage.removeItem('key');

var theUser;
var theUserID;
var theUsername;
var theToken;
var foldersCount;
var dataRef;
var metaRef;
var rootRef;
var foldersRef;
var connectedRef = db.ref(".info/connected");;
var minuteTimer;
var idleTime = 0;
var lastActivityTime = (new Date()).getTime();

var lastSaved = (new Date()).getTime();
var lastScrollTop = 0;
var docChanged;
var currentGeneration;
var toolbarOptions = ['bold', 'italic', 'underline', 'strike'];
var saveUpload;

var idleInterval = setInterval(idleTimer, 1000);
var inactivityInterval = setInterval(inactiveTimer, 1000);

var bootOfflineTimer = setInterval(function() { if(!$("#key-modal").hasClass("is-active")) { showBootOffline(); } }, 5000);

var allowedStorage, usedStorage;
var decryptingFoldersTimeout;
var activeDocTitle;
var activeDocID;

var activeDocAttachments = [];
var docsArray = [];
var foldersArray = [];
var foldersOrderObject = {};
var titlesObject = {};

var activeFileContents;
var activeFileTitle;
var activeFileID;

var isSaving = false;
var settingsOpen = false;
var reauthenticated = false;
var retokening = false;
var initialLoadComplete = false;
var connected = false;
var docIsBeingSorted = false;
var numFilesLeftToBeUploaded = 0;
var numFilesUploaded = 0;
var fileUploadError = false;
var menuBeforeDrag;
var somethingDropped = false;

var isDocOutdated = false;
var menuClosedDueToOffline = false;
var movingDoc = false;
var zenMode = false;
var desktopCutOffWidthPixel = 1092;

var sortableFoldersDesktopPreferences = {
  animation: 300, delay:0,
  handle: ".folder-header",
  chosenClass: "draggingFolder",
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
    $("#all-folders, body, html, .ql-editor, #active-doc-contents").addClass("draggingStuff");
  });

  $('#all-folders').on('touchend', '.folder-clicker-icon', function(event) {
    $(this).parents(".afolder").removeClass("aboutToDragFolder");
    $("#all-folders").removeClass("draggingStuff");
    $("#all-folders, body, html, .ql-editor, #active-doc-contents").removeClass("draggingStuff");
  });
}

var sortableDocsDesktopPreferences = {
  animation: 300, delay:0,
  group : "docs",
  handle: ".adoc",
  chosenClass: "draggingDoc",
  filter : ".activedoc, .docs-float-context",
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
  filter : ".activedoc",
  sort: true,
  onStart: function (evt) {
    docIsBeingSorted = true;
    $("#all-folders, body, html, .ql-editor, #active-doc-contents").addClass("draggingStuff");
		$(".docs-list").addClass("docDrop");
    $('.afolder').addClass("openForDrop");
	},
	onEnd: function (evt) {
    docIsBeingSorted = false;
    $("#all-folders, body, html, .ql-editor, #active-doc-contents").removeClass("draggingStuff");
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
var loadImage = function (file) {
    var reader = new FileReader();
    reader.onload = function(e){
        var img = document.createElement('img');
        img.src = e.target.result;

        var range = window.getSelection().getRangeAt(0);
        range.deleteContents();
        range.insertNode(img);
    };
    reader.readAsDataURL(file);
};
document.onpaste = function(e){
    var items = e.clipboardData.items;

    for (var i = 0; i < items.length; i++) {
        if (IMAGE_MIME_REGEX.test(items[i].type)) {
            loadImage(items[i].getAsFile());
            return;
        }
    }

    // Normal paste handling here
}

!function(t,e){if("object"==typeof exports&&"object"==typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var r=e();for(var n in r)("object"==typeof exports?exports:t)[n]=r[n]}}("undefined"!=typeof self?self:this,function(){return function(t){function e(n){if(r[n])return r[n].exports;var i=r[n]={i:n,l:!1,exports:{}};return t[n].call(i.exports,i,i.exports,e),i.l=!0,i.exports}var r={};return e.m=t,e.c=r,e.d=function(t,r,n){e.o(t,r)||Object.defineProperty(t,r,{configurable:!1,enumerable:!0,get:n})},e.n=function(t){var r=t&&t.__esModule?function(){return t.default}:function(){return t};return e.d(r,"a",r),r},e.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},e.p="",e(e.s=2)}([function(t,e,r){function n(t){return null===t||void 0===t}function i(t){return!(!t||"object"!=typeof t||"number"!=typeof t.length)&&("function"==typeof t.copy&&"function"==typeof t.slice&&!(t.length>0&&"number"!=typeof t[0]))}function o(t,e,r){var o,l;if(n(t)||n(e))return!1;if(t.prototype!==e.prototype)return!1;if(f(t))return!!f(e)&&(t=s.call(t),e=s.call(e),a(t,e,r));if(i(t)){if(!i(e))return!1;if(t.length!==e.length)return!1;for(o=0;o<t.length;o++)if(t[o]!==e[o])return!1;return!0}try{var p=u(t),h=u(e)}catch(t){return!1}if(p.length!=h.length)return!1;for(p.sort(),h.sort(),o=p.length-1;o>=0;o--)if(p[o]!=h[o])return!1;for(o=p.length-1;o>=0;o--)if(l=p[o],!a(t[l],e[l],r))return!1;return typeof t==typeof e}var s=Array.prototype.slice,u=r(5),f=r(6),a=t.exports=function(t,e,r){return r||(r={}),t===e||(t instanceof Date&&e instanceof Date?t.getTime()===e.getTime():!t||!e||"object"!=typeof t&&"object"!=typeof e?r.strict?t===e:t==e:o(t,e,r))}},function(t,e,r){"use strict";var n=Object.prototype.hasOwnProperty,i=Object.prototype.toString,o=function(t){return"function"==typeof Array.isArray?Array.isArray(t):"[object Array]"===i.call(t)},s=function(t){if(!t||"[object Object]"!==i.call(t))return!1;var e=n.call(t,"constructor"),r=t.constructor&&t.constructor.prototype&&n.call(t.constructor.prototype,"isPrototypeOf");if(t.constructor&&!e&&!r)return!1;var o;for(o in t);return void 0===o||n.call(t,o)};t.exports=function t(){var e,r,n,i,u,f,a=arguments[0],l=1,p=arguments.length,h=!1;for("boolean"==typeof a&&(h=a,a=arguments[1]||{},l=2),(null==a||"object"!=typeof a&&"function"!=typeof a)&&(a={});l<p;++l)if(null!=(e=arguments[l]))for(r in e)n=a[r],i=e[r],a!==i&&(h&&i&&(s(i)||(u=o(i)))?(u?(u=!1,f=n&&o(n)?n:[]):f=n&&s(n)?n:{},a[r]=t(h,f,i)):void 0!==i&&(a[r]=i));return a}},function(t,e,r){"use strict";function n(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}Object.defineProperty(e,"__esModule",{value:!0});var i=function(){function t(t,e){var r=[],n=!0,i=!1,o=void 0;try{for(var s,u=t[Symbol.iterator]();!(n=(s=u.next()).done)&&(r.push(s.value),!e||r.length!==e);n=!0);}catch(t){i=!0,o=t}finally{try{!n&&u.return&&u.return()}finally{if(i)throw o}}return r}return function(e,r){if(Array.isArray(e))return e;if(Symbol.iterator in Object(e))return t(e,r);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}(),o=Object.assign||function(t){for(var e=1;e<arguments.length;e++){var r=arguments[e];for(var n in r)Object.prototype.hasOwnProperty.call(r,n)&&(t[n]=r[n])}return t},s=function(){function t(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}return function(e,r,n){return r&&t(e.prototype,r),n&&t(e,n),e}}(),u=r(3),f=function(t){return t&&t.__esModule?t:{default:t}}(u),a={globalRegularExpression:/https?:\/\/[\S]+/g,urlRegularExpression:/(https?:\/\/[\S]+)/},l=function(){function t(e,r){n(this,t),this.quill=e,r=r||{},this.options=o({},a,r),this.registerTypeListener(),this.registerPasteListener()}return s(t,[{key:"registerPasteListener",value:function(){var t=this;this.quill.clipboard.addMatcher(Node.TEXT_NODE,function(e,r){if("string"==typeof e.data){var n=e.data.match(t.options.globalRegularExpression);if(n&&n.length>0){var i=new f.default,o=e.data;n.forEach(function(t){var e=o.split(t),r=e.shift();i.insert(r),i.insert(t,{link:t}),o=e.join(t)}),i.insert(o),r.ops=i.ops}return r}})}},{key:"registerTypeListener",value:function(){var t=this;this.quill.on("text-change",function(e){var r=e.ops;if(!(!r||r.length<1||r.length>2)){var n=r[r.length-1];n.insert&&"string"==typeof n.insert&&n.insert.match(/\s/)&&t.checkTextForUrl()}})}},{key:"checkTextForUrl",value:function(){var t=this.quill.getSelection();if(t){var e=this.quill.getLeaf(t.index),r=i(e,1),n=r[0];if(n.text){var o=n.text.match(this.options.urlRegularExpression);if(o){var s=n.text.length-o.index,u=t.index-s;this.textToUrl(u,o[0])}}}}},{key:"textToUrl",value:function(t,e){var r=(new f.default).retain(t).delete(e.length).insert(e,{link:e});this.quill.updateContents(r)}}]),t}();e.default=l,window.Quill&&window.Quill.register("modules/magicUrl",l)},function(t,e,r){var n=r(4),i=r(0),o=r(1),s=r(7),u=String.fromCharCode(0),f=function(t){Array.isArray(t)?this.ops=t:null!=t&&Array.isArray(t.ops)?this.ops=t.ops:this.ops=[]};f.prototype.insert=function(t,e){var r={};return 0===t.length?this:(r.insert=t,null!=e&&"object"==typeof e&&Object.keys(e).length>0&&(r.attributes=e),this.push(r))},f.prototype.delete=function(t){return t<=0?this:this.push({delete:t})},f.prototype.retain=function(t,e){if(t<=0)return this;var r={retain:t};return null!=e&&"object"==typeof e&&Object.keys(e).length>0&&(r.attributes=e),this.push(r)},f.prototype.push=function(t){var e=this.ops.length,r=this.ops[e-1];if(t=o(!0,{},t),"object"==typeof r){if("number"==typeof t.delete&&"number"==typeof r.delete)return this.ops[e-1]={delete:r.delete+t.delete},this;if("number"==typeof r.delete&&null!=t.insert&&(e-=1,"object"!=typeof(r=this.ops[e-1])))return this.ops.unshift(t),this;if(i(t.attributes,r.attributes)){if("string"==typeof t.insert&&"string"==typeof r.insert)return this.ops[e-1]={insert:r.insert+t.insert},"object"==typeof t.attributes&&(this.ops[e-1].attributes=t.attributes),this;if("number"==typeof t.retain&&"number"==typeof r.retain)return this.ops[e-1]={retain:r.retain+t.retain},"object"==typeof t.attributes&&(this.ops[e-1].attributes=t.attributes),this}}return e===this.ops.length?this.ops.push(t):this.ops.splice(e,0,t),this},f.prototype.chop=function(){var t=this.ops[this.ops.length-1];return t&&t.retain&&!t.attributes&&this.ops.pop(),this},f.prototype.filter=function(t){return this.ops.filter(t)},f.prototype.forEach=function(t){this.ops.forEach(t)},f.prototype.map=function(t){return this.ops.map(t)},f.prototype.partition=function(t){var e=[],r=[];return this.forEach(function(n){(t(n)?e:r).push(n)}),[e,r]},f.prototype.reduce=function(t,e){return this.ops.reduce(t,e)},f.prototype.changeLength=function(){return this.reduce(function(t,e){return e.insert?t+s.length(e):e.delete?t-e.delete:t},0)},f.prototype.length=function(){return this.reduce(function(t,e){return t+s.length(e)},0)},f.prototype.slice=function(t,e){t=t||0,"number"!=typeof e&&(e=1/0);for(var r=[],n=s.iterator(this.ops),i=0;i<e&&n.hasNext();){var o;i<t?o=n.next(t-i):(o=n.next(e-i),r.push(o)),i+=s.length(o)}return new f(r)},f.prototype.compose=function(t){for(var e=s.iterator(this.ops),r=s.iterator(t.ops),n=new f;e.hasNext()||r.hasNext();)if("insert"===r.peekType())n.push(r.next());else if("delete"===e.peekType())n.push(e.next());else{var i=Math.min(e.peekLength(),r.peekLength()),o=e.next(i),u=r.next(i);if("number"==typeof u.retain){var a={};"number"==typeof o.retain?a.retain=i:a.insert=o.insert;var l=s.attributes.compose(o.attributes,u.attributes,"number"==typeof o.retain);l&&(a.attributes=l),n.push(a)}else"number"==typeof u.delete&&"number"==typeof o.retain&&n.push(u)}return n.chop()},f.prototype.concat=function(t){var e=new f(this.ops.slice());return t.ops.length>0&&(e.push(t.ops[0]),e.ops=e.ops.concat(t.ops.slice(1))),e},f.prototype.diff=function(t,e){if(this.ops===t.ops)return new f;var r=[this,t].map(function(e){return e.map(function(r){if(null!=r.insert)return"string"==typeof r.insert?r.insert:u;var n=e===t?"on":"with";throw new Error("diff() called "+n+" non-document")}).join("")}),o=new f,a=n(r[0],r[1],e),l=s.iterator(this.ops),p=s.iterator(t.ops);return a.forEach(function(t){for(var e=t[1].length;e>0;){var r=0;switch(t[0]){case n.INSERT:r=Math.min(p.peekLength(),e),o.push(p.next(r));break;case n.DELETE:r=Math.min(e,l.peekLength()),l.next(r),o.delete(r);break;case n.EQUAL:r=Math.min(l.peekLength(),p.peekLength(),e);var u=l.next(r),f=p.next(r);i(u.insert,f.insert)?o.retain(r,s.attributes.diff(u.attributes,f.attributes)):o.push(f).delete(r)}e-=r}}),o.chop()},f.prototype.eachLine=function(t,e){e=e||"\n";for(var r=s.iterator(this.ops),n=new f,i=0;r.hasNext();){if("insert"!==r.peekType())return;var o=r.peek(),u=s.length(o)-r.peekLength(),a="string"==typeof o.insert?o.insert.indexOf(e,u)-u:-1;if(a<0)n.push(r.next());else if(a>0)n.push(r.next(a));else{if(!1===t(n,r.next(1).attributes||{},i))return;i+=1,n=new f}}n.length()>0&&t(n,{},i)},f.prototype.transform=function(t,e){if(e=!!e,"number"==typeof t)return this.transformPosition(t,e);for(var r=s.iterator(this.ops),n=s.iterator(t.ops),i=new f;r.hasNext()||n.hasNext();)if("insert"!==r.peekType()||!e&&"insert"===n.peekType())if("insert"===n.peekType())i.push(n.next());else{var o=Math.min(r.peekLength(),n.peekLength()),u=r.next(o),a=n.next(o);if(u.delete)continue;a.delete?i.push(a):i.retain(o,s.attributes.transform(u.attributes,a.attributes,e))}else i.retain(s.length(r.next()));return i.chop()},f.prototype.transformPosition=function(t,e){e=!!e;for(var r=s.iterator(this.ops),n=0;r.hasNext()&&n<=t;){var i=r.peekLength(),o=r.peekType();r.next(),"delete"!==o?("insert"===o&&(n<t||!e)&&(t+=i),n+=i):t-=Math.min(i,t-n)}return t},t.exports=f},function(t,e){function r(t,e,r){if(t==e)return t?[[b,t]]:[];(r<0||t.length<r)&&(r=null);var i=s(t,e),o=t.substring(0,i);t=t.substring(i),e=e.substring(i),i=u(t,e);var f=t.substring(t.length-i);t=t.substring(0,t.length-i),e=e.substring(0,e.length-i);var l=n(t,e);return o&&l.unshift([b,o]),f&&l.push([b,f]),a(l),null!=r&&(l=p(l,r)),l=h(l)}function n(t,e){var n;if(!t)return[[y,e]];if(!e)return[[g,t]];var o=t.length>e.length?t:e,s=t.length>e.length?e:t,u=o.indexOf(s);if(-1!=u)return n=[[y,o.substring(0,u)],[b,s],[y,o.substring(u+s.length)]],t.length>e.length&&(n[0][0]=n[2][0]=g),n;if(1==s.length)return[[g,t],[y,e]];var a=f(t,e);if(a){var l=a[0],p=a[1],h=a[2],c=a[3],v=a[4],d=r(l,h),x=r(p,c);return d.concat([[b,v]],x)}return i(t,e)}function i(t,e){for(var r=t.length,n=e.length,i=Math.ceil((r+n)/2),s=i,u=2*i,f=new Array(u),a=new Array(u),l=0;l<u;l++)f[l]=-1,a[l]=-1;f[s+1]=0,a[s+1]=0;for(var p=r-n,h=p%2!=0,c=0,b=0,v=0,d=0,x=0;x<i;x++){for(var m=-x+c;m<=x-b;m+=2){var j,k=s+m;j=m==-x||m!=x&&f[k-1]<f[k+1]?f[k+1]:f[k-1]+1;for(var O=j-m;j<r&&O<n&&t.charAt(j)==e.charAt(O);)j++,O++;if(f[k]=j,j>r)b+=2;else if(O>n)c+=2;else if(h){var w=s+p-m;if(w>=0&&w<u&&-1!=a[w]){var A=r-a[w];if(j>=A)return o(t,e,j,O)}}}for(var E=-x+v;E<=x-d;E+=2){var A,w=s+E;A=E==-x||E!=x&&a[w-1]<a[w+1]?a[w+1]:a[w-1]+1;for(var T=A-E;A<r&&T<n&&t.charAt(r-A-1)==e.charAt(n-T-1);)A++,T++;if(a[w]=A,A>r)d+=2;else if(T>n)v+=2;else if(!h){var k=s+p-E;if(k>=0&&k<u&&-1!=f[k]){var j=f[k],O=s+j-k;if(A=r-A,j>=A)return o(t,e,j,O)}}}}return[[g,t],[y,e]]}function o(t,e,n,i){var o=t.substring(0,n),s=e.substring(0,i),u=t.substring(n),f=e.substring(i),a=r(o,s),l=r(u,f);return a.concat(l)}function s(t,e){if(!t||!e||t.charAt(0)!=e.charAt(0))return 0;for(var r=0,n=Math.min(t.length,e.length),i=n,o=0;r<i;)t.substring(o,i)==e.substring(o,i)?(r=i,o=r):n=i,i=Math.floor((n-r)/2+r);return i}function u(t,e){if(!t||!e||t.charAt(t.length-1)!=e.charAt(e.length-1))return 0;for(var r=0,n=Math.min(t.length,e.length),i=n,o=0;r<i;)t.substring(t.length-i,t.length-o)==e.substring(e.length-i,e.length-o)?(r=i,o=r):n=i,i=Math.floor((n-r)/2+r);return i}function f(t,e){function r(t,e,r){for(var n,i,o,f,a=t.substring(r,r+Math.floor(t.length/4)),l=-1,p="";-1!=(l=e.indexOf(a,l+1));){var h=s(t.substring(r),e.substring(l)),c=u(t.substring(0,r),e.substring(0,l));p.length<c+h&&(p=e.substring(l-c,l)+e.substring(l,l+h),n=t.substring(0,r-c),i=t.substring(r+h),o=e.substring(0,l-c),f=e.substring(l+h))}return 2*p.length>=t.length?[n,i,o,f,p]:null}var n=t.length>e.length?t:e,i=t.length>e.length?e:t;if(n.length<4||2*i.length<n.length)return null;var o,f=r(n,i,Math.ceil(n.length/4)),a=r(n,i,Math.ceil(n.length/2));if(!f&&!a)return null;o=a?f&&f[4].length>a[4].length?f:a:f;var l,p,h,c;return t.length>e.length?(l=o[0],p=o[1],h=o[2],c=o[3]):(h=o[0],c=o[1],l=o[2],p=o[3]),[l,p,h,c,o[4]]}function a(t){t.push([b,""]);for(var e,r=0,n=0,i=0,o="",f="";r<t.length;)switch(t[r][0]){case y:i++,f+=t[r][1],r++;break;case g:n++,o+=t[r][1],r++;break;case b:n+i>1?(0!==n&&0!==i&&(e=s(f,o),0!==e&&(r-n-i>0&&t[r-n-i-1][0]==b?t[r-n-i-1][1]+=f.substring(0,e):(t.splice(0,0,[b,f.substring(0,e)]),r++),f=f.substring(e),o=o.substring(e)),0!==(e=u(f,o))&&(t[r][1]=f.substring(f.length-e)+t[r][1],f=f.substring(0,f.length-e),o=o.substring(0,o.length-e))),0===n?t.splice(r-i,n+i,[y,f]):0===i?t.splice(r-n,n+i,[g,o]):t.splice(r-n-i,n+i,[g,o],[y,f]),r=r-n-i+(n?1:0)+(i?1:0)+1):0!==r&&t[r-1][0]==b?(t[r-1][1]+=t[r][1],t.splice(r,1)):r++,i=0,n=0,o="",f=""}""===t[t.length-1][1]&&t.pop();var l=!1;for(r=1;r<t.length-1;)t[r-1][0]==b&&t[r+1][0]==b&&(t[r][1].substring(t[r][1].length-t[r-1][1].length)==t[r-1][1]?(t[r][1]=t[r-1][1]+t[r][1].substring(0,t[r][1].length-t[r-1][1].length),t[r+1][1]=t[r-1][1]+t[r+1][1],t.splice(r-1,1),l=!0):t[r][1].substring(0,t[r+1][1].length)==t[r+1][1]&&(t[r-1][1]+=t[r+1][1],t[r][1]=t[r][1].substring(t[r+1][1].length)+t[r+1][1],t.splice(r+1,1),l=!0)),r++;l&&a(t)}function l(t,e){if(0===e)return[b,t];for(var r=0,n=0;n<t.length;n++){var i=t[n];if(i[0]===g||i[0]===b){var o=r+i[1].length;if(e===o)return[n+1,t];if(e<o){t=t.slice();var s=e-r,u=[i[0],i[1].slice(0,s)],f=[i[0],i[1].slice(s)];return t.splice(n,1,u,f),[n+1,t]}r=o}}throw new Error("cursor_pos is out of bounds!")}function p(t,e){var r=l(t,e),n=r[1],i=r[0],o=n[i],s=n[i+1];if(null==o)return t;if(o[0]!==b)return t;if(null!=s&&o[1]+s[1]===s[1]+o[1])return n.splice(i,2,s,o),c(n,i,2);if(null!=s&&0===s[1].indexOf(o[1])){n.splice(i,2,[s[0],o[1]],[0,o[1]]);var u=s[1].slice(o[1].length);return u.length>0&&n.splice(i+2,0,[s[0],u]),c(n,i,3)}return t}function h(t){for(var e=!1,r=function(t){return t.charCodeAt(0)>=56320&&t.charCodeAt(0)<=57343},n=2;n<t.length;n+=1)t[n-2][0]===b&&function(t){return t.charCodeAt(t.length-1)>=55296&&t.charCodeAt(t.length-1)<=56319}(t[n-2][1])&&t[n-1][0]===g&&r(t[n-1][1])&&t[n][0]===y&&r(t[n][1])&&(e=!0,t[n-1][1]=t[n-2][1].slice(-1)+t[n-1][1],t[n][1]=t[n-2][1].slice(-1)+t[n][1],t[n-2][1]=t[n-2][1].slice(0,-1));if(!e)return t;for(var i=[],n=0;n<t.length;n+=1)t[n][1].length>0&&i.push(t[n]);return i}function c(t,e,r){for(var n=e+r-1;n>=0&&n>=e-1;n--)if(n+1<t.length){var i=t[n],o=t[n+1];i[0]===o[1]&&t.splice(n,2,[i[0],i[1]+o[1]])}return t}var g=-1,y=1,b=0,v=r;v.INSERT=y,v.DELETE=g,v.EQUAL=b,t.exports=v},function(t,e){function r(t){var e=[];for(var r in t)e.push(r);return e}e=t.exports="function"==typeof Object.keys?Object.keys:r,e.shim=r},function(t,e){function r(t){return"[object Arguments]"==Object.prototype.toString.call(t)}function n(t){return t&&"object"==typeof t&&"number"==typeof t.length&&Object.prototype.hasOwnProperty.call(t,"callee")&&!Object.prototype.propertyIsEnumerable.call(t,"callee")||!1}var i="[object Arguments]"==function(){return Object.prototype.toString.call(arguments)}();e=t.exports=i?r:n,e.supported=r,e.unsupported=n},function(t,e,r){function n(t){this.ops=t,this.index=0,this.offset=0}var i=r(0),o=r(1),s={attributes:{compose:function(t,e,r){"object"!=typeof t&&(t={}),"object"!=typeof e&&(e={});var n=o(!0,{},e);r||(n=Object.keys(n).reduce(function(t,e){return null!=n[e]&&(t[e]=n[e]),t},{}));for(var i in t)void 0!==t[i]&&void 0===e[i]&&(n[i]=t[i]);return Object.keys(n).length>0?n:void 0},diff:function(t,e){"object"!=typeof t&&(t={}),"object"!=typeof e&&(e={});var r=Object.keys(t).concat(Object.keys(e)).reduce(function(r,n){return i(t[n],e[n])||(r[n]=void 0===e[n]?null:e[n]),r},{});return Object.keys(r).length>0?r:void 0},transform:function(t,e,r){if("object"!=typeof t)return e;if("object"==typeof e){if(!r)return e;var n=Object.keys(e).reduce(function(r,n){return void 0===t[n]&&(r[n]=e[n]),r},{});return Object.keys(n).length>0?n:void 0}}},iterator:function(t){return new n(t)},length:function(t){return"number"==typeof t.delete?t.delete:"number"==typeof t.retain?t.retain:"string"==typeof t.insert?t.insert.length:1}};n.prototype.hasNext=function(){return this.peekLength()<1/0},n.prototype.next=function(t){t||(t=1/0);var e=this.ops[this.index];if(e){var r=this.offset,n=s.length(e);if(t>=n-r?(t=n-r,this.index+=1,this.offset=0):this.offset+=t,"number"==typeof e.delete)return{delete:t};var i={};return e.attributes&&(i.attributes=e.attributes),"number"==typeof e.retain?i.retain=t:"string"==typeof e.insert?i.insert=e.insert.substr(r,t):i.insert=e.insert,i}return{retain:1/0}},n.prototype.peek=function(){return this.ops[this.index]},n.prototype.peekLength=function(){return this.ops[this.index]?s.length(this.ops[this.index])-this.offset:1/0},n.prototype.peekType=function(){return this.ops[this.index]?"number"==typeof this.ops[this.index].delete?"delete":"number"==typeof this.ops[this.index].retain?"retain":"insert":"retain"},t.exports=s}])});

var URLRegex = new RegExp(
  "^" +
    // protocol identifier
    "(?:(?:https?|ftp)://)" +
    // user:pass authentication
    "(?:\\S+(?::\\S*)?@)?" +
    "(?:" +
      // IP address exclusion
      // private & local networks
      "(?!(?:10|127)(?:\\.\\d{1,3}){3})" +
      "(?!(?:169\\.254|192\\.168)(?:\\.\\d{1,3}){2})" +
      "(?!172\\.(?:1[6-9]|2\\d|3[0-1])(?:\\.\\d{1,3}){2})" +
      // IP address dotted notation octets
      // excludes loopback network 0.0.0.0
      // excludes reserved space >= 224.0.0.0
      // excludes network & broacast addresses
      // (first & last IP address of each class)
      "(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])" +
      "(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}" +
      "(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))" +
    "|" +
      // host name
      "(?:(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)" +
      // domain name
      "(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*" +
      // TLD identifier
      "(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))" +
      // TLD may end with dot
      "\\.?" +
    ")" +
    // port number
    "(?::\\d{2,5})?" +
    // resource path
    "(?:[/?#]\\S*)?" +
  "$", "i"
);

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

  var quill = new Quill('#active-doc-contents', {
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
    bounds : "#active-doc-contents"
  });

} else {

  var toolbarOptions = {
    handlers: quillhandlers,
    container: '#toolbar-container'
  };

  var quill = new Quill('#active-doc-contents', {
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
    callback(tagsArray);
    tribute.hideMenu();
  } else {
    var docTagsArray = [];
    var tagsArray = [];
    $.each(docsArray, function(i, doc) {
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

$("#active-doc-contents").on('touchstart', 'ul[data-checked="false"] > li, ul[data-checked="true"] > li', function(event) {
  event.stopPropagation();
  event.preventDefault();
});

$("#active-doc-contents").on('touchstart', 'ul[data-checked="false"] > li, ul[data-checked="true"] > li', function(event) {
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

key('command+shift+o, ctrl+shift+o', function(){ if (ww() <= desktopCutOffWidthPixel) {  quill.blur(); showMenu(); } $("#search-input").focus(); return false; });
key('command+\\, ctrl+\\', function(){ if (ww() <= desktopCutOffWidthPixel) { $("#hamburger").click(); } return false; });
key('command+], ctrl+]', function(){ quill.format('indent', '+1'); return false; });
key('command+[, ctrl+[', function(){ quill.format('indent', '-1'); return false; });
key('command+s, ctrl+s', function(){ saveDoc(); return false; });
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
  clearSelections();
});

//////// MENU SWIPE FOR MOBILE //////////

$("body").on('swipeleft',  function(){
    if (connected === true && isMobile) {
      // HIDE
      hideMenu();
    }
});

$("body").on('swiperight',  function(){
    if (connected === true && isMobile) {
      // SHOW
      quill.blur();
      showMenu();
    }
});

//////// DROPDOWNS //////////

$("#all-folders").on('click', '.dropdown-buttons', function(event) {
  var theDropdown = $(this).parents(".afolder").find(".folder-dropdown");
  if (!theDropdown.hasClass("dropdown-open")){
    theDropdown.fadeIn(100).addClass('dropdown-open');
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

    var leftStuffContainer = $("#left-stuff");
    var hamburgerButton = $("#hamburger");
    if ((!leftStuffContainer.is(e.target) && leftStuffContainer.has(e.target).length === 0) && !hamburgerButton.is(e.target) && hamburgerButton.has(e.target).length === 0) {
      if(ww() <= desktopCutOffWidthPixel) {
        hideMenu();
      }
    }

    var contextualButtons = $(".document-contextual-button");
    var dcb = $("#doc-contextual-button");
    if (!contextualButtons.is(e.target) && contextualButtons.has(e.target).length === 0 && !dcb.is(e.target) && dcb.has(e.target).length === 0) {
      $(".document-contextual-button").addClass("docContextOff");
      $(".filesize-button, .mobile-floating-tools").removeClass('menuOpen');
    }

});

function closeDropdownAfterSubButtonPress(buttonPressed) {
  var theDropdown = $(this).parents(".afolder").find(".folder-dropdown");
  theDropdown.fadeOut(100).removeClass('dropdown-open');
}

$("#all-folders").on('click', '.adoc-float-context', function(event) {
  $(this).parents(".adoc").find(".adoc-float-delete, .adoc-float-rename").toggleClass("visible");
});

$("#all-folders").on('mouseleave', '.adoc', function(event) {
  $(this).find(".adoc-float-delete, .adoc-float-rename").removeClass("visible");
});







///////  RESIZE & WINDOW MANAGEMENT & TOOLS ARRANGEMENT ///////

var thingsNeedResizing = "#toolbar-container, #doc-contextual-buttons, #doc-contextual-button, #active-doc-contents, #file-viewer, #all-folders, #left-stuff, #upload-progress, .filesize-button, .save-doc-button, #doc-top, #hamburger, .docs-float-context, .mobile-floating-tools";
function ww() { return $(window).width(); }

function arrangeTools() {
  if (!isMobile) {
    //DESKTOP
    if (ww() <= desktopCutOffWidthPixel) {
      hideMenu();
      $("#hamburger").fadeIn(100);
    } else if (ww() > desktopCutOffWidthPixel){
      $(thingsNeedResizing).removeClass("menuOpen");
      $("#left-stuff").removeClass('leftStuffOff');
      $("#doc-top, #active-doc-contents, #file-viewer").addClass("menuOpen");
      $("#hamburger").fadeOut(100);
    }

  }
}

$(".ql-editor").on('scroll', throttleScroll(function(event) {
  lastActivityTime = (new Date()).getTime();
}, 100));

$(window).resize(function(event) {
  arrangeTools();
});

$(window).on("load", function(event) {
  if (isMobile) {
    $("#mobile-toolbar, .mobile-floating-tools").removeClass("hidden");
    $(thingsNeedResizing).addClass("itsMobile");
    $(".menu-hamburger").show();
    $("#doc-contextual-button").addClass("unavailable");
  } else {
    $(".filesize-button").addClass("desktop");
    if (isSafari) {
      $(thingsNeedResizing).addClass("itsSafari");
    }
  }

  if ($(window).width() > 768) {
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
  if (!initialLoadComplete) {
    setTimeout(function () {
      $("#doc-contextual-buttons").show();
      if (!isMobile) {
        arrangeTools();
      } else {
        $("#hamburger").fadeIn(100);
      }
    }, 1000);
    initialLoadComplete = true;
  }
}

function showMenu () {
  $(thingsNeedResizing).addClass("menuOpen");
  $("#left-stuff").removeClass('leftStuffOff');
}

function hideMenu () {
  if (ww() <= desktopCutOffWidthPixel || isMobile) {
    $("#left-stuff").addClass('leftStuffOff');
    $(thingsNeedResizing).removeClass("menuOpen");
  }
}

function toggleZenMode() {
  if (zenMode) {
    hideZenMode();
  } else {
    showZenMode();
  }
}

function showZenMode() {
  // ☯

  zenMode = true;
  setTimeout(function () {
    $("#left-stuff").addClass('leftStuffOff');
    $(thingsNeedResizing).removeClass("menuOpen");
    $("#active-doc-contents, #doc-contextual-buttons, #doc-top").addClass("zenMode");
  }, 500);
}


if (document.addEventListener) {
  document.addEventListener('webkitfullscreenchange', fullScreenExitHandler, false);
  document.addEventListener('mozfullscreenchange', fullScreenExitHandler, false);
  document.addEventListener('fullscreenchange', fullScreenExitHandler, false);
  document.addEventListener('MSFullscreenChange', fullScreenExitHandler, false);
}

function fullScreenExitHandler() {
  // if (document.webkitIsFullScreen || document.mozFullScreen || document.msFullscreenElement !== null) {
  //
  // } else {
  //
  // }
  toggleZenMode();
}


function hideZenMode() {

  zenMode = false;
  setTimeout(function () {
    $("#active-doc-contents, #doc-contextual-buttons, #doc-top").removeClass("zenMode");
    $(thingsNeedResizing).addClass("menuOpen");
    $("#left-stuff").removeClass('leftStuffOff');
    arrangeTools();
  }, 500);
}

function toggleHotkeys() {
  $("#hotkeys-modal").toggleClass("is-visible");
}

$("#hamburger").on('click', function(event) {
  if ($("#left-stuff").hasClass("menuOpen")){
    hideMenu();
  } else {
    quill.blur();
    showMenu();
  }
});



function activeFileFolder() {
  var currentFolder;
  $.each(docsArray, function(i,doc){
    if (doc.did === activeDocID) { currentFolder = doc.fid; }
  });
  return currentFolder;
}


////////////////////////////////////////////////////
///////////////// PROGRESS DIMMER   ////////////////
////////////////////////////////////////////////////


function showFoldersProgress(status){
  $(".folders-status").html(status);
  $("#all-folders").stop(true, true).fadeOut(100, function(){
    $(".folders-status").stop(true, true).fadeIn(100);
  });
}

function hideFoldersProgress(){
  setTimeout(function () {
    $(".folders-status").stop(true, true).fadeOut(100, function(){
      $("#all-folders").stop(true, true).fadeIn(100);
    });
  }, 250);
}

function showDocProgress (status){
  $("#fileLoadingStatus").html(status);
  $("#active-doc-contents").addClass("doc-loading");
  $("#upload-progress, .progressButtons, .document-contextual-button, .filesize-button, .mobile-floating-tools, #doc-contextual-buttons").stop(true, true).fadeOut(100, function() {
    $("#toolbar-container").stop(true, true).fadeOut(100, function() {
      $(".loading-message").stop(true, true).fadeIn(100);
    });
  });
}

function hideDocProgress (callback){
  callback = callback || noop;
  setTimeout(function () {
    $("#active-doc-contents").removeClass("doc-loading");
    $(".loading-message").stop(true, true).fadeOut(100, function() {
      $("#toolbar-container").stop(true, true).fadeIn(100, function() {
        $("#upload-progress, .progressButtons, .document-contextual-button, .filesize-button, .mobile-floating-tools, #doc-contextual-buttons").stop(true, true).fadeIn(100, function(){
          callback();
        });
      });
    });
  }, 350);
}

////////////////////////////////////////////////////
///////////////// DOC CONTEXTUAL MENU   ////////////
////////////////////////////////////////////////////

function toggleContextualMenu () {
  if (activeDocID !== "home") {
    $(".document-contextual-button").toggleClass("docContextOff");
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
      dataRef = db.ref().child('/users/' + theUserID + "/data/");
      metaRef = db.ref().child('/users/' + theUserID + "/meta/");
      homeGenerationRef = db.ref().child('/users/' + theUserID + "/data/homegeneration");
      foldersRef = db.ref().child('/users/' + theUserID + "/data/folders/");
      rootRef = store.ref().child('/users/' + theUserID);
      Raven.setUserContext({ id: theUserID });

      $('.username').html(theUsername);

      checkForExistingUser(function(){
        if (getUrlParameter("dlddid")) {
          $("#key-status").html("Enter your encryption key to start the download");
        }
        if (keyToRemember) {
          checkKey();
        } else {
          showKeyModal();
        }
      });
    }

    getToken();
    webAppURLController();
  } else {
    // no user. redirect to sign in IF NOT WEBAPP
    var downloadDID = getUrlParameter("dlddid");
    if (downloadDID) {
      webAppURLController("signin.html?redirect=docs&dlddid="+downloadDID);
    } else {
      webAppURLController("signin.html?redirect=docs");
    }
  }
}, function(error){
  if (error.code !== "auth/network-request-failed") {
    handleError(error);
  }
});

function checkForExistingUser (callback){
  callback = callback || noop;

  db.ref('/users/' + theUserID + "/data/keycheck").once('value').then(function(snapshot) {
    if (snapshot.val() === null) {
      window.location = "signup.html?status=newuser";
    } else {
      callback();
    }
  });

}

function signInComplete () {
  var downloadDID = getUrlParameter("dlddid");
  if (downloadDID) {
    dataRef.child("titles").on('value', function(snapshot) {
      var encryptedTitlesObject = snapshot.val();
      if (encryptedTitlesObject) {
        if (encryptedTitlesObject !== null && encryptedTitlesObject !== undefined) {
          var encTitObj = JSON.parse(encryptedTitlesObject).data;
          openpgp.decrypt({ message: openpgp.message.readArmored(encTitObj), passwords: [theKey], format: 'utf8' }).then(function(plaintext) {
            titlesObject = JSON.parse(plaintext.data);
            var dldTitle = JSON.parse(titlesObject.docs[downloadDID]);
            downloadFile(downloadDID, dldTitle, false, function(){
              history.pushState("", null, '/docs');
            });
          });
        }
      }
    });
  } else {
    decryptingFoldersTimeout = setTimeout(function(){
      if (connected) {
        console.log("attempting to fix files and folders");
        fixFilesAndFolders();
      }
    }, 10000);
    showDocProgress("Decrypting Folders and Documents");
    showFoldersProgress("Decrypting Folders");

    connectedRef.on("value", function(snap) {
      connectionStatus(snap.val(), false);
    });

    foldersRef.on('child_added', function(folder) {
      appendFolder(folder.val());
    });

    foldersRef.on('child_removed', function(folder) {
      removeFolder(folder.val().folderid);

      //remove folder from array.
      var index = foldersArray.indexOf(folder.val().title);
      if (index > -1) { foldersArray.splice(index, 1); }

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
            $("#upgrade-button").parents("li").hide();
            $("#low-storage-warning").removeClass('showLowStorage viaUpgradeButton');
            closeExceededStorageModal();
          if (usedStorage >= allowedStorage){
            showBumpUpThePlan(true);
          } else if ((usedStorage >= allowedStorage * 0.8) && !huaLowStorage){
            showBumpUpThePlan(false);
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
            $("#upgrade-button").parents("li").hide();
          }
        }

        saveUserDetailsToLS(theUsername, usedStorage, allowedStorage);
      }
    });

    dataRef.child("foldersCount").on('value', function(snapshot) {
      foldersCount = snapshot.val();
      amITheLastFolder();
    });

    dataRef.child("orderComplete").on('value', function(snapshot) {
      orderCompleteBool = snapshot.val();
      if (orderCompleteBool) {
        orderComplete();
        dataRef.update({"orderComplete" : ""});
      }
    });
  }
}

function amITheLastFolder(){
  if (typeof foldersCount !== 'undefined') {
    if ($(".afolder").length === parseInt(foldersCount)){
      clearTimeout(decryptingFoldersTimeout);
      var sortableFolders;
      if (!isMobile) {
        sortableFolders = Sortable.create(document.getElementById('all-folders'), sortableFoldersDesktopPreferences);
      } else {
        sortableFolders = Sortable.create(document.getElementById('all-folders'), sortableFoldersMobilePreferences);
      }

      getTitles();
      getTags();

      sortFolders();
      hideFoldersProgress();

      if (parseInt(foldersCount) === 0) {
        $("#first-folder-hint").fadeIn();
      }
    }
  }
}

function loadLastOpenDoc () {
  dataRef.child("lastOpenDocID").once('value', function(snapshot) {
    var lastOpenDocID = snapshot.val();
    if (activeDocID) {
      if (activeDocID !== lastOpenDocID) {
        loadDoc(lastOpenDocID, firstLoadComplete);
      }
    } else {
      loadDoc(lastOpenDocID, firstLoadComplete);
    }
  });
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
    }).appendTo('#all-folders');

  });
}

function checkKey (key){
  if (!$("#key-modal").hasClass("is-active")){
    if (connected) {
      showDocProgress("Checking Key");
    }
  }

  db.ref('/users/' + theUserID + "/data/keycheck").once('value').then(function(snapshot) {
    var encryptedStrongKey = JSON.parse(snapshot.val()).data; // or encrypted checkstring for legacy accounts

    var hashedKey;
    if (key) {
      hashedKey = hashString(key);
    } else {
      hashedKey = keyToRemember;
    }

    openpgp.decrypt({ message: openpgp.message.readArmored(encryptedStrongKey), passwords: [hashedKey],  format: 'utf8' }).then(function(plaintext) {
        rightKey(plaintext, hashedKey);
    }).catch(function(error) {
        checkLegacyKey(dataRef, key, hashedKey, encryptedStrongKey, function(plaintext){
          rightKey(plaintext, hashedKey);
          // if it's wrong, wrongKey() will be called in checkLegacyKey in main.js
        });
    });
  });
}

function rightKey (plaintext, hashedKey) {
  var theStrongKey = plaintext.data;
  $("#left-stuff").css({"opacity" : 1 });
  hideKeyModal();
  theKey = theStrongKey;
  keyToRemember = hashedKey;
  signInComplete();
}

function wrongKey (error) {
  console.log("wrong key or ", error);
  sessionStorage.removeItem('key');
  $("#left-stuff").css({"opacity" : 1 });
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

function fixFilesAndFolders () {
  showDocProgress("This is taking too long...<br>One second. Going to ask the chef to see what's going on...");
  fixFolders();
}

function fixFolders () {
  foldersRef.once('value', function(snapshot) {
    var allFolders = snapshot.val();
    if (allFolders) {
      var allFoldersCount = Object.keys(allFolders).length;
      var foldersCountOnServer;
      dataRef.child("foldersCount").on('value', function(snapshot) {
        foldersCountOnServer = snapshot.val();
        if (foldersCountOnServer !== allFoldersCount) {
          dataRef.update({"foldersCount" : allFoldersCount});
          // folders should be fixed. Or there's not much we can do since the folder completely disappeared anyway
          // TODO FIX FILES, BY CHECKING IF THEY EXIST IN THE FIRST PLACE. USE
          // storageRef.child("file.png").getDownloadURL().then(onResolve, onReject);
          // TO SEE IF THEY EXIST ONE BY ONE IF YOU HAVE TO.
          fixFiles();
        } else {
          fixFiles();
        }
      });
    } else {
      fixFiles();
    }
  });
}

function fixFiles() {
  dataRef.update({"lastOpenDocID" : "home"},function(){
    loadDoc("home", firstLoadComplete);
  });
}
////////////////////////////////////////////////////////
/////////////////// CONNECTION STATUS  /////////////////
////////////////////////////////////////////////////////

document.addEventListener('visibilityChange', handleVisibilityChange, false);

function handleVisibilityChange() {
  if (document[hidden]) {
    // hidden
  } else {
    // shown
    forceCheckConnection();
  }
}

$(window).on("focus", function () {
  forceCheckConnection();
});

function forceCheckConnection(){
  connectedRef.once("value", function(snap) {
    connectionStatus(snap.val(), true);
  });
}

function connectionStatus(status, forced) {
  connected = status; // boolean, true if connected
  if (status === true) {
    clearInterval(bootOfflineTimer);
    hideBootOffline();
    $(".offlineHidden").fadeIn('250', function(){
      if (ww() > desktopCutOffWidthPixel) { $("#hamburger").hide(); }
      $("#upload-progress, .progressButtons").removeClass('is-danger is-warning').addClass('is-success');
      $(".filesize-button > .button").removeClass("is-danger");
      $("#filesize").css("color", "#888");
      var filesizeWas = $("#filesize").attr("size");
      $("#filesize").html(filesizeWas);

      if (menuClosedDueToOffline) {
        if (!isMobile) {
          $(thingsNeedResizing).addClass("menuOpen");
          $("#left-stuff").removeClass('leftStuffOff');
          arrangeTools();
        }
        menuClosedDueToOffline = false;
      }

      //if there's an open doc, (and not just on startup) save it when back online
      // considered putting this in if(!isSaving). However, if user pressed save before going offline, but save isn't complete,
      // isSaving would be true, and changes made during offline won't be saved when came back online.
      if (activeDocID !== undefined && docChanged && !isDocOutdated && !forced) {
        saveDoc();
      }
    });

  } else {
    //to prevent multiple calls while already offline
    $(".offlineHidden").fadeOut('250', function() {
        $("#upload-progress, .progressButtons").removeClass('is-success is-warning').addClass('is-danger');
        $(".filesize-button > .button").addClass("is-danger");
        $("#filesize").html("Offline").css("color", "#fff");

        if (!isMobile) {
          $("#left-stuff").addClass('leftStuffOff');
          $(thingsNeedResizing).removeClass("menuOpen");
        } else {
          hideMenu();
        }
        menuClosedDueToOffline = true;
    });
    if (!theKey || theKey === undefined || theKey === null || theKey === "") {
      showBootOffline();
    }
  }
}

function showBootOffline () {
  $("#bootOffline").css("opacity", 1);
}

function hideBootOffline () {
  $("#bootOffline").css("opacity", 0);
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

  $("#" + changedDoc.docid).find(".doctitle").html(changedDoc.title);
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
  saveDoc();
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

function getTitles () {
  dataRef.child("titles").on('value', function(snapshot) {
    var encryptedTitlesObject = snapshot.val();
    if (encryptedTitlesObject) {
      if (encryptedTitlesObject !== null && encryptedTitlesObject !== undefined) {
        if (!initialLoadComplete) {
          gotTitles(encryptedTitlesObject, loadLastOpenDoc);
        } else {
          gotTitles(encryptedTitlesObject);
        }

      } else {
        encryptTitles();
      }
    } else {
      encryptTitles();
    }
  });
}

function encryptTitles() {

  var ftitles = {};

  $(".afolder").each(function(index, el) {
    var folderTitle = $(this).find(".folder-title").text().trim();
    var folderID = $(this).attr("id");
    ftitles[folderID] = JSON.stringify(folderTitle);
  });

  var dtitles = {};
  $(".adoc").each(function(index, el) {
    var docTitle = $(this).find(".doctitle").text().trim();
    var docID = $(this).attr("id");
    dtitles[docID] = JSON.stringify(docTitle);
  });

  titlesObject.folders = ftitles;
  titlesObject.docs = dtitles;

  updateTitles();

}

function updateTitles (callback, callbackParam) {
  callback = callback || noop;
  var plaintextTitles = JSON.stringify(titlesObject);

  openpgp.encrypt({ data: plaintextTitles, passwords: [theKey], armor: true }).then(function(ciphertext) {
    var encryptedTitlesObject = JSON.stringify(ciphertext);

    dataRef.update({"titles" : encryptedTitlesObject},function(){
      callback(callbackParam);
    });

  });
}

function gotTitles (JSONifiedEncryptedTitlesObject, callback) {
  callback = callback || noop;
  var encryptedTitlesObject = JSON.parse(JSONifiedEncryptedTitlesObject).data;
  openpgp.decrypt({ message: openpgp.message.readArmored(encryptedTitlesObject), passwords: [theKey], format: 'utf8' }).then(function(plaintext) {
    titlesObject = JSON.parse(plaintext.data);
    processTitles(callback);
  });
}

function processTitles (callback) {
  callback = callback || noop;
  foldersArray = [];
  $.each(titlesObject.folders, function(fid, ftitle) {
    $("#" + fid).find(".folder-title").html(JSON.parse(ftitle));
    foldersArray.push(ftitle);

    if ( $("#" + fid).length <= 0 ) {
      delete titlesObject.folders[fid];
    }
  });

  $.each(titlesObject.docs, function(did, dtitle) {

    if ( $("#" + did).length <= 0 ) {
      delete titlesObject.docs[did];
    }

    var theParsedTitle = "";
    try { theParsedTitle = JSON.parse(dtitle); } catch (e) {}
    $("#" + did).find(".doctitle").html(theParsedTitle);
    if (did === activeDocID) { document.title = theParsedTitle; }
    if (did === activeFileID) { $("#file-viewer-title").html(theParsedTitle); }

    $.each(docsArray, function(index, docObject) {
      if (docObject.did === did && theParsedTitle !== "") {
        docsArray[index].name = theParsedTitle;
        docsArray[index].fname = $("#" + did).parents(".afolder").find(".folder-title").text();
        docsArray[index].ftype = filetypeFromFilename(theParsedTitle);

        var diconClass = iconFromFilename(theParsedTitle);
        docsArray[index].icon = diconClass;
        $("#"+did).find(".exticon").find("i").addClass(diconClass);

        var extension = theParsedTitle.slice((theParsedTitle.lastIndexOf(".") - 1 >>> 0) + 2);
        var dext = (extension || "crypteedoc");
        $("#" + did).attr("ext", dext);
      }
    });
  });

  callback();
}

function processGhostTitles(ghostTitlesObject) {
  titlesObject.folders[ghostTitlesObject.fid] = ghostTitlesObject.fname;
  $.each(ghostTitlesObject.docs, function(ghostedDID, dname) {
    titlesObject.docs[ghostedDID] = dname;
  });
  processTitles();
  updateTitles();
  updateFolderIndexes();
  foldersRef.child(ghostTitlesObject.fid).update({"ghosttitles" : null, "title" : null});
}










////////////////////////////////////////////////////
////////////////// FOLDER ACTIONS ////////////////
////////////////////////////////////////////////////

/////////////////////
// APPEND FOLDER //
/////////////////////

function appendFolder (folder){

  var fid = folder.folderid;
  // TODO IF YOU GET AN ERROR FOR TITLE NOT FOUND / OTHER SHIT NOT FOUND ETC. THERE ARE SOME FOLDERS IN FIREBASE THAT ONLY HAVE OPEN/CLOSE PROPERTIES.
  // IT COULD BE BECAUSE THE STATUS OF AN OPEN FOLDER IS BEING SAVED AFTER ITS DELETION. THEY DON'T SEEM TO COUNT TOWARDS THE FOLDERSCOUNT EITHER.
  // CHANCES ARE CLIENT WRITES OPEN/CLOSE STATUS AFTER CLOSURE. OR THERE'S A FOOT RACE. COULD BE FIXED AFTER ADDING DROPDOWNS INSTEAD OF DELETE BUTTONS (WHICH FALSELY TRIGGERED OPEN / CLOSE OCCASIONALLY)


  var fcount = folder.count;
  var fopen = folder.open;
  var fcolor = folder.color;
  var openClass = "-open";
  var colorClass = " ";
  var hiddenClass = "hidden";
  var uploadButton = '';
  if (isAPIAvailable()) {
    uploadButton =
    '<input class="folder-upload-input" type="file" id="upload-to-'+fid+'" name="files[]" multiple />' +
    '<label class="upload-to-folder-button clickable" for="upload-to-'+fid+'"><span class="icon"><i class="fa fa-cloud-upload"></i></span> Upload a File to Folder</label>';
  }

  if (fopen) { openClass = "-open"; hiddenClass = "";} else { openClass = ""; hiddenClass = "hidden";}
  if (fcolor) { colorClass = fcolor; }

  var folderCard =  '<div class="afolder card folder" id="'+fid+'" color=" '+colorClass+'" count="'+fcount+'">'+
                      '<header class="card-header folder-header">'+
                        '<a class="card-header-icon card-folder-icon folder-clicker-icon"><span class="icon"><i style="color:'+colorClass+';" class="folder-icon fa fa-folder'+openClass+'"></i></span></a>'+
                        '<p class="card-header-title folder-title"></p>'+
                        '<a title="Folder Actions" class="card-header-icon dropdown-buttons"><span class="icon"><i class="fa fa-ellipsis-v"></i></span></a>'+
                      '</header>'+
                      '<div class="notification dropdowns folder-dropdown">'+
                        uploadButton +
                        '<p class="rename-folder-button clickable"><span class="icon"><i class="fa fa-i-cursor"></i></span> Rename Folder</p>'+
                        '<p class="make-ghost-folder-button clickable"><span class="icon"><i class="fa fa-eye-slash"></i></span> Make Ghost Folder</p>'+
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
                        '<p class="delete-folder-button clickable"><span class="icon"><i class="fa fa-trash-o"></i></span> Delete Folder</p>'+
                        '<span class="delete-folder-buttons sub-dropdown"><a class="button is-success delete-folder-confirm">Yes Delete</a> <a class="button is-danger delete-folder-cancel">No Wait</a></span>'+
                      '</div>'+
                      '<div class="card-content folderClosable '+ hiddenClass +'">'+
                        '<aside class="menu">'+
                          '<ul class="menu-list">'+
                            '<li class="newDocInput"><div class="field has-addons"><p class="control new-document-icon"><label><span class="icon"><i class="fa fa-plus"></i></span></label></p><p class="control new-doc-input-control"><input class="new-doc-input input" type="text" placeholder="Create New Document"></p><p title="Upload File" class="control folder-upload-icon"><label class="upload-to-folder-button" for="upload-to-'+fid+'"><span class="icon clickable"><i class="fa fa-cloud-upload"></i></span></label></p></div></li>'+
                          '</ul>'+
                          '<ul class="menu-list docs-list" id="docs-of-'+fid+'">'+

                          '</ul>'+
                        '</aside>'+
                      '</div>'+
                    '</div>';

  if ( $( "#" + fid ).length ) {
    //folder exists.
  } else {
    $("#all-folders").prepend(folderCard);
    document.getElementById(fid).addEventListener('drop', handleFileDrop, false);
    document.getElementById('upload-to-'+fid).addEventListener('change', handleFileSelect, false);

    foldersRef.child(folder.folderid + "/docs").on('child_added', function(doc) {
      appendDoc(doc.val().fid, doc.val().docid, doc.val(), doc.val().isfile);
    });

    foldersRef.child(folder.folderid + "/docs").on('child_removed', function(doc) {
      deleteDocComplete(doc.val().fid, doc.val().docid);
    });

    foldersRef.child(folder.folderid + "/docs").on('child_changed', function(doc) {
      checkDocGeneration(doc.val());
    });

    if (!folder.ghosttitles) {
      amITheLastFolder();
    } else {
      if (folder.ghosttitles !== null || folder.ghosttitles !== "" || folder.ghosttitles !== " ") {
        var encryptedGhostTitlesObject = JSON.parse(folder.ghosttitles).data;
        openpgp.decrypt({ message: openpgp.message.readArmored(encryptedGhostTitlesObject), passwords: [theKey], format: 'utf8' }).then(function(plaintext) {
          var ghostTitlesObject = JSON.parse(plaintext.data);
          processGhostTitles(ghostTitlesObject);
        });
      }
    }

    $("#" + fid).fadeIn(250, function(){

    });

  }
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
  icon = "fa fa-fw fa-file-text-o";
  var extension = filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);

  if (extension.match(/^(006|007|3DMF|3DX|8PBS|ABM|ABR|ADI|AEX|AI|AIS|ALBM|AMU|ARD|ART|ARW|ASAT|B16|BIL|BLEND|BLKRT|BLZ|BMC|BMC|BMP|BOB|BR4|BR5|C4|CADRG|CATPART|CCX|CDR|CDT|CDX|CGM|CHT|CM2|CMX|CMZ|COMICDOC|CPL|CPS|CPT|CR2|CSF|CV5|CVG|CVI|CVI|CVX|DAE|DCIM|DCM|DCR|DCS|DDS|DESIGN|DIB|DJV|DJVU|DNG|DRG|DRW|DRWDOT|DT2|DVL|DWB|DWF|DXB|EASM|EC3|EDP|EDRW|EDW|EMF|EPRT|EPS|EPSF|EPSI|EXR|FAC|FACE|FBM|FBX|FC2|FCZ|FD2|FH11|FHD|FIT|FLIC|FLM|FM|FPF|FS|FXG|GIF|GRAFFLE|GTX|HD2|HDZ|HPD|HPI|HR2|HTZ4|ICL|ICS|IDW|IEF|IGES|IGR|ILBM|ILM|IMA|IME|IMI|IMS|INDD|INDT|IPJ|IRF|ITC2|ITHMB|J2K|JIFF|JNG|JPEG|JPF|JPG|JPG2|JPS|JPW|JT|JWL|JXR|KDC|KODAK|KPG|LDA|LDM|LET|LT2|LTZ|LVA|LVF|LXF|MAC|MACP|MCS|MCZ|MDI|MGS|MGX|MIC|MIP|MNG|MPF|MPO|MTZ|MUR|MUR|NAV|NCR|NEU|NFF|NJB|NTC|NTH|ODI|ODIF|OLA|OPD|ORA|OTA|OTB|OTC|OTG|OTI|OVW|P21|P2Z|PAT|PC6|PC7|PCD|PCT|PCX|PDN|PEF|PI2|PIC|PIC|PICNC|PICTCLIPPING|PL0|PL2|PLN|PMB|PNG|POL|PP2|PPSX|PRW|PS|PS|PSB|PSD|PSF|PSG|PSP|PSPIMAGE|PSQ|PVL|PWD|PWS|PX|PXR|PZ2|PZ3|QTIF|QTZ|QXD|RIC|RLC|RLE|RW2|SDK|SDR|SEC|SFW|SIG|SKP|SLDASM|SLDDRW|SLDPRT|SNX|SRF|SST|SUN|SVG|SVGZ|TARGA|TCW|TCX|TEX|TGA|TIF|TIFF|TJP|TN|TPF|TPX|TRIF|TRX|U3D|UPX|URT|UTX|V00|V3D|VFS|VGA|VHD|VIS|VRL|VTX|WB1|WBC|WBD|WBZ|WEBP|WGS|WI|WMF|WNK|XDW|XIP|XSI|X_B|X_T|ZDL|ZIF|ZNO|ZPRF|ZT)$/i)) {
    icon = "fa fa-fw fa-file-image-o";
  }
  if (extension.match(/^(pdf)$/i)) {
    icon = "fa fa-fw fa-file-pdf-o";
  }
  if (extension.match(/^(c|cake|clojure|coffee|jsx|cpp|cs|css|less|scss|csx|gfm|git-config|go|gotemplate|java|java-properties|js|jquery|regexp|json|litcoffee|makefile|nant-build|objc|objcpp|perl|perl6|plist|python|ruby|rails|rjs|sass|shell|sh|sql|mustache|strings|toml|yaml|git-commit|git-rebase|html|erb|gohtml|jsp|php|py|junit-test-report|shell-session|xml|xsl)$/i)) {
    icon = "fa fa-fw fa-file-code-o";
  }
  if (extension.match(/^(7z|bz2|tar|gz|rar|zip|zipx|dmg|pkg|tgz|wim|bdoc)$/i)) {
    icon = "fa fa-fw fa-file-archive-o";
  }
  if (extension.match(/^(doc|dot|wbk|docx|docm|dotx|dotm|docb|apxl|pages)$/i)) {
    icon = "fa fa-fw fa-file-word-o";
  }
  if (extension.match(/^(xls|xlt|xlm|xlsx|xlsm|xltx|xltm|xlsb|xla|xlam|xll|xlw|numbers)$/i)) {
    icon = "fa fa-fw fa-file-excel-o";
  }
  if (extension.match(/^(ppt|pot|pps|pptx|pptm|potx|potm|ppam|ppsx|ppsm|sldx|sldm|key|keynote)$/i)) {
    icon = "fa fa-fw fa-file-powerpoint-o";
  }
  if (extension.match(/^(3GA|AA|AA3|AAC|AAX|ABC|AC3|ACD|ACD|ACM|ACT|ADG|ADTS|AFC|AHX|AIF|AIFC|AIFF|AL|AMR|AMZ|AOB|APC|APE|APF|ATRAC|AU|AVR|AWB|AWB|BAP|BMW|CAF|CDA|CFA|CIDB|COPY|CPR|CWP|DAC|DCF|DCM|DCT|DFC|DIG|DSM|DSS|DTS|DTSHD|DVF|EFA|EFE|EFK|EFV|EMD|EMX|ENC|F64|FL|FLAC|FLP|FST|GNT|GPX|GSM|GSM|HMA|HTW|IFF|IKLAX|IMW|IMY|ITS|IVC|K26|KAR|KFN|KOE|KOZ|KOZ|KPL|KTP|LQT|M3U|M3U8|M4A|M4B|M4P|M4R|MA1|MID|MIDI|MINIUSF|MIO|MKA|MMF|MON|MP2|MP3|MPA|MPC|MPU|MP_|MSV|MT2|MTE|MTP|MUP|MXP4|MZP|NCOR|NKI|NRT|NSA|NTN|NWC|ODM|OGA|OGG|OMA|OMG|OMX|OTS|OVE|PCAST|PEK|PLA|PLS|PNA|PROG|PVC|QCP|R1M|RA|RAM|RAW|RAX|REX|RFL|RIF|RMJ|RNS|RSD|RSO|RTI|RX2|SA1|SBR|SD2|SFA|SGT|SID|SMF|SND|SNG|SNS|SPRG|SSEQ|SSND|SWA|SYH|SZ|TAP|TRM|UL|USF|USFLIB|USM|VAG|VMO|VOI|VOX|VPM|VRF|VYF|W01|W64|WAV|WMA|WPROJ|WRK|WUS|WUT|WWU|XFS|ZGR|ZVR)$/i)) {
    icon = "fa fa-fw fa-file-audio-o";
  }
  if (extension.match(/^(264|3G2|3GP|3MM|3P2|60D|AAF|AEC|AEP|AEPX|AJP|AM4|AMV|ARF|ARV|ASD|ASF|ASX|AVB|AVD|AVI|AVP|AVS|AVS|AX|AXM|BDMV|BIK|BIX|BOX|BPJ|BUP|CAMREC|CINE|CPI|CVC|D2V|D3V|DAV|DCE|DDAT|DIVX|DKD|DLX|DMB|DM_84|DPG|DREAM|DSM|DV|DV2|DVM|DVR|DVR|DVX|DXR|EDL|ENC|EVO|F4V|FBR|FBZ|FCP|FCPROJECT|FLC|FLI|FLV|GTS|GVI|GVP|H3R|HDMOV|IFO|IMOVIEPROJ|IMOVIEPROJECT|IRCP|IRF|IRF|IVR|IVS|IZZ|IZZY|M1PG|M21|M21|M2P|M2T|M2TS|M2V|M4E|M4U|M4V|MBF|MBT|MBV|MJ2|MJP|MK3D|MKV|MNV|MOCHA|MOD|MOFF|MOI|MOV|MP21|MP21|MP4|MP4V|MPEG|MPG|MPG2|MQV|MSDVD|MSWMM|MTS|MTV|MVB|MVP|MXF|MZT|NSV|OGV|OGX|PDS|PGI|PIV|PLB|PMF|PNS|PPJ|PRPROJ|PRTL|PSH|PVR|PXV|QT|QTL|R3D|RATDVD|RM|RMS|RMVB|ROQ|RPF|RPL|RUM|RV|SDV|SFVIDCAP|SLC|SMK|SPL|SQZ|SUB|SVI|SWF|TDA3MT|THM|TIVO|TOD|TP0|TRP|TS|UDP|USM|VCR|VEG|VFT|VGZ|VIEWLET|VLAB|VMB|VOB|VP6|VP7|VRO|VSP|VVF|WD1|WEBM|WLMP|WMMP|WMV|WP3|WTV|XFL|XVID|ZM1|ZM2|ZM3|ZMV)$/i)) {
    icon = "fa fa-fw fa-file-video-o";
  }

  return icon;
}

////////////////////////////////////
// APPEND _DOC INTO THE FOLDER //
////////////////////////////////////

function appendDoc (fid, did, doc, isfile) {
  var dclass = (isfile && "itsAFile") || "itsADoc";
  var fcolor = $("#" + fid).attr("color");

  var doccard = "<li class='adoc "+dclass+"' id='"+ did +"'><a><span class='icon docicon exticon'><i></i></span><span class='icon uncheckedicon docicon'><i class='fa fa-fw fa-square-o'></i></span><span class='icon checkedicon docicon'><i class='fa fa-fw fa-check-square-o'></i></span><span class='docsize'></span><span class='doctitle'></span><progress class='progress is-small docprogress' value='' max=''></progress></a><div class='tags docs-float-context has-addons'><span title='Delete Document' class='adoc-float-delete tag is-light'><span class='icon is-small'><i class='fa fa-trash fa-fw'></i></span></span><span title='Rename Document' class='adoc-float-rename tag is-light'><span class='icon is-small'><i class='fa fa-i-cursor fa-fw'></i></span></span><span title='Quick Document Actions' class='adoc-float-context tag is-light'><span class='icon is-small'><i class='fa fa-ellipsis-v fa-fw'></i></span></span></div></li>";

  if ( $("#docs-of-" + fid + " > " + "#" + did).length > 0 ) {
    //doc exists
  } else {
    docsArray.push({ fid : fid, did : did, fcolor : fcolor });
    $("#docs-of-" + fid).prepend(doccard);
    if(isMobile){ $(".docs-float-context").addClass("itsMobile"); }
  }
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

function newFolder (callback){
  callback = callback || noop;
  $("#new-folder-button").removeClass("is-armed");
  var newFTitle = $("#new-folder-title").val().trim();
  if (newFTitle === "" || newFTitle === undefined || newFTitle === null) {
    newFTitle = "Untitled Folder";
  }
  var fid = "f-" + newUUID();
  var fcount = 0;
  var folderData = {
    folderid : fid,
    count : fcount,
    open : true
  };

  titlesObject.folders[fid] = JSON.stringify(newFTitle);
  updateTitles();

  foldersRef.child(fid).update(folderData , function(){
    dataRef.update({"foldersCount" : foldersCount+1});

    $("#new-folder-title").val("");
    updateFolderIndexes();

    $("#first-folder-hint").hide();

    callback(fid);
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
});



function deleteFolder (folderElement){
  var fid = folderElement.attr("id");
  var activeDID = activeDocID;

  showDocProgress("One Moment, deleting dolder.");

  var anyDocsFromThisFolderOpen = false;
  clearSelections();

  $("#" + fid).find(".adoc").each(function(index, doc) {
    var docID = doc.id;
    if (activeDID === docID) {
      // IF ANY OF THESE DOCS ARE CURRENTLY OPEN -~ hard close it.
      anyDocsFromThisFolderOpen = true;
    }

    var deletionRef;
    if ($(doc).hasClass("itsADoc")) {
      deletionRef = rootRef.child(docID + ".crypteedoc");
    }

    if ($(doc).hasClass("itsAFile")) {
      deletionRef = rootRef.child(docID + ".crypteefile");
    }

    delete titlesObject.docs[docID];
    deletionRef.delete().then(function(){}).catch(function(error) {
      handleError(error);
    });

  });

  foldersRef.child(fid).remove().then(function() {
    dataRef.update({"foldersCount" : foldersCount-1},function(){
      if (anyDocsFromThisFolderOpen){
        loadDoc("home");
      } else {
        hideDocProgress();
      }

      removeByAttr(docsArray, 'fid', fid);
      delete titlesObject.folders[fid];

      updateTitles();
      updateFolderIndexes();
    });
  }).catch(function(error) {
    handleError(error);
    showDocProgress("Error deleting folder. Please reload page and try again.");
  });

}

function removeFolder(fid){
    setTimeout(function(){
      $("#" + fid).fadeOut('500', function(){
        $("#" + fid).remove();
        updateFolderIndexes();
      });
    }, 500);
}











//////////////////////////////////
// OPEN & CLOSE FOLDER BUTTON //
//////////////////////////////////

function toggleFolderOpenClose(fid) {
  $("#" + fid).find(".folderClosable").toggleClass("hidden");
  $("#" + fid).find(".folder-icon").toggleClass('fa-folder-open').toggleClass('fa-folder');
  $("#" + fid).find(".folder-dropdown").fadeOut(100).removeClass('dropdown-open');
  if ($("#" + fid).find(".folderClosable").hasClass('hidden')) {
    foldersRef.child(fid).update({open : false});
  } else {
    foldersRef.child(fid).update({open : true});
  }
}

$('#all-folders').on('click', '.folder-clicker-icon, .folder-title', function(event) {
    var fid = $(this).parents(".afolder").attr("id");
    toggleFolderOpenClose(fid);
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

    titlesObject.folders[fid] = JSON.stringify(folderNewName);
    updateTitles(function(){
      $(".rename-status").removeClass("is-danger is-warning is-dark is-success").addClass("is-success");
      var folderToReplaceInFoldersArray = foldersArray.indexOf(folderOldName);
      if (folderToReplaceInFoldersArray !== -1) { foldersArray[folderToReplaceInFoldersArray] = folderNewName; }
      setTimeout(function(){
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

function makeGhostFolder () {
  $("#ghost-folder-confirm-button").addClass("is-loading").prop("disabled", true).attr("disabled", true);

  var ghostTitles = {};
  ghostTitles.docs = {};
  ghostTitles.fid = fidToGhost;
  ghostTitles.fname = JSON.stringify(ghostFTitleToConfirm);
  $("#docs-of-" + fidToGhost).children(".adoc").each(function(index, doc){
    ghostTitles.docs[doc.id] = JSON.stringify($("#" + doc.id).find(".doctitle").text());
  });

  var plaintextGhostTitles = JSON.stringify(ghostTitles);
  openpgp.encrypt({ data: plaintextGhostTitles, passwords: [theKey], armor: true }).then(function(ciphertext) {
    var encryptedGhostTitlesObject = JSON.stringify(ciphertext);
    foldersRef.child(fidToGhost).update({"ghosttitles" : encryptedGhostTitlesObject, "title" : hashString(ghostFTitleToConfirm)}, function(error){
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

            removeByAttr(docsArray, 'fid', fidToGhost);
            delete titlesObject.folders[fidToGhost];
            $.each(ghostTitles.docs, function(ghostedDID, doc) {
              delete titlesObject.docs[ghostedDID];
            });

            updateTitles();
            updateFolderIndexes();
            ghostTitles = {};
          }
        });
      }
    });
  });
}

function summonGhostFolder () {
  $("#ghost-folder-input").prop('disabled', true);
  folderTitleToSummon = hashString($("#ghost-folder-input").val());
  $("#ghost-folder").find(".fa-eye").removeClass("fa-eye").addClass("fa-cog fa-spin fa-fw");
  dataRef.update({"summonghost" : folderTitleToSummon}, function(error){
    handleError(error);
  });
  dataRef.child("summonghost").on('value', function(snapshot) {
    if (snapshot === undefined || snapshot === null || !snapshot.val() || snapshot.val() === "" || snapshot.val() === " "){
      $("#ghost-folder").find(".fa-cog").addClass("fa-eye").removeClass("fa-cog fa-spin fa-fw");
      $("#ghost-folder-input").val("");
      $(".ghost-folder-info").html('<i class="fa fa-question"></i>');
    }
    $("#ghost-folder-input").prop('disabled', false);
  });
}

$("#ghost-folder-input").on('keydown', function(event) {
  setTimeout(function(){
    if (event.keyCode == 13 && $("#ghost-folder-input").val().trim() !== "") {
      summonGhostFolder();
    }
    if ($("#ghost-folder-input").val().trim() !== "") {
      $(".ghost-folder-info").html('<i class="fa fa-magic" id="ghost-folder-summon-icon"></i>');
    } else {
      $(".ghost-folder-info").html('<i class="fa fa-question"></i>');
    }
    if (event.keyCode == 27) {
      $("#ghost-folder-input").val(""); $(".ghost-folder-info").html('<i class="fa fa-question"></i>');
    }
  },50);
});

$('#ghost-folder').on('click', "#ghost-folder-icon, #ghost-folder-summon-icon",function(event) {
  event.preventDefault();
  /* Act on the event */
  if (!$("#ghost-folder-icon").find("i").hasClass("fa-cog")) {
    if ($("#ghost-folder-input").val().trim() !== "") {
      folderTitleToSummon = $("#ghost-folder-input").val();
      summonGhostFolder();
    }
  }
});

$('#ghost-folder').on('click', ".fa-question",function(event) {
  event.preventDefault();
  showGhostFolderHelp();
});







//////////////////////
// NEW _DOC BUTTON //
//////////////////////
$('#all-folders').on('click', '.new-document-icon', function(event) {
  event.preventDefault();
  var ndInput = $(this).parents(".newDocInput").find('.new-doc-input');
  var newDTitle = ndInput.val().trim();
  if (newDTitle !== "") {
    if (usedStorage <= allowedStorage) {
      showDocProgress("Saving Current Document");
      saveDoc(newDoc, ndInput);
    } else {
      exceededStorage();
    }
  } else {
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

function newDoc (whichInput){
  showDocProgress("Creating New Document");
  var input = whichInput;
  if ($.trim(input.val()) !== ""){
    var dtitle = $.trim(input.val());
    var fid = input.parents(".afolder").attr("id");

    foldersRef.child(fid + "/count").once('value', function(snapshot) {
      var fcount = snapshot.val();
      var did = "d-" + newUUID();
      var docData = { docid : did, fid : fid };

      foldersRef.child(fid).update({"count" : fcount+1});
      foldersRef.child(fid + "/docs/" + did).update(docData, function(){
        input.parents(".afolder").attr("count", fcount + 1);
        appendDoc(fid, did, docData, false);
        whichInput.val("");
        newDocCreated(did, dtitle);
        updateDocIndexesOfFID(fid);
        titlesObject.docs[did] = JSON.stringify(dtitle);
        updateTitles();
      });
    });
  }
}

function newDocCreated (did, dtitle) {
  quill.setText('\n');

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

  saveDoc(function(){
    dataRef.update({"lastOpenDocID" : did}, function(){
      if (isMobile) {
        hideDocProgress(hideMenu);
      } else {
        hideDocProgress();
      }
    });
  });
}












/////////////////////////////////////
// _DOC INPUT CHANGE & AUTOSAVE   //
/////////////////////////////////////


quill.on('text-change', function(delta, oldDelta, source) {
  $('#upload-progress, .progressButtons').attr("value", "0").attr("max", "100").removeClass('is-success');

  lastActivityTime = (new Date()).getTime();
  idleTime = 0;
  docChanged = true;
});

function idleTimer () {
  idleTime++;
  if (idleTime > 5 && docChanged && !isSaving) { // 5 secs
    saveDoc();
  }
}

function inactiveTimer () {
  var now = (new Date()).getTime();

  // 30minutes
  if (now - lastActivityTime > 1800000) {
    inactivityTimeout();
  }
}







//////////////////////////
//   CLICK LOAD HOME    //
//////////////////////////

$('#homedoc').on('click', function(event) {
  loadHomeDoc ();
});

function loadHomeDoc (){
  var didToLoad = "home";
  // check the active ID first.
  if ((didToLoad !== activeDocID) && (typeof didToLoad != 'undefined')) {
    saveDoc(loadDoc, didToLoad);
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
        errorText = "Seems like this file doesn't exist or you don't have permission to open this doc. We're not sure how this happened.<br> Please try again shortly, or contact our support. We're terribly sorry about this.";
        // File or doc doesn't exist at all ~ shit. alright let's try to repair things.
        // Chances are we've got a problem.
        showDocProgress(errorText);
        fixFilesAndFolders();
        break;
      case 'storage/unauthorized':
        errorText = "Seems like this file doesn't exist or you don't have permission to open this doc. We're not sure how this happened.<br> Please try again shortly, or contact our support. We're terribly sorry about this.";
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












$('#all-folders').on('click', '.adoc', function(event) {
  var selectionButtons = $(".icon");
  if (!selectionButtons.is(event.target) && selectionButtons.has(event.target).length === 0) {
    var did = $(this).attr("id");
    var didToLoad = did;
    var activeDID = activeDocID;

    clearSelections();

    if ((didToLoad !== activeDID) && (typeof didToLoad != 'undefined') && !isDocOutdated) {
      saveDoc(loadDoc, didToLoad);
      $(this).find(".exticon").addClass("is-loading");
    } else {
      if (isDocOutdated) {
        loadDoc(didToLoad);
        $(this).find(".exticon").addClass("is-loading");
      }
    }
  }


});

function loadDoc (did, callback, callbackParam){

  callback = callback || noop;

  $(".outdated-message").fadeOut();
  $(".outdated-save-message").fadeOut();

  //get necessary variables
  var itsAFile = false;
  var itsADoc = false;

  if ($("#" + did).hasClass("itsAFile")) {
    itsAFile = true;
  } else {
    itsADoc = true;
  }

  var dtitle = $("#"+did).find(".doctitle").text();
  // var fid = $("#" + did).parents(".afolder").attr("id");

  if (itsADoc) {
    //DOWNLOAD _DOC
    var docRef = rootRef.child(did + ".crypteedoc");
    docRef.getMetadata().then(function(metadata) {
      docRef.getDownloadURL().then(function(docURL) {

        //loading indicator
        if (dtitle) {
          showDocProgress("Loading " + dtitle + "<br><br><span class='cancel-loading' onclick='cancelLoading();'>Cancel</span>");
        } else {
          showDocProgress("Loading Home");
        }

        var docsize = metadata.size;
        $.ajax({ url: docURL, type: 'GET',
            success: function(encryptedDocDelta){
              //LOAD _DOC WITH DID
              if (did !== "home") {
                docLoaded(did, dtitle, encryptedDocDelta, docsize, callback, callbackParam);
              } else {
                docLoaded(did, "Home", encryptedDocDelta, docsize, callback, callbackParam);
              }
            },
            error:function (xhr, ajaxOptions, thrownError){
              console.log(thrownError);
              var errorText = "One moment please";
              showDocProgress(errorText);
              window.location.reload();
            }
        });

      });
    }).catch(function(error) {
      var errorText;

      switch (error.code) {
        case 'storage/object-not-found':
          //  NOT CAPTURING THIS. BUT STILL WORRIED.
          errorText = "Seems like this doc doesn't exist or you don't have permission to open this doc. We're not sure how this happened. Please try again shortly, or contact our support. We're terribly sorry about this.";
          if (did === "home") {
            fixHomeDoc(loadDoc, "home");
          } else {
            handleError(error);
            errorText = "Seems like this doc doesn't exist or you don't have permission to open this doc. We're not sure how this happened. Please try again shortly, or contact our support. We're terribly sorry about this.";
            showDocProgress(errorText);
          }
          break;
        case 'storage/unauthorized':
          handleError(error);
          errorText = "Seems like this doc doesn't exist or you don't have permission to open this doc. We're not sure how this happened. Please try again shortly, or contact our support. We're terribly sorry about this.";
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

}

function docLoaded(did, dtitle, delta, docsize, callback, callbackParam){

  var theEncryptedDelta = JSON.parse(delta).data;
  openpgp.decrypt({ message: openpgp.message.readArmored(theEncryptedDelta),   passwords: [theKey],  format: 'utf8' }).then(function(plaintext) {
      var decryptedText = plaintext.data;
      quill.setContents(JSON.parse(decryptedText));
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
        $("#homedoc").addClass("is-dark");
        $("#homedoc").prop("disabled", true).attr("disabled", true);

        $(".document-contextual-button").addClass("docContextOff");
        $(".filesize-button, .mobile-floating-tools").addClass('menuOpen');
        $("#doc-contextual-button").fadeOut(100);

      }

      //old one isn't active anymore
      $(".activedoc").removeClass('is-active activedoc');

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
      //reset all progresses

      $('#upload-progress, .progressButtons').attr("value", "100").attr("max", "100").removeClass("is-danger is-warning").addClass("is-success");
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
      // always inherited from load doc.
      callback(callbackParam);
  });
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

        previewController (dtitle, did, decryptedContents, callback, callbackParam)

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
      displayMP3File(dtitle, did, decryptedContents, callback, filesize, callbackParam);
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
      importHTMLDocument(dtitle, did, decryptedContents, callback, filesize, callbackParam);
      resetFileViewer = false;
    }
    else if (ext.match(/^(txt|md)$/i)) {
      importTxtOrMarkdownDocument(dtitle, did, decryptedContents, callback, filesize, callbackParam);
      resetFileViewer = false;
    }
    else {
      displayUnsupportedFile(dtitle, did, decryptedContents, callback, filesize, callbackParam);
      resetFileViewer = true;
    }

    if (resetFileViewer) {
      $("#" + did).find(".exticon").removeClass("is-loading");
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
 }
}

function hideFileViewer () {

  activeFileContents = "";
  activeFileTitle = "";
  activeFileID = "";
  $("#file-viewer").hide();
  $("#doc-top, #active-doc-contents").show();
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

function displayMP3File (dtitle, did, decryptedContents, callback, filesize, callbackParam) {
  activeFileContents = decryptedContents;
  activeFileTitle = dtitle;
  activeFileID = did;

  $('#file-viewer').addClass("loading-contents");

  setTimeout(function () {
    $("#file-viewer").width("9999");
    $("#file-viewer").height("9999");

    $('#file-viewer-contents').html('<audio id="'+did+'" controls controlsList="nodownload"><source src='+decryptedContents+' type="audio/mp3"><p>It seems your browser does not support MP3 playback. Please download the file to hear it</p></audio>');
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
  if (!isSaving) {
    saveDoc(loadDoc, "home");
  } else if (isSaving){
    alert("The doc is currently being saved, please close after it's done saving");
  }
}


//////////////////////
//   SAVE  _DOC    //
//////////////////////

$(".save-doc-button").on('click', function(event) {
  if (!isSaving) {
    saveDoc();
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

        var fid = $("#" + did).parents(".afolder").attr("id");
        updateActiveTags();

        if (callbackParam) {
          showDocProgress("Saving");
        }

        if (!callback) {
          $('#upload-progress, .progressButtons').attr("max", "0").attr("value", "100").removeClass("is-danger is-warning is-success").addClass("is-warning");
        }

        foldersRef.child(fid + "/docs/" + did).once('value', function(snapshot) {
          encryptAndUploadDoc(did, fid, callback, callbackParam);
        } , function (error) {
          if (did !== "home") {
            // doc deleted from server, but still open, and user tried to save. which means computer was offline when doc was deleted,
            // it came back online, and tried to save, and if it does save it would fuck things up in backend. so instead reload page to make sure shit's up to date.
            window.location.reload();
          } else {
            //oh it's just the home doc, carry on.
            encryptAndUploadDoc(did, fid, callback, callbackParam);
          }
          if (error) {
            handleError(error);
          }
        });

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
        $('#upload-progress, .progressButtons').attr("max", snapshot.totalBytes).removeClass("is-danger is-success").addClass("is-warning");
        $('#upload-progress, .progressButtons').attr("value", snapshot.bytesTransferred);
        totalBytes = snapshot.totalBytes;
        var filesize = formatBytes(totalBytes);
        $("#filesize").html(filesize);
        $("#filesize").attr("size", filesize);
        lastActivityTime = (new Date()).getTime();
        switch (snapshot.state) { case firebase.storage.TaskState.PAUSED: break; case firebase.storage.TaskState.RUNNING: break; }
        if (snapshot.bytesTransferred === totalBytes) {
          saveUploadComplete(did, totalBytes, callback, callbackParam);
        }
      }, function(error) {
        if (usedStorage >= allowedStorage) {
          exceededStorage(callback, callbackParam);
        } else {
          $('#upload-progress, .progressButtons').attr("max", "100").attr("value", "100").removeClass("is-warning is-success").addClass("is-danger");
          console.log("SAVE FAILED. RETRYING IN 3 SECONDS.");
          forceCheckConnection();
          setTimeout(function(){
            saveDoc(callback, callbackParam);
          }, 3000);
        }
      });
  });
}


function saveUploadComplete(did, dsize, callback, callbackParam) {

  callback = callback || noop;

  var docRef = rootRef.child(did + ".crypteedoc");
  docRef.getMetadata().then(function(metadata) {
    currentGeneration = metadata.generation;

    if (did !== "home") {
      var fid = $("#" + did).parents(".afolder").attr("id");
      var docData = { "generation" : currentGeneration };
      foldersRef.child(fid + "/docs/" + did).update(docData, function(){
        saveComplete(did, callback, callbackParam);
      });
    } else {
      dataRef.update({"homegeneration" : currentGeneration}, function(){
        saveComplete(did, callback, callbackParam);
      });
    }

  });
}

function saveComplete(did, callback, callbackParam){

  setTimeout(function () { $('#upload-progress, .progressButtons').attr("max", "100").attr("value", "100").removeClass("is-warning is-danger").addClass("is-success"); }, 500);
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

  callback(callbackParam);

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
  clearSelections();
  $(".delete-status").removeClass("is-light is-warning is-danger").addClass("is-warning").html("<p class='title'>Delete Document</p><p class='subtitle is-6'>You're about to delete this document</p>");
  $("#delete-doc-modal").addClass("is-active");
}

function hideDeleteDocModal() {
  $("#delete-doc-modal").removeClass("is-active");
}

$(".delete-doc-confirm").on('click', function(event) {
  event.preventDefault();
  deleteDoc(activeDocID);
});

function deleteDoc (did){
  $(".delete-status").removeClass("is-light is-warning is-danger").addClass("is-light").html("<p class='title'>Deleting ...</p>");

  var fid = $("#" + did).parents(".afolder").attr("id");
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
  removeByAttr(docsArray, 'did', did);
  $("#docs-of-" + fid + " > " + "#" + did).remove();


  if ( did === activeFileID ) {
    hideFileViewer ();
  }

  if ( did === activeDocID ) {
    loadDoc("home");
  }

  if (movingDoc) {
    movingDoc = false;
  } else {
    delete titlesObject.docs[did];
    updateTitles();
  }
}

/////////////////////
//   MOVE _DOC  //
////////////////////

function moveDoc (from, did) {
  var fromFID = $("#"+ from).parents(".afolder").attr("id");
  var toFID = $("#" + did).parents(".afolder").attr("id");
  movingDoc = true;

  foldersRef.child(fromFID + "/docs/" + did).once('value', function(snap)  {
     foldersRef.child(toFID + "/docs/" + did).set( snap.val(), function(error) {
          if( !error ) {
            foldersRef.child(toFID + "/docs/" + did).update({"fid" : toFID},function(error){
              if (!error){
                foldersRef.child(fromFID + "/docs/" + did).remove();

                foldersRef.child(fromFID + "/count").once('value', function(snapshot) {
                  var fcount = snapshot.val();
                  foldersRef.child(fromFID).update({"count" : fcount-1});
                });

                foldersRef.child(toFID + "/count").once('value', function(snapshot) {
                  var fcount = snapshot.val();
                  foldersRef.child(toFID).update({"count" : fcount+1});
                  $("#"+ from).parents(".afolder").attr("count", fcount + 1);
                  $("#" + did).parents(".afolder").attr("count", fcount + 1);

                  updateDocIndexesOfFID(fromFID);
                  updateDocIndexesOfFID(toFID);
                });
              }
            });
          }
          else if( typeof(console) !== 'undefined' && console.error ) {  handleError(error); console.error(error); }
     });
  });
}








/////////////////////
//   RENAME _DOC  //
////////////////////

$("#all-folders").on('click', '.adoc-float-rename', function(event) {
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
  var fid = $("#" + inactiveDidToRename).parents(".afolder").attr("id");
  if (newDocName !== oldDocName) {
    $(".rename-doc-status").removeClass("is-danger is-warning is-dark is-success").addClass("is-warning");
    $(".rename-doc-status > .title").html("Renaming ... ");

    titlesObject.docs[inactiveDidToRename] = JSON.stringify(newDocName);
    updateTitles(function(){
      theInput.val(newDocName);
      theInput.attr("placeholder", newDocName);
      $("#" + inactiveDidToRename).find(".doctitle").html(newDocName);
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
  var newDocName = $('#active-doc-title-input').val().trim();
  var oldDocName = $('#active-doc-title-input').attr("placeholder");
  var fid = $("#" + activeDocID).parents(".afolder").attr("id");
  if (newDocName !== oldDocName) {
    $(".rename-doc-status").removeClass("is-danger is-warning is-dark is-success").addClass("is-warning");
    $(".rename-doc-status > .title").html("Renaming ... ");

    titlesObject.docs[activeDocID] = JSON.stringify(newDocName);
    updateTitles(function(){
      document.title = newDocName;
      theInput.val(newDocName);
      theInput.attr("placeholder", newDocName);
      $("#" + activeDocID).find(".doctitle").html(newDocName);
      $(".rename-doc-status").removeClass("is-danger is-warning is-dark is-success").addClass("is-success");
      $(".rename-doc-status > .title").html("Done");
      setTimeout(function(){
        hideRenameDocModal();
      }, 1000);
    });

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
    $('#new-folder-card').addClass("hiddenNewFolderCard");
    $("#selection-actions-card").removeClass("hiddenSelectionActions").delay(500).queue(function (next) { $(this).css('display', 'inline-block'); next(); });
  } else {
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
$("#all-folders").on('click', '.adoc-float-delete', function(event) {

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

$('#seletion-delete-button').on('click', function(event) {
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
    var fid = $("#" + selection.did).parents(".afolder").attr("id");
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
  removeByAttr(docsArray, 'did', did);
  $("#" + fid).find("#" + did).remove();
  if (selectionArray.length === completedDeletions) {
    hideDeleteSelectionsModal();
    clearSelections();
  }
}




///////////////////////////////////////////////////
////////////////// TAGS /////////////////////////
///////////////////////////////////////////////////

function updateActiveTags () {
  var activeDocTags = [];
  $('crypteetag').each(function(index, el) {
    var tagContent = $(this).text().replace("&nbsp;", "");
    activeDocTags.push(tagContent);
  });
  for (var doc in docsArray) {
    if (docsArray[doc].did == activeDocID) {
      docsArray[doc].tags = activeDocTags;
      break;
    }
  }
  updateTags();
}

function updateTags(callback, callbackParam) {
  callback = callback || noop;
  var tagsObject = {};
  for (var doc in docsArray) {
    var docID = docsArray[doc].did;
    var docTags = docsArray[doc].tags;
    tagsObject[docID] = docTags;
  }
  var plaintextTags = JSON.stringify(tagsObject);
  openpgp.encrypt({ data: plaintextTags, passwords: [theKey], armor: true }).then(function(ciphertext) {
    var encryptedTagsObject = JSON.stringify(ciphertext);
    dataRef.update({"tags" : encryptedTagsObject},function(){
      callback(callbackParam);
    });
  });
}

function getTags () {
  dataRef.child("tags").on('value', function(snapshot) {
    var encryptedTagsObject = snapshot.val();
    if (encryptedTagsObject) {
      if (encryptedTagsObject !== null && encryptedTagsObject !== undefined) {
        gotTags(encryptedTagsObject);
      } else {
        // no tags found. maybe call updateTags() to follow getTitles?
        // ONLY IF THERE'S A docsArray. OR YOU'LL FUCK SHIT UP BIGTIME.
        // THERE SHOULD BE, BECAUSE THIS IS CALLED AFTER AMITHELASTDOC,
        // WHICH IS CALLED AFTER AN APPENDDOC LOOP WHICH PUSHES DOCS TO DOCSARRAY
      }
    } else {
      // no tags found. maybe call updateTags() to follow getTitles?
      // ONLY IF THERE'S A docsArray. OR YOU'LL FUCK SHIT UP BIGTIME.
      // THERE SHOULD BE, BECAUSE THIS IS CALLED AFTER AMITHELASTDOC,
      // WHICH IS CALLED AFTER AN APPENDDOC LOOP WHICH PUSHES DOCS TO DOCSARRAY
    }
  });
}

function gotTags (JSONifiedEncryptedTagsObject, callback) {
  callback = callback || noop;
  var encryptedTagsObject = JSON.parse(JSONifiedEncryptedTagsObject).data;
  openpgp.decrypt({ message: openpgp.message.readArmored(encryptedTagsObject), passwords: [theKey], format: 'utf8' }).then(function(plaintext) {
    var tagsObject = JSON.parse(plaintext.data);
    processTags(tagsObject);
  });
}

function processTags (tagsObject) {
  for (var doc in docsArray) {
    var docID = docsArray[doc].did;
    docsArray[doc].tags = tagsObject[docID];
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
document.getElementById('active-doc-contents').addEventListener('drop', handleAttachmentDrop, false);

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
    var files = evt.dataTransfer.files;

    for (var i = 0; i < files.length; i++) {
      var filename = files[i].name;
      var extension = filename.slice((filename.lastIndexOf(".") - 1 >>> 0) + 2);
      if (extension.match(/^(JPEG|JPG|PNG|GIF)$/i)) {
        embedDroppedImages(evt);
      } else {
        if (activeDocID !== "home") {
          embedDroppedAttachments(evt);
        } else {
          showFileUploadHomeInfo(evt);
        }
      }
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
    setTimeout(function () {
      showFileUploadStatus("is-danger", "Unfortunately your browser or device does not support File API, which is what allows us to encrypt files on your device. Therefore we can't upload your file.");
    }, 10000);
  }
}


var dragCounter = 0;
var menuBeforeDrag;

function handleDragEnter(evt) {
  if (dragCounter === 0) {
    if ($(".leftStuffOff").length === 1) {
      // MENU WAS OFF SO SHOW IT
      menuBeforeDrag = false;
      showMenu();
    } else {
      menuBeforeDrag = true;
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
    if (!menuBeforeDrag) {
      hideMenu();
      menuBeforeDrag = false;
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

function showFileUploadHomeInfo(evt) {
  dragCounter = 0;
  var afolder = $(".afolder");
  if (afolder.has(evt.target).length === 0) {
    evt.stopPropagation();
    evt.preventDefault();

    if ($(".afolder").length > 0) {
      $('.afolder').addClass("fileDropFolder");

      showFileUploadStatus("is-info", "Unfortunately you can only drag images onto your home document. All other documents support drag & drop attachments. Sorry.");
      setTimeout(function () {
        hideFileUploadStatus();
      }, 10000);

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
        if (snapshot.bytesTransferred === snapshot.totalBytes) {
          $("#upload-"+did).remove();
          fileUploadComplete(fid, did, filename, filesize, callback, callbackParam);
        }
      }, function(error) {
        if (usedStorage >= allowedStorage) {
          showFileUploadStatus("is-danger", "Error uploading your file(s). Looks like you've already ran out of storage. Please consider upgrading to a paid plan or deleting something else.<br><br><a class='button is-light' onclick='hideFileUploadStatus();'>Close</a>" + ' &nbsp; <a class="button is-info" onclick="upgradeFromExceed()">Upgrade</a>');
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
      });
  });
}

function fileUploadComplete(fidToUpdateInDB, did, filename, filesize, callback, callbackParam) {
  numFilesLeftToBeUploaded--;
  numFilesUploaded++;

  callback = callback || noop;
  callbackParam = callbackParam || did;

  function saveToDB(fid) {
    foldersRef.child(fid + "/count").once('value', function(snapshot) {
      var fcount = snapshot.val();
      var docData = { docid : did, fid : fid, isfile : true };
      foldersRef.child(fid).update({"count" : fcount+1});
      foldersRef.child(fid + "/docs/" + did).update(docData, function(){
        $("#" + fid).attr("count", fcount + 1);
        appendDoc(fid, did, docData, true);
      });

      titlesObject.docs[did] = JSON.stringify(filename);
      updateTitles();

      if (numFilesLeftToBeUploaded <= 0) {
        hideFileUploadStatus();
        updateDocIndexesOfFID (fid);
      }
      callback(callbackParam);
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

  // ios 11 compatiblity. we can't trigger shit with keyup and keydown fires before character is in input.
  setTimeout(function(){
    if ($("#search-input").val().trim() === "") {
      clearSearch();
    }
  }, 50);
});

function search (term){
  $("#search-button-icon").addClass("fa-close").removeClass("fa-search");
  var fuse = new Fuse(docsArray, searchOptions);
  var results = fuse.search(term);
  displaySearchResults(results, term);
}

function clearSearch () {
  $("#search-button-icon").removeClass("fa-close").addClass("fa-search");
  $("#results").html("");
  $("#search-input").val("");
  $("#results").fadeOut(125, function(){
    $("#all-folders").fadeIn(125);
    $(".left-contextual-buttons, #new-folder-card, #ghost-folder").fadeIn(250);
  });
  currentResultSelection = 0;
}

function displaySearchResults (results, term) {
  $(".left-contextual-buttons, #new-folder-card, #ghost-folder, #all-folders").fadeOut(100, function(){
    $("#results").fadeIn(100);
  });
  $("#results").html("");

  $.each(results, function(i, rslt) {
    var result = rslt.item;
    var match = "";
    var matchedTag = false;
    var resultTitle = result.name;
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
    var resultCard = '<div class="notification search-result" did="'+result.did+'"><span class="icon"><i class="'+result.icon+'"></i></span> '+resultTitle+'<br>'+ match +'</div>';
    $("#results").append(resultCard);
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

$("#upgrade-button").on('click', function(event) {
  saveDoc(openSettingsUpgrade);
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

function embedDroppedImages (evt) {
  dragCounter = 0;
  somethingDropped = true;
  var files = evt.dataTransfer.files;
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    processEmbedImage(file);
  }
}

function embedDroppedAttachments (evt) {
  dragCounter = 0;
  somethingDropped = true;
  var files = evt.dataTransfer.files;
  for (var i = 0; i < files.length; i++) {
    var file = files[i];
    processDroppedAttachment(file);
  }
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
      var targetfid = activeFileFolder();
      processDroppedDoc(file, targetfid, function(did){
        console.log("testing upload");
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















function showCrypteeSelector () {
  $('.attachment-selector').show();
  setTimeout(function () {
    $("#attachment-search-input").focus();
  }, 25);
}

$("#attachment-search-input").on('keydown', function (e) {
  // var filetype = $("#attachment-modal").attr("filetype");
  setTimeout(function(){
    var filetype = $("#attachment-search-input").attr("filetype");
    if (e.keyCode === 27 || $("#attachment-search-input").val().trim() === "") {
      clearAttachmentSearch();
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
    keys: [ "ftype", "name", "fname", "ftype", "tags"  ]
  };
  var fuse = new Fuse(docsArray, attachmentSearchOptions);
  var results = fuse.search(term);
  displayAttachmentSearchResults(results, filetype);
}

function displayAttachmentSearchResults (results, filetype) {
  $("#attachment-results").html("");

  $.each(results, function(i, result){
    if (result.ftype) {
      if (result.ftype.indexOf(filetype) !== -1) {
        var folderColor = result.fcolor;
        if ( result.fcolor === " #363636" ) { folderColor = "#000"; }
        var folderCard = '<p class="attachment-result-folder column is-11" id="attachment-result-'+result.fid+'"><span class="icon"><i class="fa fa-folder" style="color:'+folderColor+'"></i></span> '+result.fname+'</p>';
        var theResultFolder = $("#attachment-result-" + result.fid);
        if (theResultFolder.length <= 0) {
          $("#attachment-results").append(folderCard);
        }
      }
    }
  });

  $.each(results, function(i, result){
    if (result.ftype) {
      if (result.ftype.indexOf(filetype) !== -1) {
        var theResultFolder = $("#attachment-result-" + result.fid);
        var resultCard = '<div class="attachment-result column is-half" did="'+result.did+'"><span class="icon docicon exticon"><i class="'+result.icon+'"></i></span><span class="doctitle">'+result.name+'</span></div>';
        theResultFolder.after(resultCard);
      }
    }
  });

}

function clearAttachmentSearch () {
  $("#attachment-results").html("");
}






$("#attachment-results").on('click', '.attachment-result', function(event) {
  event.preventDefault();

  var filetype = $("#attachment-search-input").attr("filetype");
  var didToAttach = $(this).attr("did");
  var attachmentTitle = $(this).find(".doctitle").text();

  if (filetype === "image") {
    downloadAttachment(didToAttach, attachmentTitle);
  } else {
    attachCrypteeFile(attachmentTitle, didToAttach);
  }
  hideAttachmentSelector();
  showFileUploadStatus("is-info", "Attaching " + attachmentTitle + " to document.");
});

function downloadAttachment (did, attachmentTitle) {
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
        errorText = "Seems like this file doesn't exist or you don't have permission to open this doc. We're not sure how this happened.<br> Please try again shortly, or contact our support. We're terribly sorry about this.";
        // File or doc doesn't exist at all ~ shit. alright let's try to repair things.
        // Chances are we've got a problem.
        showDocProgress(errorText);
        fixFilesAndFolders();
        break;
      case 'storage/unauthorized':
        errorText = "Seems like this file doesn't exist or you don't have permission to open this doc. We're not sure how this happened.<br> Please try again shortly, or contact our support. We're terribly sorry about this.";
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
      // IMAGE
      if (ext.match(/^(jpg|jpeg|png|gif|svg|webp)$/i)) {
        attachImageFile(decryptedContents);
      }
      // else if (ext.match(/^(pdf)$/i) && !isMobile) {
      //
      // }
      // else if (ext.match(/^(mp3)$/i)) {
      //
      // }
      // else if (ext.match(/^(mp4)$/i)) {
      //
      // }
      // else {
      //
      // }

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
    // just to check file exists
    fileRef.getDownloadURL().then(function(url) {
      downloadFile(did, fileTitle, preview, attachmentLoaded, did);
    }).catch(function(error){
      theFile.removeClass("loading").addClass("error");
    });
  } else {
    theFile.remove();
  }
});

function attachmentLoaded(did) {
  $("crypteefile[did='"+did+"']").removeClass("loading");
}








///////////////////////////////////////////////////////////
//////////////////  IMPORT HTML DOCUMENT   ////////////////
///////////////////////////////////////////////////////////

// Importer from HTML using (which can import from Bear & Evernote or anything else HTML)

function importHTMLDocument (dtitle, did, decryptedContents, callback, docsize, callbackParam) {
  var spacelessDataURI = decryptedContents.replace(/\s/g, ''); // ios doesn't accept spaces and crashes browser. like wtf apple. What. THE. FUCCK!!!
  var rawHTML = decodeBase64Unicode(spacelessDataURI.split(',')[1]);
  var fid = $("#" + did).parents(".afolder").attr("id");

  quill.setText('\n');
  quill.clipboard.dangerouslyPasteHTML(1, rawHTML);

  dataRef.update({"lastOpenDocID" : did});
  sessionStorage.setItem('session-last-did', JSON.stringify(did));

  var milliseconds = (new Date()).getTime();
  sessionStorage.setItem('session-last-loaded', JSON.stringify(milliseconds));

  $("#homedoc").prop("disabled", false).attr("disabled", false);
  $("#homedoc").removeClass("is-dark");
  $("#doc-contextual-button").fadeIn(100);
  $(".activedoc").removeClass('is-active activedoc');

  //set new did active
  activeDocID = did;
  activeDocTitle = dtitle;

  $(".filesize-button").prop('onclick',null).off('click');

  $("#" + did + "> a").addClass("is-active activedoc");
  $("#" + did).find(".exticon").removeClass("is-loading");


  // always inherited from load doc.

  saveDoc(function (){
    // RENAME DOCUMENT AND REMOVE HTML NOW.
    var newDocName = dtitle.replace(/\.html/g, '');
    titlesObject.docs[activeDocID] = JSON.stringify(newDocName);
    updateTitles(function(){
      foldersRef.child(fid + "/docs/" + did).update({ "isfile" : false }, function(){
        //set doc title in taskbar
        $("#active-doc-title").html(newDocName);
        $("#active-doc-title-input").val(newDocName);
        document.title = newDocName;
        $("#active-doc-title-input").attr("placeholder", newDocName);
        $("#" + activeDocID).find(".doctitle").html(newDocName);
        $("#" + did).removeClass("itsAFile");
        callback(callbackParam);
      });d
    });
  });
}




///////////////////////////////////////////////////////////
//////////  IMPORT TEXT OR MARKDOWN DOCUMENT   ////////////
///////////////////////////////////////////////////////////

function importTxtOrMarkdownDocument (dtitle, did, decryptedContents, callback, filesize, callbackParam) {
  var spacelessDataURI = decryptedContents.replace(/\s/g, ''); // ios doesn't accept spaces and crashes browser. like wtf apple. What. THE. FUCCK!!!
  var rawTXT = decodeBase64Unicode(spacelessDataURI.split(',')[1]);
  var rawHTML = markdownConverter.makeHtml(rawTXT).split("\n").join("<br>");
  var fid = $("#" + did).parents(".afolder").attr("id");

  quill.setText('\n');
  quill.clipboard.dangerouslyPasteHTML(1, rawHTML);

  dataRef.update({"lastOpenDocID" : did});
  sessionStorage.setItem('session-last-did', JSON.stringify(did));

  var milliseconds = (new Date()).getTime();
  sessionStorage.setItem('session-last-loaded', JSON.stringify(milliseconds));

  $("#homedoc").prop("disabled", false).attr("disabled", false);
  $("#homedoc").removeClass("is-dark");
  $("#doc-contextual-button").fadeIn(100);
  $(".activedoc").removeClass('is-active activedoc');

  //set new did active
  activeDocID = did;
  activeDocTitle = dtitle;

  $(".filesize-button").prop('onclick',null).off('click');

  $("#" + did + "> a").addClass("is-active activedoc");
  $("#" + did).find(".exticon").removeClass("is-loading");


  // always inherited from load doc.

  saveDoc(function (){
    // RENAME DOCUMENT AND REMOVE HTML NOW.
    var newDocName = dtitle.replace(/\.md/g, '').replace(/\.txt/g, '');
    titlesObject.docs[activeDocID] = JSON.stringify(newDocName);
    updateTitles(function(){
      foldersRef.child(fid + "/docs/" + did).update({ "isfile" : false }, function(){
        //set doc title in taskbar
        $("#active-doc-title").html(newDocName);
        $("#active-doc-title-input").val(newDocName);
        document.title = newDocName;
        $("#active-doc-title-input").attr("placeholder", newDocName);
        $("#" + activeDocID).find(".doctitle").html(newDocName);
        $("#" + did).removeClass("itsAFile");
        callback(callbackParam);
      });
    });
  });
}




















//
