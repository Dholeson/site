// Portfolio: the case-study list on /portfolio and one templated case-study
// page (/case?id=...). Both come from data/portfolio.js, so adding a project
// is adding a block there, with no new HTML page.
//
// /portfolio's head (h1, lede, contact buttons) is static HTML that
// npm run sync:owner writes; this file renders only the list into #pf-list.
// /case's <head> is written on the server by functions/case.js; this file
// renders the body into #case-main and keeps document.title in step.
//
// Layout shift: #pf-list and #case-main are held at 100vh while empty, and
// main at the viewport (portfolio.css), so everything arrives in one go into
// held space. Screenshots carry their pixel size. Only real screenshots
// render: an entry without one is a text-only row (from 60em those sit two
// to a line), and an entry without a gallery has no "More views".
//
// A screenshot with imageDark (the step sequencer, a capture of the
// site's own light interface) is a theme pair: two <picture>s in the one
// figure, the light one (.for-light) then the dark one (.for-dark), with the
// same sizes and alt. site.css shows only the current theme's, by the same
// selectors as the dark tokens, so a theme chosen in the footer wins over
// the device, and print shows the light one. Both images are lazy, even on
// the case page, so the hidden one is never fetched. Never a <source> whose
// media query asks for the device's colour scheme: it would ignore the
// visitor's choice.

import { profile, work, findWork } from "../data/portfolio.js";
import { esc } from "./esc.js";

