-- Personas any product can describe (PRD 2779 s1, docs: .omni-loop/delivery/inbox/2779-open-personas/spec.md).
-- Builds on 20261022090000_personas.sql:
--
--   stance                   `excited` is renamed `enthusiastic`: every stored persona moves, and the rule is
--                            `enthusiastic, neutral, skeptical`. persona_add() and persona_edit() still take
--                            `excited` from a writer that sends it (an older kit or skill) and store
--                            `enthusiastic`; any other word is refused with the list
--   trade                    lower-case words with single spaces or hyphens between them, at most 40
--                            characters (`data analyst`, `credit-risk analyst`), in the table and in
--                            persona_fields() alike. It is no longer trimmed: ` analyst` is refused
--   persona_find(workspace, product, name)   the one live persona of that name in the product, for an edit
--                            by name (`omni business persona edit`): P0002 for none, P0003 for several, both
--                            naming the persona in plain words; 42501 for a non-member
--   the history              every change to a persona is appended to product_knowledge_events
--                            (BL-PRODUCTKNOWLEDGE-2), as Legal and Glossary changes are: kind `persona`, the
--                            persona in `persona_id`, its fields {name, stance, trade, avatar, who, usage}
--                            before and after, and `changed_by` the caller, in the same transaction.
--                            persona_add() appends `added`, persona_edit() `edited` when a field changed,
--                            persona_delete() `removed` and persona_restore() (Undo) the new action
--                            `restored`. A refused change appends nothing. Members of the workspace read
--                            them, as the rest of the history (its existing policy)
--   persona_stance_rename()  moves every `excited` persona, deleted ones included, to `enthusiastic`, each
--                            with one `edited` event, `changed_by` null: the one change no person made. The
--                            migration calls it once; it stays so supabase/checks/personas.sql proves it.
--                            Nobody but the database's owner runs it
--
-- business_for_repo() and the other reads send the stored stance as it is: `GET /api/business` sends
-- `excited` back to a kit that does not ask for `stances=2` (apps/galaxy/src/business-api/api.ts).
--
-- The newest event id of a product keys the canon gate's cached verdict (ADR-0066), so a persona change now
-- re-judges, as a glossary change does.
--
-- Proven by supabase/checks/personas.sql.
-- Rollback: a follow-up migration moves `enthusiastic` back to `excited` and restores the two rules and the
-- functions of 20261022090000_personas.sql, after renaming every trade the old rule refuses; it drops
-- persona_find() and persona_stance_rename(), deletes the events of kind `persona`, then restores the
-- events' kind, action and entry checks of 20270109090000_product_domains.sql and drops `persona_id`.

-- ── The history takes personas ───────────────────────────────────────────────────

alter table public.product_knowledge_events
  add column persona_id uuid references public.personas on delete cascade,
  drop constraint product_knowledge_events_kind_check,
  add constraint product_knowledge_events_kind_check check (kind in ('legal', 'glossary', 'domains', 'persona')),
  drop constraint product_knowledge_events_action_check,
  add constraint product_knowledge_events_action_check
    check (action in ('added', 'edited', 'retired', 'removed', 'restored', 'proposed', 'approved', 'rejected', 'named')),
  drop constraint product_knowledge_events_check,
  add constraint product_knowledge_events_check check (num_nonnulls(legal_id, glossary_id, domain_id, persona_id) <= 1),
  add constraint product_knowledge_events_persona_check check ((kind = 'persona') = (persona_id is not null));

create index product_knowledge_events_persona_idx on public.product_knowledge_events (persona_id) where persona_id is not null;

comment on column public.product_knowledge_events.persona_id is
  'PRD 2779: the persona the change is to. Its before and after are {name, stance, trade, avatar, who, usage}; restored: after only.';

-- ── The stance, renamed ──────────────────────────────────────────────────────────

alter table public.personas drop constraint personas_stance_check;

-- A persona's fields as the history records them.
create function public.persona_event_fields(p public.personas) returns jsonb
language sql immutable
set search_path = ''
as $$
  select jsonb_build_object('name', p.name, 'stance', p.stance, 'trade', p.trade, 'avatar', p.avatar, 'who', p.who, 'usage', p.usage)
$$;

