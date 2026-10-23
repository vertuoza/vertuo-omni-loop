import { createElement } from 'react';
import { prerender } from 'react-dom/static';
import { describe, expect, it } from 'vitest';
import { createTimings, parseServerTiming, serverTiming, timingsInPage } from './timing';
import { ServerTimingMark } from './timing-mark';

// PRD 2401 s1: each read of /prd and /prd/<id> is timed under its name, and the page says them in one
// `server-timing` template at its end, which scripts/perf-prd.ts reads back.

const clock = (...ticks: number[]) => () => ticks.shift() ?? 0;

async function markup(element: ReturnType<typeof createElement>): Promise<string> {
  const { prelude } = await prerender(element);
  return new Response(prelude).text();
}

describe('timing the reads of a request', () => {
  it('records each read under its name, in the order they settled, and gives the read\'s value back', async () => {
    const timings = createTimings(clock(0, 10, 15, 40));
    expect(await timings.time('viewer', Promise.resolve('me'))).toBe('me');
    expect(await timings.time('dossier_list', () => Promise.resolve([]))).toEqual([]);
    expect(timings.entries()).toEqual([{ name: 'viewer', ms: 10 }, { name: 'dossier_list', ms: 25 }]);
  });

  it('records a read that fails, and fails with it', async () => {
    const timings = createTimings(clock(0, 7));
    await expect(timings.time('counts', Promise.reject(new Error('down')))).rejects.toThrow('down');
    expect(timings.entries()).toEqual([{ name: 'counts', ms: 7 }]);
  });
});

describe('the Server-Timing value', () => {
  it('names each read with its duration, to a tenth of a millisecond', () => {
    expect(serverTiming([{ name: 'viewer', ms: 3.24 }, { name: 'dossier_list', ms: 41.76 }])).toBe('viewer;dur=3.2, dossier_list;dur=41.8');
  });

  it('keeps a name to token characters', () => {
    expect(serverTiming([{ name: 'login ids;"x"', ms: 1 }])).toBe('login_ids__x_;dur=1');
  });

  it('reads back what it wrote', () => {
    const entries = [{ name: 'viewer', ms: 3.2 }, { name: 'scope', ms: 12 }];
    expect(parseServerTiming(serverTiming(entries))).toEqual(entries);
    expect(parseServerTiming('')).toEqual([]);
    expect(parseServerTiming('cache;desc="hit"')).toEqual([]);
  });
});

describe('the page\'s say of its timings', () => {
  it('puts each named read in a template at the end of the page, once the reads it waits for are over', async () => {
    const timings = createTimings(clock(0, 4, 4, 30));
    await timings.time('viewer', Promise.resolve(1));
    await timings.time('dossier_list', Promise.resolve(2));
    const html = await markup(createElement(ServerTimingMark, { timings, settle: [Promise.resolve(), Promise.reject(new Error('late'))] }));
    expect(timingsInPage(html)).toEqual([{ name: 'viewer', ms: 4 }, { name: 'dossier_list', ms: 26 }]);
  });

  it('finds none in a page without it', () => {
    expect(timingsInPage('<p>no timings</p>')).toEqual([]);
  });
});
