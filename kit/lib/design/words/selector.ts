// PRD 1407, s4: the selectors the word pass marks a screen and a primary action by
// (`design.words.screen`, `design.words.primary`). A selector here is a comma-separated list of
// compound selectors — a tag or `*`, then any `#id`, `.class`, `[attr]` and `[attr=value]` — with no
// combinator and no pseudo-class: it names an element by its own markup, never by where it sits or
// how it looks. Anything else does not parse, so the config refuses it.

/** One `[attr]` or `[attr=value]` test. */
type AttributeTest = { readonly name: string; readonly value: string | null };

/** One compound selector: every part must hold of the same element. */
type Compound = { readonly tag: string | null; readonly ids: readonly string[]; readonly classes: readonly string[]; readonly attributes: readonly AttributeTest[] };

/** A parsed selector: an element matches when any of its compounds does. */
export type Selector = { readonly source: string; readonly compounds: readonly Compound[] };

/** What a selector reads of an element: its tag, lowercased, and its attributes. */
export type Markup = { readonly tag: string; readonly attributes: ReadonlyMap<string, string> };

const NAME = String.raw`[A-Za-z_][\w-]*`;
const PART = String.raw`(?:#(${NAME})|\.(${NAME})|\[\s*(${NAME})\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\]\s"']+))\s*)?\])`;
const COMPOUND = new RegExp(String.raw`^(\*|${NAME})?((?:${PART})*)$`);

function parseCompound(text: string): Compound | null {
  const compound = COMPOUND.exec(text.trim());
  if (!compound || compound[0] === '') return null;
  const [, tag, parts = ''] = compound;
  const matched = [...parts.matchAll(new RegExp(PART, 'g'))];
  return {
    tag: tag === undefined || tag === '*' ? null : tag.toLowerCase(),
    ids: matched.flatMap(([, id]) => (id === undefined ? [] : [id])),
    classes: matched.flatMap(([, , className]) => (className === undefined ? [] : [className])),
    attributes: matched.flatMap(([, , , name, doubled, single, bare]): AttributeTest[] =>
      name === undefined ? [] : [{ name: name.toLowerCase(), value: doubled ?? single ?? bare ?? null }]),
  };
}

/** `source` parsed, or null when it is not a selector this module reads. */
export function parseSelector(source: string): Selector | null {
  const compounds: Compound[] = [];
  for (const piece of source.split(',')) {
    const compound = parseCompound(piece);
    if (!compound) return null;
    compounds.push(compound);
  }
  return { source, compounds };
}

function matchesCompound({ tag, ids, classes, attributes }: Compound, element: Markup): boolean {
  if (tag !== null && tag !== element.tag) return false;
  const id = element.attributes.get('id');
  if (ids.some((wanted) => wanted !== id)) return false;
  const own = new Set((element.attributes.get('class') ?? '').split(/\s+/).filter(Boolean));
  if (classes.some((wanted) => !own.has(wanted))) return false;
  return attributes.every(({ name, value }) => element.attributes.has(name) && (value === null || element.attributes.get(name) === value));
}

/** Whether `element` matches any compound of `selector`. */
export function matches(selector: Selector, element: Markup): boolean {
  return selector.compounds.some((compound) => matchesCompound(compound, element));
}

/**
 * The attributes a selector asks for by name alone (`[data-screen]`, not `[role=dialog]`), in order:
 * the first one an element holds a value for names its screen.
 */
export function namingAttributes(selector: Selector): string[] {
  return [...new Set(selector.compounds.flatMap((compound) => compound.attributes.flatMap((test) => (test.value === null ? [test.name] : []))))];
}
