////////////////////////////////////////////////
////////////////////////////////////////////////
//	UI HELPERS
////////////////////////////////////////////////
////////////////////////////////////////////////


/**
 * Scrolls a container to top, i.e. pass "folders" to scroll "#folders" to top.
 * @param {string} containerID i.e. "folders"
 */
function scrollTop(containerID) {
    $("#" + containerID)[0].scrollTo({ top: 0, left: 0, behavior: 'smooth' });
    activityHappened();
}

/**
 * Displays a progress message on body, similar to the one you display when starting up, while decrypting docs (with the blinking dot)
 * @param {('other'|'starting')} type type of progress
 * @param {string} msg the progress message
 */
function showBodyProgress(type, msg) {
    $("body").removeClass("other starting");
    $("body").addClass(type);   
    $("body").attr("msg", msg);
}

/**
 * Hide body progress.
 */
function hideBodyProgress() {
    $("body").removeClass("other starting");
    $("body").attr("msg", "");
}



var rightProgressTimer;
var rightProgressSeconds = 0;
var secondsBeforeWeShowProgress = 5;
/**
 * Updates / displays the progress bar on the right side
 * @param {number} value 
 * @param {number} max 
 * @param {('green'|'red'|'yellow'|'blue')} [color] color for the progress bar
 */
function updateRightProgress(value, max, color) {
    $("#progress").removeClass("green red yellow blue");
    
    if (color) { $("#progress").addClass(color); }
    
    max = max || 100;
    value = value || 0;

    // if five seconds passed, and we still haven't uploaded more than 50%, then we see the progress bar.
    // otherwise only change color.
    
    if (value === 0) {
        rightProgressSeconds = 0;
        clearInterval(rightProgressTimer);
        rightProgressTimer = setInterval(function(){
            rightProgressSeconds++;
        }, 1000);
    }

    if (rightProgressSeconds >= secondsBeforeWeShowProgress && value / 2 < max) {
        $("#progress").attr("value", value);
        $("#progress").attr("max", max);
    }
    
    if (value === max) {
        clearInterval(rightProgressTimer);
        rightProgressSeconds = 0;
    }
}

/**
 * Starts an indeterminate progress on the right and shows a message
 * @param {string} msg A message to show while loading
 */
function startRightProgress(msg) {
    $("#progress").removeClass("green red yellow blue");
    $("#progress").removeAttr("max");
    $("#progress").removeAttr("value");
    $("body").addClass("loading-doc");
    $("#statusMessage").html(msg);
    clearInterval(rightProgressTimer);
    rightProgressSeconds = 0;
}


/**
 * Stops a progress on the right, and resets to 100%
 * @param {('green'|'red'|'yellow'|'blue')} [color] color for the progress bar
 */
function stopRightProgress(color) {
    $("#progress").attr("value", 100);
    $("#progress").attr("max", 100);
    $("body").removeClass("loading-doc");
    $("#progress").removeClass("green red yellow blue");
    if (color) { $("#progress").addClass(color); }
    clearInterval(rightProgressTimer);
    rightProgressSeconds = 0;
}





/**
 * Updates the editor state to no document, loading doc or nothing
 * @param {('no-doc'|'loading-doc'|'')} state the editor state (no document, loading doc or nothing) 
 */
function updateEditorState(state) {
    if (state) {
        $("body").addClass(state);
        quill.blur();
        setTimeout(function () { swiper.update(); }, 100);
    } else {
        if (isMobile) {
            // so that this happens right away once we set the editor's contents
            $("body").removeClass("loading-doc no-doc");
            setTimeout(function () { swiper.update(); }, 100);            
        } else {
            // so that this happens shortly after we set the editor's contents
            setTimeout(function () {
                $("body").removeClass("loading-doc no-doc");
                setTimeout(function () { swiper.update(); }, 100);
            }, 300);
        }
    }
}

/**
 * Updates / displays the progress bar on the left side
 * @param {number} value 
 * @param {number} max 
 */
function updateLeftProgress(value, max) {
    $("#searchProgress").attr("value", value);
    $("#searchProgress").attr("max", max);
}

/**
 * Starts an indeterminate progress on the left
 */
function startLeftProgress() {
    $("#searchProgress").removeAttr("max");
    $("#searchProgress").removeAttr("value");
}

/**
 * Stops a progress on the left, and resets to 100% to act as search input field.
 */
function stopLeftProgress() {
    $("#searchProgress").attr("value", 100);
    $("#searchProgress").attr("max", 100);
}


/**
 * starts the move floater progress
 */
function startMoveProgress() {
    $("#moveFloat").addClass("moving");
    $("#moveProgress").removeAttr("max");
    $("#moveProgress").removeAttr("value");
}

/**
 * stops the move floater progress
 */
function stopMoveProgress() {
    $("#moveFloat").removeClass("moving");
    $("#moveProgress").attr("value", 100);
    $("#moveProgress").attr("max", 100);
}

/**
 * Shows a floater in the left slide
 * @param {string} id FloaterID (i.e. "moveFloat", or "selectionsFloat")
 * @param {string} msg Message to display in the float
 */
function showFloater(id) {
    $("#" + id).addClass("show");    
}

/**
 * Hides a floater in the left slide
 * @param {string} id FloaterID (i.e. "moveFloat", or "selectionsFloat")
 */
function hideFloater(id) {
    $("#" + id).removeClass("show");    
    $("#" + id).attr("items", "");
    $("#" + id).attr("what", "");
}

/**
 * Hides all floaters in the left slide
 */
function hideFloaters() {
    $(".actionFloater").removeClass("show");   
    $(".actionFloater").attr("items", "");
    $(".actionFloater").attr("what", ""); 
}


$("#moveFloat")[0].addEventListener('swiped-down', function(event) {
    hideFloater("moveFloat");
}); 

/**
 * starts the doc or file progress in the left sidebar
 * @param {string} did doc or file id
 */
function startDocOrFileProgress(did) {
    $(`.doc[did="${did}"]`).addClass("loading");
    $(`crypteefile[did="${did}"]`).addClass("loading");
}

/**
 * stops the doc or file progress in the left sidebar
 * @param {string} did doc or file id
 */
function stopDocOrFileProgress(did) {
    $(`.doc[did="${did}"]`).removeClass("loading");
    $(`crypteefile[did="${did}"]`).removeClass("loading");
}


function showEmbeddingImageProgress() {
    $("#embedding-image").removeAttr("max");
    $("#embedding-image").removeAttr("value");
    $("#panel-embedding-image").addClass("show");
}


function hideEmbeddingImageProgress() {
    setTimeout(function () { // for UI smoothness
        $("#panel-embedding-image").removeClass("show");
        $("#embedding-image").attr("value", 0);
        $("#embedding-image").attr("max", 100);
    }, 500);
}

////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 GLOBAL VARIABLES
////////////////////////////////////////////////
////////////////////////////////////////////////

var activeFolderID = "";
var activeDocID;









////////////////////////////////////////////////
////////////////////////////////////////////////
//	HELPERS
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Extracts useful information from the filename. (i.e. "icon" can return "ri-file-text-line", or "unicodeIcon" can return "\ED0F", or "filetype" can return "image photo foto" etc )
 * @param {string} filename 
 * @param {('icon'|'filetype'|'unicodeIcon')} whatToExtract 
 */
