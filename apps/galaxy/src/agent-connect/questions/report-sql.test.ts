// What an agent's link reports, read as SQL text from the migrations: the latest definition of
// agent_question_report() (what report_unknown calls) beside the latest business_for_token() (what an
// agent reads the business through).
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MIGRATIONS = fileURLToPath(new URL('../../../../../supabase/migrations/', import.meta.url));

/** The body of the newest migration's `create function public.<name>(`, spaces folded. */
function latestDefinition(name: string): string {
  const head = `create function public.${name}(`;
  const file = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort().reverse()
    .map((f) => readFileSync(MIGRATIONS + f, 'utf8'))
    .find((sql) => sql.includes(head) || sql.includes(`create or replace function public.${name}(`));
  expect(file, `a migration defining public.${name}`).toBeDefined();
  const sql = file ?? '';
  const start = Math.max(sql.lastIndexOf(head), sql.lastIndexOf(`create or replace function public.${name}(`));
  const end = sql.indexOf('$$;', start);
  return sql.slice(start, end).replace(/\s+/g, ' ');
}

/** The repository guard: the check that the repository is the workspace's, and its refusal. */
function repositoryGuard(body: string): string | undefined {
  return /if not exists \(select 1 from public\.repositories r where r\.workspace_id = t\.workspace_id and r\.full_name = v_repo\) and org is distinct from split_part\(v_repo, '\/', 1\) then raise exception '[^']*(?:''[^']*)*', v_repo using errcode = '42501', hint = 'repo'; end if;/.exec(body)?.[0];
}

describe('a question an agent reports', () => {
  // Law BR-PRODUCT-65 (.omni-loop/knowledge/product/rules.md, #1526).
  it('law BR-PRODUCT-65: a question naming a repository outside the workspace is refused with the read\'s reason, before it is kept', () => {
    const report = latestDefinition('agent_question_report');
    const read = latestDefinition('business_for_token');

    const reportGuard = repositoryGuard(report);
    const readGuard = repositoryGuard(read);
    expect(readGuard, 'the read refuses a repository outside the workspace').toBeDefined();
    expect(reportGuard, 'the report refuses a repository outside the workspace').toBeDefined();
    // The same refusal, word for word: the same condition, the same one-line reason, the same code.
    expect(reportGuard).toBe(readGuard);
    // Refused before anything is kept.
    expect(report.indexOf(reportGuard ?? '')).toBeLessThan(report.indexOf('insert into public.agent_questions'));
    expect(report.indexOf(reportGuard ?? '')).toBeLessThan(report.indexOf('insert into public.agent_question_reports'));
  });
});
