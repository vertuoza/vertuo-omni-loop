# Plan: Context budgets

PRD #1679, specified in `spec.md` beside this plan. The feature branch `feat/context-budgets` goes
into `main` through the draft feature PR (`Closes #1679`); each slice is a sub-PR from
`feat/context-budgets--<slice>` into the feature branch (`Part of #1679`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A repository measures what its agents read and records a ceiling per target: `omni budget measure context` and `omni budget set context`, behind `budgets.context` | `kit/lib/budgets/measure` `kit/lib/budgets/ceilings` `kit/lib/budgets/index.ts` `kit/lib/config.ts` `kit/lib/config.test.ts` `kit/lib/types.ts` `kit/lib/schema/config` `kit/bin/commands/budget.ts` `kit/bin/commands/index.ts` `kit/bin/budget.test.ts` `kit/lib/help/entries` `kit/bin/help.test.ts` | — | 1 |
| s2 | `omni check context` gives each target its ratchet verdict, matches settled raise items through `OutboxStore`, writes the red for a junior, and fails `omni check all` | `kit/lib/budgets/ratchet` `kit/lib/budgets/message` `kit/bin/commands/check.ts` `kit/bin/check-context.test.ts` `kit/lib/help/entries` `kit/bin/help.test.ts` `mutation/floor.json` `stryker.config.ts` | s1 | 2 |
| s3 | The Omni App posts the `omni / budgets` check run on each pull request of a repository with budgets on, and posts it again on `item-settled` | `apps/omni-app/src/budgets-check/` `apps/omni-app/src/functions.ts` `apps/omni-app/src/inngest-client.ts` `apps/omni-app/src/server-event/` `apps/omni-app/src/webhook/` | s2 | 3 |
| s4 | The agents meet a budget: `/omni:pr-care` and `/omni:do-work` trim first and file the high raise item, `/omni:invade` sets budgets up, and the `ci` form's template gains a **Budgets** section | `kit/plugin/skills/pr-care/` `kit/plugin/skills/do-work/` `kit/plugin/skills/invade/` `kit/templates/playbook/ci.md` `kit/test/plugin.test.ts` | s2 | 3 |
| s5 | This repository turns budgets on, its ceilings at today's sizes, the releasing form flagged to trim | `.omni-loop/config.yml` `.omni-loop/budgets/` `.omni-loop/knowledge/playbook/ci.md` | s2 | 3 |

**Shared ground.** `kit/lib/help/entries` and `kit/bin/help.test.ts`: s1 adds `omni budget`, s2
adds `context` to `omni check`'s usage; waves 1 and 2 keep them apart. Nothing else is declared by
two slices. `kit/dist/` and `apps/omni-app/api/` are generated: each slice rebuilds them to test,
and the wave rebuilds them once after merging.

## Per slice: done when

**s1**
- `omni budget measure context` prints one byte count per target (`briefing`, `form:<name>` for
  each form, `context:<path>` for each `paths.context` file, and `session`), each equal to the bytes
  `omni kb show` prints, pointers expanded; `--json` prints the same as an object.
- On a fixture with a form whose pointer expands, its count is the expanded size; a missing context
  file is a measurement error naming the file.
- `omni budget set context` writes `budgets.context.file` with today's sizes rounded up to the next
  KiB for targets with no ceiling, and never raises a ceiling that exists.
- `budgets.context: { enabled, file }` reads from the config with `enabled: false` and
  `file: .omni-loop/budgets/context.json` by default; `omni check config` refuses an unknown key
  under it.
- `omni help budget` describes both verbs.

**s2**
- `ratchet` gives every row of the spec's verdict table, by tests on its pure inputs; a raise item
  for another target or another ceiling does not match; a ceiling changed again after a settled
  raise is red again.
- `omni check context [--base <ref>]` is green under every ceiling; red with the five parts of the
  message (what, why, what grew, fix it for me, or it needs the room) on an over-budget form; red
  "needs a person's yes" on a raised ceiling with no settled raise item; neutral, exit 0 and the
  reason printed, on a measurement error.
- On a pull request with no PRD, the red offers the trim prompt only and says a raise goes through
  a PRD or `/omni:bug-fix`.
- `omni check all` runs it when `budgets.context.enabled` is true, and fails on red.
- `kit/lib/budgets/ratchet` has a floor in `mutation/floor.json`.

**s3** (`ui: yes`)
- On the stubbed GitHub of `outbox-check/end-to-end.test.ts`: a pull request over budget gets a red
  `omni / budgets` check run whose text is `omni check context`'s; one under every ceiling gets a
  green run with the table of target, size, ceiling and change.
- An `item-settled` event for the matching raise posts the check again, green, with no new push.
- A measurement error posts a neutral run that says why.
- A repository whose `budgets.context.enabled` is false gets no check run.

**s4**
- `/omni:pr-care` names the red `omni / budgets` among the reds it handles: trim first; when it
  cannot trim without dropping a rule, raise the ceiling and file a high item; never force green.
- `/omni:do-work` does the same with `omni check context` red inside its territory.
- `/omni:invade` measures, writes the ceilings with `omni budget set context`, proposes
  `budgets.context.enabled: true`, fills the `ci` form's **Budgets** section, and lists every
  target over 16 KiB (a form) or 24 KiB (`session`) as a `TODO(human)` on its map.
- `kit/templates/playbook/ci.md` has a **Budgets** section; `kit/test/plugin.test.ts` is green.

**s5**
- `.omni-loop/config.yml` has `budgets.context.enabled: true`, and `.omni-loop/budgets/context.json`
  holds today's sizes rounded up, `form:releasing` included at its expanded size.
- `omni check context` and `omni check all` are green on the branch.
- This repository's `ci` form has its **Budgets** section, naming the releasing form as the target
  to trim once its pointer bug is fixed.
