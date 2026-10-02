// `omni constituents [--json]` (PRD 871), seen from the outside: through `main()` on a fixture
// repository, against an injected `fetch` that plays the Omni page, with the sign-in an in-memory token
// store. Every outcome exits 0: fresh, offline with or without a copy, no product, no sign-in, and a
// page slower than the budget.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../test/fixture.ts';
import { CONSTITUENTS_BUDGET_MS } from './commands/constituents.ts';
import { CONSTITUENTS_FILE } from '../lib/constituents/cache.ts';
import { ageOf, constituentsOf } from '../lib/constituents/read.ts';
import { main } from './omni.ts';
import type { Tokens } from '../lib/ask/schema.ts';

const URL_ = 'https://omni.example';
const HOST = 'omni.example';
const T0 = Date.parse('2026-10-01T09:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

const READ = {
  state: 'ok',
  product: { name: 'Vertuoza UX' },
  statement: { id: 'statement', text: 'The component workshop, shown with fixtures.' },
  never: [
    { id: 'never#1', text: 'Calls real Vertuoza APIs' },
    { id: 'never#3', text: 'Holds business logic' },
  ],
  latestEventId: '42',
};

function io() {
  const out: string[] = [];
  return { out: () => out.join(''), stdout: { write: (s: string) => out.push(s) }, stderr: { write: () => {} } };
}

function memoryTokens(entries: Record<string, Tokens> = {}) {
  const store: Record<string, Tokens> = { ...entries };
  return { read: (host: string) => store[host] ?? null, write: (host: string, tokens: Tokens) => { store[host] = tokens; } };
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const config = (url: string | null) => `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${url ?? 'null'}\n`;

/** A `fetch` answering every call with `status` and `body`, recording what it was asked. */
function page(body: unknown, status = 200) {
  const calls: { url: string; authorization: unknown }[] = [];
  const fetch: Fetch = async (url, init) => {
    calls.push({ url, authorization: (init.headers as Record<string, string>).authorization });
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, calls };
}

const offline: Fetch = async () => { throw new TypeError('fetch failed'); };

/** A page that never answers until the call is given up. */
const slow: Fetch = (url, init) => new Promise((_, reject) => {
  init.signal?.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
});

function checkout({ url = URL_, signedIn = true }: { url?: string | null; signedIn?: boolean } = {}) {
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config(url) } });
  const tokens = memoryTokens(signedIn ? { [HOST]: { access_token: 'access-1', refresh_token: 'refresh-1' } } : {});
  return { root, tokens };
}

async function run(
  args: string[],
  { root, tokens }: { root: string; tokens: ReturnType<typeof memoryTokens> },
  { fetch, now = T0, budgetMs }: { fetch: Fetch; now?: number; budgetMs?: number },
) {
  const s = io();
  const code = await main(['constituents', ...args], { cwd: root, ...s, tokens, env: {}, fetch, now: () => now, ...(budgetMs ? { budgetMs } : {}) });
  return { code, out: s.out() };
}

