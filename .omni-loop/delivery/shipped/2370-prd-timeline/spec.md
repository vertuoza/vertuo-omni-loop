---
prd: 2370
title: A PRD's timeline — how long each step took, idea to merged
blocked-by: none
spec: file
phase0: server
---

## Problem

Nobody can say where a PRD's time went. The stages sync (PRD 587) already records when each PRD
reached each stage in `prd_stages`, written once and never moved (`supabase/migrations/20261009090000_prd_stages.sql`),
yet:

- **No date is shown.** The PRD page draws the stage pills (`apps/galaxy/src/dossier/page/StageHeader.tsx`)
  and, on hover, only when the sync last ran. The one reader of `reached_at` is a roadmap's end date
  (`apps/galaxy/src/roadmap/page/load.ts`).
- **No duration is computed.** The Engineering board's median time to merge
  (`apps/galaxy/src/engineering/tally.ts`) is per pull request, not per PRD step. Nothing computes
  how long a PRD waited for its approval, how long the agents built it, or how long its review took.
- **Key moments are not on any record as a PRD's:** when its idea was opened and its plan written
  (both kept on the dossier only), when its last slice merged, and, for a PRD that lands in several
  repositories, any moment of a target repository's pull requests.

So a PM like Paul cannot tell whether a PRD was slow because it waited on an approver, on the agents
or on a reviewer, and a lead cannot tell which step is the slow one across PRDs. The bottleneck
board being brainstormed beside this PRD needs the same answer.

## Solution

A **timeline** per PRD: a record of its milestones, and the gaps between them, each with how long it
took and who it waited on. The record is the product; the PRD page and the Engineering board are two
views of it.

### 1. The milestones

| level | milestone | when | from |
|---|---|---|---|
| PRD | `idea` | the PRD's dossier was opened | `dossiers.created_at` of the dossier numbered to the PRD |
| PRD | `plan` | its plan was first written | the first `dossier_versions` row of kind `plan` |
| PRD | `approved` | it entered the inbox | the `inbox` row of `prd_stages` (phase-0 merged, or the first approval) |
| lane | `opened` | the lane's feature PR opened | its `created_at` |
| lane | `first-slice` | the first sub-PR merged into the lane's feature branch | its `merged_at` |
| lane | `last-slice` | the latest sub-PR merged into it before the lane merged | its `merged_at` |
| lane | `ready` | the lane's feature PR was marked ready | its `ready_for_review` event, or `created_at` when opened ready |
| lane | `merged` | the lane's feature PR merged into the default branch | its `merged_at` |

A **lane** is one repository the PRD lands in. A PRD of an ordinary repository has one lane, its own
repository and its feature PR. A PRD of a plan repository (`/omni:mega-brainstorm`) has one lane per
target: the target feature PR whose body starts `Part of <owner/repo>#<n>`, the rule the approved
check already reads (`apps/omni-app/src/approved-check/github.ts`), and its sub-PRs are the pull
requests merged into that PR's head branch. The plan repository's own feature PR is a lane too when
it carries slices of its own.

The PRD is **done** at its last lane's `merged`.

### 2. The record

A new table, `public.prd_milestones`, beside `prd_stages`, which stays as it is:

- one row per (workspace, PRD repository, PRD, lane, milestone), with `reached_at` and the pull
  request's number (`pr`, null for `idea`, `plan` and `approved`);
- a PRD-level milestone's lane is the PRD's own repository;
- **every time is GitHub's or the dossier's own,** never the sync's: a milestone the sync cannot
  date is not written. (This differs from `prd_stages`, whose folder fallback writes the sync's time:
  a made-up time would skew every median.)
- **first time wins,** as `prd_stages_keep_first` does, for every milestone but `last-slice`, which
  only moves later (a rework slice merged after `ready` moves it; nothing moves it earlier);
- written by the service role only; read by the workspace's members, as `prd_stages` is.

The stages sync (`/api/stages/sync`, every 15 minutes) writes it from the same GitHub read it already
makes (`apps/galaxy/src/stages/sync/github.ts`), adding each pull request's body to that read to find
the target lanes, and from the dossier rows for `idea` and `plan`. The App's stage events are not
extended: the times are GitHub's own, so a 15-minute delay moves no duration. The first sync after
the merge fills the timelines of every PRD it can read, the shipped ones included.

### 3. The gaps

One pure function, `timeline(milestones, now)` in `apps/galaxy/src/timeline/`, turns a PRD's
milestones into its gaps. Gaps are computed, never stored:

| gap | from → to | waits on |
|---|---|---|
| Writing it | `idea` → `plan` | PM + brainstorm |
| Approval | `plan` → `approved` | approver |
| Starting | the later of `approved` and `opened` → `first-slice` | agents |
| Building | `first-slice` → `last-slice` | agents |
| Finishing | `last-slice` → `ready` | agents + outbox |
| Review | `ready` → `merged` | reviewer |

