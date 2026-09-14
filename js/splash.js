// Hides the native splash screen once this page has actually finished
// loading, instead of it dismissing on its own before there's anything to
// see — the gap that showed as a blank white screen during a slow network
// connection. No-op outside the native app: window.Capacitor only exists
// when running inside the Capacitor-wrapped app (see js/platform.js).
(function () {
  function hide() {
    try {
      const SplashScreen = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.SplashScreen;
      if (SplashScreen && typeof SplashScreen.hide === 'function') {
        SplashScreen.hide();
      }
    } catch (err) {
      // A splash-screen hiccup must never block the app underneath it.
    }
  }
  if (document.readyState === 'complete') hide();
  else window.addEventListener('load', hide);
})();
