import 'server-only';
import { headers } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { knowledgePacksRepository } from '../../knowledge-packs/knowledge-packs.repository';
import { knowledgePacksService } from '../../knowledge-packs/knowledge-packs.service';
import { knowledgeReader, writeSourceOf, type WriteSource } from '../constituents/knowledge-reader';
import { productRepositoriesOf } from '../repositories/repositories.repository';
import { cardFrom, originFrom, type McpCard } from './mcp-server';
import { mcpProductOf, roleIn } from './mcp-server.repository';

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
  const [stored, role, held] = await Promise.all([mcpProductOf(db, product), roleIn(db, workspace, me), productRepositoriesOf(db, product)]);
  if (stored === null) return null;
  const missing = stored.mcp_enabled && held !== null ? await withoutPack(db, held.repositories) : [];
  return { card: cardFrom(stored, role, origin, missing), source: writeSourceOf(reader) };
}
