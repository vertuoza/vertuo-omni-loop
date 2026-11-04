---
id: s2-03-the-approval-requests-check-now-expects-no-row-to-be-emailed
prd: 2608
slice: s2
rank: high
bears-on: none
raised: 2026-11-04
wave: 2
---

## The question, in plain words

The database check that proves how approval requests reach people used to expect that a person with no alert settings got no email. Is it right that it now expects them to be emailed?

## The decision, in plain words

The spec turns email on by default for everyone, so that old expectation became wrong and I changed it, then added cases for a new row, a row with email off and a row with email on. The check sits beside the approval rules, so a person should confirm the change in what it proves.

## The intro, for fun

The rulebook's footnote changed, so the referee wants a witness.

## The punchline, for fun

Say yes and the new default is official.

## The options, in plain words

A. A. Keep the new expectation: no row is emailed, email off is not, email on is (as built).
B. B. Keep the old expectation and leave email off by default for people with no row.

## What I had to decide

Whether the check may expect an email for a person with no alert settings, as the spec's on-by-default rule says.

## What I did meanwhile

The check passes against a fresh local database; no approval rule other than the email default was touched.

## What it costs to change later

Restoring the old expectation is one edit to the check, together with the default's own rollback.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's done-when says the check holds three cases; it does not say that the existing no-row expectation flips.
