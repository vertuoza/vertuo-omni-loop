---
id: s1-01-unversioned-skips-latest
prd: 347
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

When the running tool carries no version number at all, should the version command still say whether a newer release exists?

## The decision, in plain words

It says only that it is unversioned and does not ask GitHub, because without a number it cannot tell older from newer. From the tool's own source with no number yet, it says unversioned and source.

## The intro, for fun

A tool with no version number walks into a release party and asks if it is late.

## The punchline, for fun

Nobody can tell, so it just says unversioned and stays quiet.

## The options, in plain words

A. Unversioned prints one line, no GitHub call (built).
B. Unversioned also prints the latest release and says to run the update command.

## What I had to decide

Whether an unversioned build should also print the latest release and point to the update command.

## What I did meanwhile

An unversioned build prints one line and never asks GitHub; a numbered build compares as the spec says.

## What it costs to change later

A constant in one function: printing the latest line for an unversioned build is a two-line change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the unversioned first line but not whether GitHub is asked after it (author).
