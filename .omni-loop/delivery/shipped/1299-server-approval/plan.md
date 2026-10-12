# Plan: Phase 0 approved on the server

PRD #1299, specified in `spec.md` beside this plan. The feature branch `feat/server-approval` goes into
`main` through one feature PR (`Closes #1299`). Each slice is a sub-PR from
`feat/server-approval--<slice>` into the feature branch (`Part of #1299`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A workspace owner flips a repository's phase 0 between `pr` and `server` on the page, and `GET /api/repositories/phase0` answers it | `supabase/migrations/20261120090000_phase0_flag` `supabase/database.types.ts` `apps/galaxy/src/repositories/` `apps/galaxy/app/api/repositories/` | — | 1 |
| s4 | `omni approval <n>` reads the approval in force and tells approved, pending, drifted, unreachable or refused; `prdState()` reads it for a ◆ PRD; `omni check inbox` accepts `phase0: server`; `labels.approved` exists | `kit/lib/approval/` `kit/lib/ask/client` `kit/bin/commands/approval` `kit/bin/commands/index.ts` `kit/lib/inbox/check-inbox` `kit/lib/front-matter.ts` `kit/lib/config.ts` `kit/lib/config.test.ts` `kit/lib/help/` | — | 1 |
| s2 | A member approves a ◆ dossier: the append-only approval pins its latest files, a non-member or a ◇ dossier is refused, the approval route answers the approval in force, and the PRD issue gets `omni:approved` | `supabase/migrations/20261121090000_approvals` `supabase/database.types.ts` `apps/galaxy/src/approval/` `apps/galaxy/app/api/dossiers/approval/` `apps/galaxy/src/dossier/store` `apps/galaxy/src/dossier/api` | s1 | 2 |
| s5 | `omni prd`, `omni status` and `omni next` read a ◆ PRD's stage through `prdState()`: `pending` is stage `prd` and parks it with its page link, the other refusals print their line, and a ◇ PRD reads exactly as today | `kit/lib/delivery/prd` `kit/bin/commands/prd.ts` `kit/lib/status/` `kit/bin/commands/status.ts` `kit/bin/commands/next.ts` `kit/lib/next/` | s4 | 2 |
| s3 | The PRD page shows a ◆ PRD as waiting for approval with an Approve button, approved with who and when, or drifted · approve again | `apps/galaxy/src/dossier/page/` `apps/galaxy/app/prd/` | s2 | 3 |
| s6 | The stage sync and the App's stage-forward date a ◆ PRD's `inbox` at its approval, never at a phase-0 merge | `apps/galaxy/src/stages/sync/` `apps/omni-app/src/stage-forward/` | s2 | 3 |
| s7 | `/omni:brainstorm` reads the flag, writes `phase0: server`, opens no phase-0 PR and hands off to the page; `/omni:plan`, `/omni:yolo`, `/omni:wave` and `/omni:drive` name the approval refusals | `kit/plugin/skills/brainstorm/` `kit/plugin/skills/plan/` `kit/plugin/skills/yolo/` `kit/plugin/skills/wave/` `kit/plugin/skills/drive/` `kit/porting/plugin--brainstorm.md` `kit/porting/plugin--plan.md` `kit/porting/plugin--yolo.md` `kit/porting/plugin--wave.md` | s4, s5 | 3 |

**Shared ground.** `supabase/database.types.ts` is declared by s1 and s2, which each add their columns
or table to it: s2 is blocked by s1, so they sit in waves 1 and 2. `apps/galaxy/src/dossier/` is
split between s2 (`store*` and `api*`, the data and its routes) and s3 (`page/`, the screen): s3 waits
on s2. The kit's `kit/dist/` and the App's `apps/omni-app/api/` are generated: no slice lists them,
and each wave rebuilds them once after merging.

## Per slice: done when

**s1**
- The migration adds `repositories.phase0`, `pr` or `server`, `pr` by default, and only a workspace
  owner can change it.
- The repository's row on the Repositories page shows the flag, and an owner switches it both ways.
- `GET /api/repositories/phase0?repo=<owner/name>` answers `{ "phase0": "pr" | "server" }`, refuses a
  caller outside the workspace, and answers `pr` for a repository with no row. Route tests cover the
  validation, the shape and each failure.

**s4**
- `omni approval <n>` prints one of the five lines the spec's §4 table gives and exits `0` on
  `approved`, `1` otherwise; `--json` gives the state, who, when and the pinned files.
- Pinned files are paired by kind, so a folder moved by `omni ship` still matches; a changed file
  says `content` or `whitespace only`, and both refuse.
- `prdState(n)` returns today's answer for a ◇ PRD and, for a ◆ PRD, `inbox` only when approved;
  one table test covers both birthplaces against the five states, with the server faked behind the
  ask client.
- `omni check inbox` accepts `phase0: server` and refuses any other value by name.
- `labels.approved` defaults to `omni:approved`; `omni help approval` explains the command.
- `pnpm mutation:changed --base origin/feat/server-approval` leaves no survivor in the core code the
  slice wrote.

**s2**
- The migration adds `dossiers.birthplace` (`server` or `repo`, set once) and the append-only
  `approvals` table; rows cannot be updated or deleted.
- `dossier_approve` writes a row pinning the latest spec, plan, before/after, voice and scenarios
  for a workspace member, and refuses a non-member, a ◇ dossier, and a dossier missing a spec, a plan
  or a before/after; a second approval adds a row.
- `POST /api/dossiers/approval` approves, and `GET /api/dossiers/approval?repo=&prd=` answers the
  approval in force with the approver's login, whether they are a member today, the time and the
  pinned files; route tests cover each failure.
- After an approval, the PRD's issue gets `omni:approved` (against a stubbed GitHub).
- A dossier opened by a ◆ brainstorm records `birthplace: server` on its first push.

**s5**
- Characterization tests pin today's `omni prd`, `omni status` and `omni next` output for ◇ PRDs
  before the change, and still pass after it.
- For a ◆ PRD not yet approved, `omni prd` reports stage `prd`, and `omni next` parks it naming its
  dossier link, as it parks an open phase-0 PR.
- For a ◆ PRD approved, `omni prd` reports `inbox`; drifted, unreachable and refused print their
  line and are not `inbox`.
- A ◇ PRD never calls the server.

**s3**
- A ◆ PRD's page shows **waiting for approval** with the Approve button, **approved** with who and
  when once approved, and **drifted · approve again** with the changed files when a newer version
  was pushed after the approval.
- Pressing Approve as a member approves it; a non-member does not see the button.
- A ◇ PRD's page is unchanged. Page tests cover the three states.

**s6**
- The stage sync and stage-forward write a ◆ PRD's `inbox` stage dated at its approval.
- A ◇ PRD's `inbox` is still dated at its phase-0 merge; tests cover both, against fixtures.

**s7**
- `/omni:brainstorm` reads the flag at step 0, falls back to `pr` with one line when it cannot, writes
  `phase0: server` in the spec when it is `server`, skips the phase-0 PR and `omni phase0` at step 9,
  and hands off with "approve it on its page, then `/omni:yolo <n>`".
- `/omni:plan`, `/omni:yolo` and `/omni:wave` name the waiting, drifted, unreachable and refused lines
  at their gate; `/omni:drive` parks a ◆ PRD waiting for approval.
- Each ported skill's porting note records the change; the plugin's skill tests pass.
