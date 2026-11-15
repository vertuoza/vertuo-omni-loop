-- The ready verdicts (PRD 2898 s7, docs: .omni-loop/delivery/inbox/2898-ready-five-checks/spec.md): what the
-- Omni App's check `omni / ready` decided on a gated feature PR's latest commit, kept for the PRD page's
-- Ready panel. The App runs the kit's ready rule (kit/lib/ready/checks.ts) on facts it reads through GitHub,
-- posts the check, then saves its verdict here: one row per pull request and head commit, a re-run on the
-- same commit rewriting it.
--
-- - workspace_id: the workspace the App's installation belongs to (workspaces.github_installation_id), so
--   a verdict is never saved in another workspace (BR-PRODUCT-63).
-- - state: `ready` (all five checks pass), `not ready` (one fails) or `not finished` (one is still coming,
--   or could not be judged); passed counts the checks that pass, 5 exactly when ready (BL-GATE-1).
-- - checks: the five, in order, as the rule gives them: {id, title, state, why, evidence, excused}.
-- - criteria: the spec's criteria at the head, each {number, kind, scenario, lines, proof, state}, the state
--   the acceptance report gives its proof of that kind (null while none), for the panel.
-- - They are the App's status records, in its own name, never a person's words or answer (BL-ASK-1).
--
-- A member of the workspace reads its verdicts; anyone else reads nothing, and nobody signed in writes the
-- table: the service role does (the App).
--
-- Proven by supabase/checks/ready_verdicts.sql.
-- Rollback: a follow-up migration drops public.ready_verdicts; nothing else reads it.

create table public.ready_verdicts (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  repo         text not null check (repo ~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$'),
  prd          integer not null check (prd > 0),
  pr_number    integer not null check (pr_number > 0),
  head_sha     text not null check (head_sha ~ '^[0-9a-f]{40}$'),
  state        text not null check (state in ('ready', 'not ready', 'not finished')),
  passed       smallint not null check (passed between 0 and 5),
  headline     text not null check (char_length(headline) between 1 and 300),
  checks       jsonb not null check (jsonb_typeof(checks) = 'array' and jsonb_array_length(checks) = 5),
  criteria     jsonb not null default '[]'::jsonb check (jsonb_typeof(criteria) = 'array'),
  check_url    text check (check_url is null or (check_url ~ '^https://' and char_length(check_url) <= 500)),
  decided_at   timestamptz not null default now(),
  constraint ready_verdicts_ready_is_five check ((state = 'ready') = (passed = 5)),
  constraint ready_verdicts_head_key unique (workspace_id, repo, pr_number, head_sha)
);

create index ready_verdicts_prd_idx on public.ready_verdicts (workspace_id, repo, prd, decided_at desc);

comment on table public.ready_verdicts is
  'What the App''s check omni / ready decided on a gated feature PR''s latest commit (PRD 2898): one row per pull request and head commit, written by the service role, read by the workspace''s members.';
comment on column public.ready_verdicts.repo is 'owner/name, in lower case: the pull request''s repository.';
comment on column public.ready_verdicts.state is 'ready (five checks pass), not ready (one fails) or not finished (one is still coming, or not judged).';
comment on column public.ready_verdicts.passed is 'How many of the five checks pass: 5 exactly when ready.';
comment on column public.ready_verdicts.checks is 'The five checks in order, as the kit''s rule gives them: {id, title, state, why, evidence, excused}.';
comment on column public.ready_verdicts.criteria is 'The spec''s criteria at the head: {number, kind, scenario, lines, proof, state}, state as the acceptance report gives it.';
comment on column public.ready_verdicts.check_url is 'The omni / ready check run on GitHub, when it was posted.';

alter table public.ready_verdicts enable row level security;

create policy "a member reads their workspace's ready verdicts" on public.ready_verdicts
  for select to authenticated
  using (workspace_id in (select public.my_workspaces()));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false). Nobody signed in writes
-- the table: the service role does.
revoke all on public.ready_verdicts from public, anon, authenticated, service_role;
grant select on public.ready_verdicts to authenticated;
grant select, insert, update on public.ready_verdicts to service_role;
