---
id: s1-02-law-label-styled-by-init
prd: 1342
slice: s1
rank: medium
bears-on: none
raised: 2026-10-09
wave: 1
---

## The question, in plain words

The new label for law issues needs a colour and a description so that setting up a repository creates it like every other loop label. That lives outside this slice's ground: should this slice add it?

## The decision, in plain words

Yes. The slice gives the new label a purple colour and a one-line description in the set-up step, and updates the set-up tests that list every label, because the kit's own test refuses a label with no style.

## The intro, for fun

A brand-new label showed up to the party without a colour, and the bouncer would not let it in.

## The punchline, for fun

So it borrowed a purple coat and a name tag on the way.

## The options, in plain words

A. A. Add the style and the test lists in this slice (built).
B. B. Move the style to another slice, leaving the kit's tests red until it lands.
C. C. Pick another colour or wording for the label.

## What I had to decide

Whether the law label's style is added by this slice, outside its declared ground, or left to a later slice.

## What I did meanwhile

Setting up a repository creates the law label, purple, described as a law waiting for its test.

## What it costs to change later

A constant: one style line and the label lists of two test files.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan gave the new label key to this slice but not the set-up code that styles every label; the kit's test of label styles makes the two inseparable. (author)
