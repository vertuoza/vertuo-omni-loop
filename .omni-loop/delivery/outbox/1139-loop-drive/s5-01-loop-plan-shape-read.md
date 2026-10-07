---
id: s5-01-loop-plan-shape-read
prd: 1139
slice: s5
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

The Loop page draws each loop's plan, but the plan itself is being written by a part built at the same time. Which shape of plan should the page expect?

## The decision, in plain words

The page expects a list of numbered steps, each naming its PRD, its slice or what it runs, the step it waits on and why, and whether it may run beside another. A plan in any other shape is shown as unreadable, while the ledger and parked PRDs still show.

## The intro, for fun

Two teams building a bridge from both banks hope to meet in the middle.

## The punchline, for fun

This item is the chalk line on the river where they agreed to meet.

## The options, in plain words

A. The page reads numbered steps with prd, slice, wave, action, after (prd, slice, reason) and beside, and shows any other shape as unreadable
B. The page waits for the kit's shape and is changed to read whatever s3 pushes
C. The kit pushes a plan already laid out per PRD for display, and the page draws it without reading steps

## What I had to decide

Whether the kit's loop plan should be pushed as `{steps: [{step, prd, slice?, wave?, action?, after?: {prd, slice?, reason}, beside?}]}`, the shape the page reads.

## What I did meanwhile

The page reads that shape; a plan in another shape shows 'This plan cannot be read here.' and nothing else breaks.

## What it costs to change later

A constant: the reader is one zod schema in `apps/galaxy/src/loop/page/view.ts` (`readPlan`); matching another shape changes that schema only, no migration, since the app stores the plan as it came.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) s3 builds `omni next --plan` in the same wave, so its actual JSON could not be read; s3 and s4 should push this shape, or this reader should follow theirs
