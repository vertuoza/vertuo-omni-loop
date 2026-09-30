---
id: s3-01-canon-cache-in-instance
prd: 839
slice: s3
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

Where should the canon check remember a verdict, so that re-running it on an unchanged spec does not ask the model again?

## The decision, in plain words

It remembers verdicts in the running App while it stays warm. A re-run shortly after costs nothing, but after a quiet spell the first run asks the model once more.

## The intro, for fun

The check has a good memory, as long as nobody lets it fall asleep.

## The punchline, for fun

After a nap it asks the same question once, politely.

## The options, in plain words

A. A. Remember verdicts in the running App only, lost on a cold start.
B. B. Store verdicts in a database table, kept across restarts.
C. C. Read the verdict back from the previous check run on the same commit.

## What I had to decide

Whether a verdict must be remembered across restarts of the App, which needs a new stored table, or whether remembering it while the App is warm is enough.

## What I did meanwhile

The verdict is kept in memory, keyed by the repository, the spec's fingerprint and the claims' latest change, up to 200 verdicts.

## What it costs to change later

Moving it to a stored table is a small migration and a new read and write in the canon module; nothing already stored moves.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec asks for a cache but does not say where it lives, and the plan keeps this slice out of the database (author).
