// The main watch's migration (PRD 2410 s1), read as text, as runners.skills.migration.test.ts reads the
// runners': the three tables as the before/after page draws them, the replay key of a break, the
// evidence a finding cannot do without, the one-time decision and its event, who reads and who writes,
// the rollback its header names, and the database's types that carry them. The rows themselves are
// proven by supabase/checks/main_watch.sql, which the supabase workflow runs as its own step.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = (path: string) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url));
const read = (path: string) => readFileSync(root(path), 'utf8');
const NAME = '20261230090000_main_watch.sql';
const MIGRATION = read(`supabase/migrations/${NAME}`);
const CODE = MIGRATION.replace(/--.*$/gm, '').replace(/\s+/g, ' ');
const TYPES = read('supabase/database.types.ts');
const FLAT_TYPES = TYPES.replace(/\s+/g, ' ');
const WORKFLOW = read('.github/workflows/supabase.yml');

/** The columns of a table the migration creates, from its `create table` to its closing `);`. */
function table(name: string): string {
  const match = new RegExp(`create table public\\.${name} \\((.*?)\\);`).exec(CODE);
  if (!match?.[1]) throw new Error(`no table ${name}`);
  return match[1];
}

/** The body of a function the migration creates, from its `create function` to its closing `$$;`. */
function body(name: string): string {
  const match = new RegExp(`create function public\\.${name}\\(.*?\\$\\$(.*?)\\$\\$;`).exec(CODE);
  if (!match?.[1]) throw new Error(`no function ${name}`);
  return match[1];
}

/** The generated Row type of a table, flattened. */
function rowType(name: string): string {
  return new RegExp(`${name}: \\{ Row: \\{(.*?)\\} Insert:`).exec(FLAT_TYPES)?.[1] ?? '';
}

describe('the migration', () => {
  // A later PRD's migration may follow it: scripts/migration-order.ts keeps each new one the newest.
  it('is dated after every migration main held when it was written, so supabase db push applies it', () => {
    const versions = readdirSync(root('supabase/migrations')).filter((file) => file.endsWith('.sql')).sort();
    expect(versions.indexOf(NAME)).toBeGreaterThan(versions.indexOf('20261229090000_api_key_job_control.sql'));
  });

  it('names its rollback in its header: a follow-up migration drops the tables, which nothing else reads', () => {
    expect(MIGRATION).toMatch(/^-- Rollback: a follow-up migration drops .*rewind_finding_approve.*rewind_finding_reject.*prd_main_watch.*nothing else reads/ms);
  });

  it('writes no ledger event: a break feeds nothing in the game (N-PRODUCT-16)', () => {
    expect(CODE).not.toMatch(/galaxy_events|ledger/);
  });
});

describe('prd_main_watch', () => {
  const cols = table('prd_main_watch');

  it('holds one watch per PRD (its repository and number) and lane, each repository it merged into', () => {
    expect(cols).toContain('workspace_id uuid not null references public.workspaces on delete cascade');
    expect(cols).toContain("repository text not null check (repository = lower(repository) and repository ~ '^[^/\\s]+/[^/\\s]+$')");
    expect(cols).toContain('prd integer not null check (prd > 0)');
    expect(cols).toContain("lane text not null check (lane = lower(lane) and lane ~ '^[^/\\s]+/[^/\\s]+$')");
    expect(cols).toContain('primary key (workspace_id, repository, prd, lane)');
  });

  it('keeps the merge, its seven days and the status, watching until clean or broke', () => {
    expect(cols).toContain("merge_sha text not null check (merge_sha ~ '^[0-9a-f]{40}$')");
    expect(cols).toContain('merged_at timestamptz not null');
    expect(cols).toContain('watch_until timestamptz not null');
    expect(cols).toContain("status text not null default 'watching' check (status in ('watching', 'clean', 'broke'))");
    expect(cols).toContain('check (watch_until > merged_at)');
  });

  it('names each signal it could not read, so a missing read never reads clean', () => {
    expect(cols).toContain("unread text[] not null default '{}'");
    expect(cols).toContain("check (status <> 'clean' or cardinality(unread) = 0)");
  });
});

describe('prd_main_breaks', () => {
  const cols = table('prd_main_breaks');

  it('belongs to its watch, and goes with it', () => {
    expect(cols).toContain('foreign key (workspace_id, repository, prd, lane) references public.prd_main_watch (workspace_id, repository, prd, lane) on delete cascade');
  });

  it('is one of three kinds, keyed by its source, so a replayed signal adds no row', () => {
    expect(cols).toContain("kind text not null check (kind in ('ci-red', 'revert', 'regression'))");
    expect(cols).toContain('source text not null check (char_length(source) between 1 and 200)');
    expect(cols).toContain('primary key (workspace_id, repository, prd, lane, kind, source)');
  });

  it('links what broke, names it, and keeps the parent commit\'s result beside a CI red only', () => {
    expect(cols).toContain("url text not null check (url ~ '^https://')");
    expect(cols).toContain('title text not null check (char_length(title) between 1 and 300)');
    expect(cols).toContain("parent text check (parent in ('green', 'red', 'unknown'))");
    expect(cols).toContain("check (kind = 'ci-red' or parent is null)");
    expect(cols).toContain('at timestamptz not null');
  });
});

