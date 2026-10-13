# Bug 1800: the season cache never stores — the galaxy is over Next's 2 MB data-cache limit

## Triage

- **Domain:** the arcade's season cache (`apps/galaxy/src/data/season-cache.ts`, PRD 657 s8), read by /app, /app/workspace, /app/fleet and /play
- **Risk:** high — every member waits 14 to 26 seconds for the dashboard, the workspace, the fleet and the play pages on each visit, because the season is recomputed from the whole ledger every time; the pages do load, and there is no workaround. (Jev, 0.97)
- **Regression:** new bug — no evidence this ever worked: the cache stores the season whole, and no log shows when the season last fitted under 2 MB; it fails now because the ledger grew

## Reproduction

- **File:** `apps/galaxy/src/data/season-cache-size.test.ts`
- **Red:** AssertionError: expected 2156998 to be less than 2097152

## Fix

Next's data cache refuses an entry over 2 MB and keeps nothing ("items over 2MB can not be cached"),
and production's season had grown to 2.06 MB of JSON, most of it the planets' logs and open wounds,
so the pages folded the whole ledger on every view. The season cache now hands Next the season's JSON
gzipped in base64 (202 KB for production's season, 10 ms to pack, 5 ms to unpack), and reads it back
through a check of a season's fields; an entry that holds none (one stored before seasons were
packed, or one that does not unpack) is folded again, as on a miss.

## Guard

The reproduction: a season grown past 2 MB must reach Next as an entry under the limit and read back
as folded (red on main's cache, 2,156,998 bytes). Two more tests hold the read-back path: a whole
season is folded once and read from the stored entry, and an entry holding no season, stored before
seasons were packed, or not unpacking is folded again.

## Mutation

mutation: no changed core file against origin/main (9086e70f): nothing to mutate
