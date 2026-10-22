-- An API key's GitHub App (PRD 2433 s1, docs: .omni-loop/delivery/inbox/2433-api-key-github-app/spec.md,
-- "A key carries at most one GitHub App" and "Which runner takes it"). A workspace owner attaches the
-- GitHub App of the program that holds an API key (PRD 2022): the job the key sends then runs on GitHub as
-- that app, never as the person whose machine runs it. Galaxy's server checks the App ID and private key
-- pair with GitHub, seals the key (AES-256-GCM under SECRETS_MASTER_KEY, apps/galaxy/src/jev/secret-box.ts,
-- as PRD 812 seals Jev's) and sends only the sealed text here; this migration is the storage and its rules.
--
--   public.api_key_github_apps               one row per key: `key_id`, `workspace_id`, `app_id`, `slug`,
--                                            `bot_id`, the sealed private key (`ciphertext`, `iv`), who
--                                            attached it and when, and when it last minted a token. RLS is
--                                            on and no policy reads it: nobody signed in selects a row.
--                                            The service role selects `key_id` only (runner_claim()).
--   public.runner_job_needs_app              the jobs a key queued while it held an app: the app's row is
--                                            deleted with the app, the mark stays, so a job queued for the
--                                            app never becomes a job that runs as a person (spec §10).
--                                            Written by the trigger below alone; the service role selects.
--   public.runners.github_app                a runner registered `githubApp: true`: it can run a job as an
--                                            app. False for every runner already there, until it updates.
--   api_key_github_app_attach(key, app_id, slug, bot_id, ciphertext, iv)
--                                            owners of the key's workspace only, on a live key: inserts or
--                                            replaces the row (a replaced pair starts `last_token_at`
--                                            again). Answers the key's `{keyId, slug, lastTokenAt}`
--   api_key_github_app_remove(key)           owners only: deletes the row. Answers whether there was one
--   api_key_github_apps_list(workspace)      any member: each live key's `{keyId, slug}` that holds an app,
--                                            newest key first, and `lastTokenAt` for an owner only. Never
--                                            the ciphertext nor the iv
--   api_key_github_app_of_job(job)           service role only: `{key_id, workspace_id, working, needs_app,
--                                            app, repos, product_repos}` for a job a key queued, null for
--                                            any other job. `app` is `{app_id, slug, bot_id, ciphertext,
--                                            iv}` or null; `working` is the key's (not revoked, its maker
--                                            still a member, as api_key_of()); `needs_app` is true while the
--                                            key holds an app or the job was queued while it did. `repos` is
--                                            the key's allow-list (`agent_tokens.repos`, which the service
--                                            role cannot select; empty means every repository of the
--                                            workspace) and `product_repos` the repositories of the live
--                                            products that name the job's repository: what a mega bug fix's
--                                            token is widened to, within `repos`, by the server
--   api_key_github_app_of_key(key)           service role only: `{app}` for a key that holds an app, null for
--                                            any other. `app` is `{app_id, slug, ciphertext, iv}`: what the
--                                            public API opens to check the app is installed on a repository
--                                            before it queues a job
--   api_key_github_app_minted(key)           service role only: sets `last_token_at`
--   runner_claim(runner)                     changed: a runner whose `github_app` is false never takes a job
--                                            that needs an app (the key holds one, or the job is marked).
--                                            Its returned columns do not change
--
-- Revoking a key deletes its row, whichever function revokes it: api_key_revoke() (20261210090000) and
-- agent_token_revoke() (20261028090000, which revokes a token of any scope) both set `revoked_at`, so a
-- trigger on that column does the deleting. api_key_revoke() itself is unchanged. Removing the app deletes
-- the row too: the sealed private key is gone either way. A key whose maker left keeps its row, working
-- false, until an owner removes the app or revokes the key (BR-PRODUCT-64: it stops minting).
--
-- Laws kept: the functions read only the caller's workspace (BR-PRODUCT-63); an owner alone reads
-- `last_token_at` and no one reads the private key again (BR-PRODUCT-59); no answer, ledger row, ask
-- session or GitHub link is written (BR-PRODUCT-12, 28, 29, 39, N-PRODUCT-16).
--
-- Refusals: 42501 (not an owner of the key's workspace, a key the caller cannot see, a revoked key, not a
-- member to list), 22023 (a bad value, its field in the hint). Proven by supabase/checks/api_key_github_apps.sql.
-- Rollback: a follow-up migration restores runner_claim() as 20261207100000_runners.sql defines it, then
-- drops the two triggers and their functions, the five functions, the two tables and
-- `runners.github_app`. Until then nothing reads the new objects but the claim: with no row and no mark
-- it hands every job out exactly as before, and every key keeps working with no app.

