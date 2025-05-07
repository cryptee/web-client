////////////////////////////////////////////////
////////////////////////////////////////////////
//#region UI
////////////////////////////////////////////////
////////////////////////////////////////////////

function resetShareAlbumPopup() {

    $("#input-sharing-name").val("");
    $("#sharing-settings-summary-text").text("sharing: all photos in large size");

    $("#sharing-settings-quality-large").attr("open", true);
    $("#sharing-settings-quality-originals").removeAttr("open");

    $("#sharing-settings-filters-all").attr("open", true);
    $("#sharing-settings-filters-favorites").removeAttr("open");

    $("#sharing-link-settings").attr("open", true);
    $("#sharing-access-control").removeAttr("open");
    $("#sharing-status").removeAttr("open");

    $("#button-copy-link").removeClass("copied");
    $("#share-link").val(""); // this also disables the access control tab
    $("#access-log").empty(); // this also disables the sharing status tab

    // so once the share link / access log are populated these tabs will automatically become available. yay css.

}

async function populateShareAlbumPopup() {

    let album = albums[activeAlbumID];

    if (!album.share || isEmpty(album.share)) { return false; }

    let shareID = album.share.id;

    // first get the share key and decrypt it
    let shareKey;
    try {
        let shareKeyObject = await decrypt(album.share.keyWrapped, [theKey]);
        shareKey = shareKeyObject.data;
    } catch (error) {
        handleError("[SHARE ALBUM] Failed to populate share album popup. Failed to decrypt share key.");
        return false;
    }

    // decrypt headers and get name

    let sender = "";
    try {
        let decryptedHeaders = await decrypt(album.share.headers, [shareKey]);
        let dh = JSON.parse(decryptedHeaders.data);
        sender = dh.albumSender || "";
    } catch (error) {
        handleError("[SHARE ALBUM] Failed to populate share album popup. Failed to decrypt headers.");
        return false;
    }

    $("#input-sharing-name").val(sender);

    // this is user's own data, so we don't need to worry too much about stuff like xss here

    let sharingText = "sharing: ";

    // prepare filter toggles
    if (album.share.favonly) {
        $("#sharing-settings-filters-favorites").attr("open", true);
        $("#sharing-settings-filters-all").removeAttr("open");
        sharingText += "favorites ";
    } else {
        $("#sharing-settings-filters-all").attr("open", true);
        $("#sharing-settings-filters-favorites").removeAttr("open");
        sharingText += "all photos ";
    }

    // prepare quality toggles
    if (album.share.quality === "o") {
        $("#sharing-settings-quality-originals").attr("open", true);
        $("#sharing-settings-quality-large").removeAttr("open");
        sharingText += "in original size";
    } else {
        $("#sharing-settings-quality-large").attr("open", true);
        $("#sharing-settings-quality-originals").removeAttr("open");
        sharingText += "in large size";
    }

    // now update the summary on main page
    $("#sharing-settings-summary-text").text(sharingText);

    // prep and add the link
    $("#share-link").val(`https://cryptee.photos/a/${shareID}#${shareKey}`);

    // now fetch the logs
    // only do this if there's a sharekey, otherwise it's useless.
    // first make the log tab spin while it's loading.
    if (!shareKey) { return true; }

    $("#sharing-status").addClass("loading");

    let logsResponse = await api("photos-albumlogs", { sid : shareID });
    if (logsResponse.status !== 200) {
        handleError("[SHARE ALBUM] Failed to fetch logs, got non-200");
        return false;
    }

    let logs = logsResponse.data || [];
    let logsHTML = [];
    for (const l of logs) {
        let logPrettyDate = new Date(l.ti).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
        let logPrettyTime = new Date(l.ti).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        let what = (l.wh || "");
        let by = DOMPurify.sanitize(l.by || "");
        logsHTML.push(`<li>
            <p>${by}</p>
            <time>${logPrettyDate}</time>
            <small>${what}</small>
            <time>${logPrettyTime}</time>
        </li>`);
    }

    $("#access-log").html(logsHTML.reverse());
    $("#sharing-status").removeClass("loading");

}

