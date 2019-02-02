function showEmojilock() {
    $("html, body").addClass("modal-is-active");
    $(".emojilock-wrapper").addClass("is-active");
    setTimeout(function() {
        $(".emojilock-wrapper").addClass("shown");
    }, 500);
}

function hideEmojilock() {
    $(".emojilock-wrapper").removeClass("shown");
    setTimeout(function() {
        $(".emojilock-wrapper").removeClass("is-active");
        resetEmojiCode();
        $(".emojicode").removeClass("wrong");
    }, 1000);
}

$(".emojitab").on('click', function(event) {
    $(".emojitab.is-active").removeClass("is-active");
    $(".emojis.is-active").removeClass("is-active");
    $(this).addClass("is-active");
    var tab = $(this).attr("tab");
    $(".emojis[tab='"+tab+"']").addClass("is-active");
}); 

$(".emojis").on('click', 'i', function(event) {
    var code = $(this).attr("code");
    var emoji = $(this).html();
    inputEmoji(code, emoji);
}); 

var digitInputted = 1;
var typedEmojiCode;
var emojilockMode;
var typedWrong = 0;

function inputEmoji(code, emoji) {
    $(".emojicode").removeClass("wrong");
    $(".emojicode[digit='"+digitInputted+"']").html(emoji).attr("code", code);
    if (digitInputted === 4) { checkEmojiCode(); }
    digitInputted++;
}

function checkEmojiCode() {
    var codeOne     = $(".emojicode[digit='1']").attr("code");
    var codeTwo     = $(".emojicode[digit='2']").attr("code");
    var codeThree   = $(".emojicode[digit='3']").attr("code");
    var codeFour    = $(".emojicode[digit='4']").attr("code");
    typedEmojiCode  = codeOne + codeTwo + codeThree + codeFour;

    hashString(typedEmojiCode).then(function(hashedEmojiCode){

        if (emojilockMode === "set") {
            // sets emojicode to memory
            setEmojiCode(hashedEmojiCode);
        } else {
            // checks emoji code
            var emojiEncryptedHashedKey = JSON.parse(localStorage.getItem("emojiCryptedKey")).data;
            decrypt(emojiEncryptedHashedKey, [hashedEmojiCode]).then(function (plaintext) {
                rightEmojiCode(plaintext.data);
            }).catch(function (error) {
                wrongEmojiCode();
            });
        }
        
    }).catch(function(error){
        handleError(error);
        hideEmojilock();
    });
}

function resetEmojiCode() {
    $(".emojicode").html("&bull;").removeProp('code').removeAttr('code');
    digitInputted = 1;
}

function rightEmojiCode(plaintextHashedKey) {
    keyToRemember = plaintextHashedKey;
    checkKey();
}

function wrongEmojiCode() {
    typedWrong++;

    if (typedWrong >= 5) {
        localStorage.removeItem('emojiCryptedKey');
        hideEmojilock();
    }
    // do something here. 
    $(".emojilock-wrapper").find(".title").html("WRONG CODE");
    $(".emojicode").addClass("wrong");
    resetEmojiCode();
}

function setEmojiCode(hashedEmojiCode) {
    // encrypt hashed encryption key using the hashedEmojiCode and save to localStorage 
    // confirmedHashedKey comes from account.js 

    if (confirmedHashedKey) {
        encrypt(confirmedHashedKey, [hashedEmojiCode]).then(function (ciphertext) {
            var emojiEncryptedHashedKey = JSON.stringify(ciphertext);
            localStorage.setItem("emojiCryptedKey", emojiEncryptedHashedKey);
            doneSettingEmojiKey();
        });
    }
}

function doneSettingEmojiKey() {
    confirmedHashedKey = null;
    reflectDeviceSecuritySettings();
    setTimeout(function () {
      hideActiveWarningModal();
      hideEmojilock();
      $("#device-setting-keypin-modal").find(".fa-check").addClass("fa-key").removeClass("fa-check"); 
      $("#setemoji-button").prop('disabled', true).attr('disabled', true);
      $("#rememberkey-button").prop('disabled', true).attr('disabled', true);
    }, 10);
  }
  