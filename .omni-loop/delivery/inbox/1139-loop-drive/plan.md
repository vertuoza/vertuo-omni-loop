# Plan: Loop drive

PRD #1139, spec beside this plan (`spec.md`). The feature branch `feat/loop-drive` goes into `main`
with `Closes #1139`. Each slice is a sub-PR from `feat/loop-drive--<slice>` into the feature branch,
marked `Part of #1139`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `omni next <n> [--json]` prints the verdict for one PRD (`act` with its skill, `wait` with a wake hint, `park` with who, what and the link, or `done`), read from its board, its care state, its outbox gate and its feature PR | `kit/lib/next/` `kit/bin/commands/next.ts` `kit/bin/next.test.ts` `kit/bin/commands/index.ts` `kit/lib/help/entries*` `kit/bin/help.test.ts` `kit/dist/omni.mjs` | — | 1 |
| s2 | The Omni app stores loops: a migration adds `loops`, `loop_ticks` and `loop_plans`, written only by `loop_push()` and read by workspace members, and `POST /api/loops` takes `start`, `tick`, `park` and `stop`, with `loopState(row, now)` saying live, sleeping, parked, stopped or silent | `supabase/migrations/` `supabase/checks/loops.sql` `supabase/database.types.ts` `.github/workflows/supabase.yml` `apps/galaxy/app/api/loops/` `apps/galaxy/src/loop/store` `apps/galaxy/src/loop/api` `apps/galaxy/src/loop/state` `apps/galaxy/src/loop/migration.test.ts` | — | 1 |
| s3 | The loop plan: with no number `omni next` drives the person's own PRDs in inbox, building or outbox; `--plan` orders every slice of them into numbered steps (colliding territories in series with the reason, `blocked-by` held, the rest beside each other); each later call returns the first step not done; a stuck slice, an added slice or an early ship writes a new plan version with a one-line reason | `kit/lib/next/` `kit/bin/commands/next.ts` `kit/bin/next.test.ts` `kit/lib/help/entries*` `kit/bin/help.test.ts` `kit/dist/omni.mjs` | s1 | 2 |
| s4 | `omni loop push` with `start`, `tick`, `park` or `stop` sends the loop's state to the app without blocking (5 seconds, one token refresh, one-line failures), keeps the loop's id and plan under `.omni-loop/local/`, refuses a second live loop on the same checkout and takes over a silent one with `--take-over` | `kit/lib/loop/` `kit/bin/commands/loop.ts` `kit/bin/loop.test.ts` `kit/bin/commands/index.ts` `kit/lib/help/entries*` `kit/bin/help.test.ts` `kit/dist/omni.mjs` | s2 | 3 |
| s5 | A **Loop** entry beside Fleet in the sidebar opens `/app/loop`: every loop of the workspace with who runs it, its repository, its state and its last tick; one loop opened shows its plan as a timeline per PRD with collisions and every version, its ledger with each line linking to its PRD's page, and its parked PRDs with what each waits on | `apps/galaxy/app/app/loop/` `apps/galaxy/src/loop/page/` `apps/galaxy/src/nav/` `apps/galaxy/src/switch/headers.test.ts` `apps/galaxy/src/dashboard/render.test.ts` `packages/design/src/sprites` | s2 | 2 |
| s6 | `/loop /omni:drive [<n>…]` runs one step per tick from the loop plan (wave, yolo, yolo-fix or `/omni:pr-care --once`), parks on the feature PR's status comment, pushes every tick, and stops itself listing what waits on whom; `/omni:pr-care --once` runs one round and returns; the docs gain the skill and a guide page | `kit/plugin/skills/drive/` `kit/plugin/skills/pr-care/` `kit/lib/help/entries*` `kit/bin/help.test.ts` `kit/test/plugin.test.ts` `apps/galaxy/src/docs/skills` `docs/guide/drive.md` `docs/guide/meta.json` `apps/galaxy/src/docs/guide.test.ts` `kit/dist/omni.mjs` | s3, s4 | 4 |

**Shared ground.**
- `kit/dist/omni.mjs`, the bundle `kit/test/dist.test.ts` checks against a fresh build: s1, s3, s4
  and s6, in waves 1 to 4. Each slice rebuilds it with `pnpm kit:build`.
- `kit/lib/help/entries*` and `kit/bin/help.test.ts`, the help table every command and skill is
  listed in: s1 (`omni next`), s3 (`--plan` and the default "yours"), s4 (`omni loop`) and s6
  (`/omni:drive`, `/omni:pr-care --once`), in waves 1 to 4.
