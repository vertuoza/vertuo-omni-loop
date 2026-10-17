// A product's knowledge (PRD 1795, s4): the Legal entries and glossary terms the business read
// (`GET /api/business?repo=`) answers as `legal` and `glossary`, for `omni kb legal` and
// `omni kb glossary`.
//
// - A reply from before the page held either sends neither: both read as `[]`.
// - Each read is kept in `.omni-loop/local/product-knowledge.json` (`{ product, readAt, legal,
//   glossary }`), the way `targets.ts` keeps `product-targets.json`. When the server cannot be reached
//   (no answer within the client's 5 seconds, or a 5xx), the copy is read instead, said by
//   `unreachableLine`; with no copy, the read stops with `NOTHING_READ`.
// - A refusal (a 4xx: no sign-in, not a member, no such product) is never hidden behind the copy: the
//   read stops with the server's reason.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { AskCallError } from '../ask/client.ts';
import { ensureLocalDir, LOCAL_DIR } from '../ask/local-state.ts';

export const PRODUCT_KNOWLEDGE_FILE = join(LOCAL_DIR, 'product-knowledge.json');

const LegalSchema = z.object({ id: z.string().min(1), statement: z.string(), source: z.string(), owner: z.string() });
const TermSchema = z.object({ term: z.string().min(1), meaning: z.string(), avoid: z.array(z.string()) });

/** One active Legal entry, as the business read carries it. */
export type LegalEntry = z.infer<typeof LegalSchema>;
/** One glossary term, as the business read carries it. */
export type GlossaryTerm = z.infer<typeof TermSchema>;

/** The business read, as far as the product's knowledge goes. */
const ReplySchema = z.object({
  product: z.object({ name: z.string().min(1) }).nullable().optional(),
  legal: z.array(LegalSchema).optional(),
  glossary: z.array(TermSchema).optional(),
});

const CopySchema = z.object({
  product: z.string(),
  readAt: z.iso.datetime(),
  legal: z.array(LegalSchema),
  glossary: z.array(TermSchema),
});

/** What a read gives: the knowledge, and whether it came from the server or the last copy. */
export type ProductKnowledge = { product: string; legal: LegalEntry[]; glossary: GlossaryTerm[] };
export type ProductKnowledgeRead = ({ from: 'server' } | { from: 'copy'; readAt: string }) & ProductKnowledge;

export const NOTHING_READ = 'no product knowledge: the Omni page is unreachable and nothing was read yet';

/** The reply's knowledge; throws, naming the repository, when it is not a business read or names no product. */
export function knowledgeOfReply(reply: unknown, repo: string): ProductKnowledge {
  const parsed = ReplySchema.safeParse(reply);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`the Omni page answered no product knowledge for ${repo}: ${issue ? `${issue.path.join('.')} ${issue.message}` : 'out of shape'}`);
  }
  const { product, legal = [], glossary = [] } = parsed.data;
  if (!product) throw new Error(`no product knowledge: ${repo} belongs to no product on the Omni page`);
  return { product: product.name, legal, glossary };
}

function readCopy(root: string): (ProductKnowledge & { readAt: string }) | null {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(join(root, PRODUCT_KNOWLEDGE_FILE), 'utf8'));
  } catch {
    return null;
  }
  const kept = CopySchema.safeParse(value);
  return kept.success ? kept.data : null;
}

/** Whether a failed call means the server did not answer: no reply in time, or a failure on its side. */
const unanswered = (error: AskCallError): boolean => error.status === null || error.status >= 500;

/**
 * The knowledge of `repo`'s product: the server's (`fetchBusiness` calls the business read), kept
 * under `root` at `now`, or the last copy when the server does not answer. Throws with the one line to
 * print otherwise.
 */
export async function productKnowledge({ repo, root, now, fetchBusiness }: {
  repo: string;
  root: string;
  now: () => Date;
  fetchBusiness: () => Promise<unknown>;
}): Promise<ProductKnowledgeRead> {
  let reply: unknown;
  try {
    reply = await fetchBusiness();
  } catch (error) {
    if (!(error instanceof AskCallError)) throw error;
    if (unanswered(error)) {
      const copy = readCopy(root);
      if (copy === null) throw new Error(NOTHING_READ);
      return { from: 'copy', ...copy };
    }
    throw new Error(`the Omni page refused the product knowledge of ${repo} (${error.status}): ${error.reason ?? error.message}`);
  }
  const known = knowledgeOfReply(reply, repo);
  ensureLocalDir(root);
  writeFileSync(join(root, PRODUCT_KNOWLEDGE_FILE), `${JSON.stringify({ ...known, readAt: now().toISOString() }, null, 2)}\n`);
  return { from: 'server', ...known };
}

/** The line that says the knowledge is the last read's, and when it was. */
export function unreachableLine(readAt: string): string {
  return `last read ${readAt.slice(0, 10)}: the Omni page is unreachable`;
}

/** One line per active Legal entry: id, sentence, source, owner. */
export const legalLines = (legal: readonly LegalEntry[]): string[] =>
  legal.map(({ id, statement, source, owner }) => `${id}  ${statement}  (source: ${source}; owner: @${owner})`);

/** One line per glossary term: term, meaning, words to avoid. */
export const glossaryLines = (glossary: readonly GlossaryTerm[]): string[] =>
  glossary.map(({ term, meaning, avoid }) => `${term}: ${meaning}  (avoid: ${avoid.length > 0 ? avoid.join(', ') : 'none'})`);
