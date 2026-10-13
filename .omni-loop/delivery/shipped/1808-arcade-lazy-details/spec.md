---
prd: 1808
title: The game loads the map first, and each planet's details and the star chart when opened
blocked-by: none
spec: file
phase0: server
---

## Problem

The game (`/play`) reads everything any of its screens might show before it sends a byte. Measured
signed in on production (2026-10-13, after #1789 and #1802): nothing arrives for 7.2 s, then 2.6 MB of
HTML.

- **The dossiers of every planet.** `arcadeFor` (`apps/galaxy/src/data/arcade.ts`) calls
  `readDossiers` with all 306 planets; for the 215 that have a dossier it fires `dossier_list` and
  `dossier_rounds` for each, all at once: 430 database calls per load. Alone each takes 8–11 ms; fired
  together they queue behind PostgREST's connection pool, and every other request of the app queues
  behind them too. Over 18 days these two calls were the app's most frequent (73,522 and 24,756 calls,
  3 h 10 min of database time). Only a planet's DOSSIER tab shows them, once that planet is opened.
- **Every line of every planet's log.** The galaxy goes to the browser whole: the planets' logs are
  1.17 MB of it. Only the opened planet's overlay shows a log, and only its last 8 lines
  (`LogTab`, `apps/galaxy/src/arcade/scenes/planet.tsx`).
- **The star chart.** The knowledge graph (96 KB) is parsed and sent on every load; only the star
  chart's screen shows it.

## Solution

`/play` sends what its map needs, and the game reads the rest when a screen that shows it opens.

1. **The first load.** `arcadeFor` reads the workspace, the galaxy (from the season cache), the
   fleets, the player, the crew, the owner, the XP and the scores, as today. It reads no dossier and
   no star chart, and every planet goes to the browser with an empty `log`.
2. **One planet's details:** `GET /api/arcade/planets/<key>`, `<key>` the planet's key
   (`<home>#<n>`) URL-encoded as one path segment. It answers `{ dossier, log }`: the planet's
   dossier as the DOSSIER tab shows it (`none` when it has none), read with today's single-dossier
   read (`dossier_list` and `dossier_rounds` of that dossier), and the last 8 lines of its log, from
   the cached season.
3. **The star chart:** `GET /api/arcade/chart` answers the knowledge graph `/play` sends today, to the
   same people (the crew, the workspace readable).
4. **Who may read them:** the same people who see this data on `/play` today. Signed out: 401. A
   planet that is not in the person's workspace: 404. The reads run as the person, so row-level
   security still decides what they return. Neither endpoint answers anything `/play` does not send
   today.
5. **In the browser.** `usePlanetDetails(key)` and `useChart()` fetch on first use, keep each answer
   for the session (one entry per planet key, the chart once), share a fetch already in flight, and
   say `loading`, `loaded` or `unreadable`. A failure is not kept: the next open asks again.
6. **The planet overlay** opens at once from what the map knows. Its DOSSIER and LOG tabs show
   `LOADING…`, then their content, or the arcade's out-of-reach line (`DOSSIERS OUT OF REACH`,
   `LOG OUT OF REACH`); START opens the dossier's page once the
   dossier has arrived. It shows the selected planet's entry only, so an answer for another planet
   never shows. A planet opened by a deep link (`#planet-<n>`) loads its details the same way.
7. **The star chart** shows `LOADING…` until the chart has arrived, then the chart as today, or
   `THE STAR CHART IS OUT OF REACH`. The menu's STAR CHART row shows no tally until the chart has been
   read in this session, then its tally as today.
8. **The demo** (no database) keeps its dossiers, logs and chart in the page, as today: the hooks
   read them without a fetch.

## Decisions

- **Approach: two read endpoints, fetched on open, kept for the session** (asked, chosen over Next
  server actions, harder to observe and cache, and over streaming everything, which keeps the 430
  calls and the 2.6 MB).
- **No prefetch:** a planet's details are fetched when it is opened, not when the cursor rests on it
  (asked).
- **The star chart is lazy too**, though it costs 96 KB and 2 ms today (asked: one rule, a screen's
  data loads when the screen opens).
- **The overlay opens at once and its tabs fill in** (asked), rather than waiting for the details.
- **The arcade's own words.** `LOADING…` while a read is on its way and its out-of-reach lines when it
  fails, as the game already says them (`menu.tsx`, `chart.tsx`, `kart.tsx`), not a new phrase.
