---
prd: 142
feature-pr: 145
merge-sha: f3fadbc
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
---

# Retro — PRD 142, Ask mode — one page, a tab per terminal

The delivery split the ask mode fix into three slices, so that each terminal gets its own tab on one page. The first two slices merged quickly. The third slice, which carried the live proof with two terminals, took far longer than the rest and is the main timing concern. Every churn finding concerns a note in the delivery outbox: each was written during a slice and is absent from the final diff. That looks like expected bookkeeping, not code that was built and then thrown away. The product code itself shows no churn signal.

## Findings

### F1 · The settled note was written in the outbox, then left out of the final diff — `churn:.omni-loop/delivery/outbox/0142-ask-tabs/settled.md` · [#169](https://github.com/vertuoza/vertuo-omni-loop/issues/169)

- **What happened:** `.omni-loop/delivery/outbox/0142-ask-tabs/settled.md` had 84 lines added across 1 commits, none of them in the final diff: 84 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** The note was added in one commit of the third slice and none of it survives in the final diff. For an outbox file this most likely means a note that was consumed and cleared. It still counts as churn, and that can hide real rework in product code.
- **Proposed lesson:** Treat outbox notes as transient, so the churn rule looks only at files that ship.
- **Evidence:** [9e78f84 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/9e78f846dfd8a5e7d88e5ce0e030520f9afba2ce)

### F2 · The live proof note for two terminals was written twice, then cleared — `churn:.omni-loop/delivery/outbox/0142-ask-tabs/s3-01-live-proof-two-terminals.md` · [#170](https://github.com/vertuoza/vertuo-omni-loop/issues/170)

