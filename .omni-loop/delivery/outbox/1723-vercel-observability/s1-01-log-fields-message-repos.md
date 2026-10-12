---
id: s1-01-log-fields-message-repos
prd: 1723
slice: s1
rank: medium
bears-on: none
raised: 2026-10-12
wave: 1
---

## The question, in plain words

The spec lists which fields a log line may carry, but two later steps need a free sentence and a count of repositories read, which that list does not name. Should those two fields be allowed?

## The decision, in plain words

The logger also allows a short sentence for a person and a count of repositories read. The sentence is masked for credentials and cut to 500 characters, like an error's message.

## The intro, for fun

Two later steps wanted to say a little more than the list of fields allowed.

## The punchline, for fun

So the list grew by two, and both still wear the same mask.

## The options, in plain words

A. Allow a short sentence, masked and cut like an error message, and a count of repositories read, beside the fields the spec names.
B. Keep the spec list exactly: the old sentences go into the error field, and the cron does not log its count.

## What I had to decide

Keep the two extra fields (A), or drop them and have the later steps fit what they say into the fields the spec named (B).

## What I did meanwhile

Lines carry `message` (masked, cut to 500) and `repos` (a number); the App's old sentences and the stages cron's count use them in wave 2.

## What it costs to change later

Dropping a field later is a one-line change to the allow-list and the two callers; nothing is stored.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The name `repos` for the count is mine: the plan says only "how many repositories it read" (author).
