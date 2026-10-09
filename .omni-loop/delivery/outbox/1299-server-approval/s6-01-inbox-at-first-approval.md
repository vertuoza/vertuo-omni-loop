---
id: s6-01-inbox-at-first-approval
prd: 1299
slice: s6
rank: medium
bears-on: none
raised: 2026-10-09
wave: 3
---

## The question, in plain words

When a PRD approved on its page is approved again after a change, which approval dates its arrival in the inbox?

## The decision, in plain words

The first approval dates it. A later approval does not move the date, the same way the first phase-0 merge dates a PRD born in the repository.

## The intro, for fun

A PRD can be approved twice, but it only walks into the inbox once.

## The punchline, for fun

So the first approval holds the door, and the second one just waves.

## The options, in plain words

A. A. The first approval dates the inbox, and a later one never moves it.
B. B. The approval in force (the latest) dates the inbox, moving it at each new approval.

## What I had to decide

Which approval dates a PRD's inbox stage when it was approved more than once.

## What I did meanwhile

The stage sync dates a server-born PRD's inbox at its earliest approval row.

## What it costs to change later

A constant: picking the latest row instead is a one-line change in the sync's read.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says 'dated at its approval' without saying which one when there are several (author).
