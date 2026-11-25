import { mountChrome } from "../chrome.js";
// Versioned: store.js is an existing module, and a copy of the old shelf
// renderer cached for up to 600 s under /assets/* can't render into the new
// page.
import { renderStore } from "../store.js?v=2";
mountChrome("store");
renderStore();
