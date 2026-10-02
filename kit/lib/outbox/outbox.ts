/**
 * **An outbox item is a typed thing** (PRD #985, slice s2). **Every open item also carries its
 * plain words** (PRD #1071, slice s1). **Every open question carries its options** (PRD #1166,
 * slice s4).
 *
 * The ONE parser for an outbox item file (`<slice>-<nn>-<slug>.md`, under whichever directory
 * `ctx.layout.outboxDirs()` names). Pure: markdown text in, a typed item out — Zod-first per
 * invariant N1. No filesystem access happens in {@link parseOutboxItem}, {@link floorRank} or
 * {@link plainWordsProblems}; only {@link resolveBearsOn} and {@link outboxItemFiles} touch disk,
 * and they take the context or the injected laws rather than assuming a repo root.
 *
 * An item is a front-matter block (`id`, `prd`, `slice`, `rank`, `bears-on`, `raised`, `wave`)
 * followed by, for every item raised under this PRD or later, two plain-words sections, first and
 * in this order:
 *
 *   ## The question, in plain words
 *   ## The decision, in plain words
 *
 * — then, right after them, exactly one of two headings: `## The options, in plain words` (two to
 * four `A.` … `D.` lines, A the option built) for anything but a `human-action` item, or
 * `## What a person must do` for one, since a `human-action` item has nothing to choose between —
 * exposed on a parsed item as `sections.options` (`{ letter, text }[]`) or `sections.personSteps`
 * (plain text) respectively. Then the four fixed sections this parser has always required,
 * unchanged and in this exact order:
 *
 *   ## What I had to decide
 *   ## What I did meanwhile
 *   ## What it costs to change later
 *   ## What I could not know
 *
 * **The two plain sections are optional at THIS parser's level, on purpose.** `parseOutboxItem` is
 * also the function a settle step embeds an item's text through and a rework step reads a settled
 * entry's embedded item text back with — and a settled entry written before this slice carries an
 * item with no plain sections at all, forever, because the settled ledger is append-only. Requiring
 * them here would make every settled entry written before this PRD unreadable. So this parser
 * accepts a body with the two plain sections first (both, together, in order) OR with neither —
 * never one without the other — and reports `sections.questionPlain` / `sections.decisionPlain` as
 * `undefined` when they are absent. **Requiring them for a currently-open item is the outbox
 * guard's job, not this parser's** — that guard reads only files `outboxItemFiles` lists (never the
 * settled ledger), so only an item still open is ever held to the requirement.
 *
 * **The options/person-steps heading is optional here too, for the same reason.** An item raised
 * before this slice, and every settled entry's embedded item text (append-only, forever), carries
 * neither `## The options, in plain words` nor `## What a person must do` — `sections.options` and
 * `sections.personSteps` both come back `undefined` then, and this parser still accepts the body.
 * A body may carry at most one of the two headings, never both, and — when it carries one — it
 * sits right after the two plain sections. Whether a *currently open* high or medium item actually
 * needs two to four options, in order, is the guard's call, not this parser's; a malformed
 * `A. <sentence>` line is the one thing this parser itself refuses, via {@link parseOutboxOptions}.
 *
 * **An item may carry an intro and a punchline** (PRD #50, slice s1): `## The intro, for fun` and
 * `## The punchline, for fun`, together or neither, right after the two plain sections and before
 * the options or the person steps — exposed as `sections.introFun` and `sections.punchlineFun`.
 * Optional here AND at the guard, for good: an item raised before PRD #50 and every settled entry
 * written before it carry neither, and the pull request's outbox comment fills in for them. A body
 * carrying only one of the two, carrying them anywhere else, or carrying them with no plain
 * sections to sit after, is refused.
 *
 * **The plain-words rules are one pure function**, {@link plainWordsProblems}, so a caller never
 * reimplements what "plain" means: the guard calls it on both plain sections of every open item,
 * and nothing else does. The intro and the punchline are held to the same rules plus a length cap,
 * through {@link funLineProblems}.
 *
 * **Where ADR and knowledge resolution live.** This module has no filesystem opinion of its own
 * about what a `bears-on` id resolves against, or which ids floor a rank at `high` — those are
 * `laws.mjs`'s call (Task 4), injected here as `laws`. `bears-on` may legitimately name an ADR (the
 * plan's Durable decisions: "An ADR breach is not a hard stop" — contradicting an ADR is proposing
 * to supersede it, which earns a `high` item rather than a stop): {@link resolveBearsOn} simply
 * forwards to `laws.resolve`, and {@link bearsOnFloorsHigh} to `laws.floorsHigh`.
 */
