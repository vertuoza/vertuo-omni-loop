// The sync's rules (PRD 262), pure: what the repository says has shipped, and what public.releases
// already holds, in; the rows to insert and the texts to refresh, out. Every number and date comes
// from main's history, never from the day the sync runs, so syncing an emptied table again rebuilds
// the same rows.
//
// 1. A PRD already in the table keeps its release and released_at forever; only its title and
//    description are refreshed, so a typo is fixed by a pull request.
// 2. A note pinned to the initial release gets release 1.
// 3. Every other shipped PRD with no row gets the next number, from 2, in the order its shipped
//    folder first reached main, the lower PRD number first on a tie.
// 4. released_at is when that folder first reached main (read by git.ts).
// 5. A shipped PRD with no note is published all the same, under its spec title with an empty
//    description (the repository reading, sync-shipped.ts, hands it over that way).
// 6. Nothing is ever deleted: a plan holds inserts and updates, and nothing else.
import { INITIAL_RELEASE, type ReleaseRow } from './row.ts';

/** A PRD the repository has shipped, as the sync reads it. */
export type ShippedPrd = {
  prd: number;
  /** When its shipped folder first reached main, ISO 8601. */
  releasedAt: string;
  /** Its note's title, or its spec's title when it has no note. */
  title: string;
  /** Its note's description, or `''` when it has no note. */
  description: string;
  /** Its note is pinned to the initial release (`version: 0.0.1`). */
  pinned: boolean;
};

export type ReleaseText = Pick<ReleaseRow, 'prd' | 'title' | 'description'>;

/** What one sync writes: new rows, and new texts for rows already there. Never a deletion. */
export type SyncPlan = { inserts: ReleaseRow[]; updates: ReleaseText[] };

const byPrd = (a: { prd: number }, b: { prd: number }) => a.prd - b.prd;
const firstOnMain = (a: ShippedPrd, b: ShippedPrd) => Date.parse(a.releasedAt) - Date.parse(b.releasedAt) || a.prd - b.prd;

const toRow = (prd: ShippedPrd, release: number): ReleaseRow => ({
  prd: prd.prd, release, released_at: prd.releasedAt, title: prd.title, description: prd.description,
});

export function planSync(shipped: ShippedPrd[], rows: ReleaseRow[]): SyncPlan {
  const stored = new Map(rows.map((row) => [row.prd, row]));

  const updates = shipped
    .filter((prd) => {
      const row = stored.get(prd.prd);
      return row !== undefined && (row.title !== prd.title || row.description !== prd.description);
    })
    .map(({ prd, title, description }) => ({ prd, title, description }))
    .sort(byPrd);

  const fresh = shipped.filter((prd) => !stored.has(prd.prd));
  let next = Math.max(INITIAL_RELEASE, ...rows.map((row) => row.release)) + 1;
  const inserts = [
    ...fresh.filter((prd) => prd.pinned).sort(byPrd).map((prd) => toRow(prd, INITIAL_RELEASE)),
    ...fresh.filter((prd) => !prd.pinned).sort(firstOnMain).map((prd) => toRow(prd, next++)),
  ];

  return { inserts, updates };
}

/** The table after a plan is written, by PRD number: what the next sync would read. */
export function applySync(rows: ReleaseRow[], plan: SyncPlan): ReleaseRow[] {
  const text = new Map(plan.updates.map((update) => [update.prd, update]));
  return [
    ...rows.map((row) => {
      const update = text.get(row.prd);
      return update ? { ...row, title: update.title, description: update.description } : row;
    }),
    ...plan.inserts,
  ].sort(byPrd);
}
