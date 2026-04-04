////////////////////////////////////////////////
////////////////////////////////////////////////
//
//  ODT ENGINE
//
//  Bidirectional ODT <-> HTML converter for Cryptee Docs.
//
//  Public API:
//    htmlToOdt(htmlContents, title)   -> Promise<Blob>     (.odt)
//    odtToHtml(arrayBuffer)           -> Promise<string>   (sanitized HTML)
//
//  Pipeline notes for callers:
//
//  EXPORT pipeline (in exporters.js, NOT done here):
//    1. preprocessListsForExport(html)
//    2. convertCrypteeTablesToHTMLTables(html)
//    3. htmlToOdt(html, title)   <- this file
//    Do NOT run convertCommentsToHTMLText before this, since that
//    strips comment metadata. We need <mark class="comment" ...> intact.
//
//  IMPORT pipeline (in importers.js, NOT done here):
//    1. odtToHtml(arrayBuffer)   <- this file
//    2. convertAndPurifyHTMLToDeltas(html)  (it purifies twice internally)
//
//  IMPORTANT for comment round-trip on IMPORT:
//    The current purifyHTML allow-list does not include <mark> nor the
//    'comment' attribute. To support comment import, added these to
//    importers.js purifyHTML():
//      allowedHTMLTags: added "MARK"
//      allowedCrypteeAttributes already has "time" and "contents",
//      added "comment"
//    Without this, imported comments survive odtToHtml() but get
//    stripped by the importer's DOMPurify pass.
//
//  Security:
//    - DOMPurify runs on the input HTML before export walking.
//    - DOMPurify runs on the produced HTML before returning from import.
//    - All XML/HTML output is built as strings with explicit escapers.
//      No createElement on output, so no chance of inadvertent DOM
//      attachment or parser quirks.
//    - data: image URIs are validated against a strict regex.
//    - ODT content.xml is parsed read-only via DOMParser in xml mode.
//
////////////////////////////////////////////////
////////////////////////////////////////////////



////////////////////////////////////////////////
////////////////////////////////////////////////
//
//  CONSTANTS
//
////////////////////////////////////////////////
////////////////////////////////////////////////



/** ODT XML namespaces we emit / read. */
const ODT_NS = {
    office: "urn:oasis:names:tc:opendocument:xmlns:office:1.0",
    text:   "urn:oasis:names:tc:opendocument:xmlns:text:1.0",
    table:  "urn:oasis:names:tc:opendocument:xmlns:table:1.0",
    draw:   "urn:oasis:names:tc:opendocument:xmlns:drawing:1.0",
    style:  "urn:oasis:names:tc:opendocument:xmlns:style:1.0",
    fo:     "urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0",
    svg:    "urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0",
    xlink:  "http://www.w3.org/1999/xlink",
    dc:     "http://purl.org/dc/elements/1.1/",
    meta:   "urn:oasis:names:tc:opendocument:xmlns:meta:1.0",
    manifest: "urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"
};



/** Strict allow-list for data: image URIs we will accept on export. */
const SAFE_DATA_IMAGE_REGEX = /^data:image\/(png|jpe?g|gif|webp|bmp);base64,([A-Za-z0-9+/=\s]+)$/i;



/** DOMPurify config used on the HTML produced by odtToHtml().
 *  Mirrors importers.js purifyHTML() conceptually, plus <mark> for comments. */
const ODT_IMPORT_PURIFY_CONFIG = {
    ALLOWED_TAGS: [
        "A", "B", "BLOCKQUOTE", "BR", "DEL", "DIV", "EM",
        "H1", "H2", "H3", "H4", "H5", "H6",
        "HR", "I", "IMG", "LI", "MARK", "OL", "P",
        "S", "SPAN", "STRIKE", "STRONG", "SUB", "SUP",
        "TABLE", "TBODY", "TD", "TH", "TR", "U", "UL"
    ],
    ADD_ATTR: ["comment", "time", "contents", "class", "data-checked"]
};



/** DOMPurify config used on incoming HTML for export.
 *  We intentionally keep <mark> and comment attrs so we can map them. */
const ODT_EXPORT_PURIFY_CONFIG = {
    ALLOWED_TAGS: [
        "A", "B", "BLOCKQUOTE", "BR", "DEL", "DIV", "EM",
        "H1", "H2", "H3", "H4", "H5", "H6",
        "HR", "I", "IMG", "LI", "MARK", "OL", "P",
        "S", "SPAN", "STRIKE", "STRONG", "SUB", "SUP",
        "TABLE", "TBODY", "TD", "TH", "TR", "U", "UL"
    ],
    ADD_ATTR: ["comment", "time", "contents", "class", "data-checked", "type", "columns", "rows"]
};



////////////////////////////////////////////////
////////////////////////////////////////////////
//
//  GENERIC ESCAPERS
//
////////////////////////////////////////////////
////////////////////////////////////////////////



/**
 * Escape a string for safe insertion as XML text or attribute content.
 * Handles all five XML predefined entities.
 * @param {string} str
 * @returns {string}
 */
function odtXmlEscape(str) {
    if (str === null || str === undefined) { return ""; }
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}



/**
 * Escape a string for safe insertion into HTML body text.
 * @param {string} str
 * @returns {string}
 */
function odtHtmlEscape(str) {
    if (str === null || str === undefined) { return ""; }
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}



/**
 * Strip control characters that are illegal in XML 1.0.
 * Preserves tab, LF, CR. Removes the rest of 0x00-0x1F and lone surrogates.
 * @param {string} str
 * @returns {string}
 */
function odtStripIllegalXmlChars(str) {
    if (!str) { return ""; }
    return String(str).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g, "");
}



////////////////////////////////////////////////
////////////////////////////////////////////////
//
//  EXPORT: HTML  ->  ODT
//
////////////////////////////////////////////////
////////////////////////////////////////////////



/**
 * Convert preprocessed Quill .ql-editor HTML into an ODT Blob.
 *
 * Expected input shape (after preprocessListsForExport + convertCrypteeTablesToHTMLTables):
 *   - Properly nested <ul>/<ol> with <li>
 *   - Standard <table><tr><td>...</td></tr></table>
 *   - Inline formatting: <b>/<strong>, <i>/<em>, <u>, <s>/<strike>/<del>, <sub>, <sup>
 *   - <a href="...">
 *   - <img src="data:..."> (or empty src; external refs get dropped)
 *   - <h1>..<h6>, <p>, <blockquote>, <hr>, <br>
 *   - <mark class="comment" comment="ID" time="EPOCH" contents="B64TEXT">selected</mark>
 *
 * Strips entirely:
 *   - <crypteefile>, <crypteefolder>, <crypteetag>, <crypteepagebreak>
 *   - <crypteetabledata>, <crypteetable>, <crypteetablecell> (caller should
 *     have already converted these via convertCrypteeTablesToHTMLTables)
 *   - <pre>, <code>, <code-block>  (we skip code blocks bidirectionally)
 *
 * @param {string} htmlContents Preprocessed editor HTML
 * @param {string} title Document title (also used in ODT meta)
 * @returns {Promise<Blob>} an .odt blob ready for download
 */
