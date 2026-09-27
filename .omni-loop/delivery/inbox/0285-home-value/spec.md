---
prd: 285
title: HOME, value first — agents ship, you steer
blocked-by: none
spec: file
---

# HOME, value first: agents ship, you steer

**Date:** 2026-09-27 · **PRD:** #285 · **Touches:** `apps/galaxy/src/home/` · **Builds on:** #261 (HOME,
merged)

## Problem

HOME, the front door at `/` (PRD 261), explains how the loop works, but not what it is worth. A head
of engineering, a developer and a PM who land on it cannot tell, at a glance, what Omni Loop gives
them:

- **The headline says nothing.** **JOIN THE LOOP!** is a brand shout. The only value on the poster
  is the kicker, *GET WHOLE FEATURES SHIPPED WHILE YOU SLEEP*, and the pitch starts with a word most
  visitors do not know: *Hand a PRD to the loop.*
- **The spreads describe mechanics.** The strategy guide lists the loop's stages; *PLUS ALL OF THIS
  GREAT STUFF!* lists features (`omni invade`, ask mode, the knowledge graph). Neither says who gains
  what.
- **No reader is addressed.** Nothing speaks to a head of engineering's question (is it safe, can we
  stop?), a developer's (what do I still do?) or a PM's (what happens to my brief?).
- **The three strongest promises are missing:** the loop is a framework of best practices (the
  rules for agents, the brief, the plan, the review gates) that is **easy to adopt and easy to
  stop**; the agents do the building while people **own the product and the rules**; and every
  step is **observable and documented**.
- **Jargon.** PRD, slice, wave and outbox appear with no explanation.

## Solution

HOME keeps its retro print-ad skin, its design system (`@omni/design`), its route, its static
rendering and every interaction (PRESS START, Enter, the Konami code, the flipping cards). Its words
and its spreads change, so that every section opens with what it is worth, in plain words.

**The writing rules**, for every word on HOME:

- **Plain words first.** A loop term (PRD, harness, slice, wave, outbox) is used only where it helps
  and is glossed in the **LOOP LINGO** sidebar. The other loop words (phase-0, worktree, sub-PR,
  dossier, territory, yolo) never appear in HOME's prose. A command name in a `<code>` element is
  not prose, and neither is the text of the fleet cards: a fleet's motto and its card's rule are
  the game's own data (OCTOPOD's motto is *Eight arms, eight sub-PRs.*), which HOME shows as is.
- **True today.** Every claim names something the loop does now. No number but the counters, which
  are counted; no time claim ("in an afternoon"); no "one command" promise, since adopting takes
  `omni init`, the plugin, the GitHub App and `/omni:invade`.

**The page, top to bottom.** One `h1` (the headline); each spread its own `h2`.

### 1. The poster, above the fold

The split stays: the text column (`adPurple`) beside the starfield.

- **Kicker** (red): *THE DELIVERY FRAMEWORK FOR CODING AGENTS*.
- **Headline** (`h1`, the `display` role, slanted, on two lines): **AGENTS SHIP. / YOU STEER.**
- The yellow dotted rule.
- **Pitch** (`body` role): *Describe the feature once. Coding agents plan it, build it test-first
  and open the pull requests. Your team owns the product and the rules, and sees every decision the
  agents took.*
- **The promise strip,** a list of three, each with a ★:
  1. **ONE FOLDER IN, ONE FOLDER OUT**
  2. **EVERY DECISION WRITTEN DOWN**
  3. **A PERSON ALWAYS MERGES**
- Unchanged: OmniMan's `omni-point` pose with the quote **"TO JOIN INSTANTLY, SIGN UP WITH
  GITHUB!"** and the disabled sign-up button; on the starfield, the invaded planet, the crest and
  the blinking PRESS START.
- **On a phone** (under 760 px): the crest, the headline and PRESS START first, as today, then the
  kicker, the pitch, the promise strip and the rest of the column.

### 2. What's in it for you?

`h2` *What's in it for you?* Three cards side by side, stacked on a phone, all visible, each an
`h3` role, a one-line promise, and three proofs:

