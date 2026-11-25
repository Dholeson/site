import { mountChrome } from "../chrome.js";
// Versioned so a copy of the old renderer, cached for up to 600 s under
// /assets/*, can't render into the new page.
import { renderProjects } from "../projects-page.js?v=2";
mountChrome("tools");
renderProjects();
