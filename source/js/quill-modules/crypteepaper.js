var papers = {
    "a3" :          { unit : "mm", width : 297, height : 420, margins: 25,   opticalSeparator : 10  },
    "a4" :          { unit : "mm", width : 210, height : 297, margins: 25,   opticalSeparator : 10  },
    "usletter" :    { unit : "in", width : 8.5, height : 11,  margins: 0.75, opticalSeparator : 0.5 },
    "uslegal" :     { unit : "in", width : 8.5, height : 14,  margins: 0.75, opticalSeparator : 0.5 },
};

/**
 * Active paper size. Will always have mm values even for inch sized papers like US Letter
 */
var paper = {
    unit : "", 
    width : null, 
    height : null,
    margins: null,   
    widthPX : null,
    heightPX : null, 
    marginsPX : null, 
    opticalSeparator : null,
    orientation : "" 
};

////////////////////////////////////////////////
////////////////////////////////////////////////
//	HELPERS
////////////////////////////////////////////////
////////////////////////////////////////////////


var pixelPerMM; 

/**
 * Converts a pixel to its MM value for this display, using its native DPI / retina values, first by adding in a 100000mm div, then computing its pixel equivalent to determine the DPI value of the display.
 * @param {Number} px 
 * @returns {Number} millimeter
 */
 function px2mm(px) {
    
    if (!pixelPerMM) {
        var d = $("<div/>").css({ position: 'absolute', top : '-100000mm', left : '-100000mm', height : '100000mm', width : '100000mm' }).appendTo('body');
        pixelPerMM = d.height() / 100000;
        d.remove();
    }

    return px / pixelPerMM;
}

/**
 * Converts a MM to its PX value for this display, using its native DPI / retina values, first by adding in a 100000mm div, then computing its pixel equivalent to determine the DPI value of the display.
 * @param {Number} mm 
 * @returns {Number} pixel
 */
function mm2px(mm) {
    var onepx = px2mm(1);
    return mm / onepx;     
}

/**
 * Converts a MM to its PT value for PDF EXPORTS. 
 * Since PDF is derived from PostScript, it uses internally the same graphics model too including the same basic measurement unit as PostScript, which is points (72 points == 1 inch). This measurement unit is the device-independent way of using and stating dimensions.
 * @param {Number} mm 
 * @returns {Number} points
 */
function mm2pt(mm) {
    // 72 points = 1in = 25.4 mm
    return mm * 2.83464566929134;
}


/**
 * Converts INCHES to MMs
 * @param {Number} inches 
 */
function inch2mm(inches) { return inches * 25.4; }

/**
 * Gets an element, calculates which page the element is on
 * @param {*} elem A JQuery Element
 * @returns {Number} pageNo The page element is on
 */
function elementIsOnPageNo(elem) {
    var pageNo = Math.ceil(elemLeftOffsetMM(elem) / (paper.width + paper.opticalSeparator));
    return pageNo;
}

/**
 * Gets an element, calculates its left offset in mm
 * @param {*} elem A JQuery Element
 * @returns {Number} leftOffsetMM
 */
function elemLeftOffsetMM(elem) {
    return px2mm(elemLeftOffsetPX(elem));
}

/**
 * Gets an element, calculates its top offset in mm
 * @param {*} elem A JQuery Element
 * @returns {Number} topOffsetMM
 */
function elemTopOffsetMM(elem) {
    return px2mm(elemTopOffsetPX(elem));
}

/**
 * Gets an element, calculates its left offset in px
 * @param {*} elem A JQuery Element
 * @returns {Number} leftOffsetPX
 */
 function elemLeftOffsetPX(elem) {
    return $(elem)[0].offsetLeft;
}

/**
 * Gets an element, calculates its top offset in px (irregardless of scale)
 * @param {*} elem A JQuery Element
 * @returns {Number} topOffsetPX
 */
function elemTopOffsetPX(elem) {
    return elem[0].offsetTop || paper.marginsPX;
}



function isPaperMode() {
    if ($("body").attr("paper-stock")) {
        return true;
    } else {
        return false;
    }
}

if (isSafari) { $("body").addClass("safari"); }



/**
 * Creates a walker for the given tagName
 * @param {String} tagName
 * @param {*} root (defaults to ql-editor if not provided);
 */
 function walkTagname(tagName, root) {
    root = root || $(".ql-editor")[0];
    var walkerFilter = function(node) { return node.tagName===tagName ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP; };
    var walker = document.createTreeWalker($(".ql-editor")[0], NodeFilter.SHOW_ELEMENT, walkerFilter, false);
    var elems = [];
    while(elemNode = walker.nextNode()) { elems.push(elemNode); }
    return elems;
}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	CALCULATIONS
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * A helper function that returns the overflow line of a page in MM, given which page you're on.
 * @param {Number} pageNo page number
 * @returns {Number} overflowLineMM
 */
function overflowLineOfPageInMM(pageNo) {
    pageNo = pageNo || 1;
    if (pageNo <= 0) { pageNo = 1; }

    // for the first page, the overflow line is the paper's height - bottom margin
    var overflowLineMM = (paper("height") - paper("margins"));

                                  // page 1                    + page 2
    // for all other pages, this is (paperHeight + opticalSep) + (paperHeight - bottomMar)
    if (pageNo > 1) {  
        overflowLineMM = overflowLineMM + ((paper("height") + paper("opticalSeparator")) * (pageNo - 1)); 
    }
    
    return overflowLineMM;
}

var mobilePaperMode = false;
/**
 * Enables Paper Mode for the Editor (Can even be used as an inline HTML function)
 * @param {('a4'|'a3'|'usletter'|'uslegal')} paperStock The paper stock size (i.e. A4, A3, US Letter or US Legal) 
 * @param {('portrait'|'landscape')} orientation The paper orientation (portrait or landscape)
 * @param {Boolean} [forDocLoad] Pass true, if we're enabling paper mode because a new doc's loading. This will skip saving paper mode meta
 */
