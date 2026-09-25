-- The galaxy's database: a copy of the game ledger (game/ledger/*.jsonl) and the org facts in
-- projects.yml. The ledger in git stays the source of truth (spec §7.2); this is its read model
-- for the web UI. The event format is the contract: one row per event, same fields.

create table public.ledger_events (
  id          text primary key,                 -- deterministic `source:identity:state`
  at          timestamptz not null,
  type        text not null check (type in (
                'PLANET_CHARTED', 'REGION_SURVEYED', 'PLANET_LOCKED', 'PLANET_UNLOCKED',
                'ZONE_OPENED', 'ZONE_CLAIMED', 'ZONE_SECURED', 'ZONE_REVERTED',
                'WOUND_OPENED', 'WOUND_CLOSED', 'DISTRESS', 'RESCUE',
                'PLANET_READY', 'PLANET_TERRAFORMED', 'PLANET_LOST', 'PLANET_DECOMMISSIONED')),
  planet      integer not null check (planet > 0),  -- the PRD number
  region      text,                              -- engineering repository
  contributor text,                              -- GitHub login
  team        text,                              -- GitHub team at the time of the event
  data        jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now()
);

comment on table public.ledger_events is 'Append-only copy of game/ledger/*.jsonl. Written by `pnpm galaxy:sync`, read by the galaxy UI.';

create index ledger_events_at_idx on public.ledger_events (at, id);
create index ledger_events_planet_idx on public.ledger_events (planet, at);

-- Append-only, like the ledger: an event, once written, never changes.
create function public.ledger_events_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'ledger_events is append-only (% refused)', tg_op;
end;
$$;

create trigger ledger_events_append_only
  before update or delete on public.ledger_events
  for each row execute function public.ledger_events_append_only();

create table public.sectors (
  name  text primary key,
  repos text[] not null default '{}'
);

create table public.teams (
  name text primary key,
  home text not null references public.sectors (name) on update cascade
);

comment on table public.sectors is 'projects.yml › sectors. Replaced wholesale by `pnpm galaxy:sync`.';
comment on table public.teams is 'projects.yml › teams. Replaced wholesale by `pnpm galaxy:sync`.';

-- View only, for now: anyone with the anon key may read; nobody but the service role may write.
-- Login comes later; when it does, narrow these `select` policies to `authenticated`.
alter table public.ledger_events enable row level security;
alter table public.sectors enable row level security;
alter table public.teams enable row level security;

create policy "the galaxy is readable" on public.ledger_events for select to anon, authenticated using (true);
create policy "the galaxy is readable" on public.sectors for select to anon, authenticated using (true);
create policy "the galaxy is readable" on public.teams for select to anon, authenticated using (true);

revoke insert, update, delete, truncate on public.ledger_events, public.sectors, public.teams from anon, authenticated;
