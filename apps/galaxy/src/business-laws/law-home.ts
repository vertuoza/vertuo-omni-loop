// A product's business laws, read from its law home (PRD 2632): the newest knowledge pack of the repository
// its laws live in (`lawHome` of the business read: the plan repository when set, else the only repository).
// A pack is what the App kept when the law home's default branch last merged, so what is read here is merged
// law only: a pull request's unmerged change to a law changes nothing (N-PRODUCT-4).
//
// It reads on the caller's own client, so row-level security has the last word: a member reads the packs
// of their own workspaces only, and a member of another workspace reads none (BR-PRODUCT-63). It holds no
// rule of the laws themselves: the one parser of the kit does (`kit/lib/knowledge/business-laws.ts`), run on
// the pack's files, never the imported copies of a plan repository (`repos/<target>/`).
import type { BusinessLaw } from 'omni-loop/kit/lib/knowledge/business-laws.ts';
import { lawsOfPackFiles } from 'omni-loop/kit/lib/knowledge/entries.ts';
import { knowledgePacksRepository, type KnowledgePacksDb } from '../knowledge-packs/knowledge-packs.repository';

/** Why a product's laws were not read: it has no law home, its pack is not there (yet) or the read failed. */
export type LawsNone = 'no-law-home' | 'no-pack' | 'unreadable';

/** The laws of a product at its law home's newest pack, or why there are none to judge against. */
export type ProductLaws =
  | { state: 'read'; home: string; sha: string; committedAt: string; laws: BusinessLaw[] }
  | { state: 'none'; why: LawsNone; home: string | null };

/** The `lawHome` of a business read as the kit reads it: a repository slug, else none (an older reply has no key). */
export function lawHomeOf(read: { lawHome?: string | null | undefined }): string | null {
  const home = read.lawHome;
  return typeof home === 'string' && home !== '' ? home.toLowerCase() : null;
}

export { lawsOfPackFiles };

/** What a product's laws are at `home`: the newest pack's, as the caller reads it. */
export async function readProductLaws({ db, home, knowledgeRoot }: { db: KnowledgePacksDb; home: string | null; knowledgeRoot?: string | undefined }): Promise<ProductLaws> {
  if (home === null) return { state: 'none', why: 'no-law-home', home };
  const packs = knowledgePacksRepository(db);
  const pack = await packs.pack(home, null);
  if (!pack.ok) return { state: 'none', why: 'unreadable', home };
  if (pack.value === null) return { state: 'none', why: 'no-pack', home };
  const files = await packs.files(pack.value.id);
  if (!files.ok) return { state: 'none', why: 'unreadable', home };
  return { state: 'read', home, sha: pack.value.sha, committedAt: pack.value.committed_at, laws: lawsOfPackFiles(files.value, knowledgeRoot) };
}
