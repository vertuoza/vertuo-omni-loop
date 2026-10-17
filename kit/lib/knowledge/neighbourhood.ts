/**
 * **The neighbourhood of an entry** (PRD 1797): what one rule rests on and what rests on it, one
 * plain line per node, never a whole register. `omni kb graph <id>` prints it; with `--json` it is a
 * versioned document whose types PRD 1798 (P6) imports and publishes from the server unchanged:
 *
 * ```text
 * { version: 1, shape: 'neighbourhood', repo, start, depth, product, nodes, edges }
 * ```
 *
 * Built only from what the one parser, `readKnowledge` (`registers.ts`), returns and from the
 * decision records (`../playbook/decisions.ts`): nothing here reads a file. Each edge is read from a
 * line that exists, and stored in its natural direction (a rule `serves` a principle, whichever end
 * the walk started from):
 *
 * - `serves`: a rule, an invariant or a contract → the principle its `Serves:` line names;
 * - `enforced-by`: an entry → a `test:<path>` node per path its `Enforced by:` line names (none for
 *   `unenforced` or `pending #<n>`);
 * - `governs`: an entry → a `path:<pattern>` node per pattern of its `Governs:` line;
 * - `points-to`: a contract → a `schema:<path>` node per file of its `Points to:` line;
 * - `cites`: an entry → an entry whose id its statement or `Why:` names (PRD 149's link), read both
 *   ways from the start;
 * - `sibling`: an entry → another entry serving the same principle or Legal entry;
 * - `same-prd`: an entry → each decision record whose `**PRD:** #n` header is the PRD its `Source:`
 *   names.
 *
 * Only entry nodes are walked further; a test, a path, a schema and a decision record are leaves. A
 * node reached twice is kept once, at the first hop that reaches it. The product line says whether
 * the product's cached knowledge (its Legal entries and Glossary) is in the walk.
 */
import { headline } from './disclose.ts';
import { prdOf } from './graph.ts';
import { idsCitedIn, isLaw, LEGAL_ID_SHAPE, type KnowledgeEntry } from './registers.ts';
import type { DecisionRecord } from '../playbook/decisions.ts';

export const NEIGHBOURHOOD_VERSION = 1;
export const NEIGHBOURHOOD_SHAPE = 'neighbourhood';

/** The kinds of node: the entries, which are walked, and the leaves, which are not. */
export type NodeKind = 'principle' | 'rule' | 'invariant' | 'legal' | 'contract' | 'test' | 'path' | 'schema' | 'screen' | 'adr' | 'term';

/** The edge vocabulary: nine edges, each stored in its natural direction. */
export type EdgeKind = 'serves' | 'enforced-by' | 'governs' | 'points-to' | 'cites' | 'sibling' | 'screen' | 'same-prd' | 'uses-term';

/** A rule's or an invariant's standing; `null` on every other node. */
export type NodeStatus = 'law' | 'rule' | 'proposed';

/** Where a node is read from: this repository's files, or the product's cached knowledge. */
export type NodeOrigin = 'repository' | 'product';

/** Whether the product's Legal entries and Glossary are in the walk. */
export type ProductState = 'cached' | 'offline' | 'none';

export type NeighbourhoodProduct = { state: ProductState; key: string | null; cachedOn: string | null };

export type NeighbourhoodNode = {
  id: string;
  kind: NodeKind;
  label: string | null;
  status: NodeStatus | null;
  /** The file the node is read from: `null` for a product node and for a path pattern. */
  file: string | null;
  origin: NodeOrigin;
  hop: number;
};

export type NeighbourhoodEdge = { from: string; to: string; kind: EdgeKind };

/** The neighbourhood as `--json` prints it: a field is added only with a new `version`. */
export type Neighbourhood = {
  version: typeof NEIGHBOURHOOD_VERSION;
  shape: typeof NEIGHBOURHOOD_SHAPE;
  repo: string | null;
  start: string[];
  depth: number;
  product: NeighbourhoodProduct;
  nodes: NeighbourhoodNode[];
  edges: NeighbourhoodEdge[];
};

/** What the neighbourhood is built from. */
export type NeighbourhoodSources = {
  entries: readonly KnowledgeEntry[];
  records: readonly DecisionRecord[];
  repo: string | null;
  product: NeighbourhoodProduct;
};

/** An entry whose kind could be read: the only entries a walk reaches. */
type Walked = KnowledgeEntry & { kind: NonNullable<KnowledgeEntry['kind']> };
const isWalked = (entry: KnowledgeEntry): entry is Walked => entry.kind !== null;

