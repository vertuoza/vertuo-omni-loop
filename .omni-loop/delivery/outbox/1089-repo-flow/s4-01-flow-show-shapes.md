---
id: s4-01-flow-show-shapes
prd: 1089
slice: s4
rank: medium
bears-on: none
raised: 2026-10-06
wave: 3
---

## The question, in plain words

How does a hook file say what it needs and how it ends, how are the slice's details put into its text, and what counts as a change from the loop's usual way of working?

## The decision, in plain words

A hook may open with a short header block, fenced or as its first lines; the slice's details replace names written in curly braces; its last line must be the verdict for that exact step; and naming the usual merge or the usual report setting is not shown as a change.

## The intro, for fun

A recipe card walks in and asks where to write the oven temperature.

## The punchline, for fun

On top, in braces, and the last line says whether dinner worked.

## The options, in plain words

A. A. Keep it: a fenced or first-paragraph header, {name} inputs, the verdict as the strict last line for that step, squash and report not shown as changes.
B. B. Require a fenced header only, and refuse a hook file without one.
C. C. Accept the verdict line anywhere in the output, the last one found winning, and print each area's own rules only in the differences.

## What I had to decide

Whether the hook file shape, the curly-brace inputs and the strict last-line verdict are the ones the team wants before the skills start following them in a later slice.

## What I did meanwhile

Built omni flow show and omni flow verdict that way, with snapshot tests of the spec's kernel and migrations example, and listed omni flow in the help beside the config guard of omni check.

## What it costs to change later

A constant change in kit/lib/flow/show.ts or kit/lib/flow/verdict.ts and their snapshots: another placeholder syntax, a looser verdict search or counting squash as a change is a few lines; no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names a hook's front matter (omni-hook, inputs, verdict) but not its fence: both a --- block and a first paragraph of key: value lines are read, since the s1 fixture uses the latter.
- (author) The spec says a hook's inputs are filled in but not how a hook names one: {name} is used, as the branch templates do.
- (author) The spec writes not ok <hook> <why>; the verdict command knows only the point, so it prints the point.
- (author) A pass may carry text after pass (wave.merge's merged PR number), printed after ok; the spec does not say what ok prints then.
- (author) The spec's --path <p>… reads one path here; several would need a repeated flag the argument parser does not take.
- (author) Differences from the defaults list each area's rules with what it inherits, so the default area's rules show again under each inheriting area.
