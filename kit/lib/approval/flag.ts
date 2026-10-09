// The phase-0 flag of a repository (PRD 1299, item s7-01): where its new PRDs are born, read from its
// row on the Omni page (`GET /api/repositories/phase0`). `server` means born on the server (◆),
// approved on the PRD's page; `pr` means born in the repository (◇), approved by a phase-0 PR. Any
// reading that is not a clear answer is `pr`, with why, so a brainstorm falls back to today's way.
import { z } from 'zod';
import { askClient, AskCallError } from '../ask/client.ts';
import type { Fetch, TokenStore } from '../ask/client.ts';
import { homeTokens } from '../ask/client-tokens.ts';
import { credentialsHost } from '../ask/credentials.ts';

/** The flag, and why it fell back to `pr` (null when the page answered it). */
export type FlagReading = { flag: 'pr' | 'server'; why: string | null };

const fallback = (why: string): FlagReading => ({ flag: 'pr', why });

/** The flag route's reply. */
const FlagReplySchema = z.object({ phase0: z.enum(['pr', 'server']) });

/** Asks the flag through `call` and reads its reply. */
export async function flagReading(call: () => Promise<unknown>): Promise<FlagReading> {
  let body: unknown;
  try {
    body = await call();
  } catch (error) {
    if (!(error instanceof AskCallError)) throw error;
    return fallback(error.status === null ? 'unreachable' : `refused (${error.status})`);
  }
  const reply = FlagReplySchema.safeParse(body);
  return reply.success ? { flag: reply.data.phase0, why: null } : fallback('malformed reply');
}

/** The flag of `repo` (owner/name) in production: the flag route of `askUrl`, with the terminal's
 * sign-in (`tokens`, else the one kept in `home`). With no Omni page set or no sign-in it calls
 * nothing and falls back, saying why. */
export function readFlag(
  askUrl: string | null,
  { repo, tokens, home, fetch, callMs }: { repo: string; tokens?: TokenStore | undefined; home?: string | undefined; fetch?: Fetch | undefined; callMs?: number | undefined },
): Promise<FlagReading> {
  if (!askUrl) return Promise.resolve(fallback('no Omni page is set here (ask.url)'));
  const host = credentialsHost(askUrl);
  const store = tokens ?? homeTokens(home ? { home } : undefined);
  if (!store.read(host)) return Promise.resolve(fallback('no sign-in (omni signin)'));
  const client = askClient({ baseUrl: askUrl, host, tokens: store, fetch, ...(callMs ? { callMs } : {}) });
  return flagReading(() => client.readPhase0Flag(repo));
}
