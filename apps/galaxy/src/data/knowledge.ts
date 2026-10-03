// The knowledge map's data (PRD 149): the graph `omni kb graph --json` prints, typed, and the pure
// helpers both maps read it through — the arcade's star chart and the /knowledge page. The server
// builds the graph through the kit (load-knowledge.ts); nothing here touches the disk, so the browser
// may import it.

import { type PrdNumber, PrdNumberSchema } from 'vertuo-omni-plan/kit/lib/ids.ts';

export type EntryKind = 'principle' | 'rule' | 'invariant';
export type EntryStatus = 'law' | 'proposed';
export type LinkKind = 'serves' | 'cites';

/** The three kinds, inner orbit to outer: principles, rules, invariants. */
export const KINDS: readonly EntryKind[] = ['principle', 'rule', 'invariant'];

export interface KnowledgeCounts { principles: number; rules: number; invariants: number; laws: number; proposed: number }

/** `product/`, or one folder under `domains/`. */
export interface KnowledgeDomain { name: string; code: string; scope: 'product' | 'domain'; counts: KnowledgeCounts }

export interface KnowledgeEntry {
  id: string;
  kind: EntryKind;
  /** Its domain's name; `null` for a cross-domain entry, whose `domains` is its pair. */
  domain: string | null;
  domains: string[];
  statement: string;
  /** A principle's `Why:` line. */
  why: string | null;
  status: EntryStatus;
  /** The `Serves:` line as written: it may name nothing. The `serves` links are what exists. */
  serves: string | null;
  enforced: boolean;
  enforcedBy: string | null;
  /** The PRD its `Source:` line names. */
  prd: PrdNumber | null;
  file: string;
}

/**
 * An entry of the kit's graph with its PRD parsed into its brand: the kit reads `PRD #<n>` bare (PRD 1049
 * leaves it so until s5). A number no PRD has (`PRD #0`) names none, as a line naming no PRD does.
 */
export const withPrd = <E extends { prd: unknown }>(entry: E): Omit<E, 'prd'> & { prd: PrdNumber | null } =>
  ({ ...entry, prd: PrdNumberSchema.safeParse(entry.prd).data ?? null });

/** Only ever between two entries that exist. */
export interface KnowledgeLink { from: string; to: string; kind: LinkKind }

export interface KnowledgeGraph {
  version: 1;
  /** The repository's slug, `owner/name`. */
  repo: string | null;
  domains: KnowledgeDomain[];
  entries: KnowledgeEntry[];
  links: KnowledgeLink[];
  /** Rules and invariants that serve no principle. */
  loose: string[];
  /** Principles nothing serves. */
  unserved: string[];
}

/** A domain as a system: the domain, and how many entries it holds. */
export interface KnowledgeSystem extends KnowledgeDomain { size: number }

/** One cross-domain pair and its entries. */
export interface KnowledgeLane { pair: [string, string]; entries: KnowledgeEntry[] }

/** One kind's orbit. */
export interface KnowledgeOrbit { kind: EntryKind; entries: KnowledgeEntry[] }

/** Id order, numbers read as numbers: `P-PRODUCT-2` before `P-PRODUCT-10`. */
export const byId = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true });

const byEntryId = (a: KnowledgeEntry, b: KnowledgeEntry) => byId(a.id, b.id);

/** One system per domain: the product first, then each domain by name. */
export function systems(graph: KnowledgeGraph): KnowledgeSystem[] {
  return graph.domains
    .map((domain) => ({ ...domain, size: domain.counts.principles + domain.counts.rules + domain.counts.invariants }))
    .sort((a, b) => Number(b.scope === 'product') - Number(a.scope === 'product') || a.name.localeCompare(b.name));
}

/** The cross-domain entries by pair, pairs by name, entries in id order. */
export function lanes(graph: KnowledgeGraph): KnowledgeLane[] {
  const byPair = new Map<string, KnowledgeLane>();
  for (const entry of graph.entries) {
    const [one, two] = entry.domains;
    if (entry.domain !== null || entry.domains.length !== 2 || one === undefined || two === undefined) continue;
    const key = entry.domains.join('--');
    const lane: KnowledgeLane = byPair.get(key) ?? { pair: [one, two], entries: [] };
    lane.entries.push(entry);
    byPair.set(key, lane);
  }
  return [...byPair.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, lane]) => ({ ...lane, entries: [...lane.entries].sort(byEntryId) }));
}

/** The entries of one domain; a cross-domain entry belongs to none. */
export function entriesOf(graph: KnowledgeGraph, domain: string): KnowledgeEntry[] {
  return graph.entries.filter((entry) => entry.domain === domain);
}

/** `entries` by kind, inner orbit to outer, each in id order; an empty kind keeps its orbit. */
export function orbits(entries: KnowledgeEntry[]): KnowledgeOrbit[] {
  return KINDS.map((kind) => ({ kind, entries: entries.filter((entry) => entry.kind === kind).sort(byEntryId) }));
}

function linked(graph: KnowledgeGraph, kind: LinkKind, side: 'from' | 'to', id: string): KnowledgeEntry[] {
  const other = side === 'from' ? 'to' : 'from';
  const ids = new Set(graph.links.filter((link) => link.kind === kind && link[side] === id).map((link) => link[other]));
  return graph.entries.filter((entry) => ids.has(entry.id)).sort(byEntryId);
}

/** Every entry that serves `id`, in id order. */
export function servedBy(graph: KnowledgeGraph, id: string): KnowledgeEntry[] {
  return linked(graph, 'serves', 'to', id);
}

/** The principle `id` serves, or `null` when its `Serves:` line names none. */
export function serving(graph: KnowledgeGraph, id: string): KnowledgeEntry | null {
  return linked(graph, 'serves', 'from', id)[0] ?? null;
}

/** Every entry `id` cites in its statement or its `Why:`, in id order. */
export function cited(graph: KnowledgeGraph, id: string): KnowledgeEntry[] {
  return linked(graph, 'cites', 'from', id);
}

/**
 * The filter: every word of `query` appears, in any case, in the entry's id, statement or `Why:`.
 * An empty filter matches everything.
 */
export function matches(entry: KnowledgeEntry, query: string): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const text = [entry.id, entry.statement, entry.why ?? ''].join(' ').toLowerCase();
  return words.every((word) => text.includes(word));
}
