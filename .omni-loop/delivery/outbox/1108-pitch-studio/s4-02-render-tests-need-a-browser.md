---
id: s4-02-render-tests-need-a-browser
prd: 1108
slice: s4
rank: medium
bears-on: none
raised: 2026-10-06
wave: 2
---

## The question, in plain words

The tests that compare the video's frames with reference images need a browser. Should the automatic checks on pull requests install one so they always run?

## The decision, in plain words

These tests run wherever the browser is installed, as on a developer's computer, and are skipped where it is not, as on the automatic checks today, like the older pitch slide tests already are.

## The intro, for fun

A screen test is hard to pass when nobody brought a screen.

## The punchline, for fun

So the test waits politely for a machine that has one.

## The options, in plain words

A. A. Run them where the browser is installed and skip them elsewhere, as the older slide tests do (built).
B. B. Install the browser in the automatic checks so they always run.
C. C. Make them fail where no browser is installed.

## What I had to decide

Whether the automatic checks should install the browser so the frame comparisons run on every pull request, at the price of a slower check.

## What I did meanwhile

The frame comparisons and the two-looks colour test run on any computer with the browser installed, and the automatic checks skip them while still running the engine's other tests.

## What it costs to change later

One install step in the checks' workflow, a minute or so on each run; no code changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the checks' machines draw text close enough to a developer's computer to stay within the tolerance was not measured: the tests load their own fonts to keep that gap small.
