// `omni heartbeat [--end]` through `main()` (PRD 757): the throttle, the body, when it stays silent,
// and that it always exits 0 — against the fake contract server.
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';
import { startFakeAskServer } from '../test/fake-ask-server.ts';
import { assertDefined } from '../test/assert.ts';
import { makeRepo } from '../test/fixture.ts';
import { HEARTBEAT_EVERY_MS } from '../lib/ask/heartbeat.ts';
import { dig } from './dig.ts';
import { main } from './omni.ts';
import type { Tokens } from '../lib/ask/schema.ts';
import type { FakeAskServer } from '../test/fake-ask-server.ts';

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

function memoryTokens(entries: Record<string, Tokens> = {}) {
  const store: Record<string, Tokens> = { ...entries };
  return { store, read: (host: string) => store[host] ?? null, write: (host: string, tokens: Tokens) => { store[host] = tokens; } };
}

let server: FakeAskServer;
/** Every server a test started, each closed after it: the next test starts its own. */
const started: FakeAskServer[] = [];
afterEach(async () => {
  for (const running of started.splice(0)) await running.close();
});

const configText = (url: string | null, { dossier = true } = {}) =>
  `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${url === null ? 'null' : url}\ndossier:\n  enabled: ${dossier}\n`;

async function signedIn(options: Parameters<typeof startFakeAskServer>[0] = {}, { dossier = true, askUrl }: { dossier?: boolean; askUrl?: string | null } = {}) {
  server = await startFakeAskServer(options);
  started.push(server);
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

const input = (root: string, session = 'claude-a') => JSON.stringify({ hook_event_name: 'PostToolUse', session_id: session, cwd: root, tool_name: 'Bash' });

async function beat(
  root: string,
  { tokens, now = () => 1_000_000, session = 'claude-a', args = [] }: { tokens?: unknown; now?: () => number; session?: string; args?: string[] } = {},
) {
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
    expect(heartbeatCalls().map((call) => dig(call.body, 'claudeSessionId'))).toEqual(['claude-a', 'claude-a', 'claude-b']);
  });

  it('sends exactly claudeSessionId, repo and work, with the bearer token', async () => {
    const { root, tokens } = await signedIn();
    spawnSync('git', ['checkout', '-q', '-b', 'feat/play-while-working--s1'], { cwd: root });
    await beat(root, { tokens });
    const [call] = heartbeatCalls();
    assertDefined(call, 'the heartbeat');
    expect(call.authorization).toBe('Bearer access-1');
    expect(call.body).toEqual({ claudeSessionId: 'claude-a', repo: 'acme/widgets', work: { kind: 'prd', number: 757 } });
    expect(server.heartbeats).toHaveLength(1);
  });

  it('sends work: null on a branch the loop does not know', async () => {
    const { root, tokens } = await signedIn();
    await beat(root, { tokens });
    expect(heartbeatCalls()[0]?.body).toEqual({ claudeSessionId: 'claude-a', repo: 'acme/widgets', work: null });
  });

  it('--end sends ended: true once, with work null, inside the window too', async () => {
    const { root, tokens } = await signedIn();
    spawnSync('git', ['checkout', '-q', '-b', 'feat/play-while-working'], { cwd: root });
    await beat(root, { tokens });
    expect(await beat(root, { tokens, args: ['--end'] })).toEqual({ code: 0, out: '', err: '' });
    expect(heartbeatCalls().map((call): unknown => call.body)).toEqual([
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

  it('with empty stdin, sends under OMNI_SESSION_ID, else CLAUDE_CODE_SESSION_ID, else the stored id (PRD 1831)', async () => {
    const { root, tokens, write } = await signedIn();
    const byHand = async (env: Record<string, string>, now: number) => {
      const s = io();
      expect(await main(['heartbeat'], { cwd: root, ...s, stdin: '', env, tokens, now: () => now })).toBe(0);
    };
    await byHand({ OMNI_SESSION_ID: 'agent-a', CLAUDE_CODE_SESSION_ID: 'claude-z' }, 1_000_000);
    await byHand({ CLAUDE_CODE_SESSION_ID: 'claude-z' }, 1_000_000);
    write('.omni-loop/local/session.json', `${JSON.stringify({ id: 'stored-1' })}\n`);
    await byHand({}, 1_000_000);
    await byHand({}, 1_000_001);
    expect(heartbeatCalls().map((call) => dig(call.body, 'claudeSessionId'))).toEqual(['agent-a', 'claude-z', 'stored-1']);
  });

  it('with --claimed, sends inside the window its starter claimed, and claims nothing (PRD 1831)', async () => {
    const { root, tokens } = await signedIn();
    await beat(root, { tokens });
    expect(await beat(root, { tokens, args: ['--claimed'], now: () => 1_000_001 })).toEqual({ code: 0, out: '', err: '' });
    expect(heartbeatCalls()).toHaveLength(2);
  });
});

describe('the heartbeat any omni command sends (PRD 1831)', () => {
  type Spawned = { args: readonly string[]; options: unknown };

  async function run(argv: string[], { root, tokens, env, now = 1_000_000, spawned }: { root: string; tokens: ReturnType<typeof memoryTokens>; env: Record<string, string>; now?: number; spawned: Spawned[] }) {
    const s = io();
    const spawn = (_command: string, args: readonly string[], options: unknown) => {
      spawned.push({ args, options });
      return { unref: () => undefined };
    };
    const code = await main(argv, { cwd: root, ...s, env, stdin: '', heartbeat: { spawn, now: () => now, tokens } });
    return { code, out: s.out.join(''), err: s.err.join('') };
  }

  it('starts one detached child for two commands within a minute, a second after it, and changes no output', async () => {
    const { root, tokens } = await signedIn();
    const spawned: Spawned[] = [];
    const env = { OMNI_SESSION_ID: 'agent-a' };
    const first = await run(['help'], { root, tokens, env, spawned });
    const second = await run(['help'], { root, tokens, env, now: 1_030_000, spawned });
    expect(spawned).toHaveLength(1);
    expect(spawned[0]?.args.slice(1)).toEqual(['heartbeat', '--claimed']);
    expect(spawned[0]?.options).toMatchObject({ cwd: root, detached: true, stdio: 'ignore', env });
    const quiet = await run(['help'], { root, tokens, env: { ...env, OMNI_HEARTBEAT: 'off' }, spawned });
    expect(first).toEqual(quiet);
    expect(second).toEqual(quiet);
    await run(['help'], { root, tokens, env, now: 1_000_000 + HEARTBEAT_EVERY_MS, spawned });
    expect(spawned).toHaveLength(2);
    expect(server.calls).toEqual([]);
  });

  it('starts none when off, under vitest, with no session id, signed out, or after heartbeat, ask hook, session end and statusline', async () => {
    const { root, tokens } = await signedIn();
    const spawned: Spawned[] = [];
    const env = { OMNI_SESSION_ID: 'agent-a' };
    await run(['help'], { root, tokens, env: { ...env, OMNI_HEARTBEAT: 'off' }, spawned });
    await run(['help'], { root, tokens, env: { ...env, VITEST: 'true' }, spawned });
    await run(['help'], { root, tokens, env: {}, spawned });
    await run(['help'], { root, tokens: memoryTokens({}), env, spawned });
    for (const argv of [['heartbeat'], ['ask', 'hook', 'post'], ['session', 'end'], ['statusline']]) {
      await run(argv, { root, tokens, env, spawned });
    }
    expect(spawned).toEqual([]);
  });

  it('starts none with dossiers off or outside a repository, and the command still exits as it does', async () => {
    const off = await signedIn({}, { dossier: false });
    const spawned: Spawned[] = [];
    expect((await run(['help'], { root: off.root, tokens: off.tokens, env: { OMNI_SESSION_ID: 'agent-a' }, spawned })).code).toBe(0);
    const bare = makeRepo({ git: true });
    expect((await run(['help'], { root: bare.root, tokens: off.tokens, env: { OMNI_SESSION_ID: 'agent-a' }, spawned })).code).toBe(0);
    expect(spawned).toEqual([]);
  });
});
