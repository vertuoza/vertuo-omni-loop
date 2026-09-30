---
id: s1-05-scripts-test-outside-territory
prd: 728
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

This part changed a test file that the plan did not hand it. Is that acceptable?

## The decision, in plain words

Yes: the test runs the scoring command this part changed, so it had to learn the new reading. Only that one test's expectations moved.

## The intro, for fun

The fence said stay in the garden; the hose reached the neighbour's tulips.

## The punchline, for fun

Only the tulips that were already thirsty.

## The options, in plain words

A. Keep the change in this slice, the option built.
B. Move it to a follow-up slice, leaving the suite red in between.

## What I had to decide

Whether the end-to-end test of the game scripts may change in this slice. The plan gives this slice the project command but not its test file.

## What I did meanwhile

The test now seeds a tracked and an untracked repository, expects the tracked one to be read and the untracked one never, and expects the new row named by its home. The other six script tests are untouched.

## What it costs to change later

None: the edit is the test of code this slice owns.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) no later slice lists that test file, so nobody else would have updated it
