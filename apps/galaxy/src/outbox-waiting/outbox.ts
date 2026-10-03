// The outbox part of the waiting list (PRD 499, s2): GET /api/waiting/outbox. For the signed-in person,
// the numbered dossiers they opened (row-level security keeps them to their workspaces), newest first,
// at most MAX_DOSSIERS; for each, the open outbox items ranked human-action or high while the PRD's
// feature PR is open. PRD 657 (s5): those are read from prd_outbox, where the stages sync, the stage
// events and the sends store them, in one read per workspace, so the route makes no GitHub request.
// `unread` counts the dossiers whose workspace's outboxes could not be read. It reads as the person
// (their cookie session), never with a service key (ADR-0032).
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { parseRows } from '../data/parse-rows';
import type { OutboxCounts, PrdOutboxStore } from '../stages/outbox/store';
import { prdKey } from '../stages/store';
import { type PrdNumber, PrdNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';

/** The most dossiers one call reads. */
export const MAX_DOSSIERS = 30;

/** An outbox item waiting on the person. `id` is the dossier's id and the item's own, joined by `:`, so
 * two PRDs' items never share one; `title` is the PRD's. */
export type WaitingOutboxItem = {
  id: string;
  prd: PrdNumber;
  dossierId: string;
  title: string;
  rank: 'human-action' | 'high';
  question: string;
};

export type WaitingOutbox = { items: WaitingOutboxItem[]; unread: number };

/** What the route needs of a dossier. */
export type WaitingDossier = { id: string; workspace_id: string; home_repo: string; prd: PrdNumber; title: string };

/** The dossiers' columns the route reads, as the database answers them. */
export const DOSSIER_COLUMNS = 'id, workspace_id, home_repo, prd, title';
export const WaitingDossierRow = z.object({ id: z.string(), workspace_id: z.string(), home_repo: z.string(), prd: PrdNumberSchema.nullable(), title: z.string() });

/** What the route needs of the Supabase client: who is signed in, and the dossiers table. */
export type WaitingDb = {
  auth: { getUser(): Promise<{ data: { user: { id: string } | null } }> };
  from: SupabaseClient['from'];
};

export type WaitingDeps = {
  /** The client acting as the signed-in person; throws when there is no database. */
  db: () => Promise<WaitingDb>;
  /** The stored outboxes, read through the person's client; null when there is none. */
  outbox: (db: WaitingDb) => Pick<PrdOutboxStore, 'countsOf'> | null;
};

/** A dossier's waiting items from its stored counts, in the stored order; none without counts. */
export function waitingItems(dossier: Pick<WaitingDossier, 'id' | 'prd' | 'title'>, counts: OutboxCounts | undefined): WaitingOutboxItem[] {
  return (counts?.waiting ?? []).map((item) => ({
    id: `${dossier.id}:${item.id}`,
    prd: dossier.prd,
    dossierId: dossier.id,
    title: dossier.title,
    rank: item.rank,
    question: item.question,
  }));
}

/** A dossier whose outbox could not be read starts with no items. */
const noItems = (): WaitingOutboxItem[] => [];

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

  const { data, error } = await who.db.from('dossiers').select(DOSSIER_COLUMNS)
    .eq('opened_by', who.user).not('prd', 'is', null)
    .order('created_at', { ascending: false }).limit(MAX_DOSSIERS);
  if (error) {
    console.error(`Waiting outbox: the dossiers could not be read: ${error.message}`);
    return json(500, { error: 'The dossiers could not be read.' });
  }
  const rows = parseRows(WaitingDossierRow, data, 'outbox-waiting: dossiers');
  if (!rows.ok) return json(500, { error: 'The dossiers could not be read.' });
  const dossiers = rows.value.flatMap(({ prd, ...dossier }): WaitingDossier[] => (prd === null ? [] : [{ ...dossier, prd }]));

  const store = deps.outbox(who.db);
  if (!store) return json(200, { items: [], unread: dossiers.length } satisfies WaitingOutbox);

  const byWorkspace = new Map<string, WaitingDossier[]>();
  for (const dossier of dossiers) byWorkspace.set(dossier.workspace_id, [...(byWorkspace.get(dossier.workspace_id) ?? []), dossier]);
  const read = (await Promise.all([...byWorkspace].map(async ([workspace, own]) => {
    try {
      const counts = await store.countsOf(workspace, own.map((d) => ({ repository: d.home_repo, prd: d.prd })));
      return own.map((dossier) => ({ dossier, items: waitingItems(dossier, counts.get(prdKey({ repository: dossier.home_repo, prd: dossier.prd }))), unread: false }));
    } catch (error) {
      console.error(`Waiting outbox: the outboxes of workspace ${workspace} could not be read: ${error instanceof Error ? error.message : String(error)}`);
      return own.map((dossier) => ({ dossier, items: noItems(), unread: true }));
    }
  }))).flat();

  const byPrd = [...read].sort((a, b) => a.dossier.prd - b.dossier.prd || a.dossier.home_repo.localeCompare(b.dossier.home_repo));
  const answer: WaitingOutbox = {
    items: byPrd.flatMap((r) => r.items),
    unread: read.filter((r) => r.unread).length,
  };
  return json(200, answer);
}
