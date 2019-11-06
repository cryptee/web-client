// var precache_urls = [
//   '../',
//   '../css/',
//   '../assets/',
//   '../fonts/',
//   '../pdf/'
// ];




// DON'T CHANGE THIS.
// ADDED A CODEKIT BUILD HOOK SHELL SCRIPT THAT REPLACES THIS WITH ALL FILES NEEDED TO BE PRE-CACHED

var precache_urls = TO-BE-REPLACED-WITH-AN-ARRAY-OF-ALL-FILES;

// DON'T CHANGE THIS CACHENAME.
// ADDED A CODEKIT BUILD HOOK SHELL SCRIPT THAT REPLACES THIS WITH THE LATEST GITHUB HASH
// WHICH IN RETURN BUSTS THE CACHE @ ACTIVATE, AND DELETES ALL THE OLD CACHED FILES.
// CLEANER.

var cacheName = 'stale-while-revalidate';
var alfa = (location.origin === "https://alfa.crypt.ee");

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(cacheName).then(function(cache) {
      precache_urls.forEach(function (precacheURL) {
        // each precacheURL will come like "<root>/123.jpg",
        // we'll then replace this with the current origin to make sure beta and alfa etc all get cached the same way
        cache.add(precacheURL.replace("<root>", location.origin));
      });
    }).then(function() {
      return self.skipWaiting();
    }).catch(function(error){
      console.log(error);
    })
  );
});

self.addEventListener('fetch', function(event) {
  // EXCLUDES ( _ RESERVED FOR FIREBASE )

  var requrl = event.request.url;
  if (  
    requrl.indexOf( '__/' ) !== -1 ||  
    requrl.indexOf( '/__' ) !== -1 ||  
    requrl.indexOf( 'about:blank' ) !== -1 ||  
    requrl.indexOf( '/api/' ) !== -1 ||  
    requrl.indexOf( '/imgs/' ) !== -1 ||  
    requrl.indexOf( '/heroes/' ) !== -1 ||  
    requrl.indexOf( '/v.json' ) !== -1 ||  
    requrl.indexOf( '/cors.json' ) !== -1 ||  
    requrl.indexOf( 'zxcvbn' ) !== -1 ||  
    requrl.indexOf( 'pdf.worker' ) !== -1 ||  
    requrl.indexOf( '/cors-min.json' ) !== -1
  ) {
    // console.log('Fetching from network: ', event.request.url);
    return false;
  }

  // INCLUDES
  if (  
    requrl.startsWith( 'https://crypt.ee' ) ||  
    requrl.startsWith( 'https://flare.crypt.ee' ) ||  
    requrl.startsWith( 'https://beta.crypt.ee' ) ||  
    requrl.startsWith( 'https://alfa.crypt.ee' ) ||  
    requrl.startsWith( 'https://sentry.io' )
    // ||  event.request.url.startsWith( 'http://127.0.0.1' )
  ) {
    event.respondWith(

      caches.open(cacheName).then(function(cache) {
        return cache.match(event.request).then(function(cacheResponse) {
          
          if (cacheResponse) {
            
            if (alfa) {
              console.log("[SW CACHE]");
              console.log(cacheResponse);
              console.log("[/SW CACHE]");
            }

            return cacheResponse;
          } else {

            return fetch(event.request).then(function(networkResponse) {
              var clonedReponse = networkResponse.clone();
              if (event.request.method !== "POST" && event.request.method !== "DELETE")  {
                cache.put(event.request, clonedReponse);
                // console.log('Fetching from cache: ', event.request.url);
              }

              if (alfa){
                console.log("[SW NTWRK]");
                console.log(networkResponse);
                console.log("[/SW NTWRK]");
              }

              return networkResponse;
            }).catch(function(error){ console.log(error); });
          
          }

        }).catch(function(error){ console.log(error); return false; });
      }).catch(function(error){ console.log(error); return false; })
    
    );
  } else {
    // console.log('Fetching from network: ', event.request.url);
    return false;
  }
  // return false
});

self.addEventListener("activate", function(event) {
  console.log('Activating Cryptee Service Worker!');
  event.waitUntil(
    caches.keys().then(function(keyList) {
      return Promise.all(keyList.map(function(key) {
        if (key !== cacheName) {
          console.log("Removing old cache", key);
          return caches.delete(key);
        }
      }));
    })
  );
});
