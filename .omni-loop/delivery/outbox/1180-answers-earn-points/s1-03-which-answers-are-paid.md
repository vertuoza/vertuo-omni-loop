---
id: s1-03-which-answers-are-paid
prd: 1180
slice: s1
rank: medium
bears-on: none
raised: 2026-10-07
wave: 1
---

## The question, in plain words

Which answered questions earn points: also those asked while fixing a bug, and those from someone who has since left the workspace?

## The decision, in plain words

Only questions tied to a numbered PRD earn points, never those of a bug or visual fix, and only for someone who is still a member of the workspace with a GitHub login, the same people the dashboards list.

## The intro, for fun

A question answered during a bug hunt walks into the scoreboard.

## The punchline, for fun

The doorman checks for a PRD number and a member card.

## The options, in plain words

A. Pay only answers on numbered PRDs, by current members with a GitHub login.
B. Also pay answers asked while working on a bug or visual fix.
C. Also pay answers by people who have left the workspace, when their login is known.

## What I had to decide

Whether fix questions and former members' answers should earn points too.

## What I did meanwhile

Answers on fixes and answers by people who left the workspace are not paid; they still count in Questions answered.

## What it costs to change later

A change is a new version of one database function; past answers would be paid on the next poll, since the backfill reads from the game's start.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says a numbered dossier and the workspace roster; it does not say whether a fix's dossier, which also carries a number, counts as a PRD (author).
