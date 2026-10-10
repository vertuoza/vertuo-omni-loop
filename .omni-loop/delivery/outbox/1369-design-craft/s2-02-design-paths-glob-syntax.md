---
id: s2-02-design-paths-glob-syntax
prd: 1369
slice: s2
rank: medium
bears-on: none
raised: 2026-10-10
wave: 2
---

## The question, in plain words

Which pattern syntax should the list of screen locations accept?

## The decision, in plain words

It accepts the usual star, double star, question mark and either-or braces; a plain folder name means everything under it; square brackets are taken as written, so folders named with brackets match as they are.

## The intro, for fun

Every tool has its own dialect of wildcards, and each thinks its own has no accent.

## The punchline, for fun

This one speaks the common phrases and leaves the slang at the door.

## The options, in plain words

A. A. The common subset, brackets literal, a bare name as a folder (built)
B. B. Full glob syntax, with character classes and negation
C. C. Regular expressions, as the landings section uses

## What I had to decide

Whether design.paths needs character classes or negation, or the common subset is enough.

## What I did meanwhile

kit/lib/design/glob.ts matches *, **, ?, {a,b}; a pattern ending in / or with no wildcard is a folder prefix; [ and ] are literal.

## What it costs to change later

A constant: a wider syntax is an added branch in kit/lib/design/glob.ts; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says design.paths is a list of globs without naming the dialect (author).
