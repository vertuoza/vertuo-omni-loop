import { existsSync, mkdirSync, readdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { dig, digText } from '../../bin/dig.ts';
import { assertDefined } from '../../test/assert.ts';
import { firstOptionAnswers, startFakeAskServer, type FakeAskServer } from '../../test/fake-ask-server.ts';
import { makeRepo } from '../../test/fixture.ts';
import { askClient as typedClient } from './client.ts';
import type { Tokens } from './client.ts';
import { activeMode, endHook, postHook, preHook, PROMPT_CONTEXT, promptOutput, toolAnswers, WAIT_LIMITS } from './hook.ts';
import { LOCAL_DIR, readMode, readRound, readTerminal, writeMode, writeRound, writeShot, writeTerminal } from './local-state.ts';

const COLOUR = {
  question: 'Which colour should the badge be?',
  header: 'Colour',
  multiSelect: false,
  options: [{ label: 'Yellow (Recommended)', description: 'the signal colour' }, { label: 'Cyan', description: 'the link colour' }],
};
const PLACES = {
  question: 'Where should it show?',
  header: 'Places',
  multiSelect: true,
  options: [{ label: 'Header', description: 'top' }, { label: 'History', description: 'below' }, { label: 'Footer', description: 'bottom' }],
};

const TERMINAL = 'term-a';
const TITLE = 'acme/widgets · main';

type Client = ReturnType<typeof typedClient>;
type ServerOptions = Parameters<typeof startFakeAskServer>[0];

/** The page answers a round with each question's first option. */
const firstOptions = (round: unknown) => firstOptionAnswers(dig(round, 'questions'));

/** The answers a `pre` hook handed back to the tool. */
const answersOf = (output: unknown): unknown => dig(output, 'hookSpecificOutput', 'updatedInput', 'answers');

/** The input a `pre` hook is given, its tool input open to more fields. */
type PreInput = { hook_event_name: string; session_id: string; tool_name: string; tool_input: Record<string, unknown>; tool_use_id: string | null };

function preInput(questions: unknown[], toolUseId: string | null = 'toolu_01', terminalId: string = TERMINAL): PreInput {
  return { hook_event_name: 'PreToolUse', session_id: terminalId, tool_name: 'AskUserQuestion', tool_input: { questions }, tool_use_id: toolUseId };
}

function memoryTokens(entries: Record<string, Tokens>) {
  const store: Record<string, Tokens> = { ...entries };
  return { store, read: (host: string) => store[host] ?? null, write: (host: string, tokens: Tokens) => { store[host] = tokens; } };
}

// A test that expects the page's answer waits long enough for it on a loaded machine: the fake server
// answers at once, so a quiet machine never waits. A test of giving up passes its own short total (#570).
const ROOMY = { totalMs: 30_000, callMs: 10_000 };

let server: FakeAskServer;
/** Every fake server a test started, closed after it. */
const started: FakeAskServer[] = [];
afterEach(async () => {
  await Promise.all(started.splice(0).map((each) => each.close()));
});

/** A checkout with ask mode on against a fake server, and no terminal's session opened yet. */
async function modeOn(options: ServerOptions = {}) {
  server = await startFakeAskServer({ holdMs: 50, ...options });
  started.push(server);
  const { root, write } = makeRepo({ files: { '.omni-loop/config.yml': `kit: 1\nask:\n  url: ${server.url}\n` } });
  writeMode(root, { host: server.host });
  const tokens = memoryTokens({ [server.host]: { access_token: 'access-1', refresh_token: 'refresh-1' } });
  const client = typedClient({ baseUrl: server.url, host: server.host, tokens });
  const pre = (input: unknown, limits = ROOMY, more: Partial<Parameters<typeof preHook>[0]> = {}) =>
    preHook({ root, host: server.host, client, input, title: () => TITLE, limits, ...more });
  return { root, write, client, tokens, pre };
}

/** The one session the fake server holds. */
function onlySession(): unknown {
  const sessions = sessionsList();
  expect(sessions).toHaveLength(1);
  return sessions[0];
}

/** The fake server's sessions and rounds, in the order they were opened. */
const sessionsList = (): unknown[] => [...server.sessions.values()].map((session): unknown => session);
const roundsList = (): unknown[] => [...server.rounds.values()].map((round): unknown => round);

/** The fake server's first round. */
function firstRound(): unknown {
  const [round] = roundsList();
  assertDefined(round, 'a round');
  return round;
}

/** Field `key` of the fake server's session `id`. */
const sessionField = (id: string, key: string): unknown => dig(server.sessions.get(id), key);

/** The body of the fake server's first call `matching`. */
function bodyOfCall(matching: (path: string) => boolean): unknown {
  const call = server.calls.find((each) => matching(each.path));
  assertDefined(call, 'the call');
  return call.body;
}

/** The terminal's session as this checkout keeps it, which must be there. */
function terminalOf(root: string, terminalId: string) {
  const terminal = readTerminal(root, terminalId);
  assertDefined(terminal, `terminal ${terminalId}`);
  return terminal;
}

describe('activeMode', () => {
  it('is the mode\'s host and ask.url while ask.json is there and ask.url names its host', async () => {
    const { root } = await modeOn();
    expect(activeMode(root)).toEqual({ host: server.host, baseUrl: server.url });
  });

  it('reads an ask.json in PRD 71\'s shape as on', async () => {
    const { root, write } = await modeOn();
    write('.omni-loop/local/ask.json', JSON.stringify({ sessionId: 'sess-71', url: `${server.url}/ask/sess-71`, host: server.host }));
    expect(activeMode(root)).toEqual({ host: server.host, baseUrl: server.url });
  });

  it('is off without ask.json, with ask.url null, on another host, or with a config it cannot read', async () => {
    const { root, write } = await modeOn();
    write('.omni-loop/config.yml', 'kit: 1\n');
    expect(activeMode(root)).toBeNull();
    write('.omni-loop/config.yml', 'kit: 1\nask:\n  url: https://elsewhere.example.com\n');
    expect(activeMode(root)).toBeNull();
    write('.omni-loop/config.yml', 'kit: 1\nask: [\n');
    expect(activeMode(root)).toBeNull();
    const bare = makeRepo({ files: { '.omni-loop/config.yml': `kit: 1\nask:\n  url: ${server.url}\n` } });
    expect(activeMode(bare.root)).toBeNull();
    writeMode(bare.root, { host: server.host });
    expect(activeMode(bare.root)).not.toBeNull();
  });
});

describe('the pre hook', () => {
  it('opens this terminal\'s session on its first question and hands the page\'s answer back, exactly', async () => {
    const { root, pre } = await modeOn({ answer: firstOptions });
    const output = await pre(preInput([COLOUR]));
    expect(output).toEqual({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        updatedInput: { questions: [COLOUR], answers: { 'Which colour should the badge be?': 'Yellow (Recommended)' } },
      },
    });
    const session = onlySession();
    expect(session).toMatchObject({ title: TITLE, status: 'open' });
    expect(readTerminal(root, TERMINAL)).toEqual({ sessionId: dig(session, 'id'), host: server.host });
    const round = firstRound();
    expect(round).toMatchObject({ sessionId: dig(session, 'id'), questions: [COLOUR] });
    expect(readRound(root, 'toolu_01')).toEqual({ roundId: dig(round, 'id'), status: 'answered' });
  });

  it('reuses the terminal\'s session for its next question', async () => {
    const { root, pre } = await modeOn({ answer: firstOptions });
    await pre(preInput([COLOUR], 'toolu_01'));
    await pre(preInput([PLACES], 'toolu_02'));
    const session = digText(onlySession(), 'id');
    expect(roundsList().map((round) => dig(round, 'sessionId'))).toEqual([session, session]);
    expect(server.calls.filter((call) => call.path === '/api/ask/sessions')).toHaveLength(1);
    expect(terminalOf(root, TERMINAL).sessionId).toBe(session);
  });

  it('opens one session per terminal, and two questions in flight together each get their own answer', async () => {
    const { root, pre } = await modeOn({ holdMs: 30 });
    const a = pre(preInput([COLOUR], 'toolu_a', 'term-a'), ROOMY);
    const b = pre(preInput([PLACES], 'toolu_b', 'term-b'), ROOMY);
    // Both rounds are posted, each in its own session, before either is answered.
    while (server.rounds.size < 2) await new Promise((resolve) => setTimeout(resolve, 10));
    const rounds = roundsList();
    const colour = rounds.find((round) => dig(round, 'questions', 0, 'question') === COLOUR.question);
    const places = rounds.find((round) => round !== colour);
    expect(dig(colour, 'sessionId')).not.toBe(dig(places, 'sessionId'));
    server.answerRound(digText(places, 'id'), { [PLACES.question]: 'Footer' });
    server.answerRound(digText(colour, 'id'), { [COLOUR.question]: 'Cyan' });

    expect(answersOf(await a)).toEqual({ [COLOUR.question]: 'Cyan' });
    expect(answersOf(await b)).toEqual({ [PLACES.question]: 'Footer' });
    expect(server.sessions.size).toBe(2);
    expect(terminalOf(root, 'term-a').sessionId).toBe(dig(colour, 'sessionId'));
    expect(terminalOf(root, 'term-b').sessionId).toBe(dig(places, 'sessionId'));
  });

  it('sends the round\'s context with the questions', async () => {
    const { root, pre } = await modeOn({ answer: firstOptions });
    const input = { ...preInput([COLOUR], 'toolu_01', 'claude-1'), transcript_path: `${root}/no-transcript.jsonl` };
    await pre(input);
    expect(dig(firstRound(), 'context')).toEqual({
      repo: null, branch: null, prd: null, claudeSessionId: 'claude-1', skill: null, model: null, tokens: null,
    });
  });

  it('still asks the question when reading the context throws', async () => {
    const { pre } = await modeOn({ answer: firstOptions });
    const readContext = () => { throw new Error('the transcript moved'); };
    const output = await pre(preInput([COLOUR]), ROOMY, { readContext });
    expect(answersOf(output)).toEqual({ [COLOUR.question]: 'Yellow (Recommended)' });
    expect(dig(firstRound(), 'context')).toBeNull();
    expect(bodyOfCall((path) => path.endsWith('/rounds'))).toEqual({ questions: [COLOUR] });
  });

  it('sends the lead Claude wrote before asking, and none when there is no lead (PRD 752)', async () => {
    const { pre } = await modeOn({ answer: firstOptions });
    await pre(preInput([COLOUR], 'toolu_01'), ROOMY, { readLead: () => '## The design' });
    await pre(preInput([PLACES], 'toolu_02'), ROOMY, { readLead: () => null });
    const bodies = server.calls.filter((call) => call.path.endsWith('/rounds')).map((call): unknown => call.body);
    expect(dig(bodies[0], 'lead')).toBe('## The design');
    expect(bodies[1]).not.toHaveProperty('lead');
  });

  it('still asks the question, with no lead, when reading the lead throws', async () => {
    const { pre } = await modeOn({ answer: firstOptions });
    const readLead = () => { throw new Error('the transcript moved'); };
    const output = await pre(preInput([COLOUR]), ROOMY, { readLead });
    expect(answersOf(output)).toEqual({ [COLOUR.question]: 'Yellow (Recommended)' });
    expect(bodyOfCall((path) => path.endsWith('/rounds'))).not.toHaveProperty('lead');
  });

  it('opens the terminal\'s session with context.repo (PRD 144)', async () => {
    const { pre } = await modeOn({ answer: firstOptions });
    await pre(preInput([COLOUR]), ROOMY, { readSessionContext: () => ({ repo: 'acme/widgets' }) });
    expect(bodyOfCall((path) => path === '/api/ask/sessions')).toEqual({ title: TITLE, context: { repo: 'acme/widgets' } });
  });

  it('still opens the session, with no context, when reading context.repo throws', async () => {
    const { pre } = await modeOn({ answer: firstOptions });
    const readSessionContext = () => { throw new Error('the config moved'); };
    const output = await pre(preInput([COLOUR]), ROOMY, { readSessionContext });
    expect(answersOf(output)).toEqual({ [COLOUR.question]: 'Yellow (Recommended)' });
    expect(bodyOfCall((path) => path === '/api/ask/sessions')).toEqual({ title: TITLE });
  });

  it('waits across several waits for an answer given later on the page', async () => {
    // The page answers as the third wait comes in: two waits have come back `open` by then.
    let waits = 0;
    const onCall = (call: { path: string }) => {
      if (!call.path.endsWith('/wait') || (waits += 1) < 3) return;
      server.answerRound(digText(firstRound(), 'id'), { [COLOUR.question]: 'Cyan' });
    };
    const { pre } = await modeOn({ holdMs: 30, onCall });
    const output = await pre(preInput([COLOUR]), ROOMY);
    expect(answersOf(output)).toEqual({ [COLOUR.question]: 'Cyan' });
    expect(waits).toBe(3);
  });

  it('passes a multi-select joined with ", " and Other text verbatim', async () => {
    const other = '  Neither: use the green of an answered round, please  ';
    const { pre } = await modeOn({ answer: () => ({ [COLOUR.question]: other, [PLACES.question]: 'Header, History' }) });
    const output = await pre(preInput([COLOUR, PLACES]));
    expect(answersOf(output)).toEqual({ [COLOUR.question]: other, [PLACES.question]: 'Header, History' });
  });

  it('with no answer within the total wait, abandons the round and prints nothing', async () => {
    const { root, pre } = await modeOn({ holdMs: 50 });
    const started = Date.now();
    expect(await pre(preInput([COLOUR]), { totalMs: 200, callMs: 1000 })).toBeNull();
    expect(Date.now() - started).toBeLessThan(4000);
    const round = firstRound();
    const roundId = digText(round, 'id');
    expect(dig(round, 'status')).toBe('abandoned');
    expect(server.calls.at(-1)?.path).toBe(`/api/ask/rounds/${roundId}/abandon`);
    expect(readRound(root, 'toolu_01')).toEqual({ roundId, status: 'abandoned' });
  });

  it('never waits past the total, even inside one long wait', async () => {
    const { pre } = await modeOn({ holdMs: 5000 });
    const started = Date.now();
    expect(await pre(preInput([COLOUR]), { totalMs: 300, callMs: 60000 })).toBeNull();
    expect(Date.now() - started).toBeLessThan(4000);
    expect(dig(firstRound(), 'status')).toBe('abandoned');
  });

  it('with the server down, prints nothing within 2 s and writes nothing', async () => {
    const { root, pre } = await modeOn();
    await server.close();
    const started = Date.now();
    expect(await pre(preInput([COLOUR]))).toBeNull();
    expect(Date.now() - started).toBeLessThan(2000);
    expect(readTerminal(root, TERMINAL)).toBeNull();
    expect(readRound(root, 'toolu_01')).toBeNull();
    expect(readMode(root)).not.toBeNull();
  });

  it('on a 401, refreshes once and retries', async () => {
    const { pre, tokens } = await modeOn({ answer: firstOptions });
    server.expireAccess();
    const output = await pre(preInput([COLOUR]));
    expect(answersOf(output)).toEqual({ [COLOUR.question]: 'Yellow (Recommended)' });
    expect(server.calls.filter((call) => call.path === '/api/ask/token')).toHaveLength(1);
    expect(tokens.store[server.host]?.access_token).toBe('access-2');
  });

  it('when its session is closed, deletes only this terminal\'s files, keeps the mode on, and the next question opens a new session', async () => {
    let closeNext = true;
    const answer = (round: unknown) => {
      if (closeNext) {
        closeNext = false;
        // The session closes while the hook waits on its round, the moment that round is posted.
        setImmediate(() => {
          server.closeSession(digText(round, 'sessionId'));
        });
        return null;
      }
      return firstOptions(round);
    };
    const { root, pre } = await modeOn({ answer });
    writeTerminal(root, 'term-b', { sessionId: 'sess-b', host: server.host });
    writeRound(root, 'toolu_b', { roundId: 'round-b', status: 'open' });

    expect(await pre(preInput([COLOUR]), { totalMs: 2000, callMs: 1000 })).toBeNull();
    const [first] = sessionsList();
    expect(dig(first, 'status')).toBe('closed');
    expect(readTerminal(root, TERMINAL)).toBeNull();
    // Its round stays for the post hook, which records the terminal's answer on it (PRD 1180).
    expect(readRound(root, 'toolu_01')).toEqual({ roundId: digText(firstRound(), 'id'), status: 'open' });
    expect(readMode(root)).toEqual({ host: server.host, sessionId: null });
    expect(readTerminal(root, 'term-b')).toEqual({ sessionId: 'sess-b', host: server.host });
    expect(readRound(root, 'toolu_b')).toEqual({ roundId: 'round-b', status: 'open' });

    const next = await pre(preInput([COLOUR], 'toolu_02'));
    expect(answersOf(next)).toEqual({ [COLOUR.question]: 'Yellow (Recommended)' });
    const second = terminalOf(root, TERMINAL);
    expect(second.sessionId).not.toBe(dig(first, 'id'));
    expect(sessionField(second.sessionId, 'status')).toBe('open');
  });

  it('when the server no longer takes rounds in its session, forgets it, and the next question opens a new one', async () => {
    const { root, pre } = await modeOn({ answer: firstOptions });
    const gone = server.openSession(TITLE);
    server.closeSession(gone.id);
    writeTerminal(root, TERMINAL, { sessionId: gone.id, host: server.host });

    expect(await pre(preInput([COLOUR]))).toBeNull();
    expect(readTerminal(root, TERMINAL)).toBeNull();
    expect(server.rounds.size).toBe(0);

    expect(answersOf(await pre(preInput([COLOUR], 'toolu_02')))).toEqual({ [COLOUR.question]: 'Yellow (Recommended)' });
    expect(terminalOf(root, TERMINAL).sessionId).not.toBe(gone.id);
  });

  it('opens a new session when this terminal\'s was opened on another host', async () => {
    const { root, pre } = await modeOn({ answer: firstOptions });
    writeTerminal(root, TERMINAL, { sessionId: 'sess-elsewhere', host: 'elsewhere.example.com' });
    expect(await pre(preInput([COLOUR]))).not.toBeNull();
    expect(readTerminal(root, TERMINAL)).toEqual({ sessionId: dig(onlySession(), 'id'), host: server.host });
  });

  it('prints nothing when the page\'s answer leaves a question out', async () => {
    const { pre } = await modeOn({ answer: () => ({ [COLOUR.question]: 'Cyan' }) });
    expect(await pre(preInput([COLOUR, PLACES]))).toBeNull();
    expect(dig(firstRound(), 'status')).toBe('abandoned');
  });

  it('prints nothing and opens nothing for another tool, an input with no questions, or no safe session or tool use id', async () => {
    const { root, pre } = await modeOn();
    expect(await pre({ ...preInput([COLOUR]), tool_name: 'Bash' })).toBeNull();
    expect(await pre(preInput([]))).toBeNull();
    expect(await pre({})).toBeNull();
    const noTerminal: Partial<PreInput> = preInput([COLOUR]);
    delete noTerminal.session_id;
    expect(await pre(noTerminal)).toBeNull();
    expect(await pre(preInput([COLOUR], 'toolu_01', '../escape'))).toBeNull();
    expect(await pre(preInput([COLOUR], 'toolu_01', ''))).toBeNull();
    expect(await pre(preInput([COLOUR], '../escape'))).toBeNull();
    expect(await pre(preInput([COLOUR], null))).toBeNull();
    expect(server.calls).toEqual([]);
    expect(readTerminal(root, TERMINAL)).toBeNull();
  });

  it('keeps every other field of the tool input', async () => {
    const { pre } = await modeOn({ answer: firstOptions });
    const input = preInput([COLOUR]);
    input.tool_input.metadata = { source: 'brainstorm' };
    const output = await pre(input);
    expect(dig(output, 'hookSpecificOutput', 'updatedInput')).toEqual({
      questions: [COLOUR],
      metadata: { source: 'brainstorm' },
      answers: { [COLOUR.question]: 'Yellow (Recommended)' },
    });
  });
});

