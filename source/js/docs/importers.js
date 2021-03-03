////////////////////////////////////////////////
////////////////////////////////////////////////
// 
//	FILE IMPORTER / 3RD PARTY FORMAT CONVERTERS
// 
////////////////////////////////////////////////
////////////////////////////////////////////////


var importerSupportedExtensions = ["htm", "html", "docx", "enex", "txt", "md", "mkd", "mkdn", "mdwn", "mdown", "markdown", "markdn", "mdtxt", "mdtext", "crypteedoc", "ecd", "uecd"];


// FOR IMPORTS, WE'LL ALWAYS FIRST CREATE A NEW COPY OF THE FILE, AND NAME IT "Original"
// for this use copyDocument(did, true); 
// true = sets the copy's name "(Original)"

// THEN, WE'LL CONVERT THE OLD FILE TO A CRYPTEE DOC USING quill.clipboard & SAVE ITS CONTENTS

// FINALLY, WE'LL LOAD THE CONVERTED "DOCUMENT" using loadDoc. 

// this way, we don't have to worry about changing editor state from within loadFile, and don't have to worry about handling things like save / offline mode etc,
// those will all be handled in saveDoc natively.

// We only convert here, then call loadDoc on the converted document.





/**
 * Prepares the file importer, and converts the file into a doc.
 * @param {*} fileContents Plaintext / Uint8Array contents of file
 * @param {Object} doc A Document Object 
 * @param {string} [filename] Optional filename (i.e. when we call this from an attachment, name of which may not be decrypted in the catalog)
 */
async function importFile(doc, fileContents, filename) {
    filename = filename || docName(doc);
    var ext = extensionFromFilename(filename);

    breadcrumb('[IMPORT FILE] – Supported Format (' + ext + ")");

    // HTML FILES
    if (["htm", "html"].includes(ext)) {
        await importHTMLFile(doc, fileContents);
    }

    // TEXT / MARKDOWN FILES
    if (["txt", "md", "mkd", "mkdn", "mdwn", "mdown", "markdown", "markdn", "mdtxt", "mdtext"].includes(ext)) {
        await importTXTMDFile(doc, fileContents);
    }
    
    // CRYPTEEDOC / ECD FILES
    if (["crypteedoc", "ecd"].includes(ext)) {
        await importECDFile(doc, fileContents);
    }
    
    // UECD FILES
    if (["uecd"].includes(ext)) {
        await importUECDFile(doc, fileContents);
    }

    // ENEX FILES
    if (["enex"].includes(ext)) {
        await importENEXFile(doc, fileContents);
    }

    // DOCX FILES
    if (["docx"].includes(ext)) {
        await importDOCXFile(doc, fileContents);
    }
        

    // in adapters.js
    // CONSIDER LISTING FILES IN A ZIP DIRECTORY
    // https://github.com/Stuk/jszip
    
    // CHECK 7Z / ITS ENCODING OPENS CORRECTLY ON LINUX 

    return true;
}






























////////////////////////////////////////////////
////////////////////////////////////////////////
//	IMPORT 1ST PARTY FORMATS
////////////////////////////////////////////////
////////////////////////////////////////////////

var importingECD;

/**
 * Imports / Converts an ECD File
 * @param {string} doc docID
 * @param {*} fileContents Plaintext / Uint8Array contents of file
 */
