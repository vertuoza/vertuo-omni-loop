---
id: s3-03-reviewer-hand-off-lines
prd: 2871
slice: s3
rank: medium
bears-on: none
raised: 2026-11-14
wave: 1
---

## The question, in plain words

The spec names the two new endings, waiting for the Reviewer and changes asked, but not the last line a job prints for each. Which lines should the runner read?

## The decision, in plain words

The same rule as the other build endings: a job ends on the next command to run. A PR left for the Reviewer ends on the Reviewer's command, and changes asked end on the fix's command sent for review; a pass the Reviewer marked ready ends on the usual care command.

## The intro, for fun

Every job leaves a sticky note on the fridge saying who cooks next.

## The punchline, for fun

The Reviewer's notes now use the same fridge.

## The options, in plain words

A. The next command to run, as the other build endings do (built).
B. An Outcome word line of its own for each ending, as a bug fix prints.

## What I had to decide

Keep the next-command lines (A), or give the two endings an Outcome word line of their own, as a bug fix does (B).

## What I did meanwhile

The two later slices that write the Reviewer's skill and the build sent for review end on these lines: `/omni:review <n>` reads review; `/omni:yolo-fix <n> --for-review` and `/omni:ultra-yolo-fix <n> --for-review` read changes; `/omni:pr-care <n>` reads ready.

## What it costs to change later

Changing them later is a change to one table of the runner and the lines two skills print; no stored data holds the lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- In round 2 the Reviewer's changes still print the fix's command, though the mission then waits on a person instead of sending it: the line is what a person would run to settle the findings (author).
