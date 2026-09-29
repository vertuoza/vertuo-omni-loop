---
prd: 587
title: Real PRD stages and counts per stage
blocked-by: [572]
spec: file
---

# Real PRD stages and counts per stage

**Date:** 2026-09-29 · **PRD:** #587 · **Touches:** `supabase/migrations/` (one new table, one new
column), `apps/galaxy/src/dossier/` (the stage, the header, the history), `apps/galaxy/app/api/`
(one new route), `apps/galaxy/app/prd/` (the list), the dashboard tile of PRD 572,
`apps/omni-app/src/webhook/` (forwarding PR events), and the stage words in the kit
(`kit/lib/status/`, `kit/plugin/skills/brainstorm/SKILL.md`).

## Problem

The stage pills on a PRD's page (idea, PRD, inbox, outbox, shipped, retro) are worked out on every
page view from one live GitHub read. When any part of that read fails (the App is not installed on
the repo, the rate limit, a 5xx), the page shows **"Stage unknown: GitHub did not answer."** and
lights no pill. PRD 580's page shows exactly that. The pills also do not match what a person expects:
idea is only "a draft", and "being built" and "waiting for you" share one outbox pill.

Nothing stores a stage, so nobody can count PRDs per stage. The /prd list shows no stage at all.

## Solution

**Seven stages, each lit by one event.** The database records the date each stage was reached, and
the current stage is the latest one reached:

| # | Stage | Reached when | Recorded by |
|---|---|---|---|
| 1 | idea | the first question of the dossier is answered | galaxy, when the answer is saved |
| 2 | PRD | the dossier holds both a spec and a before/after version | galaxy, when a push adds the second of them |
| 3 | inbox | the phase-0 PR is merged | omni-app webhook → galaxy |
| 4 | building | the first sub-PR is merged into the feature branch | omni-app webhook → galaxy |
| 5 | outbox | the feature PR is marked ready for review | omni-app webhook → galaxy |
| 6 | shipped | the feature PR is merged | omni-app webhook → galaxy |
| 7 | retro | the retro PR is opened | omni-app webhook → galaxy |

A stage is recorded once, the first time it happens, and never moved back. A later stage can arrive
without the earlier ones (a PRD opened by hand): it is still the current stage, and the earlier
stops show as passed.

**The pill row.** Each passed stage is filled, the current one is bold, and later ones are faded. A
dossier with no stage yet (brainstorm asking, nothing answered) lights nothing and reads
*Brainstorming*. A PRD at **building** whose feature PR carries open outbox items (the red yolo gate)
shows a badge beside the pills, *N questions waiting*, linking to the outbox comment. The one button
and the links line keep today's rules for the new stages.

**Feeding the inbox → retro stages.** The omni-loop GitHub App already receives every
`pull_request` event in omni-app. For `closed` (merged), `ready_for_review` and `opened`, omni-app
recognises the branch from the repo's branch shapes (phase-0, slice, feature, retro) and POSTs a
**stage event** `{ repository, topic, prd | null, stage, at }` to galaxy's new
`/api/dossiers/stage`. The call is signed with an HMAC over the body, using a secret both apps share
(`STAGE_EVENT_SECRET`). The PRD number comes from the PR body's `prLinks` line when there is one.
Otherwise galaxy finds the dossier by `(home_repo, topic)`, and the topic is stored on the dossier
by the first push, from its folder name `<nnnn>-<topic>`. An event that matches no dossier is
answered `202` and dropped. The existing retro, harvest and outbox-check routes are unchanged: the
stage event is sent alongside them.

**Existing PRDs.** A one-time catch-up (`pnpm --filter galaxy stages:backfill`) reads GitHub once
per numbered dossier through today's reader and records the dates it finds: merged dates for phase-0,
the first sub-PR, the feature PR, and the retro PR's opened date. idea and PRD come from the
database's own rounds and versions. It is safe to run twice.

**Safety net.** When a numbered dossier has no stage recorded, the page runs today's GitHub read,
records what it finds and shows it. When that read fails, the page shows the last recorded stage
with a small *last checked …* note. The words "Stage unknown" disappear.

**What you see on /prd.** A stage bar sits above the list:
*idea 3 · PRD 5 · inbox 2 · building 1 · outbox 4 · shipped 20 · retro 18*. The counts use the
list's current filters except the stage, and clicking a stage filters the list (`?stage=inbox`, so
it can be shared). Each row shows its current stage pill.

**The dashboard (PRD 572).** A *PRDs by stage* tile shows the same seven counts for the board's
scope (you, a fleet, the workspace). Clicking a count opens /prd filtered to that stage and scope.

**The kit.** The seven words are the same everywhere. `omni status` gains *building* between inbox
and outbox (a PRD whose feature branch has a merged sub-PR and whose feature PR is still a draft),
and `/omni:brainstorm`'s *Where it is* block lists seven stages.

## Decisions

1. **Stored and fed by events, not read live** (asked): counts need a stored stage, and the page
   must not depend on GitHub answering.
