---
id: s5-02-idea-and-retro-in-the-terminal
prd: 587
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The terminal summary now shows all seven stages, but it cannot see ideas, which live only on the Omni app. Should it say so, and count a retro once its write-up is filed?

## The decision, in plain words

It shows idea as living on the app, with no number, and counts a shipped PRD as retro once its folder holds the retro write-up.

## The intro, for fun

Seven stages walked into the terminal, and one of them had stayed home on the app.

## The punchline, for fun

So the summary left it a note instead of a number.

## The options, in plain words

A. A. Idea says it lives on the app; retro counts from the filed retro write-up: the option built.
B. B. Leave idea out of the terminal summary, showing six stages there.
C. C. Also count a retro whose pull request is open but not merged, from its branch.

## What I had to decide

How omni status shows the two stages git alone does not state: idea (a draft dossier on the Omni app) and retro (the spec says a retro PR is opened; the repository shows retro.md in a shipped folder once it merges).

## What I did meanwhile

format.mjs prints `IDEA on the app` first on the counts line; facts.mjs reads the shipped folders holding retro.md (RETRO_FILE), and overview.mjs counts them as retro, still delivered in the bar and in your shipped row.

## What it costs to change later

A constant: IDEA_COUNT in format.mjs, and RETRO_FILE or a check for an open retro branch in facts.mjs.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a retro PR still open should already count as retro in the terminal, as it does on the app
