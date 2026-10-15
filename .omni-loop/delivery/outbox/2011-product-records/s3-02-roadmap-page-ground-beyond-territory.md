---
id: s3-02-roadmap-page-ground-beyond-territory
prd: 2011
slice: s3
rank: medium
bears-on: none
raised: 2026-10-15
wave: 3
---

## The question, in plain words

To show a roadmap born on the server, a few shared files outside the slice's listed ground had to change. Is that acceptable, or should they be a slice of their own?

## The decision, in plain words

The roadmap reads, the Gantt, the approval check, the seal drawing and the dossier page's redirect were adjusted so that a roadmap with no repository and no issue, and a product's PRD id, read and draw correctly. Each change is small and keeps every existing test.

## The intro, for fun

The page needed a new door, and the walls had a few extra hinges.

## The punchline, for fun

Same house, a handful of hinges moved.

## The options, in plain words

A. A. Make the small changes in place and test them (as built)
B. B. Move them into a separate preparatory slice
C. C. Copy the shared code into the slice's own folders

## What I had to decide

Change the roadmap reads and the approval check outside the listed folders, keeping each change minimal and covered by tests, rather than stop the slice.

## What I did meanwhile

Every existing test passes unchanged except where a signature gained a nullable field; the seal drawing and the approval judgement are now shared with the PRD page instead of copied.

## What it costs to change later

Moving the changes into a slice of their own is a rebase of a few files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan lists three folders for this slice and the roadmap reads sit in a fourth.
