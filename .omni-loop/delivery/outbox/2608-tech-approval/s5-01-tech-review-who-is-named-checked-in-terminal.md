---
id: s5-01-tech-review-who-is-named-checked-in-terminal
prd: 2608
slice: s5
rank: medium
bears-on: none
raised: 2026-11-04
wave: 3
---

## The question, in plain words

The tech review checks who is running it by their GitHub login in their own terminal, while only giving the approval is enforced by the server: is that enough?

## The decision, in plain words

The skill reads the login with GitHub's own command and refuses on a mismatch or when none can be read. Someone who edits their own copy of the skill could still run the review as another person, but they still could not give the approval, because the server only accepts it from the named person.

## The intro, for fun

The bouncer checks the guest list, but only at the front door of the building.

## The punchline, for fun

The vault still opens for the named person alone.

## The options, in plain words

A. A. The terminal check only: the skill reads the GitHub login and refuses a mismatch; the server enforces the approval.
B. B. Add a server check on who may push the review's changes to the PRD, in a later PRD.

## What I had to decide

Option A keeps the terminal check and relies on the server for the approval. Option B would add a server check on who pushes a tech-review commit, which needs a new rule outside this slice.

## What I did meanwhile

The review is refused for anyone whose GitHub login differs from the named one, and the approval stays with the named person.

## What it costs to change later

Option B costs a server rule and a migration; undoing option A later costs a line in the skill.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a review by the wrong person is worth blocking on a server (author)
