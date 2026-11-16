---
id: s10-03-item-score-is-jevs-or-unknown
prd: 2896
slice: s10
rank: medium
bears-on: none
raised: 2026-11-16
wave: 10
---

## The question, in plain words

A question goes to a person when it is hard to undo. Where should that score come from, when the question itself carries none?

## The decision, in plain words

The score is Jev's confidence when Jev decided whether the choice is hard to undo; otherwise it is unknown, and an unknown score always goes to a person. Until a workspace turns Jev on, the fleet answers no question on its own.

## The intro, for fun

The bouncer only lets in guests whose age is written down.

## The punchline, for fun

Nobody wrote anything down yet.

## The options, in plain words

A. The score is Jev's confidence when present; no score sends the question to a person (built).
B. Each new question carries the agent's own judgement as a score, 1 or 0, read when Jev gave none.

## What I had to decide

Where the hard-to-revert score of a question comes from, for the mission's bound: Jev's confidence when present, or something the question would have to carry.

## What I did meanwhile

Jev's confidence is read from its line in the question; a question without one is sent to a person, whatever the members would say.

## What it costs to change later

Option B writes the agent's own hard-to-revert judgement into each new question, 1 when it judged it hard and 0 otherwise, and reads it here: a change to how questions are written, older questions staying unknown.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) A question does not record whether the agent judged it hard to undo; only Jev's line carries a number.
- (author) Whether Jev's confidence is the score the spec means by a question's hard-to-revert score.
