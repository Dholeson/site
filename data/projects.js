// Project showcase.
//
// Every project here is meant to be *usable in the browser* -- that is the
// whole point of the page. `demo` is the path to a working page; anything
// without one is listed as write-up only and says so plainly rather than
// pretending there is something to click.
//
// To add a project: copy a block, drop a page in /projects/, and commit.

export const projects = [
  {
    id: "drift-tester",
    title: "Controller Drift Tester",
    tagline: "Plug in a gamepad and see exactly how far its sticks have wandered.",
    description:
      "Reads the browser Gamepad API and plots stick position live, tracking the resting offset and the worst excursion it sees. I built it to test every controller before it goes in the shop, so the drift claims on a listing are measured rather than guessed.",
    demo: "/projects/drift-tester.html",
    tags: ["Gamepad API", "Canvas", "No dependencies"],
    status: "live",
    year: 2026,
    accent: "#22d3ee"
  },
  {
    id: "chiptune",
    title: "Chiptune Sequencer",
    tagline: "A five-track step sequencer built on raw Web Audio oscillators.",
    description:
      "No samples and no audio library — every sound is a square, triangle, or noise generator wired up at runtime, which is roughly how the consoles downstairs made noise too. Draw a pattern, change the tempo and waveform, and listen.",
    demo: "/projects/chiptune.html",
    tags: ["Web Audio", "Sequencer", "No dependencies"],
    status: "live",
    year: 2026,
    accent: "#fbbf24"
  }
];

export function findProject(id) {
  return projects.find(p => p.id === id) || null;
}
