-- Tracked repositories and their pull request statistics (PRD 612, docs:
-- .omni-loop/delivery/inbox/0612-engineering-board/spec.md). A workspace lists its repositories in
-- public.repositories, and its owner, and only its owner, adds one or switches its tracking through
-- add_repository() and set_repository_tracked(), each security definer and run as the signed-in
-- person, refusing anyone else with 42501 (built like 20261003090000_own_fleets.sql). Every member
-- reads the list. omni-app's prStats collector (the service role) writes the collection columns, and
-- the pull_requests and pull_request_reviews rows of the tracked repositories. Nobody signed in writes
-- any of the three tables directly. These tables are not the game's `sectors`: the game neither reads
-- nor writes them.
--
-- Vertuoza, and only Vertuoza, starts with six tracked repositories. Any other workspace starts with
-- none.
--
-- Proven by supabase/checks/repositories.sql.
-- Rollback: a follow-up migration drops the three tables and the three functions; nothing else reads
-- them.

-- ── The tables ───────────────────────────────────────────────────────────────────

create table public.repositories (
  workspace_id    uuid not null references public.workspaces on delete cascade,
  full_name       text not null check (full_name ~ '^[a-z0-9-]{1,39}/[a-z0-9._-]{1,100}$'),
  tracked         boolean not null default true,
  added_by        uuid references auth.users on delete set null,
  added_at        timestamptz not null default now(),
  collected_at    timestamptz,
  collected_until timestamptz,
  collect_error   text,
  primary key (workspace_id, full_name)
);

comment on table public.repositories is
  'A workspace''s repositories (PRD 612), owner/name in lower case. Its owner adds one or switches its tracking through add_repository() and set_repository_tracked(); nothing deletes one. Only a tracked repository is collected and counted on the Engineering board; switching tracking off keeps its rows.';
comment on column public.repositories.collected_at is 'When the collector last finished a collection of this repository, or null before the first.';
comment on column public.repositories.collected_until is 'The collector''s cursor: the latest `updated` of a pull request read so far.';
comment on column public.repositories.collect_error is 'Why the last collection failed, or null when it succeeded. Retried on the next run.';

create table public.pull_requests (
  workspace_id  uuid not null,
  repo          text not null,
  number        integer not null check (number > 0),
  author        text,
  author_is_bot boolean not null default false,
  opened_at     timestamptz not null,
  merged_at     timestamptz,
  closed_at     timestamptz,
  merged_by     text,
  base          text,
  commits       integer not null default 0 check (commits >= 0),
  additions     integer not null default 0 check (additions >= 0),
  deletions     integer not null default 0 check (deletions >= 0),
  omni_signed   boolean not null default false,
  primary key (workspace_id, repo, number),
  foreign key (workspace_id, repo) references public.repositories (workspace_id, full_name) on delete cascade
);

create index pull_requests_opened_idx on public.pull_requests (workspace_id, opened_at);
create index pull_requests_merged_idx on public.pull_requests (workspace_id, merged_at);

comment on table public.pull_requests is
  'One row per pull request of a tracked repository, as the prStats collector last read it (PRD 612). omni_signed: Omni-man signed it (the sign trailer, the footer marker, or omni-loop-invader[bot] opened it).';

create table public.pull_request_reviews (
  workspace_id uuid not null,
  repo         text not null,
  number       integer not null,
  reviewer     text not null,
  first_at     timestamptz not null,
  primary key (workspace_id, repo, number, reviewer),
  foreign key (workspace_id, repo, number) references public.pull_requests (workspace_id, repo, number) on delete cascade
);

create index pull_request_reviews_first_idx on public.pull_request_reviews (workspace_id, first_at);

comment on table public.pull_request_reviews is
  'Who reviewed a pull request (PRD 612): once per reviewer, dated at their first submitted review, never its author.';

-- ── Who owns the list ────────────────────────────────────────────────────────────

-- Refuses the caller unless they own the workspace.
create function public.repository_owner_only(p_workspace uuid) returns void
language plpgsql stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or p_workspace is null or not public.is_owner(p_workspace) then
    raise exception 'Only the workspace''s owner can change its repositories.' using errcode = '42501';
  end if;
