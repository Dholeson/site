// Tools that run in the browser. The /projects index (assets/projects-page.js)
// and the home index render one row per entry, in this order.
//
// Every entry is a working page: `demo` is its path, and `cta` is the button
// label, which names the destination ("Open the drift tester"), never "Open
// it" and never with an arrow.
//
//   tagline      one line, for the home index
//   description  the /projects row
//   builtWith    one plain line under the description
//   tags, status, year  kept as data; no page shows them as chips
//   shot         optional. A capture of the tool's own page:
//                { src, width, height, alt, mobile: { src, width, height } }.
//                The mobile crop comes from the tool's phone layout, so it
//                stays readable at 358px wide. width and height are the files'
//                pixel sizes (test/tools.test.js reads them from the headers).
//
// Shots must be real captures of the real page: no mock-ups, no drawings, no
// empty readouts standing in for a result, no account details. The chiptune
// pair is taken by `npm run capture:tools` (scripts/capture-tools.mjs). A tool
// with no real capture has no shot, and its row is text only.

export const projects = [
  {
    id: "drift-tester",
    title: "Controller Drift Tester",
    tagline: "Plug in a controller and measure where its sticks rest when you let go.",
    description:
      "Reads the browser's Gamepad API and plots each stick live. Let go of the sticks and Measure rest samples them for two seconds, then reports how far from centre each one sits and how much it jitters.",
    demo: "/projects/drift-tester",
    tags: ["Gamepad API", "Canvas", "No dependencies"],
    status: "live",
    year: 2026,
    cta: "Open the drift tester",
    builtWith: "Built with the Gamepad API and Canvas. No dependencies."
    // No shot until there is a capture taken with a real controller connected.
  },
  {
    id: "discover-cleaner",
    title: "Discover Cleaner",
    tagline: "Clears songs from your Spotify \"to listen\" playlist once you've heard them.",
    description:
      "A Spotify and Last.fm companion: it removes backlog songs once they've really played, and turns your listening history into reports and artist pages. The demo runs the real interface in your browser on my own listening history, with Spotify simulated.",
    demo: "/projects/discover-cleaner",
    tags: ["Python", "Spotify API", "Last.fm", "SQLite"],
    status: "live",
    year: 2026,
    cta: "Open Discover Cleaner",
    builtWith: "Built with Python, the Spotify API, Last.fm and SQLite.",
    shot: {
      // The demo's Now panel, cropped from the project page's screenshots so
      // the signed-in account name and avatar aren't in it.
      src: "/assets/home/discover-cleaner-now.webp", width: 720, height: 405,
      mobile: { src: "/assets/home/discover-cleaner-now-phone.webp", width: 358, height: 179 },
      alt: "Discover Cleaner's Now panel: the song playing, a countdown to when it clears from the backlog, and Like & clear, Keep in backlog and Clear now buttons"
    }
  },
  {
    id: "chiptune",
    title: "Chiptune Sequencer",
    tagline: "A six-track step sequencer built on raw Web Audio oscillators.",
    description:
      "No samples and no audio library: every sound is a square, triangle or noise generator wired up at runtime. Draw a pattern, change the tempo and waveform, and listen.",
    demo: "/projects/chiptune",
    tags: ["Web Audio", "Sequencer", "No dependencies"],
    status: "live",
    year: 2026,
    cta: "Open the sequencer",
    builtWith: "Built with Web Audio. No dependencies.",
    shot: {
      // /projects/chiptune as it opens, captured by scripts/capture-tools.mjs.
      src: "/assets/home/chiptune.webp", width: 720, height: 405,
      mobile: { src: "/assets/home/chiptune-phone.webp", width: 358, height: 201 },
      alt: "The chiptune sequencer with its preloaded pattern: six tracks of sixteen steps, the transport and tempo controls"
    }
  }
];

export function findProject(id) {
  return projects.find(p => p.id === id) || null;
}
