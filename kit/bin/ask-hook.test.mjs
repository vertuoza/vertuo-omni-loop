// `omni ask hook <pre|post|prompt>` and the plugin's hooks.json that runs it: the hook bodies seen
// from the outside — stdin in, stdout out, exit code — against the fake contract server.
import { execFile, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { firstOptionAnswers, startFakeAskServer } from '../test/fake-ask-server.mjs';
import { makeRepo } from '../test/fixture.mjs';
import { PROMPT_CONTEXT } from '../lib/ask/hook.mjs';
import { readRound, readSession, writeRound, writeSession } from '../lib/ask/local-state.mjs';
import { main } from './omni.mjs';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const CLI = join(repoRoot, 'kit/bin/omni.mjs');
const HOOKS = join(repoRoot, 'kit/plugin/hooks/hooks.json');
const KINDS = ['pre', 'post', 'prompt'];

const QUESTION = {
  question: 'Which theme should the page open in?',
  header: 'Theme',
  multiSelect: false,
  options: [{ label: 'System (Recommended)', description: 'follow the computer' }, { label: 'Dark', description: 'always dark' }],
};
const PRE = JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: { questions: [QUESTION] }, tool_use_id: 'toolu_01' });
const STDINS = ['', 'not json at all', '{}', PRE, JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: 'hello' })];

function io() {
  const out = [];
  const err = [];
  return { out, err, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } };
}

function memoryTokens(entries) {
  const store = { ...entries };
  return { store, read: (host) => store[host] ?? null, write: (host, tokens) => { store[host] = tokens; } };
}

/** Runs the real CLI in a child process, without blocking this process's event loop. */
function runCli(args, { cwd, input = '', env = {} }) {
  return new Promise((resolve) => {
    const child = execFile(process.execPath, [CLI, ...args], { cwd, env: { ...process.env, ...env }, encoding: 'utf8' }, (error, stdout, stderr) => {
      resolve({ status: error ? error.code : 0, stdout, stderr });
    });
    child.stdin.end(input);
  });
}

let server;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

async function modeOn(options = {}) {
  server = await startFakeAskServer(options);
  const repo = makeRepo({ git: true, files: { '.omni-loop/config.yml': `kit: 1\nask:\n  url: ${server.url}\n` } });
  const { id, url } = server.openSession('acme/widgets · main');
  writeSession(repo.root, { sessionId: id, url, host: server.host });
  const tokens = memoryTokens({ [server.host]: { access_token: 'access-1', refresh_token: 'refresh-1' } });
  return { ...repo, sessionId: id, tokens };
}

// A few tests below start a process per case; the full suite runs them under load.
const SPAWNS_MS = 30000;

describe('omni ask hook, with the mode off', () => {
  it('exits 0 with empty stdout for every hook and any stdin, with no ask.json', () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': 'kit: 1\nask:\n  url: https://ask.example.com\n' } });
    for (const kind of KINDS) {
      for (const input of STDINS) {
        const run = spawnSync(process.execPath, [CLI, 'ask', 'hook', kind], { cwd: root, input, encoding: 'utf8' });
        expect({ kind, input, status: run.status, stdout: run.stdout }).toEqual({ kind, input, status: 0, stdout: '' });
      }
    }
  }, SPAWNS_MS);

  it('stays quiet with no config, a broken config, or outside a repository', () => {
    const bare = makeRepo({ git: true });
    const broken = makeRepo({ git: true, files: { '.omni-loop/config.yml': 'kit: [\n' } });
    writeSession(broken.root, { sessionId: 's', url: 'https://ask.example.com/ask/s', host: 'ask.example.com' });
    const outside = mkdtempSync(join(tmpdir(), 'omni-nogit-'));
    for (const cwd of [bare.root, broken.root, outside]) {
      for (const kind of KINDS) {
        const run = spawnSync(process.execPath, [CLI, 'ask', 'hook', kind], { cwd, input: PRE, encoding: 'utf8' });
        expect({ cwd, kind, status: run.status, stdout: run.stdout, stderr: run.stderr }).toEqual({ cwd, kind, status: 0, stdout: '', stderr: '' });
      }
    }
  }, SPAWNS_MS);

  it('stays quiet when ask.url is null, even with ask.json left behind', async () => {
    const { root, write, tokens } = await modeOn();
    write('.omni-loop/config.yml', 'kit: 1\n');
    for (const kind of KINDS) {
      const s = io();
      expect(await main(['ask', 'hook', kind], { cwd: root, ...s, stdin: PRE, tokens })).toBe(0);
      expect(s.out.join('')).toBe('');
    }
    expect(server.calls).toEqual([]);
  });
});

