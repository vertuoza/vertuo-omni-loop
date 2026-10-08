# Plan: Roadmap prerequisites

PRD #1218, specified in `spec.md` beside this plan. It is built on the feature branch
`feat/roadmap-prerequisites`, which merges into `main` through one feature PR (`Closes #1218`). Each
slice is a sub-PR from `feat/roadmap-prerequisites--<slice>` into the feature branch (`Part of #1218`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `roadmap.md` holds a `## Prerequisites` table and its author cards, and `omni roadmap check` refuses every fault spec section 5 lists | `kit/lib/roadmap/parse*` `kit/lib/roadmap/grade*` | — | 1 |
| s2 | the kit's base checks and fixes, the runner (time limit, a crash or timeout is not ok, `--fix` only on `agent` rows), the tick marker read from the roadmap issue, and this machine's last result kept locally | `kit/lib/roadmap/prereqs/` | s1 | 2 |
| s3 | `omni roadmap prereqs <n> [--fix] [--json]` prints the rows grouped by category, exits 0 or 1, and pushes the result with the machine and time; `omni roadmap tick <n> <id>` posts the marker comment; `omni help` lists both | `kit/bin/commands/roadmap.ts` `kit/bin/roadmap.test.ts` `kit/lib/roadmap/push*` `kit/lib/help/` | s2 | 3 |
| s4 | `omni next --roadmap` holds exactly the PRDs a not-ok prerequisite blocks, with `waits on prerequisite <id> (<category>): <need>` and the tab's link, after the park rules | `kit/lib/next/roadmap.ts` `kit/lib/next/roadmap.test.ts` `kit/bin/commands/next.ts` `kit/bin/next.test.ts` | s2 | 3 |
| s5 | the roadmap push stores each prerequisite and its last result (one migration with its checks), and the API validates the new body | `supabase/migrations/` `supabase/checks/roadmaps.sql` `apps/galaxy/src/roadmap/api` `apps/galaxy/src/roadmap/store` `apps/galaxy/src/roadmap/migration.test.ts` `apps/galaxy/app/api/roadmaps/route.ts` | s3 | 4 |
| s6 | the roadmap's page has **Overview** and **Prerequisites** tabs; the Prerequisites tab shows the count line, the rows grouped by category with those waiting on you first, each card with its command and **Copy**, what it does, who can do it, and the last check's machine and time; a roadmap without the section says so | `apps/galaxy/src/roadmap/page/` `apps/galaxy/app/roadmaps/[id]/` | s5 | 5 |
| s7 | **Mark as done** on a `person` row posts the tick as the signed-in member, through the omni-loop App's user authorisation as the outbox send does, and the tab shows it ticked | `apps/galaxy/src/roadmap/tick` `apps/galaxy/app/api/roadmaps/tick/` `apps/galaxy/src/roadmap/page/` | s6 | 6 |
| s8 | `/omni:roadmap` and `/omni:mega-roadmap` write the base and PRD-derived rows with their cards and run `prereqs --fix` once; `/omni:drive` and `/omni:mega-drive` run it on the first tick and before a blocked PRD starts, and list open items when they stop; the guide has a Prerequisites section | `kit/plugin/skills/roadmap/` `kit/plugin/skills/mega-roadmap/` `kit/plugin/skills/drive/` `kit/plugin/skills/mega-drive/` `docs/guide/roadmaps.md` | s3, s4 | 4 |

**Shared ground.** `apps/galaxy/src/roadmap/page/` is declared by s6 and s7 (the Mark as done
button lives in the Prerequisites pane, and `render.test.ts` checks both): s7 waits on s6, wave 6
after wave 5. `apps/galaxy/app/api/roadmaps/route.ts` (s5) and `apps/galaxy/app/api/roadmaps/tick/`
(s7) do not meet. `kit/lib/next/follow.test.ts` and `kit/lib/next/plan.test.ts` read the roadmap
parser: s1 keeps the parser's existing shape so neither needs a change; were one to, it belongs to
s4's wave. `kit/dist/` and `apps/omni-app/api/` are generated: no slice commits them.

## Per slice: done when

### s1

- A roadmap with a valid `## Prerequisites` table and a card for each `check` and `person` row
  parses, and `omni roadmap check` is green.
- Each fault of spec section 5 is refused, naming the row and the fault: an unknown category or
  `who`, a duplicate id, a `blocks` naming no row, an unknown `base:` check, a `fix` on a non-`agent`
  row or naming no base fix, an `agent` row without a fix, a missing card, a card missing a line.
- A roadmap without the section parses and grades as it does today.

### s2

- Each base check runs against a stubbed command runner (never the real machine) and returns ok or
  not ok; each base fix runs only on an `agent` row and only with `--fix`.
- A check that times out (30 s) or throws is not ok.
- `labels` creates labels only when `labels.autoCreate` is true; `env-file` never overwrites a `.env`.
- Ticks are read from marked comments on the roadmap issue; the last result is written and read
  back per machine.

### s3

- `omni roadmap prereqs <n>` prints one line per row grouped by category (`ok`, `fixed`,
  `waits on you` with the card's command, `ticked`), exits 1 while a row waits on a person and 0
  otherwise.
- The push body carries every row, its state, the machine and the time; an unreachable page prints
  one line and leaves the exit code unchanged.
- `omni roadmap tick <n> <id>` posts the marker comment on a stubbed GitHub, and refuses an id that
  is not a `person` row.
- `omni help roadmap` names both verbs.

### s4

- A not-ok row holds exactly the PRDs in its `blocks`; `all` holds them all; an ok, fixed or
  ticked row frees them.
- An unanswered `person` question still parks first.
- The hold line reads `waits on prerequisite <id> (<category>): <need>` with the Prerequisites
  tab's link.

### s5

- The migration adds the prerequisites and their last result, additively; its checks pass with
  realistic rows, and a roadmap pushed without prerequisites stores as today.
- The API refuses a malformed prerequisites body and stores a valid one.

### s6

- The page shows Overview and Prerequisites tabs, picked by `?tab=`; Overview is today's page.
- The Prerequisites tab shows the count line, the rows grouped by category with the ones waiting
  on you first, the card (Why, the command with a working Copy, What it does, Who can do it), the
  PRDs it blocks, and the machine and time of the last check.
- A roadmap without prerequisites shows one line saying so.

### s7

- A signed-in member of the workspace sees **Mark as done** on a `person` row; anyone else does not.
- Marking posts the tick comment as the member (tested with a fake GitHub), the token is never
  stored, and the row shows ticked; the next `omni roadmap prereqs` reads it.

### s8

- `/omni:roadmap` and `/omni:mega-roadmap` write the base rows (`gh-auth`, `node`, the package
  manager, `install`, `labels`, blocking `all`) and the rows their PRDs need, each `check` or
  `person` row with its four-line card, show them in the map grouped by category, and list the open
  ones in the hand-off.
- `/omni:drive --roadmap` and `/omni:mega-drive --roadmap` run `omni roadmap prereqs <n> --fix` on
  the first tick and before a blocked PRD starts, and list open prerequisites with their commands
  when they stop.
- `docs/guide/roadmaps.md` has a Prerequisites section: the table, the categories, the base checks,
  what the agent may fix, and the tab.
