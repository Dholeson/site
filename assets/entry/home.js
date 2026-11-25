import { mountChrome } from "../chrome.js";
// Versioned: home.js is an existing module, and a copy of the old homepage
// renderer cached for up to 600 s under /assets/* looks for elements the new
// index.html doesn't have.
import { renderHome } from "../home.js?v=2";
mountChrome("");
renderHome();
