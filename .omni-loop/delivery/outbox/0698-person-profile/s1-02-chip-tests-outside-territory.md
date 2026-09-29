---
id: s1-02-chip-tests-outside-territory
prd: 698
slice: s1
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

Making names and fleets clickable changed how they look in the page's code on the home, workspace, fleet and PRD pages too, so their existing checks had to be updated. Is that fine, and should the fleet page's own title stay unclickable?

## The decision, in plain words

The existing checks on those pages now expect the clickable names and fleets, with nothing else changed on them. The fleet page's own title stays plain, since it would only lead back to the same page.

## The intro, for fun

One small click for a chip, a handful of rewritten expectations elsewhere.

## The punchline, for fun

The fleet page's title declined the promotion: linking to itself felt a bit vain.

## The options, in plain words

A. Keep: checks updated, fleet page title plain
B. Keep the checks, but make the fleet page title a link too

## What I had to decide

Whether updating those checks outside the slice's planned area is accepted, and whether the fleet page's title should link to itself.

## What I did meanwhile

Four check files outside the planned area expect the new links; the fleet page's title stays plain.

## What it costs to change later

Drop one setting on the fleet page's title to make it a link; the check updates follow the chips either way.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s1 did not list the home, workspace board, fleet-of-home and PRD page check files, whose chips now link by design (author)
