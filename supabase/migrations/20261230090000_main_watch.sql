-- The main watch and the rewind (PRD 2410 s1, docs: .omni-loop/delivery/inbox/2410-broke-main/spec.md):
-- what a shipped PRD did to main in the seven days after its merge, the signals that broke it, and what
-- the rewind found about why. A status, not a retro: the retro (PRD 72) is unchanged.
--
-- - prd_main_watch: one row per PRD (its repository and issue number, as prd_milestones keys it) and
--   lane, a repository the PRD merged into: the PRD's own for a one-lane PRD, one per target for a PRD
--   of a plan repository. It keeps the merge commit, when it merged and when the watch ends, and the
--   status: `watching`, then `clean` once the seven days pass with no signal, or `broke` the moment one
--   lands. `unread` names each signal GitHub would not let the App read: the watch stays `watching`,
--   read as could not check, and a clean watch has none, so a missing read never reads clean.
-- - prd_main_breaks: one row per signal that broke a watch: a red job on the merge commit (`ci-red`,
--   the parent commit's result kept beside it), a revert of one of its pull requests (`revert`), or an
--   issue traced to it (`regression`). Its key holds its source (the run id, the revert SHA or the issue
--   number), so a replayed signal adds no row.
-- - rewind_findings: what `/omni:rewind` found, per PRD: the check it came from, where it started
--   (`repository`, `omni-setup`, `knowledge`), what happened, its evidence links (at least one, or the
--   table refuses it) and its fix. Proposed, then approved or rejected by a member once, with who and
--   when, and the reason of a rejection. The same check, origin and evidence of a PRD is one finding:
--   a rejected one is never proposed again.
-- - rewind_finding_events: the log of the decisions, one row per approval or rejection, appended in the
--   same transaction as the decision. Nobody updates or deletes one.
--
--   rewind_finding_approve(workspace, finding)           a member approves a proposed finding
--   rewind_finding_reject(workspace, finding, reason)    a member rejects one, with an optional reason
--
-- Refusals: 42501 not a member of the workspace, or the finding already decided (a decision is never
-- rewritten, BR-PRODUCT-12); P0002 no such finding in the workspace; 22023 a reason that is not one line
-- of at most 500 characters, `reason` in its hint.
--
-- A member of the workspace reads the four tables; anyone else reads nothing. Nobody signed in writes a
-- table directly: the Omni App, as the service role, opens and closes watches, adds breaks and inserts
-- the rewind's findings, and never decides one; only the two functions do. A break writes no ledger
-- event and feeds nothing in the game (N-PRODUCT-16). The App queues `/omni:rewind <n>` as it queues
-- `/omni:retro-apply`: runner_jobs.sent_by_app (20261223090000_runner_jobs_sent_by_app.sql) takes any
-- line, so nothing changes there.
--
-- Proven by supabase/checks/main_watch.sql.
--
-- Rollback: a follow-up migration drops rewind_finding_approve(), rewind_finding_reject(),
-- rewind_finding_open(), the tables rewind_finding_events, rewind_findings, prd_main_breaks and
-- prd_main_watch, and rewind_evidence_ok(); nothing else reads them.

-- ── The watch ────────────────────────────────────────────────────────────────────

create table public.prd_main_watch (
  workspace_id uuid not null references public.workspaces on delete cascade,
  repository   text not null check (repository = lower(repository) and repository ~ '^[^/\s]+/[^/\s]+$'),
  prd          integer not null check (prd > 0),
  lane         text not null check (lane = lower(lane) and lane ~ '^[^/\s]+/[^/\s]+$'),
  merge_sha    text not null check (merge_sha ~ '^[0-9a-f]{40}$'),
  merged_at    timestamptz not null,
  watch_until  timestamptz not null,
  status       text not null default 'watching' check (status in ('watching', 'clean', 'broke')),
  unread       text[] not null default '{}',
  primary key (workspace_id, repository, prd, lane),
  check (watch_until > merged_at),
  check (status <> 'clean' or cardinality(unread) = 0)
);

create index prd_main_watch_merged_idx on public.prd_main_watch (workspace_id, merged_at);

comment on table public.prd_main_watch is
  'PRD 2410: what a shipped PRD did to main, per lane (a repository it merged into): watching for seven days, then clean, or broke the moment a signal lands. Written by the Omni App as the service role, read by the workspace''s members.';
comment on column public.prd_main_watch.repository is 'owner/name of the PRD''s repository, in lower case, as prd_milestones keeps it.';
comment on column public.prd_main_watch.lane is 'owner/name of the repository the PRD merged into, in lower case: the PRD''s own for a one-lane PRD.';
comment on column public.prd_main_watch.merge_sha is 'The merge commit on the lane''s default branch.';
comment on column public.prd_main_watch.watch_until is 'When the seven days end: with no signal and nothing unread, the watch is then clean.';
comment on column public.prd_main_watch.unread is 'Each signal GitHub would not let the App read: the watch stays watching, read as could not check. A clean watch has none.';

-- ── What broke it ────────────────────────────────────────────────────────────────

create table public.prd_main_breaks (
  workspace_id uuid not null,
  repository   text not null,
  prd          integer not null,
  lane         text not null,
  kind         text not null check (kind in ('ci-red', 'revert', 'regression')),
  source       text not null check (char_length(source) between 1 and 200),
  url          text not null check (url ~ '^https://'),
  title        text not null check (char_length(title) between 1 and 300),
  parent       text check (parent in ('green', 'red', 'unknown')),
  at           timestamptz not null,
  primary key (workspace_id, repository, prd, lane, kind, source),
  foreign key (workspace_id, repository, prd, lane) references public.prd_main_watch (workspace_id, repository, prd, lane) on delete cascade,
  check (kind = 'ci-red' or parent is null)
);

comment on table public.prd_main_breaks is
  'PRD 2410: each signal that broke a watch: a red job on the merge commit, a revert of one of the PRD''s pull requests, or a regression traced to it. Keyed by its source, so a replayed signal adds no row. Written by the Omni App as the service role, read by the workspace''s members.';
comment on column public.prd_main_breaks.source is 'The replay key: the run id of a ci-red (with its job), the SHA of a revert, the number of a regression issue.';
comment on column public.prd_main_breaks.title is 'What broke, as the Main tab names it: the red job, the revert''s title, the issue''s title.';
comment on column public.prd_main_breaks.parent is 'A ci-red only: the parent commit''s result for the same checks, green, red or unknown, so a reader sees when main was red before the merge.';
comment on column public.prd_main_breaks.at is 'When the signal happened on GitHub, never when the App read it.';

-- ── What the rewind found ────────────────────────────────────────────────────────

-- A finding's evidence: an array of 1 to 20 links, each an https URL of at most 500 characters.
create function public.rewind_evidence_ok(p_evidence jsonb) returns boolean
language sql immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p_evidence) = 'array' then
    jsonb_array_length(p_evidence) between 1 and 20
    and not exists (
      select 1 from jsonb_array_elements(p_evidence) as e (link)
       where not (jsonb_typeof(link) = 'string' and link #>> '{}' ~ '^https://[^\s]+$' and char_length(link #>> '{}') <= 500))
  else false end
$$;

-- Only the service role inserts a finding, and the check runs as the role that writes.
revoke execute on function public.rewind_evidence_ok(jsonb) from public, anon, authenticated;
grant execute on function public.rewind_evidence_ok(jsonb) to service_role;

create table public.rewind_findings (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  repository   text not null check (repository = lower(repository) and repository ~ '^[^/\s]+/[^/\s]+$'),
  prd          integer not null check (prd > 0),
  check_name   text not null check (check_name in ('main', 'reviews', 'ci', 'bodies', 'waves', 'plan', 'spec', 'knowledge')),
  origin       text not null check (origin in ('repository', 'omni-setup', 'knowledge')),
  happened     text not null check (char_length(happened) between 1 and 4000),
  evidence     jsonb not null check (public.rewind_evidence_ok(evidence)),
  fix          text not null check (char_length(fix) between 1 and 4000),
  state        text not null default 'proposed' check (state in ('proposed', 'approved', 'rejected')),
  reason       text check (char_length(reason) between 1 and 500),
  proposed_at  timestamptz not null default now(),
  decided_by   uuid references auth.users on delete set null,
  decided_at   timestamptz,
  check ((state = 'proposed') = (decided_at is null)),
  check (state = 'rejected' or reason is null)
);

-- The same check, origin and evidence of a PRD is one finding, whatever became of it.
create unique index rewind_findings_once on public.rewind_findings (workspace_id, repository, prd, check_name, origin, md5(evidence::text));

comment on table public.rewind_findings is
  'PRD 2410: what /omni:rewind found about why a PRD broke main: its check, where it started, what happened, its evidence and its fix. Inserted by the Omni App as the service role; proposed until a member approves or rejects it once, through rewind_finding_approve/reject(). Read by the workspace''s members.';
comment on column public.rewind_findings.repository is 'owner/name of the PRD''s repository, in lower case, as prd_main_watch keeps it.';
comment on column public.rewind_findings.check_name is 'The rewind''s check it came from: main (the break itself), then the seven checks from the reviews back to the knowledge.';
comment on column public.rewind_findings.origin is 'Where the break started: the repository (code, tests, CI), the Omni setup (config, a skill, the kit), or knowledge nobody wrote down.';
comment on column public.rewind_findings.evidence is 'The links the finding stands on: 1 to 20 https URLs.';
comment on column public.rewind_findings.reason is 'Why a member rejected it, when they said; only on a rejected finding.';

create table public.rewind_finding_events (
  id           bigint generated always as identity primary key,
  workspace_id uuid not null references public.workspaces on delete cascade,
  finding_id   uuid not null references public.rewind_findings on delete cascade,
  action       text not null check (action in ('approved', 'rejected')),
  reason       text,
  changed_by   uuid references auth.users on delete set null,
  changed_at   timestamptz not null default now()
);

create index rewind_finding_events_finding_idx on public.rewind_finding_events (finding_id);

comment on table public.rewind_finding_events is
  'PRD 2410: the decisions on rewind findings, one row per approval or rejection, appended in the same transaction as the decision by rewind_finding_approve/reject(). Nobody updates or deletes a row.';

-- ── The decisions ────────────────────────────────────────────────────────────────

-- A finding of the workspace, locked for the decision, after the member check: 42501 for anyone but a
-- member, P0002 naming `finding` when the workspace has no such finding, 42501 naming it when it was
-- already decided.
create function public.rewind_finding_open(p_workspace uuid, p_finding uuid) returns public.rewind_findings
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_one public.rewind_findings;
begin
  if (select auth.uid()) is null or p_workspace is null or not public.is_member(p_workspace) then
    raise exception 'Only a member of the workspace decides its rewind findings.' using errcode = '42501';
  end if;
  select * into found_one from public.rewind_findings f
   where f.id = p_finding and f.workspace_id = p_workspace
   for update;
  if not found then
    raise exception 'Finding: no such finding in this workspace.' using errcode = 'P0002', hint = 'finding';
  end if;
  if found_one.state <> 'proposed' then
    raise exception 'Finding: already %, and a decision is never rewritten.', found_one.state using errcode = '42501', hint = 'finding';
  end if;
  return found_one;
end;
$$;

-- A member approves a proposed finding: it records who and when, and one `approved` event logs it.
create function public.rewind_finding_approve(p_workspace uuid, p_finding uuid)
returns public.rewind_findings
language plpgsql
security definer
set search_path = ''
as $$
declare
  was public.rewind_findings := public.rewind_finding_open(p_workspace, p_finding);
  decided public.rewind_findings;
begin
  update public.rewind_findings f
     set state = 'approved', decided_by = (select auth.uid()), decided_at = now()
   where f.id = was.id
  returning * into decided;
  insert into public.rewind_finding_events (workspace_id, finding_id, action, reason, changed_by)
  values (p_workspace, decided.id, 'approved', null, (select auth.uid()));
  return decided;
end;
$$;

-- A member rejects a proposed finding, with an optional reason: it is kept, with the reason, who and
-- when, and one `rejected` event logs it.
create function public.rewind_finding_reject(p_workspace uuid, p_finding uuid, p_reason text default null)
returns public.rewind_findings
language plpgsql
security definer
set search_path = ''
as $$
declare
  was public.rewind_findings := public.rewind_finding_open(p_workspace, p_finding);
  why text := nullif(btrim(coalesce(p_reason, '')), '');
  decided public.rewind_findings;
begin
  if why is not null and (char_length(why) > 500 or why ~ '[\n\r]') then
    raise exception 'Reason: one line, 500 characters at most.' using errcode = '22023', hint = 'reason';
  end if;
  update public.rewind_findings f
     set state = 'rejected', reason = why, decided_by = (select auth.uid()), decided_at = now()
   where f.id = was.id
  returning * into decided;
  insert into public.rewind_finding_events (workspace_id, finding_id, action, reason, changed_by)
  values (p_workspace, decided.id, 'rejected', why, (select auth.uid()));
  return decided;
end;
$$;

revoke execute on function public.rewind_finding_open(uuid, uuid) from public, anon, authenticated, service_role;
revoke execute on function public.rewind_finding_approve(uuid, uuid) from public, anon, service_role;
grant execute on function public.rewind_finding_approve(uuid, uuid) to authenticated;
revoke execute on function public.rewind_finding_reject(uuid, uuid, text) from public, anon, service_role;
grant execute on function public.rewind_finding_reject(uuid, uuid, text) to authenticated;

-- ── Who may do what ─────────────────────────────────────────────────────────────

alter table public.prd_main_watch enable row level security;
alter table public.prd_main_breaks enable row level security;
alter table public.rewind_findings enable row level security;
alter table public.rewind_finding_events enable row level security;

-- The person's workspaces are read once per statement, never once per row (bug #1832).
create policy "a member reads their workspace's main watches" on public.prd_main_watch
  for select to authenticated using (workspace_id in (select public.my_workspaces()));
create policy "a member reads their workspace's main breaks" on public.prd_main_breaks
  for select to authenticated using (workspace_id in (select public.my_workspaces()));
create policy "a member reads their workspace's rewind findings" on public.rewind_findings
  for select to authenticated using (workspace_id in (select public.my_workspaces()));
create policy "a member reads their workspace's rewind decisions" on public.rewind_finding_events
  for select to authenticated using (workspace_id in (select public.my_workspaces()));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false). Nobody signed in
-- writes a table; the Omni App, as the service role, opens and closes watches, adds breaks (never
-- rewriting one) and inserts findings, and never decides one or touches a decision's event.
revoke all on public.prd_main_watch from public, anon, authenticated, service_role;
grant select on public.prd_main_watch to authenticated;
grant select, insert, update on public.prd_main_watch to service_role;

revoke all on public.prd_main_breaks from public, anon, authenticated, service_role;
grant select on public.prd_main_breaks to authenticated;
grant select, insert on public.prd_main_breaks to service_role;

revoke all on public.rewind_findings from public, anon, authenticated, service_role;
grant select on public.rewind_findings to authenticated;
-- The App proposes a finding: it writes what the rewind found, never its state or a decision.
grant select on public.rewind_findings to service_role;
grant insert (workspace_id, repository, prd, check_name, origin, happened, evidence, fix) on public.rewind_findings to service_role;

revoke all on public.rewind_finding_events from public, anon, authenticated, service_role;
grant select on public.rewind_finding_events to authenticated;
grant select on public.rewind_finding_events to service_role;
