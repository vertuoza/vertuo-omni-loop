---
prd: 261
title: HOME — the Omni Loop front door, a retro print ad
blocked-by: none
spec: file
---

# HOME: the Omni Loop front door

**Date:** 2026-09-27 · **PRD:** #261 · **Touches:** `apps/galaxy` · **Builds on:** #141 (the design
system, merged)

This is the second of the front-door PRDs:

1. **#141, merged.** The design system: `@omni/design` with the tokens, the fonts, the 16-bit crest,
   the sprites and OmniMan's poses.
2. **This one.** HOME: a public page at `/`, drawn as a retro Super Nintendo print ad, that explains
   loop engineering and sends players to the game, which moves to `/play`.
3. **Next.** One-click sign-up with GitHub: pick your GitHub organisation, and a workspace named
   after it is created. It lights up the sign-up button this PRD shows as coming soon.

## Problem

Anyone who opens the galaxy's address lands in the arcade's attract mode. It is fun, but it never
says what Omni Loop is:

- `/` renders the arcade on every request (`apps/galaxy/app/page.tsx`). A visitor without an
  account sees an INSERT COIN screen and a sign-in that only a workspace's domain may pass.
- The product's real selling point, **loop engineering** (coding agents that take a whole PRD,
  plan it, build it test-first and open the pull requests, while a person answers their questions
  once and merges), is written nowhere a visitor can read.
- The game is Omni Loop's way of standing out, the way PostHog's playful site does. It should be
  the fun that follows the pitch, not the only thing a visitor sees.

## Solution

**`/` becomes HOME and the game moves to `/play`.**

- HOME is a server-rendered, static page: no session, no Supabase, no per-request work. Its text is
  real DOM, readable and indexable. Its parts live in `apps/galaxy/src/home/`, and it is drawn only
  from `@omni/design`: the tokens, the fonts, the crest, the sprites and the poses.
- Today's `app/page.tsx` moves unchanged to `app/play/page.tsx`, with the same modes (demo, closed,
  supabase) and the same INSERT COIN rules.
- The auth callback's return (`app/auth/callback/route.ts`, today `new URL('/', …)`) becomes
  `/play`, and so does the arcade's reload after signing out (`window.location.assign('/')` in
  `ArcadeApp.tsx`). The Ask sign-in's fallback to `/` for an unknown session stays `/`.
- HOME forwards the arcade's old deep links before it paints: `/#map`, `/#fleets`, `/#heroes`,
  `/#briefing` and `/#planet-<n>` go to `/play#…`. Any other hash stays on HOME.
- The single-file artifact still plays the demo arcade; `/ask`, `/knowledge` and `/design` keep
  their routes.

**The poster, above the fold.** The Star Fox split: a text column beside a starfield.

- **The text column** (`adPurple`):
  - a red kicker, *GET WHOLE FEATURES SHIPPED WHILE YOU SLEEP, WHEN YOU*;
  - **JOIN THE LOOP!**, in the `display` role at its largest step, slanted;
  - a yellow dotted rule;
  - the pitch, in the `body` role: *Hand a PRD to the loop. Coding agents plan it, build it
    test-first, and open the pull requests. You answer their questions once, then review and merge.*
  - at the bottom, OmniMan's `omni-point` pose at poster scale, pointing across at the crest, with
    the yellow quote **"TO JOIN INSTANTLY, SIGN UP WITH GITHUB!"** and the sign-up button (below).
- **The starfield side** (`starfield`):
  - a pixel planet from the game's own renderer (`drawPlanet`), green patches of secured ground
    spreading across it: the invasion;
  - the crest's `full` form, large, where the poster puts its logo;
  - a blinking **PRESS START** button.
- **On a phone** (under 760 px wide) it stacks: the crest, the headline, PRESS START, then the rest
  of the column.

**The magazine spreads, below the poster, in this order.**

1. **STRATEGY GUIDE: HOW THE LOOP WORKS.** A pixel world map whose levels are the loop's stages,
   with OmniMan's `omni-run` pose on the path:
   - **1-1 BRAINSTORM:** you and Claude turn an idea into an approved PRD.
   - **1-2 PLAN:** the PRD is cut into thin slices, grouped in waves.
   - **1-3 WAVES:** one agent per slice, each in its own worktree, test-first, each with its own
     pull request.
   - **1-4 OUTBOX:** every decision taken without asking is written down; you answer once, at the end.
   - **1-5 SHIP:** the feature pull request is ready, and a person merges it.
   - **★ BONUS, KNOWLEDGE:** merged decisions land in the knowledge base, so the next loop knows more.
2. **PLUS ALL OF THIS GREAT STUFF!** The ad's bullet column, each bullet a real feature:
   - `omni invade` reads a repository and writes its playbook.
   - It never merges into `main`: a person always does.
   - Ask mode puts Claude's questions on a web page.
   - The knowledge graph reads the registers as one map.
   - The galaxy: every PRD a planet, every team a fleet.
