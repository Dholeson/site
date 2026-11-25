// Portfolio content. One block per project: the /portfolio list, the
// case-study page (/case?id=<id>) and the case page's server-written <head>
// (functions/case.js) are all generated from it.
//
// Written for product-management readers: lead with who it's for, the
// problem, the decisions and how the result was checked. The stack goes last.
//
// Fields
//   id         URL slug (/case?id=)            aliases  old ids that still resolve
//   title      list and page heading           pitch    one or two sentences
//   group      "earlier" lists it under "Earlier and in progress"; leave it
//              unset for the main list
//   kind, year, role, status
//   users      who it's for (one line)         access   how a reviewer can see it
//   checked    how the result was verified, in one or two sentences, built
//              only from figures already stated elsewhere in this file
//              (test/portfolio.test.js checks every number in it)
//   image      optional real screenshot (put files in /assets/portfolio/),
//              with imageWidth and imageHeight (its pixel size, so the page
//              holds its space) and imageAlt. No stand-ins: no image is fine.
//              imageMobile { src, width, height }, optional: the same view in
//              its phone layout, shown below 60em, where a 1440px screenshot
//              is too small to read. imageAlt must be true of both.
//              imageDark { src, mobile }, optional: paths only, for a capture
//              of the site's own light interface taken in the dark theme too.
//              Each file has its light twin's size and name plus "-dark"
//              (image-dark.webp); the page shows the current theme's one.
//              imageMobile and imageDark may name a capture the home page or
//              /projects already uses (/assets/home/, /assets/projects/):
//              shared, not copied.
//   gallery    optional "More views" on the case page, after What shipped:
//              [{ src, width, height, mobile { src, width, height }, alt,
//              caption: [title, text] }]. src is the laptop view (from 60em),
//              mobile its phone layout; alt must be true of both. Real
//              captures only, usually the ones a tool's own page shows.
//   tags       the "Built with" line           links    [{label, href, primary}];
//                                                       a label names where it goes
//   problem    one paragraph                   shipped  bullet list
//   decisions  [{title, body}]: the calls I made and why
//   outcome    one paragraph                   next     one paragraph, optional
//   note       optional caveat
//
// Order here is the order on the page: the strongest work first, then the
// "earlier" group. Only claim what happened. No invented metrics.

export const profile = {
  // Contact buttons only render for fields that are set. The portfolio's
  // head is static HTML, so after changing these run: npm run sync:owner
  email: null,
  resume: null,
  github: "https://github.com/Dholeson",
  linkedin: null
};

