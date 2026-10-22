// The app-sent job's migration (PRD 2338 s2), read as text, as runners.skills.migration.test.ts reads the
// skills': the column, the rule that one sender is set, the rollback its header names, and the database's
// types that carry them. The database check is supabase/checks/runner_job_sender.sql.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(fileURLToPath(new URL(`../../../../${path}`, import.meta.url)), 'utf8');
const MIGRATION = read('supabase/migrations/20261223090000_runner_jobs_sent_by_app.sql');
const CODE = MIGRATION.replace(/--.*$/gm, '').replace(/\s+/g, ' ');
const TYPES = read('supabase/database.types.ts');
const WORKFLOW = read('.github/workflows/supabase.yml');

describe('the runner_jobs sender migration', () => {
  it('adds sent_by_app, only omni-app, and lets sent_by be null', () => {
    expect(CODE).toContain('alter column sent_by drop not null');
    expect(CODE).toContain("add column sent_by_app text check (sent_by_app = 'omni-app')");
  });

  it('requires exactly one of the two senders', () => {
    expect(CODE).toContain('add constraint runner_jobs_one_sender check ((sent_by is not null) <> (sent_by_app is not null))');
  });

  it('names its rollback in its header', () => {
    expect(MIGRATION).toMatch(/^-- Rollback: .*restores `sent_by not null`/ms);
  });

  it('adds no policy or grant: the table\'s own read by members and write by the service role hold', () => {
    expect(CODE).not.toMatch(/create policy|grant |revoke /);
  });

  it('is in the database types, sent_by being optional to write and null to read', () => {
    const table = /runner_jobs: \{ Row: \{(.*?)\} Insert: \{(.*?)\} Update: \{(.*?)\} Relationships/s.exec(TYPES.replace(/\s+/g, ' '));
    expect(table?.[1]).toContain('sent_by: string | null sent_by_app: string | null sent_by_key: string | null');
    expect(table?.[2]).toContain('sent_by?: string | null sent_by_app?: string | null');
    expect(table?.[3]).toContain('sent_by?: string | null sent_by_app?: string | null');
  });

  it('is proven by a check the supabase workflow runs as its own step', () => {
    expect(WORKFLOW).toContain('supabase/checks/runner_job_sender.sql');
  });
});