function enablePaperMode(paperStock, orientation, forDocLoad) {
    orientation = orientation || "portrait";
    forDocLoad = forDocLoad || false;

    // https://en.wikipedia.org/wiki/Letter_(paper_size) 
    // ugh ... why can't we agree on basic shit like this as humanity ... 
    if (["US", "CA", "CL", "CO", "CR", "MX", "PA", "GT", "DO", "PH"].includes(detectedLocale)) {
        paperStock = paperStock || "usletter";
    } else {
        paperStock = paperStock || "a4";
    }

    breadcrumb('[PAPER] Enabled Paper Mode with: ' + paperStock + "(" + orientation + ")" );

    var scrollbarWidth = getScrollbarWidth();
    document.body.style.setProperty("--scrollbar-width", scrollbarWidth + "px");

    $("body").attr("paper-stock", paperStock);
    $("body").attr("paper-orientation", orientation);
    
    paper = JSON.parse(JSON.stringify(papers[paperStock]));
    paper.orientation = orientation;

    // turns out when converting from mm to px, reading css height gives a more accurate value.
    // on some browsers though, we can't read calculated value, so we need fallbacks. 

    var quillComputedHeightPX = parseFloat(window.getComputedStyle($(".ql-editor")[0]).height);
    var quillComputedWidthPX = parseFloat(window.getComputedStyle($(".ql-editor")[0]).width);
    var quillComputedPaddingTopPX = parseFloat(window.getComputedStyle($(".ql-editor")[0]).paddingTop);

    paper.heightPX = quillComputedHeightPX; 
    paper.widthPX = quillComputedWidthPX;
    paper.marginsPX = quillComputedPaddingTopPX;
    
    if (orientation === "landscape") {
        paper.height = papers[paperStock].width;
        paper.width  = papers[paperStock].height;
        
        paper.heightPX = quillComputedWidthPX; 
        paper.widthPX = quillComputedHeightPX;
    }

    if (paper.unit === "in") {
        paper.height            = inch2mm(papers[paperStock].height);
        paper.width             = inch2mm(papers[paperStock].width);
        paper.margins           = inch2mm(papers[paperStock].margins);
        paper.opticalSeparator  = inch2mm(papers[paperStock].opticalSeparator);
    }

    swiper.mousewheel.disable();
    
    quill.addContainer('ql-pagenav');

    // on some mobile devices opening keyboard fucks up the paper layout. 
    // Still don't have a proper solution to this, so for now, disabling editing on mobile 
    // (bubble editor to be specific – but theoterically all on-screen keyboards could fuck stuff up.)
    // Needs investigation.
    if (isMobile) { 
        mobilePaperMode = true;
        breadcrumb('[PAPER] On Mobile, disabling editing.');
        quill.disable(); 
        $("#editorWrapper").append("<p id='preview-beta-popup' onclick='disablePaperMode();'>preview-mode. tap here to edit</p>");
    }
    
    calculatePaperOverflow(); 
    
    paperZoom("fit");

    hideMulticolOverflowPage();

    if (!forDocLoad) {
        // if we're not loading the doc, but switching a doc from continuous mode to paper mode, save paper mode meta to catalog & server
        saveDocumentPaperSizeAndOrientation(activeDocID, paperStock, orientation);
    }

    setTimeout(function () {
        calculatePaperOverflow();
    }, 1000);
    
    // if the user already enabled paper mode on any device ever at all, 
    // i.e. when a doc loads in paper mode, 
    // you won't ever have to grab their attention to this button again
    paidAttentionTo("panel-button-pagesetup");
}


/**
 * Disables Paper Mode for the Editor (Can even be used as an inline HTML function)
 * @param {Boolean} [forDocLoad] Pass true, if we're enabling paper mode because a new doc's loading. This will skip saving paper mode meta and optimize some stuff
 */
async function disablePaperMode(forDocLoad) {

    if (!isPaperMode()) { return; }
    forDocLoad = forDocLoad || false;

    breadcrumb('[PAPER] Disabled Paper Mode');

    $("body").removeAttr("paper-stock");
    $("body").removeAttr("paper-orientation");
    $(".ql-editor").css({ "background-image" : "" });
    $(".ql-pagenav").remove();
    
    paper = {
        unit : "", 
        width : null, 
        height : null, 
        margins: null,   
        opticalSeparator : null,
        orientation : "" 
    };

    swiper.mousewheel.enable();
    $(".ql-editor").off('wheel');

    if (!forDocLoad) { // to save the effort, since we'll empty the editor shortly
        
        // remove all fake / optical inline margins from elements
        $(".ql-editor").children().each(function(){ this.style.marginBottom = ""; });
    
        // remove all overflow classes, margins and pageno from tables and pagebreaks
        $("crypteetable, crypteetablecell, crypteepagebreak").removeClass("overflow").removeAttr("pgno preview-overflow-marbot").css({
            "--preview-martop": "",
            "--preview-marbot": ""
        });

    }

    paperZoom("100");

    if (isMobile) {
        // check if doc was locked or not, and enable editor if it wasn't locked;
        mobilePaperMode = false;
        var doc = await getDocFromCatalog(activeDocID);
        if (!doc.islocked) { quill.enable(); }
        $("#preview-beta-popup").remove();
    }

    if (!forDocLoad) {
        // if we're not loading the doc, but switching a doc from paper mode to continuous mode, save paper mode meta to catalog & server
        saveDocumentPaperSizeAndOrientation(activeDocID, "", "");
    }
    
}

/**
 * Adjust the paper zoom size
 * @param {('1:1'|'100'|'fit')} zoom 
 */
