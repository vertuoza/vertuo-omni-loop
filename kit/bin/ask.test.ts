// `omni ask on`, `omni ask off` and `omni ask status`: ask mode switched on and off in one checkout,
// seen from the outside — the server is the fake contract server, the sign-in an in-memory token
// store or a temporary home folder. The real `~/.config/omni/` is never touched.
import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { firstOptionAnswers, startFakeAskServer } from '../test/fake-ask-server.ts';
import { makeRepo } from '../test/fixture.ts';
import { activeMode } from '../lib/ask/hook.ts';
import { LOCAL_DIR, readMode, readRound, readTerminal, writeRound, writeTerminal } from '../lib/ask/local-state.ts';
import { ASK_URL_UNSET } from './commands/signin.ts';
import { main } from './omni.ts';
import type { Tokens } from '../lib/ask/schema.ts';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const CLI = join(repoRoot, 'kit/bin/omni.ts');

const QUESTION = {
  question: 'Which theme should the page open in?',
  header: 'Theme',
  multiSelect: false,
  options: [{ label: 'System (Recommended)', description: 'follow the computer' }, { label: 'Dark', description: 'always dark' }],
};
const preFrom = (terminalId: string, toolUseId = 'toolu_01') =>
  JSON.stringify({ hook_event_name: 'PreToolUse', session_id: terminalId, tool_name: 'AskUserQuestion', tool_input: { questions: [QUESTION] }, tool_use_id: toolUseId });
const PRE = preFrom('term-a');

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out: () => out.join(''), err: () => err.join(''), stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

function memoryTokens(entries: Record<string, Tokens> = {}) {
  const store: Record<string, Tokens> = { ...entries };
  return { store, read: (host: string) => store[host] ?? null, write: (host: string, tokens: Tokens) => { store[host] = tokens; } };
}

const config = (url: string | null, slug = 'acme/widgets') =>
  `kit: 1\nrepo:\n  slug: ${slug}\nask:\n  url: ${url === null ? 'null' : url}\n`;

/** Runs the real CLI in a child process, without blocking this process's event loop. */
function runCli(args: string[], { cwd, env = {} }) {
  return new Promise((resolve) => {
    execFile(process.execPath, [CLI, ...args], { cwd, env: { ...process.env, ...env }, encoding: 'utf8' }, (error, stdout, stderr) => {
      resolve({ status: error ? error.code : 0, stdout, stderr });
    });
  });
}

/** The calls the server got, but the one asking where questions land (PRD 459). */
const sessionCalls = () => server.calls.filter((call) => call.path !== '/api/ask/workspace');
const WHERE = 'GET /api/ask/workspace';
const whereCalls = () => server.calls.filter((call) => `${call.method} ${call.path}` === WHERE);

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

const ask = (sub: string, { root, tokens, ...more }) => {
  const s = io();
  return main(['ask', sub], { cwd: root, ...s, tokens, ...more }).then((code) => ({ code, ...s }));
};

const hook = (kind: string, stdin: string, { root, tokens }) => {
  const s = io();
  return main(['ask', 'hook', kind], { cwd: root, ...s, stdin, tokens }).then((code) => ({ code, ...s }));
};

