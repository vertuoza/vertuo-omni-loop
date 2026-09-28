---
id: s2-04-ask-mode-still-gated-by-email
prd: 359
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

Ask mode and the terminal sign-in still let in only people whose account email is at the company's own domain, so now that everyone signs in with GitHub, a crew member whose GitHub email is personal or hidden is turned away. Should ask mode admit anyone who belongs to a workspace instead?

## The decision, in plain words

This slice left that rule as it is, because the files that hold it belong to no slice of this plan. Until someone changes it, a crew member whose GitHub email is not a company address cannot use ask mode.

## The intro, for fun

The front door now opens with a GitHub key, but the ask room still checks for a company badge.

## The punchline, for fun

Anyone who left their badge at home gets a polite no from the terminal.

## The options, in plain words

A. A: leave the email rule; a follow-up changes it (built)
B. B: admit anyone who belongs to a workspace, in a rework slice of this PRD
C. C: drop the rule and rely on the database's own membership checks

## What I had to decide

Whether ask mode's email rule, which sits outside this slice's ground, changes with GitHub sign-in.

## What I did meanwhile

apps/galaxy/src/ask/auth.ts and apps/galaxy/src/ask/cli-code.ts still refuse an account whose email does not end in @vertuoza.com (isCrewEmail), with the message 'Ask mode is for @vertuoza.com accounts only.'. Neither file is in s2's territory, nor in any slice's of this plan.

## What it costs to change later

A constant: replace isCrewEmail with a workspace membership check in two call sites and their tests; no data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan does not name apps/galaxy/src/ask/auth.ts or apps/galaxy/src/ask/cli-code.ts in any slice's territory, and the spec does not mention ask mode's email rule
