---
id: s1-03-fleet-key-from-label
prd: 400
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

How is a new fleet's permanent key made from the name its owner types?

## The decision, in plain words

The typed name is lowercased with dashes for anything that is not a letter or a digit, like c-i-a for the spy fleet. When that key is already used, even by a retired fleet, a number is added, like beaver-2.

## The intro, for fun

Two fleets both want to be called Beaver.

## The punchline, for fun

The second one gets a number, like a sequel nobody asked for.

## The options, in plain words

A. Lowercase with dashes and a counter when taken, as built.
B. A random short code, so a key never echoes the label at all.
C. Lowercase with dashes, and refuse a label whose key is taken instead of numbering it.

## What I had to decide

The rule that turns a fleet's label into its key, which never changes once made.

## What I did meanwhile

Lowercase, dashes for anything else, a counter when taken; keys already made stay as they are whatever rule comes later.

## What it costs to change later

A few lines in one function; existing keys never move.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a key should ever be longer than the twelve characters a label allows, plus its number (author)
