---
id: s5-01-guide-tests-list-the-new-page
prd: 1723
slice: s5
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

Adding the observability page to the guide's menu changes the list of pages two existing guide checks expect, and those checks sat outside this piece of work. Should the page go last in the menu, after the troubleshooting page, as built?

## The decision, in plain words

The page goes last in the guide's menu and points back to the start; the two guide checks were extended to expect it there, with no other page's order or links changed.

## The intro, for fun

A new page walked into the guide and the guide's own checks counted the chairs again.

## The punchline, for fun

Nineteen chairs now, and nobody had to change seats.

## The options, in plain words

A. A. The page last in the menu, after troubleshooting, pointing back to the start; the two guide checks extended to expect it (as built).
B. B. The page before troubleshooting, so the troubleshooting page stays last; the use-cases page's next link and the checks' expected links change with it.

## What I had to decide

Answer A to keep the page last, or B to move it beside the troubleshooting page's neighbours.

## What I did meanwhile

The page sits last in the menu; every other page keeps its place and its next link.

## What it costs to change later

Moving it later is one line of the menu file and the matching lines of two checks.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's territory named the menu file but not the two checks that list the menu; extending them was the only way to keep them green, so it was done here rather than left red.
