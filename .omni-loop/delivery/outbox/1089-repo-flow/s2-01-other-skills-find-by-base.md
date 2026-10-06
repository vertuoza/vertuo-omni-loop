---
id: s2-01-other-skills-find-by-base
prd: 1089
slice: s2
rank: medium
bears-on: none
raised: 2026-10-06
wave: 1
---

## The question, in plain words

Three other loop commands (the wave, the rework run and the planner) still look for the feature pull request only when it targets the main branch, so they would not find one stacked on another pull request. Should they learn to find it too?

## The decision, in plain words

I taught only the build-everything command and the pull request command to find a stacked feature pull request, as this slice asks, and left the other three as they are, outside this slice.

## The intro, for fun

A pull request standing on another one's shoulders is easy to miss if you only look at the floor.

## The punchline, for fun

Two commands now look up; three still stare at their shoes.

## The options, in plain words

A. Keep the change to the two skills this slice owns; the other three keep their filter until a later slice widens them.
B. Fold the same change for the wave and the planner into the slice that already edits them (s7), and the rework run with it.
C. Open a follow-up fix that widens all three at once, with a test in the skill tests.

## What I had to decide

Whether the wave, the rework run and the planner should also find a stacked feature pull request, and in which slice.

## What I did meanwhile

A stacked feature pull request is found by the build-everything command and handled by the pull request command; the wave, the rework run and the planner look for it with a filter on the main branch and report none.

## What it costs to change later

Small: the same one-line change in three skill files, plus a check in the skill tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- No test guards the stacked wording in either skill: the skill tests sit outside this slice's territory (author).