async function showShareAlbumPopup() {

    if (!isPaidUser) {
        showView('photos-view-upgrade-sharing');
        return;
    }

    let isSharedAlbum = (albums[activeAlbumID].share || {}).id ? true : false;

    $("details[name='sharing-tabs']").removeAttr("open");

    if (isSharedAlbum) {

        $("#sharing-access-control").attr("open", true);

    } else {

        $("#sharing-link-settings").attr("open", true);

        // Check if album has phtoos without wrappedKeys, and warn the user
        let hasPhotosWithoutFileKeys = false;

        for (const pid of albums[activeAlbumID].photos) {

            let photo = photos[pid];

            if (photo.aid && photo.aid !== activeAlbumID) { continue; }

            // if photo doesn't have wrappedKey, we'll have to skip it,
            // it means this photo was uploaded before Jul 30, 2022
            // https://github.com/cryptee/web-client/commit/235798773319bca33444a51d067fa40b9e29b453
            // and that these photos will not be shared, and the user has to re-upload them, since they were encrypted without a file key during upload

            if (!photo.wrappedKey) {
                breadcrumb(`[SHARE ALBUM] Photo (${pid}) is missing wrappedKey, skipping...`);
                hasPhotosWithoutFileKeys = true;
                continue;
            }
        }

        if (hasPhotosWithoutFileKeys) {
            createPopup("This album contains photos uploaded before August 2022 that cannot be shared due to an older encryption method. To share this album, please download and re-upload the photos in this album (which will re-encrypt them in a way that makes it possible to share them)", "warning");
            return false;
        }

    }

    $("#sharing-wrapper").addClass("show");

}

function hideShareAlbumPopup() {
    $("#sharing-wrapper").removeClass("show");
}


/**
 * This prepares to share the current album and returns the shareID and shareKey of the shared album
 * @returns {Promise<*>} shareDetails.shareID id of the shared album
 * @returns {Promise<*>} shareDetails.shareKey key of the shared album
 */