function extractFromFilename(filename, whatToExtract) {
    var extension = extensionFromFilename(filename);
    var icon = "ri-file-text-line";
    var unicodeIcon = "\ED0F";
    var filetype = "document file";
    var extract;

    if (extension.match(/^(006|007|3DMF|3DX|8PBS|ABM|ABR|ADI|AEX|AI|AIS|ALBM|AMU|ARD|ART|ARW|ASAT|B16|BIL|BLEND|BLKRT|BLZ|BMC|BMC|BMP|BOB|BR4|BR5|C4|CADRG|CATPART|CCX|CDR|CDT|CDX|CGM|CHT|CM2|CMX|CMZ|COMICDOC|CPL|CPS|CPT|CR2|CSF|CV5|CVG|CVI|CVI|CVX|DAE|DCIM|DCM|DCR|DCS|DDS|DESIGN|DIB|DJV|DJVU|DNG|DRG|DRW|DRWDOT|DT2|DVL|DWB|DWF|DXB|EASM|EC3|EDP|EDRW|EDW|EMF|EPRT|EPS|EPSF|EPSI|EXR|FAC|FACE|FBM|FBX|FC2|FCZ|FD2|FH11|FHD|FIT|FLIC|FLM|FM|FPF|FS|FXG|GIF|GRAFFLE|GTX|HEIC|HEIF|HD2|HDZ|HPD|HPI|HR2|HTZ4|ICL|ICS|IDW|IEF|IGES|IGR|ILBM|ILM|IMA|IME|IMI|IMS|INDD|INDT|IPJ|IRF|ITC2|ITHMB|J2K|JIFF|JNG|JPEG|JPF|JPG|JPG2|JPS|JPW|JT|JWL|JXR|KDC|KODAK|KPG|LDA|LDM|LET|LT2|LTZ|LVA|LVF|LXF|MAC|MACP|MCS|MCZ|MDI|MGS|MGX|MIC|MIP|MNG|MPF|MPO|MTZ|MUR|MUR|NAV|NCR|NEU|NFF|NJB|NTC|NTH|ODI|ODIF|OLA|OPD|ORA|OTA|OTB|OTC|OTG|OTI|OVW|P21|P2Z|PAT|PC6|PC7|PCD|PCT|PCX|PDN|PEF|PI2|PIC|PIC|PICNC|PICTCLIPPING|PL0|PL2|PLN|PMB|PNG|POL|PP2|PPSX|PRW|PS|PS|PSB|PSD|PSF|PSG|PSP|PSPIMAGE|PSQ|PVL|PWD|PWS|PX|PXR|PZ2|PZ3|QTIF|QTZ|QXD|RIC|RLC|RLE|RW2|SDK|SDR|SEC|SFW|SIG|SKP|SLDASM|SLDDRW|SLDPRT|SNX|SRF|SST|SUN|SVG|SVGZ|TARGA|TCW|TCX|TEX|TGA|TIF|TIFF|TJP|TN|TPF|TPX|TRIF|TRX|U3D|UPX|URT|UTX|V00|V3D|VFS|VGA|VHD|VIS|VRL|VTX|WB1|WBC|WBD|WBZ|WEBP|WGS|WI|WMF|WNK|XDW|XIP|XSI|X_B|X_T|ZDL|ZIF|ZNO|ZPRF|ZT)$/i)) {
        filetype = "image photo foto";
        icon = "ri-image-fill";
        unicodeIcon = "\EE4A";
    }
    if (extension.match(/^(pdf)$/i)) {
        filetype = "pdf adobe document";
        icon = "ri-file-ppt-line";
        unicodeIcon = "\ED01";
    }
    if (extension.match(/^(epub)$/i)) {
        filetype = "book epub ebook mobi read ereader volume publication novel paperback hardback reference";
        icon = "ri-book-open-line";
        unicodeIcon = "\EADB";
    }
    if (extension.match(/^(ecd)$/i)) {
        filetype = "encrypted cryptee document";
        icon = "ri-file-lock-line";
        unicodeIcon = "\ECF3";
    }
    if (extension.match(/^(uecd)$/i)) {
        filetype = "cryptee document";
        icon = "ri-file-text-line";
        unicodeIcon = "\ED0F";
    }
    if (extension.match(/^(enex)$/i)) {
        filetype = "evernote note";
        icon = "ri-evernote-fill";
        unicodeIcon = "\ECA2";
    }
    if (extension.match(/^(md|mkd|mkdn|mdwn|mdown|markdown|markdn|mdtxt|mdtext)$/i)) {
        filetype = "markdown note";
        icon = "ri-markdown-fill";
        unicodeIcon = "\EF1D";
    }
    if (extension.match(/^(c|cake|clojure|coffee|jsx|cpp|cs|css|less|scss|csx|gfm|git-config|go|gotemplate|java|java-properties|js|jquery|regexp|json|litcoffee|makefile|nant-build|objc|objcpp|perl|perl6|plist|python|ruby|rails|rjs|sass|shell|sql|mustache|strings|toml|yaml|git-commit|git-rebase|html|erb|gohtml|jsp|php|py|junit-test-report|shell-session|xml|xsl)$/i)) {
        filetype = "code script program";
        icon = "ri-file-code-line";
        unicodeIcon = "\ECD1";
    }
    if (extension.match(/^(7z|bz2|tar|gz|rar|zip|zipx|dmg|pkg|tgz|wim)$/i)) {
        filetype = "archive compress";
        icon = "ri-file-zip-line";
        unicodeIcon = "\ED1F";
    }
    if (extension.match(/^(doc|dot|wbk|docx|docm|dotx|dotm|docb|apxl|pages)$/i)) {
        filetype = "office word microsoft document";
        icon = "ri-file-word-2-line";
        unicodeIcon = "\ED1B";
    }
    if (extension.match(/^(xls|xlt|xlm|xlsx|xlsm|xltx|xltm|xlsb|xla|xlam|xll|xlw|numbers)$/i)) {
        filetype = "office excel microsoft document";
        icon = "ri-file-excel-2-line";
        unicodeIcon = "\ECDD";
    }
    if (extension.match(/^(ppt|pot|pps|pptx|pptm|potx|potm|ppam|ppsx|ppsm|sldx|sldm|key|keynote)$/i)) {
        filetype = "office powerpoint microsoft document";
        icon = "ri-file-ppt-2-line";
        unicodeIcon = "\ECFF";
    }
    if (extension.match(/^(3GA|AA|AA3|AAC|AAX|ABC|AC3|ACD|ACD|ACM|ACT|ADG|ADTS|AFC|AHX|AIF|AIFC|AIFF|AL|AMR|AMZ|AOB|APC|APE|APF|ATRAC|AU|AVR|AWB|AWB|BAP|BMW|CAF|CDA|CFA|CIDB|COPY|CPR|CWP|DAC|DCF|DCM|DCT|DFC|DIG|DSM|DSS|DTS|DTSHD|DVF|EFA|EFE|EFK|EFV|EMD|EMX|ENC|F64|FL|FLAC|FLP|FST|GNT|GPX|GSM|GSM|HMA|HTW|IFF|IKLAX|IMW|IMY|ITS|IVC|K26|KAR|KFN|KOE|KOZ|KOZ|KPL|KTP|LQT|M3U|M3U8|M4A|M4B|M4P|M4R|MA1|MID|MIDI|MINIUSF|MIO|MKA|MMF|MON|MP2|MP3|MPA|MPC|MPU|MP_|MSV|MT2|MTE|MTP|MUP|MXP4|MZP|NCOR|NKI|NRT|NSA|NTN|NWC|ODM|OGA|OGG|OMA|OMG|OMX|OTS|OVE|PCAST|PEK|PLA|PLS|PNA|PROG|PVC|QCP|R1M|RA|RAM|RAW|RAX|REX|RFL|RIF|RMJ|RNS|RSD|RSO|RTI|RX2|SA1|SBR|SD2|SFA|SGT|SID|SMF|SND|SNG|SNS|SPRG|SSEQ|SSND|SWA|SYH|SZ|TAP|TRM|UL|USF|USFLIB|USM|VAG|VMO|VOI|VOX|VPM|VRF|VYF|W01|W64|WAV|WMA|WPROJ|WRK|WUS|WUT|WWU|XFS|ZGR|ZVR)$/i)) {
        filetype = "sound audio song track vibe music voice record play tune phono phone capture";
        icon = "ri-mv-line";
        unicodeIcon = "\EF87";
    }
    if (extension.match(/^(264|3G2|3GP|3MM|3P2|60D|AAF|AEC|AEP|AEPX|AJP|AM4|AMV|ARF|ARV|ASD|ASF|ASX|AVB|AVD|AVI|AVP|AVS|AVS|AX|AXM|BDMV|BIK|BIX|BOX|BPJ|BUP|CAMREC|CINE|CPI|CVC|D2V|D3V|DAV|DCE|DDAT|DIVX|DKD|DLX|DMB|DM_84|DPG|DREAM|DSM|DV|DV2|DVM|DVR|DVR|DVX|DXR|EDL|ENC|EVO|F4V|FBR|FBZ|FCP|FCPROJECT|FLC|FLI|FLV|GTS|GVI|GVP|H3R|HDMOV|IFO|IMOVIEPROJ|IMOVIEPROJECT|IRCP|IRF|IRF|IVR|IVS|IZZ|IZZY|M1PG|M21|M21|M2P|M2T|M2TS|M2V|M4E|M4U|M4V|MBF|MBT|MBV|MJ2|MJP|MK3D|MKV|MNV|MOCHA|MOD|MOFF|MOI|MOV|MP21|MP21|MP4|MP4V|MPEG|MPG|MPG2|MQV|MSDVD|MSWMM|MTS|MTV|MVB|MVP|MXF|MZT|NSV|OGV|OGX|PDS|PGI|PIV|PLB|PMF|PNS|PPJ|PRPROJ|PRTL|PSH|PVR|PXV|QT|QTL|R3D|RATDVD|RM|RMS|RMVB|ROQ|RPF|RPL|RUM|RV|SDV|SFVIDCAP|SLC|SMK|SPL|SQZ|SUB|SVI|SWF|TDA3MT|THM|TIVO|TOD|TP0|TRP|TS|UDP|USM|VCR|VEG|VFT|VGZ|VIEWLET|VLAB|VMB|VOB|VP6|VP7|VRO|VSP|VVF|WD1|WEBM|WLMP|WMMP|WMV|WP3|WTV|XFL|XVID|ZM1|ZM2|ZM3|ZMV)$/i)) {
        filetype = "video film record play capture";
        icon = "ri-movie-line";
        unicodeIcon = "\EF81";
    }

    if (whatToExtract === "icon") {
        extract = icon;
    }

    if (whatToExtract === "filetype") {
        extract = filetype;
    }

    if (whatToExtract === "unicodeIcon") {
        extract = unicodeIcon;
    }

    return extract;
}