| Role (`h3`) | Promise | Proofs |
|---|---|---|
| **HEAD OF ENGINEERING** | *More shipped, same guardrails.* | Nothing reaches `main` without a person: the agents never merge. · Your rules for agents (how you test, review and release) live in your repository, and every agent follows them. · One folder to adopt; delete it to stop. |
| **DEVELOPER** | *Review small pull requests, not prompts.* | Each feature is cut into small pieces, each built test-first, each with its own pull request. · The agents don't stop to ask: they write every call down, and you answer once, at the end. · A red CI check is the agent's to fix, not yours. |
| **PRODUCT MANAGER** | *Your brief becomes the build.* | Turn an idea into a brief with Claude, with a before/after page, approved before any code is written. · Follow it live: the brief, the plan and every question, on one shareable page. · Every shipped feature gets a release note in plain words. |

### 3. Strategy guide: the loop, level by level

`h2` *Strategy guide: the loop, level by level.* The pixel world map and OmniMan's `omni-run` pose
stay. Seven levels, each naming the practice the loop builds in:

| Level | Name | Line |
|---|---|---|
| 1-1 | **SET UP** | `omni invade` reads your repository and writes its harness: how you test, build, review and release. You merge it as one pull request of docs. |
| 1-2 | **BRAINSTORM** | You and Claude turn an idea into a brief, the PRD, with a before/after page. A person approves it before any code exists. |
| 1-3 | **PLAN** | The PRD is cut into thin slices, each with the files it may touch, grouped in waves that are built side by side. |
| 1-4 | **BUILD** | One agent per slice, each on its own branch, test-first, each with its own pull request. |
| 1-5 | **OUTBOX** | Every decision an agent took without asking is written down. You answer once, at the end. |
| 1-6 | **SHIP** | The feature's pull request is ready once its checks pass. A person reviews and merges it, never an agent. |
| ★ BONUS | **KNOWLEDGE** | The decisions you settle land in the knowledge base, so the next loop knows more. |

**LOOP LINGO**, a sidebar beside the map (under it on a phone), `h3` *Loop lingo*, a definition
list in the loop's order:

| Term | Gloss |
|---|---|
| **HARNESS** | Your repository's rules for agents: how to test, build, review and release. |
| **PRD** | The brief for one feature: the problem, the stories, and what done means. |
| **SLICE** | One small piece of a feature, built test-first, with its own pull request. |
| **WAVE** | The slices that can be built at the same time. |
| **OUTBOX** | The decisions the agents took without asking, waiting for your answer. |

### 4. You see everything

`h2` *You see everything*, with the line *Every step leaves something a person can read.* It
replaces *PLUS ALL OF THIS GREAT STUFF!* Six bullets, each a name then what it gives you:

1. **The outbox** lists every decision the agents took without asking; you adopt it or change it.
2. **One page per feature** keeps its brief, its plan and its before/after, every version, with the
   questions that shaped them.
3. **Questions on a web page:** the agents ask in your browser, not only in a terminal; a teammate
   can answer, and every answer is kept.
4. **A knowledge base that grows:** settled decisions become rules and decision records the next
   loop reads, mapped as one graph.
5. **Release notes:** every shipped feature, in plain words, on a public page. *Public page* links
   to `/releases`.
6. **The galaxy:** every feature a planet, every team a fleet, so the whole company sees what moves
   and what is stuck.

`/releases` is the only link: it is the one page here that opens without signing in.

### 5. Easy in, easy out

`h2` *Easy in, easy out.* Two columns, stacked on a phone.

- **GET IN** (`h3`), four numbered steps:
  1. `omni init` adds one folder to your repository: `.omni-loop/`.
  2. Install the omni plugin in Claude Code, and the omni-loop GitHub App.
  3. `/omni:invade` writes your harness from what your repository already proves. You merge it as
     one pull request of docs.
  4. `/omni:brainstorm` your first feature.
- **GET OUT** (`h3`):
  - **Delete `.omni-loop/` and commit. That's it.**
  - Everything the agents shipped is ordinary code, ordinary pull requests and git history. Nothing
    to migrate.
  - Fine print: *The GitHub labels and the App installation stay until you remove them.*