describe('omni ask hook, with the mode on', () => {
  it('pre prints the page\'s answer as one line of hook output', async () => {
    const { root, tokens } = await modeOn({ answer: (round) => firstOptionAnswers(round.questions) });
    const s = io();
    expect(await main(['ask', 'hook', 'pre'], { cwd: root, ...s, stdin: PRE, tokens })).toBe(0);
    expect(s.out.join('')).toBe(`${JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        updatedInput: { questions: [QUESTION], answers: { [QUESTION.question]: 'System (Recommended)' } },
      },
    })}\n`);
    expect(s.err).toEqual([]);
  });

  it('pre abandons the round and prints nothing when the page never answers', async () => {
    const { root, tokens } = await modeOn({ holdMs: 20 });
    const s = io();
    expect(await main(['ask', 'hook', 'pre'], { cwd: root, ...s, stdin: PRE, tokens, limits: { totalMs: 150, callMs: 1000 } })).toBe(0);
    expect(s.out).toEqual([]);
    expect([...server.rounds.values()][0].status).toBe('abandoned');
  });

  it('pre prints nothing within 2 s when the server is down', async () => {
    const { root, tokens } = await modeOn();
    await server.close();
    const s = io();
    const started = Date.now();
    expect(await main(['ask', 'hook', 'pre'], { cwd: root, ...s, stdin: PRE, tokens })).toBe(0);
    expect(Date.now() - started).toBeLessThan(2000);
    expect(s.out).toEqual([]);
  });

  it('pre deletes ask.json when the session is closed', async () => {
    // The session closes while the hook waits on its round, the moment that round is posted.
    const { root, tokens } = await modeOn({ answer: (round) => { setImmediate(() => server.closeSession(round.sessionId)); return null; } });
    const s = io();
    expect(await main(['ask', 'hook', 'pre'], { cwd: root, ...s, stdin: PRE, tokens, limits: { totalMs: 2000, callMs: 1000 } })).toBe(0);
    expect(s.out).toEqual([]);
    expect(readSession(root)).toBeNull();
  });

  it('post sends the terminal answer only for a round the page did not answer, then deletes the round', async () => {
    const { root, tokens, sessionId } = await modeOn();
    const answered = { questions: [QUESTION], answers: { [QUESTION.question]: 'Dark' } };
    const post = JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'AskUserQuestion', tool_input: { questions: [QUESTION] }, tool_response: answered, tool_use_id: 'toolu_01' });

    server.rounds.clear();
    writeRound(root, { roundId: 'round-page', toolUseId: 'toolu_01', status: 'answered' });
    expect(await main(['ask', 'hook', 'post'], { cwd: root, ...io(), stdin: post, tokens })).toBe(0);
    expect(server.calls).toEqual([]);
    expect(readRound(root)).toBeNull();

    const token = tokens.read(server.host).access_token;
    const opened = await fetch(`${server.url}/api/ask/sessions/${sessionId}/rounds`, {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ questions: [QUESTION] }),
    }).then((response) => response.json());
    writeRound(root, { roundId: opened.roundId, toolUseId: 'toolu_01', status: 'abandoned' });
    const s = io();
    expect(await main(['ask', 'hook', 'post'], { cwd: root, ...s, stdin: post, tokens })).toBe(0);
    expect(s.out).toEqual([]);
    expect(server.rounds.get(opened.roundId)).toMatchObject({ status: 'answered', answeredVia: 'terminal', answers: { [QUESTION.question]: 'Dark' } });
    expect(readRound(root)).toBeNull();
  });

  it('prompt prints the one sentence of context', async () => {
    const { root, tokens } = await modeOn();
    const s = io();
    expect(await main(['ask', 'hook', 'prompt'], { cwd: root, ...s, stdin: '{"prompt":"hi"}', tokens })).toBe(0);
    expect(JSON.parse(s.out.join(''))).toEqual({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: PROMPT_CONTEXT } });
    expect(server.calls).toEqual([]);
  });

  it('runs end to end as a process: stdin in, the sign-in read from the home folder, stdout out', async () => {
    const { root } = await modeOn({ answer: (round) => firstOptionAnswers(round.questions) });
    const home = mkdtempSync(join(tmpdir(), 'omni-home-'));
    mkdirSync(join(home, '.config', 'omni'), { recursive: true });
    writeFileSync(join(home, '.config', 'omni', 'credentials.json'), JSON.stringify({ [server.host]: { access_token: 'expired', refresh_token: 'refresh-1' } }));
    const run = await runCli(['ask', 'hook', 'pre'], { cwd: root, input: PRE, env: { HOME: home } });
    expect(run.stderr).toBe('');
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout).hookSpecificOutput.updatedInput.answers).toEqual({ [QUESTION.question]: 'System (Recommended)' });
    // The expired token was refreshed once, and the new one kept.
    expect(server.calls.filter((call) => call.path === '/api/ask/token')).toHaveLength(1);
    const kept = JSON.parse(readFileSync(join(home, '.config', 'omni', 'credentials.json'), 'utf8'));
    expect(kept[server.host].access_token).toBe('access-2');
  });
});

