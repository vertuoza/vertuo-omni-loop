---
id: s3-01-law-wait-shows-no-law-id
prd: 2377
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

The Waiting page should say which law a pull request is held by, but the stored wait does not keep the law's name. What should the row say?

## The decision, in plain words

A held-by-a-law row reads just 'law' for now, with the law's owners as the turn. Showing the law's name needs the sync to store it.

## The intro, for fun

The page knows a law is holding the door, but not which law's name is on it.

## The punchline, for fun

For now the row simply says 'law', and the owners know which one to look for.

## The options, in plain words

A. A. Show just the word law, with no name (built).
B. B. Store the law's name with the wait in a follow-up and show it on the row.

## What I had to decide

Show `law` with no id; the table has no column for the law's id, and this slice may not change the table.

## What I did meanwhile

The row reads `law` and links to the pull request, where the failing check names the law.

## What it costs to change later

Adding the id later is one nullable column, one sync field and one word in the row.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Where the law id should be stored (a column of waits, or read from the check) is (author) not settled by the spec.
