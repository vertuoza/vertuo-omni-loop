---
id: s10-02-other-readers-still-read-the-config-list
prd: 1548
slice: s10
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

The board, next-step, care and flow commands now read a product's repositories, but other places still read only the list written in the config. Is it fine to leave them for later?

## The decision, in plain words

Yes, left as they are: the status line's background board, roadmaps, bug fixes, knowledge copies and the retro still read the written list only, which is empty for a product. The setting itself needed no change: it already exists.

## The intro, for fun

Four rooms got the new address book; the rest of the house still has the old one.

## The punchline, for fun

The old one is blank, so nobody gets lost, they just stay in.

## The options, in plain words

A. Leave them for later, as built.
B. Move the status line's board refresh in this PRD, the others later.
C. Move every reader in this PRD.

## What I had to decide

Whether the readers outside this territory that still read plan.targets only (the status line's buildBoard refresh in kit/bin/commands/statusline.ts, roadmap, bug fix, knowledge copy and retro readers) move to withProductTargets now or in a later slice. The config key plan.product needed no schema entry: PRD 1364 added it.

## What I did meanwhile

Left untouched; with plan: { product } their plan.targets is [] as before this slice, so they read no target. withProductTargets in kit/lib/product/targets.ts is the one call each would need.

## What it costs to change later

A constant per reader: one await withProductTargets where it loads its context.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The status line's refresh builds the board without the product's targets, so in a product plan repository it marks target slices unreadable until it moves. (author)