function paperZoom(zoom) {

    zoom = zoom || "fit";

    $(".ql-editor").attr("scale", 1);
    $(".ql-editor").attr("scaleV", 1);
    $(".ql-editor").attr("scaleH", 1);
    $(".ql-editor").css("transform", "scale(1)");
    $(".paper-zoom-button").removeClass("active");

    var windowHeightPX = $("body").height();
    var windowWidthPX = $("body").width();

    var editorHeightPX = $(".ql-editor").height();
    var editorWidthPX = $(".ql-editor").width();

    var editorTopOffsetPX = $(".ql-editor").offset().top;
    var editorLeftOffsetPX = $(".ql-editor").offset().left;
    var editorRightOffsetPX = editorTopOffsetPX; // on desktop this is the same
    if (isMobile) { editorRightOffsetPX = 0; } // on mobile the editor is 100% width

    var availableVerticalSpacePX = windowHeightPX - (editorTopOffsetPX + editorTopOffsetPX);
    var availableHorizontalSpacePX = windowWidthPX - (editorLeftOffsetPX + editorRightOffsetPX);
    
    var fittedScale;
    var fittedVerticalScale = 1 - (editorHeightPX - availableVerticalSpacePX) / editorHeightPX;
    var fittedHorizontalScale = 1 - (editorWidthPX - availableHorizontalSpacePX) / editorWidthPX;
 
    if (fittedVerticalScale <= fittedHorizontalScale) {
        fittedScale = fittedVerticalScale.toFixed(3);
    } else {
        fittedScale = fittedHorizontalScale.toFixed(3);
    }

    if (isPaperMode() && zoom === "fit") {
        $(".ql-editor").attr("scale", fittedScale);
        $(".ql-editor").attr("scaleV", fittedVerticalScale.toFixed(3));
        $(".ql-editor").attr("scaleH", fittedHorizontalScale.toFixed(3));
        $(".ql-editor").css("transform", "scale(" + fittedScale + ")");
        $(`.paper-zoom-button[mode='${zoom}']`).addClass("active");
        breadcrumb('[PAPER] Zoomed @ VScale: ' + fittedVerticalScale + " & HScale: " + fittedHorizontalScale + ". Will use : " + fittedScale);
    } else {
        $(".ql-editor").attr("scale", 1);
        $(".ql-editor").attr("scaleV", 1);
        $(".ql-editor").attr("scaleH", 1);
        $(".ql-editor").css("transform", "scale(" + 1 + ")");
        $(`.paper-zoom-button[mode='${zoom}']`).addClass("active");
    }

}

var windowResizedRecalcPaperTimeout;

/**
 * When the window is resized, we need to make sure the paper can still fit perfectly, so this function is triggered with a 300ms throttle/delay to re-calculate the paper overflow & zoom in the correct amount
 */
function windowResizedRecalculatePaper() {
    
    clearTimeout(windowResizedRecalcPaperTimeout);
    windowResizedRecalcPaperTimeout = setTimeout(function () {
        breadcrumb('[PAPER] Window Resized. Recalculating.');
        paperZoom("fit");
        setTimeout(function () { calculatePaperOverflow(); }, 100);
    }, 300);

}


/**
 * Due to how multicol layout works, there's always an extra paper. Depending on the browser, we have to use different methods to hide this. This function does that.
 */
function hideMulticolOverflowPage() {

    // we fix firefox using a different technique in CSS, so this hotfix isn't necessary
    if (isFirefox) { return; }

    breadcrumb('[PAPER] Not using Firefox. Applying overflow page fix.');

    $(".ql-editor").on('wheel', function(event) { 
        
        var scrollLeftPX = document.getElementsByClassName("ql-editor")[0].scrollLeft || 0;
        var scrollLeftMM = px2mm(scrollLeftPX);
        var multicolOverflowLineMM = ((numberOfPages() - 1) * (paper.width + paper.opticalSeparator));
        
        if (scrollLeftMM >= multicolOverflowLineMM) {
            event.preventDefault();
            var pageOffset = (numberOfPages() - 1) * (paper.width + paper.opticalSeparator);
            $(".ql-editor")[0].scrollTo({ top: 0, left: mm2px(pageOffset) });
        }
        
    });
}


$("#editorWrapper").on('click', '.pagedot', function(event) {
    goToPage($(this).index() + 1);
}); 


/**
 * Scrolls the editor to the given page number
 * @param {Number} pageNo 
 */
function goToPage(pageNo) {
    pageNo = pageNo || 1;
    if (pageNo < 1) { pageNo = 1; }
    breadcrumb('[PAPER] Going to page ' + pageNo);
    var pageOffsetPX = mm2px((pageNo - 1) * (paper.width + paper.opticalSeparator));
    $(".ql-editor")[0].scrollTo({ top: 0, left: pageOffsetPX, behavior: 'smooth' });
}


function goToNextPage() {
    var earliestActivePageNo = parseInt($(".pagedot.active").attr("pg") || 1);
    goToPage(earliestActivePageNo + 1);
}

function goToPrevPage() {
    var earliestActivePageNo = parseInt($(".pagedot.active").attr("pg") || 1);
    goToPage(earliestActivePageNo - 1);
}

/**
 * Checks if the page changed / user scrolled and updates the dots
 */
function checkIfPageChanged() {
    if (!isPaperMode()) { return; }
    
    var scrollLeftPX = document.getElementsByClassName("ql-editor")[0].scrollLeft || 0;
    var scrollLeftMM = px2mm(scrollLeftPX);

    var visiblePageNo = scrollLeftMM / (paper.width + paper.opticalSeparator);
    visiblePageNo = parseFloat(visiblePageNo.toFixed(1));

    $(".pagedot").removeClass("active");
    
    var currentPageIndex = Math.floor(visiblePageNo);
    $(".pagedot").eq(currentPageIndex).addClass("active");
    
    if (visiblePageNo % 1) { 
        // some parts of next page is visible too
        $(".pagedot").eq(currentPageIndex + 1).addClass("active");
    }
}



/**
 * Returns the number of pages
 * @returns {Number} noPages
 */
function numberOfPages() {
    var lastElement = $(".ql-editor").children().last();
    return elementIsOnPageNo(lastElement);
}


/**
 * This measures the content, counts the number of pages, and adds the correct amount of navigation dots 
 */
function calculateAndDisplayPageNavigationDots() {
    var noPages = numberOfPages();
    
    $(".ql-pagenav").attr("pages", noPages);

    // if page dot doesn't exist, add
    for (var i = 0; i < noPages; i++) {
        if (!$(`.pagedot[pg='${i+1}']`).length) { $(".ql-pagenav").append(`<button class="pagedot" pg="${i + 1}"></button>`); }
    }

    // remove extra dots (i.e. if user deletes some stuff, and there's less pages)
    var dotsCount = $(".ql-pagenav").children().length;
    var extraDots = $(".ql-pagenav").children().slice(noPages, dotsCount);
    extraDots.remove();
    
    $(".ql-pagenav").removeClass("compact tiny");
    if (noPages > 30) {
        $(".ql-pagenav").addClass("compact");
    }

    checkIfPageChanged();
}

