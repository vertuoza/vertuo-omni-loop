// knowledge_product_for_repo()'s migration (PRD 2268 s1), read as text: what keeps a terminal's change on
// the caller's own workspace and on a live product. What it answers is the database's to prove
// (supabase/checks/knowledge_product_for_repo.sql); this pins that each rule is there.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const MIGRATION = readFileSync(fileURLToPath(new URL('../../../../supabase/migrations/20261219090000_knowledge_product_for_repo.sql', import.meta.url)), 'utf8');
const oneLine = MIGRATION.replace(/\s+/g, ' ');

describe('the knowledge_product_for_repo migration', () => {
  it('reads the caller\'s own workspace for the repository, as its definer, writing nothing (BR-PRODUCT-63)', () => {
    expect(oneLine).toContain("create function public.knowledge_product_for_repo(p_repo text, p_product text default null) returns jsonb language plpgsql stable security definer set search_path = '' as $$");
    expect(oneLine).toContain('ws uuid := public.business_workspace(p_repo);');
    expect(oneLine).not.toMatch(/\b(insert into|update public|delete from)\b/);
  });

  it('counts only live products, and refuses an archived one named', () => {
    expect(oneLine).toContain('where l.workspace_id = ws and l.repository = v_repo and p.archived_at is null;');
    expect(oneLine).toContain('picked := public.product_live(picked);');
    expect(oneLine).toContain('perform public.product_live(public.product_archived_for(ws, v_repo));');
  });

  it('refuses several products and none named with their names, as 21000', () => {
    expect(oneLine).toContain("raise exception '% is in % products: %; pass --product to name one.', v_repo, live_count, live_names using errcode = '21000', hint = 'product';");
  });

  it('is for a signed-in person only', () => {
    expect(oneLine).toContain('revoke execute on function public.knowledge_product_for_repo(text, text) from public, anon;');
    expect(oneLine).toContain('grant execute on function public.knowledge_product_for_repo(text, text) to authenticated;');
  });
});
