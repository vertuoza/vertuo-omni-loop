---
id: s2-01-a-person-with-no-row-is-also-emailed-when-their-approval-is-voided
prd: 2608
slice: s2
rank: medium
bears-on: none
raised: 2026-11-04
wave: 2
---

## The question, in plain words

Should a person with no alert settings also get the email when a change voids their approval, or only the email for a new approval request?

## The decision, in plain words

The spec says email is on by default for everyone and a person with no row reads as on, but the plan only names the request email. I applied the same default to the voided-approval email, so both emails treat a person with no settings alike.

## The intro, for fun

One door now opens for everyone, so the side door should not stay locked.

## The punchline, for fun

Same default, same welcome.

## The options, in plain words

A. A. Both emails follow the default: a person with no row is emailed in both cases (as built).
B. B. Only the request email follows the default; the voided-approval email keeps needing a row with email on.

## What I had to decide

Whether the voided-approval email follows the same on-by-default rule as the request email.

## What I did meanwhile

The migration redefines both reads with the on-by-default rule, and the database check holds the request case for no row, email off and email on.

## What it costs to change later

One follow-up migration restores the old read of the voided-approval email; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan names the request email only; the spec's wording 'for everyone' is why I read it to cover the voided-approval email too.
