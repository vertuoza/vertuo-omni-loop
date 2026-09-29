---
id: s5-03-status-command-test-outside-territory
prd: 587
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

Changing the words of the terminal summary meant updating the older test of the whole command, which the plan gave to nobody. Is that fine?

## The decision, in plain words

We updated it in this slice, because it pins the summary's exact lines and would fail otherwise.

## The intro, for fun

The plan fenced off the summary, and its oldest test was leaning on the gate.

## The punchline, for fun

We let it in, since it only wanted to read the new words aloud.

## The options, in plain words

A. A. Keep the test change in this slice: the option built.
B. B. Move it to a slice of its own before the feature PR is ready.

## What I had to decide

Whether s5 may change kit/bin/status.test.mjs, outside its territory, when its own done-when changes the overview's lines that test pins.

## What I did meanwhile

kit/bin/status.test.mjs expects the seven-stage count lines, building in place of outbox and PRD in place of in review in your rows, and gains two tests: a feature branch that shipped its folder counts as outbox, and a shipped folder with retro.md as retro.

## What it costs to change later

Reverting one test file, which would then fail against the new overview.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the plan meant another slice to own kit/bin/status.test.mjs
