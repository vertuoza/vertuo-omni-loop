import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { knowledgePacksRepository } from '../../knowledge-packs/knowledge-packs.repository';
import { knowledgePacksService } from '../../knowledge-packs/knowledge-packs.service';
import { githubStore } from '../../dossier/github/server';
import { omniSettingsRepository } from '../../omni-settings/omni-settings.repository';
import { settingsGithub } from '../../omni-settings/omni-settings.github';
import { appCredentials } from '../../signup/github-app';
import { knowledgeReader } from '../constituents/knowledge-reader';
import { demoRepositories } from './repositories-demo';
import { productRepositoriesOf } from './repositories.repository';
import { readSettingsLevel } from './settings-level';
import { readRepositories, type PackRead, type RepositoriesData, type RepositoriesReads } from './repositories-section';

// The Repositories section's read (PRD 2419 s1), as the signed-in person, so row-level security decides
// what it returns: the product's repositories and plan repository, then the newest knowledge pack of each
// (knowledge-packs.service.ts, PRD 2011), a pack of another workspace reading as none (BR-PRODUCT-63).
// The Omni settings level is the workspace's settings repository, read as the Omni app (settings-level.ts,
// PRD 2419 s2): one it cannot read leaves the level empty and the pages read the kit default. Anything else
// that cannot be read leaves the section saying so. In the demo, its in-memory section.

/** The newest pack of `repository` as the caller reads it, through the knowledge packs' service. */
function packReader(db: SupabaseClient): PackRead {
  const service = knowledgePacksService(knowledgePacksRepository(db));
  return async (repository) => {
    const read = await service.read({ repo: repository });
    if (read.ok) return { ok: true, pack: { sha: read.value.sha, committedAt: read.value.committedAt, files: read.value.files } };
    return read.kind === 'missing' ? { ok: true, pack: null } : { ok: false };
  };
}

/** The Omni settings level for the workspace listing `anchor`, empty when the Omni app is not configured here. */
async function settingsOf(db: SupabaseClient, anchor: string | null) {
  try {
    const github = settingsGithub(appCredentials(), fetch, Date.now, githubStore());
    return await readSettingsLevel(anchor, omniSettingsRepository(db), github);
  } catch (error) {
    log.error({ event: 'product-knowledge-repositories', outcome: 'settings-unread', message: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/** The section's reads: the product's repositories once, the packs, and the Omni settings level of its workspace. */
async function reads(db: SupabaseClient, product: string): Promise<RepositoriesReads> {
  const held = await productRepositoriesOf(db, product);
  const anchor = held === null ? null : (held.plan ?? held.repositories[0] ?? null);
  return { held: () => Promise.resolve(held), pack: packReader(db), settings: await settingsOf(db, anchor) };
}

/** The product's Repositories section, or null when it cannot be read. */
export async function loadRepositoriesData(product: string): Promise<RepositoriesData | null> {
  const reader = await knowledgeReader();
  if (reader.kind === 'demo') return demoRepositories(product);
  if (reader.kind !== 'database') return null;
  const { db } = reader;
  const read = await readRepositories(product, await reads(db, product));
  if (read.ok) return read.data;
  log.error({ event: 'product-knowledge-repositories', outcome: 'failed', message: `${read.unread} could not be read` });
  return null;
}
