-- Jev's Human work kind (PRD 1217 s3, docs: .omni-loop/delivery/inbox/1217-roadmap-human-work/spec.md).
-- A sixth Jev decision, `hitl-category`, Off by default like the others: each new piece of human work a
-- roadmap push stores (20261113090000_roadmap_human_work.sql) is offered to it once, after the push has
-- answered. On, Jev's answer among the four kinds is the entry's kind (`kind_by = 'jev'`); Shadow only
-- logs it (jev_calls) and the rule kind stays; Off, a Jev error or an answer outside the four keeps the
-- rule kind. Galaxy runs it as the service role, as every Jev decision (apps/galaxy/src/roadmap/classify-jev.ts).
--
--   jev_decision_names()                         gains `hitl-category`
--   roadmap_human_work.classified_at             when the key was offered to the classifier, or null: a key
--                                                is offered once, whatever the mode, and never again
--   roadmap_human_work_claim(roadmap, limit)     the service role only: up to `limit` open keys never
--                                                offered, marked offered now, with the roadmap's workspace
--                                                and what Jev reads of each (its PRD's title included)
--   roadmap_human_work_set_kind(roadmap, key, kind)   the service role only: Jev's counted kind on a key
--                                                offered and still of the rule's kind
--
-- The rows stored before this migration count as offered: turning the decision On never sorts them again.
-- Refusals: 22023 (a kind outside the four).
-- Proven by supabase/checks/jev.sql.
-- Rollback: a follow-up migration drops the two functions and the column, restores jev_decision_names()
-- of 20261029090000_constituents.sql and deletes the decision's jev_decisions rows; kinds Jev set stay.

create or replace function public.jev_decision_names() returns text[]
language sql immutable
set search_path = ''
as $$
  select array['question-category', 'outbox-risk', 'bug-risk', 'unknown-worth-asking', 'constituent-break', 'hitl-category']
$$;

alter table public.roadmap_human_work add column classified_at timestamptz;
update public.roadmap_human_work set classified_at = first_seen_at;

comment on column public.roadmap_human_work.classified_at is
  'When the key was offered to Jev''s hitl-category decision (whatever its mode), or null: offered once, never again.';

-- Up to p_limit open keys of the roadmap never offered, the first seen first, each marked offered now so
-- that no other push offers it again. Answers {workspace, entries: [{key, prd, prdTitle, repo, source,
-- text, act, url, ruleKind}]}; workspace null for a roadmap that does not exist.
create function public.roadmap_human_work_claim(p_roadmap uuid, p_limit integer) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workspace uuid;
  v_entries   jsonb;
begin
  select r.workspace_id into v_workspace from public.roadmaps r where r.id = p_roadmap;
  if v_workspace is null then
    return jsonb_build_object('workspace', null, 'entries', '[]'::jsonb);
  end if;
  with picked as (
    select h.key from public.roadmap_human_work h
     where h.roadmap_id = p_roadmap and h.state = 'open' and h.classified_at is null
     order by h.first_seen_at, h.key
     limit greatest(coalesce(p_limit, 0), 0)
     for update skip locked
  ), claimed as (
    update public.roadmap_human_work h set classified_at = now()
      from picked where h.roadmap_id = p_roadmap and h.key = picked.key
    returning h.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'key', c.key,
           'prd', c.prd,
           'prdTitle', (select p.title from public.roadmap_prds p where p.roadmap_id = p_roadmap and p.prd = c.prd order by p.position limit 1),
           'repo', c.repo,
           'source', c.source,
           'text', c.text,
           'act', c.act,
           'url', c.url,
           'ruleKind', c.kind) order by c.first_seen_at, c.key), '[]'::jsonb)
    into v_entries
    from claimed c;
  return jsonb_build_object('workspace', v_workspace, 'entries', v_entries);
end;
$$;

-- Jev's kind, counted: set on a key already offered whose kind is still the rule's. A key a later push
-- reclassified, or one never offered, is left as it is. Answers whether the kind was set.
create function public.roadmap_human_work_set_kind(p_roadmap uuid, p_key text, p_kind text) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_kind is null or p_kind not in ('business', 'development', 'dev-ops', 'delivery-ops') then
    raise exception 'Kind: one of business, development, dev-ops, delivery-ops.' using errcode = '22023', hint = 'kind';
  end if;
  update public.roadmap_human_work h set kind = p_kind, kind_by = 'jev'
   where h.roadmap_id = p_roadmap and h.key = p_key and h.kind_by = 'rule' and h.classified_at is not null;
  return found;
end;
$$;

revoke execute on function public.roadmap_human_work_claim(uuid, integer) from public, anon, authenticated;
grant execute on function public.roadmap_human_work_claim(uuid, integer) to service_role;
revoke execute on function public.roadmap_human_work_set_kind(uuid, text, text) from public, anon, authenticated;
grant execute on function public.roadmap_human_work_set_kind(uuid, text, text) to service_role;