async function htmlToOdt(htmlContents, title) {

    // round 1 of dompurify before we touch anything
    const cleanHtml = DOMPurify.sanitize(htmlContents || "", ODT_EXPORT_PURIFY_CONFIG);

    // parse the cleaned html into a read-only DOM tree
    const parser = new DOMParser();
    const tempDoc = parser.parseFromString(`<!doctype html><html><body>${cleanHtml}</body></html>`, "text/html");
    const body = tempDoc.body;

    // accumulators for the export walk
    const exportState = {
        bodyXml: [],            // strings of <text:*> content
        images: [],             // [{ name, mime, base64, width, height }]
        annotations: new Set(), // comment IDs seen, used to ensure end markers
        imageCounter: 0
    };

    // walk all top-level children
    for (const node of body.childNodes) {
        odtExportWalkBlock(node, exportState);
    }

    const docTitle = title || "Untitled";

    // assemble the zip
    const zip = new JSZip();

    // mimetype must be the FIRST entry and STORED (no compression)
    zip.file("mimetype", "application/vnd.oasis.opendocument.text", { compression: "STORE" });

    // META-INF/manifest.xml
    const manifestXml = odtBuildManifestXml(exportState.images);
    zip.folder("META-INF").file("manifest.xml", manifestXml);

    // meta.xml
    zip.file("meta.xml", odtBuildMetaXml(docTitle));

    // styles.xml
    zip.file("styles.xml", odtBuildStylesXml());

    // content.xml
    zip.file("content.xml", odtBuildContentXml(exportState.bodyXml.join("")));

    // Pictures/<files>
    if (exportState.images.length) {
        const picturesFolder = zip.folder("Pictures");
        for (const img of exportState.images) {
            picturesFolder.file(img.name, odtBase64ToUint8(img.base64), { binary: true });
        }
    }

    const blob = await zip.generateAsync({
        type: "blob",
        mimeType: "application/vnd.oasis.opendocument.text",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
    });

    return blob;
}



/**
 * Walk a block-level DOM node and append its ODT XML to state.bodyXml.
 * Handles paragraphs, headings, lists, tables, hr, blockquote.
 * Anything we don't recognize either gets stripped or recursed into.
 * @param {Node} node
 * @param {object} state
 */
function odtExportWalkBlock(node, state) {
    if (!node) { return; }

    // text node at block level: wrap in a paragraph if it has actual content
    if (node.nodeType === 3) {
        const txt = node.textContent || "";
        if (!txt.trim()) { return; }
        state.bodyXml.push(`<text:p text:style-name="P_Default">${odtXmlEscape(odtStripIllegalXmlChars(txt))}</text:p>`);
        return;
    }

    if (node.nodeType !== 1) { return; }

    const tag = (node.tagName || "").toLowerCase();

    // hard strip: cryptee-only + code blocks
    if (
        tag === "crypteefile" || tag === "crypteefolder" || tag === "crypteetag" ||
        tag === "crypteepagebreak" || tag === "crypteetabledata" ||
        tag === "pre" || tag === "code" || tag === "code-block"
    ) {
        return;
    }

    if (tag === "p" || tag === "div") {
        const styleName = odtParagraphStyleFor(node);
        const inner = odtExportInlineChildren(node, state);
        // empty paragraphs still need to render to preserve spacing
        state.bodyXml.push(`<text:p text:style-name="${odtXmlEscape(styleName)}">${inner}</text:p>`);
        return;
    }

    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") {
        const level = tag.charAt(1);
        const styleName = `Heading_${level}`;
        const inner = odtExportInlineChildren(node, state);
        state.bodyXml.push(
            `<text:h text:style-name="${styleName}" text:outline-level="${level}">${inner}</text:h>`
        );
        return;
    }

    if (tag === "blockquote") {
        const inner = odtExportInlineChildren(node, state);
        state.bodyXml.push(`<text:p text:style-name="Quote">${inner}</text:p>`);
        return;
    }

    if (tag === "hr") {
        // ODT has no first-class hr; we use a paragraph with a horizontal rule style
        state.bodyXml.push(`<text:p text:style-name="Horizontal_Line"></text:p>`);
        return;
    }

    if (tag === "br") {
        state.bodyXml.push(`<text:p text:style-name="P_Default"></text:p>`);
        return;
    }

    if (tag === "ul" || tag === "ol") {
        state.bodyXml.push(odtExportList(node, tag === "ol", 0, state));
        return;
    }

    if (tag === "table") {
        state.bodyXml.push(odtExportTable(node, state));
        return;
    }

    // checklist item or list item dropped into body without a parent ul/ol
    if (tag === "li") {
        // wrap in a single-item list
        const fakeList = tempWrapInList(node);
        state.bodyXml.push(odtExportList(fakeList, false, 0, state));
        return;
    }

    // unknown block: descend into its children
    for (const child of node.childNodes) {
        odtExportWalkBlock(child, state);
    }
}



/**
 * Produce ODT inline XML for the children of a block-level element.
 * Handles spans, b/i/u/s, a, img, br, mark (comments).
 * @param {Element} parent
 * @param {object} state
 * @returns {string}
 */
function odtExportInlineChildren(parent, state) {
    const out = [];
    for (const child of parent.childNodes) {
        out.push(odtExportInlineNode(child, state, []));
    }
    return out.join("");
}



/**
 * Recursive inline walker. styleStack carries the active text:span styles
 * (Bold, Italic, Underline, Strike) so nested formatting works.
 * @param {Node} node
 * @param {object} state
 * @param {string[]} styleStack
 * @returns {string}
 */
