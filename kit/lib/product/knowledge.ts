// A product's knowledge (PRD 1795, s4): the Legal entries and glossary terms the business read
// (`GET /api/business?repo=`) answers as `legal` and `glossary`, for `omni kb legal` and
// `omni kb glossary`.
//
// - A reply from before the page held either sends neither: both read as `[]`. The product's domains
//   (PRD 2583) and each term's `domains` ride the same read; a reply or a copy without them is a product
//   that lists none. So does the product's law home (PRD 2632), the `owner/name` of the repository its
//   business laws live in: a reply or a copy without the key is a product with none.
// - Each read is kept in `.omni-loop/local/product-knowledge.json` (`{ product, readAt, legal,
//   glossary, personas }`; `personas` is the name and stance of each, PRD 2299, and a copy without it still reads), the way `targets.ts` keeps `product-targets.json`. When the server cannot be reached
//   (no answer within the client's 5 seconds, or a 5xx), the copy is read instead, said by
//   `unreachableLine`; with no copy, the read stops with `NOTHING_READ`.
// - An archived product (PRD 2232) is an answer too: the read stops with `product <name> is archived: …`, the
//   copy neither read nor rewritten.
// - A refusal (a 4xx: no sign-in, not a member, no such product) is never hidden behind the copy: the
//   read stops with the server's reason.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { AskCallError } from '../ask/client.ts';
import { ensureLocalDir, LOCAL_DIR } from '../ask/local-state.ts';

export const PRODUCT_KNOWLEDGE_FILE = join(LOCAL_DIR, 'product-knowledge.json');

const LegalSchema = z.object({ id: z.string().min(1), statement: z.string(), source: z.string(), owner: z.string() });
// A term's domains are optional: a reply or a copy from before PRD 2583 has none, and a term naming none is cross-domain.
const TermSchema = z.object({ term: z.string().min(1), meaning: z.string(), avoid: z.array(z.string()) }).extend({ domains: z.array(z.string()).optional() });
const DomainSchema = z.object({ key: z.string().min(1), name: z.string(), meaning: z.string() });
const PersonaSchema = z.object({ name: z.string().min(1), stance: z.string() });

/** One active Legal entry, as the business read carries it. */
export type LegalEntry = z.infer<typeof LegalSchema>;
/** One glossary term, as the business read carries it. */
export type GlossaryTerm = z.infer<typeof TermSchema>;

/** One persona of the product, as the copy keeps it: its name and stance (PRD 2299). */
export type KnowledgePersona = z.infer<typeof PersonaSchema>;

/** One active domain of the product, as the business read carries it (PRD 2583): its key, name and meaning. */
export type KnowledgeDomain = z.infer<typeof DomainSchema>;

/** The business read, as far as the product's knowledge goes. */
const ReplySchema = z.object({
  state: z.string().optional(),
  product: z.object({ name: z.string().min(1) }).nullable().optional(),
  legal: z.array(LegalSchema).optional(),
  glossary: z.array(TermSchema).optional(),
  // Only the name and stance are kept; a persona the page sends out of shape is left out, never a refusal.
  personas: z.array(z.unknown()).optional(),
  // Like a persona, a domain out of shape is left out, never a refusal.
  domains: z.array(z.unknown()).optional(),
  // The law home (PRD 2632): a reply out of shape here reads as none, never a refusal.
  lawHome: z.unknown().optional(),
});

const CopySchema = z.object({
  product: z.string(),
  readAt: z.iso.datetime(),
  legal: z.array(LegalSchema),
  glossary: z.array(TermSchema),
  // A copy from before PRD 2299 has none: it still reads, with no persona.
  personas: z.array(PersonaSchema).default([]),
  // A copy from before PRD 2583 has none: it still reads, with no domains.
  domains: z.array(DomainSchema).optional(),
  // A copy from before PRD 2632 has none: it reads as no law home.
  lawHome: z.string().nullable().optional(),
});

/** What a read gives: the knowledge, and whether it came from the server or the last copy. */
export type ProductKnowledge = { product: string; legal: LegalEntry[]; glossary: GlossaryTerm[]; personas?: KnowledgePersona[] | undefined; domains?: KnowledgeDomain[] | undefined; lawHome?: string | null | undefined };
export type ProductKnowledgeRead = ({ from: 'server' } | { from: 'copy'; readAt: string }) & ProductKnowledge;

