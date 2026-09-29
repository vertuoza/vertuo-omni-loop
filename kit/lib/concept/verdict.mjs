/**
 * **A concept can be proven** (PRD 686, slice s1): what `omni concept <n>` grades on a concept
 * branch, as one function a test can hold open, shaped like `omni visual`'s verdict.
 *
 * A concept's whole record is one folder `<paths.delivery>/inbox/concepts/<nnnn>-<slug>/`
 * (`ctx.layout.dirs.concepts`), `<nnnn>` the concept's issue number zero-padded to four digits. The
 * checks, each failing with one line a person can act on:
 *
 * 1. Exactly one such folder exists for the concept.
 * 2. It holds `concept.md`, `vision.html`, `debate.md` and the boards `board-r<k>.html`, k from 1
 *    with no gap, at least `board-r1.html`; nothing else.
 * 3. `concept.md` parses ({@link parseConcept}) and names this concept.
 * 4. Every page (the vision tour and each board) is at most `limits.beforeAfterMaxBytes` bytes, holds
 *    no raster image inlined as a `data:image/` URL (an SVG one is allowed), and loads nothing from
 *    the network: no script, stylesheet, font, image or frame, no `@import` or CSS `url()`, no module
 *    import or fetch. A link a person may follow is allowed.
 * 5. No file outside that folder changed on the branch.
 * 6. Every commit of the branch carries the trailer `omni sign trailer` prints, unless the config
 *    says `signature: null`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fixVerdict, numberedFolders, rasterFaults } from '../fix-verdict.mjs';
import { beforeAfterViolation } from '../inbox/check-inbox.mjs';
import { padPrd } from '../layout.mjs';
import { parseConcept } from './parse.mjs';

const RECORD = 'concept.md';
const VISION = 'vision.html';
const DEBATE = 'debate.md';
const REQUIRED = [RECORD, VISION, DEBATE];
const HOLDS = `${RECORD}, ${VISION}, ${DEBATE} and board-r<k>.html only`;

/** A round's board: `board-r<k>.html`, k from 1 with no leading zero. */
const ROUND = /^board-r([1-9]\d*)\.html$/;
/** A name that means to be a board, well formed or not. */
const ROUND_LIKE = /^board/i;