// Ported from vertuo-ai-domain@c4a210122:scripts/outbox.mjs — changes in kit/porting/outbox--outbox.md.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { z } from 'zod';
import { parseFrontMatterLines, withFile } from '../front-matter.ts';
import type { PrdNumber } from '../layout.ts';
import type { Laws, Resolution } from '../laws.ts';
import type { makeMarkers } from '../markers.ts';
import { OutboxItemFrontMatterSchema, RANK_VALUES } from '../schema/front-matter.ts';
import { KIT_MESSAGES } from '../schema/messages.ts';
import type { OutboxItem, OutboxOption, OutboxSections, Rank } from '../types.ts';

export { RANK_VALUES };

export const SETTLED_FILE = 'settled.md';


/**
 * Severity order used only to decide whether `floorRank` would RAISE a proposed rank — never to
 * rank the ranks against each other for any other purpose. Higher means "harder to talk down."
 */
export const RANK_ORDER: Readonly<Record<Rank, number>> = { medium: 0, high: 1, 'human-action': 2 };

/** The four section headings, in the exact order and spelling an item must carry. */
export const REQUIRED_SECTIONS: readonly [string, string, string, string] = [
  'What I had to decide',
  'What I did meanwhile',
  'What it costs to change later',
  'What I could not know',
];

/**
 * The two plain-words headings, in the exact order and spelling (PRD #1071). First in the file,
 * before {@link REQUIRED_SECTIONS} — together, or neither: see the module doc for why a settled
 * entry's embedded item may carry neither.
 */
export const PLAIN_SECTIONS: readonly [string, string] = ['The question, in plain words', 'The decision, in plain words'];

/**
 * The intro and the punchline an item may carry (PRD #50, slice s1): two short lines about its
 * question, which the pull request's outbox comment shows around it. Together or neither, right
 * after {@link PLAIN_SECTIONS} and before the options or the person steps. Optional at THIS
 * parser's level and at the guard's: every item raised before PRD #50, and every settled entry's
 * embedded item (`settled.md` is append-only), carries neither, forever.
 */
export const FUN_SECTIONS: readonly [string, string] = ['The intro, for fun', 'The punchline, for fun'];

/** The longest an intro or a punchline may be, in characters — see {@link funLineProblems}. */
export const FUN_LINE_MAX_LENGTH = 120;

/**
 * The two headings an item may carry right after {@link PLAIN_SECTIONS} (and {@link FUN_SECTIONS},
 * when it carries them), and before {@link REQUIRED_SECTIONS} — never both (PRD #1166, slice s4).
 * `The options, in plain words` carries two to four `A.` … `D.` lines, A the option built; a
 * `human-action` item carries `What a person must do` instead, since only a person can act on it
 * and there is nothing to choose between. Optional at THIS parser's level, exactly like
 * {@link PLAIN_SECTIONS} — a
 * currently open item is held to carrying one of the two by the outbox guard, never by
 * this pure parser, and a settled entry written before this slice carries neither, forever
 * (`settled.md` is append-only).
 */
export const OPTIONS_HEADING = 'The options, in plain words';
export const PERSON_STEPS_HEADING = 'What a person must do';

/** The letters an options section may use, in the only order the guard accepts. */
export const OPTION_LETTERS: readonly string[] = ['A', 'B', 'C', 'D'];

/** A text field of a parsed item's `sections` (every field but `options`). */
type SectionTextField = Exclude<keyof OutboxSections, 'options'>;

/** One `## Heading` of a body and its trimmed text. */
type HeadingSection = { heading: string; content: string };

/** The result of {@link parseOutboxItem}. */
export type ParsedOutboxItem = { ok: true; item: OutboxItem } | { ok: false; errors: string[] };

