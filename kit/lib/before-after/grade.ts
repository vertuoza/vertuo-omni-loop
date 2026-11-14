// PRD 2239, s1: the grading of a before/after page of the two-tab shape (spec §4). A page whose head
// carries `<meta name="omni-before-after" content="2">` must hold both tabs, give every
// `data-section` one of the three states, keep no `<!-- FILL -->` and no unrendered
// `<pre class="mermaid">`, and load no resource. PRD 2850, s2: content `3` is the three-tab shape: it
// keeps all of that, with the Pixel perfect tab and the nine rules of the screens (spec §4) in
// place of the two-tab rule. A page without a meta of those two versions is not graded here: it is
// graded on its size alone, as before (`../inbox/check-inbox.ts`). Pure: it reads the page's text,
// never the disk, and each violation names the file.
import { type Element, parseHtml } from '../design/words/html.ts';
import type { PrdNumber } from '../ids.ts';

/** The name of the meta that marks a page of a graded shape. */
const META_NAME = 'omni-before-after';

/** The tabs each graded version holds, in the order the page holds them. */
const TABS_OF = {
  '2': ['functional', 'technical'],
  '3': ['functional', 'technical', 'pixel-perfect'],
} as const;

type Version = keyof typeof TABS_OF;

const isVersion = (content: string | undefined): content is Version => content !== undefined && Object.hasOwn(TABS_OF, content);

/** The name of the one section, and of the tab, the screens live in (version 3). */
const PIXEL_PERFECT = 'pixel-perfect';
const REFERENCE = /^[1-9]\d*\.[A-Z]$/;
const WIDTH = /^[1-9]\d*$/;
const WIDTH_MIN = 320;
const WIDTH_MAX = 2560;
const SIDES: ReadonlySet<string> = new Set(['today', 'after']);

/** The three states a section takes (spec §1, Section states). */
const SECTION_STATES = ['filled', 'na', 'gap'] as const;

const STATES: ReadonlySet<string> = new Set(SECTION_STATES);
const FILL = /<!--\s*FILL\s*-->/g;
/** The attributes a browser fetches from, on any element. */
const FETCHED = ['src', 'srcset', 'poster'] as const;
/** The attributes an element fetches from unless it is a link (`LINKS`), which a reader follows instead. */
const REFERENCES = ['href', 'xlink:href'] as const;
const LINKS = new Set(['a', 'area', 'base']);
/** The elements that start and end a line of text. */
const BLOCKS = new Set([
  'p', 'div', 'li', 'ul', 'ol', 'section', 'nav', 'figure', 'figcaption', 'header', 'footer', 'main', 'article', 'aside', 'br',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'tr', 'table', 'pre', 'blockquote',
]);

/** A section read: its name, its state (null when it has none), the service and tab around it, and its text. */
type Section = {
  readonly name: string;
  readonly state: string | null;
  readonly service: string | null;
  readonly tab: string | null;
  readonly text: string;
};

/** A marked screen (`data-screen`) read: its marks as written (null when absent), the tab around it and the section (an index) it sits in. */
type Screen = {
  readonly name: string;
  readonly ref: string | null;
  readonly when: string | null;
  readonly viewport: string | null;
  readonly tab: string | null;
  readonly section: number | null;
};

/** What the page holds, read once: its meta, its tabs, its sections and screens, its unrendered diagrams, the resources it loads. */
type Read = { version: Version | null; tabs: Set<string>; sections: Section[]; screens: Screen[]; diagrams: number; loads: string[] };

/** Whether a URL loads nothing: blank, a `data:` URL, or a fragment of the page itself. */
function loadsNothing(url: string): boolean {
  const value = url.trim();
  return value === '' || value.startsWith('#') || value.toLowerCase().startsWith('data:');
}

/** Whether an attribute's value loads nothing. A `srcset` is read whole, never split into its candidates: only a blank one does. */
const quiet = (attribute: string, value: string): boolean => (attribute === 'srcset' ? value.trim() === '' : loadsNothing(value));

