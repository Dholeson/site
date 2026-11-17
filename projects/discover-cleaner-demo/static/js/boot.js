// Classic (non-module) script loaded just before main.js so it can catch errors that happen
// while the module graph loads. It:
//  - reads the server config from <script type="application/json" id="app-config"> into
//    window.APP_CONFIG (kept out of inline JS so a strict CSP never breaks it);
//  - records uncaught errors / unhandled rejections in window.__errors and mirrors the count to
//    <body data-js-errors="N"> (the headless check greps for it);
//  - shows a plain message if the app never finishes starting (a script failed to load).
(function () {
  'use strict';
  var errors = window.__errors = window.__errors || [];
  function sync() {
    if (document.body) document.body.setAttribute('data-js-errors', String(errors.length));
  }
  window.__syncJsErrors = sync;

  var cfg = { pollIntervalMs: 3000 };
  try {
    var node = document.getElementById('app-config');
    if (node) {
      var parsed = JSON.parse(node.textContent || '{}');
      for (var k in parsed) if (Object.prototype.hasOwnProperty.call(parsed, k)) cfg[k] = parsed[k];
    }
  } catch (e) { /* keep defaults */ }
  window.APP_CONFIG = cfg;

  window.addEventListener('error', function (ev) {
    // Resource load failures (images etc.) do not reach window listeners; only script errors do.
    errors.push({
      message: String(ev.message || (ev.error && ev.error.message) || 'Script error'),
      source: ev.filename || '',
      line: ev.lineno || 0,
      col: ev.colno || 0,
      stack: (ev.error && ev.error.stack) || '',
      ts: Date.now()
    });
    sync();
  });
  window.addEventListener('unhandledrejection', function (ev) {
    var r = ev.reason;
    if (r && r.name === 'AbortError') return; // a cancelled fetch is not an error
    errors.push({
      message: 'Unhandled rejection: ' + String((r && r.message) || r),
      stack: (r && r.stack) || '',
      ts: Date.now()
    });
    sync();
  });

  sync();
  setTimeout(function () {
    if (window.__appReady) return;
    errors.push({ message: 'The app did not start (a script failed to load).', ts: Date.now() });
    sync();
    var view = document.getElementById('view');
    if (view) {
      view.textContent = '';
      var box = document.createElement('div');
      box.className = 'state state-error';
      var title = document.createElement('div');
      title.className = 'state-title';
      title.textContent = "Discover Cleaner didn't start";
      var body = document.createElement('div');
      body.className = 'state-body';
      body.textContent = 'A script failed to load. Reload the page; if it keeps happening, the classic view still works at /classic.';
      box.appendChild(title);
      box.appendChild(body);
      view.appendChild(box);
    }
  }, 20000);
})();
