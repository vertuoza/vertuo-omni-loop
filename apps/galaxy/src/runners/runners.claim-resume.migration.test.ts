// The claim of a resume's migration (PRD 2809 s5), read as text, as runners.resume.migration.test.ts reads s1's: the
// claim keeps every rule it had, and a resume waits for the runner that keeps its chain's newest local save while that
// runner is online and could take it; then PRD 2949 s3's, which takes recovery first. What the rows do is proven on a database by supabase/checks/runner_resume.sql.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LOST_AFTER_MS } from './runners.contract';

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../../../${path}`, import.meta.url)), 'utf8');
const flat = (sql: string) => sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ');
const CODE = flat(read('supabase/migrations/20270121110000_runner_claim_resume.sql'));
const BEFORE = flat(read('supabase/migrations/20270121100000_runner_resume.sql'));

/** The body of `runner_claim` in `code`, from its `create … function` to its closing `$$;`. */
function claim(code: string): string {
  const match = /create or replace function public\.runner_claim\(.*?\$\$(.*?)\$\$;/.exec(code);
  if (!match?.[1]) throw new Error('no runner_claim');
  return match[1];
}

describe('runner_claim(), the claim of a resume (PRD 2809 s5)', () => {
  const fn = claim(CODE);
  const keeper = /and not exists \( select 1 from \(select c\.runner_id .*? limit 1\) keeper (.*?)\)\) order by q\.queued_at/.exec(fn);

  it('keeps every rule the claim had before: s1\'s claim, with the keeper\'s wait alone added', () => {
    const before = claim(BEFORE);
    expect(fn.replace(/ and not exists \( select 1 from \(select c\.runner_id .*? q\.to_fleet is null and k\.fleet is null\)\)\)/, '')).toBe(before);
  });

  it('reads the newest local save of the chain, the job it resumes and the one before, still kept and not deleted', () => {
    expect(fn).toContain('where q.resumes is not null and (c.job_id = q.resumes or c.job_id = (select b.resumes from public.runner_jobs b where b.id = q.resumes))');
    expect(fn).toContain("and c.kind = 'local' and c.deleted_at is null and c.keep_until > now() order by p.attempt desc, c.updated_at desc limit 1");
  });

  it('holds the resume for its keeper alone while the keeper is online, of the workspace, an App runner, and could take it', () => {
    expect(keeper?.[1]).toBe(
      'join public.runners k on k.id = keeper.runner_id where k.id <> r.id and k.workspace_id = q.workspace_id and k.github_app '
      + `and k.last_seen_at > now() - interval '${String(LOST_AFTER_MS / 1000)} seconds' and q.repo = any (k.repos) `
      + 'and (q.to_runner = k.id or (q.to_runner is null and q.to_fleet is not null and q.to_fleet = k.fleet) or (q.to_runner is null and q.to_fleet is null and k.fleet is null)',
    );
  });

  it('keeps its signature and stays the service role\'s alone', () => {
    expect(CODE).toContain('create or replace function public.runner_claim(p_runner uuid, p_registered_at timestamptz default null) returns setof public.runner_jobs');
    expect(CODE).toContain('revoke execute on function public.runner_claim(uuid, timestamptz) from public, anon, authenticated;');
    expect(CODE).toContain('grant execute on function public.runner_claim(uuid, timestamptz) to service_role;');
  });
});

// Recovery first, and no job to a runner with every account out (PRD 2949 s3): the claim of 2809 s5, with three changes
// and nothing else. What the rows do is proven on a database by supabase/checks/runner_resume.sql.
describe('runner_claim(), recovery first and no job to a runner with every account out (PRD 2949 s3)', () => {
  const NEXT = flat(read('supabase/migrations/20270125110000_runner_claim_recovery_first.sql'));
  const fn = claim(NEXT);
  const HEALTH = "if jsonb_typeof(r.health -> 'accounts') = 'array' and pg_catalog.pg_input_is_valid(r.health ->> 'at', 'timestamptz') then "
    + "if (r.health ->> 'at')::timestamptz > now() - interval '2 minutes' and jsonb_array_length(r.health -> 'accounts') > 0 "
    + "and not exists ( select 1 from jsonb_array_elements(r.health -> 'accounts') a where case when a ->> 'state' = 'out' "
    + "and pg_catalog.pg_input_is_valid(a ->> 'resetsAt', 'timestamptz') then (a ->> 'resetsAt')::timestamptz <= now() else true end) then return; end if; end if; ";
  const KEEPER = 'from (with recursive chain (id, depth) as ( select q.resumes, 1 where q.resumes is not null union all '
    + 'select b.resumes, chain.depth + 1 from chain join public.runner_jobs b on b.id = chain.id where b.resumes is not null and chain.depth < 20) '
    + "select c.runner_id from chain join public.runner_checkpoints c on c.job_id = chain.id where c.kind = 'local' and c.deleted_at is null "
    + 'and c.keep_until > now() order by chain.depth, c.updated_at desc limit 1) keeper';
  const ORDER = 'order by q.resumes is null, (with recursive chain (id, resumes, queued_at, depth) as ( '
    + 'select b.id, b.resumes, b.queued_at, 1 from public.runner_jobs b where b.id = q.resumes union all '
    + 'select b.id, b.resumes, b.queued_at, chain.depth + 1 from chain join public.runner_jobs b on b.id = chain.resumes where chain.depth < 20) '
    + 'select min(chain.queued_at) from chain), q.queued_at, q.id limit 1';

  it('keeps every rule the claim had before: 2809 s5\'s claim, with the health skip, the whole chain and the order alone changed', () => {
    const before = claim(CODE);
    const keeperBefore = /from \(select c\.runner_id .*? limit 1\) keeper/.exec(before)?.[0];
    if (!keeperBefore) throw new Error('no keeper before');
    expect(fn.replace(HEALTH, '').replace(KEEPER, keeperBefore).replace(ORDER, 'order by q.queued_at, q.id limit 1')).toBe(before);
  });

  it('hands nothing to a runner whose health, under two minutes old, lists accounts all out until a time to come, casting no value that is not a time', () => {
    expect(fn).toContain(`if busy >= r.slots then return; end if; ${HEALTH}return query`);
  });

  it('reads the newest local save over the whole chain, the job nearest the resume first, as long chains of waits need', () => {
    expect(fn).toContain(KEEPER);
  });

  it('takes every resume before any fresh job, by the first queued time of its whole chain, then its own', () => {
    expect(fn).toContain(`${ORDER} for update skip locked)`);
  });

  it('keeps its signature and stays the service role\'s alone', () => {
    expect(NEXT).toContain('create or replace function public.runner_claim(p_runner uuid, p_registered_at timestamptz default null) returns setof public.runner_jobs');
    expect(NEXT).toContain('revoke execute on function public.runner_claim(uuid, timestamptz) from public, anon, authenticated;');
    expect(NEXT).toContain('grant execute on function public.runner_claim(uuid, timestamptz) to service_role;');
  });
});
