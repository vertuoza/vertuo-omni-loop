-- A bug record born on the server, in its product, with its Fixes rows (PRD 2011 s5, docs:
-- .omni-loop/delivery/inbox/2011-product-records/spec.md, "2. A bug record has Fixes rows").
--
-- - A product bug is a dossier of kind `bug` keyed by its product and a number from the product's own
--   counter, products.bug_seq: `mobile-B74` (bug_id_of()). It is born on the server, with no repository
--   and no issue. A product's PRDs, roadmaps and bugs count apart (dossiers_product_seq_key is per
--   product, kind and number), so mobile-3, mobile-R3 and mobile-B3 coexist. A bug of a repository is
--   keyed by its issue's number, as before.
-- - fix_rows: one row per fix of a bug record, in its order: the repository (one of the product's, at
--   the push), the pull request (null until it is opened), what changes, the reproduction and the guard,
--   and when its pull request merged or closed unmerged. `state` reads `open`, `merged` or `closed` (closed,
--   not merged) from those two. A merged row keeps its repository, pull request and merge for good.
-- - fix_unmatched_merges: a merge whose pull request names a record (`Fixes mobile-B74`) but matches none
--   of its rows, kept on that record once, so its page can list it.
-- - fix_bug_push(): the only writer of a product bug and its rows. With no number it creates the
--   product's next bug; with one it pushes to it. Any member of the product's workspace pushes. Each push
--   names every row: the rows take their order, repository, pull request and words from it, a row whose
--   repository or pull request changed starts open again, and a merged row is never moved, changed in
--   its repository or pull request, or dropped. A row naming a repository outside the product is refused
--   by name before anything is written. The record's bug.md, when the push carries it, is a `bug-record`
--   version, added only when it changed.
-- - fix_row_stamp(): the only writer of a row's merge, for the App's merge webhook (the service role):
--   a pull request of a repository merged, closed unmerged or reopened stamps every row of that
--   repository and number. A merge matching no row, whose pull request names a record of a product
--   holding the repository, is kept as an unmatched merge of that record. The last merge of a record's
--   rows ships it. It never merges anything.
-- - fix_facts reads its summary from the rows: every write of a fix's facts, and every change of its rows
--   or unmatched merges, sets its `rows` part ({rows, open, merged, closed, shipped, shippedAt,
--   unmatched}), and a product bug's `pull` part is read from the rows too (its last merged pull request
--   once every row merged, else the first row still open with a pull request, else none). A bug with no
--   rows keeps the facts its sync writes, as before.
-- - A member of the record's workspace reads its rows and unmatched merges; nobody signed in writes them
--   but through fix_bug_push(); the service role reads them and stamps through fix_row_stamp().
--
-- Every change adds or widens: no column, row or function is dropped, and the constraints replaced
-- accept every row they accepted before. A bug born in git stores, reads and pushes as before.
--
-- Proven by supabase/checks/fix_rows.sql (the product bug, its counter under two creates at once, its
-- rows, the stamps, who may do what), supabase/checks/fix_facts.sql (the summary read from the rows)
-- and supabase/checks/dossiers.sql (the dossier keys).
--
-- Rollback (the down script): a follow-up migration that first refuses while any dossier of kind `bug`
-- has a product_seq, then drops fix_row_stamp(), fix_bug_push(), the triggers on fix_rows,
-- fix_unmatched_merges and fix_facts and their functions, fix_rows_summary(), fix_rows_pull(),
-- bug_id_of(), the two tables and products.bug_seq, and restores dossiers_product_prd and
-- dossiers_fix_numbered as 20261210090000_product_roadmaps.sql made them. After a product bug exists,
-- keep it.

-- ── The product bug ──────────────────────────────────────────────────────────────

comment on column public.dossiers.kind is
  'prd, visual (a visual fix), bug (a bug fix), concept (PRD 1272) or roadmap (PRD 2011: a roadmap born on the server, keyed by its product and product_seq). For a fix or a concept, prd holds its issue''s number; a bug born on the server (PRD 2011) has none and is keyed by its product and product_seq instead.';

