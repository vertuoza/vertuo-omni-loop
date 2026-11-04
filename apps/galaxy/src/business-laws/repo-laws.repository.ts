// What the judge route reads of a repository's product (PRD 2632 s5; ADR-0095), on the client it is given, the
// service role's: the product's business (`business_for_repo_app`: its law home, glossary and domains). The
// answer is parsed where it comes in; it holds no rule. A refusal, or an answer out of shape, throws: the route
// answers 500 and the gate reads it as neutral.
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import type { RepoLaws } from './judge-route';
import { lawHomeOf } from './law-home';

const ReadSchema = z.looseObject({
  lawHome: z.string().nullish(),
  glossary: z.array(z.object({ term: z.string().min(1), avoid: z.array(z.string()), domains: z.array(z.string()).optional() })).nullish(),
  domains: z.array(z.object({ key: z.string().min(1), name: z.string() })).nullish(),
});

/** What the repository's product reads: its law home (lower case, or null), glossary and domains. */
export type ProductRead = Pick<RepoLaws, 'home' | 'glossary' | 'domains'>;

/** The product of `repo` as the service role `db` reads it; a repository of no product has no home. */
export async function businessOf(db: Pick<SupabaseClient, 'rpc'>, repo: string): Promise<ProductRead> {
  const answer: { data: unknown; error: { message: string } | null } = await db.rpc('business_for_repo_app', { p_repo: repo });
  if (answer.error) throw new Error(`the database refused: ${answer.error.message}`);
  const read = ReadSchema.safeParse(answer.data ?? {});
  if (!read.success) throw new Error('business_for_repo_app answered out of shape');
  return { home: lawHomeOf(read.data), glossary: read.data.glossary ?? [], domains: read.data.domains ?? [] };
}
