---
id: s3-03-count-line-one-skill
prd: 2873
slice: s3
rank: medium
bears-on: none
raised: 2026-11-14
wave: 2
---

## The question, in plain words

When a hero lists a single skill and it runs alone, should its count line say one skill or one skills?

## The decision, in plain words

It says skill for one and skills for more, so it reads as plain English. No role lists a single skill today, so every hero on screen reads as the spec writes it.

## The intro, for fun

A hero with one skill would have read like a typo.

## The punchline, for fun

One skill, one word, no extra letter.

## The options, in plain words

A. Skill for one, skills for more (built).
B. Always skills, as the spec's pattern reads.

## What I had to decide

Keep the singular for one skill, or always write skills as the spec's pattern does.

## What I did meanwhile

Built A: roleLine() in kit/lib/virtual-fleet/roles.ts writes `Runs 1 of 1 skill alone` for a hero that lists one skill, and `Runs <k> of <n> skills alone` otherwise.

## What it costs to change later

A constant: one condition in roleLine() and its test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec writes the line as `Runs <k> of <n> skills alone` and gives no case of a single skill.
