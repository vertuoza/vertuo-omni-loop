-- A product PRD's outbox on the server (PRD 1548 s5, docs: .omni-loop/delivery/inbox/1548-product-gate/spec.md,
-- "The outbox follows the birthplace" and "One parser").
--
-- - outbox_items: one row per outbox item of a product PRD (a dossier keyed by its product, `mobile-12`).
--   The typed columns are the item's front matter as the kit's one item parser read it (its id, slice,
--   rank, bears-on, raised date and wave), plus the target repository the item was raised in; `body` is
--   the item's markdown as written, front matter included. An item is open until it has a settlement.
--   An open item may be put again, which rewrites its columns and body; a settled one never changes.
--   Nobody deletes an item but the cascade of its dossier's deletion.
-- - outbox_settlements: append-only, one row per settlement of an item: its verdict (`agreed` or
--   `drifted`, from a person's answer; `adopted`, a medium item adopted the moment it was raised), the
--   basis of that verdict, the answer as it was given and where (Mobile › Questions or the terminal; none
--   for an adoption), and who settled it and when. Nobody updates a row; nobody deletes one but a
--   cascade. An item takes one settlement: a second is refused.
-- - outbox_item_put(product, prd, item, …): a member of the PRD's workspace raises the item, or rewrites
--   it while it is open. outbox_item_adopt(…): puts a medium item and settles it `adopted`, at once.
--   outbox_settle(product, prd, item, verdict, basis, answer, channel): a member settles an open item.
--   Each finds the PRD by its product key and number among the caller's workspaces (prd_dossier(), the
--   one listing the repository first when two hold the key): a PRD of another workspace is no PRD.
-- - A member of the PRD's workspace reads both tables; nobody signed in writes them but through these
--   three RPCs. The service role reads them, for the outbox check.
--
-- Proven by supabase/checks/outbox_items.sql.
--
-- Rollback (the down script): a follow-up migration that first runs
-- `select public.product_prd_ids_rollback_guard();`, which refuses (55000) while any product PRD exists,
-- then drops outbox_settle(), outbox_item_adopt(), outbox_item_put(), outbox_item_of(), outbox_prd_of(),
-- the two tables and outbox_items_kept(). After a product PRD exists, keep them.

-- ── The items ────────────────────────────────────────────────────────────────────

