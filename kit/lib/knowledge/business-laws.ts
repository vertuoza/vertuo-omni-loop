/**
 * **Business laws** (PRD 2632): the rules of the product, written for the people who build it, each
 * with its reason. They sit beside the registers but are none of them:
 *
 * ```text
 * <knowledgeRoot>/
 *   product/business-laws.md          the laws that apply everywhere (code PRODUCT)
 *   domains/<key>/business-laws.md    the laws of one domain (code: the folder's, as the registers make it)
 * ```
 *
 * ```markdown
 * ## BL-QUOTES-1
 * A quote can be sent only when its total including tax is above zero.
 * Why: A customer who receives an empty quote stops trusting the contractor.
 * Also: invoicing
 * ```
 *
 * Every `##` heading of the file opens a law; its id is `BL-<CODE>-<n>`. The body's non-blank lines
 * before the first field are the statement; `Why:` is required (it is what a red shows) and `Also:`
 * names more domain keys, comma-separated. A business law needs no test and no paths, never counts
 * toward `laws.max`, and is never {@link isLaw}: the thesis and the briefing never see it, under any
 * `laws.source`. A plan repository's imported copies under `repos/<target>/` never count.
 *
 * {@link selectBusinessLaws} is the one pure selection the terminal and the server share: the domains
 * of a spec's `areas:`, the domains of each glossary term (or avoid word) its body uses as a whole
 * word, whatever its case, then every law of those domains and every `product/` law.
 */
import { codeOf, diskSource, domainsDir, PRODUCT_CODE, productDir, type KnowledgeCtx, type KnowledgeSource } from './registers.ts';
import type { LawOwner } from '../config.ts';

/** The file a folder's business laws live in. */
export const BUSINESS_LAWS_FILE = 'business-laws.md';

/** One business law, as {@link parseBusinessLaws} reads it. `domain` is the folder's key, `product` for `product/`. */
export type BusinessLaw = {
  id: string;
  statement: string;
  why: string | null;
  also: string[];
  scope: 'product' | 'domain';
  domain: string;
  file: string;
  problems: string[];
};

/** Where a file of business laws sits: `product/`, or a domain folder named `domain`. */
export type BusinessLawPlace = { scope: 'product' | 'domain'; domain: string };

const HEADING = /^##\s+(.*?)\s*$/;
const ID = /^BL-([A-Z0-9]+)-[1-9]\d*$/;
const FIELD = /^(Why|Also):\s*(.*)$/;