-- Moves every `excited` persona to `enthusiastic`, deleted ones too, and appends one `edited` event each,
-- `changed_by` null. The number moved.
create function public.persona_stance_rename() returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  was public.personas;
  now_is public.personas;
  moved integer := 0;
begin
  for was in select * from public.personas p where p.stance = 'excited' order by p.ordinal for update loop
    update public.personas p set stance = 'enthusiastic' where p.id = was.id returning * into now_is;
    insert into public.product_knowledge_events (workspace_id, product_id, kind, action, persona_id, before, after, changed_by)
    values (was.workspace_id, was.product_id, 'persona', 'edited', was.id,
            public.persona_event_fields(was), public.persona_event_fields(now_is), null);
    moved := moved + 1;
  end loop;
  return moved;
end;
$$;

select public.persona_stance_rename();

alter table public.personas
  add constraint personas_stance_check check (stance in ('enthusiastic', 'neutral', 'skeptical')),
  drop constraint personas_trade_check,
  add constraint personas_trade_check check (char_length(trade) <= 40 and trade ~ '^[a-z]+([ -][a-z]+)*$');

-- ── Who may write, recorded ──────────────────────────────────────────────────────

-- As 20261022090000_personas.sql: `excited` is taken and stored as `enthusiastic`; a trade is lower-case
-- words with single spaces or hyphens between them, at most 40 characters, untrimmed.
create or replace function public.persona_fields(p_name text, p_stance text, p_trade text, p_avatar jsonb, p_who text, p_usage text,
                                                 out name text, out stance text, out trade text, out avatar jsonb, out who text, out usage text)
language plpgsql immutable
set search_path = ''
as $$
begin
  name := btrim(coalesce(p_name, ''));
  if char_length(name) not between 1 and 40 or name ~ '[\r\n\t]' then
    raise exception 'Name: 1 to 40 characters, on one line.' using errcode = '22023', hint = 'name';
  end if;
  if p_stance is null or p_stance not in ('enthusiastic', 'excited', 'neutral', 'skeptical') then
    raise exception 'Stance: enthusiastic, neutral or skeptical.' using errcode = '22023', hint = 'stance';
  end if;
  stance := case when p_stance = 'excited' then 'enthusiastic' else p_stance end;
  trade := coalesce(p_trade, '');
  if char_length(trade) > 40 or trade !~ '^[a-z]+([ -][a-z]+)*$' then
    raise exception 'Trade: lower-case words with single spaces or hyphens between them, at most 40 characters, like plumber or data analyst.'
      using errcode = '22023', hint = 'trade';
  end if;
  if not public.valid_persona_avatar(p_avatar) then
    raise exception 'Avatar: {v 1, skin 0–5, hair 0–5, hairColor 0–3, outfit 0–3, accessory 0–3}.' using errcode = '22023', hint = 'avatar';
  end if;
  avatar := p_avatar;
  who := btrim(coalesce(p_who, ''));
  if char_length(who) > 400 then
    raise exception 'Who: 400 characters at most.' using errcode = '22023', hint = 'who';
  end if;
  usage := btrim(coalesce(p_usage, ''));
  if char_length(usage) > 400 then
    raise exception 'Usage: 400 characters at most.' using errcode = '22023', hint = 'usage';
  end if;
end;
$$;

-- Appends one event of a persona, as the caller: a null before or after is stored as none.
create function public.persona_log(p_persona public.personas, p_action text, p_before jsonb, p_after jsonb) returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.product_knowledge_events (workspace_id, product_id, kind, action, persona_id, before, after, changed_by)
  values (p_persona.workspace_id, p_persona.product_id, 'persona', p_action, p_persona.id, p_before, p_after, (select auth.uid()))
$$;

-- As 20261022090000_personas.sql, appending `added`.
create or replace function public.persona_add(p_workspace uuid, p_product uuid, p_name text, p_stance text, p_trade text,
                                              p_avatar jsonb, p_who text, p_usage text)
returns public.personas
language plpgsql
security definer
set search_path = ''
as $$
declare
  f record;
  made public.personas;
