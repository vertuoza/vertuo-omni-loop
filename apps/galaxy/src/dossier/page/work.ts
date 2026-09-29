// Where each kind of dossier is read (PRD 627): a PRD's at /prd/<id>, a visual fix's at /visual/<id> and
// a bug fix's at /bugs/<id>, each list at the bare path. A row read without a kind is a PRD's, as every
// dossier was before PRD 627. A dossier opened on another kind's route is sent to its own, with the
// address's query kept, so `/prd/<id>?tab=questions` of a fix lands on its Questions tab.
import type { DossierRow, WorkKind } from '../store';

/** Each kind's list, and the root of its pages. */
export const WORK_PATHS: Readonly<Record<WorkKind, string>> = { prd: '/prd', visual: '/visual', bug: '/bugs' };

/** What a list or a page calls one of its kind. */
export const WORK_NAMES: Readonly<Record<WorkKind, { one: string; many: string; badge: string | null }>> = {
  prd: { one: 'PRD', many: 'PRDs', badge: null },
  visual: { one: 'visual update', many: 'Visual Updates', badge: 'Visual' },
  bug: { one: 'bug fix', many: 'Bug Fixes', badge: 'Bug' },
};

/** The dossier's kind: a PRD's when the row carries none. */
export const kindOf = (row: Pick<DossierRow, 'kind'>): WorkKind => row.kind ?? 'prd';

/** Only the rows of `kind`, in their order. */
export const ofWork = <R extends Pick<DossierRow, 'kind'>>(rows: readonly R[], kind: WorkKind): R[] => rows.filter((row) => kindOf(row) === kind);

/** A dossier's page, on its kind's route. */
export const workPath = (kind: WorkKind, id: string) => `${WORK_PATHS[kind]}/${encodeURIComponent(id)}`;

type Query = Record<string, string | string[] | undefined>;

/** Where a dossier of `kind` opened on `route`'s page goes, the query kept; null when it is on its own route. */
export function misrouted(kind: WorkKind, route: WorkKind, id: string, query: Query = {}): string | null {
  if (kind === route) return null;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const one of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, one);
  }
  const rest = String(params);
  return rest ? `${workPath(kind, id)}?${rest}` : workPath(kind, id);
}
