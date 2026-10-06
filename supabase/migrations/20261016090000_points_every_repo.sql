-- A PRD delivered in any workspace repository earns its people points (PRD 728, spec:
-- .omni-loop/delivery/inbox/0728-points-every-repo/spec.md).
--
-- 1. public.ledger_events.home: the repository whose issue is the PRD, `owner/name` in lower case as
--    public.repositories spells it. Every event the projector writes from now on names it (its id
--    names it too: `planet:<owner>/<repo>#<n>:charted`). Every row written before stays as it is,
--    with a null home: the table is append-only.
-- 2. public.workspaces.game_since: the moment the workspace's game starts. The migration sets it to the
--    moment it is applied for every workspace there is; a workspace made later starts when it is made.
--    The projector writes no event before it, and the season score and XP read only rows with a home.
--
-- The game now reads the workspace's tracked public.repositories (Settings → Repositories), not only
-- its sectors: game/sources/github.mjs.
--
-- Checked below, in the migration itself: both columns exist, old rows keep a null home, every
-- workspace has a game_since, and the append-only trigger still refuses an update of a row that has a
-- home (in a subtransaction, rolled back).
-- Rollback: a follow-up migration drops both columns. Rows written with a home would keep their new ids.

alter table public.ledger_events
  add column home text check (home is null or home ~ '^[a-z0-9-]{1,39}/[a-z0-9._-]{1,100}$');

comment on column public.ledger_events.home is
  'The PRD''s home: the repository of its issue, owner/name in lower case (PRD 728). Null on every row written before 20261016090000_points_every_repo.sql; such rows count for nothing.';

create index ledger_events_home_idx on public.ledger_events (workspace_id, home, planet, at);

alter table public.workspaces
  add column game_since timestamptz not null default now();

comment on column public.workspaces.game_since is
  'When the workspace''s game starts (PRD 728): the projector writes no event before it. Set to the moment 20261016090000_points_every_repo.sql was applied for the workspaces that existed then, and to its creation for any later one.';

comment on table public.repositories is
  'A workspace''s repositories (PRD 612), owner/name in lower case. Its owner adds one or switches its tracking through add_repository() and set_repository_tracked(); nothing deletes one. Only a tracked repository is collected and counted on the Engineering board, and only a tracked repository''s PRDs are read by the game (PRD 728); switching tracking off keeps its rows.';

-- ── The migration's own checks ──────────────────────────────────────────────────
do $$
declare
  ws uuid;
  refused boolean := false;
begin
  if exists (select 1 from public.ledger_events where home is not null) then
    raise exception 'FAIL: a ledger row written before this migration has a home';
  end if;
  if exists (select 1 from public.workspaces where game_since is null) then
    raise exception 'FAIL: a workspace has no game_since';
  end if;
  if not exists (
    select 1 from pg_trigger t
     where t.tgrelid = 'public.ledger_events'::regclass and t.tgname = 'ledger_events_append_only' and t.tgenabled <> 'D'
  ) then
    raise exception 'FAIL: ledger_events lost its append-only trigger';
  end if;

  begin
    insert into public.workspaces (slug, name) values ('points-every-repo-check', 'Check') returning id into ws;
    insert into public.ledger_events (workspace_id, id, at, type, planet, home)
    values (ws, 'planet:acme/plan#88:charted', now(), 'PLANET_CHARTED', 88, 'acme/plan');
    begin
      update public.ledger_events set home = 'acme/other' where workspace_id = ws;
    exception when others then
      refused := true;
    end;
    raise exception using errcode = 'PX728', message = 'points-every-repo: roll the check back';
  exception when sqlstate 'PX728' then
    null;
  end;
  if not refused then
    raise exception 'FAIL: ledger_events accepted an update of a row with a home';
  end if;
end $$;