async function createOrUpdateSharedAlbum() {

    breadcrumb('[SHARE ALBUM] Preparing to create or update a shared album...');

    $("#sharing-wrapper button").addClass("loading");

    // First create a master object for all photos in the album
    let sharePhotos = {};

    breadcrumb('[SHARE ALBUM] Preparing photos in album...');

    // Prepare photos for the share object
    let shareFavOnly = $("#sharing-settings-filters-favorites").is("[open]") || false;

    for (const pid in photos) {
        let photo = photos[pid];
        if (photo.aid && photo.aid !== activeAlbumID) { continue; }

        if (shareFavOnly && !favorites[pid]) { continue; }

        sharePhotos[pid] = {...photo};

        // decrypt photo's description if it's not already decrypted
        if (sharePhotos[pid].desc && !sharePhotos[pid].decryptedDesc) {

            try {
                let plaintextDescription = await decryptPhotoDescription(pid);
                sharePhotos[pid].decryptedDesc = plaintextDescription || "";
                photos[pid].decryptedDesc = plaintextDescription || "";
            } catch (error) {
                // it's okay if description is missing, wooorst case we just don't have desc for photos.
                // not the end of the world
                error.aid = activeAlbumID;
                error.pid = pid;
                handleError("[SHARE ALBUM] Failed to decrypt description of photo", error);
            }

        }

        // if photo doesn't have wrappedKey, we'll have to skip it,
        // it means this photo was uploaded before Jul 30, 2022
        // https://github.com/cryptee/web-client/commit/235798773319bca33444a51d067fa40b9e29b453
        if (!sharePhotos[pid].wrappedKey) {
            breadcrumb(`[SHARE ALBUM] Photo (${pid}) is missing wrappedKey, skipping...`);
            delete sharePhotos[pid];
            continue;
        }

        // decrypt fileKey for each photo if not already decrypted
        if (!sharePhotos[pid].decryptedFileKey) {

            try {
                let fileKey = await unwrapFileKey(sharePhotos[pid].wrappedKey);
                sharePhotos[pid].decryptedFileKey = fileKey;
                photos[pid].decryptedFileKey = fileKey;
            } catch (error) {
                error.aid = activeAlbumID;
                error.pid = pid;
                handleError("[SHARE ALBUM] Failed to decrypt file key of photo", error);
                delete sharePhotos[pid];
                continue;
            }

        }

        // just in case
        if (!sharePhotos[pid].decryptedFileKey) { delete sharePhotos[pid]; continue; }

        // clean up stuff that's unnecessary for sharing
        delete sharePhotos[pid].aid;
        delete sharePhotos[pid].tags;
        delete sharePhotos[pid].desc; // this is encrypted, and we've already decrypted it and have plaintext in the object, so no need to re-send it
        delete sharePhotos[pid].otoken;
        delete sharePhotos[pid].ltoken;
        delete sharePhotos[pid].ttoken;
        delete sharePhotos[pid].wrappedKey;

    }

    let numSharedPhotos = Object.keys(sharePhotos).length || 0;
    if (!numSharedPhotos) {
        handleError("[SHARE ALBUM] No photos to share, aborting...");
        $("#sharing-wrapper button").removeClass("loading");
        createPopup("There are no photos or videos that can be shared in this album", "info");
        return false;
    }

    // Now prepare the shareMeta object

    let senderName;
    breadcrumb('[SHARE ALBUM] Preparing sender name...');

    try {
        senderName = ($("#input-sharing-name").val().trim() || "").substring(0, 100);
        senderName = DOMPurify.sanitize(senderName);
    } catch (error) {
        handleError("[SHARE ALBUM] Failed to sanitize sender name", error);
        senderName = "Anonymous";
    }

    let albumTitle;
    breadcrumb('[SHARE ALBUM] Preparing album title...');

    try {
        albumTitle = (albums[activeAlbumID].decryptedTitle || "").substring(0, 100);
        albumTitle = DOMPurify.sanitize(albumTitle);
    } catch (error) {
        handleError("[SHARE ALBUM] Failed to sanitize album title", error);
        albumTitle = "Untitled Album";
    }

    let albumDate;
    breadcrumb('[SHARE ALBUM] Preparing album date...');

    try {
        albumDate = (albums[activeAlbumID].date || "0000:00:00").substring(0, 10);
        albumDate = DOMPurify.sanitize(albumDate);
    } catch (error) {
        handleError("[SHARE ALBUM] Failed to sanitize album date", error);
        albumDate = "0000:00:00";
    }

    let shareHeaders = {
        albumSender : senderName || "Anonymous",
        albumTitle  : albumTitle || "Untitled Album",
        albumDate   : albumDate  || "0000:00:00"
    }

    let shareKey;
    if (albums[activeAlbumID].share && !isEmpty(albums[activeAlbumID].share) && albums[activeAlbumID].share.keyWrapped) {
        breadcrumb('[SHARE ALBUM] Unwrapping share key...');
        try {
            let shareKeyObject = await decrypt(albums[activeAlbumID].share.keyWrapped, [theKey]);
            shareKey = shareKeyObject.data;
        } catch (error) {
            handleError("[SHARE ALBUM] Failed to unwrap share key while prepping to share album.");
            createPopup("Something went wrong while loading your sharing settings. This is often caused by browser extensions, ad-blockers, or DNS filters. Please try disabling them for Cryptee, refresh the page, and try again.", "error");
            $("#sharing-wrapper button").removeClass("loading");
            return false;
        }
    } else {
        breadcrumb('[SHARE ALBUM] Preparing share key...');
        shareKey = generateStrongURLToken();
    }

    if (!shareKey) {
        handleError("[SHARE ALBUM] Failed to unwrap/generate share key");
        $("#sharing-wrapper button").removeClass("loading");
        createPopup("Something went wrong while loading this album's sharing settings. This is often caused by browser extensions, ad-blockers, or DNS filters. Please try disabling them for Cryptee, refresh the page, and try again.", "error");
        return false;
    }

    breadcrumb('[SHARE ALBUM] Encrypting photos and meta...');

    let encryptedSharePhotos;
    let encryptedShareHeaders;
    let wrappedShareKey;

    try {
        encryptedSharePhotos    = await encrypt(JSON.stringify(sharePhotos), [shareKey]);
        encryptedShareHeaders   = await encrypt(JSON.stringify(shareHeaders), [shareKey]);
        wrappedShareKey         = await encrypt(shareKey, [theKey]); // wrapped share key = encrypted with user's key
    } catch (error) {
        handleError("[SHARE ALBUM] Failed to encrypt shared photos or share headers.", error);
        $("#sharing-wrapper button").removeClass("loading");
        createPopup("Something went wrong while encrypting this album's metadata. This is often caused by browser extensions, ad-blockers, or DNS filters. Please try disabling them for Cryptee, refresh the page, and try again.", "error");
        return false;
    }

    if (!encryptedSharePhotos || !encryptedShareHeaders) {
        handleError("[SHARE ALBUM] Failed to encrypt shared photos or share headers.");
        $("#sharing-wrapper button").removeClass("loading");
        createPopup("Something went wrong while encrypting this album's metadata. This is often caused by browser extensions, ad-blockers, or DNS filters. Please try disabling them for Cryptee, refresh the page, and try again.", "error");
        return false;
    }

    breadcrumb('[SHARE ALBUM] Preparing share object with encrypted photos and headers...');

    let shareQuality = "l";
    if ($("#sharing-settings-quality-originals").is("[open]")) {
        shareQuality = "o";
    }

    let shareObject = {
        quality                 : shareQuality,              // default = l for large, "o" for originals ()
        favonly                 : shareFavOnly,              // default = false
        noPhotos                : numSharedPhotos,           // default = 0, total number of photos
        wrappedShareKey         : wrappedShareKey.data,      // this is the wrapped shareKey (encrypted with user's key)
        encryptedSharePhotos    : encryptedSharePhotos.data, // all the encrypted stuff
        encryptedShareHeaders   : encryptedShareHeaders.data,
    }

    let shareResponse;
    try {
        shareResponse = await api("photos-share", { "a" : activeAlbumID }, shareObject, "POST");
    } catch (error) {
        createPopup("Something went wrong while requesting this album's sharing related metadata. This is often caused by browser extensions, ad-blockers, or DNS filters. Please try disabling them for Cryptee, refresh the page, and try again.", "error");
        handleError("[SHARE ALBUM] Error making the share album request.", error);
        $("#sharing-wrapper button").removeClass("loading");
        return false;
    }

    let shareID = ((shareResponse.data || {}).shareID || "") || false;

    albums[activeAlbumID].share = {
        id         : shareID,
        quality    : shareQuality,
        favonly    : shareFavOnly,
        keyWrapped : wrappedShareKey.data,
        headers    : encryptedShareHeaders.data,
    };

    breadcrumb('[SHARE ALBUM] Got shared album response, finishing up...');

    if (!shareID) {
        handleError("[SHARE ALBUM] Error making the share album request.");
        $("#sharing-wrapper button").removeClass("loading");
        createPopup("Something went wrong while requesting this album's sharing related metadata. This is often caused by browser extensions, ad-blockers, or DNS filters. Please try disabling them for Cryptee, refresh the page, and try again.", "error");
        return false;
    }

    $("#share-link").val(`https://cryptee.photos/a/${shareID}#${shareKey}`);
    $("details[name='sharing-tabs']").removeAttr("open");
    $("#sharing-access-control").attr("open", true);
    $("#sharing-wrapper button").removeClass("loading");
    $("#albumheader").addClass("shared");

    breadcrumb('[SHARE ALBUM] Done creating/updating shared album! ' + activeAlbumID + " -shareid:"+shareID);

    return true;

}


