
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
        // there's no better place to show this sadly, so we had to put this error popup in the API file. But normally you shouldn't do this, and show these errors in the app's functions themselves.
        createPopup("Couldn't get your albums due to a connectivity problem. Chances are this has to do with an ad-blocker / content-blocker extension. Please check your internet connection, try disabling your extensions, and try again. If this issue continues, reach out to our support via our helpdesk.", "error");
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

    return true;

    function err(msg, error) {
        handleError(msg, error);
        // there's no better place to show this sadly, so we had to put this error popup in the API file. But normally you shouldn't do this, and show these errors in the app's functions themselves.
        createPopup("Couldn't get photos due to a connectivity problem. Chances are this has to do with an ad-blocker / content-blocker extension. Please check your internet connection, try disabling your extensions, and try again. If this issue continues, reach out to our support via our helpdesk.", "error");
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

    // PICK THE CORRECT THUMBNAIL SIZE ACCORDING TO USER'S PREFERENCES
    var thumbSizePreference;
    if (appPreference.photos["high-res-thumbnails"] === "high") {
        thumbSizePreference = "l"; // HIGH-RES
    } else {
        thumbSizePreference = "t"; // NORMAL-RES
    }

    // PICK THE CORRECT VIDEO THUMBNAIL TYPE ACCORDING TO USER'S PREFERENCES
    if (appPreference.photos["video-thumbnails-type"] === "still") {
        thumbSizePreference = "l"; // STILL
    } else {
        thumbSizePreference = "t"; // ANIMATED
    }

    // DOWNLOAD ENCRYPTED THUMBNAIL
    var decryptedThumbnailURL = await getMedia(thumbImgID, thumbSizePreference, "url");
    
    if (!wrapperElem.hasClass("onscreen")) { doneLoading(); return false; }
    if (!decryptedThumbnailURL) { doneLoading(); return false; }

    var img = new Image();
    img.src = decryptedThumbnailURL;
    img.setAttribute("draggable", false);
    img.setAttribute("thumb", thumbImgID);

    try {
        await img.decode();
    } catch (error) {
        error.imgID = thumbImgID;
        error.token = thumbToken;
        handleError("[GET THUMBNAIL] Couldn't decode thumbnail", error);
        doneLoading();
    }

    imgElem.replaceWith(img);
    
    doneLoading();

    function doneLoading() {
        setTimeout(function () {
            wrapperElem.removeClass("loading");
            img = null;
            if (decryptedThumbnailURL) { revokeObjectURL(decryptedThumbnailURL); }
        }, 50);
    }
}

/**
 * Downloads, decrypts and returns a decrypted Base64 or blob photo
 * @param {string} photoID The ID of the photo. could be pid, tid, lid etc 
 * @param {('p'|'t'|'l'|'v'|'r')} size The siize of the photo 
 * @param {('url'|'blob')} outputFormat The output format of the photo (i.e. blob url or blob). Defaults to "url", as that's what we use the most.
 * @returns {*} img if the image is V1 or V2 upload, this is b66. If it's a v3 upload, thumb & lightbox sizes are b64, and original is a blob
 */
