// `omni ask on`, `omni ask off` and `omni ask status`: ask mode switched on and off in one checkout,
// seen from the outside — the server is the fake contract server, the sign-in an in-memory token
// store or a temporary home folder. The real `~/.config/omni/` is never touched.
import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { firstOptionAnswers, startFakeAskServer } from '../test/fake-ask-server.mjs';
import { makeRepo } from '../test/fixture.mjs';
import { activeSession } from '../lib/ask/hook.mjs';
import { readRound, readSession, writeRound, writeSession } from '../lib/ask/local-state.mjs';
import { ASK_URL_UNSET } from './commands/signin.mjs';
import { main } from './omni.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const CLI = join(repoRoot, 'kit/bin/omni.mjs');

const QUESTION = {
  question: 'Which theme should the page open in?',
  header: 'Theme',
  multiSelect: false,
  options: [{ label: 'System (Recommended)', description: 'follow the computer' }, { label: 'Dark', description: 'always dark' }],
};
const PRE = JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: { questions: [QUESTION] }, tool_use_id: 'toolu_01' });

function io() {
  const out = [];
  const err = [];
  return { out: () => out.join(''), err: () => err.join(''), stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } };
}

function memoryTokens(entries = {}) {
  const store = { ...entries };
  return { store, read: (host) => store[host] ?? null, write: (host, tokens) => { store[host] = tokens; } };
}

const config = (url, slug = 'acme/widgets') =>
  `kit: 1\nrepo:\n  slug: ${slug}\nask:\n  url: ${url === null ? 'null' : url}\n`;

/** Runs the real CLI in a child process, without blocking this process's event loop. */
function runCli(args, { cwd, env = {} }) {
  return new Promise((resolve) => {
    execFile(process.execPath, [CLI, ...args], { cwd, env: { ...process.env, ...env }, encoding: 'utf8' }, (error, stdout, stderr) => {
      resolve({ status: error ? error.code : 0, stdout, stderr });
    });
  });
}

let server;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

/** A checkout whose `ask.url` is the fake server, signed in to it. */
async function signedIn(options = {}) {
  server = await startFakeAskServer(options);
  const repo = makeRepo({ git: true, files: { '.omni-loop/config.yml': config(server.url) } });
  const tokens = memoryTokens({ [server.host]: { access_token: 'access-1', refresh_token: 'refresh-1', email: 'ada@example.com' } });
  return { ...repo, tokens };
}

const ask = (sub, { root, tokens, ...more }) => {
  const s = io();
  return main(['ask', sub], { cwd: root, ...s, tokens, ...more }).then((code) => ({ code, ...s }));
};