/** The comma-separated keys of an `Also:` line, backticks stripped. */
const keysOf = (value: string): string[] =>
  value
    .split(',')
    .map((part) => part.replace(/`/g, '').trim())
    .filter(Boolean);

/** Splits a file into `{ heading, lines }` blocks, one per `##` heading; what comes before the first is the file's own prose. */
function blocks(text: string): { heading: string; lines: string[] }[] {
  const found: { heading: string; lines: string[] }[] = [];
  for (const line of text.split('\n')) {
    const match = line.match(HEADING);
    if (match) found.push({ heading: match[1] ?? '', lines: [] });
    else found.at(-1)?.lines.push(line);
  }
  return found;
}

/** A block's statement and fields: each field continued on the following non-blank lines until a blank line or the next field. */
function readBody(raw: readonly string[]): { statement: string; why: string | null; also: string | null } {
  const lines = raw.map((line) => line.trim());
  const fieldAt = lines.findIndex((line) => FIELD.test(line));
  const statement = (fieldAt === -1 ? lines : lines.slice(0, fieldAt)).filter(Boolean).join(' ');
  return { statement, why: fieldValue(lines, 'Why') || null, also: fieldValue(lines, 'Also') };
}

/** The value of a block's first `<name>:` line, continued on the following non-blank, non-field lines; `null` with no such line. */
function fieldValue(lines: readonly string[], name: 'Why' | 'Also'): string | null {
  const at = lines.findIndex((line) => line.match(FIELD)?.[1] === name);
  if (at === -1) return null;
  const rest = lines.slice(at + 1);
  const end = rest.findIndex((line) => line === '' || FIELD.test(line));
  const continued = end === -1 ? rest : rest.slice(0, end);
  return [lines[at]?.match(FIELD)?.[2] ?? '', ...continued].join(' ').trim();
}

/** Why `id` is not right for a file at `place`: its shape, or its code against the folder's; none when it is. */
function idProblem(file: string, id: string, place: BusinessLawPlace): string | null {
  const code = place.scope === 'product' ? PRODUCT_CODE : codeOf(place.domain);
  const match = id.match(ID);
  if (!match) return `${file}: ${id} — is not a business law id: write BL-${code}-<n>.`;
  if (match[1] !== code) return `${file}: ${id} — names ${match[1] ?? ''}, but it sits in the ${place.domain} folder: write BL-${code}-<n>.`;
  return null;
}

/** Parses one `business-laws.md`: a law per `##` heading, each carrying the problems of its own lines. */
export function parseBusinessLaws(file: string, text: string, place: BusinessLawPlace): BusinessLaw[] {
  return blocks(text).map(({ heading, lines }) => {
    const { statement, why, also } = readBody(lines);
    const problems = [
      idProblem(file, heading, place),
      statement === '' ? `${file}: ${heading} — has no statement.` : null,
      why === null ? `${file}: ${heading} — is missing a "Why:" line: a business law says why it exists, and a red shows it.` : null,
    ].filter((problem): problem is string => problem !== null);
    return { id: heading, statement, why, also: also === null ? [] : keysOf(also), scope: place.scope, domain: place.domain, file, problems };
  });
}

/** Every business law of the knowledge folder: `product/` first, then each domain folder in order. Imported copies never count. */
export function readBusinessLaws({ ctx, source = diskSource(ctx.root) }: { ctx: KnowledgeCtx; source?: KnowledgeSource }): BusinessLaw[] {
  const product = productDir(ctx);
  const domains = domainsDir(ctx);
  const laws: BusinessLaw[] = [];
  if (source.files(product).includes(BUSINESS_LAWS_FILE)) {
    const file = `${product}/${BUSINESS_LAWS_FILE}`;
    laws.push(...parseBusinessLaws(file, source.read(file), { scope: 'product', domain: 'product' }));
  }
  for (const name of source.dirs(domains)) {
    if (!source.files(`${domains}/${name}`).includes(BUSINESS_LAWS_FILE)) continue;
    const file = `${domains}/${name}/${BUSINESS_LAWS_FILE}`;
    laws.push(...parseBusinessLaws(file, source.read(file), { scope: 'domain', domain: name }));
  }
  return laws;
}

/** The domains a law belongs to: its folder and each `Also:` key, once each; none for a `product/` law, which applies everywhere. */
export function businessLawDomains(law: Pick<BusinessLaw, 'scope' | 'domain' | 'also'>): string[] {
  return law.scope === 'product' ? [] : [...new Set([law.domain, ...law.also])];
}

/**
 * What `omni check knowledge` refuses of the business laws: each law's own problems, a number used
 * twice, and any law while `laws.owners` names nobody, since only an owner approves a change to one.
 * `owners` is `null` where they are not asked: an imported copy's are its target's.
 */
export function businessLawProblems(laws: readonly BusinessLaw[], { owners, where }: { owners: readonly LawOwner[] | null; where: string }): string[] {
  const seen = new Map<string, string>();
  const problems = laws.flatMap((law) => {
    const first = seen.get(law.id);
    if (first === undefined) seen.set(law.id, law.file);
    const reused = first === undefined ? [] : [`${law.file}: ${law.id} — already used in ${first}: a business law's number is used once.`];
    return [...law.problems, ...reused];
  });
  if (laws.length > 0 && owners?.length === 0) {
    const counted = `${laws.length} business ${laws.length === 1 ? 'law' : 'laws'}`;
    problems.push(`${where}: ${counted}, and laws.owners is empty — name the product's PM in laws.owners: only they approve a change to one.`);
  }
  return problems;
}

const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/** A spec split into its front matter and its body; all body with no front matter. */
function splitSpec(spec: string): { front: string; body: string } {
  const match = spec.match(FRONT_MATTER);
  return match ? { front: match[1] ?? '', body: match[2] ?? '' } : { front: '', body: spec };
}

/** The domain keys of a spec's `areas: [a, b]` front-matter line; none without one. */
export function specAreas(spec: string): string[] {
  const line = splitSpec(spec)
    .front.split('\n')
    .map((one) => one.match(/^areas:\s*\[(.*)\]\s*$/))
    .find((match) => match !== null);
  return line ? keysOf(line[1] ?? '') : [];
}

/** A glossary term as the selection reads it: the term, its avoid words, and the domains it names. */
export type SelectionTerm = { term: string; avoid: readonly string[]; domains?: readonly string[] | undefined };

/** A domain taken, with why: `areas`, or each word of the spec that pointed to it. */
export type SelectedDomain = { key: string; reasons: string[] };

/** What a spec is judged against: the domains taken, in the order taken, and their laws, `product/` first. */
export type BusinessLawSelection = { domains: SelectedDomain[]; laws: BusinessLaw[] };

/** Whether `text` holds `word` as a whole word, whatever its case. */
export function usesWord(text: string, word: string): boolean {
  const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  if (escaped === '') return false;
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, 'iu').test(text);
}

/**
 * The laws a spec is judged against (PRD 2632), pure and with no model: the domains of its `areas:`,
 * then the domains of each glossary term its body uses (the term, or one of its avoid words) — a term
 * naming no domain adds none — then every law of those domains, by its folder or its `Also:`, and
 * every `product/` law.
 */
export function selectBusinessLaws({ spec, laws, glossary }: { spec: string; laws: readonly BusinessLaw[]; glossary: readonly SelectionTerm[] }): BusinessLawSelection {
  const taken = new Map<string, string[]>();
  const take = (key: string, reason: string) => {
    const reasons = taken.get(key) ?? [];
    if (!reasons.includes(reason)) reasons.push(reason);
    taken.set(key, reasons);
  };
  for (const key of specAreas(spec)) take(key, 'areas');
  const { body } = splitSpec(spec);
  for (const { term, avoid, domains = [] } of glossary) {
    if (domains.length === 0) continue;
    const word = usesWord(body, term) ? `"${term}"` : avoid.filter((one) => usesWord(body, one)).map((one) => `"${one}" (for "${term}")`)[0];
    if (word === undefined) continue;
    for (const key of domains) take(key, word);
  }
  const selected = laws.filter((law) => law.scope === 'product' || businessLawDomains(law).some((key) => taken.has(key)));
  return { domains: [...taken].map(([key, reasons]) => ({ key, reasons })), laws: selected };
}
