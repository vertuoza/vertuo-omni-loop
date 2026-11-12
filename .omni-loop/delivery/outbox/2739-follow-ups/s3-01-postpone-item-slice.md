---
id: s3-01-postpone-item-slice
prd: 2739
slice: s3
rank: medium
bears-on: none
raised: 2026-11-12
wave: 2
---

## The question, in plain words

A question raised while looking after a pull request belongs to no step of the plan, so which step should it be filed under?

## The decision, in plain words

It is filed under its own name for that work, after the last step of the plan, so it never reads as part of a step that is already done.

## The intro, for fun

Every question needs a home, even one born after the plan ended.

## The punchline, for fun

So it got a room of its own, at the end of the hall.

## The options, in plain words

A. File it under its own care name, after the last step of the plan.
B. Ask for the step each time the reply is posted, and refuse without one.
C. File it under the last step of the plan.

## What I had to decide

Every outbox item id needs a slice shaped like `s<n>` (`OutboxItemIdSchema`), but `omni care reply --verdict later` runs on the feature PR, which belongs to no slice of the plan, and the spec names no `--slice` flag. The item is raised on the slice `care-s0` (`POSTPONE_SLICE` in `kit/lib/care/later.ts`), its id `care-s0-<nn>-postpone-<slug>`, and its wave is the plan's last wave (1 when the plan names none).

## What I did meanwhile

Built it so: `care-s0` is one constant, the wave is read from the plan. Nothing parses an item's slice against the plan, so the gate, the settle and the rework read it like any other item.

## What it costs to change later

A constant: changing the slice name or adding a `--slice` flag touches `kit/lib/care/later.ts` and `kit/bin/commands/care.ts`; items already written keep their ids.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the Omni page groups items by slice in a way that would show care-s0 oddly.
