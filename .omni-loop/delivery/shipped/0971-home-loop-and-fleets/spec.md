---
prd: 971
title: HOME tells the loop, the customers and the fleet game
blocked-by: none
spec: file
proof: video
---

# HOME tells the loop, the customers and the fleet game

**Date:** 2026-10-02 · **PRD:** #971 · **Touches:** `apps/galaxy/src/home/Home.tsx`,
`apps/galaxy/src/home/spreads/` (Spreads, StrategyGuide, Game, cards, a new Customers spread and a new
fleets list, their stylesheets and tests; ForYou, SeeEverything, InOut and HighScores removed),
`apps/galaxy/src/home/lingo.ts`, `apps/galaxy/src/home/home.test.ts`,
`apps/galaxy/src/home/lingo.test.ts`, and HOME's walkthrough in `apps/galaxy/README.md`.
**Out of scope:** the poster above the fold, the order form's sign-up and PRESS START, `/play`,
`/docs`, the demo galaxy (`packages/galaxy/src/demo.ts`), the Business settings page and any data.

## Problem

HOME, the front door at `/`, spends most of its length on how the loop works inside instead of on
what a team gets from it:

- **"What's in it for you?"** pitches three job titles before the visitor has seen what the product
  is.
- **The strategy guide** is a grid of seven level cards (1-1 SET UP to 1-6 SHIP, then a KNOWLEDGE
  bonus). It reads as a straight line, when the loop is a loop: the docs draw it as idea → PRD →
  inbox → outbox → shipped → retro, with knowledge flowing back to the next idea
  (`docs/guide/diagrams/loop.svg`). OmniMan "runs the path" as one still frame.
- **"You see everything"** and **"Easy in, easy out"** are implementation details: the outbox, the
  questions page, the knowledge base, `omni init`, `.omni-loop/`, the `statusLine`.
- Nothing says that the agents build **for your customers**: that a team writes down its business,
  its products and the personas it sells to, and that every run reads them.
- **The game** shows the demo galaxy's fleets as cards, one of them (NIGHT OWLS) without a face, and
  never says what a team does with it: create its fleet, ship, and climb. The real counts sit in a
  separate **High scores** strip, cut off from the game they prove.

## Solution

HOME keeps its poster, then four spreads, in this order (`Spreads.tsx`):

1. **Strategy guide: *the loop*** (`StrategyGuide.tsx`, rewritten)
2. **Built for *your customers*** (`Customers.tsx`, new)
3. **The game: *build your fleet*** (`Game.tsx`, rewritten, the counts folded in)
4. **Join *the loop!*** (`OrderForm.tsx`, plus one exit line)

`ForYou`, `SeeEverything`, `InOut` and `HighScores` are deleted with their stylesheets and tests.
HOME stays static: no session, no database, no work per request, and Controls stays the only script
besides the forwarding script and PosterPlanet.

### 1. The strategy guide is the loop

- An inline SVG map, drawn in HOME's arcade look (pixel font, starfield tokens, hard edges) after
  the docs' layout: **IDEA → PRD → INBOX** on the top row, down the right side to **OUTBOX**, then
  back along the bottom row **OUTBOX → SHIPPED → RETRO**, and a dashed **KNOWLEDGE** arrow from
  RETRO up to IDEA, which closes the loop.
- Each stage is a level box: its level (`1-1` to `1-6`), its name, and one plain line:

  | level | stage | line |
  |---|---|---|
  | 1-1 | IDEA | You talk an idea through with Claude. Nothing is written yet. |
  | 1-2 | PRD | The idea becomes a brief and a before/after page. A person approves it before any code exists. |
  | 1-3 | INBOX | Approved and ready to build. |
  | 1-4 | OUTBOX | Agents build it in slices, test-first. Every decision they took without asking waits for your answer. |
  | 1-5 | SHIPPED | A person reviews and merges the feature, never an agent. |
  | 1-6 | RETRO | How the delivery went, and what it taught. |

  The KNOWLEDGE arrow carries ★ BONUS and the line "What you settled becomes the rules the next
  idea starts from."
- Each arrow is coloured by who moves the work on, as in `loop.svg`, with a three-swatch legend:
  YOU (idea → PRD, with Claude; PRD → inbox; outbox → shipped), AGENTS (inbox → outbox), OMNI APP
  (shipped → retro).
- The stage data is one exported list, `LOOP` (stage, level, name, line, mover of the arrow leaving
  it). The SVG and the screen-reader text both come from it. The map has a `<title>`, and an
  `<ol>` of the stages with their lines is in the DOM for screen readers (visually hidden on wide
  screens).
