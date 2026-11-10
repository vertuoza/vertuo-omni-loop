import 'server-only';
import { headers } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { knowledgePacksRepository } from '../../knowledge-packs/knowledge-packs.repository';
import { knowledgePacksService } from '../../knowledge-packs/knowledge-packs.service';
import { knowledgeReader, writeSourceOf, type WriteSource } from '../constituents/knowledge-reader';
import { productRepositoriesOf } from '../repositories/repositories.repository';
import { cardFrom, originFrom, type McpCard } from './mcp-server';

// The MCP server card's read (PRD 2707 s4), as the signed-in person, so row-level security decides what it
// returns: the product's key, whether its server is on, whether it is archived, whether the person owns the
// workspace, and each repository of the product with no knowledge pack yet. Null when it cannot be read, and
// the card is then left out. In the demo, an in-memory card.

export interface McpCardRead {
  card: McpCard;
  source: WriteSource;
}

async function originOf(): Promise<string> {
  const seen = await headers();
  return originFrom(seen.get('x-forwarded-host') ?? seen.get('host'), seen.get('x-forwarded-proto'));
}

/** The repositories of the product whose newest pack is none, as owner/name. */
async function withoutPack(db: SupabaseClient, repositories: string[]): Promise<string[]> {
  const service = knowledgePacksService(knowledgePacksRepository(db));
  const reads = await Promise.all(repositories.map(async (repo) => ({ repo, read: await service.read({ repo }) })));
  return reads.filter(({ read }) => !read.ok && read.kind === 'missing').map(({ repo }) => repo);
}

export async function loadMcpCard(product: string): Promise<McpCardRead | null> {
  const reader = await knowledgeReader();
  const origin = await originOf();
  if (reader.kind === 'demo') {
    return { card: { key: 'demo', on: false, owner: true, archived: false, origin, missing: [] }, source: { kind: 'demo' } };
  }
  if (reader.kind !== 'database') return null;
  const { db, me, workspace } = reader;
  const [stored, role, held] = await Promise.all([
    db.from('products').select('key, mcp_enabled, archived_at').eq('id', product).maybeSingle(),
    db.from('workspace_members').select('role').eq('workspace_id', workspace).eq('user_id', me).maybeSingle(),
    productRepositoriesOf(db, product),
  ]);
  if (stored.error || stored.data === null) return null;
  const missing = stored.data.mcp_enabled && held !== null ? await withoutPack(db, held.repositories) : [];
  return { card: cardFrom(stored.data, role.data?.role ?? null, origin, missing), source: writeSourceOf(reader) };
}