create table public.outbox_items (
  id         uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers on delete cascade,
  item       text not null
    check (item ~ '^(?:[a-z0-9]+(?:-[a-z0-9]+)*-)?s[0-9]+-[0-9]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(item) <= 200),
  slice      text not null check (slice ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slice) <= 200),
  rank       text not null check (rank in ('medium', 'high', 'human-action')),
  bears_on   text not null check (char_length(bears_on) between 1 and 200),
  raised     date not null,
  wave       integer not null check (wave > 0),
  repository text check (repository = lower(repository) and repository ~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' and char_length(repository) <= 200),
  body       text not null check (char_length(body) between 1 and 100000),
  raised_by  uuid not null,
  raised_at  timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint outbox_items_dossier_item_key unique (dossier_id, item)
);

comment on table public.outbox_items is
  'PRD 1548: the outbox items of a product PRD. Written only by outbox_item_put() and outbox_item_adopt(); open until a settlement follows; read by the members of the PRD''s workspace.';
comment on column public.outbox_items.item is 'The item''s id, as its front matter says: s1-01-untracked-files-not-linted.';
comment on column public.outbox_items.slice is 'The slice it was raised on (s1, or a rework''s name).';
comment on column public.outbox_items.rank is 'medium, high or human-action, as the kit ranked it.';
comment on column public.outbox_items.bears_on is 'A law, a proposed entry, an ADR, or none.';
comment on column public.outbox_items.repository is 'owner/name in lower case: the target repository the item was raised in; null when none was named.';
comment on column public.outbox_items.body is 'The item''s markdown, front matter included, as written: the kit''s one item parser reads it.';
comment on column public.outbox_items.raised_by is
  'Who raised it: their account. Not a foreign key, so an item outlives its author''s account.';

-- A settled item never changes, and an item keeps its PRD and its id; nobody deletes one but its
-- dossier's deletion (a referential action runs inside a trigger, a direct delete does not).
create function public.outbox_items_kept() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() = 1 then
      raise exception 'An outbox item is never deleted: settle it instead.' using errcode = '42501';
    end if;
    return old;
  end if;
  if new.dossier_id is distinct from old.dossier_id or new.item is distinct from old.item then
    raise exception 'An outbox item keeps its PRD and its id.' using errcode = '22023';
  end if;
  if exists (select 1 from public.outbox_settlements s where s.item_id = old.id) then
    raise exception 'Item % is settled: it never changes.', old.item using errcode = '22023', hint = 'settled';
  end if;
  return new;
end;
$$;

-- ── The settlements ──────────────────────────────────────────────────────────────

create table public.outbox_settlements (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references public.outbox_items on delete cascade,
  verdict       text not null check (verdict in ('agreed', 'drifted', 'adopted')),
  basis         text not null check (char_length(basis) between 1 and 500),
  answer        text check (char_length(answer) between 1 and 20000),
  channel       text check (channel in ('questions', 'terminal')),
  settled_by    uuid not null,
  settler_login text not null check (char_length(settler_login) between 1 and 200),
  settled_at    timestamptz not null default clock_timestamp(),
  constraint outbox_settlements_answered check ((verdict = 'adopted') = (answer is null and channel is null))
);

comment on table public.outbox_settlements is
  'PRD 1548: one row per settlement of a product PRD''s outbox item, append-only. Written only by outbox_settle() and outbox_item_adopt(); never updated; deleted only with its item''s dossier.';
comment on column public.outbox_settlements.verdict is
  'agreed or drifted, from a person''s answer; adopted, a medium item adopted the moment it was raised.';
comment on column public.outbox_settlements.basis is 'Why the verdict: the kit''s basis (stated, restates-the-choice, adopted-when-raised, …).';
comment on column public.outbox_settlements.answer is 'The answer as it was given; null for an adoption, which nobody answered.';
comment on column public.outbox_settlements.channel is 'Where it was answered: questions (the product''s Questions tab) or terminal; null for an adoption.';
comment on column public.outbox_settlements.settled_by is
  'Who settled it (for an adoption, who raised it): their account. Not a foreign key, so a settlement outlives the account.';
comment on column public.outbox_settlements.settler_login is 'Their GitHub login when they settled it, in lower case.';

create index outbox_settlements_item_idx on public.outbox_settlements (item_id, settled_at desc, id desc);

create trigger outbox_items_kept
  before update or delete on public.outbox_items
  for each row execute function public.outbox_items_kept();
create trigger outbox_settlements_append_only
  before update or delete on public.outbox_settlements
  for each row execute function public.approval_rows_append_only();

-- ── Who reads ────────────────────────────────────────────────────────────────────

alter table public.outbox_items enable row level security;
alter table public.outbox_settlements enable row level security;

create policy "a member reads the outbox items of their workspace's PRDs" on public.outbox_items
  for select to authenticated
  using (exists (select 1 from public.dossiers d where d.id = dossier_id and public.is_member(d.workspace_id)));
create policy "a member reads the settlements of their workspace's PRDs" on public.outbox_settlements
  for select to authenticated
  using (exists (select 1 from public.outbox_items i join public.dossiers d on d.id = i.dossier_id
                  where i.id = item_id and public.is_member(d.workspace_id)));

revoke all on public.outbox_items from anon, authenticated, service_role;
revoke all on public.outbox_settlements from anon, authenticated, service_role;
grant select on public.outbox_items to authenticated, service_role;
grant select on public.outbox_settlements to authenticated, service_role;

-- ── Writing, through three RPCs ──────────────────────────────────────────────────

-- The product PRD `<p_product>-<p_prd>` the caller reads, or a refusal: 42501 signed out, 22023 a key or
-- a number out of shape, P0002 no such PRD in the caller's workspaces.
create function public.outbox_prd_of(p_product text, p_prd integer, p_repo text) returns public.dossiers
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  v_key  text := btrim(coalesce(p_product, ''));
  target public.dossiers%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if v_key !~ '^[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$' or char_length(v_key) > 40 then
    raise exception 'A product key is lowercase kebab-case, as mobile.' using errcode = '22023';
  end if;
  if p_prd is null or p_prd <= 0 then
    raise exception 'A PRD number is a positive whole number.' using errcode = '22023';
  end if;
  target := public.prd_dossier(p_repo, p_prd, v_key);
  if target.id is null then
    raise exception 'No PRD %-% in your workspaces.', v_key, p_prd using errcode = 'P0002';
  end if;
  return target;
end;
$$;

-- Puts the item on the PRD, raising it or rewriting it while it is open, and returns its row, locked.
-- 22023 a column out of shape, or the item already settled.
create function public.outbox_item_of(p_dossier uuid, p_item text, p_slice text, p_rank text, p_bears_on text,
  p_wave integer, p_raised date, p_body text, p_repository text) returns public.outbox_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item text := btrim(coalesce(p_item, ''));
  v_repo text := nullif(lower(btrim(coalesce(p_repository, ''))), '');
  kept   public.outbox_items%rowtype;
begin
  if v_item !~ '^(?:[a-z0-9]+(?:-[a-z0-9]+)*-)?s[0-9]+-[0-9]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(v_item) > 200 then
    raise exception 'An item''s id is its slice, a two-digit count and a slug, as s1-01-untracked-files.' using errcode = '22023', hint = 'item';
  end if;
  if coalesce(p_slice, '') !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(p_slice) > 200 then
    raise exception 'An item''s slice is lower-case words joined by hyphens, as s1.' using errcode = '22023', hint = 'slice';
  end if;
  if p_rank is null or p_rank not in ('medium', 'high', 'human-action') then
    raise exception 'An item''s rank is medium, high or human-action.' using errcode = '22023', hint = 'rank';
  end if;
  if char_length(btrim(coalesce(p_bears_on, ''))) not between 1 and 200 then
    raise exception 'An item bears on a law, an entry, an ADR, or none.' using errcode = '22023', hint = 'bears-on';
  end if;
  if p_raised is null then
    raise exception 'An item carries the date it was raised.' using errcode = '22023', hint = 'raised';
  end if;
  if p_wave is null or p_wave <= 0 then
    raise exception 'An item''s wave is a positive whole number.' using errcode = '22023', hint = 'wave';
  end if;
  if v_repo is not null and (v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' or char_length(v_repo) > 200) then
    raise exception 'An item names its repository as owner/name.' using errcode = '22023', hint = 'repository';
  end if;
  if char_length(coalesce(p_body, '')) not between 1 and 100000 then
    raise exception 'An item carries its markdown, of 1 to 100000 characters.' using errcode = '22023', hint = 'body';
  end if;

  insert into public.outbox_items (dossier_id, item, slice, rank, bears_on, raised, wave, repository, body, raised_by)
  values (p_dossier, v_item, p_slice, p_rank, btrim(p_bears_on), p_raised, p_wave, v_repo, p_body, (select auth.uid()))
  on conflict (dossier_id, item) do nothing;
  select i.* into kept from public.outbox_items i where i.dossier_id = p_dossier and i.item = v_item for update;
  if exists (select 1 from public.outbox_settlements s where s.item_id = kept.id) then
    raise exception 'Item % is already settled: it never changes.', v_item using errcode = '22023', hint = 'settled';
  end if;
  update public.outbox_items i
     set slice = p_slice, rank = p_rank, bears_on = btrim(p_bears_on), raised = p_raised, wave = p_wave,
         repository = v_repo, body = p_body, updated_at = clock_timestamp()
   where i.id = kept.id
     and (i.slice, i.rank, i.bears_on, i.raised, i.wave, i.repository, i.body)
         is distinct from (p_slice, p_rank, btrim(p_bears_on), p_raised, p_wave, v_repo, p_body)
  returning * into kept;
  if not found then
    select i.* into kept from public.outbox_items i where i.dossier_id = p_dossier and i.item = v_item;
  end if;
  return kept;
end;
$$;

-- A member of the PRD's workspace raises an item on product PRD `<p_product>-<p_prd>`, or rewrites it
-- while it is open. Answers {id, item, prdId, open}. 42501 signed out, P0002 no such PRD, 22023 a column
-- out of shape or the item already settled.
create function public.outbox_item_put(p_product text, p_prd integer, p_item text, p_slice text, p_rank text,
  p_bears_on text, p_wave integer, p_raised date, p_body text, p_repository text default null) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target public.dossiers%rowtype;
  kept   public.outbox_items%rowtype;
begin
  target := public.outbox_prd_of(p_product, p_prd, p_repository);
  kept := public.outbox_item_of(target.id, p_item, p_slice, p_rank, p_bears_on, p_wave, p_raised, p_body, p_repository);
  return jsonb_build_object('id', kept.id, 'item', kept.item, 'prdId', public.prd_id_of(target.product_id, target.product_seq), 'open', true);
end;
$$;

-- A member of the PRD's workspace raises a medium item and adopts it at once: the item, then its
-- `adopted` settlement, which nobody answered. Answers {id, item, prdId, verdict, settledAt}. 42501 signed
-- out, P0002 no such PRD, 22023 a rank other than medium, a column out of shape, or the item already
-- settled.
create function public.outbox_item_adopt(p_product text, p_prd integer, p_item text, p_slice text, p_rank text,
  p_bears_on text, p_wave integer, p_raised date, p_body text, p_repository text default null) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller  uuid := (select auth.uid());
  target  public.dossiers%rowtype;
  kept    public.outbox_items%rowtype;
  settled public.outbox_settlements%rowtype;
begin
  target := public.outbox_prd_of(p_product, p_prd, p_repository);
  if p_rank is distinct from 'medium' then
    raise exception 'Only a medium item is adopted when it is raised: % is %.', p_item, coalesce(p_rank, 'unranked')
      using errcode = '22023', hint = 'rank';
  end if;
  kept := public.outbox_item_of(target.id, p_item, p_slice, p_rank, p_bears_on, p_wave, p_raised, p_body, p_repository);
  insert into public.outbox_settlements (item_id, verdict, basis, settled_by, settler_login)
  values (kept.id, 'adopted', 'adopted-when-raised', caller, public.member_login(target.workspace_id, caller))
  returning * into settled;
  return jsonb_build_object('id', kept.id, 'item', kept.item, 'prdId', public.prd_id_of(target.product_id, target.product_seq),
    'verdict', settled.verdict, 'settledAt', settled.settled_at);
end;
$$;

-- A member of the PRD's workspace settles its open item `p_item` with a person's answer: verdict agreed
-- or drifted, its basis, the answer as given and where (questions or terminal). Answers {id, item,
-- prdId, verdict, settledAt}, id the settlement's. 42501 signed out, P0002 no such PRD or item, 22023 a
-- verdict, basis, answer or channel out of shape, or the item already settled.
create function public.outbox_settle(p_product text, p_prd integer, p_item text, p_verdict text, p_basis text,
  p_answer text, p_channel text, p_repo text default null) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller  uuid := (select auth.uid());
  target  public.dossiers%rowtype;
  kept    public.outbox_items%rowtype;
  before  public.outbox_settlements%rowtype;
  settled public.outbox_settlements%rowtype;
begin
  target := public.outbox_prd_of(p_product, p_prd, p_repo);
  if p_verdict is null or p_verdict not in ('agreed', 'drifted') then
    raise exception 'An answer''s verdict is agreed or drifted.' using errcode = '22023', hint = 'verdict';
  end if;
  if char_length(btrim(coalesce(p_basis, ''))) not between 1 and 500 then
    raise exception 'A settlement says the basis of its verdict.' using errcode = '22023', hint = 'basis';
  end if;
  if char_length(btrim(coalesce(p_answer, ''))) = 0 or char_length(p_answer) > 20000 then
    raise exception 'A settlement carries the answer as it was given, of at most 20000 characters.' using errcode = '22023', hint = 'answer';
  end if;
  if p_channel is null or p_channel not in ('questions', 'terminal') then
    raise exception 'An answer comes from questions or the terminal.' using errcode = '22023', hint = 'channel';
  end if;
  select i.* into kept from public.outbox_items i
   where i.dossier_id = target.id and i.item = btrim(coalesce(p_item, ''))
     for update;
  if not found then
    raise exception 'No item % on PRD %.', btrim(coalesce(p_item, '')), public.prd_id_of(target.product_id, target.product_seq)
      using errcode = 'P0002';
  end if;
  select s.* into before from public.outbox_settlements s where s.item_id = kept.id order by s.settled_at desc, s.id desc limit 1;
  if found then
    raise exception 'Item % is already settled (%).', kept.item, before.verdict using errcode = '22023', hint = 'settled';
  end if;
  insert into public.outbox_settlements (item_id, verdict, basis, answer, channel, settled_by, settler_login)
  values (kept.id, p_verdict, btrim(p_basis), p_answer, p_channel, caller, public.member_login(target.workspace_id, caller))
  returning * into settled;
  return jsonb_build_object('id', settled.id, 'item', kept.item, 'prdId', public.prd_id_of(target.product_id, target.product_seq),
    'verdict', settled.verdict, 'settledAt', settled.settled_at);
end;
$$;

-- ── Who runs what ────────────────────────────────────────────────────────────────

revoke execute on function public.outbox_items_kept() from public, anon, authenticated;
revoke execute on function public.outbox_prd_of(text, integer, text) from public, anon, authenticated;
revoke execute on function public.outbox_item_of(uuid, text, text, text, text, integer, date, text, text) from public, anon, authenticated;
revoke execute on function public.outbox_item_put(text, integer, text, text, text, text, integer, date, text, text) from public, anon;
revoke execute on function public.outbox_item_adopt(text, integer, text, text, text, text, integer, date, text, text) from public, anon;
revoke execute on function public.outbox_settle(text, integer, text, text, text, text, text, text) from public, anon;
grant execute on function public.outbox_item_put(text, integer, text, text, text, text, integer, date, text, text) to authenticated;
grant execute on function public.outbox_item_adopt(text, integer, text, text, text, text, integer, date, text, text) to authenticated;
grant execute on function public.outbox_settle(text, integer, text, text, text, text, text, text) to authenticated;
