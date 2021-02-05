// this takes in :
// $(".ql-editor").contents() 
// "title" 
// and returns a new Document() to use in Packer for saving

/**
 * This takes in html contents + document title, and returns a new Document() to be used in docx.Packer for saving a worddoc  
 * @param {string} htmlContents raw & pre-processed html string
 * @param {string} title document name 
 */
function htmlToDocx(htmlContents, title) {

    var doc = new docx.Document({ 
        title: title, 
        styles : { paragraphStyles: styles() } 
    });

    var docChildren = [];
  
    $(htmlContents).each(function(i, element){
        identifyElement(element);
    });
  
    function identifyElement(element) {
        var tag = "text"; if ($(element).prop("tagName")) { tag = $(element).prop("tagName").toLowerCase(); }
        
        if (tag === "ul" || tag === "ol") {
    
            // it's a bullet/list section. based on depth, we'll need new paragraphs for each bullet. 
            var bulletParagraphs = [];
    
            $(element).contents().each(function(i, elem){
                var paragraph = newParagraph([createWordElement(elem)], alignment(elem), bullet(elem), heading(elem));
                docChildren.push(paragraph);
            });
    
            // doc.addSection({ children: bulletParagraphs });
  
        } else if (tag === "table") {

            // it's a table.

            // get table's rows
            var arrayOfTableRows = [];

            $(element).contents().each(function(i, tbody){
                
                // skip if it's not a tablebody
                if (tbody.tagName !== "TBODY") { return true; } 

                $(tbody).contents().each(function(i, row){
                    
                    // skip if it's not a tablerow
                    if (row.tagName !== "TR") { return true; } 

                    // get row's cells
                    var arrayOfTableCells = [];

                    $(row).contents().each(function(i, cell){
                        
                        // skip if it's not a tablerow
                        if (cell.tagName !== "TD") { return true; } 

                        // get cell's contents
                        var arrayOfCellContents = [];
                        $(cell).contents().each(function(i, elem){

                            var childrenToAddToParagraph = [];
                            unpackDOMElement(elem, doc, childrenToAddToParagraph);

                            var paragraph = newParagraph(childrenToAddToParagraph, alignment(elem), null, heading(elem));
                            arrayOfCellContents.push(paragraph);
                        });

                        arrayOfTableCells.push(tableCell(arrayOfCellContents));
                    });

                    arrayOfTableRows.push(tableRow(arrayOfTableCells));

                });

            });

            var table = newTable(arrayOfTableRows);
            // doc.addSection({ children: [table] });
            docChildren.push(table);

        } else {

            // it's not a bullet/list, so it's text or image, parse regularly.
            var childrenToAddToParagraph = [];
            unpackDOMElement(element, doc, childrenToAddToParagraph);
            
            docChildren.push(newParagraph(childrenToAddToParagraph, alignment(element), null, heading(element)));
            // doc.addSection({ 
            //     children: [ newParagraph(childrenToAddToParagraph, alignment(element), null, heading(element)) ] 
            // });

        }

        
    }



    // this will take a dom element, enumerate its contents, and add them to childrenToAddToParagraph array.
    // unless it's a bullet. 
  
    function unpackDOMElement(element, doc, childrenToAddToParagraph) {
        var contents = $(element).contents();
      
        if (contents.length > 1) {
            contents.each(function(i, elem){
                unpackDOMElement(elem, doc, childrenToAddToParagraph);
            });
        } else {
            var wordElement = createWordElement(element);
            childrenToAddToParagraph.push(wordElement);
        }
    }






  
    function createWordElement(e) {
        var tag = "text"; if ($(e).prop("tagName")) { tag = $(e).prop("tagName").toLowerCase(); }
        var wordElement;

        var text = e.textContent || "";
        if (text) {
            if (["p", "span", "text", "li", "h1", "h2", "h3", "h4", "h5", "h6"].indexOf(tag) !== -1) { 
                wordElement = new docx.TextRun(text); 
            }
    
            if (tag === "b" || tag === "strong") { 
                wordElement = new docx.TextRun({ text: text, bold: true }); 
            }
    
            if (tag === "i" || tag === "em") { 
                wordElement = new docx.TextRun({ text: text, italics: true }); 
            }
    
            if (tag === "s") {
                wordElement = new docx.TextRun({ text: text, strike: true }); 
            }
    
            if (tag === "u") { 
                wordElement = new docx.TextRun({ text: text, underline: {} }); 
            }
    
            if (tag === "a") { 
                var url = $(e).attr("href");
                wordElement = new docx.Hyperlink({ text: text, anchor: url }); 
            }
  
        } else {
            var subContents = $(e).contents();
            subContents.each(function(i, elem){
                var subTag = $(elem).prop("tagName");
                if (subTag) {
                    if (subTag.toLowerCase() === "img") {
                        var b64 = $(elem).attr("src");
                        var imgW = elem.naturalWidth;
                        var imgH = elem.naturalHeight;
                        if (b64) {
                            wordElement = docx.Media.addImage(doc, b64, imgW, imgH);
                        }
                    } else {
                        // likely <br>
                        // console.log(subTag);
                    }
                }
            });
        }
      
        return wordElement;
    }
  




    function alignment(e) {
        if ($(e).hasClass("ql-align-right")) { return docx.AlignmentType.RIGHT; }
        else if ($(e).hasClass("ql-align-center")) { return docx.AlignmentType.CENTER; }
        else if ($(e).hasClass("ql-align-justify")) { return docx.AlignmentType.JUSTIFIED; }
        else { return docx.AlignmentType.LEFT; }
    }




  
    function bullet(e) {
        var tag = "text"; if ($(e).prop("tagName")) { tag = $(e).prop("tagName").toLowerCase(); }
        var bullet = null;
        
        if (tag === "li") { 
            bullet = { level: 0 };
            if ($(e).hasClass("ql-indent-1")) { bullet = { level: 1 }; }
            if ($(e).hasClass("ql-indent-2")) { bullet = { level: 2 }; }
            if ($(e).hasClass("ql-indent-3")) { bullet = { level: 3 }; }
            if ($(e).hasClass("ql-indent-4")) { bullet = { level: 4 }; }
            if ($(e).hasClass("ql-indent-5")) { bullet = { level: 5 }; }
            if ($(e).hasClass("ql-indent-6")) { bullet = { level: 6 }; }
        }
    
        return bullet;
    }
  




    function heading(e) {
        var tag = "text"; if ($(e).prop("tagName")) { tag = $(e).prop("tagName").toLowerCase(); }
        var heading = null;
        
        if (tag === "h1") { heading = docx.HeadingLevel.HEADING_1; }
        if (tag === "h2") { heading = docx.HeadingLevel.HEADING_2; }
        if (tag === "h3") { heading = docx.HeadingLevel.HEADING_3; }
        if (tag === "h4") { heading = docx.HeadingLevel.HEADING_4; }
        if (tag === "h5") { heading = docx.HeadingLevel.HEADING_5; }
        if (tag === "h6") { heading = docx.HeadingLevel.HEADING_6; }
    
        return heading;
    }
  




    function styles() {
        return [
            { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { bold: true, size: 32 } },
            { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { bold: true, size: 28 } },
            { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { bold: true, size: 24 } },
            { id: "Heading4", name: "Heading 4", basedOn: "Normal", next: "Normal", quickFormat: true, run: { bold: true, size: 21 } },
            { id: "Heading5", name: "Heading 5", basedOn: "Normal", next: "Normal", quickFormat: true, run: { bold: true, size: 18 } },
            { id: "Heading6", name: "Heading 6", basedOn: "Normal", next: "Normal", quickFormat: true, run: { bold: true, size: 14 } },
        ];
    }



  
    function newParagraph(children, alignment, bullet, heading) {
        return new docx.Paragraph({ 
            children: children,
            alignment : alignment,
            bullet : bullet,
            heading : heading
        });
    }
  


    function newTable(arrayOfTableRows) {
        return new docx.Table({ 
            rows: arrayOfTableRows,
            width: { size: 100, type: docx.WidthType.PERCENTAGE }, 
        });
    }

    function tableRow(arrayOfTableCells) {
        return new docx.TableRow({ cantSplit:true, children: arrayOfTableCells });
    }

    function tableCell(arrayOfCellContents) {
        return new docx.TableCell({ children: arrayOfCellContents });
    }

    doc.addSection({ children: docChildren });
    return doc;
}