---
prd: 144
feature-pr: 147
merge-sha: 9497974
runs: [merge]
model: anthropic/claude-opus-5.5
rules: 1
---

# Retro — PRD 144, Question history — every question Claude asks, kept, sorted and shareable

The question history PRD was delivered in five slices that each touched the ask page and its data layer. Most slices went from claim to merge in about a quarter of an hour, but the last slice took roughly fifteen hours. Three slices changed files outside their territory, most often the ask session page and its styles. The same few lines of the session page, the session component, the API module, the store fake and their tests were rewritten slice after slice. The plan split one shared surface across several slices without giving any of them clear ownership of it.

## Findings

### F1 · First slice edited the ask mode module outside its territory — `territory:s1` · [#223](https://github.com/vertuoza/vertuo-omni-loop/issues/223)

- **What happened:** Slice s1 changed 1 path outside its territory and off the plan’s shared ground: `kit/lib/ask/mode.mjs`.
- **Why it matters:** The first slice changed `kit/lib/ask/mode.mjs`, which was neither in its territory nor on the plan's shared ground. Edits like this make a slice harder to review against its plan, and they can collide with other work on the same module.
- **Proposed lesson:** When a slice needs to touch the ask mode module, list it in the plan's shared ground or give it to one slice.
- **Evidence:** [#163](https://github.com/vertuoza/vertuo-omni-loop/pull/163/files)

### F2 · Third slice edited the session page and its styles outside its territory — `territory:s3` · [#224](https://github.com/vertuoza/vertuo-omni-loop/issues/224)

- **What happened:** Slice s3 changed 2 paths outside its territory and off the plan’s shared ground: `apps/galaxy/app/ask/[session]/page.tsx`, `apps/galaxy/src/ask/ask.css`.
- **Why it matters:** The third slice changed `page.tsx` under the session route and `ask.css`, neither of which was planned for it. The session page was already being reshaped by other slices, so this added one more writer to a crowded file.
- **Proposed lesson:** Name the ask session page and its stylesheet as shared ground in the plan, or give them to a single slice.
- **Evidence:** [#175](https://github.com/vertuoza/vertuo-omni-loop/pull/175/files)

### F3 · Fourth slice also edited the session page outside its territory — `territory:s4` · [#225](https://github.com/vertuoza/vertuo-omni-loop/issues/225)

- **What happened:** Slice s4 changed 1 path outside its territory and off the plan’s shared ground: `apps/galaxy/app/ask/[session]/page.tsx`.
- **Why it matters:** The fourth slice changed the session route's `page.tsx` without it being in its territory. It was the third slice to reach into that page, which shows the plan had no clear owner for it.
- **Proposed lesson:** When several slices all need the same page, plan that page as shared ground from the outset.
- **Evidence:** [#188](https://github.com/vertuoza/vertuo-omni-loop/pull/188/files)

### F4 · The opening lines of `source.test.ts` were rewritten in four slices — `churn:apps/galaxy/src/ask/page/source.test.ts:4-7` · [#226](https://github.com/vertuoza/vertuo-omni-loop/issues/226)

- **What happened:** Lines 4-7 of `apps/galaxy/src/ask/page/source.test.ts`, as merged, were written and rewritten in 4 commits, in s2, s3, s4 and s5; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** The same few lines of this test were rewritten by the second, third, fourth and fifth slices. They are most likely imports or setup that each slice adjusted to its own changes, so every slice paid again to update the same test header.
- **Proposed lesson:** Settle shared test setup early, in one slice, so later slices only add cases.
- **Evidence:** [587d6d6 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/587d6d60b235af310e1f23deff603eaab972c69c), [63ad5db (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/63ad5db6c203a01747c1156154a4a3793118e123), [7a0df98 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/7a0df98dc97e3013f8e5384d93cfc488af55d663), [8f406eb (s5)](https://github.com/vertuoza/vertuo-omni-loop/commit/8f406ebbce4f908e8c4520c54ea6bbba25612d0e), [`apps/galaxy/src/ask/page/source.test.ts` lines 4-7, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/b974bb6a3c1dcfc13a6f36593556ced2e4192cfd/apps/galaxy/src/ask/page/source.test.ts#L4-L7)

### F5 · One line of the session page was rewritten in three slices — `churn:apps/galaxy/app/ask/[session]/page.tsx:30-30` · [#227](https://github.com/vertuoza/vertuo-omni-loop/issues/227)

- **What happened:** Lines 30-30 of `apps/galaxy/app/ask/[session]/page.tsx`, as merged, were written and rewritten in 3 commits, in s2, s3 and s4; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** The second, third and fourth slices each rewrote the same line of the session route page. Each rewrite undid or reshaped the one before it, so the page's shape kept moving while it was being built.
- **Proposed lesson:** Fix the session page's data loading shape once, before handing later features to other slices.
- **Evidence:** [c2ca7d3 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/c2ca7d31ea501714f54258af913e5adaec9d9c35), [63ad5db (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/63ad5db6c203a01747c1156154a4a3793118e123), [8756007 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/87560077e045addabf9f965188f7b9430a540f26), [`apps/galaxy/app/ask/[session]/page.tsx` lines 30-30, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/b974bb6a3c1dcfc13a6f36593556ced2e4192cfd/apps/galaxy/app/ask/%5Bsession%5D/page.tsx#L30-L30)

### F6 · A block of the session page was rewritten in three slices — `churn:apps/galaxy/app/ask/[session]/page.tsx:58-60`

- **What happened:** Lines 58-60 of `apps/galaxy/app/ask/[session]/page.tsx`, as merged, were written and rewritten in 3 commits, in s2, s3 and s4; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** _Dropped: it holds a word the rules refuse._
- **Proposed lesson:** Give the session page to one slice and let later slices extend it through narrow props or hooks.
- **Evidence:** [c2ca7d3 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/c2ca7d31ea501714f54258af913e5adaec9d9c35), [63ad5db (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/63ad5db6c203a01747c1156154a4a3793118e123), [8756007 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/87560077e045addabf9f965188f7b9430a540f26), [`apps/galaxy/app/ask/[session]/page.tsx` lines 58-60, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/b974bb6a3c1dcfc13a6f36593556ced2e4192cfd/apps/galaxy/app/ask/%5Bsession%5D/page.tsx#L58-L60)

### F7 · An import line in `api.test.ts` changed in three slices — `churn:apps/galaxy/src/ask/api.test.ts:4-4`

- **What happened:** Lines 4-4 of `apps/galaxy/src/ask/api.test.ts`, as merged, were written and rewritten in 3 commits, in s2, s3 and s4; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** The same line of the API test was rewritten by the second, third and fourth slices. It is a small change, but it shows every slice had to touch the shared API test to fit its own work.
- **Proposed lesson:** Agree on the API test's imports and fixtures before the slices split.
- **Evidence:** [587d6d6 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/587d6d60b235af310e1f23deff603eaab972c69c), [f290f49 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/f290f4959a69a96dee9e2a5bc2e7fbe74dc196cd), [a5def29 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/a5def299ebd98b012ce96ca9bb028e264fdb3b67), [`apps/galaxy/src/ask/api.test.ts` lines 4-4, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/b974bb6a3c1dcfc13a6f36593556ced2e4192cfd/apps/galaxy/src/ask/api.test.ts#L4-L4)

### F8 · The same lines of `api.ts` were rewritten in three slices — `churn:apps/galaxy/src/ask/api.ts:44-45`

- **What happened:** Lines 44-45 of `apps/galaxy/src/ask/api.ts`, as merged, were written and rewritten in 3 commits, in s1, s3 and s4; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** The first, third and fourth slices each rewrote these lines of the API module. The API contract for sessions and rounds kept shifting as fields such as origin and sharing were added one slice at a time.
- **Proposed lesson:** Define the full round and session shape, including origin and sharing fields, in the first slice.
- **Evidence:** [0bbadf1 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/0bbadf11b21dc7fa37587db31c69b9166a868ed7), [f290f49 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/f290f4959a69a96dee9e2a5bc2e7fbe74dc196cd), [a5def29 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/a5def299ebd98b012ce96ca9bb028e264fdb3b67), [`apps/galaxy/src/ask/api.ts` lines 44-45, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/b974bb6a3c1dcfc13a6f36593556ced2e4192cfd/apps/galaxy/src/ask/api.ts#L44-L45)

### F9 · Props of `AskSession.tsx` were rewritten in three slices — `churn:apps/galaxy/src/ask/page/AskSession.tsx:24-25`

- **What happened:** Lines 24-25 of `apps/galaxy/src/ask/page/AskSession.tsx`, as merged, were written and rewritten in 3 commits, in s2, s3 and s4; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** The second, third and fourth slices each rewrote these lines of the session component. The component's inputs changed with every slice.
- **Proposed lesson:** Settle the session component's props once, then grow it by composition.
- **Evidence:** [c2ca7d3 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/c2ca7d31ea501714f54258af913e5adaec9d9c35), [63ad5db (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/63ad5db6c203a01747c1156154a4a3793118e123), [8756007 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/87560077e045addabf9f965188f7b9430a540f26), [`apps/galaxy/src/ask/page/AskSession.tsx` lines 24-25, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/b974bb6a3c1dcfc13a6f36593556ced2e4192cfd/apps/galaxy/src/ask/page/AskSession.tsx#L24-L25)

### F10 · Another block of `AskSession.tsx` was rewritten in three slices — `churn:apps/galaxy/src/ask/page/AskSession.tsx:32-34`

- **What happened:** Lines 32-34 of `apps/galaxy/src/ask/page/AskSession.tsx`, as merged, were written and rewritten in 3 commits, in s2, s3 and s4; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** The same block of the session component was rewritten again across three slices, along with its neighbouring lines. The component was reworked repeatedly instead of being extended.
- **Proposed lesson:** Split the session component into parts that separate slices can own.
- **Evidence:** [c2ca7d3 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/c2ca7d31ea501714f54258af913e5adaec9d9c35), [63ad5db (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/63ad5db6c203a01747c1156154a4a3793118e123), [8756007 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/87560077e045addabf9f965188f7b9430a540f26), [`apps/galaxy/src/ask/page/AskSession.tsx` lines 32-34, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/b974bb6a3c1dcfc13a6f36593556ced2e4192cfd/apps/galaxy/src/ask/page/AskSession.tsx#L32-L34)

### F11 · A single line of `AskSession.tsx` was rewritten in three slices — `churn:apps/galaxy/src/ask/page/AskSession.tsx:41-41`

- **What happened:** Lines 41-41 of `apps/galaxy/src/ask/page/AskSession.tsx`, as merged, were written and rewritten in 3 commits, in s2, s3 and s4; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** This line of the session component changed in the second, third and fourth slices. It is further sign that the component had no stable shape while features were being layered on.
- **Proposed lesson:** Settle the component's shape early, before features are layered on top of it.
- **Evidence:** [c2ca7d3 (s2)](https://github.com/vertuoza/vertuo-omni-loop/commit/c2ca7d31ea501714f54258af913e5adaec9d9c35), [63ad5db (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/63ad5db6c203a01747c1156154a4a3793118e123), [8756007 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/87560077e045addabf9f965188f7b9430a540f26), [`apps/galaxy/src/ask/page/AskSession.tsx` lines 41-41, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/b974bb6a3c1dcfc13a6f36593556ced2e4192cfd/apps/galaxy/src/ask/page/AskSession.tsx#L41-L41)

### F12 · The store fake was rewritten in three slices — `churn:apps/galaxy/src/ask/store.fake.ts:12-15`

- **What happened:** Lines 12-15 of `apps/galaxy/src/ask/store.fake.ts`, as merged, were written and rewritten in 3 commits, in s1, s3 and s4; the rules flag a line range rewritten in 3 or more commits.
- **Why it matters:** The first, third and fourth slices each rewrote these lines of `store.fake.ts`, mirroring the churn in the API module. Every change to the data shape had to be repeated in the fake.
- **Proposed lesson:** Build the fake from the same shared type as the real store, so shape changes happen in one place.
- **Evidence:** [0bbadf1 (s1)](https://github.com/vertuoza/vertuo-omni-loop/commit/0bbadf11b21dc7fa37587db31c69b9166a868ed7), [f290f49 (s3)](https://github.com/vertuoza/vertuo-omni-loop/commit/f290f4959a69a96dee9e2a5bc2e7fbe74dc196cd), [a5def29 (s4)](https://github.com/vertuoza/vertuo-omni-loop/commit/a5def299ebd98b012ce96ca9bb028e264fdb3b67), [`apps/galaxy/src/ask/store.fake.ts` lines 12-15, as merged](https://github.com/vertuoza/vertuo-omni-loop/blob/b974bb6a3c1dcfc13a6f36593556ced2e4192cfd/apps/galaxy/src/ask/store.fake.ts#L12-L15)

### F13 · The last slice took far longer than the others — `slow-slice:s5`

- **What happened:** Slice s5 took 904 minutes from its claim to its merge, against a median of 16 minutes; the rules flag a slice slower than 3 times the median.
- **Why it matters:** The fifth slice took roughly fifteen hours from claim to merge, while the typical slice took about a quarter of an hour. Most of the delivery's elapsed time went to this one slice, and it also rewrote the shared source test again.
- **Proposed lesson:** Check whether the final slice was too large or was blocked, and split or unblock that work sooner.
- **Evidence:** [#192](https://github.com/vertuoza/vertuo-omni-loop/pull/192)

## Proposed lessons

- Define the session and round data shape, with origin and sharing fields, in the first slice, and build the store fake from the same type. (F8, F12, F7)
- Give the ask session page and its component a single owner, or plan them as shared ground, so later slices extend them instead of rewriting them. (F2, F3, F5, F6, F9, F10, F11)
- Settle shared test setup in one slice, so each later slice only adds cases. (F4, F7)
- List cross-cutting modules such as the ask mode module in the plan's shared ground. (F1)
- Watch the final slice's elapsed time and split or unblock it early when it runs well past the others. (F13)

## Timeline

- Feature PR [#147](https://github.com/vertuoza/vertuo-omni-loop/pull/147): opened `2026-09-26T08:57:32Z`, ready `2026-09-27T06:59:15Z`, merged `2026-09-27T08:03:02Z`, 1386 minutes in all.
- 6 slices; waves: 5 planned, 5 as merged; median slice: 16 minutes from its claim to its merge.

| slice | sub-PR | claimed | merged | minutes | wave, planned | wave, as merged |
| --- | --- | --- | --- | --- | --- | --- |
| s1 | [#163](https://github.com/vertuoza/vertuo-omni-loop/pull/163) | `2026-09-26T14:43:16Z` | `2026-09-26T14:57:41Z` | 14 | 1 | 1 |
| s2 | [#167](https://github.com/vertuoza/vertuo-omni-loop/pull/167) | `2026-09-26T14:59:27Z` | `2026-09-26T15:12:44Z` | 13 | 2 | 2 |
| s3 | [#175](https://github.com/vertuoza/vertuo-omni-loop/pull/175) | `2026-09-26T15:13:37Z` | `2026-09-26T15:30:13Z` | 17 | 3 | 3 |
| s4 | [#188](https://github.com/vertuoza/vertuo-omni-loop/pull/188) | `2026-09-26T15:31:01Z` | `2026-09-26T15:52:42Z` | 22 | 4 | 4 |
| s5 | [#192](https://github.com/vertuoza/vertuo-omni-loop/pull/192) | `2026-09-26T15:53:32Z` | `2026-09-27T06:57:38Z` | 904 | 5 | 5 |
| settle | [#206](https://github.com/vertuoza/vertuo-omni-loop/pull/206) | `2026-09-27T05:35:19Z` | `2026-09-27T05:35:38Z` | 0 | — | 5 |

Findings: F13 · The last slice took far longer than the others

## Decisions

- Decisions: 14 raised and settled — 11 adopted, 3 agreed, 0 drifted; by rank: 2 high, 1 human-action, 11 medium.
- The feature PR merged without the override label `omni:outbox-go`.
- Territory: 5 merged sub-PRs graded against the plan — 4 paths outside a slice’s territory; 1 more sub-PR names a slice the plan does not hold.
- Friction: 0 slices stuck, 0 labelled `omni:needs-fix`, 0 claimed more than once.
- Review: 7 pull requests — 0 reviews, 0 review threads, 0 red-circle bot findings, 0 threads unresolved at the merge.

Findings: F1 · First slice edited the ask mode module outside its territory · [#223](https://github.com/vertuoza/vertuo-omni-loop/issues/223); F2 · Third slice edited the session page and its styles outside its territory · [#224](https://github.com/vertuoza/vertuo-omni-loop/issues/224); F3 · Fourth slice also edited the session page outside its territory · [#225](https://github.com/vertuoza/vertuo-omni-loop/issues/225)

## Checks

- 12 runs of 1 check on 12 commits in 4 slices, read from GitHub Actions: 0 red.

| check | runs | red | commits red | slices red | red then green |
| --- | --- | --- | --- | --- | --- |
| check | 12 | 0 | 0 | — | 0 |

## Churn

- 34 commits read across 6 merged pull requests: 5029 lines added, 5021 in the final diff, 57 lines of churn.
- Left out as generated, by `.gitattributes`: `kit/dist/omni.mjs`.
- Left out as the loop's own delivery record: `.omni-loop/delivery/outbox/0144-question-history/s1-01-session-repo-sent-from-mode.md`, `.omni-loop/delivery/outbox/0144-question-history/s1-02-branch-kept-on-the-session.md`, `.omni-loop/delivery/outbox/0144-question-history/s1-03-price-table-values.md`, `.omni-loop/delivery/outbox/0144-question-history/s2-01-sweep-closes-idle-sessions.md`, `.omni-loop/delivery/outbox/0144-question-history/s2-02-session-of-owner-in-no-workspace.md`, `.omni-loop/delivery/outbox/0144-question-history/s2-03-teammate-session-outside-the-tabs.md`, `.omni-loop/delivery/outbox/0144-question-history/s3-01-classifier-model.md`, `.omni-loop/delivery/outbox/0144-question-history/s3-02-model-guess-never-overrides.md`, `.omni-loop/delivery/outbox/0144-question-history/s3-03-chip-names-who-by-role.md`, `.omni-loop/delivery/outbox/0144-question-history/s4-01-teammates-named-by-email.md`, `.omni-loop/delivery/outbox/0144-question-history/s4-02-for-me-count-on-every-page.md`, `.omni-loop/delivery/outbox/0144-question-history/s4-03-share-reply-shape.md`, `.omni-loop/delivery/outbox/0144-question-history/s5-01-history-reads-newest-thousand.md`, `.omni-loop/delivery/outbox/0144-question-history/s5-02-manual-acceptance-with-screenshots.md`, `.omni-loop/delivery/outbox/0144-question-history/settled.md`.

Findings: F4 · The opening lines of `source.test.ts` were rewritten in four slices · [#226](https://github.com/vertuoza/vertuo-omni-loop/issues/226); F5 · One line of the session page was rewritten in three slices · [#227](https://github.com/vertuoza/vertuo-omni-loop/issues/227); F6 · A block of the session page was rewritten in three slices; F7 · An import line in `api.test.ts` changed in three slices; F8 · The same lines of `api.ts` were rewritten in three slices; F9 · Props of `AskSession.tsx` were rewritten in three slices; F10 · Another block of `AskSession.tsx` was rewritten in three slices; F11 · A single line of `AskSession.tsx` was rewritten in three slices; F12 · The store fake was rewritten in three slices

## Rules

Rules version 1; the thresholds this run used:

- A slow slice: more than 3 times the median time from claim to merge.
- A repeated red check: red on 2 or more commits, or in 2 or more slices; any red then green on one commit is flaky.
- A failing test: the same test failing in 2 or more runs.
- Churn: a line range rewritten in 3 or more commits; a file whose churn is at least 50% of its final added lines and at least 40 lines.
- After merge: the `bug` issues naming the PRD within 14 days of the merge.
- At most 5 issues per run, most severe first: bug, override, drift, repeated-red or flaky, failing-test, review, friction, territory, churn, slow-slice.
