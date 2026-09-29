import type { Db } from '../ask/page/source';
import type { Store } from './alerts';

// The waiting list's New documents part (PRD 579, s1): the spec, plan and before/after versions pushed
// in the last 7 days to the numbered dossiers the signed-in person opened, read by the browser straight
// from Supabase as them (row-level security decides), every 10 s while the tab is visible. The rows are
// grouped per PRD, newest first, less what this browser has seen: a map of dossier id to when its page
// was last opened, and a `since` set the first time this browser ran it, so no history floods in. A
// new document is news, not a wait: it never adds to the bell's count, the tab's `(N)`, the favicon dot
// or the badges.

/** How often the New documents part is read while the tab is visible. */
export const DOCS_MS = 10_000;
/** How far back a version counts, in days. */
export const DOCS_DAYS = 7;
/** How many of the newest versions one read takes. */
export const DOCS_LIMIT = 50;
/** Where this browser keeps what it has seen. */
export const DOCS_SEEN_KEY = 'omni-waiting-docs-seen';

const DAY = 24 * 60 * 60_000;
const WINDOW = DOCS_DAYS * DAY;

export type DocumentKind = 'spec' | 'plan' | 'before-after';

/** The order a group names its kinds in. */
export const DOCUMENT_KINDS: readonly DocumentKind[] = ['spec', 'plan', 'before-after'];

/** One version as the read gives it, with its dossier. */
export type DocumentRow = {
  id: string;
  kind: DocumentKind;
  created_at: string;
  dossier: { id: string; prd: number; title: string };
};

/** One PRD's new documents: the kinds that landed, in the order spec, plan, before/after, each once,
 * and its newest version. */
export type DocumentGroup = {
  dossierId: string;
  prd: number;
  title: string;
  kinds: DocumentKind[];
  newestId: string;
  /** When the newest landed, in ms. */
  newestAt: number;
};

/** What this browser has seen: nothing before `since`, and nothing of a dossier before its time. */
export type Seen = { since: number; dossiers: Record<string, number> };

const KNOWN = new Set<string>(DOCUMENT_KINDS);

/** The rows, one group per PRD, newest first; a row seen (at or before its dossier's time, or before
 * `since`) is dropped, and so is a PRD left with none. */
export function groupDocuments(rows: readonly DocumentRow[], seen: Seen): DocumentGroup[] {
  const groups = new Map<string, { group: DocumentGroup; kinds: Set<DocumentKind> }>();
  for (const r of rows) {
    const { dossier } = r;
    if (!dossier || typeof dossier.prd !== 'number' || !KNOWN.has(r.kind)) continue;
    const time = Date.parse(r.created_at);
    if (Number.isNaN(time) || time < seen.since) continue;
    const last = seen.dossiers[dossier.id];
    if (last !== undefined && time <= last) continue;
    let entry = groups.get(dossier.id);
    if (!entry) {
      entry = { group: { dossierId: dossier.id, prd: dossier.prd, title: dossier.title, kinds: [], newestId: r.id, newestAt: time }, kinds: new Set() };
      groups.set(dossier.id, entry);
    }
    entry.kinds.add(r.kind);
    if (time > entry.group.newestAt) {
      entry.group.newestId = r.id;
      entry.group.newestAt = time;
    }
  }
  return [...groups.values()]
    .map(({ group, kinds }) => ({ ...group, kinds: DOCUMENT_KINDS.filter((k) => kinds.has(k)) }))
    .sort((a, b) => b.newestAt - a.newestAt || a.dossierId.localeCompare(b.dossierId));
}

const SELECT = 'id, kind, created_at, dossier:dossiers!inner(id, prd, title, opened_by)';

type Raw = { id: string; kind: string; created_at: string; dossier: { id: string; prd: number | null; title: string } | null };

/** A reader of the versions pushed to the numbered dossiers `me` opened, in the last 7 days, the 50
 * newest. Throws when a read fails. */
export function documentsReader(db: Db, me: string): (now: number) => Promise<DocumentRow[]> {
  return async (now) => {
    const { data, error } = await db.from('dossier_versions')
      .select(SELECT)
      .eq('dossier.opened_by', me)
      .not('dossier.prd', 'is', null)
      .gt('created_at', new Date(now - WINDOW).toISOString())
      .order('created_at', { ascending: false })
      .limit(DOCS_LIMIT);
    if (error) throw new Error(`read the new documents: ${error.message}`);
    return ((data ?? []) as unknown as Raw[]).flatMap((r) => (r.dossier && typeof r.dossier.prd === 'number' && KNOWN.has(r.kind)
      ? [{ id: r.id, kind: r.kind as DocumentKind, created_at: r.created_at, dossier: { id: r.dossier.id, prd: r.dossier.prd, title: r.dossier.title } }]
      : []));
  };
}

function parse(raw: string | null): Seen | null {
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as Partial<Seen> | null;
    if (!value || typeof value.since !== 'number' || !value.dossiers || typeof value.dossiers !== 'object') return null;
    const dossiers: Record<string, number> = {};
    for (const [id, time] of Object.entries(value.dossiers)) if (typeof time === 'number') dossiers[id] = time;
    return { since: value.since, dossiers };
  } catch {
    return null;
  }
}

/** What this browser has seen. The first time (or when the kept value cannot be read) `since` is
 * `now`, and kept; storage that throws gives `since` = `now` and remembers nothing. Never throws. */
export function readSeen(store: () => Store, now: number): Seen {
  const fresh: Seen = { since: now, dossiers: {} };
  try {
    const s = store();
    const kept = parse(s.getItem(DOCS_SEEN_KEY));
    if (kept) return kept;
    s.setItem(DOCS_SEEN_KEY, JSON.stringify(fresh));
  } catch {
    // Nothing is remembered: the part still works for the visit.
  }
  return fresh;
}

/** A PRD's page opened (or a new version rendered on it): its dossier seen at `now`. Seen times older
 * than the read's window are forgotten. Never throws. */
export function markSeen(store: () => Store, dossierId: string, now: number): void {
  try {
    const s = store();
    const seen = parse(s.getItem(DOCS_SEEN_KEY)) ?? { since: now, dossiers: {} };
    const dossiers: Record<string, number> = {};
    for (const [id, time] of Object.entries(seen.dossiers)) if (time >= now - WINDOW) dossiers[id] = time;
    dossiers[dossierId] = now;
    s.setItem(DOCS_SEEN_KEY, JSON.stringify({ since: seen.since, dossiers }));
  } catch {
    // Nothing is remembered.
  }
}