function gensort(a, b) {
    var aGeneration = a.generation || 0;
    var aOfflineGen = a.offline    || 0;
    if (aOfflineGen > aGeneration) { aGeneration = aOfflineGen; }

    var bGeneration = b.generation || 0;
    var bOfflineGen = b.offline    || 0;
    if (bOfflineGen > bGeneration) { bGeneration = bOfflineGen; }
    
    if (aGeneration < bGeneration) { return 1; }
    if (aGeneration > bGeneration) { return -1; }
    return 0;
}

function extsort(a, b) {
    var aext = (extensionFromFilename((a.decryptedTitle || "")) || "").toLowerCase();
    var bext = (extensionFromFilename((b.decryptedTitle || "")) || "").toLowerCase();
    if (aext < bext) { return 1; }
    if (aext > bext) { return -1; }
    return 0;
}

/*
 * Natural Sort algorithm for Javascript - Version 0.8.1 - Released under MIT license
 * Author: Jim Palmer (based on chunking idea from Dave Koelle)
 */
function naturalSort (a, b) {
    var re = /(^([+\-]?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?(?=\D|\s|$))|^0x[\da-fA-F]+$|\d+)/g,
        sre = /^\s+|\s+$/g,   // trim pre-post whitespace
        snre = /\s+/g,        // normalize all whitespace to single ' ' character
        dre = /(^([\w ]+,?[\w ]+)?[\w ]+,?[\w ]+\d+:\d+(:\d+)?[\w ]?|^\d{1,4}[\/\-]\d{1,4}[\/\-]\d{1,4}|^\w+, \w+ \d+, \d{4})/,
        hre = /^0x[0-9a-f]+$/i,
        ore = /^0/,
        i = function(s) {
            return (('' + s).toLowerCase() || '' + s).replace(sre, '');
        },
        // convert all to strings strip whitespace
        x = i(b.decryptedTitle),
        y = i(a.decryptedTitle),
        // chunk/tokenize
        xN = x.replace(re, '\0$1\0').replace(/\0$/,'').replace(/^\0/,'').split('\0'),
        yN = y.replace(re, '\0$1\0').replace(/\0$/,'').replace(/^\0/,'').split('\0'),
        // numeric, hex or date detection
        xD = parseInt(x.match(hre), 16) || (xN.length !== 1 && Date.parse(x)),
        yD = parseInt(y.match(hre), 16) || xD && y.match(dre) && Date.parse(y) || null,
        normChunk = function(s, l) {
            // normalize spaces; find floats not starting with '0', string or 0 if not defined (Clint Priest)
            return (!s.match(ore) || l == 1) && parseFloat(s) || s.replace(snre, ' ').replace(sre, '') || 0;
        },
        oFxNcL, oFyNcL;
    // first try and sort Hex codes or Dates
    if (yD) {
        if (xD < yD) { return -1; }
        else if (xD > yD) { return 1; }
    }
    // natural sorting through split numeric strings and default strings
    for(var cLoc = 0, xNl = xN.length, yNl = yN.length, numS = Math.max(xNl, yNl); cLoc < numS; cLoc++) {
        oFxNcL = normChunk(xN[cLoc] || '', xNl);
        oFyNcL = normChunk(yN[cLoc] || '', yNl);
        // handle numeric vs string comparison - number < string - (Kyle Adams)
        if (isNaN(oFxNcL) !== isNaN(oFyNcL)) {
            return isNaN(oFxNcL) ? 1 : -1;
        }
        // if unicode use locale comparison
        if (/[^\x00-\x80]/.test(oFxNcL + oFyNcL) && oFxNcL.localeCompare) {
            var comp = oFxNcL.localeCompare(oFyNcL);
            return comp / Math.abs(comp);
        }
        if (oFxNcL < oFyNcL) { return -1; }
        else if (oFxNcL > oFyNcL) { return 1; }
    }
}


function recentMonthsAgo(recentMonths) {
    var curDate = new Date();
    curDate.setMonth(curDate.getMonth() - recentMonths); // this comes from preferences.js and loaded from localStorage
    curDate.setHours(0, 0, 0);
    curDate.setMilliseconds(0);
    var msAgo = curDate.getTime();
    return msAgo * 1000;
}








