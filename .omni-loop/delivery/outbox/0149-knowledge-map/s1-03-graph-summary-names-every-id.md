---
id: s1-03-graph-summary-names-every-id
prd: 149
slice: s1
rank: medium
bears-on: none
raised: 2026-09-26
wave: 1
---

## The question, in plain words

The short summary of the knowledge map lists the rules that serve no principle. Should it name every one of them, or only the first few followed by an ellipsis, as the spec's example shows?

## The decision, in plain words

It names every one, so an agent reading the summary gets the whole answer. It also gives each pair of domains that share entries a line of its own, after the domains.

## The intro, for fun

An ellipsis is a polite way of saying the rest is somebody else's problem.

## The punchline, for fun

Here the rest gets named too, even when the line runs long.

## The options, in plain words

A. Name every entry, and give each pair of domains its own line, the option built.
B. Name the first few and end with an ellipsis, leaving the full list to the whole document.

## What I had to decide

The spec's example prints `loose entries (8): N-PRODUCT-1, N-PRODUCT-2, N-PRODUCT-3, …`, but does not say where the list is cut, nor whether cross-domain entries get a line of their own in the summary.

## What I did meanwhile

`omni kb graph` names every unserved principle and every loose entry, each list on one line, and prints a line per cross-domain pair (`<a>--<b>`) after the domains, in the same columns. On this repository the rest of the output matches the spec's example to the character: `kb graph — 1 domain, 58 entries, 26 links` and the product line.

## What it costs to change later

Cutting the list is a constant in `kit/bin/commands/kb.mjs` and one test in `kit/bin/kb.test.mjs`.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's example may have been cut for the page rather than for the terminal.
