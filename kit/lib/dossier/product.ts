// A PRD's product, as its dossier on the Omni page names it (PRD 1364, s6): the `product:` line of
// `omni prd <n>`. The product lives on the server, set when the PRD is born (its dossier's first push)
// and changed on its page, so the lookup the kit already makes, `GET /api/dossiers?repo=&prd=`, answers it
// by its name, or null.
//
// - Dossiers off here (`dossier.enabled` false, or no `ask.url`): no line, and nothing is called. A
//   repository that never sends its PRDs to the Omni page has no product to read.
// - `product: <name>` for a dossier with a product; `product: none` for one with none, or a PRD with no
//   dossier yet (404).
// - `product: unknown (<why>)` when it cannot tell: no repository slug, no sign-in, the page unreachable,
//   or its refusal. It never fails the command that prints it.
import { AskCallError } from '../ask/client.ts';
import type { Fetch, TokenStore } from '../ask/client.ts';
import { signedInClient } from '../ask/credentials.ts';
import { dossierSwitch } from '../config.ts';
import type { Context } from '../context.ts';
import type { PrdNumber } from '../ids.ts';
import { propertyOf } from '../narrow.ts';

/** What reading the product is made of beyond the context: a test hands in its own. */
type ProductLineOptions = { tokens?: TokenStore | undefined; home?: string | undefined; fetch?: Fetch | undefined; callMs?: number | undefined };

const unknownLine = (why: string): string => `product: unknown (${why})`;

/** Why a failed lookup could not tell the product, or null when it says the PRD has no dossier. */
function failed(error: unknown): string | null {
  if (!(error instanceof AskCallError)) throw error;
  if (error.status === 404) return null;
  return error.status === null ? 'unreachable' : `refused (${error.status})`;
}

/** PRD `prd`'s `product:` line, or null when dossiers are off here. */
export async function productLine(ctx: Context, prd: PrdNumber, { tokens, home, fetch = globalThis.fetch, callMs }: ProductLineOptions = {}): Promise<string | null> {
  const toggle = dossierSwitch(ctx.config);
  if (!toggle.on) return null;
  const repo = ctx.config.repo.slug;
  if (!repo) return unknownLine('no repository slug: repo.slug');
  const client = signedInClient({ askUrl: toggle.askUrl, tokens, home, fetch, callMs });
  if (!client) return unknownLine('no sign-in: omni signin');
  let found: unknown;
  try {
    found = await client.findDossier({ repo, prd });
  } catch (error) {
    const why = failed(error);
    return why === null ? 'product: none' : unknownLine(why);
  }
  const name = propertyOf(found, 'product');
  return `product: ${typeof name === 'string' && name.trim() !== '' ? name : 'none'}`;
}
