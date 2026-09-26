---
id: s6-01-retro-record-names-shipped-folder
prd: 82
slice: s6
rank: medium
bears-on: none
raised: 2026-09-26
wave: 2
---

## The question, in plain words

When a feature was merged before its folder was moved to the shipped shelf, should the retro's own record say where the folder was at the merge, or where the retro now lives?

## The decision, in plain words

The retro's record names the shipped folder, where the retro is written, and still says the folder was in the inbox at the merge.

## The intro, for fun

A retro written into a room the folder has not moved into yet.

## The punchline, for fun

The address on the letter is where it will be read, not where it was posted.

## The options, in plain words

A. Name the shipped folder in the record and the pull request text, keep the state as it was at the merge (built).
B. Keep the inbox folder in the record, and only write the files into the shipped folder; the pull request text then names a folder that no longer holds the retro.
C. Name the shipped folder and also set the state to shipped, losing the fact that the PRD was merged without being shipped.

## What I had to decide

Whether the retro's record and its pull request text name the shipped folder or the inbox folder for a PRD merged without being shipped.

## What I did meanwhile

The record's folder field and the retro pull request's text name the shipped folder; the record's state field still says inbox.

## What it costs to change later

One line in the retro function: the folder put on the fact sheet after detection. Undoing it drops that line; no stored data needs migrating.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the retro's files go into shipped/ always, and says nothing about the folder field inside retro.json. (author)
