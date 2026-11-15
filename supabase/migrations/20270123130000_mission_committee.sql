-- The committee approves a mission's PRD at `alone` (PRD 2896 s9, docs: .omni-loop/delivery/inbox/2896-fleet-alone/spec.md,
-- "6. The committee, at `alone`", criteria 13, 15 and 16). It runs after 20270123120000_mission_drops.sql, which last set the
-- kinds of a mission event, and 20270122122000_reviewer.sql, which last set a mission key's shape and the runners' fixed skills.
--
-- - mission_decisions: what the fleet's committee decided, append only, one row per committee job: the mission, the PRD,
--   `approve` (or `answer`, for an item, a later slice), the job, the hero that sat out, the files it read by hash, the verdicts
--   ({role, answer, sentence}: pm, architect or reviewer; yes, no, unsure, failed or timeout), why it escalated, the outcome
--   (`carried` or `escalated`) and, once carried, the approval it made. Signed by role (`pm`, the chair) and `agent`, never in a
--   person's name (L-AIACT-1). A member of the workspace reads it; nobody signed in writes it (BR-PRODUCT-94): the service role
--   does, through mission_decide_approval() alone. It has no retention period (L-GDPR-4): only its mission's deletion takes it.
-- - approvals.fleet and approvals.mission_id: a fleet's approval of a PRD (PRD 2896) is an approval like a person's, so the PRD's
--   page reads it (`fleet <key>`) and a later push of a file it pinned voids it (BL-APPROVALS-1), but it names the fleet and the
--   mission it was given in, and counts for that mission only: its `approved_by` is the mission's id, since a fleet has no account.
--   Both null for a person's. Neither is a foreign key, so an approval outlives its mission, as one outlives its approver.
-- - mission_decide_approval(): the only writer of a fleet's approval and of a decision, the service role's alone. It records the
--   committee job's decision once (a replay answers the decision already kept). It escalates whatever the App read when the
--   mission is not at `alone`, the PRD was not born on the server (its phase-0 pull request approves it, and only a person merges
--   that), a Tech Approval is asked and not in force, its latest spec breaks a business law at its law home's newest pack, or a
--   file the committee read is no longer the latest version of its kind; it carries only what the App carried, and then pins the
--   latest version of each kind, as dossier_approve() does.
-- - dossier_approval(): as 20270110093000_tech_approval.sql, and a fleet's approval reads its approver as a member while its fleet
--   is a live Virtual Fleet of the workspace, so the mission's build passes its approval gate.
-- - runner_jobs.mission_key: also takes `mission:<id>:prd:<n>:approve:<k>`, the committee's k-th job for the PRD: unique, so a
--   replay of the supervisor, or two runs at once, insert each once.
-- - mission_events.kind takes `decided` (the committee carried a decision) and `escalated` (it went to a person, why attached),
--   both role `pm` and actor `agent`.
-- - set_repository_runner_skill(): its fixed list also holds `committee`, the list of apps/galaxy/src/runners/runners.contract.ts
--   (RUNNER_SKILLS) and kit/lib/runner/line.ts (RUNNABLE_SKILLS). Nothing else in it changes.
--
-- Every statement can run twice. Nobody's grants change but mission_decisions', new: a member reads it, the service role reads
-- it and writes it only through mission_decide_approval(). Proven by supabase/checks/missions.sql.
-- Rollback: a follow-up migration, once no row holds a `decided` or `escalated` event or an `:approve:` key, restores
-- runner_jobs_mission_key_shape of 20270122122000_reviewer.sql, mission_events_kind_check of 20270123120000_mission_drops.sql,
-- set_repository_runner_skill() of 20270122122000_reviewer.sql and dossier_approval() of 20270110093000_tech_approval.sql; drops
-- mission_decide_approval() and mission_decisions. The two approvals columns stay while a fleet's approval is kept.

-- ── What the committee decided ─────────────────────────────────────────────────

