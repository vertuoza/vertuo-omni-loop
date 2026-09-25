---
id: s4-03-own-answer-with-several-choices
prd: 71
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When a question allows several choices and the person also types their own answer, what should Claude receive?

## The decision, in plain words

Claude receives the ticked choices first, in the order they were offered, then the typed answer, all separated by commas. For a question with a single choice, typing an answer replaces the choice.

## The intro, for fun

Ticking three boxes and then writing in the margin is a very human way to fill in a form.

## The punchline, for fun

Claude now reads the margin too, right after the boxes.

## The options, in plain words

A. The ticked choices, then the typed answer, separated by commas, the option built.
B. The typed answer alone, dropping the ticked choices.
C. Let a person either tick choices or type an answer, never both.

## What I had to decide

The contract: several labels are joined with ", " for a multi-select, and the typed text is used for Other. It does not say what a multi-select sends when it has both labels and Other text, nor whether the labels keep the order they were clicked in or the order they are listed in.

## What I did meanwhile

`answerOf` in `src/ask/answer-model.ts`: a multi-select sends its chosen labels in the order the options are listed, then the Other text verbatim, joined with ", ". A single choice sends its label exactly as Claude wrote it, "(Recommended)" included, or the Other text when Other is chosen (typing in it chooses it). Other holding only blanks is no answer, so Send stays off. `answer-model.test.ts` covers each case.

## What it costs to change later

One function and its tests; answers already given are not affected.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) What the terminal prompt itself sends for a multi-select with typed text, which the page should match: no live session could be run here to see it.
