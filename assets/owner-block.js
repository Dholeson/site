// Who you're dealing with, and how to ask a question.
//
// ownerBlock() is the headed "Who you're buying from" block. It renders only
// once data/owner.js has a firstName: an anonymous block would claim a person
// without naming one, so until then it returns "" and pages show only
// questionLine(), which is always available.
//
// Both return HTML strings; every owner value goes through esc().

import { OWNER } from "../data/owner.js";
import { SUPPORT_EMAIL } from "./store-config.js";
import { displayId } from "./unit-copy.js";
import { esc } from "./esc.js";

const set = v => typeof v === "string" && v.trim() !== "";

// A real photo only: a src and its pixel size, so it holds its space.
function photo(p) {
  if (!p || !set(p.src) || !Number.isInteger(p.width) || !Number.isInteger(p.height) || p.width < 1 || p.height < 1) return "";
  return `<img class="owner-photo" src="${esc(p.src)}" alt="${esc(p.alt || "")}" width="${p.width}" height="${p.height}" loading="lazy">`;
}

export function ownerBlock({ heading = "Who you're buying from" } = {}) {
  if (!set(OWNER.firstName)) return "";
  const where = set(OWNER.place) ? `, in ${esc(OWNER.place.trim())}` : "";
  const about = set(OWNER.about) ? ` ${esc(OWNER.about.trim())}` : "";
  const mail = esc(SUPPORT_EMAIL);
  return `<section class="owner">
  <h2>${esc(heading)}</h2>
  <p>I'm ${esc(OWNER.firstName.trim())}${where}. I run dhole.dev on my own, so email <a href="mailto:${mail}">${mail}</a> and you'll reach me.${about}</p>
  ${photo(OWNER.benchPhoto)}
</section>`.replace(/\n\s*\n/g, "\n");
}

// "Questions about RO-0042? Email support@dhole.dev", with the id in the
// email's subject; or plain "Questions? Email support@dhole.dev".
export function questionLine({ unitId = null } = {}) {
  const mail = esc(SUPPORT_EMAIL);
  if (!set(unitId)) return `<p class="ask">Questions? <a href="mailto:${mail}">Email ${mail}</a></p>`;
  const id = displayId(unitId);
  const subject = encodeURIComponent(`Question about ${id}`);
  return `<p class="ask">Questions about <span class="id">${esc(id)}</span>? <a href="mailto:${mail}?subject=${esc(subject)}">Email ${mail}</a></p>`;
}
