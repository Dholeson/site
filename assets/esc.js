// HTML-escape a value before putting it in an innerHTML template.
// Site copy is authored in this repo rather than submitted by anyone, but
// escaping costs nothing and stops a stray quote or ampersand in a title from
// breaking the markup.
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}
