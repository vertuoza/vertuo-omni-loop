---
id: s2-01-trade-ids-one-word
prd: 799
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Three trades have two-word names (heating engineer, site foreman, office manager). What short word is stored for each?

## The decision, in plain words

Each trade is stored as one plain lower-case word (heating, foreman, office) while the page shows the full name, so the database check accepts every trade whatever its exact rule.

## The intro, for fun

Some trades needed two words, but the database only takes one.

## The punchline, for fun

So the heating engineer now answers to heating, and the page still says the full name.

## The options, in plain words

A. One word per trade (heating, foreman, office), with the full name as the label.
B. Dashed words (heating-engineer, site-foreman, office-manager), with the database check accepting dashes.

## What I had to decide

Whether stored trades may be two words joined by a dash instead of one word.

## What I did meanwhile

Stored trades are single words; labels carry the full names.

## What it costs to change later

A constant change in the design package before any persona is stored; after that, renaming a stored trade needs a data update.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan says only that a trade is a short lower-case word; the database rule itself is written in s1, built in parallel, so its exact pattern was not known. (author)
