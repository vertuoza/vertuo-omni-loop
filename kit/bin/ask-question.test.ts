// `omni ask question`, `omni ask wait` and `omni ask answer` (PRD 1831): asking the person on the page
// from any agent, with no hook, no stdin and no TTY, seen from the outside. The page is the fake
// contract server; the sign-in an in-memory token store, or a kit token traded with it. A second of
// `--wait` lasts a few milliseconds here (`pace`), so that a wait running out takes no real time.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { firstOptionAnswers, startFakeAskServer } from '../test/fake-ask-server.ts';
import type { FakeAskServer } from '../test/fake-ask-server.ts';
import { makeRepo } from '../test/fixture.ts';
import { LOCAL_DIR, readTerminal } from '../lib/ask/local-state.ts';
import type { Tokens } from '../lib/ask/schema.ts';
import { dig } from './dig.ts';
import { main } from './omni.ts';

const QUESTION = {
  question: 'Which theme should the page open in?',
  header: 'Theme',
  multiSelect: false,
  options: [{ label: 'System (Recommended)', description: 'follow the computer' }, { label: 'Dark', description: 'always dark' }],
};
const SECOND = { question: 'Anything else?', header: 'More', multiSelect: false, options: [{ label: 'No', description: 'nothing' }] };
const FILE = { questions: [QUESTION], lead: 'Two themes fit the brief.', context: { skill: 'omni:do-work', model: 'gpt-5' } };

/** A kit token as `omni setup-token` prints it. */
const KIT_TOKEN = 'omk_Zq9xW3vK7pL2mN8bR4tY6uJ1hG5fD0sA_-cE3iO9wQv';
/** A second of `--wait` lasts 5 ms; one wait call at most a second. */
const PACE = { secondMs: 5, callMs: 1000 };
const SESSION = 'agent-session-1';

let server: FakeAskServer;
const started: FakeAskServer[] = [];
afterEach(async () => {
  for (const running of started.splice(0)) await running.close();
});

function memoryTokens(entries: Record<string, Tokens> = {}) {
  const store: Record<string, Tokens> = { ...entries };
  return { read: (host: string) => store[host] ?? null, write: (host: string, tokens: Tokens) => { store[host] = tokens; } };
}

const config = (url: string) => `kit: 1\nrepo:\n  slug: acme/widgets\nask:\n  url: ${url}\n`;

/** A checkout whose `ask.url` is the fake server, signed in to it, with ask mode on unless `on` is false. */
async function checkout(options: Parameters<typeof startFakeAskServer>[0] = {}, { on = true } = {}) {
  server = await startFakeAskServer(options);
  started.push(server);
  const files: Record<string, string> = { '.omni-loop/config.yml': config(server.url) };
  if (on) files[`${LOCAL_DIR}/ask.json`] = JSON.stringify({ host: server.host });
  const repo = makeRepo({ git: true, files });
  const tokens = memoryTokens({ [server.host]: { access_token: 'access-1', refresh_token: 'refresh-1' } });
  return { ...repo, tokens };
}

/** Writes `value` as a file of the checkout and gives its name. */
function file(root: string, name: string, value: unknown): string {
  writeFileSync(join(root, name), typeof value === 'string' ? value : JSON.stringify(value));
  return name;
}

/** Runs `omni ask <args>` in the checkout, with the session id set and the pace above. */
async function omni(args: string[], { root, tokens, env = {}, ...more }: { root: string; tokens?: unknown; env?: Record<string, string>; [option: string]: unknown }) {
  const out: string[] = [];
  const err: string[] = [];
  const code = await main(['ask', ...args], {
    cwd: root,
    stdout: { write: (s: string) => out.push(s) },
    stderr: { write: (s: string) => err.push(s) },
    env: { OMNI_SESSION_ID: SESSION, ...env },
    tokens,
    pace: PACE,
    ...more,
  });
  return { code, out: out.join(''), err: err.join('') };
}

