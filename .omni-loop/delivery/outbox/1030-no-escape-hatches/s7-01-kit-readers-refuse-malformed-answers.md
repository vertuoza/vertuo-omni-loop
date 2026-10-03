---
id: s7-01-kit-readers-refuse-malformed-answers
prd: 1030
slice: s7
rank: medium
bears-on: none
raised: 2026-10-03
wave: 2
---

## The question, in plain words

When the loop's own tool reads an answer from GitHub, a sign-in, or the answers people left on a pull request, and a value has the wrong shape, should it stop with a clear error or carry on as before?

## The decision, in plain words

It now stops with an error naming the field, where before it carried on with the value missing. Every command prints exactly what it printed before on well-formed answers.

## The intro, for fun

The loop's tool used to take every answer on trust.

## The punchline, for fun

Now it reads the label before drinking.

## The options, in plain words

A. A. Strict schemas on every kit reader, failing loudly with the field named: the option built.
B. B. Keep the hand checks and read a missing field as before, typing the answers without parsing them.
C. C. Parse strictly but, on a failure, log it and fall back to the old reading.

## What I had to decide

Whether the kit's readers of the pull-request care query, the access token's claims and the reply rows (the comments and items `planReplies` reads, which the arcade's Outbox tab also calls) refuse a malformed value, as the spec's strict schemas ask, or keep reading a missing field as before.

## What I did meanwhile

Each is parsed with a zod schema: the care query's answer (required: the PR's number, url, state and branch names, a thread's id, a label's name), the token's claims (`exp` a number, the others optional strings), and the reply rows (an item's id, rank and the four sections read; a comment's id a number). A token whose claims do not parse is refused as not a Supabase session. Items keep every field they carry (loose objects), so what comes back is what went in. A plan repository with no slug now fails naming the missing slug, not with a TypeError. The board and the rework plan type a missing wave and a missing feature branch as null, keeping their output as it was.

## What it costs to change later

Loosening one field is a one-line schema change; nothing stored changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) only the PRD 1030 feature PR's live care answer and board were compared old bundle against new; a sign-in token was tested on fixtures only
- the arcade's Outbox tab calls the reply reader: a malformed item now fails that read instead of showing it, which s4 already made the rule for its own reads
