-- A workspace made by sign-up starts with the standard fleets (PRD 359, fix).
--
-- create_workspace_from_installation() made a workspace with no fleet, so a newcomer's first step in
-- the arcade, picking a fleet, showed NO FLEETS YET and went nowhere. Now a workspace it makes or
-- joins that has no active fleet gets the five standard ones, the same look and order as Vertuoza's
-- (20260926120000_workspaces.sql). Every workspace sign-up already made (one with an installation and
-- no active fleet) gets them here too. Fleets are the workspace's own rows, restyled or retired later
-- like any other.
--
-- Rollback: a follow-up migration restores the previous create_workspace_from_installation() and drops
-- add_default_fleets(); the fleets it added stay (ledger events may name them).

-- ── 1. The standard fleets, for one workspace ────────────────────────────────────

create function public.add_default_fleets(p_workspace_id uuid) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.teams (workspace_id, name, label, color, motto, mascot, sort)
  select p_workspace_id, f.name, f.label, f.color, f.motto, f.mascot, f.sort
    from (values
      ('beaver',  'BEAVER',  '#d08a4a', 'Builds the dam. Secures the zone.', 'beaver',  10),
      ('octopod', 'OCTOPOD', '#b07cff', 'Eight arms, eight sub-PRs.',        'octopod', 20),
      ('picsou',  'PICSOU',  '#ffd84a', 'Every coin counted twice.',         'picsou',  30),
      ('cia',     'C.I.A.',  '#9aa3c8', 'Knows every open question.',        'cia',     40),
      ('pirates', 'PIRATES', '#2fc6a4', 'Takes the zones nobody claims.',    'pirate',  50)
    ) as f (name, label, color, motto, mascot, sort)
  on conflict (workspace_id, name) do nothing;
$$;

revoke execute on function public.add_default_fleets(uuid) from public, anon, authenticated;
grant execute on function public.add_default_fleets(uuid) to service_role;

-- ── 2. Sign-up gives a fleetless workspace the standard fleets ───────────────────

create or replace function public.create_workspace_from_installation(
  p_user_id uuid, p_installation_id bigint, p_login text, p_type text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws public.workspaces;
  made boolean := false;
  base text;
  candidate text;
  n integer := 1;
  my_role text;
begin
  if p_user_id is null or p_installation_id is null or p_installation_id <= 0
     or p_login is null or p_login !~ '^[A-Za-z0-9-]{1,39}$'
     or p_type is null or p_type not in ('Organization', 'User') then
    raise exception 'A workspace needs a person, an installation id, a GitHub login and its account type.'
      using errcode = '22023';
  end if;

  -- Two calls for one account (a double click, a replay) never race to two workspaces.
  perform pg_advisory_xact_lock(hashtext('create_workspace_from_installation:' || lower(p_login)));

  select * into ws from public.workspaces w where w.github_installation_id = p_installation_id;
  if not found then
    select * into ws from public.workspaces w
     where lower(w.github_org) = lower(p_login)
     order by w.created_at
     limit 1;
    if found then
      if ws.github_installation_id is null then
        update public.workspaces w
           set github_installation_id = p_installation_id, github_account_type = p_type
         where w.id = ws.id;
      end if;
    else
      base := left(lower(p_login), 32);
      candidate := base;
      while candidate !~ '^[a-z0-9-]{2,32}$'
            or exists (select 1 from public.workspaces w where w.slug = candidate) loop
        n := n + 1;
        candidate := left(base, 32 - 1 - length(n::text)) || '-' || n;
      end loop;
      insert into public.workspaces (slug, name, github_org, github_installation_id, github_account_type)
      values (candidate, p_login, p_login, p_installation_id, p_type)
      returning * into ws;
      made := true;
    end if;
  end if;

  -- A workspace with no fleet to pick is a dead end in the arcade: it gets the standard ones.
  if not exists (select 1 from public.teams t where t.workspace_id = ws.id and t.retired_at is null) then
    perform public.add_default_fleets(ws.id);
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (ws.id, p_user_id, case when made then 'owner' else 'member' end)
  on conflict (workspace_id, user_id) do nothing;

  select m.role into my_role from public.workspace_members m where m.workspace_id = ws.id and m.user_id = p_user_id;
  return jsonb_build_object('workspace_id', ws.id, 'slug', ws.slug, 'role', my_role, 'created', made);
end;
$$;

-- ── 3. The workspaces sign-up already made ───────────────────────────────────────

select public.add_default_fleets(w.id)
  from public.workspaces w
 where w.github_installation_id is not null
   and not exists (select 1 from public.teams t where t.workspace_id = w.id and t.retired_at is null);
