// PRD 2239, s1: the grading of a before/after page of the two-tab shape (spec §4). A page whose head
// carries `<meta name="omni-before-after" content="2">` must hold both tabs, give every
// `data-section` one of the three states, keep no `<!-- FILL -->` and no unrendered
// `<pre class="mermaid">`, and load no resource. A page without the meta is not graded here: it is
// graded on its size alone, as before (`../inbox/check-inbox.ts`). Pure: it reads the page's text,
// never the disk, and each violation names the file.
import { type Element, parseHtml } from '../design/words/html.ts';
import type { PrdNumber } from '../ids.ts';

/** The meta that marks a page of the two-tab shape: its name and the one version graded. */
const BEFORE_AFTER_META = { name: 'omni-before-after', version: '2' } as const;

/** The two tabs, in the order the page holds them. */
const BEFORE_AFTER_TABS = ['functional', 'technical'] as const;

/** The three states a section takes (spec §1, Section states). */
const SECTION_STATES = ['filled', 'na', 'gap'] as const;

const STATES: ReadonlySet<string> = new Set(SECTION_STATES);
const FILL = /<!--\s*FILL\s*-->/g;
/** The attributes a browser fetches from, on any element. */
const FETCHED = ['src', 'srcset', 'poster'] as const;
/** The attributes an element fetches from unless it is a link (`LINKS`), which a reader follows instead. */
const REFERENCES = ['href', 'xlink:href'] as const;
const LINKS = new Set(['a', 'area', 'base']);

/** A section read: its name, its state (null when it has none), and the service and tab around it. */
type Section = { readonly name: string; readonly state: string | null; readonly service: string | null; readonly tab: string | null };

/** What the page holds, read once: its meta, its tabs, its sections, its unrendered diagrams, the resources it loads. */
type Read = { marked: boolean; tabs: Set<string>; sections: Section[]; diagrams: number; loads: string[] };

/**
 * Whether an attribute's value loads nothing: blank, a `data:` URL, or a fragment of the page itself.
 * A `srcset` is read whole, never split into its candidates: only a blank one loads nothing.
 */
function loadsNothing(attribute: string, url: string): boolean {
  const value = url.trim();
  if (attribute === 'srcset') return value === '';
  return value === '' || value.startsWith('#') || value.toLowerCase().startsWith('data:');
}

/** The resources one element loads, each as `<tag attribute="value">`. */
function loadsOf({ tag, attributes }: Element): string[] {
  const named = (attribute: string, value: string): string => `<${tag} ${attribute}="${value}">`;
  const read = LINKS.has(tag) ? FETCHED : [...FETCHED, ...REFERENCES];
  const found = read.flatMap((attribute) => {
    const value = attributes.get(attribute);
    return value === undefined || loadsNothing(attribute, value) ? [] : [named(attribute, value)];
  });
  const data = attributes.get('data');
  if (tag === 'object' && data !== undefined && !loadsNothing('data', data)) found.push(named('data', data));
  return found;
}

const isMeta = ({ tag, attributes }: Element): boolean =>
  tag === 'meta' && attributes.get('name') === BEFORE_AFTER_META.name && attributes.get('content') === BEFORE_AFTER_META.version;

const isDiagram = ({ tag, attributes }: Element): boolean =>
  tag === 'pre' && attributes.get('class')?.split(/\s/).includes('mermaid') === true;

/** The innermost service and tab around an element. */
type Around = { readonly service: string | null; readonly tab: string | null };

/** The marks one element bears on its own: the meta, an unrendered diagram, the resources it loads. */
function noteMarks(element: Element, read: Read): void {
  if (isMeta(element)) read.marked = true;
  if (isDiagram(element)) read.diagrams += 1;
  read.loads.push(...loadsOf(element));
}

/** The service and tab around the children of `element`: its own, else those around it. */
const within = ({ attributes }: Element, around: Around): Around => ({
  service: attributes.get('data-service') ?? around.service,
  tab: attributes.get('data-tab') ?? around.tab,
});

/** The tab or the section `element` is, if any, `here` being the service and tab it sits in. */
function noteParts({ attributes }: Element, here: Around, read: Read): void {
  const tab = attributes.get('data-tab');
  if (tab !== undefined) read.tabs.add(tab);
  const name = attributes.get('data-section');
  if (name !== undefined) read.sections.push({ name, state: attributes.get('data-state') ?? null, ...here });
}

/** Reads `element` and everything under it into `read`. */
function walk(element: Element, around: Around, read: Read): void {
  noteMarks(element, read);
  const here = within(element, around);
  noteParts(element, here, read);
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

/**
 * The violations of one before/after page (spec §4), each naming `file`, in this order: the tabs
 * missing, the sections without a valid state, the `<!-- FILL -->` left, the diagrams not rendered,
 * then each resource it loads, in page order. Nothing for a page without the meta. `prd` names the
 * render command; null (a folder whose name gives none) writes `<n>` in its place.
 */
export function gradeBeforeAfter({ file, html, prd }: { file: string; html: string; prd: PrdNumber | null }): string[] {
  const read: Read = { marked: false, tabs: new Set(), sections: [], diagrams: 0, loads: [] };
  walk(parseHtml(html), { service: null, tab: null }, read);
  if (!read.marked) return [];

  const violations: string[] = [];
  for (const tab of BEFORE_AFTER_TABS) {
    if (!read.tabs.has(tab)) violations.push(`no "${tab}" tab`);
  }
  for (const section of read.sections) {
    const violation = stateViolation(section);
    if (violation !== null) violations.push(violation);
  }
  const fills = html.match(FILL)?.length ?? 0;
  if (fills > 0) violations.push(`${plural(fills, '<!-- FILL --> marker', '<!-- FILL --> markers')} left`);
  if (read.diagrams > 0) {
    violations.push(`${plural(read.diagrams, 'diagram', 'diagrams')} not rendered (omni before-after render ${prd === null ? '<n>' : String(prd)})`);
  }
  violations.push(...read.loads.map((resource) => `${resource} loads an external resource`));
  return violations.map((violation) => `${file}: ${violation}`);
}