describe('omni ask on', () => {
  it('opens a session titled <repo slug> · <branch>, writes ask.json and prints one link', async () => {
    const { root, tokens } = await signedIn();
    const run = await ask('on', { root, tokens });

    expect(run.err()).toBe('');
    expect(run.code).toBe(0);
    const [session] = server.sessions.values();
    expect(session).toMatchObject({ title: 'acme/widgets · main', status: 'open' });
    expect(run.out()).toBe(`${server.url}/ask/${session.id}\n`);
    expect(readSession(root)).toEqual({ sessionId: session.id, url: `${server.url}/ask/${session.id}`, host: server.host });
    // The hooks now see the mode as on, and send their calls to ask.url.
    expect(activeSession(root)).toEqual({ session: readSession(root), baseUrl: server.url });
  });

  it('names the branch the checkout is on', async () => {
    const { root, tokens } = await signedIn();
    execFileSync('git', ['switch', '-q', '-c', 'feat/theme-switch'], { cwd: root });
    expect((await ask('on', { root, tokens })).code).toBe(0);
    expect([...server.sessions.values()][0].title).toBe('acme/widgets · feat/theme-switch');
  });

  it('leaves nothing for git to commit', async () => {
    const { root, tokens } = await signedIn();
    expect((await ask('on', { root, tokens })).code).toBe(0);
    expect(execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' })).toBe('');
  });

  it('signed out, exits 1, says omni signin, and opens nothing', async () => {
    const { root } = await signedIn();
    const run = await ask('on', { root, tokens: memoryTokens() });
    expect(run.code).toBe(1);
    expect(run.out()).toBe('');
    expect(run.err()).toMatch(/`omni signin`/);
    expect(run.err().trim().split('\n')).toHaveLength(1);
    expect(server.calls).toEqual([]);
    expect(readSession(root)).toBeNull();
  });

  it('with ask.url null, exits 1 with the one-line reason', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config(null) } });
    const run = await ask('on', { root, tokens: memoryTokens() });
    expect(run.code).toBe(1);
    expect(run.out()).toBe('');
    expect(run.err()).toBe(`${ASK_URL_UNSET}\n`);
    expect(readSession(root)).toBeNull();
  });

  it('a second on in the same checkout closes the first session', async () => {
    const { root, tokens } = await signedIn();
    await ask('on', { root, tokens });
    const first = readSession(root);
    writeRound(root, { roundId: 'round-old', toolUseId: 'toolu_00', status: 'open' });

    const run = await ask('on', { root, tokens });

    expect(run.err()).toBe('');
    expect(run.code).toBe(0);
    const second = readSession(root);
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(run.out()).toBe(`${second.url}\n`);
    expect(server.sessions.get(first.sessionId).status).toBe('closed');
    expect(server.sessions.get(second.sessionId).status).toBe('open');
    // The round of the first session is not the second's.
    expect(readRound(root)).toBeNull();
  });

  it('keeps the current session when a new one cannot be opened', async () => {
    const { root, tokens } = await signedIn();
    await ask('on', { root, tokens });
    const first = readSession(root);
    await server.close();

    const run = await ask('on', { root, tokens });

    expect(run.code).toBe(1);
    expect(run.out()).toBe('');
    expect(run.err().startsWith(`omni ask on: could not open a session on ${server.host}`)).toBe(true);
    expect(run.err().trim().split('\n')).toHaveLength(1);
    expect(readSession(root)).toEqual(first);
  });

  it('refreshes a sign-in the server refuses once, and says omni signin when the refresh is refused too', async () => {
    const { root, tokens } = await signedIn();
    server.expireAccess();
    expect((await ask('on', { root, tokens })).code).toBe(0);
    expect(tokens.store[server.host].access_token).toBe('access-2');

    await ask('off', { root, tokens });
    server.expireAccess();
    server.expireRefresh();
    const run = await ask('on', { root, tokens });
    expect(run.code).toBe(1);
    expect(run.err()).toMatch(/`omni signin`/);
    expect(readSession(root)).toBeNull();
  });
});

describe('omni ask off', () => {
  it('closes the session, deletes ask.json and the round, and prints off', async () => {
    const { root, tokens } = await signedIn();
    await ask('on', { root, tokens });
    const { sessionId } = readSession(root);
    writeRound(root, { roundId: 'round-1', toolUseId: 'toolu_01', status: 'open' });

    const run = await ask('off', { root, tokens });

    expect(run.err()).toBe('');
    expect(run.code).toBe(0);
    expect(run.out()).toBe('off\n');
    expect(server.sessions.get(sessionId).status).toBe('closed');
    expect(readSession(root)).toBeNull();
    expect(readRound(root)).toBeNull();
    expect(activeSession(root)).toBeNull();
  });

  it('prints off and calls nothing when the mode is already off', async () => {
    const { root, tokens } = await signedIn();
    const run = await ask('off', { root, tokens });
    expect(run.code).toBe(0);
    expect(run.out()).toBe('off\n');
    expect(run.err()).toBe('');
    expect(server.calls).toEqual([]);
  });

  it('turns the mode off here even when the server cannot be reached, and says the session was left open', async () => {
    const { root, tokens } = await signedIn();
    await ask('on', { root, tokens });
    await server.close();

    const run = await ask('off', { root, tokens });

    expect(run.code).toBe(0);
    expect(run.out()).toBe('off\n');
    expect(run.err()).toMatch(/^omni ask off: could not close the session/);
    expect(run.err().trim().split('\n')).toHaveLength(1);
    expect(readSession(root)).toBeNull();
  });

  it('turns the mode off here when ask.url is null or names another server', async () => {
    for (const url of [null, 'https://ask.example.com']) {
      const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config(url) } });
      writeSession(root, { sessionId: 's-1', url: 'https://elsewhere.example.com/ask/s-1', host: 'elsewhere.example.com' });
      const run = await ask('off', { root, tokens: memoryTokens() });
      expect(run.code).toBe(0);
      expect(run.out()).toBe('off\n');
      expect(run.err()).toMatch(/^omni ask off: could not close the session/);
      expect(readSession(root)).toBeNull();
    }
  });

  it('says nothing more when the server no longer knows the session', async () => {
    const { root, tokens } = await signedIn();
    writeSession(root, { sessionId: 'sess-gone', url: `${server.url}/ask/sess-gone`, host: server.host });
    const run = await ask('off', { root, tokens });
    expect(run.code).toBe(0);
    expect(run.out()).toBe('off\n');
    expect(run.err()).toBe('');
    expect(readSession(root)).toBeNull();
  });
});

