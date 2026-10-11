---
id: s5-01-one-look-without-design-md
prd: 1559
slice: s5
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

When a repository has design craft on but no design system file yet, should the screen review still look only once, or take up to three rounds too?

## The decision, in plain words

Only a repository with a design system file gets the three rounds. Without one, the review looks once and confirms once, as it did before this change.

## The intro, for fun

Three rounds of looking need something to look against.

## The punchline, for fun

No design system file, no rematch: one look, one fix, done.

## The options, in plain words

A. Three rounds only when the repository has a design system file; without one, one look and one confirming look, as before (built).
B. Up to three rounds for every repository with design on, judged against the design form when there is no design system file.

## What I had to decide

Keep A, or pick B to give every design-on repository up to three rounds. B rewords the Bounded line of the review reference and the law proof that pins today's wording, kit/test/plugin.test.ts, in the same change.

## What I did meanwhile

Repositories without a DESIGN.md review as before, with one look and one confirming look; those with one get up to three rounds and the parts check.

## What it costs to change later

A constant: one sentence of the review reference and one assertion of the law proof.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec's review section does not say whether the rounds need a DESIGN.md; its Risks say reviews take up to three rounds with a DESIGN.md, which A follows. (author)
- The help entry for pixel-perfect still says one batch of polish and one confirming look; it sits outside every slice's territory and should name the rounds once a slice may change it.
