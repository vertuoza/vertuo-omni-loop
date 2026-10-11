// The constituents' migration (PRD 871), read as text: what keeps a product's Statement and its Never
// numbers. What the functions let through is the database's to prove (supabase/checks/constituents.sql);
// this pins that each rule is there.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { STATEMENT_MAX } from './model';

const MIGRATION = readFileSync(fileURLToPath(new URL('../../../../supabase/migrations/20261029090000_constituents.sql', import.meta.url)), 'utf8');
const oneLine = MIGRATION.replace(/\s+/g, ' ');

describe('the constituents migration', () => {
  // Law BR-PRODUCT-67 (.omni-loop/knowledge/product/rules.md, #1528).
  it('law BR-PRODUCT-67: a Statement is one line of at most 400 characters, its owner removes it and writes a new one, and Never numbers count per product', () => {
    // One line, at most 400 characters.
    expect(STATEMENT_MAX).toBe(400);
    expect(oneLine).toContain("most integer := case when p_kind = 'statement' then 400 else 200 end;");
    expect(oneLine).toContain("if char_length(v) not between 1 and most or v ~ '[\\r\\n\\t]' then");
    expect(oneLine).toContain("check (char_length(body) between 1 and case when kind = 'statement' then 400 else 200 end)");
    // Its owner can remove it: the row is marked removed, and only a live Statement blocks a new one.
    expect(oneLine).toContain('create function public.constituent_remove(p_workspace uuid, p_constituent uuid) returns public.constituents language plpgsql security definer set search_path = \'\' as $$ declare was public.constituents; made public.constituents; begin perform public.constituents_owner_only(p_workspace);');
    expect(oneLine).toContain('update public.constituents c set removed_at = now(), removed_by = auth.uid(), updated_at = now() where c.id = was.id');
    expect(oneLine).toContain("create unique index constituents_statement_idx on public.constituents (product_id) where kind = 'statement' and removed_at is null;");
    expect(oneLine).toContain("if exists (select 1 from public.constituents c where c.product_id = p_product and c.kind = 'statement' and c.removed_at is null) then");
    // Never numbers count per product, from one.
    expect(oneLine).toContain("select coalesce(max(c.seq), 0) + 1 into seq_next from public.constituents c where c.product_id = p_product and c.kind = 'never';");
    expect(oneLine).toContain("create unique index constituents_never_seq_idx on public.constituents (product_id, seq) where kind = 'never';");
  });
});