/** A URL reached over the network: `http://`, `https://` or protocol-relative `//`. */
const REMOTE = /^\s*(?:https?:)?\/\//i;
/** Tags whose URL a person follows rather than the page loading it. */
const FOLLOWED = new Set(['a', 'area', 'base', 'form']);
/** The attributes through which a tag loads what they name. */
const LOADING = new Set(['src', 'href', 'xlink:href', 'data', 'poster', 'srcset', 'background']);
const TAG = /<([a-z][\w:-]*)\b([^>]*)>/gi;
const ATTRIBUTE = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
const STYLE_BLOCK = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
const SCRIPT_BLOCK = /<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi;
/** Loads written in CSS, each as `[what it is, pattern whose group 1 is the URL]`. */
const CSS_LOADS = [
  ['@import', /@import\s+(?:url\(\s*)?["']?\s*((?:https?:)?\/\/[^"')\s;]+)/gi],
  ['url()', /(?<!@import\s*)\burl\(\s*["']?\s*((?:https?:)?\/\/[^"')\s]+)/gi],
];
/** Loads written in a script, likewise. */
const SCRIPT_LOADS = [
  ['import', /\b(?:import|from)\s*\(?\s*["'`]((?:https?:)?\/\/[^"'`\s]+)/gi],
  ['fetch', /\bfetch\s*\(\s*["'`]((?:https?:)?\/\/[^"'`\s]+)/gi],
];

/** The folder name prefix of a concept: its number, zero-padded to four digits, then `-`. */
export function folderPrefix(concept) {
  return `${padPrd(concept)}-`;
}

/** Each `[what, pattern]` of `patterns` found in `texts`, as `<what> <url>`. */
function textLoads(texts, patterns) {
  return patterns.flatMap(([what, pattern]) => texts.flatMap((text) => [...text.matchAll(pattern)].map((match) => `${what} ${match[1]}`)));
}

/** The URLs an attribute names: each candidate of a `srcset`, else its one value. */
function attributeUrls(attribute, value) {
  return attribute === 'srcset' ? value.split(',').map((candidate) => candidate.trim().split(/\s+/)[0]) : [value];
}

/** One tag's loads from the network, as `<tag attribute> <url>`; a style attribute's text goes to `styles`. */
function tagLoads(name, attributes, styles) {
  const loads = [];
  for (const [, attr, ...values] of attributes.matchAll(ATTRIBUTE)) {
    const attribute = attr.toLowerCase();
    const value = values.find((v) => v !== undefined) ?? '';
    if (attribute === 'style') styles.push(value);
    if (FOLLOWED.has(name) || !LOADING.has(attribute)) continue;
    const remote = attributeUrls(attribute, value).filter((url) => REMOTE.test(url));
    loads.push(...remote.map((url) => `<${name} ${attribute}> ${url.trim()}`));
  }
  return loads;
}

/**
 * What a page loads from the network: a tag's loading attribute naming a remote URL (`<script src>
 * https://…`), then an `@import` or a `url()` in its CSS (a style block or a style attribute), then a
 * module import or a fetch in its scripts. A link a person follows (`<a href>`) is none.
 */
export function networkLoads(html) {
  const styles = [...html.matchAll(STYLE_BLOCK)].map((match) => match[1]);
  const loads = [...html.matchAll(TAG)].flatMap(([, tag, attributes]) => tagLoads(tag.toLowerCase(), attributes, styles));
  const scripts = [...html.matchAll(SCRIPT_BLOCK)].map((match) => match[1]);
  return [...loads, ...textLoads(styles, CSS_LOADS), ...textLoads(scripts, SCRIPT_LOADS)];
}

function pageFaults(ctx, page) {
  const faults = [];
  const size = beforeAfterViolation(page, ctx);
  if (size) faults.push(size);
  const html = readFileSync(join(ctx.root, page), 'utf8');
  faults.push(...rasterFaults(page, html));
  const loads = networkLoads(html);
  if (loads.length) {
    faults.push(`${page}: loads from the network: ${loads.join(', ')}; inline it, and keep only links a person follows.`);
  }
  return faults;
}

function recordFaults(ctx, folder, concept) {
  const file = `${folder}/${RECORD}`;
  const parsed = parseConcept(readFileSync(join(ctx.root, file), 'utf8'));
  if (!parsed.ok) return parsed.errors.map((error) => `${file}: ${error}`);
  return parsed.record.concept === concept ? [] : [`${file}: concept is ${parsed.record.concept}, not ${concept}.`];
}

const byName = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** The kind of one folder entry: a round, a required file, a misnamed round, or a stray. */
function entryKind(entry) {
  const round = entry.isFile() ? ROUND.exec(entry.name) : null;
  if (round) return { kind: 'round', k: Number(round[1]) };
  if (!entry.isFile()) return { kind: 'other' };
  if (REQUIRED.includes(entry.name)) return { kind: 'present' };
  return { kind: ROUND_LIKE.test(entry.name) ? 'misnamed' : 'other' };
}

/** The folder's entries, sorted into required files present, rounds (by k), misnamed rounds and strays. */
function folderEntries(ctx, folder) {
  const sorted = { present: new Set(), rounds: [], misnamed: [], others: [] };
  for (const entry of readdirSync(join(ctx.root, folder), { withFileTypes: true })) {
    const { kind, k } = entryKind(entry);
    if (kind === 'round') sorted.rounds.push({ name: entry.name, k });
    else if (kind === 'present') sorted.present.add(entry.name);
    else if (kind === 'misnamed') sorted.misnamed.push(entry.name);
    else sorted.others.push(entry.name);
  }
  sorted.rounds.sort((a, b) => a.k - b.k);
  return sorted;
}

/** The boards missing from rounds numbered 1 to the last, with no gap. */
function roundFaults(folder, rounds) {
  const last = rounds.at(-1)?.k ?? 0;
  if (last === 0) return [`${folder}/board-r1.html: missing.`];
  const shown = new Set(rounds.map((round) => round.k));
  return Array.from({ length: last - 1 }, (_, index) => index + 1)
    .filter((k) => !shown.has(k))
    .map((k) => `${folder}/board-r${k}.html: missing; the rounds are numbered from 1 with no gap.`);
}

/** The folder's files, rounds, misnamed rounds and strays, then its record and its pages. */
function folderFaults(ctx, folder, concept) {
  const { present, rounds, misnamed, others } = folderEntries(ctx, folder);
  const pages = [...(present.has(VISION) ? [VISION] : []), ...rounds.map((round) => round.name)];
  return [
    ...REQUIRED.filter((name) => !present.has(name)).map((name) => `${folder}/${name}: missing.`),
    ...roundFaults(folder, rounds),
    ...(present.has(RECORD) ? recordFaults(ctx, folder, concept) : []),
    ...pages.flatMap((page) => pageFaults(ctx, `${folder}/${page}`)),
    ...misnamed.sort(byName).map((name) => `${folder}/${name}: a round's board is named board-r<k>.html, k from 1.`),
    ...others.sort(byName).map((name) => `${folder}/${name}: not part of a concept; the folder holds ${HOLDS}.`),
  ];
}

/** Every changed path outside `folder`, one line each. */
function outsideFaults(folder, changed = []) {
  return [...new Set(changed)]
    .filter((path) => !path.startsWith(`${folder}/`))
    .sort()
    .map((path) => `${path}: changed outside ${folder}/; a concept branch changes its own folder only.`);
}

/**
 * Grades one concept on the working tree, the paths its branch changed, and its commits when given.
 *
 * @param {{ ctx: object, concept: number, changed?: string[], commits?: { sha: string, message: string }[] }} options
 * @returns {{ ok: boolean, folder: string | null, failures: string[] }}
 */
export function conceptVerdict({ ctx, concept, changed, commits }) {
  return fixVerdict({
    ctx,
    issue: concept,
    commits,
    root: ctx.layout.dirs.concepts,
    prefix: folderPrefix(concept),
    folders: numberedFolders(ctx, ctx.layout.dirs.concepts, folderPrefix(concept)),
    grade: (folder) => [...folderFaults(ctx, folder, concept), ...outsideFaults(folder, changed)],
  });
}
