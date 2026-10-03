---
id: s1-01-ids-stop-at-safe-integers
prd: 1049
slice: s1
rank: medium
bears-on: none
raised: 2026-10-03
wave: 1
---

## The question, in plain words

Today the tool accepts any string of digits as a number, even one so long the computer can no longer hold it exactly. Should the new identifier checks accept those too?

## The decision, in plain words

The new checks refuse numbers too large to be held exactly, beyond about nine quadrillion. Every real issue, pull request or comment number is far below that.

## The intro, for fun

The spec said every number the old reader takes, and the old reader takes infinity.

## The punchline, for fun

We drew the line a little before infinity.

## The options, in plain words

A. A. Refuse numbers beyond the largest exact whole number, as zod 4's integer check does (built).
B. B. Accept them, matching the old argument reader exactly, including ones that read as infinity.
C. C. Refuse them, and make the old argument reader refuse them too when s5 replaces it.

## What I had to decide

Whether an identifier larger than the largest exact whole number is refused, as built, or accepted as the old argument reader does.

## What I did meanwhile

A number of more than sixteen digits given as an identifier is refused with an error naming it; every realistic identifier reads as before.

## What it costs to change later

Accepting them instead is a one-line change in kit/lib/ids.ts (drop the integer bound zod 4 applies), no data or migration involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec asks the numeric parsers to accept every digit string positiveInt accepts; positiveInt also accepts digit strings beyond Number.MAX_SAFE_INTEGER, even ones that read as Infinity, which zod 4's .int() refuses. The tests check digit strings up to Number.MAX_SAFE_INTEGER. (author)
