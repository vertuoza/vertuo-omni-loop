---
id: s4-01-other-readers-see-no-targets
prd: 1364
slice: s4
rank: medium
bears-on: none
raised: 2026-10-10
wave: 1
---

## The question, in plain words

When a plan repository names a product instead of listing its targets, should every command that reads the targets ask the server, or only the targets command for now?

## The decision, in plain words

Only the targets command asks the server for now. The other commands that read the targets see an empty list when a product is named, until they are taught to ask the server too.

## The intro, for fun

A plan repository that points at a product has a new phone book, but only one person has the number.

## The punchline, for fun

Everyone else is still flipping through an empty page.

## The options, in plain words

A. Only omni targets reads the server; the other readers see no targets with plan.product until a later slice or PRD teaches them.
B. Add a slice to this PRD that makes every reader take the product's targets through the same read and its last copy.
C. Have the other readers refuse plan.product with one line naming omni targets, until they read the server.

## What I had to decide

Whether the board, the next step, PR care, the flow, roadmaps, bug fixes and knowledge copies read a product's targets from the server in this PRD, or later.

## What I did meanwhile

With plan.product, omni targets prints the product's links; the config parses plan.targets as an empty list, so the other readers (kit/bin/commands/board.ts, next.ts, care.ts, flow.ts, kit/lib/roadmap, kit/lib/bug/fixes.ts, kit/lib/knowledge/copies.ts, kit/lib/plan-repo/copy-flow.ts, apps/omni-app/src/retro/targets.ts) behave as with no targets. A config that keeps plan.targets is untouched.

## What it costs to change later

Teaching each reader is one async read through kit/lib/product/targets.ts per command; none of those files is in s4's territory, and most are synchronous today.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names no slice for the other readers; the spec says 'every reader of the targets (lib/plan-repo/targets.ts and its callers)', whose only caller is omni targets. (author)