const answerFirst = (round: unknown) => firstOptionAnswers(dig(round, 'questions'));
const roundsPosted = () => server.calls.filter((call) => call.method === 'POST' && /\/rounds$/.test(call.path));
/** The one line a run prints on stderr, after checking it is one. */
const oneLine = (text: string): string => {
  const lines = text.trimEnd().split('\n');
  expect(lines).toHaveLength(1);
  return lines[0] ?? '';
};

describe('omni ask question', () => {
  it('exits 0 with { round, answers, shots } once the page answers, the round carrying its lead and context', async () => {
    const { root, tokens } = await checkout({ answer: answerFirst });
    const run = await omni(['question', '--file', file(root, 'q.json', FILE)], { root, tokens });

    expect(run.err).toBe('');
    expect(run.code).toBe(0);
    const [round] = server.rounds.values();
    expect(JSON.parse(run.out)).toEqual({ round: round?.id, answers: { [QUESTION.question]: 'System (Recommended)' }, shots: [] });
    expect(round?.lead).toBe(FILE.lead);
    expect(round?.context).toMatchObject({ repo: 'acme/widgets', skill: 'omni:do-work', model: 'gpt-5', tokens: null, claudeSessionId: SESSION });
    // The session is this agent session's, titled as a hook's would be.
    expect(readTerminal(root, SESSION)).toEqual({ sessionId: round?.sessionId, host: server.host });
    expect([...server.sessions.values()][0]?.title).toMatch(/^acme\/widgets · /);
  });

  it('asks in the same session the next time', async () => {
    const { root, tokens } = await checkout({ answer: answerFirst });
    const name = file(root, 'q.json', FILE);
    expect((await omni(['question', '--file', name], { root, tokens })).code).toBe(0);
    expect((await omni(['question', '--file', name], { root, tokens })).code).toBe(0);
    expect(server.sessions.size).toBe(1);
    expect(roundsPosted()).toHaveLength(2);
  });

  it('exits 3, stdout empty and one line on stderr, when ask mode is off, and calls nothing', async () => {
    const { root, tokens } = await checkout({}, { on: false });
    const run = await omni(['question', '--file', file(root, 'q.json', FILE)], { root, tokens });
    expect(run.code).toBe(3);
    expect(run.out).toBe('');
    expect(oneLine(run.err)).toMatch(/^omni ask: ask mode is off/);
    expect(server.calls).toEqual([]);
  });

  it('exits 3 with no sign-in', async () => {
    const { root } = await checkout();
    const run = await omni(['question', '--file', file(root, 'q.json', FILE)], { root, tokens: memoryTokens() });
    expect(run.code).toBe(3);
    expect(run.out).toBe('');
    expect(oneLine(run.err)).toBe(`omni ask: not signed in to ${server.host}: run omni signin, or set OMNI_TOKEN`);
  });

  it('exits 3 when the page cannot be reached, naming the host to allow', async () => {
    const { root, tokens } = await checkout();
    await server.close();
    const run = await omni(['question', '--file', file(root, 'q.json', FILE)], { root, tokens });
    expect(run.code).toBe(3);
    expect(run.out).toBe('');
    expect(oneLine(run.err)).toBe(`omni ask: cannot reach ${server.host}: allow it in your environment's network access`);
  });

  it('exits 3 when the page refuses the sign-in', async () => {
    const { root, tokens } = await checkout();
    server.denyAccess();
    const run = await omni(['question', '--file', file(root, 'q.json', FILE)], { root, tokens });
    expect(run.code).toBe(3);
    expect(run.out).toBe('');
    expect(oneLine(run.err)).toMatch(/refused this sign-in/);
  });

  it('exits 3 when the round comes back abandoned, naming the round to send the chat\'s answer to', async () => {
    const { root, tokens } = await checkout({ answer: (round) => { round.status = 'abandoned'; return null; } });
    const run = await omni(['question', '--file', file(root, 'q.json', FILE)], { root, tokens });
    expect(run.code).toBe(3);
    expect(run.out).toBe('');
    const [round] = server.rounds.values();
    expect(oneLine(run.err)).toBe(`omni ask: the question was abandoned on the page; send the answer from your chat with omni ask answer ${String(round?.id)} --file <a.json>`);
  });

  it('exits 3 when the session is closed on the page, and forgets it', async () => {
    const { root, tokens } = await checkout({ answer: (round) => { server.closeSession(round.sessionId); return null; } });
    const run = await omni(['question', '--file', file(root, 'q.json', FILE)], { root, tokens });
    expect(run.code).toBe(3);
    expect(oneLine(run.err)).toMatch(/^omni ask: the session was closed on the page/);
    expect(readTerminal(root, SESSION)).toBeNull();
  });

  it('exits 4 with round <id> when the wait runs out, leaving the round open', async () => {
    const { root, tokens } = await checkout();
    const run = await omni(['question', '--file', file(root, 'q.json', FILE), '--wait', '10'], { root, tokens });
    expect(run.err).toBe('');
    expect(run.code).toBe(4);
    const [round] = server.rounds.values();
    expect(run.out).toBe(`round ${String(round?.id)}\n`);
    expect(round?.status).toBe('open');
  });

  it('waits 110 seconds by default', async () => {
    const { root, tokens } = await checkout();
    const name = file(root, 'q.json', FILE);
    const pace = { secondMs: 2, callMs: 1000 };
    const started = Date.now();
    expect((await omni(['question', '--file', name], { root, tokens, pace })).code).toBe(4);
    expect(Date.now() - started).toBeGreaterThanOrEqual(110 * pace.secondMs);
  });

  it('takes a wait of 10 to 540 seconds, and refuses any other with exit 2', async () => {
    const { root, tokens } = await checkout({ answer: answerFirst });
    const name = file(root, 'q.json', FILE);
    for (const wait of ['10', '540']) expect((await omni(['question', '--file', name, '--wait', wait], { root, tokens })).code).toBe(0);
    for (const wait of ['9', '541', '1e2', 'soon']) {
      const run = await omni(['question', '--file', name, '--wait', wait], { root, tokens });
      expect(run.code).toBe(2);
      expect(run.err).toMatch(/--wait must be a whole number of seconds from 10 to 540/);
    }
  });

  it('exits 2 naming the field of a question file that does not read, and calls nothing', async () => {
    const { root, tokens } = await checkout();
    const cases: [unknown, string][] = [
      [{ questions: [{ ...QUESTION, header: undefined }] }, 'questions.0.header'],
      [{ ...FILE, colour: 'blue' }, 'colour'],
      [{ questions: [{ ...QUESTION, hint: 'x' }] }, 'questions.0.hint'],
      ['not json', '(file)'],
    ];
    for (const [value, field] of cases) {
      const run = await omni(['question', '--file', file(root, 'q.json', value)], { root, tokens });
      expect(run.code).toBe(2);
      expect(run.out).toBe('');
      expect(run.err).toContain(`q.json does not read: ${field}:`);
    }
    expect((await omni(['question', '--file', 'missing.json'], { root, tokens })).err).toMatch(/cannot read missing\.json/);
    expect((await omni(['question'], { root, tokens })).code).toBe(2);
    expect(server.calls).toEqual([]);
  });
});

