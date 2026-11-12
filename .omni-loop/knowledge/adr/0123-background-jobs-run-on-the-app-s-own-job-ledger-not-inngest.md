# ADR-0123 — Background jobs run on the App's own job ledger, not Inngest

**Status:** accepted · **Date:** 2026-11-12 · **PRD:** omni-loop-5 · **Layers:** job

## Context

Until PRD omni-loop-4, the Omni GitHub App ran its background jobs (the pull-request checks, the knowledge pack, the
retro, the knowledge harvest and the main watch) through Inngest, a hosted workflow service. PRD omni-loop-4 moved
every job onto the App's own job ledger in Supabase, so Inngest ran nothing. Its package, its `/api/inngest` route,
its client and its three `INNGEST_*` variables stayed behind, and the install still asked a workspace to set them up.

## Decision

Background jobs run on the App's own job ledger, and nothing in the code base depends on Inngest. The App's job code
lives in `apps/omni-app/src/jobs/`; the names and schemas the jobs share (the checks' external ids, the payload
schemas) live in `apps/omni-app/src/jobs/payloads.ts`. The run log writes a `jobs` line for a job's run.

The `inngest` package, the route, the client and the variables are removed. A guard test in `scripts/` refuses a
tracked file that names Inngest outside the delivery folders and the decision records, so a copied comment or a
restored file is caught in a pull request.

## What it supersedes in the earlier records

Each record that names Inngest as how the App runs its jobs keeps its text, and gains a status line pointing here:
ADR-0001, ADR-0038, ADR-0054, ADR-0057, ADR-0071 and ADR-0102. Where they describe Inngest as the runner, read
ADR-0123 instead: the job ledger runs them.

## Consequences

- A workspace that installs the App sets up GitHub, the database and Vercel, and nothing else.
- The job ledger is the one place a job's retries, timing and run log are read, and its lines name the job, not a
  vendor.
- Log lines written before this decision keep their old name until Vercel's retention drops them.
- The person who runs the App removes the three variables and the Inngest integration from the Vercel project, and
  archives the Inngest account, after the merge (named in the feature PR's body).
