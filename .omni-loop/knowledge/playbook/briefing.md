---
form: briefing
form-version: 1
state: filled
points-to: null
evidence:
  - README.md@e0d3c68
  - apps/galaxy/.env.example@27019dd
invaded: 2026-10-20
---

# Briefing

Use this page when a session starts: the rules that cost the most when broken.

## Never
<!-- slot: never · required -->
- Never merge into `main`. A person does.
- The `release` workflow's version commit, `chore(release): v0.0.N` after every merge, is the one
  push to `main` a person does not make; never make one like it by hand (PRD 347, ADR-0048).
- Before you decide anything the spec does not settle, read the knowledge the change touches. Take
  the most reversible option and record the decision as an outbox item; two principles pulling
  against each other stop that slice.
- Never lower a mutation floor (`mutation/floor.json`) or add a suppression to turn a check green.
- Never mark a pull request ready whose new migration is dated at or before the newest on `main`:
  re-date it first (`node scripts/migration-order.ts`; conventions › A migration stays the newest).
- Never reformat files you did not change: format only what you touched.
- A red check on your pull request is yours to fix. Read the CI page first; after
  `3` attempts, leave a comment saying what is stuck.
- A pull request you own carries `omni:in-progress` and a status comment you keep current,
  until it is green or stuck.
- Never bypass push protection. A blocked push names a secret: rotate it if it is real, build it at
  runtime if it is a fixture.

- Never run `game:project` on production before its sectors hold the real repositories: it writes
  permanent history (README).
- Never give the Supabase secret key a `NEXT_PUBLIC_` name: it stays server-side.

## Hooks
<!-- slot: hooks · optional -->

## Where to read next
<!-- slot: next · optional -->
