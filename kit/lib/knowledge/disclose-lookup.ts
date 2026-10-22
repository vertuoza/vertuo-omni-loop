// The lookup (PRD 2346): what applies to a set of files, read from the repository's knowledge map. A
// file's **domain** is the `knowledge` folder of the first flow area whose `paths` match it (as a flow
// area already resolves, `kit/lib/flow/resolve.ts`); its **layers** are every `layers.<layer>` whose
// paths match it. Then each rule, invariant and law, each tagged decision record and each Legal entry:
//
// - **applies** when its `Governs:` matches a file, its domain is a file's domain, or its layers meet a
//   file's layers, each reason said (`governs`, `domain <d>`, `layer <l>`);
// - is **global** when nothing can narrow it: no `Governs:`, a domain no area maps, and no layer the
//   repository maps a path to. Every Legal entry is global;
// - is **hidden** otherwise: it belongs to other areas, and is only counted.
//
// A repository that maps nothing (no `layers`, no area with `knowledge`) is narrowed by nothing: every
// locked law is listed, a rule only when its `Governs:` matches, as before the map. A decision record
// is listed only when one of its tags applies: an untagged one is reached through the knowledge graph.
import type { Config } from '../types.ts';
import { areaOf, resolveFlow, type ResolvedFlow } from '../flow/resolve.ts';
import { layerOf } from '../layers/layers.ts';
import type { DecisionRecord } from '../playbook/decisions.ts';
import type { LegalEntry } from '../product/knowledge.ts';
import { governsPath, headline, lawLine, lawSentence } from './disclose.ts';
import { isLaw, type KnowledgeEntry } from './registers.ts';
import type { Thesis } from './thesis.ts';
import type { LawOwner } from '../config.ts';

/** What the map is read from: the flow areas (and what resolving them needs) and the `layers` key. */
export type MapConfig = Pick<Config, 'flow' | 'landings' | 'pr' | 'layers'>;

/** The repository's map, compiled once: its areas, each layer's patterns, and whether it maps anything. */
export type KnowledgeMap = {
  flow: ResolvedFlow;
  layers: ReadonlyArray<{ layer: string; patterns: RegExp[] }>;
  /** The domain folders an area maps. */
  domains: ReadonlySet<string>;
  mapped: boolean;
};

/** Where a file sits on the map: its domain (`null` with none) and its layers. */
export type Place = { domain: string | null; layers: string[] };

/** What an entry of the lookup is. */
export type LookupKind = 'law' | 'rule' | 'invariant' | 'adr' | 'legal';

/** One entry of the lookup: what it is, its id and file, its text, and why it applies (empty for a global one). */
export type LookupEntry = { kind: LookupKind; id: string; file: string | null; text: string; why: string[]; proposed: boolean };

/** The lookup: what applies to the files, what is global, and how many entries of other areas it leaves out. */
export type Lookup = {
  mapped: boolean;
  applies: LookupEntry[];
  global: LookupEntry[];
  hidden: { laws: number; rules: number; adrs: number };
};

/** What the lookup reads: the knowledge entries, the decision records, the Legal entries and the thesis. */
export type LookupSources = {
  entries: readonly KnowledgeEntry[];
  records: readonly DecisionRecord[];
  legal: readonly LegalEntry[];
  thesis: Thesis | null;
};

/** The repository's map, from its config. */
export function knowledgeMap(config: MapConfig): KnowledgeMap {
  const flow = resolveFlow(config);
  const layers = Object.entries(config.layers ?? {}).map(([layer, sources]) => ({ layer, patterns: sources.map((source) => new RegExp(source)) }));
  const domains = new Set(flow.areas.flatMap(({ knowledge }) => (knowledge === null ? [] : [knowledge])));
  return { flow, layers, domains, mapped: layers.length > 0 || domains.size > 0 };
}

/** `path`'s domain and layers on `map`. */
export function placeOf(map: KnowledgeMap, path: string): Place {
  return {
    domain: areaOf(map.flow, path).knowledge,
    layers: map.layers.filter(({ patterns }) => patterns.some((pattern) => pattern.test(path))).map(({ layer }) => layer),
  };
}

/** The domains an entry belongs to: its folder, or both of a cross-domain file's (`a--b`). */
const domainsOf = (entry: KnowledgeEntry): string[] => (entry.scope === 'cross-domain' ? entry.domain.split('--') : [entry.domain]);

/** A list of layer words read as layers: an old word (`database`) as its layer. */
const asLayers = (words: readonly string[] | null | undefined): string[] => [...new Set((words ?? []).map(layerOf))];

/** Why something tagged `domains` and `layers` (and governing `governs`) applies to the files at `places`; empty when it does not. */
function reasons(places: readonly Place[], files: readonly string[], tags: { governs: readonly string[] | null; domains: readonly string[]; layers: readonly string[] }): string[] {
  const why: string[] = [];
  if (tags.governs !== null && files.some((file) => governsPath(tags.governs ?? [], file))) why.push('governs');
  for (const domain of tags.domains) if (places.some((place) => place.domain === domain)) why.push(`domain ${domain}`);
  for (const layer of tags.layers) if (places.some((place) => place.layers.includes(layer))) why.push(`layer ${layer}`);
  return why;
}

