---
id: s2-01-branch-before-record
prd: 1208
slice: s2
rank: medium
bears-on: none
raised: 2026-10-08
wave: 2
---

## The question, in plain words

When the branch a session is on and the last thing it worked on disagree, which one should the session show?

## The decision, in plain words

The branch wins, as it already does for features: a session on a fix branch shows that fix, and only on a branch that names nothing does it show the last thing it worked on.

## The intro, for fun

Two signposts, two directions: the road you stand on, or the note in your pocket?

## The punchline, for fun

We trusted the road under our feet.

## The options, in plain words

A. A. The branch first, then the record, for features and fixes alike (built).
B. B. The record first, then the branch, as the spec's list orders them, for fixes and features alike.
C. C. The record first for fixes only, the branch first for features.

## What I had to decide

Pick A to keep the branch first, or B to follow the spec's list where the last recorded work comes before the branch.

## What I did meanwhile

A session shows the work its branch names; the record only fills in on a branch that names nothing.

## What it costs to change later

Switching the order is a few lines in one reading module and its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec lists the record before the branch, while the status line it builds on reads the branch first; which one was meant is not written down (author).