-- ── The tables ───────────────────────────────────────────────────────────────────

create table public.api_key_github_apps (
  key_id        uuid primary key references public.agent_tokens (id) on delete cascade,
  workspace_id  uuid not null references public.workspaces (id) on delete cascade,
  app_id        bigint not null check (app_id > 0),
  slug          text not null check (slug ~ '^[a-z0-9][a-z0-9-]{0,99}$'),
  bot_id        bigint not null check (bot_id > 0),
  ciphertext    text not null check (ciphertext <> ''),
  iv            text not null check (iv <> ''),
  attached_by   uuid references auth.users (id) on delete set null,
  attached_at   timestamptz not null default now(),
  last_token_at timestamptz
);

create index api_key_github_apps_workspace on public.api_key_github_apps (workspace_id);

comment on table public.api_key_github_apps is
  'The GitHub App an API key''s jobs run as (PRD 2433): its id, slug and bot id in the clear, its private key sealed by Galaxy''s server with SECRETS_MASTER_KEY before it is stored. Written only by api_key_github_app_attach() and _remove() and the revoke of its key; opened only by the service role, through api_key_github_app_of_job() and api_key_github_app_of_key().';
comment on column public.api_key_github_apps.key_id is 'The API key (agent_tokens, scope api) the app belongs to: at most one app a key.';
comment on column public.api_key_github_apps.app_id is 'The GitHub App''s id.';
comment on column public.api_key_github_apps.slug is 'The App''s slug as GitHub reads it: its bot is `<slug>[bot]`.';
comment on column public.api_key_github_apps.bot_id is 'The id of the App''s bot user, which names its commit email `<bot_id>+<slug>[bot]@users.noreply.github.com`.';
comment on column public.api_key_github_apps.ciphertext is 'The App''s private key (PEM), sealed with AES-256-GCM; never returned to anyone signed in.';
comment on column public.api_key_github_apps.last_token_at is 'When the App last minted an installation token for a job of the key; an owner reads it.';

create table public.runner_job_needs_app (
  job_id    uuid primary key references public.runner_jobs (id) on delete cascade,
  marked_at timestamptz not null default now()
);

comment on table public.runner_job_needs_app is
  'A job queued by an API key while the key held a GitHub App (PRD 2433): it runs as that app or not at all, even once the app is removed or the key revoked. Written by the runner_jobs trigger alone; read by runner_claim() and api_key_github_app_of_job().';

alter table public.runners add column github_app boolean not null default false;

comment on column public.runners.github_app is
  'The runner registered `githubApp: true` (PRD 2433): it runs a job of a key with a GitHub App as that app. False: it never takes one, so a runner on an older kit never runs one as its machine''s account.';

-- ── The rows are reached through functions only ──────────────────────────────────

alter table public.api_key_github_apps enable row level security;
alter table public.runner_job_needs_app enable row level security;

-- No policy: nobody signed in reads a row. The service role reads what the claim needs and no more: which
-- key holds an app (key_id alone, never the sealed key) and which job is marked.
revoke all on public.api_key_github_apps, public.runner_job_needs_app from public, anon, authenticated, service_role;
grant select (key_id) on public.api_key_github_apps to service_role;
grant select on public.runner_job_needs_app to service_role;

-- ── Attaching and removing (owners only) ─────────────────────────────────────────

