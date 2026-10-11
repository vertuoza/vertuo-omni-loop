// PRD 1407, s4: the word pass — the visible words of each screen of a mockup, and four rules over
// them. A screen is an element the screen selector matches (`design.words.screen`, by default
// `[data-screen]`); a page with none is read whole and says so. A primary action is one the primary
// selector matches (`design.words.primary`, by default `[data-primary]`). It reads structure, never
// style, and only reports: what it finds is fixed in the screen, never silenced.
//
//   sentence-on-control  a control whose label holds `sentence` words or more
//   two-primaries        more than one primary action in one screen
//   explains-at-rest     a string outside any control longer than `sentence` words
//   avoided-word         a word or phrase the product avoids, matched whole and in any case
import { type Element, type Node, parseHtml } from './html.ts';
import { namingAttributes, matches, type Selector } from './selector.ts';

/** What the pass is given: the threshold, the two selectors, and the words the product avoids. */
export type WordRules = { readonly sentence: number; readonly screen: Selector; readonly primary: Selector; readonly avoid: readonly string[] };

/** One visible string of a screen: a control's whole label, or a run of text outside any control. */
export type Phrase = { readonly text: string; readonly words: number; readonly control: boolean };

export type Finding = { readonly rule: 'sentence-on-control' | 'two-primaries' | 'explains-at-rest' | 'avoided-word'; readonly message: string };

export type ScreenWords = { readonly name: string; readonly phrases: readonly Phrase[]; readonly words: number; readonly findings: readonly Finding[] };

/** A page read: its screens, and whether none was marked so the page was read whole. */
export type PageWords = { readonly whole: boolean; readonly screens: readonly ScreenWords[] };

const BLOCK = new Set([
  'address', 'article', 'aside', 'blockquote', 'body', 'br', 'caption', 'dd', 'details', 'dialog', 'div', 'dl', 'dt', 'fieldset',
  'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'menu', 'nav', 'ol',
  'option', 'p', 'pre', 'section', 'select', 'summary', 'table', 'tbody', 'td', 'textarea', 'tfoot', 'th', 'thead', 'tr', 'ul',
]);
const CONTROL_ROLES = new Set(['button', 'link', 'menuitem', 'tab', 'option', 'switch', 'checkbox', 'radio']);
const INPUT_CONTROLS = new Set(['submit', 'button', 'reset']);
const WORD = /[\p{L}\p{N}]/u;

/** The words of a string: its whitespace-separated tokens that hold a letter or a digit. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((token) => WORD.test(token)).length;
}

const isControl = ({ tag, attributes }: Element): boolean =>
  tag === 'button' || (tag === 'a' && attributes.has('href')) || CONTROL_ROLES.has(attributes.get('role') ?? '') ||
  (tag === 'input' && INPUT_CONTROLS.has((attributes.get('type') ?? '').toLowerCase()));

/** Whether an element is out of sight by its own markup: `hidden`, `aria-hidden="true"`, or the page's head. */
const isHidden = ({ tag, attributes }: Element): boolean => tag === 'head' || attributes.has('hidden') || attributes.get('aria-hidden') === 'true';

const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();

/** All the visible text under a node, in one string. */
function textOf(node: Node): string {
  if (node.kind === 'text') return node.text;
  if (isHidden(node)) return '';
  const own = node.tag === 'input' ? ` ${node.attributes.get('value') ?? ''} ` : '';
  return own + node.children.map(textOf).join(BLOCK.has(node.tag) ? ' ' : '');
}

/** A phrase of `text`, squashed, or nothing when it holds no word. */
function phraseOf(text: string, control: boolean): Phrase[] {
  const squashed = squash(text);
  const words = countWords(squashed);
  return words > 0 ? [{ text: squashed, words, control }] : [];
}

/** The walk over one screen: the phrases so far, the primary actions, and the text run still open. */
type Walk = { readonly rules: WordRules; readonly phrases: Phrase[]; readonly primaries: string[]; run: string };

function flush(walk: Walk): void {
  walk.phrases.push(...phraseOf(walk.run, false));
  walk.run = '';
}

/** Whether the walk leaves an element out: hidden by its markup, or a nested screen (read on its own). */
const skipped = (element: Element, walk: Walk, top: boolean): boolean => isHidden(element) || (!top && matches(walk.rules.screen, element));

function visitElement(element: Element, walk: Walk, top: boolean): void {
  if (skipped(element, walk, top)) return;
  if (matches(walk.rules.primary, element)) walk.primaries.push(squash(textOf(element)));
  if (isControl(element)) {
    flush(walk);
    walk.phrases.push(...phraseOf(textOf(element), true));
    return;
  }
  const block = BLOCK.has(element.tag);
  if (block) flush(walk);
  for (const child of element.children) visit(child, walk);
  if (block) flush(walk);
}

