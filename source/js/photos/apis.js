
////////////////////////////////////////////////
////////////////////////////////////////////////
//	GETTERS
////////////////////////////////////////////////
////////////////////////////////////////////////

// HERE WE'LL DOWNLOAD THINGS

/**
 * Downloads user's albums root.
 */
async function getAlbums() {
    breadcrumb("[ALBUMS] Getting albums");
    var startedRequest = (new Date()).getTime();
    
    var albumsResponse;
    try {
        albumsResponse = await api("photos-albums");
    } catch (error) {
        err("Couldn't get albums due to error", error);
        return false;
    }

    if (!albumsResponse) {  
        err("Didn't get albums response");
        return false;
    }

    for (var aid in albumsResponse.data) {
        var album = albumsResponse.data[aid];
        Object.keys(album).forEach(albumKey => {
            albums[aid] = albums[aid] || {};
            albums[aid][albumKey] = album[albumKey];
        });
    }

    var gotResponse = (new Date()).getTime();
    
    breadcrumb("[ALBUMS] Got albums in " + (gotResponse - startedRequest) + "ms");
    
    // if we haven't started up, that means we don't have the key, so don't decrypt album titles yet. 

    if (!startedUp) { return true; }

    var startedDecrypting = (new Date()).getTime();
    breadcrumb("[ALBUMS] Decrypting home titles");

    // decrypt the albums' titles, and add them to the albums object
    await decryptAlbumTitles("home");

    var doneDecrypting = (new Date()).getTime();
    breadcrumb("[ALBUMS] Decrypted home titles in " + (doneDecrypting - startedDecrypting) + "ms");

    return true;

    function err(msg, error) {
        handleError(msg, error);
    }
}


/**
 * Downloads an album with given ID (its photos & their titles) and sets it all to albums{aid}, albums{aid}.photos and photos{pid}
 * @param {string} aid Album ID to download
 */
async function getAlbumPhotos(aid) {
    if (!aid) {
        handleError("[ALBUM PHOTOS] Can't get album photos. No AlbumID!");
        return false;
    }

    gettingAlbumPhotos = true; // for startup

    breadcrumb("[ALBUM PHOTOS] Getting album photos " + aid);
    
    var startedRequest = (new Date()).getTime();
    
    var albumResponse;

    try {
        if (aid === "favorites") {
            albumResponse = await api("photos-favorites");
        } else {
            albumResponse = await api("photos-album", {a:aid});
        }
    } catch (error) {
        err("Couldn't get album photos due to error", error);
        return false;
    }

    if (!albumResponse) {  
        err("Didn't get album photos response");
        return false;
    }

    if (!albumResponse.data) {  
        err("Album photos response doesn't have any data");
        return false;
    }

    if (aid === "favorites") {
        favorites = albumResponse.data || {};
    } else { 
        albums[aid] = albums[aid] || {};
        albums[aid].titles = albumResponse.data.titles || ""; 
        
        var albumPhotos = albumResponse.data.photos || {};
        albums[aid].photos = Object.keys(albumPhotos);
        
        for (var pid in albumPhotos) {
            var photo = albumPhotos[pid];

            photos[pid] = photos[pid] || {};

            Object.keys(photo).forEach(photoKey => {
                photos[pid][photoKey] = photo[photoKey];
            });

            photos[pid].aid = aid;
        }
    }
    
    var gotResponse = (new Date()).getTime();

    breadcrumb("[ALBUM PHOTOS] Got album photos in " + (gotResponse - startedRequest) + "ms");
    
    gettingAlbumPhotos = false; // for startup

    return true;

    function err(msg, error) {
        handleError(msg, error);
    }
}


/**
 * This downloads a thumbnail / lightbox sized image with given ref ID and token, and replaces the correct image element in dom
 * @param {string} thumbImgID TID or LID of an image.
 * @param {string} thumbToken the download token of the image.
 */
