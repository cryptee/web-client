// this takes in :
// $(".ql-editor").contents() 
// "title" 
// and returns a new Document() to use in Packer for saving
function htmlToDocx(htmlContents, title) {

    var doc = new Document({ 
        title: title, 
        styles : { paragraphStyles: styles() } 
    });
  
    htmlContents.each(function(i, element){
        identifyElement(element);
    });
  
    function identifyElement(element) {
        var tag = "text"; if ($(element).prop("tagName")) { tag = $(element).prop("tagName").toLowerCase(); }
        
        if (tag === "ul" || tag === "ol") {
    
            // it's a bullet/list section. based on depth, we'll need new paragraphs for each bullet. 
            var bulletParagraphs = [];
    
            $(element).contents().each(function(i, elem){
                var paragraph = newParagraph([createWordElement(elem)], alignment(elem), bullet(elem), heading(elem));
                bulletParagraphs.push(paragraph);
            });
    
            doc.addSection({ children: bulletParagraphs });
  
        } else {
            // it's not a bullet/list, nor image, parse regularly.
            var childrenToAddToParagraph = [];
            unpackDOMElement(element, doc, childrenToAddToParagraph);
                
            doc.addSection({ 
                children: [ newParagraph(childrenToAddToParagraph, alignment(element), null, heading(element)) ] 
            });
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
            if (["p", "text", "li", "h1", "h2", "h3", "h4", "h5", "h6"].indexOf(tag) !== -1) { 
                wordElement = new TextRun(text); 
            }
    
            if (tag === "b" || tag === "strong") { 
                wordElement = new TextRun({ text: text, bold: true }); 
            }
    
            if (tag === "i" || tag === "em") { 
                wordElement = new TextRun({ text: text, italics: true }); 
            }
    
            if (tag === "s") {
                wordElement = new TextRun({ text: text, strike: true }); 
            }
    
            if (tag === "u") { 
                wordElement = new TextRun({ text: text, underline: {} }); 
            }
    
            if (tag === "a") { 
                var url = $(e).attr("href");
                wordElement = new Hyperlink({ text: text, anchor: url }); 
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
                            wordElement = Media.addImage(doc, b64, imgW, imgH);
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
        if ($(e).hasClass("ql-align-right")) { return AlignmentType.RIGHT; }
        else if ($(e).hasClass("ql-align-center")) { return AlignmentType.CENTER; }
        else if ($(e).hasClass("ql-align-justify")) { return AlignmentType.JUSTIFIED; }
        else { return AlignmentType.LEFT; }
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
        
        if (tag === "h1") { heading = HeadingLevel.HEADING_1; }
        if (tag === "h2") { heading = HeadingLevel.HEADING_2; }
        if (tag === "h3") { heading = HeadingLevel.HEADING_3; }
        if (tag === "h4") { heading = HeadingLevel.HEADING_4; }
        if (tag === "h5") { heading = HeadingLevel.HEADING_5; }
        if (tag === "h6") { heading = HeadingLevel.HEADING_6; }
    
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
        return new Paragraph({ 
            children: children,
            alignment : alignment,
            bullet : bullet,
            heading : heading
        });
    }
  


    return doc;
}