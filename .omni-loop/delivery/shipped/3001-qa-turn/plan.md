# Plan: QA checks a mission's PRD and hands its bugs to the Engineer

PRD #3001, its spec beside this plan (`spec.md`). The feature branch `feat/qa-turn` goes into `main`
through one feature PR ("Closes #3001"); each slice is a sub-PR from `feat/qa-turn--<slice>` into the
feature branch ("Part of #3001").

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | `QaVerdictSchema` checks a verdict (`pass`, or `bugs` with 1 to 5 issues) and `qaLine()` reads the `omni qa: posted round …` line, refusing a sixth bug and an unreadable line | `kit/lib/qa/` | — | 1 | deep |
| s2 | The database keeps a job's `tokens`, allows the `checked` event kind and the `qa` role, lets a runner job run `/omni:qa`, and gives QA its skill and four limits in `virtual_hero_roles()` and `roles.ts`; the runner's job end takes `tokens` | `supabase/migrations/` `supabase/checks/qa_turn.sql` `supabase/database.types.ts` `kit/lib/virtual-fleet/roles` `kit/lib/runner/line` `apps/galaxy/src/virtual-fleets/` `apps/galaxy/src/runners/runners.contract` `apps/galaxy/src/runners/runners.service` `apps/galaxy/src/runners/runners.repository` `apps/galaxy/src/runners/runners.qa.migration.test.ts` | — | 1 | deep |
| s3 | `/omni:qa` runs on a runner: the preview, the criteria, the edges, at most five bug issues with their steps, the verdict comment and its last line; the runner sends the run's tokens when a job ends | `kit/plugin/skills/qa/` `kit/lib/runner/` | s1, s2 | 2 | build |
| s4 | A mission sends QA after the build, one `/omni:bug-fix --base <feature branch>` per bug, QA's round 2, then the Reviewer; it lands each fix on the feature branch, records `checked` events, holds a surviving bug on `Decide the bugs` and reads the person's pick | `apps/omni-app/src/missions/` | s1, s2 | 2 | deep |
| s5 | The Operation room shows QA's now line and rows, the Engineer's fix rows and every job's tokens, and the mission page offers `Decide the bugs` with `Send on to the Reviewer` and `Stop this PRD` | `apps/galaxy/src/missions/` | s2, s4 | 3 | build |
| s6 | The guide's Missions page says what QA does, its two rounds and five bugs, and that QA never writes the branch; the Runners page says a job's tokens are kept | `docs/guide/missions.md` `docs/guide/runners.md` | s4, s5 | 4 | light |

Shared ground: `kit/lib/runner/line` (s2 adds `qa` to `RUNNABLE_SKILLS`, so the database's runner
skill list, `roles.ts` and the Heroes count change together) sits under s3's `kit/lib/runner/`; the
waves keep them apart (s2 in wave 1, s3 in wave 2). Every other prefix is declared by one slice: s2
alone adds a migration and touches `apps/galaxy/src/runners/` and `apps/galaxy/src/virtual-fleets/`,
s4 alone `apps/omni-app/src/missions/` and s5 alone `apps/galaxy/src/missions/`. s3's skill prints the
line s1's `qaLine()` reads, and s4 reads it, so both wait for s1. The built files (`kit/dist/`,
`apps/omni-app/api/`) are rebuilt by each wave, never listed.

Law proofs: tests these slices extend prove rules: `supervisor*.test.ts` and `mission.e2e.test.ts`
(BR-PRODUCT-139; s4), the runner skill tests (BR-PRODUCT-140; s2). None is a locked law, so no slice
carries a law mark, but a slice that changes one of these files records a high outbox item naming the
rule it proves and writes its account, so the feature's coverage gate finds every change accounted
for.

## Per slice: done when

### s1 (deep: the verdict is what the supervisor acts on)

- `QaVerdictSchema` (Zod) accepts `pass`, and `bugs` with 1 to 5 entries each holding an issue
  number; it refuses 0 or 6 bugs, a missing round, and a round other than 1 or 2.