describe('the pre hook, with screenshots on the answer (PRD 620)', () => {
  const ROUND = '6f1c2e0a-1b2c-4d5e-8f90-123456789abc';
  const DAY = 24 * 60 * 60 * 1000;
  const PNG = new Uint8Array([137, 80, 78, 71]);

  /** A client that answers the round at once with `answer`, and serves each link through `serve`. */
  function stubbed(answer: Record<string, unknown>, serve: (url: string) => Uint8Array = () => PNG) {
    const calls: unknown[][] = [];
    const client = {
      openSession: () => Promise.resolve({ id: 'sess-1' }),
      openRound: () => { calls.push(['openRound']); return Promise.resolve({ roundId: ROUND }); },
      wait: () => Promise.resolve({ status: 'answered', ...answer }),
      abandon: () => { calls.push(['abandon']); return Promise.resolve(); },
      // A download that fails rejects, as the real one does.
      download: (url: string, options: unknown) => {
        calls.push(['download', url, options]);
        try {
          return Promise.resolve(serve(url));
        } catch (error) {
          return Promise.reject(error instanceof Error ? error : new Error(String(error)));
        }
      },
    } as unknown as Client;
    const { root } = makeRepo({ files: { '.omni-loop/config.yml': 'kit: 1\n' } });
    const pre = (questions: unknown[] = [COLOUR, PLACES], more: Partial<Parameters<typeof preHook>[0]> = {}) =>
      preHook({ root, host: 'ask.example', client, input: preInput(questions), title: () => TITLE, limits: ROOMY, ...more });
    const shot = (name: string) => join(root, LOCAL_DIR, 'ask', 'shots', ROUND, name);
    return { root, calls, pre, shot };
  }

  it('downloads each into .omni-loop/local/ask/shots/<round>/ and appends their absolute paths to that question\'s answer', async () => {
    const { calls, pre, shot } = stubbed({
      answers: { [COLOUR.question]: 'This one, it is too dark', [PLACES.question]: 'Header' },
      attachments: { [COLOUR.question]: [{ name: '1.png', url: 'https://files.example/1' }, { name: '2.webp', url: 'https://files.example/2' }] },
    });
    const output = await pre([COLOUR, PLACES], { limits: WAIT_LIMITS });
    expect(answersOf(output)).toEqual({
      [COLOUR.question]: `This one, it is too dark\n\nScreenshots (open each with Read):\n- ${shot('1.png')}\n- ${shot('2.webp')}`,
      [PLACES.question]: 'Header',
    });
    expect([...readFileSync(shot('1.png'))]).toEqual([...PNG]);
    expect(existsSync(shot('2.webp'))).toBe(true);
    const downloads = calls.filter(([what]) => what === 'download');
    expect(downloads.map(([, url]) => url)).toEqual(['https://files.example/1', 'https://files.example/2']);
    // 30 s a file at most, inside the hook's own total.
    expect(downloads.every(([, , options]) => (options as { timeoutMs: number }).timeoutMs === 30_000)).toBe(true);
  });

  it('names a screenshot it could not download, and the answer still goes through', async () => {
    const { calls, pre, shot } = stubbed({
      answers: { [COLOUR.question]: '(see screenshots)' },
      attachments: { [COLOUR.question]: [
        { name: '1.png', url: null },
        { name: '2.png', url: 'https://files.example/broken' },
        { name: '3.png', url: 'https://files.example/fine' },
        { name: '../4.png', url: 'https://files.example/escape' },
      ] },
    }, (url: string) => { if (url.endsWith('broken')) throw new Error('403'); return PNG; });
    const output = await pre([COLOUR]);
    expect(answersOf(output)).toEqual({
      [COLOUR.question]: [
        '(see screenshots)',
        '',
        'Screenshots (open each with Read):',
        '- Screenshot 1 could not be downloaded',
        '- Screenshot 2 could not be downloaded',
        `- ${shot('3.png')}`,
        '- Screenshot 4 could not be downloaded',
      ].join('\n'),
    });
    expect(calls.filter(([what]) => what === 'download').map(([, url]) => url)).toEqual(['https://files.example/broken', 'https://files.example/fine']);
    expect(calls.some(([what]) => what === 'abandon')).toBe(false);
  });

  it('never downloads past the hook\'s total wait', async () => {
    let clock = 0;
    const { calls, pre } = stubbed({
      answers: { [COLOUR.question]: 'See' },
      attachments: { [COLOUR.question]: [{ name: '1.png', url: 'https://files.example/1' }, { name: '2.png', url: 'https://files.example/2' }] },
    }, () => { clock += 12_000; return PNG; });
    const output = await pre([COLOUR], { limits: { totalMs: 12_000, callMs: 5_000 }, now: () => clock });
    expect(dig(answersOf(output), COLOUR.question)).toMatch(/1\.png\n- Screenshot 2 could not be downloaded$/);
    expect(calls.filter(([what]) => what === 'download').map(([, , options]) => (options as { timeoutMs: number }).timeoutMs)).toEqual([12_000]);
  });

  it('removes screenshot folders older than 7 days before it opens a new round, and keeps the others', async () => {
    const { root, calls, pre } = stubbed({ answers: { [COLOUR.question]: 'Cyan' } });
    const now = Date.parse('2026-09-29T12:00:00Z');
    writeShot(root, 'old-round', '1.png', PNG);
    writeShot(root, 'fresh-round', '1.png', PNG);
    const shots = join(root, LOCAL_DIR, 'ask', 'shots');
    utimesSync(join(shots, 'old-round'), new Date(now - 8 * DAY), new Date(now - 8 * DAY));
    utimesSync(join(shots, 'fresh-round'), new Date(now - DAY), new Date(now - DAY));
    await pre([COLOUR], { now: () => now });
    expect(readdirSync(shots)).toEqual(['fresh-round']);
    expect(calls[0]).toEqual(['openRound']);
  });

  it('leaves an answer with no screenshots exactly as it was, and downloads nothing', async () => {
    const none = [undefined, null, {}, { [COLOUR.question]: [] }, { 'A question not asked': [{ name: '1.png', url: 'https://files.example/1' }] }];
    for (const attachments of none) {
      const { calls, pre, root } = stubbed({ answers: { [COLOUR.question]: 'Cyan' }, ...(attachments === undefined ? {} : { attachments }) });
      const output = await pre([COLOUR]);
      expect(answersOf(output)).toEqual({ [COLOUR.question]: 'Cyan' });
      expect(calls.filter(([what]) => what === 'download')).toEqual([]);
      expect(existsSync(join(root, LOCAL_DIR, 'ask', 'shots'))).toBe(false);
    }
  });

  it('still hands the answer back when the round\'s folder cannot be written', async () => {
    const { root, pre } = stubbed({
      answers: { [COLOUR.question]: 'See' },
      attachments: { [COLOUR.question]: [{ name: '1.png', url: 'https://files.example/1' }] },
    });
    // A file where the round's folder should go.
    mkdirSync(join(root, LOCAL_DIR, 'ask', 'shots'), { recursive: true });
    writeFileSync(join(root, LOCAL_DIR, 'ask', 'shots', ROUND), 'not a folder');
    const output = await pre([COLOUR]);
    expect(dig(answersOf(output), COLOUR.question))
      .toBe('See\n\nScreenshots (open each with Read):\n- Screenshot 1 could not be downloaded');
  });
});