/**
 * Calculates and inserts optical separators for paper margins & optical paper / page separation. 
 * @param {*} selectedNode optionally, you can define the node to start, so we can save compute cycles
 */
function calculatePaperOverflow(selectedNode) {
    
    if (!isPaperMode()) { return; }

    calculateAndDisplayPageNavigationDots();
 
    ////////////////////////////////////////////////
    ////////////////////////////////////////////////
    //	ELEMENT METRICS & PREPARATION
    ////////////////////////////////////////////////
    ////////////////////////////////////////////////

    var startFromChildIndex = 0;
    var totalChildrenInEditor = $(".ql-editor").children().length;

    if (selectedNode) {
        try {
            var selectedChild = findDOMNodesParentInQuill(selectedNode);
            var indexOfSelectedChild = $(selectedChild).index();
            startFromChildIndex = indexOfSelectedChild - 1;
            if (startFromChildIndex <= 0) { startFromChildIndex = 0; }
        } catch (error) {
            handleError("[PAPER] Couldn't find selected node's parent in Quill. Will start from child 0", error, "warning");
        }
    }

    $(".ql-editor").children().slice(startFromChildIndex, totalChildrenInEditor).each(function(){
        
        var elem = $(this);
    
        ////////////////////////////////////////////////
        ////////////////////////////////////////////////
        //	THINGS THAT WON'T NEED CALCULATION
        ////////////////////////////////////////////////
        ////////////////////////////////////////////////

        var isElemPageBreak = (this.tagName === "CRYPTEEPAGEBREAK");
        var isElemTableData = (this.tagName === "CRYPTEETABLEDATA");
        var isElemTable     = (this.tagName === "CRYPTEETABLE");

        if (!isElemTable && !isElemTableData && !isElemPageBreak) { return; }

        // It's a table / tabledata / page-break, let's do magic!

        ////////////////////////////////////////////////
        ////////////////////////////////////////////////
        //
        //	CALCULATIONS
        // 
        ////////////////////////////////////////////////
        ////////////////////////////////////////////////
    
        var elementIsOnPage = elementIsOnPageNo(elem);
        elem.attr("pgno", elementIsOnPage);
        
        if (isElemTable) {
            // pass 1 ( to position cells correctly etc )
            breakTableIfNecessaryForPreview(elem);
        }

        if (isElemPageBreak) {
            calculatePageBreakMargin(elem);
        }

    });
}





/**
 * Tables may span multiple pages. So this function breaks tables optically to multiple pages to make them appear correct.
 * @param {*} table
 */
 function breakTableIfNecessaryForPreview(table) {
    
    var noColumns = parseInt(table.attr("columns") || 1);

    // take the first page of table from tabledata to be safe
    var lastPageNo = elementIsOnPageNo(table.prev());
    var paperOverflowPointPX = paper.heightPX - paper.marginsPX;     
    var contentHeightOnPageSoFarPX = table.prev()[0].offsetTop; // where the table begins ( read from tabledata to be safe since it has zero height )
    var moveTheWholeTable = false;

    table.addClass("overflow");
    table.children().removeClass("overflow").css("--preview-martop", "").attr("pgno", "");
    table.children().each(function(cellIndex){
        
        // only do the calculation based on the first cells in row, 
        // since all cells in row get the height from each other, let's save calc cycles
        if (cellIndex % noColumns !== 0) {
            $(this).attr("pgno", lastPageNo);
            return; 
        }

        var cell = $(this);
        var cellHeightPX = this.clientHeight + 1; // +1 for border
        var cellTopOffsetPX = elemTopOffsetPX(cell);
        
        if (cellIndex === 0) {
            // check if the first cell is already too tall for the page, 
            // this means table itself will begin on the next page, 
            // so we can add padding to the bottom of the element before the table, 
            // and align / move the table to the following page first.
            
            if (contentHeightOnPageSoFarPX + cellHeightPX > paperOverflowPointPX) {
                // table needs to start on new page, there's not enough room even for the first cell on the current page.
                moveTheWholeTable = true;
                table.attr("pgno", lastPageNo + 1);
                table.prev().attr("pgno", lastPageNo + 1);
            } 
        }

        if (contentHeightOnPageSoFarPX + cellHeightPX >= paperOverflowPointPX) {
            // new page

            // first, we need to move the cell to the next page, so we can calculate its actual height.             
            // we will offset the cell with a large magic number to make sure it's definitely on the next page, but not on the top of the page
            // 500 is the magic number, it's 500 because the smallest page we support A4 = ~1122.52px, and we want the element to be definitely on the next page.
            var magicNumber = 500;

            offsetRow(table, cellIndex, magicNumber);
            
            // now that cell is on the next page, let's check its height again. 
            // this time it will be correct
            cellHeightPX = this.clientHeight + 1; // +1 for border

            // now we know how far from the top this cell is, thanks to the magic number helping us figure out the amount we need to offset it.
            cellTopOffsetPX = elemTopOffsetPX(cell);
            var correctMarginTopPX = Math.ceil(Math.abs(cellTopOffsetPX - magicNumber - paper.marginsPX));
            
            // in Chromium & Webkit, sometimes, we can pack things tighter.
            // not sure what causes this but had to add this in order to make table layouts work consistently across browsers 
            
            if (correctMarginTopPX > cellHeightPX) { 
                
                removeRowOffset(table, cellIndex);
                
            } else {
                
                if (cellIndex === 0 && moveTheWholeTable) {
                    try {
                        var elemBeforeTable = table.prev().prev();
                        // +1 to account for the table's top border
                        elemBeforeTable.attr("preview-overflow-marbot", true).css("--preview-marbot", (correctMarginTopPX + 1) + "px");
                    } catch (error) {
                        handleError("[PAPER] Table is element 0!", error);
                        // table might be the first element. In this case, we're not going to add margin bottom to the element before the table.
                        // More importantly, looks like if this happens, we'll have a bunch of other problems, like seems like we can't add new rows etc to the table.
                    }
                    removeRowOffset(table, cellIndex);
                } else {
                    // this is the correct amount of px we'll offset the new row to make sure it's aligned to the top of the next page

                    if (moveTheWholeTable) {
                        offsetRow(table, cellIndex, correctMarginTopPX + 1);
                    } else {
                        offsetRow(table, cellIndex, correctMarginTopPX);
                    }
                }

                contentHeightOnPageSoFarPX = paper.marginsPX + cellHeightPX;
    
                lastPageNo++;

            }

        } else {
            // same page
            contentHeightOnPageSoFarPX = contentHeightOnPageSoFarPX + cellHeightPX;
        }
        
        $(this).attr("pgno", lastPageNo);
        
    });
    
    // now that things are on the page, let's do a second pass to iron out ~1px imperfections 

    function offsetRow(table, cellIndex, offsetPX) {
        var cellsInRow = table.children().slice(cellIndex, cellIndex + noColumns);
        cellsInRow.addClass("overflow");
        cellsInRow.addClass("overflow").css("--preview-martop", offsetPX + "px");
    }

    function removeRowOffset(table, cellIndex) {
        var cellsInRow = table.children().slice(cellIndex, cellIndex + noColumns);
        cellsInRow.removeClass("overflow").css("--preview-martop", "");
    }
}