-- Attaches the App to `p_key`, or replaces the one it holds, for an owner of the key's workspace. A key the
-- caller cannot see, one of another scope and one that is not the caller's to change are refused alike
-- (42501); a revoked key is refused saying so. Galaxy's server has checked the pair with GitHub and sealed
-- the private key. The row's workspace is the key's.
create function public.api_key_github_app_attach(p_key uuid, p_app_id bigint, p_slug text, p_bot_id bigint, p_ciphertext text, p_iv text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.agent_tokens;
  a public.api_key_github_apps;
begin
  select * into t from public.agent_tokens x where x.id = p_key and x.scope = 'api' for update;
  if auth.uid() is null or not found or not public.is_owner(t.workspace_id) then
    raise exception 'Only an owner of the key''s workspace attaches or removes its GitHub App.' using errcode = '42501';
  end if;
  if t.revoked_at is not null then
    raise exception 'Key: this API key is revoked, so it takes no GitHub App.' using errcode = '42501', hint = 'key';
  end if;
  if p_app_id is null or p_app_id <= 0 then
    raise exception 'App ID: the GitHub App''s number.' using errcode = '22023', hint = 'app_id';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{0,99}$' then
    raise exception 'Slug: the GitHub App''s slug, lower case letters, digits and dashes.' using errcode = '22023', hint = 'slug';
  end if;
  if p_bot_id is null or p_bot_id <= 0 then
    raise exception 'Bot id: the id of the GitHub App''s bot.' using errcode = '22023', hint = 'bot_id';
  end if;
  if coalesce(p_ciphertext, '') = '' or coalesce(p_iv, '') = '' then
    raise exception 'Private key: a sealed key and its iv.' using errcode = '22023', hint = 'private_key';
  end if;

  insert into public.api_key_github_apps as g (key_id, workspace_id, app_id, slug, bot_id, ciphertext, iv, attached_by)
  values (t.id, t.workspace_id, p_app_id, p_slug, p_bot_id, p_ciphertext, p_iv, auth.uid())
  on conflict (key_id) do update
    set app_id = excluded.app_id, slug = excluded.slug, bot_id = excluded.bot_id,
        ciphertext = excluded.ciphertext, iv = excluded.iv,
        attached_by = excluded.attached_by, attached_at = now(), last_token_at = null
  returning g.* into a;
  return jsonb_build_object('keyId', a.key_id, 'slug', a.slug, 'lastTokenAt', a.last_token_at);
end;
$$;

-- Removes the App of `p_key`, for an owner of the key's workspace. Answers whether the key held one: a key
-- with none, or a revoked one (whose row went with it), changes nothing.
create function public.api_key_github_app_remove(p_key uuid) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  t public.agent_tokens;
  removed integer;
begin
  select * into t from public.agent_tokens x where x.id = p_key and x.scope = 'api';
  if auth.uid() is null or not found or not public.is_owner(t.workspace_id) then
    raise exception 'Only an owner of the key''s workspace attaches or removes its GitHub App.' using errcode = '42501';
  end if;
  delete from public.api_key_github_apps g where g.key_id = t.id;
  get diagnostics removed = row_count;
  return removed > 0;
end;
$$;

-- ── Listing ──────────────────────────────────────────────────────────────────────

-- The Apps of the workspace's live keys, newest key first, for any member: `{keyId, slug}`, and `lastTokenAt`
-- (null until the App first mints) for an owner only. A key with no App has no entry. Never the sealed key.
create function public.api_key_github_apps_list(p_workspace uuid) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  caller_owns boolean;
begin
  if auth.uid() is null or p_workspace is null or not public.is_member(p_workspace) then
    raise exception 'Only a member of the workspace can see its API keys.' using errcode = '42501';
  end if;
  caller_owns := public.is_owner(p_workspace);
  return coalesce((select jsonb_agg(
                     case when caller_owns
                       then jsonb_build_object('keyId', g.key_id, 'slug', g.slug, 'lastTokenAt', g.last_token_at)
                       else jsonb_build_object('keyId', g.key_id, 'slug', g.slug) end
                     order by t.created_at desc, t.id)
                     from public.api_key_github_apps g
                     join public.agent_tokens t on t.id = g.key_id
                    where g.workspace_id = p_workspace and t.scope = 'api' and t.revoked_at is null), '[]'::jsonb);
end;
$$;

-- ── What Galaxy's server reads to mint (service role only) ───────────────────────

-- The App a job runs as, for the service role: `{key_id, workspace_id, working, needs_app, app, repos,
-- product_repos}` for a job an API key queued, null for a person's job and for no job. `working` is true while
-- the key is not revoked and its maker is still a member of its workspace (as api_key_of()); `app` is null once
-- the key holds none; `needs_app` stays true for a job queued while the key held one, so a removed App or a
-- revoked key fails the job and never lets it run as a person. The sealed key is for the server to open, and no
-- one else.
--
-- `repos` is the key's allow-list as agent_tokens holds it (owner/name, lower case, empty for every repository
-- of the workspace): the server mints a job's token only for repositories within it (BR-PRODUCT-63), and reads
-- it here because the service role cannot select agent_tokens. `product_repos` is, in the job's own workspace
-- (BR-PRODUCT-63), every repository, in lower case and in order, of each live product (not archived) that names
-- the job's repository, a repository the owner removed left out: a mega bug fix's token is widened to those
-- the installation holds, within `repos`. A repository in no product has none, and the key's own limits are
-- applied by the server, not here: the list says what the products name, never what the key may reach.
create function public.api_key_github_app_of_job(p_job uuid) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  got jsonb;
begin
  select jsonb_build_object(
           'key_id', j.sent_by_key,
           'workspace_id', j.workspace_id,
           'working', t.id is not null and t.revoked_at is null
                      and exists (select 1 from public.workspace_members m where m.workspace_id = t.workspace_id and m.user_id = t.made_by),
           'needs_app', g.key_id is not null or exists (select 1 from public.runner_job_needs_app n where n.job_id = j.id),
           'app', case when g.key_id is null then null
                       else jsonb_build_object('app_id', g.app_id, 'slug', g.slug, 'bot_id', g.bot_id, 'ciphertext', g.ciphertext, 'iv', g.iv) end,
           -- No key row reads as no list; `working` is then false, and the server fails the job before it reads the list.
           'repos', coalesce(to_jsonb(t.repos), '[]'::jsonb),
           'product_repos', coalesce((select jsonb_agg(distinct l2.repository order by l2.repository)
                                        from public.product_repositories l1
                                        join public.products p on p.id = l1.product_id and p.workspace_id = l1.workspace_id and p.archived_at is null
                                        join public.product_repositories l2 on l2.product_id = l1.product_id and l2.workspace_id = l1.workspace_id
                                        join public.repositories r on r.workspace_id = l2.workspace_id and r.full_name = l2.repository and r.removed_at is null
                                       where l1.workspace_id = j.workspace_id and l1.repository = lower(j.repo)),
                                     '[]'::jsonb))
    into got
    from public.runner_jobs j
    left join public.agent_tokens t on t.id = j.sent_by_key and t.scope = 'api'
    left join public.api_key_github_apps g on g.key_id = j.sent_by_key
   where j.id = p_job and j.sent_by_key is not null;
  return got;
