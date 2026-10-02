import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { HastElement, HastNode } from './badges';

// A diagram of the guide: an SVG file beside the pages, under docs/guide/diagrams/, shown by a line of
// its own, `![What it shows](diagrams/loop.svg)`. GitHub shows the file as an image, in the colours its
// own <style> gives it. The app sets the drawing itself in the page instead, when the guide is
// compiled (remarkDiagrams, source.config.ts), inside <figure class="docs-figure">: its shapes and
// words carry dg-* classes that docs.css paints with the theme's tokens, so a diagram follows the
// theme switch as the page does. The file's <style>, <title> and <desc> are left out there: docs.css
// styles it, and the line's alt text names it (role="img", aria-label). The guard (guide.ts) refuses a
// diagram that is no file of the guide, has no alt text, does not stand alone on its line, or does not
// read. Nothing here runs in the browser.

/** The SVG's own elements the page leaves out. */
const LEFT_OUT = new Set(['style', 'title', 'desc']);
/** Where the spaces between words are the drawing's own. */
const KEEPS_SPACES = new Set(['text', 'tspan']);

const TOKEN = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([A-Za-z][\w:.-]*)\s*>|<([A-Za-z][\w:.-]*)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
const ATTRIBUTE = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

const decode = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] !== '#') return ENTITIES[name] ?? whole;
    return String.fromCodePoint(name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
  });

/** An SVG file the guide cannot read: what is wrong, and where. */
export class DiagramError extends Error {}

/** A tag's attributes as hast properties: `class` as className, the xmlns declarations left out, every
 * other name as written, which the compiler reads as SVG's own. */
function properties(attributes: string): Record<string, unknown> {
  const found: Record<string, unknown> = {};
  for (const [, attribute, double, single] of attributes.matchAll(ATTRIBUTE)) {
    const name = attribute!; // ts-allow: the pattern's first group is not optional
    const value = decode(double ?? single ?? '');
    if (name === 'xmlns' || name.startsWith('xmlns:')) continue;
    found[name === 'class' ? 'className' : name] = name === 'class' ? value.split(/\s+/).filter(Boolean) : value;
  }
  return found;
}

/**
 * An SVG file, well-formed, as one hast element: its root `<svg>` and everything in it, but its
 * `<style>`, `<title>` and `<desc>`. Throws a DiagramError naming the line of the first thing it
 * cannot read.
 */
export function readSvg(source: string): HastElement {
  const open: HastElement[] = [];
  let root: HastElement | null = null;
  let at = 0;
  const lineAt = (index: number) => source.slice(0, index).split('\n').length;
  const fail = (index: number, what: string): never => {
    throw new DiagramError(`line ${lineAt(index)}: ${what}`);
  };

  const text = (value: string, index: number) => {
    if (value.includes('<')) fail(index + value.indexOf('<'), 'a < that opens no tag (write &lt;)');
    const parent = open.at(-1);
    if (!value.trim()) {
      if (value && parent && KEEPS_SPACES.has(parent.tagName)) parent.children.push({ type: 'text', value: ' ' });
      return;
    }
    if (!parent) fail(index, 'text outside the <svg>');
    else parent.children.push({ type: 'text', value: decode(value) });
  };

  for (const match of source.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    text(source.slice(at, index), at);
    at = index + match[0].length;
    const [whole, closing, tag, attributes, selfClosing] = match;
    if (whole.startsWith('<!') || whole.startsWith('<?')) continue;
    if (closing) {
      const top = open.pop();
      if (!top) fail(index, `</${closing}> closes nothing`);
      else if (top.tagName !== closing) fail(index, `</${closing}> closes <${top.tagName}>`);
      else if (open.length === 0) root = top;
      continue;
    }
    const name = tag!; // ts-allow: a tag neither a comment, a declaration nor a closing one is an opening one, named
    if (root || (open.length === 0 && name !== 'svg')) fail(index, `<${name}> outside the one <svg>`);
    const node: HastElement = { type: 'element', tagName: name, properties: properties(attributes ?? ''), children: [] };
    const parent = open.at(-1);
    // A left-out element is still read, so its end tag is matched, but it hangs from nothing.
    if (parent && !LEFT_OUT.has(name)) parent.children.push(node);
    if (selfClosing) {
      if (!parent) root = node;
    } else {
      open.push(node);
    }
  }
  text(source.slice(at), at);
  if (open.length) fail(source.length, `<${open.at(-1)?.tagName}> is never closed`);
  if (!root) return fail(0, 'no <svg>');
  return root;
}