/**
 * Calculates and sets the amount of margin we'll add to the bottom of the pagebreak element
 * @param {*} pgbreak 
 */
function calculatePageBreakMargin(pgbr) {
    
    var pgbrTopOffsetPX = elemTopOffsetPX(pgbr); // incl paper top margin
    var paperWithoutMarginsPX = paper.heightPX - paper.marginsPX - paper.marginsPX;     
    
    // since pgbrTopOffsetPX includes top margin, and it gets subtracted here, we'll need to add another margin worth of px here
    var offsetPX = paperWithoutMarginsPX - pgbrTopOffsetPX + paper.marginsPX; 

    pgbr.attr("preview-overflow-marbot", true).css("--preview-marbot", offsetPX + "px");

}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	
// PDF EXPORT AND CONVERSION
// 
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * This converts the document to a PDF file page-by-page and downloads it. Super computationally intensive op. Use wisely.
 */
async function prepareDocumentPDF() {

    if ($("body").hasClass("exporting-pdf")) {
        createPopup("Seems like cryptee is still busy converting your document to a paper-friendly format like PDF. This may take another few seconds depending on how complex and large your document is as well as the processing power of your device.", "info");
        return;
    }

    breadcrumb('[PAPER] [EXPORT] Starting PDF preparations');

    var numPages = numberOfPages();

    // start progress
    startPDFExportProgress(numPages);

    var documentName = await getDocNameFromCatalog(activeDocID) || "Cryptee Document";

    var paperStock = $("body").attr("paper-stock");
    var orientation = $("body").attr("paper-orientation");
    var paperMargins = papers[paperStock].margins;
    if (paperStock.startsWith("us")) { paperStock = paperStock.replace("us", ""); } 

    var jsPDFConfig = {
        unit: paper.unit, 
        format: paperStock, 
        orientation: orientation, 
        hotfixes : ['px_scaling']
    };

    var pdfEncryptionConfig = getPDFEncryptionConfig();

    if (pdfEncryptionConfig) { jsPDFConfig.encryption = pdfEncryptionConfig; }

    var pdfOptions = {
        enableLinks:  false,
        margin:       paperMargins,
        filename:     documentName + '.pdf',
        html2canvas:  { scale: 2 },
        pagebreak:    { mode : ['avoid-all'] },
        image:        { type: 'jpeg', quality: 0.98 },
        jsPDF:        jsPDFConfig
    };
    
    // this splits all the words in the editor for the export, so we can check which page they're on.
    splitWordsForPDFExport();

    // check pages of each word, and assigns them pages
    assignPagesToWordsForPDFExport();

    // check for custom elements / images etc, and assign pages
    assignPagesToCustomElementsForPDFExport();

    // create an array of DIVs to contain each page's contents
    var pages = createPageDIVsForPDFExport(numPages);

    breadcrumb('[PAPER] [EXPORT] Cloning editor contents');
    
    // now copy and append each element in the editor into its own page div
    // yep this sucks, but we have to, otherwise, we'll fuck up the editor's own contents
    $(".ql-editor").children().each(function(){
        var elem = $(document.importNode(this, true));
        elem = handlePlacingWordsAndCustomElementsForPDF(elem, pages); 
        elem = handleBackgroundColorForPDF(elem);
        elem = handleSplittingTablesForPDF(elem, pages);
        
        var pgno = parseInt(elem.attr("pgno") - 1);
        elem.appendTo(pages[pgno]);
    });
    
    // pages.forEach(page => { console.log(page); });
    
    breadcrumb('[PAPER] [EXPORT] Preparing PDF page 1 / ' + numPages);

    // write the first page to the pdf to start the PDF
    var pdfWorker = html2pdf().set(pdfOptions).from(pages[0]).toPdf();

    // write pages to the PDF, one by one by using their own canvas. 
    // this is so that we never exceed the max canvas height allowed in the browser.
    // we could theoretically write the entire editor into one big canvas, and use page breaks, 
    // but for an A4 paper size, around page 6, we'll exceed max canvas height. 
    // and stuff will be cut off. 
    if (pages.length > 1) { 
        pages.slice(1).forEach(function (page, pageIndex) {
            pdfWorker = pdfWorker.get('pdf').then(pdf => {
                breadcrumb('[PAPER] [EXPORT] Preparing PDF page ' + (pageIndex+2) + " / " + numPages);
                pdf.addPage();
            }).from(page).toContainer().toCanvas().toPdf().then(()=>{
                updatePDFExportProgress(pageIndex+2, numPages); // because we already have 1, and loop starts with 0, we'll add +2 to compensate
            });
        });
    }

    // we're doing this here while the export is going on to camouflage UI being unresponsive
    joinWordsPDFExportComplete();

    pdfWorker = pdfWorker.save().then(()=>{
        stopPDFExportProgress();
    }).catch(function(error) {
        handleError("[PAPER] [EXPORT] Failed to save PDF", error);
        createPopup("failed to export your PDF. Chances are a content-blocker or browser-extension is causing this issue. Please disable your content-blockers, allow Cryptee to save/download files to your device if prompted by your browser, try again and reach out to our support via our helpdesk if this issue continues.", "error");
        stopPDFExportProgress();
    });

}


