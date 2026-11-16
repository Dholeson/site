// Portfolio content. One block per project; the index card and the case-study
// page (case.html?id=<id>) are both generated from it.
//
// Fields
//   id        URL slug                       title, pitch   card + page header
//   kind      filter group ("Web apps"...)   year, role, status
//   access    how a reviewer can see it, e.g. "Runs in your browser"
//   accent    hex colour for the card        monogram  two letters if no image
//   image     optional screenshot path (put files in /assets/portfolio/)
//   tags      stack, shown as chips          links     [{label, href, primary}]
//   problem   one paragraph                  built     bullet list
//   hard      [{title, body}] -- the interesting engineering
//   outcome   one paragraph                  note      optional caveat box
//
// Order here is the order on the page: lead with the strongest work.

export const profile = {
  // Contact buttons only render for fields that are set.
  email: null,
  resume: null,
  github: "https://github.com/Dholeson",
  linkedin: null
};

export const work = [
  {
    id: "halo-debrief",
    title: "Debrief",
    pitch: "Personal Halo Infinite analytics: pre-game briefings, post-game debriefs and coaching built from your own match history.",
    kind: "Web apps",
    year: 2026,
    role: "Solo — design, data pipeline and front end",
    status: "Live, updating itself",
    access: "Runs in your browser",
    accent: "#38bdf8",
    monogram: "Db",
    tags: ["Python", "GitHub Actions", "GitHub Pages", "Vanilla JS", "OAuth"],
    links: [
      { label: "Open Debrief", href: "https://dholeson.github.io/halo-reporting/", primary: true },
      { label: "Source", href: "https://github.com/Dholeson/halo-reporting" }
    ],
    problem:
      "Halo's own stats screens tell you what happened in one match. They don't tell you where you win, when you tilt, or what to do differently on the map you're about to load into.",
    built: [
      "An ingest pipeline that pulls every match from Halo Waypoint's unofficial API and stores raw match JSON in the repo, one line per match, so new fields from Halo never break anything.",
      "A static report app with seven views: Overview, a pre-match Briefing (pick map + mode, get a verdict and a game plan), Coach, Maps & Modes, Ranked CSR history, Matches grouped into sessions, and Squad.",
      "A Coach tab that ranks findings with evidence and a confidence level: win conditions, tilt, session fatigue, warm-up, time of day, map pool.",
      "Filters, presets and saved views all live in the URL, so any view is bookmarkable and shareable.",
      "Scouting: search any gamertag from the site and it pulls their newest 300 games in about three minutes, then backfills the rest."
    ],
    hard: [
      {
        title: "No server, still live",
        body: "Everything runs on GitHub: Actions does the ingest on a schedule, Pages hosts the report. GitHub's cron is unreliable, so the open page also triggers checks itself, on an adaptive interval (every 10 minutes if you played in the last 3 hours, every 30 otherwise), and ignores rebuilds whose data digest hasn't changed."
      },
      {
        title: "A four-step Microsoft auth chain in CI",
        body: "Microsoft refresh token → Xbox user token → XSTS → Halo Spartan token, run headlessly in Actions. Microsoft rotates refresh tokens, so each run writes the new token back to the repo's secrets."
      },
      {
        title: "Being a polite API client",
        body: "The API is rate-limited at 2 requests per second per service. The client respects that, backs off on throttling, and gates runs so polls that find nothing don't rebuild or deploy."
      }
    ],
    note: "Built under Microsoft's Game Content Usage Rules. Not affiliated with or endorsed by Microsoft."
  },

  {
    id: "shop",
    title: "dhole.dev Shop",
    pitch: "A storefront for refurbished retro consoles with real card checkout, on a static site with one serverless function.",
    kind: "Web apps",
    year: 2026,
    role: "Solo — design, build and deployment",
    status: "Built; payments being connected",
    access: "Runs in your browser",
    accent: "#8b5cf6",
    monogram: "$",
    tags: ["Cloudflare Pages Functions", "Stripe Checkout", "ES modules", "Node tests"],
    links: [
      { label: "See the store", href: "/store.html", primary: true },
      { label: "Source", href: "https://github.com/Dholeson/site" }
    ],
    problem:
      "Take card payments without running a server, and without letting the browser decide what anything costs.",
    built: [
      "Catalogue, product pages, a persistent cart and Stripe Checkout, all on static hosting plus one Cloudflare Pages Function.",
      "One catalogue file that both renders the store and prices the checkout, so the two can't disagree.",
      "16 tests on the money path, including one proving a client-supplied price is ignored."
    ],
    hard: [
      {
        title: "The browser never sends a price",
        body: "The cart sends product ids and quantities only. The function looks each one up and prices the order server-side, so editing localStorage can change what you order but never what it costs."
      },
      {
        title: "Money is integer cents",
        body: "No floating-point prices anywhere. 14500 is $145.00."
      },
      {
        title: "Strict Content Security Policy",
        body: "No inline scripts anywhere on the site. Every page loads its code from a module, so the CSP can forbid inline script outright."
      }
    ]
  },

  {
    id: "drift-tester",
    title: "Controller Drift Tester",
    pitch: "Plug in a gamepad and get a measured number for how far its sticks have wandered.",
    kind: "Tools",
    year: 2026,
    role: "Solo",
    status: "Live",
    access: "Runs in your browser",
    accent: "#22d3ee",
    monogram: "◎",
    tags: ["Gamepad API", "Canvas", "Vanilla JS", "No dependencies"],
    links: [{ label: "Open it", href: "/projects/drift-tester.html", primary: true }],
    problem:
      "Used controllers get sold as \"no drift\" based on someone wiggling the stick and shrugging. I wanted a reading I could put in a product listing.",
    built: [
      "A live plot of both analogue sticks via the browser Gamepad API, drawn on canvas.",
      "A two-second rest measurement: let go of the sticks and it samples resting offset and jitter, then gives a verdict against a typical in-game deadzone.",
      "Used for real: every controller in the shop is checked with it before listing."
    ],
    note: "Needs a controller plugged in."
  },

  {
    id: "chiptune",
    title: "Chiptune Sequencer",
    pitch: "A six-track step sequencer where every sound is synthesised at runtime. No samples, no audio library.",
    kind: "Tools",
    year: 2026,
    role: "Solo",
    status: "Live",
    access: "Runs in your browser",
    accent: "#fbbf24",
    monogram: "♪",
    tags: ["Web Audio API", "Audio scheduling", "No dependencies"],
    links: [{ label: "Open it", href: "/projects/chiptune.html", primary: true }],
    problem:
      "Make retro-console-style music in the browser from nothing but oscillators and a noise buffer.",
    built: [
      "Square, triangle and noise voices, with adjustable tempo, waveform and volume.",
      "A 16-step grid across six tracks: lead, harmony, alt, bass, snare and hat."
    ],
    hard: [
      {
        title: "Timing that doesn't drift",
        body: "Stepping a sequencer off setInterval drifts audibly, because browser timers aren't sample-accurate. Instead a short timer acts as a lookahead, scheduling upcoming notes directly on the AudioContext clock, which is."
      }
    ],
    note: "Turn your sound on."
  }
];

export function findWork(id) {
  return work.find(w => w.id === id) || null;
}
