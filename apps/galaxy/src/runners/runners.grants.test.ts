// The runners' storage reads as the service role (./runners.repository.ts): every table it reads with
// `from()` must be one the migrations, applied in order, leave the service role able to read. A table
// whose privileges a migration revoked from the service role is read through a function instead
// (issue 2165: the board read `agent_tokens` straight, and the Runners page could not be read).
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = (path: string) => fileURLToPath(new URL(`../../../../${path}`, import.meta.url));
const MIGRATIONS = readdirSync(root('supabase/migrations')).filter((name) => name.endsWith('.sql')).sort();
const REPOSITORY = readFileSync(root('apps/galaxy/src/runners/runners.repository.ts'), 'utf8');

/** The tables of `on public.a, public.b` in a grant or a revoke. */
const tablesOf = (list: string) => [...list.matchAll(/public\.(\w+)/g)].map((match) => match[1] ?? '');

/** A grant or a revoke that gives or takes `select` (or all) on tables from the service role. */
const PRIVILEGE = /^\s*(grant|revoke) [^;]*?\b(?:all|select)\b[^;]*? on (?:table )?(public\.\w+(?:\s*,\s*public\.\w+)*) (?:to|from) [^;]*\bservice_role\b/i;

/** The tables the migrations leave the service role unable to read: revoked, and not granted `select` since. */
function closedToServiceRole(sqls: string[]): Set<string> {
  const closed = new Set<string>();
  const statements = sqls.flatMap((sql) => sql.replace(/--.*$/gm, '').replace(/\s+/g, ' ').split(';'));
  for (const match of statements.map((statement) => PRIVILEGE.exec(statement))) {
    if (!match) continue;
    for (const table of tablesOf(match[2] ?? '')) {
      if (match[1]?.toLowerCase() === 'revoke') closed.add(table);
      else closed.delete(table);
    }
  }
  return closed;
}

describe('the runners storage and the service role', () => {
  it('reads with from() only tables the service role may read', () => {
    const closed = closedToServiceRole(MIGRATIONS.map((name) => readFileSync(root(`supabase/migrations/${name}`), 'utf8')));
    const read = [...new Set([...REPOSITORY.matchAll(/\.from\('(\w+)'\)/g)].map((match) => match[1] ?? ''))];
    expect(read.filter((table) => closed.has(table))).toEqual([]);
  });

  it('counts a table closed after a revoke from the service role, and open again after a grant of select', () => {
    expect(closedToServiceRole(['revoke all on public.keys, public.notes from public, anon, authenticated, service_role;'])).toEqual(new Set(['keys', 'notes']));
    expect(closedToServiceRole(['revoke all on public.keys from anon, authenticated;'])).toEqual(new Set());
    expect(closedToServiceRole(['revoke all on public.keys from service_role;', 'grant select, insert on public.keys to service_role;'])).toEqual(new Set());
    expect(closedToServiceRole(['revoke all on public.keys from service_role;', 'grant insert on public.keys to service_role;'])).toEqual(new Set(['keys']));
    expect(closedToServiceRole(['-- revoke all on public.keys from service_role;'])).toEqual(new Set());
  });
});
