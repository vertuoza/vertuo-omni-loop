---
id: s8-01-reply-comments-typed-not-parsed
prd: 725
slice: s8
rank: medium
bears-on: none
raised: 2026-10-01
wave: 4
---

## The question, in plain words

The reader of pull request replies takes the comments GitHub sends as they come. Should it check every comment against a strict shape before reading it?

## The decision, in plain words

The reader keeps reading comments as it does today, with their shape only described for the compiler, so no reply that counts now is ever dropped.

## The intro, for fun

Every comment from GitHub walks in without showing its papers.

## The punchline, for fun

The doorman got a guest list, not a metal detector.

## The options, in plain words

A. Keep reading comments as today, typed for the compiler but not checked at runtime
B. Check each comment against a lenient shape and skip any that fails, saying which field was wrong
C. Check each comment against a strict shape and stop the run on the first one that fails

## What I had to decide

Whether the GitHub comments readReplies and planReplies read (body, user, author_association, created_at, html_url) must pass a Zod schema, as the plan's done-when asks of every value read from the network.

## What I did meanwhile

kit/lib/outbox/replies.ts describes the comment as a ReplyComment type and narrows it at runtime exactly as before (a comment whose body is not a string is skipped by isCountedReply). No schema parses it, because a strict one would refuse comments the reader tolerates today, which changes output; the arcade also calls planReplies with its own rows.

## What it costs to change later

One schema in kit/lib/outbox (all fields optional, unknown keys kept) parsed at the top of planReplies, plus deciding what a comment that fails it becomes: skipped, or an error naming its field. No stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a malformed comment from GitHub should be skipped silently, as today, or fail the run with its field named
- (author) Whether the arcade's own GitHub reader should parse the same comments first, so the kit's reader receives parsed rows only
