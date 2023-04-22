let multiFactorSession; 
let totpSecret;
let qrcode;
let generatedRecoveryCodes;

async function generateOrGetMFARecoveryCodes() {
    
    breadcrumb('[MFA] Generating or getting MFA recovery codes');
    var generatedCodes; 
    
    try {
        generatedCodes = await api("user-mfaGenCodes");
    } catch (error) {
        handleError("[GENERATE RECOVERY CODES] Failed to generate recovery codes", error);
        return false;
    }

    let codes = generatedCodes.data;

    $("#mfa-recovery-code-1").text(codes[0]);
    $("#mfa-recovery-code-2").text(codes[1]);
    $("#mfa-recovery-code-3").text(codes[2]);
    $("#mfa-recovery-code-4").text(codes[3]);
    $("#mfa-recovery-code-5").text(codes[4]);

    breadcrumb('[MFA] Generated MFA recovery codes');

    return generatedCodes;
}



////////////////////////////////////////////////
////////////////////////////////////////////////
// START ENROLL
////////////////////////////////////////////////
////////////////////////////////////////////////

async function showTOTPMFAEnroll() {

    breadcrumb('[MFA] Preparing TOTP Enroll Popup...');

    var currentPass = $("#verify-pasword-to-enable-mfa-input").val();
    if (!currentPass) { 
        createPopup("To enable multi-factor-authentication, for your safety, you'll need to prove you are indeed who you say you are. To prove your identity please enter your current login password.", "warning");
        return false; 
    }

    $("#setup-mfa-button").addClass("loading");

    var reAuthorized = await reAuthUser(currentPass);
    if (!reAuthorized) { 
        // warning popups are sent in reauth already
        $("#setup-mfa-button").removeClass("loading");
        return false;
    }

    await startMultiFactorSession();
    
    generateOrGetMFARecoveryCodes();

    $("#setup-mfa-button").removeClass("loading");

    breadcrumb('[MFA] Showing TOTP Enroll Popup NOW!');

    showTip('tips-mfa-setup');

}

async function verifyMFACode() {

    breadcrumb('[MFA] [VERIFY] Verifying MFA Code ...');

    $("#button-verify-mfa").addClass("loading");

    var mfaCode = $("#input-verify-mfa-code").val().trim();
    if (!mfaCode) { $("#input-verify-mfa-code").trigger("focus"); return; }
    if ( mfaCode.length < 6 ) { $("#mfa-verify-error").text("the code needs to be 6 digits. please double-check what you typed."); }

    const multiFactorAssertion = firebase.TotpMultiFactorGenerator.assertionForEnrollment(totpSecret, mfaCode);
    

    try {
        await firebase.multiFactor(theUser).enroll(multiFactorAssertion, "cryptee-totp-mfa");
    } catch (error) {
        if (error.code === "auth/invalid-verification-code") {
            $("#mfa-verify-error").text("invalid code! looks like your authenticator had a difficulty scanning the qr code, or you made a typo. please double-check, try again, or re-start the process from scratch to get a new code.");
            handleError("[MFA] Failed to enroll, invalid code.", error);
            $("#button-verify-mfa").removeClass("loading");
            return false;
        } else {
            $("#mfa-verify-error").text("we're having difficulty verifying your code. chances are this is a network / connectivity problem, or your browser is configured to block access to a resource cryptee needs. please disable your content-blockers, check your connection, try again and reach out to our support via our helpdesk if this issue continues. ");
            handleError("[MFA] Failed to enroll, other error.", error);
            $("#button-verify-mfa").removeClass("loading");
            return false;
        }
    }

    await promiseToWait(500);

    breadcrumb('[MFA] [VERIFY] Getting fresh token ...');

    await getFreshToken(theUser);

    breadcrumb('[MFA] [VERIFY] Getting MFA UID ...');

    const mfaUID = await firebase.multiFactor(theUser).enrolledFactors[0].uid;

    breadcrumb('[MFA] [VERIFY] Saving MFA UID ...');

    try {
        await api("user-saveMFAUID", null, { mfaUID : mfaUID });
    } catch (error) {
        error.mfaUID = mfaUID;
        handleError("[MFA] Failed to save MFA UID", error);
    }

    $("#button-verify-mfa").removeClass("loading");

    $(".show-for-mfa-enabled").show();
    $(".show-for-mfa-disabled").hide();

    breadcrumb('[MFA] [VERIFY] All set! Moving on.');
    
    tipsElements["tips-mfa-setup-container"].slideNext();

}


