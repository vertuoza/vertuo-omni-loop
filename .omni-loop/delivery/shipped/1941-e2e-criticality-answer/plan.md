# Plan: an answer to the e2e criticality question sets the test's level

PRD #1941, its spec beside this plan. The feature branch `feat/e2e-criticality-answer` goes into `main` with `Closes #1941`; each slice is a sub-PR from `feat/e2e-criticality-answer--<slice>` into the feature branch with `Part of #1941`.

## Slices

| id | slice | territory | blocked by | wave |
| --- | --- | --- | --- | --- |
| s1 | `/omni:validate-e2e` drafts the first list of critical flows, records one answerable medium item per candidate test (options A and B, the test file named in backticks), lists them in the e2e sub-PR body and refreshes the outbox comment, and the guide gives the order of the answer | `kit/plugin/skills/validate-e2e/` `docs/guide/validate-e2e.md` `kit/test/plugin.test.ts` | — | 1 |
| s2 | An item written as the skill describes, answered `B`, derives a rework whose whole ground is the test file and whose chosen option is B | `kit/lib/policy/rework.test.ts` | s1 | 2 |

Shared ground: none. s2 waits for s1 only because its test encodes the item shape s1 documents; it shares no path with it.

## Per slice: done when

**s1**
- With no `<e2e.dir>/critical-flows.md`, or one with no flow, the skill's text says to draft it in the e2e sub-PR, one entry per covered flow with an id, a name and what its failure costs, in the format PRD #1737 parses; it says never to edit an existing entry.
- The text says to record one medium item per test that plausibly covers a listed flow, and none for a test that covers no flow.
- That item's options are A (`standard`, as written) and B (`critical` and `flow-<id>`), and its "What it costs to change later" names the test file in backticks and no other path.
- The text says the e2e sub-PR body lists each candidate test, its proposed flow and the reply to give (`<number>: B`), and that the skill refreshes the outbox comment after the items exist.
- The guide says the e2e sub-PR is merged before the answer is given, and why (a rework branches from the feature branch).
- The plugin tests that read the skill and the guide pass, with new ones holding each rule above.

**s2**
- A test builds an item as s1's text describes it, settles it with the answer `B`, and `deriveRework` returns its whole ground as the test file and option B as the chosen option.
- The same item answered `A` derives no rework.
- The test uses no network and no model.
