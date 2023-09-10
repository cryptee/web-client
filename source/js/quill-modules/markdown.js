var MarkdownShortcuts =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, {
/******/ 				configurable: false,
/******/ 				enumerable: true,
/******/ 				get: getter
/******/ 			});
/******/ 		}
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = 0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); // Quill.js Plugin - Markdown Shortcuts
// This is a module for the Quill.js WYSIWYG editor (https://quilljs.com/)
// which converts text entered as markdown to rich text.
//
// v0.0.5
//
// Author: Patrick Lee (me@patricklee.nyc)
//
// (c) Copyright 2017 Patrick Lee (me@patricklee.nyc).
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
//

var _hr = __webpack_require__(1);

var _hr2 = _interopRequireDefault(_hr);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

Quill.register('formats/horizontal', _hr2.default);

var MarkdownShortcuts = function () {
  function MarkdownShortcuts(quill, options) {
    var _this = this;

    _classCallCheck(this, MarkdownShortcuts);

    this.quill = quill;
    this.options = options;

    this.ignoreTags = ['PRE'];
    this.matches = [
    {
      name: 'image',
      pattern: /(?:!\[(.+?)\])(?:\((.+?)\))/g,
      action: function action(text, selection, pattern) {
        var startIndex = text.search(pattern);
        var matchedText = text.match(pattern)[0];
        // const hrefText = text.match(/(?:!\[(.*?)\])/g)[0]
        var hrefLink = text.match(/(?:\((.*?)\))/g)[0];
        var start = selection.index - matchedText.length - 1;
        if (startIndex !== -1) {
          setTimeout(function () {
            if (_this.quill.getFormat()['code-block']) { return; }
            if (_this.quill.getFormat()['code']) { return; }
            _this.quill.deleteText(start, matchedText.length);
            _this.quill.insertEmbed(start, 'image', hrefLink.slice(1, hrefLink.length - 1));
          }, 0);
        }
      }
    }, {
      name: 'link',
      pattern: /(?:\[(.+?)\])(?:\((.+?)\))/g,
      action: function action(text, selection, pattern) {
        var startIndex = text.search(pattern);
        var matchedText = text.match(pattern)[0];
        var hrefText = text.match(/(?:\[(.*?)\])/g)[0];
        var hrefLink = text.match(/(?:\((.*?)\))/g)[0];
        var start = selection.index - matchedText.length - 1;
        if (startIndex !== -1) {
          setTimeout(function () {
            if (_this.quill.getFormat()['code-block']) { return; }
            if (_this.quill.getFormat()['code']) { return; }
            _this.quill.deleteText(start, matchedText.length);
            _this.quill.insertText(start, hrefText.slice(1, hrefText.length - 1), 'link', hrefLink.slice(1, hrefLink.length - 1));
          }, 0);
        }
      }
    },
    {
      name: 'header',
      pattern: /^(#){1,6}\s/g,
      action: function action(text, selection, pattern, lineStart) {
        headerAction(text, selection, pattern, lineStart, _this);
      }
    }, {
      name: 'blockquote',
      pattern: /^(>)\s/g,
      action: function action(text, selection, pattern, lineStart) {
        blockquoteAction(text, selection, pattern, lineStart, _this);
      }
    }, {
      name: 'code-block',
      pattern: /^`{3}(?:\s|\n)/g,
      action: function action(text, selection, pattern, lineStart) {
        codeblockAction(text, selection, pattern, lineStart, _this);
      }
    }, 
    {
      name: 'code',
      pattern: /(?:`)(.+?)(?:`)/g,
      action: function action(text, selection, pattern, lineStart) {
        codeAction(text, selection, pattern, lineStart, _this);
      }
    },
    {
      name: 'bolditalic',
      // bold italic with underscores
      pattern: /(?:_){3}(.+?)(?:_){3}/g,
      action: function action(text, selection, pattern, lineStart) {
        boldItalicAction(text, selection, pattern, lineStart, _this);
      }
    }, 
    {
      name: 'bolditalic',
      // bold italic with asterisk
      pattern: /(?:\*){3}(.+?)(?:\*){3}/g,
      action: function action(text, selection, pattern, lineStart) {
        boldItalicAction(text, selection, pattern, lineStart, _this);
      }
    }, 
    {
      name: 'bold',
      // bold with underscores
      pattern: /(?:\s__|^__)(.+?)(?:__\s|__$)/g,
      action: function action(text, selection, pattern, lineStart) {
        boldAction(text, selection, pattern, lineStart, _this);
      }
    }, 
    {
      name: 'bold',
      // bold with asterisk
      pattern: /(?:\s\*\*|^\*\*)(.+?)(?:\*\*\s|\*\*$)/g,
      action: function action(text, selection, pattern, lineStart) {
        boldAction(text, selection, pattern, lineStart, _this);
      }
    }, 
    {
      name: 'italic',
      // italic with underscore
      pattern: /(?:\s_|^_)(.+?)(?:_\s|_$)/g,
      action: function action(text, selection, pattern, lineStart) {
        italicAction(text, selection, pattern, lineStart, _this);
      }
    }, 
    {
      name: 'italic',
      // italic with asterisk
      pattern: /(?:\s\*|^\*)(.+?)(?:\*\s|\*$)/g,
      action: function action(text, selection, pattern, lineStart) {
        italicAction(text, selection, pattern, lineStart, _this);
      }
    }, 
    {
      name: 'strikethrough',
      pattern: /(?:\s~~|^~~)(.+?)(?:~~\s|~~$)/g,
      action: function action(text, selection, pattern, lineStart) {
        strikethroughAction(text, selection, pattern, lineStart, _this);
      }
    }, {
      name: 'hr',
      pattern: /^(([-*]\s?){3})|([—*]-\s?)|([–*]-\s?)/g,
      action: function action(text, selection, pattern, lineStart) {
        hrAction(text, selection, pattern, lineStart, _this);
      }
    }, 
    // {
    //   name: 'asterisk-ul',
    //   pattern: /^(\*|\+)\s$/g,
    //   action: function action(text, selection, pattern) {
    //     setTimeout(function () {
    //       if (!_this.quill.getFormat()['code-block']) {
    //         _this.quill.formatLine(selection.index, 1, 'list', 'unordered');
    //         _this.quill.deleteText(selection.index - 2, 2);
    //       }
    //     }, 0);
    //   }
    // }, 
    ];

    // Handler that looks for insert deltas that match specific characters
    this.quill.on('text-change', function (delta, oldContents, source) {
      for (var i = 0; i < delta.ops.length; i++) {
        if (delta.ops[i].hasOwnProperty('insert')) {
          if (delta.ops[i].insert === ' ') {
            _this.onSpace();
          } else if (delta.ops[i].insert === '\n') {
            _this.onEnter();
          }
        }
      }
    });
  }

  _createClass(MarkdownShortcuts, [{
    key: 'isValid',
    value: function isValid(text, tagName) {
      return typeof text !== 'undefined' && text && this.ignoreTags.indexOf(tagName) === -1;
    }
  }, {
    key: 'onSpace',
    value: function onSpace() {
      var selection = this.quill.getSelection();
      if (!selection) return;

      var _quill$getLine = this.quill.getLine(selection.index),
          _quill$getLine2 = _slicedToArray(_quill$getLine, 2),
          line = _quill$getLine2[0],
          offset = _quill$getLine2[1];

      var text = line.domNode.textContent;
      var lineStart = selection.index - offset;
      if (this.isValid(text, line.domNode.tagName)) {
        var _iteratorNormalCompletion = true;
        var _didIteratorError = false;
        var _iteratorError = undefined;

        try {
          for (var _iterator = this.matches[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
            var match = _step.value;

            var matchedText = text.match(match.pattern);
            if (matchedText) {
              // We need to replace only matched text not the whole line
              console.log('matched:', match.name, text);
              match.action(text, selection, match.pattern, lineStart);
              return;
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion && _iterator.return) {
              _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      }
    }
  }, {
    key: 'onEnter',
    value: function onEnter() {
      var selection = this.quill.getSelection();
      if (!selection) return;

      var _quill$getLine3 = this.quill.getLine(selection.index),
          _quill$getLine4 = _slicedToArray(_quill$getLine3, 2),
          line = _quill$getLine4[0],
          offset = _quill$getLine4[1];

      var text = line.domNode.textContent + ' ';
      var lineStart = selection.index - offset;
      selection.length = selection.index++;
      if (this.isValid(text, line.domNode.tagName)) {
        var _iteratorNormalCompletion2 = true;
        var _didIteratorError2 = false;
        var _iteratorError2 = undefined;

        try {
          for (var _iterator2 = this.matches[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
            var match = _step2.value;

            var matchedText = text.match(match.pattern);
            if (matchedText) {
              if (location.origin.indexOf("crypt.ee") === -1) {
                // we're on testing env. log to console.
                console.log('matched', match.name, text);    
              }
              match.action(text, selection, match.pattern, lineStart);
              return;
            }
          }
        } catch (err) {
          _didIteratorError2 = true;
          _iteratorError2 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion2 && _iterator2.return) {
              _iterator2.return();
            }
          } finally {
            if (_didIteratorError2) {
              throw _iteratorError2;
            }
          }
        }
      }
    }
  }]);

  function boldItalicAction(text, selection, pattern, lineStart, _this) {
    var match = pattern.exec(text);

    var annotatedText = match[0];
    var matchedText = match[1];
    var startIndex = lineStart + match.index;

    if (text.match(/^([*_ \n]+)$/g)) return;

    
    setTimeout(function () {

      if (_this.quill.getFormat(startIndex, annotatedText.length)['code-block']) { return; }
      if (_this.quill.getFormat(startIndex, annotatedText.length)['code']) { return; }
      if (_this.quill.getFormat(startIndex, annotatedText.length)['link']) { return; }
      if (_this.quill.getFormat()['code-block']) { return; }
      if (_this.quill.getFormat()['code']) { return; }
      if (_this.quill.getFormat()['link']) { return; }

      _this.quill.deleteText(startIndex, annotatedText.length);
      _this.quill.insertText(startIndex, matchedText, { bold: true, italic: true });
      _this.quill.format('bold', false);
      _this.quill.format('italic', false);
    }, 0);
  }

  function boldAction(text, selection, pattern, lineStart, _this) {
    var match = pattern.exec(text);

    var annotatedText = match[0];
    var matchedText = match[1];
    var startIndex = lineStart + match.index;

    if (text.match(/^([*_ \n]+)$/g)) return;

    setTimeout(function () {

      if (_this.quill.getFormat(startIndex, annotatedText.length)['code-block']) { return; }
      if (_this.quill.getFormat(startIndex, annotatedText.length)['code']) { return; }
      if (_this.quill.getFormat(startIndex, annotatedText.length)['link']) { return; }
      if (_this.quill.getFormat()['code-block']) { return; }
      if (_this.quill.getFormat()['code']) { return; }
      if (_this.quill.getFormat()['link']) { return; }

      _this.quill.deleteText(startIndex, annotatedText.length);
      if (startIndex === 0 || startIndex === lineStart) {
        _this.quill.insertText(startIndex, matchedText, { bold: true });
      } else {
        _this.quill.insertText(startIndex, " " + matchedText + " ", { bold: true });
      }

      _this.quill.format('bold', false);
      
    }, 0);
  }

  function italicAction(text, selection, pattern, lineStart, _this) {
    var match = pattern.exec(text);

    var annotatedText = match[0];
    var matchedText = match[1];
    var startIndex = lineStart + match.index;

    if (text.match(/^([*_ \n]+)$/g)) return;

    setTimeout(function () {

      if (_this.quill.getFormat(startIndex, annotatedText.length)['code-block']) { return; }
      if (_this.quill.getFormat(startIndex, annotatedText.length)['code']) { return; }
      if (_this.quill.getFormat(startIndex, annotatedText.length)['link']) { return; }
      if (_this.quill.getFormat()['code-block']) { return; }
      if (_this.quill.getFormat()['code']) { return; }
      if (_this.quill.getFormat()['link']) { return; }

      _this.quill.deleteText(startIndex, annotatedText.length);
      if (startIndex === 0 || startIndex === lineStart) {
        _this.quill.insertText(startIndex, matchedText + " ", { italic: true });
      } else {
        _this.quill.insertText(startIndex, " " + matchedText + " ", { italic: true });
      }

      _this.quill.format('italic', false);
    }, 0);
  }

  function strikethroughAction(text, selection, pattern, lineStart, _this) {
    var match = pattern.exec(text);

    var annotatedText = match[0];
    var matchedText = match[1];
    var startIndex = lineStart + match.index;

    if (text.match(/^([*_ \n]+)$/g)) return;

    setTimeout(function () {
      if (_this.quill.getFormat(startIndex, annotatedText.length)['code']) { return; }
      _this.quill.deleteText(startIndex, annotatedText.length);
      
      if (startIndex === 0 || startIndex === lineStart) {
        _this.quill.insertText(startIndex, matchedText, { strike: true });
      } else {
        _this.quill.insertText(startIndex, " ");
        _this.quill.insertText(startIndex + 1, matchedText, { strike: true });
        _this.quill.insertText(startIndex, " ");
      }

      _this.quill.format('strike', false);
    }, 0);
  }

  function hrAction(text, selection, pattern, lineStart, _this) {

    var match = pattern.exec(text);
    
    var annotatedText = match[0];
    var matchedText = match[1];
    var startIndex = lineStart + match.index;

    setTimeout(function () {
      
      if (_this.quill.getFormat(startIndex, annotatedText.length)['code-block']) { return; }
      if (_this.quill.getFormat(startIndex, annotatedText.length)['code']) { return; }
      if (_this.quill.getFormat(startIndex, annotatedText.length)['link']) { return; }
      if (_this.quill.getFormat()['code-block']) { return; }
      if (_this.quill.getFormat()['code']) { return; }
      if (_this.quill.getFormat()['link']) { return; }

      _this.quill.deleteText(startIndex, text.length);
      _this.quill.insertEmbed(startIndex + 1, 'hr', true, Quill.sources.USER);
      _this.quill.insertText(startIndex + 2, "\n", Quill.sources.SILENT);
      _this.quill.setSelection(startIndex + 2, Quill.sources.SILENT);
    }, 0);
  }

  function codeAction(text, selection, pattern, lineStart, _this) {
    var match = pattern.exec(text);

    var annotatedText = match[0];
    var matchedText = match[1];
    var startIndex = lineStart + match.index;

    if (text.match(/^([*_ \n]+)$/g)) return;

    setTimeout(function () {
      _this.quill.deleteText(startIndex, annotatedText.length);
      _this.quill.insertText(startIndex, matchedText, { code: true });
      _this.quill.format('code', false);
    }, 0);
  }

  function codeblockAction(text, selection, pattern, lineStart, _this) {
    // Need to defer this action https://github.com/quilljs/quill/issues/1134
    setTimeout(function () {
      _this.quill.formatLine(selection.index, 1, 'code-block', true);
      _this.quill.deleteText(selection.index - 4, 4);
    }, 0);
  }

  function blockquoteAction(text, selection, pattern, lineStart, _this) {
    // Need to defer this action https://github.com/quilljs/quill/issues/1134

    var match = pattern.exec(text);

    var annotatedText = match[0];
    var matchedText = match[1];
    var startIndex = lineStart + match.index;

    setTimeout(function () {
      
      if (_this.quill.getFormat(startIndex, annotatedText.length)['code-block']) { return; }
      if (_this.quill.getFormat(startIndex, annotatedText.length)['code']) { return; }
      if (_this.quill.getFormat(startIndex, annotatedText.length)['link']) { return; }
      if (_this.quill.getFormat()['code-block']) { return; }
      if (_this.quill.getFormat()['code']) { return; }
      if (_this.quill.getFormat()['link']) { return; }

      _this.quill.formatLine(selection.index, 1, 'blockquote', true);
      _this.quill.deleteText(selection.index - 2, 2);
    }, 0);
  }

  function headerAction(text, selection, pattern, lineStart, _this) {
    var match = pattern.exec(text);
    if (!match) return;
    
    var size = match[0].length;

    var annotatedText = match[0];
    var matchedText = match[1];
    var startIndex = lineStart + match.index;


    // Need to defer this action https://github.com/quilljs/quill/issues/1134
    setTimeout(function () {
      
      if (_this.quill.getFormat(startIndex, annotatedText.length)['code-block']) { return; }
      if (_this.quill.getFormat(startIndex, annotatedText.length)['code']) { return; }
      if (_this.quill.getFormat(startIndex, annotatedText.length)['link']) { return; }
      if (_this.quill.getFormat()['code-block']) { return; }
      if (_this.quill.getFormat()['code']) { return; }
      if (_this.quill.getFormat()['link']) { return; }
      
      _this.quill.formatLine(selection.index, 0, 'header', size - 1);
      _this.quill.deleteText(selection.index - size, size);
      try { tribute.hideMenu(); } catch (error) {}
    }, 0);
  }

  return MarkdownShortcuts;
}();

module.exports = MarkdownShortcuts;

/***/ }),
/* 1 */
/***/ (function(module, exports, __webpack_require__) {

"use strict";


Object.defineProperty(exports, "__esModule", {
  value: true
});

var BlockEmbed = Quill.import('blots/block/embed');

var HorizontalRule = function (_BlockEmbed) {
  _inherits(HorizontalRule, _BlockEmbed);

  function HorizontalRule() {
    _classCallCheck(this, HorizontalRule);

    return _possibleConstructorReturn(this, (HorizontalRule.__proto__ || Object.getPrototypeOf(HorizontalRule)).apply(this, arguments));
  }

  return HorizontalRule;
}(BlockEmbed);

HorizontalRule.blotName = 'hr';
HorizontalRule.tagName = 'hr';

exports.default = HorizontalRule;

/***/ })
/******/ ]);
//# sourceMappingURL=markdownShortcuts.js.map
