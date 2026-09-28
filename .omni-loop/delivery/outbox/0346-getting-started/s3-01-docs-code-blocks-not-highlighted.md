---
id: s3-01-docs-code-blocks-not-highlighted
prd: 346
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The docs tool colours code examples with its own theme by default, which would bring colours the app's design system does not own. Should the docs' code examples be coloured at all?

## The decision, in plain words

We switched the colouring off: code examples show as plain text on the app's own code background, in every theme.

## The intro, for fun

The docs tool arrived with its own box of crayons for code examples.

## The punchline, for fun

We kindly asked it to use ours, and ours only has the one colour for code.

## The options, in plain words

A. No colours in code examples: what was built, plain text on the app's code background.
B. Colour code with new design-system tokens: add a few code colours to the design system, per theme, and map the highlighter onto them.
C. Keep the docs tool's own code colours: accept a few colours the design system does not own, in code examples only.

## What I had to decide

Whether code examples get syntax colours, which the design system has no tokens for.

## What I did meanwhile

Code blocks are monochrome, drawn with the app's tokens; the commands in them read the same in the three themes.

## What it costs to change later

Cheap: one setting, plus a small set of colour tokens for code if we want colours later.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec asks for the app's own look and tokens only, but does not say whether code gets colours (author)
