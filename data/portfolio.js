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
    id: "fsca-show-finder",
    title: "FSCA Show Finder",
    pitch: "Every upcoming AKC dog show in one calendar, map and grid, with ring times and judges pulled straight from the published judging programs.",
    kind: "Volunteer work",
    year: 2026,
    role: "Volunteer for the Finnish Spitz Club of America. Sole lead: scope, data checks and rollout. Built with AI coding agents.",
    status: "Live, updates twice a day",
    access: "Runs in your browser",
    accent: "#e11d48",
    monogram: "FS",
    tags: ["Python", "pdfplumber", "SQLite", "GitHub Actions", "Cloudflare Workers", "KV"],
    links: [
      { label: "Open it", href: "https://finnishspitzclub.github.io/fsca-events/", primary: true },
      { label: "On finnishspitz.org", href: "https://finnishspitz.org/events" }
    ],
    problem:
      "If you want to see a Finnish Spitz in person, or show one, you have to dig through AKC's event search and then through each show's judging program PDF to find out when the breed is actually in the ring. Most people give up before they get there.",
    built: [
      "A calendar, map and grid of upcoming shows. Each show has judges, fees, entry details and one-tap Google Calendar or .ics export.",
      "A day-of panel: the breed's ring, time, judge, entry count, how many dogs are ahead and the group running order.",
      "Printable ring cards, and a breed picker that works for any AKC breed, not just Finnish Spitz.",
      "A pipeline that pulls from AKC's event search into SQLite and rebuilds twice a day on GitHub Actions, published to GitHub Pages and embedded on the club's site.",
      "A Cloudflare Worker behind the breed picker, with a 24-hour KV cache, rate limiting and a CORS allowlist."
    ],
    hard: [
      {
        title: "Reading judging programs nobody meant to be machine-read",
        body: "Show schedules only exist as PDFs from different printing companies. I wrote one dedicated parser and one shared column-based parser that between them handle eight of those companies' formats. Each parser is checked against the index printed in the program itself, matching up to 524 of 524 entries. Anything that contradicts the index is hidden rather than shown wrong."
      },
      {
        title: "Not hammering someone else's API",
        body: "Pre-fetching every breed would have meant about 50 times more requests to AKC, so the picker fetches on demand behind a cache. Worker CPU time came down from 14–22 ms to 7–10 ms, inside the free-plan limit."
      },
      {
        title: "Fixing a bug a user found",
        body: "A user reported a wrong '9 AM' start time. I fixed the cause and re-checked all 274 programs, which corrected the times on 9 days of shows."
      }
    ],
    outcome:
      "Live on the club's website, refreshing itself twice a day without anyone maintaining it."
  },

  {
    id: "halo-debrief",
    title: "Debrief",
    pitch: "Personal Halo Infinite analytics: pre-game briefings, post-game debriefs and coaching built from your own match history.",
    kind: "Web apps",
    year: 2026,
    role: "Solo: product design, direction and testing. Built with AI coding agents.",
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
    id: "lazy-sunday",
    title: "Lazy Sunday",
    pitch: "One-click modded Minecraft for friends: click Play on a world card and land in the server, mods and all.",
    kind: "Tools",
    year: 2026,
    role: "Solo: design, direction, testing and hosting. Built with AI coding agents.",
    status: "Live",
    access: "Web page + Windows installer",
    accent: "#4ade80",
    monogram: "LS",
    tags: ["C#", "PowerShell", "Cloudflare Workers", "Prism Launcher", "Modrinth", "DNS"],
    links: [
      { label: "See the page", href: "https://dhole.dev/minecraft", primary: true }
    ],
    problem:
      "I wanted to run a modded server (voice chat and cosmetic mods) for friends, including someone new to Minecraft who can install an app but nothing more. Modded Minecraft normally means a launcher, a Java install, a mod list kept in sync by hand, and typing in a server address. That's five ways to lose someone before they've joined.",
    built: [
      "A one-time Windows installer. After that, clicking Play on the web page launches the game already joining the right server.",
      "A helper that updates itself on every launch: it keeps a hidden, checksum-verified copy of Prism Launcher, syncs that world's mods and starts the game.",
      "Everything installs per-user with no admin rights, and never touches the player's normal Minecraft folder.",
      "A pack builder that pins exact mod versions with checksums and outputs every format at once: packwiz, .mrpack, a Prism import for Mac, Linux and Steam Deck players, and the web page's world cards.",
      "A shared base layer of mods (voice chat) that every world inherits.",
      "Server ops: dynamic DNS updated on each start, an SRV record so the port can move without players noticing, a separate test server, and a go-live script that backs up the world first."
    ],
    hard: [
      {
        title: "Getting from a web page to a running game",
        body: "Browsers can't start programs, so the helper registers its own lazysunday:// link type. The official Minecraft launcher has no way to launch straight into a server, so it drives a private Prism Launcher instead."
      },
      {
        title: "Skipping a setup wizard nobody documented",
        body: "Prism's first-run wizard would have stranded a new player. I found the config keys that skip it by reading Prism's source code."
      },
      {
        title: "Shipping without touching the main site",
        body: "The /minecraft page runs as its own Cloudflare Worker with its own strict CSP, so updating worlds never redeploys the rest of dhole.dev."
      }
    ],
    outcome:
      "Live, and tested end to end on a test world before go-live. Next up: more worlds, and starting a world on demand when someone tries to join it."
  },

  {
    id: "shop",
    title: "dhole.dev Shop",
    pitch: "A storefront for refurbished retro consoles with real card checkout, on a static site with one serverless function.",
    kind: "Web apps",
    year: 2026,
    role: "Solo: design, direction and deployment. Built with AI coding agents.",
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
    id: "leagueify",
    title: "Leagueify",
    pitch: "A player-development layer for ranked League of Legends: the scoreboard you actually need, with coaching built on your own matches.",
    kind: "Web apps",
    year: 2026,
    role: "Solo: product design and direction. Built with AI coding agents.",
    status: "Working; moving to the cloud",
    access: "Private, demo on request",
    accent: "#eab308",
    monogram: "Lg",
    tags: ["TypeScript", "React", "Vite", "Express", "zod", "Riot API", "Claude API", "Cloudflare D1"],
    links: [],
    problem:
      "Ranked League tells you whether you won. It doesn't tell you what to practise. I wanted a campaign that tracks what you're working on and measures whether it's improving.",
    built: [
      "A React and Recharts front end over an Express and TypeScript API: about 55 routes and 14 engine modules.",
      "Match data from the Riot API, plus live data from the local League client while you play.",
      "An AI coach that turns your own match history into specific advice, via the Claude API."
    ],
    hard: [
      {
        title: "Moving storage without touching 55 handlers",
        body: "To move from a local JSON store to Cloudflare D1, I put storage behind an adapter that keeps reads synchronous: each request loads what it needs up front and writes back at the end, so no route handler had to change."
      },
      {
        title: "Proving the migration lost nothing",
        body: "Matches were 96% of the data, so they moved to their own table, shrinking the live document from 673 KB to 23.5 KB. 22 tests run both storage backends against real SQLite, and all 1,523 matches round-trip byte for byte."
      }
    ],
    note: "Not public yet: the live-client features need to run on the player's own machine."
  },

  {
    id: "darkroom",
    title: "Darkroom",
    pitch: "A short first-person narrative game about one night, a coastal town and a roll of film, built in Godot.",
    kind: "Games",
    year: 2026,
    role: "Solo: direction, story and playtesting. Built with AI coding agents.",
    status: "In progress: playable start to finish",
    access: "Windows build, on request",
    accent: "#f97316",
    monogram: "Dr",
    tags: ["Godot 4", "GDScript", "three.js", "GUT", "Automated testing"],
    links: [],
    problem:
      "Make a small, atmospheric story game that holds together from title screen to end card, and keep the look consistent while moving it from a browser prototype to a real engine.",
    built: [
      "A full night playable from title to end card, across 18 story beats.",
      "A first-person body: you see the character's own hands and body rather than a floating camera.",
      "In-game developer tools: a playtest-notes key that captures a screenshot plus game state, and a dev board for jumping between beats, swapping line variants, flying the camera and tuning values live.",
      "A headless export pipeline that builds and smoke-tests the Windows build without opening the editor."
    ],
    hard: [
      {
        title: "Porting from three.js without losing the look",
        body: "It started as a three.js browser prototype, then moved to Godot. Instead of eyeballing it, the Godot version was matched to the original by measuring captures side by side. That turned up bugs you'd never spot by eye, such as vertex colours being rounded down to 8 bits."
      },
      {
        title: "Testing a story game",
        body: "Over 3,300 automated tests across two suites, plus an automated self-play run that walks the whole night, so a change to one scene can't silently break another."
      }
    ],
    note: "Unreleased, so there's no public build yet. Happy to share the Windows build or a walkthrough on request."
  },

  {
    id: "osrs-skills",
    title: "OSRS Skills Rebuild",
    pitch: "Twelve Old School RuneScape skills rebuilt on an open-source server emulator, by directing a team of parallel AI coding agents and playtesting their work.",
    kind: "Games",
    year: 2026,
    role: "Lead: direction, playtesting and debugging. Built with parallel AI coding agents.",
    status: "Paused; 27 features verified in-game",
    access: "Private, local only",
    accent: "#a3e635",
    monogram: "RS",
    tags: ["Kotlin", "rsmod", "RuneLite plugin", "Git worktrees", "Agent orchestration"],
    links: [],
    problem:
      "rsmod, the open-source OSRS server emulator, ships the engine but no skills. I wanted a private sandbox to practise boss fights and skilling, which meant building the game content.",
    built: [
      "Twelve skills: woodcutting, mining, firemaking, cooking, fishing, smithing, fletching, thieving, crafting, prayer, runecrafting and agility (the Draynor rooftop course).",
      "Equipment requirements, drop tables, NPC aggression timers, and in-game test commands for setting up any scenario fast.",
      "A coordination system for parallel agents: each one worked in its own git worktree under a written protocol, with a live dashboard of progress.",
      "A RuneLite plugin that shows the current test steps inside the game client, so playtesting and sign-off happened in-game. 27 features passed."
    ],
    hard: [
      {
        title: "Bugs you only find by playing",
        body: "Harpoon and bait fishing had never worked, because they were wired to the wrong menu option. The XP curve had been copied from the wrong codebase, so 'set mining to 99' produced level 73. A character I spotted standing six feet above a wall traced back to a 480-unit height fault."
      },
      {
        title: "Failures that left no trace",
        body: "A menu call left a dialog open, which silently cancelled the next action with nothing in the logs. Finding it meant reproducing it in-game and narrowing it down by hand."
      },
      {
        title: "Matching the real game's numbers",
        body: "Skill success rates come from the community wiki's raw page data, which uses the same out-of-256 form as the engine's own formula, so no conversion step could introduce errors."
      }
    ],
    note: "A private, local experiment: nothing hosted or distributed, no connection to official servers. Built on the open-source rsmod emulator. Old School RuneScape is © Jagex; this project is not affiliated with Jagex."
  },

  {
    id: "spotify-discover-cleaner",
    title: "Spotify Discover Cleaner",
    pitch: "Turns a 1,000-song \"to listen\" playlist into a queue that shrinks itself as you actually listen.",
    kind: "Tools",
    year: 2026,
    role: "Solo: product design and direction. Built with AI coding agents.",
    status: "In daily use",
    access: "Runs locally, demo on request",
    accent: "#1ed760",
    monogram: "Sp",
    tags: ["Python", "Flask", "Spotify API", "SQLite", "ES modules"],
    links: [],
    problem:
      "Saving music to listen to later is easy. Actually getting through it isn't. The backlog only grows, and you end up skipping through songs you've already heard.",
    built: [
      "Watches what's actually playing, and once a track has genuinely played past a threshold (15–30 seconds by default), removes it from the backlog.",
      "Keep, clear now, like and undo controls, so nothing disappears by accident.",
      "Last.fm-style listening reports, artist pages and a watchlist.",
      "Versioned database migrations with automatic backups before each one."
    ],
    hard: [
      {
        title: "Testing against an API you can't break",
        body: "Reviewed in rounds for usability, data consistency, security and accessibility, against a fake Spotify sandbox, so a bug could never delete songs from a real playlist."
      }
    ]
  },

  {
    id: "fsca-site",
    title: "finnishspitz.org refresh",
    pitch: "Restructured the Finnish Spitz Club of America's website so it reads as the breed's official, educational voice.",
    kind: "Volunteer work",
    year: 2026,
    role: "Volunteer: content, structure and email setup",
    status: "Live",
    access: "Live website",
    accent: "#fb7185",
    monogram: "FS",
    tags: ["Clubistry CMS", "Information architecture", "Copywriting", "Email setup"],
    links: [{ label: "Visit the site", href: "https://finnishspitz.org", primary: true }],
    problem:
      "The club's site undersold it: navigation and About pages that didn't hang together, and nothing on the home page that said why this club is the place to learn about the breed.",
    built: [
      "Reworked navigation and the About pages, including checking and stating the club's 501(c)(3) status correctly.",
      "A new home-page hero and a card-grid Board page.",
      "Role-based @finnishspitz.org addresses, so contact details survive board turnover.",
      "An audit of every form and email route on the site, with 11 fixes. One of them: the member survey had been sending submissions to the platform vendor's test address."
    ],
    note: "Content and configuration work in the club's CMS, not custom code. The engineering side of my FSCA work is the Show Finder."
  },

  {
    id: "drift-tester",
    title: "Controller Drift Tester",
    pitch: "Plug in a gamepad and get a measured number for how far its sticks have wandered.",
    kind: "Tools",
    year: 2026,
    role: "Solo: concept, direction and testing. Built with AI coding agents.",
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
    role: "Solo: concept and direction. Built with AI coding agents.",
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
