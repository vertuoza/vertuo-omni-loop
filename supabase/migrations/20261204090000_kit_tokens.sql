-- Kit tokens (PRD 1628 s1, docs: .omni-loop/delivery/inbox/1628-cloud-sign-in/spec.md, sections 1 to 3).
-- A member makes a personal token that signs the `omni` command in where no browser opens (a cloud
-- session): a `kit` scope on PRD 855's agent tokens (decision 2), not a second table. The token acts as
-- its maker, in its workspace; it unlocks a Supabase session of its own, made by a dedicated sign-in
-- round trip (decision 4), whose refresh token only the server ever holds (decision 3): galaxy seals it
-- with a server-only key (KIT_TOKEN_KEY) before it reaches the database, and renews it on each exchange.
--
--   public.agent_tokens                      gains `scope` (`business`, every existing row, or `kit`),
--                                            `expires_at` (a kit token's, required; null for a business
--                                            link, PRD 855's decision 11 unchanged), `session` (a kit
--                                            token's sealed refresh token) and the exchange's lease
--   kit_token_make(workspace, name, hash, last_four, days, session)
--                                            the sign-in round trip, acting as the fresh session: a kit
--                                            token of 30, 90 or 365 days for the caller, in the workspace
--                                            named by its slug, or their first one
--   kit_tokens_mine(workspace)               any member: their own live kit tokens there, newest first,
--                                            and how many live tokens they hold, both scopes together
--   kit_token_claim(hash)                    service role only: the exchange's first half. The live kit
--                                            token the hash names, its sealed session and a lease; or why
--                                            not (`unknown`, `revoked`, `expired`, `not-a-member`), or
--                                            `busy` while another exchange holds the lease
--   kit_token_renewed(token, lease, session) service role only: the second half, writing the renewed
--                                            session back and ending the lease
--   kit_token_release(token, lease)          service role only: ends a lease whose exchange failed
--   agent_token_make / _revoke / _of / _listed / agent_tokens_list   replaced: see each below
--
-- The exchange is two calls, so no row lock can last across it: the lease stands in for one. A claim
-- takes the row `for update`, and refuses (`busy`) while another exchange's lease runs (30 seconds at
-- most), so two exchanges at once renew one after the other (galaxy waits and claims again).
--
-- The 20-live-token limit counts both scopes together (an expired kit token is not live). A kit
-- token's name need not be unique: `omni setup-token` names it `terminal <date>`. A kit token never
-- reads through business_for_token() (agent_token_of() finds business links only), and a business link
-- never signs the kit in (kit_token_claim() finds kit tokens only). Revoking a kit token clears its
-- session at once, so nothing renews it again.
--
-- No signed-in role reads `session`: there is still no grant on the table and no policy, no listing
-- carries it, and the three functions that read or write it run for the service role only.
--
-- Refusals: 42501 (not a member, or no workspace to make it in), 22023 (a bad value, its field in the
-- hint), 54000 (the 21st live token).
-- Proven by supabase/checks/agent_tokens.sql.
-- Rollback: `update public.agent_tokens set revoked_at = now(), session = null where scope = 'kit';`
-- stops every kit token at once; a follow-up migration drops the five columns and the five functions,
-- and restores the replaced functions from 20261028090000_agent_tokens.sql. Business links are untouched.

-- ── The columns ──────────────────────────────────────────────────────────────────

alter table public.agent_tokens
  add column scope               text not null default 'business' check (scope in ('business', 'kit')),
  add column expires_at          timestamptz,
  add column session             text,
  add column session_lease       uuid,
  add column session_lease_until timestamptz,
  add constraint agent_tokens_kit_expires check ((scope = 'kit') = (expires_at is not null)),
  add constraint agent_tokens_session_kit_only check (scope = 'kit' or (session is null and session_lease is null));

comment on column public.agent_tokens.scope is
  'business: a read-only link to the workspace''s business (PRD 855, `omb_`); kit: a token that signs the omni command in as its maker (PRD 1628, `omk_`).';
comment on column public.agent_tokens.expires_at is 'When a kit token stops working (30, 90 or 365 days after it was made); null for a business link.';
comment on column public.agent_tokens.session is
  'A kit token''s Supabase refresh token, sealed by galaxy''s server (AES-256-GCM under KIT_TOKEN_KEY) and renewed on each exchange; null once revoked. Read only by kit_token_claim(), for the service role.';
comment on column public.agent_tokens.session_lease is 'The exchange renewing the session now, until session_lease_until.';

