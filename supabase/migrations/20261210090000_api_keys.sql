-- API keys (PRD 2022 s1, docs: .omni-loop/delivery/inbox/2022-api-keys-v1/spec.md, "The key"). A workspace
-- owner makes a key a program outside the loop calls /api/v1 with: an `api` scope on PRD 855's agent
-- tokens (PRD 1628's precedent: a scope, not a second table). The key acts for the whole workspace, or
-- only on the repositories of its allow-list. Galaxy's server draws the secret (`oma_` + 32 random
-- bytes, base64url) and sends only its SHA-256 hash and its last four characters: the secret never
-- reaches the database, and is shown once, to the owner who made it.
--
--   public.agent_tokens                      `scope` widens to `api`; gains `repos` (`owner/name`, the
--                                            key's allow-list; empty means every repository of the
--                                            workspace, and it stays empty for the other scopes)
--   public.runner_jobs                       gains `sent_by_key`: the key that queued the job, if any
--   api_key_make(workspace, name, repos, hash, last_four)
--                                            workspace owners only: a name of 1 to 40 characters, unique
--                                            among the workspace's live keys; repositories the workspace
--                                            tracks; 20 live keys a workspace at most. Answers the new id
--   api_key_revoke(workspace, key)           workspace owners only: sets revoked_at and revoked_by
--   api_keys_list(workspace)                 any member: the live keys, newest first, never the hash
--   api_key_of(hash)                         service role only (the /api/v1 routes): the live key the
--                                            hash names, `{key_id, workspace_id, repos, made_by, name}`,
--                                            or null; writes last_used_at at most once a minute
--
-- A key works only while it is not revoked and its maker is still a member of its workspace, exactly as
-- an agent link (BR-PRODUCT-64): api_key_of() answers nothing for any other key, and nothing for a
-- business link or a kit token. A key whose maker left stays listed, `working` false, so an owner
-- revokes it for good. There is no expiry.
--
-- Refusals: 42501 (not a member, or not an owner to make or revoke), 22023 (a bad value, its field in
-- the hint), 54000 (the workspace's 21st live key), P0002 (a key the workspace does not hold).
-- Proven by supabase/checks/api_keys.sql.
-- Rollback: `update public.agent_tokens set revoked_at = now() where scope = 'api';` stops every key at
-- once; the column and the functions can stay, unused, until a follow-up migration drops them.

-- ── The columns ──────────────────────────────────────────────────────────────────

alter table public.agent_tokens drop constraint agent_tokens_scope_check;
alter table public.agent_tokens
  add constraint agent_tokens_scope_check check (scope in ('business', 'kit', 'api')),
  add column repos text[] not null default '{}',
  add constraint agent_tokens_repos_api_only check (scope = 'api' or repos = '{}');

comment on column public.agent_tokens.scope is
  'business: a read-only link to the workspace''s business (PRD 855, `omb_`); kit: a token that signs the omni command in as its maker (PRD 1628, `omk_`); api: a key a program calls /api/v1 with, for the workspace (PRD 2022, `oma_`).';
comment on column public.agent_tokens.repos is
  'An API key''s allow-list (PRD 2022): the repositories it may read and act on, owner/name in lower case; empty means every repository of the workspace. Always empty for the other scopes.';

-- A key's name is unique among its workspace's live keys.
create unique index agent_tokens_api_live_name on public.agent_tokens (workspace_id, lower(name))
  where revoked_at is null and scope = 'api';

alter table public.runner_jobs
  add column sent_by_key uuid references public.agent_tokens (id) on delete set null;

comment on column public.runner_jobs.sent_by_key is
  'The API key that queued the job (PRD 2022), or null for a person''s; sent_by is then the key''s maker.';

-- ── Listed ───────────────────────────────────────────────────────────────────────

-- A key as the list shows it: never its hash.
create function public.api_key_listed(t public.agent_tokens) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'lastFour', t.last_four,
    'repos', to_jsonb(t.repos),
    'createdAt', t.created_at,
    'lastUsedAt', t.last_used_at,
    'revokedAt', t.revoked_at,
    'maker', jsonb_build_object(
      'id', t.made_by,
      'login', (select lower(coalesce(nullif(p.github_login, ''), (
                  select coalesce(i.identity_data ->> 'user_name', i.identity_data ->> 'preferred_username')
                    from auth.identities i
                   where i.user_id = t.made_by and i.provider = 'github'
                   order by i.created_at limit 1)))
                  from (select 1) one
                  left join public.players p on p.workspace_id = t.workspace_id and p.user_id = t.made_by),
      'name', (select coalesce(nullif(btrim(p.display_name), ''),
                               nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
                               nullif(btrim(u.raw_user_meta_data ->> 'name'), ''))
                 from auth.users u
                 left join public.players p on p.workspace_id = t.workspace_id and p.user_id = u.id
                where u.id = t.made_by)),
    'working', exists (select 1 from public.workspace_members m where m.workspace_id = t.workspace_id and m.user_id = t.made_by))
$$;

-- ── Making ───────────────────────────────────────────────────────────────────────

-- Makes an API key in `p_workspace`, for its owner. `p_repos` is the allow-list (null or empty: every
-- repository); each one must be a repository the workspace tracks. Galaxy's server draws the secret and
-- sends only its SHA-256 hash (64 hex characters) and its last four characters. Answers the new id.
create function public.api_key_make(p_workspace uuid, p_name text, p_repos text[], p_hash text, p_last_four text) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_repos text[];
  v_unknown text;
  made uuid;
