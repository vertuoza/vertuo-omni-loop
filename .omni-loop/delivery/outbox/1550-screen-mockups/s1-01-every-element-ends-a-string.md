---
id: s1-01-every-element-ends-a-string
prd: 1550
slice: s1
rank: medium
bears-on: none
raised: 2026-10-11
wave: 1
---

## The question, in plain words

When a sentence on a screen has one word in bold or in a link, should the word check still read it as one sentence, or as separate pieces?

## The decision, in plain words

Every tag now ends a piece of text, so a bolded word splits its sentence into pieces. A long sentence with emphasis in the middle may then escape the too-many-words warning.

## The intro, for fun

One bold word walks into a sentence and splits it into three.

## The punchline, for fun

Grammar teachers would object; the word check simply counts pieces.

## The options, in plain words

A. A. Every element boundary ends a string, emphasis included (built).
B. B. Only adjacent sibling elements with no text between them split; inline emphasis inside running text stays one string.
C. C. Inline tags (b, i, em, strong, a without href) never split; every other element does.

## What I had to decide

Whether only block-level siblings (spans side by side) split a string, or every element boundary does, as built.

## What I did meanwhile

Every element ends a string: `<span>a</span><span>b</span>` reads two strings, and so does `<p>Click <b>here</b> now</p>` (three). A control's label stays whole.

## What it costs to change later

Changing it later is one rule in the walk of kit/lib/design/words/pass.ts and its tests; no stored shape moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says sibling elements are two strings and that splitting a word across tags is the mockup's choice, but does not say what inline emphasis inside a running sentence does.