describe('omni ask wait', () => {
  it('resumes an open round to 4, then to 0 once answered on the page', async () => {
    const { root, tokens } = await checkout();
    const asked = await omni(['question', '--file', file(root, 'q.json', FILE), '--wait', '10'], { root, tokens });
    expect(asked.code).toBe(4);
    const id = asked.out.trim().replace(/^round /, '');

    const still = await omni(['wait', id, '--wait', '10'], { root, tokens });
    expect(still).toEqual({ code: 4, out: `round ${id}\n`, err: '' });

    server.answerRound(id, { [QUESTION.question]: 'Dark' });
    const answered = await omni(['wait', id], { root, tokens });
    expect(answered.err).toBe('');
    expect(answered.code).toBe(0);
    expect(JSON.parse(answered.out)).toEqual({ round: id, answers: { [QUESTION.question]: 'Dark' }, shots: [] });
  });

  it('resumes to 3 when the round was abandoned meanwhile, or is not one asked here', async () => {
    const { root, tokens } = await checkout();
    const asked = await omni(['question', '--file', file(root, 'q.json', FILE), '--wait', '10'], { root, tokens });
    const id = asked.out.trim().replace(/^round /, '');
    const round = server.rounds.get(id);
    if (round) round.status = 'abandoned';
    const abandoned = await omni(['wait', id], { root, tokens });
    expect(abandoned.code).toBe(3);
    expect(abandoned.out).toBe('');
    expect(oneLine(abandoned.err)).toMatch(/abandoned on the page/);

    const unknown = await omni(['wait', 'round-999'], { root, tokens });
    expect(unknown.code).toBe(3);
    expect(oneLine(unknown.err)).toMatch(/no question asked in this checkout is round round-999/);
  });

  it('takes one round and no file', async () => {
    const { root, tokens } = await checkout();
    for (const args of [['wait'], ['wait', 'a', 'b'], ['wait', 'a', '--file', 'q.json'], ['wait', 'a', '--wait', '5']]) {
      expect((await omni(args, { root, tokens })).code).toBe(2);
    }
  });
});

