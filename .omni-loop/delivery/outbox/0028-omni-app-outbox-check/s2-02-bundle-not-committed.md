---
id: s2-02-bundle-not-committed
prd: 28
slice: s2
rank: medium
bears-on: none
raised: 2026-09-25
wave: 1
---

## The question, in plain words

The plan says to rebuild the kit's single-file bundle and commit it, but the repository is set to never track that bundle. Should it be committed anyway?

## The decision, in plain words

The bundle was rebuilt and checked to build cleanly, but not committed, because the repository deliberately ignores it and this repository runs the kit from source.

## The options, in plain words

A. A: Rebuild to prove it builds, keep it untracked as the ignore rule says (built).
B. B: Lift the ignore rule and commit the bundle with every kit change.

## What I had to decide

Whether the built bundle should be tracked in this repository, which means lifting the ignore rule, or stay a build output produced on demand.

## What I did meanwhile

The bundle builds cleanly from the changed kit and stays untracked; this repository's own command runs the kit source directly, so it already sees the new default.

## What it costs to change later

Removing one ignore rule and committing one generated file, then rebuilding it on every kit change.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether an installed repository will copy the bundle from this repository's history or from a release build is not settled.
