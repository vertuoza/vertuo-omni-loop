---
id: s2-02-inbox-folder-without-phase-0-dated-at-sync
prd: 587
slice: s2
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

When a plan folder sits in the inbox but the sync cannot find the pull request that put it there, when did the plan reach the inbox?

## The decision, in plain words

We record it as reaching the inbox at the time of the sync, the same rule the spec gives for a shipped folder whose pull request is not found.

## The intro, for fun

The folder was clearly in the inbox, but nobody remembered carrying it there.

## The punchline, for fun

So we stamped today's date on it and told it to stop being mysterious.

## The options, in plain words

A. Date it at the sync's time, the option built.
B. Leave the inbox stage unrecorded until its pull request is found, so the page shows the stage before it.

## What I had to decide

The date of the inbox stage for a folder in inbox/ whose merged phase-0 PR is not among the pull requests read. The spec gives the sync-time rule only for shipped/.

## What I did meanwhile

src/stages/sync/core.ts records inbox at the sync's time for such a folder; a folder in shipped/ gets inbox only when its phase-0 PR is found. The PRD stage is recorded only from a labelled issue, never guessed from a folder.

## What it costs to change later

One line in the core; the dates already written stay, since a stage keeps its first date.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) How many inbox folders in the workspaces' repositories have no phase-0 PR the sync can see.
