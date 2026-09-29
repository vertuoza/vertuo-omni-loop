import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { prerender } from 'react-dom/static';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Each part's view, as Home places it: a marker of its own, carrying what it was given, so these
// tests hold whatever the parts become (counts/ and board/ test their own views).
vi.mock('../counts/WaitingTile', () => ({ WaitingTile: ({ part }: { part: unknown }) => createElement('p', { 'data-part': 'waiting' }, `waiting ${JSON.stringify(part)}`) }));
vi.mock('../board/Board', () => ({
  Board: ({ board, peopleTitle, peopleNote }: Record<string, unknown>) => createElement('div', { 'data-part': 'board' }, `board ${JSON.stringify({ board, peopleTitle })}`, peopleNote as never),
}));
vi.mock('../YouBlock', () => ({ You: ({ name }: { name: string }) => createElement('h1', { 'data-part': 'you' }, name) }));

import { STREAM_FAILED } from '../../skeleton/Streamed';
import { seasonBounds } from '../season';
import type { HomeParts } from './home';
import { HomeStream } from './HomeStream';

// Home streamed (PRD 657 s4): the column is sent at once with a skeleton in each part's place, then
// each part as its read arrives; a part whose read fails says so alone.

const season = seasonBounds(new Date('2026-09-28T10:00:00Z'));
const never = <T,>() => new Promise<T>(() => {});

const parts = (over: Partial<HomeParts> = {}): HomeParts => ({
  season,
  you: Promise.resolve({ name: 'ADA', you: 'unreadable' }),
  waiting: Promise.resolve({ count: 2, href: '/ask' }),
  board: Promise.resolve({ board: 'B' as never, solo: false }),
  ...over,
});
const element = (p: HomeParts) => createElement(HomeStream, { parts: p, query: {} });
const settled = async (p: HomeParts) => new Response((await prerender(element(p))).prelude).text();

/** What the server has sent once the reads that resolve have: a pending block keeps its skeleton. */
async function sentBy(p: HomeParts) {
  const stop = new AbortController();
  setTimeout(() => stop.abort(), 20);
  return new Response((await prerender(element(p), { signal: stop.signal })).prelude).text();
}

afterEach(() => { vi.restoreAllMocks(); });

describe('Home, streamed', () => {
  it('sends a skeleton in each part\'s place while its read is pending', () => {
    const html = renderToStaticMarkup(element(parts({ you: never(), waiting: never(), board: never() })));
    expect(html).toMatch(/^<div class="dash">/);
    expect(html).toContain('Loading your hero…');
    expect(html).toContain('Loading Waiting for you…');
    expect(html).toContain('Loading the board…');
    expect(html).not.toContain('data-part');
  });

  it('draws each part in Home\'s order once its read arrives', async () => {
    const html = await settled(parts());
    const order = [...html.matchAll(/data-part="(\w+)"/g)].map((m) => m[1]);
    expect(order).toEqual(['you', 'waiting', 'board']);
    expect(html).toContain('Your team');
    expect(html).not.toContain('aria-busy');
  });

  it('a slow board holds up only itself', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const html = await sentBy(parts({ board: never() }));
    expect(html).toContain('Loading the board…');
    expect(html).toContain('data-part="you"');
    expect(html).toContain('data-part="waiting"');
  });

  it('with no team, the board carries the line to Fleet', async () => {
    const html = await settled(parts({ board: Promise.resolve({ board: 'B' as never, solo: true }) }));
    expect(html).toContain('href="/app/fleet"');
  });

  it('a part whose read fails says it could not load, and the others render', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const html = await settled(parts({ board: Promise.reject(new Error('down')) }));
    expect(html).toContain(STREAM_FAILED);
    expect(html).toContain('data-part="you"');
    expect(html).toContain('data-part="waiting"');
  });
});
