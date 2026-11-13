import 'server-only';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { serviceDb } from '../data/sign-in-live';
import { supabaseEnv } from '../data/supabase-server';
import { serverEnv, type ArcadeEnv } from '../env';
import { jevDecideDeps } from '../jev/resolve-live';
import { queryEmbedClient } from '../product-mcp/embed/client';
import { knowledgeVectorsRepository, productMcpRepository } from '../product-mcp/product-mcp.repository';
import { productMcpService } from '../product-mcp/product-mcp.service';
import { searchByMeaning, type Meaning } from '../product-mcp/search-meaning';
import { evalAccess } from './access.repository';
import type { EvalSearchDeps } from './eval-search-route';
import type { SearchRelevantDeps } from './relevant-route';

// The eval set's real dependencies (PRD omni-loop-8 s3): SEARCH_CATEGORIZE_SECRET (server only, shared with
// omni-app), the resolver, and the service role reading a product's knowledge as its MCP server reads it
// (../product-mcp/product-mcp.service.ts) and searching it as the MCP does (searchByMeaning, the same model and
// vectors). Nothing here writes: no search log row, no vector but the ones the MCP's search keeps itself.
type Env = Pick<ArcadeEnv, 'searchCategorizeSecret' | 'supabase' | 'serviceRole' | 'secretsMasterKey'>;

const warn = (message: string): void => { log.error({ event: 'search-eval', outcome: 'failed', message }); };

/** The product's knowledge as its MCP reads it, or null when the product is not the workspace's. */
async function readKnowledge(workspaceId: string, productId: string) {
  const db = serviceDb();
  const access = await evalAccess(db, workspaceId, productId);
  return access === null ? null : productMcpService(productMcpRepository(db)).read(access);
}

/** The model and the vectors the MCP searches by, or null where this deployment has none (the words search then). */
function meaningHere(): Meaning | null {
  const supabase = supabaseEnv();
  const serviceRole = serverEnv().serviceRole;
  if (supabase === null || serviceRole === null) return null;
  return {
    embedder: queryEmbedClient({ url: supabase.url, serviceRoleKey: serviceRole.key }),
    vectors: knowledgeVectorsRepository(serviceDb()),
  };
}

export function searchRelevantDeps(env: Env = serverEnv()): SearchRelevantDeps {
  return {
    secret: env.searchCategorizeSecret ?? undefined,
    jev: jevDecideDeps(env),
    entriesOf: async (workspaceId, productId, ids) => {
      const read = await readKnowledge(workspaceId, productId);
      if (read === null) return null;
      const wanted = new Set(ids);
      return read.entries.filter((entry) => wanted.has(entry.id)).map((entry) => ({ id: entry.id, title: entry.title, text: entry.body }));
    },
  };
}

export function evalSearchDeps(env: Env = serverEnv()): EvalSearchDeps {
  return {
    secret: env.searchCategorizeSecret ?? undefined,
    search: async (workspaceId, productId, question) => {
      const read = await readKnowledge(workspaceId, productId);
      if (read === null) return null;
      const found = await searchByMeaning(read.entries, { query: question }, workspaceId, meaningHere(), warn);
      return { ids: found.hits.map((hit) => hit.id), mode: found.mode ?? 'words' };
    },
  };
}
