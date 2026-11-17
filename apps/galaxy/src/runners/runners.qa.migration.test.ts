// QA's turn's migration (PRD 3001 s2), read as text, as runners.repair.migration.test.ts reads PRD 2980's: a job's tokens
// checked as a round's are, the `checked` event kind, the QA pair's job keys, /omni:qa among the loop's own skills, and QA's
// four skills and limits in virtual_hero_roles(). What the rows do is proven on a database by supabase/checks/qa_turn.sql.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { roleOf } from 'omni-loop/kit/lib/virtual-fleet/roles.ts';

const FILE = '20270125160000_qa_turn.sql';
const DIR = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url));
const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../../../${path}`, import.meta.url)), 'utf8');
const flat = (sql: string) => sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ');
const CODE = flat(read(`supabase/migrations/${FILE}`));
const REPAIRS = flat(read('supabase/migrations/20270125140000_mission_repairs.sql'));
const CHECKS = read('supabase/checks/qa_turn.sql');
const WORKFLOW = read('.github/workflows/supabase.yml');
const TYPES = read('supabase/database.types.ts');

type Role = { role: string; skills: string[]; limits: string[] };

/** The body of `name()` in `code`, from its `create … function` to its closing `$$;`. */
function body(code: string, name: string): string {
  const match = new RegExp(`create (?:or replace )?function public\\.${name}\\(.*?\\$\\$(.*?)\\$\\$;`).exec(code);
  if (!match?.[1]) throw new Error(`no ${name}()`);
  return match[1];
}

/** The fixed skills a body of set_repository_runner_skill() holds, name by name. */
const fixedOf = (fn: string): string[] =>
  (/fixed text\[\] := array\[([^\]]*)\]/.exec(fn)?.[1] ?? '').split(',').map((name) => name.trim().replace(/^'|'$/g, ''));

/** The roles virtual_hero_roles() of `code` gives, as JSON. */
const rolesOf = (code: string): Role[] => JSON.parse(/\$json\$(.*?)\$json\$/.exec(body(code, 'virtual_hero_roles'))?.[1] ?? 'null') as Role[];

const quoted = (list: readonly string[]) => `array[${list.map((item) => `'${item.replace(/'/g, "''")}'`).join(', ')}]`;

describe('the migration', () => {
  it('runs after a mission\'s repairs (PRD 2980), whatever migrations came after it', () => {
    const files = readdirSync(DIR).filter((file) => file.endsWith('.sql')).sort();
    expect(files).toContain(FILE);
    expect(files.indexOf(FILE)).toBeGreaterThan(files.indexOf('20270125140000_mission_repairs.sql'));
  });
});

describe('runner_jobs.tokens, a job\'s tokens (AC-8)', () => {
  it('takes only the four counts a round\'s tokens take, or none', () => {
    expect(CODE).toContain('alter table public.runner_jobs drop constraint if exists runner_jobs_tokens_shape;');
    expect(CODE).toContain('alter table public.runner_jobs add constraint runner_jobs_tokens_shape check (tokens is null or public.ask_tokens_valid(tokens));');
  });

  it('adds no column: the column of PRD 2102 is kept, nullable', () => {
    expect(CODE).not.toMatch(/add column/);
    expect(CODE).not.toMatch(/alter column tokens/);
  });
});

describe('the `checked` event kind', () => {
  const kinds = (code: string) => /add constraint mission_events_kind_check check \(kind in \(([^)]*)\)\)/.exec(code)?.[1]?.split(',').map((kind) => kind.trim().replace(/^'|'$/g, '')) ?? [];

  it('adds checked, QA\'s verdict, to the kinds a mission\'s repairs left', () => {
    expect(kinds(CODE)).toEqual([...kinds(REPAIRS), 'checked']);
  });

  it('leaves the roles an event takes as they are: qa is one already', () => {
    expect(CODE).not.toContain('mission_events_role_check');
  });
});

describe('the QA pair\'s job keys', () => {
  const shape = (code: string) => /add constraint runner_jobs_mission_key_shape check \( mission_key is null or mission_key ~ '([^']*)'\)/.exec(code)?.[1] ?? '';

  it('takes :qa:<1 or 2> and :qa-fix:1:<1 to 5> after a run, beside every key it took before', () => {
    expect(shape(CODE)).toBe(shape(REPAIRS).replace('(:review:[12]|:fix:1)?', '(:review:[12]|:fix:1|:qa:[12]|:qa-fix:1:[1-5])?'));
    const key = new RegExp(shape(CODE));
    const mission = 'mission:0b6c1a8e-2f4d-4c3b-9a1e-7d5f6e4c3b2a';
    for (const ok of [
      `${mission}:prd:3001:run:1:qa:1`, `${mission}:prd:3001:run:1:qa:2`, `${mission}:prd:3001:run:1:qa-fix:1:1`, `${mission}:prd:3001:run:1:qa-fix:1:5`,
      `${mission}:prd:7:run:2:review:1`, `${mission}:prd:7:run:2:fix:1`, `${mission}:prd:2980:repair:1`, `${mission}:pm:3`,
    ]) expect(key.test(ok), ok).toBe(true);
    for (const no of [
      `${mission}:prd:3001:run:1:qa:3`, `${mission}:prd:3001:run:1:qa:0`, `${mission}:prd:3001:run:1:qa-fix:1:6`, `${mission}:prd:3001:run:1:qa-fix:2:1`,
      `${mission}:prd:3001:run:1:qa-fix:1`, `${mission}:prd:3001:qa:1`, `${mission}:prd:3001:run:1:qa:1:qa:2`,
    ]) expect(key.test(no), no).toBe(false);
  });
});

describe('/omni:qa, the loop\'s own skill', () => {
  it('joins the fixed skills a repository\'s own skill may not be named, last, and changes nothing else of the function', () => {
    const fn = body(CODE, 'set_repository_runner_skill');
    expect(fixedOf(fn)).toEqual([...fixedOf(body(REPAIRS, 'set_repository_runner_skill')), 'qa']);
    const list = /fixed text\[\] := array\[[^\]]*\]/;
    expect(fn.replace(list, 'LIST')).toBe(body(REPAIRS, 'set_repository_runner_skill').replace(list, 'LIST'));
    expect(CODE).toContain('revoke execute on function public.set_repository_runner_skill(uuid, text, text, boolean) from public, anon;');
    expect(CODE).toContain('grant execute on function public.set_repository_runner_skill(uuid, text, text, boolean) to authenticated;');
  });
});

describe('QA\'s skills and limits (AC-10)', () => {
  const now = rolesOf(CODE);
  const before = rolesOf(REPAIRS);
  const qa = (roles: Role[]) => roles.find((r) => r.role === 'qa');

  it('gives QA qa, prove, bug-fix and validate-e2e, and its four limits after every hero\'s two, as the kit does', () => {
    expect(qa(now)?.skills).toEqual(['qa', 'prove', 'bug-fix', 'validate-e2e']);
    expect(qa(now)?.limits).toEqual([...roleOf('qa').limits]);
    expect(qa(now)?.limits).not.toContain('It reports what it saw; a person decides.');
  });

  it('changes no other role', () => {
    expect(now.filter((r) => r.role !== 'qa')).toEqual(before.filter((r) => r.role !== 'qa'));
  });

  it('gives a QA already made the skills only while they are still the default it was made with', () => {
    expect(CODE).toMatch(/update public\.virtual_heroes h set skills = array\(select jsonb_array_elements_text\(d\.value -> 'skills'\)\), updated_at = now\(\) from jsonb_array_elements\(public\.virtual_hero_roles\(\)\) as d \(value\) where d\.value ->> 'role' = 'qa' and h\.role = 'qa'/);
    expect(CODE).toContain(`and h.skills = ${quoted(qa(before)?.skills ?? [])};`);
  });

  it('gives a QA already made the limits only while they are still the default it was made with', () => {
    expect(CODE).toMatch(/update public\.virtual_heroes h set limits = array\(select jsonb_array_elements_text\(d\.value -> 'limits'\)\), updated_at = now\(\) from jsonb_array_elements\(public\.virtual_hero_roles\(\)\) as d \(value\) where d\.value ->> 'role' = 'qa' and h\.role = 'qa'/);
    expect(CODE).toContain(`and h.limits = ${quoted(qa(before)?.limits ?? [])};`);
  });
});

describe('the proof on a database', () => {
  it('is its own step of the supabase workflow, in one transaction rolled back', () => {
    expect(WORKFLOW).toContain('-f supabase/checks/qa_turn.sql');
    expect(CHECKS).toContain('begin;');
    expect(CHECKS.trimEnd().endsWith('rollback;')).toBe(true);
  });
});

describe('the database\'s types', () => {
  it('still name a job\'s tokens', () => {
    expect(TYPES).toMatch(/runner_jobs: \{\n {8}Row: \{[^}]*\n {10}tokens: Json \| null\n/);
  });
});
