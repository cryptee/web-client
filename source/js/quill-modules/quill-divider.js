var DividerBlot = function (_BlockEmbed) {
    _inherits(DividerBlot, _BlockEmbed);

    function DividerBlot() {
        _classCallCheck(this, DividerBlot);
        return _possibleConstructorReturn(this, _BlockEmbed.apply(this, arguments));
    }
    return DividerBlot;
}(BlockEmbed);

DividerBlot.blotName = 'divider';
DividerBlot.tagName = 'hr';

Quill.register(DividerBlot);

$('.ql-hr').click(function () {
    var range = quill.getSelection(true);
    if (range) {
        quill.insertText(range.index, '\n', Quill.sources.USER);
        quill.insertEmbed(range.index + 1, 'divider', true, Quill.sources.USER);
        quill.setSelection(range.index + 2, Quill.sources.SILENT);
    }
});