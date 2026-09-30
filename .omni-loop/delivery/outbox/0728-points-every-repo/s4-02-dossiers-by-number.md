---
id: s4-02-dossiers-by-number
prd: 728
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

A planet's dossier is still looked up by its number in the main planning repository only. What should a planet from another repository show?

## The decision, in plain words

The arcade looks a dossier up by repository and number first, and by number alone only when no other planet shares that number, so a twin never shows the wrong dossier. Other repositories' planets show no dossier until the reading side names the repository too.

## The intro, for fun

Two planets numbered 88 each reached for the same folder.

## The punchline, for fun

The arcade now checks the name on the tab before handing it over.

## The options, in plain words

A. A. Key first, number only when unambiguous, as built: twins show none, other repositories show none.
B. B. Always fall back to the number: every planet shows a dossier, twins may show the wrong one.
C. C. Widen this slice to the reading side and the stored dossier list, so every repository's planets show their own dossier now.

## What I had to decide

How the planet's DOSSIER tab and START find a dossier when data/dossiers.ts (outside this slice) still reads only the plan repository's dossiers, keyed by PRD number. The same number-only match lives in dossier_list's regions and its test fake (apps/galaxy/src/dossier/store.fake.ts), which also prefix the org onto region names that now already carry it.

## What I did meanwhile

dossierOf and dossierLink take the planet: key <home>#<n> first, the number only when no other planet in the galaxy holds it. DossiersRead accepts either key, so readDossiers keeps working unchanged.

## What it costs to change later

readDossiers keying its map by <home>#<n> and reading every tracked repository's dossiers; dossier_list's regions matching the home column and no longer prefixing the org. Neither touches stored rows.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a follow-up slice or a bug fix should carry the readDossiers and dossier_list change
