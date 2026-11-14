---
id: s3-02-review-not-runnable-yet
prd: 2871
slice: s3
rank: high
bears-on: BR-PRODUCT-139
raised: 2026-11-14
wave: 1
---

## The question, in plain words

A runner still refuses to run the Reviewer's job, and the Omni page still refuses a job that reports the two new endings, because the lists that allow them live outside every slice's ground. Who adds the Reviewer's job and its two endings to those lists before the feature goes ready?

## The decision, in plain words

This slice taught the runner to read the two endings and left the lists alone, so the whole test run stays green. Until a slice adds them, a mission that sends the Reviewer's job would see it refused.

## The intro, for fun

The Reviewer has a desk, a badge and a job title, but the front door still says staff only.

## The punchline, for fun

Someone has to put its name on the list before it can clock in.

## The options, in plain words

A. A slice before ready adds the Reviewer's job and its two endings to the runner's list, the Omni page's lists and the guide (recommended).
B. The supervisor slice widens its ground to take the same change.
C. Ship as built: the Reviewer's job is refused until a later PRD adds it.

## What I had to decide

Add a slice before ready (A, recommended) whose ground holds the runner's list of skills it runs, the Omni page's copy of that list and of the endings it accepts, and the guide's runner page; or fold the change into the supervisor slice (B); or ship without it (C).

## What I did meanwhile

Nothing sends the Reviewer's job yet: the supervisor that sends it is a later slice. A runner reads the two endings already, and when the page refuses a report for its ending the runner sends it again without the ending, so a job still ends done.

## What it costs to change later

Without the lists, the first mission that hands a PR to the Reviewer sees that job refused, and a mission never sends a failed PRD again, so each such PRD waits for a person to take it to ready by hand.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gives no slice the runner's list of skills it runs, the Omni page's list of runner skills, its report's list of endings or the guide's runner page (author).
- Adding the Reviewer's skill to the runner's list alone turns the page's own tests red, since they hold the two lists equal (author).