3. **HIGH SCORES.** Three counters: PRDs shipped, slices merged, decisions adopted (below).
4. **COLLECT ALL THE FLEETS!** The built-in fleets that are not retired (`demoFleets()`), as Power
   Trading Cards: the mascot sprite, the fleet's label and motto on the front; on the back, the
   fleet's colour and one scoring value read from `game/rulebook.mjs` (a zone secured, a rescue, or
   an Entropy kind closed), so a card never states a number the rulebook does not hold.
5. **The order form.** *TO JOIN INSTANTLY: SIGN UP WITH GITHUB*, the sign-up button, PRESS START
   again, and the fine print: *Omni Loop runs on Claude Code. Invite-only while in beta.*

**The sign-up button** reads **SIGN UP WITH GITHUB · COMING SOON**. It is a disabled button
(`disabled`, with the words "coming soon" in its accessible name) and goes nowhere. The open sign-up
PRD makes it work.

**The high scores** are counted when the page is built, from Omni Loop's own delivery folder,
`.omni-loop/delivery/shipped/`:

- **PRDs shipped:** the folders in it.
- **Slices merged:** the rows of each shipped `plan.md`'s slice table.
- **Decisions adopted:** the entries of each shipped `outbox/settled.md` whose verdict is
  `adopted`.

The reader follows the pattern `src/data/load-knowledge.ts` uses to read the repository's files on
Vercel. The numbers change on every deploy. A folder or file it cannot read gives `—` for that
counter, never an invented number.

**The fun layer.** One small client component carries every interaction; nothing else on the page
ships JavaScript.

- **PRESS START:** a click, a tap, or **Enter** anywhere on HOME plays the arcade's `start` sound
  (`src/arcade/sound.ts`), silent when the player muted the game (`omni-loop:muted`), then opens
  `/play`.
- **The Konami code:** ↑ ↑ ↓ ↓ ← → ← → B A on HOME flashes **CHEAT ACTIVATED!** over the poster,
  plays the same sound and opens `/play`. The arcade itself does not change.
- **The trading cards** are buttons: hover, a tap, Enter or Space flips one. With
  `prefers-reduced-motion`, they crossfade instead of turning.
- **Sharing:** the page's title and description, and an Open Graph image (the crest and JOIN THE
  LOOP! on the starfield), so a shared link looks like the ad.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | HOME is a poster above the fold, then magazine spreads. | The poster is the hook; the spreads give room to explain the loop, PostHog-style. (Asked, over a single poster and a flip-book.) |
| D2 | The game moves to `/play`; sign-in and sign-out return there; old hash links are forwarded. | `/` belongs to the pitch; no player and no bookmark loses the game. (Asked.) |
| D3 | HOME is static and reads no session and no database. | A public page anyone opens should be fast, cacheable and unable to leak a workspace's data. |
| D4 | The call to action is signing up with GitHub; in this PRD the button is shown as coming soon, and PRESS START is the working action. | Omni Loop has no value without GitHub. One-click sign-up (pick your org, get a workspace) is its own subsystem and its own PRD, which comes after this one. (Asked: HOME first.) |
| D5 | Requests and sign-ups are read in the Supabase dashboard until an admin app exists; the admin app is a PRD of its own. | Keeps HOME focused. (Asked.) |
| D6 | The headline is JOIN THE LOOP!, with the kicker GET WHOLE FEATURES SHIPPED WHILE YOU SLEEP, WHEN YOU. | The homage to JOIN THE CLUB! carries the retro-ad voice. (Asked, over YOUR REPO. INVADED. and ONE COMMAND. WHOLE PRD.) |
| D7 | The high scores are counted from Omni Loop's own shipped delivery at build time. | Real numbers of the loop building itself, with no database read and no invented figure. (Asked.) |
| D8 | Three fun extras: the Konami code, flipping trading cards, and the start sound on PRESS START. | The PostHog-style fun layer. (Asked.) |
| D9 | All art is Omni Loop's own: the crest, OmniMan, the pixel planets. No Nintendo name, logo or artwork appears. | The ad borrows a style, never a mark. |

## User stories

1. As a visitor with no account, I open the galaxy's address and read, on one screen, what Omni
   Loop does and why it is different.
2. As a visitor, I scroll and understand how the loop works, stage by stage, and what it has
   already shipped.
3. As a visitor who wants in, I see that signing up with GitHub is coming, and I am never led to
   believe I signed up.
4. As a visitor who wants to play, I press START (or Enter, or the Konami code) and land in the
   game.
5. As a player, my old bookmark to `/#planet-12` still opens that planet, and signing in brings me
   back to the game, not to HOME.
6. As someone sharing the link, the preview shows the ad.

## Scope

**In:**

- **Routes:** HOME at `/`; the arcade moved to `/play`; the auth callback and the arcade's sign-out
  returning to `/play`; the hash forwarding on HOME.
- **HOME:** the poster, the five spreads, the sign-up button (disabled), the high-score reader, the
  interactions, the metadata and the Open Graph image, all under `apps/galaxy/src/home/` and
  `apps/galaxy/app/`.
