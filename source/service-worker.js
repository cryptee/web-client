


// DON'T CHANGE THIS.
// ADDED A CODEKIT BUILD HOOK SHELL SCRIPT THAT REPLACES THIS WITH ALL FILES NEEDED TO BE PRE-CACHED

var precache_urls = [TO-BE-REPLACED-WITH-AN-ARRAY-OF-ALL-FILES];
// var precache_urls = [
//   '../',
//   '../css/',
//   '../assets/',
//   '../fonts/',
//   '../pdf/'
// ];




// DON'T CHANGE THIS CACHENAME.
// ADDED A CODEKIT BUILD HOOK SHELL SCRIPT THAT REPLACES THIS WITH THE LATEST GITHUB HASH
// WHICH IN RETURN BUSTS THE CACHE @ ACTIVATE, AND DELETES ALL THE OLD CACHED FILES.
// CLEANER.

// STALE WHILE REVALIDATE
var cacheName = 'cache-dev-ver';
var live = (location.origin === "https://crypt.ee");




// HERE'S A LIST OF FILES THAT WON'T BE CACHED, AND WILL ALWAYS BE REQUESTED FROM NETWORK
var excludedPaths = [
    // paths
    '/api/',
    '/imgs/',
    '/adapters/',
    '/splash/', // all splash images are loaded from static.crypt.ee/splash, so don't cache this
    '/rare-and-large-js-libs/',
    
    // files
    '/v.json',

    // other
    'about:blank'
];




// HERE'S A LIST OF HOSTNAMES WE CAN CACHE REQUESTS ON 
// WE CHECK FOR THIS AS *.crypt.ee ("beta.crypt.ee".endsWith("crypt.ee")) 
// SO THAT ALL SUBDOMAINS ARE CACHEABLE

var cacheableHostnames = [ 
    "crypt.ee", 
    // "localhost" 
];


////////////////////////////////////////////////
////////////////////////////////////////////////
//	INSTALLATION
////////////////////////////////////////////////
////////////////////////////////////////////////

async function installWorker(){
    
    console.log('[WORKER] Installing');

    var cache = await openCache();
    if (!cache) {
        console.error("[WORKER] Failed to open cache during install", cacheName);
    }
    
    var promisesToAddURLsToCache = [];
    precache_urls.forEach(function (precacheURL) {
        // each precacheURL will come like "<root>/123.jpg",
        // we'll then replace this with the current origin to make sure beta and alfa etc all get cached the same way
        var fileURL = precacheURL.replace("<root>", location.origin);
        promisesToAddURLsToCache.push(cache.add(fileURL));
    });

    await Promise.all(promisesToAddURLsToCache.map(p => p.catch((e) => {
        console.error("[WORKER] Failed to cache file(s)", e);
    })));

    console.log('[WORKER] Installed');

    return self.skipWaiting();

}

self.addEventListener('install', (event) => { 
    event.waitUntil(installWorker()); 
});






////////////////////////////////////////////////
////////////////////////////////////////////////
// HANDLE SW FETCH	
////////////////////////////////////////////////
////////////////////////////////////////////////

