---
form: design
form-version: 1
state: filled
points-to: null
evidence:
  - README.md@54f6eab
  - apps/galaxy/README.md@3dc7bdb
  - packages/design/README.md@cdcb27b
  - packages/design/tokens.css@0f40a8f
  - packages/design/fonts.css@9ee3aa6
  - packages/design/src/tokens.ts@3e8e329
  - packages/design/src/fonts.ts@075e53f
  - packages/design/src/palette.ts@cc4f6df
  - packages/design/src/draw.ts@a129057
  - packages/design/src/brand.ts@252ab72
  - apps/galaxy/app/layout.tsx@1f4bc89
  - apps/galaxy/app/app/layout.tsx@240c4a5
  - apps/galaxy/app/design/page.tsx@1fc58aa
  - apps/galaxy/src/design-system.test.ts@fa0f19f
  - apps/galaxy/src/page-width.test.ts@7302b0d
  - apps/galaxy/src/home/lingo.ts@451d655
  - apps/galaxy/src/home/press-start-guard.test.ts@0ec2faa
  - apps/galaxy/src/home/poster/Poster.tsx@a29c227
  - apps/galaxy/src/home/home.css@21785f0
  - apps/galaxy/src/ask/theme-tokens.ts@e980c91
  - apps/galaxy/src/ask/theme.ts@0fd40b2
  - apps/galaxy/src/ask/ask.css@08fdf34
  - apps/galaxy/src/arcade/theme.ts@a750c73
  - apps/galaxy/src/arcade/arcade.css@dbcdeab
  - apps/galaxy/src/arcade/deep-link.ts@736d552
  - apps/galaxy/src/nav/AppShell.tsx@ac75b75
  - apps/galaxy/scripts/shots.ts@b48bee0
invaded: 2026-10-10
---

# Design

Use this page when you build or review a screen. The product wins over the craft floor and the refuse list.

What this page says the product is, how its design system is laid out and what it does on purpose
overrides any general rule of craft: a rule of the craft floor or of the refuse list that this page
sets aside is set aside here. A repository whose design system is already written down points this
form, or one section of it, at that page with a `See:` line.

## Product
<!-- slot: product · required · by: invade -->
- **What it is.** Omni Loop turns product plans into delivered software: a PM writes a PRD, coding
  agents deliver it in waves and slices, and a person always merges (`README.md`). On top of it sits
  a game: each PRD is a planet the fleets terraform together, and open questions and stuck slices
  are Entropy (`README.md`, `apps/galaxy/README.md`).
- **Who uses its screens, in three places.** HOME at `/` is the front door for a visitor who has
  never heard of the loop, drawn as a retro print ad (`apps/galaxy/src/home/poster/Poster.tsx`).
  The arcade at `/play` is for a signed-in member, a **player** with a fleet and a hero, from the
  keyboard on a computer and from a Game Boy's buttons on a phone (`apps/galaxy/README.md`). The
  app pages under `/app`, `/prd`, `/ask`, `/docs` and `/knowledge` are a reading surface for the
  people who run the loop: PMs, engineers and reviewers reading dossiers, answering questions and
  following their dashboard (`apps/galaxy/src/ask/ask.css`, `apps/galaxy/app/app/layout.tsx`).
- **Voice.** HOME speaks plain words first and glosses the loop's terms once, in the strategy
  guide's sidebar: PRD, SLICE and OUTBOX (`apps/galaxy/src/home/lingo.ts`). Its prose never says
  `phase-0`, `worktree`, `sub-PR`, `dossier`, `territory` or `yolo`, and a test holds it to that
  (`lingo.ts`). The arcade speaks in capitals, in short game lines (`LINK GITHUB TO EARN XP`,
  `REACH LV 2 TO PLAY`, `SCORE NOT SAVED`: `apps/galaxy/README.md` › The game room). The app pages
  speak in sentences, and say what is not there and why (`The dashboard is not open here`).
- TODO(human): the list of words HOME never says is HOME's own (`lingo.ts`): the app pages say
  `dossier` on purpose. Is there a list of words the whole product avoids, for the word pass to
  read? None is written here until a person says which words, and where.
- TODO(human): under what light and on which screens are the app pages read (a desk, a phone in a
  meeting)? Nothing in the tree says.