////////////////////////////////////////////////
////////////////////////////////////////////////
//	AUTH / STARTUP
////////////////////////////////////////////////
////////////////////////////////////////////////

var startedOffline = false;

if (navigator.onLine) {
    checkConnection().then((connected)=>{
        if (connected) {
            startOnline();
        } else {
            startOffline();
        }
    });
} else {
    startOffline();
}



function startOnline() {
    breadcrumb('[STARTUP] Starting in online mode.');

    startedOffline = false;
    
    authenticate(function(user){
        // LOGGED IN

        preStartup();
        checkKey(null, startedOffline); // rightKey will call startup();
    
    }, function(){
        // NOT LOGGED IN
        location.href = "/login";
    }, function(error) {
        // ERROR
        if (error.code === "auth/network-request-failed") {
            handleError("[HOME] Error Authenticating", error);
        }
        
        location.href = "/login";
    });    
}

function startOffline() {
    breadcrumb('[STARTUP] Starting in offline mode.');

    startedOffline = true;

    //
    //
    // THIS IS preStartup but for Offline Mode
    //
    //

    // since there's stuff in catalog, we'll use the left pane progress bar for syncs
    setTimeout(function () {
        hideBodyProgress();
        setTimeout(function () { if (isTouch) {  $("html, body").addClass("overflowBG");  }  }, 500);
    }, 500);
    
    //
    //
    //

    checkKey(null, startedOffline); // rightKey will call startup();
}






////////////////////////////////////////////////
////////////////////////////////////////////////
//	STARTUP
////////////////////////////////////////////////
////////////////////////////////////////////////

// THIS RUNS EVEN BEFORE USER TYPES THE KEY. 
// THAT WAY WE CAN LOAD A FEW THINGS AHEAD OF TIME. 

var startedUp = false;
var gotRecents = false;

async function preStartup() {


    try {
        // TRY GETTING DOCS & FOLDERS FROM CATALOG

        var docs = await getAllDocsFromCatalog();
        var folders = await getAllFoldersFromCatalog();
        
        // CHECK TO SEE IF CATALOG HAS ANYTHING IN THERE.
        // IF THERE ARE NO DOCS OR FOLDERS, SHOW BODY MESSAGE FOR DECRYPTION
        // SINCE THE LEFT PANE WILL BE EMPTY FOR TOO LONG
        
        if (isEmpty(docs) || isEmpty(folders)) {
            showBodyProgress("starting", "decrypting files & folders...");
        } else {
            // if there's stuff in catalog, we'll instead use the left pane progress bar as we sync
            setTimeout(function () {
                hideBodyProgress();
                setTimeout(function () { if (isTouch) {  $("html, body").addClass("overflowBG");  }  }, 500);
            }, 500);
        }


    } catch (error) {}

    await getRecentDocsAndFolders();
    
}




// THIS RUNS AFTER USER TYPED THE KEY

async function startup() {

    startedUp = true;
    breadcrumb('[STARTED UP]');

    // GOT THE KEY. 

    // START WITH WHAT'S ALREADY IN THE CATALOG. 
    refreshDOM();

    activityHappened();

    if (startedOffline) { return; }
    
    // CONTINUE TO WAIT UNTIL WE GET RECENT DOCS IF WE'RE ONLINE

    if (gotRecents) {
        // DECRYPT CATALOG, UPDATE CATALOG.
        
        decryptCatalog().then(function() {
            hideBodyProgress();
            sync();
            setTimeout(function () { if (isTouch) {  $("html, body").addClass("overflowBG");  }  }, 500);
            checkAndWarnForExceededStorageIfNecessary();
        });

    } else {
        
        decryptCatalogWhenRecentsAreReady(); // this waits until we get recents, and triggers decrypt catalog.
    
    }
    
    activityHappened();
}


var inactivityInterval;
if (inactivityTimeoutInMinutes && !memorizedKey) {
    inactivityInterval = setInterval(inactiveTimer, 1000);
}





////////////////////////////////////////////////
////////////////////////////////////////////////
// 	 SLIDER CONTROLLER & INITIALIZATION
//   MENU CONTROLLERS & INITIALIZATION
//   SIDEBAR / SLIDER UI
////////////////////////////////////////////////
////////////////////////////////////////////////


function isPinned() { return $("body").hasClass("pinned"); }
function isViewingMode() { return $("body").hasClass("viewing-doc"); }
function isFocusMode() { return $("body").hasClass("focus-mode"); }

var rememberDocsWasPinned = false;

try {
    rememberDocsWasPinned = localStorage.getItem("docs-pinned");
} catch (e) {}


var sidebarOpen = false;
var swiper;

$(document).on("ready", function () {
    swiper = new Swiper('.docs-swiper-container', {
        mousewheel: {
            forceToAxis: true,
            invert: true,
            thresholdDelta : 30
        },
        slidesPerView: 'auto',
        spaceBetween: 0,
        initialSlide: 1, // 0 = left, 1 = editor
        simulateTouch : false,
        direction: "horizontal",
        slideActiveClass : "activeSlide",
        normalizeSlideIndex : false,
        watchSlidesProgress : true,
        // use css mode if it's a touch device, it's way smoother
        cssMode : isTouch
    });    

    swiper.on('slideChange', function(evt) { 
        if (evt.realIndex) {
            sidebarClosed();
        } else {
            sidebarOpened();
        }
    });


    //	init getting tips swipers
    initializeTips();

    if (isMobile) {
        $("body").addClass("bubble");
        
        setTimeout(function () {
            swiper.update();
            closeSidebarMenu();
        }, 500);
    }

    ////////////////////////////////////////////////
    ////////////////////////////////////////////////
    //	SIDEBAR PINNED
    ////////////////////////////////////////////////
    ////////////////////////////////////////////////

    if (rememberDocsWasPinned && location.pathname === "/docs") {
        openSidebarMenu();
        pinSidebar();
    } else {
        unPinSidebar();
        closeSidebarMenu();
    }

    ////////////////////////////////////////////////
    ////////////////////////////////////////////////
    //	CLEAN OLD ATTENTION GRABBERS
    ////////////////////////////////////////////////
    ////////////////////////////////////////////////

    cleanOldAttentionGrabbers();
});


/**
 * Opens / Closes Sidebar Menu if it's not pinned
 */
function toggleSidebarMenu() {
    if (sidebarOpen) {
        closeSidebarMenu();
    } else {
        openSidebarMenu();
    }
}


/**
 * Opens the Sidebar Menu if it's not pinned or in focus mode
 */
function openSidebarMenu() {
    if (!isPinned() && !isFocusMode() && !isViewingMode()) {
        swiper.slideTo(0);
    }
}

/**
 * Closes the Sidebar Menu if it's not pinned
 */
function closeSidebarMenu() {
    if (!isPinned()) {
        swiper.slideTo(1);
        hideRightClickDropdowns();
        hidePanels();
    }
}

/**
 * Fired when sidebar opens up
 */
function sidebarOpened() {
    
    // SIDEBAR OPENED – Don't  forget to account for pinned sidebar
    
    sidebarOpen = true;
    
    hideTableContextualButton();
    hidePanels();

    // on mobile / touch, if you blur when sidebar is opened, it'll hide the keyboard causing lag while swiping. so fire this only on desktop on mobile we're fine anyway. 
    if (!isTouch) { quill.blur(); }

    sidebarOpenedClosedRecalcPaperOverflow();
}

