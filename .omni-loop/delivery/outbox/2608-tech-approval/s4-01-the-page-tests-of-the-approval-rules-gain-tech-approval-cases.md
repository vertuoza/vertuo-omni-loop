---
id: s4-01-the-page-tests-of-the-approval-rules-gain-tech-approval-cases
prd: 2608
slice: s4
rank: high
bears-on: none
raised: 2026-11-04
wave: 3
---

## The question, in plain words

Two test files that prove approval rules on the page and in the bell gained Tech Approval cases and two new expected fields. Do they still prove the rules they are named for?

## The decision, in plain words

I added cases for requesting, giving and waiting on a Tech Approval, and the old expectations only gained two fields that read as empty for a PRD with no request. Nothing expected was removed, and the files sit beside the approval rules.

## The intro, for fun

The referee's notebook grew two pages, so the rulebook wants a witness.

## The punchline, for fun

Say yes and the notes count.

## The options, in plain words

A. A. Keep the extended tests: old cases unchanged, new fields empty without a request (as built).
B. B. Keep the old expectations untouched and put the Tech Approval cases in new test files.

## What I had to decide

Keep the tests as extended: every old case still holds, with the tech fields empty for a PRD with no request.

## What I did meanwhile

The page tests and the Waiting tests pass, and so does the whole suite; a PRD with no request renders as before.

## What it costs to change later

Restoring the old files is a revert of this slice's test edits, together with the page code they cover.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The plan's done-when does not say whether the existing view expectations may gain the new fields.
