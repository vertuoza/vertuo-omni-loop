# ADR-0028 — Row-level security checks live in supabase/checks and run in the supabase workflow on every database change

**Status:** adopted · **Date:** 2026-09-26 · **PRD:** #71 · **Decided:** nobody — adopted when raised (medium), 2026-09-25 · **Merged:** @pierrederval, 2026-09-26, PR #73

## Context

The plan's territory for s2 names the migration, the ask routes and `apps/galaxy/src/ask/{api,store,auth}`, but not `supabase/checks/` or `.github/workflows/supabase.yml`. The done-when asks for "an RLS test run with two JWTs". The repository's only RLS check is `supabase/checks/access.sql`, which the `supabase` workflow runs with psql after `supabase db start` on every pull request touching `supabase/**`. A check file inside s2's own paths would run nowhere but by hand.

## Decision

Each row-level security check sits beside the existing access check in supabase/checks and is run by the supabase workflow on every pull request touching supabase/**. Checks are never kept in a slice's own folders, where they would only run by hand.

The option chosen: A. Keep the privacy test next to the game's database test, run automatically on every database change, the option built.

## Consequences

Removing it is deleting one file and one workflow step. Folding it into `access.sql` is a cut and paste. s3's own migration (`ask_cli_codes`) may want its checks beside it, in the same file or a step of its own.

## Source

`.omni-loop/delivery/shipped/0071-ask-mode/outbox/settled.md`, entry `s2-01-rls-check-in-ci`
