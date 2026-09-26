---
id: s1-02-rename-reach
prd: 68
slice: s1
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

The rename touched three small test helpers the slice was not given, and left two places on the old word: a list of game words the jokes must avoid, and this project's own filled-in forms. Is that the right line to draw?

## The decision, in plain words

The three helpers now use the new word, while the game-word list and this project's own forms keep the old one. The forms still read fine, and the checker warns on each old spelling until someone reruns the fill.

## The intro, for fun

Renaming a street is easy. Getting every letterbox to agree takes longer.

## The punchline, for fun

The post still arrives; the checker just sighs at each old sign.

## The options, in plain words

A. Rename the three helpers, keep the game-word list and this project's own forms as they are (what was built).
B. Also rewrite this project's own forms to the new spelling in this slice.
C. Keep the three helpers on the old spelling too, and stay strictly inside the slice's files.

## What I had to decide

Whether this project's own forms should be rewritten to the new spelling now, and whether the game-word list should drop the old word.

## What I did meanwhile

The checker prints one warning per old spelling in this project's own forms and still passes.

## What it costs to change later

Low: rewriting the forms is a search and replace in one folder; the helper renames are one line each.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a later run of the fill skill on this project is planned to rewrite the forms (author).
