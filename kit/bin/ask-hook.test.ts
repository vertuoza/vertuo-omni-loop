// `omni ask hook <pre|post|prompt|end>` and the plugin's hooks.json that runs it: the hook bodies seen
// from the outside — stdin in, stdout out, exit code — against the fake contract server.
import { execFile, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { firstOptionAnswers, startFakeAskServer } from '../test/fake-ask-server.ts';
import { makeRepo } from '../test/fixture.ts';
import { PROMPT_CONTEXT } from '../lib/ask/hook.ts';
import { readMode, readRound, readTerminal, writeMode, writeRound, writeTerminal } from '../lib/ask/local-state.ts';
import { main } from './omni.ts';
import type { Tokens } from '../lib/ask/schema.ts';
import type { FakeAskServer } from '../test/fake-ask-server.ts';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));
const CLI = join(repoRoot, 'kit/bin/omni.ts');
const HOOKS = join(repoRoot, 'kit/plugin/hooks/hooks.json');
const KINDS = ['pre', 'post', 'prompt', 'end'];

const QUESTION = {
  question: 'Which theme should the page open in?',
  header: 'Theme',
  multiSelect: false,
  options: [{ label: 'System (Recommended)', description: 'follow the computer' }, { label: 'Dark', description: 'always dark' }],
};
const PRE = JSON.stringify({ hook_event_name: 'PreToolUse', session_id: 'term-a', tool_name: 'AskUserQuestion', tool_input: { questions: [QUESTION] }, tool_use_id: 'toolu_01' });
const STDINS = ['', 'not json at all', '{}', PRE, JSON.stringify({ hook_event_name: 'UserPromptSubmit', prompt: 'hello' })];

function io() {
  const out: string[] = [];
  const err: string[] = [];
  return { out, err, stdout: { write: (s: string) => out.push(s) }, stderr: { write: (s: string) => err.push(s) } };
}

function memoryTokens(entries: Record<string, Tokens> = {}) {
  const store: Record<string, Tokens> = { ...entries };
  return { store, read: (host: string) => store[host] ?? null, write: (host: string, tokens: Tokens) => { store[host] = tokens; } };
}

/** Runs the real CLI in a child process, without blocking this process's event loop. */
/** What a run of the CLI as a process came to: its exit status and its output. */
type CliRun = { status: number | string | null | undefined; stdout: string; stderr: string };

function runCli(args: string[], { cwd, input = '', env = {} }: { cwd: string; input?: string; env?: Record<string, string> }) {
  return new Promise<CliRun>((resolve) => {
    const child = execFile(process.execPath, [CLI, ...args], { cwd, env: { ...process.env, ...env }, encoding: 'utf8' }, (error, stdout, stderr) => {
      resolve({ status: error ? error.code : 0, stdout, stderr });
    });
    child.stdin!.end(input);
  });
}

let server: FakeAskServer;
afterEach(async () => {
  await server?.close();
  server = undefined as unknown as FakeAskServer; // the next test starts its own
});

async function modeOn(options: Parameters<typeof startFakeAskServer>[0] = {}) {
  server = await startFakeAskServer(options);
  const repo = makeRepo({ git: true, files: { '.omni-loop/config.yml': `kit: 1\nask:\n  url: ${server.url}\n` } });
  writeMode(repo.root, { host: server.host });
  const { id } = server.openSession('acme/widgets · main');
  writeTerminal(repo.root, 'term-a', { sessionId: id, host: server.host });
  const tokens = memoryTokens({ [server.host]: { access_token: 'access-1', refresh_token: 'refresh-1' } });
  return { ...repo, sessionId: id, tokens };
}

// The hook matrix runs in this process, through `main()` with stdin and stdout injected: a process per
// case, each loading the CLI from source, outran its time limit on a busy machine (PRD 976). What only
// a process proves (the end-to-end run, the plugin's wiring, never failing a hook) spawns once.

/** `omni ask hook <kind>` run in this process, signed in nowhere: its exit code and what it wrote. */
async function runHook(kind: string, { cwd, stdin }: { cwd: string; stdin: string }) {
  const s = io();
  const code = await main(['ask', 'hook', kind], { cwd, ...s, stdin, tokens: memoryTokens() });
  return { code, stdout: s.out.join(''), stderr: s.err.join('') };
}

