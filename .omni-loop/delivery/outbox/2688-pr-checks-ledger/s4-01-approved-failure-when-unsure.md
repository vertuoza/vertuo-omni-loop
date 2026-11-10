---
id: s4-01-approved-failure-when-unsure
prd: 2688
slice: s4
rank: medium
bears-on: none
raised: 2026-11-10
wave: 2
---

## The question, in plain words

The approved check had no failure handler before, so the spec's one for it is new. When the check keeps failing and Omni cannot even tell whether the pull request belongs to an approved PRD, should it still mark the check as failed?

## The decision, in plain words

Yes: if the repository asks for the approved check and Omni cannot tell what the pull request is, the check ends as failed with the reason, rather than staying silent. It stays silent only when it knows the check does not apply.

## The intro, for fun

A smoke alarm that cannot tell whether it is a fire still rings.

## The punchline, for fun

A red check beats a check that never comes.

## The options, in plain words

A. A. Fail the check with the reason when the pull request cannot be classified (built).
B. B. Post nothing when the pull request cannot be classified, leaving the check missing on a pull request that may need it.

## What I had to decide

Pick which side an unreadable pull request falls on: a failed check (built) or no check at all.
Decided by: Jev (hardToRevert 0.56) · agent said false

## What I did meanwhile

A pull request of no PRD in a loop repository could show a red approved check after five failed tries, only when GitHub itself kept failing.

## What it costs to change later

One boolean in the failure hook; flipping it is a one-line change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says nothing for a pull request whose kind cannot be read (author).
