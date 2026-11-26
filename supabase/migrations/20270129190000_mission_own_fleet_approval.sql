-- A mission's PM and Architect approving the latest plan give that mission its own product approval, even when another mission's
-- approval of the same plan is in force (bug #3336). It runs after 20270129180000_supervisor.sql and replaces mission_decide_plan()
-- of 20270129140000_mission_plan_tech.sql.
--
-- A fleet's approval is an approval row naming the fleet and the mission, and the mission counts it for itself only
-- (BR-PRODUCT-144): the App reads another mission's approval as none. mission_decide_plan() skipped the product approval once any
-- product approval in force pinned the latest plan, whoever gave it, so a mission that took over a PRD another mission had
-- approved (mission #3319 on omni-loop-31, after the stopped #3270) recorded both decisions and was left waiting for a person.
--
-- - mission_decide_plan(): as 20270129140000_mission_plan_tech.sql, save that the product approval in force skips the pair only
--   when it is this mission's or a person's (no mission), the two the mission reads as its own. Nothing else changes.
-- - Once: each mission at `alone`, not stopped or delivered, whose plan and tech decisions both approved its product PRD's latest
--   plan, whose Tech Approval in force pins that plan, while the product approval in force is another mission's, gets the product
--   approval the pair would have given it then, in the fleet's name, pinning the latest versions as mission_decide_plan() does.
--   Its decisions stay as recorded (append only, BR-PRODUCT-12): the approval is read from the approvals, not from them.
--
-- Laws kept: a fleet's approval names the fleet and the mission (BR-PRODUCT-144); a decision stays as recorded (BR-PRODUCT-12);
-- nobody signed in writes one (BR-PRODUCT-94); the approvals are the fleet's agents', never a person's (L-AIACT-1); the build still
-- lands through pull requests a person merges (N-PRODUCT-15). No column, table, grant or other row changes.
--
-- Every statement can run twice: the second run gives nothing, the approval it gave being the one in force.
-- Proven by supabase/checks/mission_product_prd.sql, its second part.
-- Rollback: run mission_decide_plan() of 20270129140000_mission_plan_tech.sql again. The approvals given stay, as a person's do;
-- a push of a file they pin voids them (BL-APPROVALS-1).

-- ── Recording a plan or tech decision ──────────────────────────────────────────

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
                          -- another mission's counts for that mission alone (BR-PRODUCT-144, bug #3336)
                          and (a.mission_id is null or a.mission_id = m.id)
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

-- ── Once: the missions the old function left without their approval ────────────

insert into public.approvals (dossier_id, approved_by, approver_login, files, approval_kind, fleet, mission_id)
select t.dossier_id, t.mission_id, left('fleet ' || t.fleet, 200), t.pinned, 'product', t.fleet, t.mission_id
  from (
    select distinct on (m.id, d.id) m.id as mission_id, m.fleet, d.id as dossier_id,
           (select jsonb_agg(jsonb_build_object(
                     'kind', l.kind,
                     'path', case l.kind when 'spec' then 'spec.md' when 'plan' then 'plan.md'
                                         when 'before-after' then 'before-after.html' when 'voice' then 'voice.json' end,
                     'sha256', l.sha256,
                     'version_id', l.id) order by l.o)
              from (select distinct on (v.kind) v.kind, v.sha256, v.id, k.o
                      from public.dossier_versions v
                      join unnest(array['spec', 'plan', 'before-after', 'voice']) with ordinality as k (kind, o) on k.kind = v.kind
                     where v.dossier_id = d.id
                     order by v.kind, v.created_at desc, v.id desc) l) as pinned
      from public.missions m
      join public.mission_decisions pd on pd.mission_id = m.id and pd.kind = 'plan' and pd.outcome = 'approved'
      join public.mission_decisions td on td.mission_id = m.id and td.kind = 'tech' and td.outcome = 'approved'
                                      and td.product_prd = pd.product_prd and td.plan = pd.plan
      join public.products p on p.workspace_id = m.workspace_id and p.key = (regexp_match(pd.product_prd, '^(.*)-([1-9][0-9]*)$'))[1]
      join public.dossiers d on d.product_id = p.id and d.kind = 'prd' and d.birthplace = 'server'
                            and d.product_seq = (regexp_match(pd.product_prd, '^(.*)-([1-9][0-9]*)$'))[2]::integer
      cross join lateral (select (public.approval_in_force(d.id, 'tech')).* ) tech
      cross join lateral (select (public.approval_in_force(d.id, 'product')).* ) product
     where coalesce(m.mandate ->> 'level', 'with-you') = 'alone'
       and m.status in ('draft', 'running', 'waiting', 'paused')
       and pd.plan = (select v.sha256 from public.dossier_versions v
                       where v.dossier_id = d.id and v.kind = 'plan' order by v.created_at desc, v.id desc limit 1)
       and tech.mission_id = m.id
       and exists (select 1 from jsonb_array_elements(tech.files) f where f.value ->> 'kind' = 'plan' and f.value ->> 'sha256' = pd.plan)
       and product.mission_id is not null and product.mission_id <> m.id
       and exists (select 1 from jsonb_array_elements(product.files) f where f.value ->> 'kind' = 'plan' and f.value ->> 'sha256' = pd.plan)
  ) t;