end;
$$;

-- Adds a repository to the workspace, tracked. `owner/name` is kept in lower case. Adding one already
-- listed answers it as it is.
create function public.add_repository(p_workspace uuid, p_full_name text) returns public.repositories
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text := lower(btrim(coalesce(p_full_name, '')));
  made public.repositories;
begin
  perform public.repository_owner_only(p_workspace);
  if name !~ '^[a-z0-9-]{1,39}/[a-z0-9._-]{1,100}$' then
    raise exception 'Repository: owner/name, as GitHub spells it.' using errcode = '22023', hint = 'full_name';
  end if;
  insert into public.repositories (workspace_id, full_name, added_by)
  values (p_workspace, name, auth.uid())
  on conflict (workspace_id, full_name) do nothing
  returning * into made;
  if not found then
    select * into made from public.repositories r where r.workspace_id = p_workspace and r.full_name = name;
  end if;
  return made;
end;
$$;

-- Switches a repository's tracking on or off. Off stops its collection and hides it from the
-- Engineering board; its rows stay.
create function public.set_repository_tracked(p_workspace uuid, p_full_name text, p_tracked boolean) returns public.repositories
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed public.repositories;
begin
  perform public.repository_owner_only(p_workspace);
  if p_tracked is null then
    raise exception 'Tracked: on or off.' using errcode = '22023', hint = 'tracked';
  end if;
  update public.repositories r
     set tracked = p_tracked
   where r.workspace_id = p_workspace and r.full_name = lower(btrim(coalesce(p_full_name, '')))
  returning * into changed;
  if not found then
    raise exception 'Repository: no repository % in this workspace.', p_full_name using errcode = 'P0002', hint = 'full_name';
  end if;
  return changed;
end;
$$;

-- ── Who may do what ──────────────────────────────────────────────────────────────

alter table public.repositories enable row level security;
alter table public.pull_requests enable row level security;
alter table public.pull_request_reviews enable row level security;

create policy "a member reads their workspace's repositories" on public.repositories
  for select to authenticated using (public.is_member(workspace_id));
create policy "a member reads their workspace's pull requests" on public.pull_requests
  for select to authenticated using (public.is_member(workspace_id));
create policy "a member reads their workspace's reviews" on public.pull_request_reviews
  for select to authenticated using (public.is_member(workspace_id));

-- Signed out: nothing. Signed in: reads only, the rows above. The service role reads everything,
-- writes a repository's collection columns, and upserts pull requests and reviews.
revoke all on public.repositories, public.pull_requests, public.pull_request_reviews
  from public, anon, authenticated, service_role;
grant select on public.repositories, public.pull_requests, public.pull_request_reviews to authenticated;
grant select on public.repositories, public.pull_requests, public.pull_request_reviews to service_role;
grant update (collected_at, collected_until, collect_error) on public.repositories to service_role;
grant insert, update on public.pull_requests, public.pull_request_reviews to service_role;

revoke execute on function public.repository_owner_only(uuid) from public, anon, authenticated;
revoke execute on function public.add_repository(uuid, text) from public, anon;
grant execute on function public.add_repository(uuid, text) to authenticated;
revoke execute on function public.set_repository_tracked(uuid, text, boolean) from public, anon;
grant execute on function public.set_repository_tracked(uuid, text, boolean) to authenticated;

-- ── Vertuoza's six ───────────────────────────────────────────────────────────────

-- Only the workspace whose slug is vertuoza; nothing when there is none. No other workspace is
-- seeded with anything.
insert into public.repositories (workspace_id, full_name)
select w.id, r.full_name
  from public.workspaces w
 cross join (values
   ('vertuoza/vertuo-ai-domain'),
   ('vertuoza/vertuo-workflow-domain'),
   ('vertuoza/vertuo-omni-loop'),
   ('vertuoza/vertuo-backend-php'),
   ('vertuoza/vertuo-apps'),
   ('vertuoza/pdf-builder')
 ) as r (full_name)
 where w.slug = 'vertuoza'
on conflict (workspace_id, full_name) do nothing;
