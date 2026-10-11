// Who may change a product's pitch look (PRD 859 s1, PRD 1108), read from the migrations as text: the
// functions that write the look refuse whoever may not edit the workspace's business, through the very
// guard the business's own writers use, and nothing else writes the products' rows. What the database
// lets through is supabase/checks/products_pitch_look.sql's to prove; this pins that the guard is there.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { present } from '../ask/test/test-item';

const MIGRATIONS = fileURLToPath(new URL('../../../../supabase/migrations/', import.meta.url));
const FILES = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
const read = (file: string) => readFileSync(`${MIGRATIONS}${file}`, 'utf8').replace(/\s+/g, ' ');

/** The body of the newest definition of `name`: the one in force. */
function newestBody(name: string): string {
  const defines = new RegExp(`create (?:or replace )?function public\\.${name}\\(.*?\\$\\$(.*?)\\$\\$`);
  const file = present(FILES.filter((f) => defines.test(read(f))).at(-1), `a migration defining ${name}`);
  return present(read(file).match(defines)?.[1], `${name}'s body`);
}

/** The guard a writer opens with: its first statement after `begin`. */
const guardOf = (body: string) => present(body.match(/\bbegin (.*?;)/)?.[1], 'its first statement');

describe('who may change a product\'s pitch look', () => {
  // Law BR-PRODUCT-70 (.omni-loop/knowledge/product/rules.md, #1531).
  it('law BR-PRODUCT-70: the look is changed by exactly those who may edit the business, every member today', () => {
    // Whoever may edit the business: product_rename() is one of its writers, and opens with its guard.
    const businessGuard = guardOf(newestBody('product_rename'));
    expect(businessGuard).toBe('perform public.business_member_only(p_workspace);');
    // Which today lets in any member of the workspace, and nobody else.
    expect(newestBody('business_member_only')).toContain('if auth.uid() is null or p_workspace is null or not public.is_member(p_workspace) then raise exception');

    // Both writers of the look open with that same guard, and no other gate.
    for (const writer of ['set_pitch_look', 'set_pitch_settings']) {
      const body = newestBody(writer);
      expect(guardOf(body)).toBe(businessGuard);
      expect(body).not.toMatch(/auth\.uid\(\)|is_owner|role/);
    }

    // Nobody else writes it: no migration grants a direct write on products or adds a policy that would.
    for (const f of FILES) {
      const sql = read(f);
      expect(sql).not.toMatch(/grant (update|insert|all)[^;]*on (table )?public\.products\b/);
      expect(sql).not.toMatch(/create policy [^;]* on public\.products for (update|insert|all)/);
    }
  });
});
