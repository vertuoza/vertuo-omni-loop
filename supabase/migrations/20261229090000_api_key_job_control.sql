-- What the database keeps of a job an API key sent (PRD 2425, docs:
-- .omni-loop/delivery/inbox/2425-api-key-job-control/spec.md, sections 3, 6, 7, 8 and 9): an API key
-- (PRD 2022, an `agent_tokens` row of scope `api`) follows the job it sent and acts on it, and the trace
-- says who did: the key, never a person.
--
-- - runner_jobs.outcome: also accepts `pr-opened`, `already-fixed`, `needs-brainstorm`, `not-a-bug`,
--   `stuck` and `blocked`, beside today's values: the words /omni:bug-fix and /omni:mega-bug-fix end on.
--   `human` stays need-human's.
-- - runner_jobs.fixed_by (the pull request that fixed a bug already fixed), prs (every pull request a job
--   opened, a list of 50 at most), acting_for (whom an app says it acted for, 1 to 80 characters),
--   notify_url (the https link a job's changes are pinged to, 500 characters at most), cancelled_by_key
--   and cancelled_for (the key that cancelled a job and whom it acted for). Null, but prs, which starts
--   as an empty list.
-- - runner_job_questions.closed_by_key and closed_for: the key that answered or dismissed a round and
--   whom it acted for, named after runner_jobs.sent_by_key and runner_job_questions.closed_by. A round
--   is closed by a person or by a key, never by both; a key's close never writes `closed_by`.
-- - runner_job_answer(job, answers, by, key, acting_for) and runner_job_dismiss(job, by, key, acting_for):
--   a round is closed for exactly one of a person (`by`) and a key (`key`, whose `acting_for` is stored
--   beside it). A key closes the round of a job a key sent, and only a live key of the job's workspace,
--   whose maker is still a member and whose repositories hold the job's (BR-PRODUCT-63, BR-PRODUCT-64);
--   the first close wins, the second is refused as before (BR-PRODUCT-12). The resume of a key's job is
--   queued with that job's `sent_by_key` and its maker, `continues` the job, and its `notify_url`,
--   whoever answered, so the whole thread stays the key's; the job a person sent resumes as it did, sent
--   by the one who answered. A job a resume already continues is not answered again (55000), since
--   `runner_jobs.continues` is unique.
-- - runner_job_closer_check(): the rules of who may close a round, shared by both functions.
--
-- A refusal raises a SQLSTATE the routes read: P0002 no row for the job, 55000 the row is closed, the job
-- is not waiting for an answer or a job already carries it on, 42501 `by` is not a member or the key may
-- not close this job's round, 22023 the answers do not match the questions, or the person-or-key
-- arguments are wrong.
--
-- The earlier signatures took the person alone; a call that passes only `p_job`, `p_answers` and `p_by`
-- (or `p_job` and `p_by`) is the call they took, and does what they did.
--
-- runner_jobs and runner_job_questions keep their grants and their row-level security: a member of the
-- workspace reads the new columns with the row, anyone else reads nothing, and nobody signed in writes
-- them; only the service role, through the routes and the two functions, does.
--
-- Proven by supabase/checks/api_key_jobs.sql.
-- Rollback: a follow-up migration restores runner_job_answer(uuid, jsonb, uuid) and
-- runner_job_dismiss(uuid, uuid) as 20261218100000_runner_job_questions.sql made them, drops
-- runner_job_closer_check() and the columns and constraints below, restores
-- runner_job_questions_open_shape, and restores the outcome check of 20261225090000_runner_stopped.sql
-- once no row holds one of the six new words. The routes and the answers stored stay as they are.

-- ── The outcome ─────────────────────────────────────────────────────────────────

alter table public.runner_jobs
  drop constraint runner_jobs_outcome_check,
  add constraint runner_jobs_outcome_check check (outcome in (
    'answers', 'held', 'ready', 'human', 'stopped',
    'pr-opened', 'already-fixed', 'needs-brainstorm', 'not-a-bug', 'stuck', 'blocked'));

comment on column public.runner_jobs.outcome is
  'What a done job ended on: answers, held, ready or stopped (a yolo hand-off, PRDs 2223 and 2375), human (PRD 2255: it ended with its questions open), or pr-opened, already-fixed, needs-brainstorm, not-a-bug, stuck or blocked (PRD 2425: a bug fix''s ending). Null for any other job.';

-- ── What a job did, and for whom ────────────────────────────────────────────────

alter table public.runner_jobs
  add column fixed_by text check (fixed_by is null or (fixed_by ~ '^https://' and char_length(fixed_by) <= 300)),
  add column prs jsonb not null default '[]' check (jsonb_typeof(prs) = 'array' and jsonb_array_length(prs) <= 50),
  add column acting_for text check (acting_for is null or char_length(acting_for) between 1 and 80),
  add column notify_url text check (notify_url is null or (notify_url ~ '^https://' and char_length(notify_url) <= 500)),
  add column cancelled_by_key uuid references public.agent_tokens (id) on delete set null,
  add column cancelled_for text check (cancelled_for is null or char_length(cancelled_for) between 1 and 80);

comment on column public.runner_jobs.fixed_by is
  'The pull request that fixed the bug when the job found it already fixed (PRD 2425): the one the bug fix proved, never one it only suspected. Null for any other job.';
comment on column public.runner_jobs.prs is
  'Every pull request the job opened, in order, across repositories (PRD 2425): at most 50, as the runner reported them. An empty list for a job that opened none.';
comment on column public.runner_jobs.acting_for is
  'Whom an API key''s app said it acted for when the action queued this job (PRD 2425): free text of 1 to 80 characters, stored as given, never matched to a member. Null for any other job.';
comment on column public.runner_jobs.notify_url is
  'The https address pinged when the job''s status, outcome or questions change (PRD 2425), 500 characters at most; a resume or a relaunch inherits it. Null for a job sent without one.';
comment on column public.runner_jobs.cancelled_by_key is
  'The API key that cancelled the job (PRD 2425), or null for a cancel from the page, a job nobody cancelled and a key that no longer exists.';
comment on column public.runner_jobs.cancelled_for is
  'Whom the key said it acted for when it cancelled the job (PRD 2425): 1 to 80 characters. Null with no key.';

-- ── Who closed a round ──────────────────────────────────────────────────────────

alter table public.runner_job_questions
  add column closed_by_key uuid references public.agent_tokens (id) on delete set null,
  add column closed_for text check (closed_for is null or char_length(closed_for) between 1 and 80);

-- A round still open holds nothing of whoever closes it; one closed names a person or a key, never both
-- (neither once that account or key is deleted).
alter table public.runner_job_questions
  drop constraint runner_job_questions_open_shape,
  add constraint runner_job_questions_open_shape check (closed_at is not null
    or (answers is null and closed_by is null and closed_by_key is null and closed_for is null and resume_job is null)),
  add constraint runner_job_questions_one_closer check (closed_by is null or closed_by_key is null);

comment on column public.runner_job_questions.closed_by_key is
  'The API key that answered or dismissed (PRD 2425), never with closed_by; null while open, when a person closed it, and once that key is deleted.';
comment on column public.runner_job_questions.closed_for is
  'Whom the key said it acted for (PRD 2425): 1 to 80 characters. Null while open and when a person closed it.';

-- ── Who may close a round ───────────────────────────────────────────────────────

-- The rules both functions share. It reads agent_tokens, which the service role cannot, so it runs as its
-- owner; it changes nothing.
create function public.runner_job_closer_check(
  p_workspace uuid, p_repo text, p_job_key uuid, p_by uuid, p_key uuid, p_acting_for text
) returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (p_by is null) = (p_key is null) then
    raise exception 'Close a round as one person or one API key, never both and never neither.' using errcode = '22023', hint = 'by';
  end if;
  if p_acting_for is not null and (p_key is null or char_length(p_acting_for) not between 1 and 80) then
    raise exception 'Acting for: 1 to 80 characters, and only with an API key.' using errcode = '22023', hint = 'acting_for';
  end if;
  if p_by is not null then
    if not exists (select 1 from public.workspace_members m where m.workspace_id = p_workspace and m.user_id = p_by) then
      raise exception 'not a member of this workspace' using errcode = '42501';
    end if;
    return;
  end if;
  if p_job_key is null then
    raise exception 'an API key closes only the questions of a job an API key sent' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.agent_tokens t
     where t.id = p_key and t.scope = 'api' and t.revoked_at is null and t.workspace_id = p_workspace
       and (t.repos = '{}' or p_repo = any (t.repos))
       and exists (select 1 from public.workspace_members m where m.workspace_id = t.workspace_id and m.user_id = t.made_by)
  ) then
    raise exception 'this API key does not act on this job' using errcode = '42501';
  end if;
