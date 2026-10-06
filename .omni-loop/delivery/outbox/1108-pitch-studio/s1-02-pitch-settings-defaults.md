---
id: s1-02-pitch-settings-defaults
prd: 1108
slice: s1
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

What should a product that never set its Pitch settings start with?

## The decision, in plain words

It starts on the Arcade look, as products did before, a Confident and warm voice with no instructions, the eyebrow New, the call to action Available now with credits, no music, and a length of 20 to 40 seconds.

## The intro, for fun

A blank settings page still has to look like something on day one.

## The punchline, for fun

So it looks like yesterday, only quieter: no music until someone picks some.

## The options, in plain words

A. A. Arcade look, no music, eyebrow New, Available now with credits (built).
B. B. Keynote look, as the spec's example and its fallback suggest.
C. C. Free upbeat music by default instead of none.

## What I had to decide

The spec names the voice and length defaults but not the starting look, eyebrow, call to action or music. Products already default to Arcade, so a product with no settings keeps it; music defaults to none because it needs no network and is the fallback the spec names.

## What I did meanwhile

Every unset field reads from these defaults on the page and in the terminal; a product's choices override them field by field.

## What it costs to change later

A constant each: change a default in one place and every product that never set the field follows.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec's later step says the terminal falls back to Keynote when it cannot read the settings, which differs from Arcade as the default for a product that has none.
