-- Jev decisions, opt-in per workspace (PRD 812, docs: .omni-loop/delivery/inbox/0812-jev-decisions/spec.md).
-- A workspace's owner stores its TypeSafe API key and hands Jev three decisions, each Off, Shadow or
-- On, each with its own threshold and confidence floor; every call to Jev is logged beside today's
-- answer. Three tables, one migration for the whole PRD:
--
-- - public.workspace_secrets: a workspace's secrets, sealed by Galaxy's server (AES-256-GCM under
--   SECRETS_MASTER_KEY, apps/galaxy/src/jev/secret-box.ts) before they reach the database. Written only
--   by set_jev_key() and remove_jev_key(), each security definer and owner-only; no policy lets any
--   signed-in person read a row, and only the service role (Galaxy's server, to call Jev) selects one.
--   jev_key_status() tells a member whether a key is stored, and its owner its last four.
-- - public.jev_decisions: each decision's mode, threshold and confidence floor. A decision with no row
--   is Off at the defaults (0.50 and 0.40). Every member reads them; only set_jev_decision(),
--   owner-only, writes one. A mode other than Off needs a stored key, and removing the key sets every
--   decision Off.
-- - public.jev_calls: one row per call to Jev, Jev's answer beside today's (the old answer), which one
--   counted, and a reference to the round, item or issue. Only the service role writes; every member
--   reads; nothing updates or deletes one.
--
-- Built like 20261008090000_repositories.sql: a refusal is 42501 (not the owner), 22023 (a bad value,
-- its field in the hint). Proven by supabase/checks/jev.sql.
-- Rollback: switch every decision Off (or remove the key); a follow-up migration drops the three
-- tables and the five functions. Nothing else reads them.

-- ── The tables ───────────────────────────────────────────────────────────────────

create table public.workspace_secrets (
  workspace_id uuid not null references public.workspaces on delete cascade,
  name         text not null check (name ~ '^[a-z][a-z0-9-]{0,39}$'),
  ciphertext   text not null check (ciphertext <> ''),
  iv           text not null check (iv <> ''),
  last_four    text not null check (char_length(last_four) between 1 and 4),
  set_by       uuid references auth.users on delete set null,
  set_at       timestamptz not null default now(),
  primary key (workspace_id, name)
);

comment on table public.workspace_secrets is
  'A workspace''s secrets (PRD 812), sealed by Galaxy''s server with SECRETS_MASTER_KEY before they are stored: `jev`, the TypeSafe API key. Written only by set_jev_key() and remove_jev_key(); read only by the service role.';

create table public.jev_decisions (
  workspace_id     uuid not null references public.workspaces on delete cascade,
  decision         text not null check (decision ~ '^[a-z][a-z0-9-]{0,39}$'),
  mode             text not null default 'off' check (mode in ('off', 'shadow', 'on')),
  threshold        numeric(3, 2) not null default 0.50 check (threshold between 0 and 1),
  confidence_floor numeric(3, 2) not null default 0.40 check (confidence_floor between 0 and 1),
  updated_by       uuid references auth.users on delete set null,
  updated_at       timestamptz not null default now(),
  primary key (workspace_id, decision)
);

comment on table public.jev_decisions is
  'Each Jev decision''s mode and tuning in a workspace (PRD 812). No row: Off, threshold 0.50, floor 0.40. Written only by set_jev_decision() and remove_jev_key().';
comment on column public.jev_decisions.threshold is 'A Noul answer at or above it counts as yes.';
comment on column public.jev_decisions.confidence_floor is 'Under it, an On decision falls back to today''s answer.';

create table public.jev_calls (
  id           bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces on delete cascade,
  decision     text not null,
  mode         text not null check (mode in ('off', 'shadow', 'on')),
  outcome      text not null check (outcome in ('answered', 'under-floor', 'failed', 'no-key')),
  model        text,
  jev_answer   text,
  confidence   numeric(5, 4) check (confidence between 0 and 1),
  old_answer   text,
  counted      text,
  decided_by   text not null check (decided_by in ('jev', 'old')),
  ref          text,
  reason       text,
  ms           integer check (ms >= 0),
  called_at    timestamptz not null default now()
);

create index jev_calls_record_idx on public.jev_calls (workspace_id, decision, called_at desc);

comment on table public.jev_calls is
  'One row per call to Jev (PRD 812): Jev''s answer beside today''s (old_answer), the one that counted and who decided, and ref, the round, outbox item or issue it was about. Written only by the service role; never updated or deleted.';

-- ── Who owns the key ─────────────────────────────────────────────────────────────

-- Refuses the caller unless they own the workspace.
create function public.jev_owner_only(p_workspace uuid) returns void
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or p_workspace is null or not public.is_owner(p_workspace) then
    raise exception 'Only the workspace''s owner can change its Jev settings.' using errcode = '42501';
  end if;
end;
$$;

-- The decisions Jev may make (PRD 812 decision 1). A new one is added here by a migration.
create function public.jev_decision_names() returns text[]
language sql immutable
set search_path = ''
as $$
  select array['question-category', 'outbox-risk', 'bug-risk']
$$;

-- Stores the workspace's TypeSafe key, sealed by Galaxy's server after one test call succeeded.
-- Replaces a stored one. Answers what the page shows: the last four and when.
create function public.set_jev_key(p_workspace uuid, p_ciphertext text, p_iv text, p_last_four text)
returns table (last_four text, set_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.jev_owner_only(p_workspace);
  if coalesce(p_ciphertext, '') = '' or coalesce(p_iv, '') = '' then
    raise exception 'Key: a sealed key and its iv.' using errcode = '22023', hint = 'key';
  end if;
  if char_length(coalesce(p_last_four, '')) not between 1 and 4 then
    raise exception 'Key: its last four characters.' using errcode = '22023', hint = 'last_four';
  end if;
  insert into public.workspace_secrets as s (workspace_id, name, ciphertext, iv, last_four, set_by, set_at)
  values (p_workspace, 'jev', p_ciphertext, p_iv, p_last_four, auth.uid(), now())
  on conflict (workspace_id, name) do update
    set ciphertext = excluded.ciphertext, iv = excluded.iv, last_four = excluded.last_four,
        set_by = excluded.set_by, set_at = excluded.set_at;
  return query select s.last_four, s.set_at from public.workspace_secrets s
                where s.workspace_id = p_workspace and s.name = 'jev';
end;
$$;

-- Removes the workspace's TypeSafe key and sets every decision Off (decision 7). Removing no key
-- still sets them Off.
create function public.remove_jev_key(p_workspace uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.jev_owner_only(p_workspace);
  delete from public.workspace_secrets s where s.workspace_id = p_workspace and s.name = 'jev';
  update public.jev_decisions d
     set mode = 'off', updated_by = auth.uid(), updated_at = now()
   where d.workspace_id = p_workspace and d.mode <> 'off';
end;
$$;

-- Sets one decision's mode, threshold and confidence floor; no other decision moves. A mode other than
-- Off needs a stored key.
create function public.set_jev_decision(p_workspace uuid, p_decision text, p_mode text, p_threshold numeric, p_floor numeric)
returns public.jev_decisions
language plpgsql
security definer
set search_path = ''
as $$
declare
  saved public.jev_decisions;
begin
  perform public.jev_owner_only(p_workspace);
  if p_decision is null or not (p_decision = any (public.jev_decision_names())) then
    raise exception 'Decision: one of %.', array_to_string(public.jev_decision_names(), ', ') using errcode = '22023', hint = 'decision';
  end if;
  if p_mode is null or p_mode not in ('off', 'shadow', 'on') then
    raise exception 'Mode: off, shadow or on.' using errcode = '22023', hint = 'mode';
  end if;
  if p_threshold is null or p_threshold < 0 or p_threshold > 1 then
    raise exception 'Threshold: from 0 to 1.' using errcode = '22023', hint = 'threshold';
  end if;
  if p_floor is null or p_floor < 0 or p_floor > 1 then
    raise exception 'Confidence floor: from 0 to 1.' using errcode = '22023', hint = 'confidence_floor';
  end if;
  if p_mode <> 'off' and not exists (select 1 from public.workspace_secrets s where s.workspace_id = p_workspace and s.name = 'jev') then
    raise exception 'Mode: switch Jev on with a key first.' using errcode = '22023', hint = 'mode';
  end if;
  insert into public.jev_decisions as d (workspace_id, decision, mode, threshold, confidence_floor, updated_by, updated_at)
  values (p_workspace, p_decision, p_mode, round(p_threshold, 2), round(p_floor, 2), auth.uid(), now())
  on conflict (workspace_id, decision) do update
    set mode = excluded.mode, threshold = excluded.threshold, confidence_floor = excluded.confidence_floor,
        updated_by = excluded.updated_by, updated_at = excluded.updated_at
  returning * into saved;
  return saved;
end;
$$;

-- Whether the workspace has a key, for any member; its last four and when it was set, for its owner
-- only. Refuses anyone outside the workspace.
create function public.jev_key_status(p_workspace uuid)
returns table (stored boolean, last_four text, set_at timestamptz)
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  caller_owns boolean;
begin
  if auth.uid() is null or p_workspace is null or not public.is_member(p_workspace) then
    raise exception 'Only a member of the workspace can read its Jev settings.' using errcode = '42501';
  end if;
  caller_owns := public.is_owner(p_workspace);
  return query
    select exists (select 1 from public.workspace_secrets s where s.workspace_id = p_workspace and s.name = 'jev'),
           case when caller_owns then (select s.last_four from public.workspace_secrets s where s.workspace_id = p_workspace and s.name = 'jev') end,
           case when caller_owns then (select s.set_at from public.workspace_secrets s where s.workspace_id = p_workspace and s.name = 'jev') end;
end;
$$;

-- ── Who may do what ──────────────────────────────────────────────────────────────

alter table public.workspace_secrets enable row level security;
alter table public.jev_decisions enable row level security;
alter table public.jev_calls enable row level security;

-- workspace_secrets has no policy: nobody signed in reads a row.
create policy "a member reads their workspace's Jev decisions" on public.jev_decisions
  for select to authenticated using (public.is_member(workspace_id));
create policy "a member reads their workspace's Jev calls" on public.jev_calls
  for select to authenticated using (public.is_member(workspace_id));

-- Signed out: nothing. Signed in: reads the decisions and the calls, the rows above. The service role
-- reads the three tables and appends calls.
revoke all on public.workspace_secrets, public.jev_decisions, public.jev_calls
  from public, anon, authenticated, service_role;
grant select on public.jev_decisions, public.jev_calls to authenticated;
grant select on public.workspace_secrets, public.jev_decisions, public.jev_calls to service_role;
grant insert on public.jev_calls to service_role;

revoke execute on function public.jev_owner_only(uuid) from public, anon, authenticated;
revoke execute on function public.set_jev_key(uuid, text, text, text) from public, anon;
grant execute on function public.set_jev_key(uuid, text, text, text) to authenticated;
revoke execute on function public.remove_jev_key(uuid) from public, anon;
grant execute on function public.remove_jev_key(uuid) to authenticated;
revoke execute on function public.set_jev_decision(uuid, text, text, numeric, numeric) from public, anon;
grant execute on function public.set_jev_decision(uuid, text, text, numeric, numeric) to authenticated;
revoke execute on function public.jev_key_status(uuid) from public, anon;
grant execute on function public.jev_key_status(uuid) to authenticated;
