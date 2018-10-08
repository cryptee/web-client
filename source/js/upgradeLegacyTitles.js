// old titles format
// {
//   folders : {
//     '111' : 'folder test',
//     '222' : 'folder test2'
//   },
//   docs : {
//     'd111' : 'doc test',
//     'd222' : 'doc test2'
//   }
// }

function upgradeLegacyTitles () {
  var legacyTitlesObject = {};
  var legacyTagsObject = {};

  var folderTitlesLength = 0;
  var docTitlesLength = 0;
  var totalTitlesToWrite = 0;
  var successfulWrites = 0;
  var successfulReattemptedWrites = 0;
  var failedWrites = [];

  var rootObject = {}; // this will hold all data of all folders from database
  var fidLookupObject = {}; // fidLookupObject[did] = fid

  checkConnection (function(status){
    connected = status;
    if (connected && theKey) {
      displayUpgradeStatus(0,100);
      console.log("Commencing Upgrade");
      dataRef.child("titles").once('value', function(snapshot) {
        var JSONifiedEncryptedTitlesObject = snapshot.val();
        if (JSONifiedEncryptedTitlesObject) {
          if (JSONifiedEncryptedTitlesObject !== null && JSONifiedEncryptedTitlesObject !== undefined) {
            var encryptedTitlesObject = JSON.parse(JSONifiedEncryptedTitlesObject).data;
            console.log("Got Encrypted Titles Object");
            openpgp.decrypt({ message: openpgp.message.readArmored(encryptedTitlesObject), passwords: [theKey], format: 'utf8' }).then(function(plaintext) {
              legacyTitlesObject = JSON.parse(plaintext.data);
              gotLegacyTitles();
            }).catch(function(error) { handleError(error); });

          } else {
            // ACCOUNT HAD NO TITLES? SO IT MUST BE A SUPER OLD ACCOUNT WITH NOTHING IN THERE, LOGGING IN NOW.
            upgradeSuccesful();
          }
        } else {
          // ACCOUNT HAD NO TITLES? SO IT MUST BE A SUPER OLD ACCOUNT WITH NOTHING IN THERE, LOGGING IN NOW.
          upgradeSuccesful();
        }
      }).catch(function(error) { handleError(error); });

    } else {
      displayUpgradeMessage("Cryptee needs to perform a performance update.<br>Please connect your device to the internet.<br><br>");
      // NOT CONNECTED. THIS WILL FUCK SHIT UP. DON'T PROCEED.
      // PROMPT USER TO CONNECT.
    }
  });

  function checkFolderCountIntegrity (allFolders, callback) {
    callback = callback || noop;
    if (allFolders) {
      var allFoldersCount = Object.keys(allFolders).length;
      var foldersCountOnServer;
      dataRef.child("foldersCount").once('value', function(foldersCountSnap) {
        foldersCountOnServer = foldersCountSnap.val();
        if (foldersCountOnServer !== allFoldersCount) {
          dataRef.update({"foldersCount" : allFoldersCount}, function(){
            callback();
          });
        } else {
          callback();
        }
      }).catch(function(error) {
        console.log("Couldn't get foldersCount to check integrity - skipping for now");
        handleError(error);
        callback();
      });
    } else {
      callback();
    }
  }

  function getLegacyTags (callback, callbackParam) {
    callback = callback || noop;
    dataRef.child("tags").once('value', function(snapshot) {
      var JSONifiedEncryptedTagsObject = snapshot.val();
      if (JSONifiedEncryptedTagsObject) {
        if (JSONifiedEncryptedTagsObject !== null && JSONifiedEncryptedTagsObject !== undefined) {
          var encryptedTagsObject = JSON.parse(JSONifiedEncryptedTagsObject).data;
          openpgp.decrypt({ message: openpgp.message.readArmored(encryptedTagsObject), passwords: [theKey], format: 'utf8' }).then(function(plaintextTags) {
            legacyTagsObject = JSON.parse(plaintextTags.data);
            callback(callbackParam);
          }).catch(function(error) { handleError(error); });
        } else {
          // no tags found.
          callback(callbackParam);
        }
      }
    }).catch(function(error) { handleError(error); });
  }




  function gotLegacyTitles() {
    console.log("Got Decrypted Titles Object");
    // got titles, now get tags.
    getLegacyTags(function(){
      console.log("Got Decrypted Tags Object");

      if (legacyTitlesObject.folders) {
        folderTitlesLength = Object.keys(legacyTitlesObject.folders).length || 0;
      }
      console.log("Got", folderTitlesLength, "folder titles");

      if (legacyTitlesObject.docs) {
        docTitlesLength = Object.keys(legacyTitlesObject.docs).length || 0;
      }
      console.log("Got", docTitlesLength, "doc titles");

      successfulWrites = 0;
      totalTitlesToWrite = folderTitlesLength + docTitlesLength;
      displayUpgradeStatus(successfulWrites,totalTitlesToWrite);
      console.log(totalTitlesToWrite, "titles to upgrade in total");

      foldersRef.once('value', function(folders) {
        rootObject = folders.val();
        console.log("Got Root Directory");
        Object.values(rootObject).forEach(function(folderObj){
          console.log("Got Folder:", folderObj);
          if (folderObj.docs) { // if folder has docs, add the fid to lookup object
            Object.keys(folderObj.docs).forEach(function(didForFID){
              fidLookupObject[didForFID] = folderObj.folderid;
              console.log("Got Doc with ID:", didForFID, "in:", folderObj.folderid);
            });
          }
        });

        // make sure foldercount matches the actual number of folders to ensure boot.
        checkFolderCountIntegrity(rootObject, function(){
          writeFolderTitles ();
          writeDocTitlesAndTags ();
        });
      }).catch(function(error) { console.log("Couldn't get root directory"); handleError(error);  });
    });
  }






  function writeFolderTitles () {
    $.each(legacyTitlesObject.folders, function(fid, ftitle) {
      encryptTitleForUpgrade (fid, ftitle, function(theFID, encryptedTitle){
        foldersRef.child(theFID).update({"title" : encryptedTitle}, function(error) {
        // foldersRef.child(theFID).update({"title" : null}, function(error) { // for testing to erase
          if (error) {
            // The write failed...
            handleError(error);
            failedWrites.push({id:theFID, eTitle:encryptedTitle, what:"folder"});
            checkIfThisWasTheLastWrite();
          } else {
            // titles saved successfully!
            successfulWrites++;
            checkIfThisWasTheLastWrite();
          }
        }).catch(function(error) { handleError(error); });
      });
    });
  }

  function writeDocTitlesAndTags () {
    $.each(legacyTitlesObject.docs, function(did, dtitle) {
      encryptTitleForUpgrade (did, dtitle, function(theDID, encryptedTitle){
        encryptTagsForUpgrade (legacyTagsObject[theDID], function(encryptedTags) {
          foldersRef.child(fidLookupObject[theDID] + "/docs/" + theDID).update({"title" : encryptedTitle, "tags" : encryptedTags}, function(error) {
          // foldersRef.child(fidLookupObject[theDID] + "/docs/" + theDID).update({"title" : null, "tags" : null}, function(error) { // for testing to erase
            if (error) {
              // The write failed...
              handleError(error);
              failedWrites.push({id:theDID, eTitle:encryptedTitle, eTags:encryptedTags, toFID: fidLookupObject[theDID], what:"doc"});
              checkIfThisWasTheLastWrite();
            } else {
              // titles saved successfully!
              successfulWrites++;
              checkIfThisWasTheLastWrite();
            }
          }).catch(function(error) { handleError(error); });
        });
      });
    });
  }

  function checkIfThisWasTheLastWrite () {
    displayUpgradeStatus(successfulWrites,totalTitlesToWrite);
    if ((failedWrites.length + successfulWrites) === totalTitlesToWrite) {
      // DONE. THIS WAS THE LAST WRITE.

      if (failedWrites.length > 0) {
        console.log("Couldn't upgrade all titles & tags.", failedWrites.length, "errors happened.");
        console.log(failedWrites);
        tryFailedOnes();
        // some stuff failed, try those again.
      } else {
        upgradeSuccesful();
      }

    }
  }

  function tryFailedOnes () {
    displayUpgradeStatus(successfulReattemptedWrites,failedWrites.length);
    failedWrites.forEach(function(failedWrite){
      var writeRef; var objectToWrite = {};
      if (failedWrite.what === "folder") {
        writeRef = foldersRef.child(failedWrite.id);
        objectToWrite = {"title" : failedWrite.eTitle};
      } else {
        writeRef = foldersRef.child(fidLookupObject[failedWrite.id] + "/docs/" + failedWrite.id);
        objectToWrite = {"title" : failedWrite.eTitle, "tags" : failedWrite.eTags};
      }

      writeRef.update(objectToWrite, function(error) {
        if (error) {
          // The write failed...
          handleError(error);
          checkIfThisWasTheLastFailedWrite();
        } else {
          // titles saved successfully!
          successfulReattemptedWrites++;
          checkIfThisWasTheLastFailedWrite();
        }
      }).catch(function(error) { handleError(error); });

    });
  }

  function checkIfThisWasTheLastFailedWrite () {
    displayUpgradeStatus(successfulReattemptedWrites,failedWrites.length);
    if (successfulReattemptedWrites === failedWrites.length) {
      // DONE. THIS WAS THE LAST WRITE.
      upgradeSuccesful();
    } else {
      console.log("Couldn't upgrade all titles & tags.", failedWrites.length - successfulReattemptedWrites, "errors happened.");
      if (failedWrites.length !== totalTitlesToWrite) {
        // not much we can do.. some failed, likely undefined.
        upgradeSuccesful();
      } else {
        // ALL FAILED. PROMPT USER TO CONTACT SUPPORT.
        handleError(new Error('All title and tag upgrades failed for uid: ' + theUserID));
        displayUpgradeMessage("Cryptee needed to perform a performance update, but it failed.<br>Please contact our helpdesk.<br><br>",true);
      }
    }
  }

  function encryptTitleForUpgrade (didOrFid, title, callback) {
    callback = callback || noop;
    openpgp.encrypt({ data: title, passwords: [theKey], armor: true }).then(function(ciphertext) {
      var encryptedTitle = JSON.stringify(ciphertext);
      callback(didOrFid, encryptedTitle);
    }).catch(function(error) { handleError(error); });
  }

  function encryptTagsForUpgrade (tags, callback) {
    callback = callback || noop;
    // tags need to be an array with length > 0, other this will return null to prevent writing empty tags for no reason.
    if (Array.isArray(tags)) {
      if (tags.length > 0) {
        var plaintextTags = JSON.stringify(tags);
        openpgp.encrypt({ data: plaintextTags, passwords: [theKey], armor: true }).then(function(ciphertext) {
          var encryptedTags = JSON.stringify(ciphertext);
          callback(encryptedTags);
        }).catch(function(error) { handleError(error); });
      } else {
        callback(null);
      }
    } else {
      callback(null);
    }
  }


  function upgradeSuccesful () {
    console.log("Titles upgraded.");
    dataRef.update({"tie" : true}, function(){
      setTimeout(function () {

        // UPGRADE COMPLETE
        sessionStorage.setItem("key", JSON.stringify(keyToRemember));
        window.location.reload();

      }, 500);
    });
  }

  function displayUpgradeStatus(current,total) {
    current = current || 0;
    total = total || 100;
    showDocProgress("<span>Performance Update</span><br><br><progress class='progress upgradeProgress' value='"+current+"' max='"+total+"'></progress><p style='font-size:14px;'>This is a one time only performance update</p><p style='font-size:14px;'>It should take a few seconds</p><p style='font-size:14px;'>Please don't close this window</p>");
  }

  function displayUpgradeMessage(message, error) {
    error = error || false;

    if (!error) {
      showDocProgress("<span class='tag is-warning is-medium'>Performance Update</span><br><br><p style='font-size:14px;'>"+message+"</p><p style='font-size:14px;'>It should only take a few seconds.</p><p style='font-size:14px;'>Please stay online and don't close this window.</p>");
    } else {
      showDocProgress("<span class='tag is-warning is-medium'>Performance Update</span><br><br><p style='font-size:14px;'>"+message+"</p>");
    }
  }
}