create or replace function public.mission_verdicts_ok(p_verdicts jsonb) returns boolean
language sql immutable
set search_path = ''
as $$
  select p_verdicts is not null and jsonb_typeof(p_verdicts) = 'array' and jsonb_array_length(p_verdicts) <= 3
     and not exists (
       select 1 from jsonb_array_elements(p_verdicts) v
        where jsonb_typeof(v.value) <> 'object'
           or (v.value ->> 'role') is null or (v.value ->> 'role') not in ('pm', 'architect', 'reviewer')
           or (v.value ->> 'answer') is null or (v.value ->> 'answer') not in ('yes', 'no', 'unsure', 'failed', 'timeout')
           or jsonb_typeof(v.value -> 'sentence') is distinct from 'string'
           or char_length(btrim(v.value ->> 'sentence')) not between 1 and 200)
     and (select count(distinct v.value ->> 'role') from jsonb_array_elements(p_verdicts) v) = jsonb_array_length(p_verdicts)
$$;

create or replace function public.mission_reasons_ok(p_reasons jsonb) returns boolean
language sql immutable
set search_path = ''
as $$
  select p_reasons is not null and jsonb_typeof(p_reasons) = 'array' and jsonb_array_length(p_reasons) <= 12
     and not exists (select 1 from jsonb_array_elements(p_reasons) r
                      where jsonb_typeof(r.value) <> 'string' or char_length(btrim(r.value #>> '{}')) not between 1 and 300)
$$;

create table if not exists public.mission_decisions (
  id          uuid primary key default gen_random_uuid(),
  mission_id  uuid not null references public.missions (id) on delete cascade,
  prd         integer not null check (prd > 0),
  kind        text not null check (kind in ('approve', 'answer')),
  item        text check (item is null or char_length(item) between 1 and 200),
  job_id      uuid not null,
  author      text check (author is null or author in ('pm', 'architect', 'reviewer')),
  files       jsonb not null default '[]'::jsonb check (jsonb_typeof(files) = 'array'),
  verdicts    jsonb not null constraint mission_decisions_verdicts_shape check (public.mission_verdicts_ok(verdicts)),
  why         jsonb not null default '[]'::jsonb constraint mission_decisions_why_shape check (public.mission_reasons_ok(why)),
  outcome     text not null check (outcome in ('carried', 'escalated')),
  option      text check (option is null or char_length(option) between 1 and 200),
  approval_id uuid,
  role        text not null default 'pm' check (role = 'pm'),
  actor       text not null default 'agent' check (actor = 'agent'),
  decided_at  timestamptz not null default clock_timestamp(),
  constraint mission_decisions_job_key unique (job_id),
  constraint mission_decisions_carried_has_no_why check ((outcome = 'escalated') = (jsonb_array_length(why) > 0)),
  constraint mission_decisions_approval_carried check (approval_id is null or (kind = 'approve' and outcome = 'carried'))
);

create index if not exists mission_decisions_mission_idx on public.mission_decisions (mission_id, decided_at);

comment on table public.mission_decisions is
  'PRD 2896: what a mission''s fleet committee decided, one row per committee job, append only: written by mission_decide_approval() (the service role) alone, read by the workspace''s members, kept as long as its mission (L-GDPR-4).';
comment on column public.mission_decisions.author is 'The hero whose job wrote the PRD, who sat out and did not vote; null when no hero of the fleet wrote it.';
comment on column public.mission_decisions.files is 'Each file the committee read: {kind, sha256}. A carried approval covers exactly these (BL-APPROVALS-1).';
comment on column public.mission_decisions.verdicts is 'Each member''s verdict, {role, answer, sentence}: yes, no or unsure, failed or timeout (both counted unsure).';
comment on column public.mission_decisions.why is 'Why it went to a person, one line each: a line of the escalation list, or a verdict that was not yes. Empty once carried.';
comment on column public.mission_decisions.approval_id is 'The approval a carried approval made (public.approvals): not a foreign key, so the decision outlives nothing it names.';

create or replace function public.mission_decisions_append_only() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' or pg_trigger_depth() = 1 then
    raise exception 'A mission decision is never changed or deleted: a person''s overturn is recorded beside it.' using errcode = '42501';
  end if;
  return old;
end;
$$;

drop trigger if exists mission_decisions_append_only on public.mission_decisions;
create trigger mission_decisions_append_only
  before update or delete on public.mission_decisions
  for each row execute function public.mission_decisions_append_only();

alter table public.mission_decisions enable row level security;

drop policy if exists "a member reads their workspace's mission decisions" on public.mission_decisions;
create policy "a member reads their workspace's mission decisions" on public.mission_decisions
  for select to authenticated
  using (mission_id in (select m.id from public.missions m where m.workspace_id in (select public.my_workspaces())));

revoke all on public.mission_decisions from public, anon, authenticated, service_role;
grant select on public.mission_decisions to authenticated, service_role;

-- ── A fleet's approval ─────────────────────────────────────────────────────────

alter table public.approvals add column if not exists fleet text;
alter table public.approvals add column if not exists mission_id uuid;
alter table public.approvals drop constraint if exists approvals_fleet_mission;
alter table public.approvals add constraint approvals_fleet_mission check ((fleet is null) = (mission_id is null));

comment on column public.approvals.fleet is
  'PRD 2896: the Virtual Fleet whose committee approved, its key; null for a person''s approval. Its approver_login reads `fleet <key>`.';
comment on column public.approvals.mission_id is
  'PRD 2896: the mission a fleet''s approval was given in, and counts for alone (its approved_by holds the same id); null for a person''s.';

-- The committee job p_job's decision on PRD p_prd of mission p_mission, as the App read it: `p_record` the job's record
-- ({author, read: [{kind, sha256}], verdicts}), `p_outcome` the App's own decision from it and `p_why` its reasons. Records it
-- once, carried only when the App carried it and nothing here escalates it, and then approves the PRD in the fleet's name.
-- Answers {decision, outcome, why, approval}. 22023 a malformed value, its field first in the message and in `hint`; P0002 no
-- such mission, PRD page or committee job of it.
create or replace function public.mission_decide_approval(p_mission uuid, p_prd integer, p_job uuid, p_record jsonb, p_outcome text, p_why jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  m       public.missions%rowtype;
  target  public.dossiers%rowtype;
  kept    public.mission_decisions%rowtype;
  why     jsonb := coalesce(p_why, '[]'::jsonb);
  author  text := p_record ->> 'author';
  read    jsonb := coalesce(p_record -> 'read', '[]'::jsonb);
  asked   public.approval_requests%rowtype;
  home    text;
  broken  text;
  stale   text;
  pinned  jsonb;
  made    uuid;
  outcome text;
begin
  select d.* into kept from public.mission_decisions d where d.job_id = p_job;
  if found then
    return jsonb_build_object('decision', kept.id, 'outcome', kept.outcome, 'why', kept.why, 'approval', kept.approval_id);
  end if;
  select x.* into m from public.missions x where x.id = p_mission for share;
  if not found then
    raise exception 'Mission: no mission %.', p_mission using errcode = 'P0002', hint = 'mission';
  end if;
  if not exists (select 1 from public.runner_jobs j
                  where j.id = p_job and j.mission_id = m.id
                    and j.mission_key ~ ('^mission:' || m.id::text || ':prd:' || p_prd::text || ':approve:[1-9][0-9]*$')) then
    raise exception 'Job: % is no committee job of PRD % in this mission.', p_job, p_prd using errcode = 'P0002', hint = 'job';
  end if;
  select d.* into target from public.dossiers d
   where d.workspace_id = m.workspace_id and d.home_repo = m.repo and d.kind = 'prd' and d.prd = p_prd
   order by d.numbered_at desc nulls last, d.id
   limit 1;
  if not found then
    raise exception 'PRD: % has no page in this workspace.', p_prd using errcode = 'P0002', hint = 'prd';
  end if;
  if p_outcome is null or p_outcome not in ('carried', 'escalated') then
    raise exception 'Outcome: carried or escalated.' using errcode = '22023', hint = 'outcome';
  end if;
  if not public.mission_reasons_ok(why) or (p_outcome = 'escalated') <> (jsonb_array_length(why) > 0) then
    raise exception 'Why: one to twelve reasons when escalated, none when carried.' using errcode = '22023', hint = 'why';
  end if;
  if author is not null and author not in ('pm', 'architect', 'reviewer') then
    raise exception 'Author: pm, architect or reviewer, or none.' using errcode = '22023', hint = 'author';
  end if;
  if not public.mission_verdicts_ok(coalesce(p_record -> 'verdicts', 'null'::jsonb)) then
    raise exception 'Verdicts: at most three, one per member, each {role, answer, sentence}.' using errcode = '22023', hint = 'verdicts';
  end if;
  if jsonb_typeof(read) <> 'array' or exists (select 1 from jsonb_array_elements(read) f
                                                where coalesce(f.value ->> 'kind', '') !~ '^[a-z][a-z-]*$' or coalesce(f.value ->> 'sha256', '') !~ '^[0-9a-f]{64}$') then
    raise exception 'Read: each file {kind, sha256}.' using errcode = '22023', hint = 'read';
  end if;

  -- What the committee may never settle, whatever the App carried.
  if p_outcome = 'carried' then
    if coalesce(m.mandate ->> 'level', 'with-you') <> 'alone' then
      why := why || to_jsonb('the mission is not at alone: a person approves its PRDs'::text);
    end if;
    if target.birthplace is distinct from 'server' then
      why := why || to_jsonb('it is approved by its phase-0 pull request, which only a person merges'::text);
    end if;
    select r.* into asked from public.approval_requests r
     where r.dossier_id = target.id and r.approval_kind = 'tech' order by r.asked_at desc, r.id desc limit 1;
    if asked.id is not null and (public.approval_in_force(target.id, 'tech')).id is null then
      why := why || to_jsonb(format('it waits for %s''s Tech Approval first', public.member_login(target.workspace_id, asked.asked[1])));
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
    -- Each kind's latest version must be the one the committee read, and the spec, the plan and the before/after were read.
    select string_agg(l.kind, ', ' order by l.kind) into stale
      from (
        select distinct on (v.kind) v.kind, v.sha256
          from public.dossier_versions v
         where v.dossier_id = target.id and v.kind in ('spec', 'plan', 'before-after', 'voice')
         order by v.kind, v.created_at desc, v.id desc
      ) l
     where not exists (select 1 from jsonb_array_elements(read) f where f.value ->> 'kind' = l.kind and f.value ->> 'sha256' = l.sha256);
    if stale is not null then
      why := why || to_jsonb(format('the %s changed after the committee read it', stale));
    end if;
    if exists (select 1 from unnest(array['spec', 'plan', 'before-after']) k (kind)
                where not exists (select 1 from public.dossier_versions v where v.dossier_id = target.id and v.kind = k.kind)) then
      why := why || to_jsonb('it has no spec, plan and before/after on its page yet'::text);
    end if;
  end if;
  outcome := case when jsonb_array_length(why) = 0 then 'carried' else 'escalated' end;

  if outcome = 'carried' then
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
    insert into public.approvals (dossier_id, approved_by, approver_login, files, approval_kind, fleet, mission_id)
    values (target.id, m.id, left('fleet ' || m.fleet, 200), pinned, 'product', m.fleet, m.id)
    returning id into made;
  end if;

  insert into public.mission_decisions (mission_id, prd, kind, job_id, author, files, verdicts, why, outcome, approval_id)
  values (m.id, p_prd, 'approve', p_job, author, read, p_record -> 'verdicts', why, outcome, made)
  on conflict (job_id) do nothing
  returning * into kept;
  if kept.id is null then
    select d.* into kept from public.mission_decisions d where d.job_id = p_job;
  end if;
  return jsonb_build_object('decision', kept.id, 'outcome', kept.outcome, 'why', kept.why, 'approval', kept.approval_id);
end;
$$;

revoke execute on function public.mission_verdicts_ok(jsonb) from public, anon;
revoke execute on function public.mission_reasons_ok(jsonb) from public, anon;
revoke execute on function public.mission_decisions_append_only() from public, anon, authenticated;
revoke execute on function public.mission_decide_approval(uuid, integer, uuid, jsonb, text, jsonb) from public, anon, authenticated;
grant execute on function public.mission_verdicts_ok(jsonb), public.mission_reasons_ok(jsonb) to authenticated, service_role;
grant execute on function public.mission_decide_approval(uuid, integer, uuid, jsonb, text, jsonb) to service_role;

-- ── What the kit reads: a fleet's approval is a member's while its fleet lives ──

-- As 20270110093000_tech_approval.sql, the approver's `member` read for a fleet's approval as its fleet being a live Virtual
-- Fleet of the dossier's workspace. Nothing else changes.
create or replace function public.dossier_approval(p_repo text, p_prd integer, p_product text default null) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target public.dossiers%rowtype;
  latest public.approvals%rowtype;
  tech   jsonb;
begin
  if caller is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  target := public.prd_dossier(p_repo, p_prd, p_product);
  if target.id is null then
    return null;
  end if;
  tech := public.tech_approval_state(target.id);
  select a.* into latest
    from public.approvals a
   where a.dossier_id = target.id and a.approval_kind = 'product'
   order by a.approved_at desc, a.id desc
   limit 1;
  if not found then
    return jsonb_build_object('dossier', target.id, 'approval', null)
      || case when tech is not null then jsonb_build_object('tech', tech) else '{}'::jsonb end;
  end if;
  return jsonb_build_object(
    'dossier', target.id,
    'approval', jsonb_build_object(
      'approver', jsonb_build_object(
        'login', latest.approver_login,
        'member', case
          when latest.fleet is not null then exists (select 1 from public.teams t
                                                      where t.workspace_id = target.workspace_id and t.name = latest.fleet
                                                        and t.kind = 'virtual' and t.retired_at is null)
          else exists (select 1 from public.workspace_members m
                        where m.workspace_id = target.workspace_id and m.user_id = latest.approved_by) end),
      'approvedAt', latest.approved_at,
      'files', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'kind', f.value ->> 'kind',
                 'path', f.value ->> 'path',
                 'sha256', f.value ->> 'sha256',
                 'versionId', f.value ->> 'version_id',
                 'content', v.content) order by f.o), '[]'::jsonb)
          from jsonb_array_elements(latest.files) with ordinality as f (value, o)
          left join public.dossier_versions v on v.id = (f.value ->> 'version_id')::uuid),
      'voids', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'pusher', x.pusher_login,
                 'kind', x.kind,
                 'from', x.from_sha256,
                 'to', x.to_sha256,
                 'voidedAt', x.voided_at) order by x.voided_at, x.id), '[]'::jsonb)
          from public.approval_voids x
         where x.approval_id = latest.id)))
    || case when tech is not null then jsonb_build_object('tech', tech) else '{}'::jsonb end;
