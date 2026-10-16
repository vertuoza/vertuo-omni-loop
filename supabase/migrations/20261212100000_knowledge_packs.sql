-- Knowledge served as packs, and a product's plan repository (PRD 2011 s10, docs:
-- .omni-loop/delivery/inbox/2011-product-records/spec.md, "3. Knowledge is served as packs").
--
-- - knowledge_packs: a repository's knowledge folder and flow config at one commit, kept once per workspace
--   that holds the repository in one of its products. `newest` marks, per workspace and repository, the
--   pack of the latest commit (by its date): what every product link of that repository reads. A pack is
--   never changed once kept; an older commit arriving late is kept beside the newest, not over it.
-- - knowledge_pack_files: the pack's files, each by its path in the repository, its content and the
--   sha256 of that content (lower-case hex of its UTF-8 bytes), computed here. A path never leaves the
--   pack's folder: no leading `/`, no empty, `.` or `..` segment, no backslash or control character.
-- - knowledge_pack_put(): the only writer, the service role's alone (the App's knowledge harvest, PRD 2011
--   s11). It keeps the pack in every workspace that holds the repository in a product, and none where no
--   product holds it; the same commit again changes nothing; a sender's sha256, when it gives one, must be
--   the content's. A malformed pack is refused whole, before anything is written.
-- - Who reads: a member of the pack's workspace, through row-level security (the `omni` command acts as
--   its member, signed in or through a kit token); an agent link through knowledge_pack_for_token(), which
--   reads only its own workspace's packs, of a repository its workspace lists or its GitHub organisation
--   owns, as business_for_token() does (law BR-PRODUCT-63). Nobody signed in writes the two tables.
-- - products.plan_repository: the product's plan repository (owner/name), one its workspace lists, set by
--   an owner through product_plan_repository_set(); null until then.
--
-- Every change adds: two tables, one column, three functions. Nothing existing is changed or dropped.
--
-- Proven by supabase/checks/knowledge_packs.sql (the packs, who writes and reads them, the agent link of
-- another workspace reading none) and supabase/checks/products.sql (the plan repository).
--
-- Rollback (the down script): a follow-up migration that drops
-- product_plan_repository_set() and products.plan_repository (with its constraint), knowledge_pack_for_token(), knowledge_pack_put(), knowledge_pack_files and
-- knowledge_packs. Before a pack is read by the kit (s12) nothing depends on them; after, drop the readers
-- first.

-- ── The packs ────────────────────────────────────────────────────────────────────

create table public.knowledge_packs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  repository   text not null,
  sha          text not null constraint knowledge_packs_sha_check check (sha ~ '^[0-9a-f]{40}$'),
  committed_at timestamptz not null,
  made_at      timestamptz not null default now(),
  newest       boolean not null default false,
  foreign key (workspace_id, repository) references public.repositories (workspace_id, full_name) on delete cascade,
  constraint knowledge_packs_commit_key unique (workspace_id, repository, sha),
  constraint knowledge_packs_id_workspace_key unique (id, workspace_id)
);

-- One newest pack per workspace and repository.
create unique index knowledge_packs_newest_key on public.knowledge_packs (workspace_id, repository) where newest;

comment on table public.knowledge_packs is
  'PRD 2011: a repository''s knowledge folder and flow config at one commit, kept per workspace that holds the repository in a product. Written only by knowledge_pack_put() (the service role); read by the workspace''s members, and by its agent links through knowledge_pack_for_token().';
comment on column public.knowledge_packs.repository is 'owner/name, in lower case: one of the workspace''s repositories.';
comment on column public.knowledge_packs.sha is 'The 40-hex commit the files were read at.';
comment on column public.knowledge_packs.committed_at is 'When that commit was made (merged): the newest pack is the one of the latest commit.';
comment on column public.knowledge_packs.made_at is 'When the pack was kept.';
comment on column public.knowledge_packs.newest is 'The pack every product link of this repository reads: the one of its latest commit, one per workspace and repository.';

create table public.knowledge_pack_files (
  pack_id      uuid not null,
  workspace_id uuid not null,
  path         text not null constraint knowledge_pack_files_path_check check (
                 char_length(path) between 1 and 512
                 and path !~ '^/' and path !~ '/$' and path !~ '//'
                 and path !~ '(^|/)\.\.?(/|$)' and path !~ '[[:cntrl:]\\]'),
  content      text not null constraint knowledge_pack_files_content_check check (octet_length(content) <= 1048576),
  sha256       text not null constraint knowledge_pack_files_sha256_check check (sha256 ~ '^[0-9a-f]{64}$'),
  primary key (pack_id, path),
  foreign key (pack_id, workspace_id) references public.knowledge_packs (id, workspace_id) on delete cascade
);

comment on table public.knowledge_pack_files is
  'PRD 2011: a knowledge pack''s files, each by its path in the repository, with its content and the sha256 of that content. Written with its pack, never changed.';
comment on column public.knowledge_pack_files.path is 'The file''s path in the repository (.omni-loop/knowledge/…, .omni-loop/config.yml): never absolute, never climbing out.';
comment on column public.knowledge_pack_files.sha256 is 'Lower-case hex sha256 of the content''s UTF-8 bytes, computed by knowledge_pack_put().';

