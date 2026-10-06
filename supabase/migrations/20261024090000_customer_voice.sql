-- The customer voice (PRD 822, docs: .omni-loop/delivery/inbox/0822-customer-voice/spec.md). The only
-- migration of the PRD: the kit's write of an answered claim, and the dossier's `voice` artifact.
--
--   claim_answer(repo, kind, value, state, ref)   a claim a person gave as an answer in a skill run, for the
--                                                 business agents in `repo` read: source `answer`, the receipt
--                                                 `ref` (`<skill> · <run>`), `proposed` (an overrule, for a
--                                                 member to confirm on Settings › Business) or `confirmed`
--                                                 (the gap question's answer)
--   dossier_versions.kind gains `voice`           a PRD's voice.json, one version per change; only a `prd`
--                                                 dossier takes it (dossier_takes(), the pairing trigger)
--   dossier_push()                                as 20261011090000_fix_dossiers.sql, taking `voice` too
--
-- claim_answer() is built like 20261019090000_business_store.sql's functions: security definer, run as the
-- signed-in person, refusing with 42501 (not a member of the workspace that owns `repo`) or 22023 (invalid,
-- the field in `hint`). The workspace's business is opened when nobody opened it yet, as its page would,
-- so an answer is never lost. A region belongs to the business; every other kind to the repository's
-- product (its first product when the repository points at none). A value the business already holds,
-- in any state, is not stored twice: a `confirmed` answer confirms it, as a person's pick does, and a
-- `proposed` one leaves it as it is (a rejected value is never proposed again). Answers
-- `{id, state, added}`.
--
-- Proven by supabase/checks/business.sql.
-- Rollback: delete every `voice` version, then a follow-up migration restores the version check,
-- dossier_takes() and dossier_push() from 20261011090000_fix_dossiers.sql and drops claim_answer().
-- Claims stored with source `answer` stay, as ordinary claims.

-- ── An answered claim ────────────────────────────────────────────────────────────

create function public.claim_answer(p_repo text, p_kind text, p_value text, p_state text, p_ref text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid := public.business_workspace(p_repo);
  biz public.businesses;
  v text;
  v_ref text := btrim(coalesce(p_ref, ''));
  product uuid;
  there public.claims;
  seq_next integer;
  made public.claims;
begin
  perform public.business_member_only(ws);
  if p_kind is null or p_kind not in ('region', 'offering', 'size', 'trade', 'rival') then
    raise exception 'Kind: region, offering, size, trade or rival.' using errcode = '22023', hint = 'kind';
  end if;
  if p_state is null or p_state not in ('proposed', 'confirmed') then
    raise exception 'State: proposed or confirmed.' using errcode = '22023', hint = 'state';
  end if;
  v := public.business_text(p_value, 'value', 'Value');
  if p_kind = 'size' then
    perform public.business_size_check(v);
  end if;
  if char_length(v_ref) not between 1 and 200 or v_ref ~ '[\r\n]' then
    raise exception 'Ref: the skill and the run, 1 to 200 characters on one line.' using errcode = '22023', hint = 'ref';
  end if;

  perform public.business_open(ws);
  -- The business's row is locked, so two answers never take one number.
  select * into biz from public.businesses b where b.workspace_id = ws for update;
  if p_kind <> 'region' then
    select coalesce(
             (select r.product_id from public.repositories r
               where r.workspace_id = ws and r.full_name = lower(btrim(p_repo)) and r.product_id is not null),
             public.business_first_product(ws))
      into product;
  end if;

  select * into there from public.claims c
   where c.business_id = biz.id and c.product_id is not distinct from product and c.kind = p_kind and lower(c.value) = lower(v);
  if found then
    if p_state = 'confirmed' and there.state <> 'confirmed' then
      update public.claims c set state = 'confirmed', updated_at = now() where c.id = there.id returning * into there;
    end if;
    return jsonb_build_object('id', there.kind || '#' || there.seq, 'state', there.state, 'added', false);
  end if;

  select coalesce(max(c.seq), 0) + 1 into seq_next from public.claims c where c.business_id = biz.id;
  insert into public.claims (workspace_id, business_id, product_id, seq, kind, value, source, state, receipt, created_by)
  values (ws, biz.id, product, seq_next, p_kind, v, 'answer', p_state, v_ref, auth.uid())
  returning * into made;
  return jsonb_build_object('id', made.kind || '#' || made.seq, 'state', made.state, 'added', true);
end;
$$;

revoke execute on function public.claim_answer(text, text, text, text, text) from public, anon;
grant execute on function public.claim_answer(text, text, text, text, text) to authenticated;

-- ── The voice artifact, on a PRD's dossier only ─────────────────────────────────

alter table public.dossier_versions drop constraint dossier_versions_kind_check;
alter table public.dossier_versions add constraint dossier_versions_kind_check
  check (kind in ('spec', 'plan', 'before-after', 'variations', 'bug-record', 'voice'));

create or replace function public.dossier_takes(p_dossier_kind text, p_version_kind text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_dossier_kind
           when 'prd' then p_version_kind in ('spec', 'plan', 'before-after', 'voice')
           when 'visual' then p_version_kind in ('before-after', 'variations')
           when 'bug' then p_version_kind = 'bug-record'
           else false
         end
$$;

-- As 20261011090000_fix_dossiers.sql, with `voice` among the artifact kinds.
create or replace function public.dossier_push(p_repo text, p_prd integer, p_title text, p_draft uuid, p_artifacts jsonb, p_kind text default 'prd')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller    uuid := (select auth.uid());
  v_repo    text := lower(btrim(coalesce(p_repo, '')));
  v_title   text := btrim(coalesce(p_title, ''));
  v_kind    text := coalesce(p_kind, 'prd');
  pick      record;
  draft     public.dossiers%rowtype;
  target    public.dossiers%rowtype;
  item      jsonb;
  kinds     text[] := '{}';
  v_version integer;
  added     jsonb := '[]'::jsonb;
  unchanged jsonb := '[]'::jsonb;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if v_kind not in ('prd', 'visual', 'bug') then
    raise exception 'A dossier''s kind is prd, visual or bug.' using errcode = '22023';
  end if;
  if v_repo !~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$' or char_length(v_repo) > 200 then
    raise exception 'A push names its repository as owner/name.' using errcode = '22023';
  end if;
  if p_prd is null or p_prd <= 0 then
    raise exception 'A PRD number is a positive whole number.' using errcode = '22023';
  end if;
  if char_length(v_title) not between 1 and 200 then
    raise exception 'A push carries a title of 1 to 200 characters.' using errcode = '22023';
  end if;
  if p_artifacts is null or jsonb_typeof(p_artifacts) <> 'array' then
    raise exception 'The artifacts are a list of {kind, content}.' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(p_artifacts) loop
    if jsonb_typeof(item) <> 'object'
       or coalesce(item ->> 'kind', '') not in ('spec', 'plan', 'before-after', 'variations', 'bug-record', 'voice')
       or jsonb_typeof(item -> 'content') is distinct from 'string' then
      raise exception 'Each artifact is {kind, content}, its kind one of spec, plan, before-after, variations, bug-record, voice.' using errcode = '22023';
    end if;
    if (item ->> 'kind') <> 'variations' and (item ->> 'kind') = any (kinds) then
      raise exception 'Each kind is sent once: % came twice.', item ->> 'kind' using errcode = '22023';
    end if;
    if not public.dossier_takes(v_kind, item ->> 'kind') then
      raise exception 'A % dossier takes no % version.', v_kind, item ->> 'kind' using errcode = '22023';
    end if;
    kinds := kinds || (item ->> 'kind');
  end loop;

  if p_draft is not null then
    if v_kind <> 'prd' then
      raise exception 'A fix has no draft: push it by its number alone.' using errcode = '22023';
    end if;
    select d.* into draft from public.dossiers d
     where d.id = p_draft and public.is_member(d.workspace_id)
       for update;
    if not found then
      raise exception 'No such draft dossier.' using errcode = 'P0002';
    end if;
    if draft.home_repo <> v_repo then
      raise exception 'This draft belongs to %.', draft.home_repo using errcode = '22023';
    end if;
    if draft.prd is not null and draft.prd <> p_prd then
      raise exception 'This dossier is already PRD #%.', draft.prd using errcode = '22023';
    end if;
    if draft.prd is not null then
      target := draft;
    else
      select d.* into target from public.dossiers d
       where d.workspace_id = draft.workspace_id and d.home_repo = v_repo and d.kind = 'prd' and d.prd = p_prd
         for update;
      if found then
        -- Numbered to a key already taken: the draft merges into that dossier, and goes.
        update public.dossier_versions v set dossier_id = target.id where v.dossier_id = draft.id;
        update public.dossiers d
           set claude_session_id = coalesce(draft.claude_session_id, d.claude_session_id),
               opened_by = coalesce(draft.opened_by, d.opened_by),
               created_at = least(d.created_at, draft.created_at)
         where d.id = target.id;
        delete from public.dossiers d where d.id = draft.id;
      else
        update public.dossiers d set prd = p_prd, numbered_at = now() where d.id = draft.id;
        target := draft;
      end if;
    end if;
  else
    select * into pick from public.repo_workspace(caller, v_repo);
    if pick.workspace_id is null then
      raise exception '%', pick.refusal using errcode = '42501';
    end if;
    insert into public.dossiers (workspace_id, home_repo, kind, prd, title, opened_by, numbered_at)
    values (pick.workspace_id, v_repo, v_kind, p_prd, v_title, caller, now())
    on conflict (workspace_id, home_repo, kind, prd) do nothing;
    select d.* into target from public.dossiers d
     where d.workspace_id = pick.workspace_id and d.home_repo = v_repo and d.kind = v_kind and d.prd = p_prd
       for update;
  end if;

  update public.dossiers d set title = v_title where d.id = target.id;

  for item in select value from jsonb_array_elements(p_artifacts) loop
    v_version := public.dossier_add_version(target.id, item ->> 'kind', item ->> 'content', 'kit', caller);
    if v_version is null then
      unchanged := unchanged || to_jsonb(item ->> 'kind');
    else
      added := added || jsonb_build_object('kind', item ->> 'kind', 'version', v_version);
    end if;
  end loop;

  return jsonb_build_object('id', target.id, 'added', added, 'unchanged', unchanged);
end;
$$;
