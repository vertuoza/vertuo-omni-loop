---
id: s5-01-scores-leave-with-the-player
prd: 160
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

A player's best scores are stored against their player record. When someone leaves a company space and their player record goes with them, what happens to their scores?

## The decision, in plain words

Their scores go with their player record, as the record already goes when they leave. A departed player no longer holds a line in the crew's table, and the weekly backup still has their scores for three months.

## The intro, for fun

Every high score table has a legend who left years ago.

## The punchline, for fun

Ours clears their line when they go, so nobody chases a ghost.

## The options, in plain words

A. Scores leave with the player record: the option built.
B. Keep a departed player's scores on the table, under the name they had.
C. Refuse to remove a member who holds a score until someone clears it.

## What I had to decide

The spec's table gives arcade_scores the key (workspace_id, user_id, game) pointing at players, and says scores cannot be rebuilt, so the weekly backup keeps them. It does not say what a removed player's scores become. PRD 100 made a player row go when its membership goes (players references workspace_members on delete cascade).

## What I did meanwhile

`supabase/migrations/20260926180000_arcade_scores.sql` references `players (workspace_id, user_id) on delete cascade`: removing a member removes their player row, then their scores. Without the cascade, removing a member who holds a score would be refused by the foreign key.

## What it costs to change later

Medium: another answer is a migration that changes the foreign key; the scores of anyone removed before it come back only from the weekly backup, kept 90 days.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the crew wants a departed player's best to stay on the cabinet.