-- A business link's name is unique among its maker's live links; a kit token's need not be.
drop index public.agent_tokens_live_name;
create unique index agent_tokens_live_name on public.agent_tokens (workspace_id, made_by, lower(name))
  where revoked_at is null and scope = 'business';

-- ── Live, and listed ─────────────────────────────────────────────────────────────

-- How many live tokens a person holds, both scopes together: not revoked, and not past its expiry.
create function public.agent_tokens_live(p_person uuid) returns integer
language sql stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.agent_tokens t
   where t.made_by = p_person and t.revoked_at is null and (t.expires_at is null or t.expires_at > now())
$$;

-- As 20261028090000_agent_tokens.sql, with the scope and the expiry: never the hash, never the session.
create or replace function public.agent_token_listed(t public.agent_tokens) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'scope', t.scope,
    'lastFour', t.last_four,
    'createdAt', t.created_at,
    'lastUsedAt', t.last_used_at,
    'expiresAt', t.expires_at,
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
    'mine', t.made_by = auth.uid(),
    'canRevoke', t.made_by = auth.uid() or public.is_owner(t.workspace_id),
    'working', exists (select 1 from public.workspace_members m where m.workspace_id = t.workspace_id and m.user_id = t.made_by))
$$;

-- As 20261028090000_agent_tokens.sql: the workspace's business links not revoked, for any member; and
-- now its live kit tokens too, for their maker and for an owner only (spec section 5), so an owner
-- revokes any member's where every link is listed.
create or replace function public.agent_tokens_list(p_workspace uuid) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or p_workspace is null or not public.is_member(p_workspace) then
    raise exception 'Only a member of the workspace can see its links.' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(public.agent_token_listed(t) order by t.created_at desc, t.id)
                     from public.agent_tokens t
                    where t.workspace_id = p_workspace and t.revoked_at is null
                      and (t.scope = 'business'
                           or (t.expires_at > now() and (t.made_by = auth.uid() or public.is_owner(p_workspace))))), '[]'::jsonb);
end;
$$;

-- The caller's own live kit tokens in `p_workspace`, newest first, and `live`: how many live tokens
-- they hold, both scopes together, against the limit of 20.
create function public.kit_tokens_mine(p_workspace uuid) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or p_workspace is null or not public.is_member(p_workspace) then
    raise exception 'Only a member of the workspace can see their tokens.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'tokens', coalesce((select jsonb_agg(public.agent_token_listed(t) order by t.created_at desc, t.id)
                          from public.agent_tokens t
                         where t.workspace_id = p_workspace and t.made_by = auth.uid() and t.scope = 'kit'
                           and t.revoked_at is null and t.expires_at > now()), '[]'::jsonb),
    'live', public.agent_tokens_live(auth.uid()),
    'limit', 20);
end;
$$;

-- ── Making ───────────────────────────────────────────────────────────────────────

