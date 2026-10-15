---
id: s6-01-hud-sync-row-on-nothing
prd: 1990
slice: s6
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

When a session is on no work at all, should the HUD band still show the sync badge on a row of its own?

## The decision, in plain words

Yes: the band now shows the sync badge as its first row even with no work, so a person sees a stale checkout before they start; with no sync record the band hides as before.

## The intro, for fun

The band used to say nothing when there was nothing to say.

## The punchline, for fun

Now it says whether the room is tidy before you walk in.

## The options, in plain words

A. A. Show the badge alone for a session on nothing, as built.
B. B. Keep the band hidden on nothing, and draw the badge only above some work.
C. C. Show the badge alone, and also say there is no work.

## What I had to decide

Whether the HUD stays hidden on a session with no work, as it was, or shows the badge alone.

## What I did meanwhile

The badge shows alone on a session with no work; one condition in the band undoes it.

## What it costs to change later

One condition in the band's rows to change; no stored data and nothing outside the HUD plugin depends on it.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The spec says the band's first row draws the sync status; it does not say what a session on nothing shows (author).
