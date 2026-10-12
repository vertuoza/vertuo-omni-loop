-- Asking a PRD's approvers, and the record a void will leave (PRD 1322 s2, docs:
-- .omni-loop/delivery/inbox/1322-approval-handshake/spec.md §1, §3 and §7).
--
-- - approval_requests: append-only, one row per request `omni wait approval` posts: the dossier, its
--   product, who asked, who is asked, whether nobody but the author was left, `asked` or `re-asked`
--   (a dossier asked before), and when. Every member of the dossier's workspace reads them.
-- - approval_voids: append-only, one row per approval a changed pinned file voided: the approval, the
--   kind, the old and the new sha256, who pushed. Nothing writes it yet: `dossier_push` will (s6).
-- - approval_request(repo, prd): a member asks a ◆ PRD's approvers. Asked: the members its product
--   lists as asked to approve, except the PRD's author; when that leaves nobody (no product, nobody
--   asked, or only the author), the author. Records the request and answers who was asked, with what
--   the notification shows (the title, the latest hash of each kind, the spec).
-- - approval_recipients(request): how each asked person is reached, for the server's service role
--   only: their email when Email is on, their devices when Phone alerts is on.
-- - approval_requests_waiting(): the requests that wait on the caller, for the bell: the latest
--   request of each dossier that asks them, with no approval since.
-- - The three tables join Supabase Realtime's publication, which the approval stream follows (s3).
--
-- Proven by supabase/checks/approval_requests.sql.
--
-- Rollback: a follow-up migration drops the three functions, member_login(), the two tables and
-- their trigger function, and takes approvals out of the publication. Nothing else reads them.

-- ── A member's login, as an approval records it ─────────────────────────────────

-- Their player's GitHub login in that workspace, else their GitHub identity's user name, else their
-- email, else their id; lower case. The rule dossier_approve() writes approver_login with.
create function public.member_login(p_workspace uuid, p_user uuid) returns text
language sql stable
security definer
set search_path = ''
as $$
  select left(lower(coalesce(nullif(p.github_login, ''), (
           select coalesce(i.identity_data ->> 'user_name', i.identity_data ->> 'preferred_username')
             from auth.identities i
            where i.user_id = p_user and i.provider = 'github'
            order by i.created_at limit 1),
           (select u.email from auth.users u where u.id = p_user),
           p_user::text)), 200)
    from (select 1) one
    left join public.players p on p.workspace_id = p_workspace and p.user_id = p_user
$$;

-- ── The two append-only tables ───────────────────────────────────────────────────

create table public.approval_requests (
  id           uuid primary key default gen_random_uuid(),
  dossier_id   uuid not null references public.dossiers on delete cascade,
  workspace_id uuid not null,
  product_id   uuid references public.products on delete set null,
  asked_by     uuid not null,
  asked        uuid[] not null,
  nobody_else  boolean not null,
  kind         text not null check (kind in ('asked', 're-asked')),
  asked_at     timestamptz not null default clock_timestamp()
);

comment on table public.approval_requests is
  'PRD 1322: one row per request to approve a ◆ PRD, append-only. Written only by approval_request(); never updated; deleted only with its dossier.';
comment on column public.approval_requests.asked is
  'Who is asked: the product''s members asked to approve, except the author; the author alone when nobody else is (nobody_else).';
comment on column public.approval_requests.kind is 'asked: the dossier''s first request; re-asked: any later one (after a void).';

create index approval_requests_dossier_idx on public.approval_requests (dossier_id, asked_at desc, id desc);
create index approval_requests_asked_idx on public.approval_requests using gin (asked);

create table public.approval_voids (
  id           uuid primary key default gen_random_uuid(),
  approval_id  uuid not null references public.approvals on delete cascade,
  dossier_id   uuid not null references public.dossiers on delete cascade,
  kind         text not null check (kind in ('spec', 'plan', 'before-after', 'voice')),
  from_sha256  text not null check (from_sha256 ~ '^[0-9a-f]{64}$'),
  to_sha256    text not null check (to_sha256 ~ '^[0-9a-f]{64}$'),
  pushed_by    uuid,
  pusher_login text not null check (char_length(pusher_login) between 1 and 200),
  voided_at    timestamptz not null default clock_timestamp()
);

