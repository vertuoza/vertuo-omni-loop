// A product's domains from the terminal (PRD 2583, s4), seen from the outside through `main()` on a
// fixture repository: `omni kb domains` (read, add, edit), `--domain` on the glossary verbs, a term's
// domains on its line, an older copy that still reads, and the mark in `omni kb graph`. The page is a
// stub and nothing here calls the network. Every name is fictional.
import { afterEach, describe, expect, it } from 'vitest';
import { startFakeAskServer } from '../test/fake-ask-server.ts';
import type { FakeAskServer } from '../test/fake-ask-server.ts';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const HOST = 'omni.test';
const NOW = new Date('2026-10-15T08:00:00Z');
const LOCAL = '.omni-loop/local/product-knowledge.json';
const CONFIG = 'kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: https://omni.test\n';
const DOMAINS = [
  { key: 'invoicing', name: 'Invoicing', meaning: 'Billing a customer.' },
  { key: 'planning', name: 'Planning', meaning: 'Who works where.' },
];
const BUSINESS = {
  state: 'ok',
  business: { name: 'Acme' },
  product: { name: 'Widgets' },
  claims: [],
  personas: [],
  legal: [],
  glossary: [
    { term: 'Credit note', meaning: 'Cancels an invoice.', avoid: [], domains: ['invoicing'] },
    { term: 'Quote', meaning: 'A priced offer.', avoid: [], domains: [] },
  ],
  domains: DOMAINS,
};
const signedIn = { read: (host: string) => (host === HOST ? { access_token: 'a', refresh_token: 'r' } : null), write: () => {} };

async function omni(root: string, argv: string[], options: Record<string, unknown> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(argv, { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) }, ...options });
  return { code, out: out.join(''), err: err.join('') };
}

const page = (body: unknown = BUSINESS, status = 200) => ({ fetch: () => Promise.resolve(new Response(JSON.stringify(body), { status })) });
const down = { fetch: () => Promise.reject(new TypeError('fetch failed')) };
const know = (root: string, argv: string[], server: { fetch: unknown }) => omni(root, argv, { env: {}, tokens: signedIn, fetch: server.fetch, now: () => NOW });
const repo = (files: Record<string, string> = {}) => makeRepo({ git: true, files: { '.omni-loop/config.yml': CONFIG, ...files } });

describe('omni kb domains', () => {
  it('prints the active list, one line each, and keeps it in the local copy', async () => {
    const { root, read } = repo();
    expect(await know(root, ['kb', 'domains'], page())).toEqual({ code: 0, out: 'invoicing  Invoicing: Billing a customer.\nplanning  Planning: Who works where.\n', err: '' });
    expect(JSON.parse(read(LOCAL))).toMatchObject({ product: 'Widgets', domains: DOMAINS });
  });

  it('prints the copy with its age when the page is unreachable, and one line with no copy', async () => {
    const { root } = repo();
    const none = await know(root, ['kb', 'domains'], down);
    expect(none.code).toBe(1);
    expect(none.out).toContain('no product knowledge');
    await know(root, ['kb', 'domains'], page());
    const copy = await know(root, ['kb', 'domains'], down);
    expect(copy).toEqual({
      code: 0,
      out: 'last read 2026-10-15: the Omni page is unreachable\ninvoicing  Invoicing: Billing a customer.\nplanning  Planning: Who works where.\n',
      err: '',
    });
  });

  it('says so when the product lists no domain, as a server from before the domains does', async () => {
    const { root } = repo();
    const old = { ...BUSINESS, domains: undefined, glossary: [{ term: 'Quote', meaning: 'A priced offer.', avoid: [] }] };
    expect((await know(root, ['kb', 'domains'], page(old))).out).toBe('the product lists no domains yet\n');
    expect((await know(root, ['kb', 'glossary'], page(old))).out).toBe('Quote: A priced offer.  (avoid: none)\n');
  });

  it('prints a term\'s domains on its line, and nothing for a term that names none', async () => {
    const { root } = repo();
    expect((await know(root, ['kb', 'glossary'], page())).out).toBe(
      'Credit note: Cancels an invoice.  (avoid: none)  (domains: invoicing)\nQuote: A priced offer.  (avoid: none)\n',
    );
  });

  it('still reads a copy written before the domains, with no domain', async () => {
    const { root } = repo({ [LOCAL]: JSON.stringify({ product: 'Widgets', readAt: NOW.toISOString(), legal: [], glossary: [{ term: 'Quote', meaning: 'q', avoid: [] }] }) });
    const copy = await know(root, ['kb', 'domains'], down);
    expect(copy).toEqual({ code: 0, out: 'last read 2026-10-15: the Omni page is unreachable\nthe product lists no domains yet\n', err: '' });
  });
});