PRD-level gaps are once per PRD; lane gaps once per lane. A gap whose start is recorded and whose end
is not yet is **running**, counted up to `now`. A gap missing its start is **not recorded**: never
zero, never guessed. The **total** runs from the PRD's first recorded milestone to done (or to
`now`, running). The **longest wait** is the gap with the largest duration.

### 4. On the PRD page

- **The header,** under the stage words: one line of two parts, `Idea → merged: 12.0 d · Longest: Review, 5.0 d`,
  or, while running, `Running for 4.0 d · Now: Building, 1.0 d`, durations in the board's `durationWords`.
- **The Timeline tab,** after Plan: the PRD's own milestones, then one lane per repository (a
  one-lane PRD shows one). Each milestone with its date, linked to its pull request; between two, the
  gap's name, its duration and who it waits on. The longest gap is marked. It reuses the tab id and
  the words the fix pages' Timeline tab uses (PRD 627: `not yet`, `not recorded`,
  `apps/galaxy/src/fixes/timeline.ts`).

### 5. On the Engineering board

A **Time per step** panel: for each gap, the median over the PRDs done in the board's period (one
value per lane for lane gaps), how many it covers, and the slowest step named
(`Slowest step: Review, median 2.0 d`). Durations are written by the board's own `durationWords`.

## Conventions

| repo | layer | name | source |
|---|---|---|---|
| vertuo-omni-loop | database | `public.prd_milestones` | no written convention: follows `public.prd_stages` ← supabase/migrations/20261009090000_prd_stages.sql:17 |
| vertuo-omni-loop | database | `prd_milestones_keep_first` (trigger) | no written convention: follows `prd_stages_keep_first` ← supabase/migrations/20261009090000_prd_stages.sql:47 |
| vertuo-omni-loop | database | migration `<next free version>_prd_milestones.sql` | conventions › A new migration takes the next free version ← .omni-loop/knowledge/playbook/conventions.md:27 |
| vertuo-omni-loop | database | columns `milestone`, `lane`, `pr`, `reached_at` | no written convention: follows `stage`, `reached_at` ← supabase/migrations/20261009090000_prd_stages.sql:21 |
| vertuo-omni-loop | galaxy | `apps/galaxy/src/timeline/` with `timeline.ts`, `timeline()` | no written convention: follows `apps/galaxy/src/stages/stage.ts:17` (one folder per area) |
| vertuo-omni-loop | galaxy | types `MilestoneId`, `Gap`, `GapId` | no written convention: follows `StageId` ← apps/galaxy/src/stages/stage.ts:17 |
| vertuo-omni-loop | galaxy | `pr: PrNumber`, `prd: PrdNumber` | conventions › Naming ← .omni-loop/knowledge/playbook/conventions.md:5 |
| vertuo-omni-loop | galaxy | tab `timeline` on a PRD | reuses `DossierTab` `'timeline'` ← apps/galaxy/src/dossier/page/view.ts:99 |
| vertuo-omni-loop | galaxy | panel `Time per step` | no written convention: follows the board's panels ← apps/galaxy/src/engineering/EngineeringBoard.tsx:75 |

## Decisions

- **Deploy time is out.** The person chose to stop at merge: deployment events are a rabbit hole for
  now. When they come back, they are read only from GitHub's deployment events, never from a
  customer's deploy system (the person's answer in this brainstorm).
- **All steps, every lane.** The person chose every milestone, and every repository a PRD lands in,
  so the time between repositories is visible.
- **A new table, not new stages.** `prd_stages` feeds the stage pills, the lists, the board and the
  profiles; adding milestones to it would move every pill. Approved by the person as section 1.
- **The sync only, no new App event.** The times are GitHub's own, so the stage events would only
  make the page fresher, not truer. The GitHub App's permissions and events do not change.
- **No made-up time.** A milestone without its own time is left out, unlike `prd_stages`' folder
  fallback.
- **Waits on is the step's, not a person's.** A gap names a role (an approver, a reviewer, the
  agents), never a login: who was waited on by name is the bottleneck board's question.
- **Product PRDs (`<key>-<n>`) are out of this PRD.** Their pull requests say `Part of <key>-<n>`
  and their PRD lives on the server, not in a repository's `prd_stages`. Most reversible: they gain
  a timeline in a later PRD, reading the same `timeline()`.
