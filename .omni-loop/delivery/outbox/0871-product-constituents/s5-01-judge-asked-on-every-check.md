---
id: s5-01-judge-asked-on-every-check
prd: 871
slice: s5
rank: medium
bears-on: none
raised: 2026-10-01
wave: 3
---

## The question, in plain words

Should the inbox check ask the judge again every time it runs, or remember the judge's answer like it remembers the small model's?

## The decision, in plain words

It asks the judge every time, and only remembers the small model's answer. A workspace that switches Jev on or off sees the change at the next re-run, at the price of one judge call per run.

## The intro, for fun

Ask once and remember, or ask every time and stay fresh?

## The punchline, for fun

The judge gets a call on every re-run, even when nothing has changed.

## The options, in plain words

A. A. Ask the judge every time; cache only the small model's verdict.
B. B. Cache the judge's answer too, so a re-run with nothing changed calls nobody.
C. C. Cache the judge's answer for a short while, such as ten minutes.

## What I had to decide

Whether the judge's answer is cached with the small model's verdict.

## What I did meanwhile

The small model's verdict is cached by the repository, the spec, the claims and the latest change to the constituents; the judge is asked on every evaluation, so with Jev on, each re-run makes one Jev call.

## What it costs to change later

Adding the judge's answer to the cache is a few lines in the canon gate; the price is a mode switch that only counts after the spec or the lines change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the cache key gains the latest event id but not whether the judge's answer is part of what is cached (author)
