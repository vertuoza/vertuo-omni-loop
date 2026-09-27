---
id: s1-06-dossier-command-lines
prd: 216
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

The spec lists the command's lines and exit codes, but not which stream carries them, how a push ends when one file is too large, or what a missing PRD folder is.

## The decision, in plain words

A skip line goes to the error stream and a result to the normal one; a push with a file too large still sends the others, names that file and ends as skipped. The status line never fails, and a PRD with no folder is a usage mistake.

## The intro, for fun

One file was too big for the suitcase, so the others flew without it.

## The punchline, for fun

A note in the suitcase says which one stayed home.

## The options, in plain words

A. Skip lines on the error stream, a partly sent push ends as skipped, and a missing folder is a usage mistake
B. Every line on the normal stream, so a skill reads one place
C. A partly sent push ends as done, with the file too large named as a warning

## What I had to decide

Which stream carries which line, and how a partly sent push ends.

## What I did meanwhile

The two small skills of the next wave print whatever the command printed, on either stream.

## What it costs to change later

A few constants in the command and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The skills are not written yet; they are assumed to show both streams (author).
