---
prd: 215
feature-pr: 217
merge-sha: 4a77bb2
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
---

# Retro — PRD 215, Omni-man by Omni Loop — a linked, configurable signature

This PRD asked for a signature line that links to the Omni Loop home page, carries a copyright mark, and takes the name from a single config key instead of two. The delivery hit trouble on its first slice. That slice was labelled `omni:needs-fix` after a single attempt and then went stuck, with no retry recorded. The same slice also edited a test file outside its assigned territory, `kit/test/no-literals.test.mjs`. That test's name suggests it guards against hard-coded text, which is exactly what a signature change touches.

## Findings

### F1 · First slice went stuck after one attempt — `friction:s1` · [#232](https://github.com/vertuoza/vertuo-omni-loop/issues/232)

- **What happened:** Slice s1 was labelled `omni:needs-fix` and went stuck after 1 attempt.
- **Why it matters:** The slice was flagged `omni:needs-fix` and stopped after its first attempt. The change to the signature did not land, so pull requests and issues still carry the old unlinked line, and the name is still typed in two keys. A single attempt before going stuck gave the loop little room to recover from whatever failed.
- **Proposed lesson:** When a slice is flagged `omni:needs-fix` early, read the stuck comment for the exact failing check before retrying. Consider allowing more than one attempt on small, text-only changes like a signature.
- **Evidence:** [stuck comment on #218](https://github.com/vertuoza/vertuo-omni-loop/pull/218#issuecomment-5853787470), [#218](https://github.com/vertuoza/vertuo-omni-loop/pull/218)

### F2 · Slice edited a test outside its territory — `territory:s1` · [#233](https://github.com/vertuoza/vertuo-omni-loop/issues/233)

- **What happened:** Slice s1 changed 1 path outside its territory and off the plan’s shared ground: `kit/test/no-literals.test.mjs`.
- **Why it matters:** The slice changed `kit/test/no-literals.test.mjs`, which was neither in its territory nor on the plan's shared ground. A test that checks for literal text is likely to object to a new hard-coded footer. Editing that guard, instead of moving the text into config, can hide the very problem the PRD set out to fix. It also puts the slice at odds with the plan.
- **Proposed lesson:** When a change collides with a guard test such as `kit/test/no-literals.test.mjs`, fix the code to satisfy the guard. If the guard truly needs changing, list it on the plan's shared ground first.
- **Evidence:** [#218](https://github.com/vertuoza/vertuo-omni-loop/pull/218/files)

## Proposed lessons

- For changes to user-facing text, expect literal-checking tests to fire. Plan for the text to come from config, and put any guard test that may need edits on the shared ground up front. (F2, F1)
- A slice that goes stuck after a single attempt deserves a close read of its failure before the next try, since small text changes rarely need to fail twice. (F1)

## Timeline

- Feature PR [#217](https://github.com/vertuoza/vertuo-omni-loop/pull/217): opened `2026-09-27T07:11:31Z`, ready `2026-09-27T08:09:57Z`, merged `2026-09-27T08:13:21Z`, 62 minutes in all.
- 3 slices; waves: 2 planned, 3 as merged; median slice: 7 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#218](https://github.com/vertuoza/vertuo-omni-loop/pull/218) | `2026-09-27T07:12:09Z` | `2026-09-27T07:30:00Z` | 18 | 1 | 1 |
| s2 | [#221](https://github.com/vertuoza/vertuo-omni-loop/pull/221) | `2026-09-27T07:32:05Z` | `2026-09-27T07:39:13Z` | 7 | 2 | 2 |
| settle | [#230](https://github.com/vertuoza/vertuo-omni-loop/pull/230) | `2026-09-27T08:07:03Z` | `2026-09-27T08:07:18Z` | 0 | — | 3 |

## Decisions

- Decisions: 1 raised and settled — 0 adopted, 1 agreed, 0 drifted; by rank: 1 high.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 2 merged sub-PRs graded against the plan — 1 path outside a slice’s territory; 1 more sub-PR names a slice the plan does not hold.
- Friction: 1 slice stuck, 1 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 4 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F1 · First slice went stuck after one attempt · [#232](https://github.com/vertuoza/vertuo-omni-loop/issues/232); F2 · Slice edited a test outside its territory · [#233](https://github.com/vertuoza/vertuo-omni-loop/issues/233)

## Churn

- 9 commits read across 3 merged pull requests: 318 lines added, 309 in the final diff, 9 lines of churn.
- Left out as generated, by `.gitattributes`: `kit/dist/omni.mjs`.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/0215-linked-signature/accounts/s1.md`, `.omni-loop/delivery/outbox/0215-linked-signature/s1-01-literal-guard-lets-the-home-link-through.md`, `.omni-loop/delivery/outbox/0215-linked-signature/settled.md`.

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
