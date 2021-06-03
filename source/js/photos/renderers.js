
////////////////////////////////////////////////
////////////////////////////////////////////////
//	RENDERERS
////////////////////////////////////////////////
////////////////////////////////////////////////


/**
 * Renders an album with given ID, and returns its HTML
 * @param {string} aid Album ID
 * @param {number} [photos] Number of Photos
 * @returns {string} albumHTML Album's HTML
 */
function renderAlbum(aid, photos) {
    var album = albums[aid];
    photos = photos || "";

    if (!album) { 
        handleError("[RENDER ALBUM] Album doesn't exist in catalog.", { "aid" : aid });
        return ""; 
    }

    var name            = album.decryptedTitle || "Untitled Album"; // "ALBUM NAME"
    name = escapeHTML(name);

    var exifDate        = album.date  || "0000:00:00";              // "2019:07:03"
    var sortableDate    = sortableExifDate(exifDate);
    var prettyDate      = fancyDate(exifDate);                      // "NOV '20"
    var avgColor        = album.pinky || "54,54,54";                // "17,24,33"
    var thumbToken      = album.ttoken || "";
    var thumbID         = album.thumb || "";                        // "t-12345"

    if (useHighResThumbnails && album.ltoken) {
        thumbID         = convertID(thumbID, "l") || "";            // "l-12345"
        thumbToken      = album.ltoken || "";
    }

    return `
    <div class="content album" id="${aid}" name="${name}" date="${prettyDate}" datesort="${sortableDate}" exifDate="${exifDate}" photos="${photos}" thumb="${thumbID}" thumbToken="${thumbToken}"  style="--bg:rgb(${avgColor})">
        <i></i>
        <img src="" alt thumb="${thumbID}">
    </div>`;
    
}


/**
 * Renders an album header with given ID, and returns its HTML
 * @param {string} aid Album ID
 * @returns {string} albumHeaderHTML Album's Header's HTML
 */
function renderAlbumHeader(aid) {
    var album = {};
    
    if (aid !== "favorites") {
        album = albums[aid];
        
        if (!album) { 
            handleError("[RENDER ALBUM HEADER] Album doesn't exist in catalog.", { "aid" : aid });
            return ""; 
        }
    } else {
        if (detectedLocale === "GB") {
            album.decryptedTitle = "Favourites";
        } else {
            album.decryptedTitle = "Favorites";
        }
        album.date = "0000:00:00";
    }

    var name            = album.decryptedTitle || "Untitled Album"; // "ALBUM NAME"
    name = escapeHTML(name);

    var exifDate        = album.date  || "0000:00:00";              // "2019:07:03"
    var prettyDate      = fancyDate(exifDate);                      // "NOV '20"
    var avgColor        = album.pinky || "54,54,54";                // rgb

    return `
    <div id="albumheader" style="--bg:rgb(${avgColor})">
        <h2 class="name">${name}</h2>
        <h3 class="date" exif="${exifDate}">${prettyDate}</h3>
    </div>`;
}

/**
 * Refreshes album & its header in DOM with changes (i.e. name / date / thumbnail changes etc) 
 * @param {string} aid Album ID
 */
function refreshAlbumInDOM(aid) {
    if (!aid) { return; }
    
    var albumID = aid;

    if ($(`.album[id="${albumID}"]`).length > 0) {
        $(`.album[id="${albumID}"]`).replaceWith(renderAlbum(albumID));
        
        setTimeout(function () { 
            $(`.album[id="${albumID}"]`).each(function(){
                setupIntersectionObserver($(this)[0]); 
            });
        }, 50);
    }

    if (albumID === activeAlbumID) {
        $("#albumheader").replaceWith(renderAlbumHeader(albumID));
    }

}



/**
 * Renders a photo with given ID, and returns its HTML
 * @param {string} pid Photo ID
 * @returns {string} photoHTML Photo's HTML
 */
function renderPhoto(pid, forSearch) {
    var photo = photos[pid] || favorites[pid];
    forSearch = forSearch || false;

    if (!photo) {
        handleError("[RENDER PHOTO] Photo doesn't exist in album's catalog.", { "pid" : pid });
        return ""; 
    }

    var name         = photo.decryptedTitle || "Untitled.jpg";                              // A Photo Name
    name = escapeHTML(name);

    var exifDate     = photo.date    || "0000:00:00";                                       // "2020:09:27" etc.
    // var exifDay      = photo.day     || dayFromEXIF(exifDate)   || "00";                    // "27"
    // var exifMonth    = photo.month   || monthFromEXIF(exifDate) || "00";                    // "09"
    // var exifYear     = photo.year    || yearFromEXIF(exifDate)  || "0000";                  // "2020"
    // var exifTime     = photo.time    || timeFromEXIF(exifDate)  || "00:00:00";              // "15:33:04"
    var sortableDate = sortableExifDate(exifDate);

    var avgColor     = photo.pinky   || "54,54,54";                                         // "17,24,33"

    var thumbToken   = photo.ttoken  || "";
    var thumbID      = convertID(pid, "t") || "";                                           // "t-12345"
    
    var selectionIcon = "<i></i>";
    if (activeAlbumID === "favorites" || forSearch) { selectionIcon = ""; }

    return `
    <div class="content photo" id="${pid}" name="${name}" datesort="${sortableDate}" exifDate="${exifDate}" thumb="${thumbID}" thumbToken="${thumbToken}" style="--bg:rgb(${avgColor})">
        ${selectionIcon}
        <img src="" alt thumb="${thumbID}">
    </div>`;
}



/**
 * Renders an upload with given id, name and status
 * @param {string} id upload id
 * @param {string} name filename
 * @param {string} status upload status (i.e. encrypting or something with percentage)
 */
function renderUpload(id, name, status) {
    name = name || "";
    name = escapeHTML(name);
    return `
    <p class="upload" id="upload-${id}" status="${status}">
        <span class="name">${name}</span><br>
        <span class="status">${status}</span>
    </p>`;
}


/**
 * Renders a search header with given title and optional subtitle, and returns its HTML
 * @param {string} title Search Title
 * @param {string} subtitle Search SubTitle
 * @returns {string} searchHeaderHTML Search Header's HTML
 */
function renderSearchHeader(title) {
    title = title || "";
    title = escapeHTML(title);
    return `
    <div class="searchheader" style="--bg:rgb(0,0,0)">
        <h3 class="title">${title}</h3>
    </div>`;
}