// Distinguishes where Bite Book is currently running, so the rest of the
// app (and Insights, via js/track.js) can tell native app / mobile browser /
// desktop browser apart instead of treating every visit the same.
//
// No script tag or setup is needed for the native-app check to work: when
// this same site is loaded inside the Capacitor-wrapped Android/iOS app,
// Capacitor's own runtime injects `window.Capacitor` into the page before
// any of our scripts run — same idea as how `window.webkit` shows up
// automatically inside an iOS WKWebView. Visiting the plain website in an
// ordinary browser never defines that global at all, which is exactly the
// signal used below.
const BiteBookPlatform = (() => {
  function isNativeApp() {
    return typeof window.Capacitor !== 'undefined'
      && typeof window.Capacitor.isNativePlatform === 'function'
      && window.Capacitor.isNativePlatform();
  }

  // Only meaningful once isNativeApp() is false — a phone-sized native app
  // is not "mobile web," it's the app.
  function isMobileWeb() {
    if (isNativeApp()) return false;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  // 'native_app' | 'mobile_web' | 'desktop_web'
  function current() {
    if (isNativeApp()) return 'native_app';
    if (isMobileWeb()) return 'mobile_web';
    return 'desktop_web';
  }

  return { isNativeApp, isMobileWeb, current };
})();
