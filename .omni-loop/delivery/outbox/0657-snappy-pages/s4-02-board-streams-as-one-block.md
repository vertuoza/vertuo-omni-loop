---
id: s4-02-board-streams-as-one-block
prd: 657
slice: s4
rank: medium
bears-on: none
raised: 2026-09-29
wave: 2
---

## The question, in plain words

The plan asked for each tile and each section of a dashboard board to arrive on its own, but the board is drawn by one piece this step could not split. Is streaming the whole board as one block enough?

## The decision, in plain words

On your own dashboard, your hero, the waiting tile and the board each arrive on their own. On the workspace and fleet dashboards, the whole board arrives as one block under a skeleton of its size, because all its numbers come from the same few reads.

## The intro, for fun

The menu promised each dish would come out as soon as it was ready.

## The punchline, for fun

The dishes on the board share one oven, so they come out on one tray.

## The options, in plain words

A. Stream the board as one block, and Home's three parts on their own (built).
B. Split the board into sections that each wait for their own read, in a follow-up step that may change the board's own files.

## What I had to decide

Whether a board's sections (tiles, charts, People, Repositories, fleet ranking) must each stream in their own Suspense, or whether the board streams as one block. Board.tsx (src/dashboard/board/) is outside s4's territory and exports only Board, and the sections all draw from loadBoard's five reads, settled together.

## What I did meanwhile

/app streams three blocks (hero, Waiting for you, the board) from src/dashboard/stream/home.ts, each with its own skeleton and its own 'could not load'. /app/workspace and /app/fleet stream their whole screen in one Streamed block under the board skeleton; the fleet's picker and heading come from the same read as its board.

## What it costs to change later

Splitting the board later is a change inside the board's folder and the stream folder; no stored data, no contract.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether one board block meets the '1 s warm load' target on production is not measured yet: the timings after merge will tell.
