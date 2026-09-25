---
id: s10-01-reworks-driven-by-yolo-fix
prd: 7
slice: s10
rank: medium
bears-on: none
raised: 2026-09-25
wave: 6
---

## The question, in plain words

When a person's answers mean some built decisions must be redone, should the fix step run that rework itself, or should the wave step be taught to run rework work too?

## The decision, in plain words

The fix step runs the rework itself, following the same claim, build and merge steps the wave step uses, because the wave step only knows the slices written in the plan.

## The options, in plain words

A. The fix step applies the wave step's claim, build and merge steps to the rework rows itself.
B. Teach the wave step and the board to take rework rows, and have the fix step invoke the wave step.
C. Write the reworks into the plan as extra slices, so the ordinary wave step picks them up.

## What I had to decide

Whether /omni:yolo-fix drives its rework slices by applying /omni:wave's steps 2 to 5 to the rows `omni rework plan --json` returns, or whether /omni:wave (or `omni board`) should learn to take a rework plan so the fix skill can simply invoke it, as upstream invoked its parallel-wave skill with a plan path.

## What I did meanwhile

kit/plugin/skills/yolo-fix/SKILL.md step 5 claims each rework through /omni:pr, dispatches one worktree subagent per rework with the item's brief, and merges and checks each wave exactly as /omni:wave sections 4 and 5 do, reading territory from each rework row.

## What it costs to change later

Prose only: rewrite step 5 of kit/plugin/skills/yolo-fix/SKILL.md to invoke /omni:wave once that skill (and `omni board`) accept rework rows; no stored shape changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether `omni board` should grow a rework mode was not explored (author).
