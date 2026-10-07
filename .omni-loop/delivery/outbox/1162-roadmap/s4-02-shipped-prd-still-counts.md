---
id: s4-02-shipped-prd-still-counts
prd: 1162
slice: s4
rank: medium
bears-on: none
raised: 2026-10-07
wave: 2
---

## The question, in plain words

Once a project of a roadmap has shipped, does the roadmap check still accept its row?

## The decision, in plain words

Yes: a row passes when its project's folder is in the inbox or already shipped, and its spec is compared wherever it lives. Otherwise every roadmap would fail its check as soon as its first project merged.

## The intro, for fun

A roadmap that fails the moment it succeeds would be a strange reward.

## The punchline, for fun

Shipped projects keep their seat at the table.

## The options, in plain words

A. A. Inbox or shipped folder (built).
B. B. Inbox folder only, so a roadmap must be edited each time one of its projects ships.

## What I had to decide

Whether a roadmap row needs its project in the inbox only, as the spec words it, or in the inbox or the shipped folder (built).

## What I did meanwhile

The check reads each row's project from the inbox or the shipped folder; only a project with neither is refused.

## What it costs to change later

Narrowing it to the inbox is one condition in the roadmap reader and one test.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says inbox folder; whether it meant to refuse shipped projects was not settled (author).
