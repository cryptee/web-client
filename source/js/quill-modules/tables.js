////////////////////////////////////////////////
////////////////////////////////////////////////
//  TABLE DATA BLOT / DEFINITION
//  this holds all table data, 
//  instead of keeping it individiually in cells. 	 
////////////////////////////////////////////////
////////////////////////////////////////////////

var CrypteeTableData = function (_Block) {
    _inherits(CrypteeTableData, _Block);

    function CrypteeTableData() {
        _classCallCheck(this, CrypteeTableData);
        return _possibleConstructorReturn(this, _Block.apply(this, arguments));
    }

    CrypteeTableData.create = function create(value) {
        // console.log("tabledata-create value:", value);
        var tagName = "crypteetabledata";
        var node = _Block.create.call(this, tagName);
        
        //set number of columns
        var columns = value.columns;
        var rows = value.rows;
        
        node.setAttribute('columns', columns);
        node.setAttribute('rows', rows);
        
        // set it on the table if it exists
        updateTableSpecs(tableid, columns, rows);

        // set tableid
        var tableid = value.tableid || newUUID(8);
        node.setAttribute('tableid', tableid);

        node.contentEditable = 'false';

        return node;
    };

    CrypteeTableData.formats = function formats(node) {
        // console.log("tabledata-formats value:", node);

        var columns = node.getAttribute('columns');
        var rows = node.getAttribute('rows');
        var tableid = node.getAttribute('tableid') || newUUID(8);

        // set it on the table if it exists
        updateTableSpecs(tableid, columns, rows);

        return {
            columns: columns,
            rows: rows,
            tableid : tableid
        };
    };

    var _proto = CrypteeTableData.prototype;

    _proto.formats = function formats() {
        var _ref;

        // We don't inherit from FormatBlot
        return _ref = {}, _ref[this.statics.blotName] = this.statics.formats(this.domNode), _ref;
    };

    _proto.optimize = function optimize(context) {
        _Block.prototype.optimize.call(this, context);
        
        // clear contents of the crypteetabledata to prevent accidents
        if ($(this.domNode).html() !== "<br>") {            
            $(this.domNode).html("<br>");
        }

        // if there are any other accidental tabledata elements before this, delete it.
        var prev = this.prev;
        if (prev != null && prev.next === this && prev.statics.blotName === this.statics.blotName && prev.domNode.tagName === this.domNode.tagName) {
           prev.remove();
        }
    };

    return CrypteeTableData;
}(Block);

CrypteeTableData.blotName = "crypteetabledata";
CrypteeTableData.tagName = "crypteetabledata";


////////////////////////////////////////////////
////////////////////////////////////////////////
//  TABLE CELL BLOT / DEFINITION 	 
////////////////////////////////////////////////
////////////////////////////////////////////////
// crypteefile, crypteefolder, CRYPTEEPAGEBREAK = 

var itemsDisallowedInTableCells = ["header", "blockquote", "code-block", "list", "list-item", "indent", "formula", "video", "image", "", "file", "divider", "hr", "pagebreak"];
var CrypteeTableCell = function (_Block) {
    _inherits(CrypteeTableCell, _Block);

    function CrypteeTableCell() {
        _classCallCheck(this, CrypteeTableCell);
        return _possibleConstructorReturn(this, _Block.apply(this, arguments));
    }

    CrypteeTableCell.formats = function formats(domNode) {        
        return domNode.tagName === this.tagName ? undefined : _Block.formats.call(this, domNode);
    };

    var _proto = CrypteeTableCell.prototype;

    _proto.format = function format(name, value) {    
        if (itemsDisallowedInTableCells.indexOf(name) > -1) {
            return;
        } else {
            if (name === CrypteeTable.blotName && !value) {
                this.replaceWith(Parchment.create(this.statics.scope));
            } else {
                _Block.prototype.format.call(this, name, value);
            }
        }
    };

    _proto.remove = function remove() {
        if (this.prev == null && this.next == null) {
            this.parent.remove();
        } else {
            _Block.prototype.remove.call(this);
        }
    };

    _proto.replaceWith = function replaceWith(name, value) {
        this.parent.isolate(this.offset(this.parent), this.length());

        if (name === this.parent.statics.blotName) {
            this.parent.replaceWith(name, value);
            return this;
        } else {
            this.parent.unwrap();
            return _Block.prototype.replaceWith.call(this, name, value);
        }
    };

    _proto.insertAt = function(index, value, embedValue) {      
        // strip all newlines for safety to not break the table.
        if (itemsDisallowedInTableCells.indexOf(value) > -1) {
            return;
        } else {
            if (!tableInsertsEnabled) {
                value = value.trim().replace(/(\r\n|\n|\r)/gm, " ");
            }
            _Block.prototype.insertAt.call(this, index, value);
        }
    };

    return CrypteeTableCell;
}(Block);

CrypteeTableCell.blotName = "crypteetablecell";
CrypteeTableCell.tagName = "crypteetablecell";

////////////////////////////////////////////////
////////////////////////////////////////////////
//  TABLE BLOT / DEFINITION 	 
////////////////////////////////////////////////
////////////////////////////////////////////////

