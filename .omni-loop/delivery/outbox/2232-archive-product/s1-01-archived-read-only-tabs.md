---
id: s1-01-archived-read-only-tabs
prd: 2232
slice: s1
rank: medium
bears-on: none
raised: 2026-10-20
wave: 1
---

## The question, in plain words

On an archived product's page, which tabs should its owner still see?

## The decision, in plain words

The owner keeps the tabs that only show things: Ledger, Constellation, PRDs, Ideas, Roadmap and the fixes. Questions, Knowledge and Repositories & approvers, where things are answered or edited, are hidden, and their addresses show the Ledger under the archived banner.

## The intro, for fun

A shelved product still deserves a tidy shelf.

## The punchline, for fun

Look all you like, just don't rearrange the books.

## The options, in plain words

A. A. Hide Questions, Knowledge and Repositories & approvers; their addresses show the archived Ledger (built).
B. B. Keep every tab, and show Knowledge and Repositories & approvers read-only, with no controls.
C. C. Show the Ledger alone, with no other tab.

## What I had to decide

Which tabs an archived product keeps, so its page is read-only as the spec asks. The screen library's draft leaves this open, and its mockup draws the Ledger only, with every tab still in the row.
Decided by: Jev (hardToRevert 0.50) · agent said false

## What I did meanwhile

Built A: the three tabs that change something are left out of an archived product's row, and their addresses show the archived Ledger. The database refuses every change to an archived product anyway.

## What it costs to change later

Small: one list in the tabs module and three route pages; no stored data depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person reading an archived product wants its Legal entries and glossary in view, read-only, was not asked.
