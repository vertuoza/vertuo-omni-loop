// The access the MCP's product_mcp_for_key() answers, built for the eval set (PRD omni-loop-8 s3) from the
// tables, on the service role's client. The eval has no API key to give that function, and its helpers are
// revoked from every role, so this reads what it reads: the product, its repositories with each one's newest
// pack, the law home, and the Legal entries and Glossary product_knowledge_for_agents() carries. A refusal
// throws with the database's reason, never a row. A Legal entry's owner is left out (member_login() is
// internal too): the owner's login is a line of the entry's text only, and no vector holds it.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../../supabase/database.types.ts';
import type { AccessRow } from '../product-mcp/access-row';

type Db = Pick<SupabaseClient<Database>, 'from'>;

const fail = (where: string, error: { message: string }): never => {
  throw new Error(`Supabase refused to read ${where}: ${error.message}`);
};

/** What the product's MCP would serve a key of its workspace, or null when the product is not the workspace's, or is archived. */
export async function evalAccess(db: Db, workspaceId: string, productId: string): Promise<AccessRow | null> {
  const product = await db.from('products').select('id, key, name, workspace_id, plan_repository')
    .eq('id', productId).eq('workspace_id', workspaceId).is('archived_at', null).maybeSingle();
  if (product.error) return fail('the product', product.error);
  if (product.data === null) return null;

  const links = await db.from('product_repositories').select('repository').eq('product_id', productId);
  if (links.error) return fail('the repositories', links.error);
  const repos = links.data.map((l) => l.repository).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const home = product.data.plan_repository ?? (repos.length === 1 ? repos[0] ?? null : null);

  const wanted = [...new Set([...repos, ...(home === null ? [] : [home])])];
  const packs = wanted.length === 0
    ? { data: [], error: null }
    : await db.from('knowledge_packs').select('id, repository, sha, committed_at').eq('workspace_id', workspaceId).eq('newest', true).in('repository', wanted);
  if (packs.error) return fail('the packs', packs.error);
  const refOf = (repo: string) => {
    const pack = packs.data.find((p) => p.repository === repo);
    return { repo, pack_id: pack?.id ?? null, sha: pack?.sha ?? null, committed_at: pack?.committed_at ?? null };
  };

  const [legal, glossary] = await Promise.all([
    db.from('product_legal').select('code, number, statement, source').eq('product_id', productId).is('retired_at', null),
    db.from('product_glossary').select('term, meaning, avoid').eq('product_id', productId).is('removed_at', null),
  ]);
  if (legal.error) return fail('the Legal entries', legal.error);
  if (glossary.error) return fail('the Glossary', glossary.error);

  return {
    product: { id: product.data.id, key: product.data.key ?? '', name: product.data.name, workspace_id: product.data.workspace_id },
    key_id: '',
    repositories: repos.map(refOf),
    law_home: home === null ? null : refOf(home),
    knowledge: {
      legal: [...legal.data]
        .sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : a.number - b.number))
        .map((l) => ({ id: `L-${l.code}-${l.number}`, statement: l.statement, source: l.source, owner: null })),
      glossary: glossary.data.map((g) => ({ term: g.term, meaning: g.meaning, avoid: g.avoid })),
    },
  };
}
