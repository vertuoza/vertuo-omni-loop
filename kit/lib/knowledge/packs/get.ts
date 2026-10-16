// `omni kb pack get <repo>` (PRD 2011, s12), apart from the command line: fetches the newest pack,
// keeps it (`./store.ts`) and says where, with these rules.
//
// - The server answers: the pack is written read-only and its folder is printed.
// - The server does not answer (no reply in time, or a 5xx): the newest pack already fetched is printed
//   with its sha and age, `held`, and nothing else is written. With none fetched yet, the read stops.
// - A refusal (4xx: no sign-in, not a member, another workspace's repository, no pack) is never hidden
//   behind a pack kept earlier: the read stops with the server's reason.
// - A pack older than the link's `read_at` is refused, never used (the design's section 3): the read
//   stops with `pack stale: <sha> < read_at <sha>`, and prints no folder.
import { join } from 'node:path';
import { AskCallError } from '../../ask/client.ts';
import { messageOf } from '../../narrow.ts';
import { ageOf, newestPack, PackReplySchema, packName, staleLine, writePack } from './store.ts';
import type { LocalPack } from './store.ts';

/** Whether a pack's commit is `behind` the commit a link was read at, `ok` when it is not, or `unknown`. */
export type PackOrder = 'behind' | 'ok' | 'unknown';

/** What `pack get` needs beyond the checkout: the server, the order of two commits and the clock. */
export type PackGetInput = {
  root: string;
  /** `owner/name`. */
  repo: string;
  /** The commit the product link was read at, when known. */
  readAt: string | null;
  fetchPack: () => Promise<unknown>;
  order: (packSha: string, readAt: string) => PackOrder;
  now: () => Date;
};

/** What it prints and its exit code: lines for stdout, lines for stderr. */
export type PackGetResult = { code: number; out: string[]; err: string[] };

const unanswered = (error: AskCallError): boolean => error.status === null || error.status >= 500;

/** The stale refusal for `pack`, or null. */
function staleness(pack: LocalPack, { readAt, order }: Pick<PackGetInput, 'readAt' | 'order'>): { line: string | null; note: string | null } {
  if (readAt === null || pack.sha === readAt) return { line: null, note: null };
  const how = order(pack.sha, readAt);
  if (how === 'behind') return { line: staleLine(pack.sha, readAt), note: null };
  return { line: null, note: how === 'unknown' ? `read_at ${readAt.slice(0, 7)} could not be compared with the pack, so its age against the link is not checked` : null };
}

export async function packGet(input: PackGetInput): Promise<PackGetResult> {
  const { root, repo, now } = input;
  let pack: LocalPack;
  const held: string[] = [];
  try {
    const reply = PackReplySchema.safeParse(await input.fetchPack());
    if (!reply.success) return { code: 1, out: [], err: [`the server answered a pack of ${repo} out of shape: ${reply.error.issues[0]?.path.join('.') ?? ''}`] };
    pack = writePack(root, reply.data);
  } catch (error) {
    if (!(error instanceof AskCallError)) return { code: 1, out: [], err: [messageOf(error)] };
    if (!unanswered(error)) return { code: 1, out: [], err: [`the server refused the pack of ${repo} (${error.status}): ${error.reason ?? error.message}`] };
    const newest = newestPack(root, repo);
    if (newest === null) return { code: 1, out: [], err: [`no pack of ${packName(repo)}: the server is unreachable and nothing was fetched yet`] };
    pack = newest;
    held.push(`held · server unreachable · newest pack fetched: ${pack.sha} · ${ageOf(pack.committedAt, now())} old`);
  }
  const { line, note } = staleness(pack, input);
  if (line !== null) return { code: 1, out: [], err: [line] };
  return { code: 0, out: [join(root, pack.folder), ...held], err: note === null ? [] : [note] };
}