const set = v => typeof v === "string" ? v.trim() !== "" : v !== undefined && v !== null;
const caseUrl = id => `/case?id=${encodeURIComponent(id)}`;
const external = href => (/^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener"' : "");

// A real screenshot with its pixel size, or nothing. With imageMobile (a
// crop of the same view in its phone layout), that crop shows below 60em
// and the screenshot from 60em, through one <picture> with one alt. With
// imageDark as well, a pair of those pictures (see the top of this file).
function screenshot(w, cls, eager) {
  if (!set(w.image) || !(w.imageWidth > 0) || !(w.imageHeight > 0)) return "";
  const lazy = eager ? "" : ' loading="lazy"';
  const alt = esc(w.imageAlt || "");
  const m = w.imageMobile;
  const phone = m && set(m.src) && m.width > 0 && m.height > 0;
  const dark = w.imageDark;
  // A dark twin has its light file's size. Half a pair is no pair: without
  // both of its files, the light screenshot shows alone, as before.
  if (dark && set(dark.src) && (!phone || set(dark.mobile))) {
    return `<figure class="${cls}">` +
      themed(w, "for-light", w.image, phone && m.src, alt) +
      themed(w, "for-dark", dark.src, phone && dark.mobile, alt) + "</figure>";
  }
  if (phone) {
    return `<figure class="${cls}"><picture><source media="(min-width: 60em)" srcset="${esc(w.image)}" width="${Number(w.imageWidth)}" height="${Number(w.imageHeight)}">` +
      `<img src="${esc(m.src)}" alt="${alt}" width="${Number(m.width)}" height="${Number(m.height)}"${lazy} decoding="async"></picture></figure>`;
  }
  return `<figure class="${cls}"><img src="${esc(w.image)}" alt="${alt}" width="${Number(w.imageWidth)}" height="${Number(w.imageHeight)}"${lazy} decoding="async"></figure>`;
}

// One member of a theme pair: the same <picture> as above, for one theme's
// files, always lazy. `mobileSrc` is false when the entry has no phone crop.
function themed(w, cls, src, mobileSrc, alt) {
  const m = w.imageMobile;
  const source = mobileSrc
    ? `<source media="(min-width: 60em)" srcset="${esc(src)}" width="${Number(w.imageWidth)}" height="${Number(w.imageHeight)}">`
    : "";
  const [file, width, height] = mobileSrc ? [mobileSrc, m.width, m.height] : [src, w.imageWidth, w.imageHeight];
  return `<picture class="${cls}">${source}<img src="${esc(file)}" alt="${alt}" width="${Number(width)}" height="${Number(height)}" loading="lazy" decoding="async"></picture>`;
}

// "More views": further real views of the product, after What shipped. Each
// is a figure: the laptop view from 60em and its phone layout below, through
// one <picture> with one alt (true of both), then a caption whose first
// words are its title. Lazy: they are below the fold. Only items with a
// real file and its pixel size render; none means no section.
function gallery(w) {
  const sized = x => x && set(x.src) && x.width > 0 && x.height > 0;
  const items = (w.gallery || []).filter(sized);
  if (!items.length) return "";
  return `<div class="case-gallery">${items.map(g => {
    const m = sized(g.mobile) ? g.mobile : null;
    const [title, text] = Array.isArray(g.caption) ? g.caption : [];
    const caption = [set(title) && `<strong>${esc(title)}</strong>`, set(text) && esc(text)].filter(Boolean).join(" ");
    return `<figure><picture>${m
      ? `<source media="(min-width: 60em)" srcset="${esc(g.src)}" width="${Number(g.width)}" height="${Number(g.height)}">`
      : ""}<img src="${esc(m ? m.src : g.src)}" alt="${esc(g.alt || "")}" width="${Number(m ? m.width : g.width)}" height="${Number(m ? m.height : g.height)}" loading="lazy" decoding="async"></picture>${
      caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
  }).join("")}</div>`;
}

const statusLine = w => [w.status, w.year].filter(set).join(", ");
const primaryLink = w => (w.links || []).find(l => l.primary) || null;

// ---------- /portfolio ----------

export function renderPortfolio() {
  const list = document.getElementById("pf-list");
  if (!list) return;
  const main = work.filter(w => w.group !== "earlier");
  const earlier = work.filter(w => w.group === "earlier");
  list.innerHTML = main.map(w => row(w, "h2")).join("") + (earlier.length ? `
    <section class="pf-earlier" aria-labelledby="pf-earlier">
      <h2 id="pf-earlier">Earlier and in progress</h2>
      <div class="pf-group">${earlier.map(w => row(w, "h3")).join("")}</div>
    </section>` : "");
}

// One entry: title, a real screenshot if there is one, then the pitch, how
// it was checked, status and year, and the primary link under its own name.
// No borders: rows are separated by space (portfolio.css).
function row(w, h) {
  const shot = screenshot(w, "pf-media", false);
  const primary = primaryLink(w);
  const status = statusLine(w);
  return `
    <article class="pf-row${shot ? " pf-row--media" : ""}">
      <${h} class="pf-title"><a href="${caseUrl(w.id)}">${esc(w.title)}</a></${h}>
      ${shot}
      <div class="pf-body">
        <p>${esc(w.pitch)}</p>
        ${set(w.checked) ? `<p><span class="quiet">Checked:</span> ${esc(w.checked)}</p>` : ""}
        ${status ? `<p class="quiet">${esc(status)}</p>` : ""}
        ${primary ? `<p><a class="btn-text" href="${esc(primary.href)}"${external(primary.href)}>${esc(primary.label)}</a></p>` : ""}
      </div>
    </article>`;
}

// ---------- /case?id= ----------

export function renderCase() {
  const main = document.getElementById("case-main");
  if (!main) return;
  const id = new URLSearchParams(location.search).get("id");
  const w = id ? findWork(id) : null;

  // "All case studies" is static in case.html (so it exists without this
  // script) and moves under the head block here. Moving a node re-creates
  // it, so it never counts as a layout shift.
  let all = document.querySelector(".case-all");
  if (!all) {
    all = document.createElement("p");
    all.className = "case-all";
    all.innerHTML = '<a class="btn-text" href="/portfolio">All case studies</a>';
  }

  if (!w) {
    document.title = "Case study not found | dhole.dev";
    main.innerHTML = `<header class="page-head case-head"><h1>No case study with that id</h1></header>`;
    const a = all.querySelector("a");
    if (a) a.className = "btn";
    main.append(all);
    return;
  }

  // An old id (alias) shows the case under its current address.
  if (w.id !== id) {
    try { history.replaceState(null, "", caseUrl(w.id) + location.hash); } catch { /* sandboxed */ }
  }
  document.title = `${w.title}: case study | dhole.dev`;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute("content", w.pitch);

  main.innerHTML = `
    <header class="page-head case-head">
      <h1>${esc(w.title)}</h1>
      <p class="case-pitch">${esc(w.pitch)}</p>
    </header>
    <div class="case-grid">
      <div class="case-side">
        ${facts(w)}
        ${buttons(w)}
      </div>
      <div class="case-body">
        ${screenshot(w, "case-shot", true)}
        ${section("The problem", set(w.problem) && `<p>${esc(w.problem)}</p>`)}
        ${section("What shipped", list(w.shipped))}
        ${section("More views", gallery(w))}
        ${section("Decisions", (w.decisions || []).map(d => `<h3>${esc(d.title)}</h3><p>${esc(d.body)}</p>`).join(""))}
        ${section("Outcome", set(w.outcome) && `<p>${esc(w.outcome)}</p>`)}
        ${section("What's next", set(w.next) && `<p>${esc(w.next)}</p>`)}
        ${aside(w)}
        ${contact(w)}
        ${pager(w)}
      </div>
    </div>`;
  main.querySelector(".case-head").after(all);
  stickWhileItFits(main.querySelector(".case-side"));
}

// From 960px the facts column is sticky, but only while it fits under the
// header: a sticky column taller than the viewport would hide its last rows
// and links until the end of the page. Toggling it at scroll 0 moves nothing.
function stickWhileItFits(side) {
  if (!side || typeof matchMedia !== "function") return;
  const wide = matchMedia("(min-width: 60em)");
  const fit = () => {
    const top = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--sticky-top")) || 85;
    side.classList.toggle("is-sticky", wide.matches && side.offsetHeight <= window.innerHeight - top - 16);
  };
  fit();
  window.addEventListener("resize", fit);
}

// Role, For, Status, How to see it, Year, Checked: only the ones that are set.
function facts(w) {
  const rows = [
    ["Role", w.role], ["For", w.users], ["Status", w.status],
    ["How to see it", w.access], ["Year", w.year], ["Checked", w.checked]
  ].filter(([, v]) => set(v));
  if (!rows.length) return "";
  return `<dl class="dl-rows case-facts">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`;
}

// "Note: ..." and "Built with: ...", together.
function aside(w) {
  const lines = [
    set(w.note) && `<p><span class="quiet">Note:</span> ${esc(w.note)}</p>`,
    w.tags && w.tags.length && `<p><span class="quiet">Built with:</span> ${esc(w.tags.join(", "))}</p>`
  ].filter(Boolean);
  return lines.length ? `<div class="case-lines">${lines.join("")}</div>` : "";
}

// Each link under its own name, the primary one first and ink-filled.
function buttons(w) {
  const links = w.links || [];
  const ordered = [...links.filter(l => l.primary), ...links.filter(l => !l.primary)];
  if (!ordered.length) return "";
  return `<div class="btn-row case-links">${ordered.map((l, n) =>
    `<a class="${n === 0 ? "btn-ink" : "btn"}" href="${esc(l.href)}"${external(l.href)}>${esc(l.label)}</a>`).join("")}</div>`;
}

// "Talk to me about this", only once data/portfolio.js has a way to do that.
function contact(w) {
  const ways = [];
  if (set(profile.email)) {
    const mail = esc(profile.email.trim());
    ways.push(`email <a href="mailto:${mail}?subject=${esc(encodeURIComponent(w.title))}">${mail}</a>`);
  }
  if (set(profile.linkedin)) ways.push(`message me on <a href="${esc(profile.linkedin.trim())}"${external(profile.linkedin)}>LinkedIn</a>`);
  if (!ways.length) return "";
  return `<section class="case-contact"><h2>Talk to me about this</h2><p>To ask about ${esc(w.title)}, ${ways.join(" or ")}.</p></section>`;
}

// In list order; the first has no previous and the last no next.
function pager(w) {
  const i = work.indexOf(w);
  const prev = work[i - 1];
  const next = work[i + 1];
  if (!prev && !next) return "";
  return `<nav class="case-pager" aria-label="More case studies">${
    prev ? `<a class="btn-text case-prev" href="${caseUrl(prev.id)}" rel="prev">Previous: ${esc(prev.title)}</a>` : ""}${
    next ? `<a class="btn-text case-next" href="${caseUrl(next.id)}" rel="next">Next: ${esc(next.title)}</a>` : ""}</nav>`;
}

function section(title, html) {
  return html ? `<section><h2>${esc(title)}</h2>${html}</section>` : "";
}

function list(items) {
  return items && items.length ? `<ul>${items.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : "";
}
