// The page check's facts (PRD 1990, spec section 5): the sign-in to the Omni page, and how old its
// constituents copy is.
//
// - Off (no `ask.url`, or the repository's dossier switch off): `n/a · no Omni page`, green.
// - The sign-in is the one `omni signin` keeps for the host of `ask.url` (or `OMNI_TOKEN`). One whose
//   access token ran out is still a sign-in while a refresh token can renew it; the read below shows
//   whether the page still honours it (a 401 reads as not signed in).
// - Signed in, it refreshes the constituents copy the way `omni constituents` does, within that
//   command's 3 s budget for the whole read, and keeps the copy it reads. `answering` says the page
//   replied in time; `syncedAt` is then the copy's own time, so a page that does not answer leaves
//   the copy as old as it was.
//
// - It also refreshes the local Omni-settings copy (`../omni-settings/sync.ts`), whatever the
//   constituents read says; that copy never changes the check's facts.
//
// Nothing here throws: a failure is a fact, never a finding of its own.
import { homeTokens } from '../ask/client-tokens.ts';
import { askClient, AskCallError } from '../ask/client.ts';
import type { Fetch, TokenStore } from '../ask/client.ts';
import { credentialsHost } from '../ask/credentials.ts';
import { readCache, writeCache } from '../constituents/cache.ts';
import { constituentsOf } from '../constituents/read.ts';
import { dossierSwitch } from '../config.ts';
import { refreshSettingsCopy } from '../omni-settings/sync.ts';
import type { GatherIo, PageFacts } from './facts.ts';

/** The refresh's budget: `omni constituents`'s own. */
const PAGE_BUDGET_MS = 3000;

/** What a test hands the gatherer: the token store, the page's fetch, the budget. */
export type PageDeps = { tokens?: TokenStore; fetch?: Fetch; budgetMs?: number };

/** The no-page answer. */
const NO_PAGE = { na: 'no Omni page' } as const;

/** Whether an access token carries an `expires_at` already passed (seconds as the page gives it, or milliseconds). */
function lapsed(expiresAt: unknown, now: number): boolean {
  if (typeof expiresAt !== 'number') return false;
  return (expiresAt < 1e12 ? expiresAt * 1000 : expiresAt) <= now;
}

/** Whether the store holds a sign-in for `host` that can still be used: one whose access token ran out needs a refresh token. */
function signedInTo(store: TokenStore, host: string, now: number): boolean {
  const entry = store.read(host);
  if (entry === null) return false;
  const refresh = entry.refresh_token;
  return !lapsed(entry.expires_at, now) || (typeof refresh === 'string' && refresh !== '');
}

/** The constituents read within `budgetMs`: `true` once it was kept, `'refused'` for a 401, `false` otherwise. */
async function refreshed(deps: Required<PageDeps>, { askUrl, host, repo, root, now }: { askUrl: string; host: string; repo: string; root: string; now: number }): Promise<boolean | 'refused'> {
  const controller = new AbortController();
  const bounded: Fetch = (url, init) => deps.fetch(url, { ...init, signal: init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal });
  const client = askClient({ baseUrl: askUrl, host, tokens: deps.tokens, fetch: bounded });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new AskCallError('GET /api/constituents: timed out'));
    }, deps.budgetMs);
  });
  try {
    const read = constituentsOf(await Promise.race([client.readConstituents(repo), late]));
    if (read === null) return false;
    try {
      writeCache(root, { repo, syncedAt: new Date(now).toISOString(), read });
    } catch {
      // An unwritable copy leaves the page check reading the old one: the next run tries again.
    }
    return true;
  } catch (error) {
    return error instanceof AskCallError && error.status === 401 ? 'refused' : false;
  } finally {
    clearTimeout(timer);
  }
}

/** The page check's facts, with the token store and the page's `fetch` handed in. */
export async function gatherPage(io: GatherIo, deps: PageDeps = {}): Promise<PageFacts> {
  const page = dossierSwitch(io.config);
  const repo = io.config.repo.slug;
  if (!page.on) return NO_PAGE;
  const askUrl = page.askUrl;
  const host = credentialsHost(askUrl);
  const tokens = deps.tokens ?? homeTokens();
  const copy = repo ? readCache(io.root, repo) : null;
  const copyAt = copy === null ? null : Date.parse(copy.syncedAt);
  const kept = copyAt !== null && Number.isFinite(copyAt) ? copyAt : null;
  if (!signedInTo(tokens, host, io.now)) return { signedIn: false, syncedAt: kept, answering: false };
  if (!repo) return { signedIn: true, syncedAt: kept, answering: false };
  const reach = { tokens, fetch: deps.fetch ?? globalThis.fetch, budgetMs: deps.budgetMs ?? PAGE_BUDGET_MS };
  // The Omni-settings copy (PRD 2417) is refreshed beside the constituents, each within its own budget.
  const [read] = await Promise.all([
    refreshed(reach, { askUrl, host, repo, root: io.root, now: io.now }),
    refreshSettingsCopy({ ...reach, askUrl, host, repo, root: io.root, now: io.now }),
  ]);
  if (read === 'refused') return { signedIn: false, syncedAt: kept, answering: false };
  return { signedIn: true, syncedAt: read ? io.now : kept, answering: read };
}

export const pageFacts = (io: GatherIo): Promise<PageFacts> => gatherPage(io);
