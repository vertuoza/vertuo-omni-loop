---
id: s1-01-arcade-keeps-erasable-syntax-off
prd: 725
slice: s1
rank: medium
bears-on: none
raised: 2026-10-01
wave: 1
---

## The question, in plain words

About 25 files of the web app use code the new strict rule forbids, the rule that keeps only what Node can simply strip. Should the web app keep that one rule off for now?

## The decision, in plain words

The web app keeps that one rule off until a later slice clears its files. It is built by its own bundler, not run by Node directly, so nothing breaks meanwhile.

## The intro, for fun

Twenty-five files wrote their class fields the short way, and the new rulebook frowns at it.

## The punchline, for fun

The rulebook got a sticky note instead of a bonfire.

## The options, in plain words

A. A: the web app keeps the strip-only rule off for now; the final tightening slice turns it on once the web app slices rewrite those files
B. B: leave it off in the web app for good, since its own bundler compiles it and Node never strips it
C. C: rewrite the 25 web app files in a slice of their own before the final tightening, then turn the rule on

## What I had to decide

Whether the arcade must also forbid non-erasable syntax, and which slice clears its 25 files using parameter properties.

## What I did meanwhile

apps/galaxy/tsconfig.json sets erasableSyntaxOnly to false beside noUncheckedIndexedAccess false; the root project and the base config keep it on.

## What it costs to change later

One line in apps/galaxy/tsconfig.json to remove, and 25 arcade files (classes with parameter properties, mostly test stubs and stores) rewritten to declare their fields: a mechanical change in the arcade slices (s24 to s28) or the ratchet (s29).

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's ratchet slice (s29) names only noUncheckedIndexedAccess for the arcade; who turns erasableSyntaxOnly on there is not planned (author)
