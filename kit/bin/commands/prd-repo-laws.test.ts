// The terminal reads a repository PRD's business laws verdict (bug #2793), as it reads a product PRD's (bug
// #2696, ./prd-product-laws.test.ts), through `main()` on a fixture repository against a stubbed fetch:
// `omni prd <n>` prints it for a ◆ PRD after its approval lines, and `omni dossier push <n>` prints it after
// its two lines, once the spec is judged. A reply with no `laws` prints nothing. Every law and spec is fictional.
import { describe, expect, it } from 'vitest';
import type { Tokens } from '../../lib/ask/schema.ts';
import { makeRepo } from '../../test/fixture.ts';
import { main } from '../omni.ts';

const BASE = 'https://omni.example';
const LINK = `${BASE}/prd/d-7`;
const CONFIG = `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${BASE}\ndossier:\n  enabled: true\n`;
const IN = '.omni-loop/delivery/inbox/0007-offline-upload';
const SPEC = '---\nprd: 7\ntitle: Offline photo upload\nblocked-by: none\nspec: file\nphase0: server\n---\n\n# Offline photo upload\n';
const PUSHED = { id: 'd-7', url: LINK, added: [{ kind: 'spec', version: 3 }], unchanged: [] };
const RED = {
  state: 'red', reason: '1 law broken', judgedAt: '2026-12-01T09:00:00Z',
  findings: [{ law: 'BL-QUOTES-1', statement: 'A quote has a total above zero.', quote: 'a template can be sent\nwith a zero total', broken: 'The design sends a quote whose total is zero.' }],
};
const RED_LINES = [
  'laws: red · 1 law broken',
  '  BL-QUOTES-1 · "a template can be sent with a zero total"',
  '    why: The design sends a quote whose total is zero.',
];

const json = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });
const tokens = () => {
  const store: Record<string, Tokens> = { 'omni.example': { access_token: 'access-1', refresh_token: 'refresh-1' } };
  return { read: (host: string) => store[host] ?? null, write: (host: string, kept: Tokens) => { store[host] = kept; } };
};

/** Runs `omni <args>` on a ◆ PRD 7 against a page whose approval route answers each of `laws` in turn, the last for good. */
async function omni(args: string[], laws: unknown[]) {
  const repo = makeRepo({ git: true, files: { '.omni-loop/config.yml': CONFIG, [`${IN}/spec.md`]: SPEC } });
  const urls: string[] = [];
  const paused: number[] = [];
  const left = [...laws];
  const fetch = (url: string) => {
    urls.push(url.replace(BASE, ''));
    if (url.includes('/api/dossiers/push')) return Promise.resolve(json(200, PUSHED));
    if (!url.includes('/api/dossiers/approval')) return Promise.resolve(json(200, { id: 'd-7', url: LINK, product: null }));
    const next = left.length > 1 ? left.shift() : left[0];
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(json(200, { url: LINK, approval: null, ...(next === undefined ? {} : { laws: next }) }));
  };
  const out: string[] = [];
  const err: string[] = [];
  const options = {
    cwd: repo.root, tokens: tokens(), env: {}, fetch, now: () => Date.parse('2026-12-01T12:00:00Z'),
    pause: (ms: number) => { paused.push(ms); return Promise.resolve(); },
    stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) },
  };
  const code = await main(args, options);
  return { code, out: out.join(''), err: err.join(''), urls, paused };
}

describe('omni prd <n>: a ◆ repository PRD\'s business laws verdict', () => {
  it('prints a red after the approval lines, each law with the spec\'s words and the judge\'s why', async () => {
    const run = await omni(['prd', '7'], [RED]);
    expect(run.code).toBe(0);
    expect(run.out).toContain([`approval: PRD 7 waits for approval: ${LINK}`, ...RED_LINES, `dir: ${IN}`].join('\n'));
  });

  it('prints a green and one not judged yet; nothing when the reply carries no laws', async () => {
    expect((await omni(['prd', '7'], [{ state: 'green', reason: '12 judged', findings: [] }])).out).toContain('\nlaws: green · 12 judged\ndir:');
    expect((await omni(['prd', '7'], [{ state: 'pending' }])).out).toContain('\nlaws: not judged yet\ndir:');
    expect((await omni(['prd', '7'], [undefined])).out).not.toContain('laws:');
  });
});

describe('omni dossier push <n>: the verdict, once the spec is judged', () => {
  it('prints the verdict after its two lines, waiting while the spec is not judged yet', async () => {
    const run = await omni(['dossier', 'push', '7'], [{ state: 'pending' }, RED]);
    expect(run).toMatchObject({ code: 0, err: '' });
    expect(run.out).toBe([LINK, 'added: spec v3', ...RED_LINES, ''].join('\n'));
    expect(run.urls).toEqual(['/api/dossiers/push', '/api/dossiers/approval?repo=acme%2Fwidgets&prd=7', '/api/dossiers/approval?repo=acme%2Fwidgets&prd=7']);
    expect(run.paused).toEqual([3000]);
  });

  it('stops waiting after a minute, and says how to read it later', async () => {
    const run = await omni(['dossier', 'push', '7'], [{ state: 'pending' }]);
    expect(run.out).toBe([LINK, 'added: spec v3', 'laws: not judged yet · read it with omni prd 7', ''].join('\n'));
    expect(run.paused).toHaveLength(20);
  });

  it('prints nothing more where nothing is judged or the verdict cannot be read: the push still succeeded', async () => {
    const two = [LINK, 'added: spec v3', ''].join('\n');
    expect(await omni(['dossier', 'push', '7'], [undefined])).toMatchObject({ code: 0, out: two, paused: [] });
    expect(await omni(['dossier', 'push', '7'], [new TypeError('fetch failed')])).toMatchObject({ code: 0, out: two });
  });
});
