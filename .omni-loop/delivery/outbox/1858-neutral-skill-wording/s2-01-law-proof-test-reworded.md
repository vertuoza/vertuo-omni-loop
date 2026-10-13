---
id: s2-01-law-proof-test-reworded
prd: 1858
slice: s2
rank: high
bears-on: N-PRODUCT-15
raised: 2026-10-13
wave: 2
---

## The question, in plain words

The test that proves several locked rules, among them that only a person merges into the main branch, was edited where it read the skills' old Claude-only wording. Do you approve that edit?

## The decision, in plain words

Only the lines that read the old wording changed; each rule's own check is exactly as it was, and the full test run is green.

## The intro, for fun

Words moved around a guard, and the guard asks a person to look before it stands down.

## The punchline, for fun

Same lock, new label on the door.

## The options, in plain words

A. Keep the edited test: it reads the neutral wording with the Claude way in brackets, and every rule's check stays as it was.
B. Undo the test edits and keep the old Claude-only wording in the skills.

## What I had to decide

Approve the change to the rules' test on the feature PR (the lock line names who must). Decided by: Jev (hardToRevert 0.76) · agent said true

## What I did meanwhile

The feature PR stays red on the rules' check until the person named by the lock approves it.

## What it costs to change later

Option B means putting the Claude-only wording back in every skill, which undoes the PRD.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The edit was checked by the full test run and by the snapshot of every skill's commands and guards; no one has read each changed line against the rules yet (author)