/** Why the guard refuses an SVG file, or null when the guide can read it. */
export function svgProblem(source: string): string | null {
  try {
    readSvg(source);
    return null;
  } catch (error) {
    if (error instanceof DiagramError) return error.message;
    throw error;
  }
}

/** The figure a diagram becomes in the page: the drawing, named by the alt text of its line. */
export function diagramFigure(svg: HastElement, alt: string): HastElement {
  return {
    type: 'element',
    tagName: 'figure',
    properties: { className: ['docs-figure'] },
    children: [{ ...svg, properties: { ...svg.properties, role: 'img', 'aria-label': alt } }],
  };
}

/** Whether an image's path is a diagram of the guide: an SVG file, named relative to the page. */
export const isDiagramPath = (url: string) => /\.svg$/i.test(url) && !/^(\/|[a-z][a-z0-9+.-]*:)/i.test(url);

/** One diagram a page shows: its line (1 = the markdown's first), alt text and path, and whether it
 * stands alone, a paragraph of its own. */
export interface DiagramLine {
  line: number;
  alt: string;
  src: string;
  alone: boolean;
}

const IMAGE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

/** Every diagram a page's markdown shows. */
export function diagramsNamed(markdown: string): DiagramLine[] {
  const lines = markdown.split('\n');
  const blank = (i: number) => i < 0 || i >= lines.length || !lines[i]!.trim(); // ts-allow: i is inside the lines
  return lines.flatMap((text, i) =>
    [...text.matchAll(IMAGE)]
      .filter((m) => isDiagramPath(m[2]!)) // ts-allow: both of IMAGE's groups always match
      .map((m) => ({ line: i + 1, alt: m[1]!, src: m[2]!, // ts-allow: both of IMAGE's groups always match
        alone: text.trim() === m[0] && blank(i - 1) && blank(i + 1) })));
}

/** The few mdast shapes the compile step reads and writes: no dependency on mdast's own types. */
interface MdNode {
  type: string;
  url?: string;
  alt?: string | null;
  value?: string;
  children?: MdNode[];
  data?: Record<string, unknown>;
}

/** The diagram a paragraph is, when all it holds is one image of an SVG file of the guide. */
function diagramOf(node: MdNode): { url: string; alt: string } | null {
  if (node.type !== 'paragraph') return null;
  const [only, ...rest] = (node.children ?? []).filter((child) => !(child.type === 'text' && !child.value?.trim()));
  if (!only || rest.length || only.type !== 'image' || !only.url || !isDiagramPath(only.url)) return null;
  return { url: only.url, alt: only.alt ?? '' };
}

/** The page being compiled, as the remark plugin sees it: fumadocs-mdx hands it the bundler's
 * dependency tracker, so a page is compiled again when a diagram it shows changes. */
interface PageFile {
  dirname?: string;
  path?: string;
  /** VFile's data: fumadocs-mdx's `_compiler` is read from it, when there is one. */
  data?: object;
}

/** The bundler's dependency tracker fumadocs-mdx leaves on the page's data, if any. */
const tracker = (file: PageFile) =>
  (file.data as { _compiler?: { addDependency?: (path: string) => void } } | undefined)?._compiler; // ts-allow: fumadocs-mdx's compiler hangs from the file's data, untyped

/**
 * The compile step, a remark plugin run before fumadocs' own (source.config.ts), so its image step
 * never sees a diagram: each paragraph that is one diagram becomes its figure, read from the file the
 * page names, relative to the page, which becomes one of the page's dependencies. A file that is
 * missing or does not read stops the build.
 */
export function remarkDiagrams() {
  return (tree: MdNode, file: PageFile) => {
    const dir = file.dirname ?? (file.path ? dirname(file.path) : null);
    const walk = (parent: MdNode) => {
      parent.children = parent.children?.map((child) => {
        const diagram = diagramOf(child);
        if (!diagram) {
          if (child.children) walk(child);
          return child;
        }
        if (!dir) throw new Error(`the diagram ${diagram.url}: the page's folder is unknown`);
        const path = join(dir, diagram.url);
        tracker(file)?.addDependency?.(path);
        let figure: HastElement;
        try {
          figure = diagramFigure(readSvg(readFileSync(path, 'utf8')), diagram.alt);
        } catch (error) {
          throw new Error(`the diagram ${diagram.url} ${file.path ? `of ${file.path} ` : ''}does not read: ${(error as Error).message}`, { cause: error }); // ts-allow: a caught value is unknown; the readers throw Errors
        }
        const children: HastNode[] = figure.children;
        return { type: 'diagram', data: { hName: figure.tagName, hProperties: figure.properties, hChildren: children } };
      });
    };
    walk(tree);
  };
}
