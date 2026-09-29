import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { WaitingTile } from './WaitingTile';
import { ASK, FOR_ME, type Waiting } from './counts';

// Waiting for you as the server renders it (PRD 328, kept on Home by PRD 572), to static markup: one
// tile, its label and its number, linking where waitingCount says; out of reach, it says so alone.

const UNREADABLE_LINE = 'Couldn’t load this. Reload in a moment.';

const render = (part: Waiting | 'unreadable') => renderToStaticMarkup(createElement(WaitingTile, { part }));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const tiles = (html: string) => [...html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/g)].map((m) => text(m[1]));
const links = (html: string) => [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => [m[1], text(m[2])]);

describe('Waiting for you', () => {
  it('is one tile, its label and its number, linking to /ask', () => {
    const html = render({ count: 1, href: ASK });
    expect(tiles(html)).toEqual(['Waiting for you 1 right now']);
    expect(links(html)).toEqual([[ASK, 'Waiting for you 1 right now']]);
  });

  it('links to /ask/for-me when waitingCount says so', () => {
    expect(links(render({ count: 2, href: FOR_ME }))).toEqual([[FOR_ME, 'Waiting for you 2 right now']]);
  });

  it('shows 0 as 0, and writes a large number as the page writes numbers', () => {
    expect(tiles(render({ count: 0, href: ASK }))).toEqual(['Waiting for you 0 right now']);
    expect(tiles(render({ count: 1240, href: ASK }))).toEqual(['Waiting for you 1,240 right now']);
  });

  it('out of reach: it says so under its label, and links nowhere', () => {
    const html = render('unreadable');
    expect(tiles(html)).toEqual([`Waiting for you ${UNREADABLE_LINE}`]);
    expect(links(html)).toEqual([]);
  });

  it('is drawn on the server: no script, no heading of its own (the name is the page\'s one h1)', () => {
    const html = render({ count: 1, href: ASK });
    expect(html).not.toMatch(/<script|<h\d/);
    expect(html).toMatch(/^<section class="dash-counts" aria-label="Waiting for you">/);
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