async function getThumbnail (thumbImgID, thumbToken, wrapperElem, imgElem) {
 
    imgElem = $(imgElem) || $(`img[thumb="${thumbImgID}"]`);
    wrapperElem = $(wrapperElem) || imgElem.parent();

    if (!thumbImgID) {
        if (wrapperElem.hasClass("album")) { 
            return true; 
        } else {
            handleError("[GET THUMBNAIL] Can't get thumbnail. No imgID.");
            return false;
        }
    }
    
    thumbToken = thumbToken || "";
    if (!thumbToken) {
        breadcrumb("[GET THUMBNAIL] No token provided. Will request one.");
    }

    if (!wrapperElem.hasClass("onscreen")) { return false; }

    wrapperElem.addClass("loading");

    // DOWNLOAD ENCRYPTED THUMBNAIL

    var encryptedThumbnail;

    try {
        encryptedThumbnail = await downloadFile(thumbImgID, thumbToken);
    } catch (error) {
        error.imgID = thumbImgID;
        error.token = thumbToken;
        handleError("[GET THUMBNAIL] Couldn't download thumbnail.", error);
        // wrapperElem.remove();
        // TODO – FIX IMAGE / ALBUM ETC IF IT'S NOT LOADED –
        return false;
    }

    if (!encryptedThumbnail) {
        handleError("[GET THUMBNAIL] Couldn't download thumbnail.", { imgID : thumbImgID, token : thumbToken });
        // wrapperElem.remove();
        // TODO – FIX IMAGE / ALBUM ETC IF IT'S NOT LOADED –
        return false;
    }

    if (encryptedThumbnail === "aborted") { return false; }
    if (!wrapperElem.hasClass("onscreen")) { return false; }

    // DECRYPT ENCRYPTED THUMBNAIL

    var decryptedThumbnail;
    try {
        decryptedThumbnail = await decrypt(encryptedThumbnail, [theKey]);
    } catch (error) {
        error.imgID = thumbImgID;
        error.token = thumbToken;
        handleError("[GET THUMBNAIL] Couldn't decrypt thumbnail", error);
        // wrapperElem.remove();
        // TODO – FIX IMAGE / ALBUM ETC IF IT'S NOT LOADED –
        return false;
    }

    // now we have the B64 in this
    // decryptedThumbnail.data;

    var img = new Image();
    img.src = decryptedThumbnail.data;
    img.setAttribute("draggable", false);
    img.setAttribute("thumb", thumbImgID);

    try {
        await img.decode();
    } catch (error) {
        error.imgID = thumbImgID;
        error.token = thumbToken;
        handleError("[GET THUMBNAIL] Couldn't decode thumbnail", error);
    }

    imgElem.replaceWith(img);
    
    setTimeout(function () {
        wrapperElem.removeClass("loading");
        img = null;
    }, 50);

}

/**
 * Downloads, decrypts and returns a decrypted Base64 or blob photo
 * @param {string} photoID The ID of the photo. could be pid, tid, lid etc 
 * @param {('p'|'t'|'l'|'v'|'r')} size The siize of the photo 
 * @returns {*} img if the image is V1 or V2 upload, this is b66. If it's a v3 upload, thumb & lightbox sizes are b64, and original is a blob
 */
async function getPhoto(photoID, size) {
    size = size || "l";
    
    if (!photoID) {
        handleError("[GET PHOTO] Can't get photo. No photoID");
        return false;
    }
    
    var id = convertID(photoID, size);
    var pid = convertID(photoID, "p");
    
    // technically we only need this for the token, and we can still download the photo without a token, by requesting a new token. 
    // it'll be slow, but it'd work. on the server side if we catch a moment like this, we'll generate fresh new tokens for these photos
    // so it's technically a one-time speed issue. 

    var localPhoto = photos[pid] || favorites[pid] || {}; 

    var token;
    if (size === "p") { token = localPhoto.otoken || ""; }
    if (size === "l") { token = localPhoto.ltoken || ""; }
    if (size === "t") { token = localPhoto.ttoken || ""; }

    var encryptedPhoto;

    try {
        encryptedPhoto = await downloadFile(id, token);
    } catch (error) {
        error.photoID = photoID;
        error.pid = pid;
        error.size = size;
        handleError("[GET PHOTO] Couldn't download photo", error);
        return false;
    }

    if (!encryptedPhoto) {
        handleError("[GET PHOTO] Couldn't download photo", { pid : pid });
        return false;
    }

    if (encryptedPhoto === "aborted") { return false; }

    var decryptedPhoto;
    
    try {
        if (size === "p" && pid.endsWith("-v3")) {
            // it's an original sized v3 upload which is binary
            decryptedPhoto = await decryptToBinary(encryptedPhoto, [theKey]);
        } else {
            // it's a V1 & v2 upload, OR V3 thumb or lightbox, which are b64  
            decryptedPhoto = await decrypt(encryptedPhoto, [theKey]);
        }
    } catch (error) {
        error.photoID = photoID;
        error.pid = pid;
        error.size = size;
        handleError("[GET PHOTO] Couldn't decrypt photo", error);
        return false;
    }

    if (size === "p" && pid.endsWith("-v3")) {
        // it's an original sized v3 upload, we have the Uint8Array image in :
        // decryptedPhoto.data

        // get its true mimetype
        var type = getImageMimetypeFromUint8Array(decryptedPhoto.data);        
        return new Blob([decryptedPhoto.data], {type: type});

    } else {
        // it's a V1 & v2 upload, OR V3 thumb or lightbox.  
        // now we have the B64 in this
        // decryptedPhoto.data
        return decryptedPhoto.data;
    }
    
}



