# Plan: Laws are born with their test

PRD #1342, specified in `spec.md` beside this plan. It is built on the feature branch
`feat/laws-with-their-test`, merged into `main` by one feature PR (`Closes #1342`); each slice is a
sub-PR from `feat/laws-with-their-test--<slice>` into the feature branch (`Part of #1342`).

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A law names a test or a pending issue: `Enforced by: pending #<n>` reads, and with `laws.requireProof: true` `omni check knowledge` refuses `unenforced`; the config gains `laws.requireProof`, `labels.law` and `branches.law` | `kit/lib/config` `kit/lib/schema/` `kit/lib/knowledge/check-knowledge` `kit/lib/knowledge/registers` `kit/bin/check-config.test.ts` `kit/templates/` | — | 1 |
| s2 | A person answers every change to a law on a feature PR: `law-demoted` fires, and the four law rules are accounted only by an item ranked `high` | `kit/lib/outbox/decision-coverage` `kit/lib/outbox/account` `kit/lib/outbox/status` `kit/lib/outbox/check-decision-coverage` | s1 | 2 |
| s3 | The `law-worth` Jev decision: Galaxy's registry entry, Off by default, the name allowed by the database, the signed judge route `POST /api/laws/judge` and the terminal's `omni decide law-worth` | `apps/galaxy/src/jev/decisions/` `apps/galaxy/app/api/laws/` `supabase/migrations/` `supabase/checks/jev.sql` `kit/bin/commands/decide.ts` `kit/bin/decide.test.ts` | — | 1 |
| s4 | The harvest's three paths in the kit: the classifier's `worthALaw`, "worth a law?" asked through `omni decide law-worth`, a "no" staying in `settled.md`, a "yes" written `pending #<n>` with its law issue opened by `omni harvest` | `kit/lib/knowledge/classify` `kit/lib/knowledge/pipeline` `kit/lib/knowledge/write` `kit/lib/knowledge/harvest` `kit/bin/commands/harvest.ts` `kit/bin/harvest.test.ts` | s1, s3 | 2 |
| s5 | The app's harvest asks Galaxy's judge and opens the law issue, so a merged feature PR's knowledge PR holds `pending #<n>` laws | `apps/omni-app/src/knowledge-harvest/` `apps/omni-app/src/env` `apps/omni-app/.env.example` | s3, s4 | 3 |
| s6 | The sweep: `omni knowledge judge` judges every `unenforced` law, writes `pending #<n>` with its issue or moves it to `settled.md`, and sets `laws.requireProof: true` | `kit/lib/knowledge/judge` `kit/bin/commands/knowledge.ts` `kit/bin/knowledge` `kit/lib/help/` `kit/bin/help.test.ts` | s4 | 3 |
| s7 | The server check grades fix PRs (a small outbox under the fix's folder when a law is touched), and never fails knowledge or enforce PRs, listing the laws they touch | `apps/omni-app/src/evaluate/` `apps/omni-app/src/outbox-check/` `apps/omni-app/test/fixtures/` `kit/lib/bug/` `kit/lib/visual/` `kit/bin/bug.test.ts` `kit/bin/visual.test.ts` `kit/lib/outbox/status` | s1, s2 | 3 |
| s8 | `/omni:enforce` turns a law issue into one PR with the law's test proven red then green; `/omni:bug-fix` and `/omni:visual-fix` raise a `high` item when their range touches a law | `kit/plugin/skills/enforce/` `kit/plugin/skills/bug-fix/` `kit/plugin/skills/visual-fix/` `kit/test/plugin.test.ts` `kit/lib/help/` `kit/bin/help.test.ts` | s1, s7 | 4 |
| s9 | The docs say what a law is now: `docs/guide`, the kit's and the apps' READMEs name `law-worth`, `/omni:enforce`, the sweep and `laws.requireProof` | `docs/guide/` `kit/README.md` `apps/omni-app/README.md` `apps/galaxy/README.md` `README.md` | s5, s6, s7, s8 | 5 |

**Shared ground.**

- `kit/lib/outbox/status` is declared by s2 and s7: s2 makes law rules item-only and `high`, s7 lets
  the gate read a fix's outbox. s7 is blocked by s2, so they never share a wave.
- `kit/lib/help/` and `kit/bin/help.test.ts` are declared by s6 (the `knowledge judge` verb) and s8 (the
  `/omni:enforce` skill): s6 is wave 3, s8 wave 4.
- `kit/lib/config` (the three new keys) and `kit/lib/schema/` belong to s1 alone; every later slice reads
  them, and none edits them.
- `kit/dist/` and `apps/omni-app/api/` are generated: no slice lists them, and the wave rebuilds them
  once after merging.

## Per slice: done when

**s1**

- `laws.requireProof` (default `false`), `labels.law` (default `omni:law`) and `branches.law` (default
  `test/law-{id}`) parse in the config, with unit tests for valid and invalid values.
- A register entry whose `Enforced by:` is `pending #<n>` reads; a malformed `pending` is refused,
  naming the entry.
- With `laws.requireProof: true`, `omni check knowledge` refuses an `unenforced` rule or invariant,
  naming it; with it `false`, the same tree passes as today.

**s2**

- `law-demoted` fires on a law entry removed, or an `Enforced by:` path turned to `pending` or
  `unenforced`, between the base and the head; tests for each case and for a path kept.
- An account line `spec <where>` for `law-proof`, `law-text`, `test-removed` or `law-demoted` leaves the
  change unaccounted; it still accounts for `stored-shape` and `shared-contract`.
- An `item <id>` account for a law rule whose item is ranked `medium` leaves the change unaccounted; a
  `high` or `human-action` item accounts for it, and the gate's report says which.
- `pnpm mutation:changed --base origin/feat/laws-with-their-test` leaves no survivor in the lines this
  slice wrote.

**s3**

- `law-worth` is registered, Off by default, with its Noul question, its state (statement, `Why`,
  served principle, domain, PRD title) and the masking every decision applies; tests in Off, Shadow and
  On, with the floor and the fallback.
- One additive migration adds `law-worth` to `jev_decision_names()`, and the Jev check passes.
- `POST /api/laws/judge` answers `{answer, confidence, decidedBy}` on a valid signed body, and refuses an
  unsigned, malformed or oversized one with the codes the constituent judge uses.
- `omni decide law-worth` prints the decision, or `unset` whenever Jev did not decide, and exits 0.

**s4**

- The classifier's contract has `worthALaw` on every `rule` and `invariant` reply, and refuses it on
  any other kind; the prompt snapshot is updated.
- `finishHarvest` returns, as data: a law with its changed test; a "no" as a `stays-here` note
  `not worth a law (<decided by> <score>)`; a "yes" as an entry `Enforced by: pending #<n>` plus the
  law issue to open.
- `omni harvest` on a fixture opens the law issue through `gh` before writing `pending #<n>`, and asks
  `omni decide law-worth`, keeping the classifier's answer when it prints `unset`.

**s5**

- On the end-to-end harvest against the stubbed GitHub, a "yes" opens one law issue with `labels.law`
  and the knowledge PR holds `pending #<that issue>`; a "no" opens none.
- A refused or failing judge call falls back to the classifier's answer, and the harvest completes.
- The judge secret is a documented environment variable, checked by the app's env tests.

**s6**

- `omni knowledge judge` on a fixture with `unenforced` rules and invariants writes, into the working
  tree, `pending #<n>` for each "yes" (its issue opened), the `settled.md` note for each "no", and
  `laws.requireProof: true`, then reports every id that cited a removed entry.
- Run twice, the second run changes nothing and opens no issue.
- `omni help knowledge` describes the verb.

**s7**

- `evaluate` on a fix PR with no law rule fired is `success`; with one fired and no outbox in the fix's
  folder, `failure` naming the law; with a `high` item answered, `success`.
- `evaluate` on a knowledge PR and on an enforce PR is never `failure`, and its summary lists the laws
  the range touches.
- With `laws.source` other than `knowledge`, fix PRs stay `skipped`.
- `omni bug` and `omni visual` name the outbox a law change needs.

**s8**

- `kit/plugin/skills/enforce/SKILL.md` exists and passes the plugin's skill-shape tests: it reads the
  issue, writes the test, shows it red with the law broken and green restored, rewrites `pending #<n>`
  to the test's path on `branches.law`, opens one signed PR closing the issue, and stops with a comment
  when it cannot go red.
- `/omni:bug-fix` and `/omni:visual-fix` each have one step raising a `high` item per law change in their
  range, under the fix's folder.
- `omni help enforce` describes the skill.

**s9**

- `docs/guide` has a page, or a section of an existing page, on laws: worth a law, pending, `/omni:enforce`,
  the sweep and `laws.requireProof`, linked from its index.
- `apps/omni-app/README.md` says the check now grades fix, knowledge and enforce PRs; `apps/galaxy/README.md`
  lists `law-worth` and its route; `kit/README.md` lists the new verb and keys.