-- A product's bugs count apart from its PRDs and roadmaps: mobile-3, mobile-R3 and mobile-B3 are three
-- dossiers. A product bug, like a product PRD or roadmap, has no issue number: its product's counter
-- numbers it. A bug of a repository still has its issue's number.
alter table public.dossiers
  drop constraint dossiers_product_prd,
  add constraint dossiers_product_prd check (product_seq is null or (kind in ('prd', 'roadmap', 'bug') and prd is null)),
  drop constraint dossiers_fix_numbered,
  add constraint dossiers_fix_numbered check (kind in ('prd', 'roadmap') or prd is not null or (kind = 'bug' and product_seq is not null));

comment on column public.dossiers.product_seq is
  'PRD 1548: a product PRD''s number on its product (12 in mobile-12); PRD 2011: a product roadmap''s (3 in mobile-R3) or a product bug''s (74 in mobile-B74). Null for a dossier of a repository. Set at its birth, never changed.';

-- ── A product's bug counter ──────────────────────────────────────────────────────

alter table public.products
  add column bug_seq integer not null default 0 constraint products_bug_seq_check check (bug_seq >= 0);

comment on column public.products.bug_seq is
  'PRD 2011: the product''s last bug number (0 before its first). fix_bug_push() takes the next one under the row''s lock, so numbers have no gap.';

-- A product bug's id, `<key>-B<n>`; null for a product with no key.
create function public.bug_id_of(p_product uuid, p_seq integer) returns text
language sql stable
security definer
set search_path = ''
as $$
  select p.key || '-B' || p_seq from public.products p where p.id = p_product and p_seq is not null
$$;

-- ── The rows ─────────────────────────────────────────────────────────────────────