- **What happened:** `.omni-loop/delivery/outbox/0142-ask-tabs/s3-01-live-proof-two-terminals.md` had 53 lines added across 2 commits, none of them in the final diff: 53 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** This note was touched in two commits of the third slice, the slow one. Its rewrite suggests the proof with two real terminals needed more than one pass. That matches the long duration of that slice.
- **Proposed lesson:** Plan a live proof across terminals as its own step, with a scripted setup, so that it does not stretch a slice.
- **Evidence:** [736089d (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/736089dc0a1617be2a2ed427f0c089122744f29e), [9e78f84 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/9e78f846dfd8a5e7d88e5ce0e030520f9afba2ce)

### F3 · A note on switching tabs losing a draft was written, then cleared — `churn:.omni-loop/delivery/outbox/0142-ask-tabs/s2-01-tab-switch-drops-draft.md` · [#171](https://github.com/vertuoza/vertuo-omni-loop/issues/171)

- **What happened:** `.omni-loop/delivery/outbox/0142-ask-tabs/s2-01-tab-switch-drops-draft.md` had 49 lines added across 1 commits, none of them in the final diff: 49 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** The note records a flaw found in the second slice: switching tabs dropped a draft answer. The note itself was transient. The flaw it describes is worth checking in future work on tabs.
- **Proposed lesson:** Keep the flaw a transient note describes as a lasting test, so it does not live only in a cleared file.
- **Evidence:** [d856c33 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/d856c33a1effcd4e6f7b2cb8388fc35b082e6fa7)

### F4 · A note on a closed session found by the post hook was written, then cleared — `churn:.omni-loop/delivery/outbox/0142-ask-tabs/s1-01-closed-session-found-on-post.md` · [#172](https://github.com/vertuoza/vertuo-omni-loop/issues/172)

- **What happened:** `.omni-loop/delivery/outbox/0142-ask-tabs/s1-01-closed-session-found-on-post.md` had 48 lines added across 1 commits, none of them in the final diff: 48 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** The note, from the first slice, concerns the post hook meeting a session that was already closed. That is the clash the request described. The note was transient, but the case it covers is central to the fix.
- **Proposed lesson:** Make sure the closed session case found by the post hook ends up covered by a test, not only by a cleared note.
- **Evidence:** [55595d4 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/55595d42a4f7828cd1cad9dbbb036747f442b417)

### F5 · A note on an empty page selecting no tab was written, then cleared — `churn:.omni-loop/delivery/outbox/0142-ask-tabs/s2-02-empty-page-picks-nothing.md` · [#173](https://github.com/vertuoza/vertuo-omni-loop/issues/173)

- **What happened:** `.omni-loop/delivery/outbox/0142-ask-tabs/s2-02-empty-page-picks-nothing.md` had 48 lines added across 1 commits, none of them in the final diff: 48 lines of churn. The rules flag a file whose churn is at least 50% of its final added lines and at least 40 lines.
- **Why it matters:** The note, from the second slice, covers the page opening with no tab selected. It was transient outbox content. It still marks an edge case in the new tab view.
- **Proposed lesson:** Carry edge cases found in outbox notes into tests for the tab view before the notes are cleared.
- **Evidence:** [d856c33 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/d856c33a1effcd4e6f7b2cb8388fc35b082e6fa7)

### F6 · The third slice took far longer than the others — `slow-slice:s3`

- **What happened:** Slice s3 took 289 minutes from its claim to its merge, against a median of 12 minutes; the rules flag a slice slower than 3 times the median.
- **Why it matters:** The third slice ran many times longer than the median slice. Its work was a live proof with two real terminals, which is slow and hard to automate. The delay held back the whole delivery.
- **Proposed lesson:** Prepare a repeatable harness for proofs across several terminals, and keep them in a slice of their own, sized for the time they need.
- **Evidence:** [#157](https://github.com/vertuoza/vertuo-omni-loop/pull/157)

## Proposed lessons

- Exclude transient notes in the delivery outbox from the churn rule, so that churn findings point to rework in shipped code. (F1, F2, F3, F4, F5)
- Script live proofs that need several terminals and size their slice for them, so that they do not become the long pole of a delivery. (F6, F2)
- Turn edge cases recorded in transient notes into lasting tests before the notes are cleared. (F4, F3, F5)

## Timeline

- Feature PR [#145](https://github.com/vertuoza/vertuo-omni-loop/pull/145): opened `2026-09-26T08:53:22Z`, ready `2026-09-26T15:11:54Z`, merged `2026-09-26T15:12:38Z`, 379 minutes in all.
- 3 slices; waves: 2 planned, 2 as merged; median slice: 12 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#155](https://github.com/vertuoza/vertuo-omni-loop/pull/155) | `2026-09-26T10:07:21Z` | `2026-09-26T10:16:20Z` | 9 | 1 | 1 |
| s2 | [#156](https://github.com/vertuoza/vertuo-omni-loop/pull/156) | `2026-09-26T10:07:28Z` | `2026-09-26T10:19:31Z` | 12 | 1 | 1 |
| s3 | [#157](https://github.com/vertuoza/vertuo-omni-loop/pull/157) | `2026-09-26T10:20:44Z` | `2026-09-26T15:09:14Z` | 289 | 2 | 2 |

Findings: F6 · The third slice took far longer than the others

## Decisions

- Decisions: 4 raised and settled — 3 adopted, 1 agreed, 0 drifted; by rank: 1 human-action, 3 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 3 merged sub-PRs graded against the plan — no path outside a slice’s territory.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 4 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

## Churn

- 13 commits read across 3 merged pull requests: 1930 lines added, 1608 in the final diff, 322 lines of churn.
- Left out as generated, by `.gitattributes`: `kit/dist/omni.mjs`.

Findings: F1 · The settled note was written in the outbox, then left out of the final diff · [#169](https://github.com/vertuoza/vertuo-omni-loop/issues/169); F2 · The live proof note for two terminals was written twice, then cleared · [#170](https://github.com/vertuoza/vertuo-omni-loop/issues/170); F3 · A note on switching tabs losing a draft was written, then cleared · [#171](https://github.com/vertuoza/vertuo-omni-loop/issues/171); F4 · A note on a closed session found by the post hook was written, then cleared · [#172](https://github.com/vertuoza/vertuo-omni-loop/issues/172); F5 · A note on an empty page selecting no tab was written, then cleared · [#173](https://github.com/vertuoza/vertuo-omni-loop/issues/173)

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