### 6. High scores: the loop built this

`h2` *High scores: the loop built this*, with the line *Omni Loop is built with Omni Loop.* The
three counters and their counting are PRD 261's, unchanged (`src/home/scores.ts`); only the first
label changes:

- **FEATURES SHIPPED** (was PRDS SHIPPED), **SLICES MERGED**, **DECISIONS ADOPTED**.
- The note stays: *Counted from the loop's own shipped work, each time this page is built.* A
  counter it cannot read still shows `—`.

### 7. The game: Entropy you can see

`h2` *The game: Entropy you can see* (was *Collect all the fleets!*), with the line: *Every feature
is a planet your teams terraform together. Unanswered questions, stuck work and shipped bugs are
Entropy: they cost the owning fleet points until someone closes them.* The fleet trading cards,
their flip and their note are unchanged.

### 8. The order form: join the loop

`h2` *Join the loop!*, then *TO JOIN INSTANTLY: SIGN UP WITH GITHUB*, the disabled sign-up button,
PRESS START, the fine print (*Omni Loop runs on Claude Code. Invite-only while in beta.*) and the
Konami tip, all as today.

### Sharing

- **Title:** `OMNI LOOP · AGENTS SHIP. YOU STEER.`
- **Description:** *The delivery framework for coding agents. Agents plan, build test-first and open
  the pull requests; your team owns the product and the rules, and sees every decision.*
- **The Open Graph card:** the crest and **AGENTS SHIP. YOU STEER.** on the starfield, its alt text
  saying so.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Keep the retro print-ad skin and every interaction; change the words and the spreads. | The playful look is how Omni Loop stands out (PRD 261); what is missing is value, not style. (Asked, over a sober product page and a retro poster over a plain body.) |
| D2 | The headline is **AGENTS SHIP. YOU STEER.**, under the kicker *THE DELIVERY FRAMEWORK FOR CODING AGENTS*; *JOIN THE LOOP!* moves to the order form. | Four words carry the whole deal: agents build, people own the product and the rules. (Asked, over keeping JOIN THE LOOP! and YOUR RULES. THEIR CODE.) |
| D3 | Each reader gets a card, and all three are visible at once, with no script. | Nothing hidden behind a tab, and all of it readable and indexable. (Asked, over a role picker and tags woven into the sections.) |
| D4 | Plain words first; the five loop terms HOME uses are glossed once in LOOP LINGO, and a test keeps it so. | Most visitors do not know what a PRD is. (Asked, over no loop words at all.) |
| D5 | The fleet cards stay, and their spread says why the game exists: Entropy the whole company sees. | The game is observability too, not only fun. (Asked, over cutting them and keeping them as they are.) |
| D6 | Every claim is true today and names a shipped feature: no invented number, no time claim, no one-command promise. | A front door that oversells loses a head of engineering at the first check. Adopting takes four steps (`omni init`, the plugin, the App, `/omni:invade`), so the page shows four. |
| D7 | GET OUT says *delete `.omni-loop/` and commit*, and its fine print says the labels and the App stay. | That is the removal `omni init` itself prints (`kit/lib/init/steps.mjs`), word for word in substance. |
| D8 | `/releases` is the only link on HOME. | It is the only page that opens without signing in; the dossiers, ask mode's history and the knowledge map need a workspace. |
| D9 | The high scores keep PRD 261's counting; PRDS SHIPPED is relabelled FEATURES SHIPPED. | The counts are real; only the word was jargon. |
| D10 | The sign-up button stays disabled and says coming soon. | Open sign-up with GitHub is still the next PRD's (PRD 261, D4). |

## User stories

1. As a **head of engineering**, I read on one screen that agents do the building, that nothing
   reaches `main` without a person, and that I can adopt the loop with one folder and stop by
   deleting it.
2. As a **developer**, I read that I review small, test-first pull requests instead of writing
   prompts, and that the agents answer to CI and write their decisions down.
