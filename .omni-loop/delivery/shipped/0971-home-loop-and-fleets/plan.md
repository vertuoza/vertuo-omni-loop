# Plan: HOME tells the loop, the customers and the fleet game

PRD #971, whose spec is `spec.md` beside this plan. The work lands on the feature branch
`feat/home-loop-and-fleets`, merged into `main` by the feature PR (`Closes #971`). Each slice is a
sub-PR from `feat/home-loop-and-fleets--<slice>` into the feature branch (`Part of #971`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | "What's in it for you?", "You see everything" and "Easy in, easy out" leave HOME, and the order form says "Leave any time: delete one folder and commit. Nothing to migrate." | `apps/galaxy/src/home/spreads/ForYou` `apps/galaxy/src/home/spreads/SeeEverything` `apps/galaxy/src/home/spreads/InOut` `apps/galaxy/src/home/spreads/OrderForm` `apps/galaxy/src/home/spreads/Spreads.tsx` `apps/galaxy/src/home/home.test.ts` `apps/galaxy/src/home/home.css` `apps/galaxy/src/home/lingo` `apps/galaxy/README.md` | — | 1 |
| s2 | The strategy guide is the loop: IDEA → PRD → INBOX → OUTBOX → SHIPPED → RETRO with the KNOWLEDGE arrow back to IDEA, arrows coloured by who moves the work, one column below 720px, OmniMan running it (still under reduced motion), and the LOOP LINGO trimmed to the terms HOME still says | `apps/galaxy/src/home/spreads/StrategyGuide` `apps/galaxy/src/home/home.test.ts` `apps/galaxy/src/home/home.css` `apps/galaxy/src/home/lingo` `apps/galaxy/README.md` | s1 | 2 |
| s3 | "Built for your customers": the Business → Products → Personas chain with the invented example company, persona portraits and their stance, and the step where the agents read them on every run | `apps/galaxy/src/home/spreads/Customers` `apps/galaxy/src/home/spreads/Spreads.tsx` `apps/galaxy/src/home/home.test.ts` `apps/galaxy/src/home/home.css` `apps/galaxy/src/home/lingo` `apps/galaxy/README.md` | s2 | 3 |
| s4 | "The game: build your fleet": HOME's own example fleets, each with a mascot, in three beats (create your fleet, ship value, climb the leaderboard), the real counts folded in under THE LOOP BUILT THIS, the HighScores spread gone and HOME no longer reading the demo galaxy | `apps/galaxy/src/home/spreads/Game` `apps/galaxy/src/home/spreads/fleets` `apps/galaxy/src/home/spreads/cards` `apps/galaxy/src/home/spreads/HighScores` `apps/galaxy/src/home/spreads/Spreads.tsx` `apps/galaxy/src/home/Home.tsx` `apps/galaxy/src/home/home.test.ts` `apps/galaxy/src/home/home.css` `apps/galaxy/src/home/lingo` `apps/galaxy/README.md` | s3 | 4 |

**Shared ground.** Every slice changes what HOME renders, so each declares the page's shared files:
`Spreads.tsx` (s1, s3, s4: the spread order), `home.test.ts` (all four: the h2 order and the
allowed links), `home.css` (all four: the shared spread styles), the `lingo` prefix (`lingo.ts` and
`lingo.test.ts`, all four: the glossed terms follow HOME's prose) and `apps/galaxy/README.md` (all
four: HOME's walkthrough). They are kept apart by running one slice per wave, s1 to s4 in order,
each blocked by the one before. Each slice leaves HOME whole and the suite green, with the README
describing the page as that slice leaves it.

## Per slice: done when

**s1**
- `ForYou`, `SeeEverything` and `InOut` (their .tsx, .css and .test.ts) are deleted, and
  `Spreads.tsx` no longer imports them.
- `home.test.ts` asserts the remaining h2 texts in order, and that HOME's only links are `/play` and
  `/docs`.
- `OrderForm.test.ts` asserts the exit line "Leave any time: delete one folder and commit. Nothing
  to migrate."
- `lingo.test.ts` is green: HOME's prose says no banned word, and every glossed term is still used.
- The README's HOME walkthrough no longer lists the three removed spreads.

**s2**
- `StrategyGuide.tsx` exports `LOOP`: IDEA, PRD, INBOX, OUTBOX, SHIPPED, RETRO, levels 1-1 to 1-6,
  each with its line and the mover of the arrow leaving it (YOU, YOU, AGENTS, YOU, OMNI APP), plus
  the KNOWLEDGE return from RETRO to IDEA.
- The spread's h2 is "Strategy guide: the loop". The SVG has a `<title>`, every stage line is in
  the DOM text, and the legend names YOU, AGENTS and OMNI APP.
- The `omni-run` pose is on the page, its stylesheet animates it, and a `prefers-reduced-motion:
  reduce` rule stops it. Below 720px the loop is drawn as one column.
- LOOP LINGO glosses exactly the terms HOME's prose says: SET UP and HARNESS are gone.
- `home.test.ts` and `lingo.test.ts` are green, and the README describes the loop.

**s3**
- `Customers.tsx` exports `EXAMPLE_BUSINESS`, and the spread renders BUSINESS, PRODUCTS and PERSONAS
  in that order, then the step where the agents read them on every run.
- Each of the three personas renders a portrait from `personaGrid` and its stance (EXCITED, NEUTRAL,
  SKEPTICAL); the spread is labelled EXAMPLE, and no "Vertuoza" or "vertuo" appears in it.
- `Spreads.tsx` puts it right after the strategy guide; `home.test.ts` asserts "Built for your
  customers" in that place; `lingo.test.ts` is green; the README lists it.

**s4**
- `fleets.ts` exports `EXAMPLE_FLEETS`: DAM BUSTERS, DEEP DIVERS, GOLD DIGGERS, SPY RING and SEA
  DOGS, each with a mascot the sprite library holds and `RULE_BY_MASCOT` maps, a colour, a motto and
  example points.
- The spread's h2 is "The game: build your fleet", with three beats: CREATE YOUR FLEET (one card
  per example fleet, each with a mascot SVG), SHIP VALUE (every number read from `RULEBOOK`), CLIMB
  THE LEADERBOARD (the fleets sorted by points, labelled EXAMPLE).
- THE LOOP BUILT THIS shows FEATURES SHIPPED, SLICES MERGED and DECISIONS ADOPTED from
  `countHighScores`, and `—` for a count that can't be read.
- No demo galaxy fleet label (BUILDERS, INKLINGS, COINERS, NIGHT OWLS, CORSAIRS) appears on HOME;
  `Home.tsx` no longer imports `demoFleets`; `HighScores` (.tsx, .css, .test.ts) is deleted.
- `home.test.ts` asserts the final order: "Strategy guide: the loop", "Built for your customers",
  "The game: build your fleet", "Join the loop!". `lingo.test.ts` and `pnpm test` are green, and the
  README walks through HOME's four spreads top to bottom.