var CrypteeTable = function (_Container) {
    _inherits(CrypteeTable, _Container);

    function CrypteeTable() {
        _classCallCheck(this, CrypteeTable);
        return _possibleConstructorReturn(this, _Container.apply(this, arguments));
    }

    CrypteeTable.create = function create(tableid) {
        // value will be ordered, which gets it from formats, that gets it from quill.format("crypteetable", 'ordered');
        // console.log("table-create value:", value);
        var tagName = "crypteetable";
        var node = _Container.create.call(this, tagName);
        
        // set tableid
        tableid = tableid || newUUID(8);
        node.setAttribute('tableid', tableid);

        // get columns & rows from data node
        var dataElem = $("crypteetabledata[tableid='"+tableid+"']");
        var columns = dataElem.attr("columns");
        var rows = dataElem.attr("rows");
        
        updateTableSpecs(tableid, columns, rows);

        return node;
    };

    CrypteeTable.formats = function formats(node) {
        // console.log("table-formats value:", node);
        var tableid = node.getAttribute('tableid') || newUUID(8);
        return tableid;
    };

    var _proto = CrypteeTable.prototype;

    _proto.format = function format(name, value) {     
        if (itemsDisallowedInTableCells.indexOf(name) > -1) {
            return;
        } else {
            if (this.children.length > 0) {
                this.children.tail.format(name, value);
            }
        }
    };

    _proto.formats = function formats() {
        var _ref;

        // We don't inherit from FormatBlot
        return _ref = {}, _ref[this.statics.blotName] = this.statics.formats(this.domNode), _ref;
    };

    _proto.insertBefore = function insertBefore(blot, ref) {      
        if (blot instanceof CrypteeTableCell) {
            _Container.prototype.insertBefore.call(this, blot, ref);
        } else {
            var index = ref == null ? this.length() : ref.offset(this);
            var after = this.split(index);
            after.parent.insertBefore(blot, after);
        }
    };

    _proto.insertAt = function(index, value, embedValue) {
        if (itemsDisallowedInTableCells.indexOf(value) > -1) { 
            return;
        } else {
            if (!tableInsertsEnabled) {
                value = value.trim().replace(/(\r\n|\n|\r)/gm, " ");
            }
            _Container.prototype.insertAt.call(this, index, value);
        }
    };

    _proto.optimize = function optimize(context) {
        _Container.prototype.optimize.call(this, context);

        var next = this.next;
        if (next != null && next.prev === this && next.statics.blotName === this.statics.blotName && next.domNode.tagName === this.domNode.tagName) {
            var thisTableID = $(this.domNode).attr("tableid");
            var nextTableID = $(next.domNode).attr("tableid");
            if (nextTableID === thisTableID) {
                next.moveChildren(this);
                next.remove();
            }
        }
    };

    _proto.replace = function replace(target) {
        if (target.statics.blotName !== this.statics.blotName) {
            var item = Parchment.create(this.statics.defaultChild);
            target.moveChildren(item);
            this.appendChild(item);
        }

        _Container.prototype.replace.call(this, target);
    };

    return CrypteeTable;
}(Container);

CrypteeTable.blotName = "crypteetable";
CrypteeTable.scope = Parchment.Scope.BLOCK_BLOT;
CrypteeTable.tagName = "crypteetable";
CrypteeTable.defaultChild = "crypteetablecell";
CrypteeTable.allowedChildren = [CrypteeTableCell];

Quill.register(CrypteeTable,false);
Quill.register(CrypteeTableCell,false);
Quill.register(CrypteeTableData,false);

////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 TABLE DATA / ATTRIBUTE UPDATES
////////////////////////////////////////////////
////////////////////////////////////////////////

function updateTableSpecs(tableid, columns, rows) {
    // only update if something changed, 
    // otherwise it causes an infinite feedback loop between table & tabledata.

    var table = $("crypteetable[tableid='"+tableid+"']");
    if (table.length) {
        var tableCols = table.attr("columns");
        var tableRows = table.attr("rows");
        
        if (tableCols !== columns) {
            table.attr("columns", columns);
            table[0].style.setProperty("--columns", columns);
        }
    
        if (tableRows !== rows) {
            table.attr("rows", rows);
            table[0].style.setProperty("--rows", rows);
        }
        
    }
}

////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 TABLE DELTA EVENTS
////////////////////////////////////////////////
////////////////////////////////////////////////

function generateTableDelta(index, columns, rows, tableid) {
    var numberOfCells = columns * rows;
    var cells = "\n".repeat(numberOfCells);
    var delta = { ops : [] };
    delta.ops.push({ retain : index });
    delta.ops.push({ 
        insert : "\n", 
        attributes : { 
            crypteetabledata : { columns : columns, rows : rows, tableid : tableid }
        }
    });
    delta.ops.push({ 
        insert : cells, 
        attributes : { crypteetable : tableid }
    });
        
    return delta;
}

function newTable(columns, rows) {
    var tableid = newUUID(8);
    var range = getLastSelectionRange();
    if (range) {
        quill.insertText(range.index, '\n', "user");
        var tableDelta = generateTableDelta(range.index + 1, columns, rows, tableid);
        quill.updateContents(tableDelta, "user");
        quill.setSelection(range.index + 1, "silent");
    }
}

////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 CURSOR & SELECTION & CELL SELECTION
////////////////////////////////////////////////
////////////////////////////////////////////////

function isCursorInTable() {
    var inTable = false;
    
    if (getSelectedNode()) {
        
        if (getSelectedNode().tagName) {
            if (getSelectedNode().tagName.toUpperCase() === "CRYPTEETABLE") {
                inTable = true;
            }
        }

        if (getSelectedTableCellNode()) {
            inTable = true;
        }

    } else {
        var lastSelRange = getLastSelectionRange();
        var format = quill.getFormat(lastSelRange);
        if (format.crypteetable || format.crypteetablecell) {
            inTable = true;
        }

    }
    
    return inTable;
}

function getTableIDAtCursor() {
    var tableid;
    var lastSelRange = getLastSelectionRange();
    var format = quill.getFormat(lastSelRange);
    if (format.crypteetable) {
        tableid = format.crypteetable;
    }

    if (format.crypteetabledata) {
        tableid = format.crypteetabledata.tableid;
    }
    return tableid;
}


function getSelectedTableCellNode() {
    var cellNode = false;
    
    if (getSelectedNode()) {
        
        if (getSelectedNode().tagName) {
            if (getSelectedNode().tagName.toUpperCase() === "CRYPTEETABLECELL") {
                cellNode = getSelectedNode();
            } 
        }

        if (getSelectedNode().parentNode) {
            if (getSelectedNode().parentNode.tagName) {
                if (getSelectedNode().parentNode.tagName.toUpperCase() === "CRYPTEETABLECELL") {
                    cellNode = getSelectedNode().parentNode;
                } 
            }

            if (getSelectedNode().parentNode.parentNode) {
                if (getSelectedNode().parentNode.parentNode.tagName) {
                    if (getSelectedNode().parentNode.parentNode.tagName.toUpperCase() === "CRYPTEETABLECELL") {
                        cellNode = getSelectedNode().parentNode.parentNode;
                    } 
                }

                if (getSelectedNode().parentNode.parentNode.parentNode) {
                    if (getSelectedNode().parentNode.parentNode.parentNode.tagName) {
                        if (getSelectedNode().parentNode.parentNode.parentNode.tagName.toUpperCase() === "CRYPTEETABLECELL") {
                            cellNode = getSelectedNode().parentNode.parentNode.parentNode;
                        } 
                    }
                }  
            }   
        }
        
    }
    
    return cellNode;
}

