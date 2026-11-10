// The terminal reads a product PRD's business laws verdict (bug #2696), through `main()` on a fixture
// repository against a stubbed fetch: `omni prd <key>-<n>` prints the verdict's state and, for a red, each
// law, the spec's words and the judge's why; `--json` gives the same as one object; `omni dossier push
// <key>-<n>` prints it after its three lines, once the spec is judged. Every law and spec is fictional.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Tokens } from '../../lib/ask/schema.ts';
import { makeRepo } from '../../test/fixture.ts';
import { main } from '../omni.ts';

const BASE = 'https://omni.example';
const LINK = `${BASE}/prd/d-12`;
const CONFIG = `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${BASE}\ndossier:\n  enabled: true\n`;
const FOUND = { id: 'd-12', url: LINK, prdId: 'mobile-12', title: 'Offline photo upload', product: 'Mobile' };
const PUSHED = { ...FOUND, added: [{ kind: 'spec', version: 3 }], unchanged: [] };
const RED = {
  state: 'red', reason: '2 laws broken', judgedAt: '2026-12-01T09:00:00Z',
  findings: [
    { law: 'BL-QUOTES-1', statement: 'A quote has a total above zero.', quote: 'a template can be sent\nwith a zero total', broken: 'The design sends a quote whose total is zero.' },
    { law: 'BL-STOCK-1', statement: 'Stock never goes below zero.', quote: 'sold twice' },
  ],
};
const RED_LINES = [
  'laws: red · 2 laws broken',
  '  BL-QUOTES-1 · "a template can be sent with a zero total"',
  '    why: The design sends a quote whose total is zero.',
  '  BL-STOCK-1 · "sold twice"',
  '    why: not kept',
];

const json = (status: number, body: unknown = {}) => new Response(JSON.stringify(body), { status });
const tokens = () => {
  const store: Record<string, Tokens> = { 'omni.example': { access_token: 'access-1', refresh_token: 'refresh-1' } };
  return { read: (host: string) => store[host] ?? null, write: (host: string, kept: Tokens) => { store[host] = kept; } };
};

/** Runs `omni <args>` against a page whose approval route answers each of `laws` in turn, the last one for good. */
async function omni(args: string[], laws: unknown[]) {
  const repo = makeRepo({ git: true, files: { '.omni-loop/config.yml': CONFIG } });
  const urls: string[] = [];
  const paused: number[] = [];
  const left = [...laws];
  const fetch = (url: string) => {
    urls.push(url.replace(BASE, ''));
    if (url.includes('/api/dossiers/push')) return Promise.resolve(json(200, PUSHED));
    if (!url.includes('/api/dossiers/approval')) return Promise.resolve(json(200, FOUND));
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

const specFolder = () => {
  const from = mkdtempSync(join(tmpdir(), 'prd-laws-test-'));
  writeFileSync(join(from, 'spec.md'), '---\ntitle: Offline photo upload\n---\n\n# Offline photo upload\n');
  return from;
};

describe('omni prd <key>-<n>: the business laws verdict', () => {
  it('prints a red with each law, the spec\'s words on one line and the judge\'s why', async () => {
    const run = await omni(['prd', 'mobile-12'], [RED]);
    expect(run).toMatchObject({ code: 0, err: '' });
    expect(run.out).toBe([
      'PRD mobile-12 — Offline photo upload', 'state: prd', 'birthplace: server', `approval: PRD mobile-12 waits for approval: ${LINK}`,
      ...RED_LINES, `page: ${LINK}`, 'product: Mobile', '',
    ].join('\n'));
  });

  it('prints a green, a spec not judged with why, and one not judged yet; nothing where nothing is judged', async () => {
    expect((await omni(['prd', 'mobile-12'], [{ state: 'green', reason: '12 judged', findings: [] }])).out).toContain('\nlaws: green · 12 judged\npage:');
    expect((await omni(['prd', 'mobile-12'], [{ state: 'neutral', reason: 'no model key on this deployment', findings: [] }])).out).toContain('\nlaws: not judged · no model key on this deployment\npage:');
    expect((await omni(['prd', 'mobile-12'], [{ state: 'pending' }])).out).toContain('\nlaws: not judged yet\npage:');
    expect((await omni(['prd', 'mobile-12'], [undefined])).out).not.toContain('laws:');
    expect((await omni(['prd', 'mobile-12'], [{ state: 'purple' }])).out).not.toContain('laws:');
  });

  it('--json gives the PRD as one object, its verdict whole', async () => {
    const run = await omni(['prd', 'mobile-12', '--json'], [RED]);
    expect(run).toMatchObject({ code: 0, err: '' });
    expect(JSON.parse(run.out)).toEqual({
      id: 'mobile-12', title: 'Offline photo upload', state: 'prd', birthplace: 'server',
      approval: [`PRD mobile-12 waits for approval: ${LINK}`], page: LINK, product: 'Mobile', laws: RED,
    });
    expect(JSON.parse((await omni(['prd', 'mobile-12', '--json'], [undefined])).out)).toMatchObject({ laws: null });
  });

  it('refuses --json with --show, and for a PRD of the repository', async () => {
    expect((await omni(['prd', 'mobile-12', '--json', '--show', 'spec'], [RED])).code).toBe(2);
    expect((await omni(['prd', '7', '--json'], [RED])).code).toBe(2);
  });
});

describe('omni dossier push <key>-<n>: the verdict, once the spec is judged', () => {
  it('prints the verdict after its three lines, waiting while the spec is not judged yet', async () => {
    const run = await omni(['dossier', 'push', 'mobile-12', '--from', specFolder()], [{ state: 'pending' }, { state: 'pending' }, RED]);
    expect(run).toMatchObject({ code: 0, err: '' });
    expect(run.out).toBe(['mobile-12', LINK, 'added: spec v3', ...RED_LINES, ''].join('\n'));
    expect(run.urls).toEqual(['/api/dossiers/push', ...Array.from({ length: 3 }, () => '/api/dossiers/approval?prd=mobile-12&repo=acme%2Fwidgets')]);
    expect(run.paused).toEqual([3000, 3000]);
  });

  it('stops waiting after a minute, and says how to read it later', async () => {
    const run = await omni(['dossier', 'push', 'mobile-12', '--from', specFolder()], [{ state: 'pending' }]);
    expect(run.code).toBe(0);
    expect(run.out).toBe(['mobile-12', LINK, 'added: spec v3', 'laws: not judged yet · read it with omni prd mobile-12', ''].join('\n'));
    expect(run.paused).toHaveLength(20);
  });

  it('prints nothing more where nothing is judged or the verdict cannot be read: the push still succeeded', async () => {
    const three = ['mobile-12', LINK, 'added: spec v3', ''].join('\n');
    expect(await omni(['dossier', 'push', 'mobile-12', '--from', specFolder()], [undefined])).toMatchObject({ code: 0, out: three, paused: [] });
    expect(await omni(['dossier', 'push', 'mobile-12', '--from', specFolder()], [new TypeError('fetch failed')])).toMatchObject({ code: 0, out: three });
  });
});
