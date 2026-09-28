---
id: s10-01-list-counts-every-listed-prd
prd: 251
slice: s10
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

To show how many questions wait on each plan in the list of plans, how much should the list read from GitHub each time someone opens it?

## The decision, in plain words

The list asks GitHub about every numbered plan it is about to show, all at once, reusing what was read in the last minute. A plan GitHub could not answer for shows no count, and is left out when someone asks for the plans that need an answer.

## The intro, for fun

Counting everyone's homework before class starts takes a moment.

## The punchline, for fun

The teacher remembers the answers for a minute, which helps.

## The options, in plain words

A. Read every numbered plan the other filters let through, all at once, and treat a plan that could not be read as having nothing waiting.
B. Read at most the first twenty plans shown, and mark the rest as not counted.
C. Read the plans a few at a time, so a long list never sends many GitHub reads at once.
D. Show an unknown mark on a plan that could not be read, and keep it under Needs an answer.

## What I had to decide

The spec says the count comes from the same cached reader, and that a row not read in the last minute is read when the list is. It does not say how many rows to read, nor what Needs an answer does with a row that could not be read.

## What I did meanwhile

Only the numbered dossiers that pass the other filters (Mine or All, repository, draft or PRD, the search) are read, in parallel, through the one reader and its 60-second cache. A dossier whose summary or outbox could not be read gets no badge and is not kept by Needs an answer.

## What it costs to change later

One function in the history module: a cap on how many rows are read, a concurrency limit, or an unknown mark instead of nothing. No stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How many numbered dossiers a workspace lists in practice, and so how many GitHub reads a cold list costs against the App's rate limit.