end;
$$;

-- ── Answering and dismissing ────────────────────────────────────────────────────

drop function public.runner_job_answer(uuid, jsonb, uuid);
drop function public.runner_job_dismiss(uuid, uuid);

-- The first answer to a job's questions queues the run that resumes it, in one transaction. The row is
-- locked first, so two answers at once take one after the other and the second finds it closed.
create function public.runner_job_answer(
  p_job uuid, p_answers jsonb, p_by uuid default null, p_key uuid default null, p_acting_for text default null
) returns public.runner_jobs
language plpgsql
set search_path = ''
as $$
declare
  q      public.runner_job_questions;
  asked  public.runner_jobs;
  skill  text;
  resume public.runner_jobs;
begin
  select * into q from public.runner_job_questions where job_id = p_job for update;
  if q.job_id is null then
    raise exception 'no questions on this job' using errcode = 'P0002';
  end if;
  if q.closed_at is not null then
    raise exception 'these questions are already closed' using errcode = '55000';
  end if;
  select * into asked from public.runner_jobs where id = p_job;
  if asked.outcome is distinct from 'human' then
    raise exception 'this job is not waiting for an answer' using errcode = '55000';
  end if;
  perform public.runner_job_closer_check(q.workspace_id, asked.repo, asked.sent_by_key, p_by, p_key, p_acting_for);
  if p_answers is null or jsonb_typeof(p_answers) <> 'object'
     or (select count(*) from jsonb_object_keys(p_answers)) <> jsonb_array_length(q.questions)
     or exists (select 1 from jsonb_array_elements(q.questions) e where not (p_answers ? (e ->> 'question'))) then
    raise exception 'each question needs one answer' using errcode = '22023';
  end if;
  skill := substring(asked.line from '^/omni:([a-z][a-z-]*)');
  if skill is null then
    raise exception 'the job''s line names no skill' using errcode = '22023';
  end if;
  if asked.sent_by_key is not null and exists (select 1 from public.runner_jobs c where c.continues = p_job) then
    raise exception 'a job already carries this one on' using errcode = '55000';
  end if;
  -- A key's job resumes as that job's key and maker, whoever answered; any other job, as the one who answered.
  insert into public.runner_jobs (workspace_id, line, repo, to_runner, to_fleet, sent_by, sent_by_key, continues, notify_url, acting_for)
  values (asked.workspace_id, '/omni:' || skill || ' #' || q.issue::text || ' --answers ' || p_job::text, asked.repo, asked.to_runner, asked.to_fleet,
          case when asked.sent_by_key is not null then asked.sent_by else p_by end,
          asked.sent_by_key,
          case when asked.sent_by_key is not null then p_job end,
          asked.notify_url,
          p_acting_for)
  returning * into resume;
  update public.runner_job_questions
     set answers = p_answers, closed_by = p_by, closed_by_key = p_key, closed_for = p_acting_for, closed_at = now(), resume_job = resume.id
   where job_id = p_job;
  return resume;
