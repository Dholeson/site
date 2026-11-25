// The portfolio's head block: the h1, the role line, the lede and the contact
// buttons. It is static HTML in portfolio.html, between <!-- owner:start -->
// and <!-- owner:end -->, so link-preview crawlers and readers without
// JavaScript get the name and the contact links too.
//
// scripts/sync-owner.mjs (npm run sync:owner) writes it from data/owner.js
// (fullName) and the profile in data/portfolio.js. test/portfolio.test.js
// holds the block in portfolio.html equal to portfolioOwnerBlock() byte for
// byte, so editing either file without re-running the script fails npm test.
//
//   No fullName:   h1 "Product case studies", and the role folded into the lede
//   With fullName: h1 = the name, p.role "Senior product manager", shorter lede
//   Contact:       a .btn-row with only the profile links that are set
//
// Pure: no Node imports, every owner and profile value goes through esc().

import { esc } from "../../assets/esc.js";

export const OWNER_START = "<!-- owner:start";
export const OWNER_END = "<!-- owner:end -->";

// The block sits inside main > .wrap > .page-head, so its lines are indented
// 8 spaces, and the end marker follows on its own line at the same depth.
const INDENT = "        ";

export const HEADING_NO_NAME = "Product case studies";
export const ROLE = "Senior product manager";
export const LEDE_NO_NAME = "Case studies by a senior product manager: products I've built on my own time by directing AI coding agents. I set the problem and made the calls, and each case study shows how I checked the result.";
export const LEDE_NAMED = "Products I've built on my own time by directing AI coding agents. I set the problem and made the calls, and each case study shows how I checked the result.";

const set = v => typeof v === "string" && v.trim() !== "";
const external = href => (/^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener"' : "");

// The contact links that are set, in display order. Email is the page's one
// main action, so it alone is ink-filled.
export function contactLinks(profile = {}) {
  const p = profile || {};
  return [
    set(p.email) && { field: "email", label: "Email me", href: `mailto:${p.email.trim()}`, ink: true },
    set(p.resume) && { field: "resume", label: "Résumé (PDF)", href: p.resume.trim() },
    set(p.linkedin) && { field: "linkedin", label: "LinkedIn", href: p.linkedin.trim() },
    set(p.github) && { field: "github", label: "GitHub", href: p.github.trim() }
  ].filter(Boolean);
}

// The exact text between the end of the owner:start comment and the start
// of <!-- owner:end -->, line breaks and indentation included.
export function portfolioOwnerBlock(OWNER, profile) {
  const name = OWNER && set(OWNER.fullName) ? OWNER.fullName.trim() : null;
  const links = contactLinks(profile);
  const lines = [`<h1>${name ? esc(name) : HEADING_NO_NAME}</h1>`];
  if (name) lines.push(`<p class="role">${ROLE}</p>`);
  lines.push(`<p class="lede">${name ? LEDE_NAMED : LEDE_NO_NAME}</p>`);
  if (links.length) {
    lines.push(`<div class="btn-row pf-contact">`);
    for (const l of links) {
      lines.push(`  <a class="${l.ink ? "btn-ink" : "btn"}" href="${esc(l.href)}"${external(l.href)}>${esc(l.label)}</a>`);
    }
    lines.push(`</div>`);
  }
  return `\n${lines.map(l => INDENT + l).join("\n")}\n${INDENT}`;
}

// Splits a page around its owner block. Throws when the markers are missing,
// repeated or out of order, so nothing is ever written to the wrong place.
export function ownerRegion(html) {
  const a = html.indexOf(OWNER_START);
  const b = html.indexOf(OWNER_END);
  if (a < 0 || b < 0 || html.indexOf(OWNER_START, a + 1) >= 0 || html.indexOf(OWNER_END, b + 1) >= 0) {
    throw new Error("portfolio.html needs exactly one <!-- owner:start --> and one <!-- owner:end --> marker.");
  }
  const open = html.indexOf("-->", a);
  if (open < 0 || open + 3 > b) throw new Error("portfolio.html: the owner:start comment must close before owner:end.");
  return { before: html.slice(0, open + 3), inner: html.slice(open + 3, b), after: html.slice(b) };
}

export function withOwnerBlock(html, block) {
  const { before, after } = ownerRegion(html);
  return before + block + after;
}
