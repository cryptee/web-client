var CrypteeFolderBlot = function (_Inline) {
    _inherits(CrypteeFolderBlot, _Inline);

    function CrypteeFolderBlot() {
        _classCallCheck(this, CrypteeFolderBlot);
        return _possibleConstructorReturn(this, _Inline.apply(this, arguments));
    }

    CrypteeFolderBlot.create = function create(value) {
        var node = _Inline.create.call(this);
        node.setAttribute('fid', value.fid);
        node.setAttribute('foldertitle', value.foldertitle);
        node.contentEditable = 'false';
        return node;
    };

    CrypteeFolderBlot.formats = function formats(node) {
        return {
            fid: node.getAttribute('fid'),
            foldertitle: node.getAttribute('foldertitle')
        };
    };

    return CrypteeFolderBlot;
}(Inline);

CrypteeFolderBlot.blotName = 'folder';
CrypteeFolderBlot.tagName = 'crypteefolder';
Quill.register(CrypteeFolderBlot);

function selectFoldersIfAnyInRange(range, oldRange, source) {
    $("crypteefolder").removeClass("selected");

    var selectedElements = getSelectedCustomElementsInRange(range);
    var fileIDsToSelect = selectedElements.folders || [];

    fileIDsToSelect.forEach(function(fid){
        $(`crypteefolder[fid='${fid}']`).addClass("selected");
    });
}