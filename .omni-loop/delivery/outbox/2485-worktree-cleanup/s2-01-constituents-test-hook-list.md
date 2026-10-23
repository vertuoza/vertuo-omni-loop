---
id: s2-01-constituents-test-hook-list
prd: 2485
slice: s2
rank: medium
bears-on: none
raised: 2026-10-23
wave: 2
---

## The question, in plain words

The session-start hook list gained a worktree line, and the test that copies that list still expects the old three. Should the test list the new line too?

## The decision, in plain words

The slice adds one session-start line, and the test that copies the hook list sits outside its territory, so it was left alone. Until that test follows, the full test run stays red on that one test.

## The intro, for fun

Two lists that were meant to match have drifted apart by one line.

## The punchline, for fun

One line of expected data is all that separates them.

## The options, in plain words

A. A. Update the constituents test expectation to include the worktree hint entry (what the slice would do next).
B. B. Keep the hook and leave the constituents test pinned to three entries, accepting a red test on the feature branch.

## What I had to decide

Add the worktree hint entry to the expected SessionStart list in kit/bin/constituents.test.ts, matching the fourth entry in kit/plugin/hooks/hooks.json.

## What I did meanwhile

The sub-PR stays draft with the preflight red on this one test. Everything else in the slice is green.

## What it costs to change later

One expected entry in one test file, outside this slice's territory.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the constituents test is meant to mirror every session-start line, or only the constituents one.
