---
id: s1-01-regenerate-kart-still
prd: 1447
slice: s1
rank: medium
bears-on: none
raised: 2026-10-10
wave: 1
---

## The question, in plain words

The picture of OMNI KART on its arcade cabinet is a stored copy of the circuit's drawing that had to be drawn again now the circuit floats over space, in a file outside the slice's list of places. Was it right to redraw it here?

## The decision, in plain words

The cabinet's picture was redrawn from the new circuit in this slice, because its own test fails otherwise.

## The intro, for fun

A circuit that floats in space needs a postcard that does too.

## The punchline, for fun

The old postcard still showed solid ground.

## The options, in plain words

A. A. Redraw the still in this slice, as built.
B. B. Leave the still stale and redraw it in a later slice, with the preflight red until then.

## What I had to decide

Regenerated apps/galaxy/src/arcade/games/stills.ts with the stills test's own update command; only the test file was in the territory.

## What I did meanwhile

The slice's test for the cabinet's still would stay red, and the sub-PR could not go green.

## What it costs to change later

Nothing to undo beyond a re-run of the update command; the file is generated.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan meant the generated still to be redrawn by slice s3 or later instead (author)
