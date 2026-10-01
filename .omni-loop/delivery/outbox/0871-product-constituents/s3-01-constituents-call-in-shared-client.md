---
id: s3-01-constituents-call-in-shared-client
prd: 871
slice: s3
rank: medium
bears-on: none
raised: 2026-10-01
wave: 2
---

## The question, in plain words

The new startup command needs one call to the page that serves the product's limits, and adding it touched three files outside this slice's area: the shared web client and two tests that count the commands and the startup hooks. Is that the right place for them?

## The decision, in plain words

I added the one call to the shared web client, beside the business call, and updated the two counting tests so they include the new command and the new startup hook.

## The intro, for fun

A new command walked in and the head count was off by one.

## The punchline, for fun

So the tests learned to count to forty.

## The options, in plain words

A. A. Keep the call in the shared client and the two updated counting tests.
B. B. Write a small web caller inside the new command's own folder and leave the shared client alone.
C. C. Leave the counting tests to a follow-up change.

## What I had to decide

Keep the call in the shared client and the two updated counts, or move the call into the new command's own folder.

Decided by: Jev (hardToRevert 0.64) · agent said false

## What I did meanwhile

The command reads the page through the same client as every other terminal call, with the same sign-in renewal.

## What it costs to change later

Moving the call later is a few lines in two files; nothing stored depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The plan lists the new command's files but not the shared client, nor the two tests whose counts any new command or hook changes. (author)