describe('omni ask usage', () => {
  it('refuses anything but hook pre, post or prompt', async () => {
    for (const args of [['ask'], ['ask', 'hook'], ['ask', 'hook', 'later'], ['ask', 'hook', 'pre', 'extra'], ['ask', 'dance']]) {
      const s = io();
      expect(await main(args, { cwd: tmpdir(), ...s })).toBe(2);
      expect(s.err.join('')).toMatch(/^usage: omni ask hook <pre\|post\|prompt>/);
    }
  });
});

describe('the plugin\'s hooks.json', () => {
  const hooks = JSON.parse(readFileSync(HOOKS, 'utf8')).hooks;
  const only = (event) => {
    expect(hooks[event]).toHaveLength(1);
    expect(hooks[event][0].hooks).toHaveLength(1);
    return { matcher: hooks[event][0].matcher, ...hooks[event][0].hooks[0] };
  };

  it('wires PreToolUse and PostToolUse on AskUserQuestion, and UserPromptSubmit', () => {
    expect(Object.keys(hooks).sort()).toEqual(['PostToolUse', 'PreToolUse', 'UserPromptSubmit']);
    const pre = only('PreToolUse');
    const post = only('PostToolUse');
    const prompt = only('UserPromptSubmit');
    expect(pre).toMatchObject({ matcher: 'AskUserQuestion', type: 'command', timeout: 600 });
    expect(post).toMatchObject({ matcher: 'AskUserQuestion', type: 'command' });
    expect(prompt).toMatchObject({ type: 'command' });
    expect(prompt.matcher).toBeUndefined();
    for (const [kind, hook] of [['pre', pre], ['post', post], ['prompt', prompt]]) {
      expect(hook.command).toMatch(new RegExp(`^node "\\$CLAUDE_PROJECT_DIR/\\.omni-loop/bin/omni\\.mjs" ask hook ${kind}\\b`));
    }
  });

  it('never fails a hook: a checkout without the kit, or with an omni that has no ask, exits 0 and prints nothing', () => {
    const withoutKit = makeRepo({ git: true });
    const oldKit = makeRepo({ git: true, files: { '.omni-loop/bin/omni.mjs': 'process.stderr.write("usage: omni <command>\\n"); process.exit(2);\n' } });
    for (const { root } of [withoutKit, oldKit]) {
      for (const event of Object.keys(hooks)) {
        const { command } = hooks[event][0].hooks[0];
        const run = spawnSync('sh', ['-c', command], { cwd: root, input: PRE, encoding: 'utf8', env: { ...process.env, CLAUDE_PROJECT_DIR: root } });
        expect({ event, status: run.status, stdout: run.stdout }).toEqual({ event, status: 0, stdout: '' });
      }
    }
  }, SPAWNS_MS);

  it('runs the checkout\'s own omni', async () => {
    const { root, tokens } = await modeOn({ answer: (round) => firstOptionAnswers(round.questions) });
    const shim = `import { main } from ${JSON.stringify(CLI)};\nmain(process.argv.slice(2)).then((code) => process.exit(code));\n`;
    mkdirSync(join(root, '.omni-loop', 'bin'), { recursive: true });
    writeFileSync(join(root, '.omni-loop', 'bin', 'omni.mjs'), shim);
    const home = mkdtempSync(join(tmpdir(), 'omni-home-'));
    mkdirSync(join(home, '.config', 'omni'), { recursive: true });
    writeFileSync(join(home, '.config', 'omni', 'credentials.json'), JSON.stringify({ [server.host]: tokens.read(server.host) }));
    const { command } = only('UserPromptSubmit');
    const run = await new Promise((resolve) => {
      const child = execFile('sh', ['-c', command], { cwd: root, env: { ...process.env, HOME: home, CLAUDE_PROJECT_DIR: root }, encoding: 'utf8' },
        (error, stdout) => resolve({ status: error ? error.code : 0, stdout }));
      child.stdin.end('{"prompt":"hi"}');
    });
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout).hookSpecificOutput.additionalContext).toBe(PROMPT_CONTEXT);
  });
});