function odtExportInlineNode(node, state, styleStack) {

    if (!node) { return ""; }

    if (node.nodeType === 3) {
        const cleaned = odtXmlEscape(odtStripIllegalXmlChars(node.textContent || ""));
        if (!cleaned) { return ""; }
        if (!styleStack.length) { return cleaned; }
        // wrap in nested spans, innermost-style first
        let wrapped = cleaned;
        for (const s of styleStack) {
            wrapped = `<text:span text:style-name="${odtXmlEscape(s)}">${wrapped}</text:span>`;
        }
        return wrapped;
    }

    if (node.nodeType !== 1) { return ""; }

    const tag = (node.tagName || "").toLowerCase();

    // strip cryptee-only inline blots and code
    if (
        tag === "crypteefile" || tag === "crypteefolder" || tag === "crypteetag" ||
        tag === "crypteepagebreak" || tag === "code"
    ) {
        return "";
    }

    if (tag === "br") {
        return "<text:line-break/>";
    }

    if (tag === "img") {
        return odtExportImage(node, state);
    }

    if (tag === "a") {
        const href = (node.getAttribute("href") || "").trim();
        const safeHref = odtSafeUrl(href);
        const inner = [];
        for (const c of node.childNodes) {
            inner.push(odtExportInlineNode(c, state, styleStack));
        }
        if (!safeHref) {
            return inner.join("");
        }
        return `<text:a xlink:type="simple" xlink:href="${odtXmlEscape(safeHref)}">${inner.join("")}</text:a>`;
    }

    if (tag === "mark") {
        // comment blot. emit annotation start, content, end
        return odtExportComment(node, state, styleStack);
    }

    // formatting tags push a style onto the stack and recurse
    let pushedStyle = null;
    if (tag === "b" || tag === "strong") { pushedStyle = "Bold"; }
    else if (tag === "i" || tag === "em") { pushedStyle = "Italic"; }
    else if (tag === "u") { pushedStyle = "Underline"; }
    else if (tag === "s" || tag === "strike" || tag === "del") { pushedStyle = "Strike"; }
    else if (tag === "sub") { pushedStyle = "Subscript"; }
    else if (tag === "sup") { pushedStyle = "Superscript"; }

    const nextStack = pushedStyle ? styleStack.concat([pushedStyle]) : styleStack;

    const out = [];
    for (const c of node.childNodes) {
        out.push(odtExportInlineNode(c, state, nextStack));
    }
    return out.join("");
}



/**
 * Produce ODT XML for a comment <mark class="comment">.
 * Maps:
 *   comment attr (ID) -> office:name
 *   time attr (epoch) -> dc:date
 *   contents attr (b64) -> body of inner <text:p>
 * @param {Element} markEl
 * @param {object} state
 * @param {string[]} styleStack
 * @returns {string}
 */
function odtExportComment(markEl, state, styleStack) {

    // unwrap mark if it isn't actually a comment
    if (!markEl.classList || !markEl.classList.contains("comment")) {
        const inner = [];
        for (const c of markEl.childNodes) {
            inner.push(odtExportInlineNode(c, state, styleStack));
        }
        return inner.join("");
    }

    let id = markEl.getAttribute("comment") || "";
    if (!id) { id = "c" + Math.random().toString(36).slice(2, 10); }
    // keep id alphanumeric-ish for safety in xml attrs
    id = id.replace(/[^a-zA-Z0-9_-]/g, "");

    const timeAttr = markEl.getAttribute("time") || "";
    const isoDate = odtEpochMsToIsoDate(timeAttr);

    let commentText = "";
    const b64 = markEl.getAttribute("contents") || "";
    if (b64) {
        try { commentText = atob(b64); } catch (e) { commentText = ""; }
    }
    commentText = odtStripIllegalXmlChars(commentText);

    // selected (anchor) text
    const inner = [];
    for (const c of markEl.childNodes) {
        inner.push(odtExportInlineNode(c, state, styleStack));
    }

    // duplicate IDs across ranges in ODT need to be unique. avoid collisions
    if (state.annotations.has(id)) {
        id = id + "_" + state.annotations.size;
    }
    state.annotations.add(id);

    const annotationXml =
        `<office:annotation office:name="${odtXmlEscape(id)}">` +
            `<dc:creator>User</dc:creator>` +
            `<dc:date>${odtXmlEscape(isoDate)}</dc:date>` +
            `<text:p>${odtXmlEscape(commentText)}</text:p>` +
        `</office:annotation>`;

    const annotationEnd = `<office:annotation-end office:name="${odtXmlEscape(id)}"/>`;

    return annotationXml + inner.join("") + annotationEnd;
}



/**
 * Export an <img> element. Only data: URIs with safe mime types are kept.
 * Adds the binary to state.images and returns the ODT draw:frame XML.
 * @param {Element} imgEl
 * @param {object} state
 * @returns {string}
 */
function odtExportImage(imgEl, state) {

    let src = imgEl.getAttribute("src") || "";
    src = src.trim();

    // <img src="//:0"> is the cryptee external-image block. try extsrc
    if (src === "//:0" || src === "") {
        src = (imgEl.getAttribute("extsrc") || "").trim();
    }

    // we ONLY accept data URIs. dropping external/http(s) refs by design,
    // since shipping them in an exported file would leak the URL on open
    const m = src.match(SAFE_DATA_IMAGE_REGEX);
    if (!m) { return ""; }

    const mime = "image/" + m[1].toLowerCase().replace("jpeg", "jpeg");
    const ext = mime === "image/jpeg" ? "jpg" : mime.split("/")[1];
    const base64 = (m[2] || "").replace(/\s+/g, "");
    if (!base64) { return ""; }

    state.imageCounter++;
    const fileName = `image${state.imageCounter}.${ext}`;
    const w = parseInt(imgEl.getAttribute("width") || imgEl.naturalWidth || 0, 10) || 400;
    const h = parseInt(imgEl.getAttribute("height") || imgEl.naturalHeight || 0, 10) || 300;

    state.images.push({ name: fileName, mime: mime, base64: base64, width: w, height: h });

    // dimensions in ODT are physical units; px->cm at 96 dpi
    const wcm = (w / 96 * 2.54).toFixed(2);
    const hcm = (h / 96 * 2.54).toFixed(2);

    return (
        `<draw:frame draw:style-name="Image" draw:name="img${state.imageCounter}" ` +
        `text:anchor-type="as-char" svg:width="${wcm}cm" svg:height="${hcm}cm">` +
            `<draw:image xlink:href="Pictures/${odtXmlEscape(fileName)}" ` +
            `xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/>` +
        `</draw:frame>`
    );
}



/**
 * Recursively export an <ol> or <ul> tree to ODT.
 * Nested lists become nested <text:list> inside the <text:list-item>.
 * @param {Element} listEl
 * @param {boolean} ordered
 * @param {number} level
 * @param {object} state
 * @returns {string}
 */
