# Plan: A PRD's timeline — how long each step took, idea to merged

PRD #2370, spec in `spec.md` beside this plan. The feature branch `feat/prd-timeline` merges into
`main` through the feature PR (`Closes #2370`); each slice is a sub-PR from
`feat/prd-timeline--<slice>` into the feature branch (`Part of #2370`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The record: `prd_milestones` with its first-time-wins trigger and members-only policies, written by the stages sync for a one-lane PRD (`approved`, `opened`, `first-slice`, `last-slice`, `ready`, `merged`), each dated by GitHub | `supabase/migrations/20261224090000_prd_milestones.sql` `supabase/checks/prd_milestones*` `supabase/database.types.ts` `.github/workflows/supabase.yml` `apps/galaxy/src/timeline/store*` `apps/galaxy/src/stages/sync/` | — | 1 | deep |
| s2 | `timeline(milestones, now)`: the six gaps, running and not-recorded gaps, the total and the longest wait, for one lane or several | `apps/galaxy/src/timeline/timeline*` | — | 1 | build |
| s3 | The PRD's own milestones from its dossier: `idea` (the dossier opened) and `plan` (its first plan version) | `apps/galaxy/src/stages/sync/` `apps/galaxy/src/timeline/store*` | s1 | 2 | build |
| s4 | A PRD of a plan repository gets one lane per target feature PR (`Part of <owner/repo>#<n>`), its sub-PRs the ones merged into that PR's head branch; the PRD is done at its last lane's merge | `apps/galaxy/src/stages/sync/` | s3 | 3 | deep |
| s5 | The PRD page: the time line under the stage words, and the Timeline tab after Plan with the PRD's milestones, one lane per repository, each gap's duration and who it waits on, the longest marked | `apps/galaxy/src/dossier/page/` `apps/galaxy/src/timeline/view*` | s1, s2 | 2 | build |
| s6 | The Engineering board's Time per step panel: each gap's median over the PRDs done in the period, how many it covers, the slowest step named | `apps/galaxy/src/engineering/` | s1, s2 | 2 | build |
| s7 | The guide says what the PRD page's time line and Timeline tab show, and what the board's Time per step panel shows | `docs/guide/loop.md` | s5, s6 | 3 | light |

**Shared ground.** `apps/galaxy/src/stages/sync/` is declared by s1, s3 and s4, and
`apps/galaxy/src/timeline/store*` by s1 and s3: they run in waves 1, 2 and 3, one after another, so
each starts from the one before it merged. The sync's tests (`apps/galaxy/src/stages/sync/sync.test.ts`,
`core.test.ts`, `github.test.ts`, `cron.test.ts`) sit inside that shared prefix and are edited only by
those three. `apps/galaxy/src/github-call-sites.test.ts` lists GitHub's call sites: s1 and s4 add a
field to an existing list call and no new site, so neither edits it. The milestone store's fake
(`apps/galaxy/src/timeline/store.fake.ts`) is s1's; s5 and s6 read it without editing it. The
migration's version is the next free one today; it is re-dated after `main`'s newest before the
feature PR is marked ready (conventions › A migration stays the newest until it merges).

## Per slice: done when

### s1 (deep: a migration, its trigger and its policies, and the sync's write)

**s1** (`ui: yes`)
- `supabase/migrations/20261224090000_prd_milestones.sql` creates `public.prd_milestones` as the
  spec's §2 says, with `prd_milestones_keep_first` keeping the first `reached_at` for every milestone
  but `last-slice`, which only moves later; RLS lets a workspace's members read its rows and nobody
  but the service role write.
- `supabase/checks/prd_milestones.sql` proves the trigger (a second write keeps the first time; a
  later `last-slice` moves it, an earlier one does not), a member reading their workspace's rows, a
  non-member reading none and a member's write refused; it is its own named step of the `supabase`
  workflow's `check` job.
- `supabase/database.types.ts` is regenerated (`node scripts/supabase-types.ts`).
- After a sync of a fixture repository whose feature PR merged, the store holds `approved`,
  `opened`, `first-slice`, `last-slice`, `ready` and `merged` for its one lane, each with GitHub's
  own time and the pull request's number; a pull request with no time writes nothing; a second sync
  moves nothing (acceptance criteria 1, 3, 4 for one lane).
- `prd_stages` and every test of the stages are unchanged.

### s2

**s2** (`ui: yes`)
- `timeline()` returns, for a fixture of milestones and a fixed `now`, the six gaps of the spec's
  §3 with their durations and who they wait on (`PM + brainstorm`, `approver`, `agents`,
  `agents + outbox`, `reviewer`).
- A gap with a start and no end is running, counted to `now`; a gap with no start is not recorded,
  never zero.
- Starting starts at the later of `approved` and `opened`; a rework slice after `ready` lengthens
  Building, not Finishing.
- A PRD of three lanes has its PRD-level gaps once and its lane gaps per lane; the total runs from
  the first recorded milestone to the last lane's `merged`, or to `now` while running; the longest
  gap is named.

### s3

**s3** (`ui: yes`)
- After a sync, a PRD whose dossier exists has `idea` at the dossier's `created_at` and `plan` at its
  first `plan` version's `created_at`, on the PRD's own repository as lane; a PRD with no dossier
  has neither, and nothing else changes (acceptance criterion 1).

### s4 (deep: matching pull requests across repositories)

**s4** (`ui: yes`)
- The sync reads each pull request's body in the list calls it already makes, adding no request.
- A fixture plan repository `acme/plan` with PRD 7 and two tracked targets, each with a feature PR
  whose body starts `Part of acme/plan#7` and sub-PRs merged into its head branch, gets one lane per
  target with its own `opened`, `first-slice`, `last-slice`, `ready` and `merged` (acceptance
  criterion 2).
- A `Part of` naming another PRD, another repository or a product PRD (`Part of mobile-12`) adds no
  lane.

### s5

**s5** (`ui: yes`)
- A merged PRD's page shows `Idea → merged: <total> · Longest: <gap>, <duration>` under its stage
  words; a PRD being built shows `Running for <total> · Now: <gap>, <duration>`; a PRD with no
  milestone shows no line (acceptance criterion 5).
- The PRD's tabs put Timeline after Plan; its pane lists the PRD's milestones, then one lane per
  repository, each milestone with its date linked to its pull request, each gap with its duration
  and who it waits on, the longest marked, `not yet` and `not recorded` as the fix pages write them
  (acceptance criterion 6).
- A fix's Timeline tab is unchanged; the demo dossier shows a timeline.

### s6

**s6** (`ui: yes`)
- The Engineering board shows Time per step: each gap's median over the PRDs done in the period
  (one value per lane for lane gaps), how many it covers, and `Slowest step: <gap>, median <duration>`
  in `durationWords` (acceptance criterion 7).
- With no PRD done in the period it says so in a sentence, with no table; a gap no PRD dated reads
  `–`.
- The demo board shows the panel.

### s7 (light: docs only)

**s7**
- `docs/guide/loop.md` says, in a few lines, what the time line and the Timeline tab show and what
  Time per step shows, in the guide's words; no other page changes.
