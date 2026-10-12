// Who link_github() answers, read as text from the newest migration that defines it
// (20260926120000_workspaces.sql). What the function lets through is the database's to prove
// (supabase/checks/access.sql); this pins that the workspace gate is there, ahead of GitHub.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const DIR = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url));

function migration(name: string): string {
  return readFileSync(`${DIR}${name}`, 'utf8')
    .replace(/--[^\n]*/g, '')
    .replace(/\s+/g, ' ');
}

/** The body of one function the migration creates, between its $$ quotes. */
function body(sql: string, fn: string): string {
  const match = new RegExp(`function public\\.${fn}\\([^$]*\\$\\$(.*?)\\$\\$`).exec(sql);
  if (!match?.[1]) throw new Error(`no function ${fn} in the migration`);
  return match[1];
}

/** The newest migration that creates the function, so a later one that replaced it is the one read. */
function newest(fn: string): string {
  const names = readdirSync(DIR)
    .filter((n) => n.endsWith('.sql'))
    .sort()
    .filter((n) => new RegExp(`function public\\.${fn}\\(`).test(migration(n)));
  const last = names.at(-1);
  if (!last) throw new Error(`no migration creates ${fn}`);
  return migration(last);
}

describe('who link_github() answers', () => {
  // Law BR-PRODUCT-28 (.omni-loop/knowledge/product/rules.md, #1489).
  it('law BR-PRODUCT-28: only a caller with a workspace_members row, refused with 42501 before GitHub is read', () => {
    const link = body(newest('link_github'), 'link_github');
    const gate =
      "if auth.uid() is null or not public.has_workspace() then raise exception 'Sign in with an account of a workspace first.' using errcode = '42501'; end if;";
    expect(link).toContain(gate);
    // Whether or not GitHub is linked: the gate comes before the GitHub identity is looked up.
    expect(link.indexOf(gate)).toBeLessThan(link.indexOf('public.my_github()'));

    // has_workspace() is true exactly when the caller has at least one workspace_members row.
    expect(body(newest('has_workspace'), 'has_workspace').trim()).toBe(
      'select exists (select 1 from public.workspace_members m where m.user_id = auth.uid())',
    );
  });
});