-- As 20261028090000_agent_tokens.sql, with the limit counting both scopes (an expired kit token is not
-- live), and a name unique among business links only.
create or replace function public.agent_token_make(p_workspace uuid, p_name text, p_hash text, p_last_four text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  made public.agent_tokens;
begin
  if auth.uid() is null or p_workspace is null or not public.is_member(p_workspace) then
    raise exception 'Only a member of the workspace can make a link to its business.' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 40 or v_name ~ '[\r\n\t]' then
    raise exception 'Name: 1 to 40 characters, on one line.' using errcode = '22023', hint = 'name';
  end if;
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Hash: the token''s SHA-256, 64 hexadecimal characters.' using errcode = '22023', hint = 'hash';
  end if;
  if p_last_four is null or p_last_four !~ '^[A-Za-z0-9_-]{4}$' then
    raise exception 'Last four: the token''s last four characters.' using errcode = '22023', hint = 'last_four';
  end if;

  -- One person's tokens are counted one call at a time, both scopes under the same lock.
  perform pg_advisory_xact_lock(hashtextextended('agent_tokens:' || auth.uid()::text, 0));
  if exists (select 1 from public.agent_tokens t
              where t.workspace_id = p_workspace and t.made_by = auth.uid() and t.revoked_at is null
                and t.scope = 'business' and lower(t.name) = lower(v_name)) then
    raise exception 'Name: you already have a link named %.', v_name using errcode = '22023', hint = 'name';
  end if;
  if public.agent_tokens_live(auth.uid()) >= 20 then
    raise exception 'You hold 20 links already: revoke one to make another.' using errcode = '54000', hint = 'limit';
  end if;

  insert into public.agent_tokens (workspace_id, made_by, name, token_hash, last_four)
  values (p_workspace, auth.uid(), v_name, p_hash, p_last_four)
  returning * into made;
  return public.agent_token_listed(made);
end;
$$;

-- Makes a kit token for the caller: the sign-in round trip calls it acting as the fresh session whose
-- sealed refresh token is `p_session`. `p_workspace` is a workspace's slug, or null or empty for the
-- caller's first workspace. Galaxy's server draws the token and sends only its SHA-256 hash and last four.
create function public.kit_token_make(p_workspace text, p_name text, p_hash text, p_last_four text, p_days integer, p_session text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  ws uuid;
  made public.agent_tokens;
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if coalesce(btrim(p_workspace), '') = '' then
    select m.workspace_id into ws from public.workspace_members m
     where m.user_id = auth.uid() order by m.joined_at, m.workspace_id limit 1;
  else
    select w.id into ws from public.workspaces w where w.slug = lower(btrim(p_workspace));
  end if;
  if ws is null or not public.is_member(ws) then
    raise exception 'Only a member of a workspace can make a terminal token: join one first.' using errcode = '42501';
  end if;
  if char_length(v_name) not between 1 and 40 or v_name ~ '[\r\n\t]' then
    raise exception 'Name: 1 to 40 characters, on one line.' using errcode = '22023', hint = 'name';
  end if;
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Hash: the token''s SHA-256, 64 hexadecimal characters.' using errcode = '22023', hint = 'hash';
  end if;
  if p_last_four is null or p_last_four !~ '^[A-Za-z0-9_-]{4}$' then
    raise exception 'Last four: the token''s last four characters.' using errcode = '22023', hint = 'last_four';
  end if;
  if p_days is null or p_days not in (30, 90, 365) then
    raise exception 'Expires in: 30, 90 or 365 days.' using errcode = '22023', hint = 'days';
  end if;
  if coalesce(p_session, '') = '' or char_length(p_session) > 4096 then
    raise exception 'Session: the sealed sign-in the token unlocks.' using errcode = '22023', hint = 'session';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('agent_tokens:' || auth.uid()::text, 0));
  if public.agent_tokens_live(auth.uid()) >= 20 then
    raise exception 'You hold 20 tokens already: revoke one to make another.' using errcode = '54000', hint = 'limit';
  end if;

  insert into public.agent_tokens (workspace_id, made_by, name, token_hash, last_four, scope, expires_at, session)
  values (ws, auth.uid(), v_name, p_hash, p_last_four, 'kit', now() + make_interval(days => p_days), p_session)
  returning * into made;
  return public.agent_token_listed(made);
end;
$$;

-- ── Revoking ─────────────────────────────────────────────────────────────────────

-- As 20261028090000_agent_tokens.sql, and a kit token's session is cleared at once: nothing renews it
-- again, so every access token it handed out stops at its next renewal, an hour at most.
create or replace function public.agent_token_revoke(p_workspace uuid, p_token uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.agent_tokens;
begin
  if auth.uid() is null or p_workspace is null or not public.is_member(p_workspace) then
    raise exception 'Only a member of the workspace can revoke its links.' using errcode = '42501';
  end if;
  select * into t from public.agent_tokens x where x.id = p_token and x.workspace_id = p_workspace for update;
  if not found then
    raise exception 'Link: this workspace holds no such link.' using errcode = 'P0002', hint = 'token';
  end if;
  if t.made_by <> auth.uid() and not public.is_owner(p_workspace) then
    raise exception 'Only the person who made a link, or the workspace''s owner, can revoke it.' using errcode = '42501';
  end if;
  if t.revoked_at is null then
    update public.agent_tokens x set revoked_at = now(), revoked_by = auth.uid() where x.id = t.id returning * into t;
  end if;
  if t.session is not null or t.session_lease is not null then
    update public.agent_tokens x set session = null, session_lease = null, session_lease_until = null where x.id = t.id returning * into t;
  end if;
  return public.agent_token_listed(t);
end;
$$;

-- ── Business links only ──────────────────────────────────────────────────────────

-- As 20261028090000_agent_tokens.sql: the live business link `p_hash` names, so a kit token never reads
-- through business_for_token() nor any other link's function. Anything else is 28000.
create or replace function public.agent_token_of(p_hash text) returns public.agent_tokens
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  t public.agent_tokens;
begin
  if p_hash is not null and p_hash ~ '^[0-9a-f]{64}$' then
    select * into t from public.agent_tokens x
     where x.token_hash = p_hash and x.revoked_at is null and x.scope = 'business'
       and exists (select 1 from public.workspace_members m where m.workspace_id = x.workspace_id and m.user_id = x.made_by);
  end if;
  if t.id is null then
    raise exception 'This link does not work: make a new one on Settings › Business.' using errcode = '28000';
  end if;
  return t;
end;
$$;

-- ── The exchange (service role only) ─────────────────────────────────────────────

-- The exchange's first half: the kit token `p_hash` names, locked, and why it does not work, or its
-- sealed session with a fresh lease of 30 seconds. Never a business link (`unknown`).
create function public.kit_token_claim(p_hash text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.agent_tokens;
  ws public.workspaces;
  lease uuid := gen_random_uuid();
begin
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('state', 'unknown');
  end if;
  select * into t from public.agent_tokens x where x.token_hash = p_hash and x.scope = 'kit' for update;
  if not found then
    return jsonb_build_object('state', 'unknown');
  end if;
  if t.revoked_at is not null or t.session is null then
    return jsonb_build_object('state', 'revoked');
  end if;
  if t.expires_at <= now() then
    return jsonb_build_object('state', 'expired', 'expiresAt', t.expires_at);
  end if;
  if not exists (select 1 from public.workspace_members m where m.workspace_id = t.workspace_id and m.user_id = t.made_by) then
    select * into ws from public.workspaces w where w.id = t.workspace_id;
    return jsonb_build_object('state', 'not-a-member',
      'login', public.agent_token_listed(t) -> 'maker' ->> 'login',
      'workspace', jsonb_build_object('slug', ws.slug, 'name', ws.name));
  end if;
  if t.session_lease is not null and t.session_lease_until > now() then
    return jsonb_build_object('state', 'busy');
  end if;
  update public.agent_tokens x set session_lease = lease, session_lease_until = now() + interval '30 seconds' where x.id = t.id;
  return jsonb_build_object('state', 'ok', 'id', t.id, 'owner', t.made_by, 'session', t.session, 'lease', lease,
    'expiresAt', t.expires_at, 'lastFour', t.last_four);
end;
$$;

-- The exchange's second half: the renewed session, sealed, written back under the lease, which ends;
-- `last_used_at` moves at most once a minute. False when the lease is not this exchange's any more, or
-- the token was revoked meanwhile: nothing is written.
create function public.kit_token_renewed(p_token uuid, p_lease uuid, p_session text) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(p_session, '') = '' or char_length(p_session) > 4096 then
    raise exception 'Session: the sealed sign-in the token unlocks.' using errcode = '22023', hint = 'session';
  end if;
  update public.agent_tokens x
     set session = p_session, session_lease = null, session_lease_until = null,
         last_used_at = case when x.last_used_at is null or x.last_used_at < now() - interval '1 minute' then now() else x.last_used_at end
   where x.id = p_token and x.scope = 'kit' and x.session_lease = p_lease and x.revoked_at is null;
  return found;
end;
$$;

-- Ends a lease whose exchange failed before it renewed anything.
create function public.kit_token_release(p_token uuid, p_lease uuid) returns void
language sql
security definer
set search_path = ''
as $$
  update public.agent_tokens x set session_lease = null, session_lease_until = null
   where x.id = p_token and x.session_lease = p_lease
$$;

-- ── Who may do what ──────────────────────────────────────────────────────────────

revoke execute on function public.agent_tokens_live(uuid) from public, anon, authenticated;

revoke execute on function public.kit_token_make(text, text, text, text, integer, text) from public, anon;
grant execute on function public.kit_token_make(text, text, text, text, integer, text) to authenticated;
revoke execute on function public.kit_tokens_mine(uuid) from public, anon;
grant execute on function public.kit_tokens_mine(uuid) to authenticated;

-- The sealed session is the server's alone.
revoke execute on function public.kit_token_claim(text) from public, anon, authenticated;
grant execute on function public.kit_token_claim(text) to service_role;
revoke execute on function public.kit_token_renewed(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.kit_token_renewed(uuid, uuid, text) to service_role;
revoke execute on function public.kit_token_release(uuid, uuid) from public, anon, authenticated;
grant execute on function public.kit_token_release(uuid, uuid) to service_role;
