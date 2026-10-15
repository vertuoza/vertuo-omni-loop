---
id: s1-03-roadmap-storage-shape
prd: 2011
slice: s1
rank: medium
bears-on: none
raised: 2026-10-15
wave: 1
---

## The question, in plain words

How is a roadmap born on the server stored, so its number, its rows and its history fit beside what already exists?

## The decision, in plain words

A roadmap born on the server shares the numbering slot a product's PRDs use, counted apart per kind, keeps the old roadmap record beside it for the pages, names each row's PRD in a new text column beside the old number, and keeps each push of its rows, human work and prerequisites as a version.

## The intro, for fun

Two filing cabinets, one new drawer, and nothing thrown out.

## The punchline, for fun

The old drawer keeps working while the new one fills.

## The options, in plain words

A. Keep the shapes as built: one numbering slot counted per kind, the new text column beside the old number, versions as sent
B. Give roadmaps a numbering column of their own, leaving the shared slot to PRDs
C. Replace the old number with the text column later, once every reader has moved

## What I had to decide

Whether these storage choices hold: the roadmap's number in dossiers.product_seq, unique per product and kind; the text column named prd_id, because the integer already holds the name prd; the integer kept in step by a trigger so git-born pushes stay unchanged; and the rows, human work and prerequisites versioned as the JSON the push sent.

## What I did meanwhile

dossiers_product_seq_key is now unique per product, kind and number, so mobile-3 and mobile-R3 coexist; roadmaps keeps one row per roadmap, keyed by its issue or, for a server-born one, by dossier_id, with repo and number null; roadmap_prds.prd_id holds 912 or mobile-12, and prd holds 912 or null; a product roadmap's human work keeps a product PRD's id in its key, its integer prd null.

## What it costs to change later

A constant before s2 writes the first server-born roadmap: renaming a column or moving the number is one follow-up migration while no row uses it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan names the text column roadmap_prds.prd, which the integer already holds (author)
- roadmap_human_work.prd stays an integer, so a product PRD's work is found by its key, not its number (author)
