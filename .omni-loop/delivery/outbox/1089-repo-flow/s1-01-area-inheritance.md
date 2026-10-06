---
id: s1-01-area-inheritance
prd: 1089
slice: s1
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

When a part of the code has its own rules, how does it combine them with the rules for the whole repository, and where do the older 'land alone' paths sit among the named parts?

## The decision, in plain words

A part takes the whole repository's rules and adds its own, always keeping the stricter limit; it may pick its own merge method, and only a part that opts out of inheriting can loosen a limit. The older 'land alone' paths count as one more part, checked after every named one.

## The intro, for fun

Two rulebooks walk into the same folder, and both want the last word.

## The punchline, for fun

The stricter one wins, unless the folder politely asks to be left alone.

## The options, in plain words

A. Keep it: inherited rules combine like rules across areas, the stricter limit wins, and the old 'land alone' paths are checked after the named parts.
B. Let a part's own limits override the inherited ones, so a part can loosen a limit without opting out of everything.
C. Put the old 'land alone' paths first, so they always win over a named part that also matches them.

## What I had to decide

The spec says an area inherits the default area's rules unless it says inherit: false, and how rules combine across a slice's areas, but not how an area's own value meets an inherited one. I took the cross-area rule for inheritance too: the strictest limit, the union of requireChecks, approval and territory: block stick; an area's own merge method and its own replace hook win over the default's. inherit: false also drops the default area's hooks, not only its rules. landings.alone reads as an area named landings.alone placed after the declared areas, so a path a declared area claims follows that area's rules first.

## What I did meanwhile

Built resolveFlow and resolveTerritory that way, with table-driven tests for each case (an inheriting area cannot loosen maxFiles, inherit: false keeps its own rules and no hooks, the landings.alone area comes last).

## What it costs to change later

A constant change in kit/lib/flow/resolve.ts and its tests: letting an area's own limit override the inherited one, keeping default hooks under inherit: false, or putting the landings.alone area first is a few lines, no stored data moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether a person expects an area's own maxFiles to relax the repository's, as a CSS-like override, rather than inherit: false being the only way to loosen one
