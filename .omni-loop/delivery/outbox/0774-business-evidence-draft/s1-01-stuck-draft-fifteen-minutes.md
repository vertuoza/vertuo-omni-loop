---
id: s1-01-stuck-draft-fifteen-minutes
prd: 774
slice: s1
rank: medium
bears-on: none
raised: 2026-09-30
wave: 1
---

## The question, in plain words

If a draft stops half way because the server gave up on it, how long should the page wait before letting someone start a new one?

## The decision, in plain words

After fifteen minutes a draft that never finished is marked as failed, and the next click starts a fresh one.

## The intro, for fun

A draft that never comes back should not keep the door locked forever.

## The punchline, for fun

Fifteen minutes of patience, then we knock again.

## The options, in plain words

A. Fifteen minutes, then a new draft may start: longer than any server run lasts
B. Never: a stuck draft blocks until someone clears it by hand
C. A shorter wait, such as five minutes, with a small risk of overlapping runs

## What I had to decide

Whether fifteen minutes is the right wait before a stuck draft stops blocking the next one.

## What I did meanwhile

A draft still running after fifteen minutes is marked failed ('It stopped answering.') and a new one starts.

## What it costs to change later

One constant in the function that starts a draft, changed by a small follow-up migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says one draft at a time but not what happens when one dies before finishing (author).
