---
id: s1-02-pusher-login-and-history
prd: 1798
slice: s1
rank: high
bears-on: none
raised: 2026-10-19
wave: 1
---

## The question, in plain words

How does the server remember who sent a repository's knowledge, and which twenty sends does it keep?

## The decision, in plain words

Each stored graph keeps the sender's account and their GitHub name as it was when they sent it, so pages can say who sent it without reading accounts. The twenty most recently sent commits are kept, and sending an old commit again makes it the newest.

## The intro, for fun

Every graph gets a name tag and a place in a queue of twenty.

## The punchline, for fun

Send an old commit again and it jumps back to the front of the line.

## The options, in plain words

A. A. Keep the sender's GitHub name with each graph, and the twenty latest sent (built).
B. B. Look the name up from the account each time it is shown, and keep the account only.
C. C. Keep the twenty latest commits by the date they were made, which each send would then carry.

## What I had to decide

Whether the stored graph keeps the pusher's GitHub name beside their account (as built) or reads it from the account each time, and whether the twenty kept are the latest pushed (as built) or the latest commits by date.

## What I did meanwhile

knowledge_graphs holds pushed_by (the account, set null when it is deleted) and pushed_by_login (their lower-case GitHub login at the push, from their GitHub identity). knowledge_graph_push() deletes, under a per-repository lock, every row beyond the twenty with the latest pushed_at, so the served graph is the one pushed last, as the spec says.

## What it costs to change later

Medium: dropping pushed_by_login or ordering by commit date is a follow-up migration on a table s3 reads, before production holds many rows.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names pushed_by only, and the read route answers a login (@pierrederval); a login read later from the account cannot be read by a member under row-level security (author).