describe('toolAnswers', () => {
  it('joins a list of labels with ", "', () => {
    expect(toolAnswers([PLACES], { [PLACES.question]: ['Header', 'Footer'] })).toEqual({ [PLACES.question]: 'Header, Footer' });
  });

  it('keeps only the questions asked, and refuses an empty or missing answer', () => {
    expect(toolAnswers([COLOUR], { [COLOUR.question]: 'Cyan', 'Another?': 'x' })).toEqual({ [COLOUR.question]: 'Cyan' });
    expect(toolAnswers([COLOUR], { [COLOUR.question]: '' })).toBeNull();
    expect(toolAnswers([COLOUR], { [COLOUR.question]: [] })).toBeNull();
    expect(toolAnswers([COLOUR], null)).toBeNull();
    expect(toolAnswers([COLOUR], { [COLOUR.question]: 3 })).toBeNull();
  });
});

describe('the post hook', () => {
  const postInput = (answers: unknown, toolUseId: string | null = 'toolu_01') => ({
    hook_event_name: 'PostToolUse',
    session_id: TERMINAL,
    tool_name: 'AskUserQuestion',
    tool_input: { questions: [COLOUR] },
    tool_response: { questions: [COLOUR], answers },
    tool_use_id: toolUseId,
  });

  /** The lines the post hook printed, in this test. */
  let warnings: string[] = [];
  beforeEach(() => {
    warnings = [];
  });
  const post = (root: string, client: Client, input: unknown) =>
    postHook({ root, client, input, title: () => TITLE, warn: (line) => { warnings.push(line); } });

  /** A round on the server, in a session of its own, abandoned as a terminal takes it. */
  async function abandonedRound(client: Client) {
    const { id } = server.openSession(TITLE);
    const roundId = digText(await client.openRound(id, [COLOUR]), 'roundId');
    await client.abandon(roundId);
    return roundId;
  }

  it('posts an answer typed in the terminal with via "terminal" to its own round, then deletes that round only', async () => {
    const { root, client } = await modeOn();
    const roundId = await abandonedRound(client);
    writeRound(root, 'toolu_01', { roundId, status: 'abandoned' });
    writeRound(root, 'toolu_02', { roundId: 'round-other', status: 'open' });
    await postHook({ root, client, input: postInput({ [COLOUR.question]: 'Cyan' }) });
    const round: unknown = server.rounds.get(roundId);
    expect(round).toMatchObject({ status: 'answered', answeredVia: 'terminal', answers: { [COLOUR.question]: 'Cyan' } });
    expect(server.calls.at(-1)).toMatchObject({ path: `/api/ask/rounds/${roundId}/answers`, body: { answers: { [COLOUR.question]: 'Cyan' }, via: 'terminal' } });
    expect(readRound(root, 'toolu_01')).toBeNull();
    expect(readRound(root, 'toolu_02')).toEqual({ roundId: 'round-other', status: 'open' });
  });

  it('posts nothing for a round answered on the page, and deletes it', async () => {
    const { root, client } = await modeOn();
    writeRound(root, 'toolu_01', { roundId: 'round-9', status: 'answered' });
    await postHook({ root, client, input: postInput({ [COLOUR.question]: 'Cyan' }) });
    expect(server.calls).toEqual([]);
    expect(readRound(root, 'toolu_01')).toBeNull();
  });

  it('never reads or deletes another tool call\'s round', async () => {
    const { root, client } = await modeOn();
    writeRound(root, 'toolu_00', { roundId: 'round-9', status: 'open' });
    await post(root, client, postInput({ [COLOUR.question]: 'Cyan' }, '../rounds/toolu_00'));
    await post(root, client, postInput({ [COLOUR.question]: 'Cyan' }, null));
    expect(server.calls).toEqual([]);
    await post(root, client, postInput({ [COLOUR.question]: 'Cyan' }, 'toolu_01'));
    expect(server.calls.map((call) => call.path)).not.toContain('/api/ask/rounds/round-9/answers');
    expect(readRound(root, 'toolu_00')).toEqual({ roundId: 'round-9', status: 'open' });
  });

  it('records the answer when the pre hook could not open a round: one call opens it answered, via the terminal (PRD 1180)', async () => {
    const { root, client } = await modeOn();
    await post(root, client, postInput({ [COLOUR.question]: 'Cyan' }));
    expect(onlySession()).toMatchObject({ title: TITLE });
    expect(firstRound()).toMatchObject({ status: 'answered', answeredVia: 'terminal', answers: { [COLOUR.question]: 'Cyan' }, questions: [COLOUR] });
    expect(bodyOfCall((path) => path.endsWith('/rounds'))).toMatchObject({ questions: [COLOUR], answers: { [COLOUR.question]: 'Cyan' }, via: 'terminal' });
    expect(readTerminal(root, TERMINAL)).toEqual({ sessionId: dig(onlySession(), 'id'), host: server.host });
    expect(warnings).toEqual([]);
  });

  it('records it in the terminal\'s own session, or in a new one when that session no longer takes rounds (PRD 1180)', async () => {
    const { root, client } = await modeOn();
    const gone = server.openSession(TITLE);
    server.closeSession(gone.id);
    writeTerminal(root, TERMINAL, { sessionId: gone.id, host: server.host });
    await post(root, client, postInput({ [COLOUR.question]: 'Cyan' }));
    const opened = terminalOf(root, TERMINAL).sessionId;
    expect(opened).not.toBe(gone.id);
    expect(firstRound()).toMatchObject({ sessionId: opened, status: 'answered', answeredVia: 'terminal' });
    await post(root, client, postInput({ [COLOUR.question]: 'Yellow (Recommended)' }, 'toolu_02'));
    expect(roundsList().map((round) => dig(round, 'sessionId'))).toEqual([opened, opened]);
    expect(warnings).toEqual([]);
  });

  it('records the answer on the round that came back closed, after the pre hook (PRD 1180)', async () => {
    const answer = (round: unknown) => {
      setImmediate(() => {
        server.closeSession(digText(round, 'sessionId'));
      });
      return null;
    };
    const { root, client, pre } = await modeOn({ answer });
    expect(await pre(preInput([COLOUR]), { totalMs: 2000, callMs: 1000 })).toBeNull();
    await post(root, client, postInput({ [COLOUR.question]: 'Cyan' }));
    expect(roundsList()).toHaveLength(1);
    expect(firstRound()).toMatchObject({ status: 'answered', answeredVia: 'terminal', answers: { [COLOUR.question]: 'Cyan' } });
    expect(readRound(root, 'toolu_01')).toBeNull();
    expect(warnings).toEqual([]);
  });

  it('records only the questions answered when one was left empty, on its round or on a new one (PRD 1180)', async () => {
    const { root, client } = await modeOn();
    const roundId = await abandonedRound(client);
    writeRound(root, 'toolu_01', { roundId, status: 'abandoned' });
    const partly = (toolUseId: string) => ({
      ...postInput({ [COLOUR.question]: 'Cyan', [PLACES.question]: '' }, toolUseId),
      tool_input: { questions: [COLOUR, PLACES] },
      tool_response: { questions: [COLOUR, PLACES], answers: { [COLOUR.question]: 'Cyan', [PLACES.question]: '' } },
    });
    await post(root, client, partly('toolu_01'));
    expect(server.rounds.get(roundId)).toMatchObject({ status: 'answered', answers: { [COLOUR.question]: 'Cyan' } });
    await post(root, client, partly('toolu_02'));
    expect(roundsList().at(-1)).toMatchObject({ status: 'answered', answeredVia: 'terminal', answers: { [COLOUR.question]: 'Cyan' }, questions: [COLOUR, PLACES] });
    expect(warnings).toEqual([]);
  });

  it('posts nothing when no question was answered', async () => {
    const { root, client } = await modeOn();
    writeRound(root, 'toolu_01', { roundId: 'round-9', status: 'open' });
    await post(root, client, postInput({ [COLOUR.question]: '' }));
    await post(root, client, postInput({}, 'toolu_02'));
    expect(server.calls).toEqual([]);
    expect(readRound(root, 'toolu_01')).toBeNull();
    expect(warnings).toEqual([]);
  });

  it('prints exactly one line when the answer cannot be posted, deletes the round, and never throws (PRD 1180)', async () => {
    const { root, client } = await modeOn();
    writeRound(root, 'toolu_01', { roundId: 'round-9', status: 'open' });
    await server.close();
    await expect(post(root, client, postInput({ [COLOUR.question]: 'Cyan' }))).resolves.toBeUndefined();
    expect(readRound(root, 'toolu_01')).toBeNull();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/^omni ask: /);
    expect(warnings[0]).not.toContain('\n');
    await post(root, client, postInput({ [COLOUR.question]: 'Cyan' }, 'toolu_02'));
    expect(warnings).toHaveLength(2);
    expect(warnings[1]).not.toContain('\n');
  });
});

