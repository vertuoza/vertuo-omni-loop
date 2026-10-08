---
id: s2-01-human-work-entry-limits
prd: 1217
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 1
---

## The question, in plain words

The spec does not say how big a piece of human work may be, whether every piece must name a PRD and a link, or what an empty list from the kit means. What should the app accept?

## The decision, in plain words

A roadmap question may have no PRD and any piece may have no link; a text holds up to a thousand characters, the act a person must do up to four thousand, and a push up to five hundred pieces. An empty list means nothing is waiting any more, so every open piece is marked done.

## The intro, for fun

Every inbox needs a size limit, even the one for jobs only a person can do.

## The punchline, for fun

Five hundred chores per roadmap is a lot of chores, and a sign to stop adding them.

## The options, in plain words

A. Keep these limits, with PRD and link optional and an empty list closing everything, as built.
B. Require a PRD and a link on every piece, so a roadmap question must point at one.
C. Treat an empty list like no list at all, so only a kit that sends pieces can close any.

## What I had to decide

The limits and optional fields of a human work entry, and whether an empty list closes every open entry.

## What I did meanwhile

prd and url are nullable (a roadmap question belongs to no PRD); text <= 1000, act <= 4000, at most 500 entries, a key used twice refused; `humanWork: []` marks every open key done, while a missing or null field closes nothing.

## What it costs to change later

A constant: the limits are check constraints and zod bounds, changed by a migration that only widens them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a question's link should be the roadmap issue, which the kit decides in s1 (author)
