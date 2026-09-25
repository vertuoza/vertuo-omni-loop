---
id: s2-01-answered-question-frees-its-line
prd: 50
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When an answered question leaves the list, should it keep holding its fallback intro and punchline, so that no later question's lines ever change?

## The decision, in plain words

Only the questions still shown hold a fallback line. When an earlier question is answered, a later one that had to skip past its line may move to it, so that later question's lines change once.

## The options, in plain words

A. Only the questions still shown hold a fallback line, so no line repeats in the comment while the pool has one unused, the option built.
B. Every question ever numbered keeps its fallback line after it is answered, so no line ever moves, at the price of repeats once a pull request has asked more questions than the pool has lines.

## What I had to decide

Which questions take a line from the fallback pool. The spec's decision 5 says each question skips "a line an earlier question in the same comment already took", and also that "rewriting the comment never changes a question's lines". An answered question leaves the open and adopted sections for the Answered section, which shows no lines: under the first rule it no longer takes one, so a later question that had skipped past its line may move to it, which the second rule seems to forbid. Acceptance criterion 5 names only two renders of the same comment and adding a question.

## What I did meanwhile

`questionBanter` in `kit/lib/outbox/comment.mjs` serves only the questions the comment shows (open and adopted), in question-number order, through `assignBanter` in `kit/lib/outbox/banter.mjs`. Rendering twice, rewriting in place and adding a question never change a line; an answer can change the fallback lines of a later question whose id hashed to the same line as the answered one.

## What it costs to change later

Switching to B is one change in `questionBanter`: serve every id the numbering marker lists (it already records every number ever assigned) and show only the shown questions' lines, plus a test. No stored shape changes, since the lines are recomputed on every rewrite; the switch itself moves some fallback lines once.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether a question that was answered, and so left the open and adopted sections, still counts as "in the same comment" when the fallback lines are handed out
