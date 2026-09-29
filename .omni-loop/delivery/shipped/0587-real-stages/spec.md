---
prd: 587
title: Real PRD stages and counts per stage
blocked-by: [572]
spec: file
---

# Real PRD stages and counts per stage

**Date:** 2026-09-29 · **PRD:** #587 · **Touches:** `supabase/migrations/` (one new table, one new
column), `apps/galaxy/src/dossier/` (the stage, the header, the history), `apps/galaxy/src/stages/`
(the store's stage logic and the sync), `apps/galaxy/app/api/stages/` (two new routes),
`apps/galaxy/app/prd/` (the list), the dashboard board of PRD 572 (`apps/galaxy/src/dashboard/board/`),
`apps/omni-app/src/webhook/` (forwarding PR events), one new workflow (`.github/workflows/stages.yml`),
and the stage words in the kit (`kit/lib/status/`, `kit/lib/help/`, the brainstorm and yolo
`SKILL.md`).

## Problem

The stage pills on a PRD's page (idea, PRD, inbox, outbox, shipped, retro) are worked out on every
page view from one live GitHub read. When any part of that read fails (the App is not installed on
the repo, the rate limit, a 5xx), the page shows **"Stage unknown: GitHub did not answer."** and
lights no pill. PRD 580's page shows exactly that. The pills also do not match what a person expects:
idea is only "a draft", and "being built" and "waiting for you" share one outbox pill.

Nothing stores where a PRD is. The dashboard (PRD 572) counts **events** of the period (issue opened,
phase-0 merged, feature merged), so a PRD whose folder has sat in `shipped/` for days still reads as
*drafted* in the People table and the PRDs tile: on 2026-09-29 the board read *58 drafted · 0 in
progress · 0 shipped* while all 60 PRDs on `main` were in `shipped/`. The /prd list shows no stage at
all, and nobody can count PRDs by where they are now.

## Solution

**Seven stages, stored per PRD.** A PRD is a repository and an issue number. The database records
the date each PRD reached each stage, and the current stage is the latest one reached. Stages are
stored for every PRD issue of a workspace's repositories, with or without a dossier. A dossier reads
its PRD's stages by `(home_repo, prd)`.

| # | Stage | Reached when | The repository's truth |
|---|---|---|---|
| 1 | idea | the draft dossier's first question is answered | — (a draft has no PRD yet) |
| 2 | PRD | the PRD issue is opened (`labels.prd`) | the issue exists |
| 3 | inbox | the phase-0 PR is merged | the folder is in `inbox/` on the default branch |
| 4 | building | the first sub-PR is merged into the feature branch | a merged PR from `branches.slice` |
| 5 | outbox | the feature PR is marked ready for review | the feature PR is open and not a draft |
| 6 | shipped | the feature PR is merged | **the folder is in `shipped/` on the default branch** |
| 7 | retro | the retro PR is opened | a PR from `branches.retro` exists |

A stage is recorded once, the first time it is seen, and never moved back. A later stage can be seen
without the earlier ones (a PRD opened by hand): it is still the current stage, and the earlier stops
show as passed. **idea** belongs to drafts only: it is read from the dossier's rounds, never stored,
and a numbered dossier starts at PRD.

**Two ways in, one truth.**

- **The sync, every 15 minutes, is the truth.** A scheduled workflow (`.github/workflows/stages.yml`,
  cron `*/15`) calls galaxy's `/api/stages/sync` with a bearer secret (`STAGES_SYNC_SECRET`). For
  each workspace, galaxy reads each of its repositories through the GitHub App: the repo's
  `.omni-loop` config (delivery path, branch shapes, labels), the `inbox/` and `shipped/` folders on
  the default branch, the open and closed `labels.prd` issues, and the PRs on the phase-0, slice,
  feature and retro branch shapes. It records every stage it can see, with the event's own date (an
  issue's creation, a PR's merge or ready time). A folder in `shipped/` whose feature PR is not found
  is recorded as shipped at the time of the sync. A repository it cannot read is logged and skipped,
  and the others still land. A rerun writes nothing new.
