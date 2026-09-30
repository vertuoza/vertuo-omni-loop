---
id: s4-01-dock-platformer-score-not-sent
prd: 817
slice: s4
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

Should the corner game box save the new platform game's score, the way it saves the space game's?

## The decision, in plain words

Not yet: the platform game has no score of its own until later slices add one, so the corner box plays it without saving anything, and the space game saves as before.

## The intro, for fun

The new game can be played in the corner already, but it cannot count yet.

## The punchline, for fun

Nothing to save means nothing lost, for now.

## The options, in plain words

A. Play it in the dock without saving the score for now, and wire the saving in a small follow-up once the game keeps a score, as built.
B. Widen the third slice's area to the dock so it saves the score from both places at once.
C. Never save scores from the corner box for this game: only the full arcade saves them.

## What I had to decide

Whether the play dock sends SUPER OMNI WORLD's score in this slice, when the score itself is only built by the next two slices, and the slice that adds score saving does not cover the dock.

## What I did meanwhile

The dock's score sending now takes the game's key, the space game passes its own, and the platform game in the dock sends nothing. Wiring it is one call at game over in the dock's platformer file.

## What it costs to change later

One call and one status line in the dock's platformer screen, once the game keeps a score; no stored data changes.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) the plan gives score saving to the third slice, whose area does not include the dock, and the dock's slice only makes the sending take the game's key
- (author) the game's score and game-over screen do not exist yet when this slice is built