- **Below 720px** the map is redrawn as one vertical column: the six boxes top to bottom, the
  KNOWLEDGE arrow running back up the left edge. It never scrolls sideways.
- **OmniMan runs the loop:** the `omni-run` sprite moves around the path with a CSS animation
  (`offset-path`, or keyframes on the box corners where `offset-path` is not supported). Under
  `prefers-reduced-motion: reduce` it stands still on IDEA. The caption stays: OMNIMAN RUNS THE
  LOOP, ONE LEVEL AT A TIME.
- The LOOP LINGO aside stays beside the map (below it under 720px). It glosses only the terms HOME
  still says, as `lingo.test.ts` already demands: HARNESS leaves with SET UP (set up is a one-time
  step, not a stage of the loop), and WAVE leaves unless a line still says it.

### 2. Built for your customers

- A lead: "The agents don't build for you. They build for your customers. Tell them who those are
  once, and every run reads it."
- A chain of three steps, joined by arrows (a column under 720px):
  1. **BUSINESS**: who you sell to: the size of the companies, the region, the trade, the rivals.
  2. **PRODUCTS**: what you sell them, one product at a time.
  3. **PERSONAS**: the people who use it, each a pixel portrait drawn by `personaGrid` from
     `@omni/design`, with a name, a trade and a stance (EXCITED, NEUTRAL, SKEPTICAL).
- All three are filled with one **invented example company**, labelled EXAMPLE: *Brick & Bolt*,
  software for renovation firms of 5 to 50 people in Europe, up against the spreadsheet. Its product
  is a site diary app. Its personas are a site foreman (skeptical), an office manager (excited) and a
  plumber who subcontracts (neutral). No Vertuoza name, persona or claim appears.
