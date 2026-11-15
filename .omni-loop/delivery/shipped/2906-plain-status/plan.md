# Plan: a plain-language status for this session

PRD #2906, whose spec is `spec.md` beside this plan. The feature branch `feat/plain-status` goes into
`main` through the feature PR (`Closes #2906`); each slice is a sub-PR from `feat/plain-status--<slice>`
into the feature branch (`Part of #2906`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | The steps and the plain words: from a work's facts, the step of its kind, the verdict, You, Next, Details and the block, every word from one table | `kit/lib/now/status/` | — | 1 | deep |
| s2 | `omni now --status [--fetch]` and the `status` key of `omni now --json`, read from this computer and, with `--fetch`, from the work's pull request kept beside the links | `kit/lib/now/read.ts` `kit/lib/now/links.ts` `kit/lib/now/build-links.ts` `kit/lib/now/now.ts` `kit/lib/now/now.test.ts` `kit/lib/now/links.test.ts` `kit/bin/commands/now.ts` `kit/bin/commands/now.test.ts` `kit/bin/now.test.ts` `kit/lib/help/entries.ts` | s1 | 2 | build |
| s3 | `/omni:dashboard` is today's overview skill, renamed, and runs the new `omni dashboard [--fetch]`, which prints what `omni status` prints | `kit/plugin/skills/dashboard/` `kit/bin/commands/dashboard.ts` `kit/bin/commands/index.ts` `kit/bin/dashboard.test.ts` `kit/lib/help/entries.ts` | — | 1 | light |
| s4 | `/omni:status` is this session's plain status: it runs `omni now --status --fetch`, prints the block and adds its Right now line; the README, the user guide and the skills diagram name both skills | `kit/plugin/skills/status/` `kit/README.md` `docs/guide/` `kit/test/plugin.test.ts` | s2, s3 | 3 | build |

**Shared ground.** `kit/lib/help/entries.ts` is declared by s2 (the `now` entry gains `--status` and
`--fetch`) and s3 (the new `dashboard` entry, and the `status` entry's pointer to it): s3 is in wave
1 and s2 in wave 2, so they merge one after the other. `kit/dist/` is built, never in a territory:
each slice rebuilds it only to test, and the wave rebuilds it once after merging.

## Per slice: done when

### s1 (deep: the step rules and the verdict are the feature's logic)

- A pure function takes a work's facts (its kind, number, title, stage, board counts, open
  questions, approval wait, the pull request's state, changed files and checks, the links, when they
  were read) and returns `{ verdict, kind, steps, at, you, next, details, checkedAt }`.
- `steps.test.ts` holds a table with one row per line of the spec's **How each step is read**, for
  PRD (before and after approval), Bug fix and Visual update, and each row reads its expected step.
- The verdict is 🔴 on a failed check, a stuck slice, or a pull request closed without merging, 🟡
  when You asks something, and never 🟢 while a check is red or not known; You is never empty.
- `render.test.ts`: the block's lines come in the spec's order; Next holds at most two items;
  Details (RAW…) appears only on a failed check, at most three lines; the work's Omni page, else its
  GitHub issue; the freshness line, `Checked just now.` or `Checked <m> min ago (GitHub did not
  answer).`
- `words.test.ts`: every step of every kind has a name; no block shows `branch`, `slice`, `sub-PR`,
  `outbox`, `wave` or `CI` outside the table's explained forms; each technical word is explained the
  first time it appears in a block, and only then. The work's kind uses the glossary's words
  (`PRD`, `Bug fix`, `Visual update`).

### s2

- `omni now --status` prints the block of s1 for the session's work, read from this computer only;
  the block has no Right now line.
- `omni now --status --fetch` reads the work's pull request (state, changed files, checks) through
  `LoopReads`, with a 5-second limit, and keeps it beside the links; with the reads stubbed not
  answering, it prints the last copy and `Checked <m> min ago (GitHub did not answer).`
- `omni now --json` carries the `status` key; `omni now` with no flag prints exactly what it printed
  before (the existing tests unchanged and green).
- A session on nothing prints `Nothing is running in this terminal.` and
  `/omni:dashboard shows all your work.`; outside the loop, it answers nothing and exits 0
  (N-PRODUCT-12); a branch naming a work shows that work (BR-PRODUCT-90).
- No test calls GitHub; `kit/test/no-gh-reads.test.ts` stays green.
- `omni help now` names `--status` and `--fetch`.

### s3 (light: a rename and an alias)

- `kit/plugin/skills/dashboard/SKILL.md` is today's `status` skill, renamed `dashboard`, running
  `omni dashboard`, its triggers and lines naming `/omni:dashboard`.
- `omni dashboard` and `omni dashboard --fetch` print exactly what `omni status` and
  `omni status --fetch` print, on a fixture repository (`kit/bin/dashboard.test.ts`).
- `omni help` lists `dashboard`; the `status` entry is unchanged in what it does.
- The lines of these files that state N-PRODUCT-15 are left unchanged: the slice renames a skill and
  changes no law.

### s4

- `kit/plugin/skills/status/SKILL.md` runs `omni now --status --fetch`, prints its output whole in a
  `text` block, adds one plain Right now sentence under the step line only when this session is the
  one doing the work, never in a person's name (L-AIACT-1), and never changes a pull request, a label
  or an approval (BR-PRODUCT-3, BR-PRODUCT-5, N-PRODUCT-15).
- Its triggers include "status", "where are we", "what are you doing", "/omni:status"; the overview's
  triggers ("what has shipped", "where are my PRDs") are `/omni:dashboard`'s only.
- `kit/test/plugin.test.ts` holds that the plugin ships `status` and `dashboard`.
- `kit/README.md`, the user guide pages that named `/omni:status` (`docs/guide/loop.md`,
  `use-cases.md`, `join.md`, `cloud.md`) and `docs/guide/diagrams/skills.svg` name `/omni:status` as
  this session's status and `/omni:dashboard` as the overview.
- The lines of these files that state BR-PRODUCT-3, BR-PRODUCT-5 and N-PRODUCT-15 are left unchanged:
  the slice names two skills and changes no law.