-- ── The writer: the App's knowledge harvest ──────────────────────────────────────

-- Keeps the pack of p_repo at commit p_sha (made at p_committed_at) in every workspace that holds the
-- repository in a product. p_files is a list of {path, content, sha256?}. Answers {repository, sha,
-- packs: [{workspace, packId, created, newest, files}]}, packs empty when no product holds the repository.
-- 22023 a malformed value, its field first in the message and in `hint`.
create function public.knowledge_pack_put(p_repo text, p_sha text, p_committed_at timestamptz, p_files jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_repo    text := lower(btrim(coalesce(p_repo, '')));
  v_sha     text := lower(btrim(coalesce(p_sha, '')));
  files     jsonb := '[]'::jsonb;
  f         jsonb;
  v_path    text;
  v_content text;
  v_hash    text;
  twice     text;
  ws        uuid;
  pack      public.knowledge_packs;
  created   boolean;
  packs     jsonb := '[]'::jsonb;
begin
  if v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' then
    raise exception 'Repository: owner/name.' using errcode = '22023', hint = 'repo';
  end if;
  if v_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'Sha: the full 40-character commit.' using errcode = '22023', hint = 'sha';
  end if;
  if p_committed_at is null then
    raise exception 'Committed at: when the commit was made.' using errcode = '22023', hint = 'committed_at';
  end if;
  if p_files is null or jsonb_typeof(p_files) <> 'array' then
    raise exception 'Files: a list of {path, content}.' using errcode = '22023', hint = 'files';
  end if;
  if jsonb_array_length(p_files) > 2000 then
    raise exception 'Files: at most 2000 in a pack.' using errcode = '22023', hint = 'files';
  end if;

  for f in select e.value from jsonb_array_elements(p_files) e loop
    if jsonb_typeof(f) is distinct from 'object' or jsonb_typeof(f -> 'path') is distinct from 'string'
       or jsonb_typeof(f -> 'content') is distinct from 'string' then
      raise exception 'Files: each file has a path and a content, both text.' using errcode = '22023', hint = 'files';
    end if;
    v_path := f ->> 'path';
    v_content := f ->> 'content';
    if char_length(v_path) not between 1 and 512 or v_path ~ '^/' or v_path ~ '/$' or v_path ~ '//'
       or v_path ~ '(^|/)\.\.?(/|$)' or v_path ~ '[[:cntrl:]\\]' then
      raise exception 'Path: % may not leave the pack''s folder.', v_path using errcode = '22023', hint = 'path';
    end if;
    if octet_length(v_content) > 1048576 then
      raise exception 'Content: % is over 1 MiB.', v_path using errcode = '22023', hint = 'content';
    end if;
    v_hash := encode(sha256(convert_to(v_content, 'UTF8')), 'hex');
    if f ? 'sha256' and lower(f ->> 'sha256') is distinct from v_hash then
      raise exception 'Sha256: % does not hash to what was sent.', v_path using errcode = '22023', hint = 'sha256';
    end if;
    files := files || jsonb_build_array(jsonb_build_object('path', v_path, 'content', v_content, 'sha256', v_hash));
  end loop;

  select x.path into twice from jsonb_to_recordset(files) as x (path text) group by x.path having count(*) > 1 limit 1;
  if twice is not null then
    raise exception 'Path: % is in the pack twice.', twice using errcode = '22023', hint = 'path';
  end if;

  for ws in
    select distinct l.workspace_id from public.product_repositories l where l.repository = v_repo order by l.workspace_id
  loop
    -- One put at a time per workspace and repository, so the newest pack is decided once.
    perform 1 from public.repositories r where r.workspace_id = ws and r.full_name = v_repo for update;
    select * into pack from public.knowledge_packs p where p.workspace_id = ws and p.repository = v_repo and p.sha = v_sha;
    created := not found;
    if created then
      if not exists (select 1 from public.knowledge_packs p
                      where p.workspace_id = ws and p.repository = v_repo and p.committed_at > p_committed_at) then
        update public.knowledge_packs p set newest = false where p.workspace_id = ws and p.repository = v_repo and p.newest;
        insert into public.knowledge_packs (workspace_id, repository, sha, committed_at, newest)
        values (ws, v_repo, v_sha, p_committed_at, true) returning * into pack;
      else
        insert into public.knowledge_packs (workspace_id, repository, sha, committed_at, newest)
        values (ws, v_repo, v_sha, p_committed_at, false) returning * into pack;
      end if;
      insert into public.knowledge_pack_files (pack_id, workspace_id, path, content, sha256)
      select pack.id, ws, x.path, x.content, x.sha256 from jsonb_to_recordset(files) as x (path text, content text, sha256 text);
    end if;
    packs := packs || jsonb_build_array(jsonb_build_object(
      'workspace', ws, 'packId', pack.id, 'created', created, 'newest', pack.newest,
      'files', (select count(*) from public.knowledge_pack_files k where k.pack_id = pack.id)));
  end loop;

  return jsonb_build_object('repository', v_repo, 'sha', v_sha, 'packs', packs);
end;
$$;

-- ── The agent link's read (law BR-PRODUCT-63) ────────────────────────────────────

-- The newest pack of p_repo in the link's own workspace, or the pack of commit p_sha when it names one;
-- null when there is none. The repository must be one the workspace lists or its GitHub organisation
-- owns, exactly as business_for_token() lets a link read; any other is refused, named. Never reads
-- another workspace's pack. Answers {repository, sha, committedAt, madeAt, newest, files: [{path, sha256,
-- content}]}, the files in path order. 28000 the link does not work, 42501 a repository not the
-- workspace's, 22023 a malformed repository or sha.
create function public.knowledge_pack_for_token(p_hash text, p_repo text, p_sha text default null) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  t      public.agent_tokens := public.agent_token_of(p_hash);
  v_repo text := lower(btrim(coalesce(p_repo, '')));
  v_sha  text := nullif(lower(btrim(coalesce(p_sha, ''))), '');
  org    text;
  pack   public.knowledge_packs;