// cleanup layers while cloning to solve issues like multi-line text's background-colors.
// https://github.com/niklasvh/html2canvas/issues/548#issuecomment-916757145 
function handleBackgroundColorForPDF(elem) {
    
    breadcrumb('[PAPER] [EXPORT] Handling Background Colors');

    // if element has background color, apply same background color to its words first. 
    if ($(elem).css("background-color")) { 
        elem = splitHighlightedWords(elem);
    }

    // if any one of element's children have different background colors, 
    // take those words and apply the correct background color
    $(elem).contents().filter(function() {
        if (this.nodeType === 3) { 
            return false; // text nodes will return undefined when we try to read their bg color  
        } else {
            return $(this).css("background-color");
        }
    }).each(function(){
        var elementWithBackgroundColor = $(this)[0];
        splitHighlightedWords(elementWithBackgroundColor);
    });

    return elem;

}




// take all contents with background color (highlights), go word by word and apply the same background color. 
// this way, when a new word is on a new line, it has its own boundary box. 
function splitHighlightedWords(elementWithBackgroundColor) {

    breadcrumb('[PAPER] [EXPORT] Handling highlighted words');

    // Get the background color of the element
    var bgColor = $(elementWithBackgroundColor).css("background-color") || "";
    $(elementWithBackgroundColor).css("background-color", "");

    // we wrap words and whitespaces separately as if the whitespace is a separate word 
    // so if the user has multiple whitespaces like "word1    word2", we'll get "word1", "    ", "word2"

    // elementWithBackgroundColor.innerHTML = elementWithBackgroundColor.textContent.replace(/\S+|\s+/g, '<span style="background-color:'+bgColor+';">$&</span>');   

    $(elementWithBackgroundColor).children("span[w]").each(function(){ 
        $(this).css("background-color", bgColor);
        this.textContent += " "; // this is to make spaces have the background color too
    });

    return elementWithBackgroundColor;
}



/**
 * Splits tables into multiple pages. Takes a table, looks at its cells / which page they should go to, creates a new table for each page, and puts the cells in the correct pages. 
 * @param {*} elem 
 * @param {Array} pages array of divs for each page
 */
function handleSplittingTablesForPDF(elem, pages) {
    if (elem[0].tagName !== "CRYPTEETABLE") { return elem; }

    breadcrumb('[PAPER] [EXPORT] Splitting a table');
    var table = elem;
    var cells = table.children();
    var tableStartPageNo= parseInt(cells.first().attr("pgno"));
    var tableEndPageNo  = parseInt(cells.last().attr("pgno"));
    var tableCols       = table.attr("columns");
    var tableRows       = table.attr("rows");
    
    // now create x number of tables for each page
    // skip the first page, we'll return this instead
    for (let pgno = tableStartPageNo + 1; pgno <= tableEndPageNo; pgno++) {   
        var copyTable = document.createElement("crypteetable");
        $(copyTable).attr({ "columns": tableCols, "rows": tableRows, "pgno" : pgno });
        $(copyTable).css("--columns", tableCols);
        $(copyTable).css("--rows", tableRows);
        
        cleanTableCellsOfPage(pgno).appendTo(copyTable);

        $(copyTable).appendTo(pages[pgno - 1]);
    }

    // we need to return only the starting page's table 
    // (i.e. the original one, since it'll have only the first page's cells)
    
    // that's what will get added in the next line in prepareDocumentPDF like : 
    // elem.appendTo(pages[pgno]);
    
    table.removeClass("overflow warn selected");
    cleanTableCellsOfPage(tableStartPageNo);

    return table;

    function cleanTableCellsOfPage(pgno) {
        return table.children(`[pgno='${pgno}']`)
        .css("--preview-martop","")
        .removeAttr("pgno")
        .removeClass("warn selected insertAbove insertBelow insertRight insertLeft overflow");
    }
}

/**
 * Splits paragraphs into multiple pages. Takes a paragraph, looks at its children / words, which page they should go to, creates a new paragraph for each page, and puts the children in the correct pages' paragraphs. 
 * @param {*} elem 
 * @param {Array} pages array of divs for each page
 */
function handlePlacingWordsAndCustomElementsForPDF(elem, pages) {

    if (elem[0].tagName === "CRYPTEETABLE")     { return elem; }
    if (elem[0].tagName === "CRYPTEETABLEDATA") { return elem; }
    if (elem[0].tagName === "CRYPTEEPAGEBREAK") { return elem; }
    
    breadcrumb('[PAPER] [EXPORT] Placing words & custom elements');

    var children = elem[0].querySelectorAll("[pgno]");
    var numPagedChildren = children.length;

    // i.e. <p pgno="11"><br></p> will return right away, since there's no children with pages to place, and the element itself will be placed
    // but  <p><span w pg="1">word</span></p> will continue since we need to place its child to page 1
    // but  <p><img pgno="2"/></p> will continue since we need to place its img child to page 2 etc.
    
    if (!numPagedChildren) { return elem; }

    var elemStartPageNo = parseInt(children[0].getAttribute("pgno"));
    var elemEndPageNo = parseInt(children[numPagedChildren - 1].getAttribute("pgno"));

    // now create x number of copy elements for each page
    // and delete this element's words or custom elements that are not on each page
    for (let pgno = elemStartPageNo; pgno <= elemEndPageNo; pgno++) {
        
        // skip the start page, we'll deal with that later in the parent loop 
        // by inserting the parent into dom right away
        if (pgno === elemStartPageNo) { 
            elem.attr("pgno", elemStartPageNo);
            continue; 
        }
        
        // make a copy to keep the original in the editor
        var copyElem = document.importNode(elem[0], true);
        copyElem.setAttribute("pgno", pgno);
        
        // remove all elements that don't belong to this page 
        // i.e. large paragraph with lots of words some on page 2, some on page 3
        // if we're on page 2 in the loop, remove all words from page 3, 
        // since we create a copy parent for each page, we want to keep only the relevent words on the current page ( page 2 ) 
        copyElem.querySelectorAll("[pgno]:not([pgno='"+pgno+"'])").forEach(e => e.parentNode.removeChild(e));

        // finally append the parent to the correct page div ( i.e. page 2 = pages[1] )
        $(copyElem).appendTo(pages[pgno - 1]);

    }
    
    // we need to return only the starting page's element 
    // (i.e. the original one, and it needs to have only the first page's words or custom elements)
    
    // that's what will get added in the next line in prepareDocumentPDF like : 
    // elem.appendTo(pages[pgno]);
    
    elem[0].querySelectorAll("[pgno]:not([pgno='"+elemStartPageNo+"'])").forEach(e => e.parentNode.removeChild(e));
    
    return elem;
}





