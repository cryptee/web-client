
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
 * @param {string} id Photo ID
 * @returns {string} photoHTML Photo's HTML
 */
function renderMedia(id, forSearch) {
    var photo = photos[id] || favorites[id];
    forSearch = forSearch || false;

    if (!photo) {
        handleError("[RENDER PHOTO] Media doesn't exist in album's catalog.", { "id" : id });
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
    var thumbID      = convertID(id, "t") || "";                                           // "t-12345"
    
    var selectionIcon = "<i></i>";
    if (activeAlbumID === "favorites" || forSearch) { selectionIcon = ""; }

    var type = "photo";
    if (id.startsWith("v-")) { type = "video"; }
    if (id.startsWith("r-")) { type = "raw";   }

    return `
    <div class="content media ${type}" id="${id}" name="${name}" datesort="${sortableDate}" exifDate="${exifDate}" thumb="${thumbID}" thumbToken="${thumbToken}" style="--bg:rgb(${avgColor})">
        ${selectionIcon}
        <img src="" alt thumb="${thumbID}">
    </div>`;
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


/**
 * Renders a photo/video for lightbox with given ID and returns its HTML
 * @param {String} id 
 */
function renderLightboxMedia(id) {
    var media; 
    if (id.startsWith("p-")) {
        media = `<div class='swiper-zoom-container' pid='${id}'><img class="lbox-photo" pid='${id}' draggable='false' src=""/></div>`;
    } else {
        media = `<div class="swiper-video-container" pid='${id}'>
                    <video width="1920" height="1080" pid='${id}' class="lbox-video" poster="" autoplay>
                        <source src="" type="video/mp4" pid='${id}'>
                    </video>
                </div>`;
    }
    return media;
}