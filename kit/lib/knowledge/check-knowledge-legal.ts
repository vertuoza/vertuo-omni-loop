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
// - The law variants (PRD 3375) ride it too: each `legal` id of `product/law-variants.json` is verified as
//   a served one is, named by the file and its JSON path. A file that does not read is the offline grade's
//   to refuse, so its ids are not asked. A file over 512 KiB is a warning among the notes, read or not.
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
import { LAW_VARIANTS_WARN_BYTES, readLawVariants } from './law-variants.ts';

/** What a test hands the check beyond its own io: the sign-in, the app and the clock. */
export type LegalReach = {
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch | undefined;
  callMs?: number | undefined;
  now?: (() => Date) | undefined;
};

export type LegalVerdict = { violations: string[]; notes: string[] };

/** A Legal id the knowledge names, and where: `<file>: <entry id>` that serves it, or `<file>: <JSON path>` that names it. */
type NamedLegal = { id: string; where: string; verb: 'serves' | 'names' };

/** The note for what could not be verified, one per thing there is to verify: the Legal entries named, the business laws held. */
function unverified(reason: string, { legal, laws }: { legal: boolean; laws: boolean }): string[] {
  return [...(legal ? [`Legal not verified: ${reason}`] : []), ...(laws ? [`Business laws not verified: ${reason}`] : [])];
}

/** The violations and notes for every `L-` id the entries serve or the law variants name, and for the business laws the checkout holds. */
export async function verifyServedLegal({ ctx, entries, cwd, exec, reach }: {
  ctx: Context;
  entries: readonly KnowledgeEntry[];
  cwd: string;
  exec: ExecText;
  reach: LegalReach;
}): Promise<LegalVerdict> {
  const variants = readLawVariants({ ctx });
  const named: NamedLegal[] = [
    ...servedLegalIds(entries).map(({ id, entry }) => ({ id, where: `${entry.file}: ${entry.id}`, verb: 'serves' as const })),
    ...(variants.state === 'read'
      ? variants.variants.variants.flatMap(({ legal }, at) => legal.map((id, n) => ({ id, where: `${variants.file}: variants[${String(at)}].legal[${String(n)}]`, verb: 'names' as const })))
      : []),
  ];
  const verdict = await verifyOnline({ ctx, named, cwd, exec, reach });
  const big = variants.state !== 'none' && (variants.bytes ?? 0) > LAW_VARIANTS_WARN_BYTES;
  const warning = big
    ? [`warning: ${variants.file}: ${String(Math.floor((variants.bytes ?? 0) / 1024))} KiB — over 512 KiB: a pack leaves out a file over 1 MiB, and the Omni page would not see it.`]
    : [];
  return { violations: verdict.violations, notes: [...warning, ...verdict.notes] };
}

/** The signed-in client of the Omni page and this repository's slug; `null` with no page, no slug or no sign-in. */
function productClient(ctx: Context, reach: LegalReach) {
  const askUrl = ctx.config.ask.url;
  const repo = ctx.config.repo.slug;
  if (!askUrl || !repo) return null;
  const client = signedInClient({ askUrl, tokens: reach.tokens, home: reach.home, fetch: reach.fetch ?? globalThis.fetch, callMs: reach.callMs });
  return client === null ? null : { client, repo };
}

/** The product's answer for the named Legal ids and the business laws; nothing is read when there is neither. */
async function verifyOnline({ ctx, named, cwd, exec, reach }: {
  ctx: Context;
  named: readonly NamedLegal[];
  cwd: string;
  exec: ExecText;
  reach: LegalReach;
}): Promise<LegalVerdict> {
  const laws = readBusinessLaws({ ctx });
  if (named.length === 0 && laws.length === 0) return { violations: [], notes: [] };
  const asked = { legal: named.length > 0, laws: laws.length > 0 };
  const signedIn = productClient(ctx, reach);
  if (signedIn === null) return { violations: [], notes: unverified('not signed in', asked) };
  const { client, repo } = signedIn;
  try {
    const read = await productKnowledge({
      repo,
      root: mainCheckout(cwd, exec) ?? ctx.root,
      now: reach.now ?? (() => new Date()),
      fetchBusiness: () => client.readBusiness(repo),
    });
    // The last copy is never judged: only an answer the server gives can fail the check.
    if (read.from === 'copy') return { violations: [], notes: unverified('page unreachable', asked) };
    return judged(read, { named, laws, repo });
  } catch (error) {
    return stopped(messageOf(error), { named, laws });
  }
}

/** What the server's answer fails: a named id the product does not hold, and each business law the read refuses. */
function judged(read: ProductKnowledge, { named, laws, repo }: { named: readonly NamedLegal[]; laws: readonly BusinessLaw[]; repo: string }): LegalVerdict {
  const held = new Set(read.legal.map(({ id }) => id));
  const legal = named
    .filter(({ id }) => !held.has(id))
    .map(({ id, where, verb }) => `${where} — ${verb} ${id}, which product ${read.product} does not hold.`);
  const business = verifyBusinessLaws(laws, { repo, domains: read.domains, glossary: read.glossary, lawHome: read.lawHome });
  return { violations: [...legal, ...business.violations], notes: business.notes };
}

/** What a read that stopped means: an outage is a note, a repository of no product a violation for each named id. */
function stopped(reason: string, { named, laws }: { named: readonly NamedLegal[]; laws: readonly BusinessLaw[] }): LegalVerdict {
  const asked = { legal: named.length > 0, laws: laws.length > 0 };
  if (reason === NOTHING_READ) return { violations: [], notes: unverified('page unreachable', asked) };
  if (!/belongs to no product/.test(reason)) return { violations: [], notes: unverified(reason, asked) };
  return {
    violations: named.map(({ id, where, verb }) => `${where} — ${verb} ${id}, but this repository belongs to no product.`),
    notes: asked.laws ? ['Business laws not verified: this repository belongs to no product'] : [],
  };
}
