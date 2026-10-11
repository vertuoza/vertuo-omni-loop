// The category migration (PRD 144), read as text: the model's guess is written by one function, only
// while no person has set a category, and only by the session's owner. What the database lets through
// is supabase/checks/ask.sql's to prove; this pins that the guard is there.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { present } from './test/test-item';

const MIGRATIONS = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url));
const read = (file: string) => readFileSync(`${MIGRATIONS}${file}`, 'utf8').replace(/\s+/g, ' ');

describe('the model\'s guessed category', () => {
  // Law BR-PRODUCT-40 (.omni-loop/knowledge/product/rules.md, #1501).
  it('law BR-PRODUCT-40: the guess is written only while no person set one, by the session\'s owner, never over a person\'s choice', () => {
    // The newest migration that defines the function is the one in force.
    const defining = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort()
      .filter((f) => /create (or replace )?function public\.ask_round_classified\(/.test(read(f)));
    const file = present(defining.at(-1), 'a migration defining ask_round_classified');
    const sql = read(file);
    const body = present(sql.match(/create (?:or replace )?function public\.ask_round_classified\(.*?\$\$(.*?)\$\$/)?.[1], 'its body');

    // It writes the guess as the model's, and only while nobody (no person, not the model) has set one.
    expect(body).toContain("set category = new_category, category_by = 'model'");
    expect(body).toContain('and r.category_by is null');
    // Only the session's owner, the account that asked, signed in as themselves.
    expect(body).toContain('s.owner = (select auth.uid())');
    expect(sql).toContain('revoke execute on function public.ask_round_classified(uuid, text) from public, anon;');
    // Nobody writes the category columns directly: no grant reaches them in any migration.
    for (const f of readdirSync(MIGRATIONS).filter((m) => m.endsWith('.sql'))) {
      expect(read(f)).not.toMatch(/grant (update|insert)[^;]*\bcategory(_by)?\b[^;]*on public\.ask_rounds/);
    }
  });
});
