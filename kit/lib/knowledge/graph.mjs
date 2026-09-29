/**
 * **The knowledge graph** (PRD #149): the knowledge folder as one document an agent or a map can
 * read in one call — its domains with their counts, every entry, and the links between entries.
 * Built only from what the one parser, `readKnowledge` (`registers.mjs`), returns: nothing here reads
 * the Markdown.
 *
 * ```text
 * { version: 1, repo, domains, entries, links, loose, unserved }
 * ```
 *
 * - **A domain** for `product/` (when it holds a file) and for each folder under `domains/`:
 *   `{ name, code, scope: 'product' | 'domain', counts: { principles, rules, invariants, laws,
 *   proposed } }`. A cross-domain entry counts in no domain.
 * - **An entry** for every principle, rule and invariant, in the order the registers are read:
 *   `{ id, kind, domain, domains, statement, why, status: 'law' | 'proposed', serves, enforced,
 *   enforcedBy, prd, file }`. `serves` is the `Serves:` line as written; `prd` the number its
 *   `Source:` line names, `null` when it names none. A cross-domain entry's `domain` is `null` and
 *   its `domains` the pair its file is named after; any other entry's `domains` is its one domain.
 *   An entry whose kind cannot be read (a cross-domain entry without a valid `Kind:`, which
 *   `omni check knowledge` refuses) is left out.
 * - **Links,** `{ from, to, kind }`, only between two entries that exist: `serves`, from a rule or
 *   an invariant to the principle its `Serves:` line names; `cites`, from an entry to another entry
 *   whose id its statement or `Why:` names. A self-citation is no link.
 * - **Loose** entries are the rules and invariants with no `serves` link: their `Serves:` is
 *   missing or names no principle. **Unserved** principles are those no entry serves.
 *
 * An absent knowledge folder is an empty graph, never an error. The folder is read off disk
 * ({@link readGraph}) or from texts already fetched, such as another repository's files read from
 * GitHub ({@link graphOfTexts}); the same parser reads both.
 */
import { idsCitedIn, memorySource, PRODUCT_CODE, readKnowledge } from './registers.mjs';

export const GRAPH_VERSION = 1;

const KINDS = ['principle', 'rule', 'invariant'];
const PRD_IN_SOURCE = /\bPRD\s*#(\d+)\b/;

/** The PRD number a `Source:` line names (`…, PRD #7`), or `null`. */
export function prdOf(source) {
  const match = PRD_IN_SOURCE.exec(source ?? '');
  return match ? Number(match[1]) : null;
}

/** A parsed entry as the graph carries it. `pairs` maps a cross-domain file to its pair. */
function graphEntry(entry, pairs) {
  const crossDomain = entry.scope === 'cross-domain';
  return {
    id: entry.id,
    kind: entry.kind,
    domain: crossDomain ? null : entry.domain,
    domains: crossDomain ? [...(pairs.get(entry.file) ?? [])] : [entry.domain],
    statement: entry.statement,
    why: entry.why,
    status: entry.proposed === null ? 'law' : 'proposed',
    serves: entry.serves,
    enforced: entry.enforced,
    enforcedBy: entry.enforcedBy,
    prd: prdOf(entry.source),
    file: entry.file,
  };
}

/** How many of `entries` are principles, rules and invariants, and how many are laws and proposed. */
export function countsOf(entries) {
  const counts = { principles: 0, rules: 0, invariants: 0, laws: 0, proposed: 0 };
  for (const entry of entries) {
    counts[`${entry.kind}s`] += 1;
    counts[entry.status === 'law' ? 'laws' : 'proposed'] += 1;
  }
  return counts;
}

/**
 * The graph from what `readKnowledge` returned. `repo` is the repository's slug, carried as given.
 *
 * @param {{ entries: object[], domains: object[], crossDomainFiles: object[], productFiles: string[] }} knowledge
 * @param {{ repo: string | null }} options
 */
export function buildGraph(knowledge, { repo }) {
  const pairs = new Map(knowledge.crossDomainFiles.map(({ file, pair }) => [file, pair ?? []]));
  const entries = knowledge.entries.filter((entry) => KINDS.includes(entry.kind)).map((entry) => graphEntry(entry, pairs));
  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  const domainRows = [
    ...(knowledge.productFiles.length > 0 ? [{ name: 'product', code: PRODUCT_CODE, scope: 'product' }] : []),
    ...knowledge.domains.map(({ name, code }) => ({ name, code, scope: 'domain' })),
  ];
  const domains = domainRows.map((row) => ({ ...row, counts: countsOf(entries.filter((entry) => entry.domain === row.name)) }));

  const links = [];
  for (const entry of entries) {
    const served = entry.kind === 'principle' ? undefined : byId.get(entry.serves);
    if (served?.kind === 'principle') links.push({ from: entry.id, to: served.id, kind: 'serves' });
    const cited = idsCitedIn([entry.statement, entry.why ?? ''].join('\n'));
    for (const id of cited) {
      if (id !== entry.id && byId.has(id)) links.push({ from: entry.id, to: id, kind: 'cites' });
    }
  }

  const serving = new Set(links.filter((link) => link.kind === 'serves').map((link) => link.from));
  const served = new Set(links.filter((link) => link.kind === 'serves').map((link) => link.to));
  const loose = entries.filter((entry) => entry.kind !== 'principle' && !serving.has(entry.id)).map((entry) => entry.id);
  const unserved = entries.filter((entry) => entry.kind === 'principle' && !served.has(entry.id)).map((entry) => entry.id);

  return { version: GRAPH_VERSION, repo, domains, entries, links, loose, unserved };
}

/** The graph of the repository `ctx` names, read off disk through the one parser. */
export function readGraph({ ctx }) {
  return buildGraph(readKnowledge({ ctx }), { repo: ctx.config.repo.slug });
}

/**
 * The graph of a knowledge folder held in memory: `texts` by path from the repository's root
 * (`{ '.omni-loop/knowledge/product/rules.md': '…' }`), `knowledgeRoot` where the folder sits, as
 * that repository's config says (`paths.knowledge`), and `repo` its slug. Files outside the folder
 * are ignored; a folder with no file is an empty graph.
 */
export function graphOfTexts({ texts, knowledgeRoot, repo }) {
  const ctx = { layout: { knowledgeRoot } };
  return buildGraph(readKnowledge({ ctx, source: memorySource(texts) }), { repo });
}
