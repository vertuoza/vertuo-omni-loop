-- A mission's PM approves its own product PRD's plan, and the fleet's Architect reviews it (PRD omni-loop-26 s2; docs: the PRD's
-- spec on its page, Solution 3 and 4, criteria AC-3, AC-4 and AC-6). It runs after 20270129130000_mission_requests.sql and builds
-- on 20270129100000_mission_product_prd.sql (which last set runner_jobs_mission_key_shape and mission_decisions' PRD columns),
-- 20270129090000_mission_alone_store.sql (mission_decisions' outcome checks, mission_job_role()), 20270124130000_mission_committee.sql
-- (mission_decisions, a fleet's approval) and 20270110093000_tech_approval.sql (approvals.approval_kind).
--
-- It only adds: no column, row or table is dropped, no row is rewritten, and every check it replaces takes what it took before.
--
-- - mission_decisions.kind also takes `plan` (the PM approved a plan version, from its plan job's `omni plan:` record, role `pm`)
--   and `tech` (the Architect's review of one, from its `/omni:tech-review` job's `omni tech:` record, role `architect`); role
--   takes `architect`, for a `tech` decision only. Both name a product PRD, never a number.
-- - mission_decisions.plan: the sha256 of the plan version a `plan` or a `tech` decision names, never set on another kind. Only an
--   escalated one with no readable record names none (the App read no line, BL-GATE-1).
-- - mission_decisions.outcome also takes `approved`, a `plan` or `tech` decision's alone; those two are `approved` or `escalated`.
-- - mission_decisions.settled: what the Architect settled by changing the plan, one line each, a `tech` decision's only. What it
--   left open is the decision's `why`, as for any escalated decision, so `approved` with an open point is recorded escalated.
-- - mission_decisions.tech_approval_id: the Tech Approval an approved `tech` decision gave; approval_id, the product approval in
--   the fleet's name a `plan` or `tech` decision gave once both name the latest plan version. Neither is a foreign key.
-- - runner_jobs.mission_key takes `mission:<id>:prd:<product id>:tech:<k>`, the Architect's k-th review of a product PRD, and its
--   `:resume:<k>`; mission_job_role() reads it as the Architect's.
-- - mission_decide_plan(): the only writer of both kinds, the service role's alone, through no other door (BR-PRODUCT-94). It
--   records a job's decision once (a replay answers the decision kept), and escalates what the record approved when the mission is
--   not at `alone`, the PRD was not born on the server, the plan it names is not on its page, the PRD's page lacks a spec, plan and
--   before/after, or its latest spec breaks a business law. A decision on a plan version that is no longer the latest is kept as
--   recorded and gives nothing: the supervisor asks again on the latest. An approved `tech` decision on the latest plan gives the
--   PRD's Tech Approval, signed `fleet <key> · architect`, its approver the mission (a fleet has no account), pinning the latest
--   versions as dossier_approve() does; once a `plan` and a `tech` decision both approve the latest plan, and the Tech Approval in
--   force pins it, the product approval follows in the fleet's name (`fleet <key>`), as the committee's does. A later push of a
--   pinned file voids either one, as any approval (BL-APPROVALS-1).
--
-- Laws kept: a decision stays as recorded, append only, a new plan version taking a new decision (BR-PRODUCT-12, by the trigger of
-- 20270124130000_mission_committee.sql); nobody signed in writes one (BR-PRODUCT-94); a member reads their own workspace's
-- missions only (BR-PRODUCT-63); the approvals are the fleet's agents', never a person's (L-AIACT-1); the build still lands
-- through pull requests a person merges (N-PRODUCT-15). No membership, ask session, AI key or game ledger row is touched.
--
-- Every statement can run twice. Nobody's grants change on an existing table.
-- Proven by supabase/checks/mission_product_prd.sql, its second part.
-- Rollback: once no decision is of kind `plan` or `tech` and no job key holds `:tech:`, a follow-up migration drops
-- mission_decide_plan(), the plan, settled and tech_approval_id columns with their checks, restores the kind, role, outcome and
-- approval checks of 20270124130000_mission_committee.sql and 20270129090000_mission_alone_store.sql, mission_job_role() of
-- 20270129090000_mission_alone_store.sql and runner_jobs_mission_key_shape of 20270129100000_mission_product_prd.sql. The
-- approvals the fleet gave stay, as a person's do.

-- ── Two more kinds of decision ─────────────────────────────────────────────────

alter table public.mission_decisions add column if not exists plan text;
alter table public.mission_decisions add column if not exists settled jsonb not null default '[]'::jsonb;
alter table public.mission_decisions add column if not exists tech_approval_id uuid;

alter table public.mission_decisions drop constraint if exists mission_decisions_kind_check;
alter table public.mission_decisions add constraint mission_decisions_kind_check check (kind in ('approve', 'answer', 'plan', 'tech'));

alter table public.mission_decisions drop constraint if exists mission_decisions_role_check;
alter table public.mission_decisions add constraint mission_decisions_role_check check (role in ('pm', 'architect'));
alter table public.mission_decisions drop constraint if exists mission_decisions_role_of_kind;
alter table public.mission_decisions add constraint mission_decisions_role_of_kind check ((role = 'architect') = (kind = 'tech'));

alter table public.mission_decisions drop constraint if exists mission_decisions_outcome_check;
alter table public.mission_decisions add constraint mission_decisions_outcome_check check (outcome in ('carried', 'deferred', 'escalated', 'approved'));
alter table public.mission_decisions drop constraint if exists mission_decisions_outcome_of_kind;
alter table public.mission_decisions add constraint mission_decisions_outcome_of_kind check (
  case when kind in ('plan', 'tech') then outcome in ('approved', 'escalated') else outcome <> 'approved' end);

-- A plan or tech decision names a product PRD and the plan version it read; only an escalated one with no record names none.
alter table public.mission_decisions drop constraint if exists mission_decisions_plan_shape;
alter table public.mission_decisions add constraint mission_decisions_plan_shape check (
  (plan is null or (kind in ('plan', 'tech') and plan ~ '^[0-9a-f]{64}$'))
  and (kind not in ('plan', 'tech') or ((plan is not null or outcome = 'escalated') and product_prd is not null)));

alter table public.mission_decisions drop constraint if exists mission_decisions_settled_shape;
alter table public.mission_decisions add constraint mission_decisions_settled_shape check (
  public.mission_reasons_ok(settled) and (kind = 'tech' or jsonb_array_length(settled) = 0));

alter table public.mission_decisions drop constraint if exists mission_decisions_approval_carried;
alter table public.mission_decisions add constraint mission_decisions_approval_carried check (
  approval_id is null or (kind = 'approve' and outcome = 'carried') or (kind in ('plan', 'tech') and outcome = 'approved'));
alter table public.mission_decisions drop constraint if exists mission_decisions_tech_approval;
alter table public.mission_decisions add constraint mission_decisions_tech_approval check (
  tech_approval_id is null or (kind = 'tech' and outcome = 'approved'));

comment on column public.mission_decisions.kind is
  'approve (a committee''s approval of a PRD, PRD 2896), answer (an item''s), plan (PRD omni-loop-26: the PM approved a plan version of its own product PRD, role pm) or tech (PRD omni-loop-26: the fleet''s Architect reviewed one, role architect).';
comment on column public.mission_decisions.role is 'Who decided, as an agent of the fleet: pm (the committee''s chair, or the PM on a plan) or architect (a tech review).';
comment on column public.mission_decisions.outcome is
  'carried, deferred or escalated (PRD 2896, omni-loop-21), or approved (PRD omni-loop-26: a plan or tech decision the record approved and nothing here escalated); a plan or tech decision is approved or escalated.';
comment on column public.mission_decisions.plan is
  'PRD omni-loop-26: the sha256 of the plan version a plan or tech decision names; null for any other kind, and for an escalated one whose job left no readable record.';
comment on column public.mission_decisions.settled is
  'PRD omni-loop-26: what the Architect settled by changing the plan''s coding parts, one line each; empty for any other kind. What it left open is in why.';
comment on column public.mission_decisions.tech_approval_id is
  'PRD omni-loop-26: the Tech Approval an approved tech decision on the latest plan gave (public.approvals, kind tech): not a foreign key.';
comment on column public.mission_decisions.approval_id is
  'The product approval a decision made (public.approvals): a committee''s carried approval, or the plan or tech decision that completed the pair on the latest plan (PRD omni-loop-26). Not a foreign key.';

-- ── The Architect's job ────────────────────────────────────────────────────────

-- As 20270129100000_mission_product_prd.sql, a product PRD's `tech:<k>` (and its resume) taken beside its other steps.
alter table public.runner_jobs drop constraint if exists runner_jobs_mission_key_shape;
alter table public.runner_jobs add constraint runner_jobs_mission_key_shape check (
  mission_key is null
  or mission_key ~ '^mission:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:(prd:([1-9][0-9]*|[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*-[1-9][0-9]{0,9}):(run:[1-9][0-9]*(:review:[12]|:fix:1|:qa:[12]|:qa-fix:1:[1-5])?(:resume:([1-9]|10))?|approve:[1-9][0-9]*(:resume:([1-9]|10))?|repair:[1-9][0-9]*)|prd:[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*-[1-9][0-9]{0,9}:tech:[1-9][0-9]*(:resume:([1-9]|10))?|pm:[1-9][0-9]*(:resume:([1-9]|10))?|stuck:[1-9][0-9]*|retro:([1-9][0-9]*|mission)|bug:[1-9][0-9]*:run:[1-9][0-9]*)$');

comment on column public.runner_jobs.mission_key is
  'The step of its mission a job is (PRD 2842 and on): `mission:<id>:prd:<n>:run:<k>` and its review, fix, QA and QA-fix steps, `…:approve:<k>` a committee''s, `…:repair:<k>` a repair''s, `mission:<id>:prd:<product id>:tech:<k>` the Architect''s review of a product PRD (PRD omni-loop-26), `mission:<id>:pm:<k>` the PM''s, `…:stuck:<k>` a stuck repair''s, `…:retro:<milestone>` a milestone retro''s, `…:bug:<issue>:run:<k>` a bug-fix job''s; a step''s, a committee''s, a tech review''s or a PM''s resume ends `:resume:<k>` (PRD omni-loop-21), and `<n>` is a repository PRD''s number or a product PRD''s id (`omni-loop-15`, PRD omni-loop-21 s3b). Unique: a replay sends each once.';

-- As 20270129090000_mission_alone_store.sql, a tech review (`…:tech:<k>`) read as the Architect's. Nothing else changes.
create or replace function public.mission_job_role(p_key text) returns text
language sql immutable
set search_path = ''
as $$
  select case
    when s.key ~ ':review:[12]$' then 'reviewer'
    when s.key ~ ':qa:[12]$' then 'qa'
    when s.key ~ ':approve:[0-9]+$' or s.key ~ ':tech:[0-9]+$' then 'architect'
    when s.key ~ ':pm:[0-9]+$' then 'pm'
    when s.key ~ ':run:[0-9]+$' or s.key ~ ':fix:1$' or s.key ~ ':qa-fix:1:[1-5]$' then 'engineer'
    else 'supervisor'
  end
  from (select regexp_replace(p_key, ':resume:([1-9]|10)$', '') as key) s
$$;

revoke execute on function public.mission_job_role(text) from public, anon;
grant execute on function public.mission_job_role(text) to authenticated, service_role;

-- ── Recording a plan or tech decision ──────────────────────────────────────────

-- Job p_job's decision of kind p_kind (`plan` or `tech`) on product PRD p_product_prd of mission p_mission: `p_record` the job's
-- record as the App read it (`plan`: {v, prd, plan, outcome}; `tech`: {v, prd, plan, settled, open, outcome}; null when the job
-- left none, then escalated), `p_why` the App's own reasons to escalate. A `plan` job is one of the mission's PM jobs
-- (`mission:<id>:pm:<k>`) whose line names the PRD; a `tech` job its `…:prd:<id>:tech:<k>`. Answers {decision, outcome, why,
-- plan, latest, techApproval, approval}: `latest` whether the plan it names is the PRD's latest version. 22023 a malformed value,
-- its field first in the message and in `hint`; P0002 no such mission, PRD page or job of it.
create or replace function public.mission_decide_plan(p_mission uuid, p_product_prd text, p_job uuid, p_kind text, p_record jsonb, p_why jsonb default '[]'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m        public.missions%rowtype;
  target   public.dossiers%rowtype;
  kept     public.mission_decisions%rowtype;
  parts    text[];
  why      jsonb := coalesce(p_why, '[]'::jsonb);
  settled  jsonb := '[]'::jsonb;
  open     jsonb := '[]'::jsonb;
  named    text;
  latest   text;
  outcome  text;
  home     text;
  broken   text;
  pinned   jsonb;
  tech     public.approvals%rowtype;
  tech_id  uuid;
  made     uuid;
  key_re   text;
begin
  select d.* into kept from public.mission_decisions d where d.job_id = p_job;
  if found then
    return jsonb_build_object('decision', kept.id, 'outcome', kept.outcome, 'why', kept.why, 'plan', kept.plan,
                              'latest', null, 'techApproval', kept.tech_approval_id, 'approval', kept.approval_id);
  end if;
  if p_kind is null or p_kind not in ('plan', 'tech') then
    raise exception 'Kind: plan or tech.' using errcode = '22023', hint = 'kind';
  end if;
  if not public.mission_product_id_ok(p_product_prd, 'prds') then
    raise exception 'PRD: a product PRD''s id, as omni-loop-31.' using errcode = '22023', hint = 'prd';
  end if;
  parts := regexp_match(p_product_prd, '^(.*)-([1-9][0-9]*)$');
  select x.* into m from public.missions x where x.id = p_mission for share;
  if not found then
    raise exception 'Mission: no mission %.', p_mission using errcode = 'P0002', hint = 'mission';
  end if;
  key_re := case p_kind
    when 'plan' then '^mission:' || m.id::text || ':pm:[1-9][0-9]*(:resume:([1-9]|10))?$'
    else '^mission:' || m.id::text || ':prd:' || p_product_prd || ':tech:[1-9][0-9]*(:resume:([1-9]|10))?$' end;
  if not exists (select 1 from public.runner_jobs j
                  where j.id = p_job and j.mission_id = m.id and j.mission_key ~ key_re
                    and (p_kind = 'tech' or j.line ~ ('(^| )' || p_product_prd || '( |$)'))) then
    raise exception 'Job: % is no % job of PRD % in this mission.', p_job, p_kind, p_product_prd using errcode = 'P0002', hint = 'job';
  end if;
  select d.* into target from public.dossiers d
    join public.products p on p.id = d.product_id
   where p.workspace_id = m.workspace_id and p.key = parts[1] and d.product_seq = parts[2]::integer and d.kind = 'prd'
   limit 1;
  if not found then
    raise exception 'PRD: % has no page in this workspace.', p_product_prd using errcode = 'P0002', hint = 'prd';
  end if;
  if not public.mission_reasons_ok(why) then
    raise exception 'Why: up to twelve reasons, each one line.' using errcode = '22023', hint = 'why';
  end if;

  -- The record, as the job left it. None: the job decided nothing, and a person looks (BL-GATE-1).
  if p_record is null then
    outcome := 'escalated';
    why := to_jsonb((case p_kind when 'plan' then 'no record of the plan approval' else 'no record of the tech review' end)::text) || why;
  else
    if jsonb_typeof(p_record) <> 'object' or (p_record -> 'v') is distinct from '1'::jsonb then
      raise exception 'Record: {"v":1, …}, as the job''s line wrote it.' using errcode = '22023', hint = 'record';
    end if;
    if (p_record ->> 'prd') is distinct from p_product_prd then
      raise exception 'Record: it names %, not %.', coalesce(p_record ->> 'prd', 'no PRD'), p_product_prd using errcode = '22023', hint = 'record';
    end if;
    named := p_record ->> 'plan';
    if named is null or named !~ '^[0-9a-f]{64}$' then
      raise exception 'Plan: the plan version''s sha256, 64 hexadecimal characters.' using errcode = '22023', hint = 'plan';
    end if;
    outcome := p_record ->> 'outcome';
    if outcome is null or outcome not in ('approved', 'escalated') then
      raise exception 'Outcome: approved or escalated.' using errcode = '22023', hint = 'outcome';
    end if;
    if p_kind = 'tech' then
      settled := coalesce(p_record -> 'settled', '[]'::jsonb);
      open := coalesce(p_record -> 'open', '[]'::jsonb);
      if not public.mission_reasons_ok(settled) then
        raise exception 'Settled: up to twelve lines, each what the Architect changed.' using errcode = '22023', hint = 'settled';
      end if;
      if not public.mission_reasons_ok(open) then
        raise exception 'Open: up to twelve lines, each a point left to a person.' using errcode = '22023', hint = 'open';
      end if;
      why := open || why;
    elsif p_record ? 'settled' or p_record ? 'open' then
      raise exception 'Record: a plan approval settles nothing and leaves nothing open.' using errcode = '22023', hint = 'record';
    end if;
    if outcome = 'escalated' and jsonb_array_length(why) = 0 then
      why := to_jsonb((case p_kind when 'plan' then 'the PM did not approve the plan' else 'the Architect did not approve the plan' end)::text);
    end if;
  end if;

  select v.sha256 into latest from public.dossier_versions v
   where v.dossier_id = target.id and v.kind = 'plan' order by v.created_at desc, v.id desc limit 1;

  -- What the fleet may never settle, whatever its record says.
  if outcome = 'approved' then
    if coalesce(m.mandate ->> 'level', 'with-you') <> 'alone' then
      why := why || to_jsonb('the mission is not at alone: a person approves its PRDs'::text);
    end if;
    if target.birthplace is distinct from 'server' then
      why := why || to_jsonb('it is approved by its phase-0 pull request, which only a person merges'::text);
    end if;
    if not exists (select 1 from public.dossier_versions v where v.dossier_id = target.id and v.kind = 'plan' and v.sha256 = named) then
      why := why || to_jsonb('the plan it names is not on the PRD''s page'::text);
    end if;
    if exists (select 1 from unnest(array['spec', 'plan', 'before-after']) k (kind)
                where not exists (select 1 from public.dossier_versions v where v.dossier_id = target.id and v.kind = k.kind)) then
      why := why || to_jsonb('it has no spec, plan and before/after on its page yet'::text);
    end if;
    home := public.product_law_home(target.product_id);
    if home is not null then
      select string_agg(distinct e.value ->> 'law', ', ' order by e.value ->> 'law') into broken
        from public.business_law_verdicts b
        cross join lateral jsonb_array_elements(b.findings) e
       where b.state = 'red'
         and b.pack_sha = (select p.sha from public.knowledge_packs p
                            where p.workspace_id = target.workspace_id and p.repository = home and p.newest)
         and b.dossier_version_id = (select v.id from public.dossier_versions v
                                      where v.dossier_id = target.id and v.kind = 'spec'
                                      order by v.created_at desc, v.id desc limit 1);
      if broken is not null then
        why := why || to_jsonb(format('its spec breaks the business law %s', broken));
      end if;
    end if;
    if jsonb_array_length(why) > 0 then
      outcome := 'escalated';
    end if;
  end if;

  -- Approved on the latest plan: the Architect's gives the Tech Approval; the pair, once both hold, the product approval.
  if outcome = 'approved' and named = latest then
    select jsonb_agg(jsonb_build_object(
             'kind', l.kind,
             'path', case l.kind when 'spec' then 'spec.md' when 'plan' then 'plan.md'
                                 when 'before-after' then 'before-after.html' when 'voice' then 'voice.json' end,
             'sha256', l.sha256,
             'version_id', l.id) order by l.o)
      into pinned
      from (
        select distinct on (v.kind) v.kind, v.sha256, v.id, k.o
          from public.dossier_versions v
          join unnest(array['spec', 'plan', 'before-after', 'voice']) with ordinality as k (kind, o) on k.kind = v.kind
         where v.dossier_id = target.id
         order by v.kind, v.created_at desc, v.id desc
      ) l;
    if p_kind = 'tech' then
      insert into public.approvals (dossier_id, approved_by, approver_login, files, approval_kind, fleet, mission_id)
      values (target.id, m.id, left('fleet ' || m.fleet || ' · architect', 200), pinned, 'tech', m.fleet, m.id)
      returning id into tech_id;
    end if;
    tech := public.approval_in_force(target.id, 'tech');
    if tech.id is not null and tech.mission_id = m.id
       and exists (select 1 from jsonb_array_elements(tech.files) f where f.value ->> 'kind' = 'plan' and f.value ->> 'sha256' = latest)
       and (p_kind = 'plan'
            or exists (select 1 from public.mission_decisions d
                        where d.mission_id = m.id and d.product_prd = p_product_prd and d.kind = 'plan'
                          and d.outcome = 'approved' and d.plan = latest))
       and not exists (select 1 from public.approvals a
                        where a.id = (public.approval_in_force(target.id, 'product')).id
                          and exists (select 1 from jsonb_array_elements(a.files) f where f.value ->> 'kind' = 'plan' and f.value ->> 'sha256' = latest)) then
      insert into public.approvals (dossier_id, approved_by, approver_login, files, approval_kind, fleet, mission_id)
      values (target.id, m.id, left('fleet ' || m.fleet, 200), pinned, 'product', m.fleet, m.id)
      returning id into made;
    end if;
  end if;

  -- At most twelve reasons are kept, the record's first.
  if jsonb_array_length(why) > 12 then
    why := (select jsonb_agg(w.value order by w.o) from jsonb_array_elements(why) with ordinality w (value, o) where w.o <= 12);
  end if;

  insert into public.mission_decisions (mission_id, product_prd, kind, job_id, plan, settled, verdicts, why, outcome,
                                        approval_id, tech_approval_id, role)
  values (m.id, p_product_prd, p_kind, p_job, named, settled, '[]'::jsonb, why, outcome, made, tech_id,
          case p_kind when 'tech' then 'architect' else 'pm' end)
  on conflict (job_id) do nothing
  returning * into kept;
  if kept.id is null then
    select d.* into kept from public.mission_decisions d where d.job_id = p_job;
  end if;
  return jsonb_build_object('decision', kept.id, 'outcome', kept.outcome, 'why', kept.why, 'plan', kept.plan,
                            'latest', kept.plan is not null and kept.plan = latest,
                            'techApproval', kept.tech_approval_id, 'approval', kept.approval_id);
end;
$$;

revoke execute on function public.mission_decide_plan(uuid, text, uuid, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.mission_decide_plan(uuid, text, uuid, text, jsonb, jsonb) to service_role;
