---
id: s1-02-call-sites-list
prd: 1665
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The page keeps a list of every place it calls GitHub, and the new reader is one more. Adding it meant changing a test outside this slice's ground: is that fine?

## The decision, in plain words

I added the new reader to the list, as a reader that goes through the shared, budget-aware client, so the guard still sees every call to GitHub.

## The intro, for fun

Every door to GitHub has a name on the guest list.

## The punchline, for fun

The new door signed in at the front desk, one line, no forged badge.

## The options, in plain words

A. Keep the one-line entry: the guard lists the new reader beside the others.
B. Route the reader through an existing listed reader instead, so the list does not change.

## What I had to decide

Whether a one-line entry in apps/galaxy/src/github-call-sites.test.ts, outside s1's territory, is the right way to let apps/galaxy/src/loop/github.ts call GitHub.

## What I did meanwhile

Listed 'apps/galaxy/src/loop/github.ts' as a 'client' site; the test also proves it reaches @omni/github.

## What it costs to change later

Removing one line.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person keeps that list by hand on purpose, so an agent should not add to it. (author)
