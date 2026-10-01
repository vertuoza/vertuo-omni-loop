// `omni heartbeat [--end]` through `main()` (PRD 757): the throttle, the body, when it stays silent,
// and that it always exits 0 — against the fake contract server.
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { startFakeAskServer } from '../test/fake-ask-server.ts';
import { makeRepo } from '../test/fixture.ts';
import { HEARTBEAT_EVERY_MS } from '../lib/ask/heartbeat.ts';
import { main } from './omni.ts';

function io() {
  const out = [];
  const err = [];
  return { out, err, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } };
}

function memoryTokens(entries) {
  const store = { ...entries };
  return { store, read: (host) => store[host] ?? null, write: (host, tokens) => { store[host] = tokens; } };
}

let server;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

const configText = (url, { dossier = true } = {}) =>
  `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${url === null ? 'null' : url}\ndossier:\n  enabled: ${dossier}\n`;

async function signedIn(options = {}, { dossier = true, askUrl } = {}) {
  server = await startFakeAskServer(options);
  const repo = makeRepo({
    git: true,
    files: {
      '.omni-loop/config.yml': configText(askUrl === undefined ? server.url : askUrl, { dossier }),
      '.omni-loop/delivery/inbox/0757-play-while-working/spec.md': '# spec\n',
    },
  });
  const tokens = memoryTokens({ [server.host]: { access_token: 'access-1', refresh_token: 'refresh-1' } });
  return { ...repo, tokens };
}

const input = (root, session = 'claude-a') => JSON.stringify({ hook_event_name: 'PostToolUse', session_id: session, cwd: root, tool_name: 'Bash' });

async function beat(root, { tokens, now = () => 1_000_000, session = 'claude-a', args = [] } = {}) {
  const s = io();
  const code = await main(['heartbeat', ...args], { cwd: root, ...s, stdin: input(root, session), tokens, now });
  return { code, out: s.out.join(''), err: s.err.join('') };
}

const heartbeatCalls = () => server.calls.filter((call) => call.path === '/api/ask/heartbeat');

describe('omni heartbeat', () => {
  it('makes one call for 100 runs within 60 s, a second after 60 s, and a window per Claude session', async () => {
    const { root, tokens } = await signedIn();
    const t0 = 1_000_000;
    for (let i = 0; i < 100; i += 1) {
      expect(await beat(root, { tokens, now: () => t0 + i * 500 })).toEqual({ code: 0, out: '', err: '' });
    }
    expect(heartbeatCalls()).toHaveLength(1);
    await beat(root, { tokens, now: () => t0 + HEARTBEAT_EVERY_MS });
    expect(heartbeatCalls()).toHaveLength(2);
    await beat(root, { tokens, now: () => t0 + HEARTBEAT_EVERY_MS + 1, session: 'claude-b' });
    expect(heartbeatCalls().map((call) => call.body.claudeSessionId)).toEqual(['claude-a', 'claude-a', 'claude-b']);
  });

  it('sends exactly claudeSessionId, repo and work, with the bearer token', async () => {
    const { root, tokens } = await signedIn();
    spawnSync('git', ['checkout', '-q', '-b', 'feat/play-while-working--s1'], { cwd: root });
    await beat(root, { tokens });
    const [call] = heartbeatCalls();
    expect(call.authorization).toBe('Bearer access-1');
    expect(call.body).toEqual({ claudeSessionId: 'claude-a', repo: 'acme/widgets', work: { kind: 'prd', number: 757 } });
    expect(server.heartbeats).toHaveLength(1);
  });

  it('sends work: null on a branch the loop does not know', async () => {
    const { root, tokens } = await signedIn();
    await beat(root, { tokens });
    expect(heartbeatCalls()[0].body).toEqual({ claudeSessionId: 'claude-a', repo: 'acme/widgets', work: null });
  });

  it('--end sends ended: true once, with work null, inside the window too', async () => {
    const { root, tokens } = await signedIn();
    spawnSync('git', ['checkout', '-q', '-b', 'feat/play-while-working'], { cwd: root });
    await beat(root, { tokens });
    expect(await beat(root, { tokens, args: ['--end'] })).toEqual({ code: 0, out: '', err: '' });
    expect(heartbeatCalls().map((call) => call.body)).toEqual([
      { claudeSessionId: 'claude-a', repo: 'acme/widgets', work: { kind: 'prd', number: 757 } },
      { claudeSessionId: 'claude-a', repo: 'acme/widgets', work: null, ended: true },
    ]);
  });

  it('makes no call and exits 0 signed out, with dossier.enabled false, or with ask.url null', async () => {
    const signedOut = await signedIn();
    expect(await beat(signedOut.root, { tokens: memoryTokens({}) })).toEqual({ code: 0, out: '', err: '' });
    expect(server.calls).toEqual([]);
    await server.close();

    const off = await signedIn({}, { dossier: false });
    expect(await beat(off.root, { tokens: off.tokens })).toEqual({ code: 0, out: '', err: '' });
    expect(await beat(off.root, { tokens: off.tokens, args: ['--end'] })).toEqual({ code: 0, out: '', err: '' });
    expect(server.calls).toEqual([]);
    await server.close();

    const noUrl = await signedIn({}, { askUrl: null });
    expect(await beat(noUrl.root, { tokens: noUrl.tokens })).toEqual({ code: 0, out: '', err: '' });
    expect(server.calls).toEqual([]);
  });

  it('exits 0 with no output on 401, 404, 500 and a timeout past 2 s', async () => {
    for (const status of [404, 500]) {
      const { root, tokens } = await signedIn({ heartbeat: () => ({ status }) });
      expect(await beat(root, { tokens })).toEqual({ code: 0, out: '', err: '' });
      expect(heartbeatCalls()).toHaveLength(1);
      await server.close();
    }

    const refused = await signedIn();
    server.denyAccess();
    expect(await beat(refused.root, { tokens: refused.tokens })).toEqual({ code: 0, out: '', err: '' });
    expect(heartbeatCalls()).toHaveLength(2);
    await server.close();

    const slow = await signedIn({ heartbeat: () => ({ status: 204, delayMs: 5000 }) });
    const started = Date.now();
    expect(await beat(slow.root, { tokens: slow.tokens })).toEqual({ code: 0, out: '', err: '' });
    expect(Date.now() - started).toBeLessThan(3000);
    expect(server.heartbeats).toEqual([]);
  });

  it('exits 0 with no output outside a repository, with no config, and with any stdin or arguments', async () => {
    const bare = makeRepo({ git: true });
    for (const stdin of ['', 'not json', '{}', input(bare.root)]) {
      const s = io();
      expect(await main(['heartbeat'], { cwd: bare.root, ...s, stdin })).toBe(0);
      expect(s.out.join('') + s.err.join('')).toBe('');
    }
    const s = io();
    expect(await main(['heartbeat', 'extra', '--what'], { cwd: bare.root, ...s, stdin: '' })).toBe(0);
    expect(s.out.join('') + s.err.join('')).toBe('');
  });
});
