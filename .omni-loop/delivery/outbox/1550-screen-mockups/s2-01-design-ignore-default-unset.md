---
id: s2-01-design-ignore-default-unset
prd: 1550
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

Should the setting that leaves tests out of the design check show its default list when someone asks the config for it, or only the list a repository wrote itself?

## The decision, in plain words

The default test shapes apply whenever a repository writes no list of its own, but asking the config for the setting says it is not set until the repository writes one.

## The intro, for fun

A setting with a default that it keeps to itself.

## The punchline, for fun

It works quietly; it just will not say so when asked.

## The options, in plain words

A. Leave the key unset when the file does not name it, and apply the default where it is read (built).
B. Fill the default when the config is read, and update the law's proof in a law change of its own.
C. Fill the default and make omni config print defaults for optional keys in general.

## What I had to decide

Whether design.ignore is filled with its four default globs when the config is read, so omni config design.ignore prints them.

## What I did meanwhile

design.ignore is optional in the schema; kit/lib/design/ignore.ts reads an unset key as the four test globs, and omni config design.ignore prints no key until a repository sets one.

## What it costs to change later

Filling the default is a one-line schema change (a .default), plus updating the design section's expected value in kit/lib/config.test.ts, a law's proof this slice may not touch.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The proof kit/lib/config.test.ts compares the whole parsed design section, so a filled default would turn it red; this slice was told not to edit it (author).
