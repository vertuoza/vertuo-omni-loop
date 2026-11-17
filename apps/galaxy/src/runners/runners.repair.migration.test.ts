// A mission's repairs' migration (PRD 2980 s2), read as text, as runners.claim-resume.migration.test.ts reads PRD 2949's:
// the two tables and their budget, the four event kinds, the repair job's key, the claim that takes a repair first, and
// /omni:repair among the loop's own skills and the Engineer's. What the rows do is proven on a database by
// supabase/checks/mission_repairs.sql.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const FILE = '20270125140000_mission_repairs.sql';
const DIR = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url));
const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../../../${path}`, import.meta.url)), 'utf8');
const flat = (sql: string) => sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ');
const CODE = flat(read(`supabase/migrations/${FILE}`));
const BEFORE = flat(read('supabase/migrations/20270125130000_runner_claim_recovery_first.sql'));
const PM = flat(read('supabase/migrations/20270124150000_mission_pm.sql'));
const CHECKS = read('supabase/checks/mission_repairs.sql');
const WORKFLOW = read('.github/workflows/supabase.yml');
const TYPES = read('supabase/database.types.ts');

/** The body of `name()` in `code`, from its `create … function` to its closing `$$;`. */
function body(code: string, name: string): string {
  const match = new RegExp(`create (?:or replace )?function public\\.${name}\\(.*?\\$\\$(.*?)\\$\\$;`).exec(code);
  if (!match?.[1]) throw new Error(`no ${name}()`);
  return match[1];
}

/** The columns of a table the migration creates, from its `create table` to its closing `);`. */
function table(name: string): string {
  const match = new RegExp(`create table if not exists public\\.${name} \\((.*?)\\);`).exec(CODE);
  if (!match?.[1]) throw new Error(`no table ${name}`);
  return match[1];
}

/** The fixed skills a body of set_repository_runner_skill() holds, name by name. */
const fixedOf = (fn: string): string[] =>
  (/fixed text\[\] := array\[([^\]]*)\]/.exec(fn)?.[1] ?? '').split(',').map((name) => name.trim().replace(/^'|'$/g, ''));

/** The roles virtual_hero_roles() of `code` gives, as JSON. */
const rolesOf = (code: string): { role: string; skills: string[] }[] =>
  JSON.parse(/\$json\$(.*?)\$json\$/.exec(body(code, 'virtual_hero_roles'))?.[1] ?? 'null') as { role: string; skills: string[] }[];

describe('the migration', () => {
  it('runs after the claim that takes recovery first (PRD 2949), whatever migrations came after it', () => {
    const files = readdirSync(DIR).filter((file) => file.endsWith('.sql')).sort();
    expect(files).toContain(FILE);
    expect(files.indexOf(FILE)).toBeGreaterThan(files.indexOf('20270125130000_runner_claim_recovery_first.sql'));
  });
});

describe('mission_repairs, one row per repair a mission sent', () => {
  const columns = table('mission_repairs');

  it('names its mission, its PRD, the cause\'s fingerprint, its round and its number, 1 to 3', () => {
    expect(columns).toContain('mission_id uuid not null references public.missions (id) on delete cascade');
    expect(columns).toContain('prd integer not null check (prd > 0)');
    expect(columns).toContain("fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$')");
    expect(columns).toContain('round integer not null default 1 check (round >= 1)');
    expect(columns).toContain('number smallint not null default 1 check (number between 1 and 3)');
  });

  it('keeps the failed job, its own job, the retro, the fix pull request and the outcome', () => {
    expect(columns).toContain('failed_job_id uuid not null');
    expect(columns).toContain('job_id uuid');
    expect(columns).toContain("retro jsonb check (retro is null or (jsonb_typeof(retro) = 'object' and octet_length(retro::text) <= 8192))");
    expect(columns).toContain("fix_pr text check (fix_pr is null or fix_pr ~ '^https://github\\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+/pull/[1-9][0-9]*$')");
    expect(columns).toContain("outcome text check (outcome is null or outcome in ('fixed', 'not fixed', 'stopped', 'lost'))");
    expect(columns).toContain('constraint mission_repairs_ended check ((outcome is null) = (ended_at is null))');
  });

  it('holds one row per number of a cause in a round, a lost repair apart', () => {
    expect(CODE).toContain("create unique index if not exists mission_repairs_number_key on public.mission_repairs (mission_id, round, fingerprint, number) where outcome is distinct from 'lost';");
  });

  it('refuses a 4th repair of a cause in a round and a 10th in a mission, numbering each, a lost one spending nothing', () => {
    const fn = body(CODE, 'mission_repairs_budget');
    expect(fn).toContain('perform 1 from public.missions m where m.id = new.mission_id for update;');
    expect(fn).toContain("select count(*) into spent from public.mission_repairs r where r.mission_id = new.mission_id and r.outcome is distinct from 'lost';");
    expect(fn).toContain("if spent >= 9 then raise exception 'A mission runs 9 repairs at most: this one has run its 9.' using errcode = '23514', hint = 'mission';");
    expect(fn).toContain("select count(*) into cause from public.mission_repairs r where r.mission_id = new.mission_id and r.round = new.round and r.fingerprint = new.fingerprint and r.outcome is distinct from 'lost';");
    expect(fn).toContain("if cause >= 3 then raise exception 'A cause is repaired 3 times at most in a round: % was.', left(new.fingerprint, 8) using errcode = '23514', hint = 'fingerprint';");
    expect(fn).toContain('new.number := cause + 1;');
    expect(CODE).toContain('create trigger mission_repairs_budget before insert on public.mission_repairs for each row execute function public.mission_repairs_budget();');
  });

  it('never changes what a repair was, and nothing of one that ended', () => {
    const fn = body(CODE, 'mission_repairs_keep');
    expect(fn).toContain('if (new.id, new.mission_id, new.prd, new.fingerprint, new.round, new.number, new.failed_job_id, new.started_at) is distinct from (old.id, old.mission_id, old.prd, old.fingerprint, old.round, old.number, old.failed_job_id, old.started_at) then');
    expect(fn).toContain('if old.outcome is not null then');
    expect(CODE).toContain('create trigger mission_repairs_keep before update on public.mission_repairs for each row execute function public.mission_repairs_keep();');
  });

  it('is read by the mission\'s workspace\'s members, and written by the service role alone, never deleted but with its mission', () => {
    expect(CODE).toContain('alter table public.mission_repairs enable row level security;');
    expect(CODE).toContain('on public.mission_repairs for select to authenticated using (mission_id in (select m.id from public.missions m where m.workspace_id in (select public.my_workspaces())));');
    expect(CODE).toContain('revoke all on public.mission_repairs from public, anon, authenticated, service_role;');
    expect(CODE).toContain('grant select on public.mission_repairs to authenticated;');
    expect(CODE).toContain('grant select, insert, update on public.mission_repairs to service_role;');
    expect(CODE).not.toMatch(/grant [^;]*delete[^;]* on public\.mission_repairs/);
  });
});

describe('omni_bug_reports, one Omni Loop issue per fingerprint', () => {
  const columns = table('omni_bug_reports');

  it('keys a report by its fingerprint, with the repository and issue it was filed as and how often it was met', () => {
    expect(columns).toContain("fingerprint text primary key check (fingerprint ~ '^[0-9a-f]{64}$')");
    expect(columns).toContain("repo text not null check (repo ~ '^[a-z0-9_.-]+/[a-z0-9_.-]+$')");
    expect(columns).toContain('issue integer not null check (issue > 0)');
    expect(columns).toContain('count integer not null default 1 check (count >= 1)');
  });

  it('counts a repeat in one statement, for the service role alone', () => {
    expect(body(CODE, 'omni_bug_report_seen')).toContain('update public.omni_bug_reports b set count = b.count + 1, updated_at = now() where b.fingerprint = p_fingerprint returning b.*;');
    expect(CODE).toContain('revoke execute on function public.omni_bug_report_seen(text) from public, anon, authenticated;');
    expect(CODE).toContain('grant execute on function public.omni_bug_report_seen(text) to service_role;');
  });

  it('holds no workspace, and nobody signed in reads or writes it', () => {
    expect(columns).not.toContain('workspace');
    expect(CODE).toContain('alter table public.omni_bug_reports enable row level security;');
    expect(CODE).toContain('revoke all on public.omni_bug_reports from public, anon, authenticated, service_role;');
    expect(CODE).toContain('grant select, insert, update on public.omni_bug_reports to service_role;');
    expect(CODE).not.toMatch(/create policy [^;]* on public\.omni_bug_reports/);
  });
});

describe('the four event kinds of a repair', () => {
  const kinds = (code: string) => /add constraint mission_events_kind_check check \(kind in \(([^)]*)\)\)/.exec(code)?.[1]?.split(',').map((kind) => kind.trim().replace(/^'|'$/g, '')) ?? [];

  it('adds repair-started, retro, repair-ended and bug-reported to the kinds the PM\'s migration left', () => {
    expect(kinds(CODE)).toEqual([...kinds(PM), 'repair-started', 'retro', 'repair-ended', 'bug-reported']);
  });
});

describe('a repair job\'s key', () => {
  const shape = (code: string) => /add constraint runner_jobs_mission_key_shape check \( mission_key is null or mission_key ~ '([^']*)'\)/.exec(code)?.[1] ?? '';

  it('takes mission:<id>:prd:<n>:repair:<k>, beside every key it took before', () => {
    expect(shape(CODE)).toBe(shape(PM).replace('|approve:[1-9][0-9]*)', '|approve:[1-9][0-9]*|repair:[1-9][0-9]*)'));
    const key = new RegExp(shape(CODE));
    const mission = 'mission:0b6c1a8e-2f4d-4c3b-9a1e-7d5f6e4c3b2a';
    for (const ok of [`${mission}:prd:2980:repair:1`, `${mission}:prd:2980:repair:12`, `${mission}:prd:7:run:2:review:1`, `${mission}:pm:3`]) expect(key.test(ok), ok).toBe(true);
    for (const no of [`${mission}:prd:2980:repair:0`, `${mission}:prd:2980:repair`, `${mission}:repair:1`, `${mission}:prd:2980:run:1:repair:1`]) expect(key.test(no), no).toBe(false);
  });
});

describe('runner_claim(), a repair first in line', () => {
  const claim = (code: string) => body(code, 'runner_claim');
  const FIRST = 'order by q.resumes is null, (with recursive chain';
  const NOW = "order by q.resumes is null and (q.mission_key is null or q.mission_key !~ ':prd:[1-9][0-9]*:repair:[1-9][0-9]*$'), coalesce((with recursive chain";

  it('changes only the order: a repair is taken with the resumes, before any fresh job', () => {
    const fn = claim(CODE);
    expect(fn).toContain(NOW);
    const back = fn.replace(NOW, FIRST).replace('select min(chain.queued_at) from chain), q.queued_at), q.queued_at, q.id', 'select min(chain.queued_at) from chain), q.queued_at, q.id');
    expect(back).toBe(claim(BEFORE));
  });

  it('keeps its signature and stays the service role\'s alone', () => {
    expect(CODE).toContain('create or replace function public.runner_claim(p_runner uuid, p_registered_at timestamptz default null) returns setof public.runner_jobs');
    expect(CODE).toContain('revoke execute on function public.runner_claim(uuid, timestamptz) from public, anon, authenticated;');
    expect(CODE).toContain('grant execute on function public.runner_claim(uuid, timestamptz) to service_role;');
  });
});

describe('/omni:repair, the loop\'s own skill and the Engineer\'s', () => {
  it('joins the fixed skills a repository\'s own skill may not be named, last, and changes nothing else of the function', () => {
    const fn = body(CODE, 'set_repository_runner_skill');
    expect(fixedOf(fn)).toEqual([...fixedOf(body(PM, 'set_repository_runner_skill')), 'repair']);
    const list = /fixed text\[\] := array\[[^\]]*\]/;
    expect(fn.replace(list, 'LIST')).toBe(body(PM, 'set_repository_runner_skill').replace(list, 'LIST'));
    expect(CODE).toContain('revoke execute on function public.set_repository_runner_skill(uuid, text, text, boolean) from public, anon;');
    expect(CODE).toContain('grant execute on function public.set_repository_runner_skill(uuid, text, text, boolean) to authenticated;');
  });

  it('joins the Engineer\'s skills, last, and changes no other role', () => {
    const now = rolesOf(CODE);
    const before = rolesOf(PM);
    expect(now.find((r) => r.role === 'engineer')?.skills).toEqual([...(before.find((r) => r.role === 'engineer')?.skills ?? []), 'repair']);
    expect(now.filter((r) => r.role !== 'engineer')).toEqual(before.filter((r) => r.role !== 'engineer'));
  });

  it('gives an Engineer already made the skill only while its skills are still the default it was made with', () => {
    const engineer = before();
    expect(CODE).toContain(`and h.skills = array[${engineer.map((skill) => `'${skill}'`).join(', ')}]`);
    expect(CODE).toMatch(/update public\.virtual_heroes h set skills = array\(select jsonb_array_elements_text\(d\.value -> 'skills'\)\), updated_at = now\(\) from jsonb_array_elements\(public\.virtual_hero_roles\(\)\) as d \(value\) where d\.value ->> 'role' = 'engineer' and h\.role = 'engineer'/);
  });
});

/** The Engineer's skills before this migration. */
function before(): string[] {
  return rolesOf(PM).find((r) => r.role === 'engineer')?.skills ?? [];
}

describe('the proof on a database', () => {
  it('is its own step of the supabase workflow', () => {
    expect(WORKFLOW).toContain('-f supabase/checks/mission_repairs.sql');
    expect(CHECKS).toContain('begin;');
    expect(CHECKS.trimEnd().endsWith('rollback;')).toBe(true);
  });
});

describe('the database\'s types', () => {
  it('name the two tables and the count of a repeat', () => {
    expect(TYPES).toContain('mission_repairs: {\n        Row: {');
    expect(TYPES).toContain('omni_bug_reports: {\n        Row: {');
    expect(TYPES).toContain('omni_bug_report_seen: {');
  });
});
