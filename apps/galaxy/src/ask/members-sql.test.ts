// The share list and the already-answered note (PRD 144): how ask_members() lists a workspace's
// members, and how the page names each one. The migration is read as text, as the other *-sql tests do.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { memberLabel } from './rows';

const MIGRATION = readFileSync(fileURLToPath(new URL('../../../../supabase/migrations/20260927120000_ask_shares.sql', import.meta.url)), 'utf8');

/** The body of ask_members(), on one line. */
function askMembers() {
  const found = MIGRATION.match(/create function public\.ask_members\(workspace uuid\)([\s\S]*?)\$\$;/);
  if (!found?.[1]) throw new Error('ask_members() is not in the migration');
  return found[1].replace(/\s+/g, ' ');
}

describe('the members a question is shared with', () => {
  // Law BR-PRODUCT-41 (.omni-loop/knowledge/product/rules.md, #1502).
  it('law BR-PRODUCT-41: names each member by their arcade name, else their email, and lists them only to members of the same workspace', () => {
    expect(memberLabel({ name: 'Ada Arcade', email: 'ada@example.com' })).toBe('Ada Arcade');
    expect(memberLabel({ name: null, email: 'bob@example.com' })).toBe('bob@example.com');

    const body = askMembers();
    expect(body).toContain('returns table (user_id uuid, email text, name text)');
    expect(body).toContain('select m.user_id, u.email::text, p.display_name');
    expect(body).toContain('left join public.players p on p.workspace_id = m.workspace_id and p.user_id = m.user_id');
    expect(body).toContain('where m.workspace_id = workspace and public.is_member(workspace)');
    expect(MIGRATION).toContain('revoke execute on function public.ask_members(uuid) from public, anon;');
  });
});
