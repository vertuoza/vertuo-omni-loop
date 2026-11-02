import 'server-only';
import { cache } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { knowledgePacksRepository } from '../knowledge-packs/knowledge-packs.repository';
import { knowledgePacksService } from '../knowledge-packs/knowledge-packs.service';
import { knowledgeReader } from './constituents/knowledge-reader';
import { foundDomains, type FoundDomains, type RepositoryFolders } from './found-domains';
import { readRepositoryFolders, type PackFiles } from './found-domains-read';
import type { KnowledgeTabView } from './KnowledgeTab';
import type { KnowledgeTab } from './product-knowledge.contract';
import { productRepositoriesOf } from './repositories/repositories.repository';

// What Not on the list reads (PRD 2583 s3), as the signed-in person, so row-level security decides what
// each read returns (BR-PRODUCT-63): the product's repositories and plan repository, then the newest
// knowledge pack of each, the way the Repositories section reads them (found-domains-read.ts). A stranger
// or a member of another workspace reads no repository and no pack, so no folder name. Nothing is written
// and no check fails. In the demo there is nothing to read. A read that fails is `null`: the region says so
// and the sub-menu shows no count of it.

/** The newest pack of a repository, as the caller reads it, through the knowledge packs' service. */
const packFilesOf = (db: SupabaseClient): PackFiles => {
  const service = knowledgePacksService(knowledgePacksRepository(db));
  return async (repository) => {
    const read = await service.read({ repo: repository });
    if (read.ok) return { ok: true, files: read.value.files };
    return read.kind === 'missing' ? { ok: true, files: null } : { ok: false };
  };
};

const unreadable = (error: unknown): null => {
  log.error({ event: 'product-knowledge-domains', outcome: 'failed', message: error instanceof Error ? error.message : String(error) });
  return null;
};

/** The folders of every repository of `product` and of its plan repository; null when unreadable. */
async function readFolders(product: string): Promise<RepositoryFolders[] | null> {
  const reader = await knowledgeReader();
  if (reader.kind !== 'database') return reader.kind === 'demo' ? [] : null;
  return readRepositoryFolders(() => productRepositoriesOf(reader.db, product), packFilesOf(reader.db)).catch(unreadable);
}

/** One read per request, whichever of the sub-menu and the Domains section asks first. */
const foldersOfProduct = cache(readFolders);

/** The folders of `tab`'s product that its list of domains does not hold; null when they could not be read. */
export async function loadFoundDomains(tab: KnowledgeTab): Promise<FoundDomains | null> {
  const folders = await foldersOfProduct(tab.product.id);
  return folders === null ? null : foundDomains(tab.domains.entries, folders);
}

/** A page's view with the number of folders off the list put on its tab, once the product was read and the folders too. */
export async function loadNotOnList(view: KnowledgeTabView): Promise<KnowledgeTabView> {
  const found = view.kind === 'tab' ? await loadFoundDomains(view.tab) : null;
  return view.kind === 'tab' && found !== null ? { ...view, tab: { ...view.tab, notOnList: found.count } } : view;
}
