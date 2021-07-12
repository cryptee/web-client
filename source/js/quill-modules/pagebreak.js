var PageBreakBlot = function (_BlockEmbed) {
    _inherits(PageBreakBlot, _BlockEmbed);

    function PageBreakBlot() {
        _classCallCheck(this, PageBreakBlot);
        return _possibleConstructorReturn(this, _BlockEmbed.apply(this, arguments));
    }

    PageBreakBlot.create = function create(value) {
        var node = _BlockEmbed.create.call(this);
        if (value.pgno >= 0) { node.setAttribute('pgno', value.pgno); }
        node.contentEditable = 'false';
        return node;
    };

    PageBreakBlot.formats = function formats(node) {
        return { pgno: node.getAttribute('pgno') };
    };

    return PageBreakBlot;
}(BlockEmbed);

PageBreakBlot.blotName = 'pagebreak';
PageBreakBlot.tagName = 'crypteepagebreak';

Quill.register(PageBreakBlot);

$('.ql-pagebreak').on("click", function () {
    var range = quill.getSelection(true);
    if (range) {
        quill.insertText(range.index, '\n', Quill.sources.USER);
        quill.insertEmbed(range.index + 1, 'pagebreak', true, Quill.sources.USER);
        quill.setSelection(range.index + 2, Quill.sources.SILENT);
    }
});

function selectPageBreaksIfAnyInRange(range, oldRange, source) {

    if (!isPaperMode()) { return; }

    $("crypteepagebreak").removeClass("selected");

    var selectedElements = getSelectedCustomElementsInRange(range);
    var pageBreaksToSelect = selectedElements.pagebreaks || [];
    
    pageBreaksToSelect.forEach(function(pgno){
        $(`crypteepagebreak[pgno='${pgno}']`).addClass("selected");
    });
}