---
id: s1-02-engineering-board-quiet-claims-need-update-time
prd: 2175
slice: s1
rank: medium
bears-on: none
raised: 2026-10-19
wave: 1
---

## The question, in plain words

The Engineering board's Loop health panel cannot see when a pull request was last updated, so should it count quiet claims now, or wait until that time is stored?

## The decision, in plain words

The panel counts a released claim as stale at once, and a quiet claim only when the pull request's update time is known, which the stored rows do not carry yet; so until then it shows released claims and cold ones, never quiet ones.

## The intro, for fun

The panel can read the label, but nobody told it what time it is upstairs.

## The punchline, for fun

It will not guess, so quiet claims wait for their clock.

## The options, in plain words

A. Count released claims now and quiet ones only when an update time is known; store none here.
B. A follow-up stores each pull request's last update time, so the panel counts quiet claims too.

## What I had to decide

Keep the panel as built (A), or store the update time in a later change so quiet claims show too (B).

## What I did meanwhile

The panel uses the kit's own rule, so it never shows a claim `omni board` would read as in flight; it may miss a quiet claim the board already reads as stale.

## What it costs to change later

B is a nullable column on `pull_requests`, the collector writing it, and the loader reading it: a migration, outside this slice.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the collector in the GitHub App can read the update time on the same call it already makes (author).
