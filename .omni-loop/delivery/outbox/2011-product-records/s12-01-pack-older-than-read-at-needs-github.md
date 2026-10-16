---
id: s12-01-pack-older-than-read-at-needs-github
prd: 2011
slice: s12
rank: medium
bears-on: none
raised: 2026-10-16
wave: 3
---

## The question, in plain words

How should the kit tell that a knowledge pack is older than the commit a product link was read at, when the spec only says the pack must be refused?

## The decision, in plain words

The kit asks GitHub to compare the two commits, refuses a pack that GitHub says is behind, and serves the pack with a warning when GitHub cannot answer.

## The intro, for fun

Two commits walk into a bar and nobody knows who came first.

## The punchline, for fun

Without a clock from GitHub, the kit shrugs and says so out loud.

## The options, in plain words

A. A. Refuse only what GitHub says is behind; serve with a warning when the comparison is unavailable (built).
B. B. Refuse the pack whenever the comparison is unavailable, so a stale pack is never used by accident.
C. C. Ask the Omni page for the date of read_at and compare dates, with no GitHub call.

## What I had to decide

Whether an unreadable comparison should refuse the pack (stricter, blocks work offline) or serve it with a note (what was built).

## What I did meanwhile

The slice serves a pack when the comparison is unavailable and prints one line saying the age against read_at was not checked.

## What it costs to change later

Changing the answer is a one-line change in the pack reader: no stored shape, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether a pack that has diverged from read_at (neither ahead nor behind) counts as older: it is served as not older (author).
- Whether the server should answer the commit date of read_at itself so no GitHub call is needed (author).