function odtExportList(listEl, ordered, level, state) {

    const styleName = ordered ? "L_Ordered" : "L_Bullet";
    const out = [`<text:list text:style-name="${styleName}">`];

    for (const child of listEl.children) {
        if (child.tagName.toLowerCase() !== "li") { continue; }

        out.push("<text:list-item>");

        // partition li children into block content vs. nested lists
        let inlineBuf = [];
        const flushInline = () => {
            if (!inlineBuf.length) { return; }
            const inlineHtml = inlineBuf.map(odtNodeToInlineXml.bind(null, state)).join("");
            out.push(`<text:p text:style-name="P_ListItem">${inlineHtml}</text:p>`);
            inlineBuf = [];
        };

        for (const c of child.childNodes) {
            if (c.nodeType === 1 && (c.tagName.toLowerCase() === "ul" || c.tagName.toLowerCase() === "ol")) {
                flushInline();
                out.push(odtExportList(c, c.tagName.toLowerCase() === "ol", level + 1, state));
            } else {
                inlineBuf.push(c);
            }
        }
        flushInline();

        out.push("</text:list-item>");
    }

    out.push("</text:list>");
    return out.join("");
}



/**
 * Helper: convert one node to inline xml using the inline walker.
 * @param {object} state
 * @param {Node} node
 * @returns {string}
 */
function odtNodeToInlineXml(state, node) {
    return odtExportInlineNode(node, state, []);
}



/**
 * Export a <table> to ODT.
 * @param {Element} tableEl
 * @param {object} state
 * @returns {string}
 */
function odtExportTable(tableEl, state) {

    // find rows (<tr>), regardless of <tbody>/<thead>
    const rows = tableEl.querySelectorAll(":scope > tr, :scope > tbody > tr, :scope > thead > tr, :scope > tfoot > tr");

    let columnCount = parseInt(tableEl.getAttribute("columns") || "0", 10);
    if (!columnCount) {
        // figure out max cells in any row
        for (const r of rows) {
            const c = r.querySelectorAll(":scope > td, :scope > th").length;
            if (c > columnCount) { columnCount = c; }
        }
    }
    if (!columnCount) { columnCount = 1; }

    const out = [];
    out.push(`<table:table table:style-name="T_Default">`);
    out.push(`<table:table-column table:number-columns-repeated="${columnCount}"/>`);

    for (const row of rows) {
        out.push(`<table:table-row>`);
        const cells = row.querySelectorAll(":scope > td, :scope > th");
        for (const cell of cells) {
            out.push(`<table:table-cell office:value-type="string">`);
            const isHeader = cell.tagName.toLowerCase() === "th";
            // descend, but treat cell as a block container
            const cellBuf = [];
            for (const c of cell.childNodes) {
                if (c.nodeType === 1 && (
                    c.tagName.toLowerCase() === "ul" || c.tagName.toLowerCase() === "ol" ||
                    c.tagName.toLowerCase() === "table" || c.tagName.toLowerCase() === "p" ||
                    c.tagName.toLowerCase() === "div" ||
                    /^h[1-6]$/i.test(c.tagName)
                )) {
                    // nested block: recurse via a small temp accumulator
                    const tmp = { bodyXml: [], images: state.images, annotations: state.annotations, imageCounter: 0 };
                    odtExportWalkBlock(c, tmp);
                    state.imageCounter += tmp.imageCounter;
                    cellBuf.push(tmp.bodyXml.join(""));
                } else {
                    // inline
                    const inlineXml = odtExportInlineNode(c, state, isHeader ? ["Bold"] : []);
                    if (inlineXml) {
                        cellBuf.push(`<text:p text:style-name="P_Cell">${inlineXml}</text:p>`);
                    }
                }
            }
            // empty cell still needs at least one <text:p>
            if (!cellBuf.length) { cellBuf.push(`<text:p text:style-name="P_Cell"></text:p>`); }
            out.push(cellBuf.join(""));
            out.push(`</table:table-cell>`);
        }
        // pad missing cells to keep column count consistent
        const cellCount = cells.length;
        for (let i = cellCount; i < columnCount; i++) {
            out.push(`<table:table-cell office:value-type="string"><text:p text:style-name="P_Cell"></text:p></table:table-cell>`);
        }
        out.push(`</table:table-row>`);
    }

    out.push(`</table:table>`);
    return out.join("");
}



/**
 * Map common quill alignment classes on a block to a paragraph style name.
 * @param {Element} el
 * @returns {string}
 */
function odtParagraphStyleFor(el) {
    if (el.classList) {
        if (el.classList.contains("ql-align-center"))  { return "P_Center"; }
        if (el.classList.contains("ql-align-right"))   { return "P_Right"; }
        if (el.classList.contains("ql-align-justify")) { return "P_Justify"; }
    }
    return "P_Default";
}



/**
 * Wrap a stray <li> in a parent <ul>. Used as a fallback only.
 * @param {Element} liEl
 * @returns {Element}
 */
function tempWrapInList(liEl) {
    const ul = liEl.ownerDocument.createElement("ul");
    ul.appendChild(liEl.cloneNode(true));
    return ul;
}



/**
 * Validate a URL for safe inclusion in an ODT hyperlink.
 * Allows http(s), mailto, tel, and data: (but not javascript: or anything else).
 * @param {string} url
 * @returns {string} safe url, or empty string
 */
function odtSafeUrl(url) {
    if (!url) { return ""; }
    const u = url.trim();
    if (/^(https?:|mailto:|tel:|ftp:|sftp:|sms:)/i.test(u)) { return u; }
    if (u.startsWith("#") || u.startsWith("/")) { return u; }
    return "";
}



/**
 * Convert epoch ms (or ISO string) to ODT-friendly ISO 8601.
 * @param {string|number} val
 * @returns {string}
 */
function odtEpochMsToIsoDate(val) {
    if (!val) { return new Date().toISOString().replace(/\.\d+Z$/, "Z"); }
    const n = Number(val);
    if (!Number.isNaN(n) && n > 0) {
        return new Date(n).toISOString().replace(/\.\d+Z$/, "Z");
    }
    return new Date().toISOString().replace(/\.\d+Z$/, "Z");
}



/**
 * Decode a base64 string into a Uint8Array, suitable for jszip binary writes.
 * @param {string} base64
 * @returns {Uint8Array}
 */
function odtBase64ToUint8(base64) {
    const bin = atob((base64 || "").replace(/\s+/g, ""));
    const len = bin.length;
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) { out[i] = bin.charCodeAt(i); }
    return out;
}



