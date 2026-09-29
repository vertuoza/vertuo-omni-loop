import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { prerender } from 'react-dom/static';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { STREAM_FAILED, Streamed } from './Streamed';

// A block that streams in on its own (PRD 657 s4): its skeleton while its read is pending, the block
// once it resolves, and its own "could not load" when the read fails, the blocks beside it untouched.
// The first pass renders what the server sends at once; prerender waits for every block.

/** A read that stays pending until `resolve` or `reject` is called. */
function pending<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const read = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { read, resolve, reject };
}

const block = (read: Promise<string>, name: string) => h(Streamed<string>, {
  read, skeleton: h('i', { 'data-skeleton': name }), children: (value: string) => h('b', { 'data-block': name }, value),
});

const settled = async (element: ReturnType<typeof h>) => {
  const { prelude } = await prerender(element);
  return new Response(prelude).text();
};

afterEach(() => { vi.restoreAllMocks(); });

describe('a streamed block', () => {
  it('sends its skeleton while its read is pending', () => {
    const html = renderToStaticMarkup(h('div', null, block(pending<string>().read, 'tiles')));
    expect(html).toContain('data-skeleton="tiles"');
    expect(html).not.toContain('data-block');
  });

  it('draws the block once its read resolves', async () => {
    const tiles = pending<string>();
    const html = settled(h('div', null, block(tiles.read, 'tiles')));
    tiles.resolve('12 PRs');
    const out = await html;
    expect(out).toContain('<b data-block="tiles">12 PRs</b>');
    expect(out).not.toContain('data-skeleton');
  });

  it('a slow block holds up only itself: its sibling is drawn at once', () => {
    const html = renderToStaticMarkup(h('div', null, block(Promise.resolve('fast'), 'fast'), block(pending<string>().read, 'slow')));
    expect(html).toContain('data-skeleton="slow"');
  });

  it('a read that fails shows its own "could not load", and its sibling still renders', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = await settled(h('div', null, block(Promise.reject(new Error('down')), 'broken'), block(Promise.resolve('fine'), 'fine')));
    expect(out).toContain(STREAM_FAILED);
    expect(out).toContain('<b data-block="fine">fine</b>');
    expect(error).toHaveBeenCalled();
  });

  it('a read that fails can say so in its own words', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = await settled(h(Streamed<string>, {
      read: Promise.reject(new Error('down')), skeleton: null, failed: h('p', null, 'No list'), children: (v: string) => v,
    }));
    expect(out).toContain('<p>No list</p>');
  });
});