describe('the end hook', () => {
  const endInput = (terminalId = TERMINAL) => ({ hook_event_name: 'SessionEnd', session_id: terminalId, reason: 'exit' });

  it('closes only its own terminal\'s session and deletes its file', async () => {
    const { root, client } = await modeOn();
    const a = server.openSession(TITLE);
    const b = server.openSession(TITLE);
    writeTerminal(root, 'term-a', { sessionId: a.id, host: server.host });
    writeTerminal(root, 'term-b', { sessionId: b.id, host: server.host });

    await endHook({ root, host: server.host, client, input: endInput('term-a') });

    expect(sessionField(a.id, 'status')).toBe('closed');
    expect(sessionField(b.id, 'status')).toBe('open');
    expect(readTerminal(root, 'term-a')).toBeNull();
    expect(readTerminal(root, 'term-b')).toEqual({ sessionId: b.id, host: server.host });
    expect(readMode(root)).not.toBeNull();
  });

  it('does nothing for a terminal that never asked, or with no safe session id', async () => {
    const { root, client } = await modeOn();
    writeTerminal(root, 'term-b', { sessionId: 'sess-b', host: server.host });
    await endHook({ root, host: server.host, client, input: endInput('term-a') });
    await endHook({ root, host: server.host, client, input: endInput('../ask/term-b') });
    await endHook({ root, host: server.host, client, input: {} });
    expect(server.calls).toEqual([]);
    expect(readTerminal(root, 'term-b')).not.toBeNull();
  });

  it('deletes its file even when the server cannot be reached, or the session was opened on another host', async () => {
    const { root, client } = await modeOn();
    writeTerminal(root, 'term-b', { sessionId: 'sess-b', host: 'elsewhere.example.com' });
    await endHook({ root, host: server.host, client, input: endInput('term-b') });
    expect(server.calls).toEqual([]);
    expect(readTerminal(root, 'term-b')).toBeNull();

    writeTerminal(root, 'term-a', { sessionId: 'sess-a', host: server.host });
    await server.close();
    await endHook({ root, host: server.host, client, input: endInput('term-a') });
    expect(readTerminal(root, 'term-a')).toBeNull();
  });
});

describe('the prompt hook', () => {
  it('is one sentence of additional context', () => {
    expect(PROMPT_CONTEXT).toBe('Ask mode is on: ask every question to the person through the AskUserQuestion tool, never as plain text.');
    expect(promptOutput()).toEqual({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: PROMPT_CONTEXT } });
  });
});
