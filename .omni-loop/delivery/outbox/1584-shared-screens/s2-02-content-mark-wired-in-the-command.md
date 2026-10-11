---
id: s2-02-content-mark-wired-in-the-command
prd: 1584
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

The new setting that says which part of a mockup is content had to reach the command that runs the word check, and that command sits outside this slice's planned files. Is a one-line change there fine?

## The decision, in plain words

The command now passes the content setting to the word check, with its default when unset. Without it, the setting would be read but never used.

## The intro, for fun

The plan drew the fence one file too short for the new setting.

## The punchline, for fun

So the setting hopped over it, carrying exactly one line.

## The options, in plain words

A. Keep the two-line change in the design command, as built
B. Move where the word check's settings are gathered into the word check itself, in a later change

## What I had to decide

Whether the one-line change to the design command, outside s2's territory, may stay.

## What I did meanwhile

The design command builds the word pass's rules with the content selector read through wordsContent, so design.words.content and its [data-content] default take effect.

## What it costs to change later

Reverting is removing two lines (an import and one field); nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory for s2 did not list kit/bin/commands/design.ts, where the rules are built (author).
