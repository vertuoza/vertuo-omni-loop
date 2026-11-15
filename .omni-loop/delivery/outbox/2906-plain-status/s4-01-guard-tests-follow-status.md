---
id: s4-01-guard-tests-follow-status
prd: 2906
slice: s4
rank: medium
bears-on: none
raised: 2026-11-15
wave: 3
---

## The question, in plain words

Three older guard tests still checked the old overview skill under the name status, outside this slice's files. Should they follow the rename?

## The decision, in plain words

The guard that remembers each skill's steps now remembers status as the session's status, and the guard that wants a link to the PRD's page now checks the dashboard instead. Nothing the old overview did was dropped: it lives on in the dashboard skill.

## The intro, for fun

The old status moved house, and its mail still came to the old address.

## The punchline, for fun

We forwarded the mail.

## The options, in plain words

A. A. Follow the rename: status holds the session status, the dashboard carries the overview's checks (what was built).
B. B. Keep the old snapshot entry and add the same words to the status skill, which would make it name the overview command again.

## What I had to decide

Edited kit/test/skill-steps.snapshot.json (the status entry now holds the session status's one command) and kit/test/skills-dossier-link.test.ts (dashboard replaces status in its list), both outside the territory, since the rename made them fail. A person can instead keep the snapshot and add a dashboard entry.

## What I did meanwhile

The session status stands as built; the guards pass.

## What it costs to change later

Reverting the two small test edits and choosing another guard shape.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the old snapshot should stay untouched is the owner's call (author).
