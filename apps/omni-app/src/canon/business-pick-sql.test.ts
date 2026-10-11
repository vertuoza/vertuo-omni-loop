// The canon check's business read, business_for_repo_app() (PRD 839), read as text from the newest
// migration that defines it: which workspace it picks when more than one tracks the repository. What
// the read returns is the database's to prove; this pins that the pick is written so, as the law asks.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MIGRATIONS = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url));

/** The body of business_for_repo_app() in the newest migration that (re)defines it, on one line. */
function newestRead(): string {
  const definition = /create (?:or replace )?function public\.business_for_repo_app\(p_repo text\)[\s\S]*?\n\$\$;/;
  const bodies = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
    .map((f) => readFileSync(MIGRATIONS + f, 'utf8').match(definition)?.[0])
    .filter((body): body is string => body !== undefined);
  const newest = bodies.at(-1);
  if (newest === undefined) throw new Error('no migration defines business_for_repo_app()');
  return newest.replace(/\s+/g, ' ');
}

describe('the canon check\'s business read', () => {
  // Law BR-PRODUCT-62 (.omni-loop/knowledge/product/rules.md, #1523).
  it('law BR-PRODUCT-62: reads the workspace whose GitHub organisation owns the repository, else the one that started tracking it first', () => {
    const read = newestRead();
    // One workspace among those tracking the repository: the owner's organisation first, then the
    // earliest to start tracking it.
    expect(read).toContain('select r.workspace_id into ws from public.repositories r join public.workspaces w on w.id = r.workspace_id'
      + ' where r.full_name = v_repo and r.tracked'
      + " order by (lower(w.github_org) is not distinct from split_part(v_repo, '/', 1)) desc, r.added_at, w.slug limit 1;");
    // And the business read is that workspace's.
    expect(read).toContain('select * into biz from public.businesses b where b.workspace_id = ws;');
  });
});
