# Bug 1832: every policy checks membership once per row, so reading a large table as a member is ~50x slower

## Triage

- **Domain:** the database access rules: row-level security policies (`supabase/migrations/`), read by every page and endpoint that reads as the signed-in person
- **Risk:** high — every signed-in member waits longer on every page that reads a large table (about 1 second on the game's planet details and the dashboard's season check, growing with the data); pages do load, and there is no workaround. (Jev, 0.91)
- **Regression:** new bug — no evidence this ever worked: `20261012110000_rls_once_and_indexes.sql` read the uid once per statement but kept `is_member(workspace_id)` per row on purpose, and the cost grew with the tables

## Reproduction

- **File:** `supabase/checks/rls_membership_once.sql`
- **Red:** ERROR:  FAIL: these policies read membership once per row (is_member): approval_requests · a member reads their workspace's approval requests; … (59 policies); and, on its own: ERROR:  FAIL: a member's count over 10,000 ledger events read 20511 buffers (at most 2,000): membership is read per row

## Fix

59 policies on 52 tables called public.is_member() with a row's column, directly or inside an EXISTS on
a parent row, so every statement ran it, and its lookup in workspace_members, once per row read. A new
public.my_workspaces() returns the person's workspaces, and each policy now asks
`x in (select public.my_workspaces())`, which Postgres evaluates once per statement; the bodies were
generated from the migrated database's own pg_policy with nothing else changed. A member's count over
10,000 ledger events reads 426 buffers instead of 20,511; on production the same count went from 351 ms
to 7 ms.

## Guard

The reproduction runs in the supabase workflow on every pull request that touches the migrations: it
refuses any policy that calls is_member() again, and a member's count over 10,000 ledger events above
2,000 buffers. Red on main's schema, green here. The 39 checks the workflow already ran (access.sql
among them) pass unchanged, so who may read and write what did not move.

## Mutation

mutation: no changed core file against origin/main (67fb8ea2): nothing to mutate