function setCursorToTableCellAtIndex(tableid, cellIndex) {
    var targetCell = $("crypteetable[tableid='"+tableid+"']").children()[cellIndex];
    var targetQuillIndex;
    if (targetCell) {
        targetQuillIndex = getQuillIndexOfDOMNode(targetCell);    
        quill.setSelection(targetQuillIndex, 0, "user");
    } else {
        // we got the wrong number of cols / rows vs the actual number, so instead exit table here by first checking table's range
        // this could happen if you delete the last cell in the last row, and look for the cellIndex to set the cursor ahead in the table for example.
        // not a bad thing, not a bug, but instead of checking the cell's range, we check the table's range basically, 
        // since the last cell we were looking for is gone now.
        targetQuillIndex = getTableRange(tableid).index + getTableRange(tableid).length;
        quill.setSelection(targetQuillIndex, 0, "user");
    }
}

function isThereSomethingElseOtherThanNewLineSelected(range, context) {
    
    var thereIsSomethingElse = false;
    var selectedContents = quill.getContents(range.index, range.length);

    var opsAtIndex = selectedContents.ops;
    opsAtIndex.forEach(function(op) {
        if (op.insert) {
            if (typeof op.insert === "string") {
                op.insert = op.insert.trim().replace(/(\r\n|\n|\r)/gm, " ");
            }
            if (op.insert) { thereIsSomethingElse = true; }
        }
    });
    
    return thereIsSomethingElse;
}

function doesSelectionHaveTables(range, context) {
    var thereIsATable = false;
    var selectedContents = quill.getContents(range.index, range.length);

    var opsAtIndex = selectedContents.ops;
    opsAtIndex.forEach(function(op) {
        if (op.attributes) {
            if (op.attributes.crypteetable || op.attributes.crypteetabledata) {
                thereIsATable = true;              
            }
        }
    });

    if (context) {
        if (context.format.crypteetable || context.format.crypteetablecell || context.format.crypteetabledata) {
            thereIsATable = true;
        }
    }

    return thereIsATable;
}

var selectedCellCoords = {};
function checkIfTableHasFocus() {

    try {
        var lastSelRange = getLastSelectionRange();
        var selectedFormat = quill.getFormat(lastSelRange);

        if (selectedFormat.crypteetable) {
            var tableid = selectedFormat.crypteetable;
            
            var cell = getSelectedTableCellNode();
            if (cell) {
                var cellIndex = $(cell).index();
                var cellIndexString = cellIndex.toString();
                var cellPosition = cell.getBoundingClientRect();
                var cellTop = cellPosition.top;
                var cellLeft = cellPosition.left;
                var cellWidth = $(cell).width();
                
                var ctxLeft = cellLeft + cellWidth - 28 + "px";
                var ctxTop = cellTop + 4 + "px";
                selectedCellCoords = { 
                    top : cellTop, 
                    left : cellLeft, 
                    width : cellWidth, 
                    tableid : tableid 
                };

                if (selectedFormat.direction === "rtl" || selectedFormat.align === "right") {
                    // user is using right align or RTL, show the contextual button on the left side of the cell instead.
                    ctxLeft = cellLeft + 1 + "px";
                }
                
                $("#table-contextual-button").css({ transform: "translate3d("+ctxLeft+", "+ctxTop+", 0)" });
                if (cellIndexString) { $("#table-contextual-button, #table-dropdown").attr("cellindex", cellIndexString); }
                if (tableid) { $("#table-contextual-button, #table-dropdown").attr("tableid", tableid); }
                $("#table-contextual-button").addClass("visible");
                enableEditorToolbarTableMode();
            } else {
                hideTableContextualButton();
                disableEditorToolbarTableMode();
            }
        } else if (selectedFormat.crypteetabledata) { 
            var tabledataid = selectedFormat.crypteetabledata.tableid;
            setCursorToTableCellAtIndex(tabledataid, 0); 
        } else {
            hideTableContextualButton();
            disableEditorToolbarTableMode();
        }
    } catch (error) {
        handleError("Couldn't get format to check if table's in focus", error, "warning");
        hideTableContextualButton();
        disableEditorToolbarTableMode();  
    }

    hideTableContextualDropdown();
    $("#table-contextual-button, crypteetablecell").removeClass("warn insertAbove insertBelow insertLeft insertRight");    
    
    if (!insertingCells) { tableInsertsEnabled = false; }
}

function selectTablesIfAnyInRange(range, oldRange, source) {
    
    $("crypteetable").removeClass("selected");

    var selectedElements = getSelectedCustomElementsInRange(range);
    var tableIDsToSelect = selectedElements.tables || [];

    var originalSelectionStart = range.index;
    var originalSelectionEnd = range.index + range.length;

    var adjustedSelectionStart, adjustedSelectionEnd;

    if (range.length > 0 && tableIDsToSelect.length > 0) {
        var lowestTableStartIndex = 0;
        var highestTableEndIndex = 0;
        tableIDsToSelect.forEach(function(tableid){
            $(`crypteetable[tableid='${tableid}']`).addClass("selected");
            var tableStart = getTableRange(tableid).index - 2;
            var tableEnd = getTableRange(tableid).index + getTableRange(tableid).length;
    
            if (lowestTableStartIndex > 0) {
                if (tableStart <= lowestTableStartIndex) {
                    lowestTableStartIndex = tableStart;
                } 
            } else {
                lowestTableStartIndex = tableStart;
            }
    
            if (tableEnd >= highestTableEndIndex) {
                highestTableEndIndex = tableEnd;
            }
        });

        if (originalSelectionStart > lowestTableStartIndex) {
            adjustedSelectionStart = lowestTableStartIndex;
        } else {
            adjustedSelectionStart = originalSelectionStart;
        }
        
        if (originalSelectionEnd < highestTableEndIndex) {
            adjustedSelectionEnd = highestTableEndIndex;
        } else {
            adjustedSelectionEnd = originalSelectionEnd;
        }
    
        var adjustedIndex = adjustedSelectionStart;
        var adjustedLength = adjustedSelectionEnd - adjustedSelectionStart;
        quill.setSelection(adjustedIndex, adjustedLength, "api");
    }
}

function getTableDataRange(tableid) {
    var tabledata = $("crypteetabledata[tableid='"+tableid+"']");
    var index = getQuillIndexOfDOMNode(tabledata[0]);
    return {index: index, length : 1};
}

function getTableRange(tableid) {
    var table = $("crypteetable[tableid='"+tableid+"']");
    var index = getQuillIndexOfDOMNode(table[0]);
    
    var nextElem = $("crypteetable[tableid='"+tableid+"']").next();
    var nextElemIndex = getQuillIndexOfDOMNode(nextElem[0]);
    var length = nextElemIndex - index;

    return {index: index, length : length};
}

