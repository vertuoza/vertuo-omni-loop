---
id: s6-03-harvest-helpers-shared
prd: 1342
slice: s6
rank: medium
bears-on: none
raised: 2026-10-10
wave: 3
---

## The question, in plain words

Should the sweep reuse the harvest's way of asking the judge and opening a law issue, even though that file belongs to an earlier part of this work?

## The decision, in plain words

Yes: the harvest's three small helpers were made shareable, unchanged in behaviour, so both paths ask the judge and open issues the same way.

## The intro, for fun

Two doors into the same courtroom should use the same doorbell.

## The punchline, for fun

One small edit next door saved a whole copy of the wiring.

## The options, in plain words

A. A. Export the helpers from the harvest command and reuse them.
B. B. Copy them into the knowledge command, leaving the harvest untouched.
C. C. Move them into a new shared module both commands import.

## What I had to decide

Whether to touch kit/bin/commands/harvest.ts, outside this slice's territory, to share askLawWorth, openLawIssue and prdTitle.

## What I did meanwhile

Exported the three helpers from harvest.ts; askLawWorth now takes its --ref from the caller (the harvest still passes 'PRD <n> <id>', the sweep passes 'sweep <id>'). The harvest's tests pass unchanged.

## What it costs to change later

Moving the helpers to a shared module later is a rename of imports.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The territory names no shared place for command helpers.
