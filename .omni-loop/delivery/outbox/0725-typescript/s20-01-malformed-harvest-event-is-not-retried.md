---
id: s20-01-malformed-harvest-event-is-not-retried
prd: 725
slice: s20
rank: medium
bears-on: none
raised: 2026-10-01
wave: 5
---

## The question, in plain words

When the request to harvest knowledge from a merged change arrives incomplete, should the app try it again a few times, or give up at once and say which part was missing?

## The decision, in plain words

It gives up at once and leaves its usual failure note on the merged change, naming the missing part. Trying again could not help, since the same incomplete request would come back each time.

## The intro, for fun

A letter with no address on it will not find its way on the fourth try either.

## The punchline, for fun

So the app stops at the first try and says which line was left blank.

## The options, in plain words

A. Fail at once, naming the missing field (built).
B. Retry three times like any other failure, then fail with the same message.

## What I had to decide

Whether a harvest request missing a field is retried three times before failing, or fails at once.

## What I did meanwhile

A malformed request fails at once with a message naming its missing field; the failure comment is posted as before.

## What it costs to change later

Changing it back is one line: throw a plain error instead of a non-retriable one.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) No harvest request has ever been seen arriving incomplete; the webhook always sends every field.
