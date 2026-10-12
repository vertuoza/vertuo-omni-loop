// The agent tokens' migration (PRD 855), read as text: which functions keep a link working, list it
// and let it be revoked. What the database does with them is the database's to prove; this pins the
// conditions the law names.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MIGRATION = readFileSync(fileURLToPath(new URL('../../../../../supabase/migrations/20261028090000_agent_tokens.sql', import.meta.url)), 'utf8');

/** The body of `public.<name>(…)` as the migration creates it, on one line. */
function body(name: string): string {
  const match = new RegExp(`create function public\\.${name}\\([\\s\\S]*?\\$\\$([\\s\\S]*?)\\$\\$;`).exec(MIGRATION);
  expect(match, `the migration creates public.${name}()`).not.toBeNull();
  return (match?.[1] ?? '').replace(/\s+/g, ' ');
}

const MAKER_IS_MEMBER = 'exists (select 1 from public.workspace_members m where m.workspace_id = x.workspace_id and m.user_id = x.made_by)';

describe('the agent tokens migration', () => {
  // Law BR-PRODUCT-64 (.omni-loop/knowledge/product/rules.md, #1525).
  it('law BR-PRODUCT-64: a link whose maker left the workspace is refused, yet listed as not working for an owner to revoke', () => {
    // Every call through a link goes through agent_token_of(), which finds it only while its maker is a member.
    const of = body('agent_token_of');
    expect(of).toContain(`where x.token_hash = p_hash and x.revoked_at is null and ${MAKER_IS_MEMBER};`);
    expect(of).toContain("if t.id is null then raise exception 'This link does not work: make a new one on Settings › Business.' using errcode = '28000';");

    // The list keeps every link not revoked, whoever made it, with no condition on its maker.
    const list = body('agent_tokens_list');
    expect(list).toContain('from public.agent_tokens t where t.workspace_id = p_workspace and t.revoked_at is null), \'[]\'::jsonb);');
    expect(list).not.toContain('workspace_members');

    // Each listed link says whether it works: its maker is still a member. An owner may revoke any.
    const listed = body('agent_token_listed');
    expect(listed).toContain("'working', exists (select 1 from public.workspace_members m where m.workspace_id = t.workspace_id and m.user_id = t.made_by)");
    expect(listed).toContain("'canRevoke', t.made_by = auth.uid() or public.is_owner(t.workspace_id)");
    const revoke = body('agent_token_revoke');
    expect(revoke).toContain('if t.made_by <> auth.uid() and not public.is_owner(p_workspace) then');
    expect(revoke).toContain('update public.agent_tokens x set revoked_at = now(), revoked_by = auth.uid() where x.id = t.id');
  });
});