async function startMultiFactorSession() {

    breadcrumb('[MFA] Starting MFA Session ...');

    try {
        multiFactorSession = await firebase.multiFactor(theUser).getSession();
    } catch (error) {
        handleError("[MFA] Failed to get mfa session", error);
        createPopup("Looks like we're having a difficulty retrieving your user configuration or having a general connectivity issue. Please make sure your internet connection is stable and try again in a few minutes.", "error");
        return false;
    }

    breadcrumb('[MFA] Generating TOTP Secret ...');

    try {
        totpSecret = await firebase.TotpMultiFactorGenerator.generateSecret(multiFactorSession);
    } catch (error) {
        handleError("[MFA] Failed to get totp secret", error);
        createPopup("Looks like we're having a difficulty creating your multi-factor codes or having a general connectivity issue. Please make sure your internet connection is stable and try again in a few minutes.", "error");
        return false;
    }

    breadcrumb('[MFA] Preparing TOTP URL & QR Code...');

    var totpURL = "otpauth://totp/Cryptee:" + theEmail + 
                  "?secret="    + totpSecret.secretKey + 
                  "&algorithm=" + "SHA1" +
                  "&digits="    + totpSecret.codeLength +
                  "&period="    + totpSecret.codeIntervalSeconds +
                  "&issuer=Cryptee";
        
    // show secret
    // $("#mfa-qr-code-secret").text(totpSecret.secretKey);
    // show url
    
    $("#mfa-qr-code").empty();
    $("#mfa-qr-code").attr("title", "");

    try {
        const qrCode = new QRCodeStyling({
            "width": 1024,
            "height": 1024,
            "data": totpURL,
            "margin": 0,
            "qrOptions": {
                "typeNumber": "0",
                "mode": "Byte",
                "errorCorrectionLevel": "L"
            },
            "imageOptions": {
                "hideBackgroundDots": true,
                "imageSize": 0.6,
                "margin": 16
            },
            "dotsOptions": {
                "type": "dots",
                "color": "#6a1a4c",
                "gradient": {
                    "type": "radial",
                    "rotation": 0,
                    "colorStops": [
                        {
                            "offset": 0,
                            "color": "#000000"
                        },
                        {
                            "offset": 1,
                            "color": "#646464"
                        }
                    ]
                }
            },
            "backgroundOptions": {
                "color": "#ffffff"
            },
            "image": "../assets/logo-b.svg",
            "dotsOptionsHelper": {
                "colorType": {
                    "single": true,
                    "gradient": false
                },
                "gradient": {
                    "linear": true,
                    "radial": false,
                    "color1": "#6a1a4c",
                    "color2": "#6a1a4c",
                    "rotation": "0"
                }
            },
            "cornersSquareOptions": {
                "type": "dot",
                "color": "#646464",
                "gradient": null
            },
            "cornersSquareOptionsHelper": {
                "colorType": {
                    "single": true,
                    "gradient": false
                },
                "gradient": {
                    "linear": true,
                    "radial": false,
                    "color1": "#000000",
                    "color2": "#000000",
                    "rotation": "0"
                }
            },
            "cornersDotOptions": {
                "type": "dot",
                "color": "#000000",
                "gradient": null
            },
            "cornersDotOptionsHelper": {
                "colorType": {
                    "single": true,
                    "gradient": false
                },
                "gradient": {
                    "linear": true,
                    "radial": false,
                    "color1": "#000000",
                    "color2": "#000000",
                    "rotation": "0"
                }
            },
            "backgroundOptionsHelper": {
                "colorType": {
                    "single": true,
                    "gradient": false
                },
                "gradient": {
                    "linear": true,
                    "radial": false,
                    "color1": "#ffffff",
                    "color2": "#ffffff",
                    "rotation": "0"
                }
            }
        });
    
        qrCode.append(document.getElementById("mfa-qr-code"));
    } catch (error) {
        handleError("[MFA] Failed to generate QR code", error);
        createPopup("Looks like we're having a difficulty generating your multi-factor authenticator QR code or having a general connectivity issue. Please make sure your internet connection is stable and try again in a few minutes.", "error");
        createPopup(`In the meantime, you can visit this URL on your authenticator device:<br><code>${totpURL}</code>`, "info");
        return false;
    }

}



////////////////////////////////////////////////
////////////////////////////////////////////////
// DISABLE MFA
////////////////////////////////////////////////
////////////////////////////////////////////////

