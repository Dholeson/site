// Web demo only (dist/web-demo, built by dev/build_web_demo.py): the browser's clock starts at
// the moment the demo's listening history was frozen and runs on from there, so "today", "this
// week" and every "3 min ago" match the history instead of the visitor's calendar.
//
// A classic script loaded before boot.js and every module: it replaces window.Date with a
// subclass whose "now" is DEMO_NOW + real time elapsed since the page loaded. new Date(x),
// Date.parse, Date.UTC and instanceof Date behave exactly as before. DEMO_NOW comes from
// <script type="application/json" id="app-config"> (webDemo.now); without it nothing changes.
(function () {
  'use strict';
  var demoNow = 0;
  try {
    var node = document.getElementById('app-config');
    var cfg = node ? JSON.parse(node.textContent || '{}') : {};
    demoNow = Number(cfg && cfg.webDemo && cfg.webDemo.now) || 0;
  } catch (e) { demoNow = 0; }
  if (!demoNow || window.__demoClock) return;

  var RealDate = window.Date;
  var offset = demoNow - RealDate.now();
  var now = function () { return RealDate.now() + offset; };

  function DemoDate() {
    var args = Array.prototype.slice.call(arguments);
    // Date() called as a function returns the current time as a string.
    if (!new.target) return new RealDate(now()).toString();
    return Reflect.construct(RealDate, args.length ? args : [now()], new.target);
  }
  DemoDate.prototype = RealDate.prototype;   // instanceof Date keeps working both ways
  DemoDate.now = now;
  DemoDate.parse = RealDate.parse;
  DemoDate.UTC = RealDate.UTC;
  Object.defineProperty(DemoDate, 'name', { value: 'Date' });

  window.Date = DemoDate;
  window.__demoClock = { realNow: function () { return RealDate.now(); }, offset: offset, RealDate: RealDate };
})();