create table public.fix_rows (
  id           uuid primary key default gen_random_uuid(),
  dossier_id   uuid not null references public.dossiers on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  position     integer not null check (position between 1 and 50),
  repository   text not null
    check (repository = lower(repository) and repository ~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' and char_length(repository) <= 200),
  pull         integer check (pull > 0),
  changes      text not null check (char_length(btrim(changes)) between 1 and 2000),
  reproduction text check (char_length(btrim(reproduction)) between 1 and 2000),
  guard        text check (char_length(btrim(guard)) between 1 and 2000),
  merged_at    timestamptz,
  closed_at    timestamptz,
  state        text not null generated always as (
                 case when merged_at is not null then 'merged' when closed_at is not null then 'closed' else 'open' end
               ) stored,
  updated_at   timestamptz not null default clock_timestamp(),
  constraint fix_rows_order_key unique (dossier_id, position),
  constraint fix_rows_pull_key unique (dossier_id, repository, pull) deferrable initially deferred,
  constraint fix_rows_merged_with_pull check (merged_at is null or pull is not null),
  constraint fix_rows_closed_unmerged check (closed_at is null or (merged_at is null and pull is not null))
);

create index fix_rows_pull_idx on public.fix_rows (repository, pull) where pull is not null;
create index fix_rows_workspace_idx on public.fix_rows (workspace_id);

comment on table public.fix_rows is
  'PRD 2011: the Fixes rows of a bug record born on the server, one per fix, in order. Written only by fix_bug_push() and, for a merge, fix_row_stamp(); read by the members of the record''s workspace.';
comment on column public.fix_rows.position is 'The row''s place in the record''s Fixes table, from 1: the order its fixes merge in.';
comment on column public.fix_rows.repository is 'owner/name in lower case: the repository the fix lands in, one of the product''s when it was pushed.';
comment on column public.fix_rows.pull is 'The fix''s pull request number in that repository; null until it is opened.';
comment on column public.fix_rows.changes is 'What the fix changes, in one line.';
comment on column public.fix_rows.reproduction is 'The reproduction that went red before the fix; null until it is written.';
comment on column public.fix_rows.guard is 'The guard that would have caught the bug; null until it is written.';
comment on column public.fix_rows.merged_at is 'When its pull request merged, as the merge webhook saw it; set once, never changed.';
comment on column public.fix_rows.closed_at is 'When its pull request closed unmerged; null once it is reopened or merged.';
comment on column public.fix_rows.state is 'open, merged, or closed (closed, not merged): read from merged_at and closed_at.';

create table public.fix_unmatched_merges (
  dossier_id   uuid not null references public.dossiers on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  repository   text not null
    check (repository = lower(repository) and repository ~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' and char_length(repository) <= 200),
  pull         integer not null check (pull > 0),
  merged_at    timestamptz not null,
  seen_at      timestamptz not null default clock_timestamp(),
  primary key (dossier_id, repository, pull)
);

create index fix_unmatched_merges_workspace_idx on public.fix_unmatched_merges (workspace_id);

comment on table public.fix_unmatched_merges is
  'PRD 2011: a merged pull request naming a bug record born on the server that matches none of its rows (unmatched merge <repo>#<n>), kept once. Written only by fix_row_stamp(); read by the members of the record''s workspace.';

-- A merged row keeps its repository, its pull request and its merge for good.
create function public.fix_rows_merged_fixed() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.merged_at is not null
     and (new.repository is distinct from old.repository or new.pull is distinct from old.pull
          or new.merged_at is distinct from old.merged_at or new.dossier_id is distinct from old.dossier_id) then
    raise exception 'Row % of this bug merged: its repository, pull request and merge stay.', old.position
      using errcode = '22023', hint = 'rows';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;

create trigger fix_rows_merged_fixed
  before update on public.fix_rows
  for each row execute function public.fix_rows_merged_fixed();

-- ── The summary the facts read from the rows ─────────────────────────────────────

-- A record's rows in one object; null when it has none.
create function public.fix_rows_summary(p_dossier uuid) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select case when count(r.id) = 0 then null else jsonb_build_object(
           'rows', count(r.id),
           'open', count(r.id) filter (where r.state = 'open'),
           'merged', count(r.id) filter (where r.state = 'merged'),
           'closed', count(r.id) filter (where r.state = 'closed'),
           'shipped', bool_and(r.state = 'merged'),
           'shippedAt', case when bool_and(r.state = 'merged') then max(r.merged_at) end,
           'unmatched', (select count(*) from public.fix_unmatched_merges u where u.dossier_id = p_dossier)
         ) end
    from public.fix_rows r
   where r.dossier_id = p_dossier
$$;

-- A product bug's pull request, as a fix's facts show one: once every row merged, the last merged; else
-- the first row still open with a pull request, open; else none.
create function public.fix_rows_pull(p_dossier uuid) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('number', r.pull, 'url', 'https://github.com/' || r.repository || '/pull/' || r.pull,
                               'state', 'merged', 'mergedAt', r.merged_at, 'mergedBy', null)
       from public.fix_rows r
      where r.dossier_id = p_dossier
        and not exists (select 1 from public.fix_rows o where o.dossier_id = p_dossier and o.state <> 'merged')
      order by r.merged_at desc, r.position desc
      limit 1),
    (select jsonb_build_object('number', r.pull, 'url', 'https://github.com/' || r.repository || '/pull/' || r.pull,
                               'state', 'open', 'mergedAt', null, 'mergedBy', null)
       from public.fix_rows r
      where r.dossier_id = p_dossier and r.state = 'open' and r.pull is not null
      order by r.position
      limit 1),
    'null'::jsonb)
$$;

-- Every write of a fix's facts carries its rows' summary, whoever writes: a bug with rows has its `rows`
-- part set from them, and a product bug its `pull` part too.
create function public.fix_facts_from_rows() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  summary jsonb := public.fix_rows_summary(new.dossier_id);
begin
  if summary is null then
    new.facts := new.facts - 'rows';
    return new;
  end if;
  new.facts := new.facts || jsonb_build_object('rows', summary);
  if exists (select 1 from public.dossiers d where d.id = new.dossier_id and d.product_seq is not null) then
    new.facts := new.facts || jsonb_build_object('pull', public.fix_rows_pull(new.dossier_id));
  end if;
  return new;