function getCellRange(tableid, cellIndex) {
    var table = $("crypteetable[tableid='"+tableid+"']");
    var cell = table.children()[cellIndex];

    var index = getQuillIndexOfDOMNode(cell);
    
    var length, nextElem, nextElemIndex;
    nextElem = $(cell).next();
    if (nextElem[0]) {
        // there's another cell after this one.
        nextElemIndex = getQuillIndexOfDOMNode(nextElem[0]);
        length = nextElemIndex - index;
    } else {
        // this was the last cell, we need what's after the table.
        nextElem = $("crypteetable[tableid='"+tableid+"']").next();
        nextElemIndex = getQuillIndexOfDOMNode(nextElem[0]);
        length = nextElemIndex - index;
    }

    return {index: index, length : length};
}

////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 CLIPBOARD EVENTS
////////////////////////////////////////////////
////////////////////////////////////////////////

function handleTablePaste(node, delta) {
    // trim newline characters to ensure table won't break

    var ops = [];
    
    delta.ops.forEach(function(op) {
        if (op.insert) {
            // trim the inserts (because &nbsp; gets to pass through as \n as well)
            if (typeof op.insert === "string") {
                op.insert = op.insert.trim().replace(/(\r\n|\n|\r)/gm, " ");
                ops.push({ insert: op.insert });
            } else {
                ops.push(op);
            }
        }
    });
    
    delta.ops = ops;

    return delta;
}


// we need to keep the pasted tabledata in memory until the actual table is pasted, and remove it once the table is pasted.
// this is also going to be used for passing the new tableid; 

var pastedTableDataMemory = {};
var pasteEndedTimeout;

function updateTablesInDelta(node, delta) {
    // check if the pasted content has a table, and update its table attributes.
        
    var newlinesInTable = 0;
    var cellsInTable = 0;
    var ops = [];
    
    delta.ops.forEach(function(op) {
        if (op.attributes) {
            if (op.attributes.crypteetabledata) {
                ops.push({insert:"\n"}); // this is a newline before the table, in case if the user pastes the table on an existing line, allows us to start in a new line.

                var newTableID = newUUID(8); // pasting means we're creating a new table, so it needs a new tableid
                var tabledataid = op.attributes.crypteetabledata.tableid; // get the tabledata's id first, this is what the table will have
                pastedTableDataMemory[tabledataid] = op.attributes.crypteetabledata; // add tabledata to paste memory
                pastedTableDataMemory[tabledataid].newTableID = newTableID; // set the new id to paste memory
                op.attributes.crypteetabledata.tableid = newTableID; // update the tabledata insert operation with the new id

                op.insert = "\n"; // if the tabledata has some randomass text in it, get it rid of it. 
            }

            if (op.attributes.crypteetable) {
                var tableid = op.attributes.crypteetable;
                
                // check the number of cells in the original table, using the tabledata from the paste memory
                var table = pastedTableDataMemory[tableid];
                if (table) {
                    cellsInTable = table.columns * table.rows;
    
                    // update the table insert operation with the new id
                    op.attributes.crypteetable = pastedTableDataMemory[tableid].newTableID;
    
                    if (op.insert) {
                        if (typeof op.insert === "string") {
                            // if the table has more newlines than the number of cells, get rid of them.
                            newlinesInTable = (op.insert.match(/\r\n|\r|\n/g) || '').length;
                            
                            while (newlinesInTable > cellsInTable) {
                                // usually it's the leading or trailing newlines, delete it all.
                                if (newlinesInTable > cellsInTable) {
                                    op.insert = op.insert.replace(/^\n/,"").replace(/^\r/,"");
                                    newlinesInTable--;
                                }
        
                                if (newlinesInTable > cellsInTable) {
                                    op.insert = op.insert.replace(/\n$/,"").replace(/\r$/,"");
                                    newlinesInTable--;
                                }
                            }
                            
                        }
                    }
                }
                
            } 
        } 
        ops.push(op);
    });

    //..updateTablesInDelta will be triggered once for each line/change/delta. 
    // so each paste operation will trigger updateTablesInDelta multiple times.

    // Meaning that we need to capture the tabledata in the first time it fires, and use in the consecutive ones.
    // save it to memory, then delete after the last delta fires. This should be a safe way to defer it.
    
    clearTimeout(pasteEndedTimeout);
    pasteEndedTimeout = setTimeout(function () { pastedTableDataMemory = {}; }, 10);
    // 

    delta.ops = ops;
    return delta;
}

////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 KEYBOARD EVENTS
////////////////////////////////////////////////
////////////////////////////////////////////////

function handleTableDelete(range, context) { 
    // stop delete, or it'll delete & break table cell 
    if (context.suffix.length > 0) { 
        return true; 
    } else {
        handleDeletionInsideTable(range, context);
    }
}

function handleTableBackspace(range, context) {
    // stop backspace, or it'll delete & break table cell    
    if (context.prefix.length > 0) { 
        return true; 
    } else {        
        handleDeletionInsideTable(range, context);
    }
}

// this handles both backspace & delete characters
function handleDeletionInsideTable(range, context) {
    if (range.length > 0) {
        // user selected something all the way to the beginnging of the table cell, 
        // and pressed delete, if you let delete go through, you'll delete the cell.
        // so instead pass spacebar to delete the selection
        
        if (isThereSomethingElseOtherThanNewLineSelected(range, context)) {
            quill.deleteText(range.index, range.length, 'user');
        }
    } else {
        // user selected nothing, cell is likely empty, so don't do anything
    }
}

