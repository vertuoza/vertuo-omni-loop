// PRD 1407, s4: the word pass — the visible words of each screen of a mockup, and four rules over
// them. A screen is an element the screen selector matches (`design.words.screen`, by default
// `[data-screen]`); a page with none is skipped and says so (PRD 1550: read whole, a page's own
// captions were all it found). A primary action is one the primary selector matches
// (`design.words.primary`, by default `[data-primary]`), and is a control whatever its tag. Every
// element ends a string, so two sibling elements are two strings, while the text runs of one element
// stay one. PRD 1584: a phrasing element (`code`, `em`, `span`…) inside running text — a parent that
// holds words of its own beside it — does not end the string, so a sentence stays whole; a layout of
// sibling spans with no running text still reads as separate strings. Inside a control, two sibling
// elements are joined with a space. Text inside an element the content selector matches
// (`design.words.content`, by default `[data-content]`) is what the screen shows, not what it wrote:
// it is counted apart and judged by no rule. It reads structure, never style, and only reports: what
// it finds is fixed in the screen, never silenced.
//
//   sentence-on-control  a control whose label holds `sentence` words or more
//   two-primaries        more than one primary action in one screen
//   explains-at-rest     a string outside any control longer than `sentence` words
//   avoided-word         a word or phrase the product avoids, matched whole and in any case
import { type Element, type Node, parseHtml } from './html.ts';
import { namingAttributes, matches, type Selector } from './selector.ts';

/** What the pass is given: the threshold, the three selectors, and the words the product avoids. */
export type WordRules = {
  readonly sentence: number;
  readonly screen: Selector;
  readonly primary: Selector;
  readonly content: Selector;
  readonly avoid: readonly string[];
  /** PRD 1795 s6: for an avoided word the product's glossary lists (lower case), the term the product says instead. */
  readonly says?: ReadonlyMap<string, string>;
};

/** One visible string of a screen: a control's whole label, or a run of text outside any control. */
export type Phrase = { readonly text: string; readonly words: number; readonly control: boolean };

export type Finding = { readonly rule: 'sentence-on-control' | 'two-primaries' | 'explains-at-rest' | 'avoided-word'; readonly message: string; /** How the line names the rule, when not by its id. */ readonly label?: string };

/** One screen read: its own strings and their words, the words of the content it shows, and its findings. */
export type ScreenWords = {
  readonly name: string;
  readonly phrases: readonly Phrase[];
  readonly words: number;
  readonly content: number;
  readonly findings: readonly Finding[];
};

/** A page read: its screens, and whether none was marked so the page was skipped. */
export type PageWords = { readonly skipped: boolean; readonly screens: readonly ScreenWords[] };

