// A job's live lines' migration (PRD 1904), read as text: the table and its columns, its keys and
// limits, its reading rule, its one writer and the retention function the repository calls. What the
// rules let through is the database's to prove (supabase/checks/runner_job_lines.sql); this pins that
// each is there, and that the database's types name what the repository writes and reads.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../../../${path}`, import.meta.url)), 'utf8');
const MIGRATION = read('supabase/migrations/20261208090000_runner_job_lines.sql');
const CODE = MIGRATION.replace(/--.*$/gm, '').replace(/\s+/g, ' ');
const CHECK = read('supabase/checks/runner_job_lines.sql');
const TYPES = read('supabase/database.types.ts');

/** The column list of `create table public.runner_job_lines (…);`. */
function columns(): string {
  const match = /create table public\.runner_job_lines \((.*?)\);/.exec(CODE);
  if (!match?.[1]) throw new Error('no table runner_job_lines');
  return match[1];
}

describe('the runner_job_lines migration', () => {
  it('creates the table with its five columns, cascading with its job and its workspace', () => {
    const created = columns();
    expect(created).toContain('job_id uuid not null references public.runner_jobs (id) on delete cascade');
    expect(created).toContain('workspace_id uuid not null references public.workspaces (id) on delete cascade');
    expect(created).toContain('seq integer not null check (seq > 0)');
    expect(created).toContain('text text not null check (char_length(text) <= 600)');
    expect(created).toContain('at timestamptz not null default now()');
    expect(created).toContain('primary key (job_id, seq)');
  });

  it('keeps the 600 characters the contract allows a line', () => {
    expect(read('apps/galaxy/src/runners/runners.contract.ts')).toContain('const JOB_LINE_CHARS = 600;');
  });

  it('lets a member of the workspace read the lines, and only the service role write them', () => {
    expect(CODE).toContain('alter table public.runner_job_lines enable row level security;');
    expect(CODE).toContain('on public.runner_job_lines for select to authenticated using (workspace_id in (select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid())));');
    expect(CODE).toContain('revoke all on public.runner_job_lines from public, anon, authenticated, service_role;');
    expect(CODE).toContain('grant select on public.runner_job_lines to authenticated;');
    expect(CODE).toContain('grant select, insert, delete on public.runner_job_lines to service_role;');
    expect(CODE).not.toMatch(/grant [^;]*(insert|update|delete|all)[^;]* on public\.runner_job_lines to (authenticated|anon|public)/);
  });

  it('deletes the lines of the workspace\'s ended jobs beyond the most recent, by a function only the service role runs', () => {
    expect(CODE).toContain('create function public.runner_job_lines_retain(p_workspace uuid, p_keep integer) returns integer language plpgsql set search_path = \'\'');
    expect(CODE).toContain('where j.workspace_id = p_workspace and j.ended_at is not null order by j.ended_at desc, j.id desc offset p_keep');
    expect(CODE).toContain('revoke execute on function public.runner_job_lines_retain(uuid, integer) from public, anon, authenticated;');
    expect(CODE).toContain('grant execute on function public.runner_job_lines_retain(uuid, integer) to service_role;');
  });

  it('is proved by supabase/checks/runner_job_lines.sql: a member reads, a non-member reads none, nobody signed in inserts', () => {
    expect(CHECK).toContain('FAIL: a member did not read');
    expect(CHECK).toContain('FAIL: another workspace read');
    expect(CHECK).toContain('FAIL: a member wrote a line');
    expect(CHECK).toContain("select 'runner_job_lines: every check passed' as result;");
  });

  it('is named in the database\'s types, with the retention function', () => {
    expect(TYPES).toMatch(/runner_job_lines: \{\n\s+Row: \{\n\s+at: string\n\s+job_id: string\n\s+seq: number\n\s+text: string\n\s+workspace_id: string\n/);
    expect(TYPES).toContain('runner_job_lines_retain: {\n        Args: { p_keep: number; p_workspace: string }\n        Returns: number\n      }');
  });
});
