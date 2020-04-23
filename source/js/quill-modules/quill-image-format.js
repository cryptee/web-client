var ImageFormatAttributesList = ['alt', 'height', 'width', 'style'];
var whitelisted_styles = ['display', 'float'];

var ImageFormat = function (_BaseImageFormat) {
    _inherits(ImageFormat, _BaseImageFormat);

    function ImageFormat() {
        _classCallCheck(this, ImageFormat);
        return _possibleConstructorReturn(this, (ImageFormat.__proto__ || Object.getPrototypeOf(ImageFormat)).apply(this, arguments));
    }
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