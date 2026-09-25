---
id: s3-01-matchby-narrows-not-replaces-branch-match
prd: 7
slice: s3
rank: medium
bears-on: none
raised: 2026-09-25
wave: 2
---

## The question, in plain words

When deciding which pull request belongs to a slice, should the base-branch-or-label setting be the only rule, or just an extra check alongside matching the branch name itself?

## The decision, in plain words

The branch name always has to match the slice first; the base-branch-or-label setting is only an extra check on top of that, not a replacement for it.

## The options, in plain words

A. Keep the base-branch-or-label setting as a secondary filter alongside the head-branch match (what was built).
B. Make the base-branch-or-label setting the only rule, matching a slice by base branch or label alone, without checking the head branch name at all.

## What I had to decide

How `board.matchBy` (base vs label) combines with matching a pull request's head branch to a slice.

## What I did meanwhile

Treated `matchBy` as a secondary filter alongside an exact head-branch match, rather than the only way to find a slice's pull request — matching by branch name already ties a pull request to exactly one slice, so `matchBy` only narrows an ambiguity, it does not replace the branch check.

## What it costs to change later

Changing which check wins is a small, local change to the matching function; no stored data or file format changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Neither the spec nor the plan says whether `matchBy` is the sole matching rule or a secondary filter alongside the head branch.
