# Plan: Measure where the settings pages lose their time

PRD #3215 (spec beside this plan, `spec.md`). The feature branch `feat/settings-speed-baseline` goes into `main` as one feature PR (`Closes #3215`); each slice is a sub-PR from `feat/settings-speed-baseline--<slice>` into the feature branch (`Part of #3215`). Roadmap #3223, row P1, wave 1, blocked by none.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | Every settings route has a counted read profile (reads, sequential depth, loader per read) in `baseline.json`, and a ratchet plus a route-coverage test fail on growth, on an unlowered improvement and on a route with no row | `apps/galaxy/src/settings-perf/profile*` `apps/galaxy/src/settings-perf/coverage*` `apps/galaxy/src/settings-perf/baseline.json` | — | 1 | deep |
| s2 | A settings response says where its time went: `shell`, `data` and `render` entries in a `Server-Timing` value and nothing else of the request | `apps/galaxy/src/settings-perf/timing*` `apps/galaxy/app/app/settings/` `apps/galaxy/app/app/layout.tsx` | s1 | 2 | build |
| s3 | `budget.md` states the Q5 budget and lists, from the profile, each page that misses it with the loader that causes it | `apps/galaxy/src/settings-perf/budget*` | s1 | 2 | light |

### Shared ground

- `apps/galaxy/src/settings-perf/` is one folder that three slices write into. Each owns a distinct file family (`profile*` and `coverage*` and `baseline.json`; `timing*`; `budget*`), so no two territories intersect. The folder is new: no slice may create a file outside its own family in it.
- s2 edits the settings pages and `app/app/layout.tsx`, which s1 only reads (through the profiler). s2 therefore waits for s1 so that the ratchet proves the timing wrapper added no read: its pages' counts must still equal the baseline.
- s3 only reads the finished profile, so it needs s1 and shares no ground with s2: they share wave 2.
- Tests that read the files s2 changes: `git grep` over the test files finds no test that renders `app/app/settings/*/page.tsx` or the app layout; the loaders' own tests (`src/fleets/`, `src/business/`, and the like) are not in any territory and are not changed. s1's profiler is the only test over the pages.
- No generated path is touched. Other PRDs of roadmap #3223 (3216 to 3222) also change the settings pages; the roadmap's blockers order them after this PRD, and a conflict with one is theirs to resolve.

## Per slice: done when

### s1 (deep: the counting seam and the ratchet's two-sided rule are the design)

- A profiler in `apps/galaxy/src/settings-perf/` renders each route under `app/app/settings/` in test over the pages' existing fakes, and counts per page its reads (database calls, rpc calls, outbound fetches), its sequential depth (the longest chain) and the loader that made each. Round trips are counted, never milliseconds. It reaches no real Supabase, GitHub or network.
- AC-1: `baseline.json` holds a row for the root, Fleets, Repositories, Business, API keys, Jev and Playbook, each with its reads, its depth and the loader of each read; the measured value of each equals its row.
- AC-2: a page given one more awaited read after another fails the ratchet, and the failure names the page and the new depth.
- AC-3: a page measured lower than its row fails until the row is lowered to the measured value.
- AC-4: a directory under `app/app/settings/` holding a page and no baseline row fails the coverage test, naming the route. `products/` (a route handler, no page) is not a page and needs no row.
- The layout's one shared read of the viewer is counted once for Settings as a whole, apart from each page's own reads, so the budget's "after the shared read" is computable.

### s2

- AC-5: the response built for a settings page carries a `Server-Timing` value with `shell`, `data` and `render` entries, each a name and a duration, and no other field of the request (no workspace, person or query).
- The mechanism follows the one PRD 2401 settled for `/prd` (`src/dossier/page/timing.ts`): a page of the App Router cannot set a header once it streams, so the value rides in the document as a hidden `<template id="server-timing">`. Reusing `createTimings` and `serverTiming` is allowed only if that does not make `settings-perf` import a dossier folder in a way the layering guard refuses; otherwise the slice writes its own small helper under `settings-perf/timing*`.
- The ratchet of s1 still passes unchanged: wrapping a read in `time` adds no read and no depth.
- No screen changes: the template is hidden and the skeletons stay as they are.

### s3 (light: a written document from the profile s1 produced)

- AC-6: `apps/galaxy/src/settings-perf/budget.md` states the Q5 budget as the spec words it (no page makes more than two sequential reads after the one read shared by Settings, and its frame is usable before any slow read finishes), and lists each page that misses it today with the loader that causes it, every number taken from `baseline.json`.
- It names, as the brief for the fast-loads PRD (#3219), what each missing page must change; it changes no code.
