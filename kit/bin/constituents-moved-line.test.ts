// Bug #2811, the line it prints instead: when the copy saved for this repository is another product's
// than the one a newer knowledge read names, the briefing says so in one line and prints no constituent.
// A knowledge read older than the copy, or naming the same product, leaves the copy printed as before.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Tokens } from '../lib/ask/schema.ts';
import { PRODUCT_KNOWLEDGE_FILE } from '../lib/product/knowledge.ts';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const HOST = 'omni.example';
const T0 = Date.parse('2026-10-01T09:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const READ = {
  state: 'ok',
  product: { name: 'Acme Ops' },
  statement: { id: 'statement', text: 'Acme Ops runs the field teams.' },
  never: [{ id: 'never#1', text: 'Never schedules a team twice.' }],
  latestEventId: '7',
};

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const offline: Fetch = () => Promise.reject(new TypeError('fetch failed'));

async function constituents(root: string, fetch: Fetch, now: number, args: string[] = []) {
  const out: string[] = [];
  const store: Record<string, Tokens> = { [HOST]: { access_token: 'access-1', refresh_token: 'refresh-1' } };
  const tokens = { read: (host: string) => store[host] ?? null, write: (host: string, entry: Tokens) => { store[host] = entry; } };
  await main(['constituents', ...args], { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: () => {} }, tokens, env: {}, fetch, now: () => now });
  return out.join('');
}

/** A checkout whose copy of Acme Ops' constituents was saved at T0, and whose knowledge read named `product` at `readAt`. */
async function movedCheckout(product: string, readAt: number): Promise<string> {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/insight-domain\nask:\n  url: https://${HOST}\n` } });
  await constituents(root, () => Promise.resolve(Response.json(READ)), T0);
  mkdirSync(join(root, '.omni-loop', 'local'), { recursive: true });
  writeFileSync(join(root, PRODUCT_KNOWLEDGE_FILE), JSON.stringify({ product, readAt: new Date(readAt).toISOString(), legal: [], glossary: [] }));
  return root;
}

describe('the copy of a product the repository has left (#2811)', () => {
  it('says whose copy it is and which product the repository is in now, in one line', async () => {
    const root = await movedCheckout('Acme Insight', T0 + DAY);
    expect(await constituents(root, offline, T0 + 2 * DAY)).toBe(
      'no constituents: offline; the copy saved here is Acme Ops\'s, and this repository is now in Acme Insight — agents carry on\n',
    );
  });

  it('prints no product under --json', async () => {
    const root = await movedCheckout('Acme Insight', T0 + DAY);
    expect(JSON.parse(await constituents(root, offline, T0 + 2 * DAY, ['--json']))).toEqual({
      state: 'unreachable', product: null, statement: null, never: [], syncedAt: null,
    });
  });

  it('still prints the copy when the knowledge read names the same product', async () => {
    const root = await movedCheckout('Acme Ops', T0 + DAY);
    expect(await constituents(root, offline, T0 + 2 * DAY)).toContain('Constituents of Acme Ops (synced 2 d ago, offline)');
  });

  it('still prints the copy when the knowledge read is older than it', async () => {
    const root = await movedCheckout('Acme Insight', T0 - DAY);
    expect(await constituents(root, offline, T0 + 2 * DAY)).toContain('Constituents of Acme Ops (synced 2 d ago, offline)');
  });
});