end;
$$;

revoke execute on function public.dossier_approval(text, integer, text) from public, anon;
grant execute on function public.dossier_approval(text, integer, text) to authenticated;

-- ── The committee's job ────────────────────────────────────────────────────────

alter table public.runner_jobs drop constraint if exists runner_jobs_mission_key_shape;
alter table public.runner_jobs add constraint runner_jobs_mission_key_shape check (
  mission_key is null
  or mission_key ~ '^mission:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:prd:[1-9][0-9]*:(run:[1-9][0-9]*(:review:[12]|:fix:1)?|approve:[1-9][0-9]*)$');

comment on column public.runner_jobs.mission_key is
  'mission:<mission id>:prd:<n>:run:<k>, then :review:<1 or 2> for the Reviewer''s job of that round or :fix:1 for the fix after round 1 (PRD 2871); or mission:<mission id>:prd:<n>:approve:<k>, the committee''s k-th job for the PRD (PRD 2896): unique, so a replay of the supervisor, or two runs at once, insert the job once.';

-- ── What a mission did: the committee's decisions ──────────────────────────────

alter table public.mission_events drop constraint if exists mission_events_kind_check;
alter table public.mission_events add constraint mission_events_kind_check check (kind in (
  'started', 'paused', 'resumed', 'dispatched', 'job-ended', 'waits', 'prd-ready',
  'prd-merged', 'held', 'stopped', 'delivered', 'reviewed', 'prd-joined',
  'drop-asked', 'drop-asked-keep', 'prd-dropped', 'decided', 'escalated'));