end;
$$;

-- The App a key holds, for the service role: `{app: {app_id, slug, ciphertext, iv}}`, null for a key that holds
-- none. The public API opens it to check the App is installed on a repository before it queues a job, when no
-- job exists yet for api_key_github_app_of_job() to read.
create function public.api_key_github_app_of_key(p_key uuid) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('app', jsonb_build_object('app_id', g.app_id, 'slug', g.slug, 'ciphertext', g.ciphertext, 'iv', g.iv))
    from public.api_key_github_apps g where g.key_id = p_key
$$;

-- Records that the key's App minted a token now: what an owner reads as `last token`.
create function public.api_key_github_app_minted(p_key uuid) returns void
language sql
security definer
set search_path = ''
as $$
  update public.api_key_github_apps g set last_token_at = now() where g.key_id = p_key
$$;

-- ── A revoked key loses its App ──────────────────────────────────────────────────

-- A key is revoked by api_key_revoke() or, as any token of its workspace, by agent_token_revoke(): both set
-- `revoked_at`, and the sealed private key goes with it, whichever one ran.
create function public.api_key_github_app_revoked() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.api_key_github_apps g where g.key_id = new.id;
  return null;
end;
$$;

create trigger agent_tokens_github_app_revoked
  after update of revoked_at on public.agent_tokens
  for each row when (new.revoked_at is not null and old.revoked_at is null)
  execute function public.api_key_github_app_revoked();