function visit(node: Node, walk: Walk): void {
  if (node.kind === 'text') walk.run += node.text;
  else visitElement(node, walk, false);
}

/** A screen's phrases and its primary actions, stopping at a nested screen (it is read on its own). */
function readScreen(screen: Element, rules: WordRules): { phrases: Phrase[]; primaries: string[] } {
  const walk: Walk = { rules, phrases: [], primaries: [], run: '' };
  visitElement(screen, walk, true);
  flush(walk);
  return { phrases: walk.phrases, primaries: walk.primaries };
}

/** The name a screen goes by: the first attribute its selector asks for by name that it holds, else its id or label. */
function screenName(screen: Element, rules: WordRules, index: number): string {
  const named = [...namingAttributes(rules.screen), 'id', 'aria-label'].map((name) => screen.attributes.get(name)?.trim()).find(Boolean);
  return named ?? `#${index + 1}`;
}

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A pattern matching `term` whole, its spaces any run of whitespace, in any case. */
const wholeTerm = (term: string): RegExp => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(squash(term)).replace(/ /g, '\\s+')}(?![\\p{L}\\p{N}])`, 'iu');

const sentenceOnControl = (phrases: readonly Phrase[], { sentence }: WordRules): Finding[] =>
  phrases
    .filter((phrase) => phrase.control && phrase.words >= sentence)
    .map((phrase) => ({ rule: 'sentence-on-control', message: `"${phrase.text}" — ${phrase.words} words on a control (${sentence} or more)` }));

const twoPrimaries = (primaries: readonly string[]): Finding[] =>
  primaries.length > 1 ? [{ rule: 'two-primaries', message: `${primaries.length} primary actions — ${primaries.map((label) => `"${label}"`).join(', ')}` }] : [];

const explainsAtRest = (phrases: readonly Phrase[], { sentence }: WordRules): Finding[] =>
  phrases
    .filter((phrase) => !phrase.control && phrase.words > sentence)
    .map((phrase) => ({ rule: 'explains-at-rest', message: `"${phrase.text}" — ${phrase.words} words at rest (more than ${sentence})` }));

function avoidedWord(phrases: readonly Phrase[], { avoid }: WordRules): Finding[] {
  const terms = avoid.map((term) => ({ term, pattern: wholeTerm(term) }));
  return phrases.flatMap((phrase) =>
    terms.filter(({ pattern }) => pattern.test(phrase.text)).map(({ term }): Finding => ({ rule: 'avoided-word', message: `"${term}" in "${phrase.text}"` })));
}

/** The four rules over one screen's phrases and primary actions, in the rules' order. */
function findings(phrases: readonly Phrase[], primaries: readonly string[], rules: WordRules): Finding[] {
  return [...sentenceOnControl(phrases, rules), ...twoPrimaries(primaries), ...explainsAtRest(phrases, rules), ...avoidedWord(phrases, rules)];
}

/** Every element under `node` the screen selector matches, outermost first, in page order. */
function screensUnder(node: Element, rules: WordRules): Element[] {
  const found: Element[] = [];
  const walk = (element: Element) => {
    if (isHidden(element)) return;
    if (matches(rules.screen, element)) found.push(element);
    for (const child of element.children) if (child.kind === 'element') walk(child);
  };
  walk(node);
  return found;
}

/** The word pass over one page's HTML. */
export function wordPass(html: string, rules: WordRules): PageWords {
  const root = parseHtml(html);
  const marked = screensUnder(root, rules);
  const whole = marked.length === 0;
  const screens = (whole ? [root] : marked).map((screen, index) => {
    const { phrases, primaries } = readScreen(screen, rules);
    return {
      name: whole ? '(whole page)' : screenName(screen, rules, index),
      phrases,
      words: phrases.reduce((sum, phrase) => sum + phrase.words, 0),
      findings: findings(phrases, primaries, rules),
    };
  });
  return { whole, screens };
}

/** The lines `omni design words` prints for one page, under its name. */
export function formatPage(page: string, { whole, screens }: PageWords, rules: Pick<WordRules, 'screen'>): string[] {
  const lines = [page];
  if (whole) lines.push(`  no screen marked (${rules.screen.source}): the page read whole`);
  for (const screen of screens) {
    lines.push(`  screen ${screen.name} · ${screen.words} ${screen.words === 1 ? 'word' : 'words'}`);
    for (const phrase of screen.phrases) lines.push(`    ${phrase.control ? '[control] ' : ''}${phrase.text} (${phrase.words})`);
    if (screen.findings.length === 0) lines.push('    findings: none');
    for (const finding of screen.findings) lines.push(`    ! ${finding.rule}: ${finding.message}`);
  }
  return lines;
}
