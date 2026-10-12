---
id: s2-01-governs-is-a-path-pattern-not-a-glob
prd: 1726
slice: s2
rank: medium
bears-on: none
raised: 2026-10-12
wave: 2
---

## The question, in plain words

The list of files a rule governs is written in the same pattern language the flow areas already use, so a wildcard written as two stars is refused; is that the right language?

## The decision, in plain words

Yes: one pattern language for the whole kit, as the spec asks, even though the spec's own examples were written with two-star wildcards.

## The intro, for fun

Two ways to say every file in this folder walked into a kit.

## The punchline, for fun

Only one of them already had a key to the door.

## The options, in plain words

A. Regular expressions, the flow areas' own matcher, a glob refused by omni check knowledge (built).
B. Globs: translate ** and * to a regular expression before matching, the flow areas keeping theirs.
C. Both: a pattern containing ** read as a glob, anything else as a regular expression.

## What I had to decide

Whether a Governs line is read as the flow areas read their paths (a regular expression, such as ^kit/lib/outbox/) or as a glob (kit/lib/outbox/**), the spec asking for both: the flow matcher, and examples written as globs.

## What I did meanwhile

Governs patterns are matched by the flow areas' own resolver (resolveFlow and areaOf), and omni check knowledge refuses any pattern that does not compile as a regular expression, naming it and showing the ^kit/lib/outbox/ shape. The s1 test fixture that wrote kit/lib/advisor/** now writes ^kit/lib/advisor/.

## What it costs to change later

A constant: switching to globs is a translation function in disclose.ts and the check's message; no entry in this repository carries Governs yet, so no data moves. Once s6 writes Governs on 108 entries, a switch would rewrite those lines.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says Governs reuses the flow areas' matcher and also shows kit/lib/outbox/** as an example; the two cannot both hold, since ** does not compile as a regular expression.
- (author) A slice's territory is a list of path prefixes; --slice matches each prefix and every tracked file under it, so a pattern naming one file still meets the slice that owns its folder.