-- ── A job queued for the App stays a job for the App ─────────────────────────────

-- A job a key queues while it holds an App is marked. The mark outlives the App: a job queued for it never
-- runs under a machine's account, whatever happens to the App before a runner takes it (spec §10).
create function public.runner_job_needs_app_mark() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.api_key_github_apps g where g.key_id = new.sent_by_key) then
    insert into public.runner_job_needs_app (job_id) values (new.id) on conflict (job_id) do nothing;
  end if;
  return null;
end;
$$;

create trigger runner_jobs_needs_app_mark
  after insert on public.runner_jobs
  for each row when (new.sent_by_key is not null)
  execute function public.runner_job_needs_app_mark();

-- ── The claim ────────────────────────────────────────────────────────────────────

-- As 20261207100000_runners.sql, and a runner that did not register `githubApp` never takes a job that needs
-- an App: the key holds one, or the job was queued while it did. The job waits in the queue for a runner
-- that can run it as the App, as a job with no free runner does. Returned columns: the same.
create or replace function public.runner_claim(p_runner uuid) returns setof public.runner_jobs
language plpgsql
set search_path = ''
as $$
declare
  r    public.runners;
  busy integer;
begin
  select * into r from public.runners where id = p_runner for update;
  if r.id is null then
    return;
  end if;
  select count(*) into busy from public.runner_jobs j where j.runner_id = r.id and j.status in ('claimed', 'running');
  if busy >= r.slots then
    return;
  end if;
  return query
  update public.runner_jobs j
     set status = 'claimed', runner_id = r.id, claimed_at = now()
   where j.id = (
     select q.id from public.runner_jobs q
      where q.workspace_id = r.workspace_id
        and q.status = 'queued'
        and not q.cancel_requested
        and q.repo = any (r.repos)
        and (q.to_runner = r.id
             or (q.to_runner is null and q.to_fleet is not null and q.to_fleet = r.fleet)
             or (q.to_runner is null and q.to_fleet is null and r.fleet is null))
        and (r.github_app
             or (not exists (select 1 from public.api_key_github_apps g where g.key_id = q.sent_by_key)
                 and not exists (select 1 from public.runner_job_needs_app n where n.job_id = q.id)))
      order by q.queued_at, q.id
      limit 1
      for update skip locked)
     and j.status = 'queued'
  returning j.*;
end;
$$;

-- ── Who may do what ──────────────────────────────────────────────────────────────

revoke execute on function public.api_key_github_app_attach(uuid, bigint, text, bigint, text, text) from public, anon;
grant execute on function public.api_key_github_app_attach(uuid, bigint, text, bigint, text, text) to authenticated;
revoke execute on function public.api_key_github_app_remove(uuid) from public, anon;
grant execute on function public.api_key_github_app_remove(uuid) to authenticated;
revoke execute on function public.api_key_github_apps_list(uuid) from public, anon;
grant execute on function public.api_key_github_apps_list(uuid) to authenticated;

-- The sealed key and the mint are the server's alone.
revoke execute on function public.api_key_github_app_of_job(uuid) from public, anon, authenticated;
grant execute on function public.api_key_github_app_of_job(uuid) to service_role;
revoke execute on function public.api_key_github_app_of_key(uuid) from public, anon, authenticated;
grant execute on function public.api_key_github_app_of_key(uuid) to service_role;
revoke execute on function public.api_key_github_app_minted(uuid) from public, anon, authenticated;
grant execute on function public.api_key_github_app_minted(uuid) to service_role;

-- The triggers run as the table's owner whoever writes the row; nobody calls their functions.
revoke execute on function public.api_key_github_app_revoked() from public, anon, authenticated, service_role;
revoke execute on function public.runner_job_needs_app_mark() from public, anon, authenticated, service_role;
