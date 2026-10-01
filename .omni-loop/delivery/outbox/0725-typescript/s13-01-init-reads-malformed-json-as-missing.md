---
id: s13-01-init-reads-malformed-json-as-missing
prd: 725
slice: s13
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

When the setup command reads a project file or a tool's answer that has the wrong shape, should it treat it as missing, or stop as it sometimes did before?

## The decision, in plain words

A file or an answer of the wrong shape is now treated exactly like a missing one, so setup carries on with its usual fallback instead of crashing in one rare case.

## The intro, for fun

The setup command opened a box labelled package and found only the word null inside.

## The punchline, for fun

It now shrugs, writes no scripts down, and keeps unpacking.

## The options, in plain words

A. Treat a malformed file or answer as missing, the same fallback as an absent one (built)
B. Bring back the old crash for a project file holding nothing at all, and keep the rest as built
C. Stop init with an error naming the field whenever an outside value has the wrong shape

## What I had to decide

Whether init should keep treating a malformed package.json, composer.json or gh/claude JSON answer as missing (what the slice built), or restore the old crash for the one case that crashed.

## What I did meanwhile

kit/lib/init/schema.ts parses every outside read of init through Zod; a value the schema refuses falls back exactly as an absent file or a failed command does. The one output that changed: a package.json or composer.json whose whole content is JSON `null` used to throw a TypeError out of detectCommands (`null.scripts`); it now reads as no scripts, so every command is null. A gh or claude answer whose fields have the wrong type (never seen from the real tools) now takes the same fallback as gh being unavailable, where before the wrong-typed value was used as is.

## What it costs to change later

A constant: the fallback lives in readScripts in kit/lib/init/detect.ts and in each safeParse/parse call inside an existing try. Restoring the crash is one throw when the parsed file is null.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a bug the types reveal is recorded, not fixed; it does not say whether init's never-throw contract should cover a package.json holding only null, which no real repository is likely to have.