////////////////////////////////////////////////
////////////////////////////////////////////////
//
//  EXPORT: STATIC ODT TEMPLATES
//
////////////////////////////////////////////////
////////////////////////////////////////////////



/**
 * Produce the META-INF/manifest.xml listing all parts of the package.
 * @param {Array<{name:string,mime:string}>} images
 * @returns {string}
 */
function odtBuildManifestXml(images) {
    const entries = [];
    entries.push(`<manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>`);
    entries.push(`<manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>`);
    entries.push(`<manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>`);
    entries.push(`<manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>`);
    if (images && images.length) {
        entries.push(`<manifest:file-entry manifest:full-path="Pictures/" manifest:media-type=""/>`);
        for (const img of images) {
            entries.push(
                `<manifest:file-entry manifest:full-path="Pictures/${odtXmlEscape(img.name)}" ` +
                `manifest:media-type="${odtXmlEscape(img.mime)}"/>`
            );
        }
    }
    return (
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<manifest:manifest xmlns:manifest="${ODT_NS.manifest}" manifest:version="1.2">` +
            entries.join("") +
        `</manifest:manifest>`
    );
}



/**
 * Produce a minimal meta.xml.
 * @param {string} title
 * @returns {string}
 */
function odtBuildMetaXml(title) {
    const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
    return (
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<office:document-meta xmlns:office="${ODT_NS.office}" xmlns:dc="${ODT_NS.dc}" ` +
        `xmlns:meta="${ODT_NS.meta}" office:version="1.2">` +
            `<office:meta>` +
                `<dc:title>${odtXmlEscape(title || "")}</dc:title>` +
                `<meta:creation-date>${now}</meta:creation-date>` +
                `<dc:date>${now}</dc:date>` +
                `<meta:generator>Cryptee</meta:generator>` +
            `</office:meta>` +
        `</office:document-meta>`
    );
}



/**
 * Produce styles.xml with the named styles content.xml references.
 * @returns {string}
 */
function odtBuildStylesXml() {
    return (
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<office:document-styles xmlns:office="${ODT_NS.office}" xmlns:style="${ODT_NS.style}" ` +
        `xmlns:text="${ODT_NS.text}" xmlns:table="${ODT_NS.table}" xmlns:draw="${ODT_NS.draw}" ` +
        `xmlns:fo="${ODT_NS.fo}" xmlns:svg="${ODT_NS.svg}" xmlns:xlink="${ODT_NS.xlink}" ` +
        `office:version="1.2">` +

            `<office:styles>` +

                // paragraph styles
                `<style:style style:name="P_Default" style:family="paragraph"><style:paragraph-properties fo:text-align="start"/></style:style>` +
                `<style:style style:name="P_Center" style:family="paragraph"><style:paragraph-properties fo:text-align="center"/></style:style>` +
                `<style:style style:name="P_Right" style:family="paragraph"><style:paragraph-properties fo:text-align="end"/></style:style>` +
                `<style:style style:name="P_Justify" style:family="paragraph"><style:paragraph-properties fo:text-align="justify"/></style:style>` +
                `<style:style style:name="P_ListItem" style:family="paragraph" style:parent-style-name="P_Default"/>` +
                `<style:style style:name="P_Cell" style:family="paragraph" style:parent-style-name="P_Default"/>` +
                `<style:style style:name="Quote" style:family="paragraph"><style:paragraph-properties fo:margin-left="1cm" fo:margin-right="1cm"/><style:text-properties fo:font-style="italic"/></style:style>` +
                `<style:style style:name="Horizontal_Line" style:family="paragraph"><style:paragraph-properties fo:border-bottom="0.5pt solid #888888" fo:padding-bottom="0.1cm"/></style:style>` +

                // heading styles
                `<style:style style:name="Heading_1" style:family="paragraph" style:default-outline-level="1"><style:text-properties fo:font-size="24pt" fo:font-weight="bold"/></style:style>` +
                `<style:style style:name="Heading_2" style:family="paragraph" style:default-outline-level="2"><style:text-properties fo:font-size="20pt" fo:font-weight="bold"/></style:style>` +
                `<style:style style:name="Heading_3" style:family="paragraph" style:default-outline-level="3"><style:text-properties fo:font-size="16pt" fo:font-weight="bold"/></style:style>` +
                `<style:style style:name="Heading_4" style:family="paragraph" style:default-outline-level="4"><style:text-properties fo:font-size="14pt" fo:font-weight="bold"/></style:style>` +
                `<style:style style:name="Heading_5" style:family="paragraph" style:default-outline-level="5"><style:text-properties fo:font-size="12pt" fo:font-weight="bold"/></style:style>` +
                `<style:style style:name="Heading_6" style:family="paragraph" style:default-outline-level="6"><style:text-properties fo:font-size="11pt" fo:font-weight="bold"/></style:style>` +

                // text spans
                `<style:style style:name="Bold" style:family="text"><style:text-properties fo:font-weight="bold"/></style:style>` +
                `<style:style style:name="Italic" style:family="text"><style:text-properties fo:font-style="italic"/></style:style>` +
                `<style:style style:name="Underline" style:family="text"><style:text-properties style:text-underline-style="solid" style:text-underline-type="single"/></style:style>` +
                `<style:style style:name="Strike" style:family="text"><style:text-properties style:text-line-through-style="solid"/></style:style>` +
                `<style:style style:name="Subscript" style:family="text"><style:text-properties style:text-position="sub 58%"/></style:style>` +
                `<style:style style:name="Superscript" style:family="text"><style:text-properties style:text-position="super 58%"/></style:style>` +

                // table + image
                `<style:style style:name="T_Default" style:family="table"><style:table-properties style:width="17cm" table:align="margins"/></style:style>` +
                `<style:style style:name="Image" style:family="graphic"><style:graphic-properties style:wrap="none" style:vertical-pos="top" style:horizontal-pos="center"/></style:style>` +

            `</office:styles>` +

            // list styles
            `<office:automatic-styles>` +
                `<text:list-style style:name="L_Bullet">` +
                    odtBulletListLevels() +
                `</text:list-style>` +
                `<text:list-style style:name="L_Ordered">` +
                    odtOrderedListLevels() +
                `</text:list-style>` +
            `</office:automatic-styles>` +

        `</office:document-styles>`
    );
}



/**
 * Generate 9 levels of bullet list-level definitions.
 * @returns {string}
 */
function odtBulletListLevels() {
    const out = [];
    for (let i = 1; i <= 9; i++) {
        out.push(
            `<text:list-level-style-bullet text:level="${i}" text:bullet-char="•">` +
                `<style:list-level-properties text:space-before="${i * 0.5}cm" text:min-label-width="0.5cm"/>` +
            `</text:list-level-style-bullet>`
        );
    }
    return out.join("");
}



/**
 * Generate 9 levels of numbered list-level definitions, cycling 1/a/i.
 * @returns {string}
 */
function odtOrderedListLevels() {
    const out = [];
    const formats = ["1", "a", "i"];
    for (let i = 1; i <= 9; i++) {
        const fmt = formats[(i - 1) % 3];
        out.push(
            `<text:list-level-style-number text:level="${i}" style:num-format="${fmt}" style:num-suffix=".">` +
                `<style:list-level-properties text:space-before="${i * 0.5}cm" text:min-label-width="0.5cm"/>` +
            `</text:list-level-style-number>`
        );
    }
    return out.join("");
}



/**
 * Wrap the body XML produced by the export walk in a complete content.xml.
 * @param {string} bodyXml
 * @returns {string}
 */
function odtBuildContentXml(bodyXml) {
    return (
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<office:document-content ` +
            `xmlns:office="${ODT_NS.office}" ` +
            `xmlns:text="${ODT_NS.text}" ` +
            `xmlns:table="${ODT_NS.table}" ` +
            `xmlns:draw="${ODT_NS.draw}" ` +
            `xmlns:style="${ODT_NS.style}" ` +
            `xmlns:fo="${ODT_NS.fo}" ` +
            `xmlns:svg="${ODT_NS.svg}" ` +
            `xmlns:xlink="${ODT_NS.xlink}" ` +
            `xmlns:dc="${ODT_NS.dc}" ` +
            `xmlns:meta="${ODT_NS.meta}" ` +
            `office:version="1.2">` +
            `<office:body><office:text>` +
                bodyXml +
            `</office:text></office:body>` +
        `</office:document-content>`
    );
}



