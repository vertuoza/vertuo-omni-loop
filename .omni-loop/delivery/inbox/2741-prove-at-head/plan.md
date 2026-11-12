# Plan: Prove a bug fix at the head that merges

PRD #2741 · spec: `spec.md` beside this plan · feature branch `feat/prove-at-head` into `main`
(`Closes #2741`) · sub-PRs from `feat/prove-at-head--<slice>` into the feature branch (`Part of #2741`).

## Slices

| id | slice | territory | blocked by | wave | tier |
| --- | --- | --- | --- | --- | --- |
| s1 | `omni bug <n>` refuses a produced proof whose After line cites no commit, or a commit that is not the fix pull request's head (the local `HEAD` with `--body-file` and no pull request) | `kit/lib/bug/proof-body` `kit/lib/bug/verdict.ts` `kit/bin/commands/bug.ts` `kit/bin/bug.test.ts` | — | 1 | build |
| s2 | a `## Fixes` record's proof must cite the head of one of its rows' pull requests, and `omni bug check --product --body-file` takes `--pr <owner/repo>#<n>` and grades against that head | `kit/lib/bug/fixes` `kit/lib/bug/product` `kit/bin/commands/bug.ts` `kit/bin/bug.test.ts` `kit/bin/bug-product.test.ts` | s1 | 2 | build |
| s3 | `/omni:pr-care` reruns `omni bug <n>` after each push to a bug-fix pull request and re-proves at the head or puts it back to draft; the bug-fix skills and the guide say the After line cites the head | `kit/plugin/skills/pr-care/` `kit/plugin/skills/bug-fix/` `kit/plugin/skills/mega-bug-fix/` `docs/guide/use-cases.md` `docs/guide/products.md` | s1 | 2 | build |

**Shared ground.** `kit/bin/commands/bug.ts` and `kit/bin/bug.test.ts` are declared by s1 and s2:
s1 adds the head read and its test cases, s2 the `--pr` flag and the `## Fixes` cases on top, so s2
waits for s1 (wave 2). s3 shares no prefix with s2, so they run side by side in wave 2. The
generated `kit/dist/` is rebuilt by the wave, never listed.

## Per slice: done when

### s1
- `omni bug <n>`, its `gh pr view` injected with a head one commit after the sha the After line
  cites, prints `not ok` and `the proof cites green at <sha>, but #<pr>'s head is <head> (1 commits
  later): run the reproduction again at the head and rewrite the After line` (the test that would
  have caught the kit-gaps review's item 2 earlier-green cases).
- The same, with a review commit pushed after the proof (the injected head moves), prints `not ok`
  (the test that would have caught item 2's review-commit cases).
- A cited sha that is the head, by any prefix of 7 characters or more, prints `ok`; a sha that is
  not a commit of the pull request prints the line with `<sha> is not a commit of #<pr>`.
- A produced proof whose After line cites no commit prints its own fault; a not-produced proof is
  graded as today.
- `--body-file` with no open pull request compares with `git rev-parse HEAD`.
- A head `gh` cannot read is one fault, `not judged: could not read the head of <owner/repo>#<n>: <why>`, never a pass.

### s2
- A `## Fixes` record whose proof cites a sha that is the head of none of its rows' pull requests
  prints `not ok` naming each row's head; the head of one row prints `ok`.
- `omni bug check --product <key> <file> --body-file <b>` without `--pr` exits 2 with
  `omni bug check: --body-file needs --pr <owner/repo>#<n>, the fix pull request it belongs to`.
- With `--pr <owner/repo>#<n>`, it refuses a sha that is not that pull request's head and passes
  the head.
- `omni help bug` names `--pr`.

### s3
- `/omni:pr-care`'s text says: after each push to a bug-fix pull request, run `omni bug <n>`; when
  the only fault is a stale green, run the reproduction at the head, rewrite the After line with the
  new short sha and passing line, put the body back and rerun `omni bug`; else `gh pr ready <pr>
  --undo` and say why in the status comment.
- `/omni:bug-fix` and `/omni:mega-bug-fix` say the After line cites the head at the moment the body is
  checked, and that `omni bug` refuses any other commit; `--pr` is named where the product proof is
  checked.
- The guide's bug-fix pages say a proof is only good at the head that merges.
