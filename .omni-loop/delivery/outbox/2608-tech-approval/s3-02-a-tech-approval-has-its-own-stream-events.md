---
id: s3-02-a-tech-approval-has-its-own-stream-events
prd: 2608
slice: s3
rank: medium
bears-on: none
raised: 2026-11-04
wave: 2
---

## The question, in plain words

When a terminal follows a PRD's approval as it happens, how should it hear about a Tech Approval, so that a terminal with an older kit never takes one for the real approval?

## The decision, in plain words

A Tech Approval gets its own news with new names, which an older kit already ignores, so the news it knows stays about the product approval alone. A newer kit waits on the named person and asks no approver until they have given it.

## The intro, for fun

Two doors, two doorbells, and the old house only hears its own.

## The punchline, for fun

A stranger's bell can ring all day without opening your door.

## The options, in plain words

A. A. News of its own names, ignored by an older kit (what was built).
B. B. Send no live news of it, and have a newer kit look again every few seconds while it waits.

## What I had to decide

Tell the Tech Approval with news of its own names, and leave the existing names for the product approval alone.

## What I did meanwhile

An older kit keeps waiting for the product approval and never ends on a Tech Approval; it may still ask early, which is recorded and waits, as already settled. A newer kit names the person it waits on, and reads the state again after a cancelled approval, so the named person is asked first.

## What it costs to change later

A change in two small modules if another way of telling is wanted; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says the approval's reply gains a tech part but does not say how the live news carries it.
- (author) The member list shows only people with a GitHub login, so no email is ever shown; a member with no login could not be picked from it, which should be rare as members sign in with GitHub.
