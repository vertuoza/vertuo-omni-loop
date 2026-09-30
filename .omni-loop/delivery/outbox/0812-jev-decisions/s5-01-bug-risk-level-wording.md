---
id: s5-01-bug-risk-level-wording
prd: 812
slice: s5
rank: medium
bears-on: none
raised: 2026-09-30
wave: 4
---

## The question, in plain words

When Jev is asked how risky a bug is, whose description of each risk level should it read?

## The decision, in plain words

Jev reads the default description of each level (critical, high, medium, low) that every repository starts with, the same for all, even for a repository that has rewritten those descriptions for itself.

## The intro, for fun

Four words, critical to low, and everyone swears they mean the same thing by them.

## The punchline, for fun

Until a repository rewrites them, the dictionary stays the one everybody got at birth.

## The options, in plain words

A. Keep one fixed wording, the kit default's, for every repository.
B. Have the bug-fix skill send the repository's own wording of the four levels, and let Jev read those instead.

## What I had to decide

The plan says each level is worded from the repository's bug-fixing form, but the question lives in Galaxy's registry, which is one per decision and not per repository, and the form's own text is read on the laptop. I kept one fixed wording in Galaxy: the kit default's Triage wording of each level.

## What I did meanwhile

The bug-risk entry carries the kit default's wording of the four levels, and its test pins that wording.

## What it costs to change later

A constant: sending the repository's own wording would mean the skill adds the form's four lines to the state it sends, and the entry reads them instead of its own; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether any repository has rewritten its bug-fixing form's risk levels today is not known (author).