- **The objection** of persona:F-E Developer ("if the only thing measured is speed, my PM will push
  me to merge faster") was shown with section 1 and approved without an answer: settled `none`.

## User stories

1. As a PM, on a PRD's page, I see how long it took from idea to merged, and which step was the
   longest.
2. As a PM, on the Timeline tab, I see each milestone's date and each gap's duration and who it
   waited on, for every repository the PRD lands in.
3. As a PM, while a PRD is still being built, I see how long it has been running and which step it
   is in now.
4. As a lead engineer, on the Engineering board, I see the median of each step over the PRDs done in
   the period, and which step is the slowest.
5. As the bottleneck board (the next PRD), I read the same timeline instead of computing my own.

## Scope

In: the `prd_milestones` table and its trigger and policies; the sync writing it (pull request
bodies read, target lanes, dossier times); `timeline()`; the header line and the Timeline tab on a
PRD's page; the Time per step panel; the guide's line on the PRD page.

Out: deploy time; token cost and money; the bottleneck board; product PRDs (`<key>-<n>`); a fix's
timeline (it has its own, PRD 627); notifications on a slow step.

## Test seams

Following `omni kb show testing`: vitest beside the code; nothing calls GitHub or Supabase.

- **`timeline()`,** a pure module: gaps in order, a running gap counted to a fixed `now`, a gap
  missing its start, `opened` before `approved` (Starting starts at the later), a rework slice after
  `ready`, a PRD of three lanes, the total and the longest wait.
- **The sync's mapping,** on a fixture GitHub snapshot (`apps/galaxy/src/stages/sync/core.test.ts`'s
  shape): one-lane PRD, a plan repository with two target PRs (`Part of acme/plan#7`), a PR opened
  ready, a PR without a time (nothing written).
- **The store,** with the stage store's fake (`store.fake.ts`): first time wins, `last-slice` moves
  only later.
- **The migration,** in `supabase/checks/`: the trigger keeps the first time, `last-slice` moves
  later only, a member reads their workspace's rows, a non-member reads none, a member cannot write.
- **The views,** rendered from fixtures: the header line (done, running, no milestone), the
  Timeline tab (one lane, three lanes, not recorded), the Time per step panel (medians, an empty
  period).

## Risks

- **What merging publishes:** a migration applied to production by the `supabase` workflow, and
  galaxy deployed by the release commit (`omni kb show releasing`). Rollback: revert the feature PR;
  the table is new and read only by this PRD's views, so a follow-up migration dropping it is safe.
- **The sync's GitHub budget:** pull request bodies come in the same list calls the sync already
  makes, so no new request is made (PRD 902's budget). A plan repository's targets are read only when
  they are tracked repositories of the workspace.
- **Backfill volume:** the first sync writes milestones for every PRD it reads (about 220 here). The
  upsert is batched like `recordStages`.
- **The Legal entries:** L-GDPR-1 — the rows hold repository names, PRD and pull request numbers and
  times, no login or email, and only the workspace's members read them. Otherwise none touched.
- **The locked laws:** `omni kb laws` printed every locked law for these paths; the design changes
  none of them:
  - BR-PRODUCT-3, BR-PRODUCT-5, BR-PRODUCT-6, BR-PRODUCT-12: no gate, label or answer changes; the timeline only reads.
  - BR-PRODUCT-28, BR-PRODUCT-29, BR-PRODUCT-39, BR-PRODUCT-59, BR-PRODUCT-63, BR-PRODUCT-64, BR-PRODUCT-94: no sign-in, membership, key or agent link changes; the new rows are read by members only.
  - N-PRODUCT-3, N-PRODUCT-4, N-PRODUCT-7, N-PRODUCT-8, N-PRODUCT-13, N-PRODUCT-14: no question, check, hook or install changes.
  - N-PRODUCT-15: nothing merges; the timeline reads merges.
  - N-PRODUCT-16: the game's ledger is untouched; `prd_milestones` is a separate table.
  - N-PRODUCT-17: no secret reaches the browser; the views are rendered on the server.
  - Changing any of them needs @pierrederval or @dervalp to approve the pull request on GitHub.

## Acceptance criteria

1. After a sync, a PRD of this repository whose feature PR merged has rows in `prd_milestones` for
   `approved`, `opened`, `first-slice`, `last-slice`, `ready` and `merged`, each dated by GitHub, and
   `idea` and `plan` when its dossier has them.
2. A PRD of a plan repository with two target feature PRs (`Part of <owner/repo>#<n>`) has one lane
   per target, each with its own milestones; the PRD is done at the later merge.
3. A second sync never moves a milestone's time, except `last-slice`, which only moves later.
4. A milestone GitHub or the dossier cannot date is not written, and its gap reads `not recorded`.
5. A merged PRD's page shows `Idea → merged: <total> · Longest: <gap>, <duration>` under its stage; a
   PRD being built shows `Running for <total> · Now: <gap>, <duration>`.
6. The PRD's Timeline tab lists the PRD's milestones and each lane's, every gap with its duration and
   who it waits on, the longest marked.
7. The Engineering board's Time per step panel shows, for each gap, the median over the PRDs done in
   the period and how many it covers, and names the slowest step; with none done, it says so.
8. A member of another workspace reads no row of `prd_milestones`, and no member can write one.
