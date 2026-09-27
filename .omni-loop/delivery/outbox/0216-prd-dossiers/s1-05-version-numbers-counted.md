---
id: s1-05-version-numbers-counted
prd: 216
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

Versions show as v1, v2 and v3, but the spec's tables hold no version number. Should the number be stored, or counted from the order the versions were added?

## The decision, in plain words

It is counted: a version's number is its place among the versions of its kind, by the time it was added. Each version is timed as it is written, after the dossier is locked, so the newest is always the last added.

## The intro, for fun

Every version wanted a number on its shirt, and nobody had printed any.

## The punchline, for fun

They now line up by arrival and count off.

## The options, in plain words

A. Count each version's place among its kind, by the time it was added
B. Store a number on each version, unique for its dossier and kind

## What I had to decide

Store a number on each version, or count them.

## What I did meanwhile

A push answers each added version's number by counting, and the page slices can count the same way.

## What it costs to change later

Storing a number later is one additive migration, filled from the same order.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- None beyond the spec: two versions of one kind are never added at the same moment, since a push holds the dossier's lock (author).
