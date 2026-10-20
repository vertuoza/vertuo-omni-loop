// `omni constituents add | edit` (PRD 2268, s3), seen from the outside: through `main()` on a fixture
// repository, against the fake contract server, with the sign-in an in-memory token store.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CONSTITUENTS_FILE } from '../lib/constituents/cache.ts';
import type { Tokens } from '../lib/ask/schema.ts';
import { startFakeAskServer } from '../test/fake-ask-server.ts';
import type { FakeAskServer } from '../test/fake-ask-server.ts';
import { makeRepo } from '../test/fixture.ts';
import { main } from './omni.ts';

const started: FakeAskServer[] = [];
afterEach(async () => {
  for (const running of started.splice(0)) await running.close();
});

type Answered = { status?: number; body: unknown };

/** A checkout of acme/widgets pointed at a fake server that answers each change with `answer`, and the bodies it received. */
async function checkout(answer: (body: unknown) => Answered, { signedIn = true }: { signedIn?: boolean } = {}) {
  const bodies: unknown[] = [];
  const server = await startFakeAskServer({ change: (body) => { bodies.push(body); return answer(body); } });
  started.push(server);
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${server.url}\n` } });
  const store: Record<string, Tokens> = signedIn ? { [server.host]: { access_token: 'access-1', refresh_token: 'refresh-1' } } : {};
  const tokens = { read: (host: string) => store[host] ?? null, write: (host: string, entry: Tokens) => { store[host] = entry; } };
  return { root, tokens, bodies, server };
}

async function omni(args: string[], { root, tokens }: { root: string; tokens: unknown }) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['constituents', ...args], { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) }, tokens, env: {} });
  return { code, out: out.join(''), err: err.join('') };
}

const APPLIED = (id: string) => ({ body: { done: 'applied', id, url: `https://omni.test/constituents/${id}` } });

describe('omni constituents add', () => {
  it('adds a Never line and prints `added <id> · <url>`', async () => {
    const run = await checkout(() => APPLIED('never#4'));
    const result = await omni(['add', '--never', 'We never store card numbers'], run);
    expect(result).toEqual({ code: 0, out: 'added never#4 · https://omni.test/constituents/never#4\n', err: '' });
    expect(run.bodies).toEqual([{ repo: 'acme/widgets', kind: 'constituent', action: 'add', fields: { never: 'We never store card numbers' } }]);
  });

  it('adds the Statement, and sends --product', async () => {
    const run = await checkout(() => APPLIED('statement'));
    const result = await omni(['add', '--statement', 'A quoting tool.', '--product', 'Quotes'], run);
    expect(result.out).toMatch(/^added statement · /);
    expect(run.bodies).toEqual([{ repo: 'acme/widgets', product: 'Quotes', kind: 'constituent', action: 'add', fields: { statement: 'A quoting tool.' } }]);
  });

  it('prints the route’s answer with --json', async () => {
    const run = await checkout(() => APPLIED('never#4'));
    const result = await omni(['add', '--never', 'x', '--json'], run);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.out)).toEqual({ done: 'applied', id: 'never#4', url: 'https://omni.test/constituents/never#4' });
  });

  it.each([
    ['no flag', []],
    ['both --statement and --never', ['--statement', 'a', '--never', 'b']],
    ['a blank --never', ['--never', '  ']],
    ['--text', ['--never', 'a', '--text', 'b']],
    ['an unknown flag', ['--never', 'a', '--meaning', 'b']],
  ])('exits 2 with the usage on %s, and calls nothing', async (_, flags) => {
    const run = await checkout(() => APPLIED('x'));
    const result = await omni(['add', ...flags], run);
    expect(result.code).toBe(2);
    expect(result.err).toContain('usage');
    expect(run.bodies).toEqual([]);
  });
});

describe('omni constituents edit', () => {
  it('rewrites a Never line and prints `edited <id> · <url>`', async () => {
    const run = await checkout(() => APPLIED('never#3'));
    const result = await omni(['edit', 'never#3', '--text', 'Holds business logic'], run);
    expect(result).toEqual({ code: 0, out: 'edited never#3 · https://omni.test/constituents/never#3\n', err: '' });
    expect(run.bodies).toEqual([{ repo: 'acme/widgets', kind: 'constituent', action: 'edit', entry: 'never#3', fields: { text: 'Holds business logic' } }]);
  });

  it('rewrites the Statement', async () => {
    const run = await checkout(() => APPLIED('statement'));
    const result = await omni(['edit', 'statement', '--text', 'New.'], run);
    expect(result.out).toMatch(/^edited statement · /);
  });

  it.each([
    ['no --text', ['never#3']],
    ['no id', ['--text', 'x']],
    ['an id that is neither', ['legal', '--text', 'x']],
    ['a bad never id', ['never#x', '--text', 'x']],
    ['--statement', ['statement', '--statement', 'x']],
  ])('exits 2 on %s, and calls nothing', async (_, args) => {
    const run = await checkout(() => APPLIED('x'));
    expect((await omni(['edit', ...args], run)).code).toBe(2);
    expect(run.bodies).toEqual([]);
  });

  it('exits 1 naming an unknown item', async () => {
    const run = await checkout(() => ({ status: 404, body: { error: 'No never#9 in Quotes’s constituents.' } }));
    const result = await omni(['edit', 'never#9', '--text', 'x'], run);
    expect(result).toEqual({ code: 1, out: '', err: 'omni constituents edit: No never#9 in Quotes’s constituents.\n' });
  });
});

describe('refusals', () => {
  const add = ['add', '--never', 'x'];

  it.each([
    [403, 'Only a workspace owner may change a constituent.'],
    [409, 'This repository is in two products: Invoicing, Quotes. Name one with --product.'],
    [422, 'A Statement is one line of at most 400 characters.'],
  ])('exits 1 with the database’s words on a %s', async (status, error) => {
    const run = await checkout(() => ({ status, body: { error } }));
    expect(await omni(add, run)).toEqual({ code: 1, out: '', err: `omni constituents add: ${error}\n` });
  });

  it('exits 1 with {error} on stdout under --json', async () => {
    const run = await checkout(() => ({ status: 403, body: { error: 'No.' } }));
    const result = await omni([...add, '--json'], run);
    expect(result.code).toBe(1);
    expect(JSON.parse(result.out)).toEqual({ error: 'No.' });
  });

  it('exits 1 when signed out, calling nothing', async () => {
    const run = await checkout(() => APPLIED('x'), { signedIn: false });
    const result = await omni(add, run);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/no sign-in for .* \(omni signin\)/);
    expect(run.bodies).toEqual([]);
  });

  it('exits 1 when the page is unreachable', async () => {
    const run = await checkout(() => APPLIED('x'));
    await run.server.close();
    expect(await omni(add, run)).toEqual({ code: 1, out: '', err: 'omni constituents add: the Omni page could not be reached\n' });
  });

  it('exits 1 on a reply that is no change', async () => {
    const run = await checkout(() => ({ body: { nothing: true } }));
    expect((await omni(add, run)).code).toBe(1);
  });

  it('never writes the constituents cache', async () => {
    const run = await checkout(() => APPLIED('never#4'));
    await omni(add, run);
    expect(existsSync(join(run.root, CONSTITUENTS_FILE))).toBe(false);
  });
});
