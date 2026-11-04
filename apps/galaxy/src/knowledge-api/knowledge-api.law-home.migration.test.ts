// The law home's migration (PRD 2632 s2), read as text: where a product's business laws live. What it answers is the
// database's to prove (supabase/checks/business.sql: the plan repository, the only repository, none); this pins that
// each rule is there and that nothing else about the read changed.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MIGRATION = readFileSync(fileURLToPath(new URL('../../../../supabase/migrations/20270110090000_business_law_home.sql', import.meta.url)), 'utf8');
const oneLine = MIGRATION.replace(/\s+/g, ' ');

describe('the business_law_home migration', () => {
  it('is the plan repository when set, else the only repository, else none', () => {
    expect(oneLine).toContain('select p.plan_repository from public.products p where p.id = p_product');
    expect(oneLine).toContain('select min(l.repository) from public.product_repositories l where l.product_id = p_product having count(*) = 1');
  });

  it('is internal: no caller runs it, and the two reads append it', () => {
    expect(oneLine).toContain('revoke execute on function public.product_law_home(uuid) from public, anon, authenticated, service_role;');
    expect(oneLine).toContain("'lawHome', to_jsonb(public.product_law_home(p_product))");
  });

  it('adds the key to what agents read and nothing else: the same function, signature and read-only body', () => {
    expect(oneLine).toContain('create or replace function public.product_knowledge_for_agents(p_product uuid) returns jsonb language sql stable security definer');
    expect(oneLine).not.toMatch(/\b(insert into|update public|delete from|drop )\b/);
  });
});
