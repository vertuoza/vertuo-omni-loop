---
id: s5-01-ask-dock-plays-in-arcade-workspace
prd: 757
slice: s5
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

Someone can belong to several workspaces. When they play from the questions page, whose level and whose score table should count: the workspace the arcade plays, or the workspace of the terminal's session?

## The decision, in plain words

The questions page plays exactly as the arcade does: the level, the hero and the score table are those of the workspace the arcade opens for that person, whatever workspace the terminal's session belongs to.

## The intro, for fun

Two workspaces, one Game Boy, and a scoreboard that can only hang on one wall.

## The punchline, for fun

So the score goes where the arcade already keeps it, and nobody has to pick a wall.

## The options, in plain words

A. A. Play in the workspace the arcade opens for the person, so level and scores match the arcade exactly (what was built).
B. B. Play in the workspace of the terminal's session, so the score lands where the questions were asked.
C. C. Show no dock when the two workspaces differ.

## What I had to decide

Which workspace's level and score table the play dock on the questions page uses, for a person who belongs to more than one.

## What I did meanwhile

The page reads the player the way the arcade does: the first workspace joined, its player row for the hero and fleet, and the XP row by GitHub login; scores are saved to that workspace.

## What it costs to change later

Switching to the session's workspace is changing which workspace id one server read passes on: minutes, no migration.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the arcade's rules apply and scores go to the arcade's scores as they do there, but not which workspace counts when the session's workspace differs from the arcade's. (author)
