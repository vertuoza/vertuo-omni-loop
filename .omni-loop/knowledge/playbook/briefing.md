---
form: briefing
form-version: 1
state: filled
points-to: null
evidence:
  - README.md@7eaaaa0
  - apps/galaxy/.env.example@a092419
terraformed: 2026-09-25
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
- Never lower a coverage floor or add a suppression to turn a check green.
- Never reformat files you did not change: format only what you touched.
- A red check on your pull request is yours to fix. Read the CI page first; after
  `3` attempts, leave a comment saying what is stuck.
- A pull request you own carries `omni:in-progress` and a status comment you keep current,
  until it is green or stuck.

TODO(human): README.md warns that the game's ledger projection writes permanent history (run it against production only once the sectors hold the real repositories), and apps/galaxy/.env.example keeps the Supabase secret key out of the browser. Should these be never lines here, and what else costs the most when broken?

## Hooks
<!-- slot: hooks · optional -->

## Where to read next
<!-- slot: next · optional -->