2. **Seven stages, with `building` added** between inbox and outbox (asked). outbox means the feature
   PR is ready and waiting for a person. A red gate stays at building with a questions badge (asked).
3. **idea lights at the first answer** (asked).
4. **Passed filled, current bold** (asked).
5. **Counts on /prd and on the dashboard** (asked), so this PRD is blocked by 572.
6. **One table of dates, `dossier_stages (dossier_id, stage, reached_at)`**, primary key
   `(dossier_id, stage)`, insert-if-absent. The current stage is the highest-ranked row. Dates, not
   a single column, because they cost nothing, make the track honest, and allow "time in stage"
   later.
7. **omni-app forwards to galaxy over HTTP with an HMAC secret.** One GitHub App has one webhook URL,
   omni-app owns it, and omni-app holds no database. Forwarding keeps each app's job.
8. **The topic is stored on the dossier** (`dossiers.topic`, set by the first push), so a retro PR,
   whose body names no PRD, still finds its dossier.
9. **A forward that fails is not retried by omni-app.** The safety net and the catch-up repair a
   missed event. This stays simple, and a missed event is not lost for good.
10. **The stage words live in one place per side**: `STAGES` in `stage.ts` for galaxy, and
    `format.mjs` for the kit. A test holds the two lists to the same seven words.

## User stories

- As a person opening a PRD page, I see which stages it went through and where it is now, even when
  GitHub is slow or down.
- As a lead, I open /prd and read how many PRDs sit in each stage, then click one to see them.
- As a person on the dashboard, I see my PRDs by stage without leaving it.
- As a person running `omni status`, I read the same stage words as the app.

## Scope

In: the table and column, the stage route, omni-app forwarding, idea/PRD recording in galaxy, the
pill row, the questions badge, the /prd bar and filter, the row pill, the dashboard tile, the
catch-up script, the safety net, the kit words.

Out: time-in-stage charts, stage notifications, moving a stage back (a reverted merge), and PRDs
with no dossier (they have no page to show a stage on).

## Test seams

- `stageOf` becomes a pure function of the recorded stage rows plus the open-outbox count. Unit tests
  cover each of the seven stages, a gap (retro without inbox), no rows (Brainstorming), and the badge.
- The stage route: signature refused (401), unknown dossier (202, nothing written), a duplicate event
  (first date kept), a PRD found by number and by topic. Tested against the in-memory store fake.
- omni-app: `receiveWebhook` given a merged phase-0 PR, a merged slice PR, `ready_for_review` on the
  feature PR, a merged feature PR and an opened retro PR produces the right stage event. Other
  branches produce none. Uses the existing webhook test harness.
- The /prd bar: counts per stage respect the other filters, and `?stage=` filters rows (view tests on
  `history.ts`).
- The dashboard tile: counts per scope (view test on 572's board model).
- The catch-up: fed a fake GitHub summary, it writes the expected rows and writes nothing on a second
  run.
- The kit: `omni status` counts a building PRD, and the word lists of kit and galaxy match.
- Tests never call real GitHub or a real database.

## Risks

- **A new migration** (`dossier_stages`, `dossiers.topic`). Rolling it back means dropping the table
  and the column. The page falls back to the live read, so nothing breaks while the migration is out.
- **A new secret on two Vercel projects** (`STAGE_EVENT_SECRET` on galaxy and omni-app). While it is
  missing, the route refuses (401) and omni-app logs and carries on: stages then come only from the
  safety net.
- **omni-app is its own deploy.** A merge is not live there until that project redeploys. Inngest is
  not involved, so no Resync is needed.
- **The catch-up writes to production once.** It only inserts dates, never deletes, and is safe to
  rerun.
- Rollback: revert the feature PR. The table can stay: nothing else reads it.

## Acceptance criteria

1. A dossier whose first question is answered shows idea as the current pill. Before any answer it
   lights nothing and reads *Brainstorming*.
2. Once the dossier holds a spec and a before/after, PRD is the current pill, and idea is filled.
3. Merging the phase-0 PR makes inbox the current pill within a minute, with no page read of GitHub.
4. Merging the first sub-PR into the feature branch makes building current. Marking the feature PR
   ready makes outbox current. Merging it makes shipped current. The retro PR opening makes retro
   current.
5. A building PRD with open outbox items shows *N questions waiting* beside the pills, linking to the
   outbox comment.
6. With GitHub unreachable, a PRD page shows its last recorded stage with *last checked …*, and never
   *Stage unknown*.
7. PRD 580's page shows a real stage after the catch-up has run.
8. /prd shows a stage bar with seven counts that add up to the numbered and answered dossiers the
   other filters keep. Clicking a stage filters the list and puts `?stage=` in the URL. Each row
   shows its stage pill.
9. The dashboard shows a *PRDs by stage* tile for the board's scope, and each count opens /prd
   filtered.
10. `omni status` and `/omni:brainstorm`'s hand-off use the seven words, with building between inbox
    and outbox.
11. A stage event with a bad signature is refused (401) and writes nothing. A repeated event keeps
    the first date.