describe('rewind_findings', () => {
  const cols = table('rewind_findings');

  it('explains a PRD, whatever lane broke, and goes with its workspace', () => {
    expect(cols).toContain('id uuid primary key default gen_random_uuid()');
    expect(cols).toContain('workspace_id uuid not null references public.workspaces on delete cascade');
    expect(cols).toContain("repository text not null check (repository = lower(repository) and repository ~ '^[^/\\s]+/[^/\\s]+$')");
    expect(cols).toContain('prd integer not null check (prd > 0)');
    expect(cols).toContain('proposed_at timestamptz not null default now()');
  });

  it('names one of the eight checks and one of the three origins', () => {
    expect(cols).toContain("check_name text not null check (check_name in ('main', 'reviews', 'ci', 'bodies', 'waves', 'plan', 'spec', 'knowledge'))");
    expect(cols).toContain("origin text not null check (origin in ('repository', 'omni-setup', 'knowledge'))");
  });

  it('is refused without an evidence link', () => {
    expect(cols).toContain('evidence jsonb not null check (public.rewind_evidence_ok(evidence))');
    const ok = body('rewind_evidence_ok');
    expect(ok).toContain("jsonb_typeof(p_evidence) = 'array'");
    expect(ok).toContain('jsonb_array_length(p_evidence) between 1 and 20');
    expect(ok).toContain("jsonb_typeof(link) = 'string' and link #>> '{}' ~ '^https://[^\\s]+$' and char_length(link #>> '{}') <= 500");
    expect(CODE).toContain('revoke execute on function public.rewind_evidence_ok(jsonb) from public, anon, authenticated;');
  });

  it('says what happened and its fix', () => {
    expect(cols).toContain('happened text not null check (char_length(happened) between 1 and 4000)');
    expect(cols).toContain('fix text not null check (char_length(fix) between 1 and 4000)');
  });

  it('is proposed, then approved or rejected once, with who and when, a reason only on a rejection', () => {
    expect(cols).toContain("state text not null default 'proposed' check (state in ('proposed', 'approved', 'rejected'))");
    expect(cols).toContain('reason text check (char_length(reason) between 1 and 500)');
    expect(cols).toContain('decided_by uuid references auth.users on delete set null');
    expect(cols).toContain('decided_at timestamptz');
    expect(cols).toContain("check ((state = 'proposed') = (decided_at is null))");
    expect(cols).toContain("check (state = 'rejected' or reason is null)");
  });

  it('is never proposed twice: the same check, origin and evidence of a PRD is one finding', () => {
    expect(CODE).toContain('create unique index rewind_findings_once on public.rewind_findings (workspace_id, repository, prd, check_name, origin, md5(evidence::text));');
  });
});

describe('rewind_finding_events', () => {
  const cols = table('rewind_finding_events');

  it('logs each decision of a finding, with who and when, and goes with it', () => {
    expect(cols).toContain('id bigint generated always as identity primary key');
    expect(cols).toContain('finding_id uuid not null references public.rewind_findings on delete cascade');
    expect(cols).toContain("action text not null check (action in ('approved', 'rejected'))");
    expect(cols).toContain('changed_by uuid references auth.users on delete set null');
    expect(cols).toContain('changed_at timestamptz not null default now()');
  });
});

describe('rewind_finding_approve() and rewind_finding_reject()', () => {
  it('run as definers, with an empty search path, and answer the decided finding', () => {
    expect(CODE).toContain("create function public.rewind_finding_approve(p_workspace uuid, p_finding uuid) returns public.rewind_findings language plpgsql security definer set search_path = ''");
    expect(CODE).toContain("create function public.rewind_finding_reject(p_workspace uuid, p_finding uuid, p_reason text default null) returns public.rewind_findings language plpgsql security definer set search_path = ''");
  });

  it('decide a proposed finding of the workspace, locked, once: a non-member and a second decision get 42501', () => {
    const open = body('rewind_finding_open');
    expect(open).toContain('if (select auth.uid()) is null or p_workspace is null or not public.is_member(p_workspace) then');
    expect(open).toContain("raise exception 'Only a member of the workspace decides its rewind findings.' using errcode = '42501';");
    expect(open).toContain('where f.id = p_finding and f.workspace_id = p_workspace for update;');
    expect(open).toContain("raise exception 'Finding: no such finding in this workspace.' using errcode = 'P0002', hint = 'finding';");
    expect(open).toContain("if found_one.state <> 'proposed' then raise exception 'Finding: already %, and a decision is never rewritten.', found_one.state using errcode = '42501', hint = 'finding';");
  });

  it('record who decided and when, and append the decision\'s event in the same call', () => {
    const approve = body('rewind_finding_approve');
    expect(approve).toContain("set state = 'approved', decided_by = (select auth.uid()), decided_at = now()");
    expect(approve).toContain("insert into public.rewind_finding_events (workspace_id, finding_id, action, reason, changed_by) values (p_workspace, decided.id, 'approved', null, (select auth.uid()));");
    const reject = body('rewind_finding_reject');
    expect(reject).toContain("set state = 'rejected', reason = why, decided_by = (select auth.uid()), decided_at = now()");
    expect(reject).toContain("insert into public.rewind_finding_events (workspace_id, finding_id, action, reason, changed_by) values (p_workspace, decided.id, 'rejected', why, (select auth.uid()));");
  });

  it('take an optional reason on one line, 500 characters at most, else 22023 naming it', () => {
    const reject = body('rewind_finding_reject');
    expect(reject).toContain("why text := nullif(btrim(coalesce(p_reason, '')), '');");
    expect(reject).toContain("if why is not null and (char_length(why) > 500 or why ~ '[\\n\\r]') then raise exception 'Reason: one line, 500 characters at most.' using errcode = '22023', hint = 'reason';");
  });

  it('are run by a signed-in person only', () => {
    for (const fn of ['rewind_finding_approve(uuid, uuid)', 'rewind_finding_reject(uuid, uuid, text)']) {
      expect(CODE).toContain(`revoke execute on function public.${fn} from public, anon, service_role;`);
      expect(CODE).toContain(`grant execute on function public.${fn} to authenticated;`);
    }
    expect(CODE).toContain('revoke execute on function public.rewind_finding_open(uuid, uuid) from public, anon, authenticated, service_role;');
  });
});

