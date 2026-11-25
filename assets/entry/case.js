import { mountChrome } from "../chrome.js";
// Versioned so a copy of the old renderer, cached for up to 600 s under
// /assets/*, can't render into the new page.
import { renderCase } from "../portfolio-page.js?v=2";
mountChrome("portfolio");
renderCase();