/**
 * Downloads user's titles.
 */
async function getTitles() {
    breadcrumb("[TITLES] Getting all titles");
    var startedRequest = (new Date()).getTime();
    
    var titlesResponse;
    try {
        titlesResponse = await api("photos-titles");
    } catch (error) {
        err("Couldn't get titles due to error", error);
        return false;
    }

    if (!titlesResponse) {  
        err("Didn't get titles response");
        return false;
    }
    
    var gotResponse = (new Date()).getTime();
    breadcrumb("[TITLES] Got all titles in " + (gotResponse - startedRequest) + "ms");
    
    var startedDecrypting = (new Date()).getTime();
    breadcrumb("[TITLES] Decrypting all titles");
    
    // decrypt album titles one by one
    var albumIDs = Object.keys(titlesResponse.data);
    for (var aid of albumIDs) {
        albums[aid] = albums[aid] || {};
        albums[aid].titles = titlesResponse.data[aid];
        try {
            await decryptAlbumTitles(aid);
        } catch (error) {
            console.error("[TITLES] Couldn't decrypt album titles", error);
        }
    }

    var doneDecrypting = (new Date()).getTime();
    breadcrumb("[TITLES] Decrypted all titles in " + (doneDecrypting - startedDecrypting) + "ms");

    return true;

    function err(msg, error) {
        handleError(msg, error);
    }
}




async function getSummonAlbum(hashedTitleToSummon){

    if (!hashedTitleToSummon) { 
        handleError("[SUMMON ALBUM] Can't summon without a title.");
        return false;
    }

    var apiResponse; 

    try {
        apiResponse = await api("photos-summon", {}, { hash : hashedTitleToSummon }, "POST");
    } catch (error) {
        handleError("[SUMMON ALBUM] API had an error.", error);
        return false;
    }

    if (!apiResponse) {
        handleError("[SUMMON ALBUM] Didn't get a response from the API.");
        return false;
    }

    if (apiResponse.status !== 200) {
        handleError("[SUMMON ALBUM] API had an error: " + apiResponse.status);
        return false;
    }

    return apiResponse.data;

}



/**
 * Searches for albums & photos based on references we pass, and returns an array of search results. The search functionality is in photos-search.js.
 * @param {*} references a synctactic search references array.   
 */
async function getSyntacticSearchResults(references) {
    references = references || [];

    if (references === []) { 
        breadcrumb("[SEARCH] No references found, won't query");
        return []; 
    }

    var apiResponse; 
    
    try {
        apiResponse = await api("photos-search", {}, {references : references}, "POST");
    } catch (error) {
        handleError("[SEARCH] API had an error.", error);
        return [];
    }

    if (!apiResponse) {
        handleError("[SEARCH] Didn't get a response from the API");
        return [];
    }

    if (apiResponse.status !== 200) {
        handleError("[SEARCH] API had an error: " + apiResponse.status);
        return [];
    }

    // add results to local memory to speed things up later when we're requesting thumbnails
    apiResponse.data.forEach(photo => {

        var pid = photo.id;
        var aid = photo.aid;
        
        // add photo to photos in memory
        photos[pid] = photos[pid] || {};
        Object.keys(photo).forEach(photoKey => {
            photos[pid][photoKey] = photo[photoKey];
        });

        // add photo to album's photos in memory
        albums[aid] = albums[aid] || {};
        albums[aid].photos = albums[aid].photos || [];

        if (!albums[aid].photos.includes(pid)) { albums[aid].photos.push(pid); }

    });
    
    return apiResponse.data;
}