describe('who reads and who writes', () => {
  const TABLES = ['prd_main_watch', 'prd_main_breaks', 'rewind_findings', 'rewind_finding_events'];

  it('lets a member read their workspace\'s rows, through my_workspaces() once per statement', () => {
    for (const name of TABLES) {
      expect(CODE).toContain(`alter table public.${name} enable row level security;`);
      expect(CODE).toMatch(new RegExp(`on public\\.${name} for select to authenticated using \\(workspace_id in \\(select public\\.my_workspaces\\(\\)\\)\\);`));
    }
  });

  it('lets nobody signed in write a table directly', () => {
    for (const name of TABLES) {
      expect(CODE).toContain(`revoke all on public.${name} from public, anon, authenticated, service_role;`);
      expect(CODE).toContain(`grant select on public.${name} to authenticated;`);
      expect(CODE).not.toMatch(new RegExp(`grant [^;]*(insert|update|delete|all)[^;]* on public\\.${name} to [^;]*authenticated`));
      expect(CODE).not.toMatch(new RegExp(`create policy [^;]* on public\\.${name} for (insert|update|delete|all)`));
    }
  });

  it('lets the service role write the watch and its breaks, and only insert a finding, never decide one', () => {
    expect(CODE).toContain('grant select, insert, update on public.prd_main_watch to service_role;');
    expect(CODE).toContain('grant select, insert on public.prd_main_breaks to service_role;');
    expect(CODE).toContain('grant select on public.rewind_findings to service_role;');
    expect(CODE).toContain('grant insert (workspace_id, repository, prd, check_name, origin, happened, evidence, fix) on public.rewind_findings to service_role;');
    expect(CODE).not.toMatch(/grant [^;]*update[^;]* on public\.rewind_findings/);
    expect(CODE).toContain('grant select on public.rewind_finding_events to service_role;');
  });
});

describe('the database\'s types', () => {
  it('name the four tables', () => {
    expect(rowType('prd_main_watch')).toBe(' lane: string merge_sha: string merged_at: string prd: number repository: string status: string unread: string[] watch_until: string workspace_id: string ');
    expect(rowType('prd_main_breaks')).toBe(' at: string kind: string lane: string parent: string | null prd: number repository: string source: string title: string url: string workspace_id: string ');
    // The three outcome columns are PRD 2498's (20270101090000_rewind_outcome.sql, rewind.outcome.migration.test.ts).
    expect(rowType('rewind_findings')).toBe(' check_name: string decided_at: string | null decided_by: string | null evidence: Json fix: string happened: string id: string origin: string outcome: string | null outcome_note: string | null outcome_pr: number | null prd: number proposed_at: string reason: string | null repository: string state: string workspace_id: string ');
    expect(rowType('rewind_finding_events')).toContain('action: string changed_at: string changed_by: string | null finding_id: string id: number reason: string | null workspace_id: string');
  });

  it('name the two decisions', () => {
    expect(FLAT_TYPES).toContain('rewind_finding_approve: { Args: { p_finding: string; p_workspace: string }');
    expect(FLAT_TYPES).toContain('rewind_finding_reject: { Args: { p_finding: string; p_reason?: string; p_workspace: string }');
  });
});

describe('the check', () => {
  it('is its own step of the supabase workflow', () => {
    expect(WORKFLOW).toContain("run: psql 'postgresql://postgres:postgres@127.0.0.1:54322/postgres' -v ON_ERROR_STOP=1 -f supabase/checks/main_watch.sql");
  });

  it('proves the app may queue the rewind as it queues retro-apply', () => {
    const check = read('supabase/checks/main_watch.sql');
    expect(check).toContain("'/omni:rewind 2410'");
    expect(check).toContain("sent_by_app");
  });
});