async function getMedia(photoID, size, outputFormat) {
    outputFormat = outputFormat || "url";

    size = size || "l";
    
    if (!photoID) {
        handleError("[GET PHOTO] Can't get photo. No photoID");
        return false;
    }
    
    var pid;

    var id = convertID(photoID, size);
    
    if (photoID.startsWith("v-") || size === "v") {
        pid = convertID(photoID, "size");
    } else {
        pid = convertID(photoID, "p");
    }
    
    // technically we only need this for the token, and we can still download the photo without a token, by requesting a new token. 
    // it'll be slow, but it'd work. on the server side if we catch a moment like this, we'll generate fresh new tokens for these photos
    // so it's technically a one-time speed issue. 

    var localPhoto = photos[pid] || favorites[pid] || {}; 

    var token;
    if (size === "p" || size === "v") { token = localPhoto.otoken || ""; }
    if (size === "l")                 { token = localPhoto.ltoken || ""; }
    if (size === "t")                 { token = localPhoto.ttoken || ""; }
    
    var decryptedPhoto;
    
    try {
        decryptedPhoto = await downloadAndDecryptFile(id, token, outputFormat);
    } catch (error) {
        error.photoID = photoID;
        error.pid = pid;
        error.size = size;
        handleError("[GET PHOTO] Couldn't download / decrypt / get photo", error);
        return false;
    }
    
    if (decryptedPhoto === "aborted") { return false; }

    // couldn't find thumbnail size, auto-fallback to lightbox size
    if (size === "t" && !decryptedPhoto) { 
        handleError("[GET PHOTO] Couldn't download / decrypt / get thumbnail photo. Falling back to lightbox size.", { photoID : photoID, pid : pid, size : size });
        return getMedia(photoID, "l", outputFormat); 
    }

    // couldn't find lightbox size, auto-fallback to original size
    if (size === "l" && !decryptedPhoto) { 
        handleError("[GET PHOTO] Couldn't download / decrypt / get lightbox photo. Falling back to original size.", { photoID : photoID, pid : pid, size : size });
        return getMedia(photoID, "p", outputFormat); 
    }

    if (size === "p" && !decryptedPhoto) {
        handleError("[GET PHOTO] Couldn't download / decrypt / get original photo. Aborting.", { photoID : photoID, pid : pid, size : size });
        return false;
    }

    return decryptedPhoto;
    
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
        // there's no better place to show this sadly, so we had to put this error popup in the API file. But normally you shouldn't do this, and show these errors in the app's functions themselves.
        createPopup("Couldn't get photo/album names due to a connectivity problem. Chances are this has to do with an ad-blocker / content-blocker extension. Please check your internet connection, try disabling your extensions, and try again. If this issue continues, reach out to our support via our helpdesk.", "error");
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


async function getTagsSearchResults(hmacs) {
    hmacs = hmacs || [];

    if (hmacs === []) { 
        breadcrumb("[SEARCH] No hmacs found, won't query");
        return []; 
    }

    var apiResponse; 
    
    try {
        apiResponse = await api("photos-tagged", {}, { hmacs : hmacs }, "POST");
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


/**
 * Get Tags with given HMACs and decrypt them
 * @param {array} tagHMACs An Array of Tag HMACs 
 */
async function getTags(tagHMACs) {
    
    if (!tagHMACs) { 
        handleError("[GET TAGS] Can't get tags, no tag hmacs provided.");
        return [];
    }

    if (!Array.isArray(tagHMACs) || tagHMACs.length === 0) {
        handleError("[GET TAGS] Can't get tags, no tag hmacs provided.");
        return [];
    }

    var apiResponse; 

    try {
        apiResponse = await api("photos-tags", {}, { tags : tagHMACs }, "POST");
    } catch (error) {
        handleError("[GET TAGS] API had an error.", error);
        return [];
    }

    if (!apiResponse) {
        handleError("[GET TAGS] Didn't get a response from the API.");
        return [];
    }

    if (apiResponse.status !== 200) {
        handleError("[GET TAGS] API had an error: " + apiResponse.status);
        return [];
    }

    var encryptedTags = apiResponse.data;
    var decryptedTags = await decryptTags(encryptedTags);
    var arrayOfDecryptedTags = Object.values(decryptedTags) || [];
    
    return arrayOfDecryptedTags;

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

    if (isEmpty(albums[aid])) {
        handleError("[UPDATE TITLES] Album doesn't exist, can't update its titles without an album");
        return false;
    }

    var titlesObject = {
        albums : {},
        photos : {}
    };
    
    albums[aid].photos = albums[aid].photos || [];

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


/**
 * Tags photos of an album with the given tags
 * @param {string} aid Album ID
 * @param {array} photosToTag Array of Photo IDs 
 * @param {array} tags Array of Tag Objects
 */
async function tagPhotos(aid, photosToTag, tags) {

    if (!aid) {
        handleError("[TAG PHOTOS] Can't tag photos. No Album ID!");
        return false;
    }

    if (aid === "favorites") {
        handleError("[TAG PHOTOS] Can't tag photos from the favorites album.");
        return false;
    }

    if (!Array.isArray(photosToTag) || photosToTag.length === 0) {
        handleError("[TAG PHOTOS] Can't tag photos. No photos!");
        return false;
    }

    if (!Array.isArray(tags) || tags.length === 0) {
        handleError("[TAG PHOTOS] Can't tag photos. No tags!");
        return false;
    }

    breadcrumb("[TAG PHOTOS] Starting to tag photoso");
    var startedRequest = (new Date()).getTime();

    var response;
    try {
        response = await api("photos-tag", { a:aid }, { photosToTag : photosToTag, tags : tags }, "POST", 120);
    } catch (error) {
        error.aid = aid;
        error.photos = photosToTag;
        handleError("Couldn't tag photos due to error", error);
        return false;
    }

    if (!response) {  
        handleError("Didn't get tag photos response", { aid:aid, photos:photosToTag });
        return false;
    }

    if (response.status !== 200) {
        response.aid = aid;
        response.photos = photosToTag;
        handleError("Couldn't tag photos, response code: " + response.status);
        return false;
    }

    var gotResponse = (new Date()).getTime();
    breadcrumb("[TAG PHOTOS] Tagged " + photosToTag.length + " photo(s) in " + (gotResponse - startedRequest) + "ms");

    return true;

}


async function setPhotoDescription(aid, pid, plaintextDescription) {
    
    if (!aid) { return false; }
    if (!pid) { return false; }

    plaintextDescription = (plaintextDescription || "").toString();

    breadcrumb("[SET PHOTOS DESC] Starting to set the description of photo:" + pid);

    // photo doesn't exist!?
    if (isEmpty(photos[pid])) {
        handleError("[SET PHOTOS DESC] Can't set photos description. Photo doesn't exist!");
        createPopup("Couldn't set the description of this photo. Chances are this is a network problem. Please check your connection and reach out to our support via our helpdesk if this issue continues.", "error");
        return false;
    }

    if (!aid) {
        handleError("[SET PHOTOS DESC] Can't set photos description. No Album ID!");
        return false;
    }

    if (aid === "favorites") {
        handleError("[SET PHOTOS DESC] Can't set photos description from the favorites album.");
        createPopup("At the moment it's not possible to set the description of a photo from the favorites album. Please first open the album containing the photo, and try to set the photo's description from there. We're working on improving this process and sorry about the inconvenience.", "error");
        return false;
    }

    var encryptedDescriptionString = null;
    // if there's a description, encrypt it, 
    // if there's no description, we'll save null 
    if (plaintextDescription.length >= 1) {
        var encryptedDescription; 
    
        try {
            breadcrumb('[SET PHOTOS DESC] Encrypting description of photo: ' + pid);
            encryptedDescription = await encrypt(plaintextDescription, [theKey]);
            breadcrumb('[SET PHOTOS DESC] Encrypted description of photo: ' + pid);
        } catch (error) {
            handleError("[SET PHOTOS DESC] Failed to encrypt description of photo: " + pid);
            createPopup("Couldn't set the description of this photo. Chances are this is a network problem or this has to do with an ad-blocker / content-blocker extension. Please try disabling your extensions and try again.", "error");
            return false;
        }
    
        if (!encryptedDescription || isEmpty(encryptedDescription)) {
            handleError("[SET PHOTOS DESC] Failed to encrypt description of photo: " + pid);
            createPopup("Couldn't set the description of this photo. Chances are this is a network problem or this has to do with an ad-blocker / content-blocker extension. Please try disabling your extensions and try again.", "error");
            return false;
        }
    
        encryptedDescriptionString = encryptedDescription.data || "";
    }

    breadcrumb('[SET PHOTOS DESC] Setting description of photo: ' + pid + " to its meta.");

    var setDescriptions;
    try {
        setDescriptions = await setPhotoMeta(aid, pid, { "desc" : encryptedDescriptionString });
        photos[pid].decryptedDesc = plaintextDescription;
        photos[pid].desc = encryptedDescriptionString;
    } catch (error) {
        handleError("[SET PHOTOS DESC] Failed to set description of photo: " + pid);
        createPopup("Couldn't set the description of this photo. Chances are this is a network problem or this has to do with an ad-blocker / content-blocker extension. Please try disabling your extensions and try again.", "error");
        return false;
    }

    if (!setDescriptions) {
        handleError("[SET PHOTOS DESC] Failed to set description of photo: " + pid);
        createPopup("Couldn't set the description of this photo. Chances are this is a network problem or this has to do with an ad-blocker / content-blocker extension. Please try disabling your extensions and try again.", "error");
        return false;
    }

    breadcrumb('[SET PHOTOS DESC] Successfully set description of photo: ' + pid);

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