- **Scripts and docs:** `apps/galaxy/scripts/shots.mjs` walking the arcade from `/play`, and
  screenshots of HOME; `apps/galaxy/README.md` where it names `/` as the arcade.

**Out:**

- **Open sign-up with GitHub:** the org picker, workspace creation, and the sign-up hook. The next
  PRD.
- **The admin app** that lists requests and workspaces. A later PRD.
- **Any database change:** no migration, no new table, no policy.
- **The arcade's own screens:** unchanged but for where signing in and out returns.

## Test seams

Commands and conventions from the testing playbook: `pnpm test` runs vitest over `packages/` and
`apps/*/src/`, tests sit beside their code, and no test calls GitHub or Supabase.

- **`apps/galaxy/src/home/forward.test.ts`:** each arcade hash (`#map`, `#fleets`, `#heroes`,
  `#briefing`, `#planet-7`) maps to `/play#…`; an empty hash, `#top` and `#planet-x` do not.
- **`apps/galaxy/src/home/scores.test.ts`:** on a fixture delivery folder with two shipped PRDs, the
  three counters are exact; a missing folder, a plan without a slice table and a missing
  `settled.md` each give `—` for their counter only.
- **`apps/galaxy/src/home/konami.test.ts`:** the exact sequence matches; a wrong key resets it; a
  sequence with an extra key in the middle does not match.
- **`apps/galaxy/src/home/home.test.ts`:** a render of HOME with no Supabase environment finds the
  headline, a PRESS START link to `/play`, a disabled sign-up button whose name says coming soon,
  the six stages of the strategy guide, the five great-stuff bullets, the three counters, one card
  per built-in fleet not retired, and no Nintendo name.
- **`apps/galaxy/src/home/start.test.ts`:** pressing START with sound muted plays nothing and still
  opens `/play`.
- **The callback and sign-out:** the callback's tests expect `/play`; the arcade's sign-out test
  expects `/play`.
- **`/play`:** the moved page renders in demo, closed and supabase modes as `/` did (the existing
  page tests, moved).
- **The design-system guard** (`src/design-system.test.ts`) still passes: HOME declares no colour
  on `:root` and links no Google font.
- **Manual, recorded in the feature PR:** HOME at 393, 852 and 1440 px wide; `pnpm galaxy:shots`
  from `/play`, every scene as before.

## Risks

- **What merging publishes.** The galaxy is a Vercel project imported from this repository, so a
  merge may deploy: `/` stops being the game for every visitor. Crew bookmarks of `/` land on HOME,
  and PRESS START is one click away. No migration, no ledger event, no kit file changes.
- **Rollback.** Revert the feature PR's merge commit: HOME, the route move and the callback revert
  together.
- **A sign-in that still lands on `/`** would drop a player on HOME. The callback and the sign-out
  change cover the arcade's two returns; the Supabase site URL can stay the root.
- **Honesty.** The sign-up button is disabled and says coming soon, so no visitor believes they
  signed up; the fine print says invite-only.
- **Build-time reads.** The high-score reader needs the delivery folder in the Vercel build, which
  the project already includes (files outside the root directory are kept on, as `/knowledge`
  relies on).
- **`galaxy:shots`** walks the arcade from `/` today and must start at `/play`, or its screenshots
  show HOME.

## Acceptance criteria

1. `/` renders HOME without a session and without Supabase variables, in every mode, and makes no
   request to Supabase.
2. `/play` renders the arcade exactly as `/` did, in demo, closed and supabase modes.
3. After signing in with Google or linking GitHub, and after signing out, the player lands on
   `/play`.
4. Opening `/#planet-12`, `/#map`, `/#fleets`, `/#heroes` or `/#briefing` lands on `/play` with the
   same hash; any other hash stays on HOME.
5. Above the fold, HOME shows the kicker, JOIN THE LOOP!, the pitch, OmniMan pointing, the crest, the
   invaded planet and PRESS START; on a phone the crest, the headline and PRESS START come first.
6. Below it come, in order, the strategy guide with its six stages, PLUS ALL OF THIS GREAT STUFF!
   with its five bullets, HIGH SCORES, the fleets' trading cards and the order form.
7. The high scores equal the counts of `.omni-loop/delivery/shipped/` at build time; a counter that
   cannot be read shows `—`.
8. The sign-up button is disabled, says SIGN UP WITH GITHUB · COMING SOON, and goes nowhere.
9. PRESS START, Enter and the Konami code each open `/play`; the start sound plays unless the game
   is muted; the Konami code flashes CHEAT ACTIVATED! first.
10. Each trading card flips on hover, tap, Enter or Space, and crossfades under reduced motion.
11. A shared link to `/` shows the page's title, description and Open Graph image.
12. HOME uses only `@omni/design`'s colours and fonts (the guard passes), shows no Nintendo name or
    art, and has no sideways scroll at 393 px wide.
13. `pnpm test`, the galaxy's `typecheck` and `build` pass, and `pnpm galaxy:shots` from `/play`
    shows every arcade scene unchanged.
