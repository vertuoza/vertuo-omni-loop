---
id: s3-02-follow-keeps-last-milestone-file
prd: 2251
slice: s3
rank: medium
bears-on: none
raised: 2026-10-20
wave: 2
---

## The question, in plain words

The plan says the follow writes its last milestone for this session, but not where, so the band's slice has nothing fixed to read.

## The decision, in plain words

While a follow runs, it keeps its last milestone in one small file per PRD in the checkout's local folder, and removes it when the follow ends; the board's merged count is read every 30 seconds from the board command.

## The intro, for fun

A follow needs a note on the fridge so the band can read it without asking.

## The punchline, for fun

The note says what happened last, and it comes off the fridge when the job ends.

## The options, in plain words

A. A. One file per PRD under the local folder, removed when the follow ends (as built).
B. B. One file per terminal session, named by the session id the way ask mode names its files.
C. C. No file: the band asks the page for the followed job itself.

## What I had to decide

Where the followed job's last milestone is kept for the HUD, and how the slice count is read.

## What I did meanwhile

Wrote .omni-loop/local/runner-follow/<prd>.json holding prd, runner, line and at; the file is deleted when the follow ends for any reason. The count of merged slices comes from running the board command's JSON every sixth read (30 seconds) and once the job ends; an unreadable board prints no count line.

## What it costs to change later

A constant: the file's name and shape are read only by the band's slice, which is not built yet.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names no file or shape for what the follow leaves, nor where the board's count comes from.
