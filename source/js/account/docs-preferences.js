

////////////////////////////////////////////////
////////////////////////////////////////////////
//	CLEAR CACHE
////////////////////////////////////////////////
////////////////////////////////////////////////


async function clearDocsCache() {
    
    purgeLocalCache();

    createPopup("Cleared Cache! Next time you launch Cryptee Docs, it will take a few extra seconds for Cryptee to decrypt file/foldernames and rebuild the cache.", "success");
    
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	CLEAR OFFLINE STORAGE
////////////////////////////////////////////////
////////////////////////////////////////////////


async function clearDocsOfflineStorage() {
    
    purgeOfflineStorage();
    
    createPopup("Cleared Offline Storage!", "success");

}