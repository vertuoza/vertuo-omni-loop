// Which store a PRD's outbox lives in, by the PRD's birthplace (PRD 1548): a product PRD (`mobile-12`)
// lives on the server, so its outbox is the `server` store's rows on the Omni page (slice s7); every
// PRD of a repository, ◇ or ◆, keeps its outbox in git, the `git` store, exactly as before (s6).
import { signedInClient } from '../ask/credentials.ts';
import type { Fetch, TokenStore } from '../ask/client.ts';
import { dossierSwitch } from '../config.ts';
import type { Context } from '../context.ts';
import { isProductPrdId } from '../ids.ts';
import { gitOutboxStore } from './git-store.ts';
import { OutboxServerError, serverOutboxStore } from './server-store.ts';
import type { OutboxServerClient } from './server-store.ts';
import type { OutboxPrd, OutboxStore } from './store.ts';

/** How the `server` store signs in: the token store, the home it is read from, the `fetch` and the
 * timeout of a call, and the clock of the held line; each left out takes the kit's own. */
export type OutboxSignIn = {
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch | undefined;
  callMs?: number | undefined;
  now?: (() => number) | undefined;
};

/** The Omni page's client, signed in, or the error that says why there is none: dossiers off here, or
 * nobody signed in. */
function serverClient(ctx: Context, { tokens, home, fetch = globalThis.fetch, callMs }: OutboxSignIn): OutboxServerClient {
  const toggle = dossierSwitch(ctx.config);
  if (!toggle.on) throw new OutboxServerError(`a product PRD's outbox lives on the Omni page, and dossiers are off here (${toggle.reason})`, 401);
  const client = signedInClient({ askUrl: toggle.askUrl, tokens, home, fetch, callMs });
  if (client === null) throw new OutboxServerError('a product PRD\'s outbox lives on the Omni page: sign in first (omni signin)', 401);
  return client;
}

/** The store every outbox verb of the repository `ctx` reads and writes PRD `prd`'s outbox through:
 * the `server` store for a product PRD, signed in through `signIn`, else the `git` store, which is also
 * the store of a verb that names no PRD. */
export function outboxStore(ctx: Context, prd: OutboxPrd | null = null, signIn: OutboxSignIn = {}): OutboxStore {
  if (prd === null || !isProductPrdId(prd)) return gitOutboxStore(ctx);
  return serverOutboxStore({ ctx, connect: () => serverClient(ctx, signIn), now: signIn.now ?? Date.now });
}
