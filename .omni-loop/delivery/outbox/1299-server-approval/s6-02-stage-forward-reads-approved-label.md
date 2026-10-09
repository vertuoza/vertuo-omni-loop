---
id: s6-02-stage-forward-reads-approved-label
prd: 1299
slice: s6
rank: medium
bears-on: none
raised: 2026-10-09
wave: 3
---

## The question, in plain words

How does the GitHub App learn, the moment it happens, that a PRD was approved on its page?

## The decision, in plain words

It reads the approved label being added to the PRD's issue, and dates the inbox at that moment, a second or so after the approval itself. When the label is missed, the 15-minute sync dates it at the approval's exact time.

## The intro, for fun

The approval happens on the page, but the App only hears what GitHub tells it.

## The punchline, for fun

Luckily the page leaves a label behind, like a note on the fridge.

## The options, in plain words

A. A. The App reads the approved label being added and forwards the inbox stage, as built.
B. B. The approval route on the page records the inbox stage itself, and the App reads no label.

## What I had to decide

Whether the App's live stage update for an approval rides on the approved label, or the page records the stage itself.

## What I did meanwhile

The App turns the approved label added to an issue into the PRD's inbox stage, dated at the issue's update time, with the PRD number standing in for its folder name.

## What it costs to change later

A constant: the page could record the stage directly instead, and the label reading would simply be removed.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The label event carries no approval time, so the live date is the label's, a moment late, and the stage store keeps the first date it is given (author).
- A repository that renames its approved label gets the live update from the sync alone, as with renamed branch shapes (author).