end;
$$;

create trigger fix_facts_from_rows
  before insert or update on public.fix_facts
  for each row execute function public.fix_facts_from_rows();

-- A change of a record's rows, or a new unmatched merge, writes its facts again (a record with none yet
-- gets them, with no issue, pull request, approval or release of its own).
create function public.fix_rows_touch_facts() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dossier uuid := case when tg_op = 'DELETE' then old.dossier_id else new.dossier_id end;
begin
  insert into public.fix_facts (dossier_id, workspace_id, facts)
  select d.id, d.workspace_id, '{"issue": null, "pull": null, "approvals": [], "release": null}'::jsonb
    from public.dossiers d
   where d.id = v_dossier
  on conflict (dossier_id) do update set facts = public.fix_facts.facts;
  return null;
end;
$$;

create trigger fix_rows_touch_facts
  after insert or update or delete on public.fix_rows
  for each row execute function public.fix_rows_touch_facts();

create trigger fix_unmatched_merges_touch_facts
  after insert on public.fix_unmatched_merges
  for each row execute function public.fix_rows_touch_facts();

-- ── The only writer of a product bug and its rows ────────────────────────────────

-- One push of the kit's `omni bug push --product <key>`. p_key is the product's key; p_bug null creates
-- the product's next bug, a number pushes to `<key>-B<n>`; p_repo only says which workspace when two of
-- the caller's hold the key. `p_body`:
--   {title, record? (bug.md),
--    rows: [{repo (owner/name, one of the product's), pull?, changes, reproduction?, guard?}] (1 to 50)}
-- Answers {dossierId, bug, created, product: {id, name}, rows: [{position, repository, pull,
-- state}], added: [{kind, version}], unchanged: [kind]}: `bug` the id `<key>-B<n>`. Refused: 42501
-- signed out; P0002 no product of that key in the caller's workspaces, or no such bug on it; 22023 a
-- malformed argument, a repository outside the product (named), or a merged row moved, changed or
-- dropped.
create function public.fix_bug_push(p_key text, p_bug integer, p_body jsonb, p_repo text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller    uuid := (select auth.uid());
  body      jsonb := coalesce(p_body, '{}'::jsonb);
  v_key     text := btrim(coalesce(p_key, ''));
  v_repo    text := lower(btrim(coalesce(p_repo, '')));
  v_title   text := btrim(coalesce(p_body ->> 'title', ''));
  v_outside text;
  v_seq     integer;
  v_version integer;
  v_created boolean;
  keyed     public.products%rowtype;
  target    public.dossiers%rowtype;
  kept      public.fix_rows%rowtype;
  item      record;
  added     jsonb := '[]'::jsonb;
  unchanged jsonb := '[]'::jsonb;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if jsonb_typeof(body) <> 'object' then
    raise exception 'A push carries its fields as an object.' using errcode = '22023';
  end if;
  if v_key !~ '^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$' or char_length(v_key) > 40 then
    raise exception 'A product key is lowercase kebab-case, as mobile.' using errcode = '22023';
  end if;
  if v_repo <> '' and (v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' or char_length(v_repo) > 200) then
    raise exception 'A push names its repository as owner/name.' using errcode = '22023';
  end if;
  if p_bug is not null and p_bug <= 0 then
    raise exception 'A bug number is a positive whole number.' using errcode = '22023';
  end if;
  if char_length(v_title) not between 1 and 200 then
    raise exception 'A bug carries its title, of 200 characters at most.' using errcode = '22023';
  end if;
  if jsonb_typeof(body -> 'record') not in ('string', 'null') then
    raise exception 'A bug carries its record as text.' using errcode = '22023';
  end if;
  if jsonb_typeof(body -> 'rows') is distinct from 'array' or jsonb_array_length(body -> 'rows') not between 1 and 50 then
    raise exception 'A bug carries its Fixes rows: 1 to 50.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(body -> 'rows') as e (value)
              where jsonb_typeof(e.value) <> 'object'
                 or jsonb_typeof(e.value -> 'repo') is distinct from 'string'
                 or jsonb_typeof(e.value -> 'changes') is distinct from 'string'
                 or jsonb_typeof(e.value -> 'pull') not in ('number', 'null')
                 or jsonb_typeof(e.value -> 'reproduction') not in ('string', 'null')
                 or jsonb_typeof(e.value -> 'guard') not in ('string', 'null')) then
    raise exception 'A Fixes row carries its repo and changes as text, its pull request as a number.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(body -> 'rows') as e (value)
              where jsonb_typeof(e.value -> 'pull') = 'number'
              group by lower(btrim(e.value ->> 'repo')), e.value ->> 'pull'
             having count(*) > 1) then
    raise exception 'A pull request is on one row of a bug at most.' using errcode = '22023';
  end if;

  keyed := public.product_of_key(v_key, v_repo);
  if keyed.id is null then
    raise exception 'No product keyed % in your workspaces.', v_key using errcode = 'P0002';
  end if;

  -- Every row's repository is one of the product's, checked before anything is written.
  select string_agg(distinct lower(btrim(e.value ->> 'repo')), ', ' order by lower(btrim(e.value ->> 'repo'))) into v_outside
    from jsonb_array_elements(body -> 'rows') as e (value)
   where not exists (select 1 from public.product_repositories l
                      where l.product_id = keyed.id and l.repository = lower(btrim(e.value ->> 'repo')));
  if v_outside is not null then
    raise exception 'Not a repository of %: %.', keyed.name, v_outside using errcode = '22023', hint = 'repo';
  end if;

  if p_bug is null then
    -- The product's row is locked until this push commits: the next create waits, then takes the next
    -- number. A push rolled back takes its number back with it.
    update public.products p set bug_seq = p.bug_seq + 1 where p.id = keyed.id returning p.bug_seq into v_seq;
    insert into public.dossiers (workspace_id, home_repo, kind, product_id, product_seq, title, opened_by, numbered_at, birthplace)
    values (keyed.workspace_id, null, 'bug', keyed.id, v_seq, v_title, caller, now(), 'server')
    returning * into target;
    v_created := true;
  else
    select d.* into target from public.dossiers d
     where d.product_id = keyed.id and d.kind = 'bug' and d.product_seq = p_bug
       for update;
    if not found then
      raise exception 'No bug %-B% on %.', v_key, p_bug, keyed.name using errcode = 'P0002';
    end if;
    update public.dossiers d set title = v_title where d.id = target.id and d.title is distinct from v_title;
    v_created := false;
  end if;

  -- A merged row stays where it is, as it is, and is never dropped.
  for kept in
    select r.* from public.fix_rows r where r.dossier_id = target.id and r.state = 'merged' order by r.position
  loop
    if not exists (select 1 from jsonb_array_elements(body -> 'rows') with ordinality as e (value, ordinality)
                    where e.ordinality = kept.position
                      and lower(btrim(e.value ->> 'repo')) = kept.repository
                      and (e.value ->> 'pull')::integer is not distinct from kept.pull) then
      raise exception 'Row % of %-B% merged (%#%): it stays where it is, as it is.', kept.position, v_key, target.product_seq, kept.repository, kept.pull
        using errcode = '22023', hint = 'rows';
    end if;
  end loop;

  delete from public.fix_rows r where r.dossier_id = target.id and r.position > jsonb_array_length(body -> 'rows');

  for item in
    select e.ordinality::integer as position, lower(btrim(e.value ->> 'repo')) as repository,
           (e.value ->> 'pull')::integer as pull, btrim(e.value ->> 'changes') as changes,
           nullif(btrim(e.value ->> 'reproduction'), '') as reproduction, nullif(btrim(e.value ->> 'guard'), '') as guard
      from jsonb_array_elements(body -> 'rows') with ordinality as e (value, ordinality)
  loop
    update public.fix_rows r
       set repository = item.repository, pull = item.pull, changes = item.changes,
           reproduction = item.reproduction, guard = item.guard,
           closed_at = case when r.repository = item.repository and r.pull is not distinct from item.pull then r.closed_at end
     where r.dossier_id = target.id and r.position = item.position
       and (r.repository, r.pull, r.changes, r.reproduction, r.guard)
           is distinct from (item.repository, item.pull, item.changes, item.reproduction, item.guard);
    if not found and not exists (select 1 from public.fix_rows r where r.dossier_id = target.id and r.position = item.position) then
      insert into public.fix_rows (dossier_id, workspace_id, position, repository, pull, changes, reproduction, guard)
      values (target.id, target.workspace_id, item.position, item.repository, item.pull, item.changes, item.reproduction, item.guard);
    end if;
  end loop;

  if jsonb_typeof(body -> 'record') = 'string' then
    v_version := public.dossier_add_version(target.id, 'bug-record', body ->> 'record', 'kit', caller);
    if v_version is null then
      unchanged := unchanged || to_jsonb('bug-record'::text);
    else
      added := added || jsonb_build_object('kind', 'bug-record', 'version', v_version);
    end if;
  end if;

  return jsonb_build_object(
    'dossierId', target.id,
    'bug', public.bug_id_of(keyed.id, target.product_seq),
    'created', v_created,
    'product', jsonb_build_object('id', keyed.id, 'name', keyed.name),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object('position', r.position, 'repository', r.repository, 'pull', r.pull, 'state', r.state)
                                       order by r.position), '[]'::jsonb)
               from public.fix_rows r where r.dossier_id = target.id),
    'added', added,
    'unchanged', unchanged
  );
exception
  when invalid_text_representation or numeric_value_out_of_range or not_null_violation or check_violation
    or unique_violation or foreign_key_violation then
    raise exception 'A bug''s fields are malformed: %', sqlerrm using errcode = '22023';
end;
$$;

-- ── The only writer of a row's merge ─────────────────────────────────────────────

-- The App's merge webhook, as the service role: pull request p_pull of p_repo `merged`, `closed` (unmerged)
-- or `reopened` at p_at. Every row of that repository and number takes it: a merge stamps merged_at
-- once (a replay keeps the first) and clears a close; a close marks a row not merged yet; a reopen clears
-- the close. A merge matching no row, when p_bug names a record (`mobile-B74`, as its body's `Fixes`
-- line does) of a product holding p_repo, is kept once as that record's unmatched merge. Answers
-- {rows: [{bug, dossierId, position, state}], shipped: [bug], unmatched: bug or null}: `shipped` the
-- records this stamp shipped (the last of their rows merged). 22023 a malformed argument.
create function public.fix_row_stamp(p_repo text, p_pull integer, p_event text, p_at timestamptz, p_bug text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_repo    text := lower(btrim(coalesce(p_repo, '')));
  v_bug     text := btrim(coalesce(p_bug, ''));
  v_match   text[];
  stamped   jsonb := '[]'::jsonb;
  shipped   jsonb := '[]'::jsonb;
  unmatched text;
  named     public.dossiers%rowtype;
  newly     uuid[] := '{}';
begin
  if v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' or char_length(v_repo) > 200 then
    raise exception 'A stamp names its repository as owner/name.' using errcode = '22023';
  end if;
  if p_pull is null or p_pull <= 0 then
    raise exception 'A stamp names its pull request by number.' using errcode = '22023';
  end if;
  if p_event is null or p_event not in ('merged', 'closed', 'reopened') then
    raise exception 'A stamp is merged, closed or reopened.' using errcode = '22023';
  end if;
  if p_at is null then
    raise exception 'A stamp says when.' using errcode = '22023';
  end if;
  if v_bug <> '' then
    v_match := regexp_match(v_bug, '^([a-z][a-z0-9]*(?:-[a-z][a-z0-9]*)*)-B([1-9][0-9]{0,8})$');
    if v_match is null then
      raise exception 'A record is named as <key>-B<n>, as mobile-B74.' using errcode = '22023';
    end if;
  end if;

  -- The rows this merge merges now: a replay finds none, so it ships nothing twice.
  if p_event = 'merged' then
    select coalesce(array_agg(r.id), '{}') into newly
      from public.fix_rows r
     where r.repository = v_repo and r.pull = p_pull and r.merged_at is null;
  end if;

  with hit as (
    update public.fix_rows r
       set merged_at = case when p_event = 'merged' then coalesce(r.merged_at, p_at) end,
           closed_at = case when p_event = 'closed' then p_at end
     where r.repository = v_repo and r.pull = p_pull
       and (p_event = 'merged' or r.merged_at is null)
    returning r.dossier_id, r.position, r.merged_at, r.closed_at
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'bug', public.bug_id_of(d.product_id, d.product_seq), 'dossierId', h.dossier_id, 'position', h.position,
           'state', case when h.merged_at is not null then 'merged' when h.closed_at is not null then 'closed' else 'open' end)
           order by d.product_id, d.product_seq, h.position), '[]'::jsonb)
    into stamped
    from hit h join public.dossiers d on d.id = h.dossier_id;

  -- Each record this merge completed: one of its rows merged now, and every one of them merged.
  select coalesce(jsonb_agg(distinct public.bug_id_of(d.product_id, d.product_seq)), '[]'::jsonb) into shipped
    from public.dossiers d
   where d.id in (select r.dossier_id from public.fix_rows r where r.id = any (newly))
     and not exists (select 1 from public.fix_rows o where o.dossier_id = d.id and o.state <> 'merged');

  if p_event = 'merged' and jsonb_array_length(stamped) = 0 and v_match is not null then
    select d.* into named
      from public.products p
      join public.dossiers d on d.product_id = p.id and d.kind = 'bug' and d.product_seq = v_match[2]::integer
     where p.key = v_match[1]
       and exists (select 1 from public.product_repositories l where l.product_id = p.id and l.repository = v_repo)
     order by d.created_at, d.id
     limit 1;
    if found then
      insert into public.fix_unmatched_merges (dossier_id, workspace_id, repository, pull, merged_at)
      values (named.id, named.workspace_id, v_repo, p_pull, p_at)
      on conflict (dossier_id, repository, pull) do nothing;
      unmatched := public.bug_id_of(named.product_id, named.product_seq);
    end if;
  end if;

  return jsonb_build_object('rows', stamped, 'shipped', shipped, 'unmatched', unmatched);
