// Portfolio content. One block per project; the index card and the case-study
// page (case.html?id=<id>) are both generated from it.
//
// Written for product-management readers: lead with who it's for, the
// problem, and the decisions -- the stack is a footnote, not the headline.
//
// Fields
//   id         URL slug                       title, pitch   card + page header
//   kind       filter group                   year, role, status
//   users      who it's for (one line)        access  how a reviewer can see it
//   accent     hex colour for the card        monogram  two letters if no image
//   image      optional screenshot path (put files in /assets/portfolio/)
//   tags       "Built with" chips             links   [{label, href, primary}]
//   problem    one paragraph                  shipped bullet list
//   decisions  [{title, body}] -- the calls I made and why
//   outcome    one paragraph                  next    one paragraph, optional
//   note       optional caveat box
//
// Order here is the order on the page: lead with the strongest work.
// Only claim what actually happened. No invented metrics.

export const profile = {
  // Contact buttons only render for fields that are set.
  email: null,
  resume: null,
  github: "https://github.com/Dholeson",
  linkedin: null
};

const AI = " Built with AI coding agents.";

export const work = [
  {
    id: "fsca-show-finder",
    title: "FSCA Show Finder",
    pitch: "Every upcoming AKC dog show in one calendar and map, with ring times and judges pulled straight from the published judging programs.",
    kind: "Volunteer work",
    year: 2026,
    role: "Volunteer for the Finnish Spitz Club of America. Product owner: scope, data quality and rollout." + AI,
    users: "Club members, exhibitors, and anyone who wants to meet the breed in person.",
    status: "Live, updates itself twice a day",
    access: "Runs in your browser",
    accent: "#e11d48",
    monogram: "FS",
    tags: ["Python", "pdfplumber", "SQLite", "GitHub Actions", "Cloudflare Workers"],
    links: [
      { label: "Open it", href: "https://finnishspitzclub.github.io/fsca-events/", primary: true },
      { label: "On finnishspitz.org", href: "https://finnishspitz.org/events" }
    ],
    problem:
      "If you want to see a Finnish Spitz in person, or show one, you have to search AKC's event listings and then read each show's judging program PDF to find out when the breed is actually in the ring. That's a lot of digging just to know when to show up.",
    shipped: [
      "A calendar, map and grid of upcoming shows. Each show has judges, fees, entry details and one-tap calendar export.",
      "A day-of panel: the breed's ring, start time, judge, entry count and how many dogs are ahead.",
      "Printable ring cards, and a breed picker that works for any AKC breed, not just Finnish Spitz.",
      "Runs itself: it refreshes twice a day and is embedded on the club's own website, with nobody maintaining it."
    ],
    decisions: [
      {
        title: "Wrong is worse than missing",
        body: "Show times come from PDFs in eight different printers' formats, so parsing errors were the biggest risk to trust. Every parser is checked against the index printed in the program itself (up to 524 of 524 entries matched), and anything that contradicts it is hidden rather than shown wrong."
      },
      {
        title: "Be a good guest on someone else's data",
        body: "Pre-loading every breed would have meant about 50 times more requests to AKC. I chose on-demand loading behind a 24-hour cache instead, and later cut the server time per request roughly in half to stay inside the free plan's limits."
      },
      {
        title: "Fix the class of bug, not the ticket",
        body: "A user reported a wrong '9 AM' start time. Rather than patch that one show, I fixed the cause and re-checked all 274 programs, which corrected times on 9 days of shows."
      }
    ],
    outcome:
      "Live on the club's website, refreshing itself twice a day with no ongoing upkeep."
  },

  {
    id: "lazy-sunday",
    title: "Lazy Sunday",
    pitch: "One-click modded Minecraft for friends: click Play on a web page and you land in the server, mods and all.",
    kind: "Tools",
    year: 2026,
    role: "Solo: design, direction, testing and hosting." + AI,
    users: "Friends of mine, including one who's new to Minecraft and comfortable installing an app but not much else.",
    status: "Live",
    access: "Web page + Windows installer",
    accent: "#4ade80",
    monogram: "LS",
    tags: ["C#", "PowerShell", "Cloudflare Workers", "Prism Launcher", "Modrinth"],
    links: [{ label: "See the page", href: "https://dhole.dev/minecraft", primary: true }],
    problem:
      "Modded Minecraft normally means installing a launcher and Java, keeping a mod list in sync by hand, and typing in a server address. That's five ways to lose a new player before they've joined, and my least technical friend was the one I was building it for.",
    shipped: [
      "A one-time Windows installer. After that, clicking Play on the web page launches the game already joining the right server.",
      "Updates happen by themselves on every launch: the app, the launcher and that world's mods.",
      "A pack for Mac, Linux and Steam Deck players that also updates itself.",
      "One step on my side builds every download and the web page's world cards, so adding a world is a single change."
    ],
    decisions: [
      {
        title: "Design for the least technical player",
        body: "The bar was zero terminal steps and zero manual updates. The official launcher can't join a server directly, which ruled it out, so the installer manages its own hidden launcher instead."
      },
      {
        title: "Make trying it cost nothing",
        body: "It installs without admin rights and never touches the player's normal Minecraft setup, so saying yes is low-risk and uninstalling is clean."
      },
      {
        title: "Ship it separately",
        body: "The /minecraft page runs as its own service, so adding or changing a world never risks the rest of dhole.dev."
      },
      {
        title: "Rehearse before go-live",
        body: "Everything was tested end to end on a separate test server, and the go-live step backs up the world before it changes anything."
      }
    ],
    outcome: "Live, after a full end-to-end run on the test world.",
    next:
      "More worlds, and starting a world on demand when someone tries to join. Known gap: the installer isn't code-signed yet, so Windows shows a warning the first time it runs."
  },

  {
    id: "halo-debrief",
    title: "Debrief",
    pitch: "Halo Infinite analytics that answer the questions a player actually has: how should I play this map, and what should I fix?",
    kind: "Web apps",
    year: 2026,
    role: "Solo: product design, direction and testing." + AI,
    users: "Halo players who want to improve, starting with me, plus anyone I scout or share a view with.",
    status: "Live, updating itself",
    access: "Runs in your browser",
    accent: "#38bdf8",
    monogram: "Db",
    tags: ["Python", "GitHub Actions", "GitHub Pages", "Vanilla JS"],
    links: [
      { label: "Open Debrief", href: "https://dholeson.github.io/halo-reporting/", primary: true },
      { label: "Source", href: "https://github.com/Dholeson/halo-reporting" }
    ],
    problem:
      "Halo's own stats screens tell you what happened in one match. They don't tell you where you win, when you start tilting, or what to do differently on the map you're about to load into.",
    shipped: [
      "A pre-match Briefing: pick the map and mode, and get a verdict, your numbers there against your baseline, and a game plan.",
      "A Coach that ranks findings about you: win conditions, tilt, session fatigue, warm-up, time of day and map pool.",
      "Ranked history, matches grouped into play sessions, and a Squad view of who you win with.",
      "Scouting: look up any player and get their newest 300 games in about three minutes."
    ],
    decisions: [
      {
        title: "Organise around moments, not stats",
        body: "The product is built around when you'd use it: loading into a match (Briefing) and after a session (Debrief and Coach), not around a wall of numbers."
      },
      {
        title: "Show confidence, not just findings",
        body: "Every Coach finding carries its evidence and a confidence level, so a pattern from five games isn't presented as if it came from five hundred."
      },
      {
        title: "Every view is a link",
        body: "Filters, presets and saved views live in the URL, so any view can be bookmarked or sent to a teammate."
      },
      {
        title: "No server to babysit",
        body: "It runs entirely on GitHub's free tooling. GitHub's scheduler is unreliable, so the open page also checks for new games itself, more often if you've played recently."
      }
    ],
    outcome: "Live, and keeps itself up to date with no manual steps.",
    note: "Built under Microsoft's Game Content Usage Rules. Not affiliated with or endorsed by Microsoft."
  },

  {
    id: "osrs-skills",
    title: "OSRS Skills Rebuild",
    pitch: "Twelve Old School RuneScape skills rebuilt on an open-source server emulator by running a team of parallel AI agents, with me as lead and QA.",
    kind: "Games",
    year: 2026,
    role: "Lead: direction, playtesting and debugging. Built with parallel AI coding agents.",
    users: "Me: a private sandbox for practising boss fights and skilling.",
    status: "Paused at a milestone; 27 features verified",
    access: "Private, local only",
    accent: "#a3e635",
    monogram: "RS",
    tags: ["Kotlin", "rsmod", "RuneLite plugin", "Agent orchestration"],
    links: [],
    problem:
      "rsmod, the open-source OSRS server emulator, ships the engine but no skills. A practice sandbox meant building all of that game content, which is far more work than one person can do by hand.",
    shipped: [
      "Twelve skills, from woodcutting and fishing to the Draynor rooftop agility course.",
      "Equipment requirements, drop tables, NPC aggression, and test commands that set up any scenario in seconds.",
      "A working process for parallel agents: each in its own workspace under a written protocol, with a live board tracking every feature from built to verified.",
      "A plugin that shows the current test steps inside the game, so sign-off happens where the feature lives."
    ],
    decisions: [
      {
        title: "Run it like a team",
        body: "Agents worked in parallel, each in its own copy of the code under a written set of rules, so they didn't overwrite each other. A shared board made status visible at a glance."
      },
      {
        title: "A human signs off, in context",
        body: "Nothing counted as done until I'd verified it in-game. 27 features passed that bar."
      },
      {
        title: "Find bugs by using the product",
        body: "Playing turned up what automated checks missed: fishing methods that had never worked, an XP table copied from the wrong source (level 99 came out as 73), and a character standing six feet above a wall. I reported the symptoms and traced the causes with the agents."
      },
      {
        title: "Pick a single source of truth",
        body: "Success rates come from the community wiki's raw data, in the same format the engine uses, so there was no conversion step to get wrong."
      }
    ],
    outcome: "Paused after reaching the Draynor rooftop milestone, with 27 features verified in-game.",
    next: "Scoped but not built: the world map, potions, ranged and magic NPCs, and special attacks.",
    note: "A private, local experiment: nothing hosted or distributed, no connection to official servers. Built on the open-source rsmod emulator. Old School RuneScape is © Jagex; this project is not affiliated with Jagex."
  },

  {
    id: "shop",
    title: "dhole.dev Shop",
    pitch: "A storefront for refurbished retro consoles with real card checkout, designed so a buyer can't be overcharged and I can't be underpaid.",
    kind: "Web apps",
    year: 2026,
    role: "Solo: design, direction and deployment." + AI,
    users: "Buyers of tested retro hardware, and me as the seller who'd absorb any pricing mistake.",
    status: "Built; payments being connected",
    access: "Runs in your browser",
    accent: "#8b5cf6",
    monogram: "$",
    tags: ["Cloudflare Pages", "Stripe Checkout", "Automated tests"],
    links: [
      { label: "See the store", href: "/store.html", primary: true },
      { label: "Source", href: "https://github.com/Dholeson/site" }
    ],
    problem:
      "Take card payments without running a server, and without the price ever being something a buyer could tamper with.",
    shipped: [
      "Catalogue, product pages, a cart and Stripe checkout.",
      "One catalogue file that both displays prices and charges them, so the two can never disagree.",
      "16 automated tests on the money path, including one proving a tampered price is ignored."
    ],
    decisions: [
      {
        title: "Remove the risk at the source",
        body: "The buyer's browser never sends a price, only what they want and how many. The server looks up the price itself, so editing the page can change what you order but never what it costs."
      },
      {
        title: "Back up claims with measurements",
        body: "Used-controller listings quote readings from my own Drift Tester rather than 'works great'."
      },
      {
        title: "Document the gap instead of overbuilding",
        body: "Stock doesn't count itself down yet, so two people could buy the last unit minutes apart. At this volume that's a known, written-down risk with a planned fix, not a reason to delay launch."
      }
    ],
    outcome: "Built and tested. Card payments are being connected before launch.",
    next: "Connect payments, replace the illustrations with photos of the actual units (buyers of used hardware expect them), then automatic stock counts."
  },

  {
    id: "fsca-site",
    title: "finnishspitz.org refresh",
    pitch: "Restructured the Finnish Spitz Club of America's website so it reads as the breed's official, educational voice.",
    kind: "Volunteer work",
    year: 2026,
    role: "Volunteer: positioning, content, structure and email setup",
    users: "Prospective owners, club members and the board.",
    status: "Live",
    access: "Live website",
    accent: "#fb7185",
    monogram: "FS",
    tags: ["Clubistry CMS", "Information architecture", "Copywriting"],
    links: [{ label: "Visit the site", href: "https://finnishspitz.org", primary: true }],
    problem:
      "The club's site undersold it. The navigation and About pages didn't hang together, and nothing on the home page said why this club is the place to learn about the breed.",
    shipped: [
      "Reworked navigation and About pages, including checking and correctly stating the club's 501(c)(3) status.",
      "A new home-page hero and a Board page.",
      "Role-based club email addresses."
    ],
    decisions: [
      {
        title: "Lead with positioning",
        body: "The home page now presents the club as the breed's official, educational voice, which is the reason a newcomer should trust it over a search result."
      },
      {
        title: "Make contacts survive turnover",
        body: "Role-based addresses instead of personal ones, so the right person gets the message after a board changeover."
      },
      {
        title: "Audit the plumbing nobody looks at",
        body: "I checked every form and email route on the site and made 11 fixes. One of them: member survey responses had been going to the platform vendor's test address."
      }
    ],
    outcome: "Live on finnishspitz.org.",
    note: "Content and configuration work in the club's website platform, not custom code. The engineering side of my FSCA work is the Show Finder."
  },

  {
    id: "leagueify",
    title: "Leagueify",
    pitch: "A player-development campaign for ranked League of Legends: the scoreboard you actually need, with coaching built on your own matches.",
    kind: "Web apps",
    year: 2026,
    role: "Solo: product design and direction." + AI,
    users: "Ranked League players who want to improve deliberately, starting with me.",
    status: "Working; mid-migration to the cloud",
    access: "Private, demo on request",
    accent: "#eab308",
    monogram: "Lg",
    tags: ["TypeScript", "React", "Riot API", "Claude API", "Cloudflare D1"],
    links: [],
    problem:
      "Ranked League tells you whether you won. It doesn't tell you what to practise, or whether the thing you're practising is getting better.",
    shipped: [
      "A campaign that tracks what you're working on and measures it across your matches.",
      "Match history from Riot's official API, plus live data from the game client while you play.",
      "An AI coach that turns your own history into specific advice."
    ],
    decisions: [
      {
        title: "A campaign, not a scoreboard",
        body: "The core idea is that improvement needs a goal and a measure over time, not just another stats page."
      },
      {
        title: "Migrate without a rewrite",
        body: "Moving to the cloud meant changing how everything is stored. I had the storage put behind a single adapter, so none of the app's roughly 55 endpoints had to change."
      },
      {
        title: "Prove nothing was lost",
        body: "22 tests run the old and new storage side by side, and all 1,523 stored matches come back identical."
      }
    ],
    outcome: "Phase 1 of 5 of the cloud migration is done and tested.",
    next: "Open question: the live in-game features can only run on the player's own PC, so the cloud version needs a small local companion or has to ship without them."
  },

  {
    id: "spotify-discover-cleaner",
    title: "Spotify Discover Cleaner",
    pitch: "Turns a 1,000-song \"to listen\" playlist into a queue that shrinks itself as you actually listen.",
    kind: "Tools",
    year: 2026,
    role: "Solo: product design and direction." + AI,
    users: "Anyone whose save-for-later playlist only ever grows. Me first.",
    status: "Working; runs locally",
    access: "Runs locally, demo on request",
    accent: "#1ed760",
    monogram: "Sp",
    tags: ["Python", "Flask", "Spotify API", "SQLite"],
    links: [],
    problem:
      "Saving music for later is easy. Getting through it isn't. The backlog only grows, and you end up skipping past songs you've already heard.",
    shipped: [
      "Watches what's playing and clears a track from the backlog once you've actually listened to it.",
      "Keep, clear now, like and undo controls.",
      "Listening reports, artist pages and a watchlist."
    ],
    decisions: [
      {
        title: "Only count real listens",
        body: "A track only leaves the backlog once it has played past a threshold (15–30 seconds by default), so skipping a song isn't treated as hearing it."
      },
      {
        title: "Make destructive actions reversible",
        body: "Anything that removes a song can be undone, and the database is backed up automatically before every upgrade."
      },
      {
        title: "Test where mistakes are free",
        body: "It was reviewed in rounds for usability, data consistency, security and accessibility, against a fake Spotify sandbox, so testing could never delete songs from a real playlist."
      }
    ],
    outcome: "Working and running locally."
  },

  {
    id: "darkroom",
    title: "Darkroom",
    pitch: "A short first-person narrative game about one night, a coastal town and a roll of film.",
    kind: "Games",
    year: 2026,
    role: "Solo: direction, story and playtesting." + AI,
    status: "In progress: playable start to finish",
    access: "Windows build, on request",
    accent: "#f97316",
    monogram: "Dr",
    tags: ["Godot 4", "three.js", "Automated testing"],
    links: [],
    problem:
      "Make a small, atmospheric story game that holds together from title screen to end card, and keep its look intact while moving it from a browser prototype to a full game engine.",
    shipped: [
      "The whole night, playable from title to end card across 18 story beats.",
      "A first-person body: you see your character's hands, not a floating camera.",
      "A Windows build that's produced and smoke-tested automatically."
    ],
    decisions: [
      {
        title: "Prototype cheap, then commit",
        body: "It started as a quick browser prototype in three.js, then moved to the Godot engine, with the prototype kept as the reference for how it should look."
      },
      {
        title: "Match by measurement, not taste",
        body: "The Godot version was matched to the prototype by comparing captures side by side. That caught problems nobody would spot by eye, such as colours being quietly rounded off."
      },
      {
        title: "Build the feedback loop into the product",
        body: "One key during a playtest saves a note with a screenshot and the exact game state, so every piece of feedback arrives with the context needed to act on it."
      },
      {
        title: "Test a story like software",
        body: "Over 3,300 automated tests, plus an automated run that plays through the whole night, so a change to one scene can't silently break another."
      }
    ],
    outcome: "Playable start to finish and ready for playtesting.",
    next: "Playtesting, getting frame time under its performance budget, and VR support."
  },

  {
    id: "drift-tester",
    title: "Controller Drift Tester",
    pitch: "Plug in a gamepad and get a measured number for how far its sticks have wandered.",
    kind: "Tools",
    year: 2026,
    role: "Solo: concept, direction and testing." + AI,
    users: "Me as a seller, and buyers who want to know what they're getting.",
    status: "Live",
    access: "Runs in your browser",
    accent: "#22d3ee",
    monogram: "◎",
    tags: ["Gamepad API", "Canvas", "No dependencies"],
    links: [{ label: "Open it", href: "/projects/drift-tester.html", primary: true }],
    problem:
      "Used controllers get sold as \"no drift\" because someone wiggled the stick and shrugged. I wanted a number I could put in a listing.",
    shipped: [
      "A live view of both sticks.",
      "A two-second rest test: let go of the sticks and it measures how far off-centre they sit and how much they jitter, then gives a verdict against a typical in-game dead zone."
    ],
    decisions: [
      {
        title: "Replace an adjective with a number",
        body: "\"No drift\" is a claim. A measured resting offset is evidence, and it's the same test for every controller."
      }
    ],
    outcome: "Every controller listed in the shop is checked with it first.",
    note: "Needs a controller plugged in."
  },

  {
    id: "chiptune",
    title: "Chiptune Sequencer",
    pitch: "A six-track step sequencer where every sound is generated live. No samples, no audio library.",
    kind: "Tools",
    year: 2026,
    role: "Solo: concept and direction." + AI,
    status: "Live",
    access: "Runs in your browser",
    accent: "#fbbf24",
    monogram: "♪",
    tags: ["Web Audio API", "No dependencies"],
    links: [{ label: "Open it", href: "/projects/chiptune.html", primary: true }],
    problem:
      "Make retro-console-style music in the browser from nothing but basic sound waves.",
    shipped: [
      "A 16-step grid across six tracks, with adjustable tempo, waveform and volume."
    ],
    decisions: [
      {
        title: "Fix timing at the root",
        body: "Browser timers aren't precise enough for music; driving the beat off one makes it drift audibly. Notes are scheduled ahead on the audio system's own clock instead, which is precise."
      }
    ],
    outcome: "Live and playable.",
    note: "Turn your sound on."
  }
];

export function findWork(id) {
  return work.find(w => w.id === id) || null;
}