////////////////////////////////////////////////
////////////////////////////////////////////////
//	SETTERS
////////////////////////////////////////////////
////////////////////////////////////////////////


/**
 * Set album metadata (i.e. thumbnail, pinky, tokens, date, rename etc all happen here)
 * @param {string} aid AlbumID (i.e. f-12345)
 * @param {Object} meta The meta object with properties to add to album. This will be upsert/merged with existing data. so it will update data if it exists, or will be set from scratch if it doesn't exist  
 */
async function setAlbumMeta(aid, meta) {
    if (!aid) {
        handleError("[ALBUM META] Can't set album meta. No AlbumID!");
        return false;
    }

    if (aid === "favorites") {
        handleError("[ALBUM META] Can't set album meta for favorites.");
        return false;
    }

    if (isEmpty(meta)) {
        handleError("[ALBUM META] Can't set album meta. No Meta!");
        return false;
    }

    breadcrumb("[ALBUM META] Setting album meta " + aid);

    var startedRequest = (new Date()).getTime();

    var response;
    try {
        response = await api("photos-albummeta", {a:aid}, meta);
    } catch (error) {
        error.aid = aid;
        err("Couldn't set album meta due to error", error);
        return false;
    }

    if (!response) {  
        err("Didn't get set album meta response", {aid:aid});
        return false;
    }

    if (response.status !== 200) {
        response.aid = aid;
        err("Couldn't set album meta, response code: " + response.status);
        return false;
    }

    var gotResponse = (new Date()).getTime();
    breadcrumb("[ALBUM META] Set album ("+aid+") meta in " + (gotResponse - startedRequest) + "ms");

    return true;

    function err(msg, error) {
        handleError(msg, error);
    }
}


/**
 * Change album cover / thumbnail
 * @param {string} aid AlbumID to set the cover of (i.e. f-12345)
 * @param {string} pid PhotoID to use as cover (i.e. p-12345)
 */
async function setAlbumCover(aid, pid) {
    if (!aid) {
        handleError("[ALBUM COVER] Can't set album cover. No AlbumID!");
        return false;
    }

    if (aid === "home" || aid === favorites) {
        handleError("[ALBUM COVER] Can't set album cover for home or favs!");
        return false;
    }

    if (!pid) {
        handleError("[ALBUM COVER] Can't set album cover. No PhotoID!");
        return false;
    }

    if (!photos[pid]) {
        handleError("[ALBUM COVER] Can't set album cover. Photo is not in memory or it doesn't exist!", { aid: aid, pid:pid });
        return false;
    }

    var tid = convertID(pid, "t");

    var meta = {
        "thumb"  : tid,
        "ltoken" : (photos[pid].ltoken || ""),
        "ttoken" : (photos[pid].ttoken || ""),
        "pinky"  : (photos[pid].pinky || ""),
        "date"   : dateFromEXIF((photos[pid].date || ""))
    };

    // only set the album's date if the cover photo has a date, otherwise, leave album's own date as it is.
    if (meta.date === "") { delete meta.date; }

    var setThumbnail;
    
    try {
        setThumbnail = await setAlbumMeta(aid, meta);
    } catch (error) {
        handleError("[ALBUM COVER] Failed to set album cover.", error);
        return false;
    }
    
    if (setThumbnail) {
        albums[aid].thumb  = tid;
        albums[aid].ltoken = (photos[pid].ltoken || "");
        albums[aid].ttoken = (photos[pid].ttoken || "");
        albums[aid].pinky  = (photos[pid].pinky || "");
        albums[aid].date   = dateFromEXIF((photos[pid].date || ""));
    }

    // popup is visible, update the contents (i.e. once an upload completes, this might be visible in the background)
    var popup = $(`#popup-album-info[aid="${aid}"]`);
    if (popup.length > 0 && popup.hasClass("show")) {
        updateEditAlbumPopupContents(aid);
    }

    return true;
}