describe('omni constituents', () => {
  it('fresh: prints the Statement and the Never list, synced just now, and keeps the copy', async () => {
    const c = checkout();
    const p = page(READ);
    const result = await run([], c, { fetch: p.fetch });
    expect(result).toEqual({
      code: 0,
      out: [
        'Constituents of Vertuoza UX (synced just now): they come before every priority and the playbook.',
        'Statement: The component workshop, shown with fixtures.',
        'Never:',
        '  never#1  Calls real Vertuoza APIs',
        '  never#3  Holds business logic',
        '',
      ].join('\n'),
    });
    expect(p.calls).toEqual([{ url: `${URL_}/api/constituents?repo=acme%2Fwidgets`, authorization: 'Bearer access-1' }]);
    const kept = JSON.parse(readFileSync(join(c.root, CONSTITUENTS_FILE), 'utf8'));
    expect(kept).toEqual({ repo: 'acme/widgets', syncedAt: new Date(T0).toISOString(), read: READ });
    expect(readFileSync(join(c.root, '.omni-loop/local/.gitignore'), 'utf8')).toBe('*\n');
  });

  it('--json prints {state, product, statement, never, syncedAt}', async () => {
    const c = checkout();
    const printed = JSON.parse((await run(['--json'], c, { fetch: page(READ).fetch })).out);
    expect(Object.keys(printed)).toEqual(['state', 'product', 'statement', 'never', 'syncedAt']);
    expect(printed).toEqual({ state: 'ok', product: READ.product, statement: READ.statement, never: READ.never, syncedAt: new Date(T0).toISOString() });
  });

  it('offline with a copy: prints it with its age, and keeps it', async () => {
    const c = checkout();
    await run([], c, { fetch: page(READ).fetch });
    const result = await run([], c, { fetch: offline, now: T0 + 3 * DAY });
    expect(result.code).toBe(0);
    expect(result.out.split('\n')[0]).toBe('Constituents of Vertuoza UX (synced 3 d ago, offline): they come before every priority and the playbook.');
    expect(result.out).toContain('  never#1  Calls real Vertuoza APIs');
    const printed = JSON.parse((await run(['--json'], c, { fetch: offline, now: T0 + 3 * DAY })).out);
    expect(printed).toEqual({ state: 'cached', product: READ.product, statement: READ.statement, never: READ.never, syncedAt: new Date(T0).toISOString() });
  });

  it('offline without a copy: one line', async () => {
    const c = checkout();
    const result = await run([], c, { fetch: offline });
    expect(result).toEqual({ code: 0, out: 'no constituents: offline — agents carry on\n' });
    expect(JSON.parse((await run(['--json'], c, { fetch: offline })).out))
      .toEqual({ state: 'unreachable', product: null, statement: null, never: [], syncedAt: null });
  });

  it('no product: one line, and the reply is kept', async () => {
    const c = checkout();
    const none = { state: 'none', product: null, statement: null, never: [], latestEventId: null };
    const result = await run([], c, { fetch: page(none).fetch });
    expect(result).toEqual({ code: 0, out: 'no product for acme/widgets yet (synced just now) — agents carry on\n' });
    expect(existsSync(join(c.root, CONSTITUENTS_FILE))).toBe(true);
  });

  it('a product with no constituent: one line', async () => {
    const c = checkout();
    const none = { state: 'none', product: { name: 'Omni Loop' }, statement: null, never: [], latestEventId: null };
    const result = await run([], c, { fetch: page(none).fetch });
    expect(result).toEqual({ code: 0, out: 'no constituents for Omni Loop yet (synced just now) — agents carry on\n' });
  });

  it('no sign-in: one line, without calling the page', async () => {
    const c = checkout({ signedIn: false });
    const p = page(READ);
    const result = await run([], c, { fetch: p.fetch });
    expect(result).toEqual({ code: 0, out: 'no constituents: no sign-in (omni signin) — agents carry on\n' });
    expect(p.calls).toEqual([]);
  });

  it('no Omni page set here: one line', async () => {
    const c = checkout({ url: null });
    const result = await run(['--json'], c, { fetch: page(READ).fetch });
    expect(JSON.parse(result.out).state).toBe('no-sign-in');
  });

  it('a refusal or a reply that is not constituents: one line, or the copy', async () => {
    const c = checkout();
    const refused = await run([], c, { fetch: page({ error: 'Not your repository.' }, 403).fetch });
    expect(refused).toEqual({ code: 0, out: 'no constituents: refused (403): Not your repository. — agents carry on\n' });
    const odd = await run(['--json'], c, { fetch: page({ state: 'ok', never: 'x' }).fetch });
    expect(JSON.parse(odd.out).state).toBe('refused');
  });

  it('a page slower than the budget: gives up within it, exits 0', async () => {
    const c = checkout();
    const started = Date.now();
    const result = await run([], c, { fetch: slow, budgetMs: 100 });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(result).toEqual({ code: 0, out: 'no constituents: offline — agents carry on\n' });
    expect(CONSTITUENTS_BUDGET_MS).toBe(3000);
  });

  it('a checkout without the kit set up: one line, exit 0', async () => {
    const { root } = makeRepo({ git: true });
    const s = io();
    const code = await main(['constituents'], { cwd: root, ...s, tokens: memoryTokens(), env: {}, fetch: offline });
    expect(code).toBe(0);
    expect(s.out()).toMatch(/^no constituents: .* — agents carry on\n$/);
  });

  it('a stray argument is a usage error', async () => {
    const c = checkout();
    expect((await run(['show'], c, { fetch: offline })).code).toBe(2);
  });
});

describe('the constituents read', () => {
  it('reads only the contract, and refuses a state that disagrees with the lines', () => {
    expect(constituentsOf({ ...READ, extra: 1 })).toEqual(READ);
    expect(constituentsOf({ ...READ, never: [{ id: 'never#0', text: 'x' }] })).toBeNull();
    expect(constituentsOf({ ...READ, state: 'none' })).toBeNull();
    expect(constituentsOf({ ...READ, latestEventId: 42 })).toBeNull();
  });

  it('says the age in minutes, hours and days', () => {
    const at = new Date(T0).toISOString();
    expect(ageOf(at, T0 + 30_000)).toBe('just now');
    expect(ageOf(at, T0 + 5 * 60_000)).toBe('5 min ago');
    expect(ageOf(at, T0 + 3 * 60 * 60_000)).toBe('3 h ago');
    expect(ageOf(at, T0 + 2 * DAY)).toBe('2 d ago');
  });
});

describe('the plugin\'s SessionStart hook', () => {
  it('runs omni constituents, never failing', () => {
    const hooks = JSON.parse(readFileSync(fileURLToPath(new URL('../plugin/hooks/hooks.json', import.meta.url)), 'utf8')).hooks;
    expect(hooks.SessionStart).toEqual([{ hooks: [{ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/.omni-loop/bin/omni.mjs" constituents || true', timeout: 10 }] }]);
  });
});
