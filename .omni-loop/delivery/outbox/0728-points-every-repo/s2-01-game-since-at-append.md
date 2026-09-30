---
id: s2-01-game-since-at-append
prd: 728
slice: s2
rank: medium
bears-on: none
raised: 2026-09-30
wave: 2
---

## The question, in plain words

Where should the game drop the events that happened before its fresh start: when it works them out, or when it writes them down?

## The decision, in plain words

It drops them when it writes them down. The step that writes reads the workspace's start moment each time and keeps nothing older, whoever worked the events out.

## The intro, for fun

The ledger got a bouncer who checks every event's birth date at the door.

## The punchline, for fun

No date, no entry, and fake moustaches are not accepted.

## The options, in plain words

A. A. At the write, in the ledger's append, the option built: every caller is covered, one read per poll.
B. B. In the projector, with the start moment passed by the command: pure and visible, but the command must remember to pass it.
C. C. Both: the projector filters and the write refuses anything older as a last guard.

## What I had to decide

The plan puts the fresh start in the projector, but the command that runs the projector (game/cli/project.mjs) is outside this slice's territory, so the projector cannot be handed game_since without leaving the territory.

## What I did meanwhile

supabaseLedger.append (game/sources/supabase.mjs) reads workspaces.game_since at every append and drops every event whose moment is before it; an unknown workspace or a failed read appends nothing. projectEvents is unchanged.

## What it costs to change later

A constant's worth: moving the filter into projectEvents is a new option plus one line in game/cli/project.mjs. Nothing stored changes either way. The append costs one extra read of one row per poll.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- (author) Whether a person prefers the filter visible in the projector too, for the demo seed and other callers of projectEvents that never append to Supabase.
