---
id: s12-03-reworks-only-from-answers-given-in-the-run
prd: 1548
slice: s12
rank: medium
bears-on: none
raised: 2026-10-11
wave: 2
---

## The question, in plain words

When someone disagrees with a decision on the product's Questions tab, the loop has no command yet that reads that answer back. Which disagreements does the rework run act on?

## The decision, in plain words

Only the ones answered in the same run, in the terminal, where the run saw the question and the answer. A disagreement given on the Questions tab is reported as held until a command can read it.

## The intro, for fun

Someone wrote a strong opinion on the fridge, and the robot cannot read handwriting yet.

## The punchline, for fun

It acts on what you told it out loud and points at the fridge for the rest.

## The options, in plain words

A. Rework only what was answered in the same run; hold the rest, named (built).
B. Hold every product rework until a command reads the answers on the server.
C. Add that command to this PRD, so the rework run reads every answer.

## What I had to decide

Which drifted answers on a product PRD the rework run reworks, while no command lists the answers settled on the server.

## What I did meanwhile

The rework run reworks each answer posted as a disagreement in the same run, bounded by the option picked, and names every other one as held on the Questions tab.

## What it costs to change later

Skill text only, plus a command that lists a product PRD's settled answers when one lands.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- how often a person answers on the Questions tab rather than in the terminal (author)
