// The Jev migration (PRD 812), read as text: the database functions that keep Jev's on state tied to
// a stored key, and who sees what of that key. No later migration redefines them.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MIGRATION = readFileSync(fileURLToPath(new URL('../../../../supabase/migrations/20261026090000_jev_decisions.sql', import.meta.url)), 'utf8');

/** One function's body, between its $$ markers, on one line. */
function body(name: string): string {
  const match = new RegExp(`create function public\\.${name}\\([\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`).exec(MIGRATION);
  if (!match?.[1]) throw new Error(`the migration defines no ${name}()`);
  return match[1].replace(/\s+/g, ' ');
}

describe('Jev\'s key', () => {
  // Law BR-PRODUCT-59 (.omni-loop/knowledge/product/rules.md, #1520).
  it('law BR-PRODUCT-59: Jev is on exactly when a key is stored, and only the owner sees its last four and date', () => {
    const remove = body('remove_jev_key');
    expect(remove).toContain("delete from public.workspace_secrets s where s.workspace_id = p_workspace and s.name = 'jev';");
    expect(remove).toContain("update public.jev_decisions d set mode = 'off',");
    expect(remove).toContain("where d.workspace_id = p_workspace and d.mode <> 'off';");

    const decide = body('set_jev_decision');
    expect(decide).toContain("if p_mode <> 'off' and not exists (select 1 from public.workspace_secrets s where s.workspace_id = p_workspace and s.name = 'jev') then raise exception");

    const status = body('jev_key_status');
    expect(status).toContain('caller_owns := public.is_owner(p_workspace);');
    expect(status).toContain("select exists (select 1 from public.workspace_secrets s where s.workspace_id = p_workspace and s.name = 'jev'),");
    expect(status).toContain("case when caller_owns then (select s.last_four from public.workspace_secrets s where s.workspace_id = p_workspace and s.name = 'jev') end,");
    expect(status).toContain("case when caller_owns then (select s.set_at from public.workspace_secrets s where s.workspace_id = p_workspace and s.name = 'jev') end;");

    expect(MIGRATION).not.toMatch(/create policy [^;]* on public\.workspace_secrets/);
    expect(MIGRATION).not.toMatch(/grant [^;]* on public\.workspace_secrets[^;]* to authenticated/);
  });
});
