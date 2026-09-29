---
id: s4-01-push-skill-takes-a-kind
prd: 627
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The two fix skills now send their record to the Omni page through the small skill that sends a PRD's files, which sat outside this piece of work: should it have been changed here?

## The decision, in plain words

Yes: the small sending skill now also takes a fix's kind, the fix skills use it, and the checks that list who uses it and what a visual fix folder may hold were updated to match.

## The intro, for fun

Two fix skills knocked on the door of a skill built for PRDs only.

## The punchline, for fun

It learned one new word, kind, and let them both in.

## The options, in plain words

A. A. Teach the shared sending skill the fix kinds, and have both fix skills follow it (built).
B. B. Leave the sending skill for PRDs only, and have both fix skills run the send command themselves, with the same rules.
C. C. Make a separate small sending skill for fixes.

## What I had to decide

Whether the shared sending skill should learn the fix kinds here, or whether the fix skills should run the send command on their own.

## What I did meanwhile

The sending skill takes an optional kind and says what it sends for a fix; the fix skills follow it with their kind after they push. The skills pages of the docs now list both fix skills among those that run it, the old visual fix check that used a stray notes file now uses a round page, and the note on where the bug fix skill came from gained one line.

## What it costs to change later

Text only: undoing it is rewriting a few lines of two skills and three tests, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan gave this piece the two fix skills and the help text, but not the shared sending skill, the docs page tests, the visual check's command test, or the plugin test, all of which had to change for the fix skills to push with a kind.
