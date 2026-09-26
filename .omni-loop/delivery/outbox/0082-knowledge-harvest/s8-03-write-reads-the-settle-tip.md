---
id: s8-03-write-reads-the-settle-tip
prd: 82
slice: s8
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

The harvest reads the main branch twice, once to settle and once to write the knowledge, and the main branch may move in between. Should the second read take the newest state, or the same state the first read took?

## The decision, in plain words

Both reads take the same state of the main branch, the one the first read found, and the knowledge pull request starts from there. Other open knowledge pull requests are the ones not yet merged.

## The intro, for fun

Measuring a room twice only helps if nobody moves the walls in between.

## The punchline, for fun

So the harvest measures once, writes it down, and uses the same numbers twice.

## The options, in plain words

A. A. Read the same commit in both steps, and cut the branch from it (built).
B. B. Read the newest tip again in the write step, and cut the branch from that newer tip.
C. C. Read the newest tip again, and start the whole harvest over when it moved.

## What I had to decide

The spec's flow says step 'write' snapshots the tip again and step 'publish' cuts from the tip. The settle step's edits (the moves, the ledger's new entries) are planned against the tree it read; applied to a newer tip, a move could name a path that changed. The spec also does not say how the open knowledge branches are found.

## What I did meanwhile

Step 'settle' records the tip's sha; step 'write' snapshots that same sha, and 'publish' cuts the branch from it. The open knowledge branches are the open pull requests into the default branch whose head matches branches.knowledge, this run's own branch left out; each one's knowledge folder and decision records are snapshotted at its head for the ids it takes.

## What it costs to change later

Low: one sha passed between steps. Reading the newest tip instead is one call in the write step; finding knowledge branches by name instead of by open pull request is one query. No stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether 'the tip again' in the spec means a fresh read or the same commit; the flow diagram does not say.
- (author) A knowledge branch whose pull request never opened is not counted; the concurrency limit of one run per repository is what keeps two such runs apart.
