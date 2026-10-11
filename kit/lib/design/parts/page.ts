// PRD 1559, s2: the parts check over one mockup page — `omni design parts --check <page.html>`. It
// reads the marked screens only, as the word pass does (an element `design.words.screen` matches, by
// default `[data-screen]`); a page with none is skipped and says so. Inside a screen, each
// `data-part="<name>"` tag is a part the screen is built from: a name DESIGN.md does not list is
// `off-list`. Each control (a button, an input but a hidden one, a select, a textarea, an element
// whose role is a control's, a link classed `btn` or `button`, and any element the primary selector
// marks) that carries no tag, itself or on an element around it inside the screen, is `untagged`.
// What an element `design.words.content` matches holds (by default `[data-content]`) is content the
// screen shows: never a part, never untagged. A nested screen is read on its own. It reads
// structure, never style, and only reports.
import { type Element, parseHtml } from '../words/html.ts';
import { matches, namingAttributes, type Selector } from '../words/selector.ts';
import { isListed } from './names.ts';

/** The attribute a mockup tags a part with. */
const PART_ATTRIBUTE = 'data-part';

/** What the check is given: the selectors it shares with the word pass, and the listed parts' names. */
export type PartRules = {
  readonly screen: Selector;
  readonly primary: Selector;
  readonly content: Selector;
  readonly parts: readonly string[];
};

/** One screen read: how many tags it holds, the tags not on the list, and each untagged control. */
type ScreenParts = { readonly name: string; readonly tagged: number; readonly offList: readonly string[]; readonly untagged: readonly string[] };

/** A page read: its screens, and whether none was marked so the page was skipped. */
export type PageParts = { readonly skipped: boolean; readonly screens: readonly ScreenParts[] };

const CONTROL_TAGS = new Set(['button', 'select', 'textarea']);
const CONTROL_ROLES = new Set(['button', 'checkbox', 'combobox', 'menuitem', 'option', 'radio', 'slider', 'switch', 'tab', 'textbox']);
const BUTTON_CLASS = /^(?:btn|button)(?:[-_].*)?$/;

const isHidden = ({ tag, attributes }: Element): boolean => tag === 'head' || attributes.has('hidden') || attributes.get('aria-hidden') === 'true';

/** A link drawn as a button: a `btn` or `button` class (`btn-primary` too). A role makes any element a control. */
const isButtonLink = ({ attributes }: Element): boolean => (attributes.get('class') ?? '').split(/\s+/).some((name) => BUTTON_CLASS.test(name));

function isControl(element: Element, primary: Selector): boolean {
  const { tag, attributes } = element;
  if (CONTROL_TAGS.has(tag) || CONTROL_ROLES.has(attributes.get('role') ?? '') || matches(primary, element)) return true;
  if (tag === 'input') return (attributes.get('type') ?? '').toLowerCase() !== 'hidden';
  return tag === 'a' && isButtonLink(element);
}

/** The visible text under an element, squashed. */
function textUnder(element: Element): string {
  return element.children
    .map((child) => {
      if (child.kind === 'text') return child.text;
      return isHidden(child) ? '' : ` ${textUnder(child)} `;
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** How an untagged control is named: its tag, then its label, else its accessible name, placeholder, value or name. */
function controlLabel(element: Element): string {
  const { attributes } = element;
  const label = [textUnder(element), attributes.get('aria-label'), attributes.get('placeholder'), attributes.get('value'), attributes.get('name')]
    .map((text) => text?.trim())
    .find(Boolean);
  return label ? `${element.tag} "${label}"` : element.tag;
}

type Walk = { readonly rules: PartRules; tagged: number; readonly offList: string[]; readonly untagged: string[] };

/** Whether the walk leaves an element out: hidden, a nested screen (read on its own), or content the screen shows. */
const leftOut = (element: Element, rules: PartRules, top: boolean): boolean =>
  isHidden(element) || (!top && (matches(rules.screen, element) || matches(rules.content, element)));

/** A tag counted, and named off the list once when the list does not hold it. */
function recordTag(walk: Walk, tag: string): void {
  walk.tagged += 1;
  if (!isListed(walk.rules.parts, tag) && !walk.offList.includes(tag)) walk.offList.push(tag);
}

/** One element of a screen; `covered` is true once an element around it inside the screen carries a tag. */
function visit(element: Element, walk: Walk, covered: boolean, top: boolean): void {
  if (leftOut(element, walk.rules, top)) return;
  const tag = element.attributes.get(PART_ATTRIBUTE)?.trim() ?? '';
  if (tag !== '') recordTag(walk, tag);
  else if (!covered && isControl(element, walk.rules.primary)) walk.untagged.push(controlLabel(element));
  const inside = covered || tag !== '';
  for (const child of element.children) if (child.kind === 'element') visit(child, walk, inside, false);
}

/** Every element the screen selector matches, outermost first, in page order. */
function screensUnder(node: Element, screen: Selector): Element[] {
  if (isHidden(node)) return [];
  const own = matches(screen, node) ? [node] : [];
  return [...own, ...node.children.flatMap((child) => (child.kind === 'element' ? screensUnder(child, screen) : []))];
}

/** The name a screen goes by: the first attribute its selector asks for by name that it holds, else its id or label. */
function screenName(screen: Element, rules: PartRules, index: number): string {
  const named = [...namingAttributes(rules.screen), 'id', 'aria-label'].map((name) => screen.attributes.get(name)?.trim()).find(Boolean);
  return named ?? `#${index + 1}`;
}

/** The parts check over one page's HTML. */
export function partsOfPage(html: string, rules: PartRules): PageParts {
  const marked = screensUnder(parseHtml(html), rules.screen);
  const screens = marked.map((screen, index) => {
    const walk: Walk = { rules, tagged: 0, offList: [], untagged: [] };
    visit(screen, walk, false, true);
    return { name: screenName(screen, rules, index), tagged: walk.tagged, offList: walk.offList, untagged: walk.untagged };
  });
  return { skipped: marked.length === 0, screens };
}

const partsTagged = (count: number): string => `${count} ${count === 1 ? 'part' : 'parts'} tagged`;

/** The lines `omni design parts --check <page>` prints for one page, under its name. */
export function formatPageParts(page: string, { skipped, screens }: PageParts, rules: Pick<PartRules, 'screen'>): string[] {
  const lines = [page];
  if (skipped) lines.push(`  no screen marked: skipped (${rules.screen.source})`);
  for (const screen of screens) {
    lines.push(`  screen ${screen.name} · ${partsTagged(screen.tagged)}`);
    if (screen.offList.length === 0 && screen.untagged.length === 0) lines.push('    parts: all listed');
    for (const name of screen.offList) lines.push(`    off-list: ${name}`);
    for (const control of screen.untagged) lines.push(`    untagged: ${control}`);
  }
  return lines;
}