/** The one line for a product an owner archived (PRD 2232): an answer, not an outage, so no copy is served for it. */
export const archivedLine = (name: string): string => `product ${name} is archived: an owner restores it on its page`;

/** Why a read stopped, for the one line it prints: `state` tells an answer (archived, no product, refused) from an outage. */
export class KnowledgeStop extends Error {
  readonly state: 'archived' | 'none' | 'unreachable' | 'refused';
  constructor(state: KnowledgeStop['state'], message: string) {
    super(message);
    this.name = 'KnowledgeStop';
    this.state = state;
  }
}

export const NOTHING_READ = 'no product knowledge: the Omni page is unreachable and nothing was read yet';

/** The reply's knowledge; throws, naming the repository, when it is not a business read or names no product. */
export function knowledgeOfReply(reply: unknown, repo: string): ProductKnowledge {
  const parsed = ReplySchema.safeParse(reply);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new KnowledgeStop('refused', `the Omni page answered no product knowledge for ${repo}: ${issue ? `${issue.path.join('.')} ${issue.message}` : 'out of shape'}`);
  }
  const { state, product, legal = [], glossary = [], personas = [], domains, lawHome } = parsed.data;
  if (state === 'archived' && product) throw new KnowledgeStop('archived', archivedLine(product.name));
  if (!product) throw new KnowledgeStop('none', `no product knowledge: ${repo} belongs to no product on the Omni page`);
  const kept = personas.flatMap((one) => {
    const persona = PersonaSchema.safeParse(one);
    return persona.success ? [{ name: persona.data.name, stance: persona.data.stance }] : [];
  });
  const listed = domains?.flatMap((one) => {
    const domain = DomainSchema.safeParse(one);
    return domain.success ? [domain.data] : [];
  });
  return {
    product: product.name,
    legal,
    glossary,
    personas: kept,
    ...(listed === undefined ? {} : { domains: listed }),
    ...(typeof lawHome === 'string' && lawHome !== '' ? { lawHome: lawHome.toLowerCase() } : {}),
  };
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

/** What the last copy on disk holds, read without a network call (PRD 1797): none, one that does not read, or its knowledge. */
export type CachedKnowledge = { state: 'absent' } | { state: 'unreadable' } | ({ state: 'cached'; readAt: string } & ProductKnowledge);

/** The copy kept under `root`, never the server: `absent` with no file, `unreadable` when the file is not a copy. */
export function readCachedKnowledge(root: string): CachedKnowledge {
  let text: string;
  try {
    text = readFileSync(join(root, PRODUCT_KNOWLEDGE_FILE), 'utf8');
  } catch {
    return { state: 'absent' };
  }
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { state: 'unreadable' };
  }
  const kept = CopySchema.safeParse(value);
  return kept.success ? { state: 'cached', ...kept.data } : { state: 'unreadable' };
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
      if (copy === null) throw new KnowledgeStop('unreachable', NOTHING_READ);
      return { from: 'copy', ...copy };
    }
    throw new KnowledgeStop('refused', `the Omni page refused the product knowledge of ${repo} (${error.status}): ${error.reason ?? error.message}`);
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

/** One line per glossary term: term, meaning, words to avoid, and the domains it names when it names any. */
export const glossaryLines = (glossary: readonly GlossaryTerm[]): string[] =>
  glossary.map(({ term, meaning, avoid, domains = [] }) =>
    `${term}: ${meaning}  (avoid: ${avoid.length > 0 ? avoid.join(', ') : 'none'})${domains.length > 0 ? `  (domains: ${domains.join(', ')})` : ''}`);

/** The line of an empty list: no domain is on the product's list yet. */
export const NO_DOMAINS_LINE = 'the product lists no domains yet';

/** One line per active domain: key, name, meaning. */
export const domainLines = (domains: readonly KnowledgeDomain[]): string[] =>
  domains.length === 0 ? [NO_DOMAINS_LINE] : domains.map(({ key, name, meaning }) => `${key}  ${name}: ${meaning}`);
