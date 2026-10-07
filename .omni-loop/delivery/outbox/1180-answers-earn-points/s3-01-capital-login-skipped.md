---
id: s3-01-capital-login-skipped
prd: 1180
slice: s3
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

GitHub accounts may be spelt with capital letters. Should points credited to such an account be skipped until it is spelt in lower case, or written under its lower-case spelling?

## The decision, in plain words

They are skipped, as the design says: a name with a capital letter earns nothing new and a warning names it, until the rule changes. Nothing is written in the meantime, so no history needs fixing either way.

## The intro, for fun

Somebody signed up to GitHub with their caps lock on.

## The punchline, for fun

The ledger now whispers their name until it is written quietly.

## The options, in plain words

A. A. Skip an event credited to a capitalised name, with a warning naming it, as the design says.
B. B. Lower the name before the check, so a capitalised GitHub name is credited under its lower-case spelling.

## What I had to decide

Keep skipping capitalised names, or credit them under their lower-case spelling.

## What I did meanwhile

Every new event credited to a capitalised GitHub name is skipped with a warning on each poll; once the rule changes, the next poll writes them all, dated when they happened.

## What it costs to change later

Switching to B is one line in the projector and a test, no migration: the skipped events were never written, so the next poll writes them.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- I did not check whether anyone in the workspace roster has a capitalised GitHub name today; the board's skip warnings will say so after the first poll. (author)
