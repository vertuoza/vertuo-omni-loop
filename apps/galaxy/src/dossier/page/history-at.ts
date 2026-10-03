// The short address of a PRD's questions (PRD 251, s10): /prd/at/<owner>/<repo>/<n>, which the kit's
// outbox comment writes knowing only the repository and the PRD. It names the dossier whose home
// repository and PRD they are, among the ones dossier_list() gives the viewer (row-level security has
// left out every other workspace), and lands on its Outbox tab; a dossier of another workspace reads
// exactly like one that never was: not found. Signed out, the page's GitHub sign-in comes back to the
// same short address through its own callback (atSignInReturn). Ported from the first build's s4
// (tag archive/outbox-answers-v1), which found the dossier through a query this page no longer has.
import type { Exchange, Join } from '../../ask/page/sign-in';
import type { DossierListRow } from '../store';
import { historySignInReturn } from './sign-in';
import { dossierPath } from './view';
import { type PrdNumber, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

/** A PRD of a repository, as the short address names it. */
export type AtKey = { owner: string; repo: string; prd: PrdNumber };

const NAME = /^[\w.-]{1,100}$/;
const PRD = /^[1-9]\d{0,8}$/;

const decode = (part: string) => {
  try {
    return decodeURIComponent(part);
  } catch {
    return '';
  }
};

/** The PRD an address names, or null when it names none. */
export function readAt({ owner, repo, n }: { owner: string; repo: string; n: string }): AtKey | null {
  const [o, r] = [decode(owner), decode(repo)];
  const named = (part: string) => NAME.test(part) && part !== '.' && part !== '..';
  if (!named(o) || !named(r) || !PRD.test(n)) return null;
  return { owner: o, repo: r, prd: parsePrd(n) };
}

export const atPath = (key: AtKey) => `/prd/at/${encodeURIComponent(key.owner)}/${encodeURIComponent(key.repo)}/${key.prd}`;

/** Where GitHub sends the person back after signing in on the short address. */
export const atCallbackPath = (key: AtKey) => `${atPath(key)}/callback`;

/** The dossier's Outbox tab. */
export const outboxTabPath = (id: string) => `${dossierPath(id)}?tab=outbox`;

/** The id of the dossier the key names among `rows` (the viewer's), or null: its home repository (in lower
 * case, as dossier_list() gives it) and its PRD. */
export function findAt(rows: readonly DossierListRow[], key: AtKey): string | null {
  const repo = `${key.owner}/${key.repo}`.toLowerCase();
  return rows.find((row) => row.prd === key.prd && row.home_repo.toLowerCase() === repo)?.id ?? null;
}

/** Where the short address's sign-in callback sends the person: back to the same short address, carrying
 * the reason when the sign-in was refused; to /prd when the address names no PRD. */
export async function atSignInReturn(url: URL, origin: string, key: AtKey | null, exchange: Exchange | null, join: Join | null): Promise<string> {
  const back = new URL(await historySignInReturn(url, origin, exchange, join));
  if (key) back.pathname = atPath(key);
  return back.toString();
}
