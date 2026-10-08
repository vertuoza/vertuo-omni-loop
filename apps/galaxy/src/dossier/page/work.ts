// Where each kind of dossier is read (PRD 627): a PRD's at /prd/<id>, a visual fix's at /visual/<id> and
// a bug fix's at /bugs/<id>, each list at the bare path. A row read without a kind is a PRD's, as every
// dossier was before PRD 627. A dossier opened on another kind's route is sent to its own, with the
// address's query kept, so `/prd/<id>?tab=questions` of a fix lands on its Questions tab.
// Since PRD 1272 a concept's is at /concepts/<id>, its list at /concepts. A concept's row is never one of
// another kind's: every list keeps only its own kind's rows. A concept opened on a PRD's or a fix's route
// is sent to /concepts/<id>; its own page reads the row's kind as it came (`rowKind`), since the store's
// row type names only the kinds the PRD page shows.
import { isPushKind, type DossierRow, type PushKind, type WorkKind } from '../store';

/** Each kind's list, and the root of its pages. */
export const WORK_PATHS: Readonly<Record<PushKind, string>> = { prd: '/prd', visual: '/visual', bug: '/bugs', concept: '/concepts' };

/** What a list or a page calls one of its kind. */
export const WORK_NAMES: Readonly<Record<PushKind, { one: string; many: string; badge: string | null }>> = {
  prd: { one: 'PRD', many: 'PRDs', badge: null },
  visual: { one: 'visual update', many: 'Visual Updates', badge: 'Visual' },
  bug: { one: 'bug fix', many: 'Bug Fixes', badge: 'Bug' },
  concept: { one: 'concept', many: 'Concepts', badge: 'Concept' },
};

/** The dossier's kind: a PRD's when the row carries none. */
export const kindOf = (row: Pick<DossierRow, 'kind'>): WorkKind => row.kind ?? 'prd';

/** A row's kind as it came from the database, a concept's included: a PRD's when it carries none, null
 * for a kind nobody knows. */
export function rowKind(row: { kind?: unknown }): PushKind | null {
  if (row.kind === undefined || row.kind === null) return 'prd';
  return isPushKind(row.kind) ? row.kind : null;
}

/** Only the rows of `kind`, in their order: a concept's row (PRD 1272) is never a PRD's or a fix's. */
export const ofWork = <R extends { kind?: PushKind | undefined }>(rows: readonly R[], kind: WorkKind): R[] => rows.filter((row) => (row.kind ?? 'prd') === kind);

/** A dossier's page, on its kind's route. */
export const workPath = (kind: PushKind, id: string) => `${WORK_PATHS[kind]}/${encodeURIComponent(id)}`;

type Query = Record<string, string | string[] | undefined>;

/** Where a dossier of `kind` opened on `route`'s page goes, the query kept; null when it is on its own route. */
export function misrouted(kind: PushKind, route: PushKind, id: string, query: Query = {}): string | null {
  if (kind === route) return null;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const one of Array.isArray(value) ? value : value === undefined ? [] : [value]) params.append(key, one);
  }
  const rest = String(params);
  return rest ? `${workPath(kind, id)}?${rest}` : workPath(kind, id);
}