async function updateAlbumTitles(aid) {
    if (!aid) {
        handleError("[UPDATE TITLES] Can't update album titles without AlbumID");
        return false;
    }

    var titlesObject = {
        albums : {},
        photos : {}
    };
    
    albums[aid].photos.forEach(pid => {
        if (photos[pid]) {
            try {
                var photoTitle = photos[pid].decryptedTitle || "Untitled.jpg";
                titlesObject.photos[pid] = JSON.stringify(photoTitle);
            } catch (error) {
                error.pid = pid;
                error.aid = aid;
                handleError("[UPDATE TITLES] Couldn't stringify photo title", error);
            }
        }
    });
    
    if (aid === "home") {
        for (var albumID in albums) {
            try {
                
                var albumTitle; 
                
                if (albumID === "home") {
                    albumTitle = "Home";
                } else {
                    albumTitle = (albums[albumID].decryptedTitle || "Untitled Album").toUpperCase();
                }
                
                titlesObject.albums[albumID] = JSON.stringify(albumTitle);

            } catch (error) {
                error.aid = "home";
                error.albumID = albumID;
                handleError("[UPDATE TITLES] Couldn't stringify album title", error);
            }

        }
    }

    var plaintextTitlesObject;

    try {
        plaintextTitlesObject = JSON.stringify(titlesObject);
    } catch (error) {
        error.aid = aid;
        handleError("[UPDATE TITLES] Couldn't stringify album titles object", error);
        return false;
    }

    if (!plaintextTitlesObject) { return false; }

    var encryptedTitles;

    try {
        encryptedTitles = await encrypt(plaintextTitlesObject, [theKey]);
    } catch (error) {
        error.aid = aid;
        handleError("[UPDATE TITLES] Couldn't encrypt album titles object", error);
        return false;
    }

    if (!encryptedTitles) { return false; }

    var encryptedTitlesObject;

    try {
        encryptedTitlesObject = JSON.stringify(encryptedTitles);
    } catch (error) {
        error.aid = aid;
        handleError("[UPDATE TITLES] Couldn't stringify album's encrypted titles", error);
        return false;
    }

    try {
        await setAlbumMeta(aid, { titles:encryptedTitlesObject });
    } catch (error) {
        error.aid = aid;
        handleError("[UPDATE TITLES] Couldn't set album titles", error);
        return false;
    }

    return true;
}











/**
 * Set photo metadata (i.e. date, pinky, tokens, etc all happen here)
 * @param {string} aid AlbumID (i.e. f-12345)
 * @param {string} pid PhotoID (i.e. p-12345)
 * @param {Object} meta The meta object with properties to add to photo. This will be upsert/merged with existing data. so it will update data if it exists, or will be set from scratch if it doesn't exist  
 */
async function setPhotoMeta(aid, pid, meta) {
    if (!aid) {
        handleError("[PHOTO META] Can't set photo meta. No AlbumID!");
        return false;
    }

    if (aid === "favorites") {
        handleError("[PHOTO META] Can't set photo meta for favorites.");
        return false;
    }

    if (isEmpty(meta)) {
        handleError("[PHOTO META] Can't set photo meta. No Meta!");
        return false;
    }

    if (!pid) {
        handleError("[PHOTO META] Can't set photo meta. No PhotoID!");
        return false;
    }

    if (meta.date) {
        // 2020:09:27 15:33:40 -> year:2020, month:09 etc etc. 
        try { meta.year  = meta.date.split(":")[0] || "";               } catch (error) {} 
        try { meta.month = meta.date.split(":")[1] || "";               } catch (error) {} 
        try { meta.day   = meta.date.split(":")[2].split(" ")[0] || ""; } catch (error) {} 
        try { meta.time  = meta.date.split(' ')[1] || "";               } catch (error) {} 
    }

    breadcrumb("[PHOTO META] Setting photo meta " + aid + "/" + pid);
    var startedRequest = (new Date()).getTime();

    var response;
    try {
        response = await api("photos-photometa", {a:aid, p:pid}, meta);
    } catch (error) {
        error.aid = aid;
        error.pid = pid;
        err("Couldn't set photo meta due to error", error);
        return false;
    }

    if (!response) {  
        err("Didn't get set photo meta response", {aid:aid, pid:pid});
        return false;
    }

    if (response.status !== 200) {
        response.aid = aid;
        response.pid = pid;
        err("Couldn't set photo meta, response code: " + response.status);
        return false;
    }

    var gotResponse = (new Date()).getTime();
    breadcrumb("[PHOTO META] Set photo ("+aid + "/" + pid+") meta in " + (gotResponse - startedRequest) + "ms");

    return true;

    function err(msg, error) {
        handleError(msg, error);
    }
}



