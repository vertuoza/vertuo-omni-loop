---
id: s3-01-update-cleans-up-after-itself
prd: 347
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

When the update has prepared its change in a separate working copy, should that copy be kept on the person's machine or thrown away once the change is sent for review?

## The decision, in plain words

It is thrown away as soon as the change is pushed and the review request is open, or as soon as the update stops. A later run that finds a leftover copy of the same update starts it again from scratch.

## The intro, for fun

The update builds its change in a spare room so the person's desk stays tidy.

## The punchline, for fun

Once the change is posted, it sweeps the spare room too.

## The options, in plain words

A. Remove the working copy once the change is pushed or the update stops (built).
B. Keep the working copy, so a person can look at or amend the change before it is reviewed.
C. Keep it only when the update stops early, so a person can see where it stopped.

## What I had to decide

Whether the separate working copy the update prepares its change in stays after the review request is open, and what a rerun does with a copy an earlier run left behind.

## What I did meanwhile

The copy is removed once the change is pushed or the update stops; a rerun resets the same update branch and starts over, and the check for an already-open review request runs before anything is written.

## What it costs to change later

One line: dropping the removal keeps the copy; nothing is stored anywhere that would need migrating.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says where the working copy is made but not whether it is kept afterwards (author).
