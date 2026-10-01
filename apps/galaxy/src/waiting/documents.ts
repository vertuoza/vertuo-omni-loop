import type { Db } from '../ask/page/source';
import { claimChime, documentAlertOf, raiseEach, type DesktopState, type NotificationApi, type Store } from './alerts';

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
  /** When the newest of each kind landed, in ms: what an alert after an earlier one names (s2). A
   * group without it names all its kinds. */
  kindsAt?: Partial<Record<DocumentKind, number>>;
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
      entry = { group: { dossierId: dossier.id, prd: dossier.prd, title: dossier.title, kinds: [], newestId: r.id, newestAt: time, kindsAt: {} }, kinds: new Set() };
      groups.set(dossier.id, entry);
    }
    entry.kinds.add(r.kind);
    const kindsAt = entry.group.kindsAt!;
    if ((kindsAt[r.kind] ?? -Infinity) < time) kindsAt[r.kind] = time;
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
    return ((data ?? []) as unknown as Raw[]).flatMap((r) => (r.dossier && typeof r.dossier.prd === 'number' && KNOWN.has(r.kind) // ts-allow: the select names exactly these columns; each is checked on this line
      ? [{ id: r.id, kind: r.kind as DocumentKind, created_at: r.created_at, dossier: { id: r.dossier.id, prd: r.dossier.prd, title: r.dossier.title } }] // ts-allow: KNOWN just proved the kind a known one
      : []));
  };
}

function parse(raw: string | null): Seen | null {
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as Partial<Seen> | null; // ts-allow: each field is checked on the next line
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

// Announcing (PRD 579, s2). Pushes come in bursts, so a PRD's group is announced only once it has
// settled: its newest version at least 30 s old. It is announced once per newest version id, naming
// the kinds that landed since that PRD's last alert: one desktop alert per PRD, tagged by its newest
// version so every open tab raises it once, and one chime per read, claimed by one tab. What was
// announced is kept in localStorage, bounded, so a reload or a second tab does not announce it again;
// the first read after load does announce a settled group never announced. Both behind the existing
// switches; what settles is recorded as announced even with them off, so switching on later does not
// bring back old news.

/** How long a PRD's newest version must be quiet before it is announced. */
export const SETTLE_MS = 30_000;
/** Where this browser keeps what it announced. */
export const DOCS_ANNOUNCED_KEY = 'omni-waiting-docs-announced';
/** How many announced versions are kept. */
export const ANNOUNCED_KEPT = 200;

/** Each newest version announced, oldest first, with its dossier and when it landed. */
export type Announced = { id: string; dossierId: string; at: number }[];

/** One PRD to announce, and the kinds its alert names. */
export type DocumentAlert = { group: DocumentGroup; kinds: DocumentKind[] };

/** The groups whose newest version has been quiet for 30 s. */
export function settled(groups: readonly DocumentGroup[], now: number): DocumentGroup[] {
  return groups.filter((g) => now - g.newestAt >= SETTLE_MS);
}

/** Which settled groups to announce, and what is announced after: a newest id already announced is
 * skipped; a later one names only the kinds newer than its PRD's last alert. */
export function toAnnounce(groups: readonly DocumentGroup[], announced: Announced): { alerts: DocumentAlert[]; announced: Announced } {
  const ids = new Set(announced.map((a) => a.id));
  const next = [...announced];
  const alerts: DocumentAlert[] = [];
  for (const group of groups) {
    if (ids.has(group.newestId)) continue;
    const last = next.reduce((t, a) => (a.dossierId === group.dossierId && a.at > t ? a.at : t), -Infinity);
    const newer = group.kindsAt ? group.kinds.filter((k) => (group.kindsAt?.[k] ?? -Infinity) > last) : group.kinds;
    alerts.push({ group, kinds: newer.length > 0 ? newer : group.kinds });
    next.push({ id: group.newestId, dossierId: group.dossierId, at: group.newestAt });
    ids.add(group.newestId);
  }
  return { alerts, announced: next.slice(-ANNOUNCED_KEPT) };
}

function readAnnounced(store: () => Store): Announced | null {
  try {
    const raw: unknown = JSON.parse(store().getItem(DOCS_ANNOUNCED_KEY) ?? '[]');
    if (!Array.isArray(raw)) return [];
    return raw.filter((a): a is Announced[number] =>
      !!a && typeof a.id === 'string' && typeof a.dossierId === 'string' && typeof a.at === 'number');
  } catch (error) {
    return error instanceof SyntaxError ? [] : null;
  }
}

/** A read's groups announced: the settled ones never announced raise a desktop alert each and one
 * chime, each behind its switch. Returns what is announced now, which the caller passes back as
 * `kept`: it stands in for storage that cannot be read. Never throws. */
export function noticeDocuments({ groups, now, store, kept, desktop, chime, notifications, play, open }: {
  groups: readonly DocumentGroup[];
  now: number;
  store: () => Store;
  kept: Announced;
  desktop: DesktopState;
  chime: boolean;
  notifications: NotificationApi | null | undefined;
  play: () => void;
  open: (href: string) => void;
}): Announced {
  const { alerts, announced } = toAnnounce(settled(groups, now), readAnnounced(store) ?? kept);
  if (alerts.length === 0) return announced;
  try {
    store().setItem(DOCS_ANNOUNCED_KEY, JSON.stringify(announced));
  } catch {
    // Held for this visit through what is returned.
  }
  const each = alerts.map((a) => documentAlertOf(a.group, a.kinds));
  raiseEach(notifications, desktop, each, open);
  if (chime && claimChime(store, each.map((a) => a.tag))) play();
  return announced;
}
