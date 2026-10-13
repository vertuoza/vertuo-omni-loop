# Plan: the game loads the map first, and each planet's details and the star chart when opened

PRD #1808, the spec beside this plan (`spec.md`). One feature branch, `feat/arcade-lazy-details`, into
`main` (`Closes #1808`); each slice is a sub-PR from `feat/arcade-lazy-details--<slice>` into the
feature branch (`Part of #1808`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | One planet's details answer at `GET /api/arcade/planets/<key>`: its dossier and its last 8 log lines, to a signed-in member of its workspace | `apps/galaxy/src/arcade-api/planet*` `apps/galaxy/app/api/arcade/planets/` `apps/galaxy/src/data/dossiers*` | — | 1 |
| s2 | The star chart answers at `GET /api/arcade/chart`, to the crew, as `/play` sends it today | `apps/galaxy/src/arcade-api/chart*` `apps/galaxy/app/api/arcade/chart/` | — | 1 |
| s3 | The game reads a planet's details when it is opened, and `/play` sends no dossier and planets without their logs | `apps/galaxy/src/arcade/planet-details*` `apps/galaxy/src/arcade/scenes/planet*` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/arcade/ArcadeClient.tsx` `apps/galaxy/src/arcade/types.ts` `apps/galaxy/src/arcade/page.test.ts` `apps/galaxy/src/data/arcade*` `apps/galaxy/src/data/dossiers*` `apps/galaxy/app/play/` | s1 | 2 |
| s4 | The game reads the star chart when it is opened, the menu's STAR CHART row shows its tally once it is read, and `/play` sends no star chart | `apps/galaxy/src/arcade/chart-source*` `apps/galaxy/src/arcade/scenes/chart*` `apps/galaxy/src/arcade/scenes/menu*` `apps/galaxy/src/arcade/ArcadeApp.tsx` `apps/galaxy/src/arcade/ArcadeClient.tsx` `apps/galaxy/src/arcade/page.test.ts` `apps/galaxy/app/play/` | s2, s3 | 3 |

**Shared ground.** `apps/galaxy/src/data/dossiers*` is s1's (it exports the single-dossier read the
endpoint reuses) and s3's (it drops `readDossiers` once `arcadeFor` no longer calls it): s3 waits on
s1. `apps/galaxy/src/arcade/ArcadeApp.tsx`, `ArcadeClient.tsx`, `apps/galaxy/app/play/` and
`apps/galaxy/src/arcade/page.test.ts` (it reads the play page and the knowledge loader) are s3's and
s4's: s4 waits on s3, in wave 3. s1 and s2 create files in the new folder `apps/galaxy/src/arcade-api/`
under prefixes that do not meet (`planet*`, `chart*`), so they share wave 1. Other tests read
`ArcadeApp.tsx` as text (`brand`, `deep-link`, `game-field`, `leave`, the duet and kart guards,
`home`): s3 and s4 keep the strings they read, and a slice that must change one adds it to its
territory first.

## Per slice: done when

**s1** (`ui: yes`)
- `GET /api/arcade/planets/<key>`, `<key>` URL-encoded as one segment (`vertuoza%2Fvertuo-omni-loop%2312`),
  answers `{ dossier, log }` to a signed-in member: the planet's dossier as the DOSSIER tab shows it,
  or `none`, and its last 8 log lines, read from the cached season.
- Signed out: 401. A planet outside the member's workspace: 404. A read that fails: 500, its error
  logged; the dossier read on its own gives `unreadable` in the answer.
- The reads run as the person (their Supabase session); at most 3 database calls per answer.
- `app/api/arcade/planets/[key]/route.ts` re-exports a controller in `apps/galaxy/src/arcade-api/`,
  as the other routes do; the controller's tests cover each answer above on fixtures, a key holding
  `/` and `#` included. No test calls Supabase or GitHub.

**s2** (`ui: yes`)
- `GET /api/arcade/chart` answers the knowledge graph `/play` sends today, to a signed-in crew member
  whose workspace is readable; 401 signed out; `none` in a build without a knowledge base; the
  out-of-reach answer when it cannot be read.
- Its controller's tests cover the crew, the outsider, the signed-out visitor and the build without
  a chart.

**s3** (`ui: yes`)
- `arcadeFor` makes no `dossier_list` or `dossier_rounds` call and sends every planet with an empty
  `log` (a fake database that records each call proves it); `readDossiers` is gone.
- BR-PRODUCT-30 holds: an unreadable membership still reads as crew, out of reach
  (`apps/galaxy/src/data/arcade.test.ts`); changing that file raises a high outbox item for the law.
- `usePlanetDetails(key)` fetches a planet once per session, shares a fetch in flight, says
  `loading`, `loaded` or `unreadable`, keeps no failure (the next open asks again) and never fetches
  in the demo; tested: the same planet opened twice fetches once, switching planets mid-load shows
  the selected planet only, an answer after the overlay closed draws nothing.
- The planet overlay opens at once; its DOSSIER and LOG tabs show `LOADING…`, then their content, or
  `DOSSIERS OUT OF REACH` / `LOG OUT OF REACH`; START opens the dossier's page only once it has
  arrived. A planet opened by its deep link loads the same way.
- The draft screen `planet-overlay` matches what the overlay shows.

**s4** (`ui: yes`)
- `/play` sends no star chart; `useChart()` reads `/api/arcade/chart` once per session when the chart
  opens, never in the demo, and keeps no failure.
- The star chart shows `LOADING…`, then the chart as today, or `THE STAR CHART IS OUT OF REACH`.
- The menu's STAR CHART row shows no tally until the chart has been read in the session, then its
  tally as today; the chart's door opens as it does today.
- The draft screens `star-chart` and `arcade-menu` match what the game shows.
- Once s4 merges, `/play` signed in sends at most 1 MB of HTML and runs no dossier read (acceptance
  criteria 1 and 2, measured on the preview).
