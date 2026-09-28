---
id: s2-01-dashboard-part-contract
prd: 328
slice: s2
rank: medium
bears-on: none
raised: 2026-09-28
wave: 1
---

## The question, in plain words

What does each part of the dashboard get to work with, so that the people building the rankings, the chart and the counts never have to touch a shared file?

## The decision, in plain words

Every part gets the same things: who is reading, their workspace, their GitHub login and fleet, the time, the season, and the game's scores, read once for the whole page. A part that fails to load says so on its own, and the rest of the page still shows.

## The intro, for fun

Three builders, one page, and nobody may touch the shared walls.

## The punchline, for fun

So every room got the same set of keys, and one shared copy of the scoreboard.

## The options, in plain words

A. A: the wider input, the option built: person, workspace, login, fleet, time, season, and the galaxy read once for the page.
B. B: only what the plan named (person, workspace, login, time): each part reads its own galaxy and fleet, and a visit may read the whole ledger up to three times.
C. C: the wider input, and the crew's names read once for the page too, for the rankings.

## What I had to decide

Whether the input every part's loader receives carries the person's fleet, the season and one shared read of the galaxy, beyond the person, workspace, login and time the plan named.

## What I did meanwhile

Each part's loader receives the database as the person, the workspace id, the user id, the GitHub login in lower case, the fleet, now, the season, and a galaxy read made once per request for whichever parts ask. It resolves with its value or unreadable, and a loader that throws is read as unreadable with its error logged. Each part's view receives its value and the season; each part's demo receives the demo world and the demo person.

## What it costs to change later

One type and the page's loader: the three parts are stubs today, so nothing reads the extra fields yet, and dropping one breaks no stored data.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- whether wave 2 needs more in the shared input, such as the crew's names, which each part reads for itself today (author)