comment on table public.approval_voids is
  'PRD 1322: one row per approval a push voided, append-only: the approval stays as it was, and an approval with a void after it is no longer in force. Never updated; deleted only with its approval.';

create index approval_voids_dossier_idx on public.approval_voids (dossier_id, voided_at desc, id desc);

-- Nobody updates or deletes a row: only a cascade does (a referential action runs inside a trigger).
create function public.approval_rows_append_only() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' or pg_trigger_depth() = 1 then
    raise exception 'A row of % is never changed or deleted: append a new one instead.', tg_table_name using errcode = '42501';
  end if;
  return old;
end;
$$;

create trigger approval_requests_append_only
  before update or delete on public.approval_requests
  for each row execute function public.approval_rows_append_only();
create trigger approval_voids_append_only
  before update or delete on public.approval_voids
  for each row execute function public.approval_rows_append_only();

alter table public.approval_requests enable row level security;
alter table public.approval_voids enable row level security;

create policy "a member reads their workspace's approval requests" on public.approval_requests
  for select to authenticated
  using (public.is_member(workspace_id));
create policy "a member reads the voids of their workspace's dossiers" on public.approval_voids
  for select to authenticated
  using (exists (select 1 from public.dossiers d where d.id = dossier_id and public.is_member(d.workspace_id)));

revoke all on public.approval_requests from anon, authenticated, service_role;
revoke all on public.approval_voids from anon, authenticated, service_role;
grant select on public.approval_requests to authenticated, service_role;
grant select on public.approval_voids to authenticated, service_role;

-- ── Asking ───────────────────────────────────────────────────────────────────────

-- The caller, a member of the dossier's workspace, asks a numbered ◆ PRD's approvers. Answers
-- {id, dossier, repo, prd, title, kind, askedAt, product, author, nobodyElse,
--  asked: [{user, login, name}], files: [{kind, sha256}], spec}. 42501 signed out, P0002 no such PRD
-- the caller reads, 22023 a PRD born in the repository.
create function public.approval_request(p_repo text, p_prd integer) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller      uuid := (select auth.uid());
  target      public.dossiers%rowtype;
  product     public.products%rowtype;
  has_product boolean;
  author      uuid;
  chosen      uuid[];
  nobody      boolean;
  made        public.approval_requests%rowtype;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select d.* into target
    from public.dossiers d
   where d.home_repo = lower(btrim(coalesce(p_repo, ''))) and d.kind = 'prd' and d.prd = p_prd
     and public.is_member(d.workspace_id)
   order by d.numbered_at desc nulls last, d.id
   limit 1;
  if not found then
    raise exception 'No dossier for PRD #% of %.', p_prd, p_repo using errcode = 'P0002';
  end if;
  if target.birthplace is distinct from 'server' then
    raise exception 'PRD #% was born in the repository: its phase-0 pull request approves it.', target.prd using errcode = '22023';
  end if;
  select p.* into product
    from public.repositories r
    join public.products p on p.id = r.product_id
   where r.workspace_id = target.workspace_id and r.full_name = target.home_repo;
  has_product := found;
  -- A dossier the fallback opened names no author: the person asking stands in.
  author := coalesce(target.opened_by, caller);

  select coalesce(array_agg(a.user_id order by a.set_at, a.user_id), '{}') into chosen
    from public.product_approvers a
   where has_product and a.product_id = product.id and a.state = 'asked' and a.user_id <> author;
  nobody := cardinality(chosen) = 0;
  if nobody then
    chosen := array[author];
  end if;

  insert into public.approval_requests (dossier_id, workspace_id, product_id, asked_by, asked, nobody_else, kind)
  values (target.id, target.workspace_id, case when has_product then product.id end, caller, chosen, nobody,
          case when exists (select 1 from public.approval_requests r where r.dossier_id = target.id) then 're-asked' else 'asked' end)
  returning * into made;

  return jsonb_build_object(
    'id', made.id,
    'dossier', target.id,
    'repo', target.home_repo,
    'prd', target.prd,
    'title', target.title,
    'kind', made.kind,
    'askedAt', made.asked_at,
    'product', case when has_product then product.name end,
    'author', public.member_login(target.workspace_id, author),
    'nobodyElse', nobody,
    'asked', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'user', u.id,
               'login', public.member_login(target.workspace_id, u.id),
               'name', nullif(btrim(pl.display_name), '')) order by u.o), '[]'::jsonb)
        from unnest(chosen) with ordinality as u (id, o)
        left join public.players pl on pl.workspace_id = target.workspace_id and pl.user_id = u.id),
    'files', (
      select coalesce(jsonb_agg(jsonb_build_object('kind', l.kind, 'sha256', l.sha256) order by l.o), '[]'::jsonb)
        from (
          select distinct on (v.kind) v.kind, v.sha256, k.o
            from public.dossier_versions v
            join unnest(array['spec', 'plan', 'before-after', 'voice']) with ordinality as k (kind, o) on k.kind = v.kind
           where v.dossier_id = target.id
           order by v.kind, v.created_at desc, v.id desc
        ) l),
    'spec', (
      select v.content from public.dossier_versions v
       where v.dossier_id = target.id and v.kind = 'spec'
       order by v.created_at desc, v.id desc
       limit 1));
