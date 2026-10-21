---
id: s7-01-s7-adr-names-renamed
prd: 2305
slice: s7
rank: high
bears-on: ADR-0058
raised: 2026-10-21
wave: 2
---

## The question, in plain words

Five decision records named the maintainer's real repositories when saying where an idea came from; they now name the fictional ones. Do you approve the renamed records?

## The decision, in plain words

Only the repository names in those five records changed; what each record decided is the same, and one of them now matches the real package name.

## The intro, for fun

Five old decisions got new name tags, and none of them changed its mind.

## The punchline, for fun

The history still says what was decided, just not where the idea was born.

## The options, in plain words

A. A. Keep the renamed decision records, as built.
B. B. Restore the original names in those five records and list them as an exception to the guard.

## What I had to decide

Approve the renamed names in decision records 0012, 0019, 0058, 0095 and 0116, or have them restored as an exception. Raised at the finish by the orchestrator: slice s7 renamed them without an item.

## What I did meanwhile

The records are renamed on the feature branch; the guard and every check are green.

## What it costs to change later

Restoring them is a mechanical edit of five records plus one allowlist entry each.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a decision record should keep naming where its idea came from, even as a fictional name (author)