end;
$$;

-- A question nobody will answer leaves the board: closed with no answers and no job queued.
create function public.runner_job_dismiss(
  p_job uuid, p_by uuid default null, p_key uuid default null, p_acting_for text default null
) returns public.runner_job_questions
language plpgsql
set search_path = ''
as $$
declare
  q     public.runner_job_questions;
  asked public.runner_jobs;
begin
  select * into q from public.runner_job_questions where job_id = p_job for update;
  if q.job_id is null then
    raise exception 'no questions on this job' using errcode = 'P0002';
  end if;
  if q.closed_at is not null then
    raise exception 'these questions are already closed' using errcode = '55000';
  end if;
  select * into asked from public.runner_jobs where id = p_job;
  if asked.outcome is distinct from 'human' then
    raise exception 'this job is not waiting for an answer' using errcode = '55000';
  end if;
  perform public.runner_job_closer_check(q.workspace_id, asked.repo, asked.sent_by_key, p_by, p_key, p_acting_for);
  update public.runner_job_questions
     set closed_by = p_by, closed_by_key = p_key, closed_for = p_acting_for, closed_at = now()
   where job_id = p_job
  returning * into q;
  return q;
end;
$$;

revoke execute on function public.runner_job_closer_check(uuid, text, uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.runner_job_closer_check(uuid, text, uuid, uuid, uuid, text) to service_role;
revoke execute on function public.runner_job_answer(uuid, jsonb, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.runner_job_answer(uuid, jsonb, uuid, uuid, text) to service_role;
revoke execute on function public.runner_job_dismiss(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.runner_job_dismiss(uuid, uuid, uuid, text) to service_role;