function promptRevokeSharedAlbumConfirmation() {
    $("#sharing-wrapper").addClass("revoke-confirm");
}

function cancelRevokeSharedAlbum() {
    $("#sharing-wrapper").removeClass("revoke-confirm");
}


/**
 * Revokes the share link for the current album, preventing all recipients from accessing it
 */
async function revokeSharedAlbum() {

    breadcrumb('[SHARE ALBUM] Preparing to revoke shared album...');

    // Add loading state to buttons
    $("#sharing-wrapper button").addClass("loading");

    let unshareResponse;
    try {
        // Make the API call to unshare the album
        unshareResponse = await api("photos-unshare", { "a" : activeAlbumID }, {}, "DELETE");
    } catch (error) {
        handleError("[SHARE ALBUM] Error making the unshare album request.", error);
        $("#sharing-wrapper button").removeClass("loading");
        createPopup("Failed to revoke share link. Please try again.", "error");
        return false;
    }

    if (unshareResponse.status !== 200) {
        handleError("[SHARE ALBUM] Error making the unshare album request.");
        $("#sharing-wrapper button").removeClass("loading");
        createPopup("Failed to revoke share link. Please try again.", "error");
        return false;
    }

    // Clear the album's share data
    delete albums[activeAlbumID].share;

    // Reset the UI
    resetShareAlbumPopup();

    // Show the link settings tab since there's no longer a share link
    $("details[name='sharing-tabs']").removeAttr("open");
    $("#sharing-link-settings").attr("open", true);

    // Remove loading state from buttons
    $("#sharing-wrapper button").removeClass("loading");

    breadcrumb('[SHARE ALBUM] Successfully revoked shared album');

    // Show success message
    createPopup("Successfully revoked access for all recipients. Album is now un-shared, and the link is no longer usable.", "success");

    $("#albumheader").removeClass("shared");

    return true;
}

/**
 * We call this function to make updates to shared album after a major change like deleted photo / uploaded photo etc
 * @param {String} aid
 */
async function ifSharedAlbumChangedShowPopupAndUpdate(aid) {
    if (aid === activeAlbumID) {
        let isSharedAlbum = (albums[aid].share || {}).id ? true : false;
        if (isSharedAlbum) {
            createPopup("one moment please...<br><br>please do not close this window or quit the app.<br><br>updating the shared album and syncing changes...<br><br>recipients will see the updates to this album in a minute", "info", "shared-album-updating", true);
            await createOrUpdateSharedAlbum();
            hidePopup("popup-shared-album-updating");
        }
    }
}


/**
 * We call this function to make updates to shared album (if necessary) after user favorites / unfavorites a photo. AND ONLY IF USER SHARED JUST THE FAVORITES.
 */
async function favoritesChangedCheckAndUpdateSharedAlbumIfNecessary() {

    let isSharedAlbumFavOnly = (albums[activeAlbumID].share || {}).favonly || false;

    if (isSharedAlbumFavOnly) {
        createPopup("one moment please...<br><br>updating your favorites in this shared album and syncing changes...<br><br>please do not close this window or quit the app.<br><br>recipients will see the updates to this album in a minute", "info", "shared-album-updating", true);
        await createOrUpdateSharedAlbum();
        hidePopup("popup-shared-album-updating");
    }

}
//#endregion UI
