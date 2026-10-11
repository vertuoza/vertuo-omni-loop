---
id: s4-01-kart-late-arrival-race-on
prd: 1572
slice: s4
rank: medium
bears-on: none
raised: 2026-10-11
wave: 3
---

## The question, in plain words

How should a player who joins the grid in the middle of a race know that a race is on, since they never received its start?

## The decision, in plain words

The grid reads a race as on for as long as it keeps hearing the racers' positions, and says how many racers it hears. Three seconds after the last position it reads the grid again.

## The intro, for fun

A latecomer opens the door of a room where everyone is already running laps.

## The punchline, for fun

The grid listens for engines and counts the ones it hears.

## The options, in plain words

A. Listen to the racers' own position messages: a race is on while any arrive, within the last three seconds
B. Add a message the starter sends again every few seconds while the race lasts, at a cost in the shared message budget
C. Keep a race flag in the presence entry of each racer, which adds a field to what every player tracks

## What I had to decide

Pick how a late arrival learns a race is on. A relies on the positions the racers keep sending, so it needs no new message and no extra traffic. The cost is a delay of up to three seconds before the grid reads a race as over.

## What I did meanwhile

A late arrival reads RACE ON with the number of racers it hears, and cannot start a race.

## What it costs to change later

Changing it later is a constant or one extra message, with no stored data involved.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec names the line RACE ON · <n> RACERS but not how it is known (author)
