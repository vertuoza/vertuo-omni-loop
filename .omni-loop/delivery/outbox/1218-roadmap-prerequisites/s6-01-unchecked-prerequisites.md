---
id: s6-01-unchecked-prerequisites
prd: 1218
slice: s6
rank: medium
bears-on: none
raised: 2026-10-08
wave: 5
---

## The question, in plain words

When a prerequisite has never been checked yet, how should the roadmap's Prerequisites tab show it?

## The decision, in plain words

It shows as not checked yet, counted on its own in the count line, sorted right after the ones waiting on you, with its card open so a person can act on it.

## The intro, for fun

Some items on the checklist have never been looked at, not even once.

## The punchline, for fun

Schrödinger's prerequisite: neither done nor missing until somebody runs the check.

## The options, in plain words

A. A. Show it as not checked yet, apart, its card open (built).
B. B. Count it as waiting on you, with the same look.
C. C. Hide its state and show only its need until it is checked.

## What I had to decide

Whether a prerequisite nobody has checked yet should count as waiting on you, or stay apart as not checked yet.

## What I did meanwhile

The tab shows it as not checked yet, after the rows waiting on you, with its card open.

## What it costs to change later

A label, a sort rank and one part of the count line on the page; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec lists four states (ok, fixed, waits on you, ticked) and says nothing of a row the last check did not report.
