---
id: s1-01-preview-question-width
prd: 498
slice: s1
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

A question that shows a picture beside it used to stretch wider than the other questions. Now that every question already uses the full width, should it still get special treatment?

## The decision, in plain words

It no longer gets special treatment: it uses the same full width as every other question, with its picture beside the text as before.

## The intro, for fun

The wide question used to be the only one allowed to stretch its legs.

## The punchline, for fun

Now everyone gets the whole room, so it stopped showing off.

## The options, in plain words

A. Same full width as every question: the preview question fills the column.
B. Cap it at 1120 px, centred in the full-width page.
C. Cap it at 1120 px, aligned left with the rest of the content.

## What I had to decide

Whether a question with a preview should keep a separate width rule now that the column is full width.

## What I did meanwhile

A question with a preview fills the page's width like the others; its text and preview still split the space in two from 720 px.

## What it costs to change later

A few lines of stylesheet to bring back a width cap and centring for that one kind of question.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No browser pass yet of a question with a preview at 1920 px (author).