async function importECDFile(doc, fileContents) {
    var did = doc.docid;

    breadcrumb('[ECD IMPORTER] Decoding File ' + did);

    var armoredContents = decodeFileContents(doc, fileContents);
    if (!armoredContents) {
        handleError("[ECD IMPORTER] Failed to import", { did : did });
        createPopup(`Failed to load/import your file <b>${docName(doc)}</b>. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        return false;
    }

    var parsedArmor;
    try {
        parsedArmor = JSON.parse(armoredContents);
        parsedArmor = parsedArmor.data;
    } catch (error) {
        error.did = did;
        handleError("[ECD IMPORTER] Failed to parse", { did : did });
    }

    if (!parsedArmor) {
        createPopup(`Failed to load/import your file <b>${docName(doc)}</b>. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        return false;
    }

    var plaintextContents;
    try {
        plaintextContents = await decrypt(parsedArmor, [theKey, keyToRemember]);
    } catch (error) {}

    if (!plaintextContents) {
        cancelAndResetImportingECD();

        // USING DIFFERENT KEY, SHOW MODAL
        importingECD = { doc : doc, ciphertext : parsedArmor };
        showModal("modal-import-ecd");
        return false;
    }

    await decryptAndImportECD({ doc : doc, plaintext : plaintextContents });

    return true;
}


/**
 * Decrypts, Converts & Imports ECD file (optionally skips decrypting) Called in modal-import-ecd and in importECDFile
 * @param {*} [ecd] if provided, skips decryption, and continues to import 
 */
async function decryptAndImportECD(ecd){
    ecd = ecd || importingECD || {};

    // if there's no ECD
    if (isEmpty(ecd)) {
        createPopup(`Failed to load/import your ECD file. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        return false;
    }

    // if there's no DOC in ECD
    if (!ecd.doc) {
        createPopup(`Failed to load/import your ECD file. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        return false;
    }

    var plaintextContents = ecd.plaintext;
    var ecdKey = $("#ecd-import-key-input").val().trim();

    // if we're coming from the modal
    if (ecd.ciphertext) {
        if (!ecdKey) {
            // user didn't enter key
            $("#ecd-import-key-input").trigger("focus");
            return false;
        } else {
            // user entered key
            startModalProgress("modal-import-ecd");

            try {
                plaintextContents = await decrypt(ecd.ciphertext, [theKey, keyToRemember, ecdKey]);
            } catch (error) {} 
        }
    }

    if (isEmpty(plaintextContents)) {
        stopModalProgress("modal-import-ecd");
        $("#modal-import-ecd").addClass("error");
        showModal("modal-import-ecd");
        $("#ecd-import-key-input").val("");
        $("#ecd-import-status").html("WRONG KEY!");
        return false;
    }

    $("#modal-import-ecd").removeClass("error");
    $("#ecd-import-status").html("decrypting / importing");

    // NOW plaintextContents.data = stringified doc delta
    // which is basically what we'd have as a UECD file, so from here on, we're basically importing an UECD file.
    await importUECDFile(ecd.doc, plaintextContents.data);

    cancelAndResetImportingECD();
    hideActiveModal();

    return true;
}



function cancelAndResetImportingECD() {
    importingECD = {};
    $("#ecd-import-status").html("");
    $("#ecd-import-key-input").val("");
    $("#modal-import-ecd").removeClass("error");
    stopModalProgress("modal-import-ecd");
}


/**
 * Imports / Converts / Loads an UECD (Unencrypted Cryptee Document) – and does the conversion for ECD files 
 * @param {*} doc document object
 * @param {*} fileContents Either stringified deltas of an ECD, or encoded fileContents of an UECD 
 */
async function importUECDFile(doc, fileContents) {
    var did = doc.docid;

    // there's technically no such thing called a V3 UECD file. 
    // AS OF V3, UECD files are imported during upload as regular documents.
    // so here, we'll either import an V1/V2/V3 ECD file, or a V1/V2 UECD file.
    
    // if this is an ECD file, it'll arrive as raw stringifiedDelta
    // if this is an UECD file, you'll need to decode it. So check the doc's extension, and work from there. 

    var filename = docName(doc);
    var extension = extensionFromFilename(filename);
    
    var plaintextDeltas;

    if (extension !== "ecd") {
        // legacy, V1/V2 UECD file. needs decoding.
        breadcrumb('[TXT / MD IMPORTER] Decoding File ' + did);

        plaintextDeltas = decodeFileContents(doc, fileContents);
    } else {
        plaintextDeltas = fileContents;
    }
    
    if (!plaintextDeltas) {
        handleError("[(U)ECD IMPORTER] Failed to decode", { did : did });
        createPopup(`Failed to load/import your file <b>${docName(doc)}</b>. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        return false;
    }

    var docContents; // parsed quill deltas
    try {
        docContents = JSON.parse(plaintextDeltas);
    } catch (error) {
        docContents = plaintextDeltas;
    }

    if (isEmpty(docContents)) {
        handleError("[(U)ECD IMPORTER] Failed to decode", { did : did });
        createPopup(`Failed to load/import your file <b>${docName(doc)}</b>. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        return false;
    }

    breadcrumb('[(U)ECD IMPORTER] Making a backup of original of: ' + did);

    // seems like we could convert it, so let's make a copy, and call it "Original", users can delete this original later if they wish
    await copyDocument(did, true);

    var savedConvertedDoc = await saveAndConvertFileToDocForImport(did, doc, docContents);
    if (isEmpty(savedConvertedDoc)) {
        handleError("[(U)ECD IMPORTER] Failed to save file/doc after conversion", {did:did});
        createPopup(`Failed to load/import your file <b>${docName(doc)}</b>. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        return false;
    }

    // now that we've got the converted doc, let's load it
    await loadDoc(savedConvertedDoc);

    return true;

}








////////////////////////////////////////////////
////////////////////////////////////////////////
//	IMPORT 3RD PARTY FORMATS
////////////////////////////////////////////////
////////////////////////////////////////////////









/**
 * Imports / Converts / Sanitizes an HTML File to a CrypteeDoc
 * @param {string} doc docID
 * @param {*} fileContents Plaintext / Uint8Array contents of file
 */
async function importHTMLFile(doc, fileContents) {
    var did = doc.docid;

    breadcrumb('[HTML IMPORTER] Decoding File ' + did);

    var rawHTML = decodeFileContents(doc, fileContents);
    if (!rawHTML) {
        handleError("[HTML IMPORTER] Failed to import", { did : did });
        createPopup(`Failed to load/import your file <b>${docName(doc)}</b>. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        return false;
    }
    
    breadcrumb('[HTML IMPORTER] Converting ' + did);

    var docContents;
    try {
        docContents = convertAndPurifyHTMLToDeltas(rawHTML);
    } catch (error) {
        error.did = did;
        handleError("[HTML IMPORTER] Failed to convert to quill deltas", error);
    }

    if (isEmpty(docContents)) {
        createPopup(`Failed to load/import your file <b>${docName(doc)}</b>. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        return false;
    }

    breadcrumb('[HTML IMPORTER] Making a backup of original of: ' + did);
    
    // seems like we could convert it, so let's make a copy, and call it "Original", users can delete this original later if they wish
    await copyDocument(did, true);
    
    var savedConvertedDoc = await saveAndConvertFileToDocForImport(did, doc, docContents);
    if (isEmpty(savedConvertedDoc)) {
        handleError("[HTML IMPORTER] Failed to save file/doc after conversion", {did:did});
        createPopup(`Failed to load/import your file <b>${docName(doc)}</b>. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        return false;
    }

    // now that we've got the converted doc, let's load it
    await loadDoc(savedConvertedDoc);

    return true;
}









/**
 * Imports / Converts a TXT/MD File to a CrypteeDoc through HTML
 * @param {*} doc Document Object
 * @param {*} fileContents Plaintext / Uint8Array contents of file
 */
async function importTXTMDFile(doc, fileContents) {
    var did = doc.docid;

    breadcrumb('[TXT / MD IMPORTER] Decoding File ' + did);

    var rawText = decodeFileContents(doc, fileContents);
    if (!rawText) {
        handleError("[TXT / MD IMPORTER] Failed to import", { did : did });
        createPopup(`Failed to load/import your file <b>${docName(doc)}</b>. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        return false;
    }
    
    breadcrumb('[TXT / MD IMPORTER] Converting ' + did);

    var docContents;
    try {
        docContents = convertTXTMDToDeltas(rawText);
    } catch (error) {
        error.did = did;
        handleError("[TXT / MD IMPORTER] Failed to convert to quill deltas", error);
    }

    if (isEmpty(docContents)) {
        createPopup(`Failed to load/import your file <b>${docName(doc)}</b>. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        return false;
    }

    breadcrumb('[TXT / MD IMPORTER] Making a backup of original of: ' + did);
    
    // seems like we could convert it, so let's make a copy, and call it "Original", users can delete this original later if they wish
    await copyDocument(did, true);
    
    var savedConvertedDoc = await saveAndConvertFileToDocForImport(did, doc, docContents);
    if (isEmpty(savedConvertedDoc)) {
        handleError("[TXT / MD IMPORTER] Failed to save file/doc after conversion", {did:did});
        createPopup(`Failed to load/import your file <b>${docName(doc)}</b>. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        return false;
    }

    // now that we've got the converted doc, let's load it
    await loadDoc(savedConvertedDoc);

    return true;

}










/**
 * Imports / Converts an ENEX file to Crypteedoc through HTML & Sanitizes the content as well
 * @param {*} doc document object
 * @param {*} fileContents Plaintext / Uint8Array contents of file
 */
async function importENEXFile(doc, fileContents) {
    var did = doc.docid;
    
    breadcrumb('[ENEX IMPORTER] Decoding File ' + did);
    showPopup("popup-enote");

    var rawENEX = decodeFileContents(doc, fileContents);
    if (!rawENEX) {
        handleError("[ENEX IMPORTER] Failed to import", { did : did });
        hidePopup("popup-enote");
        createPopup(`Failed to load/import your file <b>${docName(doc)}</b>. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        return false;
    }

    breadcrumb('[ENEX IMPORTER] Unpacking ' + did);

    var enexFile = await unpackENEXFile(rawENEX);

    if (isEmpty(enexFile)){
        handleError("[ENEX IMPORTER] Failed to import", { did : did });
        hidePopup("popup-enote");
        createPopup(`Failed to read/load/import your evernote file. Chances are this is a problem with the Evernote export. Please try exporting & uploading this file again.`, "error");
        return false;
    }

    // now we have 
    // enexFile.notes ( an object indexed by Cryptee DIDs ) 
    // enexFile.attachments ( an object indexed by file hashes )
    // encrypt & upload these 2 - 3 at a time.
    // we know their sumtotal size is smaller than 50mb, so we can work fast here. 

    // first upload attachments
    // this way by the time user sees the notes in the UI, 
    // all attachments would be uploaded
    
    // so if user opens the doc while upload is still going on,
    // linked attachments won't be missing

    // we'll also need a way to queue these. 
    // Perhaps go 3 attachments at a time, (just contents & title need encryption)
    // and 2 notes at a time (contents, title, tags need encryption)
    // so we'll have ~6 encryption operations in parallel max
    
    // there's more than one note, create a folder named after this file
    var targetFID = activeFolderID;
    if (Object.keys(enexFile.notes).length > 1) {
        var collectionName = docName(doc);
        var newFolderName = titleFromFilename(collectionName) + " (from Evernote)";
        var newFolderID = "f-" + newUUID();
        var brandNewFolder = await newFolder(activeFolderID, newFolderName, newFolderID, "#4bbf73");
        if (brandNewFolder) { targetFID = newFolderID; }
    }

    // now upload everything into either the current or the newly created folder. 
    // conveniently, we can actually use our uploader as a means of uploading everything here. 
    // notes are technically uecd files since we have their plaintext contents, and attachments are just regular v3 file uploads.
    // so we just have to cycle through notes & attachments, and add them to upload queue now the rest is all ready for us 

    for (var hash in enexFile.attachments) {
        var attachment = enexFile.attachments[hash];
        var attachmentDataURI = `data:${attachment.mime};charset=utf-8;base64,${attachment.b64}`;
        var attachmentDID = attachment.did;
        // if it's an image, attachment may not have a name since it might be embedded. so we simply don't upload images without names.
        // but if it's not an image, and for some reason attachment doesn't have a name, we make up one.
        var attachmentName = attachment.name;
        if (!attachmentName && !attachment.mime.startsWith("image")) {
            attachmentName = "Attached File." + attachment.mime.split("/")[1]; 
        }

        if (!attachmentName) { continue; }

        addFileToUploadQueue(dataURIToFile(attachmentDataURI, attachmentName), attachmentDID);
    }

    for (var noteDID in enexFile.notes) {
        var note = enexFile.notes[noteDID];
        var noteContents = JSON.stringify(note.plaintextDeltas);
        var noteName = note.plaintextTitle + ".uecd";
        addFileToUploadQueue(blobToFile(new Blob([noteContents], {type: "application/json;charset=utf-8"}), noteName), noteDID);
    }

    await runUploadQueue(false, targetFID);

    // for UI's sake
    hidePopup("popup-enote");
    
    return true;
}




































/**
 * Saves & Converts a crypteefile to a crypteedoc for import
 * @param {string} did doc id
 * @param {Object} doc document object
 * @param {*} contents plaintext doc contents (quill delta object)
 * @returns {Promise<Object>} convertedDoc (document object)
 */
async function saveAndConvertFileToDocForImport(did, doc, contents) {
    
    // STEP 1 : save the contents in the background

    breadcrumb('[IMPORTER] Saving converted file/doc' + did);
    var docUpload = await encryptAndUploadDocument(did, contents, true);

    if (isEmpty(docUpload)) { 
        handleError("[IMPORTER] Failed to save contents", {did:did});
        return false; 
    }

    // STEP 2 : this was a file, now it will be a document, so we'll need to set a few pieces of meta, and remove a few pieces of meta. 
    
    breadcrumb('[IMPORTER] Setting converted file/doc meta' + did);

    var docGen = parseInt(docUpload.generation);
    var docTags = await findAndEncryptDocumentTags(did, contents);
    var encryptedTags = docTags.tags;
    var decryptedTags = docTags.decryptedTags; 
    
    enableWakeLock();

    metaSavedToServer = await setDocMeta(did, {
        mime:"", // remove since it's not a file anymore         
        isfile : false, // remove since it's not a file anymore
        generation : docGen, // add because it's not a file anymore
        tags : encryptedTags // add because it's not a file anymore
    });

    metaSavedToCatalog = await setDocMetaInCatalog(did, {
        mime:"", // remove since it's not a file anymore        
        isfile : false, // remove since it's not a file anymore
        generation : docGen, // add because it's not a file anymore
        tags : encryptedTags, // add because it's not a file anymore
        decryptedTags : decryptedTags // add because it's not a file anymore. for local catalog, to save a decryption cycle, we save the decrypted tags too
    });

    disableWakeLock();

    if (!metaSavedToServer || !metaSavedToCatalog) { 
        handleError("[IMPORTER] Failed to set meta", {did:did});
        return false; 
    }

    // STEP 3 : RENAME and remove file extension

    var originalName = docName(doc);
    var filenameWithoutExtension = titleFromFilename(originalName);

    var updatedFilename = await renameDocOrFolder(did, filenameWithoutExtension);
    if (!updatedFilename) {
        handleError("[IMPORTER] Failed to update filename", {did:did});
        return false; 
    }

    // rename calls refresh dom, no need to do it again.
    
    // STEP 4 : RETURN the new doc.

    var convertedDoc = await getDocFromCatalog(did);
    if (isEmpty(convertedDoc)) {
        handleError("[IMPORTER] Failed to get the converted doc from catalog", {did:did});
        return false; 
    }

    return convertedDoc;
}










/**
 * Decodes a file's contents and returns raw contents. (i.e. takes a uint8array html file and returns raw html string like "<body>...</body>")
 * @param {Object} doc Document Object
 * @param {*} fileContents plaintext file contents (either uint8array or b64 string)
 */
function decodeFileContents(doc, fileContents) {
    var did = doc.docid;
    var decodedRawContents = ""; 

    if (did.endsWith("-v3")) {
        // if it's a v3, it's a uint8array, we'll need a decoded raw html string

        try {
            decodedRawContents = decodeUint8Array(fileContents);
        } catch (error) {
            handleError("[IMPORTER] Error decoding v3 file", error);
        }

    } else {
        // if it's a non v3, it's a B64, we'll need to decode it to get a raw html string
        
        try {
            // ios doesn't accept spaces and crashes browser. like wtf apple. What. THE. FUCCK!!!
            var spacelessDataURI = fileContents.replace(/\s/g, ''); 
            decodedRawContents = decodeBase64Unicode(spacelessDataURI.split(',')[1]);
        } catch (error) {
            handleError("[IMPORTER] Error decoding v1/2 file", error);
        }

    }

    return decodedRawContents;
}









/**
 * Converts a raw txt/md string to html then to deltas, while making sure the tables format is correct, and won't break editor. In addition it tries to convert html tables to cryptee tables
 * @param {string} rawText raw txt/md text
 * @returns {*} delta quill delta
 */
function convertTXTMDToDeltas(rawText) {
    var mdToHTMLConverter = new showdown.Converter({
        excludeTrailingPunctuationFromURLs : true,
        ghCompatibleHeaderId:true,
        simplifiedAutoLink: true,
        simpleLineBreaks : true, // alternatively use makeHTML().split("\n").join("<br>") 
        strikethrough: true,
        tasklists: true,
        tables : true
    });
    var rawHTML = mdToHTMLConverter.makeHtml(rawText);
    return convertAndPurifyHTMLToDeltas(rawHTML);
}

/**
 * Converts a raw html string to deltas, while making sure the tables format is correct, and won't break editor. In addition it converts html tables to cryptee tables
 * @param {string} rawHTML raw html string
 * @returns {*} delta quill delta
 */
function convertAndPurifyHTMLToDeltas(rawHTML) {
    // we'll need to purify twice here. here's why. 
    
    // to convert html tables to cryptee tables, we have to create an element and load things into dom. 
    // but this would mean we'd be loading unsafe HTML into dom right away. 
    
    // so purify round 1, before we load things into DOM for table conversion
    var purifiedHTML = purifyHTML(rawHTML);
    
    // dompurify says : "if you first sanitize HTML and then modify it afterwards, you might easily void the effects of sanitization"
    // meaning that since we need to convert tables, / replace img sources etc, and if someone reverse engineers this process, it could potentially open doors to other XSS attacks. 
    // so make necessary changes to html now, and we'll have to sanitize again afterwards.
    var crypteeHTML = fortifyHTML(purifiedHTML);
    
    // so do one more round of purification now with the tables changes in effect
    var purifiedCrypteeHTML = purifyHTML(crypteeHTML);

    var delta = convertHTMLToDeltas(purifiedCrypteeHTML);

    return delta;
}


/**
 * This takes in an HTML from the web, makes necessary chages to make sure it won't break the editor and adds a layer of privacy if it can
 * 
 * – converts html tables to cryptee tables
 * 
 * – replaces image sources as a privacy measure
 * @param {string} webHTML HTML
 * @returns {string} crypteeHTML HTML
 */
function fortifyHTML(webHTML) {
    breadcrumb('[CONVERT TABLES] Checking / Converting HTML Tables to Cryptee Tables');
    
    var parser = new DOMParser();
    var tempEl = parser.parseFromString(webHTML, "text/html");

    // find each image element and block it if it's from an external source, 
    // otherwise these can be used for tracking
    Array.from(tempEl.querySelectorAll("img")).forEach(imgElement => {
        // if image is from an external source, block it.
        blockInsecureImage(0, imgElement);
    });

    // find all elements with background images, and delete their background images 
    // otherwise these can be used for tracking
    Array.from(tempEl.querySelectorAll("*")).forEach(node => {
        if (node.style.backgroundImage.includes("url(")) {
            node.style.backgroundImage = "none";
        }

        if (node.style.background.includes("url(")) {
            node.style.background = "none";
        }
    });

    // find each table and convert them to cryptee tables
    Array.from(tempEl.querySelectorAll("table")).forEach(table => {

        var tableid = newUUID(8);

        // TAKE ONLY "TR" ELEMENTS – otherwise a broken table that has bad table syntax could break things here. 
        var rows = Array.from(table.getElementsByTagName("tr"));
        var noRows = rows.length;

        var noColumns = 0; 
        var cells = [];
        rows.forEach(row => {

            // take only td or th elements as columns... because internet is a weird place...
            Array.from(row.querySelectorAll("th, td")).forEach(column => {  
                // check to see if this column's childrens could break the table.
                // i.e. if there's a table as a children don't add or we'd be fucked.
                if (column.outerHTML.includes("<table") || column.outerHTML.includes("</table")) { return; }
                    
                // check if the children have a "BR" in them, since these would translate into add a new cell in a crypteetable.
                // if there are any delete those BRs. 
                Array.from(column.getElementsByTagName("br")).forEach(br => { br.remove(); });

                // strip all classes / attributes of the cell to make our parser's life easier
                while(column.attributes.length > 0) { column.removeAttribute(column.attributes[0].name); }

                // if there's a header, make it bold
                if (column.tagName === "TH") { column.innerHTML = "<b>"+column.innerHTML+"</b>"; }

                // finally add the column = cryptee table cell 
                cells.push(column);
            });

            // number of columns is the maximum number of columns in the table in total.
            // i.e. if the first two rows of the table have 2 columns, 
            // then the third row has 5 columns, we'll use 5 columns to make sure table won't break.

            if (row.children.length > noColumns) { noColumns = row.children.length; }

            row.remove();
        });
        
        // remove all attributes of the table.
        while(table.attributes.length > 0) { table.removeAttribute(table.attributes[0].name); }

        table.setAttribute("rows", noRows);
        table.setAttribute('tableid', tableid);
        table.setAttribute('columns', noColumns);
        table.setAttribute("style", `--columns:${noColumns}; --rows:${noRows};`);
        table.insertAdjacentHTML('beforebegin', `<crypteetabledata columns="${noColumns}" rows="${noRows}" tableid="${tableid}" contenteditable="false"><br></crypteetabledata>`);

        // remove all children of the table
        Array.from(table.children).forEach(children => { children.remove(); });

        // now add all cells back into the table
        cells.forEach(cell => { 
            while(cell.attributes.length > 0) { cell.removeAttribute(cell.attributes[0].name); }
            table.appendChild(cell);
        });

    });
      

    //  Get the content in the temp element and replace the temporary tags with new ones
    var newContent = tempEl.body.innerHTML;

    newContent = newContent.replace(/<td/g, '<crypteetablecell');
    newContent = newContent.replace(/<\/td/g, '</crypteetablecell');

    newContent = newContent.replace(/<th/g, '<crypteetablecell');
    newContent = newContent.replace(/<\/th/g, '</crypteetablecell');

    newContent = newContent.replace(/<table/g, '<crypteetable');
    newContent = newContent.replace(/<\/table/g, '</crypteetable');

    return newContent;

}

/**
 * Converts HTML to Deltas, while making sure tables etc won't break with unwanted elements in there.
 * @param {string} purifiedCrypteeHTML Purified & Cryptee Table Converted HTML
 */
function convertHTMLToDeltas(purifiedCrypteeHTML) {
    var delta = quill.clipboard.convert(purifiedCrypteeHTML);

    var tables = {};

    // first check ops for tables, and if there's anything incompatible in tables, and remove these incompatible items / ops. 
    delta.ops.forEach(function(op,opIndex) {
        if (op.attributes) {
            if (op.attributes.crypteetable) {
                if 
                (
                    op.insert.image ||
                    op.insert.video ||
                    op.insert.formula ||
                    op.insert.divider ||
                    op.attributes.list ||
                    op.attributes.indent ||
                    op.attributes.header ||
                    op.attributes.blockquote ||
                    op.attributes['list-item'] ||
                    op.attributes['code-block']
                ) { 
                    delta.ops[opIndex] = {}; 
                }
            }
        }
    });

    // now, we may have removed a few cells of the table, so we'll have to recalculate if there's any missing cells. 

    delta.ops.forEach(function(op,opIndex) {
        if (op.attributes) {
            
            var nextOpIndex = opIndex + 1;

            if (op.attributes.crypteetabledata) {
                
                // CREATE A DICTIONARY OF ALL TABLES IN THE PASTE BUFFER,
                // THEIR COLUMNS, ROWS ETC, WE'LL USE THIS SHORTLY.
                var data = op.attributes.crypteetabledata;
                var tableid = data.tableid;
                
                tables[tableid] = {};
                
                var columns = parseInt(data.columns);
                var rows = parseInt(data.rows);
                
                tables[tableid].columns = columns;
                tables[tableid].rows = rows;
                tables[tableid].cellCount = rows * columns;

                // pasted/converted crypteetabledata is often followed by a linebreak before crypteetable, which breaks the format.
                // we'll check to see if crypteetabledata is followed by anything else but a crypteetabledata.
                // crypteetabledata always has "attributes", so if next op doesn't have an attribute, delete it.
                
                if (!delta.ops[nextOpIndex].attributes || !delta.ops[nextOpIndex].attributes.crypteetable) { 
                    delta.ops[nextOpIndex] = {};
                }
            }

            if (op.attributes.crypteetable) {
                var id = op.attributes.crypteetable;

                // now using the tables dictionary,
                // let's double check to make sure table has the correct number of rows / columns / cells
                
                // let's first get the cells in this insert operation.
                // this could have the whole table's worth of cells, 
                // or even 0. Because if a cell has styling (i.e. bold) 
                // that will come in a separete insert, which may not have a newline in it. 
                // so we'll have to go through all inserts 
                // and add the total number of newline (\n) characters across all inserts
                var cellsInThisInsert = 0;
                if (typeof op.insert === "string") {
                    cellsInThisInsert = (op.insert.match(/\n/g) || []).length;
                }

                tables[id].cellsCounted = tables[id].cellsCounted || 0;
                tables[id].cellsCounted = tables[id].cellsCounted + cellsInThisInsert;

                // is this the last op? if so take note, we'll add missing cells here if necessary.
                // this is the last op for this table if : 

                // there's no next OP
                // next OP doesn't have attributes
                // next OP has an attributes, but doesn't have crypteetable
                // next OP table id isn't the same as this one.
                if (!delta.ops[nextOpIndex] ||
                    !delta.ops[nextOpIndex].attributes || 
                    !delta.ops[nextOpIndex].attributes.crypteetable ||
                     delta.ops[nextOpIndex].attributes.crypteetable !== id) { 
                    tables[id].lastOpIndex = opIndex; 
                }
            }
        }
    });

    
    // now that we have the counts, let's go through the tables, and find out how many cells might be missing
    for (var tableid in tables) {
        var table = tables[tableid];
        var shouldHaveCells    = table.cellCount;
        var actuallyHasCells   = table.cellsCounted;
        var lastOpIndexOfTable = table.lastOpIndex;
        
        var missingCells = shouldHaveCells - actuallyHasCells;
        
        if (missingCells >= 0) {
            // if table's missing x number of cells, let's add that many \n to the last op of the table
            // to make sure table won't break
            var cellsToAdd = "\n".repeat(missingCells);
            delta.ops[lastOpIndexOfTable].insert = delta.ops[lastOpIndexOfTable].insert + cellsToAdd; 
        } else {
            // if the table somehow has more cells, which may strangely happen, then we'll get a minus value for missing cells. 
            // so first, we'll have to take the number of columns as reference,
        }
    }

    // now that our modifications are complete, let's delete all blank ops 
    delta.ops = delta.ops.filter(value => Object.keys(value).length !== 0);
    
    return delta;
}


/**
 * Strips all un-usable html tags / elements such as "<style>" etc & and strips all potential XSS attack vectors
 * @param {string} rawHTML raw html string
 */
function purifyHTML(rawHTML) {
    breadcrumb('[PURIFY HTML] Purifying HTML');
    var allowedHTMLTags = ["A", "B", "BLOCKQUOTE", "BR", "CODE", "DEL", "DIV", "H1", "H2", "H3", "H4", "H5", "H6", "HR", "I", "IMG", "LI", "META", "OL", "P", "PRE", "Q", "S", "SPAN", "STRIKE", "STRONG", "SUB", "SUP", "TABLE", "TBODY", "TFOOT", "THEAD", "TD", "TH", "TR", "U", "UL"];
    var allowedCustomTags = ["CRYPTEETABLEDATA", "CRYPTEETABLE", "CRYPTEETABLECELL", "CRYPTEEFILE", "CRYPTEETAG"];
    var allowedCrypteeAttributes = ["tableid", "rows", "columns", "fid", "did", "filetitle", "filename", "extsrc", "extalt", "type", "hash", "checked", "data-checked"];
    var cleanHTML = DOMPurify.sanitize(rawHTML, { 
        ALLOWED_TAGS: allowedHTMLTags, 
        ADD_TAGS: allowedCustomTags ,
        ADD_ATTR: allowedCrypteeAttributes,
    });
    return cleanHTML;
}











////////////////////////////////////////////////
////////////////////////////////////////////////
//	CONVERT EVERNOTE (ENEX) FILES
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Takes the raw decoded enex / xml string of the master file, and extracts / unpacks the notes in it.
 * @param {string} rawENEX the main / parent ENEX file's XML source 
 * @returns {Object} enexFile
 * @returns {Object} enexFile.notes object of notes, mapped by cryptee DIDs
 * @returns {Object} enexFile.attachments object of attachments, mapped by resource hashes
 */
async function unpackENEXFile(rawENEX) {
    var x2js = new X2JS();

    var evernoteJSON = x2js.xml_str2json( rawENEX );
    if (!evernoteJSON) { return false; }
 
    var exporter = evernoteJSON['en-export']._version;
    breadcrumb('[ENEX IMPORTER] ENEX Created with : ' + exporter);
    setSentryTag("enex-version", exporter);

    // FIRST CHECK / GET ALL NOTES IN ENEX FILE.
    // ENEX FILES ARE LIKE NESTING DOLLS. THEY CAN CONTAIN MULTIPLE NOTES. 
    
    // SO LET'S GO THROUGH ALL NOTES IN THIS FILE FIRST.
    // AND ADD THEM TO A SINGLE OBJECT MAPPED BY CRYPTEE DIDs CALLED NOTES.

    // SIMILARLY, GO THROUGH ALL ATTACHMENTS IN ALL NOTES,
    // ADD THEM TO A SINGLE OBJECT MAPPED BY THEIR HASHES, CALLED ATTACHMENTS

    var attachments = {}; // object of attachments, mapped by resource hashes (maybe there's overlap, we only want to upload same file once)
    var notes = {};

    try {
        
        if (Array.isArray(evernoteJSON['en-export'].note)) {
            for (var note of evernoteJSON['en-export'].note) {
                prepareNoteAndAttachments(note);
            }
        } else {
            prepareNoteAndAttachments(evernoteJSON['en-export'].note);
        }
        
    } catch (error) {
        handleError("[ENEX IMPORTER] Failed to import / parse / process", error);
    }
    
    // now we have a packed notes object full of notes, their names, tags, and deltas
    // and a packed attachments object full of attachments,

    // it's time to upload them. 
    if (isEmpty(notes) && isEmpty(attachments)) { return false; }

    return { notes : notes, attachments : attachments };

    function prepareNoteAndAttachments(note) {
        var noteDID = "d-" + newUUID() + "-v3";
            
        // first let's get all the resources
        // and add them to our attachments object. 
        // console.log(note);
        if (note.resource) {
            if (note.resource.mime) {
                // there's only one resource / attachment
                var onlyAttachment = prepareENEXAttachmentFromResource(x2js, noteDID, note.resource);
                attachments[onlyAttachment.hash] = onlyAttachment;
            } else {
                // there's multiple resources / attachments
                for (var resource of note.resource) { 
                    var attachment = prepareENEXAttachmentFromResource(x2js, noteDID, resource);
                    attachments[attachment.hash] = attachment;
                }
            }
        } 

        // Now
        // purify enex xml –> convert the ENEX XML to HTML –> convert tables -> convert evernote tags to cryptee tags, –> convert todo lists, code blocks etc –> embed attachments / images we can embed
        // link all attachments we couldn't embed –> purify again –> get deltas
        var noteContent; 
        if (typeof note.content === "string") {
            noteContent = note.content;
        } else {
            noteContent = note.content.__cdata;
        }
        
        notes[noteDID] = {
            did : noteDID,
            tags : note.tag || [],
            plaintextDeltas : convertENEXToDeltas(noteDID, noteContent, attachments, (note.tag || [])),
            plaintextTitle : note.title || "Untitled Evernote Note"
        };
    }
}









/**
 * Converts a raw xml/html ENEX file to deltas, while making sure the tables format is correct, and won't break editor. In addition it converts html tables to cryptee tables
 * @param {string} noteDID 
 * @param {string} noteHTML raw html/xml string
 * @param {Object} attachments evernote attachments object
 * @param {array} tags evernote tags array
 * @returns {*} delta quill delta
 */
function convertENEXToDeltas(noteDID, noteHTML, attachments, tags) {

    // if it's empty
    if (!noteHTML || typeof noteHTML !== "string") { return { ops : [] }; }

    // we'll need to purify twice here. here's why. 
    
    // to convert html tables to cryptee tables, we have to create an element and load things into dom. 
    // but this would mean we'd be loading unsafe HTML into dom right away. 
    
    // so we'll have to purify first, before we load things into DOM for table conversion
    // BUT
    // domPurify extends void elements (or self closing dom elements like <img/> or <en-media/> and makes them <en-media></en-media>)
    // so before it does this, we'll need to replace all <en-media> tags with something we can safely use as a void-element in domPurify
    // and something that isn't "img", since it may not be an image, but a pdf etc.

    // here are all valid void elements. (for future reference)
    // area, base, br, col, command, embed, hr, img, input, keygen, link, meta, param, source, track, wbr
    
    // so we'll convert all <en-media/> or <en-todo/> elements to <meta/> since that's our only shot here
    noteHTML = noteHTML.replace(/<en-media/g, '<meta'); // meta[hash] 
    noteHTML = noteHTML.replace(/<en-todo/g, '<meta'); // meta[checked]

    var purifiedHTML = purifyHTML(noteHTML);
    
    // dompurify says : "if you first sanitize HTML and then modify it afterwards, you might easily void the effects of sanitization"
    
    // meaning that since we need to convert tables / enex media, if someone reverse engineers this process of conversion, it could potentially open doors to other XSS attacks. 
    // so convert now, and we'll have to sanitize again afterwards.
    var crypteeHTML = fortifyHTML(purifiedHTML);
    crypteeHTML     = convertENEXHTMLToCrypteeHTML(noteDID, crypteeHTML, attachments, tags);

    // so do one more round of purification now with the tables changes in effect
    var purifiedCrypteeHTML = purifyHTML(crypteeHTML);

    var delta = convertHTMLToDeltas(purifiedCrypteeHTML);

    return delta;

}






/**
 * Converts en-media tags to Cryptee Attachments
 * @param {string} noteDID 
 * @param {string} rawHTML raw html/xml string
 * @param {Object} attachments evernote attachments object
 * @param {array} tags evernote tags array
 */
function convertENEXHTMLToCrypteeHTML(noteDID, rawHTML, attachments, tags) {
    var $html = $('<div />',{html:rawHTML});
    var embeddedAttachments = [];

    breadcrumb("[ENEX CONVERTER] Converter RAW ENEX XML to Cryptee HTML");

    // STEP 1 : ENRICH EMBEDDED IMAGES

    $html.find('img').each(function(index, imgElement){
        var hash = $(this).attr("hash");
        var mime = $(this).attr("type");
        var b64, name;
        if (attachments[hash]) { 
            b64 = attachments[hash].b64; 
            mime = attachments[hash].mime;
            name = attachments[hash].name;
        }

        if (b64 && mime) {
            $(this).attr("src", `data:${mime};charset=utf-8;base64,${b64}`);
            embeddedAttachments.push(hash);
        }

        if (name) {
            $(this).attr("alt", name);
        }
    });

    // STEP 2 : REPLACE EN-MEDIA (META) ELEMENTS WITH IMAGES / CRYPTEE ATTACHMENTS

    // <en-media hash="c74289f94e4ca336c42962ff0f50e641" type="image/jpeg" />
    // <en-media hash="c74289f94e4ca336c42962ff0f50e641" type="application/pdf" />
    $html.find("meta[hash]").each(function(){
        var whatToReplaceWith;
        var hash = $(this).attr("hash");
        var mime = $(this).attr("type");
        var b64, name;
        if (attachments[hash]) { 
            b64 = attachments[hash].b64; 
            mime = attachments[hash].mime;
            name = attachments[hash].name;
            did  = attachments[hash].did;
        }
        
        if (mime.startsWith("image/")) {
            if (b64 && mime) {
                whatToReplaceWith = `<img src="data:${mime};charset=utf-8;base64,${b64}" alt="${name}" />`;
                embeddedAttachments.push(hash);
            }
        } else {
            if (did && name) {
                whatToReplaceWith = `<p><br></p><crypteefile did='${did}' filetitle='${name}'></crypteefile><p><br></p>`;
                embeddedAttachments.push(hash);
            }
        }

        if (whatToReplaceWith) {
            $(this).replaceWith(whatToReplaceWith);
        }
    });

    // STEP 3 : REPLACE TODOS

    $html.find('div').has("meta[checked]").each(function() {
        var checkedBool = $(this).find("meta[checked]").attr("checked");
        var checkboxContent = $(this).html();
        $(this).replaceWith(`<ul data-checked='${checkedBool}'><li>${checkboxContent}</li></ul>`);
    });

    // STEP 4 : REPLACE CODEBLOCKS

    $html.find('div').each(function() {
        if ($(this)[0].outerHTML.includes('-en-codeblock')) {
          var codeblockContent = $(this).html();
          $(this).replaceWith(`<pre class='ql-syntax' spellcheck='false'>${codeblockContent}</pre>`);
        }
    });

    // STEP 5 : ADD TAGS

    tags.forEach(tag => { $html.append(`<crypteetag contenteditable="false">${tag}</crypteetag><p><br></p>`); });
    
    // STEP 6 : ADD ATTACHMENTS WE COULDN'T EMBED VIA EN-MEDIA

    // first scroll through all attachments with their hashes. 
    for (var hash in attachments) {

        var attachment = attachments[hash];
        
        // if attachment doesn't belong to this note skip
        if (attachment.noteDID !== noteDID) { continue; }
        
        // already embedded it
        if (embeddedAttachments.includes(attachment.hash)) { continue; }
    
        // now get its name & did to embed
        var name = attachment.name || "Untitled Attachment";
        var did = attachment.did;
        $html.append(`<p><br></p><crypteefile did='${did}' filetitle='${name}'></crypteefile><p><br></p>`);

    }

    return $html.html();
}





/**
 * Takes in an ENEX Resource, and returns an attachment object
 * @param {*} x2js 
 * @param {string} noteDID 
 * @param {*} resource 
 * @returns {Object} attachment
 * @returns {string} attachment.hash
 * @returns {string} attachment.name
 * @returns {string} attachment.mime
 * @returns {string} attachment.b64
 */
function prepareENEXAttachmentFromResource(x2js, noteDID, resource) {

    // {
    // data: { _encoding:"base64", __text:"/9j/4AAQ...." }
    // mime: "application/pdf",
    // "resource-attributes" : { "file-name" : "AkkuratLL-Regular.pdf" }
    // "recognition" : "<xml>...<recoIndex objID="4c39db7b7884540f6123e03afe894666"></recoIndex></xml>" (objID = resource hash)
    // } 
    var uuid = newUUID();

    var did = "d-" + uuid + "-v3";
    var hash = uuid; 
    var name, b64, mime;
    var recognitionJSON = x2js.xml_str2json( (resource.recognition || "") );

    // get resource hash
    if (recognitionJSON) {
        if (recognitionJSON.recoIndex) {
            hash = recognitionJSON.recoIndex._objID || uuid;
        }
    }
    
    // get filename
    if (resource["resource-attributes"]) {
        name = resource["resource-attributes"]["file-name"] || "";
    }

    if (resource.data) {
        b64 = resource.data.__text || "";
    }

    if (resource.mime) {
        mime = resource.mime || "";
    }



    return { hash: hash, name: name, b64 : b64, mime: mime, did : did, noteDID:noteDID };
}



/**
 * Imports / Converts a DOCX File to a CrypteeDoc through HTML
 * @param {*} doc Document Object
 * @param {*} fileContents Plaintext / Uint8Array contents of file
 */
async function importDOCXFile(doc, fileContents) {
    
    var did = doc.docid;

    breadcrumb('[DOCX IMPORTER] Decoding File ' + did);
    
    // WE NEED DOCX FILES IN THE FORM OF A FILE, AS ARRAY BUFFER.
    // SO DO THE NECESSARY CONVERSIONS
    var fileArrayBuffer;
    if (did.endsWith("-v3")) {
        // fileContents === uInt8Array
        var docxFile = uInt8ArrayToFile(fileContents, "application/vnd.openxmlformats-officedocument.wordprocessingml.document", docName(doc));
        fileArrayBuffer = await readFileAs(docxFile, "arrayBuffer");
        
    } else {
        // fileContents === dataURL / b64
        fileArrayBuffer = dataURIToUInt8Array(fileContents).buffer;
    }

    breadcrumb('[DOCX IMPORTER] Converting ' + did);

    var docContents;
    try {
        docContents = await convertDOCXToDeltas(fileArrayBuffer, did);
    } catch (error) {
        error.did = did;
        handleError("[DOCX IMPORTER] Failed to convert to quill deltas", error);
    }

    if (isEmpty(docContents)) {
        createPopup(`Failed to load/import your file <b>${docName(doc)}</b>. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        return false;
    }

    breadcrumb('[DOCX IMPORTER] Making a backup of original of: ' + did);
    
    // seems like we could convert it, so let's make a copy, and call it "Original", users can delete this original later if they wish
    await copyDocument(did, true);
    
    var savedConvertedDoc = await saveAndConvertFileToDocForImport(did, doc, docContents);
    if (isEmpty(savedConvertedDoc)) {
        handleError("[DOCX IMPORTER] Failed to save file/doc after conversion", {did:did});
        createPopup(`Failed to load/import your file <b>${docName(doc)}</b>. Chances are this is a network / connectivity problem, or your browser is configured to block access to localStorage / indexedDB. Please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues.`, "error");
        return false;
    }

    // now that we've got the converted doc, let's load it
    await loadDoc(savedConvertedDoc);

    createPopup(`<i>docx</i> is a 15+ year old format by Microsoft&trade;. Although Cryptee is able to convert &amp; open Word&trade; <i>docx</i> files as accurately as possible, you may still experience compatibility issues like misformatted tables or missing colors, highlights, comments etc. To prevent data-loss, Cryptee generated a copy of your original file before converting this <i>docx</i> file.`, "info");

    return true;

}


/**
 * Converts a raw docx arrayBuffer to html then to deltas, while making sure the tables format is correct, and won't break editor. In addition it tries to convert html tables to cryptee tables
 * @param {*} arrayBuffer raw docx arrayBuffer contents
 * @param {string} did doc id for error logging 
 * @returns {*} delta quill delta
 */
async function convertDOCXToDeltas(arrayBuffer, did) {
    
    var convertedResult;
    var rawHTML = ""; 

    try {
        convertedResult = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer }).then();
        rawHTML = convertedResult.value;
    } catch (error) {
        error.did = did;
        handleError("[DOCX IMPORTER] Failed to convert DOCX to HTML", error);
    }

    if (!rawHTML) { return false; }

    return convertAndPurifyHTMLToDeltas(rawHTML);

}