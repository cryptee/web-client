// a test line for github public workflow
var theKey = JSON.parse(sessionStorage.getItem('key'));
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
  });

  $('#all-folders').on('touchend', '.folder-clicker-icon', function(event) {
    $(this).parents(".afolder").removeClass("aboutToDragFolder");
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
        tribute.selectItemAtIndex(tribute.menuSelected, event);
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
        showKeyModal();
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
    var hashedKey = hashString(key);
    openpgp.decrypt({ message: openpgp.message.readArmored(encryptedStrongKey), passwords: [hashedKey],  format: 'utf8' }).then(function(plaintext) {
        rightKey(plaintext);
    }).catch(function(error) {
        checkLegacyKey(dataRef, key, hashedKey, encryptedStrongKey, function(plaintext){
          rightKey(plaintext);
          // if it's wrong, wrongKey() will be called in checkLegacyKey in main.js
        });
    });
  });
}

function rightKey (plaintext) {
  var theStrongKey = plaintext.data;
  $("#left-stuff").css({"opacity" : 1 });
  hideKeyModal();
  theKey = theStrongKey;
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

// separate this into a new file.

function fixHomeDoc (callback, callbackParam){
  var homeDelta = {"ops":[{"attributes":{"size":"16px","bold":true},"insert":"Welcome to Cryptee! Curious about what you can do with Cryptee Docs? Start here."},{"insert":"\n\n"},{"insert":{"divider":true}},{"insert":"Cryptee docs supports "},{"attributes":{"bold":true},"insert":"hotkeys "},{"insert":"and "},{"attributes":{"bold":true},"insert":"markdown"},{"insert":". Most of our hotkeys are standard (like [command/ctrl + B] for bold text), but to see our full list of hotkeys and markdown shortcuts, click "},{"attributes":{"width":"26"},"insert":{"image":"data:image/png;base64,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"}},{"insert":" in the header. \n"},{"insert":{"divider":true}},{"insert":"Need to color-code your notes? You can"},{"attributes":{"color":"#66a3e0"},"insert":" "},{"attributes":{"color":"#66a3e0","bold":true},"insert":"add"},{"attributes":{"color":"#6b24b2","bold":true},"insert":" "},{"attributes":{"color":"#66b966","bold":true},"insert":"colors"},{"attributes":{"color":"#66b966"},"insert":" "},{"insert":"and "},{"attributes":{"background":"#ffff00","bold":true},"insert":"highlights"},{"insert":" to your text in the header. \n"},{"insert":{"divider":true}},{"insert":"Say you want to create a quick"},{"attributes":{"bold":true},"insert":" list"},{"insert":"?  \nYou can create a to-do list."},{"attributes":{"list":"unchecked"},"insert":"\n"},{"insert":"Cross off tasks as they're completed. "},{"attributes":{"list":"checked"},"insert":"\n"},{"insert":"You can also create numbered lists for step-by-step instructions."},{"attributes":{"list":"ordered"},"insert":"\n"},{"insert":"We have regular bulleted lists, too."},{"attributes":{"list":"bullet"},"insert":"\n"},{"insert":" \nExperiment with your options in the header!\n"},{"insert":{"divider":true}},{"insert":"Do you want to "},{"attributes":{"bold":true},"insert":"tag your documents"},{"insert":" so they're searchable? Just use \"#\" and start typing, like this  "},{"attributes":{"tag":true},"insert":"tag"},{"insert":"  and  "},{"attributes":{"tag":true},"insert":"this tag"},{"insert":" \n"},{"insert":{"divider":true}},{"insert":"Need to type out your "},{"attributes":{"bold":true},"insert":"math"},{"insert":" homework? We support that with "},{"attributes":{"bold":true},"insert":"LaTeX"},{"insert":"!\n"},{"insert":{"formula":" 1 +  \\frac{q^2}{(1-q)}+\\frac{q^6}{(1-q)(1-q^2)}+\\cdots = \\prod_{j=0}^{\\infty}\\frac{1}{(1-q^{5j+2})(1-q^{5j+3})}, \\quad\\quad \\text{for }\\lvert q\\rvert<1. "}},{"insert":" \nClick   ƒx   in the header, type in your equation, and click \"Add.\"\n"},{"insert":{"divider":true}},{"insert":"Or you can"},{"attributes":{"bold":true},"insert":" insert code"},{"insert":". Your code will be automatically highlighted. We support 22 languages for now, with more to come.\nfunction helloWorld ( ) "},{"attributes":{"code-block":true},"insert":"\n"},{"insert":"{"},{"attributes":{"code-block":true},"insert":"\n"},{"insert":"\tconsole.log(\"Hello World!\");"},{"attributes":{"code-block":true},"insert":"\n"},{"insert":"}?"},{"attributes":{"code-block":true},"insert":"\n"},{"insert":"Just click "},{"attributes":{"width":"20"},"insert":{"image":"data:image/png;base64,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"}},{"insert":" in the header and start typing!\n"},{"insert":{"divider":true}},{"insert":"Oh and yeah, you can also "},{"attributes":{"bold":true},"insert":"embed images and videos"},{"insert":"!\n"},{"attributes":{"italic":true},"insert":"(Important : Your images' size will increase exponentially upon upload. So try to use small images, since they'll impact your save & load time.)"},{"insert":"\n"},{"insert":{"divider":true}},{"insert":"Finally, if you'd like to "},{"attributes":{"bold":true},"insert":"use Cryptee on your phone"},{"insert":", we recommend that you add Cryptee to your smartphone's home screen. It will work like a native application.\nIf you have an "},{"attributes":{"bold":true},"insert":"iPhone/iPad"},{"insert":" you can achieve this by pressing: \n"},{"insert":{"image":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQkAAAAkCAYAAACaLc84AAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAAAVlpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDUuNC4wIj4KICAgPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iPgogICAgICAgICA8dGlmZjpPcmllbnRhdGlvbj4xPC90aWZmOk9yaWVudGF0aW9uPgogICAgICA8L3JkZjpEZXNjcmlwdGlvbj4KICAgPC9yZGY6UkRGPgo8L3g6eG1wbWV0YT4KTMInWQAAD+ZJREFUeAHtXFuMVdUZ/vY+58yFYUCBQWAqzHAraJRKtKb1WtEaGuMlVYNaEx+MqT6Y9KEmjT70rUbjA8YXo7ERbEttaoypKNWUFlTEWqEGAZG7gIAFRmAunNvu96191syeM2dm9jkHmH1O9sqc2WuvvS7/v/71f/tf//73djwmxCm6M5DPA64L7NoFPPkk8OyzwMUXA7kckEhEl+6YsrqZgWTdcFKPjAi/BRBffQXccQewbRtw8iTw8svAjBmABZB65D3mKTIzkIwNicjIYighAgnH8X+nT5vrzjvvAA8+CKxcaYDCk0UhIIlTPAPnaAaceLtxjmb2bHd78CBw333A+vV+z0uWAK++CrS3n+2R4v7iGRg0A87Ro0djn8SgKYngiSyK5maz3bjgzjuR+uYbSGjOLbfg5PPPo49bD7e3F14pi0Jtk9xVamuifJziGShzBpyuri7PkUlbSNp+2PNg3l6v5lhtf6Xaq0wpSHPw3FwM/CvVhy4Hy4N5e01HO4bywTRSfXut+Kj2tizY17Dl3FZ4LS1o2rMHjXffDWzZYpqlZ81C3+rV8ObOhdPdDY/OzH5pEhi8VApOT48BCnNN80V5a2wl8TQcHaZC4V+pOmHL1EVxXZ0rBec0WCeYNxUD/yq5NlKbQNdVZzWOUpCv0Tq1bWw7e25lY8uL+zlfPDnpdNrnqpiC+Dx6M0Clzzc2wtm5E6l77oGzebNP4623Ivvii8gTMJwzZ3wfhUClqQnu7t1IvP02sg8/DDQ0+E9FAjeF6DEZUxS1GXB6e3uNJWHR62wRGETBs9VnJf1US0c57cupG+SlnHZ0IsHj1sPdsQOpZcvgbNpkuvKuvRbpFSvgdXbCoZNTVodDP0bD0qXwFi1C+qWX/EemBJqRx5MdwvuGgIRjlapbqizIj/Jh6th6Ola7/sKOZ8csHk/tR6NjtDFGu24GKONfsL9gvnQXBbkNuujzZOQ5qHzgpFS/wTLlk/qnZI8DzavPnYs+K6GqWjrKaV9O3SAvodtRXkR25OfPR+b115G66y443Ho4H3yAhoceQuaVV5CfMwfuvn1IPf64uebRdyFwMYpfGLTUeAVLeWAtjLA2SrUP8qN8mDq2TTl1bZviYzl9DFd3uHI7VrXXbT9hj8HxgvnS7S0oFF8drtyvV6rfYFn87Kx4PmvhnA5KAxT0Q2TeeAPeVVcZqp1165B64gkkNmxA6qmn4Lz1ll9OUBktCSBSSQ8NKX/3aQFjtHZRvi4egr9iWsXpSNeL60fxPE8m5JMO+8upri/i0Ow4fX19ZTYJ3Xdc8VzPAFeG2Xow2Cp1221wuAUZlC65BNi6FR4tjPTy5f4TEsVVFCwEW1cLrLnZw+ZdCRzqcrD0iiwyGccspqKqtkmkj1IClzfPJG+BjsvtmedAyqGfypVUJ8Hr+jkO6+QdZAsKZOv4NaP7XwDX2MAtYZm3+jyXQJryDSvbOOIyumtgdMqCFsW77yL16KNw1qwB6JfAiRPA8eN+HzrKoTlu3JA+tdAEEFv2JvDom0l8TJB4k4vo9iuzyGZ95Qq7mIZ0PgYF4qcppV24h65uB+k0rS4q0YRxHpobPU4Dn+aQrmYqVx8VpeskwZAAkaIFdUGLQIPl6fAKNAYs9g8pgNuxP4HDxx0DdvaC+LNJmGjPlRdQzpjsoWMGneDMh0lVg4QhgP9qaSGFmZiaqSOtYPL05EKxFEp65NnVBUyd6p8TJJxsFvRQ++eF/2qqLcaGbQn8nb/fXp8jMABff+fgD+tTuOdHWSNXjTC45aBuInMifrRd2nPUxftbkjjGXdZFjUA3Qa+Hvxvn5XHl3DytCQ+f7U7gH9tdNJCxVmrBEWLoRNZdcmkOc6fnkSFARpXvIF3vbUpgZpuHqRM90jxUULaukTXB89tjDrZ+7eKRdoJESMlVBRIaWOtOKJzN6Xl7yFFrqJrLu3VeZj2ZCzpzIsGC6KJ14O7fjxS3FM7atcC0acDhwz551heh80zGgISWvsxvyUpmdZrKsI93oseWZHDyOxe7vnHwCPOrPkzi+CkHbRMGFl8RxkRiCiwR4kcA8enOBP5Kxbl7cQ5zpuXRQsXXNuJbAt+qjQl09ThoZL11X7l44Oocpk3yzLakJw3sPeLi9x8l8TMCxTULcsYkjxo6ik/9QCtCVkETLaIbFmUxsZWF0vqR0JzXZDmt3pgsyy9RMUiIUNGjPdFb/06ilTexGy/J4kwZex0r4KgdBQhJRikyGpU35R7MYvxB5ICCNBp/hABCTzEEEFdc4VsQ8+b5UyrrQhaF7Er6IiQvyY3xVXyBlJlCWnaNbkHAoSPclVB+Cty8/zqWFaooYFPttI+NYhKZAjzd/dfTOnjsxixmESCypFespxJAx0V5/Gqph9/8JYUTtBpeuC+DFm6z0txaiM/WJk7f3BymX5jHinVJLO7Mo4F8SxGjAo6SgYBQ8rFpQfvAuXFIajICSbRrO3WGINhAuXf3+r6mQJVRsxWBhIhVamzy8LdPklj+UQKvcNJzJKZekkChhbEGBxlrINDo7OyknjFAifkxtygkAGquy9fHUzffDGfvXn/aCzETxTIwUilYEkkqzM4DLr6kyWmfZPRwn37dZTmziJIEj74+B2t5N9Yw2vemiRdtE4EfzCPQRFHEWo+kU1ulqbQcLmzxld/4aKVQVHQpRwv9EjfMyaOb/AogemhVGIUjT6qr9TuBbpvp/GV5LqWKSjIip+y270tg50FfdiqTPD78nLIqQai1FKdPyuMy8u3S3+JW4JUtGyREmFITAWI1LYgXPk5g5YMZzCAhvZz8CmjwO4zQf4GABYmFCxfyAcFWAwwdHR3RAgrSmX3tNX/mGJLtEAi0rZC2OLqFKrHcODG5LfF4WxRIfLbTpZkKdE7zKDMphO/Uk4ffLkY5t3Rn0t30NPf2//oigUs7c3T++QqkxRm1JJrICrcXWoekn+eGTP4T2EmT2uicbOXdWHkBRD8frKPzNKfPWA9RY470SMk/+dI1W0DJroeyE19WJ4Mkq0wgd+KUL7uFHXlus0rXDbYrlS8LJCwxAog1/0ni6Q8S+JMAgiZaD+8+RhClRqnBMgFFlsrWyDBoAcU2fstBZdp6jLlFYbSBVo22QbNn+5LvX+1Fk223GjzKeZlPOfTsA4tpFcykg87jHVOapCcA2rsbkKASXU7T2yiYFIcm+c5D9M1w4dVCkt+lONkSsoOEYYy8Ml/I+icsGG4ai/s73+eiS7IZz23R4vl5TG/zZTfc40/V1bVeWlB7jvjbrgFmy6M+NEhoUFkJDXyMtPrTJJ770AeIdloQMlfrCSDsFAoUBAjNfGpggULbDQGFjrI2VGdMksal1cCXb0YeXvUCNIpayVIy8wgKsv54asxvw4mp4Jcrq49f9fZxKIKJuT7yaDVxVfzWahJQy/pTrINkZyyJEsxIxilqt+RcrV9FwBoqmXXG2ms/T2LFp/RBLMugfXL9AoSdFGtRNPFlqQULFtAP2IUDBw4YkBgzgBggzreRZScP95PgglpR0HQBvsUPs0VUubnmV7DXzTH0KrGEjdExyGclJPisV9LyPLXxCZTcJJegjOz50GO1k8JxwnAn9JKH+Bj3Nzf9OYlf0hs+i95iOYPq0YIonhMLFK2trfy85MXYx/ciurnX1+NRWRSRT2EXv1gp8DOEq7B9jOVk1AKNYzk/FY4dCiSETvJwT2mlJ/UXGTzzzyR20EMuD7FMmXpPAoIUnxue5Pcl9/OR42z6AcaPHz+2241zMOkChmH9DkNQ4xwQUG2XtUBjVTyODYOhQMLwRaCQD+zHC3P4NSPz7l2Vwq7DLsbRiVnPQCGAUMyE4iW2b9+OKVOm8Bu0M2rDggi5IOXg0rsaM2kdXr2Q0YaKlajFu3I/zf2Z/hkYWlLkYylVob91VDKVEDm0jXEdlMFSaJDQULJE5S39CSO8lt+axR2vpbC7ABQCkHpLQYDQ042pDHOeOXNm/9ONeuFXslWcQAsD4iYxvLfmQH+IHvh3XK1XrUv9gjzZ6iqz11W3PpPeYvH9T/I5yT0gWZeTQj/dUKcGgTiQgm1uYPDN83wQveyPKbz+QAYdjHDrZXlN3oFKzJgFCH6Uxzz+FEDIH6HHoro25k7LEjRXUyTZ2sVT7p2mmnHPSlujBQM9+WHn3CJydSf5bopxyOomRh61nTJbKuZbaAUbrxwPOb5WYECD+XpKmotmxkcogG771y6OnWYgGZ9QSk+FFTyMmsoCCfWmTjWPAoqbaFH8jgpz+8oU/np/BrNprio0tuYWmRgLJIGAnJKn+YWnHXz9uq2tzQDEmMdHBGisNmvvnFYndLRyM/ngALZSsCxK+aKVrkjSFF8XOHLcxYH/ueii9dtKxVBsSJMJpPLjBjbxPQ+9yzGRvrX2KR6m82mdAspqIQVFYuVly6yO2nM9vp7O4LhJE3LGcprAiFQBYlhOywYJTaAWkxaZgGLJohyeI1odOuHwhZpamN5wNAokZEXUHUBQbpKfnphqleiOonP+9adBeZ6orqnfXyNiGWkD6dSaVETpMb6Y9s7mBLYziGgulWPKeOALgsXGvS5m8kUo1Xvx/RS0+Dt4fddRB+9uddE5ycV1C/yoVHUZxWRkR16NzOyxQChP+5PEq6hTyU2AIGBQEKTiK/Quh8rCpopAQp2LSE1kH4M1llzOSD4OLIeXyms9aSshq2Hy5Mnkx8/XzRaD8tGdxWwtuFBG8iVJmfKFRXaG4cpGcaIoX61FEqfH9If4luPTa5L4+aI8Hv9p1nxHwqxJ1vkvXw+/a1USexh/tvH+LH44nxMhpvg7RWvjs90unnsviQvYj8LR1We0kv9Grt4rMbIRfcMou7lOnTR6yfpqo29pCBzsjSEsbxWDhAbQeqERMfCVGxXUURIw2KjKevJBTKB5/SZfm561y+Vbnz7gDyc2fd3pFCMuJW3t8RWlGbXUv+yYuZcxPKKznWHLegtUH5ARCAgoFs3O4ZnrHfOClwBClrD8E7qmd1nkZ/v+DA/d5FeRplI0AzARYNjS0krZvbEhie/xFfeRZKf6mgd9eEdbLFlY4qVcgBDr8efrIrAAzjcJsiJ6eTc1C89A/cgUcL2ZbzBE6a3IUhSLH//NVv/VaCmFVXLxQOub/wo/5q3iqS/lbXu1kW8tikkWQZ+RHa32EASKZX1zQoBRaYpBotKZq+F25o6iTauxtf3FpsWkFFx4KrPn5lGhrWRqRvOfsQxEtyV8GDKDvAWrGLBgge64UUziy0Y5W3EUk1pcXq3sqsCXKE5hTFOYGTCPARlBOwABYVqNrnjhejm3tcIqd7FiWaqkhMNds3XG8mjjOsqlYTTQHKm/GCRGmp06vWaUIMqaUKfzfjbYqkbZKx3fGJ2VNo7bxTMQz0D9z0AMEvUv45jDeAaqmoEYJKqavrhxPAP1PwP/B2zGkRgO3wznAAAAAElFTkSuQmCC"}},{"insert":" \n\nAnd if you have an "},{"attributes":{"bold":true},"insert":"Android"},{"insert":" you can achieve this by pressing \"Add to Home screen\" in Chrome:\n"},{"attributes":{"width":"160"},"insert":{"image":"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAPAAAAHNCAYAAAAgxvZVAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAACXBIWXMAAAsTAAALEwEAmpwYAAABWWlUWHRYTUw6Y29tLmFkb2JlLnhtcAAAAAAAPHg6eG1wbWV0YSB4bWxuczp4PSJhZG9iZTpuczptZXRhLyIgeDp4bXB0az0iWE1QIENvcmUgNS40LjAiPgogICA8cmRmOlJERiB4bWxuczpyZGY9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogICAgICA8cmRmOkRlc2NyaXB0aW9uIHJkZjphYm91dD0iIgogICAgICAgICAgICB4bWxuczp0aWZmPSJodHRwOi8vbnMuYWRvYmUuY29tL3RpZmYvMS4wLyI+CiAgICAgICAgIDx0aWZmOk9yaWVudGF0aW9uPjE8L3RpZmY6T3JpZW50YXRpb24+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgpMwidZAABAAElEQVR4AeydB5wVRfLHax9vyaAEBUGiipgFAQMqKCoGPDGc6VTM6VDPfGf29K+YFXPA4xQ9MeccEDChYg6oKCggOWdY9t/fWmoYHm+Xzby3W/3ZtzPTuX/Tv67q6pnpHBHJDz93WYpA7dq1pV69epKbmys1atSQvLw8Wbp0qSxYsECWLFmSpa3yahcXgZwQ0QlcXLQyKF6TJk2kZs2a8ueff6atVU5OjjRv3lxJPHPmzLRxysOTcvLz120Xog4MXlYPBrHq4pzAWXan69SpI+utt55Mnjw5qnmLFi2kTZs2sv7668vs2bNl3LhxqxEbIs+aNatcJTKk4bdixQo9GnmiSlXCSbwOqcURhlsX9UqtS0VeO4ErEt1yzttUZLJFbT7uuONkyy23FJPGqNHLli1Tok6fPl2+++47eeCBB6Ja0KnLq0MnEgklbzKZlOXLl0dlVOaJ1YEBjMGLtjGgjB07VutUnPaCad26dYWBkfOpU6fqNMTaweBHG9PhBtbET3WUW6tWrSjfefPmydy5c9cY6Jo2barxyId7t3jxYpkxY0ZqdkVeO4GLhCdzAukUdDDIAnH32Wcf2XDDDZWsU6ZMUQlLJyNe48aNNYxOhKR+9dVX5YknntBOumjRojI3ykjbsWNHLe+HH34QI1OZMy9FBp06dZKWLVsqecFn2LBhagcoTlZglGorKGtbmNpgh4g7bBUQ1Bz3KN3UpjB/S5d6dAKnIpKB15CSDgD5rr76atlll120040ePVo++eQTJfUGG2ygUohOMW3aNB3Zd9ppJ+ncubMSn059/fXXq1Qgn3QSZW1Njw8ibdu2VenP4PH555+rlCpMEjPQMPiQnvrFOzJlNmvWTNuD+o9mwY/6ofan5kkehG266abaXqRXo0aNpGHDhuqPBKZOHImHNE4n/Swfa3O3bt100Pvqq6/kjz/+0LoS56ijjpL69eurVLY0EHzhwoWCZH399de17kZ6JLkNkptvvrm0b99epzUfffSRSlnqS/swMrZq1Ur+8pe/qAaFxvT000+rRLdwq1tRx2RRgR6WOQjQeXDcXNS2QYMGKWkOOOAA2XjjjfUckmDAodP//vvv8uKLL8p7770nJ598sjRo0EDT09FK60wDoFNCICTN2gxGECtVzTRVn3own4dwOOJCNjq3OeLSZsiNMxKZ9d3aCwEMI8I4h8Tp2mtkg5jnnnuuoIJTBu1hgIHAnJN+xx13VI3G2klaJDbTljlz5sgLL7yggyJ5IXWpJxpS165dddAlHoMsBKatEJ/27bHHHnL88cerVkR+W2+9tab5z3/+I8OHD9c8ibs25wReG0IZEI4kMal17733qlQ555xzZP/999dO9vPPP8uvv/6qZEK93WSTTVQ6brHFFtrBjj32WB3taQqdgvxK6kxtbteunWy22WbFIi+kgJC777677LDDDqoZDBkyROfplG9Gtx49emg7RowYoR23X79+Kn1R+yERpLDBCQkHAXr16qWDCBLNiBtvE34MZKQ36WdqrcVncGDQAFvyRw3niCMOpP3ggw8iCQx5iYu2c9BBB6mNgbhgGicbgyV5owlxLyAuDgwt/yOOOEIHhueff14mTJggbYNGgzRG4kNg4lGHtd0rJ7BCm/n/6IjM11AJcailGDyGDh2qHbx79+4qFeg0+DHy0xnolHTk3377TdOnzveK03IjL5LXyEuedNLCnBFt3333lUMPPVTmz5+vUga1EVUeElDXbbfdVs466yz58ssvBQJzjkpMx6cD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l/eR8qyMdOWXd3llzS9dXfErqytJHqwnspeybQZX1rI9/bpBICJwaYs38rBX6ahRo2TRokVrkPj777+XX3/9dbUiSGc/C0i9xh+/uEuNwzUdlz2A33zzzWjP4Xi8+Hk8L84tjGOqKyosXdp4HnYez8P8IM5bb70lkydPXgMri2N1iac3v9RjPE38vKg6jh8/Xu68806ZP3++ZgeRU9OmluPXmYOA3au0BLbA4lTX4k6cOFEXl19//fU1kt1///1i/sSns6RKIfzNL55BqlRJF4f4c+bMkdtvv10JzLXFi+drdSWc83gY8ePSKDXM4pMWly48XlfO08UhLYPcPffcI3/++SeXwhLeiy++KNOnT1+N0Knp4/XThOGfxfnpp5/k7bff1vQWlooz/pYHG5pfdNFFatHEH6OI1Zlrd9mBQFoCxzticZthj3gdcsgh8vPPP6/WGSAXnRZHhzOLN+Zw0lEeP86tg1m5xE91Vhb+VtcNNthA7rjjDmnevLlGtziEY3JfvpzvXheoqdbprUwkIo56EWbh+FFHS0v81HBLa3mRBmft4tziWLsbNGggN910k2yyySYE66Bz0EEHyYQJE/SaMnBWXjy9hWmE8M+uR48eLdddd522lTD8rbz4MqFtam7PvtetW1ezIg7OytQL/5exCHCfcNF+ouZR2hqTfuedd5bNN99cbrzxRrnrrruEJ0XoSLboTN50qnnz5smrr74qY8eO1ZcoevXqJTvssIOg1r377rvC450sUkO8oUOHSvfu3aV9+/ZatQ8++ECmTZsmffv21Wvyp2xUQTpxs2bNNO2wYcOUfDx69tFHH2mcfffdVzp16qTnJP7kk09k+PDhStBWrVpJnz59dJGcMOr42muvaR3p9N26dZPdd989IgUq+0svvaSDFWk7dOig04S//vWv2qbHH39ctthiCxk3bpz8+OOPsuGGG2qdN9poIx3MeJaV+owZM0YGDx4sHTt21OPBBx8sPXr0oAryww8/yBtvvKHxGzVqJPvvv7+0bt1aMbX7RfufeuopxRMSohYfccQRsvHGGwvTGjQf6kC8nXbaSdsAeRkoGezAE+mN9O/atavss88+wsMChqtWxP9lHALcH1xaCVya2pIhkpfHvOh0L7zwQpSNSUA8eGAE9RGi7rrrrtKyZUvt2MyRkQannHJKJIlQy4877jgZMWJElNeg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Du11G0oiP6jQZZC8ZGiZxmsAqdP5x+P4uSPgCJQOgYQkeZCjpiRq1w38NQbbsfiZLl26VPfkZV9edrdnP1+24SwP8ppkJ++3335b86Zm5l/8WpY+ppX1zTffyOeff176jDylI1COCCRlxRJd/81HAkeu+O8TmoQdP368DBw4UHewh7hs6M0GxH379pWtt95ayQaZjQip51Y04fzYZ8jObRCYPn267L333kJZDRs2XC0v0lvenMfz5xqHH1tuxvcwsjTx+FaehdkRfwYQNufeYYcdNM94GB7x6/i5RvZ/jkA5IWB9K5m/MHyJY3F4EitI4dI4MqJjz58/X+666y55/fXXpWnTprq7/HvvvSennHKKPPfcc7orfCp54kTh3PIyf478SGfn1NHC40SM+1s7LJ5dc4ynsfIs3OKbv13bkXiEmUttj6WzcEuX6m/hfnQEyopAcsXipeFd4LywDhy+D71qJbjE+bI3Lm7nnXdW6cj5FltsIf/85z/l+++/VwJDnry8PPn6669lwoQJst566+kO9w0aNIjISzri//rrr1KnTh3ZfvvtpUmT8LGB4OKE4BoCffTRRzpgbLrppvLFF19Iy5YtZfLkyfLHH3/IRhttJJ07d5Z58+bpRtxoBptvvrlssskmUXnkQbpJkyZJvXr1tD6NGjUie60jajv1/PLLL2W33XaT+vXry5w5czSc9lDWd999J126dNF4lDV69GhV8ym/U6dOUqNGjag8Tej/HIEyIBAXCIkVS+aFr3GED9rFn59cJWSKXYxJJkhijrkwzgixbNky+c9//iPXXnutqqEvv/yyXHLJJTJlyhQlJ3k888wzcuGFFyqhRo4cKWeffbaMHTtW84FsOAiBGzJkiJxzzjlSu3ZtIe8rrrhCrr76avnggw90ADjhhBNk8ODBMmjQIPnxxx/ls88+k6OPPloHCAaDBQsWyK233qqqP3WlPldeeaWgquOY72677bZy++23y9ChQ3Uzb0i7aNEiDafeJ510kuYN+Zn333zzzfLKK69om6gPWsmSJUuiwUcT+j9HoAwI0HeNb8lE7fAy/9KwhlROG40++eSTKokwat1zzz3y4IMPynbbbafV/eSTT1SlRgIjndndHrJCMIg8ZswYOeyww2TEiBGy4447KlEg2P/93//Jww8/HBEXAr/xxhvSr18/lYxt2rRRMr7zzjsy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LmqHDh2y7VLm888/l08//VR+9KMfmWVs0EBflBYQZdatWyeLFi2SV1991b7Fy0e6+S6vA37p0qWycuVKy2vXrp1su+22/wICWPJ50QEDBmQ/K+oDC9tWrVpZPcp5ej6+5K9Zs8a8AT72vXjxYvMoqL/zzjvLqlWr7Hw4D2TZfvvts7Kg/48//li+/PJL+0YxOnE9wReiDGl4NB999JFtaWevvfTNjkE+nsjChQttOuJtU4/rwVRkhx12kE8++UTatGkjfBcZ4ph85CwuLrZ2vD3qkA9Rp1mzZpbP9WGgbt68uclOefKbNm2aldUqxZ9a10CNB7H+9re/yaBBg+Twww+XffbZR0499VQDInNJQPD666/LL37xC+nbt6+BC+vbokWLrAWcP3++XH755QYeOhWdFmDSSSDvXHS6Rx55xDrU7NmzrTOddtppBuDJkyfL73//e+nTp491MOQ499xzrQN6/VCzfJQbgIfEMeAO6dlnn5U77rjDZKdj77333vKzn/3MwAAIL7jgAhk8eLCBd8GCBZY+ZMgQef75500uzv3HP/6xnHfeeQZirPxDDz0kzz33nOy7774yY8YMs/qHHnpo9jxdXsB01113yYcffih77LGHDVx4CEceeaTpgEHx+uuvtw+MN27c2IB+5ZVX2gA6Z84cueqqq2yq8vDDD8vEiRNNtj//+c/yxBNPWJk33njDzuXoo482fgxUN9xwg8lJnIDrAD+uBR4Pcvfv39+8p7lz59rARBsRxGGPqb397CB/2513JL+56frkuptvSL5et077S5Io2Gxb0R8vr6ACZYkGnayqgjhRMGXZ6Mht+ffee2+iHTJZvnx5Mnr06KRz586JWo9EO0miX7tPrrvuukTntvav81Oroxbb+HhbGzduTGjv5JNPTv70pz8lOme1fO2sVn7KlCmJWulELXminTJR4JWqr53SjpEPmV988cXklVdeSV5++eVErXqiYLV0HZCsnAba/oWvgjW59dZbLV8HEct/+umn7Vxo9yc/+Umy0047JeQh31tvvWVldF5tdWhD5/eJWuwEeTR2kOjAkSxZssTyOVeXE77IqV6FXZ+nnnrKjtW627EOJMnVV1+dfPHFF9a+gj1RMCXoifOh7pNPPpnowJOsX+YW8tkAAAhkSURBVL/e2tpll10SHRCsDZdfLbjx08Ew0RiA6fDrr79O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"}},{"insert":"\n\n"},{"insert":{"divider":true}},{"insert":"If you have a question or run into any problems, let us know via the \"Report Bug\" section or check out our "},{"attributes":{"link":"https://cryptee.kayako.com"},"insert":"support"},{"insert":".\n"}]};
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
}

function fixFilesAndFolders () {
  showDocProgress("This is taking too long...<br>One second. Going to ask the chef to see what's going on...");
  fixFolders();
}

function fixFolders () {
  foldersRef.once('value', function(snapshot) {
    var allFolders = snapshot.val();
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
    var folderTitle = $(this).find(".folder-title").html().trim();
    var folderID = $(this).attr("id");
    ftitles[folderID] = JSON.stringify(folderTitle);
  });

  var dtitles = {};
  $(".adoc").each(function(index, el) {
    var docTitle = $(this).find(".doctitle").html().trim();
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
        docsArray[index].fname = $("#" + did).parents(".afolder").find(".folder-title").html();
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
  if (extension.match(/^(c|cake|clojure|coffee|jsx|cpp|cs|css|less|scss|csx|gfm|git-config|go|gotemplate|java|java-properties|js|jquery|regexp|json|litcoffee|makefile|nant-build|objc|objcpp|perl|perl6|plist|python|ruby|rails|rjs|sass|shell|sql|mustache|strings|toml|yaml|git-commit|git-rebase|html|erb|gohtml|jsp|php|py|junit-test-report|shell-session|xml|xsl)$/i)) {
    icon = "fa fa-fw fa-file-code-o";
  }
  if (extension.match(/^(7z|bz2|tar|gz|rar|zip|zipx|dmg|pkg|tgz|wim)$/i)) {
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

function newFolder (){
  $("#new-folder-button").removeClass("is-armed");
  var newFTitle = $("#new-folder-title").val().trim();
  var fid = "f-" + newUUID();
  var fcount = 0;
  var folderData = {
      folderid : fid,
      count : fcount,
      open : true
    };

  dataRef.update({"foldersCount" : foldersCount+1});
  foldersRef.child(fid).update(folderData);

  titlesObject.folders[fid] = JSON.stringify(newFTitle);
  updateTitles();

  $("#new-folder-title").val("");
  updateFolderIndexes();

  $("#first-folder-hint").hide();
}














/////////////////////
// DELETE FOLDER //
/////////////////////


$('#all-folders').on('click', '.delete-folder-confirm', function(event) {
    deleteFolder($(this).parents(".afolder"));
    $(this).addClass("is-loading").prop("disabled", true);
    $(this).parents(".afolder").find(".delete-folder-cancel").addClass("is-loading").prop("disabled", true);
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

    var docRef = rootRef.child(docID + ".crypteedoc");
    delete titlesObject.docs[docID];
    docRef.delete().then(function(){}).catch(function(error) {
      handleError(error);
    });

    var fileRef = rootRef.child(docID + ".crypteefile");
    fileRef.delete().then(function(){}).catch(function(error) {
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
  var folderOldName = $(this).parents(".afolder").find(".folder-title").html();
  $("#rename-folder-input").attr("placeholder", folderOldName).val(folderOldName);
  $("#rename-folder-modal").addClass('is-active').attr("fid", fid);
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
  ghostFTitleToConfirm = $(this).parents(".afolder").find(".folder-title").html();
  fidToGhost = $(this).parents(".afolder").attr("id");
  $("#ghost-folder-confirm-input").attr("placeholder", ghostFTitleToConfirm);
  saveDoc(prepareForGhostFolderModal);
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
      $("#ghost-folder-confirm-button").prop("disabled", false);
    } else {
      $("#ghost-folder-confirm-button").prop("disabled", true);
    }

    if (event.keyCode == 27) {
      $("#ghost-folder-confirm-button").prop("disabled", true);
      $("#ghost-folder-confirm-input").val("");
      $("#ghost-folder-confirm-input").blur();
      $("#ghost-folder-modal").removeClass('is-active');
    }
  }, 50);
});

function makeGhostFolder () {
  $("#ghost-folder-confirm-button").addClass("is-loading").prop("disabled", true);

  var ghostTitles = {};
  ghostTitles.docs = {};
  ghostTitles.fid = fidToGhost;
  ghostTitles.fname = JSON.stringify(ghostFTitleToConfirm);
  $("#docs-of-" + fidToGhost).children(".adoc").each(function(index, doc){
    ghostTitles.docs[doc.id] = JSON.stringify($("#" + doc.id).find(".doctitle").html());
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
            $("#ghost-folder-confirm-button").prop("disabled", true);
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

  $("#homedoc").prop("disabled", false);
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

    //get necessary variables
    var fid = $("#" + did).parents(".afolder").attr("id");
    var docRef = rootRef.child(did + ".crypteedoc");
    var dtitle = $("#"+did).find(".doctitle").html();

    $(".outdated-message").fadeOut();
    $(".outdated-save-message").fadeOut();

    //DOWNLOAD _DOC
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
            var preview = true;
            downloadFile(did, dtitle, preview, callback, callbackParam);
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
        $("#homedoc").prop("disabled", false);
        $("#homedoc").removeClass("is-dark");
        $("#doc-contextual-button").fadeIn(100);
      } else {
        $("#homedoc").addClass("is-dark");
        $("#homedoc").prop("disabled", true);

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
        var urlToPass = "https://flare.crypt.ee/download?dlddid=" + did;
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
      $('#file-viewer-contents').html('<a class="unsupported-file-preview clickable openInSafari" href="https://flare.crypt.ee/download?dlddid='+did+'" target="_blank"><p><b>'+dtitle+'</b></p><span class="icon is-large"><i class="fa fa-download"></i></span><br><p class="deets">Unfortunately it isn\'t possible to preview this filetype on your device in browser/app yet. Click here to download/open the file.</p></a>');
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

var isDragDocOver = false, draginterval;
$("#all-folders").on('dragover', '.folder', function(e) {
    e.preventDefault();

    clearInterval(draginterval);

    draginterval = setInterval(function() {
        isDragDocOver = false;
        clearInterval(draginterval);
        $(this).removeClass("drophover");
        /*** callback for onDragLeave ***/
    }, 10);

    if (!isDragDocOver) {
        isDragDocOver = true;
          $(this).addClass("drophover");
        /*** callback for onDragEnter ***/
    }
});








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
  var inactiveTitle = $("#" + did).find(".doctitle").html();
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
  var dtitle = $(this).parents(".adoc").find(".doctitle").html();

  if (did !== activeDocID) {
    uncheckedicon.hide();
    checkedicon.css('display', 'inline-block');

    if ($(this).parents(".adoc").hasClass("itsAFile")) {
      selectedFiles++;
    } else {
      selectedDocs++;
    }

    selectionArray.push({ did : did , dtitle : dtitle});
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
    var dtitle = $(this).parents(".adoc").find(".doctitle").html();

    if (did !== activeDocID) {
      uncheckedicon.hide(); exticon.hide();
      checkedicon.css('display', 'inline-block');

      if ($(this).parents(".adoc").hasClass("itsAFile")) {
        selectedFiles++;
      } else {
        selectedDocs++;
      }

      selectionArray.push({ did : did , dtitle : dtitle});
      toggleSelectionActions();
    }

    floatDelete = true;
    showDeleteSelectionsModal();

  }
});


function hideDeleteSelectionsModal () {
  $("#delete-selections-modal").find(".button").removeClass("is-loading").prop("disabled", false);
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
  $("#delete-selections-modal").find(".button").addClass("is-loading").prop("disabled", true);
  completedDeletions = 0;
  $.each(selectionArray, function(index, selection) {
    var fid = $("#" + selection.did).parents(".afolder").attr("id");

    var docRef = rootRef.child(selection.did + ".crypteedoc");
    var fileRef = rootRef.child(selection.did + ".crypteefile");

    if (selection.did === activeFileID) {
      hideFileViewer ();
    }

    docRef.delete().then(function() {
      foldersRef.child(fid + "/count").once('value', function(snapshot) {
        var fcount = snapshot.val();
        foldersRef.child(fid).update({"count" : fcount-1}, function(){
          $("#" + fid).attr("count", fcount-1);
          foldersRef.child(fid + "/docs/" + selection.did).remove();
          areDeletionsComplete(selection.did, fid);
        });
      });
    }).catch(function(error) {
      fileRef.delete().then(function() {
        foldersRef.child(fid + "/count").once('value', function(snapshot) {
          var fcount = snapshot.val();
          foldersRef.child(fid).update({"count" : fcount-1}, function(){
            $("#" + fid).attr("count", fcount-1);
            foldersRef.child(fid + "/docs/" + selection.did).remove();
            areDeletionsComplete(selection.did, fid);
          });
        });
      }).catch(function(error) {
        if (error.code === "storage/object-not-found") {
          foldersRef.child(fid + "/docs/" + selection.did).remove();
          areDeletionsComplete(selection.did, fid);
        } else {
          handleError(error);
          $(".delete-selections-status").removeClass("is-light is-warning is-danger").addClass("is-danger").html("<p class='title'>Error Deleting Doc... Sorry.. Please Reload the page.</p>");
        }
      });
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
    var tagContent = $(this).html().replace("&nbsp;", "");
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
    handleError(err);
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
          showFileUploadStatus("is-warning", processingMessage);
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
          '<div class="upload" id="upload-'+pid+'">'+
            '<progress class="progress is-small is-danger" value="100" max="100"></progress>'+
            '<p class="deets"><b class="fn">'+filename+'</b> (<span class="fs">Error</span>)</p>'+
          '</div>';
          $("#upload-status-contents").append(uploadElem);
        }
      });
  });
}

function fileUploadComplete(fid, did, filename, filesize, callback, callbackParam) {
  numFilesLeftToBeUploaded--;
  numFilesUploaded++;

  callback = callback || noop;
  callbackParam = callbackParam || did;
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
  $("#attachment-modal").find(".modal-background").css("background-image", 'none');
}

function hideAttachmentSelector () {
  $("#attachment-modal").removeClass("is-active");
  $("#attachment-target-box").hide();
  $("#attachment-modal").find(".modal-background").css("background-image", 'none');
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
      $("#attachment-modal").find(".modal-background").css("background-image", 'url(' + base64FileContents + ')');
    };
    reader.onerror = function(err){
      fileUploadError = true;
      handleError(err);
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
  var attachmentTitle = $(this).find(".doctitle").html();

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

  quill.setText('\n');
  quill.clipboard.dangerouslyPasteHTML(1, rawHTML);

  dataRef.update({"lastOpenDocID" : did});
  sessionStorage.setItem('session-last-did', JSON.stringify(did));

  var milliseconds = (new Date()).getTime();
  sessionStorage.setItem('session-last-loaded', JSON.stringify(milliseconds));

  $("#homedoc").prop("disabled", false);
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

      //set doc title in taskbar
      $("#active-doc-title").html(newDocName);
      $("#active-doc-title-input").val(newDocName);
      document.title = newDocName;
      $("#active-doc-title-input").attr("placeholder", newDocName);
      $("#" + activeDocID).find(".doctitle").html(newDocName);
        callback(callbackParam);
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

  quill.setText('\n');
  quill.clipboard.dangerouslyPasteHTML(1, rawHTML);

  dataRef.update({"lastOpenDocID" : did});
  sessionStorage.setItem('session-last-did', JSON.stringify(did));

  var milliseconds = (new Date()).getTime();
  sessionStorage.setItem('session-last-loaded', JSON.stringify(milliseconds));

  $("#homedoc").prop("disabled", false);
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

      //set doc title in taskbar
      $("#active-doc-title").html(newDocName);
      $("#active-doc-title-input").val(newDocName);
      document.title = newDocName;
      $("#active-doc-title-input").attr("placeholder", newDocName);
      $("#" + activeDocID).find(".doctitle").html(newDocName);
        callback(callbackParam);
    });
  });
}




















//