async function setFavoritePhoto(pid) {
    if (!pid) {
        handleError("[FAVORITE PHOTO] Can't fav photo. No PhotoID!");
        return false;
    }

    var aid = activeAlbumID;

    breadcrumb("[FAVORITE PHOTO] Favoriting photo " + aid + "/" + pid);
    var startedRequest = (new Date()).getTime();

    var response;
    try {
        response = await api("photos-favorite", {a:aid, p:pid}, {}, "POST");
    } catch (error) {
        error.aid = aid;
        error.pid = pid;
        err("Couldn't fav photodue to error", error);
        return false;
    }

    if (!response) {  
        err("Didn't get fav photo response", {aid:aid, pid:pid});
        return false;
    }

    if (response.status !== 200) {
        response.aid = aid;
        response.pid = pid;
        err("Couldn't fav photo, response code: " + response.status);
        return false;
    }

    var gotResponse = (new Date()).getTime();
    breadcrumb("[FAVORITE PHOTO] Favorited photo ("+aid + "/" + pid+") in " + (gotResponse - startedRequest) + "ms");

    return true;

    function err(msg, error) {
        handleError(msg, error);
    }
}

async function setUnfavoritePhoto(pid) {
    if (!pid) {
        handleError("[UNFAVORITE PHOTO] Can't un-fav photo. No PhotoID!");
        return false;
    }

    breadcrumb("[UNFAVORITE PHOTO] Un-favoriting photo " + pid);
    var startedRequest = (new Date()).getTime();

    var response;
    try {
        response = await api("photos-unfavorite", {p:pid}, {}, "POST");
    } catch (error) {
        error.pid = pid;
        err("Couldn't un-fav photodue to error", error);
        return false;
    }

    if (!response) {  
        err("Didn't get un-fav photo response", {pid:pid});
        return false;
    }

    if (response.status !== 200) {
        response.pid = pid;
        err("Couldn't un-fav photo, response code: " + response.status);
        return false;
    }

    var gotResponse = (new Date()).getTime();
    breadcrumb("[UNFAVORITE PHOTO] Un-favorited photo ("+ pid +") in " + (gotResponse - startedRequest) + "ms");

    return true;

    function err(msg, error) {
        handleError(msg, error);
    }
}



async function setGhostAlbum(aid, hashedTitleToGhost) {

    if (!hashedTitleToGhost) { 
        handleError("[GHOST ALBUM] Can't ghost without a title.");
        return false;
    }

    var apiResponse; 

    try {
        apiResponse = await api("photos-ghost", { a:aid }, { hash : hashedTitleToGhost }, "POST");
    } catch (error) {
        handleError("[GHOST ALBUM] API had an error.", error);
        return false;
    }

    if (!apiResponse) {
        handleError("[GHOST ALBUM] Didn't get a response from the API.");
        return false;
    }

    if (apiResponse.status !== 200) {
        handleError("[GHOST ALBUM] API had an error: " + apiResponse.status);
        return false;
    }

    return true;
}



////////////////////////////////////////////////
////////////////////////////////////////////////
//	MOVERS
////////////////////////////////////////////////
////////////////////////////////////////////////

