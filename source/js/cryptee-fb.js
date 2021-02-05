var config = {
    apiKey: "AIzaSyBzI3Sr5lx_mhbmmlS8eehdUBfRXb7EyRk",
    authDomain: "flare.crypt.ee",
    projectId: "cryptee-54307"
};

firebase.initializeApp(config);

var firebaseVersion = firebase.SDK_VERSION;

if (firebaseVersion) { setSentryTag("firebase-ver", firebaseVersion); }