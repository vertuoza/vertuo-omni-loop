---
id: s7-01-grid-view-carries-its-circuit
prd: 1923
slice: s7
rank: medium
bears-on: none
raised: 2026-10-14
wave: 5
---

## The question, in plain words

The grid must show the name of the circuit it will race, but only the grid's own code knows it, and that code was outside this slice. Was it right to widen the slice by one small change there?

## The decision, in plain words

The grid's code now also says which circuit it will race, and shows a best time only for players who chose that same circuit; a player on the other circuit shows NO TIME. The change is a few lines and a constant to undo.

## The intro, for fun

Two circuits, one grid, and everyone has an opinion about the snow.

## The punchline, for fun

The grid now knows where it is going.

## The options, in plain words

A. A. The grid view carries the circuit's id, and a player on another circuit shows NO TIME (built).
B. B. The grid view carries the circuit's id, and every player shows the best they sent, whichever circuit it was on.
C. C. The arcade reads each entry itself and the grid's code stays as it was.

## What I had to decide

Confirm the grid's code may carry the circuit, or say which other way the screen should learn it.

## What I did meanwhile

The grid shows the circuit of its first arrival, and a time only for players on it.

## What it costs to change later

Undoing it means removing one field from the grid's view and showing every player's own best again, a few lines and their tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says each player's best on the grid is their time on the grid's circuit; whether a player who picked the other circuit shows NO TIME or their own circuit's time is not said (author).
