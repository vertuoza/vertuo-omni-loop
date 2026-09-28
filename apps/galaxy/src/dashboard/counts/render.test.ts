import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { seasonBounds } from '../season';
import { Counts } from './Counts';
import { ASK, FOR_ME } from './counts';
import type { CountsValue } from './load';

// The four counts as the server renders them (PRD 328), to static markup: four tiles, each a label
// and a number, in the spec's order; Waiting for you links where waitingCount says. A tile that could
// not be read says so alone, and one that counts by a GitHub login not linked yet says to link it.

const season = seasonBounds(new Date('2026-09-26T10:00:00Z'));
const VALUE: CountsValue = { answered: 14, settled: 3, prds: 2, waiting: { count: 1, href: ASK } };
const LABELS = ['Questions answered', 'Outbox settled', 'PRDs created', 'Waiting for you'];
const UNREADABLE_LINE = 'Couldn’t load this. Reload in a moment.';
const LINK_GITHUB = 'Link your GitHub in the arcade';

const render = (part: CountsValue | 'unreadable') => renderToStaticMarkup(createElement(Counts, { part, season }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
/** Each tile's text, in order. */
const tiles = (html: string) => [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
const links = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [m[1], text(m[2])]);

describe('the four counts', () => {
  it('are four tiles, in the spec\'s order, each its label and its number', () => {
    expect(tiles(render(VALUE))).toEqual([
      'Questions answered 14 this season',
      'Outbox settled 3 this season',
      'PRDs created 2 this season',
      'Waiting for you 1 right now',
    ]);
  });

  it('Waiting for you links to /ask, and only it links', () => {
    expect(links(render(VALUE))).toEqual([[ASK, 'Waiting for you 1 right now']]);
  });

  it('Waiting for you links to /ask/for-me when waitingCount says so', () => {
    expect(links(render({ ...VALUE, waiting: { count: 2, href: FOR_ME } }))).toEqual([[FOR_ME, 'Waiting for you 2 right now']]);
  });

  it('shows 0 as 0, and never hides a tile for being empty', () => {
    expect(tiles(render({ answered: 0, settled: 0, prds: 0, waiting: { count: 0, href: ASK } }))).toEqual([
      'Questions answered 0 this season', 'Outbox settled 0 this season', 'PRDs created 0 this season', 'Waiting for you 0 right now',
    ]);
  });

  it('writes a large number as the page writes numbers', () => {
    expect(tiles(render({ ...VALUE, answered: 1240 }))[0]).toBe('Questions answered 1,240 this season');
  });

  it('is drawn on the server: no script, no heading of its own (the name is the page\'s one h1)', () => {
    const html = render(VALUE);
    expect(html).not.toMatch(/<script|<h\d/);
    expect(html).toMatch(/^<section class="dash-counts" aria-label="Your counts">/);
  });
});

describe('a tile that cannot count', () => {
  it('with no GitHub linked: Outbox settled and PRDs created say to link it in the arcade; the other two still count', () => {
    const html = render({ ...VALUE, settled: 'no-github', prds: 'no-github' });
    expect(tiles(html)).toEqual([
      'Questions answered 14 this season', `Outbox settled ${LINK_GITHUB}`, `PRDs created ${LINK_GITHUB}`, 'Waiting for you 1 right now',
    ]);
    expect(links(html)).toEqual([['/play', LINK_GITHUB], ['/play', LINK_GITHUB], [ASK, 'Waiting for you 1 right now']]);
  });

  it.each([
    ['answered', 0], ['settled', 1], ['prds', 2],
  ] as const)('%s out of reach: only its tile says so, its label kept', (key, at) => {
    const shown = tiles(render({ ...VALUE, [key]: 'unreadable' }));
    expect(shown[at]).toBe(`${LABELS[at]} ${UNREADABLE_LINE}`);
    expect(shown.filter((t) => t.includes(UNREADABLE_LINE))).toHaveLength(1);
    expect(shown.filter((_t, i) => i !== at).every((t) => /\d/.test(t))).toBe(true);
  });

  it('Waiting for you out of reach: it says so, and links nowhere', () => {
    const html = render({ ...VALUE, waiting: 'unreadable' });
    expect(tiles(html)[3]).toBe(`Waiting for you ${UNREADABLE_LINE}`);
    expect(links(html)).toEqual([]);
    expect(tiles(html).slice(0, 3)).toEqual(['Questions answered 14 this season', 'Outbox settled 3 this season', 'PRDs created 2 this season']);
  });

  it('the whole part out of reach: every tile says so, under its label', () => {
    expect(tiles(render('unreadable'))).toEqual(LABELS.map((label) => `${label} ${UNREADABLE_LINE}`));
  });
});

describe('the stylesheet', () => {
  const css = readFileSync(new URL('./counts.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

  it('sets the tiles two by two on a phone, and in one row from 720 px, never wider than the page', () => {
    expect(css).toMatch(/\.dash-tiles \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
    expect(css).toMatch(/@media \(min-width: 720px\) \{\s*\.dash-tiles \{ grid-template-columns: repeat\(4, minmax\(0, 1fr\)\); \}/);
    expect(css).toMatch(/\.dash-tile-body \{[^}]*overflow-wrap: anywhere;/);
  });
});
