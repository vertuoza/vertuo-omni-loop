---
id: s14-01-readers-left-moved-to-the-links
prd: 1364
slice: s14
rank: high
bears-on: none
raised: 2026-10-10
wave: 1
---

## The question, in plain words

The old one-product setting was to be removed only once nothing read it, but three parts of the app and several database tests still read it. Should this step fix them, or wait?

## The decision, in plain words

This step moved them all to the new links in the same change: the approve screen now reads the PRD's own product, the business draft reads each repository's only product, and the tests link repositories instead of setting the old value.

## The intro, for fun

The old sign was coming down, but three shops still gave directions by it.

## The punchline, for fun

So we repainted their directions before taking the sign away.

## The options, in plain words

A. Move every reader to the links in this slice, outside its listed files, the option built.
B. Drop nothing yet: leave the column until a separate slice rewrites the readers.
C. Drop the column and leave the readers for a follow-up, accepting a broken approve screen and red database checks in between.

## What I had to decide

Whether the contract landing also rewrites the code that still read the old column, outside the slice's listed files, or stops until another slice does.
Decided by: Jev (hardToRevert 0.46) · agent said false

## What I did meanwhile

Built: the approve screen reads dossiers.product_id, as dossier_approve() does; the business draft reads product_repositories and takes a repository's only product, else the first product as before; the saved repository row no longer has product_id; nine database checks write links instead of the column; the galaxy README says the column is gone.

## What it costs to change later

Reverting the code commit of this slice; no data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a repository in several products should put the draft's evidence on the first product, as built, or on none (author)
- the plan's done-when grep for product_id in the repositories module cannot come back empty: the links table's own column is named product_id (author)