/**
 * Fired when the sidebar is closed, and editor is open.
 */
function sidebarClosed() {
    
    //  SIDEBAR CLOSED – Don't forget to account for pinned sidebar
    
    sidebarOpen = false;
    
    hideTableContextualButton();
    hideRightClickDropdowns();
    
    hidePanels();

    sidebarOpenedClosedRecalcPaperOverflow();
}

// DOCUMENTS ARE LOADED WHILE THE SIDEBAR IS OPEN. 
// THIS MEANS, THEIR SCREEN POSITION / SIZING ETC ARE ALL CALCULATED WHILE SIDEBAR IS OPEN. 
// ON MOBILE, THIS MEANS PAPER-MODE DOCS WILL BE TINY FOR EXAMPLE. 
// SO WE NEED TO RECALCULATE THE PAPER OVERFLOW AFTER SIDEBAR IS OPENED / CLOSED.

function sidebarOpenedClosedRecalcPaperOverflow() {
    if (isPaperMode()) { 
        setTimeout(function () {
            breadcrumb('[PAPER] Sidebar opened/closed, viewing area changed. Recalculating.');
            paperZoom("fit");
            setTimeout(function () { calculatePaperOverflow(); }, 100);
        }, 750);
    }
}

/**
 * Pins / Unpins sidebar, shrinks right slide, disables swiping nav, updates paper layout
 */
function toggleSidebarPin() {
    $("body").toggleClass("pinned");
    swiper.update();
    windowResizedRecalculatePaper();

    if (isPinned()) {
        try { localStorage.setItem("docs-pinned", true); } catch (e) {}
    } else {
        try { localStorage.removeItem("docs-pinned"); } catch (e) {}
    }
}

/**
 * Unpins sidebar, expands right slide, enables swiping nav, updates paper layout
 * Only to be used for restoring the pin-state
 */
function unPinSidebar() {
    $("body").removeClass("pinned");
    swiper.update();
    windowResizedRecalculatePaper();
    try { localStorage.removeItem("docs-pinned"); } catch (e) {}
}

/**
 * Pins sidebar, shrinks right slide, disables swiping nav, updates paper layout
 * Only to be used for restoring the pin-state
 */
function pinSidebar() {
    if ($(window).width() > 896) {
        $("body").addClass("pinned");
        swiper.update();
        windowResizedRecalculatePaper();
        try { localStorage.setItem("docs-pinned", true); } catch (e) {}
    } else {
        unPinSidebar();
    }
}

$(window).on('resize', function(event) {
    var width = $(window).width(); 

    if (isPaperMode() && width < 928) {
        // unpin if pinned, screen too small
        if (isPinned()) { 
            toggleSidebarPin(); 
            closeSidebarMenu();
        }
    }

    if (width < 896) {
        // unpin if pinned, screen too small
        if (isPinned()) { 
            toggleSidebarPin(); 
            closeSidebarMenu();
        }
    }

    if (isPaperMode()) { windowResizedRecalculatePaper(); }
}); 

////////////////////////////////////////////////
////////////////////////////////////////////////
//	LOADERS UI
////////////////////////////////////////////////
////////////////////////////////////////////////

$("body").on('click', '.folder[fid]', function(event) {
    if (!$(event.target).hasClass("ri-more-2-fill") && $(event.target).parents(".ri-more-2-fill").length <= 0) {
        var fid = $(this).attr("fid");
        clearSearchOnlyIfNecessary();
        loadFolder(fid);
    }
});

$("body").on('click', '.subfolder[fid]', function(event) {
    if (!$(event.target).hasClass("more") && $(event.target).parents(".more").length <= 0) {
        var fid = $(this).attr("fid");
        clearSearchOnlyIfNecessary();
        loadFolder(fid);
    }
});

$("#activeDocFolderButton").on('click', function(event) {
    var fid = $(this).attr("fid");
    clearSearchOnlyIfNecessary();
    loadFolder(fid);
    
    $("#leftListWrapper").attr("show", "folder");
    setTimeout(function () {
        openSidebarMenu();
        hideRightClickDropdowns();
        hidePanels();
    }, 10);
}); 

$("#loadParentOfDocButton").on('click', function(event) {
    var fid = $("#dropdown-doc").attr("parent");
    clearSearchOnlyIfNecessary();
    loadFolder(fid);
    
    $("#leftListWrapper").attr("show", "folder");
    setTimeout(function () {
        openSidebarMenu();
        hideRightClickDropdowns();
        hidePanels();
    }, 10);
}); 


$("body").on('click', '.goback', function(event) {
    loadParentFolder();
    hidePanels();
});

$("#activeFolder")[0].addEventListener('swiped-right', function(event) {
    loadParentFolder();
    hidePanels();
}); 




$("#foldersButton").on('click', function(event) {
    
    // if sidebar is open, pressing folders button will load root folder.
    // if sidebar is closed, if we have an active folder, we'll first show the active folder, 
    // then if user presses again, since sidebar is open, we load root folder
    if (sidebarOpen || !sidebarOpen && !activeFolderID) {
        loadRootFolder();
    }
     
    setTimeout(function () {
        openSidebarMenu();
        hideRightClickDropdowns();
        hidePanels();
    }, 10);
}); 


$("#recentsButton").on('click', function(event) {
    loadRecents();
    setTimeout(function () {
        openSidebarMenu();
        hideRightClickDropdowns();
        hidePanels();
    }, 10);
});

$("#folders")[0].addEventListener('swiped-right', function(event) {
    loadRecents();
    hideRightClickDropdowns();
    hidePanels();
}); 

$("#explorerButtons").on('click', function(event) {
    if ($(event.target).is("button") || $(event.target).parents("button").length > 0) { return; }
    if (sidebarOpen) { return; }
    openSidebarMenu();
}); 




////////////////////////////////////////////////
////////////////////////////////////////////////
//	SELECTIONS UI
////////////////////////////////////////////////
////////////////////////////////////////////////

var selections = [];
$("body").on('click', '.doc > .icon', function(event) {
    var docElem = $(this).parents(".doc");
    if (docElem.hasClass("decrypting")) { return; }

    var did = docElem.attr("did");

    var shifted = event.shiftKey;
    if (!shifted) {
        toggleDocSelection(did);
    } else {
        var where = docElem.parent();
        shiftToggledDocSelection(where, did);
    }

});











////////////////////////////////////////////////
////////////////////////////////////////////////
//	RIGHT CLICKS & DROPDOWNS UI
////////////////////////////////////////////////
////////////////////////////////////////////////


// DOCS RIGHT CLICKS & DROPDOWNS 
$("body").on('contextmenu', '.doc', function(event) {
    var did = $(this).attr("did");
    var isQuickRecent = $(this).parents("section").hasClass("quick-recent-docs") || false;

    if (selections.length > 0) {
        showSelectionsRightClickDropdown(event.y);
    } else {
        if (isQuickRecent) {
            showDocRightClickDropdown(did, event.y, event.x);
        } else {
            showDocRightClickDropdown(did, event.y);
        }
    }

    event.preventDefault();
}); 

$("body").on('click', '.doc > .more', function(event) {
    var did = $(this).parents(".doc").attr("did");

    if (selections.length > 0) {
        showSelectionsRightClickDropdown(event.y);
    } else {
        showDocRightClickDropdown(did, event.y);
    }

    event.preventDefault();
}); 

