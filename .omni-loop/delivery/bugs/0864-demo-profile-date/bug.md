# Bug 864: the demo profile test fails depending on today's date ('no demo lists')

## Triage

- **Domain:** galaxy app demo world: the demo roster (`apps/galaxy/src/dashboard/board/demo.ts`), read by the demo board, fleet and person profile
- **Risk:** low — demo mode only: on a season's first morning the demo's you (DAM-DEV) drops off the demo roster, so their demo profile says "not in this workspace"; real workspaces are untouched (Jev, 0.79)
- **Regression:** new bug — no evidence this ever worked

## Reproduction

- **File:** `apps/galaxy/src/dashboard/board/demo.test.ts`
- **Red:** AssertionError: 2026-10-01T00:30:00Z: expected [] to deeply equal [ ObjectContaining{…} ]

## Fix

The demo roster was the season's heroes plus two newcomers, and a season is a calendar month: on its
first morning the demo's you had no point yet, so was no hero and no member, and `demoProfile('dam-dev', …)`
answered "not in this workspace". The roster now always holds the demo's you, solo, adding them when the
season's heroes do not name them yet; the profile render test uses a fixed clock instead of `new Date()`,
mid-season and on a season's first morning.

## Guard

The roster test over four season first mornings (2026-10-01 00:30 and 08:00, 2026-11-01, 2027-01-01) fails on main's `demoRoster` and passes here, and the render test no longer reads today's date.

## Mutation

not set here
