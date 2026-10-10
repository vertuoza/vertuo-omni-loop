---
screen: home
status: draft
mock: null
implements: [apps/galaxy/app/page.tsx, apps/galaxy/src/home/]
routes: [/]
supersedes: null
---

## Purpose

The Omni Loop front door for a visitor who has never heard of the loop: it says what the loop gives
a team (AGENTS SHIP. YOU STEER.), proves it with the loop's own counts, and sends them to sign up
with GitHub or to the game. Static: the same for every visitor, no cookie read, no database
(`apps/galaxy/app/page.tsx`, `apps/galaxy/src/home/Home.tsx`).

## Regions

- **The poster, above the fold** (`home/poster/Poster.tsx`), drawn as a retro print ad: a text
  column in the ad's purple (the kicker THE DELIVERY FRAMEWORK FOR CODING AGENTS, the headline, the
  pitch, the three promises, the quote, OmniMan and SIGN UP WITH GITHUB) beside a starfield with the
  turning planet, the crest, a blinking PRESS START and OmniMan's flyby. Every picture is an SVG
  drawn on the server (`poster/art.ts`).
- **The magazine spreads, under the fold** (`home/spreads/Spreads.tsx`), in the ad's order: the
  strategy guide (with LOOP LINGO's sidebar glossing PRD, SLICE and OUTBOX), built for your
  customers, the game (the loop's real high-score counts, counted when the page is built,
  `home/scores.ts`) and the order form (Join the loop!, sign up with GitHub, GETTING STARTED to
  `/docs`, the Konami hint).
- **Controls** (`home/Controls.tsx`), the page's one script: Enter, the Konami code, every PRESS
  START (which opens SELECT YOUR APP) and the cards' flips.

## States

- **Signed out:** the poster shows SIGN UP WITH GITHUB.
- **Signed in:** when the browser holds a Supabase auth cookie, a script marks the page pending
  before it paints, so the signed-in pill replaces the sign-up button without SIGN UP WITH GITHUB
  flashing first (`home/session-mark.ts`, `home/SignedIn.tsx`).
- **An old arcade deep link** (`/#planet-12`, `/#menu`): forwarded to `/play` before anything
  paints (`home/forward.ts`).
- **Motion:** the planet turns on a canvas only once the browser allows motion
  (`poster/PosterPlanet.tsx`).
- **A remembered pick:** under SIGN UP, a line says where a remembered app pick opens, with its
  change, drawn in the browser only (`Poster.tsx`).

## Words

- Kicker: THE DELIVERY FRAMEWORK FOR CODING AGENTS. Headline: AGENTS SHIP. YOU STEER.
- Promises: ONE FOLDER IN, ONE FOLDER OUT · EVERY DECISION WRITTEN DOWN · A PERSON ALWAYS MERGES.
- Actions: SIGN UP WITH GITHUB, PRESS START, GETTING STARTED.
- Fine print: "Omni Loop runs on Claude Code. Free while in beta: sign up with GitHub." "Leave any
  time: delete one folder and commit. Nothing to migrate."
- The page's prose never says phase-0, worktree, sub-PR, dossier, territory or yolo, and glosses
  PRD, SLICE and OUTBOX once (`home/lingo.ts`, held by `home/lingo.test.ts`).

## Refusals

- HOME reads no session and no database per request (`app/page.tsx`, `home/Home.tsx`).
- No link from HOME to the game skips SELECT YOUR APP: each is a PRESS START
  (`home/press-start-guard.test.ts`).

## Open questions

- Which is HOME's one primary action: SIGN UP WITH GITHUB or PRESS START? Both stand above the fold,
  and the code does not rank them.
- The kicker, the ★ glyphs and the hard offset shadows are on the craft floor's refuse list: are
  they the print ad's on purpose? (The design form's Deliberate asks the same.)
- The poster renders no error state: what should HOME show when the GitHub sign-in fails to start?
- No mockup is kept for HOME: is today's page the reference, or should a mock be drawn to lock?

## Source

- apps/galaxy/app/page.tsx@5b81f8d
- apps/galaxy/src/home/Home.tsx@8dd2ca8
- apps/galaxy/src/home/poster/Poster.tsx@a29c227
- apps/galaxy/src/home/spreads/Spreads.tsx@303ab83
- apps/galaxy/src/home/spreads/OrderForm.tsx@2589f42
- apps/galaxy/src/home/lingo.ts@451d655
- apps/galaxy/src/home/press-start-guard.test.ts@0ec2faa
- /omni:invade 2026-10-10 (written by hand from its screen-library step, PRD 1407 s9)
