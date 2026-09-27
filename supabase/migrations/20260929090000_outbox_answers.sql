-- Answer the outbox anywhere (PRD 251, docs: .omni-loop/delivery/inbox/0251-outbox-answers/spec.md):
-- the Omni page keeps each PRD's latest outbox, as the omni-loop App sends it, and the replies a person
-- sends from the page.
--
-- - dossier_outboxes: one row per dossier, the latest outbox the App evaluated on its feature pull
--   request (numbering, open, adopted, pending, settled, as sent). Written only by
--   dossier_outbox_put(), which the galaxy's /api/outbox calls with the service role once the App's
--   signature checks out: it finds or creates the dossier by PRD 216's key (the workspace whose
--   github_org owns the repository, the repository, the PRD), keeps only a newer evaluation, and
--   upserts, under a lock on the dossier. A member of the dossier's workspace reads it; nobody else.
-- - outbox_sends: each reply the page posts as a person. Its owner inserts it (a member of the
--   dossier's workspace), reads it, and records its outcome once through outbox_send_done(). Nobody
--   else reads it, and nobody deletes it.
-- - dossier_list() (PRD 216) gains open_questions: the open items of the dossier's outbox while its
--   pull request is open, 0 otherwise.
--
-- Rollback: a follow-up migration drops the two tables and the two functions, and puts back
-- 20260928110000_dossier_list.sql's dossier_list(). Nothing else reads them.

-- ── The latest outbox ───────────────────────────────────────────────────────────

create table public.dossier_outboxes (
  dossier_id    uuid primary key references public.dossiers on delete cascade,
  pr_number     integer not null check (pr_number > 0),
  pr_url        text not null check (char_length(pr_url) between 1 and 500),
  head_sha      text not null check (head_sha ~ '^[0-9a-f]{7,64}$'),
  state         text not null check (state in ('open', 'merged', 'closed')),
  outbox        jsonb not null check (jsonb_typeof(outbox) = 'object'),
  evaluated_at  timestamptz not null,
  received_at   timestamptz not null default now()
);

comment on table public.dossier_outboxes is
  'The latest outbox of each dossier''s feature pull request, as the omni-loop App evaluated and sent it. Written only by dossier_outbox_put().';
comment on column public.dossier_outboxes.outbox is 'numbering, open, adopted, pending and settled, as sent.';
comment on column public.dossier_outboxes.evaluated_at is 'When the App evaluated it: an older evaluation never replaces a newer one.';

-- Stores the outbox the App sent for `p_repo`'s PRD `p_prd`: finds the dossier by its key in the
-- workspace whose github_org owns the repository — creating it, titled after the PRD, when there is
-- none — and upserts its outbox unless the stored one was evaluated later. Returns {id, stale}:
-- stale true when nothing changed because the stored outbox is newer.
-- Refused: P0002 no workspace owns the repository's organisation; 22023 a malformed call.
create function public.dossier_outbox_put(
  p_repo         text,
  p_prd          integer,
  p_pr_number    integer,
  p_pr_url       text,
  p_head_sha     text,
  p_state        text,
  p_outbox       jsonb,
  p_evaluated_at timestamptz
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_repo  text := lower(btrim(coalesce(p_repo, '')));
  place   uuid;
  target  uuid;
  stored  timestamptz;
begin
  if v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' or char_length(v_repo) > 200 then
    raise exception 'An outbox names its repository as owner/name.' using errcode = '22023';
  end if;
  if p_prd is null or p_prd <= 0 or p_pr_number is null or p_pr_number <= 0 then
    raise exception 'An outbox names its PRD and its pull request by number.' using errcode = '22023';
  end if;
  if p_state is null or p_state not in ('open', 'merged', 'closed') then
    raise exception 'A pull request is open, merged or closed.' using errcode = '22023';
  end if;
  if p_outbox is null or jsonb_typeof(p_outbox) <> 'object' or p_evaluated_at is null then
    raise exception 'An outbox is an object, with the time it was evaluated.' using errcode = '22023';
  end if;

  select w.id into place
    from public.workspaces w
   where w.github_org is not null and lower(w.github_org) = split_part(v_repo, '/', 1)
   order by w.created_at, w.slug
   limit 1;
  if place is null then
    raise exception 'No workspace owns %.', split_part(v_repo, '/', 1) using errcode = 'P0002';
  end if;

  insert into public.dossiers (workspace_id, home_repo, prd, title, numbered_at)
  values (place, v_repo, p_prd, 'PRD ' || p_prd, now())
  on conflict (workspace_id, home_repo, prd) do nothing;
  select d.id into target from public.dossiers d
   where d.workspace_id = place and d.home_repo = v_repo and d.prd = p_prd
     for update;

  select o.evaluated_at into stored from public.dossier_outboxes o where o.dossier_id = target;
  if stored is not null and stored > p_evaluated_at then
    return jsonb_build_object('id', target, 'stale', true);
  end if;

  insert into public.dossier_outboxes (dossier_id, pr_number, pr_url, head_sha, state, outbox, evaluated_at, received_at)
  values (target, p_pr_number, p_pr_url, p_head_sha, p_state, p_outbox, p_evaluated_at, now())
  on conflict (dossier_id) do update
     set pr_number = excluded.pr_number, pr_url = excluded.pr_url, head_sha = excluded.head_sha,
         state = excluded.state, outbox = excluded.outbox, evaluated_at = excluded.evaluated_at,
         received_at = excluded.received_at;
  return jsonb_build_object('id', target, 'stale', false);
end;
$$;

-- ── The replies the page sends ──────────────────────────────────────────────────

create table public.outbox_sends (
  id           uuid primary key default gen_random_uuid(),
  dossier_id   uuid not null references public.dossiers on delete cascade,
  owner        uuid not null default auth.uid() references auth.users on delete cascade,
  pr_number    integer not null check (pr_number > 0),
  reply        text not null check (length(reply) between 1 and 16384),
  nonce_hash   text not null check (char_length(nonce_hash) between 1 and 200),
  created_at   timestamptz not null default now(),
  posted_at    timestamptz,
  comment_url  text,
  login        text,
  counted      boolean,
  error        text
);

comment on table public.outbox_sends is
  'Each reply the Omni page posts on a feature pull request as a person. Only its owner reads it; its outcome is recorded once, by outbox_send_done().';
comment on column public.outbox_sends.login is 'The GitHub account the reply was posted as.';
comment on column public.outbox_sends.counted is 'Whether its author_association is one omni replies counts.';

create index outbox_sends_owner_idx on public.outbox_sends (owner, created_at desc);

-- Records a send's outcome, once, for its owner only: posted (its comment's link, the account it was
-- posted as, whether the kit counts it) or failed (the error). Refused: 42501 signed out; P0002 no
-- send of the caller's; 22023 an outcome already recorded, or neither a link nor an error.
create function public.outbox_send_done(
  p_send        uuid,
  p_comment_url text default null,
  p_login       text default null,
  p_counted     boolean default null,
  p_error       text default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  send   public.outbox_sends%rowtype;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if (p_comment_url is null) = (p_error is null) then
    raise exception 'A send ends posted, with its link, or failed, with its error.' using errcode = '22023';
  end if;
  select s.* into send from public.outbox_sends s where s.id = p_send and s.owner = caller for update;
  if not found then
    raise exception 'No such send.' using errcode = 'P0002';
  end if;
  if send.posted_at is not null or send.error is not null then
    raise exception 'This send''s outcome is already recorded.' using errcode = '22023';
  end if;
  update public.outbox_sends s
     set posted_at = case when p_comment_url is null then null else now() end,
         comment_url = p_comment_url,
         login = p_login,
         counted = p_counted,
         error = left(p_error, 1000)
   where s.id = p_send;
end;
$$;

-- ── Who may do what ─────────────────────────────────────────────────────────────

alter table public.dossier_outboxes enable row level security;
alter table public.outbox_sends enable row level security;

create policy "a member reads the outbox of their workspace's dossiers" on public.dossier_outboxes
  for select to authenticated
  using (exists (select 1 from public.dossiers d where d.id = dossier_id and public.is_member(d.workspace_id)));

create policy "the owner reads their own sends" on public.outbox_sends
  for select to authenticated
  using (owner = (select auth.uid()));

create policy "a member sends on their workspace's dossiers, as themselves" on public.outbox_sends
  for insert to authenticated
  with check (
    owner = (select auth.uid())
    and exists (select 1 from public.dossiers d where d.id = dossier_id and public.is_member(d.workspace_id))
  );

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false).
revoke all on public.dossier_outboxes, public.outbox_sends from anon, authenticated, service_role;
grant select on public.dossier_outboxes to authenticated;
grant select on public.outbox_sends to authenticated;
grant insert (dossier_id, pr_number, reply, nonce_hash) on public.outbox_sends to authenticated;

revoke execute on function public.dossier_outbox_put(text, integer, integer, text, text, text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.dossier_outbox_put(text, integer, integer, text, text, text, jsonb, timestamptz) to service_role;
revoke execute on function public.outbox_send_done(uuid, text, text, boolean, text) from public, anon;
grant execute on function public.outbox_send_done(uuid, text, text, boolean, text) to authenticated;

-- ── dossier_list(), with the open questions ─────────────────────────────────────
-- PRD 216's dossier_list(), unchanged but for one more column: open_questions, the open items of the
-- dossier's outbox while its pull request is open (0 when it has none, or it merged or closed). Its
-- return type changes, so it is dropped and created again.

drop function public.dossier_list(uuid);

create function public.dossier_list(p_dossier uuid default null)
returns table (
  id             uuid,
  workspace_id   uuid,
  home_repo      text,
  prd            integer,
  title          text,
  opened_by      uuid,
  created_at     timestamptz,
  numbered_at    timestamptz,
  repos          text[],
  latest         jsonb,
  asked          integer,
  answered       integer,
  last_activity  timestamptz,
  open_questions integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select d.id as id, d.workspace_id as workspace_id, d.home_repo as home_repo, d.prd as prd, d.title as title,
         d.opened_by as opened_by, d.created_at as created_at, d.numbered_at as numbered_at,
         array[d.home_repo] || array(
           select distinct x.repo
             from unnest(q.repos || p.repos) as x (repo)
            where x.repo <> d.home_repo
            order by x.repo
         ) as repos,
         coalesce(v.latest, '{}'::jsonb) as latest,
         q.asked as asked,
         q.answered as answered,
         greatest(d.created_at, d.numbered_at, v.at, q.asked_at, q.answered_at) as last_activity,
         coalesce((
           select case
                    when o.state = 'open' and jsonb_typeof(o.outbox -> 'open') = 'array'
                    then jsonb_array_length(o.outbox -> 'open')
                    else 0
                  end
             from public.dossier_outboxes o
            where o.dossier_id = d.id
         ), 0) as open_questions
    from public.dossiers d
    -- Its rounds, by the two rules: how many, how many answered, when, and the repositories they were asked in.
    cross join lateral (
      select count(*)::integer as asked,
             (count(*) filter (where r.status = 'answered'))::integer as answered,
             max(r.created_at) as asked_at,
             max(r.answered_at) as answered_at,
             coalesce(array_agg(lower(r.repo)) filter (where r.repo is not null), '{}'::text[]) as repos
        from public.dossier_rounds(d.id) r
    ) q
    -- Its latest version of each kind, numbered by its place among its kind's.
    cross join lateral (
      select jsonb_object_agg(k.kind, jsonb_build_object('id', k.id, 'version', k.version, 'source', k.source, 'created_at', k.created_at)) as latest,
             max(k.created_at) as at
        from (
          select distinct on (dv.kind) dv.kind, dv.id, dv.source, dv.created_at, count(*) over (partition by dv.kind) as version
            from public.dossier_versions dv
           where dv.dossier_id = d.id
           order by dv.kind, dv.created_at desc, dv.id desc
        ) k
    ) v
    -- A PRD of its workspace's plan repository: its planet's regions, each a repository of the workspace's organisation.
    cross join lateral (
      select coalesce(array_agg(lower(w.github_org || '/' || e.region)), '{}'::text[]) as repos
        from public.workspaces w
        join public.ledger_events e
          on e.workspace_id = w.id and e.planet = d.prd and e.type = 'REGION_SURVEYED' and e.region is not null
       where w.id = d.workspace_id
         and w.github_org is not null
         and w.plan_repo is not null
         and d.home_repo = lower(w.github_org || '/' || w.plan_repo)
    ) p
   where p_dossier is null or d.id = p_dossier
   order by last_activity desc, d.id
$$;

comment on function public.dossier_list(uuid) is
  'Each dossier of the caller''s workspaces (or only p_dossier), newest activity first: its repositories (home, its questions'', its planet''s regions), its latest version of each kind, its question counts, its last activity and its open outbox questions. Security invoker: the caller''s row-level security decides.';

revoke execute on function public.dossier_list(uuid) from public, anon;
grant execute on function public.dossier_list(uuid) to authenticated;