begin
  if auth.uid() is null or p_workspace is null or not public.is_owner(p_workspace) then
    raise exception 'Only an owner of the workspace makes or revokes its API keys.' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 40 or v_name ~ '[\r\n\t]' then
    raise exception 'Name: 1 to 40 characters, on one line.' using errcode = '22023', hint = 'name';
  end if;
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Hash: the key''s SHA-256, 64 hexadecimal characters.' using errcode = '22023', hint = 'hash';
  end if;
  if p_last_four is null or p_last_four !~ '^[A-Za-z0-9_-]{4}$' then
    raise exception 'Last four: the key''s last four characters.' using errcode = '22023', hint = 'last_four';
  end if;

  select coalesce(array_agg(distinct lower(btrim(r)) order by lower(btrim(r))), '{}')
    into v_repos
    from unnest(coalesce(p_repos, '{}')) r;
  select r into v_unknown
    from unnest(v_repos) r
   where not exists (select 1 from public.repositories x
                      where x.workspace_id = p_workspace and x.full_name = r and x.tracked)
   order by r limit 1;
  if v_unknown is not null then
    raise exception 'Repositories: % is not a repository this workspace tracks.', v_unknown using errcode = '22023', hint = 'repos';
  end if;

  -- A workspace's keys are counted one call at a time.
  perform pg_advisory_xact_lock(hashtextextended('api_keys:' || p_workspace::text, 0));
  if exists (select 1 from public.agent_tokens t
              where t.workspace_id = p_workspace and t.scope = 'api' and t.revoked_at is null
                and lower(t.name) = lower(v_name)) then
    raise exception 'Name: this workspace already has a key named %.', v_name using errcode = '22023', hint = 'name';
  end if;
  if (select count(*) from public.agent_tokens t
       where t.workspace_id = p_workspace and t.scope = 'api' and t.revoked_at is null) >= 20 then
    raise exception 'This workspace holds 20 API keys already: revoke one to make another.' using errcode = '54000', hint = 'limit';
  end if;

  insert into public.agent_tokens (workspace_id, made_by, name, token_hash, last_four, scope, repos)
  values (p_workspace, auth.uid(), v_name, p_hash, p_last_four, 'api', v_repos)
  returning id into made;
  return made;
end;
$$;

-- ── Revoking ─────────────────────────────────────────────────────────────────────

-- Revokes an API key of `p_workspace`, for its owner. Revoking a revoked key changes nothing. Answers
-- the key as listed.
create function public.api_key_revoke(p_workspace uuid, p_key uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.agent_tokens;
begin
  if auth.uid() is null or p_workspace is null or not public.is_owner(p_workspace) then
    raise exception 'Only an owner of the workspace makes or revokes its API keys.' using errcode = '42501';
  end if;
  select * into t from public.agent_tokens x
   where x.id = p_key and x.workspace_id = p_workspace and x.scope = 'api' for update;
  if not found then
    raise exception 'Key: this workspace holds no such API key.' using errcode = 'P0002', hint = 'key';
  end if;
  if t.revoked_at is null then
    update public.agent_tokens x set revoked_at = now(), revoked_by = auth.uid() where x.id = t.id returning * into t;
  end if;
  return public.api_key_listed(t);
end;
$$;

-- ── Listing ──────────────────────────────────────────────────────────────────────

-- The workspace's API keys not revoked, newest first, for any member: a key whose maker left is listed
-- with `working` false, so an owner revokes it.
create function public.api_keys_list(p_workspace uuid) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or p_workspace is null or not public.is_member(p_workspace) then
    raise exception 'Only a member of the workspace can see its API keys.' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(public.api_key_listed(t) order by t.created_at desc, t.id)
                     from public.agent_tokens t
                    where t.workspace_id = p_workspace and t.scope = 'api' and t.revoked_at is null), '[]'::jsonb);
end;
$$;

-- ── The routes' check (service role only) ────────────────────────────────────────

-- The live API key `p_hash` names: not revoked, its maker still a member of its workspace, and an `api`
-- key (never a business link nor a kit token). Null for anything else. `last_used_at` moves at most once
-- a minute.
create function public.api_key_of(p_hash text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.agent_tokens;
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    return null;
  end if;
  select * into t from public.agent_tokens x
   where x.token_hash = p_hash and x.scope = 'api' and x.revoked_at is null
     and exists (select 1 from public.workspace_members m where m.workspace_id = x.workspace_id and m.user_id = x.made_by);
  if not found then
    return null;
  end if;
  if t.last_used_at is null or t.last_used_at < now() - interval '1 minute' then
    update public.agent_tokens x set last_used_at = now() where x.id = t.id;
  end if;
  return jsonb_build_object('key_id', t.id, 'workspace_id', t.workspace_id, 'repos', to_jsonb(t.repos),
    'made_by', t.made_by, 'name', t.name);
end;
$$;

-- ── Who may do what ──────────────────────────────────────────────────────────────

revoke execute on function public.api_key_listed(public.agent_tokens) from public, anon, authenticated;

revoke execute on function public.api_key_make(uuid, text, text[], text, text) from public, anon;
grant execute on function public.api_key_make(uuid, text, text[], text, text) to authenticated;
revoke execute on function public.api_key_revoke(uuid, uuid) from public, anon;
grant execute on function public.api_key_revoke(uuid, uuid) to authenticated;
revoke execute on function public.api_keys_list(uuid) from public, anon;
grant execute on function public.api_keys_list(uuid) to authenticated;

-- The hash is the credential, checked by the routes alone.
revoke execute on function public.api_key_of(text) from public, anon, authenticated;
grant execute on function public.api_key_of(text) to service_role;
