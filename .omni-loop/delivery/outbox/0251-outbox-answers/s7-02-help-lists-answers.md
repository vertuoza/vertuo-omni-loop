---
id: s7-02-help-lists-answers
prd: 251
slice: s7
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

The new answering command must appear in the kit's built-in help, but the plan did not give this slice the help file. Should the slice add it anyway?

## The decision, in plain words

Yes. The help lists every command, and its own test fails when one is missing, so the slice added one short entry for the answering command and raised the count by one.

## The intro, for fun

A new command walked in, and the help desk refused to open until it signed the guest book.

## The punchline, for fun

One line in the guest book, and everybody is back to work.

## The options, in plain words

A. Add the help entry in this slice, listed as run by the skills.
B. Add the help entry in this slice, listed as a command a person types.
C. Leave the help to a later slice and keep this one inside its territory, with the suite red until then.

## What I had to decide

The slice's territory names the command table but not the help table, which a test holds to the command table entry for entry. Adding the command without the entry leaves the suite red.

## What I did meanwhile

Added one entry for the answering command to the help table (who runs it: the skills; its two verbs, a summary and a few sentences), and raised the command count its test expects from 29 to 30.

## What it costs to change later

Rewording one help entry, or moving it: a text change, nothing stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the answering command should show under the commands you type yourself rather than under those the skills run: the spec only has /omni:yolo run it.