const BLOCK = new Set([
  'address', 'article', 'aside', 'blockquote', 'body', 'br', 'caption', 'dd', 'details', 'dialog', 'div', 'dl', 'dt', 'fieldset',
  'figcaption', 'figure', 'footer', 'form', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'menu', 'nav', 'ol',
  'option', 'p', 'pre', 'section', 'select', 'summary', 'table', 'tbody', 'td', 'textarea', 'tfoot', 'th', 'thead', 'tr', 'ul',
]);
/** The phrasing elements that run on inside running text rather than end its string (PRD 1584). */
const PHRASING = new Set(['a', 'abbr', 'b', 'cite', 'code', 'em', 'i', 'kbd', 'mark', 'q', 's', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var']);
const CONTROL_ROLES = new Set(['button', 'link', 'menuitem', 'tab', 'option', 'switch', 'checkbox', 'radio']);
const INPUT_CONTROLS = new Set(['submit', 'button', 'reset']);
const WORD = /[\p{L}\p{N}]/u;

/** The words of a string: its whitespace-separated tokens that hold a letter or a digit. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((token) => WORD.test(token)).length;
}

/** Whether an element is a control: by its tag or role, or because the primary selector marks it. */
const isControl = ({ tag, attributes }: Element, primary: Selector): boolean =>
  matches(primary, { tag, attributes }) || tag === 'button' || (tag === 'a' && attributes.has('href')) || CONTROL_ROLES.has(attributes.get('role') ?? '') ||
  (tag === 'input' && INPUT_CONTROLS.has((attributes.get('type') ?? '').toLowerCase()));

/** Whether an element is out of sight by its own markup: `hidden`, `aria-hidden="true"`, or the page's head. */
const isHidden = ({ tag, attributes }: Element): boolean => tag === 'head' || attributes.has('hidden') || attributes.get('aria-hidden') === 'true';

const wordsOf = (count: number): string => `${count} ${count === 1 ? 'word' : 'words'}`;

const squash = (text: string): string => text.replace(/\s+/g, ' ').trim();

/**
 * All the visible text under a node, in one string. `spaced` (inside a control, PRD 1584) puts a space
 * between two sibling elements, so a label's parts never run together.
 */
function textOf(node: Node, spaced: boolean): string {
  if (node.kind === 'text') return node.text;
  if (isHidden(node)) return '';
  const own = node.tag === 'input' ? ` ${node.attributes.get('value') ?? ''} ` : '';
  const block = BLOCK.has(node.tag);
  return node.children.reduce((text, child, index) => {
    const before = node.children[index - 1];
    const apart = block || (spaced && before?.kind === 'element' && child.kind === 'element');
    return text + (index > 0 && apart ? ' ' : '') + textOf(child, spaced);
  }, own);
}

/** A phrase of `text`, squashed, or nothing when it holds no word. */
function phraseOf(text: string, control: boolean): Phrase[] {
  const squashed = squash(text);
  const words = countWords(squashed);
  return words > 0 ? [{ text: squashed, words, control }] : [];
}

/** The walk over one screen: the phrases so far, the primary actions, and the text run still open. */
type Walk = { readonly rules: WordRules; readonly phrases: Phrase[]; readonly primaries: string[]; run: string; content: number };

function flush(walk: Walk): void {
  walk.phrases.push(...phraseOf(walk.run, false));
  walk.run = '';
}

/** Whether the walk leaves an element out: hidden by its markup, or a nested screen (read on its own). */
const skipped = (element: Element, walk: Walk, top: boolean): boolean => isHidden(element) || (!top && matches(walk.rules.screen, element));

/** Whether an element holds running text: a text of its own, beside its children, with a word in it. */
const hasRunningText = (element: Element): boolean => element.children.some((child) => child.kind === 'text' && WORD.test(child.text));

/** Whether a child runs on inside its parent's running text rather than end the string. */
const runsOn = (child: Node, running: boolean): boolean => running && child.kind === 'element' && PHRASING.has(child.tag);

/** Text the content selector marks: counted apart, never a phrase. It ends the open string unless inline. */
function readContent(element: Element, walk: Walk, inline: boolean): void {
  if (!inline) flush(walk);
  walk.content += countWords(textOf(element, true));
}

/** A control: its whole label is one phrase, its parts spaced, ending the open string. */
function readControl(element: Element, walk: Walk): void {
  flush(walk);
  walk.phrases.push(...phraseOf(textOf(element, true), true));
}

/** An element's children: run on into the open string when inline, else a string of their own. */
function visitChildren(element: Element, walk: Walk, inline: boolean): void {
  if (!inline) flush(walk);
  const running = inline || hasRunningText(element);
  for (const child of element.children) visit(child, walk, runsOn(child, running));
  if (!inline) flush(walk);
}

/**
 * One element of a screen. `inline` is a phrasing element inside running text: it adds to the string
 * its parent holds open instead of ending it. A control and a block always end it.
 */
function visitElement(element: Element, walk: Walk, top: boolean, inline: boolean): void {
  if (skipped(element, walk, top)) return;
  if (!top && matches(walk.rules.content, element)) {
    readContent(element, walk, inline);
    return;
  }
  if (matches(walk.rules.primary, element)) walk.primaries.push(squash(textOf(element, true)));
  if (isControl(element, walk.rules.primary)) {
    readControl(element, walk);
    return;
  }
  visitChildren(element, walk, inline);
}

function visit(node: Node, walk: Walk, inline: boolean): void {
  if (node.kind === 'text') walk.run += node.text;
  else visitElement(node, walk, false, inline);
}

/** A screen's phrases and its primary actions, stopping at a nested screen (it is read on its own). */
function readScreen(screen: Element, rules: WordRules): { phrases: Phrase[]; primaries: string[]; content: number } {
  const walk: Walk = { rules, phrases: [], primaries: [], run: '', content: 0 };
  visitElement(screen, walk, true, false);
  flush(walk);
  return { phrases: walk.phrases, primaries: walk.primaries, content: walk.content };
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

function avoidedWord(phrases: readonly Phrase[], { avoid, says }: WordRules): Finding[] {
  const terms = avoid.map((term) => ({ term, pattern: wholeTerm(term), say: says?.get(squash(term).toLowerCase()) }));
  return phrases.flatMap((phrase) =>
    terms.filter(({ pattern }) => pattern.test(phrase.text)).map(({ term, say }): Finding => ({
      rule: 'avoided-word',
      ...(say === undefined ? { message: `"${term}" in "${phrase.text}"` } : { label: 'avoided word', message: `${term} → say ${say} (in "${phrase.text}")` }),
    })));
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
  const marked = screensUnder(parseHtml(html), rules);
  const screens = marked.map((screen, index) => {
    const { phrases, primaries, content } = readScreen(screen, rules);
    return {
      name: screenName(screen, rules, index),
      phrases,
      words: phrases.reduce((sum, phrase) => sum + phrase.words, 0),
      content,
      findings: findings(phrases, primaries, rules),
    };
  });
  return { skipped: marked.length === 0, screens };
}

/** The lines `omni design words` prints for one page, under its name. */
export function formatPage(page: string, { skipped, screens }: PageWords, rules: Pick<WordRules, 'screen'>): string[] {
  const lines = [page];
  if (skipped) lines.push(`  no screen marked: skipped (${rules.screen.source})`);
  for (const screen of screens) {
    lines.push(`  screen ${screen.name} · ${wordsOf(screen.words)}`);
    for (const phrase of screen.phrases) lines.push(`    ${phrase.control ? '[control] ' : ''}${phrase.text} (${phrase.words})`);
    if (screen.content > 0) lines.push(`    content · ${wordsOf(screen.content)}`);
    if (screen.findings.length === 0) lines.push('    findings: none');
    for (const finding of screen.findings) lines.push(`    ! ${finding.label ?? finding.rule}: ${finding.message}`);
  }
  return lines;
}