begin
  if t.last_used_at is null or t.last_used_at < now() - interval '1 minute' then
    update public.agent_tokens x set last_used_at = now() where x.id = t.id;
  end if;

  if v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' then
    raise exception 'Repository: owner/name.' using errcode = '22023', hint = 'repo';
  end if;
  if v_sha is not null and v_sha !~ '^[0-9a-f]{40}$' then
    raise exception 'Sha: the full 40-character commit.' using errcode = '22023', hint = 'sha';
  end if;
  select lower(w.github_org) into org from public.workspaces w where w.id = t.workspace_id;
  if not exists (select 1 from public.repositories r where r.workspace_id = t.workspace_id and r.full_name = v_repo)
     and org is distinct from split_part(v_repo, '/', 1) then
    raise exception 'Repository: % is not one of this workspace''s repositories.', v_repo using errcode = '42501', hint = 'repo';
  end if;

  select * into pack from public.knowledge_packs p
   where p.workspace_id = t.workspace_id and p.repository = v_repo
     and (case when v_sha is null then p.newest else p.sha = v_sha end);
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'repository', pack.repository, 'sha', pack.sha, 'committedAt', pack.committed_at, 'madeAt', pack.made_at,
    'newest', pack.newest,
    'files', coalesce((select jsonb_agg(jsonb_build_object('path', f.path, 'sha256', f.sha256, 'content', f.content)
                                        order by f.path collate "C")
                         from public.knowledge_pack_files f where f.pack_id = pack.id and f.workspace_id = t.workspace_id),
                      '[]'::jsonb));
end;
$$;

-- ── Who reads the packs ──────────────────────────────────────────────────────────

alter table public.knowledge_packs enable row level security;
alter table public.knowledge_pack_files enable row level security;

create policy "a member reads their workspace's knowledge packs" on public.knowledge_packs
  for select to authenticated
  using (workspace_id in (select public.my_workspaces()));
create policy "a member reads their workspace's knowledge pack files" on public.knowledge_pack_files
  for select to authenticated
  using (workspace_id in (select public.my_workspaces()));

-- ── A product's plan repository ──────────────────────────────────────────────────

alter table public.products
  add column plan_repository text,
  add constraint products_plan_repository_listed
    foreign key (workspace_id, plan_repository) references public.repositories (workspace_id, full_name);

comment on column public.products.plan_repository is
  'PRD 2011: the product''s plan repository, owner/name in lower case, one its workspace lists; null until an owner sets it with product_plan_repository_set().';

-- Sets the product's plan repository, or clears it (null or empty). Answers the product. 42501 signed out
-- or not an owner, P0002 no such product or a repository the workspace does not list.
create function public.product_plan_repository_set(p_product uuid, p_repository text) returns public.products
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned public.products;
  repo  text := nullif(lower(btrim(coalesce(p_repository, ''))), '');
  got   public.products;
begin
  owned := public.product_repository_owned(p_product);
  if repo is not null and not exists (select 1 from public.repositories r where r.workspace_id = owned.workspace_id and r.full_name = repo) then
    raise exception 'Repository: % is not one of this workspace''s repositories.', repo using errcode = 'P0002', hint = 'plan_repository';
  end if;
  update public.products p set plan_repository = repo where p.id = owned.id returning * into got;
  return got;
end;
$$;

-- ── Who may call what ────────────────────────────────────────────────────────────

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false): read, and write only
-- through the functions.
revoke all on public.knowledge_packs from public, anon, authenticated, service_role;
revoke all on public.knowledge_pack_files from public, anon, authenticated, service_role;
grant select on public.knowledge_packs to authenticated, service_role;
grant select on public.knowledge_pack_files to authenticated, service_role;

revoke execute on function public.knowledge_pack_put(text, text, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.knowledge_pack_put(text, text, timestamptz, jsonb) to service_role;
revoke execute on function public.knowledge_pack_for_token(text, text, text) from public;
grant execute on function public.knowledge_pack_for_token(text, text, text) to anon, authenticated;
revoke execute on function public.product_plan_repository_set(uuid, text) from public, anon;
grant execute on function public.product_plan_repository_set(uuid, text) to authenticated;
