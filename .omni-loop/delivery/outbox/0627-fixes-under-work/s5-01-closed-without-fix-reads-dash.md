---
id: s5-01-closed-without-fix-reads-dash
prd: 627
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 3
---

## The question, in plain words

What state does a fix show when its issue was closed but no fix pull request was ever opened or merged?

## The decision, in plain words

It shows the same dash as when GitHub does not answer, because none of Asked, In review or Merged is true for it.

## The intro, for fun

An issue closed with no fix in sight is a story with no middle chapter.

## The punchline, for fun

So the pill shrugs politely and shows a dash.

## The options, in plain words

A. Show the dash, as for GitHub not answering (built).
B. Add a fourth state, Closed, with its own pill and filter choice.
C. Keep showing Asked until a fix pull request merges, whatever the issue's state.

## What I had to decide

The spec's table names three states: Asked (issue open, no fix PR open), In review (a fix PR open) and Merged (that PR merged). An issue closed without any fix PR, or whose only fix PR was closed unmerged, fits none of them.

## What I did meanwhile

The state reads the dash (the unknown state) for it, on the list row and in the page header. The state filter never matches it.

## What it costs to change later

One line in the state function and one label: adding a fourth state such as Closed later is a constant and a label, no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a person wants abandoned fixes told apart from GitHub being silent (author).