/** The resources one element loads, each as `<tag attribute="value">`. */
function loadsOf({ tag, attributes }: Element): string[] {
  const named = (attribute: string, value: string): string => `<${tag} ${attribute}="${value}">`;
  const read = LINKS.has(tag) ? FETCHED : [...FETCHED, ...REFERENCES];
  const found = read.flatMap((attribute) => {
    const value = attributes.get(attribute);
    return value === undefined || quiet(attribute, value) ? [] : [named(attribute, value)];
  });
  const data = attributes.get('data');
  if (tag === 'object' && data !== undefined && !loadsNothing(data)) found.push(named('data', data));
  return found;
}

/** The version a `<meta name="omni-before-after">` declares, when it is one this grader reads. */
function metaVersion({ tag, attributes }: Element): Version | null {
  const content = attributes.get('content');
  return tag === 'meta' && attributes.get('name') === META_NAME && isVersion(content) ? content : null;
}

const isDiagram = ({ tag, attributes }: Element): boolean =>
  tag === 'pre' && attributes.get('class')?.split(/\s/).includes('mermaid') === true;

/** The innermost service, tab and section (an index of `read.sections`) around an element. */
type Around = { readonly service: string | null; readonly tab: string | null; readonly section: number | null };

/** The marks one element bears on its own: the meta, an unrendered diagram, the resources it loads. */
function noteMarks(element: Element, read: Read): void {
  read.version ??= metaVersion(element);
  if (isDiagram(element)) read.diagrams += 1;
  read.loads.push(...loadsOf(element));
}

/** The service and tab around the children of `element`: its own, else those around it. */
const within = ({ attributes }: Element, around: Around): Around => ({
  service: attributes.get('data-service') ?? around.service,
  tab: attributes.get('data-tab') ?? around.tab,
  section: around.section,
});

/** The text under `element`, a line break around each block element, so a line of the page reads as one line. */
function textOf(element: Element): string {
  return element.children
    .map((child) => {
      if (child.kind === 'text') return child.text;
      return BLOCKS.has(child.tag) ? `\n${textOf(child)}\n` : textOf(child);
    })
    .join('');
}

/** Notes the screen `element` is, if it is one, `here` being where it sits. */
function noteScreen({ attributes }: Element, here: Around, read: Read): void {
  const name = attributes.get('data-screen');
  if (name === undefined) return;
  read.screens.push({
    name,
    ref: attributes.get('data-ref') ?? null,
    when: attributes.get('data-when') ?? null,
    viewport: attributes.get('data-viewport') ?? null,
    tab: here.tab,
    section: here.section,
  });
}

/** Notes the tab, the screen or the section `element` is, `here` being the service and tab it sits in; the section it opens, as an index. */
function noteParts(element: Element, here: Around, read: Read): number | null {
  const tab = element.attributes.get('data-tab');
  if (tab !== undefined) read.tabs.add(tab);
  noteScreen(element, here, read);
  const name = element.attributes.get('data-section');
  if (name === undefined) return null;
  read.sections.push({ name, state: element.attributes.get('data-state') ?? null, service: here.service, tab: here.tab, text: textOf(element) });
  return read.sections.length - 1;
}

/** Reads `element` and everything under it into `read`. */
function walk(element: Element, around: Around, read: Read): void {
  noteMarks(element, read);
  const outer = within(element, around);
  const opened = noteParts(element, outer, read);
  const here = opened === null ? outer : { ...outer, section: opened };
  for (const child of element.children) {
    if (child.kind === 'element') walk(child, here, read);
  }
}

/** Where a section sits, in words: its service and its tab, when it has them. */
const placeOf = ({ name, service, tab }: Section): string =>
  `section "${name}"${service === null ? '' : ` of service "${service}"`}${tab === null ? '' : ` in the "${tab}" tab`}`;