$("body").on('click', '#fileViewerOptionsButton', function(event) {
    var did = activeFileID;

    clearSelections();
    showDocRightClickDropdown(did, event.y, event.x);

    event.preventDefault();
}); 





// FOLDERS RIGHT CLICKS & DROPDOWNS

$("body").on('contextmenu', '.folder, .subfolder', function(event) {
    var fid = $(this).attr("fid");
    showFolderRightClickDropdown(fid, event.x, event.y);
    event.preventDefault();
}); 

$("body").on('click', '.folder > .ri-more-2-fill', function(event) {
    var fid = $(this).parents(".folder").attr("fid");
    showFolderRightClickDropdown(fid, event.x, event.y);
    event.preventDefault();
}); 

$("body").on('click', '.subfolder > .more', function(event) {
    var fid = $(this).parents(".subfolder").attr("fid");
    showFolderRightClickDropdown(fid, event.x, event.y);
    event.preventDefault();
}); 


// SELECTIONS RIGHT CLICKS & DROPDOWNS


$("#selectionsFloat").on('click contextmenu', function(event) {
    showSelectionsRightClickDropdown(event.y);
    event.preventDefault();
}); 



$("body").on('click', function(event) {
    
    // CLOSE RIGHT CLICKS & DROPDOWNS

    if (
        $(".dropdown").hasClass("show")                         &&     // if the dropdown is visible 
        $(event.target).parents("#file-viewer-nav").length <= 0 &&     // if the click isn't inside file-viewer nav
        $(event.target).parents(".actionFloater").length <= 0   &&     // if the click isn't inside dropdown
        $(event.target).parents(".dropdown").length <= 0        &&     // if the click isn't inside dropdown
        $(event.target).parents(".more").length <= 0            &&     // if the click isn't on the context icon
        !$(event.target).hasClass("more")                       &&     // if the click isn't on the context icon
        !$(event.target).hasClass("ri-more-2-fill")             &&     // if the click isn't on the context icon
        !$(event.target).hasClass(".actionFloater")                    // if the click isn't on the context icon
    ) {
        hideRightClickDropdowns();
        event.preventDefault();
    }

}); 

$(".dropdown").each(function () {
    this.addEventListener('swiped-left', function(event) {
        hideRightClickDropdowns();
        hidePanels();
    });
});



////////////////////////////////////////////////
////////////////////////////////////////////////
//	PANELS UI
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Show panel with ID (i.e. doc info panel), and hide all other panels
 * @param {string} panelID (i.e. "panel-docinfo")
 */
function togglePanel(panelID) {
    // toggle panel
    panelID = panelID || "";
    
    if ($("#" + panelID).hasClass("hidden")) {

        $("#" + panelID).removeClass("hidden");

        setTimeout(function () {
            
            $("#" + panelID).addClass("show");
            
            // make panel button active
            $("#panel-button-" + panelID.replace("panel-","")).addClass("active");
             
        }, 10);

    } else {
        
        $("#" + panelID).removeClass("show");
            
        // make panel button active
        $("#panel-button-" + panelID.replace("panel-","")).removeClass("active");

        var animationDuration = parseFloat($("#" + panelID).css("transition-duration")) * 1000;
        setTimeout(function () { $("#" + panelID).addClass("hidden"); }, (animationDuration + 10));

    }

    
    // hide all panels but this one
    hidePanels(panelID);
    hideTips();

}


/**
 * Hides all panels
 * @param {string} exceptID (i.e. "panel-docinfo")
 */
function hidePanels(exceptID) {

    exceptID = exceptID || "";

    // except persistent panels
    var panelsToHide = $(".panel").not(".persistent");

    // except table dropdown
    panelsToHide = panelsToHide.not("#table-dropdown");

    if (exceptID) {
        
        // custom exceptions + except persistent stuff
        panelsToHide = panelsToHide.not("#" + exceptID);
        $("button[id^='panel-button']").not("#panel-button-" + exceptID.replace("panel-","")).removeClass("active");

    } else {
        
        $("button[id^='panel-button']").removeClass("active");

        resetPDFExporter();
        $("#panel-copy-doc").attr("did", "");

    }

    panelsToHide.removeClass("show");
 
    // animation is 300ms, you can hide it afterwards 
    setTimeout(function () { panelsToHide.addClass("hidden"); }, 310);

}



$("#rightSlide").on('click', function(event) {
    // if there's no docs, and right slide is active
    if ($("#rightSlide").hasClass("activeSlide") && $("body").hasClass("no-doc")) {
        hideRightClickDropdowns();
        hidePanels();
    }
}); 


////////////////////////////////////////////////
////////////////////////////////////////////////
//	FONTS PANEL
////////////////////////////////////////////////
////////////////////////////////////////////////


var fontsPanelTimeout;
/**
 * Prepares and toggles the fonts panel (i.e. gets the font button location, active font etc)
 */
function toggleFontsPanel() {
    
    var defaultFontSize = "16px";

    // STEP 1) GET THE FONT BUTTON POSITION
    var left = $(".cryptee-fonts-button").offset().left;
    var top  = $(".cryptee-fonts-button").offset().top;
    $("#panel-fonts")[0].style.setProperty("--left-pos", left + "px");
    $("#panel-fonts")[0].style.setProperty("--top-pos", (top + 32) + "px");

    // STEP 2) GET THE CURRENTLY SELECTED FONT ( with a fallback to document's font )
    var font = (quillSafelyGetFormat() || {}).font || $(".ql-editor").attr("font");

    // STEP 3) SET THE FONT IN THE PANEL
    $(".fonts-list").find(".font").removeAttr("selected");
    $(".fonts-list").find(".font").removeAttr("default");
    $(".fonts-list").find(`.font[font='${font}']`).attr("selected", true);
    $(".fonts-list").find(`.font[font='${defaultFont}']`).attr("default", true);

    // STEP 4) GET THE SELECTED FONT SIZE & PARAGRAPH (HEADER) STYLE
    var header = (quillSafelyGetFormat() || {}).header || "p";
    var size   = (quillSafelyGetFormat() || {}).size || defaultFontSize; // default is 16px
    
    // STEP 5) SET THE SIZE & PARAGRAPH STYLE IN THE PANEL
    $("#font-sizes-wrapper").find("button").removeAttr("selected");
    $("#font-sizes-wrapper").find(`button[size='${size}']`).attr("selected", true);
    $("#font-sizes-wrapper").find(`button[value='${header}']`).attr("selected", true);
    
    // STEP 6) FOR BUBBLE/MOBILE, BLUR EDITOR SO TEXT SELECTION IS REMOVED WHEN POPUP IS DISPLAYED
    
    if (isMobile) { 
        quill.blur(); 
        // you need a 500ms timeout because blurring quill closes all panels
        clearTimeout(fontsPanelTimeout);
        fontsPanelTimeout = setTimeout(function () {
            togglePanel("panel-fonts");
        }, 500);
    } else {
        togglePanel("panel-fonts");
    }

}

$("#font-sizes-wrapper").on('click', "button", function(event) {
    var size = $(this).attr("size");
    var header = $(this).attr("value");

    $(this).removeAttr("selected");
    $(this).siblings().removeAttr("selected");
    $(this).attr("selected", true);

    if (size) { quillSafelyFormat("size", size); }
    
    if (header) { 
        if (header !== "p") {
            quillSafelyFormatLine("header", header);
            quillSafelyFormat("size", false);
        } else {
            quillSafelyFormatLine("header", false);
        }
    }
    
}); 