/** One step out of an entry: the edge, and the node at its other end. */
type Link = { edge: NeighbourhoodEdge; node: Omit<NeighbourhoodNode, 'hop'> };

type Index = { walked: readonly Walked[]; byId: ReadonlyMap<string, Walked>; records: readonly DecisionRecord[] };

/** A rule's or an invariant's standing: a law once locked, else proposed or a rule. */
function statusOf(entry: Walked): NodeStatus | null {
  if (entry.kind !== 'rule' && entry.kind !== 'invariant') return null;
  if (isLaw(entry)) return 'law';
  return entry.proposed === null ? 'rule' : 'proposed';
}

const entryNode = (entry: Walked): Link['node'] => ({
  id: entry.id,
  kind: entry.kind,
  label: headline(entry.statement),
  status: statusOf(entry),
  file: entry.file,
  origin: 'repository',
});

const leaf = (id: string, kind: NodeKind, file: string | null, label: string | null = null): Link['node'] => ({
  id,
  kind,
  label,
  status: null,
  file,
  origin: 'repository',
});

const link = (from: string, to: string, kind: EdgeKind, node: Link['node']): Link => ({ edge: { from, to, kind }, node });

/** The paths a comma-separated line names, backticks stripped. */
const pathsOf = (value: string): string[] => value.split(',').map((path) => path.replace(/`/g, '').trim()).filter(Boolean);

/** A decision record's title without its `ADR-nnnn — ` prefix. */
const recordLabel = (title: string | null): string | null => title?.replace(/^ADR-\d{4}\s*[—–-]\s*/, '') ?? null;

const citedBy = (entry: Walked): string[] => idsCitedIn([entry.statement, entry.why ?? ''].join('\n'));

/** Whether `entry` serves something siblings can share: a principle of the repository or a Legal entry. */
function servesShared(entry: Walked, byId: Index['byId']): entry is Walked & { serves: string } {
  if (entry.kind === 'principle' || entry.serves === null) return false;
  return byId.get(entry.serves)?.kind === 'principle' || LEGAL_ID_SHAPE.test(entry.serves);
}

/** `serves`, up to the principle `entry` serves, or down from a principle to every entry serving it. */
function servesLinks(entry: Walked, { walked, byId }: Index): Link[] {
  if (entry.kind === 'principle') {
    return walked.filter((other) => other.kind !== 'principle' && other.serves === entry.id).map((other) => link(other.id, entry.id, 'serves', entryNode(other)));
  }
  const served = entry.serves === null ? undefined : byId.get(entry.serves);
  return served?.kind === 'principle' ? [link(entry.id, served.id, 'serves', entryNode(served))] : [];
}

/** The leaves below `entry`: its tests, the patterns it governs, the schema files it points to. */
function leafLinks(entry: Walked): Link[] {
  const tests = entry.enforced && entry.enforcedBy !== null ? pathsOf(entry.enforcedBy) : [];
  return [
    ...tests.map((path) => link(entry.id, `test:${path}`, 'enforced-by', leaf(`test:${path}`, 'test', path))),
    ...(entry.governs ?? []).map((pattern) => link(entry.id, `path:${pattern}`, 'governs', leaf(`path:${pattern}`, 'path', null))),
    ...(entry.pointsTo ?? []).map((path) => link(entry.id, `schema:${path}`, 'points-to', leaf(`schema:${path}`, 'schema', path))),
  ];
}

/** `cites`, both ways: the entries `entry` names, then the entries that name it. */
function citeLinks(entry: Walked, { walked, byId }: Index): Link[] {
  const cited = citedBy(entry).flatMap((id) => {
    const other = id === entry.id ? undefined : byId.get(id);
    return other === undefined ? [] : [link(entry.id, other.id, 'cites', entryNode(other))];
  });
  const citing = walked.filter((other) => other.id !== entry.id && citedBy(other).includes(entry.id));
  return [...cited, ...citing.map((other) => link(other.id, entry.id, 'cites', entryNode(other)))];
}

/** `sibling`, to every other entry serving what `entry` serves. */
function siblingLinks(entry: Walked, { walked, byId }: Index): Link[] {
  if (!servesShared(entry, byId)) return [];
  const siblings = walked.filter((other) => other.id !== entry.id && other.kind !== 'principle' && other.serves === entry.serves);
  return siblings.map((other) => link(entry.id, other.id, 'sibling', entryNode(other)));
}

/** `same-prd`, to every decision record whose header names the PRD of `entry`'s `Source:`. */
function samePrdLinks(entry: Walked, { records }: Index): Link[] {
  const prd = prdOf(entry.source);
  if (prd === null) return [];
  return records
    .filter((record) => record.prd === prd)
    .map(({ number, file, title }) => link(entry.id, `ADR-${number}`, 'same-prd', leaf(`ADR-${number}`, 'adr', file, recordLabel(title))));
}

/** Every step out of `entry`, in the order the text prints them: up, then down, then side. */
function linksOf(entry: Walked, index: Index): Link[] {
  return [...servesLinks(entry, index), ...leafLinks(entry), ...citeLinks(entry, index), ...siblingLinks(entry, index), ...samePrdLinks(entry, index)];
}

/** An edge's identity: a sibling is the same edge read from either end. */
function edgeKey({ from, to, kind }: NeighbourhoodEdge): string {
  const ends = kind === 'sibling' ? [from, to].sort() : [from, to];
  return `${kind} ${ends.join(' ')}`;
}

/** A walk in progress: what it reads, the nodes and edges it has reached, and the edges it has seen. */
type Walk = { index: Index; nodes: Map<string, NeighbourhoodNode>; edges: NeighbourhoodEdge[]; seen: Set<string> };

/** One hop out of `entry`: records each new edge and each new node at `hop`; returns the entries reached, to walk next. */
function step(walk: Walk, entry: Walked, hop: number): Walked[] {
  const reached: Walked[] = [];
  for (const { edge, node } of linksOf(entry, walk.index)) {
    const key = edgeKey(edge);
    if (!walk.seen.has(key)) {
      walk.seen.add(key);
      walk.edges.push(edge);
    }
    if (walk.nodes.has(node.id)) continue;
    walk.nodes.set(node.id, { ...node, hop });
    const next = walk.index.byId.get(node.id);
    if (next !== undefined) reached.push(next);
  }
  return reached;
}

/**
 * The neighbourhood of the entries `start` names, walked `depth` hops between entries (1 by
 * default). An id that names no entry whose kind can be read is left out: the command refuses it
 * before building.
 */
export function buildNeighbourhood(sources: NeighbourhoodSources, { start, depth = 1 }: { start: readonly string[]; depth?: number }): Neighbourhood {
  const walked = sources.entries.filter(isWalked);
  const byId = new Map(walked.map((entry) => [entry.id, entry]));
  const walk: Walk = { index: { walked, byId, records: sources.records }, nodes: new Map(), edges: [], seen: new Set() };

  let frontier = [...new Set(start)].flatMap((id) => {
    const entry = byId.get(id);
    return entry === undefined ? [] : [entry];
  });
  for (const entry of frontier) walk.nodes.set(entry.id, { ...entryNode(entry), hop: 0 });
  for (let hop = 1; hop <= depth; hop += 1) frontier = frontier.flatMap((entry) => step(walk, entry, hop));
  const { nodes, edges } = walk;

  return {
    version: NEIGHBOURHOOD_VERSION,
    shape: NEIGHBOURHOOD_SHAPE,
    repo: sources.repo,
    start: [...nodes.values()].filter(({ hop }) => hop === 0).map(({ id }) => id),
    depth,
    product: sources.product,
    nodes: [...nodes.values()],
    edges,
  };
}

/** The product, read without its cache: none with no Omni page to belong to, offline otherwise. */
export function productWithoutCache(askUrl: string | null): NeighbourhoodProduct {
  return { state: askUrl ? 'offline' : 'none', key: null, cachedOn: null };
}

/** The last line of the text: whether the product's Legal entries and Glossary are in the walk. */
export function productLine({ state, key, cachedOn }: NeighbourhoodProduct): string {
  if (state === 'cached') return `product knowledge: cached ${cachedOn ?? 'on an unknown day'} (${key ?? 'no key'}).`;
  if (state === 'offline') return "product knowledge: offline — no cached copy of the product's Legal and Glossary; only this repository's links are shown.";
  return 'product knowledge: none — this repository belongs to no product.';
}

/** At most this many lines per edge kind under one node; the JSON lists them all. */
const LINES_PER_EDGE = 6;

/** How an edge reads from the node it is printed under: up, down or side. */
function directionOf(edge: NeighbourhoodEdge, from: string): 'up' | 'down' | 'side' {
  if (edge.kind === 'serves') return edge.from === from ? 'up' : 'down';
  return edge.kind === 'enforced-by' || edge.kind === 'governs' || edge.kind === 'points-to' ? 'down' : 'side';
}

/** One printed row: its indent, its direction and edge, and either a node or the count of those cut. */
type Row = { indent: string; direction: string; edge: EdgeKind } & ({ node: NeighbourhoodNode } | { more: number });

/** The other end of `edge` from `id`, or `null` when the edge does not touch it. */
function otherEnd(edge: NeighbourhoodEdge, id: string): string | null {
  if (edge.from === id) return edge.to;
  return edge.to === id ? edge.from : null;
}

/** The nodes one hop past `parent` that no line printed yet, each with the first edge reaching it; marks them printed. */
function childrenOf(parent: NeighbourhoodNode, built: Neighbourhood, printed: Set<string>): { edge: NeighbourhoodEdge; node: NeighbourhoodNode }[] {
  const byId = new Map(built.nodes.map((node) => [node.id, node]));
  const children: { edge: NeighbourhoodEdge; node: NeighbourhoodNode }[] = [];
  for (const edge of built.edges) {
    const node = byId.get(otherEnd(edge, parent.id) ?? '');
    if (node === undefined || node.hop !== parent.hop + 1 || printed.has(node.id)) continue;
    printed.add(node.id);
    children.push({ edge, node });
  }
  return children;
}

/** The rows under `parent`: each node one hop further first reached through an edge of `parent`, cut per edge kind. */
function rowsUnder(parent: NeighbourhoodNode, built: Neighbourhood, printed: Set<string>): Row[] {
  const indent = '  '.repeat(parent.hop + 1);
  const children = childrenOf(parent, built, printed);
  const rows: Row[] = [];
  const shown = new Map<EdgeKind, number>();
  for (const [at, { edge, node }] of children.entries()) {
    const count = shown.get(edge.kind) ?? 0;
    shown.set(edge.kind, count + 1);
    const direction = directionOf(edge, parent.id);
    if (count < LINES_PER_EDGE) {
      rows.push({ indent, direction, edge: edge.kind, node }, ...rowsUnder(node, built, printed));
    } else if (count === LINES_PER_EDGE) {
      const more = children.slice(at).filter((child) => child.edge.kind === edge.kind).length;
      rows.push({ indent, direction, edge: edge.kind, more });
    }
  }
  return rows;
}

/** The start's line: id, kind, status, a pending proof, and its headline. */
function startLine(node: NeighbourhoodNode, entry: KnowledgeEntry | undefined): string {
  const parts = [node.id, node.kind];
  if (node.status === 'law') parts.push(`law${entry?.locked?.by ? `, locked by @${entry.locked.by}` : ''}`);
  else if (node.status !== null) parts.push(node.status);
  const pending = entry?.pending ?? null;
  if (pending !== null) parts.push(`enforced by: pending #${pending}`);
  return `${parts.join(' · ')} — ${node.label ?? ''}`;
}

/** The rows as aligned columns: direction, edge, node id, node kind, label. */
function rowLines(rows: readonly Row[]): string[] {
  const width = (cells: readonly string[]) => Math.max(0, ...cells.map((cell) => cell.length));
  const lead = width(rows.map(({ indent, direction }) => indent + direction));
  const edge = width(rows.map((row) => row.edge));
  const nodes = rows.flatMap((row) => ('node' in row ? [row.node] : []));
  const id = width(nodes.map((node) => node.id));
  const kind = width(nodes.map((node) => node.kind));
  return rows.map((row) => {
    const head = `${(row.indent + row.direction).padEnd(lead)}  ${row.edge.padEnd(edge)}  `;
    if (!('node' in row)) return `${head}… and ${row.more} more (--json lists them all)`;
    return `${head}${row.node.id.padEnd(id)}  ${row.node.kind.padEnd(kind)}  ${row.node.label ?? ''}`.trimEnd();
  });
}

/**
 * The neighbourhood as text: per start, its line and one aligned line per node under it, at most
 * {@link LINES_PER_EDGE} per edge kind; then the product line. `entries` gives the start's lock and
 * its pending proof, which the JSON does not carry.
 */
export function neighbourhoodText(built: Neighbourhood, entries: readonly KnowledgeEntry[]): string {
  const printed = new Set(built.start);
  const lines: string[] = [];
  for (const node of built.nodes.filter(({ hop }) => hop === 0)) {
    lines.push(startLine(node, entries.find(({ id }) => id === node.id)), ...rowLines(rowsUnder(node, built, printed)));
  }
  lines.push(productLine(built.product));
  return lines.join('\n');
}
