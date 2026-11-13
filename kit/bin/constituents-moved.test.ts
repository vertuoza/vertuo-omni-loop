// Bug #2811: a repository that moved to another product is never briefed with the old product's
// constituents. The copy `omni constituents` falls back on when its read does not answer was saved for
// the repository alone; once a newer read of the repository's product knowledge names another product,
// that copy is no longer this repository's, and the briefing must not print it as if it were.
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

const OLD_PRODUCT = {
  state: 'ok',
  product: { name: 'Acme Ops' },
  statement: { id: 'statement', text: 'Acme Ops runs the field teams.' },
  never: [{ id: 'never#1', text: 'Never schedules a team twice.' }],
  latestEventId: '7',
};

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const answering = (body: unknown): Fetch => () => Promise.resolve(Response.json(body));
const offline: Fetch = () => Promise.reject(new TypeError('fetch failed'));

async function constituents(root: string, fetch: Fetch, now: number, args: string[] = []) {
  const out: string[] = [];
  const store: Record<string, Tokens> = { [HOST]: { access_token: 'access-1', refresh_token: 'refresh-1' } };
  const tokens = { read: (host: string) => store[host] ?? null, write: (host: string, entry: Tokens) => { store[host] = entry; } };
  await main(['constituents', ...args], { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: () => {} }, tokens, env: {}, fetch, now: () => now });
  return out.join('');
}

/** The product knowledge a later read kept for this repository: it names `product`, read at `readAt`. */
function knowledgeRead(root: string, product: string, readAt: number): void {
  mkdirSync(join(root, '.omni-loop', 'local'), { recursive: true });
  writeFileSync(join(root, PRODUCT_KNOWLEDGE_FILE), JSON.stringify({ product, readAt: new Date(readAt).toISOString(), legal: [], glossary: [] }));
}

describe('a repository that moved to another product (#2811)', () => {
  it('is not briefed with the old product’s constituents when the read does not answer', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/insight-domain\nask:\n  url: https://${HOST}\n` } });
    await constituents(root, answering(OLD_PRODUCT), T0);
    knowledgeRead(root, 'Acme Insight', T0 + DAY);
    const briefing = await constituents(root, offline, T0 + 2 * DAY);
    expect(briefing).not.toContain('Constituents of Acme Ops');
    expect(briefing).not.toContain('Never schedules a team twice.');
  });
});
