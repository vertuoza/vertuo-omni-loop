---
id: s4-01-last-activity-counts-answers
prd: 216
slice: s4
rank: medium
bears-on: none
raised: 2026-09-27
wave: 4
---

## The question, in plain words

The list of PRDs puts the most recently active first, and the spec says activity is the latest version or question. Does an answer count as activity, and what about a draft nobody has touched since it was opened?

## The decision, in plain words

An answer counts, as much as a question being asked, and so do opening the dossier and giving it its number. A draft nobody touched sits at the date it was opened, below the ones people are working on.

## The intro, for fun

Two drafts sat at the bottom of the list, each claiming it had been busy.

## The punchline, for fun

The one with an answer this morning won the argument.

## The options, in plain words

A. Count the opening, the numbering, every version, and every question asked or answered
B. Count only versions and questions asked, as the spec words it, with the opening for a dossier that has neither
C. Count versions only, so questions never move a PRD up the list

## What I had to decide

What moves a dossier up the list: only a new version or a question asked, as the spec words it, or also an answer, its opening and its numbering.

## What I did meanwhile

The last activity is the latest of the opening, the numbering, every version, and every question asked or answered. The list and the planet's tab of the next slice read the same value.

## What it costs to change later

One line in the database function that lists the dossiers, and the same line in the test double; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says newest activity first, the latest version or question, without saying whether answering a question is activity or where a dossier with neither sits.
