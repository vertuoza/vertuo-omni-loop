import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { serviceDb } from '../data/sign-in-live';
import { serverEnv, type ArcadeEnv } from '../env';
import { knowledgePacksRepository } from '../knowledge-packs/knowledge-packs.repository';
import type { BusinessLawsRouteDeps, RepoLaws } from './judge-route';
import { lawHomeOf } from './law-home';
import { lawsModelFromEnv } from './model';

// The business laws judge route's real dependencies (./judge-route.ts, PRD 2632 s5): BUSINESS_LAWS_JUDGE_SECRET
// (server only, shared with omni-app), the service role reading the product of the repository
// (`business_for_repo_app`: its law home, glossary and domains) and the newest pack of its law home, and
// OpenRouter judging (OPENROUTER_API_KEY; without it every spec is not judged, and says why). Each is read per
// call.

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

export function businessLawsJudgeDeps(env: Pick<ArcadeEnv, 'businessLawsJudgeSecret' | 'openrouter'> = serverEnv()): BusinessLawsRouteDeps {
  return { secret: env.businessLawsJudgeSecret ?? undefined, read: (repo) => readRepoLaws(serviceDb(), repo), ask: lawsModelFromEnv(env.openrouter) };
}
