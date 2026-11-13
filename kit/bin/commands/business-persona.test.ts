// `omni business persona add | edit` (PRD 2779 s4), seen from the outside: through `main()` on a fixture
// repository, against the fake contract server, with the sign-in an in-memory token store.
import { afterEach, describe, expect, it } from 'vitest';
import type { Tokens } from '../../lib/ask/schema.ts';
import { startFakeAskServer } from '../../test/fake-ask-server.ts';
import type { FakeAskServer } from '../../test/fake-ask-server.ts';
import { makeRepo } from '../../test/fixture.ts';
import { main } from '../omni.ts';

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
  return { root, tokens, bodies };
}

async function omni(args: string[], { root, tokens }: { root: string; tokens: unknown }) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['business', 'persona', ...args], { cwd: root, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) }, tokens, env: {} });
  return { code, out: out.join(''), err: err.join('') };
}

const APPLIED = (id: string) => ({ body: { done: 'applied', id, url: `https://omni.test/personas/${id}`, waitsFor: null } });
const ADD = ['add', '--name', 'Ada', '--stance', 'skeptical', '--trade', 'data analyst', '--who', 'Reads the numbers.', '--usage', 'Weekly.'];

describe('omni business persona add', () => {
  it('adds a persona and prints `added persona:<name> · <url>`', async () => {
    const run = await checkout(() => APPLIED('Ada'));
    expect(await omni(ADD, run)).toEqual({ code: 0, out: 'added persona:Ada · https://omni.test/personas/Ada\n', err: '' });
    expect(run.bodies).toEqual([{
      repo: 'acme/widgets', kind: 'persona', action: 'add',
      fields: { name: 'Ada', stance: 'skeptical', trade: 'data analyst', who: 'Reads the numbers.', usage: 'Weekly.' },
    }]);
  });

  it('sends --product, writes `excited` as enthusiastic, and prints the route’s answer with --json', async () => {
    const run = await checkout(() => APPLIED('Ada'));
    const result = await omni([...ADD.map((w) => (w === 'skeptical' ? 'excited' : w)), '--product', 'Quotes', '--json'], run);
    expect(result.code).toBe(0);
    expect(JSON.parse(result.out)).toEqual({ done: 'applied', id: 'Ada', url: 'https://omni.test/personas/Ada', waitsFor: null });
    expect(run.bodies).toEqual([expect.objectContaining({ product: 'Quotes', fields: expect.objectContaining({ stance: 'enthusiastic' }) as unknown })]);
  });

  it.each([
    ['no flag', ['add']],
    ['a missing --usage', ADD.slice(0, -2)],
    ['an unknown stance', ADD.map((w) => (w === 'skeptical' ? 'angry' : w))],
    ['a blank --who', ADD.map((w) => (w === 'Reads the numbers.' ? '  ' : w))],
    ['an unknown flag', [...ADD, '--avoid', 'x']],
    ['an argument', [...ADD, 'Ada']],
    ['no verb', []],
    ['an unknown verb', ['remove', 'Ada']],
  ])('exits 2 with the usage on %s, and calls nothing', async (_, args) => {
    const run = await checkout(() => APPLIED('x'));
    const result = await omni(args, run);
    expect(result.code).toBe(2);
    expect(result.out).toBe('');
    expect(run.bodies).toEqual([]);
  });

  it('lists the three stances in the usage line', async () => {
    const run = await checkout(() => APPLIED('x'));
    expect((await omni(['add'], run)).err).toContain('enthusiastic, neutral, skeptical');
    expect((await omni(ADD.map((w) => (w === 'skeptical' ? 'angry' : w)), run)).err).toContain('enthusiastic, neutral, skeptical');
  });
});

describe('omni business persona edit', () => {
  it('edits by name, sends the fields given and prints `edited persona:<name> · <url>`', async () => {
    const run = await checkout(() => APPLIED('Ada'));
    expect(await omni(['edit', 'Ada', '--trade', 'journalist'], run)).toEqual({ code: 0, out: 'edited persona:Ada · https://omni.test/personas/Ada\n', err: '' });
    expect(run.bodies).toEqual([{ repo: 'acme/widgets', kind: 'persona', action: 'edit', entry: 'Ada', fields: { trade: 'journalist' } }]);
  });

  it.each([
    ['no field', ['edit', 'Ada']],
    ['no name', ['edit', '--trade', 'journalist']],
    ['two names', ['edit', 'Ada', 'Sam', '--trade', 'journalist']],
    ['an unknown stance', ['edit', 'Ada', '--stance', 'angry']],
  ])('exits 2 on %s, and calls nothing', async (_, args) => {
    const run = await checkout(() => APPLIED('x'));
    expect((await omni(args, run)).code).toBe(2);
    expect(run.bodies).toEqual([]);
  });

  it('exits 1 with the server’s own words when it refuses, and with {error} on stdout under --json', async () => {
    const line = 'no persona named "Zed" in Mobile';
    const run = await checkout(() => ({ status: 404, body: { error: line } }));
    expect(await omni(['edit', 'Zed', '--who', 'x'], run)).toEqual({ code: 1, out: '', err: `omni business persona edit: ${line}\n` });
    const json = await omni(['edit', 'Zed', '--who', 'x', '--json'], run);
    expect(json.code).toBe(1);
    expect(JSON.parse(json.out)).toEqual({ error: line });
    expect(json.err).toBe('');
  });
});

describe('omni business persona, when it cannot call', () => {
  it('exits 1 when signed out', async () => {
    const run = await checkout(() => APPLIED('x'), { signedIn: false });
    const result = await omni(ADD, run);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/no sign-in \(omni signin\)/);
    expect(run.bodies).toEqual([]);
  });

  it('exits 1 when the sign-in is refused', async () => {
    const run = await checkout(() => ({ status: 401, body: { error: 'no' } }));
    const result = await omni(ADD, run);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/sign-in was refused/);
  });

  it('exits 1 when the page cannot be reached', async () => {
    const run = await checkout(() => APPLIED('x'));
    const server = started.pop();
    await server?.close();
    const result = await omni(ADD, run);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/could not be reached/);
  });

  it('exits 1 when the page answers something this kit does not read', async () => {
    const run = await checkout(() => ({ body: { done: 'proposed', id: null, url: 'x', waitsFor: null } }));
    const result = await omni(ADD, run);
    expect(result.code).toBe(1);
    expect(result.err).toMatch(/does not read/);
  });
});
