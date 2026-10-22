---
id: s3-01-the-session-finds-the-page-in-the-token-file
prd: 2433
slice: s3
rank: medium
bears-on: none
raised: 2026-10-22
wave: 2
---

## The question, in plain words

When a job running as the GitHub App needs a fresh token, how does the job's own session know where to ask for one?

## The decision, in plain words

The runner writes the address of the Omni page into the small private file that already holds the job's token, when the job starts, so the session can ask the app by itself and needs no new setting.

## The intro, for fun

A token about to run out needs to know whom to call.

## The punchline, for fun

So the runner tucks the phone number into the same drawer.

## The options, in plain words

A. A. Keep the page address in the job's private token file, written when the job starts, so the session needs nothing else.
B. B. Hand the page address to the session as one more setting of its environment, which every tool in the session could read and print.
C. C. Read the address from the checkout's own configuration, which ties the job to a checkout the kit may not have set up.

## What I had to decide

Whoever owns the runner. The address is saved next to the token by the function that saves a job's token (github-token.ts), and read back by omni runner github-token; moving it to another place is a change in those two spots and in runner.ts where the job starts.

Decided by: Jev (hardToRevert 0.46) · agent said false

## What I did meanwhile

Added an optional page field to the job's token file (job-<id>.github, mode 0600). The runner fills it from the page it already talks to, at the moment it saves the first token. omni runner github-token reads it to post to the refresh route; a job whose file has no page field says so and fails the refresh instead of guessing. The kit never prints the field.

## What it costs to change later

Small. A different home for the address (an environment variable, or the checkout's configuration) is a constant and two reads; no migration, and old token files simply have no page field.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The PRD names the refresh route but not how the session learns the page address; the registers and the glossary do not settle it.
- (author) A job started before this change has a token file with no page field: its session cannot ask for a fresh token itself, while the runner still refreshes it on its own tick. Whether that is enough is not settled.
