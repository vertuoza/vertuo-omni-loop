---
id: s12-01-skills-do-by-hand-what-the-board-cannot-read
prd: 1548
slice: s12
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

Several of the loop's commands still only know a repository's own PRD numbers, so they cannot read a product PRD yet. Should the skills work around them for now, or wait until those commands learn product PRDs?

## The decision, in plain words

The skills work around them: they read the plan from the server and the pull requests from GitHub themselves, wait on approval by asking again every minute, and say in their report which command did not run. Teaching those commands product PRDs is a follow-up.

## The intro, for fun

Half the toolbox speaks the new language and the other half still nods politely.

## The punchline, for fun

So the skills translate by hand until the second half takes lessons.

## The options, in plain words

A. The skills work around the commands for now, and a follow-up teaches the commands product PRDs (built).
B. Hold every product PRD build until those commands learn product PRDs.
C. Teach the commands product PRDs inside this PRD, before the skills ship.

## What I had to decide

Whether the product path of the ultra and mega skills reads the plan, the pull requests and the approval itself while the board, the next step, care, the approval wait, the plan checks, ship, rework and the Loop page take only a repository's PRD number.

## What I did meanwhile

Each skill's product section reads the plan through the dossier, grades the slices from the target pull requests the way the board does, waits on approval by reading the PRD again once a minute for up to an hour, drives a product PRD beside the loop plan with no Loop page tick, and names every command it could not run in its hand-off.

## What it costs to change later

Skill text only: once a command learns product PRDs, the matching sentence of each product section is replaced by that command.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether grading slices by hand matches the board exactly on a claim gone stale (author)
- whether a product PRD should appear on the Loop page before its commands learn product ids (author)