function handleTableTab(range, context) {
    var format, tableid; 
    var cell = $(getSelectedTableCellNode());
    
    try {
        format = context.format;
        tableid = format.crypteetable;
    } catch (e) {}

    if (!tableid) { 
        // can't tell if it's a table, move selection one forward
        quill.setSelection(range.index + 1); 
    } else {
        var table = getTableRowAndColFromTableData(tableid);
        var columns = table.columns;
        var rows = table.rows;
        var cellInfo = getCellRowAndCol(tableid, cell.index());
        var cellIndexOfFirstCellInRow = getCellIndexFromColAndRow(1, cellInfo.rowNo, tableid);
        var nextCellRange, nextCellQuillIndex, nextCellQuillLength;
        if (format.direction === "rtl") {
            if (cell.index() === cellIndexOfFirstCellInRow) {
                // leftmost cell

                if (cellInfo.rowNo === rows) {
                    // if there's no row below, following g-docs approach, 
                    // insertRow below
                    insertRowBelow();
                }

                // now go down to the rightmost cell in the row below. 
                var indexOfRightmostCellInRowBelow = getCellIndexFromColAndRow(columns, cellInfo.rowNo + 1, tableid);
                
                setCursorToTableCellAtIndex(tableid, indexOfRightmostCellInRowBelow);
                
                // then select everything in it 
                nextCellRange = getCellRange(tableid, indexOfRightmostCellInRowBelow);
                nextCellQuillIndex = nextCellRange.index;
                nextCellQuillLength = nextCellRange.length - 1; // -1 is to account for the newline character required to skip to next cell
                quill.setSelection(nextCellQuillIndex, nextCellQuillLength);

            } else {
                // go to cell - 1 
                setCursorToTableCellAtIndex(tableid, cell.index() - 1);
                
                // then select everything in it 
                nextCellRange = getCellRange(tableid, cell.index() - 1);
                nextCellQuillIndex = nextCellRange.index;
                nextCellQuillLength = nextCellRange.length - 1; // -1 is to account for the newline character required to skip to next cell
                quill.setSelection(nextCellQuillIndex, nextCellQuillLength);
            }
            
        } else {
            if (cell.next().length > 0) {
                // there is a next cell, move cursor to it.
                setCursorToTableCellAtIndex(tableid, cell.index() + 1);
                
                // then select everything in it 
                nextCellRange = getCellRange(tableid, cell.index() + 1);
                nextCellQuillIndex = nextCellRange.index;
                nextCellQuillLength = nextCellRange.length - 1; // -1 is to account for the newline character required to skip to next cell
                quill.setSelection(nextCellQuillIndex, nextCellQuillLength);
            } else {
                // following g-docs approach, insert row below
                insertRowBelow();
            }
        }
        
    }

}

function handleTableEnter(range, context) {
    var tableid; 
    
    try {
        tableid = context.format.crypteetable;
    } catch (e) {}

    try {
        tableid = context.format.crypteetabledata.tableid;
    } catch (e) {}
    
    if (!tableid) { 
        quill.setSelection(range.index + 1); 
    } else {
        var cursorIndex = range.index;
        var tableStartIndex = getTableRange(tableid).index;

        if (cursorIndex <= tableStartIndex ) {
            // first cell & first index, add a br before the table data element.
            $("crypteetabledata[tableid='"+tableid+"']").before("<p><br></p>");
        } else {
            // any other cell, move selection forward
            quill.setSelection(range.index + 1);
        }
    }
}

function handleUpIntoTheTable(range, context) {
    quill.setSelection(range.index - 1);
    var format = quill.getFormat();
    var tableid = format.crypteetable;
    if (tableid) {
        var table = getTableRowAndColFromTableData(tableid);
        var columns = table.columns;
        var cell = $(getSelectedTableCellNode());
        var targetCell = cell.index() - columns + 1;
        if (format.direction === "rtl" || format.align === "right") {
            targetCell = cell.index();
        }
        setCursorToTableCellAtIndex(tableid, targetCell);
    }
}

function handleDownIntoTheTable(range, context) {
    var format = quill.getFormat();
    var tableFormat = quill.getFormat({index : range.index + 1, length : 1});
    var tableid = tableFormat.crypteetable || tableFormat.crypteetabledata.tableid;
    
    if (tableid) {
        if (format.direction === "rtl" || format.align === "right") {
            // it's rtl or right aligned, enter to rightmost cell in first row
            
            if (tableid) {
                var table = getTableRowAndColFromTableData(tableid);
                var columns = table.columns;
                // now set the cursor to the rightmost cell in first row
                setCursorToTableCellAtIndex(tableid, columns - 1);
            }
        } else {
            setCursorToTableCellAtIndex(tableid, 0);
        }
    } else {
        return true;
    }
}

function handleTableUP(range, context) {
    
    // get table info
    var format = context.format;
    var tableid = format.crypteetable;
    if (tableid) {
        var table = getTableRowAndColFromTableData(tableid);
        var columns = table.columns;
                
        // get cell info 
        var cell = $(getSelectedTableCellNode());

        if ((cell.index() - columns) >= 0) {
            // to to the cell above
            setCursorToTableCellAtIndex(tableid, (cell.index() - columns));
        } else {
            // there's no cell above
            if ((cell.index() - 1) >= 0) {
                // if there is a cell before this one, 

                if (format.direction === "rtl" || format.align === "right") {
                    // user is RTL or right aligned, exit table from top
                    setCursorToTableCellAtIndex(tableid, 0);
                    quill.setSelection(getLastSelectionRange().index - 2);
                } else {
                    // go the previous cell
                    setCursorToTableCellAtIndex(tableid, (cell.index() - 1));
                }

            } else {
                // there's no prev cell, exit table from top
                quill.setSelection(range.index - 2); //-2, since it's one for table, one for tabledata
            }
        }
    }
}

function handleTableDOWN(range, context) {
    
    // get table info
    var tableid = context.format.crypteetable;
    if (tableid) {
        var table = getTableRowAndColFromTableData(tableid);
        var columns = parseInt(table.columns);
        var rows = parseInt(table.rows);
        var tableRange = getTableRange(tableid);
        var numberOfCells = rows * columns;
        
        // get cell info 
        var cell = $(getSelectedTableCellNode());

        if ((cell.index() + 1) + columns <= numberOfCells) {
            // there's a cell below, go to the cell below
            setCursorToTableCellAtIndex(tableid, (cell.index() + columns));
        } else {
            // there's no cell below
            if ((cell.index() + 1) + 1 <= numberOfCells) {
                // exit table down
                quill.setSelection(tableRange.index + tableRange.length);
            } else {
                // there's no next cell
                if (context.suffix.length === 0) {
                    // there's no text ahead, exit table from bottom
                    quill.setSelection(range.index + 1);
                } else {
                    // there's some text ahead, go to end of line
                    quill.setSelection(range.index + context.suffix.length);
                }
                
            }
        }

    }
}

///////////////////////////////////////////////////////
///////////////////////////////////////////////////////
// 	 PREVENT TABLE FROM BREAKING ON SOFTWARE KEYBOARDS
///////////////////////////////////////////////////////
///////////////////////////////////////////////////////

// None of the software keyboards on Android send keycodes. They send 229 undefined.
// this is because autocorrect / swipe type etc could change the final word being typed.
// meaning that you can't rely on keypress events to prevent breaking the table's structure. 

// ALREADY TRIED THESE : 
// 1) if you try to fix this at blot level, using deleteAt() it doesn't get fired.

