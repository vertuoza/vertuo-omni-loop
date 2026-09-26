/**
 * The ONE parser for the knowledge folder — where what is true about the product is written
 * down, rooted at `ctx.layout.knowledgeRoot`:
 *
 * ```text
 * <knowledgeRoot>/
 *   README.md                  the front page, for a person — never parsed for entries
 *   product/                   principles.md · rules.md · invariants.md
 *   domains/<domain>/          README.md · principles.md · rules.md · invariants.md
 *   cross-domain/<a>--<b>.md   rules and invariants only, a before b alphabetically
 * ```
 *
 * Three kinds of entry, one per file for product and domain folders:
 *
 * - **principle** (`P-<CODE>-n`) — a person's product decision. Lines `Why:`, `Decided:`,
 *   `Source:`; never `Enforced by:`, because a principle is judged, not proven.
 * - **rule** (`BR-<CODE>-n`) — a precise, provable statement. Lines `Serves:` (one principle),
 *   `Source:`, `Enforced by:`, `Stated:`.
 * - **invariant** (`N-<CODE>-n`, and the eight Core Invariants `N1`…`N8` in `product/`) — what
 *   must hold in the code. Lines `Source:`, `Enforced by:`, `Stated:`, optional `Serves:`.
 *
 * A cross-domain entry (`X-<A>-<B>-n`) says which of the last two it is with `Kind:`. `Kept id:`
 * marks an entry whose id predates the layout and whose prefix is therefore not its domain's code.
 * A domain's **code** is its folder name uppercased with the hyphens removed.
 *
 * Nothing else may glob this markdown: `check-knowledge.mjs` grades it, `outbox.mjs` resolves a
 * `bears-on` id through {@link resolveId}, and `describe.mjs` prints an entry and what serves it.
 *
 * Parsing is line-oriented and deliberately plain: a `## <id>` heading opens an entry and any other
 * `##` heading closes it; the body's non-blank lines before the first field line are the
 * statement; a field line (`Serves: …`) holds its value, continued on the following non-blank
 * lines until a blank line or the next field. Everything else — a `Note:` paragraph explaining a
 * partial `Enforced by:` claim — is prose the guard does not need to understand.
 */
// Ported from vertuo-ai-domain@c4a210122:scripts/registers.mjs — changes in kit/porting/knowledge--registers.md.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';

/** The product-wide code, the one "domain" that is not a folder under `domains/`. */
export const PRODUCT_CODE = 'PRODUCT';

/** The three layer files every product and domain folder carries, and the kind each one holds. */
export const LAYER_FILES = {
  'principles.md': 'principle',
  'rules.md': 'rule',
  'invariants.md': 'invariant',
};

/** Every id shape, as one alternation. Order matters: the longer shapes first. */
const ID_SOURCE =
  'X-[A-Z0-9]+-[A-Z0-9]+-\\d+|BR-[A-Z0-9]+-\\d+|P-[A-Z0-9]+-\\d+|N-[A-Z0-9]+-\\d+|N\\d+';

/** A whole string that is an id of any kind. */
export const ID_SHAPE = new RegExp(`^(?:${ID_SOURCE})$`);

/** Every id-shaped token (`N3`, `BR-QUOTE-1`, `P-ADVISOR-2`, `X-ADVISOR-CREDITS-1`) in a text. */
export const ID_TOKEN = new RegExp(`\\b(?:${ID_SOURCE})\\b`, 'g');

const ENTRY_HEADING = new RegExp(`^##\\s+(${ID_SOURCE})\\s*$`);
const ANY_H2 = /^##\s/;
const FIELD_LINE =
  /^(Why|Decided|Source|Serves|Enforced by|Stated|Proposed|Kind|Kept id|Glossary term):\s*(.*)$/;

/** The field names as they appear on a parsed entry. */
const FIELD_KEY = {
  Why: 'why',
  Decided: 'decided',
  Source: 'source',
  Serves: 'serves',
  'Enforced by': 'enforcedBy',
  Stated: 'stated',
  Proposed: 'proposedLine',
  Kind: 'kindLine',
  'Kept id': 'keptId',
  'Glossary term': 'glossaryTerm',
};

export function idsCitedIn(text) {
  return [...new Set(text.match(ID_TOKEN) ?? [])];
}

/** A domain folder name (`agent-session`) → its code (`AGENTSESSION`). */
export function codeOf(name) {
  return name.replace(/-/g, '').toUpperCase();
}

