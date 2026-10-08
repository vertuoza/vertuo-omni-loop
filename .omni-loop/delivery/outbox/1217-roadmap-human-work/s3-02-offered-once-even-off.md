---
id: s3-02-offered-once-even-off
prd: 1217
slice: s3
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

When the automatic sorting is switched off and a new piece of human work arrives, should it be sorted later if someone switches the sorting on?

## The decision, in plain words

No: each new piece is looked at once, when it first arrives, whatever the setting is then. Pieces that arrived while the sorting was off, and those already stored, keep the kind the simple rules gave them.

## The intro, for fun

The spec says each new piece is sorted once, and is silent on pieces that arrived while sorting was off.

## The punchline, for fun

Once means once, so switching it on later does not reopen the old ones.

## The options, in plain words

A. Offer each key once, at its first push, whatever the mode is then; the backlog keeps the rule kind (built).
B. Offer only while the decision is Shadow or On; keys stored while Off are offered the first push after it is turned on.
C. Offer the open keys again whenever the decision is turned On, once per switch.

## What I had to decide

Whether switching the Jev decision On later sorts the pieces that arrived while it was Off, or only the ones that arrive from then on.

## What I did meanwhile

Every key is marked offered the first time a push stores it, Off included; turning hitl-category On only sorts keys first stored after that. The rows stored before the migration count as offered. A key the time budget of one push did not reach is offered after the next push.

## What it costs to change later

Low: offering the backlog instead is one migration that clears the offered mark on the rule-kind keys, and nothing else changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says a new key is classified once but not what turning the decision On does to keys stored while it was Off (author).
