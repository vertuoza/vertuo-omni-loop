// A job's live lines' migration (PRD 1904), and a runner's health's (PRD 2102), read as text: the tables
// and their columns, their keys and limits, their reading rule, their one writer and the retention
// function the repository calls. What the rules let through is the database's to prove
// (supabase/checks/runner_job_lines.sql, supabase/checks/runner_samples.sql); this pins that each is
// there, and that the database's types name what the repository writes and reads.
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

const HEALTH = read('supabase/migrations/20261211090000_runner_health.sql').replace(/--.*$/gm, '').replace(/\s+/g, ' ');
const HEALTH_CHECK = read('supabase/checks/runner_samples.sql');

describe('the runner health migration (PRD 2102)', () => {
  it('adds the runner\'s last health, empty for a runner that never sent one', () => {
    expect(HEALTH).toContain('alter table public.runners add column health jsonb;');
  });

  it('creates runner_samples with its figures, cascading with its runner and its workspace, keyed by runner and instant', () => {
    const created = /create table public\.runner_samples \((.*?)\);/.exec(HEALTH)?.[1] ?? '';
    expect(created).toContain('runner_id uuid not null references public.runners (id) on delete cascade');
    expect(created).toContain('workspace_id uuid not null references public.workspaces (id) on delete cascade');
    expect(created).toContain('at timestamptz not null default now()');
    expect(created).toContain('cpu real check (cpu between 0 and 100)');
    for (const column of ['mem_used', 'mem_total', 'disk_free', 'tokens_5h']) expect(created).toContain(`${column} bigint check (${column} >= 0)`);
    expect(created).toContain('primary key (runner_id, at)');
  });

  it('lets a member of the workspace read the samples, and only the service role write them', () => {
    expect(HEALTH).toContain('alter table public.runner_samples enable row level security;');
    expect(HEALTH).toContain('on public.runner_samples for select to authenticated using (workspace_id in (select m.workspace_id from public.workspace_members m where m.user_id = (select auth.uid())));');
    expect(HEALTH).toContain('revoke all on public.runner_samples from public, anon, authenticated, service_role;');
    expect(HEALTH).toContain('grant select on public.runner_samples to authenticated;');
    expect(HEALTH).toContain('grant select, insert, delete on public.runner_samples to service_role;');
    expect(HEALTH).not.toMatch(/grant [^;]*(insert|update|delete|all)[^;]* on public\.runner_samples to (authenticated|anon|public)/);
    // runners keeps its grants: members read it, health included, and only the service role writes it.
    expect(HEALTH).not.toMatch(/grant [^;]* on public\.runners/);
  });

  it('is proved by supabase/checks/runner_samples.sql, which the supabase workflow runs', () => {
    for (const fail of ['FAIL: a member did not read', 'FAIL: another workspace read the runner samples', 'FAIL: a member wrote a sample', 'FAIL: a member wrote a runner\'\'s health', 'FAIL: the trim deleted the wrong samples']) {
      expect(HEALTH_CHECK).toContain(fail);
    }
    expect(HEALTH_CHECK).toContain("select 'runner_samples: every check passed' as result;");
    expect(read('.github/workflows/supabase.yml')).toContain('-f supabase/checks/runner_samples.sql');
  });

  it('is named in the database\'s types', () => {
    expect(TYPES).toMatch(/runner_samples: \{\n\s+Row: \{\n\s+at: string\n\s+cpu: number \| null\n\s+disk_free: number \| null\n\s+mem_total: number \| null\n\s+mem_used: number \| null\n\s+runner_id: string\n\s+tokens_5h: number \| null\n\s+workspace_id: string\n/);
    expect(TYPES).toMatch(/runners: \{\n\s+Row: \{\n\s+created_at: string\n\s+fleet: string \| null\n\s+health: Json \| null\n/);
  });
});
