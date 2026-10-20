---
id: s2-01-s2-export-kit-template
prd: 2239
slice: s2
rank: medium
bears-on: none
raised: 2026-10-20
wave: 2
---

## The question, in plain words

The loader of the kit's built-in files had to let the new command ask for the page skeleton by its path, and that loader sits outside this slice's list of files. Is that small addition acceptable?

## The decision, in plain words

We added one small function to the loader that already serves the playbook templates, so the new command can read the page skeleton in the built kit as well as from source.

## The intro, for fun

The skeleton was in the building, but the key was in another room.

## The punchline, for fun

One tiny doorway, cut where the other doors already are.

## The options, in plain words

A. A. Keep the small general-purpose export in the existing loader (what was built).
B. B. Give the loader a reader made only for the page skeleton, and drop the general-purpose export.

## What I had to decide

Added `kitTemplate(path)` to `kit/lib/playbook/templates.ts`, a one-line export of the existing private `templateText`. The slice's territory names the skeleton folder and the command but not this loader, and the bundle's templates are private to that file, so there was no other way to read `before-after/page.html` from `kit/dist`. A different answer undoes it by deleting the export and passing the text in.

## What I did meanwhile

The new command reads the skeleton through the export; no behaviour of the playbook templates changes.

## What it costs to change later

One exported function in a file outside the slice's territory; nothing to migrate if reversed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person prefers a dedicated reader for the skeleton over the generic export (author)
