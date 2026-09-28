---
id: s6-01-board-refreshed-for-inbox-prds-only
prd: 324
slice: s6
rank: medium
bears-on: none
raised: 2026-09-28
wave: 5
---

## The question, in plain words

The status line keeps a copy of a PRD's slices fresh in the background, asking GitHub once a minute. For which PRDs should it do that?

## The decision, in plain words

Only for a PRD waiting in the inbox or being built, the two stages where the slices show or can change the stage. A shipped PRD, one still in review, or one read without a main branch never makes it ask GitHub.

## The intro, for fun

The line could ask GitHub about any PRD it names, so it had to pick which ones earn a knock every minute.

## The punchline, for fun

Shipped and in-review PRDs now rest in peace, and nobody knocks on their door.

## The options, in plain words

A. Keep the copy fresh only for PRDs in the inbox or being built, where the slices show or change the stage: the option built.
B. Keep it fresh for every PRD the line names, shipped and in review included, so it is ready the moment it is needed.
C. Keep it fresh only for PRDs the line already shows as being built, so a PRD that only its slices would move there never gets one.

## What I had to decide

For which PRDs the status line starts the background refresh (`omni statusline --refresh <n>`) when the cached board is missing or a minute old. The spec's "The board" says when a board is refreshed, not for which PRDs. The board only matters for a PRD whose folder is in the base inbox: its slices show in the outbox only, and by D9 it moves a PRD from inbox to outbox.

## What I did meanwhile

`readPrd` in `kit/lib/statusline/facts.mjs` reads the board, and starts its refresh, only when the PRD's folder is in `inbox/` on the base and not in `shipped/`. A shipped PRD, a PRD in review and a PRD with no base (no stage) read no board and start no refresh; `kit/lib/statusline/facts.test.mjs` and `kit/bin/statusline.test.mjs` pin it.

## What it costs to change later

One condition in `kit/lib/statusline/facts.mjs` and the cases pinning it in its test and in `kit/bin/statusline.test.mjs`. No stored data: a board file is rewritten on every refresh.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) The spec says when a refresh starts (a board missing or 60 seconds old, no live lock) but not whether it starts for a PRD whose line can never show slices: shipped, in review, or read with no stage.
