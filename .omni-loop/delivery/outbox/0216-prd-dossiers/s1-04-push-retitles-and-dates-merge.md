---
id: s1-04-push-retitles-and-dates-merge
prd: 216
slice: s1
rank: medium
bears-on: none
raised: 2026-09-27
wave: 1
---

## The question, in plain words

Each push carries the spec's title, and a draft numbered to a dossier the fallback already made is merged into it. Should every push rename the dossier, and which opening date should a merged dossier keep?

## The decision, in plain words

Every push sets the title to the spec's latest one. A merged dossier keeps the earlier opening date, the draft's, so the questions asked during that brainstorm still belong to it.

## The intro, for fun

The draft arrived first, and the fallback's copy arrived later with all the paperwork.

## The punchline, for fun

The dossier now remembers who was actually early.

## The options, in plain words

A. Retitle on every push, and date a merged dossier from the earlier opening
B. Title a dossier only when it is created or numbered, and keep the fallback's date on a merge
C. Retitle on every push, but keep the fallback's date on a merge

## What I had to decide

Rename the dossier on every push or only once, and keep the fallback's date or the draft's when the two merge.

## What I did meanwhile

The title follows the spec on every push, and a merge dates the dossier from the draft's opening.

## What it costs to change later

One line each in the database function and the test fake; no row changes shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The questions slice reads the opening date for its brainstorm rule; it is assumed to read this same date (author).
