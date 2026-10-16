---
id: s1-01-film-card-font
prd: 2100
slice: s1
rank: medium
bears-on: none
raised: 2026-10-16
wave: 1
---

## The question, in plain words

The spec asks for a well-known public-domain pixel font on the before and after cards, but the agent could not fetch it, so every letter was drawn by hand in the same cell size. Should a person swap in the original font's letters?

## The decision, in plain words

The cards use a hand-drawn set of letters in the same size and style as that font. Every letter, digit and test-runner mark is covered and reads cleanly, but the shapes are not copies of the original font.

## The intro, for fun

The font was supposed to arrive by post, so the agent drew every letter itself.

## The punchline, for fun

Even the lowercase g got its tail, and the question mark got a very busy week.

## The options, in plain words

A. Keep the hand-drawn letters, the option built.
B. Embed the original public-domain font's letters, supplied by a person, with its notice.

## What I had to decide

Whether the cards keep the hand-drawn letters, or a person supplies the original public-domain font for the kit to embed.
Decided by: Jev (hardToRevert 0.44) · agent said false

## What I did meanwhile

The cards read well with the hand-drawn letters, and swapping them later changes one table of letter shapes and no behaviour.

## What it costs to change later

One table of letter shapes, and the tests that name its cell size.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether the hand-drawn shapes match the original font closely enough for a reviewer (author)
- whether the original font's notice must travel with the kit if its letters are embedded (author)