- **Events, between two syncs, for speed.** The omni-loop GitHub App already receives every
  `pull_request` event in omni-app. For `closed` (merged), `ready_for_review` and `opened`, omni-app
  recognises the branch from the repo's branch shapes and POSTs a **stage event**
  `{ repository, topic, prd | null, stage, at }` to galaxy's `/api/stages/event`, signed with an HMAC
  over the body (`STAGE_EVENT_SECRET`, shared by both apps). The PRD number comes from the PR body's
  `prLinks` line. Without one, galaxy finds the PRD by `(repository, topic)`, which the sync learns
  from each folder's name `<nnnn>-<topic>`. An event it cannot place is answered `202` and dropped:
  the next sync records it anyway.

**The pill row.** Each passed stage is filled, the current one is bold, and later ones are faded. A
draft with no answer lights nothing and reads *Brainstorming*. A PRD at **building** whose feature PR
carries open outbox items (the red yolo gate) shows a badge beside the pills, *N questions waiting*,
linking to the outbox comment. The one button and the links line keep today's rules. The header never
waits on GitHub. A PRD not synced yet shows *Syncing…* in place of the stage words, and every PRD shows
*last synced …* on hover. The words *Stage unknown* disappear.

**On /prd.** A stage bar sits above the list:
*idea 3 · PRD 5 · inbox 2 · building 1 · outbox 4 · shipped 60 · retro 18*. The counts use the list's
current filters except the stage, and clicking a stage filters the list (`?stage=inbox`, so it can
be shared). Each row shows its current stage pill. The list keeps showing dossiers only: an older PRD
with no dossier counts on the dashboard but has no row here.

**On the dashboard (PRD 572).**

- **The PRDs tile shows where each PRD is now:** seven counts, one per stage, for the board's scope
  (you: PRDs you opened; a fleet: its members'; the workspace: all). Each count opens /prd filtered to
  that stage and scope.
- **The People table's PRDs column** shows, for the PRDs each person opened, *open · building ·
  shipped* now. open is idea, PRD and inbox. building is building and outbox. shipped is shipped and
  retro.
- **The per-day chart stays events of the period,** relabelled *opened · started · shipped*, so
  nobody reads it as a current state.

**The kit.** The seven words are the same everywhere. `omni status` gains *building* between inbox
and outbox (a PRD whose feature branch has a merged sub-PR and whose feature PR is still a draft).
The *Where it is* blocks of `/omni:brainstorm`, `/omni:yolo` and `omni help` list seven stages.

## Decisions

1. **Stored, not read live** (asked): counts need a stored stage, and the page must not depend on
   GitHub answering.
2. **The 15-minute sync is the truth, and events only make it faster** (asked): the repository's
   folders and PRs decide, and a missed event is fixed by the next sync.
3. **Seven stages, with `building` added** between inbox and outbox (asked). outbox means the feature
   PR is ready and waiting for a person. A red gate stays at building with a questions badge (asked).
4. **idea lights at the first answer** (asked), and belongs to drafts only.
5. **Passed filled, current bold** (asked).
6. **Every PRD issue counts, with or without a dossier** (asked): stages are keyed by
   `(workspace_id, repository, prd)`, in one table
   `prd_stages (workspace_id, repository, prd, stage, reached_at, synced_at)`, plus
   `prd_topics (workspace_id, repository, prd, topic)`, so a retro PR, whose body names no PRD, still
   finds it.
7. **The dashboard's tile and People column show now, and the chart stays events** (asked).
8. **The sync runs in galaxy and a GitHub workflow only wakes it.** galaxy already holds the GitHub
   App's key and the service key. A scheduled workflow gives the 15-minute beat on any Vercel plan.
   The workflow holds nothing but the bearer secret.
9. **omni-app forwards to galaxy over HTTP with an HMAC secret.** One GitHub App has one webhook URL,
   omni-app owns it, and omni-app holds no database. A failed forward is not retried: the sync
   repairs it.
10. **The stage words live in one place per side**: `STAGES` in galaxy's stage module and
    `format.mjs` for the kit. A test holds the two lists to the same seven words.

## User stories

- As a person opening a PRD page, I see which stages it went through and where it is now, even when
  GitHub is slow or down.
- As a lead, I open /prd and read how many PRDs sit in each stage, then click one to see them.
- As a person on the dashboard, I read how many PRDs are shipped, building or open right now, and a
  PRD in `shipped/` never reads as drafted.
- As a person running `omni status`, I read the same stage words as the app.

## Scope

In: the two tables, the sync route and its workflow, the event route, omni-app forwarding, the pill
row, the questions badge, the /prd bar and filter, the row pill, the dashboard's PRDs tile and People
column, the chart's relabel, the kit words.

Out: time-in-stage charts, stage notifications, moving a stage back (a reverted merge), and /prd rows
for PRDs with no dossier.

## Test seams

- The stage module is pure. `stageOf(rows, openOutbox)` gives the current stage, the track and the
  badge. Unit tests cover each of the seven stages, a gap (retro without inbox), no rows (draft →
  *Brainstorming*, numbered → *Syncing…*), and the badge.
- The sync's core is a pure function: a repository's snapshot (config, folder names, issues, PRs) in,
  the stage rows out. Tests cover a folder in `shipped/` with and without its feature PR, inbox with
  and without a merged sub-PR, a ready feature PR, a retro PR, a PRD issue with no folder, and a repo
  with no `.omni-loop` config (nothing). The route's tests, on the store fake, cover a bad bearer →
  401, one unreadable repository skipped while the others land, and a rerun that writes nothing.
- The event route: a bad signature → 401 and nothing written, an unplaced event → 202, a PRD found by
  number and by topic, and a repeated event that keeps the first date.
- omni-app: `receiveWebhook` given a merged phase-0 PR, a merged slice PR, `ready_for_review` on the
  feature PR, a merged feature PR and an opened retro PR produces the right stage event. Other
  branches produce none. Uses the existing webhook harness.
- /prd: the bar's counts respect the other filters, and `?stage=` filters rows (view tests on
  `history.ts`).
