// Project showcase.
//
// Every project here is meant to be *usable in the browser* -- that is the
// whole point of the page. `demo` is the path to a working page; anything
// without one is listed as write-up only and says so plainly rather than
// pretending there is something to click.
//
// To add a project: copy a block, drop a page in /projects/, and commit.
//
// The homepage's "Browser tools" cards also use, when present:
//   cta        the button label (the projects page keeps "Open it →")
//   builtWith  one plain line under the button, instead of tag chips
//   shot       a real view of the interface: { src, alt, width, height,
//              mobile: { src, width, height } }. The mobile crop comes from the
//              tool's phone layout so its text stays readable at 342px wide.
//              Genuine screens only: no invented results, no account details.

export const projects = [
  {
    id: "discover-cleaner",
    title: "Discover Cleaner",
    tagline: "Clears songs from your Spotify \"to listen\" playlist once you've actually heard them.",
    description:
      "A Spotify and Last.fm companion: it removes backlog songs once they've really played, and turns your listening history into reports and artist pages. The demo runs the real interface in your browser on my own listening history, with Spotify simulated.",
    demo: "/projects/discover-cleaner",
    tags: ["Python", "Spotify API", "Last.fm", "SQLite"],
    status: "live",
    year: 2026,
    accent: "#1ed760",
    cta: "Open Discover Cleaner",
    builtWith: "Built with Python, Spotify API, Last.fm, and SQLite.",
    shot: {
      // The demo's Now panel, cropped from the project page's screenshots so
      // the signed-in account name and avatar aren't in it.
      src: "/assets/home/discover-cleaner-now.webp", width: 720, height: 405,
      mobile: { src: "/assets/home/discover-cleaner-now-phone.webp", width: 358, height: 179 },
      alt: "Discover Cleaner's Now panel: the song playing, a countdown to when it clears from the backlog, and Like & clear, Keep in backlog and Clear now buttons"
    }
  },
  {
    id: "drift-tester",
    title: "Controller Drift Tester",
    tagline: "Plug in a gamepad and see exactly how far its sticks have wandered.",
    description:
      "Reads the browser Gamepad API and plots stick position live, tracking the resting offset and the worst excursion it sees. I built it to test every controller before it goes in the shop, so the drift claims on a listing are measured rather than guessed.",
    demo: "/projects/drift-tester",
    tags: ["Gamepad API", "Canvas", "No dependencies"],
    status: "live",
    year: 2026,
    accent: "#22d3ee",
    cta: "Test controller drift",
    builtWith: "Built with Gamepad API and Canvas. No dependencies.",
    shot: {
      // The tester as it opens, before a controller is plugged in.
      // TODO: replace with a capture taken with a real controller connected.
      src: "/assets/home/drift-tester.webp", width: 1030, height: 580,
      mobile: { src: "/assets/home/drift-tester-phone.webp", width: 684, height: 342 },
      alt: "The drift tester before a controller is connected: the left stick's plot and its X, Y, magnitude, peak and rest readouts"
    }
  },
  {
    id: "chiptune",
    title: "Chiptune Sequencer",
    tagline: "A six-track step sequencer built on raw Web Audio oscillators.",
    description:
      "No samples and no audio library — every sound is a square, triangle, or noise generator wired up at runtime, which is roughly how the consoles downstairs made noise too. Draw a pattern, change the tempo and waveform, and listen.",
    demo: "/projects/chiptune",
    tags: ["Web Audio", "Sequencer", "No dependencies"],
    status: "live",
    year: 2026,
    accent: "#fbbf24",
    cta: "Open the sequencer",
    builtWith: "Built with Web Audio. No dependencies."
  }
];

export function findProject(id) {
  return projects.find(p => p.id === id) || null;
}
