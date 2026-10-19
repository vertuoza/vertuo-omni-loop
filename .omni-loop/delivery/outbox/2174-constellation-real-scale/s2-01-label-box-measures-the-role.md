---
id: s2-01-label-box-measures-the-role
prd: 2174
slice: s2
rank: medium
bears-on: none
raised: 2026-10-19
wave: 1
---

## The question, in plain words

The spec sizes each star's label by its name only, but a repository's role prints under its name and can be longer. Should the label's space also cover a long role?

## The decision, in plain words

Each label takes the width of its longer line, the name or the role, still capped at 28 characters, so a long role never prints over a neighbour.

## The intro, for fun

A star's name was short, but its job description ran on for a whole sentence.

## The punchline, for fun

So we measured the longer line, and the neighbours kept their personal space.

## The options, in plain words

A. A. Measure the longer of the name and the role (built).
B. B. Measure the name alone, as the spec says; a long role may print over a neighbour's label.

## What I had to decide

Keep A: the layout measures the longer of the name and the role. Choose B to measure the name alone, as the spec wrote it; the change is one line in the layout and its test.

## What I did meanwhile

Labels with a role longer than the name take a little more room, so a product with many long roles spreads its stars slightly wider.

## What it costs to change later

Reversing it is a one-line change to how a label's width is measured, plus one test; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The role's real type size is set by the drawing slice (s4); it is measured here at the name's 7.8 px a character, which errs on the wide side (author).
