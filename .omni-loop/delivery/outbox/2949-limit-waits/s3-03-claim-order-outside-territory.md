---
id: s3-03-claim-order-outside-territory
prd: 2949
slice: s3
rank: medium
bears-on: none
raised: 2026-11-16
wave: 2
---

## The question, in plain words

The database now hands out recovered jobs first and follows a job's whole history, but two helpers outside this slice still work the old way: the in-memory stand-in the tests use still hands out jobs oldest first, and the server reads only the two latest earlier tries when it tells a machine what to restore. Should a follow-up bring them in line?

## The decision, in plain words

We left both as they are, since they sit outside this slice. The server already hands over the limited job and its saved work, which is the newest, so nothing is lost today; only the older tries of a long history are left out of what the machine is told.

## The intro, for fun

The database learned a new queue order; its stand-in did not get the memo.

## The punchline, for fun

Two copies of one rule, one of them a little behind.

## The options, in plain words

A. A. Leave both as they are: the newest save already reaches the machine
B. B. A follow-up brings the test stand-in's order in line with the database
C. C. A follow-up does B, and makes the server follow the whole history too

## What I had to decide

Pick whether a follow-up makes the test stand-in (apps/galaxy/src/runners/fixtures/store.fake.ts) hand out resumes first and the server's chain reading (CHAIN_MAX in apps/galaxy/src/runners/runners.service.ts) follow the whole history.
Decided by: Jev (hardToRevert 0.62) · agent said false

## What I did meanwhile

Both are unchanged; a test in runners.resume-claim.test.ts proves a limit's resume four jobs on still carries the limited job and its save.

## What it costs to change later

Low: a small change to each, with its tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the older tries' saves are worth telling the machine about once a newer save exists (author)
