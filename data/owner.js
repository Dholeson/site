// Who runs dhole.dev, in the owner's own words. Every field is null until the
// owner fills it in, and a null leaves no trace: no placeholder, no stand-in
// photo, no anonymous "about" block. assets/owner-block.js renders the
// "Who you're buying from" block only once firstName is set; until then pages
// show only the plain question line (questionLine()).
//
// /data/ is always revalidated by the browser, so this file is safe to change
// at any time.

export const OWNER = {
  fullName: null,   // portfolio h1 + og-portfolio.png (then run: npm run sync:owner)
  firstName: null,  // turns on the "Who you're buying from" block; without it only the plain question line shows
  place: null,      // e.g. "Portland, Oregon"
  about: null,      // one sentence in the owner's own words
  benchPhoto: null  // { src, width, height, alt } of a real photo; never a stand-in
};