- A closing step, **THE AGENTS READ THEM ON EVERY RUN**, shows one exchange: the skeptical persona
  objects to a design in one first-person sentence, and the answer ("we sell to 5-person crews
  too") becomes a fact the agents keep.
- The spread's data is one exported constant, `EXAMPLE_BUSINESS`, in `Customers.tsx`.

### 3. The game: build your fleet

- A lead: "Ship value to your customers, and score for your fleet while you do."
- Three beats, each a numbered heading:
  1. **CREATE YOUR FLEET**: a fleet is a team with a name, a colour and a mascot. The example fleets
     are trading cards, as today: a mascot, a name and a motto on the front; the colour and one
     scoring rule from the game's rulebook on the back (`cardsOf`, unchanged, so a card never states
     a number the rulebook does not hold). Every card has a mascot.
  2. **SHIP VALUE**: one line on how points come: a secured zone, a rescue, and closed Entropy (an
     unanswered question, stuck work, a shipped bug). Every number is read from `RULEBOOK`.
  3. **CLIMB THE LEADERBOARD**: the example fleets ranked by points, labelled EXAMPLE, then the
     loop's real counts under the heading THE LOOP BUILT THIS: FEATURES SHIPPED, SLICES MERGED,
     DECISIONS ADOPTED (`countHighScores`, unchanged, `—` when a count can't be read), with the note
     that they are counted from Omni Loop's own shipped work each time the page is built.
- **HOME's own example fleets:** `spreads/fleets.ts` exports `EXAMPLE_FLEETS`, five invented fleets
  with names of their own, none of them the demo galaxy's: DAM BUSTERS (beaver), DEEP DIVERS
  (octopod), GOLD DIGGERS (picsou), SPY RING (cia), SEA DOGS (pirate), each with a colour, a motto and
  example points. `Home.tsx` stops calling `demoFleets()`, and `Spreads` stops taking `fleets`.

### 4. Join the loop

Unchanged, plus one line in the fine print: "Leave any time: delete one folder and commit. Nothing
to migrate."

## Decisions

- **Spreads removed:** "What's in it for you?", "You see everything" and "Easy in, easy out" (the
  person asked for it, 2026-10-02: they are implementation details).
- **High scores** fold into the game as its proof, rather than staying a strip of their own or
  leaving HOME (the person picked it).
- **The loop's look:** the docs' loop in the arcade's skin, with OmniMan running around it, rather
  than the docs' SVG reused as is or a circle (the person picked it).
- **Example fleets** are HOME's own, with new names, rather than the demo galaxy's fleets (the person
  said: "The fleet are example we should not use the vertuoza one"). Every fleet has a mascot, so
  the faceless card goes.
- **Fleet spread:** build, ship, climb, rather than a leaderboard alone or the cards with new copy
  (the person picked it).
- **Customers spread:** a Business → Products → Personas chain filled by one invented company,
  rather than a single worked example or a short pitch (the person picked it).
- **SET UP leaves the loop:** it is done once, so it isn't a stage. The docs' loop has no set-up
  stage either.
- **The voice's objection, accepted:** persona:B-E DEv objected: "Fleets and leaderboards on the
  home page are exactly the fluff I expected, and with 'Easy in, easy out' gone I can't see how I'd
  back out of it." The order form keeps one plain exit line (section 4).
- **Proof:** a proof video is recorded once the feature PR is ready (the person said yes).

## User stories

- As a visitor, I see the loop as a loop: an idea goes round to shipped, and what it taught comes
  back to the next idea.
- As a product manager, I see that the agents build for my customers, from the business, products
  and personas my team writes down once.
- As a team lead, I see that my team can create its fleet and compete with other teams while
  shipping, and that the scores are real.
- As a skeptical developer, I still read that leaving costs one folder and one commit.

## Scope

In: the four spreads above, their data constants, styles and tests, HOME's lingo list, and the
README's HOME walkthrough. Out: the poster, the order form's buttons, every other route, the demo
galaxy, the game's rulebook and scoring, and the Business settings page.

## Test seams

Vitest, rendering to static markup (`renderToStaticMarkup`) as HOME's tests do today; no browser, no
GitHub, no Supabase.

- `home.test.ts`: the spreads' h2 texts in order are `Strategy guide: the loop`, `Built for your
  customers`, `The game: build your fleet`, `Join the loop!`; `Spreads.tsx` imports exactly those
  four components; HOME's only links are `/play` and `/docs` (`/releases` left with "You see
  everything").
- `StrategyGuide.test.ts`: `LOOP` lists IDEA, PRD, INBOX, OUTBOX, SHIPPED, RETRO in that order with
  levels 1-1 to 1-6; every arrow's mover is YOU, AGENTS or OMNI APP as in section 1; the SVG has one
  KNOWLEDGE arrow from RETRO to IDEA; every stage line is in the DOM text; OmniMan's `omni-run` pose
  is there; the reduced-motion rule exists in the stylesheet.
- `Customers.test.ts`: BUSINESS, PRODUCTS and PERSONAS appear in that order; each persona renders a
  portrait and a stance; the example is labelled EXAMPLE; no name from the business read of this
  repository (no "Vertuoza", no "vertuo") appears.
- `Game.test.ts`: one card per example fleet, each with a mascot SVG; no demo galaxy fleet label
  (BUILDERS, INKLINGS, COINERS, NIGHT OWLS, CORSAIRS) appears; the leaderboard is sorted by points
  and labelled EXAMPLE; the three real counts render, and `—` when a count is missing.
- `fleets.test.ts`: every example fleet has a mascot the sprite library holds and that
  `RULE_BY_MASCOT` maps.
- `OrderForm.test.ts`: the exit line is there.
- `lingo.test.ts`: HOME's prose still says no banned word, every glossed term is used, and every term
  used is glossed.

## Risks

A merge to `main` publishes HOME, the public front door, through the galaxy's Vercel project
(`apps/galaxy/README.md#deploy-to-production`). Nothing is stored and no data changes. Rollback is
reverting the feature PR. The OmniMan animation is the one new motion on the page: it respects
`prefers-reduced-motion`.

## Acceptance criteria

- HOME shows, under the poster, exactly four spreads in this order: the loop, built for your
  customers, the fleet game, join the loop.
- "What's in it for you?", "You see everything", "Easy in, easy out" and the separate "High scores"
  spread no longer appear on HOME.
- The strategy guide draws IDEA → PRD → INBOX → OUTBOX → SHIPPED → RETRO with a KNOWLEDGE arrow from
  RETRO back to IDEA, each arrow coloured by who moves it, and the stage lines are readable by a
  screen reader.
- OmniMan moves around the loop, and stands still when the visitor asks for reduced motion.
- At 360px wide the loop is one column and the page has no sideways scroll.
- The customers spread shows BUSINESS → PRODUCTS → PERSONAS with an invented example company labelled
  EXAMPLE, persona portraits with their stance, and the step where the agents read them on every
  run.
- The game spread shows the three beats: create your fleet, ship value, climb the leaderboard.
  Every fleet card has a mascot, no demo galaxy fleet name appears, and the loop's real counts sit
  under THE LOOP BUILT THIS.
- The order form says "Leave any time: delete one folder and commit. Nothing to migrate."
- HOME's prose says none of the banned loop words, and `pnpm test` is green.
- `apps/galaxy/README.md` walks through HOME's new spreads top to bottom.
