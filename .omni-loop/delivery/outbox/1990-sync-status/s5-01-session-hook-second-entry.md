---
id: s5-01-session-hook-second-entry
prd: 1990
slice: s5
rank: medium
bears-on: none
raised: 2026-10-15
wave: 2
---

## The question, in plain words

The sync refresh needed a place in the session-start hook list, and an older test outside this slice's files pins that list to one entry. Where should the refresh go?

## The decision, in plain words

The refresh is its own second entry next to the constituents one, and the older test that pins the list now expects both. That keeps every other hook test as it was.

## The intro, for fun

Two things want to start with the session, and the door only had one hook.

## The punchline, for fun

Now each gets its own hook, and neither waits for the other.

## The options, in plain words

A. A. The refresh is its own second start-up hook, and the older hook test expects both.
B. B. The refresh joins the first start-up hook, and two older hook tests change.

## What I had to decide

Add omni sync --background as a second SessionStart entry and update kit/bin/constituents.test.ts, one file outside the slice's territory, to expect both entries.

## What I did meanwhile

Sessions start the sync refresh in the background beside the constituents; nothing blocks.

## What it costs to change later

Moving the refresh into the constituents entry later is a two-line change in hooks.json and its three tests.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- Whether the plan meant the territory to include kit/bin/constituents.test.ts (author)