3. As a **PM**, I read that my brief is approved before any code, that I can follow it on one page,
   and that what ships gets a plain release note.
4. As a **visitor who does not know the loop's words**, I understand every sentence, and the few
   loop terms I meet are explained in LOOP LINGO.
5. As a **visitor who checks the claims**, I see how to get in and how to get out, and numbers
   counted from the loop's own shipped work.
6. As a **visitor who wants to play**, PRESS START, Enter and the Konami code still take me to
   `/play`.
7. As **someone sharing the link**, the preview says *AGENTS SHIP. YOU STEER.*

## Scope

**In:**

- **HOME's words and spreads,** under `apps/galaxy/src/home/`: the poster (kicker, headline, pitch,
  promise strip), the new spreads (what's in it for you, you see everything, easy in and easy out),
  the strategy guide's seven levels and the LOOP LINGO sidebar, the reframed high scores, game and
  order form, and their styles in `home.css`.
- **Sharing:** the title, the description, and the Open Graph card's headline and alt text
  (`src/home/share.tsx`).
- **Tests:** `home.test.ts` and `share.test.ts` to the new words, and the new LOOP LINGO guard.
- **Docs:** `apps/galaxy/README.md`'s HOME section, where it names the poster's words and spreads.

**Out:**

- **Routes and data:** `/`, `/play`, the forwarding of old links, the auth callback and the
  high-score counting are unchanged. No database change.
- **The interactions:** PRESS START, Enter, the Konami code, CHEAT ACTIVATED! and the card flips are
  unchanged.
- **Open sign-up with GitHub** and the admin app: later PRDs.
- **The arcade** at `/play`, and any page other than HOME.
- **The kit:** no kit file changes.

## Test seams

Commands and conventions from the testing playbook: `pnpm test` runs vitest over `packages/` and
`apps/*/src/`, tests sit beside their code, and no test calls GitHub or Supabase.

- **`apps/galaxy/src/home/home.test.ts`**, rewritten to the new page:
  - **AGENTS SHIP. YOU STEER.** is the page's one `h1`; the kicker, the headline, the pitch and the
    three promises come in the column's order.
  - The spreads come in this order: what's in it for you, the strategy guide, you see everything,
    easy in and easy out, high scores, the game, the order form; each has its own `h2`.
  - Three role cards, each with its `h3`, its promise and three proofs.
  - Seven levels, in order, with OmniMan running the path; LOOP LINGO holds the five terms, in
    order.
  - Six see-everything bullets; the release notes bullet links to `/releases`, and HOME has no other
    link but `/play`.
  - GET IN has four steps; GET OUT says to delete `.omni-loop/` and commit, and its fine print names
    the labels and the App.
  - The three counters, labelled FEATURES SHIPPED, SLICES MERGED and DECISIONS ADOPTED, show what the
    build counted, and `—` for one it could not read.
  - The game spread's line names Entropy, and there is one flipping card per built-in fleet not
    retired.
  - The order form carries JOIN THE LOOP!, the disabled sign-up, PRESS START and the fine print.
  - The tests PRD 261 left that still hold stay: no session, no Supabase, the forwarding script
    first, the controls mounted, the phone order, the disabled sign-up buttons, no Nintendo name,
    the reduced-motion crossfade.
- **`apps/galaxy/src/home/lingo.test.ts`**, the jargon guard, on a render of HOME with the text of
  `<code>` and `<kbd>` elements, of the fleet cards and of the LOOP LINGO sidebar left out:
  - each of PRD, harness, slice, wave and outbox found in the rest of the page is a LOOP LINGO term;
  - each LOOP LINGO term is found in the rest of the page at least once, so no gloss is left
    without a use;
  - none of phase-0, worktree, sub-PR, dossier, territory and yolo is found at all;
  - matching is whole-word and ignores case and a plural *s*.
- **`apps/galaxy/src/home/share.test.ts`:** the title, the description, and the card's headline and
  alt text say AGENTS SHIP. YOU STEER.
- **Unchanged and still green:** `scores.test.ts`, `forward.test.ts`, `konami.test.ts`,
  `start.test.ts`, the cards' tests, and the design-system guard (`src/design-system.test.ts`: HOME
  declares no colour on `:root` and links no Google font).
