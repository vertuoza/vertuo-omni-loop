---
id: s1-01-waits-on-closed-or-unreadable
prd: 1118
slice: s1
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

When a pull request waits on another one that was closed without merging, or that cannot be looked up, should care keep holding it or go back to fixing it?

## The decision, in plain words

A closed-without-merging dependency no longer holds the pull request, so care goes back to fixing it as usual. A dependency that cannot be looked up keeps holding it, so no fix attempt is spent on a guess.

## The intro, for fun

The spec says what to do when the other pull request is open or merged, and stays quiet on the rest.

## The punchline, for fun

Somebody had to decide what a closed door means.

## The options, in plain words

A. Closed unmerged: fix as usual. Unreadable: hold.
B. Both hold until a person removes the line.
C. Both fix as usual.

## What I had to decide

Whether a closed or unreadable dependency holds the pull request.

## What I did meanwhile

Closed means fix as usual; unreadable means hold and spend nothing.

## What it costs to change later

A constant in one pure function: swapping either case is a one-line change with its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names only the open and merged cases (author).
