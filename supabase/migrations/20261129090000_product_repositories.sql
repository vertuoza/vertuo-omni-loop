-- A repository in no product, one or several (PRD 1364 s1, docs:
-- .omni-loop/delivery/inbox/1364-product-home/spec.md §1). The expand step: the links are added beside
-- repositories.product_id, which landing 3 drops once nothing reads it.
--
-- - product_repositories: one row per product and repository, with the fields a plan repository keeps
--   in plan.targets[]: role, knowledge, read_at, read_only and consumes, and who added it (`person`, or
--   `prd` when a PRD of the product touches it). No repository consumes itself, and every repository a
--   link consumes is linked to the same product. Every member of the workspace reads the links; only
--   its owners write them, through product_repository_link() and product_repository_unlink().
-- - Each repositories.product_id is copied into one link (added_by = 'person'), and the
--   repositories_default_product trigger is dropped: a new repository is in no product.
-- - Until landing 3 drops the column, every write of repositories.product_id (repository_set_product(),
--   business_open()) moves the repository's link with it, through repositories_product_link: the
--   deployed app keeps working, and the links never disagree with the column.
--
-- Proven by supabase/checks/product_repositories.sql.
--
-- Rollback: a follow-up migration drops the repositories_product_link trigger, product_repository_link(),
-- product_repository_unlink() and product_repositories, and restores repositories_default_product() and
-- its trigger as 20261019090000_business_store.sql defines them. repositories.product_id was kept in
-- step with every link the old writers made, so no lookup changes.

-- ── The links ────────────────────────────────────────────────────────────────────