- `qaLine(log)` returns the last `omni qa: posted round <r> (pass|bugs, <k>) on PR #<pr>: <url>`
  line's round, verdict, count and comment URL, or `null` when no such line is there or it names
  more than five bugs (AC-6).
- Pure: no GitHub, no clock; tests in `kit/lib/qa/`.

### s2 (deep: a migration and the runner's contract) (`ui: yes`)

- `supabase/migrations/20270125150000_qa_turn.sql` (re-dated if `main` moved): `runner_jobs.tokens
  jsonb`, nullable, checked like `ask_rounds.tokens`; `mission_events` allows kind `checked` and role
  `qa`; a runner job may run `qa`; `virtual_hero_roles()` gives QA `qa`, `prove`, `bug-fix`,
  `validate-e2e` and the limits `It never writes the branch.`, `It reports bugs to the Engineer.`,
  `It reports five bugs at most.`, `It checks two rounds at most.` after every hero's two.
- `roles.ts` holds the same and `RUNNABLE_SKILLS` holds `qa`; the arcade's `roles-sql.test.ts` stays
  green; `supabase/checks/qa_turn.sql` proves the column's shape and the event kind.
- The runner's job end (`runners.contract.ts`) takes an optional `tokens`; the service stores it, and
  `null` when absent (AC-8).
- The Heroes tab's QA row reads `Runs 3 of 4 skills alone` and the four limits (AC-10).
- `supabase/database.types.ts` regenerated.

### s3

- `kit/plugin/skills/qa/SKILL.md`: the steps of spec section 2, `--round 2` checking only the
  criteria and round 1's bugs, at most five issues labelled `bug`, signed as an agent, each with
  numbered steps, expected, actual and the preview URL; one comment on the feature PR; the last line
  `qaLine()` reads. It never commits, pushes or opens a pull request.
- The plugin's skill tests pass with the new skill.
- The runner sends the run's `Usage` as `tokens` when a job ends, `null` when the agent gave none
  (AC-8), with a test over the runner's end call.

### s4 (deep: the mission's run and its keys) (`ui: yes`)

- `Step` gains `qa:1`, `qa-fix:1:<k>` (1 to 5) and `qa:2`; the job key accepts them; a build that
  ends ready for review sends `/omni:qa <n>` (AC-1); a `pass` in round 1 sends `review:1` with no
  `qa:2` (AC-2).
- `bugs` sends one `/omni:bug-fix #<issue> --base <feature branch>` at a time, the next once the
  previous fix landed or is marked `not fixed: <why>` (AC-3); the App lands a green fix PR on the
  feature branch as it lands a repair's fix (PRD 2980).
- Once every bug is landed or marked, it sends `/omni:qa <n> --round 2`; its `pass` sends
  `review:1` (AC-4); a bug still there holds the PRD on `decide-bugs`, and nothing else is sent until
  the person's pick: `Send on to the Reviewer` sends `review:1`, `Stop this PRD` stops it (AC-5).
- A QA job with no readable line ends `failed · verdict not read`, repaired within PRD 2980's budget
  (AC-6). A replay sends no key twice (AC-7). A plan repository's PRD skips the QA pair.
- Each verdict is a `checked` event signed `qa`, with the round and the bugs' issues.

### s5 (`ui: yes`)

- QA's now line reads `Checking PR <n> · round 1 of 2`, `Waiting for the preview` or `Idle`.
- A `checked` row reads `QA · agent · 2 bugs found · Round 1 of 2 · #12 #13 · 41k tokens` (AC-9);
  the Engineer's fix rows read `fixed #12 · PR #15` or `not fixed #13: <why>`; every job row ends
  with its tokens or `tokens unknown`.
- A PRD on `decide-bugs` reads `Waits for you · Decide the bugs`, its bugs listed by issue, with the
  two actions, each recorded as the person's own pick; drawn as `fleet-room` 1.A and 1.B of the
  before/after page.

### s6 (light: docs only)

- `docs/guide/missions.md` says QA checks each PRD before the Reviewer, files at most five bugs,
  never writes the branch, checks two rounds, and what `Decide the bugs` offers.
- `docs/guide/runners.md` says a job keeps the tokens it spent.
