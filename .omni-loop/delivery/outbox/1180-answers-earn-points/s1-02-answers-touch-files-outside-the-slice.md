---
id: s1-02-answers-touch-files-outside-the-slice
prd: 1180
slice: s1
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

The slice needed a few small changes outside the files its plan listed. Is that all right?

## The decision, in plain words

Four small changes landed outside the listed files: the database check now runs on every pull request, the test stand-in for the database learned to answer the new read, a script test covers the new read, and the arcade's How to play page lists answered questions among what earns XP.

## The intro, for fun

The plan drew a fence around this slice. Four tiny footprints are on the other side.

## The punchline, for fun

Nothing was trampled, but the gardener should know.

## The options, in plain words

A. Keep all four changes in this slice.
B. Keep the workflow and test changes, and drop the How to play line so the arcade shows answers nowhere.
C. Move all four into a follow-up slice.

## What I had to decide

Whether the four out-of-plan changes stay, or each moves to a slice of its own.

## What I did meanwhile

The new database check runs in the database workflow; the arcade's How to play shows QUESTION ANSWERED x1.

## What it costs to change later

Each change is a few lines and can be reverted on its own; none changes stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan's territory left out the database workflow, the game's test stand-in and the arcade menu, though the conventions require a new database check to run in CI and the rulebook change breaks the menu's own test without the label (author).
