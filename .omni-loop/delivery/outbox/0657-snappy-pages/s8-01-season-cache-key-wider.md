---
id: s8-01-season-cache-key-wider
prd: 657
slice: s8
rank: medium
bears-on: none
raised: 2026-09-29
wave: 1
---

## The question, in plain words

Should the saved copy of the season also be thrown away when an older event arrives late, or when someone edits a fleet or a sector, even though the newest event did not change?

## The decision, in plain words

Yes. Besides the newest event and the day, the saved season is also tied to how many events exist and to the fleets and sectors, so a late event or a fleet edit shows at once instead of the next day.

## The intro, for fun

The season now keeps a saved copy, like a scoreboard photo taken after the last goal.

## The punchline, for fun

A late goal or a new team colour now retakes the photo, even if the last goal did not change.

## The options, in plain words

A. Key on the newest event, the event count, the sectors and fleets, and the UTC day (built).
B. Key on the newest event and the UTC day only, as the spec says: a late event or a fleet edit shows the next day.
C. Key as in B, and have the settings pages and the game workflow clear the cache tag when they write.

## What I had to decide

Whether the saved season follows only the newest event and the day, as the spec says, or also the event count and the fleets and sectors.

## What I did meanwhile

The key carries the workspace, the newest event's id and time, the event count, a fingerprint of the sectors and fleets, and the UTC day. The count comes back with the newest-event query itself, and the sectors and fleets were already read on every page view.

## What it costs to change later

Nothing to undo but the key: dropping the count and the fingerprint from seasonKey is a one-line change, and the cache refills on its own.

## What I could not know

(author) The PRD, the registers and the glossary do not settle this:

- The game writes the ledger insert-only, but can insert events dated before the newest one (history projected from GitHub): the spec's key would miss those until the next UTC day. (author)
- Whether the exact count stays cheap on a very large ledger was not measured; s9's indexes cover the workspace filter. (author)
