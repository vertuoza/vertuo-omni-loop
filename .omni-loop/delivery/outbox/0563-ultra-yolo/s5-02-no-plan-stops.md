---
id: s5-02-no-plan-stops
prd: 563
slice: s5
rank: medium
bears-on: none
raised: 2026-09-29
wave: 4
---

## The question, in plain words

When a feature that spans several repositories has no plan yet, should the build write one itself, as the one-repository build does, or stop?

## The decision, in plain words

It stops in one line and points to the brainstorm for several repositories, the step that writes such a plan and asks which repository does what.

## The intro, for fun

Building across three repositories without a map is a bold holiday plan.

## The punchline, for fun

The build asks for the map first, and says who draws it.

## The options, in plain words

A. A. Stop in one line and point to the brainstorm for several repositories, the option built.
B. B. Follow the one-repository planning step and let it write a plan that names a repository per piece.

## What I had to decide

What /omni:ultra-yolo does when the PRD has no plan.md or no plan PR, where /omni:yolo would follow /omni:plan.

## What I did meanwhile

It stops with the line 'PRD <n> has no plan: /omni:mega-brainstorm writes it'. /omni:plan slices one repository and cannot fill the plan's repo column or its Repositories table.

## What it costs to change later

One sentence of the ultra-yolo skill: planning there instead would name a planning step that fills the repo column, which no skill does today outside the mega-brainstorm.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec takes the plan from PRD 549 as given and never says what happens when it is missing.
