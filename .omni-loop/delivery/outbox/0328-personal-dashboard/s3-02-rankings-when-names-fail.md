---
id: s3-02-rankings-when-names-fail
prd: 328
slice: s3
rank: medium
bears-on: none
raised: 2026-09-28
wave: 2
---

## The question, in plain words

The rankings need the season's scores and the players' names. If only the names cannot be loaded, should the rankings still show, with GitHub names in place of display names?

## The decision, in plain words

No: when either cannot be loaded, both rankings tables say they could not load, as every other part of the page does when one of its reads fails.

## The intro, for fun

The scores arrived on time, but the name tags got lost in the post.

## The punchline, for fun

Rather than seat everyone under their GitHub handle, the tables ask for a reload.

## The options, in plain words

A. Both tables say they could not load, the option built.
B. Both tables show, each person named by their GitHub login, and the error kept in the server's log.
C. The fleets table shows, and only the individuals table says it could not load.

## What I had to decide

What the rankings show when the season's galaxy is read but the workspace's players, whose display names the individuals wear, cannot be. The spec and the plan name only the galaxy's failure for the rankings.

## What I did meanwhile

The rankings' loader reads the galaxy and the workspace's players (loadCrew) in parallel; either failing throws, the page's settle logs the error and marks the whole part 'unreadable', and both tables read 'Couldn’t load this. Reload in a moment.'

## What it costs to change later

A few lines of the rankings' loader: catch the players' read, log it, and name every hero by login.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec and the plan say what the rankings show when the galaxy cannot be read, and do not name the players' read failing on its own (author)
