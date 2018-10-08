

if (isInWebAppiOS || isInWebAppChrome) {
  $(".is-hidden-webapp").hide();
  $(".is-visible-webapp").show();

  // MAKE DELETE ACCT BUTTON IN SETTINGS TAKE YOU TO BROWSER OTHERWISE YOU CAN'T REAUTH FOR DELETION.
  // BUT THAT WOULD MEAN THAT USER NEEDS TO RELOGIN AGAIN.
  // MAYBE INSTEAD MAKE IT SO THAT USER CAN ONLY DELETE FROM DESKTOP ?
}

if (isInWebAppiOS) {
  $(".is-hidden-ios-pwa").hide();
}