describe('omni kb domains add | edit, and --domain on the glossary', () => {
  const started: FakeAskServer[] = [];
  afterEach(async () => {
    for (const running of started.splice(0)) await running.close();
  });

  async function checkout(answer: () => { status?: number; body: unknown }) {
    const bodies: unknown[] = [];
    const server = await startFakeAskServer({ change: (body) => { bodies.push(body); return answer(); } });
    started.push(server);
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${server.url}\n` } });
    const tokens = { read: (host: string) => (host === server.host ? { access_token: 'access-1', refresh_token: 'refresh-1' } : null), write: () => {} };
    return { root, bodies, tokens };
  }
  const run = (c: { root: string; tokens: unknown }, args: string[]) => omni(c.root, ['kb', ...args], { tokens: c.tokens, env: {} });
  const APPLIED = (id: string) => ({ body: { done: 'applied', id, url: `https://omni.test/domains/${id}` } });

  it('adds a domain and prints `added <key> · <url>`', async () => {
    const c = await checkout(() => APPLIED('stock'));
    const result = await run(c, ['domains', 'add', '--key', 'stock', '--name', 'Stock', '--meaning', 'What is on the shelves.']);
    expect(result).toEqual({ code: 0, out: 'added stock · https://omni.test/domains/stock\n', err: '' });
    expect(c.bodies).toEqual([{ repo: 'acme/widgets', kind: 'domains', action: 'add', fields: { key: 'stock', name: 'Stock', meaning: 'What is on the shelves.' } }]);
  });

  it('edits a domain by its key, only the fields given', async () => {
    const c = await checkout(() => APPLIED('stock'));
    const result = await run(c, ['domains', 'edit', 'stock', '--meaning', 'Goods in the warehouse.', '--product', 'Widgets']);
    expect(result.out).toBe('edited stock · https://omni.test/domains/stock\n');
    expect(c.bodies).toEqual([{ repo: 'acme/widgets', product: 'Widgets', kind: 'domains', action: 'edit', entry: 'stock', fields: { meaning: 'Goods in the warehouse.' } }]);
  });

  it('prints `proposed` for a member who does not decide', async () => {
    const c = await checkout(() => ({ body: { done: 'proposed', url: 'https://omni.test/domains', owner: 'jane' } }));
    const result = await run(c, ['domains', 'add', '--key', 'stock', '--name', 'Stock', '--meaning', 'Shelves.']);
    expect(result.out).toBe('proposed · waits for @jane · https://omni.test/domains\n');
  });

  it('prints the refusal in the server\'s words, and exits 2 on a missing flag, an edit with no field, or --key on an edit', async () => {
    const c = await checkout(() => ({ status: 422, body: { error: 'key: a domain with that key exists or was retired' } }));
    expect(await run(c, ['domains', 'add', '--key', 'stock', '--name', 'Stock', '--meaning', 'Shelves.'])).toEqual({
      code: 1, out: '', err: 'omni kb domains add: key: a domain with that key exists or was retired\n',
    });
    expect((await run(c, ['domains', 'add', '--key', 'stock'])).code).toBe(2);
    expect((await run(c, ['domains', 'edit', 'stock'])).code).toBe(2);
    expect((await run(c, ['domains', 'edit', 'stock', '--key', 'other'])).code).toBe(2);
    expect((await run(c, ['domains', 'retire', 'stock'])).code).toBe(2);
  });

  it('sends --domain as a list on a glossary add, and leaves it out when not named', async () => {
    const c = await checkout(() => APPLIED('quote'));
    await run(c, ['glossary', 'add', '--term', 'Quote', '--meaning', 'A priced offer.', '--domain', 'invoicing, planning']);
    await run(c, ['glossary', 'add', '--term', 'Note', '--meaning', 'A short text.']);
    expect(c.bodies[0]).toMatchObject({ kind: 'glossary', action: 'add', fields: { domains: ['invoicing', 'planning'] } });
    expect(c.bodies[1]).not.toHaveProperty('fields.domains');
  });

  it('sets the domains of a term on edit, and --domain \'\' clears them', async () => {
    const c = await checkout(() => APPLIED('quote'));
    await run(c, ['glossary', 'edit', 'Quote', '--domain', 'planning']);
    await run(c, ['glossary', 'edit', 'Quote', '--domain', '']);
    expect(c.bodies).toEqual([
      { repo: 'acme/widgets', kind: 'glossary', action: 'edit', entry: 'Quote', fields: { domains: ['planning'] } },
      { repo: 'acme/widgets', kind: 'glossary', action: 'edit', entry: 'Quote', fields: { domains: [] } },
    ]);
  });
});

describe('omni kb graph and the product\'s list of domains', () => {
  const K = '.omni-loop/knowledge';
  const FILES = {
    [`${K}/domains/invoicing/rules.md`]: '# Rules\n',
    [`${K}/domains/stock/rules.md`]: '# Rules\n',
  };
  const copy = (domains?: unknown) => ({ [LOCAL]: JSON.stringify({ product: 'Widgets', readAt: NOW.toISOString(), legal: [], glossary: [], ...(domains === undefined ? {} : { domains }) }) });
  const graph = (root: string) => omni(root, ['kb', 'graph'], { env: {} });
  const line = (out: string, name: string) => out.split('\n').find((l) => l.trim().startsWith(name)) ?? '';

  it('marks a folder off the list from the copy, with no network call', async () => {
    const { root } = repo({ ...FILES, ...copy(DOMAINS) });
    const { code, out } = await graph(root);
    expect(code).toBe(0);
    expect(line(out, 'stock')).toContain("not on the product's list");
    expect(line(out, 'invoicing')).not.toContain("not on the product's list");
    expect(out).not.toContain('the product lists no domains yet');
  });

  it('marks nothing with no copy', async () => {
    const { root } = repo(FILES);
    const { code, out } = await graph(root);
    expect(code).toBe(0);
    expect(out).not.toContain("not on the product's list");
    expect(out).not.toContain('the product lists no domains yet');
  });

  it('prints one line for an empty list instead of marking every folder, and for a copy from before the domains', async () => {
    for (const files of [copy([]), copy()]) {
      const { root } = repo({ ...FILES, ...files });
      const { code, out } = await graph(root);
      expect(code).toBe(0);
      expect(out).toContain('the product lists no domains yet');
      expect(out).not.toContain("not on the product's list");
    }
  });

  it('leaves --json as it was', async () => {
    const { root } = repo({ ...FILES, ...copy(DOMAINS) });
    const { out } = await omni(root, ['kb', 'graph', '--json'], { env: {} });
    expect(out).not.toContain("not on the product's list");
  });
});
