# Bug 1844: a new ledger event makes the next view reread the whole ledger (~20 s)

## Triage

- **Domain:** the game's season: `apps/galaxy/src/data/season-cache.ts` (the key, the data cache) and `load-galaxy.ts` (the ledger read), read by the dashboard, the workspace page, the fleet page, the profile and the game's planet details
- **Risk:** medium — every signed-in member waits up to ~20 s on the dashboard, the workspace page, the fleet page or a planet's details on the first view after a new ledger event; a reload is fast again, so there is a workaround. (Jev, 0.91)
- **Regression:** new bug — no evidence this ever worked: the season's key has held the newest event and the count since it was written (#664), and a miss only grew slower as the ledger grew

## Reproduction

- **File:** `apps/galaxy/src/data/season-cache.test.ts`
- **Red:** AssertionError: expected 3 to be 1 // Object.is equality

## Fix

The season's key changes with every new ledger event (30–110 an hour), which is right, but a new key
folded the season from a fresh read of the whole ledger: 11 sequential pages of 1,000 rows on
production's 10,571 events. The ledger read is now cached on its own, per workspace, gzipped (284 kB for
production's ledger, under the 2 MB Next refuses), and read again every hour; a new season folds that
copy plus only the rows from its tail on (one page). When the events up to the viewer's newest are not as
many as the viewer's count, or a new row shares the tail's own instant, an event was added behind the
tail, and the whole ledger is read again, as before. The season's key, the viewer's newest-event read
that gates the service key, and the fold itself are unchanged.

Measured before the fix (2026-10-13): one ledger page 10–12 ms in Postgres, the zod parse of every row
9–42 ms, the fold ~250 ms and the pack ~30 ms on a laptop; no stage of one miss comes near 20 s, so the
rest is the miss happening to many views at once (`pg_stat_statements`: 4,801 full-ledger page reads
against 1,573 newest-event reads), which the timings available here could not split further.

## Guard

The reproduction: a 2,500-event ledger, one new event, and the second load may read one page, not three;
red on main, green here. Beside it, the cases that must still read the whole ledger again (an event
backfilled behind the tail as a new one comes; a new event at the tail's own instant, red when that check
is removed), a cached ledger newer than the viewer's read folding only up to the viewer's newest, and a
read ledger twice production's size packing under 1 MB.

## Mutation

mutation: no changed core file against origin/main (c7b6b086): nothing to mutate
