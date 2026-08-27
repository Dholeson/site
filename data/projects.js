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
    id: "gen1-save-reader",
    title: "Gen I Save Reader",
    tagline: "Drop a Pokémon Red, Blue, or Yellow save and read every byte of it.",
    description:
      "A Gen I save is a raw 32 KB SRAM dump with no container format — the Pokédex is two bitfields, money is binary-coded decimal, and names use a character map that isn't ASCII. This reads all of it and reports dex completion three ways, because Gen I has three honest answers to \"what is 100%?\". I use it to check a cartridge's save is intact before it goes in the shop; a failing checksum usually means the save battery is on its way out. The file is parsed in your browser and never uploaded.",
    demo: "/projects/gen1-save-reader.html",
    tags: ["File API", "Binary parsing", "No dependencies"],
    status: "live",
    year: 2026,
    accent: "#34d399"
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
