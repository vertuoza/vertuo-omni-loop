---
id: s2-02-init-shows-the-sign-in-line
prd: 459
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The setup command's sign-in step has to show where the repository goes, but the part of setup that runs that step was not in this slice's ground. Touch it, or leave the line printed only in the sign-in's own output?

## The decision, in plain words

A few lines of the setup command were changed so its sign-in status line is the sign-in's own closing line, printed once. The sign-in's own tests were extended beside it to prove the three lines.

## The intro, for fun

The message was ready, but the envelope belonged to the neighbour.

## The punchline, for fun

We borrowed the envelope and left a note on the door.

## The options, in plain words

A. A. The setup command hands the sign-in's closing line to its status block, so it is printed once, in the step's own place.
B. B. Leave setup untouched: the sign-in prints its line while setup runs, and setup's status line still says only who signed in.

## What I had to decide

Whether the small change to the setup command stands, or setup goes back to printing its old status line under the sign-in's own line.

## What I did meanwhile

Setup ends its sign-in step on the same line the sign-in command prints: the workspace, the install hint, or the workspace the person is not a member of.

## What it costs to change later

Undoing it is removing four lines; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Nobody said whether a slice may change a file beside its ground when the spec's promise needs it (author).