describe('omni ask on', () => {
  it('writes ask.json as { host }, prints the person\'s page, and opens no session', async () => {
    const { root, tokens } = await signedIn();
    const run = await ask('on', { root, tokens });

    expect(run.err()).toBe('');
    expect(run.code).toBe(0);
    expect(run.out()).toBe(`${server.url}/ask\n`);
    expect(JSON.parse(readFileSync(join(root, LOCAL_DIR, 'ask.json'), 'utf8'))).toEqual({ host: server.host });
    expect(sessionCalls()).toEqual([]);
    // The hooks now see the mode as on, and send their calls to ask.url.
    expect(activeMode(root)).toEqual({ host: server.host, baseUrl: server.url });
  });

  it('run twice, changes nothing and prints the same page', async () => {
    const { root, tokens } = await signedIn();
    const first = await ask('on', { root, tokens });
    writeTerminal(root, 'term-a', { sessionId: 'sess-a', host: server.host });
    const before = readFileSync(join(root, LOCAL_DIR, 'ask.json'), 'utf8');

    const second = await ask('on', { root, tokens });

    expect(second.code).toBe(0);
    expect(second.out()).toBe(first.out());
    expect(readFileSync(join(root, LOCAL_DIR, 'ask.json'), 'utf8')).toBe(before);
    expect(readTerminal(root, 'term-a')).toEqual({ sessionId: 'sess-a', host: server.host });
    expect(sessionCalls()).toEqual([]);
  });

  it('in a second terminal, leaves the first terminal\'s session open and its mode on', async () => {
    const { root, tokens } = await signedIn({ answer: (round) => firstOptionAnswers(round.questions) });
    await ask('on', { root, tokens });
    expect((await hook('pre', preFrom('term-a'), { root, tokens })).code).toBe(0);
    const { sessionId } = readTerminal(root, 'term-a');

    await ask('on', { root, tokens });

    expect(server.sessions.get(sessionId).status).toBe('open');
    expect(readTerminal(root, 'term-a')).toEqual({ sessionId, host: server.host });
    const again = await hook('pre', preFrom('term-a', 'toolu_02'), { root, tokens });
    expect(JSON.parse(again.out()).hookSpecificOutput.updatedInput.answers).toEqual({ [QUESTION.question]: 'System (Recommended)' });
    expect(server.sessions.size).toBe(1);
  });

  it('keeps an ask.json in PRD 71\'s shape on the same host, so off can still close its session', async () => {
    const { root, tokens, write } = await signedIn();
    const legacy = { sessionId: 'sess-71', url: `${server.url}/ask/sess-71`, host: server.host };
    write(`${LOCAL_DIR}/ask.json`, JSON.stringify(legacy));
    expect((await ask('on', { root, tokens })).out()).toBe(`${server.url}/ask\n`);
    expect(readMode(root)).toEqual({ host: server.host, sessionId: 'sess-71' });
  });

  it('says where the checkout\'s questions land: its workspace\'s page (PRD 459)', async () => {
    const { root, tokens } = await signedIn({ place: () => ({ workspace: { slug: 'acme', name: 'Acme' }, reason: null }) });
    const run = await ask('on', { root, tokens });
    expect(run.err()).toBe('');
    expect(run.code).toBe(0);
    expect(run.out()).toBe(`${server.url}/ask\nquestions go to Acme's page\n`);
    expect(whereCalls().map((call) => call.authorization)).toEqual(['Bearer access-1']);
    expect(activeMode(root)).toEqual({ host: server.host, baseUrl: server.url });
  });

  it('asks for the checkout\'s repository, repo.slug', async () => {
    const asked: unknown[] = [];
    const { root, tokens } = await signedIn({ place: (repo: any) => { asked.push(repo); return { workspace: { slug: 'acme', name: 'Acme' }, reason: null }; } });
    await ask('on', { root, tokens });
    expect(asked).toEqual(['acme/widgets']);
  });

  it('prints the page\'s reason when the repository goes nowhere, and still turns ask mode on', async () => {
    const reason = 'you are not a member of Globex, which owns acme/widgets';
    const { root, tokens } = await signedIn({ place: () => ({ workspace: null, reason }) });
    const run = await ask('on', { root, tokens });
    expect(run.code).toBe(0);
    expect(run.out()).toBe(`${server.url}/ask\n${reason}\n`);
    expect(run.err()).toBe('');
    expect(activeMode(root)).toEqual({ host: server.host, baseUrl: server.url });
  });

  it('with the page unreachable, an older page, or nothing it can say, prints the page alone and turns ask mode on', async () => {
    for (const setUp of [
      async () => { const repo = await signedIn(); await server.close(); return repo; },
      () => signedIn(),
      () => signedIn({ place: () => ({ workspace: null, reason: null }) }),
    ]) {
      const { root, tokens } = await setUp();
      const url = server.url;
      const run = await ask('on', { root, tokens });
      expect(run.code).toBe(0);
      expect(run.out()).toBe(`${url}/ask\n`);
      expect(run.err()).toBe('');
      expect(activeMode(root)).toEqual({ host: server.host, baseUrl: url });
      await server.close();
    }
  });

  it('signed out, exits 1, says omni signin, and writes nothing', async () => {
    const { root } = await signedIn();
    const run = await ask('on', { root, tokens: memoryTokens() });
    expect(run.code).toBe(1);
    expect(run.out()).toBe('');
    expect(run.err()).toMatch(/`omni signin`/);
    expect(run.err().trim().split('\n')).toHaveLength(1);
    expect(server.calls).toEqual([]);
    expect(readMode(root)).toBeNull();
  });

  it('with ask.url null, exits 1 with the one-line reason', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config(null) } });
    const run = await ask('on', { root, tokens: memoryTokens() });
    expect(run.code).toBe(1);
    expect(run.out()).toBe('');
    expect(run.err()).toBe(`${ASK_URL_UNSET}\n`);
    expect(readMode(root)).toBeNull();
  });

  it('leaves nothing for git to commit', async () => {
    const { root, tokens } = await signedIn();
    expect((await ask('on', { root, tokens })).code).toBe(0);
    expect(execFileSync('git', ['status', '--porcelain', '--untracked-files=all'], { cwd: root, encoding: 'utf8' })).toBe('');
  });
});

