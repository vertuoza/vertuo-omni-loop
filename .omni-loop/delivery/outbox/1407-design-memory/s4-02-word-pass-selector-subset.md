---
id: s4-02-word-pass-selector-subset
prd: 1407
slice: s4
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

When a team marks its screens and main buttons with its own markup instead of the kit's default markers, how rich can that marking be?

## The decision, in plain words

A team can name screens and main buttons by element type, id, class or attribute, several at once separated by commas, but not by where an element sits inside another. The config refuses anything richer, so a mistake shows up at once.

## The intro, for fun

Everyone wants their buttons found, but nobody wants to learn a new query language.

## The punchline, for fun

Simple names in, no family trees.

## The options, in plain words

A. A. Element type, id, class and attribute tests, comma-separated, with no nesting
B. B. Also allow nesting rules such as one element inside another
C. C. Only attribute names, as the default markers are

## What I had to decide

Whether element type, id, class and attribute (comma-separated) are enough for a team's own markers, or whether nesting rules are needed too.

## What I did meanwhile

The word check reads that simple set; a config with a nesting rule or a hover rule is refused with a message naming the setting.

## What it costs to change later

Widening the accepted set later is an addition to one small reader; nothing stored changes and no config that works today breaks.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No repository using its own markers has been tried yet; the dogfood slice uses the default markers (author)
