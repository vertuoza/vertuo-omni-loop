// `omni session start | end` (PRD 1831), seen from the outside: through `main()` on a fixture
// repository, against the fake contract server, with the sign-in an in-memory token store. `start`
// prints the constituents, the briefing and the session id, for each of the four id sources; `end`
// closes the ask session and sends the heartbeat's end. Both exit 0 with the page unreachable.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { startFakeAskServer } from '../test/fake-ask-server.ts';
import type { FakeAskServer } from '../test/fake-ask-server.ts';
import { makeRepo } from '../test/fixture.ts';
import { readTerminal, writeTerminal } from '../lib/ask/local-state.ts';
import { SESSION_FILE } from '../lib/dossier/session.ts';
import { readSyncCache, writeSyncCache } from '../lib/sync/cache.ts';
import type { SyncRecord } from '../lib/sync/schema.ts';
import { dig } from './dig.ts';
import { main } from './omni.ts';
import type { Tokens } from '../lib/ask/schema.ts';

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const CONSTITUENTS = {
  state: 'ok',
  product: { name: 'Widgets' },
  statement: { id: 'statement', text: 'The widget shop.' },
  never: [{ id: 'never#1', text: 'Sells gadgets' }],
  latestEventId: '1',
};
const UUID = /^session: [0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function memoryTokens(entries: Record<string, Tokens> = {}) {
  const store: Record<string, Tokens> = { ...entries };
  return { read: (host: string) => store[host] ?? null, write: (host: string, tokens: Tokens) => { store[host] = tokens; } };
}

const started: FakeAskServer[] = [];
afterEach(async () => {
  for (const running of started.splice(0)) await running.close();
});

const configText = (url: string) => `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${url}\ndossier:\n  enabled: true\n`;

/** A checkout signed in to the fake page, whose constituents the `fetch` answers itself. */
async function checkout() {
  const server = await startFakeAskServer();
  started.push(server);
  const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': configText(server.url) } });
  const tokens = memoryTokens({ [server.host]: { access_token: 'access-1', refresh_token: 'refresh-1' } });
  const fetch: Fetch = (url, init) =>
    url.includes('/api/constituents')
      ? Promise.resolve(new Response(JSON.stringify(CONSTITUENTS), { status: 200, headers: { 'content-type': 'application/json' } }))
      : globalThis.fetch(url, init);
  return { root, server, tokens, fetch };
}

const offline: Fetch = () => Promise.reject(new TypeError('fetch failed'));

async function run(args: string[], { root, tokens, fetch, env = {}, extra = {} }: { root: string; tokens: unknown; fetch: Fetch; env?: Record<string, string>; extra?: Record<string, unknown> }) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['session', ...args], {
    cwd: root,
    stdout: { write: (s: string) => out.push(s) },
    stderr: { write: (s: string) => err.push(s) },
    env,
    tokens,
    fetch,
    now: () => 1_000_000,
    ...extra,
  });
  return { code, lines: out.join('').trimEnd().split('\n'), err: err.join('') };
}

const stored = (root: string): unknown => (existsSync(join(root, SESSION_FILE)) ? JSON.parse(readFileSync(join(root, SESSION_FILE), 'utf8')) : null);

describe('omni session start', () => {
  it('prints the constituents, then the briefing, then a generated id, which it stores', async () => {
    const c = await checkout();
    const { code, lines } = await run(['start'], c);
    expect(code).toBe(0);
    expect(lines[0]).toMatch(/^Constituents of Widgets \(synced just now\)/);
    const briefing = lines.indexOf('# Briefing');
    expect(briefing).toBeGreaterThan(lines.findIndex((line) => line.includes('Sells gadgets')));
    expect(lines.at(-1)).toMatch(UUID);
    expect(stored(c.root)).toEqual({ id: lines.at(-1)?.slice('session: '.length) });
  });

  it.each([
    ['OMNI_SESSION_ID', { OMNI_SESSION_ID: 'omni-1', CLAUDE_CODE_SESSION_ID: 'claude-1' }, 'omni-1'],
    ['CLAUDE_CODE_SESSION_ID', { CLAUDE_CODE_SESSION_ID: 'claude-1' }, 'claude-1'],
  ])('takes the id from %s and stores none', async (_name, env, id) => {
    const c = await checkout();
    const { code, lines } = await run(['start'], { ...c, env });
    expect(code).toBe(0);
    expect(lines.at(-1)).toBe(`session: ${id}`);
    expect(stored(c.root)).toBeNull();
  });

  it('takes the id stored for the checkout, and keeps it', async () => {
    const c = await checkout();
    const first = await run(['start'], c);
    const second = await run(['start'], c);
    expect(second.lines.at(-1)).toBe(first.lines.at(-1));
  });

  it('still prints the briefing and exits 0 with the Omni page unreachable', async () => {
    const c = await checkout();
    const { code, lines } = await run(['start'], { ...c, fetch: offline });
    expect(code).toBe(0);
    expect(lines[0]).toMatch(/^no constituents: offline/);
    expect(lines).toContain('# Briefing');
    expect(lines.at(-1)).toMatch(UUID);
  });

  it('is a usage error with another verb', async () => {
    const c = await checkout();
    expect((await run(['begin'], c)).code).toBe(2);
    expect((await run(['start', 'now'], c)).code).toBe(2);
  });
});

