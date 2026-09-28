---
prd: 315
feature-pr: 316
merge-sha: e203ca7
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
---

# Retro — PRD 315, omni help and omni status, the loop explained and where your PRDs are

This PRD gave the loop a real help text and an overview for `omni status`, so the loop can explain its stages and show where each PRD stands. No failed job or review comment was recorded. The only findings are about churn inside the new status code: the same short passages of `kit/lib/status/facts.mjs`, `kit/lib/status/overview.mjs` and their tests were rewritten in each of three successive stories. The pattern suggests the shape of the status facts and the overview kept moving while later stories were built on top of it. The work merged, but it took more rework than a settled design would have needed.

## Findings

### F1 · The top of `kit/lib/status/facts.mjs` was rewritten in each of three stories — `churn:kit/lib/status/facts.mjs:2-3` · [#336](https://github.com/vertuoza/vertuo-omni-loop/issues/336)

- **What happened:** Lines 2-3 of `kit/lib/status/facts.mjs`, as merged, were written and rewritten in 3 commits, in s1, s2 and s3; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** The opening lines of a module usually hold its imports and main declarations. When they change in every story, the module's dependencies and core contract were still unsettled, and each later story had to redo work around them.
- **Proposed lesson:** Fix the imports and exported contract of a shared module in the first story that creates it, before later stories depend on it.
- **Evidence:** [efaa48a (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/efaa48a7d6c32729bf43de319f3dc69e2933d251), [22b2d37 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/22b2d37d9a83fe9dfa633ef05233c840b75c0180), [ea08c5a (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/ea08c5a1df72de372409fd41fbc36fef4fb76852), [`kit/lib/status/facts.mjs` lines 2-3, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/edfe59bf9cda4f089a5a9c9436f7a47725ecdcb7/kit/lib/status/facts.mjs#L2-L3)

### F2 · A block near the end of `kit/lib/status/facts.mjs` kept changing across stories — `churn:kit/lib/status/facts.mjs:275-278` · [#337](https://github.com/vertuoza/vertuo-omni-loop/issues/337)

- **What happened:** Lines 275-278 of `kit/lib/status/facts.mjs`, as merged, were written and rewritten in 3 commits, in s1, s2 and s3; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** This block was rewritten in all three commits that touched the file. The logic that gathers PRD facts across branches was likely redesigned each time, and that is where overview counts can quietly go wrong.
- **Proposed lesson:** When a fact-gathering function spans several stories, agree on its inputs and outputs early and test them directly, so later stories extend it instead of reshaping it.
- **Evidence:** [efaa48a (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/efaa48a7d6c32729bf43de319f3dc69e2933d251), [22b2d37 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/22b2d37d9a83fe9dfa633ef05233c840b75c0180), [ea08c5a (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/ea08c5a1df72de372409fd41fbc36fef4fb76852), [`kit/lib/status/facts.mjs` lines 275-278, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/edfe59bf9cda4f089a5a9c9436f7a47725ecdcb7/kit/lib/status/facts.mjs#L275-L278)

### F3 · A single line in `kit/lib/status/facts.mjs` was redone three times — `churn:kit/lib/status/facts.mjs:298-298` · [#338](https://github.com/vertuoza/vertuo-omni-loop/issues/338)

- **What happened:** Lines 298-298 of `kit/lib/status/facts.mjs`, as merged, were written and rewritten in 3 commits, in s1, s2 and s3; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** Rewriting one line in each story, next to the block just above it, shows the same unsettled logic. It is part of one pattern, not a separate problem.
- **Evidence:** [efaa48a (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/efaa48a7d6c32729bf43de319f3dc69e2933d251), [22b2d37 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/22b2d37d9a83fe9dfa633ef05233c840b75c0180), [ea08c5a (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/ea08c5a1df72de372409fd41fbc36fef4fb76852), [`kit/lib/status/facts.mjs` lines 298-298, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/edfe59bf9cda4f089a5a9c9436f7a47725ecdcb7/kit/lib/status/facts.mjs#L298-L298)

### F4 · A line of `kit/lib/status/format.test.mjs` changed with every story — `churn:kit/lib/status/format.test.mjs:16-16` · [#339](https://github.com/vertuoza/vertuo-omni-loop/issues/339)

- **What happened:** Lines 16-16 of `kit/lib/status/format.test.mjs`, as merged, were written and rewritten in 3 commits, in s1, s2 and s3; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** When a test line is rewritten in each story, the expected output format kept shifting. The test followed the code rather than pinning down the intended behaviour.
- **Proposed lesson:** Write the expected help and status output first and keep it stable, so format tests guard behaviour instead of chasing each rewrite.
- **Evidence:** [efaa48a (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/efaa48a7d6c32729bf43de319f3dc69e2933d251), [22b2d37 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/22b2d37d9a83fe9dfa633ef05233c840b75c0180), [51ec6b2 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/51ec6b22e09ddd5a07329141e9725362b7a5e32f), [`kit/lib/status/format.test.mjs` lines 16-16, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/edfe59bf9cda4f089a5a9c9436f7a47725ecdcb7/kit/lib/status/format.test.mjs#L16-L16)

### F5 · A block of `kit/lib/status/overview.mjs` was rewritten in three stories — `churn:kit/lib/status/overview.mjs:111-115` · [#340](https://github.com/vertuoza/vertuo-omni-loop/issues/340)

- **What happened:** Lines 111-115 of `kit/lib/status/overview.mjs`, as merged, were written and rewritten in 3 commits, in s1, s2 and s3; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** The overview is what gets shown about the inbox, outbox and shipped PRDs. Repeated rewrites of one block mean the way it summarises PRDs changed story after story, following the changes in the facts module.
- **Proposed lesson:** Settle the data the overview receives before shaping how it is presented, so presentation code is not reworked each time the facts change.
- **Evidence:** [efaa48a (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/efaa48a7d6c32729bf43de319f3dc69e2933d251), [22b2d37 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/22b2d37d9a83fe9dfa633ef05233c840b75c0180), [51ec6b2 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/51ec6b22e09ddd5a07329141e9725362b7a5e32f), [`kit/lib/status/overview.mjs` lines 111-115, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/edfe59bf9cda4f089a5a9c9436f7a47725ecdcb7/kit/lib/status/overview.mjs#L111-L115)

### F6 · Another line of `kit/lib/status/overview.mjs` kept being rewritten — `churn:kit/lib/status/overview.mjs:130-130`

- **What happened:** Lines 130-130 of `kit/lib/status/overview.mjs`, as merged, were written and rewritten in 3 commits, in s1, s2 and s3; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** This line changed in the same three commits as the block above it. The overview logic as a whole was unsettled, not just one detail.
- **Evidence:** [efaa48a (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/efaa48a7d6c32729bf43de319f3dc69e2933d251), [22b2d37 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/22b2d37d9a83fe9dfa633ef05233c840b75c0180), [51ec6b2 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/51ec6b22e09ddd5a07329141e9725362b7a5e32f), [`kit/lib/status/overview.mjs` lines 130-130, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/edfe59bf9cda4f089a5a9c9436f7a47725ecdcb7/kit/lib/status/overview.mjs#L130-L130)

### F7 · The setup lines of `kit/lib/status/overview.test.mjs` changed each story — `churn:kit/lib/status/overview.test.mjs:7-8`

- **What happened:** Lines 7-8 of `kit/lib/status/overview.test.mjs`, as merged, were written and rewritten in 3 commits, in s1, s2 and s3; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** The first lines of a test file usually hold imports and fixtures. Rewriting them in each story means the test inputs kept changing along with the facts they model.
- **Proposed lesson:** Build shared fixtures for PRD states once, near the start, and reuse them across stories.
- **Evidence:** [efaa48a (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/efaa48a7d6c32729bf43de319f3dc69e2933d251), [22b2d37 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/22b2d37d9a83fe9dfa633ef05233c840b75c0180), [51ec6b2 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/51ec6b22e09ddd5a07329141e9725362b7a5e32f), [`kit/lib/status/overview.test.mjs` lines 7-8, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/edfe59bf9cda4f089a5a9c9436f7a47725ecdcb7/kit/lib/status/overview.test.mjs#L7-L8)

## Proposed lessons

- Settle the contract of the shared status facts in the first story, before later stories build the overview and its tests on it. Most of the rework followed from that contract moving. (F1, F2, F3, F5, F6)
- Pin down the expected output and the test fixtures early, so tests guard intended behaviour instead of being rewritten with each change. (F4, F7)

## Timeline

- Feature PR [#316](https://github.com/vertuoza/vertuo-omni-loop/pull/316): opened `2026-09-28T05:12:15Z`, ready `2026-09-28T06:59:21Z`, merged `2026-09-28T07:09:39Z`, 117 minutes in all.
- 5 slices; waves: 4 planned, 4 as merged; median slice: 16 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#320](https://github.com/vertuoza/vertuo-omni-loop/pull/320) | `2026-09-28T05:35:20Z` | `2026-09-28T05:50:59Z` | 16 | 1 | 1 |
| s2 | [#321](https://github.com/vertuoza/vertuo-omni-loop/pull/321) | `2026-09-28T05:54:06Z` | `2026-09-28T06:09:50Z` | 16 | 2 | 2 |
| s4 | [#322](https://github.com/vertuoza/vertuo-omni-loop/pull/322) | `2026-09-28T05:54:09Z` | `2026-09-28T06:10:06Z` | 16 | 2 | 2 |
| s3 | [#323](https://github.com/vertuoza/vertuo-omni-loop/pull/323) | `2026-09-28T06:13:17Z` | `2026-09-28T06:31:38Z` | 18 | 3 | 3 |
| s5 | [#325](https://github.com/vertuoza/vertuo-omni-loop/pull/325) | `2026-09-28T06:34:14Z` | `2026-09-28T06:52:23Z` | 18 | 4 | 4 |

## Decisions

- Decisions: 9 raised and settled — 9 adopted, 0 agreed, 0 drifted; by rank: 9 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 5 merged sub-PRs graded against the plan — no path outside a slice’s territory.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 6 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

## Churn

- 22 commits read across 5 merged pull requests: 3180 lines added, 3065 in the final diff, 115 lines of churn.
- Left out as generated, by `.gitattributes`: `kit/dist/omni.mjs`.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/0315-help-and-status/s1-01-failed-fetch-keeps-last-fetch-time.md`, `.omni-loop/delivery/outbox/0315-help-and-status/s1-02-nothing-in-progress-under-a-full-bar.md`, `.omni-loop/delivery/outbox/0315-help-and-status/s2-01-counts-line-leaves-empty-stages-out.md`, `.omni-loop/delivery/outbox/0315-help-and-status/s2-02-fetch-time-read-across-worktrees.md`, `.omni-loop/delivery/outbox/0315-help-and-status/s2-03-branch-without-shared-history-skipped.md`, `.omni-loop/delivery/outbox/0315-help-and-status/s3-01-one-open-item-waits.md`, `.omni-loop/delivery/outbox/0315-help-and-status/s3-02-shipped-list-wraps-under-the-rows.md`, `.omni-loop/delivery/outbox/0315-help-and-status/s4-01-prd-number-still-shows-the-overview.md`, `.omni-loop/delivery/outbox/0315-help-and-status/s5-01-ask-command-run-by-the-skills.md`.

Findings: F1 · The top of `kit/lib/status/facts.mjs` was rewritten in each of three stories · [#336](https://github.com/vertuoza/vertuo-omni-loop/issues/336); F2 · A block near the end of `kit/lib/status/facts.mjs` kept changing across stories · [#337](https://github.com/vertuoza/vertuo-omni-loop/issues/337); F3 · A single line in `kit/lib/status/facts.mjs` was redone three times · [#338](https://github.com/vertuoza/vertuo-omni-loop/issues/338); F4 · A line of `kit/lib/status/format.test.mjs` changed with every story · [#339](https://github.com/vertuoza/vertuo-omni-loop/issues/339); F5 · A block of `kit/lib/status/overview.mjs` was rewritten in three stories · [#340](https://github.com/vertuoza/vertuo-omni-loop/issues/340); F6 · Another line of `kit/lib/status/overview.mjs` kept being rewritten; F7 · The setup lines of `kit/lib/status/overview.test.mjs` changed each story

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