////////////////////////////////////////////////
////////////////////////////////////////////////
//
//  IMPORT: ODT  ->  HTML
//
////////////////////////////////////////////////
////////////////////////////////////////////////



/**
 * Convert an ODT file (ArrayBuffer) to a clean HTML string suitable for
 * passing into convertAndPurifyHTMLToDeltas.
 *
 * Produces semantic HTML: <p>, <h1>-<h6>, <ul>/<ol>/<li>, <table><tr><td>,
 * <a href>, <img src=data...>, <b>/<i>/<u>/<s>/<sub>/<sup>, <blockquote>,
 * <hr>, <br>, and <mark class="comment" comment time contents>.
 *
 * Skips: code blocks, page breaks, all cryptee-specific blots, and any
 * ODT element not in the allow-list below.
 *
 * @param {ArrayBuffer} arrayBuffer raw odt file bytes
 * @returns {Promise<string>} sanitized html
 */
async function odtToHtml(arrayBuffer) {

    const zip = await JSZip.loadAsync(arrayBuffer);

    // optional sanity check on mimetype
    if (zip.file("mimetype")) {
        const mimetype = await zip.file("mimetype").async("string");
        if (mimetype && mimetype.indexOf("opendocument.text") === -1) {
            throw new Error("Not a text ODT file (mimetype mismatch)");
        }
    }

    const contentFile = zip.file("content.xml");
    if (!contentFile) { throw new Error("ODT missing content.xml"); }
    const contentXml = await contentFile.async("string");

    // pull all images from Pictures/* into a name->dataURI map
    const imageMap = {};
    const picturesFolder = zip.folder("Pictures");
    if (picturesFolder) {
        const picFiles = [];
        zip.folder("Pictures").forEach(function(relPath, fileObj) {
            if (!fileObj.dir) { picFiles.push({ relPath, fileObj }); }
        });
        for (const p of picFiles) {
            const safeMime = odtMimeFromName(p.relPath);
            if (!safeMime) { continue; }
            const b64 = await p.fileObj.async("base64");
            imageMap["Pictures/" + p.relPath] = `data:${safeMime};base64,${b64}`;
        }
    }

    // parse content.xml in xml mode (no script context, no entities resolved)
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(contentXml, "application/xml");

    if (xmlDoc.getElementsByTagName("parsererror").length) {
        throw new Error("ODT content.xml is malformed");
    }

    // pull every <text:*> direct under <office:text>
    const officeTextEls = xmlDoc.getElementsByTagNameNS(ODT_NS.office, "text");
    if (!officeTextEls.length) { return ""; }
    const root = officeTextEls[0];

    // first pass: collect annotation contents keyed by office:name so we can
    // attach them properly when we hit the matching range
    const importState = {
        imageMap: imageMap,
        annotationsById: odtCollectAnnotations(root),
        openCommentStack: []
    };

    const out = [];
    for (const child of root.childNodes) {
        odtImportWalk(child, out, importState);
    }

    let rawHtml = out.join("");
    // final dompurify pass on the produced html
    rawHtml = DOMPurify.sanitize(rawHtml, ODT_IMPORT_PURIFY_CONFIG);
    return rawHtml;
}



/**
 * Pre-walk content to grab every <office:annotation>'s id, date, creator,
 * and inner text. We need the id->text mapping when we encounter the same
 * annotation inline so we can emit a complete <mark>.
 * @param {Element} root
 * @returns {Object<string, {time:string, text:string}>}
 */
function odtCollectAnnotations(root) {
    const map = {};
    const annotations = root.getElementsByTagNameNS(ODT_NS.office, "annotation");
    for (const ann of annotations) {
        const name = ann.getAttribute("office:name") || ann.getAttributeNS(ODT_NS.office, "name") || "";
        if (!name) { continue; }
        // dc:date
        let dateStr = "";
        const dateEl = ann.getElementsByTagNameNS(ODT_NS.dc, "date")[0];
        if (dateEl) { dateStr = dateEl.textContent || ""; }
        // text body, joined from any <text:p> inside
        const ps = ann.getElementsByTagNameNS(ODT_NS.text, "p");
        const textParts = [];
        for (const p of ps) { textParts.push(p.textContent || ""); }
        map[name] = {
            time: odtIsoDateToEpochMs(dateStr),
            text: textParts.join("\n")
        };
    }
    return map;
}



/**
 * Walk a block-level ODT element and push its HTML into out.
 * @param {Node} node
 * @param {string[]} out
 * @param {object} state
 */
