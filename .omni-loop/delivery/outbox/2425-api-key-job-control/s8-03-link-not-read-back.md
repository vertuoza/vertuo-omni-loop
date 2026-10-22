---
id: s8-03-link-not-read-back
prd: 2425
slice: s8
rank: medium
bears-on: none
raised: 2026-10-22
wave: 6
---

## The question, in plain words

May a key read back the link a job pings when it reads the job? The link can carry a secret in its address.

## The decision, in plain words

No: the link is stored with the job and used, never shown, so reading a job never reveals it to another key of the same workspace.

## The intro, for fun

A link may hold a secret, so the job keeps it to itself.

## The punchline, for fun

Whoever sent it knows it, and nobody else reads it back.

## The options, in plain words

A. Never returned: stored, used and never shown.
B. Returned as sent, to every key of the workspace that reads the job.
C. Returned with its address cut to the host, so a secret in the path stays hidden.

## What I had to decide

The spec's table of what `GET /api/v1/jobs/{id}` adds does not include `notify_url`, and any key of the workspace can read the jobs another key sent, so a link with a token in its path would pass from one key to another. I store it, use it and never return it, in a job's read, in a list or in a log.

## What I did meanwhile

Left the link out of the job's public shape, and tested that a job sent with a link reads back without it, through both start routes and the job's read.

## What it costs to change later

Adding it later is one new optional field on the job, which breaks no client; hiding it again after clients rely on it would.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the app that sent the link wants to read it back to check what it registered, which the spec does not say.