async function disableTOTPMFAEnroll() {
    
    breadcrumb('[MFA] Preparing to disable MFA...');

    var currentPass = $("#verify-pasword-to-disable-mfa-input").val();
    if (!currentPass) { 
        createPopup("To disable multi-factor-authentication, for your safety, you'll need to prove you are indeed who you say you are. To prove your identity please enter your current login password.", "warning");
        return false; 
    }

    var mfaCode = $("#verify-mfa-code-to-disable-mfa-input").val();
    if (!mfaCode) { 
        createPopup("To disable multi-factor-authentication, for your safety, you'll need to prove you are indeed who you say you are. To prove your identity please enter a multi-factor-authentication code.", "warning");
        return false; 
    }
    
    if (mfaCode.length < 6) {
        createPopup("Please double check to make sure you've typed the multi-factor code correctly. It needs to be 6 digits.", "warning");
        return false; 
    }

    if ((mfaCode.length > 8 && mfaCode.length < 19) || mfaCode.length > 19) {
        createPopup("Please make sure you typed the recovery code correctly. It needs to be formatted like:<br> xxxx-xxxx-xxxx-xxxx", "warning");
        return false; 
    }

    $("#disable-mfa-button").addClass("loading");
    
    if (mfaCode.length < 8) {
        // using mfa code
        
        breadcrumb('[MFA] Will use MFA Code to disable MFA...');

        var reAuthorized = await reAuthUser(currentPass, mfaCode);
        
        if (!reAuthorized) { 
            // warning popups are sent in reauth already
            $("#disable-mfa-button").removeClass("loading");
            return false;
        }

        breadcrumb('[MFA] Getting enrolled MFA factors...');

        // get enrolled factors. 
        // when we start supporting webauthn, this will have more options 
        // until then we can safely use the first / default one : 
        let enrollmentID;
        try {
            enrollmentID = await firebase.multiFactor(theUser).enrolledFactors[0].uid;
        } catch (error) {
            handleError("[MFA] Failed to get enrollment id", error);
            createPopup("Looks like we're having a difficulty retrieving your multi-factor configuration or having a connectivity issue. Please make sure your internet connection is stable and try again in a few minutes.", "error");
            $("#disable-mfa-button").removeClass("loading");
            return false; 
        }

        breadcrumb('[MFA] Unenrolling MFA...');
    
        try {
            await firebase.multiFactor(theUser).unenroll(enrollmentID)
        } catch (error) {  
            handleError("[MFA] Failed to unenroll", error);
            createPopup("Looks like we're having a difficulty disabling multi-factor authentication for your account or having a connectivity issue. Please make sure your internet connection is stable and try again in a few minutes.", "error");
            $("#disable-mfa-button").removeClass("loading");
            return false;
        }
    
        await promiseToWait(500);
    
        breadcrumb('[MFA] Getting fresh token after erasing MFA codes...');

        await getFreshToken(theUser);
    
        breadcrumb('[MFA] Will erase MFA codes...');

        try {
            await api("user-mfaEraseCodes");
        } catch (error) {
            handleError("[ERASE OLD RECOVERY CODES] Failed to erase old recovery codes", error);
            return false;
        }

        breadcrumb('[MFA] Unenrolled MFA!');
    
        $("#disable-mfa-button").removeClass("loading");
        $(".show-for-mfa-enabled").hide();
        $(".show-for-mfa-disabled").show();
        createPopup("You have successfully disabled multi-factor authentication for your account. <br><br> We strongly recommend enabling multi-factor authentication on all your accounts, and not just Cryptee.", "success");
        
    } else {
        // using recovery code

        breadcrumb('[MFA] Will use recovery code to disable MFA...');

        let result = await api("user-mfaDisableWithRecoveryCode", null, { recoveryCode : mfaCode });
        if (!result)  {
            createPopup("Looks like we're having a difficulty disabling multi-factor authentication for your account. Please make sure your internet connection is stable, and you typed the recovery code correctly, then try again in a minute.", "error");
            $("#disable-mfa-button").removeClass("loading");
            return false;
        } else {
            $("#disable-mfa-button").removeClass("loading");
            $(".show-for-mfa-enabled").hide();
            $(".show-for-mfa-disabled").show();
            createPopup("Successfully disabled multi-factor auth for your account. <br><br> All your devices are logged out of Cryptee for your security and you'll need to login again once you navigate away from this page.", "success");    
        }

    }

}