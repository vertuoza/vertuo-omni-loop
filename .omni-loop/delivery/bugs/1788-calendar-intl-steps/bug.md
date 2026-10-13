# Bug 1788: /app dashboard waits 8s on the galaxy fold, which counts working time in 15-minute Intl steps

## Triage

- **Domain:** game: the working calendar (`game/calendar.ts`), read by the galaxy fold, the economy, the planet state and the banner
- **Risk:** high — every member waits 8s or more for their dashboard on each visit, because the galaxy fold spends most of its time counting working minutes; the page does load, and there is no workaround. (Jev, 0.98)
- **Regression:** new bug — no evidence this ever worked: the calendar has stepped every 15 minutes through Intl since it was written (32b4f09b), and grew slow as the ledger grew

## Reproduction

- **File:** `game/calendar.test.ts`
- **Red:** AssertionError: expected 2976 to be less than or equal to 100

## Fix

The calendar read Brussels' weekday and hour through `Intl.DateTimeFormat.formatToParts` at every
quarter-hour it counted: about 1.1 million calls per galaxy fold of the production ledger (10,187
events), 90% of its time. It now reads the zone's offset at most twice per UTC day, keeps it, and
works out the weekday and hour by arithmetic, reading a clock-change day hour by hour. The fold of
the production ledger goes from 1.2s to 85ms on a laptop, with the same results.

## Guard

A unit test bounding the Intl calls of a month of working time (red on the old calendar: 2976
calls), and an oracle test holding the counted and added working minutes to the original
quarter-hour stepping across both 2026 clock changes, a weekend and a new year.

## Mutation

mutation: no changed core file against origin/main (4ab2c47b): nothing to mutate
