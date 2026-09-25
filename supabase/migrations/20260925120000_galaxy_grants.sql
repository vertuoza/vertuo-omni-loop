-- Explicit Data API grants for the galaxy tables. Supabase projects created since 2026-05-30 no
-- longer grant anon, authenticated and service_role privileges on new public tables (existing
-- projects follow on 2026-10-30), and without a grant Postgres refuses the query before RLS is
-- consulted. Row-level security still decides which rows; these decide which statements.

grant usage on schema public to anon, authenticated, service_role;

-- The web UI reads with the anon key.
grant select on public.ledger_events, public.sectors, public.teams to anon, authenticated;

-- `pnpm galaxy:sync` writes with the service role: it appends events (ON CONFLICT DO NOTHING, the
-- trigger refuses anything else) and upserts then prunes the org facts to match projects.yml.
grant select, insert on public.ledger_events to service_role;
grant select, insert, update, delete on public.sectors, public.teams to service_role;
