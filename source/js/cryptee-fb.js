window.firebase = {};

import { initializeApp, SDK_VERSION } from "firebase/app";
window.firebase.initializeApp = initializeApp;
window.firebase.SDK_VERSION = SDK_VERSION;

import { 
    getAuth,
    signOut,
    deleteUser,
    updateEmail,
    updateProfile,
    updatePassword,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithRedirect,
    signInWithPopup,
    applyActionCode,
    checkActionCode,
    verifyPasswordResetCode,
    sendEmailVerification,
    sendPasswordResetEmail,
    confirmPasswordReset,
    createUserWithEmailAndPassword,
    EmailAuthProvider,
    reauthenticateWithCredential,
    reauthenticateWithRedirect,
    reauthenticateWithPopup,

    TotpSecret,
    multiFactor,
    getMultiFactorResolver,
    TotpMultiFactorGenerator,
} from "firebase/auth";

window.firebase.getAuth = getAuth;
window.firebase.signOut = signOut;
window.firebase.deleteUser = deleteUser;
window.firebase.updateEmail = updateEmail;
window.firebase.updateProfile = updateProfile;
window.firebase.updatePassword = updatePassword;
window.firebase.onAuthStateChanged = onAuthStateChanged;
window.firebase.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.firebase.GoogleAuthProvider = GoogleAuthProvider;
window.firebase.signInWithRedirect = signInWithRedirect;
window.firebase.signInWithPopup = signInWithPopup;
window.firebase.applyActionCode = applyActionCode;
window.firebase.checkActionCode = checkActionCode;
window.firebase.verifyPasswordResetCode = verifyPasswordResetCode;
window.firebase.sendPasswordResetEmail = sendPasswordResetEmail;
window.firebase.sendEmailVerification = sendEmailVerification;
window.firebase.confirmPasswordReset = confirmPasswordReset;
window.firebase.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.firebase.EmailAuthProvider = EmailAuthProvider;
window.firebase.reauthenticateWithCredential = reauthenticateWithCredential;
window.firebase.reauthenticateWithRedirect = reauthenticateWithRedirect;
window.firebase.reauthenticateWithPopup = reauthenticateWithPopup;

window.firebase.TotpSecret = TotpSecret;
window.firebase.multiFactor = multiFactor;
window.firebase.getMultiFactorResolver = getMultiFactorResolver;
window.firebase.TotpMultiFactorGenerator = TotpMultiFactorGenerator;

var config = {
    apiKey: "AIzaSyBzI3Sr5lx_mhbmmlS8eehdUBfRXb7EyRk",
    authDomain: "flare.crypt.ee",
    projectId: "cryptee-54307"
};

window.firebase.initializeApp(config);

var firebaseVersion = window.firebase.SDK_VERSION;

if (firebaseVersion) { setSentryTag("firebase-ver", firebaseVersion); }