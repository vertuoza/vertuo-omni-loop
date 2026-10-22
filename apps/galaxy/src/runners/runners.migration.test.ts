// A job's live lines' migration (PRD 1904), and a runner's health's (PRD 2102), read as text: the tables
// and their columns, their keys and limits, their reading rule, their one writer and the retention
// function the repository calls. What the rules let through is the database's to prove
// (supabase/checks/runner_job_lines.sql, supabase/checks/runner_samples.sql); this pins that each is
// there, and that the database's types name what the repository writes and reads.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { PRS_MAX } from 'omni-loop/kit/lib/runner/log.ts';
import { STORED_OUTCOMES } from './runners.contract';

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

const HEALTH = read('supabase/migrations/20261211100000_runner_health.sql').replace(/--.*$/gm, '').replace(/\s+/g, ' ');
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

const TOKENS = read('supabase/migrations/20261212090000_runner_tokens.sql').replace(/--.*$/gm, '').replace(/\s+/g, ' ');

describe('the runner tokens migration (PRD 2102)', () => {
  it('adds the job\'s tokens, empty for a job whose runner never reported any, and changes no grant', () => {
    expect(TOKENS).toContain('alter table public.runner_jobs add column tokens jsonb;');
    expect(TOKENS).not.toMatch(/grant |revoke |policy /);
  });

  it('is proved by supabase/checks/runner_samples.sql: a member reads the tokens, no one else does, and only the service role writes them', () => {
    for (const fail of ['FAIL: a member did not read the job\'\'s tokens', 'FAIL: another workspace read a job\'\'s tokens', 'FAIL: a member wrote a job\'\'s tokens', 'FAIL: the route did not store a job\'\'s tokens']) {
      expect(HEALTH_CHECK).toContain(fail);
    }
  });

  it('is named in the database\'s types', () => {
    expect(TYPES).toMatch(/runner_jobs: \{\n\s+Row: \{[^}]*status: string\n\s+to_fleet: string \| null\n\s+to_runner: string \| null\n\s+tokens: Json \| null\n/);
  });
});

const RELEASED = read('supabase/migrations/20261214090000_runner_released.sql').replace(/--.*$/gm, '').replace(/\s+/g, ' ');

describe('the runner released-claims migration (PRD 2175)', () => {
  it('adds the job\'s released claims and why a release failed, both empty until a runner reports them, and changes no grant', () => {
    expect(RELEASED).toContain('alter table public.runner_jobs add column released integer[];');
    expect(RELEASED).toContain('alter table public.runner_jobs add column release_error text;');
    expect(RELEASED).not.toMatch(/grant |revoke |policy |not null|default /);
  });

  it('keeps what the contract lets a report carry: 50 numbers, 200 characters', () => {
    const contract = read('apps/galaxy/src/runners/runners.contract.ts');
    expect(contract).toContain('const RELEASED_MAX = 50;');
    expect(contract).toContain('const RELEASE_ERROR_CHARS = 200;');
  });

  it('is named in the database\'s types', () => {
    expect(TYPES).toMatch(/runner_jobs: \{\n\s+Row: \{[^}]*reason: string \| null\n\s+release_error: string \| null\n\s+released: number\[\] \| null\n/);
  });
});

const OUTCOME = read('supabase/migrations/20261217090000_runner_outcome.sql').replace(/--.*$/gm, '').replace(/\s+/g, ' ');

describe('the runner outcome migration (PRD 2223)', () => {
  it('adds the job\'s outcome, empty until a runner reports one and limited to answers, held and ready, and changes no grant', () => {
    expect(OUTCOME).toContain('alter table public.runner_jobs add column outcome text');
    expect(OUTCOME).toContain("check (outcome in ('answers', 'held', 'ready'))");
    expect(OUTCOME).not.toMatch(/grant |revoke |policy |not null|default /);
  });

  it('allows the words the contract lets a report carry', () => {
    expect(read('apps/galaxy/src/runners/runners.contract.ts')).toContain("const REPORTED_OUTCOMES = ['answers', 'held', 'ready', 'stopped', ...BUG_FIX_OUTCOMES] as const;");
  });

  it('is named in the database\'s types', () => {
    expect(TYPES).toMatch(/runner_jobs: \{\n\s+Row: \{[^}]*log_tail: string\n\s+notify_url: string \| null\n\s+outcome: string \| null\n\s+pr_url: string \| null\n/);
  });
});

const KEY_CONTROL = read('supabase/migrations/20261228090000_api_key_job_control.sql').replace(/--.*$/gm, '').replace(/\s+/g, ' ');

// PRD 2425: what the server stores of a bug fix's report is what the migration's columns and check hold.
describe('the API key job control migration (PRD 2425)', () => {
  it('lets the outcome column hold each word the server stores, and no other', () => {
    const allowed = /check \(outcome in \(([^)]*)\)\)/.exec(KEY_CONTROL)?.[1]?.split(',').map((word) => word.trim().replaceAll("'", '')).sort();
    expect(allowed).toEqual([...STORED_OUTCOMES].sort());
  });

  it('adds the columns the server stores and a key reads, and keeps what the contract lets a report carry in them: 50 pull requests, a link', () => {
    for (const column of ['fixed_by text', 'prs jsonb not null default', 'acting_for text', 'cancelled_by_key uuid references public.agent_tokens (id)', 'cancelled_for text']) {
      expect(KEY_CONTROL, column).toContain(`add column ${column}`);
    }
    expect(KEY_CONTROL).toContain('jsonb_array_length(prs) <= 50');
    expect(PRS_MAX).toBe(50);
  });

  it('is named in the database\'s types, so the repository reads the columns it selects', () => {
    for (const column of ['acting_for: string | null', 'cancelled_by_key: string | null', 'cancelled_for: string | null', 'fixed_by: string | null', 'prs: Json']) {
      expect(TYPES, column).toContain(column);
    }
  });
});

const CONTINUES = read('supabase/migrations/20261220090000_fix_when_answered.sql').replace(/--.*$/gm, '').replace(/\s+/g, ' ');

describe('the fix-when-answered migration (PRD 2270)', () => {
  it('adds the job a job continues, empty for any other job, and holds each job continued once', () => {
    expect(CONTINUES).toContain('alter table public.runner_jobs add column continues uuid references public.runner_jobs (id) on delete set null;');
    expect(CONTINUES).toContain('create unique index runner_jobs_continues_key on public.runner_jobs (continues) where continues is not null;');
  });

  it('adds the repository\'s switch, on by default', () => {
    expect(CONTINUES).toContain('alter table public.repositories add column fix_when_answered boolean not null default true;');
  });

  it('lets only the workspace\'s owner switch it, as Phase 0 on the server, and changes no grant on the tables', () => {
    expect(CONTINUES).toContain('create function public.set_repository_fix_when_answered(p_workspace uuid, p_full_name text, p_on boolean) returns public.repositories language plpgsql security definer set search_path = \'\'');
    expect(CONTINUES).toContain('perform public.repository_owner_only(p_workspace);');
    expect(CONTINUES).toContain('revoke execute on function public.set_repository_fix_when_answered(uuid, text, boolean) from public, anon;');
    expect(CONTINUES).toContain('grant execute on function public.set_repository_fix_when_answered(uuid, text, boolean) to authenticated;');
    expect(CONTINUES).not.toMatch(/(grant|revoke) [^;]* on public\.(runner_jobs|repositories)/);
  });

  it('is named in the database\'s types: both columns and the switch\'s function', () => {
    expect(TYPES).toMatch(/runner_jobs: \{\n\s+Row: \{\n\s+acting_for: string \| null\n\s+cancel_requested: boolean\n\s+cancelled_by_key: string \| null\n\s+cancelled_for: string \| null\n\s+claimed_at: string \| null\n\s+continues: string \| null\n/);
    expect(TYPES).toContain('foreignKeyName: "runner_jobs_continues_fkey"');
    expect(TYPES).toMatch(/repositories: \{\n\s+Row: \{[^}]*collected_until: string \| null\n\s+fix_when_answered: boolean\n/);
    expect(TYPES).toContain('set_repository_fix_when_answered: {\n        Args: { p_full_name: string; p_on: boolean; p_workspace: string }');
  });
});