end;
$$;

-- ── Who may do what ──────────────────────────────────────────────────────────────

alter table public.fix_rows enable row level security;
alter table public.fix_unmatched_merges enable row level security;

create policy "a member reads their workspace's fix rows" on public.fix_rows
  for select to authenticated
  using (workspace_id in (select public.my_workspaces()));
create policy "a member reads their workspace's unmatched merges" on public.fix_unmatched_merges
  for select to authenticated
  using (workspace_id in (select public.my_workspaces()));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false): read, and write only
-- through the two functions.
revoke all on public.fix_rows from public, anon, authenticated, service_role;
revoke all on public.fix_unmatched_merges from public, anon, authenticated, service_role;
grant select on public.fix_rows to authenticated, service_role;
grant select on public.fix_unmatched_merges to authenticated, service_role;

revoke execute on function public.bug_id_of(uuid, integer) from public, anon, authenticated;
revoke execute on function public.fix_rows_merged_fixed() from public, anon, authenticated;
revoke execute on function public.fix_rows_summary(uuid) from public, anon, authenticated;
revoke execute on function public.fix_rows_pull(uuid) from public, anon, authenticated;
revoke execute on function public.fix_facts_from_rows() from public, anon, authenticated;
revoke execute on function public.fix_rows_touch_facts() from public, anon, authenticated;
revoke execute on function public.fix_bug_push(text, integer, jsonb, text) from public, anon;
grant execute on function public.fix_bug_push(text, integer, jsonb, text) to authenticated;
revoke execute on function public.fix_row_stamp(text, integer, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.fix_row_stamp(text, integer, text, timestamptz, text) to service_role;
