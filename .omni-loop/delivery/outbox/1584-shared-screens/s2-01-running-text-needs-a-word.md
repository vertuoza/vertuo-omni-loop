---
id: s2-01-running-text-needs-a-word
prd: 1584
slice: s2
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

When does a line of a mockup count as a running sentence, so that the small styled pieces inside it are read as part of it? Only when it has real words of its own, or also when it only has a separator such as a dot or a dash?

## The decision, in plain words

A line counts as a running sentence only when it holds at least one letter or digit of its own. Pieces separated only by a dot or a dash stay separate strings.

## The intro, for fun

A lonely middle dot walks between two labels and asks to be called a sentence.

## The punchline, for fun

The word check says no: a sentence needs at least one word.

## The options, in plain words

A. A. Own text must hold a letter or a digit (built).
B. B. Any non-blank own text, a separator included, makes running text.

## What I had to decide

What counts as a parent's own text when the word pass decides whether phrasing elements run on.

## What I did meanwhile

A parent's text of its own must hold a letter or a digit; a separator alone (·, —, |) keeps its sibling spans as separate strings, as PRD 1550 made them.

## What it costs to change later

One constant in kit/lib/design/words/pass.ts (the test used by hasRunningText); no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says 'a parent that holds text of its own beside them' without saying whether punctuation alone counts (author).