// 2) if you try to fix this using mutation observers in blot update, it's too late, you already lost the node, 
// meaning that you can't reference it's previous sibling,
// meaning that you can't add a new cell where the old one was.
// best case scenario this is the last/first cell, you can add to the beginning or end of the table
// worst case scenario, it's a cell in between, and you can't do shit.

// 3) if you try to fix this using a keyboard binding for 229, you can't.
// returning false / null in the keyboard binding doesn't do anything. 
// so quill is powerless here. 
// presumably because you only get "229", and nothing else. 
// you don't know if you're deleting, or pressing enter, or typing.
// you'd need to keep a history of all things user types in tables, 
// and compare with something like jsdiff. not cool

// 4) This brings us to the final & nuclear option here. 
// on each text-change that happens inside tables, 
// we need to count where we are based on quill indexes. 
// and keep track of where cursor was. 

// so IF we get "{delete : 1}", in the text-change delta, 
// then using the oldDelta OR the last selection position before this text change, 
// we insert a newline character (\n) to fix the table immediately. 

var tableOperationsInProgress = false;

function preventTableFromBreaking(delta, oldDelta, source) {
    // if we're not deleting or inserting a row or column, and the user typed / deleted something instead
    if (!tableOperationsInProgress && !insertingCells && !tableInsertsEnabled) {

        if (isCursorInTable()) {
            // SOMETHING CHANGED IN THE TABLE
            
            // Let's find out more about the table first. 
            var tableid = getTableIDAtCursor();
            var tableInfo = getCellRowAndCol(tableid);
            var columns = tableInfo.columns;
            var rows = tableInfo.rows;
            var cells = columns * rows;
            var table = $("crypteetable[tableid='"+tableid+"']");

            
            // if the table is still there
            if (table) {
                // but its missing some children, this means user used a software keyboard 
                // and pressed backspace / delete and deleted some cells
                
                if (table.children().length < cells) {
                    
                    // TABLE IS MISSING CELLS. INSERT THE SAME NUMBER OF NEWLINES TO FIX IT.
                    var numberOfMissingCells = cells - table.children().length;
    
                    // the delta we'll apply back to fix the issue
                    var fixDelta = { ops : [] };
    
                    // go through the delta we received from text-change, to figure out the index where this incident took place
                    // for this, we'll cycle through all retain operations, and add them to our fixDelta 
                    delta.ops.forEach(function(op) {
                        if (op.retain) {
                            fixDelta.ops.push(op);
                        }
                    });
    
                    // now let's generate the necessary number of missing cells
                    var newlines = '\n'.repeat(numberOfMissingCells);
                    
                    // and add them to the fixDelta too
                    fixDelta.ops.push({ 
                        insert : newlines, 
                        attributes : { crypteetable : tableid }
                    });
    
                    // finally, apply the fixDelta back into the editor to fix the table.
    
                    insertingCells = true;
                    tableInsertsEnabled = true;
                    quill.updateContents(fixDelta, "user");    
                    insertingCells = false;
                    tableInsertsEnabled = false;
                    
                }
            }
        }
    }
}

////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 USER INTERFACE
////////////////////////////////////////////////
////////////////////////////////////////////////

function populateTablePicker() {
    // For now it's 8 x 8 = 64 cells. 
    var colNo = 0;
    var rowNo = 0;
    for (var cell = 0; cell < 64; cell++) {
        colNo = (cell % 8);
        if (colNo === 0) { rowNo++; }
        $("#table-picker").append("<div class='table-picker-cell' c='" + (colNo + 1) + "' r='" + rowNo + "'>" + (colNo + 1) + "x" + rowNo + "</div>");
    }

    $("#table-selected-cols").html("0");
    $("#table-selected-rows").html("0");

    var winW = $(window).width();
    if (winW <= 480) {
        $("#add-table").addClass("compact");
    } else {
        $("#add-table").removeClass("compact");
    }
}

populateTablePicker();

$("#table-picker").on('mouseover', ".table-picker-cell",function(event) {
    var col = $(this).attr("c");
    var row = $(this).attr("r");
    $(".table-picker-cell").removeClass("s");
    $(".table-picker-cell").not(this).filter(function() { 
        return $(this).attr("r") <= row && $(this).attr("c") <= col; 
    }).addClass("s");

    $("#table-selected-cols").html(col);
    $("#table-selected-rows").html(row);
    $("#table-picker-header").addClass("selection");
}); 

$("#table-picker").on('mouseout', ".table-picker-cell",function(event) {
    $("#table-picker-header").removeClass("selection");
    $(".table-picker-cell").removeClass("s");
    $("#table-selected-cols").html("0");
    $("#table-selected-rows").html("0");
});

$("#table-picker").on('click', ".table-picker-cell",function(event) {
    var col = $(this).attr("c");
    var row = $(this).attr("r");
    newTable(col, row);
    hidePanels();
});

$('.cryptee-new-table').click(function () {
    togglePanel("add-table");
});

$("#table-contextual-button").on('click', function(event) {
    var winH = $(window).height();
    var winW = $(window).width();

    // 32 (cell height) + 4px for optical coolness 
    var topPos = selectedCellCoords.top + 36 + "px";
    if (selectedCellCoords.top + 36 + 280 >= winH) {
        if (selectedCellCoords.top - 280 - 4 > 0) {
            topPos = selectedCellCoords.top - 280 - 4 + "px";
        } else {
            topPos = 4 + "px";
        }
    }
    
    // 200 (dropdown width) - 10px for optical coolness
    var leftPos = selectedCellCoords.left + selectedCellCoords.width - (200 - 10) + "px";
    if (selectedCellCoords.left + selectedCellCoords.width - (200 - 10) <= 0) {
        leftPos = "10px";
    }

    $("#table-dropdown").css({ top: topPos, left : leftPos });
    showTableContextualDropdown();
    tableInsertsEnabled = true;
}); 

function hideTableContextualButton() {
    $("#table-contextual-button").removeClass("visible");
}

function enableEditorToolbarTableMode() {
    $(".quill-toolbar").addClass("in-table");
    $("#doc-contextual-buttons").addClass("in-table");
}

function disableEditorToolbarTableMode() {
    $(".quill-toolbar").removeClass("in-table");
    $("#doc-contextual-buttons").removeClass("in-table");
}

function showTableContextualDropdown() {
    $("#table-dropdown").addClass("show");
}

function hideTableContextualDropdown() {
    $("#table-dropdown").removeClass("show");
}

