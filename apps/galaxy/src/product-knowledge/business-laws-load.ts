import 'server-only';
import { cache } from 'react';
import { log } from 'omni-loop/kit/lib/log/log.ts';
import { lawOwnerParts, parseConfig } from 'omni-loop/kit/lib/config.ts';
import { lawsOfPackFiles } from '../business-laws/law-home';
import { knowledgePacksRepository, type FileRow, type KnowledgePacksDb } from '../knowledge-packs/knowledge-packs.repository';
import { knowledgeReader } from './constituents/knowledge-reader';
import { lawCountOf, lawHomeOfRepositories, noHomeWhy, type LawsRead } from './business-laws-section';
import type { KnowledgeTabView } from './KnowledgeTab';
import { productRepositoriesOf } from './repositories/repositories.repository';

// What the Business laws section reads (PRD 2632 s6), as the signed-in person, so row-level security decides
// what each read returns (BR-PRODUCT-63): the product's repositories, then the newest knowledge pack of its
// law home (its plan repository, else its only repository). A pack is merged law only: a pull request's
// change to a law shows nothing here. The knowledge folder and the owners come from the config the pack holds.
// Nothing is written. A read that fails is `unreadable`, and the section says so.

const CONFIG_PATH = '.omni-loop/config.yml';

/** Where the pack's knowledge folder is and who owns the laws, from its config; the defaults when it has none or cannot be read. */
function configOf(files: readonly FileRow[], home: string): { knowledgeRoot: string | undefined; owners: string[] } {
  const config = files.find((file) => file.path === CONFIG_PATH);
  if (config === undefined) return { knowledgeRoot: undefined, owners: [] };
  try {
    const read = parseConfig(config.content, `${home}:${CONFIG_PATH}`, { ignoreUnknownKeys: true });
    return { knowledgeRoot: read.paths.knowledge.replace(/^\.\/+/, '').replace(/\/+$/, ''), owners: read.laws.owners.map((entry) => lawOwnerParts(entry).owner) };
  } catch {
    return { knowledgeRoot: undefined, owners: [] };
  }
}

/** The laws of `home`'s newest pack, as `db` reads it. */
export async function readLawsOf(db: KnowledgePacksDb, home: string): Promise<LawsRead> {
  const packs = knowledgePacksRepository(db);
  const pack = await packs.pack(home, null);
  if (!pack.ok) return { state: 'none', why: 'unreadable' };
  if (pack.value === null) return { state: 'none', why: 'no-pack' };
  const files = await packs.files(pack.value.id);
  if (!files.ok) return { state: 'none', why: 'unreadable' };
  const { knowledgeRoot, owners } = configOf(files.value, home);
  return { state: 'read', home, sha: pack.value.sha, laws: lawsOfPackFiles(files.value, knowledgeRoot), owners };
}

/** A fictional law for the demo, so the section can be seen without a database. */
const DEMO: LawsRead = {
  state: 'read',
  home: 'demo/widgets',
  sha: '0000000000000000000000000000000000000000',
  owners: ['anna'],
  laws: [{
    id: 'BL-INVOICING-1', statement: 'An invoice can be sent only when its total including tax is above zero.',
    why: 'A customer who receives an empty invoice stops trusting the contractor.', also: [], scope: 'domain', domain: 'invoicing',
    file: '.omni-loop/knowledge/domains/invoicing/business-laws.md', problems: [],
  }],
};

async function readLaws(product: string): Promise<LawsRead> {
  const reader = await knowledgeReader();
  if (reader.kind === 'demo') return DEMO;
  if (reader.kind !== 'database') return { state: 'none', why: 'unreadable' };
  try {
    const repositories = await productRepositoriesOf(reader.db, product);
    if (repositories === null) return { state: 'none', why: 'unreadable' };
    const home = lawHomeOfRepositories(repositories);
    return home === null ? { state: 'none', why: noHomeWhy(repositories) } : await readLawsOf(reader.db, home);
  } catch (error) {
    log.error({ event: 'product-knowledge-business-laws', outcome: 'failed', message: error instanceof Error ? error.message : String(error) });
    return { state: 'none', why: 'unreadable' };
  }
}

/** One read per request, whichever of the sub-menu, the section and a domain's page asks first. */
export const loadBusinessLaws = cache(readLaws);

/** A page's view with the number of business laws put on its tab, once the product was read and its laws too. */
export async function loadLawCount(view: KnowledgeTabView): Promise<KnowledgeTabView> {
  if (view.kind !== 'tab') return view;
  const count = lawCountOf(await loadBusinessLaws(view.tab.product.id));
  return count === null ? view : { ...view, tab: { ...view.tab, businessLaws: count } };
}
