---
id: s4-01-old-rows-still-shown
prd: 728
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

Should the game's pages in the app hide the points and planets recorded before the fresh start, or only the scorer on the command line?

## The decision, in plain words

The app still reads every stored row: old ones show as they did, and only new ones are told apart by their repository. Hiding the old ones is left to one small filter later.

## The intro, for fun

The old ledger rows were told they no longer count, but nobody told the app.

## The punchline, for fun

They are still waving from the back of the room.

## The options, in plain words

A. A. Read every row, as built: old planets and their points stay visible in the app until a filter lands.
B. B. Drop home-less rows in the loader: the app matches the scorer, the map starts empty until the first run.
C. C. Keep old planets on the map but score only rows with a home, in the economy.

## What I had to decide

Whether the app's galaxy (map, planet scenes, the dashboard's Points column) drops ledger rows that carry no home, as the spec asks of every season, fleet and XP. The loader is in this slice; the scorer and XP are s2's.

## What I did meanwhile

load-galaxy reads the home column and passes it on; a row without one keeps its planet keyed by number alone and still counts in the current month's season. No filter was added, because every data and dashboard test fixture outside this slice's territory holds home-less rows and would need a home.

## What it costs to change later

One filter in the loader (home is not null) plus a home on the fixtures of the season-cache, arcade and dashboard tests. Nothing stored changes. If the rollout lands in a new month, old rows fall outside the season anyway and only the map still shows old planets.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) whether the fresh start should also empty the map of old planets, or only zero their points