- `kit/bin/commands/index.ts`, the command table: s1 and s4, in waves 1 and 3.
- `kit/lib/next/`, `kit/bin/commands/next.ts` and `kit/bin/next.test.ts`: s1 then s3.
- `apps/galaxy/src/loop/` is split by prefix: s2 owns `store`, `api`, `state` and
  `migration.test.ts`; s5 owns `page/` and reads s2's store and `loopState` without changing them.
- s5 and s3 run side by side in wave 2: one is the app, the other the kit, and they share no prefix.

## Per slice: done when

**s1**
- `kit/lib/next/decide.test.ts`: one row per verdict of the spec's table: a ready feature PR with red
  CI, a conflict or a new thread → `act pr-care --once`; gate red with answers posted → `act
  yolo-fix`; every slice merged and the PR draft → `act yolo`; takeable slices → `act wave`; CI
  running → `wait` with a hint; a claim held elsewhere → `wait`; phase-0 open, outbox questions open,
  or a ready clean PR → `park` with who, what and the link; merged or closed → `done`; an unreadable
  board → `wait`.
- `kit/bin/next.test.ts` through `main()` on `makeRepo()` with gh stubbed: `omni next <n>` prints one
  verdict line, `--json` prints `{prds: [{prd, verdict, skill?, why, link?, wakeHint?}]}`, and gh
  unreachable prints `wait: github unreachable` with exit 0.
- `omni help next` prints its entry.

**s2**
- `supabase/checks/loops.sql` and `apps/galaxy/src/loop/migration.test.ts`: a member reads only their
  workspace's loops, ticks and plans; nothing but `loop_push()` writes them.
- `apps/galaxy/src/loop/api.test.ts` on the fake store: each event's body is validated (unknown
  event, missing fields, a foreign workspace refused with its status); `start` returns the loop's
  id; `tick` appends a ledger row and moves `nextWakeAt`; `park` and `stop` set the state; a second
  `start` for the same person and repository while one is live is refused naming it.
- `apps/galaxy/src/loop/state.test.ts`: `loopState(row, now)` at each boundary, silent from
  `nextWakeAt` plus 5 minutes.

**s3**
- `kit/lib/next/plan.test.ts`: two PRDs whose slices share territory are ordered in series with the
  reason; `blocked-by` between PRDs holds; two that share nothing are marked beside each other; the
  same plans and boards give the same steps.
- `kit/lib/next/follow.test.ts`: the verdict is the first step not done, never a later runnable step,
  save one the plan marked beside it.
- `kit/lib/next/replan.test.ts`: a stuck slice, an added slice and an early ship each give a new
  version with its reason; nothing changed gives none.
- `kit/bin/next.test.ts`: with no number, the PRDs `omni status` reads as the person's own, in inbox,
  building or outbox, and no one else's; `--plan` prints the numbered steps and each cross-PRD
  order with its reason.

**s4**
- `kit/bin/loop.test.ts` with the HTTP client stubbed: each event's body matches s2's API; a 5-second
  limit; one refresh on a 401; `off`, `no sign-in (omni signin)`, `unreachable` and
  `refused (<status>)` each print one line and exit 1 without throwing.
- A second `start` on a checkout with a live loop prints the live loop and exits 1; `--take-over`
  succeeds only when that loop is silent.
- A loop started then resumed reads the same id and plan from `.omni-loop/local/`.

**s5**
- `apps/galaxy/src/nav/sidebar.test.ts` lists the `loop` id beside `fleet` in the Dashboard group.
- `apps/galaxy/src/loop/page/render.test.ts` on demo data: the list with one loop per state; one
  loop opened shows its plan timeline with a collision marked and two versions, its ledger whose
  lines link to `/prd/<n>`, and its parked PRDs with their links; the empty state names how to start
  a loop; signed out shows the demo.
- `/app/loop` loads through `memberSession()` like the Engineering page, with a `loading.tsx`.

**s6**
- `kit/plugin/skills/drive/SKILL.md` passes `kit/test/plugin.test.ts`: it parses, names only commands
  the CLI has, signs what it commits, and states its guardrails (never merge into `main`, never add
  `omni:outbox-go`, never answer the outbox, never push while a wave holds claims).
- `/omni:pr-care --once` is documented in its skill and runs one round, then returns, without a wait.
- `/docs/skills` lists `drive` in its group, and `docs/guide/drive.md` explains starting, watching on
  the Loop page, stopping and resuming; `guide.test.ts` and `skills.test.ts` pass.
- On a real run against this repository, `/loop /omni:drive` prints the loop plan, takes one step per
  tick in order, and stops when every driven PRD is parked or done (acceptance criteria 1 to 8).