- The dashboard: the tile and the People column count current stages per scope. The chart keeps its
  events under the new labels (tally, load and render tests).
- The kit: `omni status` counts a building PRD, and the word lists of kit and galaxy match.
- Tests never call real GitHub or a real database.

## Risks

- **A new migration** (`prd_stages`, `prd_topics`). Rolling it back means dropping both tables.
- **Two new secrets.** `STAGES_SYNC_SECRET` goes on galaxy and in the repository's Actions secrets.
  `STAGE_EVENT_SECRET` goes on galaxy and omni-app. While one is missing, its route refuses (401) and
  stages come from the other way in.
- **The sync reads GitHub every 15 minutes** for every workspace repository, through the App's
  installation token. That is a handful of calls per repository, far under the App's rate limit. A
  repository that fails is skipped, never retried in a loop.
- **omni-app is its own deploy.** A merge is not live there until that project redeploys. Inngest is
  not involved, so no Resync is needed.
- **The sync writes to production from its first run.** It only inserts dates and never deletes.
- Rollback: revert the feature PR and disable the workflow. The tables can stay, because nothing else
  reads them.

## Acceptance criteria

1. A draft whose first question is answered shows idea as the current pill. Before any answer it
   lights nothing and reads *Brainstorming*.
2. A numbered PRD shows PRD once its issue exists.
3. Within 15 minutes of the first sync, every PRD whose folder is in `shipped/` counts as shipped (or
   retro) on /prd and on the dashboard, and none of them counts as open. On this repository that is
   the 60 PRDs in `shipped/` on 2026-09-29.
4. Merging the phase-0 PR makes inbox current within a minute through the event, or by the next sync
   without it.
5. Merging the first sub-PR into the feature branch makes building current. Marking the feature PR
   ready makes outbox current. Merging it makes shipped current. The retro PR opening makes retro
   current.
6. A building PRD with open outbox items shows *N questions waiting* beside the pills, linking to the
   outbox comment.
7. With GitHub unreachable, a PRD page shows its stored stage, and the string *Stage unknown* appears
   nowhere.
8. PRD 580's page shows a real stage after the first sync.
9. /prd shows a stage bar with seven counts over the dossiers the other filters keep. Clicking a stage
   filters the list and puts `?stage=` in the URL. Each row shows its stage pill.
10. The dashboard's PRDs tile shows seven current counts for the board's scope, each opening /prd
    filtered. The People table's PRDs column reads *open · building · shipped* now. The per-day chart
    reads *opened · started · shipped*.
11. `omni status`, `omni help` and the hand-offs of `/omni:brainstorm` and `/omni:yolo` use the seven
    words, with building between inbox and outbox.
12. A sync or stage event with a bad secret is refused (401) and writes nothing. A rerun of the sync
    and a repeated event write nothing new.
