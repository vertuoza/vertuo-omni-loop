---
id: s2-01-s2-link-order-tests
prd: 2401
slice: s2
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

Switching the PRD tabs to client links changed the order of their attributes in the page's HTML, so three older tests that read the tabs by their exact text broke. Should the slice have fixed those tests, which sit just outside its listed files?

## The decision, in plain words

The three tests (PR care, outbox and visual fix pages) were adjusted to read the same links in the new attribute order, with no change to what they check.

## The intro, for fun

A link moved one word to the left and three tests noticed.

## The punchline, for fun

Now they read the new order and agree again.

## The options, in plain words

A. A. Fix the three tests in this slice (as built).
B. B. Leave them red and let a person fix them in a separate change.

## What I had to decide

Territory widened by three test files, regex order only.

## What I did meanwhile

Nothing waits on this; the tests are green.

## What it costs to change later

None to undo: three one-line regex edits.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the owner wants test fixes outside the listed files in a slice (author)
