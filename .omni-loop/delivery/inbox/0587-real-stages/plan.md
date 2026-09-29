# Plan: Real PRD stages and counts per stage

PRD #587, spec in `spec.md` beside this plan. Built on the feature branch `feat/real-stages` into
`main` (`Closes #587`), through sub-PRs from `feat/real-stages--<slice>` into the feature branch
(`Part of #587`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A PRD's page shows seven pills from stored stages: `prd_stages` and `prd_topics` exist, the stage module gives the current stage, the track (passed filled, current bold) and the *N questions waiting* badge at building, a draft reads idea from its rounds (*Brainstorming* with no answer), a numbered PRD with no rows reads *Syncing…*, the header never reads GitHub for the stage, and *Stage unknown* is gone | `supabase/migrations/20261008090000_prd_stages.sql` `supabase/checks/prd_stages.sql` `apps/galaxy/src/stages/stage` `apps/galaxy/src/stages/store` `apps/galaxy/src/dossier/page/stage` `apps/galaxy/src/dossier/page/StageHeader` `apps/galaxy/src/dossier/page/view` `apps/galaxy/src/dossier/page/demo` `apps/galaxy/src/dossier/page/dossier.css` `apps/galaxy/app/prd/[id]/` | — | 1 |
| s2 | Every 15 minutes the sync records every stage the workspace repositories show: `stages.yml` calls `/api/stages/sync` with the bearer secret, galaxy reads each repository's config, `inbox/` and `shipped/` folders, `labels.prd` issues and branch-shaped PRs through the GitHub App, records each stage with its event's date (a `shipped/` folder with no feature PR at the sync's time), learns each folder's topic, skips an unreadable repository, and writes nothing on a rerun | `apps/galaxy/src/stages/sync/` `apps/galaxy/app/api/stages/sync/` `.github/workflows/stages.yml` `apps/galaxy/.env.example` `apps/galaxy/README.md` | s1 | 2 |
| s3 | Merging a phase-0 PR, merging the first sub-PR, marking the feature PR ready, merging it and opening the retro PR each record their stage within a minute: omni-app's webhook recognises the branch by the repo's branch shapes and POSTs a signed stage event to `/api/stages/event`, which places the PRD by number or by topic, keeps the first date, refuses a bad signature (401) and drops an unplaced event (202) | `apps/omni-app/src/webhook/` `apps/omni-app/src/stage-forward/` `apps/omni-app/README.md` `apps/galaxy/app/api/stages/event/` `apps/galaxy/src/stages/event/` | s1 | 2 |
| s4 | /prd shows the stage bar with seven counts that follow the other filters, `?stage=` filters the rows, and each row shows its stage pill | `apps/galaxy/src/dossier/page/history` `apps/galaxy/src/dossier/page/DossierHistory` `apps/galaxy/src/dossier/page/source` `apps/galaxy/app/prd/page.tsx` | s1 | 2 |
| s5 | `omni status`, `omni help` and the hand-offs of `/omni:brainstorm` and `/omni:yolo` use the seven words, with building between inbox and outbox, and a test holds the kit's list to galaxy's `STAGES` | `kit/lib/status/` `kit/lib/help/` `kit/plugin/skills/brainstorm/SKILL.md` `kit/plugin/skills/yolo/SKILL.md` `kit/test/plugin.test.mjs` `kit/test/stage-words.test.mjs` `kit/dist/omni.mjs` | s1 | 2 |
| s6 | The dashboard's PRDs tile shows seven current counts for the board's scope, each opening /prd filtered; the People table's PRDs column reads *open · building · shipped* now for the PRDs each person opened; the per-day chart keeps its events under *opened · started · shipped* | `apps/galaxy/src/dashboard/board/` | s1, s4 | 3 |

**Shared ground.**
- No prefix is declared by two slices. s2, s3, s4 and s5 share wave 2 and meet at nothing: s2 owns
  `src/stages/sync/`, its route, the workflow, the galaxy env example and README (both new secrets
  are documented there); s3 owns `src/stages/event/`, its route and omni-app; s4 owns the history
  files by name; s5 owns only kit paths.
- `apps/galaxy/src/stages/stage` and `apps/galaxy/src/stages/store` (the module, the store, its fake
  and their tests) belong to s1 alone. They are prefixes of files, so they do not cover s2's
  `src/stages/sync/` or s3's `src/stages/event/`. s1 adds every store read and write the later slices
  call: record a stage (first date kept), record a topic, read a PRD's stages, count per stage for a
  set of PRDs, and find a PRD by topic. s2, s3, s4 and s6 use them unchanged, hence their blocker.
- `STAGES` and the pill component live in s1's `src/stages/stage*`. s4 and s6 import them unchanged,
  and s5's test reads the list.
- s6 comes last because its tile's counts link to s4's `?stage=` filter. PRD 572's board is on
  `main` since #575.

## Per slice: done when

**s1**
- The migration creates `prd_stages (workspace_id, repository, prd, stage, reached_at, synced_at)`
  with primary key `(workspace_id, repository, prd, stage)` and `stage` checked against PRD, inbox,
  building, outbox, shipped and retro. It also creates `prd_topics (workspace_id, repository, prd,
  topic)`, unique on `(workspace_id, repository, topic)`. Row-level security lets a member read their
  workspace's rows, and only the service role writes. `supabase/checks/prd_stages.sql` proves a second
  insert of a stage keeps the first date, and that a non-member reads nothing.
- The store has `recordStages`, `recordTopic`, `stagesOf`, `stageCounts` and `prdByTopic`, with
  fakes, covered by its tests.
- The stage module's tests: a draft with no answer reads *Brainstorming* with nothing lit, and with an
  answer lights idea. A numbered PRD with no rows reads *Syncing…*. Each stored stage lights its pill
  with the earlier ones passed. `retro` alone shows every earlier stop passed. Building with open
  outbox items shows the badge linking to the outbox comment. The one button keeps today's rules for
  each stage.
- `view.test.ts` / `page.test.ts`: the header renders from the stored rows with the GitHub reader
  failing, shows *last synced …* on hover, and the string *Stage unknown* appears nowhere in
  `apps/galaxy/src`.

**s2**
- The sync core's tests, on repository snapshots: a folder in `shipped/` with its merged feature PR
  gives shipped at the merge date, and without it shipped at the sync's time. A folder in `inbox/`
  with a merged phase-0 gives PRD and inbox, and with a merged slice PR building too. An open,
  non-draft feature PR gives outbox. A retro-branch PR gives retro. A `labels.prd` issue with no
  folder gives PRD. A repository without `.omni-loop` config gives nothing. Each folder's name gives
  its topic.
- The route's tests, on the store fake and a fake reader: a missing or bad bearer gives 401 and
  writes nothing. One unreadable repository is logged and skipped while the others land. A rerun
  writes nothing new. The reply names the counts per repository.
- `stages.yml` runs on `*/15` and on `workflow_dispatch`, calls the route with
  `STAGES_SYNC_SECRET`, and fails the run on a non-2xx reply.
- `apps/galaxy/.env.example` lists `STAGES_SYNC_SECRET` and `STAGE_EVENT_SECRET`, and the README says
  where each is set.

**s3**
- `webhook.test.mjs`: a merged `docs/phase-0-x` PR gives `inbox`. A merged `feat/x--s1` PR gives
  `building`. `ready_for_review` on `feat/x` gives `outbox`. A merged `feat/x` gives `shipped`. An
  opened `docs/retro-x` gives `retro`. Each carries the repository, the topic, and the PRD number
  from the body's link line when present. Any other branch or action gives no stage event. The retro,
  harvest and outbox-check events are unchanged.
- The forward signs the body with `STAGE_EVENT_SECRET`. A missing secret or a failed POST is logged
  and never fails the webhook's reply.
- The event route's tests, on the store fake: a bad or missing signature gives 401 and writes
  nothing. An unplaced event gives 202 and writes nothing. A PRD found by number, or by topic, gets
  its row written. A repeated event keeps the first date.
- The omni-app README names `STAGE_EVENT_SECRET` and its redeploy.

**s4**
- `history.test.ts`: the bar's seven counts follow the repository, mine/all, draft/PRD and search
  filters but not the stage. `?stage=inbox` keeps only inbox rows. An unknown `stage` value is
  ignored.
- `history-render.test.ts`: the bar renders in stage order with the selected stage highlighted.
  Clicking a selected stage clears it. Each row renders its current stage pill (none for a draft with
  no answer).

**s5**
- `overview.test.mjs`: a PRD in the base's inbox whose feature branch has a merged sub-PR and whose
  feature PR is a draft counts as building, and one whose feature PR is ready counts as outbox.
- `format.test.mjs` and `render.test.mjs` show the seven words in order.
- The *Where it is* blocks in `brainstorm/SKILL.md` and `yolo/SKILL.md` list seven stages, and
  `plugin.test.mjs` holds them.
- `stage-words.test.mjs` fails when the kit's stage list differs from `STAGES` in galaxy's stage
  module.
- `kit/dist/omni.mjs` is rebuilt, and `dist.test.mjs` passes.

**s6**
- `tally.test.ts`: the tile's seven counts cover the board's scope's PRDs by their current stage
  (you: PRDs you opened; a fleet: its members'; the workspace: all), and a PRD in shipped never
  counts as open. The People column groups each person's PRDs into open (idea, PRD, inbox), building
  (building, outbox) and shipped (shipped, retro).
- `load.test.ts`: the board reads the stage counts through s1's store. A failed read marks only the
  PRDs parts unreadable.
- `render.test.ts`: the tile links each count to `/prd?stage=<stage>` with the scope's filter. The
  People header reads *open · building · shipped*. The chart's legend reads *opened · started ·
  shipped*.