$("#font-families-wrapper").on('click', ".font", function(event) {
    var font = $(this).attr("font");

    $(".fonts-list").find(".font").removeAttr("selected");
    $(this).attr("selected", true);

    quillSafelyFormat("font", font);
    
}); 

$("#font-families-wrapper").on('click', ".font > button", function(event) {
    var font = $(this).parents(".font").attr("font");
    setDeviceDefaultFont(font);
}); 

function setDeviceDefaultFont(font) {
    
    font = font || "josefin-sans";
    
    try {
    
        localStorage.setItem("defaultFont", font);
        
        defaultFont = font;

        $(".fonts-list").find(".font").removeAttr("default");
        $(".fonts-list").find(`.font[font='${font}']`).attr("default", true);
        $(".ql-editor").attr("font", font);        
        
        breadcrumb('[DEFAULT FONT] Successfully set device default font.');
        
        createPopup("successfully changed the default font. cryptee will remember your default font choice on this device from now on. your current document and all newly created documents will now use this default font.");

    } catch (e) {
        console.error(e);
    }
}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	SPELL CHECKER
////////////////////////////////////////////////
////////////////////////////////////////////////

$("#spellCheckerButton").on('click', function(event) {
    
    var on = $(this).hasClass("on");

    if (on) {
        quill.root.spellcheck = false;
        $("#spellCheckerButton").removeClass("on");
    } else {
        quill.root.spellcheck = true;
        $("#spellCheckerButton").addClass("on");
    }

}); 



////////////////////////////////////////////////
////////////////////////////////////////////////
//	EDIT LOCK
////////////////////////////////////////////////
////////////////////////////////////////////////

$("#lockEditsButton").on('click', function(event) {
    var on = $(this).hasClass("on");

    if (on) {
        // unlock edits
        unlockEditor();
        toggleDocumentEditLock(activeDocID, false);
    } else {
        // lock edits
        lockEditor();
        toggleDocumentEditLock(activeDocID, true);
    }
}); 


$("#desktopToolbar").on('click', function(event) {
    var locked = $("body").hasClass("locked-doc");
    // on mobile the desktop toolbar has all document action buttons, 
    // and it causes all buttons to unclock the editor. 
    if (locked && !isMobile) {
        unlockEditor();
        toggleDocumentEditLock(activeDocID, false);
        event.preventDefault();
    }
}); 



////////////////////////////////////////////////
////////////////////////////////////////////////
//	VIEWING MODE
////////////////////////////////////////////////
////////////////////////////////////////////////


$("#viewingModeButton").on('click', function(event) {
    
    var on = $(this).hasClass("on");

    if (on) {
        disableViewingMode();
    } else {
        enableViewingMode();
    }

}); 


////////////////////////////////////////////////
////////////////////////////////////////////////
//	FOCUS MODE
////////////////////////////////////////////////
////////////////////////////////////////////////

$("#focusModeButton").on('click', function(event) {
    
    var on = $(this).hasClass("on");

    if (on) {
        disableFocusMode();
    } else {
        enableFocusMode();
    }

}); 



////////////////////////////////////////////////
////////////////////////////////////////////////
//	ATTACHMENTS
////////////////////////////////////////////////
////////////////////////////////////////////////

function showInlineAttachmentPopup() {
    createPopup("to attach / link a file, document or folder inline, first find the file or folder you'd like to attach to this document using the menu on the left, either from its parent folder, or via search. then, right click on it <br>(or press <i class='ri-more-2-fill'></i>)<br> and press '<b>attach inline</b>'", "info", "how-to-attach-info");
}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	EMBEDS
////////////////////////////////////////////////
////////////////////////////////////////////////

$("#hyperlink-input").on('keyup', function(event) {
    if (event.key === "Escape") {
        $("#hyperlink-input").trigger("blur");
        $("#hyperlink-input").val("");
        hidePanels();
    }

    if (event.key === "Enter") {
        confirmEmbed("link");
    }
}); 


////////////////////////////////////////////////
////////////////////////////////////////////////
//	TABLE OF CONTENTS
////////////////////////////////////////////////
////////////////////////////////////////////////

    
$("#tableofcontents").on('click', '.doctoc', function () {
    var targetIndex = $(this).attr("index");
    var targetHeading = tocArray[targetIndex];
    var targetOffset = targetHeading[0].offsetTop;
    $(targetHeading[0]).addClass("highlighted");
    
    setTimeout(function () {
        $(targetHeading[0]).removeClass("highlighted");
    }, 2000);

    $('.ql-editor')[0].scrollTo({
        top: targetOffset - 75,
        left: 0,
        behavior: 'smooth'
    });
});



////////////////////////////////////////////////
////////////////////////////////////////////////
//	show offline popup
////////////////////////////////////////////////
////////////////////////////////////////////////

function showOfflineInfoPopup() {
    createPopup("while offline, you can create & edit new documents, and open offline-documents, however features that require internet will be disabled. your documents will be sync'ed once cryptee's re-connected to the internet. <span class='yellow'>please note that, for your safety, your changes will sync only while cryptee docs is open & connected to the internet.</span>", "dark");
}

function showDocNotAvailableOfflinePopup() {
    createPopup("looks like you're offline, and this file isn't available offline. while offline, you can create & edit new documents, and open documents that are available offline.<br> <span class='yellow'>in the future, if you'd like to access your documents while offline, right click on your document (or press <i class='ri-more-2-fill'></i>) then click: <br><br> <i>make available offline</i></span>", "dark");
}

////////////////////////////////////////////////
////////////////////////////////////////////////
//	DOWNLOADS
////////////////////////////////////////////////
////////////////////////////////////////////////


/**
 * SHOWS BULK DOWNLOAD POPUP
 */
