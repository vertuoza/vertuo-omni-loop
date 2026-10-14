// PRD 1737: a product's critical flows (`<e2e.dir>/critical-flows.md`). One `## <id>: <name>` heading
// per flow, the lines under it say what its failure costs. Pure: text in, flows out; no file reads.

/** One critical flow: the `flow-<id>` tag's id, a name, and what its failure costs. */
export type Flow = { readonly id: string; readonly name: string; readonly cost: string };

/** `none`: no list (absent, empty, or no flow heading). `list`: the flows, in order. */
export type Flows = { readonly kind: 'none' } | { readonly kind: 'list'; readonly flows: readonly Flow[] };

/** A list that cannot be read: its message names the file and the flow. */
export class FlowsError extends Error {
  constructor(file: string, why: string) {
    super(`${file}: ${why}`);
    this.name = 'FlowsError';
  }
}

const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The flows of a list's text; `undefined` is an absent file. Throws a `FlowsError` naming the flow. */
export function parseFlows(file: string, text: string | undefined): Flows {
  if (text === undefined) return { kind: 'none' };
  const sections: { heading: string; body: string[] }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const heading = /^##\s+(.*)$/.exec(line);
    if (heading) sections.push({ heading: (heading[1] ?? '').trim(), body: [] });
    else sections.at(-1)?.body.push(line);
  }
  if (sections.length === 0) return { kind: 'none' };
  const flows: Flow[] = [];
  const seen = new Set<string>();
  sections.forEach(({ heading, body }, index) => {
    const colon = heading.indexOf(':');
    const id = (colon === -1 ? heading : heading.slice(0, colon)).trim();
    const name = colon === -1 ? '' : heading.slice(colon + 1).trim();
    if (id === '') throw new FlowsError(file, `flow ${index + 1} ("${name}") has no id`);
    if (name === '') throw new FlowsError(file, `flow "${id}" has no name`);
    if (!ID.test(id)) throw new FlowsError(file, `flow "${name}": id "${id}" must be lowercase letters, digits and hyphens`);
    if (seen.has(id)) throw new FlowsError(file, `id "${id}" is used twice`);
    seen.add(id);
    flows.push({ id, name, cost: body.join('\n').trim() });
  });
  return { kind: 'list', flows };
}
