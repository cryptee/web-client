var HistoryBlot = function (_HistoryModule){
    _inherits(HistoryBlot, _HistoryModule);

    function HistoryBlot() {
        _classCallCheck(this, HistoryBlot);
        return _possibleConstructorReturn(this, _HistoryModule.apply(this, arguments));
    }

    var _proto = HistoryBlot.prototype;

    _proto.redo = function redo() {
        tableInsertsEnabled = true;
        this.change('redo', 'undo');
    };

    _proto.undo = function undo() {
        tableInsertsEnabled = true;
        this.change('undo', 'redo');
    };

    return HistoryBlot;
}(HistoryModule);

Quill.register('modules/history', HistoryBlot, true);