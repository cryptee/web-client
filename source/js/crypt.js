//////////////////////////////////////////////////
//////////////////////////////////////////////////
//	SETUP LEGACY OPENPGP V4.5.3
// 
//  FOR ALL NON-STREAMING CRYPTOGRAPHIC OPS
//  APPLICABLE TO CRYPTEE -V1,-V2,-V3 FILES
//  USES WORKERS & MULTI-THREADS AS WELL
//////////////////////////////////////////////////
//////////////////////////////////////////////////

var cryptoThreadsCount = 1;
var multithreadedCrypto = false;
if (navigator.hardwareConcurrency && canUseWorkers) {
  cryptoThreadsCount = navigator.hardwareConcurrency;
  setSentryTag("cryptoThreadsCount", cryptoThreadsCount);
}

try {
  openpgp.config.aead_protect = true; // activate fast AES-GCM mode (not yet OpenPGP standard)
  openpgp.config.aead_protect_version = 0;
  openpgp.initWorker({ path: '../js/lib/openpgpjs/v4.5.3/openpgp.worker-4.5.3.min.js', n :cryptoThreadsCount }); // set the relative web worker path
} catch (e) {
  breadcrumb("Problem initializing openpgp in main js, failed in try/catch.");
  handleError("Problem initializing openpgp in main js, failed in try/catch.", e, "warning");
}

if (!openpgp) {
  breadcrumb("Problem initializing openpgp in main js.");
  handleError("Problem initializing openpgp in main js, openpgp is undefined.", {}, "warning");
} else {
  var openpgpversion = openpgp.config.versionstring.split("v")[1];
  setSentryTag("openpgp-ver", openpgpversion);

  if (cryptoThreadsCount >= 2 && canUseWorkers) {
    breadcrumb("[OpenPGPjs V4] Using " + cryptoThreadsCount + " worker thread(s)");
    breadcrumb("[OpenPGPjs V4] Bypassing native WebCrypto for better multi-threaded performance");
    openpgp.config.use_native = false;
    multithreadedCrypto = true;
  } else {
    breadcrumb("[OpenPGPjs V4] Using " + cryptoThreadsCount + " worker thread(s), with native WebCrypto");
  }
}


////////////////////////////////////////////////
////////////////////////////////////////////////
//	NON-STREAMING CRYPTOGRAPHIC OPERATIONS
//
//  APPLICABLE TO CRYPTEE -V1,-V2,-V3 FILES
//  USES OPENPGP V4.5.3
//  USES WORKERS & MULTI-THREADS AS WELL
////////////////////////////////////////////////
////////////////////////////////////////////////



/////////////////////////////////////////
// ENCRYPT PLAINTEXT USING KEYS
//                               
// A DROP-IN, SHORTHAND REPLACEMENT FOR    
// OPENPGPJS's .encrypt
// WORKS STARTING WITH OPENPGPJS V4.4.1
//////////////////////////////////////////

/**
 * Encrypts given plaintext string with the given keys, returns a promise with ciphertext
 * @param {string} plaintext 
 * @param {array} keys 
 * @returns {promise} promise with ciphertext
 */
async function encrypt(plaintext, keys) {

  var options = {
    message: openpgp.message.fromText(plaintext),
    passwords: keys,
    armor: true
  };

  return openpgp.encrypt(options);

}

/////////////////////////////////////////
// DECRYPT CIPHERTEXT USING KEYS
//                               
// A DROP-IN, SHORTHAND REPLACEMENT FOR    
// OPENPGPJS's .decrypt
// WORKS STARTING WITH OPENPGPJS V4.4.1
//////////////////////////////////////////

/**
 * Decrypts given ciphertext string with the given keys, returns a promise with plaintext
 * @param {string} ciphertext 
 * @param {array} keys 
 * @returns {promise} promise with plaintext
 */
async function decrypt(ciphertext, keys) {
  
  try {

    var options = {
      message: await openpgp.message.readArmored(ciphertext),
      passwords: keys,
      format: 'utf8'
    };
  
    return openpgp.decrypt(options);

  } catch (error) { throw error; }

}

/////////////////////////////////////////////////////////////
// ENCRYPT Uint8Array USING KEYS
//
// TAKES IN A UINT8ARRAY
// RETURNS A Uint8Array
/////////////////////////////////////////////////////////////

