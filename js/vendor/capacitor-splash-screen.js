// Hand-vendored copy of @capacitor/splash-screen's browser bundle (this
// project has no bundler to wire an npm import into a plain <script> tag —
// see js/splash.js). `capacitorExports` only exists when this page is
// running inside the Capacitor-wrapped native app; guarded so an ordinary
// website visit (this same HTML, opened in a regular browser) doesn't throw
// a ReferenceError trying to register a plugin that has no native side here.
if (typeof capacitorExports !== 'undefined') {
  var capacitorSplashScreen = (function (exports, core) {
      'use strict';

      const SplashScreen = core.registerPlugin('SplashScreen', {
          web: () => Promise.resolve().then(function () { return web; }).then((m) => new m.SplashScreenWeb()),
      });

      class SplashScreenWeb extends core.WebPlugin {
          async show(_options) {
              return undefined;
          }
          async hide(_options) {
              return undefined;
          }
      }

      var web = /*#__PURE__*/Object.freeze({
          __proto__: null,
          SplashScreenWeb: SplashScreenWeb
      });

      exports.SplashScreen = SplashScreen;

      return exports;

  })({}, capacitorExports);
}
