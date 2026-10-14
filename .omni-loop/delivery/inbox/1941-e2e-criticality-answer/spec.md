---
prd: 1941
title: An answer to the e2e criticality question sets the test's level
blocked-by: [1737]
spec: file
phase0: server
---

## Problem

PRD #1737 gave every e2e test a level, `critical` or `standard`, written as tags (`critical`,
`flow-<id>`) on the test file. Run by hand, `/omni:validate-e2e` asks the person which flow a test
covers. Run after `/omni:yolo`, nothing can be asked, so it writes `standard` and records one
medium outbox item with the question.

That item does not work as an answer channel:

- A medium item is adopted at the end of each wave, so it reaches the person as a collapsed
  "adopted" question, never as an open one, and the gate does not turn red on it.
- It offers no option B, and its "What it costs to change later" names no file. `omni rework plan`
  reads the paths in backticks of that field as the rework's ground; with none, and with `--slice
  e2e` naming no plan slice, the rework has no ground and `/omni:yolo-fix` will not build it.
- It is raised only when a flow list exists, and nobody has written one. A repository starting with
  e2e has to write `<e2e.dir>/critical-flows.md` by hand before any question can mean anything.

So an answer never changes a test's tags, and a person edits them by hand.

## Solution

Change the text of `/omni:validate-e2e` (its step 5b, the `/omni:yolo` case) and its guide page. No
code of the kit changes.

1. **A first list is drafted.** When `<e2e.dir>/critical-flows.md` is absent or holds no flow, the
   skill drafts it in the same sub-PR as the tests: one entry per business flow the tests cover,
   each with an id, a name and what its failure costs, in the format PRD #1737 parses. The person
   reads it in the sub-PR; merging it is the review the guide already asks for. An existing entry is
   never edited by the skill.
2. **One item per candidate test.** For each test that plausibly covers a flow of the list, the skill
   records one medium item with `omni item new` (`--slice e2e`). A test that covers no flow gets no
   item and stays `standard`.
3. **The item can be answered.** Its options are A, `standard` as written, and B, `critical` with
   the flow's tag `flow-<id>`. Its "What it costs to change later" names the test file in backticks,
   and only that file, so a rework's ground is exactly that file.
4. **The question is seen.** The body of the e2e sub-PR lists each candidate test, its proposed flow
   and how to answer (`<number>: B`), the number being the one the outbox comment gives its item.
   The skill refreshes the outbox comment once its items exist, so the numbers exist when the
   person reads the sub-PR.
5. **The answer changes the level.** After the e2e sub-PR is merged into the feature branch, the
   person answers `<number>: B` on the feature PR and runs `/omni:yolo-fix`. Its rework adds `critical`
   and `flow-<id>` to the named test file, and `omni e2e status` then validates the result.
6. **The order is written down.** The guide says the e2e sub-PR is merged before the answer is given:
   a rework branches from the feature branch and can edit only a file that is on it.

## Decisions

- The item stays `medium`. The kit picks a rank from the decision, and changing a level is easy to
  undo, so it is not declared hard to revert to force `high`. A person who wants the question asked
  at the end of the build answers it from the sub-PR list instead.
- The skill drafts the list, and the brainstorm does not. At brainstorm time no test exists, so the
  covered flows are not known; and a change to the brainstorm would reach every PRD, not only those
  with e2e.
- One item per candidate test, not one per run: a rework is derived per drifted item, and one item
  per run would turn a free-text answer into a guess about which tests it means.
- The file path goes in backticks, because `namedPaths` reads exactly that.
- No change to `/omni:yolo`, `/omni:yolo-fix`, `omni adopt` or `omni rework plan`: the existing
  rework path already does the job once the item is well formed. The integration test proves it.

## User stories

- As a QA engineer starting e2e on a product, I get a first list of critical flows to review in a
  pull request, instead of writing the file from nothing.
- As a QA engineer, I answer `B` on a question numbered in the pull request and the test becomes
  `critical` with its flow, without editing its tags.
- As a QA engineer, a test that covers no listed flow is not asked about.
- As a reviewer, I see in the e2e sub-PR which tests are candidates and how to answer.

## Scope

In: `kit/plugin/skills/validate-e2e/SKILL.md` (step 5b and the sub-PR body of step 9),
`docs/guide/validate-e2e.md`, `kit/test/plugin.test.ts`, and an integration test in
`kit/lib/policy/rework.test.ts`.

Out: the kit's rank policy, `omni adopt`, `omni rework plan`, `omni replies`, `/omni:yolo`,
`/omni:yolo-fix`, `/omni:brainstorm`, the CI jobs that run each level (PRD #1277), and any change to
an existing `critical-flows.md` entry.

## Test seams

- The plugin test reads `SKILL.md` and the guide as text, as the 1737 tests do: it holds the rules
  the skill must carry (draft the list, one item per candidate, options A and B, the path in
  backticks, the sub-PR list, the refresh, the order).
- The integration test in `rework.test.ts` builds an item the way the skill's rules describe it,
  settles it with an answer `B`, derives the rework and reads its ground and chosen option. It uses
  no network and no model.
- `omni e2e status` is covered by PRD #1737's tests; this PRD adds none there.

## Risks

- The skill's behaviour (what it drafts, which tests it asks about) is judged by its text and by a
  person, not by a test; a model may draft a poor list. The list is reviewed in a pull request
  before it counts, and the skill never edits an existing entry.
- The rework works only if its ground is the test file. A path outside backticks is not read, and
  the integration test fails if the skill's documented shape drifts.
- Publishing: a change to the text of a skill and a guide page. Rollback is reverting the pull
  request; a `critical-flows.md` or a tag already written in a product stays and stays valid under
  PRD #1737's checks.

## Acceptance criteria

- With no `critical-flows.md`, the skill's text says to draft it in the e2e sub-PR, one entry per
  covered flow with id, name and cost, and never to edit an existing entry.
- The skill's text says to record one medium item per test that plausibly covers a listed flow, and
  none for a test that covers no flow.
- That item's options are A (`standard`) and B (`critical` and `flow-<id>`), and its cost section
  names the test file in backticks and no other path.
- The e2e sub-PR body lists each candidate test, its flow and the reply to give, and the skill
  refreshes the outbox comment after recording the items.
- The guide says the e2e sub-PR is merged before the answer is given, and why.
- For an item written as the skill describes and answered `B`, `deriveRework` returns the test file
  as its whole territory and option B as the chosen option.
- The plugin test and the integration test pass, and `pnpm lint` and `pnpm typecheck` are green.
