---
id: s3-03-empty-state-only-with-nothing-tracked
prd: 612
slice: s3
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The Engineering board has an empty state. Should it show when nothing is tracked, or also when repositories are tracked but not collected yet?

## The decision, in plain words

The empty state shows only when the workspace tracks no repository. A workspace that tracks repositories not collected yet sees the board with zeros, each tracked repository listed in the table.

## The intro, for fun

The board opens its shop before the first delivery truck arrives.

## The punchline, for fun

The shelves say zero, and the sign says open.

## The options, in plain words

A. A. Empty only with no tracked repository; zeros otherwise, the option built.
B. B. Empty also while no tracked repository has been collected yet.

## What I had to decide

When /app/engineering shows its empty state (No tracked repositories yet → Settings → Repositories): the spec says both with nothing collected yet and, in its acceptance criteria, for a workspace with no repositories.

## What I did meanwhile

engineeringOf() in apps/galaxy/src/engineering/tally.ts returns the empty state when the tracked list is empty; otherwise the board, zeros kept. Settings → Repositories already says not collected yet on each row that waits.

## What it costs to change later

A one-line change in engineeringOf() and one read of the collection time per repository, which the tracked read can add.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether tracked repositories waiting for their first collection should read as empty, or as zeros (author)
