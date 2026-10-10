---
id: s5-01-two-files-outside-the-territory
prd: 1364
slice: s5
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

The two new product commands needed two small changes in files outside the area agreed for this piece of work. Is that all right?

## The decision, in plain words

The two new calls to the Omni page sit beside the other calls in the kit's shared page client, as the targets call already does, and the help table's own test now counts one more command.

## The intro, for fun

Two new commands moved in, and both needed a key to the shared front door.

## The punchline, for fun

One key cut, one name added to the doorbell list.

## The options, in plain words

A. A. Keep both calls on the shared Omni page client and count the new command in the help test.
B. B. Move the product calls into the kit's product module with their own signed-in request.
C. C. Give the shared client one general signed-in call and build the product calls on it.

## What I had to decide

Whether importProductTargets and readProductsOf stay on the shared ask client (kit/lib/ask/client.ts), and whether the command count in kit/lib/help/entries.test.ts moves from 51 to 52 in this slice.
Decided by: Jev (hardToRevert 0.46) · agent said false

## What I did meanwhile

kit/lib/ask/client.ts gains importProductTargets (POST /api/products/import) and readProductsOf (GET /api/products/which), beside readProductTargets from s4 (item s4-03, adopted). kit/lib/help/entries.test.ts counts 52 commands: the help guard fails on any new command without it.

## What it costs to change later

A few lines: the calls move with one import change in kit/bin/commands/product.ts; the count is a constant.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names neither file in s5's territory; s4-03 settled the client for the read, and its gap already foresaw the write.