async function handleFetch (event) {

    var reqURL = new URL(event.request.url);

    //
    // FIRST, LET'S CHECK FOR NETWORK BYPASS 
    // 

    var bypassForNetwork = false;

    for (const excludedPath of excludedPaths) {
        if (reqURL.href.includes(excludedPath)) {
            console.log("[WORKER] BYPASS:", reqURL.pathname, "(Path Excluded)"); 
            bypassForNetwork = true; 
            break; 
        }
    }

    // straight bypass, get from network, don't cache results
    if (bypassForNetwork) { return respondFromNetwork(event); }
    
    // if we made it here, we know the file should be cached, and isn't on an exclusion list.
    // now let's check to see if the domain is correct. for this, we'll need to invert the network bypass logic. 
    bypassForNetwork = true;

    for (const cacheableHostname of cacheableHostnames) {
        // endsWith, because if we use 'includes' or 'startsWith', something like crypt.ee.malicious.com could still cache requests.
        // so on unknown hostnames, we'll bypass for network, and don't rely on caches.
        if (reqURL.hostname.endsWith(cacheableHostname)) { 
            bypassForNetwork = false;
            break; 
        }
    }

    // now if bypass for network is still true, this means we're not on a supported host. 
    // get straight from network and don't cache results. 
    if (bypassForNetwork) { 
        console.log("[WORKER] BYPASS:", reqURL.pathname, "(Host un-cacheable)", reqURL.hostname);
        return respondFromNetwork(event); 
    }

    // finally if we're on a cache-supported hostname & file isn't on an exclusion list, 

    // get the cache
    var cache = await openCache();
    if (!cache) {
        console.error("[WORKER] BYPASS:", reqURL.pathname, "Failed to open cache", cacheName);
        return respondFromNetwork(event); 
    }
    
    // use cache to respond if file's in cache
    var cacheResponse = await respondFromCache(event, cache);
    if (cacheResponse) { return cacheResponse; }

    // if not in cache, get from network, and cache it too
    var networkResponse = await respondFromNetworkAndCacheResponse(event, cache);
    if (networkResponse) { return networkResponse; }

    // if we're absolutely doomed, then return a 500 error. under normal circumstances things should never come to this tho
    return new Response("", { "status" : 500 , "statusText" : "offline" });

}



async function respondFromCache(event, cache) {

    var cacheResponse;

    try {
        cacheResponse = await cache.match(event.request);
    } catch (error) {
        console.error("[WORKER] Failed to get a response from cache", error);
        return false;
    }

    if (!live && cacheResponse) { console.log("[WORKER] FROM CACHE:", cacheResponse); }
    
    // if we have it in cache, return it
    if (cacheResponse) { 
        return cacheResponse; 
    }

    return false;

}



async function respondFromNetworkAndCacheResponse(event, cache) {

    // if we don't have it in cache, let's fetch it from network
    var networkResponse;

    try {
        networkResponse = await fetch(event.request);
    } catch (error) {
        console.error("[WORKER] Failed to get a response from network", error);
    }

    if (!networkResponse) { return false; }

    // let's save network response to cache if it's not a post / delete etc. 
    if (!["POST", "DELETE", "PUT"].includes(event.request.method)) {
        try {
            await cache.put(event.request, networkResponse.clone());
        } catch (error) {
            console.error("[WORKER] Failed to clone / put network response into cache", error);
        }
    }

    if (!live && networkResponse) { console.log("[WORKER] FROM NETWORK:", networkResponse); }

    if (networkResponse) {
        return networkResponse;
    }

    return false;

}



async function respondFromNetwork(event) {
    var networkResponse;

    try {
        networkResponse = await fetch(event.request);
    } catch (error) {
        console.error("[WORKER] Failed to get a response from network", error);
    }

    return networkResponse;
}



async function openCache() {
    var cache; 

    try {
        cache = await caches.open(cacheName);
    } catch (error) {
        console.error("[WORKER] Failed to open caches", error);
        return false;
    }

    return cache; 
}


self.addEventListener('fetch', (event) => { 
    // bypass for post requests. 
    // XHR requests can check progress, but fetch can't. 
    // so if you 'fetch' POST requests using the service worker, you can't keep track of the upload progress in axios.
    if (event.request.method === 'POST') { return; }
    
    event.respondWith( handleFetch(event) ); 
});



////////////////////////////////////////////////
////////////////////////////////////////////////
//	HANDLE SW ACTIVATE
////////////////////////////////////////////////
////////////////////////////////////////////////

async function activateWorker() {
    
    console.log('[WORKER] Activating');

    var keyList = await caches.keys();
    await Promise.all(keyList.map(function (key) { 
        if (key !== cacheName) {
            return caches.delete(key); 
        }
    }));
    
    console.log('[WORKER] Activated');

    return true;

}


self.addEventListener("activate", (event) => { 
    event.waitUntil( activateWorker() ); 
});