function odtImportWalk(node, out, state) {

    if (!node) { return; }
    if (node.nodeType !== 1) { return; }

    const local = (node.localName || "").toLowerCase();
    const ns = node.namespaceURI || "";

    // <text:p>
    if (ns === ODT_NS.text && local === "p") {
        const cls = odtImportClassFromStyle(node);
        const inner = odtImportInline(node, state);
        if (!inner.trim()) {
            out.push(`<p${cls ? ` class="${odtHtmlEscape(cls)}"` : ""}><br></p>`);
        } else {
            out.push(`<p${cls ? ` class="${odtHtmlEscape(cls)}"` : ""}>${inner}</p>`);
        }
        return;
    }

    // <text:h>
    if (ns === ODT_NS.text && local === "h") {
        let level = parseInt(node.getAttributeNS(ODT_NS.text, "outline-level") || "1", 10);
        if (isNaN(level) || level < 1) { level = 1; }
        if (level > 6) { level = 6; }
        const inner = odtImportInline(node, state);
        out.push(`<h${level}>${inner}</h${level}>`);
        return;
    }

    // <text:list>
    if (ns === ODT_NS.text && local === "list") {
        out.push(odtImportList(node, state));
        return;
    }

    // <table:table>
    if (ns === ODT_NS.table && local === "table") {
        out.push(odtImportTable(node, state));
        return;
    }

    // <text:section> just descend into
    if (ns === ODT_NS.text && local === "section") {
        for (const c of node.childNodes) { odtImportWalk(c, out, state); }
        return;
    }

    // page break / soft page break: skip per spec (no codeblocks, no special blots)
    // any other unknown block-level element: descend so we don't lose nested content
    for (const c of node.childNodes) { odtImportWalk(c, out, state); }
}



/**
 * Walk an ODT list and produce nested <ul>/<ol>.
 * Tries to detect ordered vs bullet by looking at the list-style name.
 * Defaults to <ul> on ambiguity.
 * @param {Element} listEl
 * @param {object} state
 * @returns {string}
 */
function odtImportList(listEl, state) {

    const styleName = listEl.getAttributeNS(ODT_NS.text, "style-name") || listEl.getAttribute("text:style-name") || "";
    // crude detection of ordered vs bullet
    const isOrdered = /ord|num|number|\bL_Ordered\b/i.test(styleName);
    const tag = isOrdered ? "ol" : "ul";

    const items = [];
    for (const child of listEl.childNodes) {
        if (child.nodeType !== 1) { continue; }
        if (child.namespaceURI !== ODT_NS.text || child.localName !== "list-item") { continue; }
        items.push(odtImportListItem(child, state));
    }

    if (!items.length) { return ""; }
    return `<${tag}>${items.join("")}</${tag}>`;
}



/**
 * Render a single ODT list-item to a single <li>. Nested lists become
 * nested <ul>/<ol> directly inside the <li>.
 * @param {Element} itemEl
 * @param {object} state
 * @returns {string}
 */
function odtImportListItem(itemEl, state) {

    const inlineParts = [];
    const blockParts = [];

    for (const c of itemEl.childNodes) {
        if (c.nodeType !== 1) { continue; }
        const ns = c.namespaceURI || "";
        const local = (c.localName || "").toLowerCase();

        if (ns === ODT_NS.text && local === "p") {
            inlineParts.push(odtImportInline(c, state));
        } else if (ns === ODT_NS.text && local === "h") {
            inlineParts.push(odtImportInline(c, state));
        } else if (ns === ODT_NS.text && local === "list") {
            blockParts.push(odtImportList(c, state));
        }
    }

    let inner = inlineParts.join("<br>");
    if (blockParts.length) { inner += blockParts.join(""); }
    return `<li>${inner}</li>`;
}



/**
 * Render an ODT <table:table> to standard HTML <table>.
 * @param {Element} tableEl
 * @param {object} state
 * @returns {string}
 */
function odtImportTable(tableEl, state) {
    const rowsXml = [];
    for (const child of tableEl.childNodes) {
        if (child.nodeType !== 1) { continue; }
        if (child.namespaceURI !== ODT_NS.table) { continue; }
        if (child.localName !== "table-row") { continue; }

        const cellsXml = [];
        for (const cellChild of child.childNodes) {
            if (cellChild.nodeType !== 1) { continue; }
            if (cellChild.namespaceURI !== ODT_NS.table) { continue; }
            if (cellChild.localName !== "table-cell") { continue; }

            // walk inside the cell as a block container
            const inner = [];
            for (const sub of cellChild.childNodes) {
                odtImportWalk(sub, inner, state);
            }
            cellsXml.push(`<td>${inner.join("") || "<p><br></p>"}</td>`);
        }

        rowsXml.push(`<tr>${cellsXml.join("")}</tr>`);
    }
    return `<table><tbody>${rowsXml.join("")}</tbody></table>`;
}



/**
 * Render the inline content of a paragraph or heading. Walks ODT inline
 * elements (text:span, text:a, text:line-break, draw:frame, annotations).
 * @param {Element} parent
 * @param {object} state
 * @returns {string}
 */
function odtImportInline(parent, state) {
    const out = [];
    for (const c of parent.childNodes) {
        odtImportInlineNode(c, out, state);
    }
    return out.join("");
}



/**
 * Walk one inline node and append HTML to out.
 * @param {Node} node
 * @param {string[]} out
 * @param {object} state
 */