describe('omni ask hook, with the mode off', () => {
  it('exits 0 with empty stdout for every hook and any stdin, with no ask.json', async () => {
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': 'kit: 1\nask:\n  url: https://ask.example.com\n' } });
    for (const kind of KINDS) {
      for (const input of STDINS) {
        const run = await runHook(kind, { cwd: root, stdin: input });
        expect({ kind, input, code: run.code, stdout: run.stdout }).toEqual({ kind, input, code: 0, stdout: '' });
      }
    }
  });

  it('stays quiet with no config, a broken config, or outside a repository', async () => {
    const bare = makeRepo({ git: true });
    const broken = makeRepo({ git: true, files: { '.omni-loop/config.yml': 'kit: [\n' } });
    writeMode(broken.root, { host: 'ask.example.com' });
    const outside = mkdtempSync(join(tmpdir(), 'omni-nogit-'));
    for (const cwd of [bare.root, broken.root, outside]) {
      for (const kind of KINDS) {
        expect({ cwd, kind, ...(await runHook(kind, { cwd, stdin: PRE })) }).toEqual({ cwd, kind, code: 0, stdout: '', stderr: '' });
      }
    }
  });

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

  it('pre sends where the question came from and what the session had cost, read from the config, git and the transcript', async () => {
    const { root, write, tokens } = await modeOn({ answer: (round) => firstOptionAnswers(round.questions) });
    write('.omni-loop/config.yml', `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${server.url}\n`);
    write('.omni-loop/delivery/inbox/0144-question-history/spec.md', '# spec\n');
    spawnSync('git', ['checkout', '-q', '-b', 'feat/question-history--s1'], { cwd: root });
    const transcript = join(root, 'transcript.jsonl');
    writeFileSync(transcript, [
      JSON.stringify({ type: 'user', message: { role: 'user', content: '<command-name>/omni:brainstorm</command-name>' } }),
      JSON.stringify({ type: 'assistant', message: { id: 'm1', model: 'claude-opus-4-1', usage: { input_tokens: 5, output_tokens: 2, cache_read_input_tokens: 40, cache_creation_input_tokens: 8 } } }),
      JSON.stringify({ type: 'assistant', message: { id: 'm1', model: 'claude-opus-4-1', usage: { input_tokens: 5, output_tokens: 2, cache_read_input_tokens: 40, cache_creation_input_tokens: 8 } } }),
    ].join('\n'));
    const stdin = JSON.stringify({ ...JSON.parse(PRE), session_id: 'claude-7', transcript_path: transcript, cwd: root });
    expect(await main(['ask', 'hook', 'pre'], { cwd: root, ...io(), stdin, tokens })).toBe(0);
    const [round] = server.rounds.values();
    expect(round.context).toEqual({
      repo: 'acme/widgets',
      branch: 'feat/question-history--s1',
      prd: 144,
      claudeSessionId: 'claude-7',
      skill: '/omni:brainstorm',
      model: 'claude-opus-4-1',
      tokens: { input: 5, output: 2, cacheRead: 40, cacheWrite: 8 },
    });
  });

  it('pre sends the lead: only the text Claude wrote before asking, never tool input, tool output, thinking or a user message (PRD 752)', async () => {
    const { root, tokens } = await modeOn({ answer: (round) => firstOptionAnswers(round.questions) });
    const transcript = join(root, 'transcript.jsonl');
    writeFileSync(transcript, [
      { type: 'user', message: { role: 'user', content: 'design it, the password is hunter2' } },
      { type: 'assistant', message: { id: 'm1', content: [{ type: 'thinking', thinking: 'private reasoning' }] } },
      { type: 'assistant', message: { id: 'm1', content: [{ type: 'tool_use', id: 'toolu_r', name: 'Read', input: { file_path: '/tool-input.txt' } }] } },
      { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_r', content: 'tool output' }] } },
      { type: 'assistant', message: { id: 'm2', content: [{ type: 'text', text: '## The design' }] } },
      { type: 'assistant', message: { id: 'm2', content: [{ type: 'text', text: 'A lead and a fold.' }] } },
      { type: 'assistant', message: { id: 'm2', content: [{ type: 'tool_use', id: 'toolu_01', name: 'AskUserQuestion', input: { questions: [QUESTION] } }] } },
    ].map((entry) => JSON.stringify(entry)).join('\n'));
    const stdin = JSON.stringify({ ...JSON.parse(PRE), transcript_path: transcript, cwd: root });
    expect(await main(['ask', 'hook', 'pre'], { cwd: root, ...io(), stdin, tokens })).toBe(0);
    const sent = server.calls.find((call) => call.path.endsWith('/rounds'));
    expect(sent!.body.lead).toBe('## The design\n\nA lead and a fold.');
    for (const word of ['hunter2', 'private reasoning', 'tool-input', 'tool output']) expect(JSON.stringify(sent!.body)).not.toContain(word);
    expect([...server.rounds.values()][0].lead).toBe('## The design\n\nA lead and a fold.');
  });

  it('pre sends no lead, and still asks, when the transcript cannot be read', async () => {
    const { root, tokens } = await modeOn({ answer: (round) => firstOptionAnswers(round.questions) });
    const stdin = JSON.stringify({ ...JSON.parse(PRE), transcript_path: join(root, 'gone.jsonl') });
    const s = io();
    expect(await main(['ask', 'hook', 'pre'], { cwd: root, ...s, stdin, tokens })).toBe(0);
    expect(JSON.parse(s.out.join('')).hookSpecificOutput.updatedInput.answers).toEqual({ [QUESTION.question]: 'System (Recommended)' });
    expect(server.calls.find((call) => call.path.endsWith('/rounds'))!.body).not.toHaveProperty('lead');
  });

  it('a session open sends context.repo, read from the config', async () => {
    server = await startFakeAskServer({ answer: (round) => firstOptionAnswers(round.questions) });
    const { root } = makeRepo({ git: true, files: { '.omni-loop/config.yml': `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${server.url}\n` } });
    const tokens = memoryTokens({ [server.host]: { access_token: 'access-1', refresh_token: 'refresh-1' } });
    expect(await main(['ask', 'on'], { cwd: root, ...io(), tokens })).toBe(0);
    // `on` opens no session (PRD 142): the terminal's first question does, and says where it came from.
    expect(server.calls.find((call) => call.path === '/api/ask/sessions')).toBeUndefined();
    expect(await main(['ask', 'hook', 'pre'], { cwd: root, ...io(), stdin: PRE, tokens })).toBe(0);
    const opened = server.calls.find((call) => call.path === '/api/ask/sessions');
    expect(opened!.body).toEqual({ title: 'acme/widgets · main', context: { repo: 'acme/widgets' } });
  });

  it('pre still asks with nulls in the context when there is no transcript and HEAD is detached', async () => {
    const { root, tokens } = await modeOn({ answer: (round) => firstOptionAnswers(round.questions) });
    spawnSync('git', ['checkout', '-q', '--detach'], { cwd: root });
    const stdin = JSON.stringify({ ...JSON.parse(PRE), transcript_path: join(root, 'gone.jsonl') });
    const s = io();
    expect(await main(['ask', 'hook', 'pre'], { cwd: root, ...s, stdin, tokens })).toBe(0);
    expect(JSON.parse(s.out.join('')).hookSpecificOutput.updatedInput.answers).toEqual({ [QUESTION.question]: 'System (Recommended)' });
    const [round] = server.rounds.values();
    expect(round.context).toMatchObject({ branch: null, prd: null, skill: null, model: null, tokens: null });
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

  it('pre forgets only this terminal\'s session when it is closed, and the mode stays on', async () => {
    // The session closes while the hook waits on its round, the moment that round is posted.
    const { root, tokens } = await modeOn({ answer: (round) => { setImmediate(() => server.closeSession(round.sessionId)); return null; } });
    const s = io();
    expect(await main(['ask', 'hook', 'pre'], { cwd: root, ...s, stdin: PRE, tokens, limits: { totalMs: 2000, callMs: 1000 } })).toBe(0);
    expect(s.out).toEqual([]);
    expect(readTerminal(root, 'term-a')).toBeNull();
    expect(readMode(root)).toEqual({ host: server.host, sessionId: null });
  });

  it('post sends the terminal answer only for a round the page did not answer, then deletes the round', async () => {
    const { root, tokens, sessionId } = await modeOn();
    const answered = { questions: [QUESTION], answers: { [QUESTION.question]: 'Dark' } };
    const post = JSON.stringify({ hook_event_name: 'PostToolUse', tool_name: 'AskUserQuestion', tool_input: { questions: [QUESTION] }, tool_response: answered, tool_use_id: 'toolu_01' });

    server.rounds.clear();
    writeRound(root, 'toolu_01', { roundId: 'round-page', status: 'answered' });
    expect(await main(['ask', 'hook', 'post'], { cwd: root, ...io(), stdin: post, tokens })).toBe(0);
    expect(server.calls).toEqual([]);
    expect(readRound(root, 'toolu_01')).toBeNull();

    const token = tokens.read(server.host)!.access_token;
    const opened = await fetch(`${server.url}/api/ask/sessions/${sessionId}/rounds`, {
      method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify({ questions: [QUESTION] }),
    }).then((response) => response.json());
    writeRound(root, 'toolu_01', { roundId: opened.roundId, status: 'abandoned' });
    const s = io();
    expect(await main(['ask', 'hook', 'post'], { cwd: root, ...s, stdin: post, tokens })).toBe(0);
    expect(s.out).toEqual([]);
    expect(server.rounds.get(opened.roundId)).toMatchObject({ status: 'answered', answeredVia: 'terminal', answers: { [QUESTION.question]: 'Dark' } });
    expect(readRound(root, 'toolu_01')).toBeNull();
  });

  it('end closes this terminal\'s session only, deletes its file, and prints nothing', async () => {
    const { root, tokens, sessionId } = await modeOn();
    const other = server.openSession('acme/widgets · main');
    writeTerminal(root, 'term-b', { sessionId: other.id, host: server.host });
    const s = io();
    expect(await main(['ask', 'hook', 'end'], { cwd: root, ...s, stdin: JSON.stringify({ hook_event_name: 'SessionEnd', session_id: 'term-a', reason: 'exit' }), tokens })).toBe(0);
    expect(s.out).toEqual([]);
    expect(server.sessions.get(sessionId).status).toBe('closed');
    expect(server.sessions.get(other.id).status).toBe('open');
    expect(readTerminal(root, 'term-a')).toBeNull();
    expect(readTerminal(root, 'term-b')).toEqual({ sessionId: other.id, host: server.host });
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
  it('refuses anything but hook pre, post, prompt or end', async () => {
    for (const args of [['ask'], ['ask', 'hook'], ['ask', 'hook', 'later'], ['ask', 'hook', 'pre', 'extra'], ['ask', 'dance']]) {
      const s = io();
      expect(await main(args, { cwd: tmpdir(), ...s })).toBe(2);
      expect(s.err.join('')).toMatch(/^usage: omni ask hook <pre\|post\|prompt\|end>/);
    }
  });
});

describe('the plugin\'s hooks.json', () => {
  const hooks = JSON.parse(readFileSync(HOOKS, 'utf8')).hooks;
  /** The event's hooks, each with its entry's matcher, in order. */
  const all = (event: string) => hooks[event].flatMap((entry: { matcher?: string; hooks: Record<string, unknown>[] }) => {
    expect(entry.hooks).toHaveLength(1);
    return [{ matcher: entry.matcher, ...entry.hooks[0] }];
  });
  const only = (event: string) => {
    expect(hooks[event]).toHaveLength(1);
    return all(event)[0];
  };

  it('wires PreToolUse and PostToolUse on AskUserQuestion, UserPromptSubmit and SessionEnd', () => {
    expect(Object.keys(hooks).sort()).toEqual(['PostToolUse', 'PreToolUse', 'SessionEnd', 'SessionStart', 'UserPromptSubmit']);
    const pre = only('PreToolUse');
    const [post] = all('PostToolUse');
    const prompt = only('UserPromptSubmit');
    const [end] = all('SessionEnd');
    expect(pre).toMatchObject({ matcher: 'AskUserQuestion', type: 'command', timeout: 600 });
    expect(post).toMatchObject({ matcher: 'AskUserQuestion', type: 'command' });
    expect(prompt).toMatchObject({ type: 'command' });
    expect(prompt.matcher).toBeUndefined();
    expect(end).toMatchObject({ type: 'command' });
    expect(end.matcher).toBeUndefined();
    for (const [kind, hook] of [['pre', pre], ['post', post], ['prompt', prompt], ['end', end]]) {
      expect(hook.command).toMatch(new RegExp(`^node "\\$CLAUDE_PROJECT_DIR/\\.omni-loop/bin/omni\\.mjs" ask hook ${kind}\\b`));
    }
  });

  it('runs the heartbeat after every tool call and once at the session\'s end, never failing (PRD 757)', () => {
    const post = all('PostToolUse');
    const end = all('SessionEnd');
    expect(post).toHaveLength(2);
    expect(end).toHaveLength(2);
    expect(post[1]).toMatchObject({ matcher: '*', type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/.omni-loop/bin/omni.mjs" heartbeat || true' });
    expect(end[1]).toMatchObject({ type: 'command', command: 'node "$CLAUDE_PROJECT_DIR/.omni-loop/bin/omni.mjs" heartbeat --end || true' });
    expect(end[1].matcher).toBeUndefined();
    for (const hook of [...post, ...end]) expect(hook.command.endsWith(' || true')).toBe(true);
  });

  it('never fails a hook: a checkout without the kit, or with an omni that has no ask, exits 0 and prints nothing', () => {
    const withoutKit = makeRepo({ git: true });
    const oldKit = makeRepo({ git: true, files: { '.omni-loop/bin/omni.mjs': 'process.stderr.write("usage: omni <command>\\n"); process.exit(2);\n' } });
    const cases = [withoutKit, oldKit].flatMap(({ root }) =>
      Object.keys(hooks).flatMap((event) => all(event).map(({ command }: { command: string }) => ({ root, event, command }))));
    const input = join(mkdtempSync(join(tmpdir(), 'omni-hook-input-')), 'pre.json');
    writeFileSync(input, PRE);
    // One shell runs every hook command, each in its checkout with PRE on its stdin, between two markers
    // that carry its index and its exit status. Each case reaches the shell through the environment.
    const env: Record<string, string> = { ...process.env, HOOK_INPUT: input };
    const script = cases.map(({ root, command }, index) => {
      env[`HOOK_ROOT_${index}`] = root;
      env[`HOOK_COMMAND_${index}`] = command;
      return `printf '\\n@@${index}@@\\n'; (cd "$HOOK_ROOT_${index}" && CLAUDE_PROJECT_DIR="$HOOK_ROOT_${index}" sh -c "$HOOK_COMMAND_${index}" < "$HOOK_INPUT"); printf '\\n@@${index}:%d@@\\n' $?`;
    }).join('\n');
    const run = spawnSync('sh', ['-c', script], { encoding: 'utf8', env });
    expect(run.status).toBe(0);
    cases.forEach(({ event, command }, index) => {
      const ran = new RegExp(`\\n@@${index}@@\\n([\\s\\S]*?)\\n@@${index}:(\\d+)@@\\n`).exec(run.stdout);
      expect(ran, command).not.toBeNull();
      expect({ event, command, status: Number(ran![2]), stdout: ran![1] }).toEqual({ event, command, status: 0, stdout: '' });
    });
  });

  it('runs the checkout\'s own omni', async () => {
    const { root, tokens } = await modeOn({ answer: (round) => firstOptionAnswers(round.questions) });
    const shim = `import { main } from ${JSON.stringify(CLI)};\nmain(process.argv.slice(2)).then((code) => process.exit(code));\n`;
    mkdirSync(join(root, '.omni-loop', 'bin'), { recursive: true });
    writeFileSync(join(root, '.omni-loop', 'bin', 'omni.mjs'), shim);
    const home = mkdtempSync(join(tmpdir(), 'omni-home-'));
    mkdirSync(join(home, '.config', 'omni'), { recursive: true });
    writeFileSync(join(home, '.config', 'omni', 'credentials.json'), JSON.stringify({ [server.host]: tokens.read(server.host) }));
    const { command } = only('UserPromptSubmit');
    const run = await new Promise<Omit<CliRun, 'stderr'>>((resolve) => {
      const child = execFile('sh', ['-c', command], { cwd: root, env: { ...process.env, HOME: home, CLAUDE_PROJECT_DIR: root }, encoding: 'utf8' },
        (error, stdout) => resolve({ status: error ? error.code : 0, stdout }));
      child.stdin!.end('{"prompt":"hi"}');
    });
    expect(run.status).toBe(0);
    expect(JSON.parse(run.stdout).hookSpecificOutput.additionalContext).toBe(PROMPT_CONTEXT);
  });
});