$("#insert-table-row-above-button").on('mouseover', function() { toggleRowHighlight("insertAbove"); }); 
$("#insert-table-row-above-button").on('mouseout', function() { toggleRowHighlight(false); }); 

$("#insert-table-row-below-button").on('mouseover', function() { toggleRowHighlight("insertBelow"); }); 
$("#insert-table-row-below-button").on('mouseout', function() { toggleRowHighlight(false); }); 

$("#insert-table-col-left-button").on('mouseover', function() { toggleColumnHighlight("insertLeft"); }); 
$("#insert-table-col-left-button").on('mouseout', function() { toggleColumnHighlight(false); }); 

$("#insert-table-col-right-button").on('mouseover', function() { toggleColumnHighlight("insertRight"); }); 
$("#insert-table-col-right-button").on('mouseout', function() { toggleColumnHighlight(false); }); 

$("#delete-table-row-button").on('mouseover', function() { toggleRowHighlight("warn"); }); 
$("#delete-table-row-button").on('mouseout', function() { toggleRowHighlight(false); }); 

$("#delete-table-column-button").on('mouseover', function() { toggleColumnHighlight("warn"); }); 
$("#delete-table-column-button").on('mouseout', function() { toggleColumnHighlight(false); }); 

$("#delete-table-button").on('mouseover', function() { toggleTableWarning(true); }); 
$("#delete-table-button").on('mouseout', function() { toggleTableWarning(false); }); 


////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 COL / ROW FUNCTIONS
////////////////////////////////////////////////
////////////////////////////////////////////////

function getTableRowAndColFromTableData(tableid) {
    var tableData = $("crypteetabledata[tableid='"+tableid+"']");
    var columns = parseInt(tableData.attr("columns"));
    var rows = parseInt(tableData.attr("rows"));
    return { columns : columns, rows : rows };
}

function getCellRowAndCol(tableid, cellIndex) {
    tableid = tableid || $("#table-dropdown").attr("tableid");
    if (cellIndex) {
        if (cellIndex > -1) {
            // you're good to go. got cell index as parameter
        } else {    
            cellIndex = $("#table-dropdown").attr("cellindex");
        }
    } else {
        cellIndex = $("#table-dropdown").attr("cellindex");
    }
    cellIndex = parseInt(cellIndex);

    if (!tableid || cellIndex < 0) { return; }
    
    var tableData = $("crypteetabledata[tableid='"+tableid+"']");
    var columns = parseInt(tableData.attr("columns"));
    var rows = parseInt(tableData.attr("rows"));

    var colNo = (cellIndex % columns) + 1;
    var rowNo = Math.ceil((cellIndex + 1) / columns);
    return {tableid : tableid, cellIndex : cellIndex, colNo : colNo, rowNo : rowNo, columns : columns, rows : rows };
}

function getCellIndexFromColAndRow(col, row, tableid) {
    var cellIndex;
    tableid = tableid || $("#table-dropdown").attr("tableid");
    
    var tableData = $("crypteetabledata[tableid='"+tableid+"']");
    var columns = parseInt(tableData.attr("columns"));

    cellIndex = (((row - 1) * columns) + col) - 1;
    
    return cellIndex;
}

// We use _proto.insertAt in both the table and cell blots to filter out newline / return characters to ensure the flex/grid won't break,
// But if all newline characters are filtered out, we wouldn't be able to add new rows / columns etc.
// so we have a boolean switch.
// we only enable this when the table-dropdown is shown.
// this ensures that the editor doesn't have a selection / focus, and things can't be pasted or typed in and break the table.

var tableInsertsEnabled = false;
var insertingCells = false;

function formatTable(tableid, columns, rows) {
    var formatTableDelta = getFormatDeltaForQuillTableData(tableid, columns, rows);
    quill.updateContents(formatTableDelta, "user");
}

function getFormatDeltaForQuillTableData(tableid, columns, rows, targetQuillIndex, delta) {
    delta = delta || {ops:[]};

    var tableRange = getTableRange(tableid);
    var tableQuillIndex = tableRange.index;

    // don't change anything up to the tabledata object
    delta.ops.push({ retain : tableQuillIndex - 1 });

    // update table data object
    delta.ops.push({ 
        retain : 1, 
        attributes : { 
            crypteetabledata : { columns : columns, rows : rows, tableid : tableid } 
        }
    });

    // now retain everything from beginning of table, all the way to the targetIndex. 
    if (targetQuillIndex) {
        if (targetQuillIndex - tableQuillIndex > 0) {
            delta.ops.push({ retain : (targetQuillIndex - tableQuillIndex) });
        }
    }

    return delta;
}

function insertRow(cellInfo, targetQuillIndex) {
    
    var cells = "\n".repeat(cellInfo.columns);

    var delta = {ops:[]};

    // first ops will set the columns & rows on to the tabledata element;
    delta = getFormatDeltaForQuillTableData(cellInfo.tableid, cellInfo.columns, cellInfo.rows + 1, targetQuillIndex, delta);

    delta.ops.push({ 
        insert : cells, 
        attributes : { crypteetable : cellInfo.tableid }
    });
    
    tableOperationsInProgress = true;

    quill.updateContents(delta, "user");
    quill.setSelection(targetQuillIndex); // set cursor at the beginning of the new row.

    tableOperationsInProgress = false;
}

function insertRowAbove() {
    var cellInfo = getCellRowAndCol();
    var cellIndexOfFirstCellInRow = getCellIndexFromColAndRow(1, cellInfo.rowNo, cellInfo.tableid);
    var targetRange = getCellRange(cellInfo.tableid, cellIndexOfFirstCellInRow);
    var targetQuillIndex = targetRange.index; // start of the first cell in the row
    insertRow(cellInfo, targetQuillIndex);
}

function insertRowBelow() {
    var cellInfo = getCellRowAndCol();
    var cellIndexOfLastCellInRow = getCellIndexFromColAndRow(cellInfo.columns, cellInfo.rowNo, cellInfo.tableid);
    var targetRange; 
    if ( cellInfo.rowNo === cellInfo.rows ) {
        // last row, use table's range
        targetRange = getTableRange(cellInfo.tableid);
    } else {
        // there's another row, get cell's range
        targetRange = getCellRange(cellInfo.tableid, cellIndexOfLastCellInRow);
    }

    var targetQuillIndex = targetRange.index + targetRange.length; // end of the last cell in the row (or the table if it's the bottom of the table)
    insertRow(cellInfo, targetQuillIndex);
}






