// What the judge route reads of a repository's product (PRD 2632 s5; ADR-0095), on the client it is given, the
// service role's: the product's business (`business_for_repo_app`: its law home, glossary and domains), then the
// newest knowledge pack of its law home. Every answer is parsed where it comes in; it holds no rule. A refusal,
// or an answer out of shape, throws: the route answers 500 and the gate reads it as neutral.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { knowledgePacksRepository } from '../knowledge-packs/knowledge-packs.repository';
import type { RepoLaws } from './judge-route';
import { lawHomeOf } from './law-home';

const ReadSchema = z.looseObject({
  lawHome: z.string().nullish(),
  glossary: z.array(z.object({ term: z.string().min(1), avoid: z.array(z.string()), domains: z.array(z.string()).optional() })).nullish(),
  domains: z.array(z.object({ key: z.string().min(1), name: z.string() })).nullish(),
});

/** The service role's reads: the product's business, and the tables of the knowledge packs. */
export type LawsReadDb = Pick<SupabaseClient, 'rpc' | 'from'>;

/** The newest pack of `home`, or null with none yet; throws when it cannot be read. */
async function newestPack(db: LawsReadDb, home: string): Promise<RepoLaws['pack']> {
  const packs = knowledgePacksRepository(db);
  const pack = await packs.pack(home, null);
  if (!pack.ok) throw new Error(`the pack of ${home} could not be read`);
  if (pack.value === null) return null;
  const files = await packs.files(pack.value.id);
  if (!files.ok) throw new Error(`the files of the pack of ${home} could not be read`);
  return { sha: pack.value.sha, files: files.value.map(({ path, content }) => ({ path, content })) };
}

/** What the product of `repo` holds for the judge, as the service role `db` reads it. */
export async function readRepoLaws(db: LawsReadDb, repo: string): Promise<RepoLaws> {
  const { data, error } = await db.rpc('business_for_repo_app', { p_repo: repo });
  if (error) throw new Error(`the database refused: ${error.message}`);
  const read = ReadSchema.safeParse(data ?? {});
  if (!read.success) throw new Error('business_for_repo_app answered out of shape');
  const home = lawHomeOf(read.data);
  return { home, pack: home === null ? null : await newestPack(db, home), glossary: read.data.glossary ?? [], domains: read.data.domains ?? [] };
}
