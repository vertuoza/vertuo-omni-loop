# Plan: PR care

PRD #790, spec beside this plan (`spec.md`). The feature branch `feat/pr-care` goes into `main` with
`Closes #790`. Each slice is a sub-PR from `feat/pr-care--<slice>` into the feature branch, marked
`Part of #790`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `omni care state <n>` prints the feature PR's care state (checks, mergeable, review threads with verdicts, wave claims), `omni care reply` writes a marked reply, and a pure decision turns a state into the round's next actions | `kit/lib/care/` `kit/bin/commands/care.mjs` `kit/bin/commands/index.mjs` `kit/bin/care.test.mjs` `kit/bin/omni.test.mjs` `kit/dist/` | — | 1 |
| s2 | The PRD page reads the feature PR's care state from GitHub and shows the health chip beside the feature PR link in the stage header | `apps/galaxy/src/dossier/github/` `apps/galaxy/src/dossier/page/StageHeader.tsx` `apps/galaxy/src/dossier/page/stage.ts` `apps/galaxy/src/dossier/page/stage.test.ts` `apps/galaxy/src/dossier/page/render.test.ts` `apps/galaxy/src/dossier/page/dossier.css` | — | 1 |
| s3 | `omni kb show review` prints the `review` form (fix, push-back, ask) with the kit default | `kit/lib/playbook/` `kit/templates/playbook/` `kit/bin/kb.test.mjs` `kit/dist/` | — | 2 |
| s4 | The PR care tab lists CI, conflicts, each review thread with its verdict and reason (asked first), and the watcher line with the copyable `/omni:pr-care <n>` | `apps/galaxy/src/dossier/page/view.ts` `apps/galaxy/src/dossier/page/view.test.ts` `apps/galaxy/src/dossier/page/CarePane.tsx` `apps/galaxy/src/dossier/page/care-render.test.ts` `apps/galaxy/src/dossier/page/DossierPage.tsx` `apps/galaxy/src/dossier/page/render.test.ts` `apps/galaxy/src/dossier/page/dossier.css` | s2 | 2 |
| s5 | `/omni:pr-care <n>` watches the feature PR round by round (conflicts, red CI, review threads judged against the `review` form, status comment's care line, nothing pushed during a wave), and `/omni:yolo`'s hand-off names it | `kit/plugin/skills/pr-care/` `kit/plugin/skills/yolo/` `kit/lib/help/` `kit/test/plugin.test.mjs` `kit/dist/` | s1, s3 | 3 |

**Shared ground.**
- `kit/dist/` belongs to s1, s3 and s5, because every kit change rebuilds the committed bundle
  (`kit/test/dist.test.mjs`). They sit in waves 1, 2 and 3.
- `apps/galaxy/src/dossier/page/render.test.ts` and `dossier.css` belong to s2 (the chip) and s4
  (the tab). s4 is blocked by s2, so it builds on the chip's styles in wave 2.

## Per slice: done when

**s1**
- `omni care state 790`, run on a stubbed GitHub response, prints JSON holding: the check rollup
  (green, red with the failed run's link, or running), the mergeable state, each unresolved or
  care-handled review thread with its comments and verdict (`fixed`, `pushed-back`, `asked` or
  unhandled), and whether a wave holds claims.
- `omni care reply` builds a body ending with `<!-- omni-care: <verdict> -->`. The marker reader
  returns the three verdicts, and anything else reads as unhandled.
- Tests of the decision function show:
  - A conflict comes before red CI, and red CI comes before reviews.
  - While a wave holds claims, the decision is report-only.
  - A handled thread is skipped.
  - When a person replies after a care reply, the thread becomes asked.
  - A stuck CI still lets reviews be handled.
- `pnpm test` is green, with `kit/dist/omni.mjs` rebuilt.

**s2**
- Recorded GraphQL fixtures parse into the care state: green, red, running, conflicting, threads of
  each verdict, and a fresh and a stale status comment.
- While the feature PR is open, the stage header shows the chip beside its link:
  `CI ✓ · no conflict · N open`, red on `CI red` or `conflict`, grey while CI runs.
- No chip shows when there is no open feature PR, or when the read failed.
- No test calls GitHub.

**s3**
- `omni kb show review` prints the `fix`, `push-back` and `ask` slots with the spec's kit default
  when the repository has no `review.md`.
- The template passes the playbook check.
- The forms tests count the new form.

**s4**
- A PR care tab comes after Outbox, only while the PRD has a feature PR.
- The tab shows:
  - the CI row (with the failed run's link when red)
  - the Conflicts row
  - the Review counts
  - one line per thread (avatar, login, the comment's first line, the verdict with its reason, a
    GitHub link), with asked threads first
- The watcher line reads `Claude is watching · last round N min ago` under 15 minutes. From 15
  minutes on it reads `Nobody is watching`, with `/omni:pr-care <n>` in a copy chip.

**s5**
- `kit/plugin/skills/pr-care/SKILL.md` describes the round exactly as the spec does:
  - the order: conflict, red CI, then reviews
  - judging each thread against `omni kb show review`
  - posting through `omni care reply`, and resolving fixed and pushed-back threads
  - the reviewer's last word
  - no push while a wave holds claims
  - the status comment's `PR care: watching since … · last round …` line
  - the stop conditions: merged, closed, or stopped by the person
- `/omni:help` lists `/omni:pr-care` with its group, when to use it, and an example.
- `/omni:yolo`'s hand-off, after the feature PR is marked ready, ends with the `/omni:pr-care <n>` line.
- `kit/test/plugin.test.mjs` is green.
