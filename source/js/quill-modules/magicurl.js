!function(t,e){if("object"==typeof exports&&"object"==typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var r=e();for(var n in r)("object"==typeof exports?exports:t)[n]=r[n]}}("undefined"!=typeof self?self:this,function(){return function(t){function e(n){if(r[n])return r[n].exports;var i=r[n]={i:n,l:!1,exports:{}};return t[n].call(i.exports,i,i.exports,e),i.l=!0,i.exports}var r={};return e.m=t,e.c=r,e.d=function(t,r,n){e.o(t,r)||Object.defineProperty(t,r,{configurable:!1,enumerable:!0,get:n})},e.n=function(t){var r=t&&t.__esModule?function(){return t.default}:function(){return t};return e.d(r,"a",r),r},e.o=function(t,e){return Object.prototype.hasOwnProperty.call(t,e)},e.p="",e(e.s=2)}([function(t,e,r){function n(t){return null===t||void 0===t}function i(t){return!(!t||"object"!=typeof t||"number"!=typeof t.length)&&("function"==typeof t.copy&&"function"==typeof t.slice&&!(t.length>0&&"number"!=typeof t[0]))}function o(t,e,r){var o,l;if(n(t)||n(e))return!1;if(t.prototype!==e.prototype)return!1;if(f(t))return!!f(e)&&(t=s.call(t),e=s.call(e),a(t,e,r));if(i(t)){if(!i(e))return!1;if(t.length!==e.length)return!1;for(o=0;o<t.length;o++)if(t[o]!==e[o])return!1;return!0}try{var p=u(t),h=u(e)}catch(t){return!1}if(p.length!=h.length)return!1;for(p.sort(),h.sort(),o=p.length-1;o>=0;o--)if(p[o]!=h[o])return!1;for(o=p.length-1;o>=0;o--)if(l=p[o],!a(t[l],e[l],r))return!1;return typeof t==typeof e}var s=Array.prototype.slice,u=r(5),f=r(6),a=t.exports=function(t,e,r){return r||(r={}),t===e||(t instanceof Date&&e instanceof Date?t.getTime()===e.getTime():!t||!e||"object"!=typeof t&&"object"!=typeof e?r.strict?t===e:t==e:o(t,e,r))}},function(t,e,r){"use strict";var n=Object.prototype.hasOwnProperty,i=Object.prototype.toString,o=function(t){return"function"==typeof Array.isArray?Array.isArray(t):"[object Array]"===i.call(t)},s=function(t){if(!t||"[object Object]"!==i.call(t))return!1;var e=n.call(t,"constructor"),r=t.constructor&&t.constructor.prototype&&n.call(t.constructor.prototype,"isPrototypeOf");if(t.constructor&&!e&&!r)return!1;var o;for(o in t);return void 0===o||n.call(t,o)};t.exports=function t(){var e,r,n,i,u,f,a=arguments[0],l=1,p=arguments.length,h=!1;for("boolean"==typeof a&&(h=a,a=arguments[1]||{},l=2),(null==a||"object"!=typeof a&&"function"!=typeof a)&&(a={});l<p;++l)if(null!=(e=arguments[l]))for(r in e)n=a[r],i=e[r],a!==i&&(h&&i&&(s(i)||(u=o(i)))?(u?(u=!1,f=n&&o(n)?n:[]):f=n&&s(n)?n:{},a[r]=t(h,f,i)):void 0!==i&&(a[r]=i));return a}},function(t,e,r){"use strict";function n(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}Object.defineProperty(e,"__esModule",{value:!0});var i=function(){function t(t,e){var r=[],n=!0,i=!1,o=void 0;try{for(var s,u=t[Symbol.iterator]();!(n=(s=u.next()).done)&&(r.push(s.value),!e||r.length!==e);n=!0);}catch(t){i=!0,o=t}finally{try{!n&&u.return&&u.return()}finally{if(i)throw o}}return r}return function(e,r){if(Array.isArray(e))return e;if(Symbol.iterator in Object(e))return t(e,r);throw new TypeError("Invalid attempt to destructure non-iterable instance")}}(),o=Object.assign||function(t){for(var e=1;e<arguments.length;e++){var r=arguments[e];for(var n in r)Object.prototype.hasOwnProperty.call(r,n)&&(t[n]=r[n])}return t},s=function(){function t(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,n.key,n)}}return function(e,r,n){return r&&t(e.prototype,r),n&&t(e,n),e}}(),u=r(3),f=function(t){return t&&t.__esModule?t:{default:t}}(u),a={globalRegularExpression:/https?:\/\/[\S]+/g,urlRegularExpression:/(https?:\/\/[\S]+)/},l=function(){function t(e,r){n(this,t),this.quill=e,r=r||{},this.options=o({},a,r),this.registerTypeListener(),this.registerPasteListener()}return s(t,[{key:"registerPasteListener",value:function(){var t=this;this.quill.clipboard.addMatcher(Node.TEXT_NODE,function(e,r){if("string"==typeof e.data){var n=e.data.match(t.options.globalRegularExpression);if(n&&n.length>0){var i=new f.default,o=e.data;n.forEach(function(t){var e=o.split(t),r=e.shift();i.insert(r),i.insert(t,{link:t}),o=e.join(t)}),i.insert(o),r.ops=i.ops}return r}})}},{key:"registerTypeListener",value:function(){var t=this;this.quill.on("text-change",function(e){var r=e.ops;if(!(!r||r.length<1||r.length>2)){var n=r[r.length-1];n.insert&&"string"==typeof n.insert&&n.insert.match(/\s/)&&t.checkTextForUrl()}})}},{key:"checkTextForUrl",value:function(){var t=this.quill.getSelection();if(t){var e=this.quill.getLeaf(t.index),r=i(e,1),n=r[0];if(n.text){var o=n.text.match(this.options.urlRegularExpression);if(o){var s=n.text.length-o.index,u=t.index-s;this.textToUrl(u,o[0])}}}}},{key:"textToUrl",value:function(t,e){var r=(new f.default).retain(t).delete(e.length).insert(e,{link:e});this.quill.updateContents(r)}}]),t}();e.default=l,window.Quill&&window.Quill.register("modules/magicUrl",l)},function(t,e,r){var n=r(4),i=r(0),o=r(1),s=r(7),u=String.fromCharCode(0),f=function(t){Array.isArray(t)?this.ops=t:null!=t&&Array.isArray(t.ops)?this.ops=t.ops:this.ops=[]};f.prototype.insert=function(t,e){var r={};return 0===t.length?this:(r.insert=t,null!=e&&"object"==typeof e&&Object.keys(e).length>0&&(r.attributes=e),this.push(r))},f.prototype.delete=function(t){return t<=0?this:this.push({delete:t})},f.prototype.retain=function(t,e){if(t<=0)return this;var r={retain:t};return null!=e&&"object"==typeof e&&Object.keys(e).length>0&&(r.attributes=e),this.push(r)},f.prototype.push=function(t){var e=this.ops.length,r=this.ops[e-1];if(t=o(!0,{},t),"object"==typeof r){if("number"==typeof t.delete&&"number"==typeof r.delete)return this.ops[e-1]={delete:r.delete+t.delete},this;if("number"==typeof r.delete&&null!=t.insert&&(e-=1,"object"!=typeof(r=this.ops[e-1])))return this.ops.unshift(t),this;if(i(t.attributes,r.attributes)){if("string"==typeof t.insert&&"string"==typeof r.insert)return this.ops[e-1]={insert:r.insert+t.insert},"object"==typeof t.attributes&&(this.ops[e-1].attributes=t.attributes),this;if("number"==typeof t.retain&&"number"==typeof r.retain)return this.ops[e-1]={retain:r.retain+t.retain},"object"==typeof t.attributes&&(this.ops[e-1].attributes=t.attributes),this}}return e===this.ops.length?this.ops.push(t):this.ops.splice(e,0,t),this},f.prototype.chop=function(){var t=this.ops[this.ops.length-1];return t&&t.retain&&!t.attributes&&this.ops.pop(),this},f.prototype.filter=function(t){return this.ops.filter(t)},f.prototype.forEach=function(t){this.ops.forEach(t)},f.prototype.map=function(t){return this.ops.map(t)},f.prototype.partition=function(t){var e=[],r=[];return this.forEach(function(n){(t(n)?e:r).push(n)}),[e,r]},f.prototype.reduce=function(t,e){return this.ops.reduce(t,e)},f.prototype.changeLength=function(){return this.reduce(function(t,e){return e.insert?t+s.length(e):e.delete?t-e.delete:t},0)},f.prototype.length=function(){return this.reduce(function(t,e){return t+s.length(e)},0)},f.prototype.slice=function(t,e){t=t||0,"number"!=typeof e&&(e=1/0);for(var r=[],n=s.iterator(this.ops),i=0;i<e&&n.hasNext();){var o;i<t?o=n.next(t-i):(o=n.next(e-i),r.push(o)),i+=s.length(o)}return new f(r)},f.prototype.compose=function(t){for(var e=s.iterator(this.ops),r=s.iterator(t.ops),n=new f;e.hasNext()||r.hasNext();)if("insert"===r.peekType())n.push(r.next());else if("delete"===e.peekType())n.push(e.next());else{var i=Math.min(e.peekLength(),r.peekLength()),o=e.next(i),u=r.next(i);if("number"==typeof u.retain){var a={};"number"==typeof o.retain?a.retain=i:a.insert=o.insert;var l=s.attributes.compose(o.attributes,u.attributes,"number"==typeof o.retain);l&&(a.attributes=l),n.push(a)}else"number"==typeof u.delete&&"number"==typeof o.retain&&n.push(u)}return n.chop()},f.prototype.concat=function(t){var e=new f(this.ops.slice());return t.ops.length>0&&(e.push(t.ops[0]),e.ops=e.ops.concat(t.ops.slice(1))),e},f.prototype.diff=function(t,e){if(this.ops===t.ops)return new f;var r=[this,t].map(function(e){return e.map(function(r){if(null!=r.insert)return"string"==typeof r.insert?r.insert:u;var n=e===t?"on":"with";throw new Error("diff() called "+n+" non-document")}).join("")}),o=new f,a=n(r[0],r[1],e),l=s.iterator(this.ops),p=s.iterator(t.ops);return a.forEach(function(t){for(var e=t[1].length;e>0;){var r=0;switch(t[0]){case n.INSERT:r=Math.min(p.peekLength(),e),o.push(p.next(r));break;case n.DELETE:r=Math.min(e,l.peekLength()),l.next(r),o.delete(r);break;case n.EQUAL:r=Math.min(l.peekLength(),p.peekLength(),e);var u=l.next(r),f=p.next(r);i(u.insert,f.insert)?o.retain(r,s.attributes.diff(u.attributes,f.attributes)):o.push(f).delete(r)}e-=r}}),o.chop()},f.prototype.eachLine=function(t,e){e=e||"\n";for(var r=s.iterator(this.ops),n=new f,i=0;r.hasNext();){if("insert"!==r.peekType())return;var o=r.peek(),u=s.length(o)-r.peekLength(),a="string"==typeof o.insert?o.insert.indexOf(e,u)-u:-1;if(a<0)n.push(r.next());else if(a>0)n.push(r.next(a));else{if(!1===t(n,r.next(1).attributes||{},i))return;i+=1,n=new f}}n.length()>0&&t(n,{},i)},f.prototype.transform=function(t,e){if(e=!!e,"number"==typeof t)return this.transformPosition(t,e);for(var r=s.iterator(this.ops),n=s.iterator(t.ops),i=new f;r.hasNext()||n.hasNext();)if("insert"!==r.peekType()||!e&&"insert"===n.peekType())if("insert"===n.peekType())i.push(n.next());else{var o=Math.min(r.peekLength(),n.peekLength()),u=r.next(o),a=n.next(o);if(u.delete)continue;a.delete?i.push(a):i.retain(o,s.attributes.transform(u.attributes,a.attributes,e))}else i.retain(s.length(r.next()));return i.chop()},f.prototype.transformPosition=function(t,e){e=!!e;for(var r=s.iterator(this.ops),n=0;r.hasNext()&&n<=t;){var i=r.peekLength(),o=r.peekType();r.next(),"delete"!==o?("insert"===o&&(n<t||!e)&&(t+=i),n+=i):t-=Math.min(i,t-n)}return t},t.exports=f},function(t,e){function r(t,e,r){if(t==e)return t?[[b,t]]:[];(r<0||t.length<r)&&(r=null);var i=s(t,e),o=t.substring(0,i);t=t.substring(i),e=e.substring(i),i=u(t,e);var f=t.substring(t.length-i);t=t.substring(0,t.length-i),e=e.substring(0,e.length-i);var l=n(t,e);return o&&l.unshift([b,o]),f&&l.push([b,f]),a(l),null!=r&&(l=p(l,r)),l=h(l)}function n(t,e){var n;if(!t)return[[y,e]];if(!e)return[[g,t]];var o=t.length>e.length?t:e,s=t.length>e.length?e:t,u=o.indexOf(s);if(-1!=u)return n=[[y,o.substring(0,u)],[b,s],[y,o.substring(u+s.length)]],t.length>e.length&&(n[0][0]=n[2][0]=g),n;if(1==s.length)return[[g,t],[y,e]];var a=f(t,e);if(a){var l=a[0],p=a[1],h=a[2],c=a[3],v=a[4],d=r(l,h),x=r(p,c);return d.concat([[b,v]],x)}return i(t,e)}function i(t,e){for(var r=t.length,n=e.length,i=Math.ceil((r+n)/2),s=i,u=2*i,f=new Array(u),a=new Array(u),l=0;l<u;l++)f[l]=-1,a[l]=-1;f[s+1]=0,a[s+1]=0;for(var p=r-n,h=p%2!=0,c=0,b=0,v=0,d=0,x=0;x<i;x++){for(var m=-x+c;m<=x-b;m+=2){var j,k=s+m;j=m==-x||m!=x&&f[k-1]<f[k+1]?f[k+1]:f[k-1]+1;for(var O=j-m;j<r&&O<n&&t.charAt(j)==e.charAt(O);)j++,O++;if(f[k]=j,j>r)b+=2;else if(O>n)c+=2;else if(h){var w=s+p-m;if(w>=0&&w<u&&-1!=a[w]){var A=r-a[w];if(j>=A)return o(t,e,j,O)}}}for(var E=-x+v;E<=x-d;E+=2){var A,w=s+E;A=E==-x||E!=x&&a[w-1]<a[w+1]?a[w+1]:a[w-1]+1;for(var T=A-E;A<r&&T<n&&t.charAt(r-A-1)==e.charAt(n-T-1);)A++,T++;if(a[w]=A,A>r)d+=2;else if(T>n)v+=2;else if(!h){var k=s+p-E;if(k>=0&&k<u&&-1!=f[k]){var j=f[k],O=s+j-k;if(A=r-A,j>=A)return o(t,e,j,O)}}}}return[[g,t],[y,e]]}function o(t,e,n,i){var o=t.substring(0,n),s=e.substring(0,i),u=t.substring(n),f=e.substring(i),a=r(o,s),l=r(u,f);return a.concat(l)}function s(t,e){if(!t||!e||t.charAt(0)!=e.charAt(0))return 0;for(var r=0,n=Math.min(t.length,e.length),i=n,o=0;r<i;)t.substring(o,i)==e.substring(o,i)?(r=i,o=r):n=i,i=Math.floor((n-r)/2+r);return i}function u(t,e){if(!t||!e||t.charAt(t.length-1)!=e.charAt(e.length-1))return 0;for(var r=0,n=Math.min(t.length,e.length),i=n,o=0;r<i;)t.substring(t.length-i,t.length-o)==e.substring(e.length-i,e.length-o)?(r=i,o=r):n=i,i=Math.floor((n-r)/2+r);return i}function f(t,e){function r(t,e,r){for(var n,i,o,f,a=t.substring(r,r+Math.floor(t.length/4)),l=-1,p="";-1!=(l=e.indexOf(a,l+1));){var h=s(t.substring(r),e.substring(l)),c=u(t.substring(0,r),e.substring(0,l));p.length<c+h&&(p=e.substring(l-c,l)+e.substring(l,l+h),n=t.substring(0,r-c),i=t.substring(r+h),o=e.substring(0,l-c),f=e.substring(l+h))}return 2*p.length>=t.length?[n,i,o,f,p]:null}var n=t.length>e.length?t:e,i=t.length>e.length?e:t;if(n.length<4||2*i.length<n.length)return null;var o,f=r(n,i,Math.ceil(n.length/4)),a=r(n,i,Math.ceil(n.length/2));if(!f&&!a)return null;o=a?f&&f[4].length>a[4].length?f:a:f;var l,p,h,c;return t.length>e.length?(l=o[0],p=o[1],h=o[2],c=o[3]):(h=o[0],c=o[1],l=o[2],p=o[3]),[l,p,h,c,o[4]]}function a(t){t.push([b,""]);for(var e,r=0,n=0,i=0,o="",f="";r<t.length;)switch(t[r][0]){case y:i++,f+=t[r][1],r++;break;case g:n++,o+=t[r][1],r++;break;case b:n+i>1?(0!==n&&0!==i&&(e=s(f,o),0!==e&&(r-n-i>0&&t[r-n-i-1][0]==b?t[r-n-i-1][1]+=f.substring(0,e):(t.splice(0,0,[b,f.substring(0,e)]),r++),f=f.substring(e),o=o.substring(e)),0!==(e=u(f,o))&&(t[r][1]=f.substring(f.length-e)+t[r][1],f=f.substring(0,f.length-e),o=o.substring(0,o.length-e))),0===n?t.splice(r-i,n+i,[y,f]):0===i?t.splice(r-n,n+i,[g,o]):t.splice(r-n-i,n+i,[g,o],[y,f]),r=r-n-i+(n?1:0)+(i?1:0)+1):0!==r&&t[r-1][0]==b?(t[r-1][1]+=t[r][1],t.splice(r,1)):r++,i=0,n=0,o="",f=""}""===t[t.length-1][1]&&t.pop();var l=!1;for(r=1;r<t.length-1;)t[r-1][0]==b&&t[r+1][0]==b&&(t[r][1].substring(t[r][1].length-t[r-1][1].length)==t[r-1][1]?(t[r][1]=t[r-1][1]+t[r][1].substring(0,t[r][1].length-t[r-1][1].length),t[r+1][1]=t[r-1][1]+t[r+1][1],t.splice(r-1,1),l=!0):t[r][1].substring(0,t[r+1][1].length)==t[r+1][1]&&(t[r-1][1]+=t[r+1][1],t[r][1]=t[r][1].substring(t[r+1][1].length)+t[r+1][1],t.splice(r+1,1),l=!0)),r++;l&&a(t)}function l(t,e){if(0===e)return[b,t];for(var r=0,n=0;n<t.length;n++){var i=t[n];if(i[0]===g||i[0]===b){var o=r+i[1].length;if(e===o)return[n+1,t];if(e<o){t=t.slice();var s=e-r,u=[i[0],i[1].slice(0,s)],f=[i[0],i[1].slice(s)];return t.splice(n,1,u,f),[n+1,t]}r=o}}throw new Error("cursor_pos is out of bounds!")}function p(t,e){var r=l(t,e),n=r[1],i=r[0],o=n[i],s=n[i+1];if(null==o)return t;if(o[0]!==b)return t;if(null!=s&&o[1]+s[1]===s[1]+o[1])return n.splice(i,2,s,o),c(n,i,2);if(null!=s&&0===s[1].indexOf(o[1])){n.splice(i,2,[s[0],o[1]],[0,o[1]]);var u=s[1].slice(o[1].length);return u.length>0&&n.splice(i+2,0,[s[0],u]),c(n,i,3)}return t}function h(t){for(var e=!1,r=function(t){return t.charCodeAt(0)>=56320&&t.charCodeAt(0)<=57343},n=2;n<t.length;n+=1)t[n-2][0]===b&&function(t){return t.charCodeAt(t.length-1)>=55296&&t.charCodeAt(t.length-1)<=56319}(t[n-2][1])&&t[n-1][0]===g&&r(t[n-1][1])&&t[n][0]===y&&r(t[n][1])&&(e=!0,t[n-1][1]=t[n-2][1].slice(-1)+t[n-1][1],t[n][1]=t[n-2][1].slice(-1)+t[n][1],t[n-2][1]=t[n-2][1].slice(0,-1));if(!e)return t;for(var i=[],n=0;n<t.length;n+=1)t[n][1].length>0&&i.push(t[n]);return i}function c(t,e,r){for(var n=e+r-1;n>=0&&n>=e-1;n--)if(n+1<t.length){var i=t[n],o=t[n+1];i[0]===o[1]&&t.splice(n,2,[i[0],i[1]+o[1]])}return t}var g=-1,y=1,b=0,v=r;v.INSERT=y,v.DELETE=g,v.EQUAL=b,t.exports=v},function(t,e){function r(t){var e=[];for(var r in t)e.push(r);return e}e=t.exports="function"==typeof Object.keys?Object.keys:r,e.shim=r},function(t,e){function r(t){return"[object Arguments]"==Object.prototype.toString.call(t)}function n(t){return t&&"object"==typeof t&&"number"==typeof t.length&&Object.prototype.hasOwnProperty.call(t,"callee")&&!Object.prototype.propertyIsEnumerable.call(t,"callee")||!1}var i="[object Arguments]"==function(){return Object.prototype.toString.call(arguments)}();e=t.exports=i?r:n,e.supported=r,e.unsupported=n},function(t,e,r){function n(t){this.ops=t,this.index=0,this.offset=0}var i=r(0),o=r(1),s={attributes:{compose:function(t,e,r){"object"!=typeof t&&(t={}),"object"!=typeof e&&(e={});var n=o(!0,{},e);r||(n=Object.keys(n).reduce(function(t,e){return null!=n[e]&&(t[e]=n[e]),t},{}));for(var i in t)void 0!==t[i]&&void 0===e[i]&&(n[i]=t[i]);return Object.keys(n).length>0?n:void 0},diff:function(t,e){"object"!=typeof t&&(t={}),"object"!=typeof e&&(e={});var r=Object.keys(t).concat(Object.keys(e)).reduce(function(r,n){return i(t[n],e[n])||(r[n]=void 0===e[n]?null:e[n]),r},{});return Object.keys(r).length>0?r:void 0},transform:function(t,e,r){if("object"!=typeof t)return e;if("object"==typeof e){if(!r)return e;var n=Object.keys(e).reduce(function(r,n){return void 0===t[n]&&(r[n]=e[n]),r},{});return Object.keys(n).length>0?n:void 0}}},iterator:function(t){return new n(t)},length:function(t){return"number"==typeof t.delete?t.delete:"number"==typeof t.retain?t.retain:"string"==typeof t.insert?t.insert.length:1}};n.prototype.hasNext=function(){return this.peekLength()<1/0},n.prototype.next=function(t){t||(t=1/0);var e=this.ops[this.index];if(e){var r=this.offset,n=s.length(e);if(t>=n-r?(t=n-r,this.index+=1,this.offset=0):this.offset+=t,"number"==typeof e.delete)return{delete:t};var i={};return e.attributes&&(i.attributes=e.attributes),"number"==typeof e.retain?i.retain=t:"string"==typeof e.insert?i.insert=e.insert.substr(r,t):i.insert=e.insert,i}return{retain:1/0}},n.prototype.peek=function(){return this.ops[this.index]},n.prototype.peekLength=function(){return this.ops[this.index]?s.length(this.ops[this.index])-this.offset:1/0},n.prototype.peekType=function(){return this.ops[this.index]?"number"==typeof this.ops[this.index].delete?"delete":"number"==typeof this.ops[this.index].retain?"retain":"insert":"retain"},t.exports=s}])});

var MagicURLRegex = new RegExp(
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