/**
 * Encrypts the plaintext Uint8Array with the given keys, returns a promise with ciphertext Uint8Array 
 * @param {Uint8Array} plaintext
 * @param {array} keys 
 * @returns {promise} promise with ciphertext uint8array
 */
async function encryptUint8Array(plaintext, keys) {
  
  var options = {
    message: openpgp.message.fromBinary(plaintext),
    passwords: keys,
    armor: true
  };

  return openpgp.encrypt(options);
  
}



/////////////////////////////////////////
// DECRYPT CIPHERTEXT TO UINT8ARRAY USING KEYS
//                               
// TAKES IN A CIPHERTEXT    
// AND RETURNS A UINT8ARRAY
//////////////////////////////////////////

/**
 * Decrypts given ciphertext string with the given keys, returns a promise with ciphertext Uint8Array
 * @param {string} ciphertext 
 * @param {array} keys 
 * @returns {promise} promise with plaintext
 */
async function decryptToBinary(ciphertext, keys) {
  
  try {

    var options = {
      message: await openpgp.message.readArmored(ciphertext),
      passwords: keys,
      format: 'binary'
    };
  
    return openpgp.decrypt(options);

  } catch (error) { throw error; }

}




////////////////////////////////////////////////
////////////////////////////////////////////////
// 
//	STREAMING CRYPTOGRAPHIC OPERATIONS 
//  FOR CRYPTEE-V4 FILES
// 
//  COMPATIBLE STARTING WITH OPENPGP V5.2.1
// 
////////////////////////////////////////////////
////////////////////////////////////////////////


/**
 * Takes in a file and streaming encrypts it
 * @param {(File|Blob)} fileOrBlob 
 * @param {array} keys
 * @returns {Promise <Blob>} encryptedBlob
 */
async function streamingEncrypt(fileOrBlob, keys) {
    
    openpgpV5.config.aeadProtect = true;
    openpgpV5.config.preferredAEADAlgorithm = openpgpV5.enums.aead.experimentalGCM;

    var fileStream; 
    
    if (!isFirefox) {
      fileStream = blobToStream(fileOrBlob);
    } else {
      fileStream = polyfilledReadableStream(blobToStream(fileOrBlob));
    }

    var encrypted = await openpgpV5.encrypt({
        message: await openpgpV5.createMessage({ binary: fileStream }),
        passwords: keys,
        format : 'binary'
    });

    var encryptedStreamReader = encrypted.getReader();

    var chunks = [];
  
    while (true) {
        var { done, value } = await encryptedStreamReader.read();
        if (done) break;
        chunks.push(value);
    }
    
    return new Blob(chunks, { type : "application/octet-stream" });
  
}
  


/**
 * Decrypts given ciphertext stream with the given keys, returns a promise with ciphertext blob
 * @param {*} encryptedStream 
 * @param {array} keys 
 * @param {String} plaintextMimetype (required so we can output the blob)
 * @returns {Promise <Blob>} decryptedBlob
 */
async function streamingDecrypt(encryptedStream, keys, plaintextMimetype) {
    
    try {
        
      // refer to polyfilledReadableStream for more info on why we need this polyfill, and maybe remove in the future
      if (isFirefox) { encryptedStream = polyfilledReadableStream(encryptedStream); }

      var decrypted = await openpgpV5.decrypt({
          message : await openpgpV5.readMessage({ binaryMessage: encryptedStream }),
          passwords: keys,
          format: 'binary'
      });

      var decryptedStreamReader = decrypted.data.getReader();

      var chunks = [];

      while (true) {
          var { done, value } = await decryptedStreamReader.read();
          if (done) break;
          chunks.push(value);
      }
      
      return new Blob(chunks, { type : plaintextMimetype });

    } catch (error) { throw error; }
  
}
  
  
/**
 * This generates an additional fileKey for an upload. For photos we use the same fileKey for all sizes (original, lightbox, thumbnail etc). 
 * fileKeys are encrypted similarly to doc titles / tags etc
 * If for some reason this operation fails, we will gracefully fall back to using the default data encryption key of the user in code.
 * This is only for things like future sharing features etc.
 */
