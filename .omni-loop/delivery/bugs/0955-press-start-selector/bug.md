# Bug 955: PRESS START on HOME skips SELECT YOUR APP

## Triage

- **Domain:** galaxy HOME (`apps/galaxy/src/home`: `start.ts`, `Controls.tsx`)
- **Risk:** medium — a visitor who presses START on HOME is never offered the Omni app and always lands in the arcade; SIGN UP WITH GITHUB further down the page still opens the picker, so there is a workaround. (Jev, 0.98)
- **Regression:** new bug — no evidence this ever worked (PRD 932, #934, put SELECT YOUR APP on SIGN UP WITH GITHUB only)

## Reproduction

- **File:** `apps/galaxy/src/home/start.test.ts`
- **Red:** AssertionError: expected [ 'sound', 'wait 550', 'go /play' ] to deeply equal [ 'select your app' ]

## Fix

PRESS START always played the start jingle and opened /play: it never read the pick SELECT YOUR APP
saves, and never opened the overlay. `pressStart` now takes the app picked, or the remembered one,
and with neither opens SELECT YOUR APP; the Omni app opens /app, the Arcade is the game as before.
`Controls` opens the overlay from a PRESS START click or Enter, and its pick presses START instead
of signing up; the Konami code still starts the game.

## Guard

none — the bug was a gap in PRD 932's spec, not a slip in the code; the reproduction pins PRESS START's answer for each pick, and none.

## Mutation

not set here
