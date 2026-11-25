import { mountChrome } from "../chrome.js";
// Versioned so a copy of the old renderer, cached for up to 600 s under
// /assets/*, can't render into the new page.
import { renderPortfolio } from "../portfolio-page.js?v=3";
mountChrome("portfolio");
renderPortfolio();
