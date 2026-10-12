// The Omni page's `LoopReads` (PRD 1665): every read is a `GET <ask.url>/api/loop/*` with the
// terminal's sign-in (`omni signin`, or the kit token `OMNI_TOKEN`), given 15 seconds. The page alone
// knows the code host. A read that cannot be made throws a `LoopReadError` with the spec's line:
//
//   no sign-in (omni signin)                        no sign-in, or it was refused
//   unreachable                                     no answer within the limit, or no network
//   refused (403|424|429): <the page's words>       this repository only
//   refused (404): <the page's words>               a change or an issue the repository does not have
//   refused (404): this Omni page cannot read the loop yet   a page without the loop's routes
//   the Omni page answered outside the loop's contract (<path>)   an answer the contract does not read
//
// A missing change is told from a missing route by the page's own `{error}` (settled item s1-03): a page
// without the routes answers a bare 404.
import type { z } from 'zod';
import { AskCallError } from '../ask/client.ts';
import type { Fetch, TokenStore } from '../ask/client.ts';
import { signedInClient } from '../ask/credentials.ts';
import { LoopChangeDetailSchema, LoopChangesSchema, LoopCommentsSchema, LoopIssueDetailSchema, LoopIssuesSchema } from './contract.ts';
import { LoopReadError } from './port.ts';
import type { ChangesQuery, IssuesQuery, LoopReads } from './port.ts';

/** How long one of the loop's reads may take. */
const LOOP_READ_MS = 15_000;

const NO_SIGN_IN = 'no sign-in (omni signin)';
const UNREACHABLE = 'unreachable';
const NO_OMNI_PAGE = 'no Omni page is set here (ask.url)';
const NO_LOOP_ROUTES = 'this Omni page cannot read the loop yet';
const UNREADABLE_ANSWER = "the Omni page answered outside the loop's contract";

/** The statuses that refuse one repository only: another repository may still read. */
const REPOSITORY_STATUSES = new Set([403, 424, 429]);

/** What a refusal says when the page gave no words of its own, by status. */
function plainRefusal(status: number, repo: string): string {
  if (status === 403) return `${repo} is not in your workspace`;
  if (status === 424) return `the Omni app cannot read ${repo}`;
  if (status === 429) return `the code host's budget for ${repo} is spent`;
  if (status === 404) return NO_LOOP_ROUTES;
  return `the Omni page answered ${status}`;
}

/** The page's words as one line, without the closing full stop the spec's lines do not carry. */
const unstopped = (reason: string): string => reason.replace(/\.$/, '');

/** The one line `error`, thrown by the ask client reading `repo`, stops on. */
function lineOf(error: AskCallError, repo: string): LoopReadError {
  const { status, reason } = error;
  if (status === null) return new LoopReadError(error.message.startsWith('not signed in') ? NO_SIGN_IN : UNREACHABLE, 'everything');
  if (status === 401) return new LoopReadError(NO_SIGN_IN, 'everything');
  const words = reason === null ? plainRefusal(status, repo) : unstopped(reason);
  // A 404 with the page's words is a change or an issue the repository does not have: that repository only.
  const scope = REPOSITORY_STATUSES.has(status) || (status === 404 && reason !== null) ? 'repository' : 'everything';
  return new LoopReadError(`refused (${status}): ${words}`, scope);
}

/** Only the filters given, as text: an absent one is never sent. */
function queryOf(fields: Record<string, string | number | undefined>): Record<string, string> {
  return Object.fromEntries(Object.entries(fields).flatMap(([key, value]) => (value === undefined ? [] : [[key, String(value)]])));
}

/**
 * The `LoopReads` of the Omni page at `askUrl` (null: none is set here), signed in with `tokens` when
 * given, else the kit token or the sign-in kept in `home`.
 */
export function omniLoopReads({ askUrl, tokens, home, fetch = globalThis.fetch, callMs = LOOP_READ_MS }: {
  askUrl: string | null;
  tokens?: TokenStore | undefined;
  home?: string | undefined;
  fetch?: Fetch | undefined;
  callMs?: number | undefined;
}): LoopReads {
  const client = askUrl ? signedInClient({ askUrl, tokens, home, fetch, callMs }) : null;

  async function read<T>(path: string, query: Record<string, string | number | undefined>, schema: z.ZodType<T>): Promise<T> {
    if (!askUrl) throw new LoopReadError(NO_OMNI_PAGE, 'everything');
    if (client === null) throw new LoopReadError(NO_SIGN_IN, 'everything');
    const repo = String(query.repo);
    let body: unknown;
    try {
      body = await client.readLoop(path, queryOf(query));
    } catch (error) {
      if (error instanceof AskCallError) throw lineOf(error, repo);
      throw error;
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) throw new LoopReadError(`${UNREADABLE_ANSWER} (${path})`, 'everything');
    return parsed.data;
  }

  return {
    changes: async ({ repo, base, head, label, state }: ChangesQuery) => (await read('changes', { repo, base, head, label, state }, LoopChangesSchema)).changes,
    change: (repo, number) => read(`changes/${number}`, { repo }, LoopChangeDetailSchema),
    comments: async (repo, on) => (await read('comments', { repo, on }, LoopCommentsSchema)).comments,
    issues: async ({ repo, label, state }: IssuesQuery) => (await read('issues', { repo, label, state }, LoopIssuesSchema)).issues,
    issue: (repo, number) => read(`issues/${number}`, { repo }, LoopIssueDetailSchema),
  };
}