function odtImportInlineNode(node, out, state) {

    if (!node) { return; }

    if (node.nodeType === 3) {
        out.push(odtHtmlEscape(node.textContent || ""));
        return;
    }

    if (node.nodeType !== 1) { return; }

    const ns = node.namespaceURI || "";
    const local = (node.localName || "").toLowerCase();

    // <text:span> - inspect its style-name; we have no styles.xml resolver so
    // we try heuristics on style-name keywords as a best effort
    if (ns === ODT_NS.text && local === "span") {
        const styleName = node.getAttributeNS(ODT_NS.text, "style-name") || node.getAttribute("text:style-name") || "";
        const wraps = odtInlineWrappersFromStyleName(styleName);

        const inner = [];
        for (const c of node.childNodes) {
            odtImportInlineNode(c, inner, state);
        }
        out.push(odtWrapHtml(wraps, inner.join("")));
        return;
    }

    // <text:a>
    if (ns === ODT_NS.text && local === "a") {
        const href = node.getAttributeNS(ODT_NS.xlink, "href") || node.getAttribute("xlink:href") || "";
        const safe = odtSafeUrl(href);
        const inner = [];
        for (const c of node.childNodes) {
            odtImportInlineNode(c, inner, state);
        }
        if (!safe) { out.push(inner.join("")); return; }
        out.push(`<a href="${odtHtmlEscape(safe)}">${inner.join("")}</a>`);
        return;
    }

    // <text:line-break>
    if (ns === ODT_NS.text && local === "line-break") {
        out.push("<br>");
        return;
    }

    // <text:tab>
    if (ns === ODT_NS.text && local === "tab") {
        out.push("\t");
        return;
    }

    // <text:s> -> spaces (text:c attribute = count, default 1)
    if (ns === ODT_NS.text && local === "s") {
        const cAttr = node.getAttributeNS(ODT_NS.text, "c") || node.getAttribute("text:c") || "1";
        const count = parseInt(cAttr, 10) || 1;
        out.push(" ".repeat(Math.min(count, 200)));
        return;
    }

    // <draw:frame> -> we expect a <draw:image> inside referencing Pictures/...
    if (ns === ODT_NS.draw && local === "frame") {
        const imgEls = node.getElementsByTagNameNS(ODT_NS.draw, "image");
        if (imgEls.length) {
            const href = imgEls[0].getAttributeNS(ODT_NS.xlink, "href") || imgEls[0].getAttribute("xlink:href") || "";
            if (href && state.imageMap[href]) {
                out.push(`<img src="${odtHtmlEscape(state.imageMap[href])}" alt="">`);
            }
        }
        return;
    }

    // <office:annotation> - emit nothing here directly; the inline anchor
    //   text is the content between <office:annotation> and <office:annotation-end>.
    //   Some ODT writers put the anchor text as the content INSIDE the annotation
    //   (older style) and others use the range markers. We handle both:
    if (ns === ODT_NS.office && local === "annotation") {
        const id = node.getAttribute("office:name") || node.getAttributeNS(ODT_NS.office, "name") || "";
        // open a comment range
        state.openCommentStack.push(id);
        const meta = state.annotationsById[id] || { time: Date.now(), text: "" };
        // older odt: annotation contents include the anchor text as <text:p> too,
        //   but we already collected the comment text in meta.text. so we DO NOT
        //   emit the inner here, since that would double up.
        out.push(odtBuildCommentMarkOpen(id, meta));
        return;
    }

    if (ns === ODT_NS.office && local === "annotation-end") {
        const id = node.getAttribute("office:name") || node.getAttributeNS(ODT_NS.office, "name") || "";
        // pop matching id off the stack
        const idx = state.openCommentStack.lastIndexOf(id);
        if (idx >= 0) { state.openCommentStack.splice(idx, 1); }
        out.push("</mark>");
        return;
    }

    // <text:soft-page-break> / page break: skip
    if (ns === ODT_NS.text && (local === "soft-page-break" || local === "page-break")) {
        return;
    }

    // unknown inline element: descend
    for (const c of node.childNodes) {
        odtImportInlineNode(c, out, state);
    }
}



/**
 * Build the OPENING <mark> tag for a comment, encoding the meta.
 * Caller emits </mark> later when annotation-end is hit.
 * @param {string} id
 * @param {{time:number,text:string}} meta
 * @returns {string}
 */
function odtBuildCommentMarkOpen(id, meta) {
    const safeId = (id || "").replace(/[^a-zA-Z0-9_-]/g, "");
    const time = meta.time || Date.now();
    let b64 = "";
    try { b64 = btoa(meta.text || ""); } catch (e) { b64 = ""; }
    return `<mark class="comment" comment="${odtHtmlEscape(safeId)}" time="${odtHtmlEscape(String(time))}" contents="${odtHtmlEscape(b64)}">`;
}



/**
 * Map an ODT class-like style-name to a Quill-friendly css class.
 * Used on paragraphs for alignment.
 * @param {Element} el
 * @returns {string}
 */
function odtImportClassFromStyle(el) {
    const styleName = el.getAttributeNS(ODT_NS.text, "style-name") || el.getAttribute("text:style-name") || "";
    if (!styleName) { return ""; }
    if (/center/i.test(styleName)) { return "ql-align-center"; }
    if (/right|end/i.test(styleName)) { return "ql-align-right"; }
    if (/justify/i.test(styleName)) { return "ql-align-justify"; }
    return "";
}



/**
 * Heuristic: turn a style-name into a list of html wrapper tags.
 * We can't read the full styles.xml here without bigger machinery, so we
 * go off common naming conventions. Anything we don't recognize stays plain.
 * @param {string} styleName
 * @returns {string[]} array of tag names (innermost first)
 */
function odtInlineWrappersFromStyleName(styleName) {
    if (!styleName) { return []; }
    const wraps = [];
    if (/bold|^b$|_b\b|strong/i.test(styleName)) { wraps.push("b"); }
    if (/italic|^i$|_i\b|emph/i.test(styleName)) { wraps.push("i"); }
    if (/underline|^u$|_u\b/i.test(styleName)) { wraps.push("u"); }
    if (/strike|line-through|^s$/i.test(styleName)) { wraps.push("s"); }
    if (/subscript|^sub$/i.test(styleName)) { wraps.push("sub"); }
    if (/superscript|^sup$/i.test(styleName)) { wraps.push("sup"); }
    return wraps;
}



/**
 * Wrap an inner html string in a list of tags (innermost first).
 * @param {string[]} tags
 * @param {string} inner
 * @returns {string}
 */
function odtWrapHtml(tags, inner) {
    let html = inner;
    for (const t of tags) {
        html = `<${t}>${html}</${t}>`;
    }
    return html;
}



/**
 * Convert ISO date back to epoch ms. Returns now() on parse failure.
 * @param {string} iso
 * @returns {number}
 */
function odtIsoDateToEpochMs(iso) {
    if (!iso) { return Date.now(); }
    const t = Date.parse(iso);
    if (isNaN(t)) { return Date.now(); }
    return t;
}



/**
 * Best-effort mime detection for a Pictures/* file by extension.
 * Returns "" for anything we don't trust.
 * @param {string} relPath
 * @returns {string}
 */
function odtMimeFromName(relPath) {
    const lower = (relPath || "").toLowerCase();
    if (lower.endsWith(".png"))  { return "image/png"; }
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) { return "image/jpeg"; }
    if (lower.endsWith(".gif"))  { return "image/gif"; }
    if (lower.endsWith(".webp")) { return "image/webp"; }
    if (lower.endsWith(".bmp"))  { return "image/bmp"; }
    return "";
}
