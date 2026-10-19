-- Each PRD's plan targets, stored once (PRD 2174 s1, docs:
-- .omni-loop/delivery/inbox/2174-constellation-real-scale/spec.md §1).
--
-- - prd_targets: one row per PRD dossier and repository its latest plan's `## Repositories` table
--   names, resolved to owner/name (under the home repository's owner, else the workspace's only
--   repository of that name), with the dossier's workspace. A name the workspace does not list is
--   skipped. The home repository is a target only when the plan names it: a plan repository's PRDs are
--   homed in it, and counting it would tie it to every target.
-- - Written on each version added, by dossier_link_repositories() (the dossier_versions_product trigger
--   and dossier_push() already call it): it now replaces the dossier's rows through
--   dossier_write_targets(), for any dossier, with or without a product, then links the product's
--   repositories exactly as before. A plan with no Repositories table, or no plan, leaves no row.
-- - Backfilled once, here, by prd_targets_backfill(): every dossier with a plan version, from its
--   latest plan.
-- - Every member of the dossier's workspace reads the rows, as `dossiers`; nobody writes them but the
--   two functions above (security definer), which no client may run.
--
-- Proven by supabase/checks/prd_targets.sql.
--
-- Rollback: a follow-up migration drops prd_targets, dossier_write_targets() and prd_targets_backfill(),
-- and restores dossier_link_repositories() as 20261129100000_prd_product.sql defines it. Nothing else
-- reads the table.

-- ── The targets ──────────────────────────────────────────────────────────────────

create table public.prd_targets (
  dossier_id   uuid not null references public.dossiers (id) on delete cascade,
  workspace_id uuid not null,
  repository   text not null,
  primary key (dossier_id, repository),
  foreign key (workspace_id, repository) references public.repositories (workspace_id, full_name) on delete cascade
);

create index prd_targets_repository_idx on public.prd_targets (workspace_id, repository);

comment on table public.prd_targets is
  'PRD 2174: the repositories a PRD''s latest plan targets (its ## Repositories table, resolved), one row per dossier and repository. Written on each version added by dossier_link_repositories(); members read; no client writes.';

alter table public.prd_targets enable row level security;

create policy "a member reads their workspace's PRD targets" on public.prd_targets
  for select to authenticated using (workspace_id in (select public.my_workspaces()));

revoke all on public.prd_targets from public, anon, authenticated, service_role;
grant select on public.prd_targets to authenticated, service_role;

-- ── Who writes them ──────────────────────────────────────────────────────────────

-- Replaces the dossier's targets with the repositories its latest plan's Repositories table names,
-- resolved as dossier_link_repositories() always resolved them and kept only when the workspace lists
-- them. Answers them; {} for no such dossier, no plan or no table.
create function public.dossier_write_targets(p_dossier uuid) returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  target  public.dossiers;
  v_plan  text;
  v_owner text;
  v_names text[] := '{}';
  v_name  text;
  v_found text;
  written text[];
begin
  select d.* into target from public.dossiers d where d.id = p_dossier;
  if target.id is null then
    return '{}';
  end if;
  v_owner := split_part(target.home_repo, '/', 1);
  select v.content into v_plan
    from public.dossier_versions v
   where v.dossier_id = target.id and v.kind = 'plan'
   order by v.created_at desc, v.id desc
   limit 1;
  foreach v_name in array public.plan_repository_names(v_plan) loop
    v_found := null;
    if position('/' in v_name) > 0 then
      v_found := v_name;
    else
      select r.full_name into v_found from public.repositories r
       where r.workspace_id = target.workspace_id and r.full_name = v_owner || '/' || v_name;
      if v_found is null then
        select min(r.full_name) into v_found from public.repositories r
         where r.workspace_id = target.workspace_id and split_part(r.full_name, '/', 2) = v_name
        having count(*) = 1;
      end if;
    end if;
    if v_found is not null then
      v_names := v_names || v_found;
    end if;
  end loop;

  delete from public.prd_targets t where t.dossier_id = target.id;
  with added as (
    insert into public.prd_targets (dossier_id, workspace_id, repository)
    select distinct target.id, target.workspace_id, r.full_name
      from public.repositories r
     where r.workspace_id = target.workspace_id and r.full_name = any (v_names)
    on conflict (dossier_id, repository) do nothing
    returning repository
  )
  select coalesce(array_agg(a.repository order by a.repository), '{}') into written from added a;
  return written;
end;
$$;

-- As 20261129100000_prd_product.sql, and first it writes the dossier's targets, for a dossier with or
-- without a product. The product linking is unchanged: the home repository, and every target, joins the
-- dossier's product (added_by = prd); a link that exists is left as it is.
create or replace function public.dossier_link_repositories(p_dossier uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  target  public.dossiers;
  v_repos text[];
begin
  select d.* into target from public.dossiers d where d.id = p_dossier;
  if target.id is null then
    return;
  end if;
  v_repos := public.dossier_write_targets(target.id);
  if target.product_id is null then
    return;
  end if;

  insert into public.product_repositories (product_id, workspace_id, repository, added_by)
  select distinct target.product_id, target.workspace_id, r.full_name, 'prd'
    from public.repositories r
   where r.workspace_id = target.workspace_id and r.full_name = any (array[target.home_repo] || v_repos)
  on conflict (product_id, repository) do nothing;
end;
$$;

-- Writes the targets of every dossier with a plan version, from its latest plan. Answers how many
-- dossiers it read.
create function public.prd_targets_backfill() returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dossier uuid;
  n         integer := 0;
begin
  for v_dossier in
    select d.id from public.dossiers d
     where exists (select 1 from public.dossier_versions v where v.dossier_id = d.id and v.kind = 'plan')
  loop
    perform public.dossier_write_targets(v_dossier);
    n := n + 1;
  end loop;
  return n;
end;
$$;

revoke execute on function public.dossier_write_targets(uuid) from public, anon, authenticated;
revoke execute on function public.dossier_link_repositories(uuid) from public, anon, authenticated;
revoke execute on function public.prd_targets_backfill() from public, anon, authenticated;

-- ── What was there before ────────────────────────────────────────────────────────

select public.prd_targets_backfill();