export const work = [
  {
    id: "fsca-show-finder",
    title: "FSCA Show Finder",
    pitch: "Every upcoming AKC dog show in one calendar and map, with ring times and judges pulled straight from the published judging programs.",
    kind: "Volunteer work",
    year: 2026,
    role: "Volunteer for the Finnish Spitz Club of America. Product owner: scope, data quality and rollout.",
    users: "Club members, exhibitors, and anyone who wants to meet the breed in person.",
    status: "Live, updates itself twice a day",
    access: "Runs in your browser",
    checked: "Every parser is checked against the index printed in each program (up to 524 of 524 entries matched), and all 274 programs were re-checked after one wrong start time was reported.",
    tags: ["Python", "pdfplumber", "SQLite", "GitHub Actions", "Cloudflare Workers"],
    links: [
      { label: "Open the Show Finder", href: "https://finnishspitzclub.github.io/fsca-events/", primary: true },
      { label: "See it on finnishspitz.org", href: "https://finnishspitz.org/events" }
    ],
    problem:
      "If you want to see a Finnish Spitz in person, or show one, you have to search AKC's event listings and then read each show's judging program PDF to find out when the breed is in the ring. That's a lot of digging just to know when to show up.",
    shipped: [
      "A calendar, map and grid of upcoming shows. Each show has judges, fees, entry details and one-tap calendar export.",
      "A day-of panel: the breed's ring, start time, judge, entry count and how many dogs are ahead.",
      "Printable ring cards, and a breed picker that works for any AKC breed.",
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
        title: "Fix the whole class of bug",
        body: "A user reported a wrong '9 AM' start time. I fixed the cause and re-checked all 274 programs, which corrected times on 9 days of shows."
      }
    ],
    outcome:
      "Live on the club's website, refreshing itself twice a day with no ongoing upkeep."
  },

  {
    id: "discover-cleaner",
    aliases: ["spotify-discover-cleaner"],
    title: "Discover Cleaner",
    pitch: "Clears songs from a Spotify \"to listen\" playlist once you've heard them, so a backlog that only ever grew finally shrinks.",
    kind: "Tools",
    year: 2026,
    role: "Solo: product design, direction and testing.",
    users: "Anyone whose save-for-later playlist only ever grows. Me first.",
    status: "Live demo; open source",
    access: "Demo in your browser",
    checked: "An adversarial verifier confirmed 171 of the bugs about 20 agents reported and refuted 5. 444 automated tests. April 2026 plays within 2 of Last.fm's report (661 vs 659).",
    image: "/assets/portfolio/discover-cleaner.webp",
    imageWidth: 1440,
    imageHeight: 900,
    imageAlt: "Discover Cleaner's Now page: the song playing, a countdown to when it clears from the backlog, and Like, Keep and Clear now buttons.",
    imageMobile: { src: "/assets/portfolio/discover-cleaner-phone.webp", width: 374, height: 491 },
    // The three views /projects/discover-cleaner shows, with its alts and
    // captions word for word (its files, shared).
    gallery: [
      { src: "/assets/projects/discover-cleaner/insights-report.webp", width: 1440, height: 900,
        mobile: { src: "/assets/projects/discover-cleaner/insights-report-phone.webp", width: 748, height: 962 },
        alt: "A monthly Insights report: plays per day and the month's totals against the month before",
        caption: ["Insights.", "Reports for any week, month, year or all time, compared with the period before."] },
      { src: "/assets/projects/discover-cleaner/artist.webp", width: 1440, height: 900,
        mobile: { src: "/assets/projects/discover-cleaner/artist-phone.webp", width: 748, height: 1234 },
        alt: "The artist page for Dance Gavin Dance: plays, rank, first and last listen, longest streak",
        caption: ["Artist page.", "Your plays, rank, first and last listen, and streaks for every artist."] },
      { src: "/assets/projects/discover-cleaner/library-backlog.webp", width: 1440, height: 900,
        mobile: { src: "/assets/projects/discover-cleaner/library-backlog-phone.webp", width: 748, height: 678 },
        alt: "The backlog in Library: tracks left, tracks cleared, and the auto-clear switch",
        caption: ["Library.", "The backlog itself: how many tracks are left, how many have cleared, and whether auto-clear is on."] }
    ],
    tags: ["Python", "Flask", "SQLite", "Vanilla JS", "Spotify API", "Last.fm API", "Agent orchestration"],
    links: [
      { label: "Open the Discover Cleaner demo", href: "/projects/discover-cleaner-demo/", primary: true },
      { label: "Source on GitHub", href: "https://github.com/Dholeson/spotify-discover-cleaner" }
    ],
    problem:
      "My backlog playlist of Discover Weekly finds had grown to 1,187 tracks. About 30 new songs arrive every week, and nothing removed the ones I'd already heard, so the list only grew. An earlier version of this app was meant to fix that; the rebuild started by finding out why it hadn't.",
    shipped: [
      "Clears a song from the backlog once it has really played, and always shows what will happen to the song playing and when. Keep, clear now, like and undo are one tap away.",
      "Reports for any week, month, year or all time, and a page for every artist, from one ledger of 49,548 plays going back to 2021.",
      "Three ways to try it: a live demo of the real interface that runs in the browser, an offline mode, and a guided setup for your own Spotify developer app.",
      "444 automated tests, and the source on GitHub."
    ],
    decisions: [
      {
        title: "Audit before rebuilding",
        body: "About 20 AI agents audited the existing app in parallel: code readers, a data analyst and a hands-on UX reviewer. Every bug they claimed went to an adversarial verifier before anything was fixed: 171 were confirmed and 5 refuted. Among them: the app could only ever see 500 of the 1,187 backlog tracks, so 58% of them could never be cleared; the Last.fm sync had silently stopped in May; and the settings API returned secrets to the browser."
      },
      {
        title: "Earn trust in the numbers",
        body: "The audit found 29% of scrobbles filed under the wrong day (UTC instead of local time) and removals counted twice. Reports now read from one ledger that merges Last.fm scrobbles with the app's own plays and counts each listen once. Its April 2026 total is within 2 plays of Last.fm's own report for that month (661 vs 659)."
      },
      {
        title: "Fail safe on anything destructive",
        body: "Removing songs from someone's playlist is the one thing it must not get wrong. Nothing is removed until the app has read the whole playlist, a removal that fails is queued and retried, and every clear can be undone for 30 minutes, back in its original position. Testing runs against a simulated Spotify, so a test can never delete a song from a real playlist."
      },
      {
        title: "Design around the platform's rules",
        body: "Spotify's February 2026 rules allow 5 users per developer app, require the app's owner to have Premium, and reserve wider access for large businesses. That rules out a hosted 'log in with Spotify' site, so it ships three ways in instead: a static demo that runs in the browser, an offline mode, and a guided setup for your own Spotify app."
      }
    ],
    outcome:
      "Rebuilt and open source, with 444 automated tests. Anyone can try the real interface in the browser, with no account and nothing to install.",
    note: "Not affiliated with or endorsed by Spotify. The demo's listening history is my own, frozen on October 4, 2026."
  },

  {
    id: "drift-tester",
    title: "Controller Drift Tester",
    pitch: "Plug in a controller and get a measured number for how far its sticks rest off-centre.",
    kind: "Tools",
    year: 2026,
    role: "Solo: concept, direction and testing.",
    users: "Me as a seller, and buyers who want to know what they're getting.",
    status: "Live",
    access: "Runs in your browser",
    tags: ["Gamepad API", "Canvas", "No dependencies"],
    links: [{ label: "Open the drift tester", href: "/projects/drift-tester", primary: true }],
    problem:
      "Used controllers get sold as \"no drift\" because someone wiggled the stick and shrugged. I wanted a number I could put in a listing.",
    shipped: [
      "A live view of each stick the controller reports.",
      "A 2-second rest test: let go of the sticks and it measures how far off-centre they sit and how much they jitter."
    ],
    decisions: [
      {
        title: "Replace an adjective with a number",
        body: "The rest test turns \"no drift\" into a measured resting offset, and it's the same test for every controller."
      }
    ],
    outcome: "Live.",
    note: "Needs a controller plugged in."
  },

  {
    id: "halo-debrief",
    title: "Debrief",
    pitch: "Halo Infinite analytics that answer the questions a player has: how should I play this map, and what should I fix?",
    kind: "Web apps",
    year: 2026,
    role: "Solo: product design, direction and testing.",
    users: "Halo players who want to improve, starting with me, plus anyone I scout or share a view with.",
    status: "Live, updating itself",
    access: "Runs in your browser",
    tags: ["Python", "GitHub Actions", "GitHub Pages", "Vanilla JS"],
    links: [
      { label: "Open Debrief", href: "https://dholeson.github.io/halo-reporting/", primary: true },
      { label: "Source on GitHub", href: "https://github.com/Dholeson/halo-reporting" }
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
        title: "Organise around moments of use",
        body: "The product is built around when you'd use it: loading into a match (Briefing) and after a session (Debrief and Coach)."
      },
      {
        title: "Show how sure each finding is",
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
    id: "fsca-site",
    title: "finnishspitz.org refresh",
    pitch: "Restructured the Finnish Spitz Club of America's website so it reads as the breed's official, educational voice.",
    kind: "Volunteer work",
    year: 2026,
    role: "Volunteer: positioning, content, structure and email setup",
    users: "Prospective owners, club members and the board.",
    status: "Live",
    access: "Live website",
    tags: ["Clubistry CMS", "Information architecture", "Copywriting"],
    links: [{ label: "Visit finnishspitz.org", href: "https://finnishspitz.org", primary: true }],
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
    note: "Content and configuration work in the club's website platform, with no custom code. The engineering side of my FSCA work is the Show Finder."
  },

  {
    id: "lazy-sunday",
    title: "Lazy Sunday",
    pitch: "One-click modded Minecraft for friends: click Play on a web page and you land in the server, mods and all.",
    kind: "Tools",
    year: 2026,
    role: "Solo: design, direction, testing and hosting.",
    users: "Friends of mine, including one who's new to Minecraft and comfortable installing an app but not much else.",
    status: "Live",
    access: "Web page + Windows installer",
    tags: ["C#", "PowerShell", "Cloudflare Workers", "Prism Launcher", "Modrinth"],
    links: [{ label: "See the Lazy Sunday page", href: "/minecraft", primary: true }],
    problem:
      "Modded Minecraft normally means installing a launcher and Java, keeping a mod list in sync by hand, and typing in a server address. That's four ways to lose a new player before they've joined, and my least technical friend was the one I was building it for.",
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
    id: "chiptune",
    title: "Chiptune Sequencer",
    pitch: "A six-track step sequencer where every sound is generated live. No samples, no audio library.",
    kind: "Tools",
    year: 2026,
    role: "Solo: concept and direction.",
    status: "Live",
    access: "Runs in your browser",
    tags: ["Web Audio API", "No dependencies"],
    // /projects/chiptune mid-playback, in both themes (npm run capture:tools).
    // The phone crop and its dark twin are the home and /projects row's files.
    image: "/assets/portfolio/chiptune-playing-wide.webp", imageWidth: 1440, imageHeight: 810,
    imageAlt: "The chiptune sequencer playing its preloaded pattern, with a dashed outline on the step being heard",
    imageMobile: { src: "/assets/home/chiptune-playing-phone.webp", width: 358, height: 360 },
    imageDark: { src: "/assets/portfolio/chiptune-playing-wide-dark.webp", mobile: "/assets/home/chiptune-playing-phone-dark.webp" },
    links: [{ label: "Open the sequencer", href: "/projects/chiptune", primary: true }],
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
  },

  // ---------- Earlier and in progress ----------

  {
    id: "osrs-skills",
    group: "earlier",
    title: "OSRS Skills Rebuild",
    pitch: "Twelve Old School RuneScape skills rebuilt on an open-source server emulator by running a team of parallel AI agents, with me as lead and QA.",
    kind: "Games",
    year: 2026,
    role: "Lead: direction, playtesting and debugging. Built with parallel AI coding agents.",
    users: "Me: a private sandbox for practising boss fights and skilling.",
    status: "Paused at a milestone; 27 features verified",
    access: "Private, local only",
    checked: "27 features verified in-game by hand, which caught an XP table where level 99 came out as 73.",
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
    group: "earlier",
    title: "dhole.dev Store",
    pitch: "A storefront for refurbished retro consoles, with a card checkout designed so a buyer can't be overcharged and I can't be underpaid.",
    kind: "Web apps",
    year: 2026,
    role: "Solo: design, direction and deployment.",
    users: "Buyers of tested retro hardware, and me as the seller who'd absorb any pricing mistake.",
    status: "Built; payments being connected",
    access: "Runs in your browser",
    tags: ["Cloudflare Pages", "Stripe Checkout", "Automated tests"],
    links: [
      { label: "See the store", href: "/store", primary: true },
      { label: "Source on GitHub", href: "https://github.com/Dholeson/site" }
    ],
    problem:
      "Take card payments without running a server, and without the price ever being something a buyer could tamper with.",
    shipped: [
      "Catalogue, product pages, a cart and Stripe checkout.",
      "Live stock from my refurbishing app: each unit is listed once, with photos of that unit, and held while its buyer pays.",
      "One source for each price that both displays it and charges it (the catalogue file for new stock, the store's database for refurbished units), so the two can never disagree.",
      "Automated tests on the money path, including one proving a tampered price is ignored."
    ],
    decisions: [
      {
        title: "Remove the risk at the source",
        body: "The buyer's browser never sends a price, only what they want and how many. The server looks up the price itself, so editing the page can change what you order but never what it costs."
      },
      {
        title: "Write the gap down and ship",
        body: "Units are held during checkout, so two people can't buy the same one, except at one edge: a payment that completes just as its hold runs out, while a second buyer takes the unit. Both sales are recorded and the unit is flagged as sold twice, so the second buyer gets a full refund. At this volume that's a known, written-down risk."
      }
    ],
    outcome: "Built and tested. Card payments are being connected before launch.",
    next: "Connect payments."
  },

  {
    id: "leagueify",
    group: "earlier",
    title: "Leagueify",
    pitch: "A player-development campaign for ranked League of Legends: the scoreboard you need, with coaching built on your own matches.",
    kind: "Web apps",
    year: 2026,
    role: "Solo: product design and direction.",
    users: "Ranked League players who want to improve deliberately, starting with me.",
    status: "Working; mid-migration to the cloud",
    access: "Private, demo on request",
    checked: "22 tests run the old and new storage side by side, and all 1,523 stored matches come back identical.",
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
        title: "Build around a campaign",
        body: "The core idea is that improvement needs a goal and a measure over time."
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
    id: "darkroom",
    group: "earlier",
    title: "Darkroom",
    pitch: "A short first-person narrative game about one night, a coastal town and a roll of film.",
    kind: "Games",
    year: 2026,
    role: "Solo: direction, story and playtesting.",
    status: "In progress: playable start to finish",
    access: "Windows build, on request",
    checked: "Over 3,300 automated tests, plus an automated run that plays through the whole night.",
    tags: ["Godot 4", "three.js", "Automated testing"],
    links: [],
    problem:
      "Make a small, atmospheric story game that holds together from title screen to end card, and keep its look intact while moving it from a browser prototype to a full game engine.",
    shipped: [
      "The whole night, playable from title to end card across 18 story beats.",
      "A first-person body: you see your character's hands.",
      "A Windows build that's produced and smoke-tested automatically."
    ],
    decisions: [
      {
        title: "Prototype cheap, then commit",
        body: "It started as a quick browser prototype in three.js, then moved to the Godot engine, with the prototype kept as the reference for how it should look."
      },
      {
        title: "Match the look by measurement",
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
  }
];

// Case-study links get sent out in applications, so a renamed id stays
// reachable through `aliases`.
export function findWork(id) {
  return work.find(w => w.id === id || (w.aliases || []).includes(id)) || null;
}