/** camelCase field name each heading maps to on a parsed item's `sections` object. */
const SECTION_FIELD: Readonly<Record<string, SectionTextField>> = {
  'The question, in plain words': 'questionPlain',
  'The decision, in plain words': 'decisionPlain',
  'The intro, for fun': 'introFun',
  'The punchline, for fun': 'punchlineFun',
  [PERSON_STEPS_HEADING]: 'personSteps',
  'What I had to decide': 'whatIHadToDecide',
  'What I did meanwhile': 'whatIDidMeanwhile',
  'What it costs to change later': 'whatItCostsToChangeLater',
  'What I could not know': 'whatICouldNotKnow',
};

const FRONT_MATTER_BLOCK = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;
const HEADING_LINE = /^##\s+(.+?)\s*$/;

/** Every `## Heading` in `body`, in the order it appears, with its trimmed body text. */
export function parseHeadingSections(body: string): HeadingSection[] {
  const sections: { heading: string; lines: string[] }[] = [];
  let current: { heading: string; lines: string[] } | null = null;
  for (const line of body.split('\n')) {
    const match = line.match(HEADING_LINE);
    if (match) {
      if (current) sections.push(current);
      current = { heading: match[1] ?? '', lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) sections.push(current);
  return sections.map((section) => ({
    heading: section.heading,
    content: section.lines.join('\n').trim(),
  }));
}

/**
 * Validates that `body` carries exactly the expected headings, in order, each with content.
 * `body` may carry the two {@link PLAIN_SECTIONS}, first, before {@link REQUIRED_SECTIONS} — or
 * neither — and the two {@link FUN_SECTIONS} right after them, or neither. Either pair with only
 * one of its two is refused by name, never silently tolerated, and so is the fun pair in a body
 * with no plain sections to sit after.
 *
 * Returns `{ errors, sections }` — `sections` is a `{ heading: content }` map, populated even when
 * there are errors, so a caller can still report partial state if it wants to.
 */
function validateSections(body: string): { errors: string[]; sections: Record<string, string> } {
  const found = parseHeadingSections(body);
  const foundHeadings = found.map((section) => section.heading);
  const errors: string[] = [];

  const presentPlain = PLAIN_SECTIONS.filter((heading) => foundHeadings.includes(heading));
  if (presentPlain.length === 1) {
    const [present] = presentPlain;
    const other = PLAIN_SECTIONS.find((heading) => heading !== present);
    errors.push(
      `carries "## ${present}" without "## ${other}" — the two plain-words sections come together, or neither does`,
    );
  }

  const presentFun = FUN_SECTIONS.filter((heading) => foundHeadings.includes(heading));
  if (presentFun.length === 1) {
    const [present] = presentFun;
    const other = FUN_SECTIONS.find((heading) => heading !== present);
    errors.push(
      `carries "## ${present}" without "## ${other}" — the intro and the punchline come together, or neither does`,
    );
  }
  if (presentFun.length === 2 && presentPlain.length === 0) {
    errors.push(
      `carries "## ${FUN_SECTIONS[0]}" and "## ${FUN_SECTIONS[1]}" with no plain-words sections — the intro and the punchline sit right after the two plain-words sections`,
    );
  }

  const presentOptionsHeadings = [OPTIONS_HEADING, PERSON_STEPS_HEADING].filter((heading) =>
    foundHeadings.includes(heading),
  );
  if (presentOptionsHeadings.length > 1) {
    errors.push(
      `carries both "## ${OPTIONS_HEADING}" and "## ${PERSON_STEPS_HEADING}" — an item carries at most one, never both`,
    );
  }
  const chosenOptionsHeading =
    presentOptionsHeadings.length === 1 ? presentOptionsHeadings[0] : null;

  const expectedSections = [
    ...(presentPlain.length === 2 ? PLAIN_SECTIONS : []),
    ...(presentFun.length === 2 ? FUN_SECTIONS : []),
    ...(chosenOptionsHeading ? [chosenOptionsHeading] : []),
    ...REQUIRED_SECTIONS,
  ];
  const knownHeadings = [
    ...PLAIN_SECTIONS,
    ...FUN_SECTIONS,
    OPTIONS_HEADING,
    PERSON_STEPS_HEADING,
    ...REQUIRED_SECTIONS,
  ];

  const missing = expectedSections.filter((heading) => !foundHeadings.includes(heading));
  if (missing.length > 0) {
    errors.push(`missing section(s): ${missing.map((heading) => `"## ${heading}"`).join(', ')}`);
  }

  const unexpected = foundHeadings.filter((heading) => !knownHeadings.includes(heading));
  if (unexpected.length > 0) {
    errors.push(
      `unexpected heading(s): ${unexpected.map((heading) => `"## ${heading}"`).join(', ')}`,
    );
  }

  if (
    missing.length === 0 &&
    unexpected.length === 0 &&
    presentPlain.length !== 1 &&
    presentFun.length !== 1
  ) {
    const seen = foundHeadings;
    const inOrder = seen.every((heading, index) => heading === expectedSections[index]);
    if (!inOrder) {
      errors.push(
        `sections are out of order: found [${seen.join(', ')}], expected [${expectedSections.join(', ')}]`,
      );
    }
  }

  for (const section of found) {
    if (expectedSections.includes(section.heading) && section.content.length === 0) {
      errors.push(`section "## ${section.heading}" has no content`);
    }
  }

  const sections: Record<string, string> = Object.fromEntries(
    found.map((section) => [section.heading, section.content]),
  );
  return { errors, sections };
}

/**
 * Parses one outbox item's full markdown text into a typed item, or a list of human-readable
 * errors. Pure — no filesystem access, so a fixture string is enough to exercise every case.
 *
 * @param {string} text raw file content
 * @param {{ file?: string | null }} [options] `file` is only used to prefix error messages
 * @returns {{ ok: true, item: object } | { ok: false, errors: string[] }}
 */
export function parseOutboxItem(text: string, { file = null }: { file?: string | null } = {}): ParsedOutboxItem {
  const read = readFrontMatterBlock(text, file, OutboxItemFrontMatterSchema);
  if (read.body === null) return { ok: false, errors: read.errors };
  const errors = [...read.errors];

  const { errors: sectionErrors, sections } = validateSections(read.body);
  errors.push(...sectionErrors.map((message) => withFile(file, message)));

  let parsedOptions: OutboxOption[] | undefined;
  if (OPTIONS_HEADING in sections) {
    const { options, errors: optionErrors } = parseOutboxOptions(sections[OPTIONS_HEADING] ?? '');
    parsedOptions = options;
    errors.push(...optionErrors.map((message) => withFile(file, message)));
  }

  // A front matter the schema refused always left at least one error above.
  if (errors.length > 0 || read.data === null) return { ok: false, errors };

  const fm = read.data;
  const itemSections: OutboxSections = {};
  for (const [heading, field] of Object.entries(SECTION_FIELD)) {
    const content = sections[heading];
    if (content !== undefined) itemSections[field] = content;
  }
  if (parsedOptions !== undefined) itemSections.options = parsedOptions;
  const item: OutboxItem = {
    id: fm.id,
    prd: fm.prd,
    slice: fm.slice,
    rank: fm.rank,
    bearsOn: fm['bears-on'],
    raised: fm.raised,
    wave: fm.wave,
    sections: itemSections,
    file,
  };
  return { ok: true, item };
}

/**
 * Splits `text`'s `---` fenced front matter from the body after it, and checks the front matter
 * against `schema` — the first half {@link parseOutboxItem} and `parseAccount` (`account.ts`)
 * share. `body` is `null` when `text` carries no front-matter block at all; `data` is `null` when
 * the schema refused it. Every error names its field and is prefixed with `file`. Pure.
 */
export function readFrontMatterBlock<T>(
  text: string,
  file: string | null,
  schema: z.ZodType<T>,
): { body: string | null; errors: string[]; data: T | null } {
  const blockMatch = text.match(FRONT_MATTER_BLOCK);
  if (!blockMatch) {
    return { body: null, errors: [withFile(file, 'missing a front-matter block (a "---" fenced header)')], data: null };
  }
  const [, rawFrontMatter = '', body = ''] = blockMatch;
  const lines = parseFrontMatterLines(rawFrontMatter);
  const checked = schema.safeParse(lines.data, { error: KIT_MESSAGES });
  const refusals = checked.success
    ? []
    : checked.error.issues.map(
        (issue) => `${issue.path.length > 0 ? issue.path.join('.') : '(front matter)'}: ${issue.message}`,
      );
  return {
    body,
    errors: [...lines.errors, ...refusals].map((message) => withFile(file, message)),
    data: checked.success ? checked.data : null,
  };
}

/** One `A. <sentence>` line of an options section. */
const OPTION_LINE = /^([A-Za-z])\.\s+(\S.*)$/;

/**
 * Parses `## The options, in plain words`' content into `{ letter, text }[]` — one entry per
 * non-blank line. A line that isn't `<letter>. <sentence>` is a parse error rather than a silently
 * dropped line, named with its own text. Pure: text in, options and errors out.
 *
 * Whether the count sits in the two-to-four range, and whether the letters run `A`, `B`, `C`… in
 * order, are the outbox guard's business rule, not this parser's — exactly the split
 * `plainWordsProblems` already draws between "is this well-formed" and "does the guard accept it".
 *
 * @param {string} content
 * @returns {{ options: { letter: string, text: string }[], errors: string[] }}
 */
export function parseOutboxOptions(content: string | null | undefined): { options: OutboxOption[]; errors: string[] } {
  const lines = (content ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const options: OutboxOption[] = [];
  const errors: string[] = [];
  for (const line of lines) {
    const match = line.match(OPTION_LINE);
    if (!match) {
      errors.push(`option line is not "<letter>. <sentence>": "${line}"`);
      continue;
    }
    options.push({ letter: (match[1] ?? '').toUpperCase(), text: (match[2] ?? '').trim() });
  }
  return { options, errors };
}

/**
 * Whether `options`' letters run `A`, `B`, `C`, `D` in order with no gap and no repeat — the shape
 * the outbox guard requires of a high or medium item. An empty list is vacuously in
 * order; the guard's own two-to-four count check catches that case separately.
 *
 * @param {{ letter: string }[]} options
 */
export function optionLettersInOrder(options: readonly { letter: string }[] | null | undefined): boolean {
  return (options ?? []).every((option, index) => option.letter === OPTION_LETTERS[index]);
}

/** Common English idioms that carry a slash but name no file — never flagged as a path. */
const SLASH_IDIOMS = new Set([
  'and/or',
  'he/she',
  'his/her',
  'him/her',
  'she/he',
  'her/his',
  'yes/no',
  'on/off',
  'either/or',
  'i/o',
  'w/o',
]);

/** A common extension, so a bare filename (no slash) still reads as naming a file. */
const FILE_EXTENSION =
  '(?:mjs|cjs|mts|cts|js|jsx|ts|tsx|json|ya?ml|md|mdx|py|rb|go|java|sh|html?|css)';

/** A dotted filename, with or without a leading path, OR any slash-separated token. */
const FILE_PATH_PATTERN = new RegExp(
  String.raw`\b[\w.-]*\.${FILE_EXTENSION}\b|\b[\w.-]+(?:/[\w.-]+)+\b`,
  'gi',
);

/** An `N…` invariant, a `BR-…` business rule, or an `ADR-NNNN` id — the two registers plus ADRs. */
const REGISTER_OR_ADR_ID = /\bN\d+\b|\bBR-[A-Z0-9]+-\d+\b|\bADR-\d{4}\b/g;

/** `companyName`, `isValid` — lowercase start, an uppercase letter later, letters/digits only. */
const CAMEL_CASE_WORD = /\b[a-z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]*\b/g;

/** `LOOKUP_LIMIT_MAX` — all caps with at least one underscore. */
const SCREAMING_CASE_WORD = /\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g;

/** Every backtick-fenced code span in `text`. */
const BACKTICK_SPAN = /`[^`\n]+`/g;

/**
 * How many sentences `text` reads as — a naive split on `.`, `!` or `?`, each counted once. Good
 * enough to catch "explain it in two sentences, not five"; it does not understand abbreviations,
 * and the guard is not trying to (see {@link plainWordsProblems}'s own doc).
 */
function countSentences(text: string | null | undefined): number {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return 0;
  const matches = trimmed.match(/[^.!?]+(?:[.!?]+|$)/g) ?? [];
  return matches.filter((sentence) => sentence.trim().length > 0).length;
}

function uniqueMatches(text: string, pattern: RegExp): string[] {
  return [...new Set(text.match(pattern) ?? [])];
}

/**
 * **The plain-words rules, as one pure function of a string** (PRD #1071, slice s1). Refuses five
 * things, each with its own message naming exactly what was found — never a generic "not plain
 * enough". The outbox guard calls this on both plain sections of every open item; nothing else
 * reimplements it.
 *
 * The five rules:
 *
 * 1. **Backticks** — a code span reads like a variable or a command, never a sentence a business
 *    person would say.
 * 2. **A file path** — a repo path or a bare filename with a recognized extension; a business
 *    person cannot open it.
 * 3. **A register or ADR id** — `N3`, `BR-QUOTE-4`, `ADR-0069`; spell out what it means instead of
 *    citing its id.
 * 4. **A `camelCase` or `SCREAMING_CASE` word** — a variable or a constant name, not a word anyone
 *    would say aloud.
 * 5. **More than two sentences** — a plain explanation is one or two sentences, not a paragraph.
 *
 * **What this cannot do.** It polices form, not clarity — "the mint" or "the façade" passes just as
 * cleanly as jargon-free prose (the plan's own Risks say so). It is a pure string function: no
 * filesystem, no network, and it never guesses at meaning.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function plainWordsProblems(text: string | null | undefined): string[] {
  const value = text ?? '';
  const problems: string[] = [];

  const backticks = uniqueMatches(value, BACKTICK_SPAN);
  if (backticks.length > 0) {
    problems.push(
      `carries a code span (${backticks.join(', ')}) — say it in plain words, with no backticks`,
    );
  }

  const paths = uniqueMatches(value, FILE_PATH_PATTERN).filter(
    (match) => !SLASH_IDIOMS.has(match.toLowerCase()),
  );
  if (paths.length > 0) {
    problems.push(
      `names a file path (${paths.join(', ')}) — a business person cannot open a repo path`,
    );
  }

  const ids = uniqueMatches(value, REGISTER_OR_ADR_ID);
  if (ids.length > 0) {
    problems.push(
      `names an id (${ids.join(', ')}) — spell out what it means instead of citing its register or ADR id`,
    );
  }

  const codeWords = [
    ...uniqueMatches(value, CAMEL_CASE_WORD),
    ...uniqueMatches(value, SCREAMING_CASE_WORD),
  ];
  if (codeWords.length > 0) {
    problems.push(
      `carries a code identifier (${codeWords.join(', ')}) — write the plain word instead of the variable or constant name`,
    );
  }

  const sentenceCount = countSentences(value);
  if (sentenceCount > 2) {
    problems.push(`is ${sentenceCount} sentences long — say it in one or two sentences`);
  }

  return problems;
}

/**
 * **The rules an intro or a punchline is held to, as one pure function of a string** (PRD #50,
 * slice s1): every {@link plainWordsProblems} rule, plus at most {@link FUN_LINE_MAX_LENGTH}
 * characters (counted as code points, so an emoji is one). `omni item new` calls it on the two
 * fields it is given, and the outbox guard on the two sections of every open item that carries
 * them; nothing else reimplements it.
 *
 * **What this cannot do.** Whether a line is about the question, and never about a person or a
 * team, is the writer's job and the review's, not a string function's.
 *
 * @param {string} text
 * @returns {string[]}
 */
export function funLineProblems(text: string | null | undefined): string[] {
  const value = (text ?? '').trim();
  const problems = plainWordsProblems(value);
  const length = Array.from(value).length;
  if (length > FUN_LINE_MAX_LENGTH) {
    problems.push(
      `is ${length} characters long — keep it to ${FUN_LINE_MAX_LENGTH} characters at most`,
    );
  }
  return problems;
}

/**
 * True when `bearsOn` is an id shape the injected `laws` treats as floor-setting — a principle, a
 * business rule, an invariant or a cross-domain entry when `laws.source` is `knowledge`; an ADR
 * named under the CLAUDE.md invariants heading when it is `claudeMdInvariants`; nothing when it is
 * `none`. Delegates entirely to `laws.floorsHigh` (`kit/lib/laws.ts`) so this module carries no
 * opinion of its own about which ids are laws.
 *
 * @param {string} bearsOn
 * @param {{ floorsHigh(bearsOn: string): boolean }} laws
 */
export function bearsOnFloorsHigh(bearsOn: string, laws: Pick<Laws, 'floorsHigh'>): boolean {
  return laws.floorsHigh(bearsOn);
}

/**
 * The rank floor set by what a decision `bears-on`, per the plan's "The rank cannot be talked
 * down": a decision bearing on a law floors at `high`; the agent's proposed rank may only RAISE
 * that floor, never lower it (and never lower any other proposal either — a `human-action`
 * proposal against a floored `bears-on` stays `human-action`).
 *
 * Pure function of its inputs plus the injected `laws` — no filesystem access here itself (`laws`
 * may have read one already, building `floorsHigh`). Bearing on anything `laws.floorsHigh` refuses
 * sets no floor: the proposed rank passes through unchanged.
 *
 * @param {string} bearsOn
 * @param {'human-action' | 'high' | 'medium'} proposed
 * @param {{ floorsHigh(bearsOn: string): boolean }} laws
 * @returns {'human-action' | 'high' | 'medium'}
 */
export function floorRank(bearsOn: string, proposed: Rank, laws: Pick<Laws, 'floorsHigh'>): Rank {
  const floor: Rank = bearsOnFloorsHigh(bearsOn, laws) ? 'high' : proposed;
  return RANK_ORDER[proposed] >= RANK_ORDER[floor] ? proposed : floor;
}

/** True when `rank` sits below the floor `bearsOn` sets — the guard's rank-floor violation. */
export function isBelowFloor(bearsOn: string, rank: Rank, laws: Pick<Laws, 'floorsHigh'>): boolean {
  return floorRank(bearsOn, rank, laws) !== rank;
}

/**
 * Whether `bearsOn` resolves. Delegates entirely to `laws.resolve` (`kit/lib/laws.ts`), which
 * already knows `none`, an `ADR-NNNN` id and a knowledge id — this module has no filesystem opinion
 * of its own about where a `bears-on` id resolves (see the module doc).
 *
 * @param {string} bearsOn
 * @param {{ resolve(bearsOn: string): { ok: boolean, reason?: string } }} laws
 * @returns {{ ok: boolean, reason?: string }}
 */
export function resolveBearsOn(bearsOn: string, laws: Pick<Laws, 'resolve'>): Resolution {
  return laws.resolve(bearsOn);
}

/** The part of the context {@link outboxItemFiles} reads: the root and every outbox directory. */
export type OutboxDirsContext = { root: string; layout: { outboxDirs(): readonly { dir: string }[] } };

/** The part of a layout the outbox reads: one PRD's outbox directory, and every one of them. */
export type OutboxLayout = {
  outboxDir(prd: PrdNumber): string | null;
  outboxDirs(): readonly { dir: string }[];
};

/** The part of the context the outbox modules read: the root, the outbox layout and the markers. */
export type OutboxContext = { root: string; layout: OutboxLayout; markers: ReturnType<typeof makeMarkers> };

/** Every `.md` file under `dir`, skipping `settled.md` and an `accounts/` subfolder entirely. */
function itemFilesUnder(root: string, dir: string): string[] {
  const absolute = join(root, dir);
  if (!existsSync(absolute)) return [];

  const files: string[] = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name === 'accounts') continue;
      files.push(...itemFilesUnder(root, `${dir}/${entry.name}`));
      continue;
    }
    if (!entry.name.endsWith('.md') || entry.name === SETTLED_FILE) continue;
    files.push(`${dir}/${entry.name}`);
  }
  return files.sort();
}

/**
 * Every open item file under every `dir` in `ctx.layout.outboxDirs()`, in that order, each dir's
 * own files sorted by name. Skips `settled.md` (the append-only ledger) and anything under an
 * `accounts/` subfolder, wherever it sits under a `dir`. Empty or absent tree → `[]`.
 *
 * @param {{ ctx: { root: string, layout: { outboxDirs(): { dir: string }[] } } }} options
 * @returns {string[]}
 */
export function outboxItemFiles({ ctx }: { ctx: OutboxDirsContext }): string[] {
  const files: string[] = [];
  for (const { dir } of ctx.layout.outboxDirs()) {
    files.push(...itemFilesUnder(ctx.root, dir));
  }
  return files;
}
