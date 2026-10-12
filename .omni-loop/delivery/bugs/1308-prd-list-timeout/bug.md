# Bug 1308: the PRD list does not load — The dossier database could not answer

## Triage

- **Domain:** Dossiers — the PRD history (`/prd`), `public.dossier_list()`
- **Risk:** high — every member of the workspace sees the PRD list fail with "The dossier database could not answer"; a PRD page still opens from a direct link, but nothing lists them (Jev, 0.56)
- **Regression:** yes — the production Postgres logs show no `57014 statement timeout` before the evening of 8 Oct and a steady stream since; no code change, the workspace's growth crossed the 8 s timeout

## Reproduction

- **File:** `supabase/checks/dossier_list_volume.sql`
- **Red:** `ERROR:  canceling statement due to statement timeout` (CONTEXT: SQL function "dossier_list" statement 1), after 8 s, on main's `dossier_list()`

## Fix

`dossier_list()` was a SQL function, and Postgres 17 plans a non-inlined SQL function's statement with its
arguments as unknown parameters: `(p_dossier is null or d.id = p_dossier)` read as "a few dossiers", so the
planner chose nested loops and the read grew with the square of the workspace (70 s at 1400 dossiers,
65 ms for the same body with the arguments written in). The same body now runs in PL/pgSQL with
`plan_cache_mode = force_custom_plan`, so each call is planned with its own arguments; columns, rows,
order and row-level security are unchanged.

## Guard

The reproduction runs in the supabase workflow on every pull request: a member lists 1400 dossiers through
`dossier_list()` inside production's 8 s statement timeout. It fails on main's function and passes on this
branch.

## Mutation

mutation: no changed core file against origin/main (d249f2bf): nothing to mutate