/** Whether anything on `map` can narrow an entry: a `Governs:` line, a domain an area maps, or a layer the map holds. */
function reachable(map: KnowledgeMap, governs: readonly string[] | null, domains: readonly string[], layers: readonly string[]): boolean {
  return (
    (governs !== null && governs.length > 0) ||
    domains.some((domain) => map.domains.has(domain)) ||
    layers.some((layer) => map.layers.some((mapped) => mapped.layer === layer))
  );
}

/** A record's title without its `ADR-NNNN — ` prefix, or its file with no title. */
const recordText = (record: DecisionRecord): string => (record.title ?? record.file).replace(/^ADR-\d+\s*[—–-]\s*/, '');

/** Where one entry goes: applies (it has a reason), global, or hidden. */
type Placed = { group: 'applies' | 'global' | 'hidden'; line: LookupEntry };

/** A rule, an invariant or a law, placed for the files at `places`. */
function placeEntry(entry: KnowledgeEntry, thesis: Thesis | null, map: KnowledgeMap, places: readonly Place[], files: readonly string[]): Placed {
  const law = isLaw(entry);
  const tags = { governs: entry.governs, domains: domainsOf(entry), layers: asLayers(entry.layers) };
  const line: LookupEntry = {
    kind: law ? 'law' : entry.kind === 'invariant' ? 'invariant' : 'rule',
    id: entry.id,
    file: entry.file,
    text: law ? lawSentence(entry, thesis) : headline(entry.statement),
    why: reasons(places, files, tags),
    proposed: entry.proposed !== null,
  };
  if (line.why.length > 0) return { group: 'applies', line };
  // Mapped, what nothing can narrow is global; unmapped, every law is, and a rule shows only by its `Governs:`.
  const global = map.mapped ? !reachable(map, tags.governs, tags.domains, tags.layers) : law;
  return { group: global ? 'global' : 'hidden', line };
}

/** A tagged decision record, placed for the files at `places`; `null` for an untagged one, never listed. */
function placeRecord(record: DecisionRecord, places: readonly Place[], files: readonly string[]): Placed | null {
  const tags = { governs: null, domains: record.domain == null ? [] : [record.domain], layers: asLayers(record.layers) };
  if (tags.domains.length === 0 && tags.layers.length === 0) return null;
  const why = reasons(places, files, tags);
  const line: LookupEntry = { kind: 'adr', id: `ADR-${record.number}`, file: record.file, text: recordText(record), why, proposed: false };
  return { group: why.length > 0 ? 'applies' : 'hidden', line };
}

/** What applies to `files`, what is global, and how many entries of other areas are left out. */
export function lookup(sources: LookupSources, map: KnowledgeMap, files: readonly string[]): Lookup {
  const places = files.map((file) => placeOf(map, file));
  const ruleLike = sources.entries.filter((entry) => entry.kind === 'rule' || entry.kind === 'invariant');
  const placed = [
    ...[...ruleLike.filter(isLaw), ...ruleLike.filter((entry) => !isLaw(entry))].map((entry) => placeEntry(entry, sources.thesis, map, places, files)),
    ...sources.records.flatMap((record) => placeRecord(record, places, files) ?? []),
    ...sources.legal.map((legal): Placed => ({
      group: 'global',
      line: { kind: 'legal', id: legal.id, file: null, text: headline(legal.statement), why: [], proposed: false },
    })),
  ];
  const linesOf = (group: Placed['group']) => placed.filter((one) => one.group === group).map(({ line }) => line);
  const hidden = linesOf('hidden');
  return {
    mapped: map.mapped,
    applies: linesOf('applies'),
    global: linesOf('global'),
    hidden: {
      laws: hidden.filter(({ kind }) => kind === 'law').length,
      rules: hidden.filter(({ kind }) => kind === 'rule' || kind === 'invariant').length,
      adrs: hidden.filter(({ kind }) => kind === 'adr').length,
    },
  };
}

/** One entry of the lookup as a line: a law as `omni kb laws` prints it, then why it applies. */
export function lookupLine(entry: LookupEntry, owners: readonly LawOwner[]): string {
  const because = entry.why.length === 0 ? '' : ` (${entry.why.join(', ')})`;
  if (entry.kind === 'law') {
    return `${lawLine({ id: entry.id, file: entry.file ?? '', sentence: entry.text, lockedBy: null, lockedOn: null, governs: [] }, owners)}${because}`;
  }
  const proposed = entry.proposed ? ' (proposed, not yet confirmed by a person)' : '';
  return `${entry.kind} ${entry.id} — ${entry.text}${proposed}${because}`;
}
