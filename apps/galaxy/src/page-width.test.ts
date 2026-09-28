// The app pages' width and top bar (PRD 498, s1), read from the stylesheets as text: the top bar
// stands apart from the page, every app page but the PRD page uses the full width, prose keeps a
// 900 px column, a form field is never wider than 900 px, and `.ask-main` pads its sides with the
// page gutter, `--ask-gutter`.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const sheet = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

const ASK = sheet('./ask/ask.css');
const APP_BAR = sheet('./nav/app-bar.css');
const DASH = sheet('./dashboard/dashboard.css');
const KNOWLEDGE = sheet('./knowledge/knowledge.css');
const DOCS = sheet('./docs/docs.css');

/** The body of every `@media <query> { … }` block in `css`, joined. */
function media(css: string, query: string): string {
  const bodies: string[] = [];
  let from = 0;
  for (;;) {
    const at = css.indexOf(`@media ${query}`, from);
    if (at < 0) return bodies.join('\n');
    const open = css.indexOf('{', at);
    let depth = 1;
    let i = open + 1;
    for (; depth > 0 && i < css.length; i += 1) {
      if (css[i] === '{') depth += 1;
      if (css[i] === '}') depth -= 1;
    }
    bodies.push(css.slice(open + 1, i - 1));
    from = i;
  }
}

/** `css` with every `@media … { … }` block taken out: the rules that hold at every width. */
function outsideMedia(css: string): string {
  let out = css;
  for (;;) {
    const at = out.indexOf('@media');
    if (at < 0) return out;
    const open = out.indexOf('{', at);
    let depth = 1;
    let i = open + 1;
    for (; depth > 0 && i < out.length; i += 1) {
      if (out[i] === '{') depth += 1;
      if (out[i] === '}') depth -= 1;
    }
    out = out.slice(0, at) + out.slice(i);
  }
}

/** A selector list split on its top-level commas: `:is(a, b)` stays one selector. */
function selectorList(prelude: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  [...prelude].forEach((c, i) => {
    if (c === '(') depth += 1;
    if (c === ')') depth -= 1;
    if (c === ',' && depth === 0) { out.push(prelude.slice(start, i)); start = i + 1; }
  });
  out.push(prelude.slice(start));
  return out.map((s) => s.trim().replace(/\s+/g, ' '));
}

/** Every declaration, as `property: value`, of the rules whose selector list names `selector`. */
function declarations(css: string, selector: string): string[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter(([, prelude]) => selectorList(prelude.split(';').pop() ?? '').includes(selector))
    .flatMap(([, , body]) => body.split(';').map((d) => d.trim().replace(/\s+/g, ' ')).filter(Boolean));
}

const has = (css: string, selector: string, property: string) =>
  declarations(css, selector).filter((d) => d.startsWith(`${property}:`)).map((d) => d.slice(property.length + 1).trim());

describe('the top bar (T1)', () => {
  it('has the surface as its background and a 2 px strong rule below it', () => {
    expect(has(APP_BAR, '.app-bar', 'background')).toEqual(['var(--ask-surface)']);
    expect(has(APP_BAR, '.app-bar', 'border-bottom')).toEqual(['2px solid var(--ask-line-strong)']);
  });

  it('still wraps below 900 px, as before', () => {
    const narrow = media(APP_BAR, '(max-width: 899.98px)');
    expect(has(narrow, '.app-bar', 'display')).toEqual(['grid']);
    expect(has(APP_BAR, '.app-bar', 'flex-wrap')).toEqual(['wrap']);
  });
});

describe('every app page but the PRD page', () => {
  const containers: [string, string][] = [
    ['.dash', DASH],
    ['.ask-page', ASK],
    ['.ask-col', ASK],
    ['.km-main', KNOWLEDGE],
    ['.km', KNOWLEDGE],
    ['.docs', DOCS],
  ];

  it.each(containers)('%s declares no max-width, is full width and is not centred', (selector, css) => {
    expect(declarations(css, selector).length).toBeGreaterThan(0);
    expect(has(css, selector, 'max-width')).toEqual([]);
    expect(has(css, selector, 'width')).toEqual(['100%']);
    expect(has(css, selector, 'justify-self')).toEqual(['start']);
    expect(has(css, selector, 'margin').concat(has(css, selector, 'margin-inline'))
      .filter((m) => m.includes('auto'))).toEqual([]);
  });

  it('keeps a docs article at 900 px, as the spec and the plan', () => {
    expect(has(DOCS, '.docs-article', 'max-width')).toEqual(['900px']);
  });

  it('never lets a form field in the page grow past 900 px', () => {
    expect(has(ASK, '.ask-main :is(input, select, textarea)', 'max-width')).toEqual(['900px']);
  });
});

describe('the page gutter', () => {
  it('is 16 px, and 24 px from 900 px wide', () => {
    expect(has(outsideMedia(ASK), '.ask', '--ask-gutter')).toEqual(['16px']);
    expect(has(media(ASK, '(min-width: 900px)'), '.ask', '--ask-gutter')).toEqual(['24px']);
  });

  it('pads the sides of .ask-main', () => {
    expect(has(ASK, '.ask-main', 'padding')).toEqual(['28px var(--ask-gutter) 72px']);
  });
});
