---
id: s3-02-ticks-unread-when-github-is-down
prd: 1218
slice: s3
rank: medium
bears-on: none
raised: 2026-10-08
wave: 3
---

## The question, in plain words

When the check of a roadmap's prerequisites cannot reach GitHub to see which items a person marked as done, what should it do?

## The decision, in plain words

It carries on and treats every item a person must mark as not done yet, saying so in one line, so the loop never moves on something it could not confirm.

## The intro, for fun

If you cannot read the sign-off sheet, nobody signed it.

## The punchline, for fun

Better a short wait than a false all-clear.

## The options, in plain words

A. Carry on with no tick, one line on stderr (built).
B. Stop with one line and exit 1, checking nothing.
C. Reuse the ticks of this machine's last result.

## What I had to decide

How omni roadmap prereqs behaves when the roadmap issue's comments, where the ticks live, cannot be read.

## What I did meanwhile

The command prints one line on stderr (the ticks could not be read, every person row waits) and runs the rest; every person row waits, so the exit is 1 while one exists. It does not stop with an error, so the checks of the machine still run and are kept.

## What it costs to change later

One branch of the command: stop with exit 1 instead, or keep the last result's ticks. No stored shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says a check that cannot run is not ok, but says nothing of the ticks when GitHub cannot be read.