function showDownloadPopup() {
    if (selections.length < 1) { return; }
    if ((isios || isipados) && selections.length > 1) { return; }
    $("#popup-download").find(".status").html("DOWNLOAD FILES");
    showPopup("popup-download");
    hideRightClickDropdowns();
    hidePanels();
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	INBOX
////////////////////////////////////////////////
////////////////////////////////////////////////

function showInboxPopup() {
    createPopup(
        `<b>Inbox</b> is a special type of folder, where all documents without folders go to. 
        When you quickly create new documents, they'll be created in inbox. 
        You can of course move these docs to other folders later if you wish.
        <i>You cannot rename, move, archive or ghost the inbox folder.</i>
        You can delete it like any other folder, but it will be re-created when necessary, if a new doc needs a home to live.`, "info");
}



////////////////////////////////////////////////
////////////////////////////////////////////////
// NEW DOC & FOLDER RECOS	
////////////////////////////////////////////////
////////////////////////////////////////////////

function docNameTimeRecommendations() {
    var todaysDate = new Date();
    var todayLocale = todaysDate.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    var timeRightNow = todaysDate.toLocaleTimeString(undefined, {hour: '2-digit', minute:'2-digit'});

    return `<time class="docreco">${todayLocale}</time><time class="docreco">${timeRightNow}</time>`;
}

function docNameRecoUp() {
    var selIndex = $(".docreco.selected").index() - 1;
    $(".docreco").removeClass("selected");
    if (selIndex >= 0) {
        $(".docreco").eq(selIndex).addClass("selected");
    }
}

function docNameRecoDown() {
    var selIndex = $(".docreco.selected").index() + 1;
    $(".docreco").removeClass("selected");
    $(".docreco").eq(selIndex).addClass("selected");
}

function useSelectedReco(input) {
    var reco = $(".docreco.selected").text();
    $(".docreco").removeClass("selected");
    $(input).val(reco);
}

////////////////////////////////////////////////
////////////////////////////////////////////////
//	NEW DOC & COPY DOC
////////////////////////////////////////////////
////////////////////////////////////////////////

async function showNewDocPanel() {
    $("#new-doc-input").val("");
    $("#new-doc-recos").html(docNameTimeRecommendations());
    var targetFID = activeFolderID || "f-uncat";
    var targetFolderName = await getFolderNameFromCatalog(targetFID);
    $("#new-doc-target-folder").text(targetFolderName);
    togglePanel('panel-new-doc');
    $("#new-doc-input").trigger("focus");
}

$("#new-doc-input, #copy-doc-input").on('keyup', function(event) {
    if (event.key === "Enter") {
        if ($(".docreco.selected").index() >= 0) {
            useSelectedReco(this);
        } else {
            if ($(this).attr("id") === "new-doc-input") {
                confirmNewDoc();
            } else {
                confirmCopyDoc();
            }
        }
    }

    if (event.key === "Escape") {
        hidePanels();
        $(this).val("");
    }

    if (event.key === "ArrowDown") {
        docNameRecoDown();
    }

    if (event.key === "ArrowUp") {
        docNameRecoUp();
    }
}); 

$("#new-doc-recos, #copy-doc-recos").on('click', "time", function(event) {
    var recommendation = $(this).text();
    var input = $(this).parent().prev();
    input.val(recommendation);
});

$("#panel-new-doc")[0].addEventListener('swiped-down', function() { hidePanels(); }); 
$("#panel-copy-doc")[0].addEventListener('swiped-down', function() { hidePanels(); }); 

////////////////////////////////////////////////
////////////////////////////////////////////////
//	COPY DOC
////////////////////////////////////////////////
////////////////////////////////////////////////



////////////////////////////////////////////////
////////////////////////////////////////////////
//	NEW FOLDER
////////////////////////////////////////////////
////////////////////////////////////////////////

function showNewFolderPanel() {
    $("#new-folder-input").val("");
    togglePanel('panel-new-folder');
    $("#new-folder-input").trigger("focus");
}

$("#new-folder-input").on('keyup', function(event) {
    if (event.key === "Enter") {
        confirmNewFolder();
    }

    if (event.key === "Escape") {
        hidePanels();
        $("#new-folder-input").val("");
    }
}); 

$("#panel-new-folder")[0].addEventListener('swiped-down', function() {  hidePanels(); }); 

////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////
//	
//
//  SEARCH
//
//
////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////


$("#searchInput").on('keyup', function(event) {

    activityHappened();

    setTimeout(function () {
        
        var searchTerm = $("#searchInput").val().trim();

        if (event.key === "Escape" || searchTerm === "") {
            
            event.preventDefault();
            stopLeftProgress();
            clearSearch(event.key === "Escape"); // if it's escape, we'll blur the search

        } else if ( event.key === "Enter" && event.shiftKey && searchHighlightIndex >= 0 && activeDocID ){

            // user pressed shift + enter 
            // attach / link document highlighted in search, then close search
            
            var didToAttach = $("#results > .highlight").not(".active, .loading, .decrypting").attr("did");
            
            if (didToAttach) {
                // if highlighted item is a doc, attach / link it
                attachSelectedFileInline(didToAttach).then(()=>{
                    stopLeftProgress();
                    clearSearch(event.key === "Escape");
                    closeSidebarMenu();
                });
            } else {
                // if hihglighted item is a folder, then just load it
                loadHighlightedResult();
            }
            
        } else if (event.key === "Enter") {
            
            event.preventDefault();
            loadHighlightedResult();
            
        } else if (event.key === "Meta" || event.key === "Shift") {
            event.preventDefault();
        } else if (event.key === "Alt" || event.key === "Control") {
            event.preventDefault();
        } else if (event.key === "CapsLock" || event.key === "Tab") {
            event.preventDefault();
        } else if (event.metaKey || event.ctrlKey || event.shiftKey) {
            event.preventDefault();
        } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            event.preventDefault();
        } else if (event.key === "ArrowUp") {

            event.preventDefault();
            highlightPreviousSearchResult();

        } else if (event.key === "ArrowDown") {
            
            event.preventDefault();
            highlightNextSearchResult();

        } else {
            
            if (searchTerm.length < 2) { return; } 

            startLeftProgress();

            clearTimeout(searchTimer);
            clearTimeout(searchKeydownTimer);
            clearTimeout(clearSearchTimeout);
            searchKeydownTimer = setTimeout(function () { 
                search(searchTerm); 
            }, 700);
        }

    }, 50);
}); 

////////////////////////////////////////////////
////////////////////////////////////////////////
//	GETTING STARTED
////////////////////////////////////////////////
////////////////////////////////////////////////

$("#blankEditor").on("click", "details", function(event) {
    $("#blankEditor").find("details").not(this).removeAttr("open");
});

// DON'T USE THIS. 
// IT BREAKS DROPDOWNS / PANELS LIKE ADD TABLE ETC 
// $("#editorWrapper").on('click', function(event) {
//     hideRightClickDropdowns();
//     hidePanels();
// });

$("#blankEditor").on("click", function(event) {
    hidePanels();
});

$("#leftListWrapper").on("click", function(event) {
    hidePanels();
});



////////////////////////////////////////////////
////////////////////////////////////////////////
//	ATTENTION GRABBERS
////////////////////////////////////////////////
////////////////////////////////////////////////


/**
 * Grabs users attention to a button with given ID. Importantly, it only does it once by saving it to localstorage
 * @param {String} buttonID (i.e. "panel-button-pagesetup")
 */
 function grabAttentionTo(buttonID) {
     
    try {
        var alreadyPaidAttention = localStorage.getItem("attention-" + buttonID);
        if (!alreadyPaidAttention) {
            $("#" + buttonID).addClass("grab-attention");
        }
    } catch (e) {}

}


/**
 * Disables attention grabber after user paid attention to a button by clicking on it etc. 
 * It's automatic, we do this by listening to all attention grabber buttons from window
 * @param {String} buttonID (i.e. "panel-button-pagesetup")
 */
function paidAttentionTo(buttonID) {
    try { localStorage.setItem("attention-" + buttonID, "1"); } catch (e) {}
    $("#" + buttonID).removeClass("grab-attention");
}


function cleanOldAttentionGrabbers() {
    $(".grab-attention").each(function(){
        var id = $(this).attr("id");

        try {
            var alreadyPaidAttention = localStorage.getItem("attention-" + id);
            if (alreadyPaidAttention) {
                $("#" + id).removeClass("grab-attention");
            }
        } catch (e) {}
        
    });
}


$(window).on('click', ".grab-attention" ,function(event) {
    paidAttentionTo($(this).attr("id"));
});


/**
 * Goes through an array of button ids, and sets up attention grabbers, only on desktop!
 * @param {Array} buttons 
 */
function setupAttentionGrabbers(buttons) {
    buttons = buttons || [];

    if (isMobile) { return; }
    buttons.forEach(buttonID => { grabAttentionTo(buttonID); });
}

// This will set up all attention grabbers. 
// If user already paid attention they will be removed in document ready 
setupAttentionGrabbers([ "panel-button-pagesetup" ]);