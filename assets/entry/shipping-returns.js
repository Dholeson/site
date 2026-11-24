import { mountChrome } from "../chrome.js";
import { SUPPORT_EMAIL } from "../store-config.js";
import { esc } from "../esc.js";

mountChrome("store");
// A shop without a way to reach it loses sales; SUPPORT_EMAIL in
// assets/store-config.js turns this line on.
if (SUPPORT_EMAIL) {
  document.getElementById("support").innerHTML =
    `Questions before or after you buy? Email <a href="mailto:${esc(SUPPORT_EMAIL)}">${esc(SUPPORT_EMAIL)}</a>.`;
}
