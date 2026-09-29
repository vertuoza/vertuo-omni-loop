---
id: s3-01-link-attribute-order-tests
prd: 657
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

The new sidebar links write their attributes in a different order, which broke three older page checks that read the marked link a fixed way. May the slice adjust those checks, though they sit outside its own ground?

## The decision, in plain words

The three checks now find the marked link whatever the order of its attributes. What they check did not change: exactly one sidebar entry is marked as the current page.

## The intro, for fun

The links learned manners and now say where they are before saying where they go.

## The punchline, for fun

Three old checks were not ready for such politeness, so they got a little update.

## The options, in plain words

A. Adjust the three checks to read the marker in any attribute order.
B. Keep the sidebar on plain anchors and give up soft navigation.
C. Move the three checks into the slice's territory in the plan and leave them as edited.

## What I had to decide

Whether a slice may adjust tests outside its declared ground when its change only reorders markup.

## What I did meanwhile

The three tests read the current-page marker in any attribute order; the sidebar and app bar use next/link.

## What it costs to change later

Undoing it is reverting three test lines; no product code outside the slice changed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan did not list apps/galaxy/src/switch/headers.test.ts, apps/galaxy/src/switch/render.test.ts or apps/galaxy/src/dossier/page/page.test.ts in s3's territory, because nobody foresaw next/link reordering attributes (author).
- apps/galaxy/src/dossier/page/page.test.ts is inside s5's and s10's neighbourhood; a merge conflict there is possible but small (author).
