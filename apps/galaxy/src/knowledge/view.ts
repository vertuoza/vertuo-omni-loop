import { byId, entriesOf, KINDS, lanes, matches, systems, type KnowledgeEntry, type KnowledgeGraph } from '../data/knowledge';

// What the /knowledge page shows of the graph (PRD 149): its tabs, the entry an address selects, and
// the index grouped by principle. Pure, so the server renders exactly what the browser then keeps.

/** The tab of the cross-domain entries, as the address names it: their folder's name. */
export const BETWEEN = 'cross-domain';

export interface KnowledgeTab { key: string; label: string; count: number }

/** One tab per domain, the product first, each with its entry count; then Between domains, when any
 * entry is cross-domain. */
export function tabs(graph: KnowledgeGraph): KnowledgeTab[] {
  const between = lanes(graph).reduce((sum, lane) => sum + lane.entries.length, 0);
  return [
    ...systems(graph).map((system) => ({ key: system.name, label: system.name, count: system.size })),
    ...(between > 0 ? [{ key: BETWEEN, label: 'Between domains', count: between }] : []),
  ];
}

/** A tab's entries: a domain's own, or every cross-domain one. */
export function tabEntries(graph: KnowledgeGraph, key: string): KnowledgeEntry[] {
  return key === BETWEEN ? graph.entries.filter((e) => e.domain === null) : entriesOf(graph, key);
}

/** The tab an entry is shown in. */
export const tabOf = (entry: KnowledgeEntry) => entry.domain ?? BETWEEN;

const byKindThenId = (a: KnowledgeEntry, b: KnowledgeEntry) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind) || byId(a.id, b.id);

/** The entry a tab opens on: its first principle, or its first entry when it holds none. */
export function firstEntry(entries: KnowledgeEntry[]): KnowledgeEntry | null {
  return [...entries].sort(byKindThenId)[0] ?? null;
}

export interface Selection { domain: string; entry: string | null }

/**
 * What `/knowledge?domain=&entry=` opens. The entry wins: it is shown in its own tab whatever the
 * domain says. Without one, the tab named (or the first) opens on its first principle. `null` only
 * when the graph holds no domain at all.
 */
export function select(graph: KnowledgeGraph, query: { domain?: string | null; entry?: string | null }): Selection | null {
  const named = query.entry ? graph.entries.find((e) => e.id === query.entry) : undefined;
  if (named) return { domain: tabOf(named), entry: named.id };
  const all = tabs(graph);
  const tab = all.find((t) => t.key === query.domain) ?? all[0];
  if (!tab) return null;
  return { domain: tab.key, entry: firstEntry(tabEntries(graph, tab.key))?.id ?? null };
}

/** The shareable address of a selection. */
export function entryHref({ domain, entry }: Selection): string {
  const query = new URLSearchParams({ domain });
  if (entry) query.set('entry', entry);
  return `/knowledge?${query}`;
}

export type IndexRole = 'principle' | 'member' | 'loose' | 'unserved';

/** One row of the index. `foreign` marks a principle of another tab heading a group here, because an
 * entry of this tab serves it. */
export interface IndexRow { entry: KnowledgeEntry; role: IndexRole; foreign: boolean }

export interface KnowledgeIndex { grouped: IndexRow[]; loose: IndexRow[]; unserved: IndexRow[] }

/**
 * The index of a tab's entries: each principle something serves, followed by the rules then the
 * invariants of this tab that serve it (a principle of another tab heads a group too when an entry
 * here serves it); then the loose entries, which serve no principle; then the unserved principles,
 * which nothing serves. A filter leaves only the rows whose id or words match it.
 */
export function indexOf(graph: KnowledgeGraph, entries: KnowledgeEntry[], query = ''): KnowledgeIndex {
  const here = new Set(entries.map((e) => e.id));
  const byEntry = new Map(graph.entries.map((e) => [e.id, e]));
  const loose = new Set(graph.loose);
  const unserved = new Set(graph.unserved);

  const members = new Map<string, KnowledgeEntry[]>();
  for (const link of graph.links) {
    if (link.kind !== 'serves' || !here.has(link.from)) continue;
    const from = byEntry.get(link.from);
    if (from) members.set(link.to, [...(members.get(link.to) ?? []), from]);
  }
  const heads = [
    ...entries.filter((e) => e.kind === 'principle' && !unserved.has(e.id)).sort(byKindThenId),
    ...[...members.keys()].filter((id) => !here.has(id)).flatMap((id) => byEntry.get(id) ?? []).sort(byKindThenId),
  ];

  const shown = (entry: KnowledgeEntry) => matches(entry, query);
  const row = (entry: KnowledgeEntry, role: IndexRole, foreign = false): IndexRow => ({ entry, role, foreign });
  const grouped = heads.flatMap((head) => [
    ...(shown(head) ? [row(head, 'principle', !here.has(head.id))] : []),
    ...(members.get(head.id) ?? []).filter(shown).sort(byKindThenId).map((e) => row(e, 'member')),
  ]);
  return {
    grouped,
    loose: entries.filter((e) => loose.has(e.id) && shown(e)).sort(byKindThenId).map((e) => row(e, 'loose')),
    unserved: entries.filter((e) => unserved.has(e.id) && shown(e)).sort(byKindThenId).map((e) => row(e, 'unserved')),
  };
}