describe('omni ask answer', () => {
  it('posts the chat\'s answer with via terminal, leaving an empty question out', async () => {
    const { root, tokens } = await checkout();
    const asked = await omni(['question', '--file', file(root, 'q.json', { questions: [QUESTION, SECOND] }), '--wait', '10'], { root, tokens });
    const id = asked.out.trim().replace(/^round /, '');

    const run = await omni(['answer', id, '--file', file(root, 'a.json', { answers: { [QUESTION.question]: 'Dark', [SECOND.question]: '' } })], { root, tokens });

    expect(run).toEqual({ code: 0, out: '', err: '' });
    const posted = server.calls.find((call) => call.path === `/api/ask/rounds/${id}/answers`);
    expect(posted?.body).toEqual({ answers: { [QUESTION.question]: 'Dark' }, via: 'terminal' });
    expect(server.rounds.get(id)).toMatchObject({ status: 'answered', answeredVia: 'terminal' });
    expect(existsSync(join(root, LOCAL_DIR, 'ask', 'questions', `${id}.json`))).toBe(false);
  });

  it('exits 0 with one line on stderr when the post fails', async () => {
    const { root, tokens } = await checkout();
    const asked = await omni(['question', '--file', file(root, 'q.json', FILE), '--wait', '10'], { root, tokens });
    const id = asked.out.trim().replace(/^round /, '');
    await server.close();
    const run = await omni(['answer', id, '--file', file(root, 'a.json', { answers: { [QUESTION.question]: 'Dark' } })], { root, tokens });
    expect(run.code).toBe(0);
    expect(run.out).toBe('');
    expect(oneLine(run.err)).toMatch(/^omni ask: this answer was not recorded on the page \(cannot reach /);
  });

  it('exits 2 naming the field of an answer file that does not read', async () => {
    const { root, tokens } = await checkout();
    const run = await omni(['answer', 'round-1', '--file', file(root, 'a.json', { answers: { q: 3 } })], { root, tokens });
    expect(run.code).toBe(2);
    expect(run.err).toContain('a.json does not read: answers.q:');
    expect((await omni(['answer', 'round-1'], { root, tokens })).code).toBe(2);
  });
});

describe('OMNI_ASK', () => {
  it('on turns ask mode on with no ask.json', async () => {
    const { root, tokens } = await checkout({ answer: answerFirst }, { on: false });
    const run = await omni(['question', '--file', file(root, 'q.json', FILE)], { root, tokens, env: { OMNI_ASK: 'on' } });
    expect(run.code).toBe(0);
    expect(existsSync(join(root, LOCAL_DIR, 'ask.json'))).toBe(false);
  });

  it('off turns it off with one, for the verbs, the hooks and status alike', async () => {
    const { root, tokens } = await checkout({ answer: answerFirst });
    const env = { OMNI_ASK: 'off' };
    const run = await omni(['question', '--file', file(root, 'q.json', FILE)], { root, tokens, env });
    expect(run.code).toBe(3);
    expect(oneLine(run.err)).toMatch(/ask mode is off/);
    const pre = JSON.stringify({ session_id: 'term-a', tool_name: 'AskUserQuestion', tool_input: { questions: [QUESTION] }, tool_use_id: 'toolu_01' });
    expect(await omni(['hook', 'pre'], { root, tokens, env, stdin: pre })).toEqual({ code: 0, out: '', err: '' });
    expect((await omni(['status'], { root, tokens, env })).out).toBe('off\n');
    expect(server.calls).toEqual([]);
  });

  it('on turns the hooks and status on too', async () => {
    const { root, tokens } = await checkout({ answer: answerFirst }, { on: false });
    const env = { OMNI_ASK: 'on' };
    expect((await omni(['status'], { root, tokens, env })).out).toBe(`${server.url}/ask\n`);
    const pre = JSON.stringify({ session_id: 'term-a', tool_name: 'AskUserQuestion', tool_input: { questions: [QUESTION] }, tool_use_id: 'toolu_01' });
    const hook = await omni(['hook', 'pre'], { root, tokens, env, stdin: pre });
    expect(dig(JSON.parse(hook.out), 'hookSpecificOutput', 'updatedInput', 'answers')).toEqual({ [QUESTION.question]: 'System (Recommended)' });
  });
});

describe('the cloud seam', () => {
  it('with no home folder, no TTY and no ask.json, OMNI_TOKEN and OMNI_ASK=on ask, get 4, resume with ask wait and get 0', async () => {
    const codes = ['code-1', 'code-2', 'code-3'];
    const { root } = await checkout({ codes }, { on: false });
    let traded = 0;
    // The fake page takes one-time codes; the kit token is traded as one, as the real page trades it.
    const fetch = (url: string, init: RequestInit) => {
      const body = typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
      if (url.endsWith('/api/ask/token') && dig(body, 'omni_token') === KIT_TOKEN) {
        return globalThis.fetch(url, { ...init, body: JSON.stringify({ code: codes[traded++] }) });
      }
      return globalThis.fetch(url, init);
    };
    const env = { OMNI_TOKEN: KIT_TOKEN, OMNI_ASK: 'on', HOME: join(root, 'no-such-home') };
    const stdin = '';

    const asked = await omni(['question', '--file', file(root, 'q.json', FILE), '--wait', '10'], { root, env, fetch, stdin });
    expect(asked.err).toBe('');
    expect(asked.code).toBe(4);
    const id = asked.out.trim().replace(/^round /, '');
    server.answerRound(id, { [QUESTION.question]: 'Dark' });

    const resumed = await omni(['wait', id], { root, env, fetch, stdin });
    expect(resumed.code).toBe(0);
    expect(JSON.parse(resumed.out)).toMatchObject({ round: id, answers: { [QUESTION.question]: 'Dark' } });
    expect(traded).toBe(2);
    expect(existsSync(join(root, 'no-such-home'))).toBe(false);
    expect(readFileSync(join(root, LOCAL_DIR, '.gitignore'), 'utf8')).toBe('*\n');
  });
});

describe('the session asked in', () => {
  it('is the stored one when no variable names one, generated and stored the first time', async () => {
    const { root, tokens } = await checkout({ answer: answerFirst });
    const name = file(root, 'q.json', FILE);
    const env = { OMNI_SESSION_ID: '' };
    expect((await omni(['question', '--file', name], { root, tokens, env })).code).toBe(0);
    const stored: unknown = JSON.parse(readFileSync(join(root, LOCAL_DIR, 'session.json'), 'utf8'));
    const id = String(dig(stored, 'id'));
    expect(readTerminal(root, id)?.host).toBe(server.host);
    expect((await omni(['question', '--file', name], { root, tokens, env })).code).toBe(0);
    expect(server.sessions.size).toBe(1);
  });
});
