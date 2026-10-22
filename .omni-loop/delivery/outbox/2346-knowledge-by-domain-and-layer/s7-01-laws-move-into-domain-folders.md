---
id: s7-01-laws-move-into-domain-folders
prd: 2346
slice: s7
rank: high
bears-on: none
raised: 2026-10-22
wave: 5
---

## The question, in plain words

Every locked law now sits in the folder of the area it protects, with its number and its words unchanged, so an agent working in that area sees it first and no longer sees the laws of other areas. Do you approve the move?

## The decision, in plain words

The twenty locked laws and 53 other rules of the same areas moved into nine area folders, word for word, each marked as moved; 40 design decisions now say which parts of the code they concern.

## The intro, for fun

Twenty laws packed their bags and moved to the neighbourhoods they guard.

## The punchline, for fun

Same words, same numbers, new street names.

## The options, in plain words

A. Move the laws and their areas' rules into nine area folders, and tag the 40 decisions (built).
B. Keep every law in the product list, shown for every file as today, and move only the rules that are not laws.
C. Move nothing yet: keep the map in the config only, and let a person sort the entries into areas later.

## What I had to decide

An owner of the laws (@pierrederval or @dervalp) approves this pull request on GitHub to keep the move, or answers B or C to have it reworked. A law moved into the wrong area would hide it from the agents working where it matters, so check each area's list in the pull request's body.

## What I did meanwhile

The nine areas are declared in the repository's config with no rule and no hook, so planning and merging are unchanged; every moved entry keeps its id, and the check that compares laws with the base branch reads it by that id.

## What it costs to change later

Cheap to undo: reverting the two commits puts every entry back in the product list and the config back as it was; no code reads the area folders by name.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The 40 decision tags were chosen from each decision's title and opening lines (author).
- Two rules stay global because no area holds them yet, BR-PRODUCT-109 and BR-PRODUCT-119 (author).
- Comments in a few tests still name the old product rules file for a law they prove (author).
