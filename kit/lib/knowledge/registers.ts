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
 * An entry the knowledge harvest wrote (PRD #82) carries `Merged: @<who>, <date>, PR #<n>` beside
 * its `Decided:` line: who merged the feature pull request the decision came from, and when.
 *
 * Any entry may carry `Proposed: <who> <YYYY-MM-DD>` (PRD #68): no person has confirmed it yet. Its
 * id resolves, but it is no law — `laws.floorsHigh` is false for it — until a person removes the line.
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
import { existsSync, readFileSync, readdirSync, type Dirent } from 'node:fs';
import { basename, join } from 'node:path';

/** An entry's kind: a person's decision, a provable statement, or what must hold in the code. */
export type EntryKind = 'principle' | 'rule' | 'invariant';

/** Where an entry file sits: its scope, its domain, the code(s) its ids carry, and its layer. */
export type EntryScope = 'product' | 'domain' | 'cross-domain';
export type Place = { scope: EntryScope; domain: string; codes: string[]; kind: EntryKind | null };

/** An entry's `Proposed:` line read: who and when, both `null` when the line is malformed. */
export type Proposal = { by: string | null; on: string | null };

/** One entry of the knowledge folder, as {@link parseEntryFile} reads it. */
export type KnowledgeEntry = {
  id: string;
  kind: EntryKind | null;
  scope: EntryScope;
  domain: string;
  codes: string[];
  file: string;
  statement: string;
  why: string | null;
  decided: string | null;
  merged: string | null;
  source: string | null;
  serves: string | null;
  enforcedBy: string | null;
  enforced: boolean;
  stated: string | null;
  proposed: Proposal | null;
  kindLine: string | null;
  keptId: string | null;
  fieldCounts: Partial<Record<FieldKey, number>>;
  problems: string[];
};

/** Where the knowledge folder is read from (see {@link diskSource}). */
export type KnowledgeSource = {
  files: (dir: string) => string[];
  dirs: (dir: string) => string[];
  read: (file: string) => string;
};

/** What reading the knowledge folder needs of the context: the checkout and where the folder sits. */
export type KnowledgeCtx = { root: string; layout: { knowledgeRoot: string } };

export type KnowledgeDomain = { name: string; code: string; files: string[]; glossaryTerm: string | null };
export type CrossDomainFile = { file: string; name: string; pair: string[] | null };
export type Knowledge = {
  entries: KnowledgeEntry[];
  domains: KnowledgeDomain[];
  crossDomainFiles: CrossDomainFile[];
  productFiles: string[];
};

/** The product-wide code, the one "domain" that is not a folder under `domains/`. */
export const PRODUCT_CODE = 'PRODUCT';

/** The three layer files every product and domain folder carries, and the kind each one holds. */
export const LAYER_FILES: Record<string, EntryKind> = {
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
  /^(Why|Decided|Merged|Source|Serves|Enforced by|Stated|Proposed|Kind|Kept id|Glossary term):\s*(.*)$/;

/** The field names as they appear on a parsed entry. */
const FIELD_KEY = {
  Why: 'why',
  Decided: 'decided',
  Merged: 'merged',
  Source: 'source',
  Serves: 'serves',
  'Enforced by': 'enforcedBy',
  Stated: 'stated',
  Proposed: 'proposedLine',
  Kind: 'kindLine',
  'Kept id': 'keptId',
  'Glossary term': 'glossaryTerm',
} as const;

type FieldName = keyof typeof FIELD_KEY;
export type FieldKey = (typeof FIELD_KEY)[FieldName];

export function idsCitedIn(text: string): string[] {
  return [...new Set(text.match(ID_TOKEN) ?? [])];
}

/** A domain folder name (`agent-session`) → its code (`AGENTSESSION`). */
export function codeOf(name: string): string {
  return name.replace(/-/g, '').toUpperCase();
}

/**
 * The shape of an id, split: `{ type: 'P' | 'BR' | 'N' | 'CORE' | 'X', codes: string[], n }`.
 * `CORE` is one of the eight Core Invariants, `N1`…`N8`, which carry no code. `null` when the
 * string is no id at all.
 */
export function idParts(id: string): { type: string; codes: string[]; n: string } | null {
  if (!ID_SHAPE.test(id)) return null;
  const core = id.match(/^N(\d+)$/);
  if (core) return { type: 'CORE', codes: [], n: core[1] ?? '' };
  const parts = id.split('-');
  return { type: parts[0] ?? '', codes: parts.slice(1, -1), n: parts.at(-1) ?? '' };
}

/**
 * Reads every field line in `lines`: `{ fields: { key: value }, counts: { key: n }, fieldAt }`.
 * A value continues on the following non-blank, non-field lines; `fieldAt` is the index of the
 * first field line, where the statement ends.
 */
function readFields(lines: string[]): {
  fields: Partial<Record<FieldKey, string>>;
  counts: Partial<Record<FieldKey, number>>;
  fieldAt: number;
} {
  const fields: Partial<Record<FieldKey, string>> = {};
  const counts: Partial<Record<FieldKey, number>> = {};
  let fieldAt = -1;
  let open: FieldKey | null = null;
  lines.forEach((line, index) => {
    const match = line.match(FIELD_LINE);
    if (match) {
      if (fieldAt === -1) fieldAt = index;
      const key = FIELD_KEY[match[1] as FieldName]; // ts-allow: FIELD_LINE matches only FIELD_KEY's names
      counts[key] = (counts[key] ?? 0) + 1;
      if (counts[key] === 1) {
        fields[key] = (match[2] ?? '').trim();
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
function readProposed(file: string, id: string, value: string | undefined): { proposed: Proposal | null; problems: string[] } {
  if (value === undefined) return { proposed: null, problems: [] };
  const match = value.match(PROPOSED_VALUE);
  const [, by = '', on = ''] = match ?? [];
  if (match && !/\d{4}-\d{2}-\d{2}$/.test(by)) {
    return { proposed: { by, on }, problems: [] };
  }
  return {
    proposed: { by: null, on: null },
    problems: [`${file}: ${id} — "Proposed: ${value}" is not "Proposed: <who> <YYYY-MM-DD>".`],
  };
}

/** Splits `text` into `{ id, lines }` entries; any `##` heading that is not an id closes one. */
function splitEntries(text: string): { id: string; lines: string[] }[] {
  const entries: { id: string; lines: string[] }[] = [];
  let current: { id: string; lines: string[] } | null = null;
  for (const line of text.split('\n')) {
    const match = line.match(ENTRY_HEADING);
    if (match) {
      if (current) entries.push(current);
      current = { id: match[1] ?? '', lines: [] };
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
export function parseEntryFile(file: string, text: string, place: Place): KnowledgeEntry[] {
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
      merged: fields.merged ?? null,
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

function listDir(root: string, dir: string, predicate: (entry: Dirent) => boolean): string[] {
  const abs = join(root, dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs, { withFileTypes: true })
    .filter(predicate)
    .map((entry) => entry.name)
    .sort();
}

/**
 * Where {@link readKnowledge} reads the folder from: `files(dir)` and `dirs(dir)` name what sits
 * right under `dir` (a path from the repository's root), sorted, `[]` when `dir` is absent;
 * `read(file)` returns a file's text. This one reads the checkout under `root`.
 */
export function diskSource(root: string): KnowledgeSource {
  return {
    files: (dir) => listDir(root, dir, (entry) => entry.isFile()),
    dirs: (dir) => listDir(root, dir, (entry) => entry.isDirectory()),
    read: (file) => readFileSync(join(root, file), 'utf8'),
  };
}

/**
 * The same source over texts held in memory, `{ <path from the repository's root>: <text> }`: a
 * knowledge folder read from somewhere other than a checkout, such as a repository's files fetched
 * from GitHub. A folder exists when a file sits somewhere under it.
 */
export function memorySource(texts: Record<string, string>): KnowledgeSource {
  const paths = Object.keys(texts);
  const under = (dir: string): string[] => {
    const prefix = `${dir}/`;
    return paths.filter((path) => path.startsWith(prefix)).map((path) => path.slice(prefix.length));
  };
  return {
    files: (dir) => under(dir).filter((rest) => !rest.includes('/')).sort(),
    dirs: (dir) => {
      const nested = under(dir).filter((rest) => rest.includes('/'));
      return [...new Set(nested.map((rest) => rest.split('/')[0] ?? ''))].sort();
    },
    read: (file) => {
      if (!Object.hasOwn(texts, file)) throw new Error(`${file} is not among the files read`);
      return texts[file] ?? '';
    },
  };
}

/** A domain README's `Glossary term:` line, or `null`. */
export function glossaryTermOf(text: string): string | null {
  return readFields(text.split('\n')).fields.glossaryTerm ?? null;
}

/** The three folders the knowledge root carries, resolved from `ctx.layout.knowledgeRoot`. */
export function productDir(ctx: { layout: { knowledgeRoot: string } }): string {
  return `${ctx.layout.knowledgeRoot}/product`;
}

export function domainsDir(ctx: { layout: { knowledgeRoot: string } }): string {
  return `${ctx.layout.knowledgeRoot}/domains`;
}

export function crossDomainDir(ctx: { layout: { knowledgeRoot: string } }): string {
  return `${ctx.layout.knowledgeRoot}/cross-domain`;
}

/**
 * Reads the whole knowledge folder, off disk unless `source` says otherwise
 * ({@link memorySource}). An absent folder reads as empty — a fixture tree that needs none of it
 * (an outbox test) does not have to seed it.
 *
 * `{ entries, domains, crossDomainFiles, productFiles }`: `domains` is `[{ name, code, files,
 * glossaryTerm }]`, `files` the names present in the folder; `crossDomainFiles` is `[{ file, name,
 * pair }]`, `pair` `null` when the name is not `<a>--<b>`.
 */
export function readKnowledge({ ctx, source = diskSource(ctx.root) }: { ctx: KnowledgeCtx; source?: KnowledgeSource }): Knowledge {
  const entries: KnowledgeEntry[] = [];
  const PRODUCT_DIR = productDir(ctx);
  const DOMAINS_DIR = domainsDir(ctx);
  const CROSS_DOMAIN_DIR = crossDomainDir(ctx);

  const productFiles = source.files(PRODUCT_DIR);
  for (const [name, kind] of Object.entries(LAYER_FILES)) {
    if (!productFiles.includes(name)) continue;
    const file = `${PRODUCT_DIR}/${name}`;
    entries.push(
      ...parseEntryFile(file, source.read(file), {
        scope: 'product',
        domain: 'product',
        codes: [PRODUCT_CODE],
        kind,
      }),
    );
  }

  const domains = source.dirs(DOMAINS_DIR).map((name) => {
    const dir = `${DOMAINS_DIR}/${name}`;
    const files = source.files(dir);
    const code = codeOf(name);
    for (const [layer, kind] of Object.entries(LAYER_FILES)) {
      if (!files.includes(layer)) continue;
      const file = `${dir}/${layer}`;
      entries.push(
        ...parseEntryFile(file, source.read(file), {
          scope: 'domain',
          domain: name,
          codes: [code],
          kind,
        }),
      );
    }
    const glossaryTerm = files.includes('README.md')
      ? glossaryTermOf(source.read(`${dir}/README.md`))
      : null;
    return { name, code, files, glossaryTerm };
  });

  const crossDomainNames = source.files(CROSS_DOMAIN_DIR).filter((name) => name.endsWith('.md'));
  const crossDomainFiles = crossDomainNames.map((fileName) => {
    const name = basename(fileName, '.md');
    const halves = name.split('--');
    const pair = halves.length === 2 && halves.every(Boolean) ? halves : null;
    const file = `${CROSS_DOMAIN_DIR}/${fileName}`;
    entries.push(
      ...parseEntryFile(file, source.read(file), {
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
export function readRegisters({ ctx }: { ctx: KnowledgeCtx }): {
  entries: KnowledgeEntry[];
  principles: KnowledgeEntry[];
  rules: KnowledgeEntry[];
  invariants: KnowledgeEntry[];
} {
  const { entries } = readKnowledge({ ctx });
  return {
    entries,
    principles: entries.filter((entry) => entry.kind === 'principle'),
    rules: entries.filter((entry) => entry.kind === 'rule'),
    invariants: entries.filter((entry) => entry.kind === 'invariant'),
  };
}

/**
 * Per register folder — `product/`, each `domains/<domain>/`, `cross-domain/` — how many of its
 * entries are laws and how many are proposed (PRD #68): `[{ folder, laws, proposals }]`, in that
 * order, a folder listed only when it exists and holds a file. An absent knowledge folder is `[]`.
 */
export function registerCounts({ ctx }: { ctx: KnowledgeCtx }): { folder: string; laws: number; proposals: number }[] {
  const knowledge = readKnowledge({ ctx });
  const folders = [
    ...(knowledge.productFiles.length > 0 ? [productDir(ctx)] : []),
    ...knowledge.domains.map((domain) => `${domainsDir(ctx)}/${domain.name}`),
    ...(knowledge.crossDomainFiles.length > 0 ? [crossDomainDir(ctx)] : []),
  ];
  return folders.map((folder) => {
    const held = knowledge.entries.filter((entry) => entry.file.startsWith(`${folder}/`));
    const proposals = held.filter((entry) => entry.proposed !== null).length;
    return { folder, laws: held.length - proposals, proposals };
  });
}

/** `id` → its entry, or `null` when nothing claims it. */
export function resolveId(id: string, { ctx }: { ctx: KnowledgeCtx }): KnowledgeEntry | null {
  return readKnowledge({ ctx }).entries.find((entry) => entry.id === id) ?? null;
}

/**
 * Every entry whose `Serves:` line names `id` — "the rules a principle produced", derived and never
 * written by hand, because two copies of a link drift.
 */
export function servedBy(entries: readonly KnowledgeEntry[], id: string): KnowledgeEntry[] {
  return entries.filter((entry) => entry.serves === id);
}
