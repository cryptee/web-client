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