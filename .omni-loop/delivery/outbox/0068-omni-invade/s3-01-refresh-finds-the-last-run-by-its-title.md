---
id: s3-01-refresh-finds-the-last-run-by-its-title
prd: 68
slice: s3
rank: medium
bears-on: none
raised: 2026-09-26
wave: 3
---

## The question, in plain words

When the setup is refreshed, how does it know what changed since the last time it ran?

## The decision, in plain words

It looks for the most recent change to the knowledge folder whose title mentions the setup by name, and only re-reads what changed after it. If none is found, it asks for a full run instead.

## The intro, for fun

Picking up where you left off only works if you remember where that was.

## The punchline, for fun

So the refresh reads the last title with its own name on it, like a bookmark.

## The options, in plain words

A. A: the newest merged change to the knowledge folder whose subject says invade (built)
B. B: a date the skill writes into the knowledge folder's front page on every run
C. C: the oldest invaded date among the playbook forms

## What I had to decide

Whether the refresh finds its starting point from the title of the last merged change, or from something written down on purpose, such as a date kept in the knowledge folder.

## What I did meanwhile

The refresh starts from the newest merged change to the front door whose subject says invade, and re-runs only the facets whose sources changed after it.

## What it costs to change later

A constant in one skill's prose: switching to a recorded date is a paragraph rewrite, no data to migrate.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says only 'since the last invade' and does not say how that point is found (author)
- A person who renames the pull request title before merging would hide the run from the search (author)