describe('omni ask status', () => {
  it('prints the link while the mode is on, and off otherwise', async () => {
    const { root, tokens } = await signedIn();
    expect((await ask('status', { root, tokens })).out()).toBe('off\n');
    const on = await ask('on', { root, tokens });
    const status = await ask('status', { root, tokens });
    expect(status.code).toBe(0);
    expect(status.out()).toBe(on.out());
    await ask('off', { root, tokens });
    expect((await ask('status', { root, tokens })).out()).toBe('off\n');
  });

  it('prints off when ask.url is null or names another server, as the hooks read it', async () => {
    for (const url of [null, 'https://ask.example.com']) {
      const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config(url) } });
      writeSession(root, { sessionId: 's-1', url: 'https://elsewhere.example.com/ask/s-1', host: 'elsewhere.example.com' });
      const run = await ask('status', { root, tokens: memoryTokens() });
      expect(run.code).toBe(0);
      expect(run.out()).toBe('off\n');
    }
  });
});

describe('ask mode, whole', () => {
  it('on, a question answered on the page, off — and the hooks go quiet', async () => {
    const { root, tokens } = await signedIn({ answer: (round) => firstOptionAnswers(round.questions) });
    expect((await ask('on', { root, tokens })).code).toBe(0);

    const pre = io();
    expect(await main(['ask', 'hook', 'pre'], { cwd: root, ...pre, stdin: PRE, tokens })).toBe(0);
    expect(JSON.parse(pre.out()).hookSpecificOutput.updatedInput.answers).toEqual({ [QUESTION.question]: 'System (Recommended)' });

    expect((await ask('off', { root, tokens })).code).toBe(0);
    const [session] = server.sessions.values();
    expect(session.status).toBe('closed');
    const calls = server.calls.length;
    const quiet = io();
    expect(await main(['ask', 'hook', 'pre'], { cwd: root, ...quiet, stdin: PRE, tokens })).toBe(0);
    expect(quiet.out()).toBe('');
    expect(server.calls).toHaveLength(calls);
  });

  it('runs as a process, reading the sign-in from the home folder', async () => {
    server = await startFakeAskServer();
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config(server.url) } });
    const home = mkdtempSync(join(tmpdir(), 'omni-home-'));
    mkdirSync(join(home, '.config', 'omni'), { recursive: true });
    writeFileSync(join(home, '.config', 'omni', 'credentials.json'), JSON.stringify({ [server.host]: { access_token: 'access-1', refresh_token: 'refresh-1' } }), { mode: 0o600 });
    const env = { HOME: home };

    const on = await runCli(['ask', 'on'], { cwd: root, env });
    expect(on.stderr).toBe('');
    expect(on.status).toBe(0);
    expect(on.stdout).toMatch(new RegExp(`^${server.url}/ask/\\S+\\n$`));
    expect((await runCli(['ask', 'status'], { cwd: root, env })).stdout).toBe(on.stdout);
    const off = await runCli(['ask', 'off'], { cwd: root, env });
    expect(off).toEqual({ status: 0, stdout: 'off\n', stderr: '' });
    expect(existsSync(join(root, '.omni-loop/local/ask.json'))).toBe(false);
    expect(JSON.parse(readFileSync(join(home, '.config', 'omni', 'credentials.json'), 'utf8'))).toHaveProperty(server.host);
  }, 30000);
});

describe('omni ask on, off and status usage', () => {
  it('takes no argument', async () => {
    for (const sub of ['on', 'off', 'status']) {
      const s = io();
      expect(await main(['ask', sub, 'extra'], { cwd: tmpdir(), ...s })).toBe(2);
      expect(s.err()).toMatch(/^usage: omni ask/);
      expect(s.err()).toMatch(/omni ask <on\|off\|status>/);
    }
  });

  it('is a configuration error outside a repository', async () => {
    const outside = mkdtempSync(join(tmpdir(), 'omni-nogit-'));
    for (const sub of ['on', 'off', 'status']) {
      const s = io();
      expect(await main(['ask', sub], { cwd: outside, ...s, tokens: memoryTokens() })).toBe(2);
      expect(s.err()).toMatch(/is not inside a git repository/);
    }
  });
});
