// Where a guide code block goes (PRD 373). Every fenced block of docs/guide/*.md names it after its
// language, on the opening fence: ```bash terminal agent, ```text agent, ```yaml file=<path>,
// ```text github. When the guide is compiled (source.config.ts), rehypeCodeBadges turns those words
// into badges set above the code, as real text a screen reader reads first; docs.css draws them as
// arcade chips. The docs guard (guide.ts) refuses a block that names no kind, or names one wrongly,
// through fenceProblem. Nothing here runs in the browser.

/** One kind of place a block goes. */
export type CodeKind = { kind: 'terminal' } | { kind: 'agent' } | { kind: 'file'; path: string } | { kind: 'github' };

/** The few hast shapes the compile step reads and writes: no dependency on hast's own types. */
export interface HastElement {
  type: 'element';
  tagName: string;
  properties: Record<string, unknown>;
  children: HastNode[];
  data?: { meta?: string | null } & Record<string, unknown>;
}
export type HastNode = HastElement | { type: string; value?: string; children?: HastNode[] };
interface HastParent { children: HastNode[] }

const words = (meta: string | null | undefined) => (meta ?? '').trim().split(/\s+/).filter(Boolean);
const ORDER = { terminal: 0, agent: 1, file: 2, github: 3 } as const;

/** The kinds a fence's meta names, TERMINAL first. Words that are no kind are left out: the guard,
 * not the compiler, refuses them. */
export function codeKinds(meta: string | null | undefined): CodeKind[] {
  const kinds: CodeKind[] = [];
  for (const word of words(meta)) {
    if (word === 'terminal' || word === 'agent' || word === 'github') kinds.push({ kind: word });
    else if (word.startsWith('file=') && word.length > 'file='.length) kinds.push({ kind: 'file', path: word.slice('file='.length) });
  }
  return kinds.sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
}

/** What a badge reads. */
export function badgeLabel(kind: CodeKind): string {
  switch (kind.kind) {
    case 'terminal': return 'TERMINAL';
    case 'agent': return 'CODING AGENT';
    case 'file': return `FILE · ${kind.path}`;
    case 'github': return 'GITHUB COMMENT';
  }
}

/** Why the guard refuses a fence's meta, or null when it names where the block goes. One reason
 * per block: the first found. */
export function fenceProblem(meta: string | null | undefined): string | null {
  const named = words(meta);
  if (named.length === 0) return 'names no kind (terminal, agent, file=<path>, github)';
  for (const word of named) {
    if (word === 'file' || word === 'file=') return 'names file with no path';
    if (!['terminal', 'agent', 'github'].includes(word) && !word.startsWith('file=')) return `names "${word}", which is no kind`;
  }
  if (named.length > 1) {
    if (named.some((word) => word.startsWith('file='))) return 'names file= beside another kind: it stands alone';
    if (named.includes('github')) return 'names github beside another kind: it stands alone';
  }
  return null;
}

const element = (tagName: string, properties: Record<string, unknown>, children: HastNode[]): HastElement =>
  ({ type: 'element', tagName, properties, children });

/** The badges of a block: one chip per kind, in a row. */
export function badges(kinds: readonly CodeKind[]): HastElement {
  return element('div', { className: ['docs-badges'] }, kinds.map((kind) =>
    element('span', { className: ['docs-badge'], dataKind: kind.kind }, [{ type: 'text', value: badgeLabel(kind) }])));
}

/** A block with its badges above its code: `pre` is the block as compiled, `kinds` where it goes. */
export function badgedBlock(kinds: readonly CodeKind[], pre: HastNode): HastElement {
  return element('div', { className: ['docs-code'] }, [badges(kinds), pre]);
}

const isElement = (node: HastNode): node is HastElement => node.type === 'element';

/** The meta of a compiled code block: `<pre><code>` carries its fence's words as `data.meta`. */
function metaOf(node: HastNode): string | null {
  if (!isElement(node) || node.tagName !== 'pre') return null;
  const code = node.children.find(isElement);
  return code?.tagName === 'code' ? code.data?.meta ?? null : null;
}

/** The compile step, a rehype plugin: every code block whose fence names a kind gets its badges. */
export function rehypeCodeBadges() {
  return (tree: HastParent) => {
    const walk = (parent: HastParent) => {
      parent.children = parent.children.map((child) => {
        const kinds = codeKinds(metaOf(child));
        if (kinds.length > 0) return badgedBlock(kinds, child);
        if ('children' in child && Array.isArray(child.children)) walk(child as HastParent); // ts-allow: a node with a children array is a parent
        return child;
      });
    };
    walk(tree);
  };
}
