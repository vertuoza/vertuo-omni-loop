import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { knowledgePacksRepository } from '../../knowledge-packs/knowledge-packs.repository';
import { knowledgePacksService } from '../../knowledge-packs/knowledge-packs.service';
import { knowledgeReader } from '../constituents/knowledge-reader';
import { demoRepositories } from './repositories-demo';
import { productRepositoriesOf } from './repositories.repository';
import { readRepositories, type PackRead, type RepositoriesData } from './repositories-section';

// The Repositories section's read (PRD 2419 s1), as the signed-in person, so row-level security decides
// what it returns: the product's repositories and plan repository, then the newest knowledge pack of each
// (knowledge-packs.service.ts, PRD 2011), a pack of another workspace reading as none (BR-PRODUCT-63).
// The Omni settings level is not read yet (PRD 2419 s2): the pages above the plan repository read the kit
// default. Anything that cannot be read leaves the section saying so. In the demo, its in-memory section.

/** The newest pack of `repository` as the caller reads it, through the knowledge packs' service. */
function packReader(db: SupabaseClient): PackRead {
  const service = knowledgePacksService(knowledgePacksRepository(db));
  return async (repository) => {
    const read = await service.read({ repo: repository });
    if (read.ok) return { ok: true, pack: { sha: read.value.sha, committedAt: read.value.committedAt, files: read.value.files } };
    return read.kind === 'missing' ? { ok: true, pack: null } : { ok: false };
  };
}

/** The product's Repositories section, or null when it cannot be read. */
export async function loadRepositoriesData(product: string): Promise<RepositoriesData | null> {
  const reader = await knowledgeReader();
  if (reader.kind === 'demo') return demoRepositories(product);
  if (reader.kind !== 'database') return null;
  const { db } = reader;
  const read = await readRepositories(product, { held: () => productRepositoriesOf(db, product), pack: packReader(db), settings: null });
  if (read.ok) return read.data;
  log.error({ event: 'product-knowledge-repositories', outcome: 'failed', message: `${read.unread} could not be read` });
  return null;
}
