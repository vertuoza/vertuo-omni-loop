---
id: s2-02-brief-allows-no-measure
prd: 2842
slice: s2
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

The plan says a brief holds one to five signs of success, yet a one-line mission holds none. Should the brief accept a mission with no sign yet?

## The decision, in plain words

The brief accepts none to five signs, so a one-line mission is a valid brief. The conversation that writes a full mission still asks for at least one.

## The intro, for fun

A mission walked in with a goal and no way to tell if it worked.

## The punchline, for fun

We let it in anyway, and handed it a notebook for later.

## The options, in plain words

A. Zero to five signs: a one-line mission has none yet (built)
B. One to five signs: the one-line mission writes a placeholder sign a person fills later
C. One to five signs, and the one-line mission asks for one: it is no longer one line

## What I had to decide

Allow zero signs in the brief (A), or demand one and have the one-line mission write a placeholder sign (B).

## What I did meanwhile

The kit's schema and the database both take 0 to 5 measures; a brief with none reads as an empty list.

## What it costs to change later

Small: one bound in the kit's schema and one in the database check, and a placeholder in the one-line skill for B.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says both: the brief holds 1 to 5 measures, and /omni:mission --prd writes no measure yet. Both cannot hold for one schema.
- (author) The other bounds are mine, as the spec names none: a title of 200 characters, a goal of 500, 50 PRDs and 10 roadmaps in a scope, and a sign, how it is read and its target of 200 characters each.
- (author) The fleet is named by its key, as the Fleet section's address names it (night-shift); the app checks it is an active Virtual Fleet of the workspace.
