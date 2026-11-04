// `omni check knowledge` verifies the Legal entries a rule serves (PRD 1795, s5). The offline grade
// (`check-knowledge.ts`) only accepts the shape `L-<CODE>-<n>`; this reads the product's knowledge as
// `omni kb legal` does (the read becomes the local copy) and never blocks on the network.
//
// - No served `L-` id: nothing is read, nothing is printed.
// - No sign-in, or the page unreachable: a note, no violation.
// - An id the page does not list as active: a violation. The business read answers active entries
//   only, so a retired id and an unknown one read the same here.
// - A repository of no product: a violation naming it, when the server answers so.
// - The business laws (PRD 2632) ride the same read: a folder or `Also:` key off the product's domain
//   list, an avoid word and a law outside the law home are violations when the server answers; the page
//   unreachable, no sign-in or no product is a note for them, as for a Legal entry. No law, no served id:
//   nothing is read.
import { signedInClient } from '../ask/credentials.ts';
import { mainCheckout } from '../dossier/local.ts';
import { messageOf } from '../narrow.ts';
import { NOTHING_READ, productKnowledge, type ProductKnowledge } from '../product/knowledge.ts';
import type { Fetch, TokenStore } from '../ask/client.ts';
import type { Context, ExecText } from '../context.ts';
import type { KnowledgeEntry } from './registers.ts';
import { servedLegalIds } from './check-knowledge.ts';
import { readBusinessLaws, type BusinessLaw } from './business-laws.ts';
import { verifyBusinessLaws } from './check-knowledge-business.ts';

/** What a test hands the check beyond its own io: the sign-in, the app and the clock. */
export type LegalReach = {
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch | undefined;
  callMs?: number | undefined;
  now?: (() => Date) | undefined;
};

export type LegalVerdict = { violations: string[]; notes: string[] };

const NONE: LegalVerdict = { violations: [], notes: [] };

/** The note for what could not be verified, one per thing there is to verify: the Legal entries served, the business laws held. */
function unverified(reason: string, { legal, laws }: { legal: boolean; laws: boolean }): string[] {
  return [...(legal ? [`Legal not verified: ${reason}`] : []), ...(laws ? [`Business laws not verified: ${reason}`] : [])];
}

/** The violations and notes for every `L-` id the entries serve, and for the business laws the checkout holds. */
export async function verifyServedLegal({ ctx, entries, cwd, exec, reach }: {
  ctx: Context;
  entries: readonly KnowledgeEntry[];
  cwd: string;
  exec: ExecText;
  reach: LegalReach;
}): Promise<LegalVerdict> {
  const served = servedLegalIds(entries);
  const laws = readBusinessLaws({ ctx });
  if (served.length === 0 && laws.length === 0) return NONE;
  const asked = { legal: served.length > 0, laws: laws.length > 0 };
  const askUrl = ctx.config.ask.url;
  const repo = ctx.config.repo.slug;
  if (!askUrl || !repo) return { violations: [], notes: unverified('not signed in', asked) };
  const client = signedInClient({ askUrl, tokens: reach.tokens, home: reach.home, fetch: reach.fetch ?? globalThis.fetch, callMs: reach.callMs });
  if (client === null) return { violations: [], notes: unverified('not signed in', asked) };
  try {
    const read = await productKnowledge({
      repo,
      root: mainCheckout(cwd, exec) ?? ctx.root,
      now: reach.now ?? (() => new Date()),
      fetchBusiness: () => client.readBusiness(repo),
    });
    // The last copy is never judged: only an answer the server gives can fail the check.
    if (read.from === 'copy') return { violations: [], notes: unverified('page unreachable', asked) };
    return judged(read, { served, laws, repo });
  } catch (error) {
    return stopped(messageOf(error), { served, laws });
  }
}

/** What the server's answer fails: a served id the product does not hold, and each business law the read refuses. */
function judged(read: ProductKnowledge, { served, laws, repo }: { served: ReturnType<typeof servedLegalIds>; laws: readonly BusinessLaw[]; repo: string }): LegalVerdict {
  const held = new Set(read.legal.map(({ id }) => id));
  const legal = served
    .filter(({ id }) => !held.has(id))
    .map(({ id, entry }) => `${entry.file}: ${entry.id} — serves ${id}, which product ${read.product} does not hold.`);
  const business = verifyBusinessLaws(laws, { repo, domains: read.domains, glossary: read.glossary, lawHome: read.lawHome });
  return { violations: [...legal, ...business.violations], notes: business.notes };
}

/** What a read that stopped means: an outage is a note, a repository of no product a violation for each served id. */
function stopped(reason: string, { served, laws }: { served: ReturnType<typeof servedLegalIds>; laws: readonly BusinessLaw[] }): LegalVerdict {
  const asked = { legal: served.length > 0, laws: laws.length > 0 };
  if (reason === NOTHING_READ) return { violations: [], notes: unverified('page unreachable', asked) };
  if (!/belongs to no product/.test(reason)) return { violations: [], notes: unverified(reason, asked) };
  return {
    violations: served.map(({ id, entry }) => `${entry.file}: ${entry.id} — serves ${id}, but this repository belongs to no product.`),
    notes: asked.laws ? ['Business laws not verified: this repository belongs to no product'] : [],
  };
}
