// HTML-escape a value before putting it in an innerHTML template.
// Most site copy is authored in this repo, but bench listings (names, blurbs,
// details) arrive from the bench app through /api/store/listings, so every
// value that reaches innerHTML goes through here.
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
