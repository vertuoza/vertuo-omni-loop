// `omni check knowledge` verifies the Legal entries a rule serves (PRD 1795, s5). The offline grade
// (`check-knowledge.ts`) only accepts the shape `L-<CODE>-<n>`; this reads the product's knowledge as
// `omni kb legal` does (the read becomes the local copy) and never blocks on the network.
//
// - No served `L-` id: nothing is read, nothing is printed.
// - No sign-in, or the page unreachable: a note, no violation.
// - An id the page does not list as active: a violation. The business read answers active entries
//   only, so a retired id and an unknown one read the same here.
// - A repository of no product: a violation naming it, when the server answers so.
import { signedInClient } from '../ask/credentials.ts';
import { mainCheckout } from '../dossier/local.ts';
import { messageOf } from '../narrow.ts';
import { NOTHING_READ, productKnowledge } from '../product/knowledge.ts';
import type { Fetch, TokenStore } from '../ask/client.ts';
import type { Context, ExecText } from '../context.ts';
import type { KnowledgeEntry } from './registers.ts';
import { servedLegalIds } from './check-knowledge.ts';

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

/** The violations and notes for every `L-` id the entries serve. */
export async function verifyServedLegal({ ctx, entries, cwd, exec, reach }: {
  ctx: Context;
  entries: readonly KnowledgeEntry[];
  cwd: string;
  exec: ExecText;
  reach: LegalReach;
}): Promise<LegalVerdict> {
  const served = servedLegalIds(entries);
  if (served.length === 0) return NONE;
  const askUrl = ctx.config.ask.url;
  const repo = ctx.config.repo.slug;
  if (!askUrl || !repo) return { violations: [], notes: ['Legal not verified: not signed in'] };
  const client = signedInClient({ askUrl, tokens: reach.tokens, home: reach.home, fetch: reach.fetch ?? globalThis.fetch, callMs: reach.callMs });
  if (client === null) return { violations: [], notes: ['Legal not verified: not signed in'] };
  try {
    const read = await productKnowledge({
      repo,
      root: mainCheckout(cwd, exec) ?? ctx.root,
      now: reach.now ?? (() => new Date()),
      fetchBusiness: () => client.readBusiness(repo),
    });
    // The last copy is never judged: only an answer the server gives can fail the check.
    if (read.from === 'copy') return { violations: [], notes: ['Legal not verified: page unreachable'] };
    const held = new Set(read.legal.map(({ id }) => id));
    const violations = served
      .filter(({ id }) => !held.has(id))
      .map(({ id, entry }) => `${entry.file}: ${entry.id} — serves ${id}, which product ${read.product} does not hold.`);
    return { violations, notes: [] };
  } catch (error) {
    const reason = messageOf(error);
    if (reason === NOTHING_READ) return { violations: [], notes: ['Legal not verified: page unreachable'] };
    if (/belongs to no product/.test(reason)) {
      return {
        violations: served.map(({ id, entry }) => `${entry.file}: ${entry.id} — serves ${id}, but this repository belongs to no product.`),
        notes: [],
      };
    }
    return { violations: [], notes: [`Legal not verified: ${reason}`] };
  }
}
