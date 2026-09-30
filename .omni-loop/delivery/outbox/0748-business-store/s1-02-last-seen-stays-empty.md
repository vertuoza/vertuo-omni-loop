---
id: s1-02-last-seen-stays-empty
prd: 748
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

Each fact an agent reads carries a 'last seen' date, but nothing in this change ever sees a fact anywhere. What should that date say?

## The decision, in plain words

It stays empty for now. It fills in once a later change reads facts from real sources, such as a pricing page.

## The intro, for fun

We built a guest book before anyone came to visit.

## The punchline, for fun

Its pages are blank, and that is honest.

## The options, in plain words

A. Null until evidence sets it, the option built.
B. The date the claim was picked or last confirmed.

## What I had to decide

What claims.last_seen and the contract's lastSeen hold while no evidence sets them.

## What I did meanwhile

The column last_seen is null on every claim, and lastSeen is null in every read; the pick date is kept apart in created_at and updated_at.

## What it costs to change later

One nullable column; filling it later needs no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- the spec names lastSeen in decision 14 without saying what sets it before evidence drafting (author)
