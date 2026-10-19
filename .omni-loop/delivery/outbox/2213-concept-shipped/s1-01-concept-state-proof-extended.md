---
id: s1-01-concept-state-proof-extended
prd: 2213
slice: s1
rank: high
bears-on: BR-PRODUCT-93
raised: 2026-10-19
wave: 1
---

## The question, in plain words

A concept can now read shipped, so the tests that prove a concept with no facts or an unread pull request is state unknown were extended. Is the rule still proved as you want it?

## The decision, in plain words

The old checks stay as they were and still pass, and new ones were added beside them: a concept in review or with no facts never reads shipped. Nothing about state unknown was loosened.

## The intro, for fun

A fourth state walks in, and the doorman still checks everyone's papers.

## The punchline, for fun

Unknown stays unknown, shipped or not.

## The options, in plain words

A. A. Keep the new cases beside the old ones, as built.
B. B. Move the new shipped cases to their own tests and leave the old ones untouched.

## What I had to decide

Confirm the extended tests are the proof of the rule, or ask for the new cases to move.

## What I did meanwhile

The extended tests stay as built, all green.

## What it costs to change later

Moving the new cases to other files is a small edit.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the owner of the rule wants the new cases in the same tests (author)