end;
$$;

-- How each person a request asked is reached: [{user, email, devices: [{id, endpoint, p256dh, auth}]}],
-- `email` null unless their Email switch is on, `devices` empty unless Phone alerts is. For the
-- server's service role only: it reads addresses no member reads.
create function public.approval_recipients(p_request uuid) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'user', u.id,
           'email', case when c.email then au.email end,
           'devices', case when c.push then (
             select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)
                                       order by s.created_at, s.id), '[]'::jsonb)
               from public.push_subscriptions s where s.user_id = u.id) else '[]'::jsonb end)
         order by u.o), '[]'::jsonb)
    from public.approval_requests r
    cross join unnest(r.asked) with ordinality as u (id, o)
    left join public.alert_channels c on c.user_id = u.id
    left join auth.users au on au.id = u.id
   where r.id = p_request
$$;

-- The requests that wait on the caller, oldest first: of each dossier of their workspaces, its latest
-- request, when it asks them and nobody approved the PRD since. [{id, dossier, repo, prd, title, askedAt}].
create function public.approval_requests_waiting() returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  with latest as (
    select distinct on (r.dossier_id) r.*
      from public.approval_requests r
     where public.is_member(r.workspace_id)
     order by r.dossier_id, r.asked_at desc, r.id desc
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', l.id, 'dossier', d.id, 'repo', d.home_repo, 'prd', d.prd, 'title', d.title, 'askedAt', l.asked_at)
         order by l.asked_at, l.id), '[]'::jsonb)
    from latest l
    join public.dossiers d on d.id = l.dossier_id
   where (select auth.uid()) = any (l.asked)
     and not exists (select 1 from public.approvals a where a.dossier_id = l.dossier_id and a.approved_at >= l.asked_at)
$$;

-- ── Realtime ─────────────────────────────────────────────────────────────────────

-- The approval stream follows approvals, voids and requests as the signed-in member (row-level
-- security applies). A database without Supabase Realtime's publication skips this.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.approvals, public.approval_voids, public.approval_requests;
  end if;
end;
$$;

revoke execute on function public.member_login(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.approval_rows_append_only() from public, anon, authenticated;
revoke execute on function public.approval_request(text, integer) from public, anon;
revoke execute on function public.approval_recipients(uuid) from public, anon, authenticated;
revoke execute on function public.approval_requests_waiting() from public, anon;
grant execute on function public.approval_request(text, integer) to authenticated;
grant execute on function public.approval_recipients(uuid) to service_role;
grant execute on function public.approval_requests_waiting() to authenticated;
