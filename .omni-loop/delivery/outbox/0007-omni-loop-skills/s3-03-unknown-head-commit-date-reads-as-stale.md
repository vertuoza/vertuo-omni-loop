---
id: s3-03-unknown-head-commit-date-reads-as-stale
prd: 7
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When a pull request's head commit date cannot be read at all, should the board assume the claim has moved on so it is never called stale, or assume it has not so an old, quiet draft still gets flagged?

## The decision, in plain words

An unknown head commit date is treated the same as no commit beyond the claim, so an old, quiet draft can still be flagged even when this one signal is missing.

## The options, in plain words

A. Missing head commit date reads as no commit since the claim (what was built) — an old, untouched draft can go stale even without this signal.
B. Missing head commit date reads as unknown, so the slice is never marked stale on this signal alone — only a known, unmoved commit date does.

## What I had to decide

What the claimed-stale check does when a pull request payload carries no head commit date at all.

## What I did meanwhile

Read a missing head commit date as no commit since the claim — the conservative direction, since the whole point of this state is to surface a claim nobody is working on; staying silent just because one field was missing would let a truly abandoned claim hide.

## What it costs to change later

Flipping the fallback is a small, local change with no format change; it only matters when `gh` cannot supply commit history for a pull request.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The task names the head commit date as available only "if available", without saying what to assume when it is not.
