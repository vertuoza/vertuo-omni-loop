# Bug 2552: runner health and omni runner follow give up when the app is slow

## Triage

- **Domain:** runners — the terminal's follow (`kit/bin/commands/runner-follow.ts`)
- **Risk:** medium — a person following a runner job in the terminal loses its milestones whenever the Omni app is slow for under a minute; the job runs on, and following again or the Runners page is the workaround (Jev, 0.99)
- **Regression:** new bug — no evidence this ever worked: since PRD 2251 (#2252) the follow ended held after 3 failed reads in a row

## Reproduction

- **File:** `kit/bin/commands/runner.test.ts`
- **Level:** unit
- **Red:** AssertionError: expected 'server unreachable · held, not failed…' not to contain 'server unreachable'

## Fix

`omni runner follow` took three failed reads in a row for a page gone: with 10 s timeouts and 5 s pauses, about 40 s of a slow app ended the follow `server unreachable · held, not failed` while the job ran on. It now ends held only after twelve failed reads in a row (`HELD_AFTER` in `kit/bin/commands/runner-follow.ts`), a minute of pauses at least and up to about three when every read times out. The health route's slowness and the `PR:` links read from test output are separate causes, left as follow-ups on the issue.

## Guard

A boundary test in `kit/bin/commands/runner.test.ts`: eleven failed reads in a row are followed through, the twelfth ends held. It fails on main's value (3) and passes here.

## Mutation

mutation: no changed core file against origin/main (bc5ec7ab): nothing to mutate
