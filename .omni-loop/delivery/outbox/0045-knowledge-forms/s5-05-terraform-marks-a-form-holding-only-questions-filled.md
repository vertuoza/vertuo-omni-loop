---
id: s5-05-terraform-marks-a-form-holding-only-questions-filled
prd: 45
slice: s5
rank: medium
bears-on: none
raised: 2026-09-25
wave: 4
---

## The question, in plain words

When the setup skill could only ask questions on a knowledge page, should that page count as filled in, or as still empty?

## The decision, in plain words

It counts as filled in and dated, so a later refresh does not ask the same questions again; only a page the skill left wholly empty stays marked empty.

## The options, in plain words

A. A page holding any written text, pointer or question is marked filled and dated; a page left wholly empty stays marked empty.
B. A page holding only questions stays marked empty, so every refresh looks at it again.
C. Every page the skill looked at is marked filled and dated, even one it left wholly empty.

## What I had to decide

A form's front matter has `state: blank | filled | pointer` and `terraformed: <date> | null`, and `--refresh` redoes "the forms `omni kb status` reports stale or blank". The spec does not say which state a form holding only `TODO(human)` lines carries, nor one terraform surveyed and left empty because the kit default is already right.

## What I did meanwhile

Step 3 of `kit/plugin/skills/terraform/SKILL.md`: a form whose sections hold any text, `See:` line or question is `state: filled` with `terraformed: <today>`; a form left wholly empty stays `state: blank`, `evidence: []`, `terraformed: null`, so `--refresh` surveys it again.

## What it costs to change later

A constant: one sentence of skill prose. Forms written meanwhile keep the state they were given until a person or a refresh changes it; only the refresh choice and the map read it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person wants a refresh to ask again the questions nobody has answered yet, which option B would do.
