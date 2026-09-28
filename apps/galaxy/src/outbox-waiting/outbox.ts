// The outbox part of the waiting list (PRD 499, s2): GET /api/waiting/outbox. For the signed-in person,
// the numbered dossiers they opened (row-level security keeps them to their workspaces), newest first,
// at most MAX_DOSSIERS; for each, the shared GitHub reader's summary (cached 60 s per dossier), whose
// open outbox items ranked human-action or high are kept while the PRD's feature PR is open. `unread`
// counts the dossiers whose summary, feature PR or outbox could not be read. It reads as the person
// (their cookie session), never with a service key (ADR-0032).
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GithubReader } from '../dossier/github/reader';
import { UNREAD, type GithubSummary, type OutboxItem } from '../dossier/github/summary';

/** The most dossiers one call reads, so its GitHub reads are bounded. */
export const MAX_DOSSIERS = 30;

/** The ranks that hold the gate: the only ones that wait on a person. */
const WAITING_RANKS: ReadonlySet<OutboxItem['rank']> = new Set(['human-action', 'high']);

/** An outbox item waiting on the person. `id` is the dossier's id and the item's own, joined by `:`, so
 * two PRDs' items never share one; `title` is the PRD's. */
export type WaitingOutboxItem = {
  id: string;
  prd: number;
  dossierId: string;
  title: string;
  rank: 'human-action' | 'high';
  question: string;
};

export type WaitingOutbox = { items: WaitingOutboxItem[]; unread: number };

/** What the route needs of a dossier. */
export type WaitingDossier = { id: string; home_repo: string; prd: number; title: string };

/** What the route needs of the Supabase client: who is signed in, and the dossiers table. */
export type WaitingDb = {
  auth: { getUser(): Promise<{ data: { user: { id: string } | null } }> };
  from: SupabaseClient['from'];
};

export type WaitingDeps = {
  /** The client acting as the signed-in person; throws when there is no database. */
  db: () => Promise<WaitingDb>;
  /** The server's one GitHub reader; null when none is configured. */
  reader: () => GithubReader | null;
};

/** A dossier's waiting items from its summary, in the outbox's order, and whether it could not be read. */
export function waitingItems(dossier: WaitingDossier, summary: GithubSummary | null): { items: WaitingOutboxItem[]; unread: boolean } {
  if (summary === null || summary.feature === UNREAD || summary.outbox === UNREAD) return { items: [], unread: true };
  if (summary.feature?.state !== 'open' || !summary.outbox) return { items: [], unread: false };
  const items = summary.outbox.open
    .filter((item) => WAITING_RANKS.has(item.rank))
    .map((item) => ({
      id: `${dossier.id}:${item.id}`,
      prd: dossier.prd,
      dossierId: dossier.id,
      title: dossier.title,
      rank: item.rank as WaitingOutboxItem['rank'],
      question: item.question,
    }));
  return { items, unread: false };
}

const json = (status: number, body: unknown) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

async function signedIn(deps: WaitingDeps): Promise<{ db: WaitingDb; user: string } | null> {
  try {
    const db = await deps.db();
    const { data: { user } } = await db.auth.getUser();
    return user ? { db, user: user.id } : null;
  } catch (error) {
    console.error(`Waiting outbox: nobody can sign in: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/** GET /api/waiting/outbox → 200 WaitingOutbox, or 401 { error } signed out. */
export async function waitingOutbox(deps: WaitingDeps): Promise<Response> {
  const who = await signedIn(deps);
  if (!who) return json(401, { error: 'Sign in to see what waits for you.' });

  const { data, error } = await who.db.from('dossiers').select('id, home_repo, prd, title')
    .eq('opened_by', who.user).not('prd', 'is', null)
    .order('created_at', { ascending: false }).limit(MAX_DOSSIERS);
  if (error) {
    console.error(`Waiting outbox: the dossiers could not be read: ${error.message}`);
    return json(500, { error: 'The dossiers could not be read.' });
  }
  const dossiers = ((data ?? []) as WaitingDossier[]).filter((d) => typeof d.prd === 'number');

  const reader = deps.reader();
  if (!reader) return json(200, { items: [], unread: dossiers.length } satisfies WaitingOutbox);

  const read = await Promise.all(dossiers.map(async (dossier) => {
    let summary: GithubSummary | null;
    try {
      summary = await reader.summary(dossier);
    } catch (error) {
      console.error(`Waiting outbox: PRD ${dossier.prd} could not be read: ${error instanceof Error ? error.message : String(error)}`);
      summary = null;
    }
    return { dossier, ...waitingItems(dossier, summary) };
  }));

  const byPrd = [...read].sort((a, b) => a.dossier.prd - b.dossier.prd || a.dossier.home_repo.localeCompare(b.dossier.home_repo));
  const answer: WaitingOutbox = {
    items: byPrd.flatMap((r) => r.items),
    unread: read.filter((r) => r.unread).length,
  };
  return json(200, answer);
}