describe('each terminal\'s session', () => {
  it('is titled <repo slug> · <branch>, opened by its first question', async () => {
    const { root, tokens } = await signedIn({ answer: (round) => firstOptionAnswers(round.questions) });
    execFileSync('git', ['switch', '-q', '-c', 'feat/theme-switch'], { cwd: root });
    await ask('on', { root, tokens });
    expect((await hook('pre', PRE, { root, tokens })).code).toBe(0);
    const [session] = server.sessions.values();
    expect(session).toMatchObject({ title: 'acme/widgets · feat/theme-switch', status: 'open' });
  });

  it('two terminals asking open two sessions', async () => {
    const { root, tokens } = await signedIn({ answer: (round) => firstOptionAnswers(round.questions) });
    await ask('on', { root, tokens });
    await hook('pre', preFrom('term-a', 'toolu_a'), { root, tokens });
    await hook('pre', preFrom('term-b', 'toolu_b'), { root, tokens });
    expect(server.sessions.size).toBe(2);
    expect(readTerminal(root, 'term-a')!.sessionId).not.toBe(readTerminal(root, 'term-b')!.sessionId);
  });
});

describe('omni ask off', () => {
  it('closes every terminal\'s session, deletes ask.json and ask/, and prints off', async () => {
    const { root, tokens } = await signedIn({ answer: (round) => firstOptionAnswers(round.questions) });
    await ask('on', { root, tokens });
    await hook('pre', preFrom('term-a', 'toolu_a'), { root, tokens });
    await hook('pre', preFrom('term-b', 'toolu_b'), { root, tokens });
    writeRound(root, 'toolu_c', { roundId: 'round-c', status: 'open' });

    const run = await ask('off', { root, tokens });

    expect(run.err()).toBe('');
    expect(run.code).toBe(0);
    expect(run.out()).toBe('off\n');
    expect([...server.sessions.values()].map((session) => session.status)).toEqual(['closed', 'closed']);
    expect(readMode(root)).toBeNull();
    expect(existsSync(join(root, LOCAL_DIR, 'ask'))).toBe(false);
    expect(readRound(root, 'toolu_c')).toBeNull();
    expect(activeMode(root)).toBeNull();
    expect((await ask('status', { root, tokens })).out()).toBe('off\n');
  });

  it('closes PRD 71\'s session when ask.json still names one', async () => {
    const { root, tokens, write } = await signedIn();
    const { id, url } = server.openSession('acme/widgets · main');
    write(`${LOCAL_DIR}/ask.json`, JSON.stringify({ sessionId: id, url, host: server.host }));
    write(`${LOCAL_DIR}/ask-round.json`, JSON.stringify({ roundId: 'round-71', toolUseId: 'toolu_01', status: 'open' }));

    const run = await ask('off', { root, tokens });

    expect(run.err()).toBe('');
    expect(run.out()).toBe('off\n');
    expect(server.sessions.get(id).status).toBe('closed');
    expect(readMode(root)).toBeNull();
    expect(existsSync(join(root, LOCAL_DIR, 'ask-round.json'))).toBe(false);
  });

  it('prints off and calls nothing when the mode is already off', async () => {
    const { root, tokens } = await signedIn();
    const run = await ask('off', { root, tokens });
    expect(run.code).toBe(0);
    expect(run.out()).toBe('off\n');
    expect(run.err()).toBe('');
    expect(server.calls).toEqual([]);
  });

  it('turns the mode off here even when the server cannot be reached, and names each session left open', async () => {
    const { root, tokens } = await signedIn();
    await ask('on', { root, tokens });
    writeTerminal(root, 'term-a', { sessionId: 'sess-a', host: server.host });
    writeTerminal(root, 'term-b', { sessionId: 'sess-b', host: server.host });
    await server.close();

    const run = await ask('off', { root, tokens });

    expect(run.code).toBe(0);
    expect(run.out()).toBe('off\n');
    const lines = run.err().trim().split('\n');
    expect(lines).toHaveLength(2);
    for (const line of lines) expect(line).toMatch(/^omni ask off: could not close a session/);
    expect(readMode(root)).toBeNull();
    expect(existsSync(join(root, LOCAL_DIR, 'ask'))).toBe(false);
  });

  it('turns the mode off here when ask.url is null or names another server', async () => {
    for (const url of [null, 'https://ask.example.com']) {
      const { root, write } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config(url) } });
      write(`${LOCAL_DIR}/ask.json`, JSON.stringify({ host: 'elsewhere.example.com' }));
      writeTerminal(root, 'term-a', { sessionId: 's-1', host: 'elsewhere.example.com' });
      const run = await ask('off', { root, tokens: memoryTokens() });
      expect(run.code).toBe(0);
      expect(run.out()).toBe('off\n');
      expect(run.err()).toMatch(/^omni ask off: could not close a session/);
      expect(readMode(root)).toBeNull();
      expect(readTerminal(root, 'term-a')).toBeNull();
    }
  });

  it('says nothing more when the server no longer knows a session', async () => {
    const { root, tokens } = await signedIn();
    await ask('on', { root, tokens });
    writeTerminal(root, 'term-a', { sessionId: 'sess-gone', host: server.host });
    const run = await ask('off', { root, tokens });
    expect(run.code).toBe(0);
    expect(run.out()).toBe('off\n');
    expect(run.err()).toBe('');
    expect(readTerminal(root, 'term-a')).toBeNull();
  });
});

