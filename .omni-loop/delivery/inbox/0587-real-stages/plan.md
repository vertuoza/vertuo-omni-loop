# Plan: Real PRD stages and counts per stage

PRD #587, spec in `spec.md` beside this plan. Built on the feature branch `feat/real-stages` into
`main` (`Closes #587`), through sub-PRs from `feat/real-stages--<slice>` into the feature branch
(`Part of #587`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A PRD's page shows seven pills from stored dates: `dossier_stages` and `dossiers.topic` exist, database triggers record idea (first answered round) and PRD (spec + before/after versions), the push stores the topic, `stageOf` reads the rows (passed filled, current bold, *Brainstorming* with none, the *N questions waiting* badge at building), and a dossier with no rows falls back to today's GitHub read, records what it finds, and shows *last checked …* instead of *Stage unknown* | `supabase/migrations/20261008090000_dossier_stages.sql` `supabase/checks/dossier_stages.sql` `apps/galaxy/src/dossier/store` `apps/galaxy/src/dossier/api` `apps/galaxy/src/dossier/page/stage` `apps/galaxy/src/dossier/page/StageHeader` `apps/galaxy/src/dossier/page/view` `apps/galaxy/src/dossier/page/demo` `apps/galaxy/src/dossier/page/dossier.css` `apps/galaxy/app/prd/[id]/` `apps/galaxy/app/api/dossiers/push/` | — | 1 |
| s2 | Merging a phase-0 PR, merging the first sub-PR, marking the feature PR ready, merging it and opening the retro PR each record their stage: omni-app's webhook recognises the branch by the repo's branch shapes and POSTs a signed stage event to galaxy's `/api/dossiers/stage`, which finds the dossier by PRD number or by topic, keeps the first date, refuses a bad signature (401) and drops an unknown dossier (202) | `apps/omni-app/src/webhook/` `apps/omni-app/src/stage-forward/` `apps/omni-app/README.md` `apps/galaxy/app/api/dossiers/stage/` `apps/galaxy/src/dossier/stage-event` `apps/galaxy/.env.example` | s1 | 2 |
| s3 | /prd shows the stage bar with seven counts that follow the other filters, `?stage=` filters the rows, and each row shows its stage pill | `apps/galaxy/src/dossier/page/history` `apps/galaxy/src/dossier/page/DossierHistory` `apps/galaxy/src/dossier/page/source` `apps/galaxy/app/prd/page.tsx` | s1 | 2 |
| s4 | `pnpm --filter galaxy stages:backfill` records the stage dates of every numbered dossier once, through today's reader, and writes nothing on a second run; PRD 580's page shows a real stage after it | `apps/galaxy/scripts/stages-backfill.mjs` `apps/galaxy/src/dossier/backfill/` `apps/galaxy/package.json` | s1 | 2 |
| s5 | `omni status`, `omni help` and the hand-offs of `/omni:brainstorm` and `/omni:yolo` use the seven words, with building between inbox and outbox, and a test holds the kit's list to galaxy's `STAGES` | `kit/lib/status/` `kit/lib/help/` `kit/plugin/skills/brainstorm/SKILL.md` `kit/plugin/skills/yolo/SKILL.md` `kit/test/plugin.test.mjs` `kit/test/stage-words.test.mjs` `kit/dist/omni.mjs` | s1 | 2 |
| s6 | The dashboard (PRD 572) shows a *PRDs by stage* tile for the board's scope, each count opening /prd filtered to that stage | `apps/galaxy/src/dashboard/board/` `apps/galaxy/src/dashboard/stages/` | s1, s3 | 3 |

**Shared ground.**
- No prefix is declared by two slices. s2, s3, s4 and s5 share wave 2 and meet at nothing: s2 owns
  the new stage route, its event parser and omni-app; s3 owns the history files by name; s4 owns the
  backfill script, its folder and `apps/galaxy/package.json`; s5 owns only kit paths.
- `apps/galaxy/src/dossier/store` (the store, its fake and its test) belongs to s1 alone. s1 adds
  every store read and write the later slices call: record a stage, read a dossier's stages, count
  per stage for a filter, and find a dossier by topic. s2, s3, s4 and s6 use them unchanged, hence
  their blocker.
- `apps/galaxy/src/dossier/page/stage` covers `stage.ts` and `stage.test.ts`. `STAGES` and the
  pill component live there, s3 and s6 import them unchanged, and s5's test reads the list.
- `apps/galaxy/src/dossier/page/source` belongs to s3 (the history's loader). s1 does not touch it:
  the page's loader is `apps/galaxy/app/prd/[id]/`.
- s6 comes last because PRD 572's board (`src/dashboard/board/`) must be merged on `main` (this PRD
  is blocked by 572), and because its counts link to s3's `?stage=` filter.

## Per slice: done when

**s1**
- The migration creates `dossier_stages (dossier_id, stage, reached_at)` with primary key
  `(dossier_id, stage)`, `stage` checked against the seven words, and adds `dossiers.topic`, unique
  per `home_repo` when set. `supabase/checks/dossier_stages.sql` inserts a row of each stage and
  proves a second insert of the same stage keeps the first date.
- Triggers insert `idea` when a round linked to the dossier gets its first answer, and `prd` once the
  dossier holds both a spec and a before/after version, each at that moment and only once. The check
  file proves both.
- The store has `recordStage`, `stagesOf`, `stageCounts` and `dossierByTopic`, with fakes, covered by
  `store.test.ts`.
- A push whose folder is `<nnnn>-<topic>` sets the dossier's topic when it is empty (api test).
- `stage.test.ts`: no rows reads *Brainstorming* with nothing lit; each of the seven stages lights
  its pill with the earlier ones passed; `retro` alone shows every earlier stop passed; building with
  open outbox items shows the badge linking to the outbox comment; the one button keeps today's rules
  for each stage.
- `view.test.ts` / `page.test.ts`: a numbered dossier with no rows runs the GitHub read once, records
  the stages it finds, and renders them; with the read failing it renders the last recorded stage and
  *last checked …*, and the string *Stage unknown* appears nowhere in `apps/galaxy/src`.

**s2**
- `webhook.test.mjs`: a merged `docs/phase-0-x` PR gives `inbox`, a merged `feat/x--s1` PR gives
  `building`, `ready_for_review` on `feat/x` gives `outbox`, a merged `feat/x` gives `shipped`, an
  opened `docs/retro-x` gives `retro`; each carries the repository, the topic, and the PRD number
  from the body's link line when present. Any other branch or action gives no stage event. The
  retro, harvest and outbox-check events are unchanged.
- The forward signs the body with `STAGE_EVENT_SECRET`. A missing secret or a failed POST is logged
  and never fails the webhook's reply.
- The route's tests, on the store fake: a bad or missing signature → 401, nothing written; an unknown
  dossier → 202, nothing written; found by number and found by topic → the row written; a repeated
  event keeps the first date.
- `STAGE_EVENT_SECRET` is listed in `apps/galaxy/.env.example`, and the omni-app README names it.

**s3**
- `history.test.ts`: the bar's seven counts follow the repository, mine/all, draft/PRD and search
  filters but not the stage; `?stage=inbox` keeps only inbox rows; an unknown `stage` value is
  ignored.
- `history-render.test.ts`: the bar renders in stage order with the selected stage highlighted,
  clicking a selected stage clears it, and each row renders its current stage pill (none for a draft
  with no answer).

**s4**
- On a fake reader and the store fake, the backfill writes `inbox` at the phase-0 merge, `building`
  at the first sub-PR merge, `shipped` at the feature merge and `retro` at the retro PR's opening, for
  each numbered dossier; a dossier the reader cannot read is logged and skipped; a second run writes
  nothing.
- It exits 1, having written nothing, when a variable is missing. The script's header says how and
  where to run it.

**s5**
- `overview.test.mjs`: a PRD in the base's inbox whose feature branch has a merged sub-PR and whose
  feature PR is a draft counts as building, and one whose feature PR is ready counts as outbox.
- `format.test.mjs` and `render.test.mjs` show the seven words in order.
- The *Where it is* blocks in `brainstorm/SKILL.md` and `yolo/SKILL.md` list seven stages, and
  `plugin.test.mjs` holds them.
- `stage-words.test.mjs` fails when the kit's stage list differs from `STAGES` in galaxy's
  `stage.ts`.
- `kit/dist/omni.mjs` is rebuilt, and `dist.test.mjs` passes.

**s6**
- A view test on the board model: the tile's seven counts cover the board's scope (you: dossiers you
  opened; fleet: its members'; workspace: all), and each count links to `/prd?stage=<stage>` with the
  scope's filter.
- A render test shows the tile on all three boards in stage order.