const NOW = 1_000_000;

/** A cache record checked `agoMs` before the session's clock, orange so the block shows a headline. */
function record(agoMs: number): SyncRecord {
  return {
    checkedAt: new Date(NOW - agoMs).toISOString(),
    status: 'orange',
    headline: 'main is 3 behind',
    setupDoneAt: new Date(0).toISOString(),
    setup: null,
    findings: [{ check: 'main', severity: 'orange', text: 'main is 3 behind', fix: 'omni sync --fix' }],
    fix: 'omni sync --fix',
  };
}

describe('omni session start: the sync block', () => {
  it('prints it between the constituents and the briefing, from a cache under 15 minutes old', async () => {
    const c = await checkout();
    writeSyncCache(c.root, record(5 * 60_000));
    const { code, lines } = await run(['start'], c);
    expect(code).toBe(0);
    const block = lines.indexOf('🟠 Needs action · main is 3 behind');
    expect(block).toBeGreaterThan(lines.findIndex((line) => line.includes('Sells gadgets')));
    expect(block).toBeLessThan(lines.indexOf('# Briefing'));
    expect(lines.some((line) => line.startsWith('sync: checked'))).toBe(false);
  });

  it('refreshes a stale cache within the budget and prints the new block', async () => {
    const c = await checkout();
    writeSyncCache(c.root, record(2 * 3_600_000));
    const { code, lines } = await run(['start'], c);
    expect(code).toBe(0);
    expect(readSyncCache(c.root)?.checkedAt).not.toBe(record(2 * 3_600_000).checkedAt);
    expect(lines.some((line) => line.startsWith('sync: checked'))).toBe(false);
    expect(lines.indexOf('# Briefing')).toBeGreaterThan(0);
  });

  it('prints the stale cache with its age when the budget is spent', async () => {
    const c = await checkout();
    writeSyncCache(c.root, record(2 * 3_600_000));
    const { code, lines } = await run(['start'], { ...c, extra: { syncBudgetMs: 1 } });
    expect(code).toBe(0);
    expect(lines).toContain('sync: checked 2 h ago');
    expect(lines).toContain('🟠 Needs action · main is 3 behind');
    expect(lines.indexOf('sync: checked 2 h ago')).toBeLessThan(lines.indexOf('# Briefing'));
  });

  it('says it is not checked yet when there is no cache and the budget is spent', async () => {
    const c = await checkout();
    const { code, lines } = await run(['start'], { ...c, extra: { syncBudgetMs: 1 } });
    expect(code).toBe(0);
    expect(lines).toContain('sync: not checked yet');
    expect(lines.at(-1)).toMatch(UUID);
  });
});

describe('omni session end', () => {
  it("closes the session's ask session and sends ended: true", async () => {
    const c = await checkout();
    const env = { OMNI_SESSION_ID: 'agent-1' };
    const opened = c.server.openSession('acme/widgets').id;
    writeTerminal(c.root, 'agent-1', { sessionId: opened, host: c.server.host });
    const { code, lines } = await run(['end'], { ...c, env });
    expect({ code, lines }).toEqual({ code: 0, lines: [''] });
    expect(c.server.sessions.get(opened)?.status).toBe('closed');
    expect(readTerminal(c.root, 'agent-1')).toBeNull();
    const beats = c.server.calls.filter((call) => call.path === '/api/ask/heartbeat');
    expect(beats.map((call) => [dig(call.body, 'claudeSessionId'), dig(call.body, 'ended')])).toEqual([['agent-1', true]]);
  });

  it('uses the stored id when no variable gives one', async () => {
    const c = await checkout();
    const id = (await run(['start'], c)).lines.at(-1)?.slice('session: '.length);
    await run(['end'], c);
    const beats = c.server.calls.filter((call) => call.path === '/api/ask/heartbeat');
    expect(beats.map((call) => dig(call.body, 'claudeSessionId'))).toEqual([id]);
  });

  it('exits 0, printing nothing, when the close and the heartbeat both fail', async () => {
    const c = await checkout();
    writeTerminal(c.root, 'agent-1', { sessionId: 'gone', host: c.server.host });
    const { code, lines, err } = await run(['end'], { ...c, fetch: offline, env: { OMNI_SESSION_ID: 'agent-1' } });
    expect({ code, lines, err }).toEqual({ code: 0, lines: [''], err: '' });
    expect(readTerminal(c.root, 'agent-1')).toBeNull();
  });

  it('does nothing, and generates no id, when none resolves', async () => {
    const c = await checkout();
    expect((await run(['end'], c)).code).toBe(0);
    expect(stored(c.root)).toBeNull();
    expect(c.server.calls).toEqual([]);
  });
});