/** The violation of one section's state, or null when it is one of the three. */
function stateViolation(section: Section): string | null {
  if (section.state === null) return `${placeOf(section)} has no data-state (${SECTION_STATES[0]}, ${SECTION_STATES[1]} or ${SECTION_STATES[2]})`;
  if (STATES.has(section.state)) return null;
  return `${placeOf(section)} has data-state "${section.state}", not ${SECTION_STATES[0]}, ${SECTION_STATES[1]} or ${SECTION_STATES[2]}`;
}

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

const quote = (text: string): string => `"${text}"`;

/** A screen in words: its library name, and its reference when it has a well-formed one. */
const screenOf = ({ name, ref }: Screen): string => `screen ${quote(name)}${ref !== null && REFERENCE.test(ref) ? ` (${ref})` : ''}`;

/** Rule 5, on one screen: each mark it lacks or writes badly. */
function marksViolations(screen: Screen): string[] {
  const { ref, when, viewport } = screen;
  const found: string[] = [];
  if (ref === null) found.push(`${screenOf(screen)} has no data-ref`);
  else if (!REFERENCE.test(ref)) found.push(`${screenOf(screen)} has data-ref ${quote(ref)}, not <number>.<letter> as 2.C`);
  if (when === null) found.push(`${screenOf(screen)} has no data-when (today or after)`);
  else if (!SIDES.has(when)) found.push(`${screenOf(screen)} has data-when ${quote(when)}, not today or after`);
  if (viewport === null) found.push(`${screenOf(screen)} has no data-viewport (a width in CSS pixels, ${WIDTH_MIN} to ${WIDTH_MAX})`);
  else if (!WIDTH.test(viewport) || Number(viewport) < WIDTH_MIN || Number(viewport) > WIDTH_MAX) {
    found.push(`${screenOf(screen)} has data-viewport ${quote(viewport)}, not a whole number of CSS pixels from ${WIDTH_MIN} to ${WIDTH_MAX}`);
  }
  return found;
}

/** The screens that have a well-formed reference and side, with both narrowed. */
function referenced(screens: readonly Screen[]): { screen: Screen; ref: string; when: string }[] {
  return screens.flatMap((screen) =>
    screen.ref !== null && REFERENCE.test(screen.ref) && screen.when !== null && SIDES.has(screen.when)
      ? [{ screen, ref: screen.ref, when: screen.when }]
      : []);
}

/** Rules 6 and 7: a pair written twice, a reference with no after. */
function pairViolations(screens: readonly Screen[]): string[] {
  const counts = new Map<string, number>();
  const refs = new Set<string>();
  for (const { ref, when } of referenced(screens)) {
    counts.set(`${ref} ${when}`, (counts.get(`${ref} ${when}`) ?? 0) + 1);
    refs.add(ref);
  }
  const twice = [...counts].filter(([, count]) => count > 1).map(([pair, count]) => `reference ${pair} is written ${count} times, not once`);
  const missing = [...refs].filter((ref) => !counts.has(`${ref} after`)).map((ref) => `reference ${ref} has no after`);
  return [...twice, ...missing];
}

/** Adds `value` to the set kept under `key`. */
function collect(map: Map<string, Set<string>>, key: string, value: string): void {
  map.set(key, (map.get(key) ?? new Set<string>()).add(value));
}

/** Rule 8: one number, one screen. */
function numberViolations(screens: readonly Screen[]): string[] {
  const namesOf = new Map<string, Set<string>>();
  const numbersOf = new Map<string, Set<string>>();
  for (const { screen, ref } of referenced(screens)) {
    const number = ref.slice(0, ref.indexOf('.'));
    collect(namesOf, number, screen.name);
    collect(numbersOf, screen.name, number);
  }
  const mixed = [...namesOf]
    .filter(([, names]) => names.size > 1)
    .map(([number, names]) => `number ${number} carries ${[...names].map(quote).join(' and ')}, not one screen`);
  const spread = [...numbersOf]
    .filter(([, numbers]) => numbers.size > 1)
    .map(([name, numbers]) => `screen ${quote(name)} sits under numbers ${[...numbers].join(' and ')}, not one`);
  return [...mixed, ...spread];
}

