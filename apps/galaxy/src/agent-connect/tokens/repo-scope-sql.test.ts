// What an agent's link may read, from the last migration that defines business_for_token(), read as
// text: which repositories it lets through and whose business it reads. What the function returns is
// the database's to prove (supabase/checks/agent_tokens.sql); this pins the scope the law states.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MIGRATIONS = fileURLToPath(new URL('../../../../../supabase/migrations/', import.meta.url));

/** The body of business_for_token() as the last migration creating it defines it, comments dropped, one line. */
function businessForToken(): string {
  const bodies = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
    .map((f) => readFileSync(`${MIGRATIONS}${f}`, 'utf8').replace(/--.*$/gm, '').replace(/\s+/g, ' '))
    .map((sql) => /create (?:or replace )?function public\.business_for_token\(.*?as \$\$(.*?)\$\$/.exec(sql)?.[1])
    .filter((body): body is string => body !== undefined);
  const last = bodies.at(-1);
  if (last === undefined) throw new Error('no migration defines business_for_token()');
  return last;
}

describe('an agent\'s link', () => {
  // Law BR-PRODUCT-63 (.omni-loop/knowledge/product/rules.md, #1524).
  it('law BR-PRODUCT-63: reads a listed repository or one its GitHub org owns, refuses any other, and only its own workspace\'s business', () => {
    const body = businessForToken();
    // The workspace's GitHub organisation, read from the link's own workspace.
    expect(body).toContain('select lower(w.github_org) into org from public.workspaces w where w.id = t.workspace_id;');
    // Refused only when the repository is neither listed by the workspace nor owned by its organisation.
    expect(body).toContain('if not exists (select 1 from public.repositories r where r.workspace_id = t.workspace_id and r.full_name = v_repo)'
      + ' and org is distinct from split_part(v_repo, \'/\', 1) then'
      + ' raise exception \'Repository: % is not one of this workspace\'\'s repositories.\', v_repo using errcode = \'42501\'');
    // Every read goes to the link's own workspace's business, never another's.
    const reads = [...body.matchAll(/public\.business_for_product\(([^,]+),/g)].map((m) => m[1]);
    expect(reads.length).toBeGreaterThan(0);
    for (const workspace of reads) expect(workspace).toBe('t.workspace_id');
  });
});
