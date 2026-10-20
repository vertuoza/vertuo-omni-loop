// An archived product (PRD 2232 s3), seen from the terminal: `omni kb legal`, `omni kb glossary` and
// `omni business show` print one line and exit 1, and never fall back to the local copy. They sit in
// a file of their own: kb.test.ts and business.test.ts prove the commands for a live product.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const HOST = 'omni.test';
const NOW = new Date('2026-10-20T08:00:00Z');
const LOCAL = '.omni-loop/local/product-knowledge.json';
const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: https://omni.test\n';
const LINE = 'product Omni Loop is archived: an owner restores it on its page\n';
const ARCHIVED = { state: 'archived', business: { name: 'Acme' }, product: { name: 'Omni Loop' }, claims: [], personas: [], legal: [], glossary: [] };
const LIVE = {
  ...ARCHIVED, state: 'ok',
  claims: [{ id: 'region#1', kind: 'region', value: 'Belgium', source: 'pick', state: 'confirmed', receipt: null, lastSeen: null }],
  legal: [{ id: 'L-OMNI-1', statement: 'Kept ten years.', source: 'law', owner: 'jane' }],
};
const signedIn = { read: (host: string) => (host === HOST ? { access_token: 'a', refresh_token: 'r' } : null), write: () => {} };

async function run(root: string, argv: string[], body: unknown) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, {
    cwd: root, env: {}, tokens: signedIn, now: () => NOW,
    fetch: () => Promise.resolve(new Response(JSON.stringify(body), { status: 200 })),
    stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) },
  });
  return { code, out: out.join(''), err: err.join('') };
}
const repo = () => makeRepo({ git: true, files: { '.omni-loop/config.yml': CONFIG } });

describe('an archived product, in the terminal', () => {
  it.each([['kb', 'legal'], ['kb', 'glossary'], ['business', 'show']])('omni %s %s prints the archived line and exits 1', async (...argv) => {
    expect(await run(repo().root, argv, ARCHIVED)).toEqual({ code: 1, out: LINE, err: '' });
  });

  it('omni business show --json prints the archived body, with no claim, and exits 1', async () => {
    const { code, out } = await run(repo().root, ['business', 'show', '--json'], ARCHIVED);
    expect(code).toBe(1);
    expect(JSON.parse(out)).toMatchObject({ state: 'archived', product: { name: 'Omni Loop' }, claims: [] });
  });

  it('never serves, nor rewrites, the local copy kept while the product was live', async () => {
    const { root } = repo();
    expect((await run(root, ['kb', 'legal'], LIVE)).code).toBe(0);
    const kept = readFileSync(`${root}/${LOCAL}`, 'utf8');
    expect(await run(root, ['kb', 'legal'], ARCHIVED)).toEqual({ code: 1, out: LINE, err: '' });
    expect(readFileSync(`${root}/${LOCAL}`, 'utf8')).toBe(kept);
  });
});
