// A job's questions' migration (PRD 2255), read as text: the table and its columns, its limits, its reading
// rule and its one writer, the `human` outcome, and the two functions the repository calls. What the rules
// let through is the database's to prove (supabase/checks/runner_job_questions.sql, run by
// .github/workflows/supabase.yml); this pins that each is there, that the contract's limits are the
// table's, and that the database's types name what the repository writes and reads.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../../../${path}`, import.meta.url)), 'utf8');
const MIGRATION = read('supabase/migrations/20261218100000_runner_job_questions.sql');
// Comment lines go; a `--` inside a string (the resume line's ` --answers `) stays.
const CODE = MIGRATION.replace(/^\s*--.*$/gm, '').replace(/\s+/g, ' ');
const CHECK = read('supabase/checks/runner_job_questions.sql');
const TYPES = read('supabase/database.types.ts');
const CONTRACT = read('apps/galaxy/src/runners/runners.contract.ts');

/** The column list of `create table public.runner_job_questions (…);`. */
function columns(): string {
  const match = /create table public\.runner_job_questions \((.*?)\);/.exec(CODE);
  if (!match?.[1]) throw new Error('no table runner_job_questions');
  return match[1];
}

/** The body of `create function public.<name>(…) … $$ … $$;`. */
function body(name: string): string {
  const match = new RegExp(`create function public\\.${name}\\(.*?as \\$\\$(.*?)\\$\\$;`).exec(CODE);
  if (!match?.[1]) throw new Error(`no function ${name}`);
  return match[1];
}

describe('the runner_job_questions migration', () => {
  it('creates the table: one row per job, cascading with its job and its workspace', () => {
    const created = columns();
    expect(created).toContain('job_id uuid primary key references public.runner_jobs (id) on delete cascade');
    expect(created).toContain('workspace_id uuid not null references public.workspaces (id) on delete cascade');
    expect(created).toContain('issue integer not null check (issue > 0)');
    expect(created).toContain('lead text not null check (char_length(lead) between 1 and 4000)');
    expect(created).toContain("questions jsonb not null check (jsonb_typeof(questions) = 'array' and jsonb_array_length(questions) between 1 and 4)");
    expect(created).toContain("answers jsonb check (answers is null or jsonb_typeof(answers) = 'object')");
    expect(created).toContain('closed_by uuid references auth.users (id) on delete set null');
    expect(created).toContain('closed_at timestamptz');
    expect(created).toContain('resume_job uuid references public.runner_jobs (id) on delete set null');
    expect(created).toContain('asked_at timestamptz not null default now()');
  });

  it('keeps an open row empty and gives a resume job only to an answered one', () => {
    const created = columns();
    expect(created).toContain('check (closed_at is not null or (answers is null and closed_by is null and resume_job is null))');
    expect(created).toContain('check (resume_job is null or answers is not null)');
  });

  it('keeps the limits the contract allows: 4 questions, a lead of 4,000 characters, 2,000 per answer', () => {
    expect(CONTRACT).toContain('const QUESTIONS_MAX = 4;');
    expect(CONTRACT).toContain('const LEAD_CHARS = 4_000;');
    expect(CONTRACT).toContain('export const ANSWER_CHARS = 2_000;');
  });

  it('indexes the open rows of a workspace', () => {
    expect(CODE).toContain('create index runner_job_questions_open_idx on public.runner_job_questions (workspace_id) where closed_at is null;');
  });

  it('lets a member of the workspace read the questions, and only the service role write them', () => {
    expect(CODE).toContain('alter table public.runner_job_questions enable row level security;');
    expect(CODE).toContain('on public.runner_job_questions for select to authenticated using (workspace_id in (select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid())));');
    expect(CODE).toContain('revoke all on public.runner_job_questions from public, anon, authenticated, service_role;');
    expect(CODE).toContain('grant select on public.runner_job_questions to authenticated;');
    expect(CODE).toContain('grant select, insert, update on public.runner_job_questions to service_role;');
    expect(CODE).not.toMatch(/grant [^;]*(insert|update|delete|all)[^;]* on public\.runner_job_questions to (authenticated|anon|public)/);
  });

  it('adds human to the outcome check, keeping the three words before it', () => {
    expect(CODE).toContain('drop constraint runner_jobs_outcome_check');
    expect(CODE).toContain("add constraint runner_jobs_outcome_check check (outcome in ('answers', 'held', 'ready', 'human'))");
    expect(CONTRACT).toContain("export const JOB_OUTCOMES = ['answers', 'held', 'ready', 'human', 'stopped'] as const;");
  });
});