describe('omni ask status', () => {
  it('prints the person\'s page while the mode is on, and off otherwise, calling nothing while off', async () => {
    const { root, tokens } = await signedIn();
    expect((await ask('status', { root, tokens })).out()).toBe('off\n');
    expect(server.calls).toEqual([]);
    const on = await ask('on', { root, tokens });
    const status = await ask('status', { root, tokens });
    expect(status.code).toBe(0);
    expect(status.out()).toBe(on.out());
    await ask('off', { root, tokens });
    const calls = server.calls.length;
    expect((await ask('status', { root, tokens })).out()).toBe('off\n');
    expect(server.calls).toHaveLength(calls);
    expect(sessionCalls()).toEqual([]);
  });

  it('while on, says where the questions land, or the page\'s reason (PRD 459)', async () => {
    let placed = { workspace: { slug: 'acme', name: 'Acme' }, reason: null };
    const { root, tokens } = await signedIn({ place: () => placed });
    await ask('on', { root, tokens });
    expect((await ask('status', { root, tokens })).out()).toBe(`${server.url}/ask\nquestions go to Acme's page\n`);
    placed = { workspace: null, reason: 'no workspace owns acme/widgets yet — install the Omni App: https://github.com/apps/omni/installations/new' };
    const refused = await ask('status', { root, tokens });
    expect(refused.code).toBe(0);
    expect(refused.out()).toBe(`${server.url}/ask\n${placed.reason}\n`);
  });

  it('while on, with the page unreachable, prints the page alone', async () => {
    const { root, tokens } = await signedIn({ place: () => ({ workspace: { slug: 'acme', name: 'Acme' }, reason: null }) });
    await ask('on', { root, tokens });
    const url = server.url;
    await server.close();
    const status = await ask('status', { root, tokens });
    expect(status).toMatchObject({ code: 0 });
    expect(status.out()).toBe(`${url}/ask\n`);
    expect(status.err()).toBe('');
  });

  it('reads an ask.json in PRD 71\'s shape as on', async () => {
    const { root, tokens, write } = await signedIn();
    write(`${LOCAL_DIR}/ask.json`, JSON.stringify({ sessionId: 'sess-71', url: `${server.url}/ask/sess-71`, host: server.host }));
    expect((await ask('status', { root, tokens })).out()).toBe(`${server.url}/ask\n`);
  });

  it('prints off when ask.url is null or names another server, as the hooks read it', async () => {
    for (const url of [null, 'https://ask.example.com']) {
      const { root, write } = makeRepo({ git: true, files: { '.omni-loop/config.yml': config(url) } });
      write(`${LOCAL_DIR}/ask.json`, JSON.stringify({ host: 'elsewhere.example.com' }));
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

    const pre = await hook('pre', PRE, { root, tokens });
    expect(pre.code).toBe(0);
    expect(JSON.parse(pre.out()).hookSpecificOutput.updatedInput.answers).toEqual({ [QUESTION.question]: 'System (Recommended)' });

    expect((await ask('off', { root, tokens })).code).toBe(0);
    const [session] = server.sessions.values();
    expect(session.status).toBe('closed');
    const calls = server.calls.length;
    const quiet = await hook('pre', PRE, { root, tokens });
    expect(quiet.code).toBe(0);
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
    expect(on.stdout).toBe(`${server.url}/ask\n`);
    expect((await runCli(['ask', 'status'], { cwd: root, env })).stdout).toBe(on.stdout);
    const off = await runCli(['ask', 'off'], { cwd: root, env });
    expect(off).toEqual({ status: 0, stdout: 'off\n', stderr: '' });
    expect(existsSync(join(root, '.omni-loop/local/ask.json'))).toBe(false);
    expect(JSON.parse(readFileSync(join(home, '.config', 'omni', 'credentials.json'), 'utf8'))).toHaveProperty(server.host);
  });
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