/**
 * Converts back all words to textNodes after the export is complete
 */
function joinWordsPDFExportComplete() {
    breadcrumb('[PAPER] [EXPORT] Joining words');
    var wordsFilter = function(node) { return node.hasAttribute("w") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP; };
    var wordsWalker = document.createTreeWalker($(".ql-editor")[0], NodeFilter.SHOW_ELEMENT, wordsFilter, false);
    var words = [];
    while(wordNode = wordsWalker.nextNode()) { words.push(wordNode); }
    words.forEach(word => { word.removeAttribute("w"); });
    breadcrumb('[PAPER] [EXPORT] Joined words');
}

/**
 * Converts all words in textNodes to individual <span w>word</span> elements to calculate their pages.
 */
function splitWordsForPDFExport() {
    breadcrumb('[PAPER] [EXPORT] Splitting words');
    $(".ql-editor")[0].children.forEach(child => {
        var isChildPageBreak = (child.tagName === "CRYPTEEPAGEBREAK");
        var isChildTableData = (child.tagName === "CRYPTEETABLEDATA");
        var isChildTable     = (child.tagName === "CRYPTEETABLE");
        var isChildKATEX     = (child.querySelectorAll(".ql-formula").length); 
        if (isChildPageBreak || isChildTableData || isChildTable || isChildKATEX) { return; }
        
        var walker = document.createTreeWalker(child, NodeFilter.SHOW_TEXT, null, false);
        var textNodes = [];
        while(node = walker.nextNode()) { textNodes.push(node); }
        textNodes.forEach(textNode => { splitWordsOfText(textNode); });

        // turn newlines into a word too so we can give them page numbers
        if (child.firstChild) {
            if (child.firstChild.tagName === "BR") { child.setAttribute("w", ""); }
        }
    });
    breadcrumb('[PAPER] [EXPORT] Splitted words');
}

/**
 * Takes a text, and splits its words into <span w>word</span> elements
 * @param {*} textNode 
 */
function splitWordsOfText(textNode) {
    if (textNode.parentNode.hasAttribute("w")) { return; } // failsafe juuuust in case.
    
    var isParentTag    = (textNode.parentNode.tagName === "CRYPTEETAG");
    var isParentFile   = (textNode.parentNode.tagName === "CRYPTEEFILE");
    var isParentFolder = (textNode.parentNode.tagName === "CRYPTEEFOLDER"); 

    if (isParentTag || isParentFile || isParentFolder) { 
        var quillChild = findDOMNodesParentInQuill(textNode);
        quillChild.setAttribute("w", "");
        return; 
    }

    var text = textNode.textContent;
    // $(textNode).replaceWith("<span w>" + text.split(" ").join("</span> <span w>") + "</span>");
    
    var spanContent = text.replace(/\S+|\s+\s/g, '<span w>$&</span>');
    $(textNode).replaceWith(spanContent);
}


/**
 * Takes the clone of the editor with tons of words, measures which page they're on, and assigns them the correct page number.
 */
function assignPagesToWordsForPDFExport() {
    breadcrumb('[PAPER] [EXPORT] Assigning pages to words');
    var wordsFilter = function(node) { return node.hasAttribute("w") ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP; };
    var wordsWalker = document.createTreeWalker($(".ql-editor")[0], NodeFilter.SHOW_ELEMENT, wordsFilter, false);
    var words = [];
    while(wordNode = wordsWalker.nextNode()) { words.push(wordNode); }
    words.forEach(word => { word.setAttribute("pgno", Math.ceil(px2mm(word.offsetLeft) / (paper.width + paper.opticalSeparator))); });
    breadcrumb('[PAPER] [EXPORT] Assigned pages to words');
}

function assignPagesToCustomElementsForPDFExport() {
    breadcrumb('[PAPER] [EXPORT] Assigning pages to custom elements');
    
    breadcrumb('[PAPER] [EXPORT] Assigning pages to images');
    createWalkerForTagAndAssignPagesForPDFExport("IMG");

    breadcrumb('[PAPER] [EXPORT] Assigning pages to dividers');
    createWalkerForTagAndAssignPagesForPDFExport("HR");
    
    breadcrumb('[PAPER] [EXPORT] Assigning pages to formulas');
    assignPagesToFormulasForPDFExport();

}

/**
 * Creates a walker for the given tagName, and assigns the elements their pages for PDF Export
 * @param {String} tagName
 */
function createWalkerForTagAndAssignPagesForPDFExport(tagName) {
    
    breadcrumb('[PAPER] [EXPORT] Assigning pages to ' + tagName + " elements");

    walkTagname(tagName).forEach(elem => { 
        var pgno = Math.ceil(px2mm(elem.offsetLeft) / (paper.width + paper.opticalSeparator));
        elem.setAttribute("pgno", pgno);
        var quillChildParent = findDOMNodesParentInQuill(elem);
        if (quillChildParent) { quillChildParent.setAttribute("pgno", pgno); }
    });

}

