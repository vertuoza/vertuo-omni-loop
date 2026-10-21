# Plan: Retro lessons lead somewhere — /omni:retro-apply

PRD #2338, its spec beside this plan (`spec.md`). The feature branch `feat/retro-apply` merges into
`main` with `Closes #2338`; each slice is a sub-PR from `feat/retro-apply--<slice>` into the feature
branch, with `Part of #2338`.

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | A kept lesson can carry its outcome, `became` a `playbook/<form>#<slot>` or `staysHere` with a reason, read by one kit schema; `omni check retro` refuses a `became` that does not resolve to a filled slot, an empty `staysHere`, and, on a retro PR, a kept lesson with none, and passes a retro from before the change; `retro.guards` is read off by default; the new module gets its mutation floor | `kit/lib/retro/` `kit/bin/commands/check.ts` `kit/bin/check-retro.test.ts` `kit/lib/config.ts` `kit/lib/config.test.ts` `kit/lib/help/entries.ts` `stryker.config.ts` `mutation/floor.json` `.github/workflows/mutation.yml` | — | 1 | deep |
| s2 | A runner job can be sent by the Omni app and name no person (`runner_jobs.sent_by_app`, one of the two senders set), and the Runners page shows such a job's sender as Omni app with `retro of PRD <n>` under it | `supabase/migrations/` `supabase/checks/` `supabase/database.types.ts` `.github/workflows/supabase.yml` `apps/galaxy/src/runners/` `apps/galaxy/app/api/runners/` | — | 1 | build |
| s3 | `omni retro outcome <prd> <finding> --became <id>` (or `--stays-here <why>`) records a lesson's outcome in its PRD's `retro.json` and the line under it in `retro.md`, refusing an id that does not resolve and a lesson that already has an outcome | `kit/lib/retro/` `kit/bin/commands/retro.ts` `kit/bin/commands/index.ts` `kit/bin/retro.test.ts` `kit/lib/help/entries.ts` | s1 | 2 | build |
| s4 | When a retro PR holds a kept lesson with no outcome, the retro queues exactly one runner job `/omni:retro-apply --retro <retro PR>` sent by the app, writes the same line in the retro PR's body, renders each outcome under its lesson in `retro.md`, and carries every outcome over on day 14 | `apps/omni-app/src/retro/` `apps/omni-app/test/` | s1, s2 | 2 | deep |
| s5 | `/omni:retro-apply --retro <n>` settles each kept lesson of a retro PR on its branch (a rule appended to its slot and quoted in the PR body, a reason, or one question), writes a guard test only with `retro.guards` on, refuses a merged or closed retro PR, and every runner list names it | `kit/plugin/skills/retro-apply/` `kit/lib/runner/` `kit/lib/help/entries.ts` `apps/galaxy/src/runners/runners.contract.ts` `apps/galaxy/src/runners/runners.contract.test.ts` `docs/guide/runners.md` `docs/guide/loop.md` | s1, s3 | 3 | build |

**Shared ground.** `kit/lib/retro/` is s1's and s3's: s3 adds the writer beside s1's schema, so it
waits a wave. `kit/lib/help/entries.ts` is a registry each of s1 (`omni check retro`), s3 (`omni
retro`) and s5 (the skill and the runner's list) adds lines to: waves 1, 2 and 3 keep them apart.
`apps/galaxy/src/runners/` is s2's; s5 changes only the contract's skill list in it
(`runners.contract.ts` and its test), two waves later. `kit/dist/` and `apps/omni-app/api/` are
generated: no slice lists them, each rebuilds them only to test, and the wave rebuilds them once.
`.github/workflows/checks.yml` already runs the full checks on any pull request that changes more
than documents, a retro PR with a guard test included, so no slice changes it.

## Per slice: done when

### s1 (deep: the gate a retro PR is judged by, and a mutation floor)

- `kit/lib/retro/` exports the lesson-outcome schema (`{ became }` or `{ staysHere }`, optional on a
  lesson) and the one line that renders an outcome, which s3 and s4 reuse.
- `omni check retro` passes on a retro with outcomes that resolve, through the kit's
  `resolvePlaybookId`, and on a `retro.json` from before this PRD, which has none.
- It refuses, naming the PRD, the lesson and why: a `became` naming a blank or missing slot or form,
  a `staysHere` with no reason, and, with `--retro` (the retro PR's head), a kept lesson that has no
  outcome.
- `retro.guards` reads `false` when the config does not set it, and `true` when it does.
- `kit/lib/retro/**/*.ts` is in `stryker.config.ts` with its shard in the mutation workflow, and its
  floor in `mutation/floor.json` is the score the slice reaches; `config`'s floor holds.

### s2 (`ui: yes`)

- A migration dated after the newest on `main` adds `runner_jobs.sent_by_app` (only `'omni-app'`),
  lets `sent_by` be null, and requires exactly one of the two; its rollback is named in its header.
- A check under `supabase/checks/`, run as its own step of the `supabase` workflow, proves a row with
  both senders and a row with neither are refused, and an app-sent row is read by the workspace's
  members only.
- `supabase/database.types.ts` is what the migrations generate (conventions › The database types
  are generated, never written).
- The Runners page shows an app-sent job's sender as `Omni app`, with `retro of PRD <n>` under it
  linked to the retro PR, as the library's `runners` screen says; a person's and an API key's jobs
  read as before; Send again on it sends it as the person who pressed.

### s3

- `omni retro outcome <prd> <finding> --became playbook/<form>#<slot>` writes the outcome on that
  lesson in `retro.json` and its line in `retro.md`, and `omni check retro` passes afterwards.
- `--stays-here '<why>'` does the same with the reason.
- It refuses, writing nothing: an id that does not resolve, an empty reason, a finding the retro did
  not keep, and a lesson that already has an outcome (an outcome is never rewritten).

### s4 (deep: a server step that sends work to a runner, once) (`ui: yes`)

- A retro that keeps at least one lesson queues exactly one `runner_jobs` row with the line
  `/omni:retro-apply --retro <retro PR>`, `sent_by_app = 'omni-app'` and no person, for the
  repository's workspace, in a saved step a replay finds again and does not repeat.
- The retro PR's body carries that line, for a person to run when no runner takes it.
- A retro that keeps nothing queues nothing, and its PR body carries no line.
- `retro.md` renders each lesson's outcome with s1's line; a day-14 run keeps every outcome it finds.
- The PRD 438 recording replays green, with any read it newly needs added and trimmed as before.

### s5 (`ui: yes`)

- `kit/plugin/skills/retro-apply/SKILL.md` follows the spec's Solution 2–4: for each kept lesson of
  the retro PR it reads the issue and `omni kb show <form>`, then appends one bullet ending
  `(retro of PRD <n>, #<issue>)` to one slot and runs `omni retro outcome … --became`, or runs it with
  `--stays-here` citing the rule that already says it, or asks one question on the retro PR and
  records nothing; it rewrites the retro PR body with one line per lesson (the rule quoted with its
  slot, or the reason) and `Closes #<issue>`; it signs every commit and comment as an agent's.
- With `retro.guards` on it writes the guard test, proved red without the rule's fix and green with
  it; off, it names the guard in the lesson's line and writes no code.
- It refuses, in one line and writing nothing, a retro PR already merged or closed.
- `RUNNABLE_SKILLS`, galaxy's `RUNNER_SKILLS`, the guide's Runners page sentence and `omni help
  runner` all name `retro-apply`, and the guide's test holds them equal.
- Run once by hand on a retro PR with an open kept lesson (#2295's retro), its PR shows the quoted
  rule, `Closes #2295`, and `omni check retro` green.