async function movePhotos(fromAID, toAID, photosToMove) {
    if (!fromAID) {
        handleError("[MOVE PHOTOS] Can't move photos. No fromAlbumID!");
        return false;
    }

    if (!toAID) {
        handleError("[MOVE PHOTOS] Can't move photos. No toAID!");
        return false;
    }
    
    if (fromAID === "favorites" || toAID === "favorites") {
        handleError("[MOVE PHOTOS] Can't move photos to/from favorites.");
        return false;
    }

    if (toAID === "home") {
        handleError("[MOVE PHOTOS] Can't move photos to home.");
        return false;
    }

    if (!Array.isArray(photosToMove) || photosToMove.length === 0) {
        handleError("[MOVE PHOTOS] Can't move photos. No photos!");
        return false;
    }

    breadcrumb('[MOVE PHOTOS] Starting to move');
    var startedRequest = (new Date()).getTime();

    var response;
    try {
        response = await api("photos-move", {to:toAID, from:fromAID}, photosToMove, "POST", 120);
    } catch (error) {
        error.from = fromAID;
        error.to   = toAID;
        error.photos = photosToMove;
        err("Couldn't move photos due to error", error);
        return false;
    }

    if (!response) {  
        err("Didn't get move photos response", {from:fromAID, to:toAID, photos:photosToMove});
        return false;
    }

    if (response.status !== 200) {
        response.from = fromAID;
        response.to   = toAID;
        response.photos = photosToMove;
        err("Couldn't move photos, response code: " + response.status);
        return false;
    }

    var gotResponse = (new Date()).getTime();
    breadcrumb("[MOVE PHOTOS] Moved " + photosToMove.length + " photo(s) in " + (gotResponse - startedRequest) + "ms");

    return true;

    function err(msg, error) {
        handleError(msg, error);
    }
}





////////////////////////////////////////////////
////////////////////////////////////////////////
//	DELETERS
////////////////////////////////////////////////
////////////////////////////////////////////////

async function deletePhotosOfAlbum(aid, photosToDelete) {
    if (!aid) {
        handleError("[DELETE PHOTOS] Can't delete photos. No AlbumID!");
        return false;
    }

    if (aid === "favorites") {
        handleError("[DELETE PHOTOS] Can't delete favorites.");
        return false;
    }

    if (!Array.isArray(photosToDelete) || photosToDelete.length === 0) {
        handleError("[DELETE PHOTOS] Can't delete photos. No photos!");
        return false;
    }

    breadcrumb('[DELETE PHOTOS] Starting deletion');
    var startedRequest = (new Date()).getTime();

    var response;
    try {
        response = await api("photos-delete", {a:aid}, photosToDelete, "DELETE", 120);
    } catch (error) {
        error.aid = aid;
        error.photos = photosToDelete;
        err("Couldn't delete photos due to error", error);
        return false;
    }

    if (!response) {  
        err("Didn't get delete photos response", {aid:aid, photos:photosToDelete});
        return false;
    }

    if (response.status !== 200) {
        response.aid = aid;
        response.photos = photosToDelete;
        err("Couldn't delete photos, response code: " + response.status);
        return false;
    }

    var gotResponse = (new Date()).getTime();
    breadcrumb("[DELETE PHOTOS] Deleted " + photosToDelete.length + " photo(s) in " + (gotResponse - startedRequest) + "ms");

    return true;

    function err(msg, error) {
        handleError(msg, error);
    }
}






async function deleteAlbum(aid) {
    if (!aid) {
        handleError("[DELETE ALBUM] Can't delete album. No AlbumID!");
        return false;
    }

    if (aid === "home" || aid === "favorites") { 
        handleError('[DELETE ALBUM] User tried deleting home or favorites. Aborting', {aid:aid});
        return false; 
    }

    breadcrumb('[DELETE ALBUM] Starting deletion');
    var startedRequest = (new Date()).getTime();

    var response;
    try {
        response = await api("photos-delete", {a:aid}, [], "DELETE", 120);
    } catch (error) {
        error.aid = aid;
        err("Couldn't delete album due to error", error);
        return false;
    }

    if (!response) {  
        err("Didn't get delete album response", {aid:aid});
        return false;
    }

    if (response.status !== 200) {
        response.aid = aid;
        err("Couldn't delete album, response code: " + response.status);
        return false;
    }

    var gotResponse = (new Date()).getTime();
    breadcrumb("[DELETE ALBUM] Deleted album in " + (gotResponse - startedRequest) + "ms");

    return true;

    function err(msg, error) {
        handleError(msg, error);
    }
}


