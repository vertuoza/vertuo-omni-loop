---
id: s5-04-scores-read-on-their-own
prd: 160
slice: s5
rank: medium
bears-on: none
raised: 2026-09-26
wave: 4
---

## The question, in plain words

The crew's high scores are read from the database along with the galaxy. What should the game room show when that read fails, who gets them read at all, and what does the demo's table hold?

## The decision, in plain words

The scores are read on their own, only for players who linked GitHub; when that fails, the galaxy and the level still show, the cabinet says the scores are out of reach, and the game still plays. The demo's table holds only the guest's own best.

## The intro, for fun

The scoreboard lives in a back room, and sometimes its door sticks.

## The punchline, for fun

When it does, the arcade stays open and the cabinet admits it cannot see the board.

## The options, in plain words

A. Read the scores on their own for players, say they are out of reach when that fails, and keep only the guest's best in the demo: the option built.
B. Read the scores together with the galaxy, so a failed read shows the whole galaxy as out of reach.
C. Fill the demo's table with made-up crew scores around the guest's.

## What I had to decide

The spec (The arcade, Reading) says the page reads the game's top five from arcade_scores, with the players' names and heroes, along with the galaxy, as the signed-in member, and the Account gains submitScore() and scores(). It does not say what a failed read shows, whether a visitor's page reads them (every cabinet is locked to a visitor), how NEW BEST knows a player's best before the game when they are not in the top five, or what the demo's table holds beside the guest.

## What I did meanwhile

`readScores()` in `apps/galaxy/src/data/scores.ts`, called by `arcadeFor()` beside `readXp()` only when the member has a GitHub login, reads per registry game the top five (best first, the earlier of two equal scores first, names, heroes and fleets embedded from players) and the player's own best. A failed read is logged and becomes 'unreadable': the lit cabinet says SCORES OUT OF REACH and A still plays; the galaxy and the XP are untouched, as for XP (item s2-01-xp-read-in-the-workspace-played). `app/page.tsx` passes an empty table to everyone else, so the Supabase arcade never reads scores in the browser at start. After a game, `ArcadeApp.tsx` merges the returned best into the table, then reads it again through `Account.scores()`. The demo and the artifact ask the demo account's `scores()` on the first render: the guest's own best only, kept in browser storage.

## What it costs to change later

Low: a condition in `arcadeFor()`, one line on the cabinet, and the demo account.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the demo should show made-up crew scores beside the guest's, so its table looks like the approved design's.