/**
 * Finds all formulas, measures which page they're on, and assigns them the correct page number.
 */
function assignPagesToFormulasForPDFExport() {
    
    breadcrumb('[PAPER] [EXPORT] Assigning pages to formulas');

    $(".ql-editor")[0].querySelectorAll(".ql-formula").forEach(function(elem){
        var pgno = Math.ceil(px2mm(elem.offsetLeft) / (paper.width + paper.opticalSeparator));
        elem.setAttribute("pgno", pgno);
        var quillChildParent = findDOMNodesParentInQuill(elem);
        if (quillChildParent) { quillChildParent.setAttribute("pgno", pgno); }
    });

}

/**
 * Creates an array of DIVs to contain each page's contents
 * @param {Number} numPages 
 * @returns {Array} pages
 */
function createPageDIVsForPDFExport(numPages) {
    breadcrumb('[PAPER] [EXPORT] Creating ' + numPages + " for PDF export");

    var pages = [];

    // now create that many divs in the pages array
    for (let pgno = 0; pgno < numPages; pgno++) {
        // this needs to be a DIV with class "ql-editor", otherwise elements won't have correct styling. 
        // this has a .pdf class to remove optical margins etc
        var pageDiv = document.createElement("div");
        pageDiv.setAttribute('pgno', pgno + 1);
        pageDiv.classList.add('ql-editor');
        pageDiv.classList.add('pdf');
        pages.push(pageDiv);
    }

    return pages;
        
}

/**
 * Starts the PDF Export Progress Bar with the number of pages for progress
 * @param {*} noPages 
 */
function startPDFExportProgress(noPages) {

    breadcrumb('[PAPER] [EXPORT] Displaying export progress');
    
    noPages = noPages || 1;
    
    $("body").addClass("exporting-pdf");
    
    $("#progress").removeClass("green red yellow blue");
    $("#progress").removeAttr("max");
    $("#progress").removeAttr("value");
    $("#saveas-pdf-actions > button").addClass("loading");
    
    updatePDFExportProgress(1, noPages);
    clearInterval(rightProgressTimer);
    rightProgressSeconds = 0;
    
    hidePanels("saveas-pdf");
    quill.blur();
    quill.disable();
    
}


/**
 * Stops the PDF Export Progress Bar
 */
async function stopPDFExportProgress() {
    
    breadcrumb('[PAPER] [EXPORT] Hiding export progress');

    $("#progress").attr("value", 100);
    $("#progress").attr("max", 100);
    $("#progress").removeClass("green red yellow blue");
    $("#progress").addClass("green");
    $("#saveas-pdf-actions > button").removeClass("loading");

    resetPDFExporter();

    $("body").removeClass("exporting-pdf");
    var doc = await getDocFromCatalog(activeDocID);
    if (!doc.islocked && !mobilePaperMode) { quill.enable(); }

    clearInterval(rightProgressTimer);
    rightProgressSeconds = 0;

    hidePanels();

}

/**
 * Updates the PDF Export Progress with the correct no of pages
 * @param {*} current 
 * @param {*} total 
 */
function updatePDFExportProgress(current, total) {
    breadcrumb('[PAPER] [EXPORT] Exporting Page ' + current + " / " + total);
    $("#statusMessage").html("<b>EXPORTING PDF...</b> ( PAGE " + current + " / " + total + " )");
    $("#saveas-pdf-print-button").attr("status", "PAGE " + current + " / " + total);
}

/**
 * This is the substitute to browser's built-in print. When user presses cmd + p, if we're not in paper mode, we switch to it, and if user's in paper mode, we display the PDF export panel.
 */
function printDocument() {
    if (isPaperMode()) {
        togglePanel("saveas-pdf");
    } else {
        togglePanel('panel-pagesetup');
        enablePaperMode();
    }
}


/**
 * Returns the correct encryption config for jsPDF based on user's preferences
 * @returns {Object} encryptionConfigSettings
 */
function getPDFEncryptionConfig() {
    var pw = ($("#pdf-password-protect-input").val() || "").trim();
    if (!pw) { return null; }

    var permissions = [];

    var canModify = $("#pdf-permissions-modifications-checkbox").is(':checked');
    if (canModify) { permissions.push("modify"); }
    
    var canPrint = $("#pdf-permissions-printing-checkbox").is(':checked');
    if (canPrint) { permissions.push("print"); }
    
    return { ownerPassword : activeDocID, userPassword : pw, userPermissions : permissions };
}

/**
 * Resets the PDF export panel's checkboxes inputs etc
 */
function resetPDFExporter() {
    $("#pdf-permissions-password-checkbox").prop('checked', false);
    $("#pdf-permissions-modifications-checkbox").prop('checked', false);
    $("#pdf-permissions-printing-checkbox").prop('checked', false);
    $("#pw-protect-pdf-checkbox").prop('checked', false);
    $("#pdf-password-protect-input").val("");
    $("#saveas-pdf").removeClass("expanded");
}

$("#pw-protect-pdf-checkbox").on('change', function(event) {
    var isChecked = $(this).is(':checked');
    $("#saveas-pdf").toggleClass("expanded", isChecked);

    if (!isChecked) {
        $("#pdf-permissions-password-checkbox").prop('checked', false);
        $("#pdf-permissions-modifications-checkbox").prop('checked', false);
        $("#pdf-permissions-printing-checkbox").prop('checked', false);
        $("#pdf-password-protect-input").val("");
    }
}); 


key('command+p, ctrl+p', function () { 
    printDocument(); 
    return false; 
});

function needToPrint() {
    createPopup("Due to cross-browser compatibility issues with printers, paper sizes and margins, to print this document pixel-accurately, you'll need to print the PDF after downloading it.<br><br>please be mindful of our planet's resources, use less paper if possible.", "info");
}

function showPasswordInfo() {
    createPopup("PDF version 1.3 has a security shortcoming as a format. it uses RC4 40-bit encryption, which is known to be weak, and can be cracked by someone determined with the necessary skills or tools. <br><br> please keep in mind that this feature provides just a basic password protection, and it's not a state of the art form of encryption.", "warning");
}