/**
 * The shape of an id, split: `{ type: 'P' | 'BR' | 'N' | 'CORE' | 'X', codes: string[], n }`.
 * `CORE` is one of the eight Core Invariants, `N1`…`N8`, which carry no code. `null` when the
 * string is no id at all.
 */
export function idParts(id) {
  if (!ID_SHAPE.test(id)) return null;
  const core = id.match(/^N(\d+)$/);
  if (core) return { type: 'CORE', codes: [], n: core[1] };
  const parts = id.split('-');
  return { type: parts[0], codes: parts.slice(1, -1), n: parts.at(-1) };
}

/**
 * Reads every field line in `lines`: `{ fields: { key: value }, counts: { key: n }, fieldAt }`.
 * A value continues on the following non-blank, non-field lines; `fieldAt` is the index of the
 * first field line, where the statement ends.
 */
function readFields(lines) {
  const fields = {};
  const counts = {};
  let fieldAt = -1;
  let open = null;
  lines.forEach((line, index) => {
    const match = line.match(FIELD_LINE);
    if (match) {
      if (fieldAt === -1) fieldAt = index;
      const key = FIELD_KEY[match[1]];
      counts[key] = (counts[key] ?? 0) + 1;
      if (counts[key] === 1) {
        fields[key] = match[2].trim();
        open = key;
      } else {
        open = null;
      }
      return;
    }
    if (line.trim() === '') {
      open = null;
      return;
    }
    if (open) fields[open] = `${fields[open]} ${line.trim()}`.trim();
  });
  return { fields, counts, fieldAt };
}

/** A `Proposed:` value: who proposed the entry, then the day, `YYYY-MM-DD`. */
const PROPOSED_VALUE = /^(\S.*?)\s+(\d{4}-\d{2}-\d{2})$/;

/**
 * An entry's `Proposed:` line read: `{ proposed, problems }`. `proposed` is `{ by, on }`, `null` when
 * the entry carries no such line — a law. A malformed line still reads as proposed (`by` and `on`
 * `null`): the line says a person has not confirmed the entry, whatever its shape; the problem
 * names the file so the checker refuses it.
 */
function readProposed(file, id, value) {
  if (value === undefined) return { proposed: null, problems: [] };
  const match = value.match(PROPOSED_VALUE);
  if (match && !/\d{4}-\d{2}-\d{2}$/.test(match[1])) {
    return { proposed: { by: match[1], on: match[2] }, problems: [] };
  }
  return {
    proposed: { by: null, on: null },
    problems: [`${file}: ${id} — "Proposed: ${value}" is not "Proposed: <who> <YYYY-MM-DD>".`],
  };
}

/** Splits `text` into `{ id, lines }` entries; any `##` heading that is not an id closes one. */
function splitEntries(text) {
  const entries = [];
  let current = null;
  for (const line of text.split('\n')) {
    const match = line.match(ENTRY_HEADING);
    if (match) {
      if (current) entries.push(current);
      current = { id: match[1], lines: [] };
    } else if (ANY_H2.test(line)) {
      if (current) entries.push(current);
      current = null;
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) entries.push(current);
  return entries;
}

/**
 * Parses one entry file's text. `place` says where the file sits: `{ scope, domain, codes, kind }`
 * — `scope` is `product`, `domain` or `cross-domain`; `codes` the code(s) an id there must carry;
 * `kind` the file's layer (`null` for a cross-domain file, whose entries say it with `Kind:`).
 */
export function parseEntryFile(file, text, place) {
  return splitEntries(text).map(({ id, lines }) => {
    const { fields, counts, fieldAt } = readFields(lines);
    const statement = (fieldAt === -1 ? lines : lines.slice(0, fieldAt))
      .filter((line) => line.trim().length > 0)
      .join(' ')
      .trim();
    const kind =
      place.kind ??
      (fields.kindLine === 'rule' || fields.kindLine === 'invariant' ? fields.kindLine : null);
    const enforcedBy = fields.enforcedBy ?? null;
    const { proposed, problems } = readProposed(file, id, fields.proposedLine);
    return {
      id,
      kind,
      scope: place.scope,
      domain: place.domain,
      codes: place.codes,
      file,
      statement,
      why: fields.why ?? null,
      decided: fields.decided ?? null,
      source: fields.source ?? null,
      serves: fields.serves ?? null,
      enforcedBy,
      enforced: enforcedBy !== null && enforcedBy !== 'unenforced',
      stated: fields.stated ?? null,
      proposed,
      kindLine: fields.kindLine ?? null,
      keptId: fields.keptId ?? null,
      fieldCounts: counts,
      problems,
    };
  });
}

function listDir(root, dir, predicate) {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { withFileTypes: true })
    .filter(predicate)
    .map((entry) => entry.name)
    .sort();
}