describe('runner_job_answer()', () => {
  it('takes the job, the answers and who answers, and answers the resume job', () => {
    expect(CODE).toContain('create function public.runner_job_answer(p_job uuid, p_answers jsonb, p_by uuid) returns public.runner_jobs language plpgsql set search_path = \'\'');
  });

  it('locks the row first, so a second answer at once finds it closed', () => {
    const answer = body('runner_job_answer');
    expect(answer).toContain('select * into q from public.runner_job_questions where job_id = p_job for update;');
    expect(answer.indexOf('for update')).toBeLessThan(answer.indexOf('insert into public.runner_jobs'));
  });

  it('refuses a missing row, a closed one, a job that is not waiting, a stranger and answers that do not match', () => {
    const answer = body('runner_job_answer');
    expect(answer).toContain("raise exception 'no questions on this job' using errcode = 'P0002';");
    expect(answer).toContain('if q.closed_at is not null then');
    expect(answer).toContain("raise exception 'these questions are already closed' using errcode = '55000';");
    expect(answer).toContain("if asked.outcome is distinct from 'human' then");
    expect(answer).toContain("raise exception 'this job is not waiting for an answer' using errcode = '55000';");
    expect(answer).toContain('where m.workspace_id = q.workspace_id and m.user_id = p_by');
    expect(answer).toContain("raise exception 'not a member of this workspace' using errcode = '42501';");
    expect(answer).toContain('<> jsonb_array_length(q.questions)');
    expect(answer).toContain("raise exception 'each question needs one answer' using errcode = '22023';");
  });

  it('queues the resume line to the first job\'s repository and target, sent by the answerer, before it stores the answers', () => {
    const answer = body('runner_job_answer');
    expect(answer).toContain("skill := substring(asked.line from '^/omni:([a-z][a-z-]*)');");
    expect(answer).toContain('insert into public.runner_jobs (workspace_id, line, repo, to_runner, to_fleet, sent_by)');
    expect(answer).toContain("values (asked.workspace_id, '/omni:' || skill || ' #' || q.issue::text || ' --answers ' || p_job::text, asked.repo, asked.to_runner, asked.to_fleet, p_by)");
    expect(answer).toContain('set answers = p_answers, closed_by = p_by, closed_at = now(), resume_job = resume.id where job_id = p_job;');
    expect(answer.indexOf('insert into public.runner_jobs')).toBeLessThan(answer.indexOf('update public.runner_job_questions'));
  });

  it('is run by the service role only', () => {
    expect(CODE).toContain('revoke execute on function public.runner_job_answer(uuid, jsonb, uuid) from public, anon, authenticated;');
    expect(CODE).toContain('grant execute on function public.runner_job_answer(uuid, jsonb, uuid) to service_role;');
  });
});

describe('runner_job_dismiss()', () => {
  it('takes the job and who dismisses, and answers the closed row', () => {
    expect(CODE).toContain('create function public.runner_job_dismiss(p_job uuid, p_by uuid) returns public.runner_job_questions language plpgsql set search_path = \'\'');
  });

  it('locks the row, refuses what an answer refuses, and queues no job', () => {
    const dismiss = body('runner_job_dismiss');
    expect(dismiss).toContain('select * into q from public.runner_job_questions where job_id = p_job for update;');
    expect(dismiss).toContain("raise exception 'no questions on this job' using errcode = 'P0002';");
    expect(dismiss).toContain("raise exception 'these questions are already closed' using errcode = '55000';");
    expect(dismiss).toContain("raise exception 'this job is not waiting for an answer' using errcode = '55000';");
    expect(dismiss).toContain("raise exception 'not a member of this workspace' using errcode = '42501';");
    expect(dismiss).toContain('set closed_by = p_by, closed_at = now() where job_id = p_job returning * into q;');
    expect(dismiss).not.toContain('insert into');
  });

  it('is run by the service role only', () => {
    expect(CODE).toContain('revoke execute on function public.runner_job_dismiss(uuid, uuid) from public, anon, authenticated;');
    expect(CODE).toContain('grant execute on function public.runner_job_dismiss(uuid, uuid) to service_role;');
  });
});

describe('what proves it', () => {
  it('is supabase/checks/runner_job_questions.sql: reading, writing, answering once, a refused queue, dismissing', () => {
    expect(CHECK).toContain('FAIL: a member did not read');
    expect(CHECK).toContain('FAIL: another workspace read');
    expect(CHECK).toContain('FAIL: a member wrote a row');
    expect(CHECK).toContain('FAIL: a second answer was taken');
    expect(CHECK).toContain('FAIL: a refused queue stored the answers or a job');
    expect(CHECK).toContain('FAIL: a dismissal queued a job');
    expect(CHECK).toContain("select 'runner_job_questions: every check passed' as result;");
  });

  it('runs in the supabase workflow', () => {
    expect(read('.github/workflows/supabase.yml')).toContain('-f supabase/checks/runner_job_questions.sql');
  });

  it('is named in the database\'s types: the table, and both functions', () => {
    expect(TYPES).toMatch(/runner_job_questions: \{\n\s+Row: \{\n\s+answers: Json \| null\n\s+asked_at: string\n\s+closed_at: string \| null\n\s+closed_by: string \| null\n\s+closed_by_key: string \| null\n\s+closed_for: string \| null\n\s+issue: number\n\s+job_id: string\n\s+lead: string\n\s+questions: Json\n\s+resume_job: string \| null\n\s+workspace_id: string\n/);
    expect(TYPES).toMatch(/runner_job_answer: \{\n\s+Args: \{\n\s+p_acting_for\?: string\n\s+p_answers: Json\n\s+p_by\?: string\n\s+p_job: string\n\s+p_key\?: string\n/);
    expect(TYPES).toMatch(/runner_job_dismiss: \{\n\s+Args: \{\n\s+p_acting_for\?: string\n\s+p_by\?: string\n\s+p_job: string\n\s+p_key\?: string\n/);
  });
});