- **The menu's STAR CHART row** shows no tally until the chart has been read in the session (the menu
  would otherwise read the chart on every load); most reversible, a later change can fetch it there.
- **The galaxy keeps its type.** Planets reach the browser with an empty `log` instead of a new
  map-only type, so none of the map's scenes change; only the LOG tab reads the fetched log. Most
  reversible: a later PRD can split the type.
- **The voice's objection, accepted.** persona:F-E Developer: on-demand fetches with loading states
  are where races and half-loaded screens slip into production. Met by the race and failure tests
  under **Test seams**: the same planet opened twice fetches once, switching planets mid-load shows the
  selected one, a failure retries on the next open, an answer after the overlay closed draws nothing.

## User stories

- As a member, I open the game and the map is playable in about a second.
- As a member, I open a planet and see its status at once; its dossier and its log follow within
  half a second, and reopening it shows them at once.
- As a member, I open the star chart and see it after a short `LOADING…`.
- As anyone else on the app, my pages no longer wait behind the game's 430 dossier reads.

## Scope

In: `arcadeFor` and the `/play` page; the two route handlers under `apps/galaxy/app/api/arcade/`; a
server reader of one planet's details beside `apps/galaxy/src/data/dossiers.ts`; the two hooks; the
planet overlay's DOSSIER and LOG tabs and START; the star chart's door; their tests.

Out: the galaxy's season cache and its key (separate bug fixes); the map's other data (wounds, zones,
fleets); the arcade's games; any change to what a person may read; a split of the `GalaxyView` type.

## Test seams

Tests beside the code (vitest), on fixtures: none calls Supabase or GitHub (testing form).

- **`arcadeFor`**, with a fake database that records each call: no `dossier_list` or
  `dossier_rounds` call, no star chart, every planet's `log` empty; BR-PRODUCT-30 holds (an unreadable
  membership still reads as crew, out of reach).
- **The planet reader:** a planet with a dossier gives it and its last 8 log lines; one without gives
  `none`; a planet of another workspace is not found; a failed read gives `unreadable`.
- **The two routes:** 401 signed out, 404 for a planet outside the workspace, the answer's shape, a key
  holding `/` and `#` read back whole, the chart only to the crew.
- **The hooks:** one fetch for a planet opened twice; switching planets mid-load shows the selected
  planet's details only; a failure shows the out-of-reach line and the next open fetches again; an answer
  arriving after the overlay closed draws nothing; the demo never fetches.
- **The overlay:** each of its tabs in `LOADING…`, loaded and out of reach; START only once the
  dossier has arrived. **The menu:** the STAR CHART row with no tally before the chart is read, its
  tally after.

## Risks

- **What a merge publishes:** the arcade (`apps/galaxy`), deployed to production by the release
  commit that follows the merge. No migration, no change to the kit or the GitHub App. Rollback:
  revert the feature PR; the next release deploys the arcade as it was.
- **A tab opened before the deploy** keeps its old page, which carries its dossiers: nothing breaks.
- **BR-PRODUCT-30** is enforced by `apps/galaxy/src/data/arcade.test.ts`, which this PRD changes
  (`arcadeFor` no longer reads dossiers): the slice that changes it raises a high outbox item, and the
  law's behaviour is kept and tested.
- **N-PRODUCT-17** (no secret reaches the browser): the endpoints answer data only, read as the
  person; no new public variable.

## Acceptance criteria

1. Signed in on production, `/play` streams the playable map in at most 1.5 s when warm, and its HTML
   is at most 1 MB (today: 7.2 s, 2.6 MB).
2. A `/play` load runs no dossier read: across a timed set of `/play` loads, the database's
   statement statistics count no `dossier_list` or `dossier_rounds` call made by them.
3. Opening a planet shows its status at once and its DOSSIER tab and log within about 0.5 s, with
   `LOADING…` until they arrive; reopening it shows them at once.
4. Opening the star chart shows `LOADING…`, then the same chart as today; the menu's STAR CHART row
   shows its tally once the chart has been read.
5. Opening a planet by its deep link (`#planet-<n>`) shows its details the same way.
6. Signed out, and in the demo, the game plays as it does today.
