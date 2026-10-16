# Plan: the briefing is a risky change

PRD #1793, built from the [spec](spec.md) beside this plan. The feature branch
`feat/briefing-risky-change` goes into `main` with `Closes #1793`; each slice is a sub-PR from
`feat/briefing-risky-change--<slice>` into the feature branch, with `Part of #1793`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A change to the briefing's files (the form at its own path, its `points-to` file, each section's `See:` file) fires `briefing-text`, which only an item ranked high or human-action accounts for, on a feature PR, a fix PR and the outbox check | `kit/lib/playbook/briefing-files` `kit/lib/outbox/decision-coverage` `kit/lib/outbox/account` `kit/lib/outbox/status` `kit/lib/outbox/check-decision-coverage` `kit/lib/outbox/comment.ts` `kit/bin/commands/check.ts` `apps/omni-app/src/outbox-check/end-to-end.test.ts` | — | 1 |
| s2 | `omni kb owners` names the briefing's files in its CODEOWNERS block, `omni check knowledge` reports a block without them as out of date, and this repository's CODEOWNERS names the briefing | `kit/lib/codeowners-laws` `kit/lib/knowledge/check-knowledge` `kit/bin/kb.test.ts` `.github/CODEOWNERS` | s1 | 2 |
| s3 | `/omni:do-work`, `/omni:bug-fix`, `/omni:visual-fix` and the guide name `briefing-text` among the changes a person answers | `kit/plugin/skills/do-work/` `kit/plugin/skills/bug-fix/` `kit/plugin/skills/visual-fix/` `kit/porting/plugin--do-work.md` `kit/porting/plugin--bug-fix.md` `docs/guide/loop.md` `kit/test/briefing-text-skills.test.ts` `kit/test/skill-steps.snapshot.json` | — | 1 |

Shared ground: none. s2 reads the briefing's files through the helper s1 adds
(`kit/lib/playbook/briefing-files.ts`), so it waits for s1 in wave 2 and edits nothing of s1's.
`kit/dist/` and `apps/omni-app/api/` are generated: no slice lists them, and the wave rebuilds them
once after merging.

## Per slice: done when

**s1**

- `riskyChanges` reports `briefing-text` on an added, modified or deleted briefing, and on a
  briefing moved away (its delete), at the default and at a custom `paths.playbook`.
- It fires on a pointer form's `points-to` file and on a section's `See:` file (the whole file, the
  anchor dropped), read at the head; never on `testing.md`, on `kit/templates/playbook/briefing.md`,
  or on a file only another form points to. A change that fires another rule reports both.
- `briefing-text` is in `LAW_RULES`: an account naming a `high` or `human-action` item accounts for
  it; a `spec` line or a `medium` item is refused with a sentence that names the briefing
  ("a change to the briefing needs an item ranked high").
- `status.test.ts` and `status-fix.test.ts`: a feature PR and a fix PR (with `laws.source:
  knowledge`) changing the briefing are red with a medium item and green once a high item is
  answered.
- `apps/omni-app/src/outbox-check/end-to-end.test.ts`, against the stubbed GitHub: a feature PR
  changing the briefing with a medium item fails, with an answered high item succeeds, and a
  knowledge PR changing it succeeds.
- `pnpm mutation:changed` on the changed `kit/lib/outbox/` files keeps `mutation/floor.json`.
- `apps/omni-app/src/outbox-check/outbox-check.test.ts`, the test of locked laws BR-PRODUCT-6 and
  N-PRODUCT-4, is not edited (it sits outside the territory).

**s2**

- `kb owners` (through `makeRepo()` in `kit/bin/kb.test.ts`) writes, inside its markers and after
  the thesis and the registers, the comment `# The briefing: the rules every agent follows.` and one
  line per briefing file (its pointer targets included), and changes nothing outside the markers.
- `check-knowledge.test.ts`: a block without the briefing's lines is reported out of date; a
  repository with no lock and no block, or with `laws.owners` empty, is asked nothing.
- `check-knowledge.test.ts` is the test of rule BR-PRODUCT-95: adding to it fires `law-proof`, so
  the slice accounts for it with an item ranked high.
- In this repository, `.github/CODEOWNERS` names `/.omni-loop/knowledge/playbook/briefing.md
  @pierrederval` (written by `omni kb owners`), and `omni check knowledge` is green.

**s3**

- `/omni:do-work`'s list of risky changes, the rule tables and the "A change to a law" lines of
  `/omni:bug-fix` and `/omni:visual-fix`, and the "A person answers every change to a rule" section
  of `docs/guide/loop.md` name `briefing-text`.
- A new test, `kit/test/briefing-text-skills.test.ts`, asserts each of those texts names it;
  `kit/test/plugin.test.ts` is not edited.
