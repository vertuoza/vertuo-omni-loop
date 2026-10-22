---
id: s1-03-database-checks-the-key
prd: 2425
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

Should the database itself refuse a key that may not close a job's questions, and a job that is already carried on, or leave both checks to the web server?

## The decision, in plain words

The database checks the key itself: it must be live, from the same workspace, made by someone still in it, and allowed on the job's repository. It also refuses a job that is already carried on.

## The intro, for fun

A lock on the door, and another on the safe.

## The punchline, for fun

The database keeps its own lock, door or no door.

## The options, in plain words

A. The database checks the key and refuses a job already carried on, so any caller that reaches it is held to the same rules.
B. Leave both checks to the web server and let the database trust its caller: fewer rules in the database, one place to get wrong.

## What I had to decide

The plan asks the two functions to close a round for a key, with exactly one of a person and a key. It leaves open whether the data layer re-checks what the web server already checks (BR-PRODUCT-63 and BR-PRODUCT-64: same workspace, key not revoked, maker still a member, repository on the key's list) and whether a job a resume already continues is refused there (`runner_jobs.continues` is unique, so the insert would fail anyway). Both functions now call runner_job_closer_check(), and runner_job_answer raises 55000 before the insert, so a caller gets a clear refusal, not a unique violation.

## What I did meanwhile

Built runner_job_closer_check() with the same SQLSTATEs the routes read (P0002, 55000, 42501, 22023), granted it to the service role only, proved each refusal, and killed the mutations that dropped a rule from it.

## What it costs to change later

Removing the checks later is a function replace, with no data change; adding them back after they were left out would be the same.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the routes of the next slices still want to run the same checks before calling the functions, or rely on the refusals alone.