/** A domain README's `Glossary term:` line, or `null`. */
export function glossaryTermOf(text) {
  return readFields(text.split('\n')).fields.glossaryTerm ?? null;
}

/** The three folders the knowledge root carries, resolved from `ctx.layout.knowledgeRoot`. */
export function productDir(ctx) {
  return `${ctx.layout.knowledgeRoot}/product`;
}

export function domainsDir(ctx) {
  return `${ctx.layout.knowledgeRoot}/domains`;
}

export function crossDomainDir(ctx) {
  return `${ctx.layout.knowledgeRoot}/cross-domain`;
}

/**
 * Reads the whole knowledge folder off disk. An absent folder reads as empty — a fixture tree that
 * needs none of it (an outbox test) does not have to seed it.
 *
 * `{ entries, domains, crossDomainFiles, productFiles }`: `domains` is `[{ name, code, files,
 * glossaryTerm }]`, `files` the names present in the folder; `crossDomainFiles` is `[{ file, name,
 * pair }]`, `pair` `null` when the name is not `<a>--<b>`.
 */
export function readKnowledge({ ctx }) {
  const entries = [];
  const PRODUCT_DIR = productDir(ctx);
  const DOMAINS_DIR = domainsDir(ctx);
  const CROSS_DOMAIN_DIR = crossDomainDir(ctx);

  const productFiles = listDir(ctx.root, PRODUCT_DIR, (entry) => entry.isFile());
  for (const [name, kind] of Object.entries(LAYER_FILES)) {
    if (!productFiles.includes(name)) continue;
    const file = `${PRODUCT_DIR}/${name}`;
    entries.push(
      ...parseEntryFile(file, readFileSync(join(ctx.root, file), 'utf8'), {
        scope: 'product',
        domain: 'product',
        codes: [PRODUCT_CODE],
        kind,
      }),
    );
  }

  const domains = listDir(ctx.root, DOMAINS_DIR, (entry) => entry.isDirectory()).map((name) => {
    const dir = `${DOMAINS_DIR}/${name}`;
    const files = listDir(ctx.root, dir, (entry) => entry.isFile());
    const code = codeOf(name);
    for (const [layer, kind] of Object.entries(LAYER_FILES)) {
      if (!files.includes(layer)) continue;
      const file = `${dir}/${layer}`;
      entries.push(
        ...parseEntryFile(file, readFileSync(join(ctx.root, file), 'utf8'), {
          scope: 'domain',
          domain: name,
          codes: [code],
          kind,
        }),
      );
    }
    const glossaryTerm = files.includes('README.md')
      ? glossaryTermOf(readFileSync(join(ctx.root, dir, 'README.md'), 'utf8'))
      : null;
    return { name, code, files, glossaryTerm };
  });

  const crossDomainFiles = listDir(
    ctx.root,
    CROSS_DOMAIN_DIR,
    (entry) => entry.isFile() && entry.name.endsWith('.md'),
  ).map((fileName) => {
    const name = basename(fileName, '.md');
    const halves = name.split('--');
    const pair = halves.length === 2 && halves.every(Boolean) ? halves : null;
    const file = `${CROSS_DOMAIN_DIR}/${fileName}`;
    entries.push(
      ...parseEntryFile(file, readFileSync(join(ctx.root, file), 'utf8'), {
        scope: 'cross-domain',
        domain: name,
        codes: pair ? pair.map(codeOf) : [],
        kind: null,
      }),
    );
    return { file, name, pair };
  });

  return { entries, domains, crossDomainFiles, productFiles };
}

/**
 * The knowledge folder as the older callers read it: `{ principles, rules, invariants, entries }`.
 * `rules` and `invariants` include cross-domain entries of that kind.
 */
export function readRegisters({ ctx }) {
  const { entries } = readKnowledge({ ctx });
  return {
    entries,
    principles: entries.filter((entry) => entry.kind === 'principle'),
    rules: entries.filter((entry) => entry.kind === 'rule'),
    invariants: entries.filter((entry) => entry.kind === 'invariant'),
  };
}

/** `id` → its entry, or `null` when nothing claims it. */
export function resolveId(id, { ctx }) {
  return readKnowledge({ ctx }).entries.find((entry) => entry.id === id) ?? null;
}

/**
 * Every entry whose `Serves:` line names `id` — "the rules a principle produced", derived and never
 * written by hand, because two copies of a link drift.
 */
export function servedBy(entries, id) {
  return entries.filter((entry) => entry.serves === id);
}
