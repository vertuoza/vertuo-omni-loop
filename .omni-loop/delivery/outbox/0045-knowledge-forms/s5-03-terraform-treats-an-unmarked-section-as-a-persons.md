---
id: s5-03-terraform-treats-an-unmarked-section-as-a-persons
prd: 45
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

The setup skill must never overwrite what a person wrote on a knowledge page. How does it tell a person's section from its own when the person did not label it?

## The decision, in plain words

It rewrites only sections that are empty, hold nothing but open questions, or that it labelled as its own; any other written section counts as a person's and is left alone.

## The options, in plain words

A. Only an empty section, one holding only questions, or one the skill labelled as its own is rewritten; every other section is a person's.
B. Only a section a person labelled as theirs is protected; unlabelled text is the skill's to rewrite.
C. The skill never rewrites a section holding any text, even its own; a refresh only fills empty sections and questions.

## What I had to decide

The spec says terraform "never rewrites a `by: human` section", and that `--refresh` redoes stale or blank forms. `omni kb init` writes markers with no `by:`, a person answering a `TODO(human)` line may not add `by: human`, and the spec's own example hole carries no `by:`. It does not say who owns a section holding text with no `by:`, nor whether a hole terraform writes is marked `by: terraform`.

## What I did meanwhile

The "Whose section it is" section of `kit/plugin/skills/terraform/SKILL.md`: terraform writes a section only when it is empty, holds nothing but `TODO(human)` lines, or its marker says `by: terraform`; text or a `See:` line with no `by:` is a person's. A hole's marker keeps no `by:`, and the pull request body tells a person to add ` · by: human` when answering one. A form holding a person's section is never turned into a pointer.

## What it costs to change later

A constant: the rule is prose in one skill. Narrowing it to option B is one sentence, but any section a person already wrote without a label would then be rewritten by the next refresh.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether people will reliably label the sections they answer, which option B relies on.