comment on column public.mission_events.kind is
  'What happened: started, paused, resumed, dispatched, job-ended, waits, prd-ready, prd-merged, held, stopped or delivered (PRD 2842), reviewed (PRD 2871: a verdict of the Reviewer, role reviewer, actor agent, linking its review), prd-joined (PRD 2896: the App squash-merged a PRD''s feature pull request into the mission branch, role supervisor, actor agent, linking the pull request), drop-asked or drop-asked-keep (PRD 2896: a member asked for a PRD to leave the branch, with or without the later PRDs sharing its territory, actor the member''s login), prd-dropped (PRD 2896: the App removed the PRD''s commit from the branch and reopened its feature pull request, role supervisor, actor agent, linking it), decided or escalated (PRD 2896: the fleet''s committee carried a decision, or sent it to a person, role pm, actor agent).';

-- ── `committee` is the loop's own skill ────────────────────────────────────────

-- set_repository_runner_skill() of 20270122122000_reviewer.sql, `committee` added to its fixed list.
create or replace function public.set_repository_runner_skill(p_workspace uuid, p_full_name text, p_skill text, p_allowed boolean) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  name text := lower(btrim(coalesce(p_full_name, '')));
  fixed text[] := array['yolo', 'yolo-fix', 'pr-care', 'do-work', 'wave', 'bug-fix', 'mega-bug-fix', 'visual-fix', 'plan', 'pitch', 'prove', 'retro-apply', 'rewind', 'knowledge-add', 'rewind-apply', 'ultra-yolo', 'ultra-wave', 'ultra-yolo-fix', 'review', 'committee'];