- **Manual, recorded in the feature PR:** HOME at 393, 852 and 1440 px wide, with no sideways scroll
  at 393 px.

## Risks

- **What merging publishes.** The galaxy is a Vercel project imported from this repository, so a
  merge may deploy: every visitor of `/` reads the new words and the new share card. No migration,
  no ledger event, no kit file, and no route changes; `/play` and sign-in are untouched.
- **Rollback.** Revert the feature PR's merge commit: HOME's words, spreads and share card come back
  as PRD 261 left them.
- **A claim that goes stale.** If a feature a card names changes (sign-up opens, `/releases` stops
  being public, the loop starts merging), HOME would say something false. Each claim is tied to a
  named feature in this spec, and the tests pin the words, so a PRD that changes the feature finds
  the words in its way.
- **Overselling.** A head of engineering who checks a claim and finds it false stops reading. D6 and
  D7 keep every promise to what the loop does now.
- **Length on a phone.** Eight sections instead of six. The cards stack, the spreads are short, and
  the manual check at 393 px covers it.
- **A shared link's cached preview** keeps showing JOIN THE LOOP! until the service that cached it
  fetches the card again.

## Acceptance criteria

1. Above the fold, HOME shows the kicker *THE DELIVERY FRAMEWORK FOR CODING AGENTS*, the headline
   **AGENTS SHIP. YOU STEER.** as its one `h1`, the pitch, and the three promises (ONE FOLDER IN, ONE
   FOLDER OUT · EVERY DECISION WRITTEN DOWN · A PERSON ALWAYS MERGES), beside OmniMan, the disabled
   sign-up button, the crest, the invaded planet and PRESS START; on a phone, the crest, the headline
   and PRESS START come first.
2. Below the poster come, in order: what's in it for you, the strategy guide, you see everything,
   easy in and easy out, high scores, the game, and the order form, each with its own `h2`.
3. *What's in it for you?* shows three cards (HEAD OF ENGINEERING, DEVELOPER, PRODUCT MANAGER), each
   with the promise and the three proofs this spec gives, all visible at once and with no script.
4. The strategy guide shows the seven levels, SET UP to the KNOWLEDGE bonus, with the lines this spec
   gives, and a LOOP LINGO sidebar glossing HARNESS, PRD, SLICE, WAVE and OUTBOX.
5. Every loop term in HOME's prose (outside `<code>`, `<kbd>` and the fleet cards) is glossed in
   LOOP LINGO, every gloss is used, and phase-0, worktree, sub-PR, dossier, territory and yolo never
   appear in it.
6. *You see everything* lists the six bullets this spec gives; the release notes bullet links to
   `/releases`, and HOME links nowhere else but `/play`.
7. *Easy in, easy out* shows the four GET IN steps and the GET OUT line *Delete `.omni-loop/` and
   commit. That's it.*, with the fine print about the labels and the App.
8. The high scores are labelled FEATURES SHIPPED, SLICES MERGED and DECISIONS ADOPTED under *High
   scores: the loop built this*, and equal the counts of `.omni-loop/delivery/shipped/` at build
   time, with `—` for a counter that cannot be read.
9. The game spread reads *The game: Entropy you can see*, names Entropy in its line, and keeps one
   flipping card per built-in fleet not retired.
10. The order form reads *Join the loop!* and keeps the disabled sign-up, PRESS START, the fine print
    and the Konami tip.
11. A shared link to `/` shows the title *OMNI LOOP · AGENTS SHIP. YOU STEER.*, the new description,
    and a card with AGENTS SHIP. YOU STEER. on the starfield.
12. PRESS START, Enter and the Konami code still open `/play`, and the cards still flip, as PRD 261
    made them.
13. HOME still uses only `@omni/design`'s colours and fonts (the guard passes), names no Nintendo
    game, and has no sideways scroll at 393 px wide.
14. `pnpm test`, and the galaxy's `typecheck` and `build`, pass.
