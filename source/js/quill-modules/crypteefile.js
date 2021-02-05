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
        node.contentEditable = 'false';
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

function selectFilesIfAnyInRange(range, oldRange, source) {
    $("crypteefile").removeClass("selected");

    var selectedElements = getSelectedCustomElementsInRange(range);
    var fileIDsToSelect = selectedElements.files || [];

    fileIDsToSelect.forEach(function(did){
        $(`crypteefile[did='${did}']`).addClass("selected");
    });
}