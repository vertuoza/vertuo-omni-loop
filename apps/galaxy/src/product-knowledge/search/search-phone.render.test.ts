import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { demoEval } from './eval/eval-demo';
import { EvalView } from './eval/EvalView';
import { demoSearches } from './search-demo';
import type { SearchRow } from './search-stats';
import { SearchView } from './SearchView';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));
vi.mock('./eval/eval-actions', () => ({ addEvalQuestion: () => undefined, removeEvalQuestion: () => undefined, setEvalAnswer: () => undefined }));

// The Search section at phone width (bug 2838). A section card (`ask-card`) is a grid, and a grid item is never
// narrower than its content unless its rule sets `min-width: 0`. A wide table scrolls inside its `kn-scroll` box only
// when every element between that box and the card may shrink: the box itself is a scroll container, so it may, but
// a plain wrapper (the overview's question regions, the Eval view's misses) took the table's full width, and at
// 390 px the overview grew to 681 px and the Eval view to 665 px.

const sheet = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
// The stylesheets the Search pages load (their routes import products.css, product-home.css, knowledge.css,
// search.css, categories.css and eval.css; ask.css is the layout's).
const CSS = [
  './search.css', './categories/categories.css', './eval/eval.css', '../knowledge.css',
  '../../products/products.css', '../../product-home/product-home.css', '../../ask/ask.css',
].map(sheet).join('\n');

/** The lone selectors (one class, or one attribute) whose rule sets `min-width: 0`. */
const shrinking = [...CSS.matchAll(/([^{}]+)\{([^}]*)\}/g)]
  .filter(([, , body]) => /(^|[;\s])min-width:\s*0(px)?\s*(;|$)/.test(body ?? ''))
  .flatMap(([, selectors]) => (selectors ?? '').split(',').map((s) => s.trim()))
  .filter((s) => /^(\.[\w-]+|\[[\w-]+(=['"]?[\w-]+['"]?)?\])$/.test(s));

type Tag = { attrs: string; classes: string[] };

/** Whether one of the `shrinking` selectors matches this tag. */
const shrinks = ({ attrs, classes }: Tag) => shrinking.some((s) => {
  if (s.startsWith('.')) return classes.includes(s.slice(1));
  const [, name, value] = /^\[([\w-]+)(?:=['"]?([\w-]+)['"]?)?\]$/.exec(s) ?? [];
  return value === undefined ? new RegExp(`\\s${name}="`).test(attrs) : attrs.includes(` ${name}="${value}"`);
});

/** The elements open around the tag that starts at `at`, outermost first. */
const around = (html: string, at: number): Tag[] => {
  const open: Tag[] = [];
  for (const m of html.slice(0, at).matchAll(/<(\/?)([a-z][\w-]*)([^>]*?)(\/?)>/g)) {
    const [, closing, tag, attrs = '', self] = m;
    if (self || ['input', 'br', 'img', 'meta', 'link', 'hr', 'col', 'wbr'].includes(tag ?? '')) continue;
    if (closing) open.pop();
    else open.push({ attrs, classes: (/class="([^"]*)"/.exec(attrs)?.[1] ?? '').split(/\s+/).filter(Boolean) });
  }
  return open;
};

/** For each `kn-scroll` box, whether every element between it and its card may shrink to the window. */
const boxesFit = (html: string): boolean[] =>
  [...html.matchAll(/<div class="kn-scroll"/g)].map((m) => {
    const chain = around(html, m.index);
    const card = chain.findLastIndex((t) => t.classes.includes('ask-card'));
    return card >= 0 && chain.slice(card + 1).every(shrinks);
  });

const NOW = Date.parse('2026-11-13T12:00:00Z');

describe('the Search section at phone width (bug 2838)', () => {
  it('keeps the overview\'s question tables scrolling inside their own box', () => {
    const rows = demoSearches('demo-product-1', NOW) as SearchRow[];
    const html = renderToStaticMarkup(createElement(SearchView, { product: 'p', rows, days: 30, now: NOW }));
    const fit = boxesFit(html);
    expect(fit.length).toBe(2);
    expect(fit).toEqual(fit.map(() => true));
  });

  it('keeps the Eval view\'s misses table scrolling inside its own box', () => {
    const demo = demoEval('demo-product-1', NOW);
    if (demo === null) throw new Error('the demo product has an eval set');
    const html = renderToStaticMarkup(createElement(EvalView, { product: 'p', ...demo, query: {}, domains: [{ key: 'invoicing', name: 'Invoicing' }] }));
    const fit = boxesFit(html);
    expect(fit.length).toBeGreaterThan(0);
    expect(fit).toEqual(fit.map(() => true));
  });
});