begin
  perform public.business_runner_only(p_workspace);
  select * into f from public.persona_fields(p_name, p_stance, p_trade, p_avatar, p_who, p_usage);
  if p_product is null then
    raise exception 'Product: a persona belongs to a product.' using errcode = '22023', hint = 'product';
  end if;
  perform public.business_product(p_workspace, p_product);
  insert into public.personas (workspace_id, product_id, name, stance, trade, avatar, who, usage, created_by)
  values (p_workspace, p_product, f.name, f.stance, f.trade, f.avatar, f.who, f.usage, auth.uid())
  returning * into made;
  perform public.persona_log(made, 'added', null, public.persona_event_fields(made));
  return made;
end;
$$;

-- As 20261022090000_personas.sql, appending `edited` when a field changed.
create or replace function public.persona_edit(p_workspace uuid, p_persona uuid, p_name text, p_stance text, p_trade text,
                                               p_avatar jsonb, p_who text, p_usage text)
returns public.personas
language plpgsql
security definer
set search_path = ''
as $$
declare
  f record;
  was public.personas;
  changed public.personas;
begin
  perform public.business_member_only(p_workspace);
  select * into f from public.persona_fields(p_name, p_stance, p_trade, p_avatar, p_who, p_usage);
  was := public.persona_of(p_workspace, p_persona, false);
  update public.personas p
     set name = f.name, stance = f.stance, trade = f.trade, avatar = f.avatar, who = f.who, usage = f.usage, updated_at = now()
   where p.id = p_persona
  returning * into changed;
  if public.persona_event_fields(was) <> public.persona_event_fields(changed) then
    perform public.persona_log(changed, 'edited', public.persona_event_fields(was), public.persona_event_fields(changed));
  end if;
  return changed;
end;
$$;

-- As 20261022090000_personas.sql, appending `removed`.
create or replace function public.persona_delete(p_workspace uuid, p_persona uuid) returns public.personas
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed public.personas;
begin
  perform public.business_member_only(p_workspace);
  perform public.persona_of(p_workspace, p_persona, false);
  update public.personas p set deleted_at = now(), updated_at = now() where p.id = p_persona returning * into changed;
  perform public.persona_log(changed, 'removed', public.persona_event_fields(changed), null);
  return changed;
end;
$$;

-- As 20261022090000_personas.sql, appending `restored`.
create or replace function public.persona_restore(p_workspace uuid, p_persona uuid) returns public.personas
language plpgsql
security definer
set search_path = ''
as $$
declare
  changed public.personas;
begin
  perform public.business_member_only(p_workspace);
  perform public.persona_of(p_workspace, p_persona, true);
  update public.personas p set deleted_at = null, updated_at = now() where p.id = p_persona returning * into changed;
  perform public.persona_log(changed, 'restored', null, public.persona_event_fields(changed));
  return changed;
end;
$$;

-- ── Finding one by name ──────────────────────────────────────────────────────────

-- The one live persona named `p_name` (trimmed, as stored) in a live product of the workspace, for a member.
-- None: P0002 `no persona named "<name>" in <product>`. Several: P0003 `several personas are named "<name>":
-- edit it on the Knowledge tab`. Both hint `name`.
create function public.persona_find(p_workspace uuid, p_product uuid, p_name text) returns public.personas
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  product public.products;
  wanted text := btrim(coalesce(p_name, ''));
  found_one public.personas;
  how_many integer;
begin
  perform public.business_member_only(p_workspace);
  product := public.business_product(p_workspace, p_product);
  select count(*) into how_many from public.personas p
   where p.product_id = product.id and p.deleted_at is null and p.name = wanted;
  if how_many = 0 then
    raise exception 'no persona named "%" in %', wanted, product.name using errcode = 'P0002', hint = 'name';
  end if;
  if how_many > 1 then
    raise exception 'several personas are named "%": edit it on the Knowledge tab', wanted using errcode = 'P0003', hint = 'name';
  end if;
  select * into found_one from public.personas p
   where p.product_id = product.id and p.deleted_at is null and p.name = wanted;
  return found_one;
end;
$$;

-- ── Who may do what ──────────────────────────────────────────────────────────────

revoke execute on function public.persona_event_fields(public.personas) from public, anon, authenticated, service_role;
revoke execute on function public.persona_log(public.personas, text, jsonb, jsonb) from public, anon, authenticated, service_role;
revoke execute on function public.persona_stance_rename() from public, anon, authenticated, service_role;
revoke execute on function public.persona_find(uuid, uuid, text) from public, anon;
grant execute on function public.persona_find(uuid, uuid, text) to authenticated;