create table public.product_repositories (
  product_id   uuid not null,
  workspace_id uuid not null,
  repository   text not null,
  role         text check (role ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' and char_length(role) <= 40),
  knowledge    text not null default 'own' check (knowledge in ('own', 'imported', 'none')),
  read_at      text check (read_at ~ '^[0-9a-f]{40}$'),
  read_only    boolean not null default false,
  consumes     text[] not null default '{}',
  added_by     text not null check (added_by in ('prd', 'person')),
  added_at     timestamptz not null default now(),
  primary key (product_id, repository),
  foreign key (product_id, workspace_id) references public.products (id, workspace_id) on delete cascade,
  foreign key (workspace_id, repository) references public.repositories (workspace_id, full_name) on delete cascade,
  check ((knowledge = 'imported') = (read_at is not null)),
  check (not (repository = any (consumes))),
  check (array_position(consumes, null) is null)
);

create index product_repositories_repository_idx on public.product_repositories (workspace_id, repository);

comment on table public.product_repositories is
  'PRD 1364: a repository in a product, one row per product and repository. A repository may be in no product, one or several. Members read; owners write through product_repository_link() and product_repository_unlink(); a PRD of the product adds its repositories (added_by = prd).';
comment on column public.product_repositories.role is 'One kebab-case word (api, web, mobile), or null until someone sets it.';
comment on column public.product_repositories.knowledge is 'Where its knowledge base lives: own (in the repository), imported (a copy read at read_at), none.';
comment on column public.product_repositories.read_at is 'The 40-hex commit an imported knowledge base was read at; null unless knowledge is imported.';
comment on column public.product_repositories.read_only is 'The product reads this repository but never writes it.';
comment on column public.product_repositories.consumes is 'The repositories of the same product this one consumes, owner/name each.';
comment on column public.product_repositories.added_by is 'prd: added because a PRD of the product touches it; person: added by someone.';

-- Every repository a link consumes is linked to the same product. Deferrable, so one transaction may
-- write a set of links in any order.
create function public.product_repositories_consumes_linked() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  missing text;
begin
  select c into missing
    from unnest(new.consumes) c
   where not exists (select 1 from public.product_repositories l where l.product_id = new.product_id and l.repository = c)
   limit 1;
  if missing is not null then
    raise exception 'Consumes: % is not in this product.', missing using errcode = '22023', hint = 'consumes';
  end if;
  return null;
end;
$$;

create constraint trigger product_repositories_consumes_linked
  after insert or update of consumes on public.product_repositories
  deferrable initially immediate
  for each row execute function public.product_repositories_consumes_linked();

alter table public.product_repositories enable row level security;

create policy "a member reads their workspace's product links" on public.product_repositories
  for select to authenticated using (public.is_member(workspace_id));

revoke all on public.product_repositories from public, anon, authenticated, service_role;
grant select on public.product_repositories to authenticated, service_role;

-- ── Who writes them: an owner ────────────────────────────────────────────────────

-- The product, locked, when the caller owns its workspace. 42501 signed out or not an owner, P0002 no
-- such product.
create function public.product_repository_owned(p_product uuid) returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned public.products;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  select p.* into owned from public.products p where p.id = p_product for update;
  if not found then
    raise exception 'Product: no such product.' using errcode = 'P0002', hint = 'product';
  end if;
  if not public.is_owner(owned.workspace_id) then
    raise exception 'Only an owner of the workspace changes the repositories of %.', owned.name using errcode = '42501';
  end if;
  return owned;
end;
$$;

-- Links a repository of the product's workspace to the product, or edits its link: every field is set
-- to what the call names. A new link is added by a person; an edited one keeps who added it. Answers the
-- link. 42501 not an owner, P0002 no such product or a repository the workspace does not list, 22023 an
-- invalid field, named first in the message and in `hint`.
create function public.product_repository_link(
  p_product    uuid,
  p_repository text,
  p_role       text default null,
  p_knowledge  text default 'own',
  p_read_at    text default null,
  p_read_only  boolean default false,
  p_consumes   text[] default '{}'
) returns public.product_repositories
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned    public.products;
  repo     text := lower(btrim(coalesce(p_repository, '')));
  v_role   text := nullif(btrim(coalesce(p_role, '')), '');
  v_read   text := nullif(lower(btrim(coalesce(p_read_at, ''))), '');
  v_uses   text[];
  made     public.product_repositories;
begin
  owned := public.product_repository_owned(p_product);
  if not exists (select 1 from public.repositories r where r.workspace_id = owned.workspace_id and r.full_name = repo) then
    raise exception 'Repository: no repository % in this workspace.', p_repository using errcode = 'P0002', hint = 'repository';
  end if;
  if v_role is not null and not (v_role ~ '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' and char_length(v_role) <= 40) then
    raise exception 'Role: % is not one kebab-case word.', v_role using errcode = '22023', hint = 'role';
  end if;
  if p_knowledge is null or p_knowledge not in ('own', 'imported', 'none') then
    raise exception 'Knowledge: own, imported or none.' using errcode = '22023', hint = 'knowledge';
  end if;
  if p_knowledge = 'imported' and v_read is null then
    raise exception 'Read at: an imported knowledge base names the commit it was read at.' using errcode = '22023', hint = 'read_at';
  end if;
  if p_knowledge <> 'imported' and v_read is not null then
    raise exception 'Read at: only an imported knowledge base is read at a commit.' using errcode = '22023', hint = 'read_at';
  end if;
  if v_read is not null and v_read !~ '^[0-9a-f]{40}$' then
    raise exception 'Read at: % is not a 40-hex commit.', p_read_at using errcode = '22023', hint = 'read_at';
  end if;
  select coalesce(array_agg(distinct u order by u), '{}') into v_uses
    from (select lower(btrim(c)) u from unnest(coalesce(p_consumes, '{}')) c where nullif(btrim(c), '') is not null) x;
  if repo = any (v_uses) then
    raise exception 'Consumes: % cannot consume itself.', repo using errcode = '22023', hint = 'consumes';
  end if;

  insert into public.product_repositories (product_id, workspace_id, repository, role, knowledge, read_at, read_only, consumes, added_by)
  values (owned.id, owned.workspace_id, repo, v_role, p_knowledge, v_read, coalesce(p_read_only, false), v_uses, 'person')
  on conflict (product_id, repository) do update
    set role = excluded.role, knowledge = excluded.knowledge, read_at = excluded.read_at,
        read_only = excluded.read_only, consumes = excluded.consumes
  returning * into made;
  return made;
end;
$$;

-- Takes a repository out of the product. True when it was in it. 22023 while another link of the
-- product consumes it, naming that link; 42501 not an owner, P0002 no such product.
create function public.product_repository_unlink(p_product uuid, p_repository text) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned public.products;
  repo  text := lower(btrim(coalesce(p_repository, '')));
  user_of text;
begin
  owned := public.product_repository_owned(p_product);
  select l.repository into user_of from public.product_repositories l
   where l.product_id = owned.id and repo = any (l.consumes) order by l.repository limit 1;
  if user_of is not null then
    raise exception 'Consumes: % consumes %; take it out of its consumes first.', user_of, repo using errcode = '22023', hint = 'consumes';
  end if;
  delete from public.product_repositories l where l.product_id = owned.id and l.repository = repo;
  return found;
end;
$$;

-- ── The one product of before, copied ────────────────────────────────────────────

insert into public.product_repositories (product_id, workspace_id, repository, added_by)
select r.product_id, r.workspace_id, r.full_name, 'person'
  from public.repositories r
  join public.products p on p.id = r.product_id and p.workspace_id = r.workspace_id;

drop trigger repositories_default_product on public.repositories;
drop function public.repositories_default_product();

-- Until landing 3 drops repositories.product_id: a write of it moves the repository's link. The link to
-- the product it left goes (and leaves every consumes of that product), the link to the new one is added
-- by a person, and a link that was already there keeps its fields. Its other links stay.
create function public.repositories_product_link() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and old.product_id is not null and old.product_id is distinct from new.product_id then
    delete from public.product_repositories l where l.product_id = old.product_id and l.repository = old.full_name;
    update public.product_repositories l set consumes = array_remove(l.consumes, old.full_name)
     where l.product_id = old.product_id and old.full_name = any (l.consumes);
  end if;
  if new.product_id is not null then
    insert into public.product_repositories (product_id, workspace_id, repository, added_by)
    select p.id, p.workspace_id, new.full_name, 'person'
      from public.products p where p.id = new.product_id and p.workspace_id = new.workspace_id
    on conflict (product_id, repository) do nothing;
  end if;
  return null;
end;
$$;

create trigger repositories_product_link after insert or update of product_id on public.repositories
  for each row execute function public.repositories_product_link();

revoke execute on function public.product_repositories_consumes_linked() from public, anon, authenticated;
revoke execute on function public.repositories_product_link() from public, anon, authenticated;
revoke execute on function public.product_repository_owned(uuid) from public, anon, authenticated;
revoke execute on function public.product_repository_link(uuid, text, text, text, text, boolean, text[]) from public, anon;
revoke execute on function public.product_repository_unlink(uuid, text) from public, anon;
grant execute on function public.product_repository_link(uuid, text, text, text, text, boolean, text[]) to authenticated;
grant execute on function public.product_repository_unlink(uuid, text) to authenticated;
