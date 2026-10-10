// `omni product import` and `omni product which` (PRD 1364, s5), through `main()` on a fixture
// repository with a stubbed Omni page: what each sends and prints, that import never edits the config,
// and each line it stops on. Nothing here calls the network.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { main } from '../omni.ts';

const HOST = 'omni.test';
const SHA = '3f2a9c1e0b7d4c5a8e6f1d2c3b4a5968778695a4';
const PLAN = `kit: 1
repo:
  slug: acme/plan
ask:
  url: https://omni.test
plan:
  guide: null
  targets:
    - repo: acme/api
      role: api
      knowledge: imported
      readAt: ${SHA}
    - repo: acme/app
      role: mobile
      knowledge: own
      consumes: [api]
`;
const LINKS = [
  { repo: 'acme/api', role: 'api', knowledge: 'imported', readAt: SHA, readOnly: false, consumes: [] },
  { repo: 'acme/app', role: 'mobile', knowledge: 'own', readAt: null, readOnly: false, consumes: ['acme/api'] },
];

type Tokens = { access_token: string; refresh_token: string };
const signedIn = () => ({ read: (host: string): Tokens | null => (host === HOST ? { access_token: 'a', refresh_token: 'r' } : null), write: () => {} });

/** A stub Omni page answering every call with `status` and `body`, keeping what it was sent. */
function answering(status: number, body: unknown) {
  const sent: Array<{ url: string; method: string; body: unknown }> = [];
  const fetch = (url: string, init: RequestInit) => {
    sent.push({ url, method: String(init.method), body: typeof init.body === 'string' ? JSON.parse(init.body) : null });
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  };
  return { sent, fetch };
}
const down = { sent: [], fetch: () => Promise.reject(new TypeError('fetch failed')) };

async function product(args: string[], { config = PLAN, server = answering(200, {}), tokens = signedIn() as unknown } = {}) {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config } });
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['product', ...args], {
    cwd: root, env: {}, tokens, fetch: server.fetch,
    stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) },
  });
  return { code, out: out.join(''), err: err.join(''), root };
}

describe('omni product import', () => {
  it("sends plan.targets to the product as links, prints what it added and changed, and leaves the config as it was", async () => {
    const server = answering(200, { product: { name: 'Mobile' }, added: ['acme/api'], changed: ['acme/app'], unchanged: [] });
    const { code, out, err, root } = await product(['import', '--product', 'mobile'], { server });
    expect({ code, err }).toEqual({ code: 0, err: '' });
    expect(out).toBe('product Mobile: 1 added, 1 changed, 0 unchanged\n  added    acme/api\n  changed  acme/app\n');
    expect(server.sent).toEqual([
      { url: 'https://omni.test/api/products/import', method: 'POST', body: { repo: 'acme/plan', product: 'mobile', targets: LINKS } },
    ]);
    expect(readFileSync(join(root, '.omni-loop/config.yml'), 'utf8')).toBe(PLAN);
  });

  it('says nothing changed on a second run', async () => {
    const server = answering(200, { product: { name: 'Mobile' }, added: [], changed: [], unchanged: ['acme/api', 'acme/app'] });
    expect((await product(['import', '--product', 'Mobile'], { server })).out).toBe('product Mobile: nothing changed, 2 links already as plan.targets says\n');
  });

  it("stops on the server's refusal with its reason, and when it is unreachable", async () => {
    const refused = answering(403, { error: 'Only an owner of the workspace changes the repositories of Mobile.' });
    expect(await product(['import', '--product', 'Mobile'], { server: refused })).toMatchObject({
      code: 1,
      out: 'the import into product Mobile stopped: the server refused (403): Only an owner of the workspace changes the repositories of Mobile.\n',
    });
    expect(await product(['import', '--product', 'Mobile'], { server: down })).toMatchObject({
      code: 1,
      out: 'the import into product Mobile stopped: the server is unreachable\n',
    });
  });

  it('needs a plan section with targets, and sends nothing without', async () => {
    const server = answering(200, {});
    expect(await product(['import', '--product', 'Mobile'], { config: 'kit: 1\nrepo:\n  slug: acme/plan\nask:\n  url: https://omni.test\n', server })).toMatchObject({
      code: 1,
      out: 'not a plan repository: omni product import sends plan.targets, and this config has no plan section\n',
    });
    const byProduct = 'kit: 1\nrepo:\n  slug: acme/plan\nask:\n  url: https://omni.test\nplan:\n  guide: null\n  product: Mobile\n';
    expect(await product(['import', '--product', 'Mobile'], { config: byProduct, server })).toMatchObject({ code: 1, out: 'nothing to import: plan.targets is empty\n' });
    expect(server.sent).toEqual([]);
  });

  it('needs an Omni page and a sign-in for it', async () => {
    expect((await product(['import', '--product', 'Mobile'], { config: PLAN.replace('url: https://omni.test', 'url: null') })).out).toBe(
      'omni product import: products live on the Omni page, and ask.url is not set\n',
    );
    expect((await product(['import', '--product', 'Mobile'], { tokens: { read: () => null, write: () => {} } })).out).toBe(
      'omni product import: no sign-in for omni.test (omni signin)\n',
    );
  });

  it('refuses a call with no product, exit 2', async () => {
    expect((await product(['import'])).code).toBe(2);
    expect((await product(['import', '--product'])).code).toBe(2);
  });
});

describe('omni product which', () => {
  it("prints this repository's products, one per line", async () => {
    const server = answering(200, { products: [{ name: 'Estimates' }, { name: 'Mobile' }] });
    expect(await product(['which'], { server })).toMatchObject({ code: 0, out: 'Estimates\nMobile\n', err: '' });
    expect(server.sent).toEqual([{ url: 'https://omni.test/api/products/which?repo=acme%2Fplan', method: 'GET', body: null }]);
  });

  it('prints none for a repository in no product', async () => {
    expect(await product(['which'], { server: answering(200, { products: [] }) })).toMatchObject({ code: 0, out: 'none\n' });
  });

  it('stops when the server is unreachable or refuses', async () => {
    expect(await product(['which'], { server: down })).toMatchObject({ code: 1, out: 'no products read for acme/plan: the server is unreachable\n' });
    expect((await product(['which'], { server: answering(200, { products: 'none' }) })).out).toBe('the server answered no products for this repository\n');
  });

  it('refuses another verb or an argument it does not take, exit 2', async () => {
    for (const args of [[], ['list'], ['which', 'acme/api'], ['which', '--product', 'Mobile'], ['which', '--json']]) {
      expect((await product(args)).code, args.join(' ')).toBe(2);
    }
  });
});

it('has its entry in omni help product', async () => {
  const out: string[] = [];
  const code = await main(['help', 'product'], { cwd: makeRepo({ git: true, files: { '.omni-loop/config.yml': PLAN } }).root, stdout: { write: (s) => out.push(s) }, stderr: { write: () => {} } });
  expect(code).toBe(0);
  expect(out.join('')).toMatch(/omni product import --product <name>/);
  expect(out.join('')).toMatch(/omni product which/);
  expect(out.join('')).toMatch(/never edits the config/);
});