async function generateFileKey() {

  var fileKey; 
  var encryptedFileKey;
  var encryptedStringifiedFileKey;

  try {
      
    // generate a strong fileKey
    fileKey = generateStrongKey(32);

    // encrypt / wrap the fileKey with user's key
    encryptedFileKey = await encrypt(JSON.stringify(fileKey), [theKey]);

    // grab the encryptedStringifiedFileKey.
    encryptedStringifiedFileKey = JSON.stringify(encryptedFileKey);

  } catch (error) {
    handleError("[FILEKEY] Failed to generate new fileKey.", error);
    return false;
  }

  if (encryptedStringifiedFileKey) { 
    breadcrumb('[FILEKEY] Generated filekey!');
    return { fileKey : fileKey, wrappedKey : encryptedStringifiedFileKey };
  } else {
    return false;
  }

}



/**
 * This decrypts a wrappedKey, and returns the strongKey (fileKey) 
 * fileKeys are encrypted similarly to doc titles / tags etc
 * This is only for things like future sharing features etc.
 * @returns {Promise <String>} fileKey (strongKey)
 */
async function unwrapFileKey(wrappedKey) {

  if (!wrappedKey) {
    handleError("[FILEKEY] Can't unwrap / decrypt a fileKey if it doesn't exist.");
    return false;
  }

  var fileKey; 

  try {
    
    var parsedEncryptedFileKey = JSON.parse(wrappedKey);

    // decrypt / unwrap the fileKey with user's key
    decryptedFileKey = await decrypt(parsedEncryptedFileKey.data, [theKey]);

    fileKey = JSON.parse(decryptedFileKey.data);

  } catch (error) {
    handleError("[FILEKEY] Failed to decrypt fileKey.", error);
    return false;
  }

  if (fileKey) { 
    breadcrumb('[FILEKEY] Unwrapped / Decrypted filekey!');
    return fileKey;
  } else {
    return false;
  }

}
  






////////////////////////////////////////////////
////////////////////////////////////////////////
//	HASHES & HMACS
////////////////////////////////////////////////
////////////////////////////////////////////////

/**
 * Hashes a string using SHA 256 or 512
 * @param {string} str string to hash
 * @param {('256'|'512'))} strength SHA256 OR SHA512
 * @returns {promise} – promise with hashed string
 */
function hashString (str, strength) {
  return new Promise(function (resolve, reject) {
    var uinta = openpgp.util.str_to_Uint8Array(str);
    var algo = openpgp.crypto.hash.sha256(uinta);
    strength = strength || "256";
    if (strength === "512") { 
      algo = openpgp.crypto.hash.sha512(uinta); 
    }
    algo.then(function (hashedUintA) {
      var hashedStr = openpgp.util.Uint8Array_to_str(hashedUintA);
      var hashedHex = openpgp.util.str_to_hex(hashedStr);
      var result = hashedHex.split(" ").join("").split("\n").join("");
      resolve(result);
    }).catch(function (error) {
      reject(error);
    });
  });
}

/**
 * generates a strong key
 * @param {Number} [length] optionally provide a length for key (i.e. for file keys, we don't want them to be massive for future sharing use) p.s. the real length will be 2x this number
 * @returns {string} – a cryptographically strong string that can be used as a key
 */
function generateStrongKey(length) {
  length = length || 1024;
  var arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, dec2hex).join('');
}


/** 
 * Computes and returns and HMAC signature of a string, with the given key. (Uses SHA-256 and native WebCrypto).
 * @param {String} string 
 * @param {String} keyToUse 
 * @returns {Promise<String>} signature HMAC Signature
 */
async function hmacString(string, keyToUse) {

  try {
  
    var enc = new TextEncoder("utf-8");
  
    var hmacKey = await window.crypto.subtle.importKey( 
      "raw", // format of the key = raw, (should be Uint8Array)
      enc.encode(keyToUse), 
      { name: "HMAC", hash: { name: "SHA-256" } },
      false, // not going to export, so false
      ["sign", "verify"] // what key should be able to do
    );
  
    var signature = await window.crypto.subtle.sign( 
      "HMAC", 
      hmacKey, 
      enc.encode(string)
    );
  
    return Array.prototype.map.call(new Uint8Array(signature), x => ('00' + x.toString(16)).slice(-2)).join("");
  
  } catch (error) {

    throw new Error(error);
  
  }

}