/** The names a section's `screens:` line gives, split on the middle dot; none when it has no such line. */
function namedScreens(text: string): Set<string> {
  const line = /^\s*screens:(.*)$/im.exec(text)?.[1] ?? '';
  return new Set(line.split('·').map((name) => name.trim()).filter((name) => name !== ''));
}

/** Rules 2, 4 and 9, on the Pixel perfect sections of a version 3 page: one, in its tab, holding a screen when filled and naming each. */
function sectionViolations(read: Read): string[] {
  const found: string[] = [];
  const own = read.sections.flatMap((section, index) => (section.name === PIXEL_PERFECT ? [{ section, index }] : []));
  if (own.length === 0) found.push(`no ${quote(PIXEL_PERFECT)} section`);
  else if (own.length > 1) found.push(`${own.length} ${quote(PIXEL_PERFECT)} sections, not one for the page`);
  for (const { section, index } of own) {
    if (section.tab !== PIXEL_PERFECT) found.push(`${placeOf(section)} sits outside the ${quote(PIXEL_PERFECT)} tab`);
    const held = read.screens.filter((screen) => screen.section === index);
    if (section.state === 'filled' && held.length === 0) found.push(`${placeOf(section)} is filled but holds no marked screen (data-screen)`);
    const named = namedScreens(section.text);
    for (const name of new Set(held.map((screen) => screen.name))) {
      if (!named.has(name)) found.push(`${placeOf(section)}: its screens: line does not name screen ${quote(name)}`);
    }
  }
  return found;
}

/** Rules 3 and 5 to 8, on the screens of a version 3 page: outside its tab, its marks, its pairs, its numbers. */
function screenViolations(read: Read): string[] {
  const outside = read.screens
    .filter(({ tab }) => tab !== PIXEL_PERFECT)
    .map((screen) => `${screenOf(screen)} sits ${screen.tab === null ? 'outside any tab' : `in the ${quote(screen.tab)} tab`}, not the ${quote(PIXEL_PERFECT)} tab`);
  return [...outside, ...read.screens.flatMap(marksViolations), ...pairViolations(read.screens), ...numberViolations(read.screens)];
}

/**
 * The violations of one before/after page (spec §4), each naming `file`, in this order: the tabs
 * missing, then (version 3) the Pixel perfect section's rules, the sections without a valid state,
 * then (version 3) the screens' rules, the `<!-- FILL -->` left, the diagrams not rendered, then
 * each resource it loads, in page order. Nothing for a page without a meta this grader reads.
 * `prd` names the render command; null (a folder whose name gives none) writes `<n>` in its place.
 */
export function gradeBeforeAfter({ file, html, prd }: { file: string; html: string; prd: PrdNumber | null }): string[] {
  const read: Read = { version: null, tabs: new Set(), sections: [], screens: [], diagrams: 0, loads: [] };
  walk(parseHtml(html), { service: null, tab: null, section: null }, read);
  if (read.version === null) return [];

  const violations: string[] = [];
  for (const tab of TABS_OF[read.version]) {
    if (!read.tabs.has(tab)) violations.push(`no "${tab}" tab`);
  }
  if (read.version === '3') violations.push(...sectionViolations(read));
  for (const section of read.sections) {
    const violation = stateViolation(section);
    if (violation !== null) violations.push(violation);
  }
  if (read.version === '3') violations.push(...screenViolations(read));
  const fills = html.match(FILL)?.length ?? 0;
  if (fills > 0) violations.push(`${plural(fills, '<!-- FILL --> marker', '<!-- FILL --> markers')} left`);
  if (read.diagrams > 0) {
    violations.push(`${plural(read.diagrams, 'diagram', 'diagrams')} not rendered (omni before-after render ${prd === null ? '<n>' : String(prd)})`);
  }
  violations.push(...read.loads.map((resource) => `${resource} loads an external resource`));
  return violations.map((violation) => `${file}: ${violation}`);
}
