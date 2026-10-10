// PRD 1407, s4: a dependency-free read of an HTML page into a tree of elements and text, enough for
// the word pass — which reads structure, never style. It is forgiving, as a mockup's markup may be:
// a stray end tag is dropped, an unclosed element closes with its parent, and the bodies of
// `<script>`, `<style>`, `<template>` and `<noscript>` are skipped, never read as words. No CSS is
// read and nothing runs.

/** An element: its tag (lowercased), its attributes (names lowercased) and its children. */
export type Element = { readonly kind: 'element'; readonly tag: string; readonly attributes: ReadonlyMap<string, string>; readonly children: Node[] };

/** A run of text, entities decoded. */
type Text = { readonly kind: 'text'; readonly text: string };

export type Node = Element | Text;

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'template', 'noscript', 'textarea', 'title']);
const KEPT_RAW = new Set(['textarea', 'title']);
const NAMED: Readonly<Record<string, string>> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', middot: '·', hellip: '…',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', laquo: '«', raquo: '»', copy: '©', bull: '•', times: '×', rarr: '→', larr: '←',
};
const TAG_OPEN = /^<([A-Za-z][\w:-]*)/;
const TAG_CLOSE = /^<\/([A-Za-z][\w:-]*)\s*>/;
const ATTRIBUTE = /^\s*([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/;

/** A numeric reference's character (`#8212`, `#x2192`), or null when it names none. */
function numericReference(ref: string): string | null {
  const hex = ref[1] === 'x' || ref[1] === 'X';
  const code = Number.parseInt(ref.slice(hex ? 2 : 1), hex ? 16 : 10);
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : null;
}

/** `text` with its character references decoded; one it does not know stays as written. */
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ref: string) =>
    (ref.startsWith('#') ? numericReference(ref) : NAMED[ref.toLowerCase()]) ?? whole);
}

/** The index just past the first `marker` at or after `from`, or the end of the page when there is none. */
function past(html: string, marker: string, from: number): number {
  const at = html.indexOf(marker, from);
  return at === -1 ? html.length : at + marker.length;
}

/** The read in progress: the root, and the elements still open, innermost last. */
type Reader = { readonly html: string; readonly root: Element; readonly stack: Element[] };

const top = ({ root, stack }: Reader): Element => stack[stack.length - 1] ?? root;

function addText(reader: Reader, text: string): void {
  if (text !== '') top(reader).children.push({ kind: 'text', text: decodeEntities(text) });
}

/** Past a comment, a doctype or a processing instruction at `lt`; null when none starts there. */
function skipDeclaration(html: string, lt: number): number | null {
  if (html.startsWith('<!--', lt)) return past(html, '-->', lt + 4);
  if (html.startsWith('<!', lt) || html.startsWith('<?', lt)) return past(html, '>', lt);
  return null;
}

/** Past an end tag at `lt`, closing its element and any left open inside it; null when none starts there. */
function readEndTag(reader: Reader, lt: number): number | null {
  const close = TAG_CLOSE.exec(reader.html.slice(lt, lt + 256));
  if (close?.[1] === undefined) return null;
  const index = reader.stack.map((element) => element.tag).lastIndexOf(close[1].toLowerCase());
  if (index >= 0) reader.stack.length = index;
  return lt + close[0].length;
}

/** The attributes from `cursor` on, and the index where they end. */
function readAttributes(html: string, cursor: number): { attributes: Map<string, string>; end: number } {
  const attributes = new Map<string, string>();
  let at = cursor;
  let attribute = ATTRIBUTE.exec(html.slice(at));
  while (attribute?.[1]) {
    const name = attribute[1].toLowerCase();
    if (!attributes.has(name)) attributes.set(name, decodeEntities(attribute[2] ?? attribute[3] ?? attribute[4] ?? ''));
    at += attribute[0].length;
    attribute = ATTRIBUTE.exec(html.slice(at));
  }
  return { attributes, end: at };
}

/** Past a raw element's body (`script`, `style`, …) and its end tag, keeping a title's or a textarea's text. */
function readRawBody(reader: Reader, element: Element, from: number): number {
  const closeAt = reader.html.toLowerCase().indexOf(`</${element.tag}`, from);
  if (KEPT_RAW.has(element.tag)) element.children.push({ kind: 'text', text: decodeEntities(reader.html.slice(from, closeAt === -1 ? undefined : closeAt)) });
  return closeAt === -1 ? reader.html.length : past(reader.html, '>', closeAt);
}

/** Past a start tag at `lt` (and a raw element's body), opening its element; null when none starts there. */
function readStartTag(reader: Reader, lt: number): number | null {
  const open = TAG_OPEN.exec(reader.html.slice(lt, lt + 256));
  if (open?.[1] === undefined) return null;
  const tag = open[1].toLowerCase();
  const { attributes, end } = readAttributes(reader.html, lt + open[0].length);
  const after = past(reader.html, '>', end);
  const element: Element = { kind: 'element', tag, attributes, children: [] };
  top(reader).children.push(element);
  if (RAW.has(tag)) return readRawBody(reader, element, after);
  const selfClosing = reader.html[after - 2] === '/';
  if (!VOID.has(tag) && !selfClosing) reader.stack.push(element);
  return after;
}

/** Past whatever markup starts at `lt`; a `<` that starts none is read as text. */
function readMarkup(reader: Reader, lt: number): number {
  const next = skipDeclaration(reader.html, lt) ?? readEndTag(reader, lt) ?? readStartTag(reader, lt);
  if (next !== null) return next;
  addText(reader, '<');
  return lt + 1;
}

/** The page read into one root element (`#document`) holding everything. */
export function parseHtml(html: string): Element {
  const root: Element = { kind: 'element', tag: '#document', attributes: new Map(), children: [] };
  const reader: Reader = { html, root, stack: [] };
  let at = 0;
  while (at < html.length) {
    const lt = html.indexOf('<', at);
    addText(reader, html.slice(at, lt === -1 ? undefined : lt));
    at = lt === -1 ? html.length : readMarkup(reader, lt);
  }
  return root;
}
