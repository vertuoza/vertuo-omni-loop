// The indexes-and-RLS migration (PRD 657, s9), read as text: the four indexes the slow reads miss
// are there, `is_member()` reads the uid once per statement, and no policy it writes compares a bare
// `auth.uid()`. Who may read what is the database's to prove: supabase/checks/access.sql.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { sure } from './arcade/test/sure';

const MIGRATION = readFileSync(
  fileURLToPath(new URL('../../../supabase/migrations/20261012110000_rls_once_and_indexes.sql', import.meta.url)),
  'utf8',
);
/** The migration's statements, comments dropped: the previous policy texts it keeps do not count. */
const CODE = MIGRATION.replace(/--.*$/gm, '').replace(/\s+/g, ' ');

/** Every `create policy` or `alter policy` statement in the migration, on one line. */
function policies(): string[] {
  return [...CODE.matchAll(/(?:create|alter) policy [\s\S]*?;/g)].map(([text]) => text);
}

/** `auth.uid()` not written as `(select auth.uid())`. */
const BARE_UID = /(?<!\(select )auth\.uid\(\)/;

describe('the rls-once-and-indexes migration', () => {
  it.each([
    ['contributions', 'workspace_id, at'],
    ['dossiers', 'opened_by'],
    ['dossier_versions', 'created_at'],
    ['ask_rounds', 'answered_at'],
  ])('indexes %s (%s)', (table, columns) => {
    expect(CODE).toMatch(new RegExp(`create index if not exists \\w+ on public\\.${table} \\(${columns}\\)`));
  });

  it('rewrites is_member() to read the uid once per statement', () => {
    const body = CODE.match(/create or replace function public\.is_member\(workspace uuid\)[\s\S]*?\$\$([\s\S]*?)\$\$/);
    expect(body).not.toBeNull();
    expect(sure(body, 'body')[1]).toContain('m.user_id = (select auth.uid())');
    expect(sure(body, 'body')[1]).not.toMatch(BARE_UID);
    expect(CODE).toMatch(/create or replace function public\.is_member\(workspace uuid\) returns boolean language sql stable security definer set search_path = ''/);
  });

  it('rewrites the policies that compared a bare auth.uid()', () => {
    const text = policies().join('\n');
    expect(text).toContain('alter policy "a person reads their own memberships" on public.workspace_members');
    expect(text).toContain('alter policy "a member joins as themself, with GitHub linked" on public.players');
    expect(text).toContain('alter policy "a player edits only themself" on public.players');
  });

  it('writes no policy that compares a bare auth.uid()', () => {
    expect(policies().length).toBeGreaterThan(0);
    for (const policy of policies()) expect(policy).not.toMatch(BARE_UID);
  });

  it('keeps each previous policy text in a comment, for rollback', () => {
    expect(MIGRATION).toMatch(/--.*using \(user_id = auth\.uid\(\)\)/);
    expect(MIGRATION).toMatch(/--.*with check \(user_id = auth\.uid\(\) and public\.is_member\(workspace_id\) and exists \(select 1 from public\.my_github\(\)\)\)/);
    expect(MIGRATION).toMatch(/--.*using \(user_id = auth\.uid\(\) and public\.is_member\(workspace_id\)\)/);
  });
});
