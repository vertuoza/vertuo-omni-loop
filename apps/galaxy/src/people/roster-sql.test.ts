// The roster-hero migration (PRD 652), read as text: replacing workspace_roster to add `hero` keeps
// what the first one promised, the member guard, the security definer and the signed-in-only grant.
// What the function returns is the database's to prove (supabase/checks/dashboards.sql); this pins
// that each promise survives the replacement.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MIGRATION = readFileSync(fileURLToPath(new URL('../../../../supabase/migrations/20261013090000_roster_hero.sql', import.meta.url)), 'utf8');
const sql = MIGRATION.replace(/--.*$/gm, '').replace(/\s+/g, ' ');

describe('the roster-hero migration', () => {
  it('drops the function, then creates it with hero jsonb as a sixth column', () => {
    expect(sql.indexOf('drop function public.workspace_roster(uuid);')).toBeGreaterThanOrEqual(0);
    expect(sql.indexOf('drop function')).toBeLessThan(sql.indexOf('create function'));
    expect(sql).toContain('returns table (user_id uuid, name text, github_login text, avatar_url text, fleet text, hero jsonb)');
    expect(sql).toContain('p.hero as hero');
  });

  it('keeps security definer, an empty search path and the is_member guard', () => {
    expect(sql).toContain('security definer set search_path = \'\'');
    expect(sql).toContain('where m.workspace_id = workspace and public.is_member(workspace)');
  });

  it('runs for signed-in people only, and never returns an email', () => {
    expect(sql).toContain('revoke execute on function public.workspace_roster(uuid) from public, anon;');
    expect(sql).toContain('grant execute on function public.workspace_roster(uuid) to authenticated;');
    expect(sql.match(/grant execute/g)).toHaveLength(1);
    expect(sql.slice(sql.indexOf('as $$'), sql.lastIndexOf('$$'))).not.toMatch(/\bemail\b/);
  });
});
