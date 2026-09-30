---
id: s3-02-run-json-shape
prd: 798
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

The design says the proof command reads a run file the recording skill writes, but not what that file holds, nor what happens to a run where nothing could be filmed.

## The decision, in plain words

The run file holds the commit, the address filmed and one line per criterion with the names of its clip and script; the moving preview is found by its file name. A run with nothing filmed gets its own number from the terminal, since there is nothing to upload.

## The intro, for fun

Every film crew needs a call sheet before the clapperboard snaps.

## The punchline, for fun

This one fits on an index card, and blank takes still get a slate number.

## The options, in plain words

A. A. The run file holds the commit, the address and the criteria, the preview is found by its name, and a run with nothing filmed is numbered by the terminal (built)
B. B. The run file also names the preview, and the Omni page always numbers the run, even with nothing to upload
C. C. Refuse to push a run with nothing filmed, printing a line instead

## What I had to decide

The shape of run.json that /omni:prove (s5) must write, how the GIF is found, and how an all-unfilmable run gets its id when the app's upload call refuses an empty file list.

## What I did meanwhile

run.json is {commit, url, criteria: [{text, verdict, note?, video?, script?}]}; preview.gif in the folder is uploaded when present; a run with no file skips the upload call and mints a random UUID for the register call. Local refusals print `refused (<status>): <reason>`, a 404 prints `none`, and a folder without run.json is exit 2.

## What it costs to change later

A constant: the file is written and read only by the kit, never stored; s5's skill text follows whatever shape is settled.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec names run.json's contents only as the criteria, verdicts, notes and file names; commit and url are needed by the register call, and whether the app accepts a run id it did not mint rests on s2's register route, which only checks the id's form.
