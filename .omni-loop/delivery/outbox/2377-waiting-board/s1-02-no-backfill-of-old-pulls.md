---
id: s1-02-no-backfill-of-old-pulls
prd: 2377
slice: s1
rank: medium
bears-on: none
raised: 2026-10-22
wave: 1
---

## The question, in plain words

On the day the board ships, should it already show the changes that were waiting before, even if nobody touched them since?

## The decision, in plain words

No: a change that was waiting before the board shipped shows up the next time anything happens on it, such as a review, a push or a label. Nothing is read twice to fill the board on day one.

## The intro, for fun

The board opens its doors, and the old queue is still outside.

## The punchline, for fun

They come in one by one, as soon as anyone knocks.

## The options, in plain words

A. Fill the board as changes move: no extra read on the first run, the option built.
B. Read every open pull request once, on the first run after the release, so the board is full on day one, at a one-off cost of a few GitHub reads per repository.

## What I had to decide

Whether the first sync after the release reads every open pull request of each repository once, to fill the board, or only the ones that changed since the last sync, as every later run does.

## What I did meanwhile

Only the pull requests the sync already lists (updated since the repository's last sync) are read for waits. A repository the sync never read before gets a full read, as today.

## What it costs to change later

A one-off read could be added later as a constant in apps/galaxy/src/stages/sync/github.ts and sync.ts (an open-pull-requests list for a repository with no waits row yet); no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- How many pull requests wait unchanged in today's repositories, and so how empty the board looks on day one, was not measured (author)