function insertCellForColumnAtQuillIndex(delta, cellInfo, targetIndex, lastTargetIndex) {
    delta = delta || {ops:[]};
    
    delta.ops.push({ retain : targetIndex - lastTargetIndex });
    delta.ops.push({ 
        insert : "\n",
        attributes : { crypteetable : cellInfo.tableid }
    });

    return delta;
}

function insertColLeft() {
    insertCol("left");
}

function insertColRight() {
    insertCol("right");
}

function insertCol(insertWhere) {
    
    var cellInfo = getCellRowAndCol();
    var cellsInCurrentColumn = [];
    var currentColumn = cellInfo.colNo;
    var tableid = cellInfo.tableid;
    var columns = cellInfo.columns;
    var rows = cellInfo.rows;
    var table = $("crypteetable[tableid='"+tableid+"']");

    table.children().each(function(cellIndex) {
        var cellCol = (cellIndex % columns) + 1;
        if (cellCol === currentColumn) {
            var cell = $(this)[0];
            cellsInCurrentColumn.push(cell);
        }
    });

    var firstInsertedCellQuillIndex, targetQuillIndex; 
    var lastTargetIndex = 0;
    var delta = {ops:[]};

    formatTable(tableid, columns + 1, rows);

    cellsInCurrentColumn.forEach(function(cell, i) {
        if (insertWhere === "left") { 
            // insertLeft
            targetQuillIndex = getQuillIndexOfDOMNode(cell); // beginning of the cell, adding a newline here will effectively add a cell before this cell.
        } else { 
            //insertRight
            var cellIndex = $(cell).index();
            var cellRange = getCellRange(tableid, cellIndex);
            targetQuillIndex = cellRange.index + cellRange.length; // end of the cell, adding a newline here will effectively add a cell after this cell.    
        }

        if (!firstInsertedCellQuillIndex) { firstInsertedCellQuillIndex = targetQuillIndex; }
      
        delta = insertCellForColumnAtQuillIndex(delta, cellInfo, targetQuillIndex, lastTargetIndex);
        
        lastTargetIndex = targetQuillIndex;
    });
    
    insertingCells = true;
    tableInsertsEnabled = true;
    tableOperationsInProgress = true;
    quill.updateContents(delta, "user");
    
    insertingCells = false;
    tableInsertsEnabled = false;
    tableOperationsInProgress = false;

    quill.setSelection(firstInsertedCellQuillIndex); // set cursor at the beginning of the new column
}





function toggleColumnHighlight(highlight) {
    var cellInfo = getCellRowAndCol();
    if (!cellInfo) { return; }

    var targetCol = cellInfo.colNo;
    var tableid = cellInfo.tableid;
    var columns = cellInfo.columns;
    var table = $("crypteetable[tableid='"+tableid+"']");
    
    table.children().each(function(cellIndex) {
        var cellCol = (cellIndex % columns) + 1;
        if (cellCol === targetCol) {
            if (highlight) {
                $(this).addClass(highlight);
            } else {
                $(this).removeClass("warn insertLeft insertRight");
            }
        }
    });
    
    if (highlight) {
        $("#table-contextual-button").addClass(highlight);
    } else {
        $("#table-contextual-button").removeClass("warn insertLeft insertRight");
    }
}

function toggleRowHighlight(highlight) {
    var cellInfo = getCellRowAndCol();
    if (!cellInfo) { return; }

    var targetRow = cellInfo.rowNo;
    var tableid = cellInfo.tableid;
    var columns = cellInfo.columns;
    var table = $("crypteetable[tableid='"+tableid+"']");
    
    table.children().each(function(cellIndex) {
        var cellRow = Math.ceil((cellIndex + 1) / columns);
        if (cellRow === targetRow) {
            if (highlight) {
                $(this).addClass(highlight);
            } else {
                $(this).removeClass("warn insertAbove insertBelow");
            }
        }
    });
    
    if (highlight) {
        $("#table-contextual-button").addClass(highlight);
    } else {
        $("#table-contextual-button").removeClass("warn insertAbove insertBelow");
    }
}

function toggleTableWarning(warn) {
    var cellInfo = getCellRowAndCol();
    if (!cellInfo) { return; }
    
    var tableid = cellInfo.tableid;
    var table = $("crypteetable[tableid='"+tableid+"']");
    
    table.toggleClass("warn", warn);
    $("#table-contextual-button").toggleClass("warn", warn);

}


function deleteSelectedRow() {
    var cellInfo = getCellRowAndCol();

    var targetRow = cellInfo.rowNo;
    var tableid = cellInfo.tableid;
    var columns = cellInfo.columns;
    var rows = cellInfo.rows;

    var table = $("crypteetable[tableid='"+tableid+"']");
    
    // if it's the last row delete the whole table.
    if (rows <= 1) { deleteTable(tableid); return; }

    tableOperationsInProgress = true;
    table.children().each(function(cellIndex) {
        var cellRow = Math.ceil((cellIndex + 1) / columns);
        if (cellRow === targetRow) {
            $(this).remove();
        }
    });
    
    quill.update(); // this is to ensure we get the new table range after cells are deleted

    formatTable(tableid, columns, rows - 1);
    tableOperationsInProgress = false;

    setCursorToTableCellAtIndex(tableid, cellInfo.cellIndex);
}

function deleteSelectedCol() {
    var cellInfo = getCellRowAndCol();

    var targetCol = cellInfo.colNo;
    var tableid = cellInfo.tableid;
    var columns = cellInfo.columns;
    var rows = cellInfo.rows;
    
    var table = $("crypteetable[tableid='"+tableid+"']");
    
    // if it's the last column delete the whole table.
    if (columns <= 1) { deleteTable(tableid); return; }

    tableOperationsInProgress = true;
    table.children().each(function(cellIndex) {
        var cellCol = (cellIndex % columns) + 1;
        if (cellCol === targetCol) {
            $(this).remove();
        }
    });

    quill.update(); // this is to ensure we get the new table range after cells are deleted

    formatTable(tableid, columns - 1, rows);
    tableOperationsInProgress = false;

    setCursorToTableCellAtIndex(tableid, cellInfo.cellIndex);
}



function deleteSelectedTable() {
    var cellInfo = getCellRowAndCol();
    var tableid = cellInfo.tableid;
    deleteTable(tableid);
}

function deleteTable(tableid) {
    tableOperationsInProgress = true;
    $("crypteetable[tableid='"+tableid+"']").remove();
    $("crypteetabledata[tableid='"+tableid+"']").remove();
    tableOperationsInProgress = false;
}