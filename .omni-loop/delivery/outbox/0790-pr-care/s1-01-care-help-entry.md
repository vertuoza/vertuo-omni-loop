---
id: s1-01-care-help-entry
prd: 790
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

The new PR care command needs a line in the built-in help, but the help belongs to a later part of this work. Should this part write it now?

## The decision, in plain words

We wrote the help line for the new command now, because every command must have one for the checks to pass. The later part that adds the PR care skill builds on it.

## The intro, for fun

A new command walked in without a name tag.

## The punchline, for fun

So we printed one at the door rather than keep it waiting outside.

## The options, in plain words

A. Add the command's help entry in s1, the option built.
B. Leave the help line to the later part, and accept failing checks on the feature until then.

## What I had to decide

Whether slice s1 may add the `care` command's help entry in kit/lib/help (s5's territory), since the help test fails for any command without one.

## What I did meanwhile

s1 adds one command entry to kit/lib/help/entries.mjs and bumps the command count from 36 to 37 in entries.test.mjs; s5 adds the skill entry on top.

## What it costs to change later

One help entry and a counter in a test; undone by moving the entry into s5.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether s5 wants to reword the command's help text (author)
