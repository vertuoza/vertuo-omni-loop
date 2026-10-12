---
id: s6-02-harvest-reads-and-bridge
prd: 1665
slice: s6
rank: medium
bears-on: none
raised: 2026-10-12
wave: 3
---

## The question, in plain words

The shared GitHub helper file was to keep only what writes, but the knowledge harvest, left out of this change, still reads two facts through it: where should those two reads live?

## The decision, in plain words

I moved the harvest's two reads into the harvest command itself, its only user, unchanged, and deleted the old bridge that turned GitHub answers into the new reads, since nothing used it any more.

## The intro, for fun

Spring cleaning found two borrowed mugs in the shared cupboard.

## The punchline, for fun

They went back to the one desk that drinks from them.

## The options, in plain words

A. A. The harvest's two reads move into the harvest command; the unused bridge is deleted (built).
B. B. Leave the harvest's two reads in the shared helper file, against the plan's wording.
C. C. Move them to a new helper file of their own beside the shared one.

## What I had to decide

kit/bin/github.ts held pullRequestFor and pullRequestFilesFor (gh api repos/<r>/pulls/<n> and its files), used only by kit/bin/commands/harvest.ts, which the spec keeps on gh. Done-when: github.ts keeps only its write helpers and githubEnv. Built: both moved, private, into harvest.ts (outside s6's territory: one import line and two functions; the harvest tests pass unchanged). kit/lib/loop-reads/gh-bridge.ts and its test (s3's ground) are deleted: no file imports it after s4 and s5. ghClient's listComments stays: it reads only to find the comment a write updates. The guard test follows the seven commands' imports and does not reach harvest.ts.

## What I did meanwhile

Ran the harvest, flow, github and loop-reads tests: green.

## What it costs to change later

Moving two functions back, or restoring the bridge from git history.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether the harvest's reads should later move to the Omni page too (the spec keeps the setup commands on gh for now).
