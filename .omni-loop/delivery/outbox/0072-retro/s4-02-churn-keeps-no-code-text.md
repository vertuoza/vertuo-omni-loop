---
id: s4-02-churn-keeps-no-code-text
prd: 72
slice: s4
rank: medium
bears-on: none
raised: 2026-09-25
wave: 3
---

## The question, in plain words

The spec says the model is shown the changed lines of each part rewritten again and again, but keeping the text of every change between two steps can outgrow what the job queue stores for one step. What should the retro keep of each change?

## The decision, in plain words

The retro keeps where each change sits and how many lines it touched, never the text of the code, so it fits however large the feature is. The model is told which lines were rewritten, by which changes, with links, but is not shown the code itself.

## The intro, for fun

The model asked to read the code, but the suitcase between two steps only fits a list of line numbers.

## The punchline, for fun

So it travels light: where each change sits, how big it was, and a link for anyone curious.

## The options, in plain words

A. Keep where each change sits and its size, never the code, the option built.
B. Keep also the code of the last change to each flagged part, read again in a step of its own after the counting.
C. Keep the code of every change between steps, accepting that a very large feature may not be counted.

## What I had to decide

What `gather` in `kinds/churn.mjs` hands `detect` for each file of each commit. The spec's model input includes "the hunks of churn ranges" ("The model, and the guard"), and its units table says `gather` returns "commits with patches". Each step's output is stored by Inngest, which refuses one over its size limit; the patches of a delivery of a hundred commits can pass it.

## What I did meanwhile

`gather` reduces each patch to its change blocks, `[oldStart, oldCount, newStart, newCount]`, and keeps no line of text; `churn.test.mjs` pins that no patch text reaches the records. Each finding carries its commit links and a link to the file, or the range, at the feature PR's head. No excerpt of the code reaches the fact sheet, so `narrate` (slice s6) has no hunk to send for a churn finding.

## What it costs to change later

Showing the model the code of each flagged range is one more field on a range finding, filled by reading those commits again after the counting, in a step the function (`retro.mjs`, slice s8's ground) would add; or by keeping every patch's text in the records and risking the step limit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The step output limit of the Inngest plan the app runs on.
- (author) How slice s6 means to find the hunks it sends the model, since the kinds' contract names no excerpt field.