begin
  perform public.repository_owner_only(p_workspace);
  if p_skill is null or p_skill !~ '^[a-z][a-z0-9-]*$' or char_length(p_skill) > 64 then
    raise exception 'Skill: a skill''s name, as its folder under .claude/skills/ spells it.' using errcode = '22023', hint = 'skill';
  end if;
  if p_skill = any (fixed) then
    raise exception 'Skill: /% is the loop''s own skill, which a runner runs as /omni:%.', p_skill, p_skill using errcode = '22023', hint = 'skill';
  end if;
  if p_allowed is null then
    raise exception 'Allow on runner: on or off.' using errcode = '22023', hint = 'allowed';
  end if;
  if not exists (select 1 from public.repositories r where r.workspace_id = p_workspace and r.full_name = name and r.removed_at is null) then
    raise exception 'Repository: no repository % in this workspace.', p_full_name using errcode = 'P0002', hint = 'full_name';
  end if;
  if p_allowed then
    insert into public.repository_runner_skills (workspace_id, full_name, skill, allowed_by)
    values (p_workspace, name, p_skill, auth.uid())
    on conflict (workspace_id, full_name, skill) do nothing;
  else
    delete from public.repository_runner_skills s
     where s.workspace_id = p_workspace and s.full_name = name and s.skill = p_skill;
  end if;
end;
$$;

-- `create or replace` keeps the grants; they are stated again so this file reads whole.
revoke execute on function public.set_repository_runner_skill(uuid, text, text, boolean) from public, anon;
grant execute on function public.set_repository_runner_skill(uuid, text, text, boolean) to authenticated;
