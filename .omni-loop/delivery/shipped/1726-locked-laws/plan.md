# Plan: Locked laws

PRD #1726, built from the spec beside this plan (`spec.md`). The feature branch `feat/locked-laws`
merges into `main` through the feature PR ("Closes #1726"); each slice is a sub-PR from
`feat/locked-laws--<slice>` into the feature branch ("Part of #1726").

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | A law is a locked entry: the registers read and write `Locked:`, `Governs:` and `Proposed law:`; "law" means locked everywhere; `laws.max` and `laws.owners` exist; `omni check knowledge` refuses a lock with no test or no `Governs:`, a locked principle, and more locks than `laws.max` | `kit/lib/knowledge/registers` `kit/lib/knowledge/write` `kit/lib/knowledge/check-knowledge` `kit/lib/laws` `kit/lib/config` `kit/templates/` | — | 1 |
| s2 | The thesis and disclosure: `product/thesis.md` and its check; the briefing prints the thesis's laws; `omni kb laws` with `--paths`, `--slice` and `--area` returns the locked laws and only the rules whose `Governs:` matches | `kit/lib/knowledge/thesis` `kit/lib/knowledge/disclose` `kit/lib/knowledge/check-knowledge` `kit/bin/commands/kb.ts` `kit/bin/kb.test.ts` | s1 | 2 |
| s3 | The gate: `law-locked` stays red on any PR that changes a locked law until a CODEOWNER of its files approves on GitHub, fails closed with no CODEOWNER, and re-runs on `pull_request_review`; rules keep today's high item | `kit/lib/outbox/decision-coverage` `kit/lib/outbox/account` `kit/lib/codeowners` `apps/omni-app/src/outbox-check/` `apps/omni-app/src/webhook/` `apps/omni-app/test/fixtures/` | s1 | 2 |
| s4 | `omni kb owners` writes the CODEOWNERS block for the locked laws, the thesis and the registers, between markers only; `omni check knowledge` goes red on a stale block | `kit/lib/codeowners` `kit/lib/knowledge/check-knowledge` `kit/bin/commands/kb.ts` `kit/bin/kb.test.ts` | s2, s3 | 3 |
| s5 | The skills read only what a change touches and speak plainly: brainstorm names each locked law and its CODEOWNERS in Risks, plan marks law slices, do-work reads `kb laws --slice`, bug-fix reads `--paths`, `/omni:pr` records `Law-Change-Approved-By:`, invade drafts the thesis and proposes candidate laws; the guide explains the tiers | `kit/plugin/skills/brainstorm/` `kit/plugin/skills/plan/` `kit/plugin/skills/do-work/` `kit/plugin/skills/bug-fix/` `kit/plugin/skills/pr/` `kit/plugin/skills/invade/` `kit/test/plugin.test.ts` `docs/guide/` | s2, s3 | 3 |
| s6 | This repository's triage: every rule and invariant has `Governs:`, `thesis.md` reads for a junior, at most 20 candidate laws are proposed in one high item for @pierrederval, `laws.owners` is set and the CODEOWNERS block written | `.omni-loop/knowledge/product/` `.omni-loop/config.yml` `.github/CODEOWNERS` | s4, s5 | 4 |

**Shared ground.**
- `kit/lib/knowledge/check-knowledge`: s1 (wave 1), s2 (wave 2) and s4 (wave 3), one per wave.
- `kit/bin/commands/kb.ts` and `kit/bin/kb.test.ts`: s2 (wave 2) and s4 (wave 3).
- `kit/lib/codeowners`: s3 creates the reader (wave 2), and s4 adds the writer (wave 3).

The generated `kit/dist/` and `apps/omni-app/api/` are rebuilt by the wave, never by a slice.

## Per slice: done when

**s1**
- `registers.ts` parses `Locked: @login, <date>`, `Governs: <paths>` and `Proposed law: <sentence>`,
  and `write.ts` writes them back unchanged; tests cover valid and malformed lines.
- `kit/lib/laws.ts` and `decision-coverage.ts` agree that a law is a locked rule or invariant, and a
  test pins it.
- `laws.max` (default 20) and `laws.owners` (default `[]`) read from the config, with invalid values
  refused.
- `omni check knowledge` refuses, each with its own message and test:
  - a lock with no `Enforced by:` test;
  - a lock with no `Governs:`;
  - a locked principle;
  - more locks than `laws.max`;
  - a lock while `laws.owners` is empty.

**s2**
- `omni kb laws` prints one plain line per locked law and nothing else.
- `--paths <files>` adds exactly the rules whose `Governs:` matches, using the flow areas' matcher,
  and never a rule without `Governs:`. `--slice <prd> <s>` does the same for the slice's territory,
  and `--area <domain>` for one domain folder.
- `omni kb show briefing` ends with the thesis's laws section.
- `omni check knowledge` refuses a thesis whose laws section names an id that is not locked, or
  misses one that is.
- `omni kb status` counts the rules with no `Governs:`.
- Every case is tested through `makeRepo()`.

**s3**
- `law-locked` fires when a PR adds or removes `Locked:`, edits a locked entry's text, changes its
  `Enforced by:` file, or deletes it. It never fires on a rule: `decision-coverage.test.ts` covers
  each case.
- In the Omni app's end-to-end test, on the stubbed GitHub:
  - no approval: red;
  - a non-owner's approval: red;
  - a CODEOWNER's approval (CODEOWNERS read from the base): green;
  - no CODEOWNERS: red, naming the law;
  - a knowledge PR and an enforce PR that change a locked law: red;
  - an outbox item or `omni:outbox-go` does not clear it.
- A `pull_request_review` event (submitted, dismissed) starts the outbox check.
- A rule's test change still needs a high item, as before.
- `pnpm mutation:changed` reports no survivor in the new code.

**s4**
- `omni kb owners` writes a marked block in `.github/CODEOWNERS` for:
  - each locked law's test file;
  - `product/thesis.md`;
  - the register files.
- The block names the owners from `laws.owners`, and the command leaves every line outside the
  markers byte-identical.
- `omni check knowledge` goes red when the block differs from what `kb owners` would write.
- These cases are tested through `makeRepo()`.

**s5**
- `/omni:brainstorm` runs `omni kb laws --paths` on what the design touches, and writes each locked
  law it touches, with its CODEOWNERS, in the spec's Risks.
- `/omni:plan` marks a slice that touches a locked law `law: <id> · owner @x`.
- `/omni:do-work` reads `omni kb laws --slice` instead of the whole knowledge folder.
- `/omni:bug-fix` reads `--paths` of its fix.
- `/omni:pr` writes `Law-Change-Approved-By: @login` for each approving CODEOWNER.
- `/omni:invade` drafts `thesis.md` from evidence, with a `TODO(human)` where there is none,
  proposes at most `laws.max` candidate laws with `Governs:`, and locks none.
- Every statement these skills write about a law is one plain sentence a junior developer or junior
  PM understands: what breaks, and who gets hurt.
- `kit/test/plugin.test.ts` pins each of these.
- `docs/guide/` explains the principle, rule and law tiers and how a law is locked.

**s6**
- Every rule and invariant in `.omni-loop/knowledge/product/` carries `Governs:`.
- `product/thesis.md` exists, written for a junior.
- At most 20 entries carry `Proposed law:`.
- One high outbox item lists those candidates, in plain words, for @pierrederval to lock or strike.
- Every "keep as rule" verdict is a medium item.
- `laws.owners` is `[pierrederval]`, and `omni kb owners` has written `.github/CODEOWNERS`.
- `omni check knowledge` is green.
