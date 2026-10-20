-- A runner job's questions (PRD 2255, docs: .omni-loop/delivery/inbox/2255-need-human/spec.md, section
-- On the server): a bug fix that stops for a decision on a runner asks a person on its job, and the
-- first person who answers queues the run that resumes it.
--
-- - runner_job_questions: one row per asking job: the job, its workspace (for row-level security), the
--   issue the job works on, the lead (why it stopped), the questions in `omni ask`'s file shape (1 to 4,
--   each with 2 to 4 options), and, once someone acts, the answers (each question's text to its answer),
--   who answered or dismissed and when, and the job that resumes the run. A row is open until
--   `closed_at` is set; closed with answers it is answered, closed without it dismissed.
-- - runner_jobs.outcome takes a fourth word, `human`: the routes set it when the job ends `done` with its
--   row still open (a failed or cancelled job's row stays as it was and reads no outcome).
-- - runner_job_answer(job, answers, by): in one transaction, locks the row, refuses a closed one, checks
--   that `by` belongs to the workspace and that every question has an answer, queues
--   `/omni:<skill> #<issue> --answers <job>` to the first job's repository and target, sent by `by`, and
--   stores the answers, who, when and the resume job. A refused queue stores nothing. Answers the
--   resume job.
-- - runner_job_dismiss(job, by): locks the row, refuses a closed one, closes it with no answers and no
--   job queued. Answers the row.
--
-- A refusal raises a SQLSTATE the routes read: P0002 no row for the job, 55000 the row is closed or the
-- job is not waiting for an answer, 42501 `by` is not a member, 22023 the answers do not match the
-- questions.
--
-- The routes write the table as the service role, which holds the rules (who may answer, the resume
-- line); a member of the workspace reads it, anyone else reads nothing, and nobody signed in writes it.
--
-- Proven by supabase/checks/runner_job_questions.sql.
-- Rollback: a follow-up migration drops runner_job_answer(), runner_job_dismiss() and
-- runner_job_questions, and restores the outcome check without `human`; a job that reads `human` reads
-- Done again once the value is mapped back (apps/galaxy/src/runners/page/model.ts).

create table public.runner_job_questions (
  job_id       uuid primary key references public.runner_jobs (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  issue        integer not null check (issue > 0),
  lead         text not null check (char_length(lead) between 1 and 4000),
  questions    jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 1 and 4),
  answers      jsonb check (answers is null or jsonb_typeof(answers) = 'object'),
  closed_by    uuid references auth.users (id) on delete set null,
  closed_at    timestamptz,
  resume_job   uuid references public.runner_jobs (id) on delete set null,
  asked_at     timestamptz not null default now(),
  constraint runner_job_questions_open_shape check (closed_at is not null or (answers is null and closed_by is null and resume_job is null)),
  constraint runner_job_questions_resume_shape check (resume_job is null or answers is not null)
);

create index runner_job_questions_open_idx on public.runner_job_questions (workspace_id) where closed_at is null;

comment on table public.runner_job_questions is
  'The questions a runner job asked a person (PRD 2255): written by the routes as the service role, through runner_job_answer() and runner_job_dismiss() once someone acts, read by the workspace''s members.';
comment on column public.runner_job_questions.issue is 'The issue the job works on; the resume job''s line names it.';
comment on column public.runner_job_questions.questions is 'The questions, in the file shape `omni ask question --file` reads: question, header, options (label, description), multiSelect.';
comment on column public.runner_job_questions.answers is 'Each question''s text to its answer, stored once by runner_job_answer() and never changed (BR-PRODUCT-12). Null while open and when dismissed.';
comment on column public.runner_job_questions.closed_by is 'Who answered or dismissed; null while open, and once that account is deleted.';
comment on column public.runner_job_questions.closed_at is 'When it was answered or dismissed; null while open.';
comment on column public.runner_job_questions.resume_job is 'The job that resumes the run with the answers; null while open, when dismissed, and once that job is deleted.';

-- ── The outcome ─────────────────────────────────────────────────────────────────

alter table public.runner_jobs
  drop constraint runner_jobs_outcome_check,
  add constraint runner_jobs_outcome_check check (outcome in ('answers', 'held', 'ready', 'human'));

comment on column public.runner_jobs.outcome is
  'What a done job ended on: answers, held or ready (PRD 2223, a yolo hand-off), or human (PRD 2255: it ended with its questions open). Null for any other job.';

-- ── Answering and dismissing ────────────────────────────────────────────────────

-- The first answer to a job's questions queues the run that resumes it, in one transaction. The row is
-- locked first, so two answers at once take one after the other and the second finds it closed.
create function public.runner_job_answer(p_job uuid, p_answers jsonb, p_by uuid) returns public.runner_jobs
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
  if not exists (select 1 from public.workspace_members m where m.workspace_id = q.workspace_id and m.user_id = p_by) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;
  if p_answers is null or jsonb_typeof(p_answers) <> 'object'
     or (select count(*) from jsonb_object_keys(p_answers)) <> jsonb_array_length(q.questions)
     or exists (select 1 from jsonb_array_elements(q.questions) e where not (p_answers ? (e ->> 'question'))) then
    raise exception 'each question needs one answer' using errcode = '22023';
  end if;
  skill := substring(asked.line from '^/omni:([a-z][a-z-]*)');
  if skill is null then
    raise exception 'the job''s line names no skill' using errcode = '22023';
  end if;
  insert into public.runner_jobs (workspace_id, line, repo, to_runner, to_fleet, sent_by)
  values (asked.workspace_id, '/omni:' || skill || ' #' || q.issue::text || ' --answers ' || p_job::text, asked.repo, asked.to_runner, asked.to_fleet, p_by)
  returning * into resume;
  update public.runner_job_questions
     set answers = p_answers, closed_by = p_by, closed_at = now(), resume_job = resume.id
   where job_id = p_job;
  return resume;
end;
$$;

-- A question nobody will answer leaves the board: closed with no answers and no job queued.
create function public.runner_job_dismiss(p_job uuid, p_by uuid) returns public.runner_job_questions
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
  if not exists (select 1 from public.workspace_members m where m.workspace_id = q.workspace_id and m.user_id = p_by) then
    raise exception 'not a member of this workspace' using errcode = '42501';
  end if;
  update public.runner_job_questions
     set closed_by = p_by, closed_at = now()
   where job_id = p_job
  returning * into q;
  return q;
end;
$$;

revoke execute on function public.runner_job_answer(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.runner_job_answer(uuid, jsonb, uuid) to service_role;
revoke execute on function public.runner_job_dismiss(uuid, uuid) from public, anon, authenticated;
grant execute on function public.runner_job_dismiss(uuid, uuid) to service_role;

-- ── Who may do what ─────────────────────────────────────────────────────────────

alter table public.runner_job_questions enable row level security;

-- The person's workspaces are read once per statement, never once per row (bug #1832).
create policy "a member reads their workspace's runner job questions" on public.runner_job_questions
  for select to authenticated
  using (workspace_id in (select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid())));

-- Explicit grants, and nothing more (config.toml › auto_expose_new_tables = false). Nobody signed in
-- writes the table: the routes do, as the service role, inserting the questions and, through the two
-- functions, closing them.
revoke all on public.runner_job_questions from public, anon, authenticated, service_role;
grant select on public.runner_job_questions to authenticated;
grant select, insert, update on public.runner_job_questions to service_role;
