// 64.2MB file, chunked :
// CHUNKSIZE –––––-  CHUNK  –––––- TOTAL
// 10MB             ~140ms          1.6s
// 5MB              ~110ms          1.6s <––– u
// 4MB              ~100ms          1.9s
// 3MB              ~95ms           2.2s
// 2MB              ~95ms           3.3s
// 1MB              ~95ms           6.1s 
// 500KB            ~85ms           11.4s

// using 5MB for now for upload speed / encryption speed optimization reasons



// //////////////////////////////////////////////////
// 
// chunkAndEncryptFile 
//
// //////////////////////////////////////////////////
//
// + file (FILE FROM DRAG / SELECTION EVENT)
//
// + chunkReadAndEncryptedCallback 
//      chunkNo
//      offset
//      encryptedArrayBuffer (of the chunk)
//      fileMeta
//      callback func (to continue chunking when upload of this chunk is finished)
//
// + successCallback (to move on to the next file or whatever)
//      fileMeta
//
// //////////////////////////////////////////////////

function getFileID(fileSize, fileName, callback) {
    hashString(fileSize + "-" + fileName).then(function (hashedID) {
        callback(hashedID);
    });
}

function chunkAndEncryptFile(file, chunkReadAndEncryptedCallback, successCallback) {
    chunkReadAndEncryptedCallback = chunkReadAndEncryptedCallback || noop;
    successCallback = successCallback || noop;

    var fileID, fileMeta;
    var fileSize = file.size;
    var fileName = file.name || "";
    var fileType = file.type || "";
    var chunkSize = 5000000; // IN BYTES (5MB) 
    var offset = 0;
    var chunkNo = 0;

    // +1 to make it like arrays, since it's 0 based. 
    var totalChunks = Math.floor(fileSize / chunkSize) + 1;
    // first chunk = "Chunk-0", second chunk = "Chunk-1", totalChunks = 2 etc.

    console.log(formatBytes(fileSize), "Total Chunks", totalChunks);

    getFileID(fileSize, fileName, function (hashedID) {

        fileID = hashedID;
        fileMeta = {
            size: fileSize,
            name: fileName,
            type: fileType,
            id: fileID,
            totalChunks: totalChunks
        };

        readBlock(offset, chunkSize, file);

        function readBlock(offset, length, _file) {
            var r = new FileReader();
            var blob = _file.slice(offset, length + offset);
            r.onload = onLoadHandler;
            r.readAsArrayBuffer(blob);
        }

        function onLoadHandler(evt) {
            if (offset >= fileSize) {
                success(file);
                return;
            }

            if (evt.target.error == null) {
                offset += evt.target.result.byteLength;
                chunkRead(evt.target.result);
            } else {
                chunkError(evt.target.error);
                return;
            }
        }

        function chunkRead(result) {
            encryptArray(result, theKey).then(function (encryptedArrayBuffer) {
                console.log("" + chunkNo + " done");
                chunkReadAndEncryptedCallback(chunkNo, offset, encryptedArrayBuffer, fileMeta, function () {
                    chunkNo++;
                    readBlock(offset, chunkSize, file);
                });
            });
        }

        function chunkError(error) {
            console.error(error);
        }

        function success(file) {
            successCallback(fileMeta);
            console.log("DONE.");
        }

    });

}

