---
id: s4-04-four-test-files-past-the-fence
prd: 487
slice: s4
rank: medium
bears-on: none
raised: 2026-09-28
wave: 3
---

## The question, in plain words

Now that a retro nobody could judge opens no pull request, four older tests outside this slice's files fail because they expected one. Should the slice change them?

## The decision, in plain words

Yes, as little as possible: two tests now give the retro a stand-in judge that keeps every finding, one test expects the comment instead of the pull request, and the recorded replay of an older feature expects the comment and reads its counts from the retro's own step.

## The intro, for fun

The new rule was polite to everyone except four old tests.

## The punchline, for fun

They got a stand-in judge and a new script.

## The options, in plain words

A. Change the four tests as little as the new rule needs, with a shared stand-in judge; the option built.
B. Leave them failing and raise a follow-up slice that owns them.

## What I had to decide

The plan's territory for this slice is the retro's retro, issues, render and publish files, the retro scenario, the replay helper and the fixtures. Four test files outside it ran the whole retro without a model key and expected a retro PR, which the spec now forbids.

## What I did meanwhile

Changed outside the territory: `src/retro/kinds/churn.test.mjs` and `src/retro/kinds/ci.test.mjs` (the retro built with the scenario's stubbed judge), `src/retro/narrate.test.mjs` (a 500 now ends in the "not judged" comment; the stubbed reply keeps its finding so the file is still written), and `test/prd-50.test.mjs` (the verdict comment and its golden instead of retro.md, the timeline read from the step "facts"). `createRetro` gained a `fetch` dependency so a test hands the judge in without stubbing globals. PRD 50's `retro.golden.md` was replaced by `verdict.golden.md`, and its recording gained the knowledge reads.

## What it costs to change later

A constant: each change is a test's expectation or its setup, with no product code outside the territory.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan meant these tests to move with the slice; it names only the retro's own test file.
