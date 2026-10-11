---
id: s11-03-the-help-does-not-list-the-new-product-verbs
prd: 1548
slice: s11
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

The terminal's help still lists the product command's two old uses and the multi-repository brainstorm with no product option. Who adds the new uses, and when?

## The decision, in plain words

Not this slice: the help's text belongs to another slice of this PRD, so it was left as it is. The guide slice that comes last, or a small follow-up, adds them.

## The intro, for fun

We taught the command new tricks but the manual is still on the old page.

## The punchline, for fun

The manual's owner gets a sticky note instead of a surprise edit.

## The options, in plain words

A. Leave the help to s13 or a follow-up (built).
B. Add the lines to the help in this slice, outside its territory.
C. Let the help read an entry file that sits beside each command.

## What I had to decide

Name who adds `omni product use <key>` and `omni product phase0 <owner/name>…` to the product entry of kit/lib/help/entries.ts, and `/omni:mega-brainstorm --product <key>` to the mega-brainstorm entry (kit/lib/help/entries.test.ts pins that entry's usage to `/omni:mega-brainstorm` alone): s13, the docs slice, or a follow-up.

## What I did meanwhile

The plan's shared ground gives kit/lib/help/entries.ts to s2 alone, so this slice left it unchanged. The command's own usage line (omni product with no verb, exit 2) names all four verbs, and kit/bin/commands/product-checkout.ts's header describes them.

## What it costs to change later

Two usage lines and a sentence in one entry, and one line in its test; nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan says s11's omni product option goes in its own entry file under kit/bin/commands/product, but the help reads its entries from kit/lib/help/entries.ts only: no entry file elsewhere is read.