## System
<!-- slot: system · required · by: invade -->
See: DESIGN.md

## Deliberate
<!-- slot: deliberate · optional · by: invade -->
- **Pixel art, at whole-number scales only.** The crest and every sprite are drawn at 1×, 2×, 3×…,
  never smoothed, never resized by CSS to a fraction, rendered `pixelated`
  (`packages/design/README.md` › Brand rules; `apps/galaxy/src/arcade/arcade.css`).
- **The pixel faces are the game's.** Press Start 2P for labels and the HUD, Jersey 10 for longer
  game text; Anton slanted 12° for ad headlines; Atkinson Hyperlegible Next for reading copy;
  JetBrains Mono for code (`packages/design/README.md` › Fonts). On the app pages the pixel face
  appears in the header wordmark only (`apps/galaxy/src/ask/ask.css`).
- **No third-party font request:** every face is served from the app's own origin
  (`apps/galaxy/app/layout.tsx`, held by `design-system.test.ts`).
- **The app pages are a reading surface, not the arcade:** a face drawn for legibility at 17 px on
  1.6, and the galaxy's colours used only as signals (`apps/galaxy/src/ask/ask.css`).
- **HOME is a retro print ad:** a text column in the ad's purple beside a starfield, the Star Fox
  split (`apps/galaxy/src/home/poster/Poster.tsx`). Every link from HOME to the game is a PRESS
  START, so a click opens SELECT YOUR APP (`apps/galaxy/src/home/press-start-guard.test.ts`).
- **On a phone the arcade is a Game Boy:** edge to edge, and never zoomed by a pinch or a double tap
  (`apps/galaxy/app/layout.tsx`).
- TODO(human): the root layout's viewport (`maximumScale: 1`, `userScalable: false`) is set for the
  Game Boy, and the app pages under `/app` inherit it: their layout overrides only the theme colour
  (`apps/galaxy/app/app/layout.tsx`). Is turning off zoom on the reading pages on purpose?
- TODO(human): HOME's poster carries a kicker above its headline, `★` glyphs before its promises,
  and hard offset shadows (`box-shadow: 3px 3px 0 var(--magenta)`, `apps/galaxy/src/home/home.css`),
  all on the craft floor's refuse list. They read as the print ad's; is each of them on purpose?

## Review
<!-- slot: review · optional · by: invade -->
- **Routes.** HOME `/`; the arcade `/play`, whose screens open by hash (`/play#menu`,
  `/play#games`, `/play#map`, `/play#planet-<owner>/<repo>/<n>`: `DEEP_LINKS` in
  `apps/galaxy/src/arcade/deep-link.ts`); the dashboard `/app`; a PRD's page `/prd/<id>`, its tabs
  by `?tab=`; the design system `/design`.
- **Widths.** The screenshot script shoots 393×700 (a phone upright, with its small-text report),
  852×393 (a phone sideways) and 1440×900 (a mouse) (`apps/galaxy/scripts/shots.ts`,
  `pnpm galaxy:shots`, with `pnpm galaxy:dev` running). The app pages change at 900 px (the gutter,
  the pinned PRD header from 900 × 700: `apps/galaxy/src/ask/ask.css`). The arcade draws on a wide
  640×360 grid or a tall 320×288 one (`apps/galaxy/README.md` › Three forms, two grids).
- **Themes.** The app pages are shot in each of Omni, Light and Dark (`scripts/shots.ts`).
- **Signing in.** `pnpm galaxy:dev` plays the demo world, signed in as the demo's *you*, with no
  database (`README.md`, `scripts/shots.ts`). On a deployment, the proof setup's
  `node .omni-loop/bin/omni.mjs proof session` writes the signed-in browser state from the person's
  own `omni signin` (`.omni-loop/config.yml`'s `proof`).

## Language
<!-- slot: language · optional -->
<!-- The product's screen grammar: its laws, which win over the craft floor as the rest of this
page does. Each law is a heading, then its lock line, then the law, then any amendments below it:

  ### <the law>
  🔒 <YYYY-MM-DD> · @<login> · "<their words>"

  <the law, in a sentence or two>

  #### Amended <YYYY-MM-DD> · @<login> · "<their words>"

A law is changed only by a dated amendment below it, never by rewriting it.
Only a person locks a law, in their own words: no agent writes one on its own. -->
