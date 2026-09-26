import { afterEach, describe, expect, it } from 'vitest';
import { firstOptionAnswers, startFakeAskServer } from '../../test/fake-ask-server.mjs';
import { makeRepo } from '../../test/fixture.mjs';
import { askClient } from './client.mjs';
import { activeMode, endHook, postHook, preHook, PROMPT_CONTEXT, promptOutput, toolAnswers } from './hook.mjs';
import { readMode, readRound, readTerminal, writeMode, writeRound, writeTerminal } from './local-state.mjs';

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

function preInput(questions, toolUseId = 'toolu_01', terminalId = TERMINAL) {
  return { hook_event_name: 'PreToolUse', session_id: terminalId, tool_name: 'AskUserQuestion', tool_input: { questions }, tool_use_id: toolUseId };
}

function memoryTokens(entries) {
  const store = { ...entries };
  return { store, read: (host) => store[host] ?? null, write: (host, tokens) => { store[host] = tokens; } };
}

const FAST = { totalMs: 400, callMs: 1000 };

let server;
afterEach(async () => {
  await server?.close();
  server = undefined;
});

/** A checkout with ask mode on against a fake server, and no terminal's session opened yet. */
async function modeOn(options = {}) {
  server = await startFakeAskServer({ holdMs: 50, ...options });
  const { root, write } = makeRepo({ files: { '.omni-loop/config.yml': `kit: 1\nask:\n  url: ${server.url}\n` } });
  writeMode(root, { host: server.host });
  const tokens = memoryTokens({ [server.host]: { access_token: 'access-1', refresh_token: 'refresh-1' } });
  const client = askClient({ baseUrl: server.url, host: server.host, tokens });
  const pre = (input, limits = FAST) => preHook({ root, host: server.host, client, input, title: () => TITLE, limits });
  return { root, write, client, tokens, pre };
}

/** The one session the fake server holds. */
function onlySession() {
  const sessions = [...server.sessions.values()];
  expect(sessions).toHaveLength(1);
  return sessions[0];
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
    const { root, pre } = await modeOn({ answer: (round) => firstOptionAnswers(round.questions) });
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
    expect(readTerminal(root, TERMINAL)).toEqual({ sessionId: session.id, host: server.host });
    const [round] = server.rounds.values();
    expect(round).toMatchObject({ sessionId: session.id, questions: [COLOUR] });
    expect(readRound(root, 'toolu_01')).toEqual({ roundId: round.id, status: 'answered' });
  });

  it('reuses the terminal\'s session for its next question', async () => {
    const { root, pre } = await modeOn({ answer: (round) => firstOptionAnswers(round.questions) });
    await pre(preInput([COLOUR], 'toolu_01'));
    await pre(preInput([PLACES], 'toolu_02'));
    const session = onlySession();
    expect([...server.rounds.values()].map((round) => round.sessionId)).toEqual([session.id, session.id]);
    expect(server.calls.filter((call) => call.path === '/api/ask/sessions')).toHaveLength(1);
    expect(readTerminal(root, TERMINAL).sessionId).toBe(session.id);
  });

  it('opens one session per terminal, and two questions in flight together each get their own answer', async () => {
    const { root, pre } = await modeOn({ holdMs: 30 });
    const a = pre(preInput([COLOUR], 'toolu_a', 'term-a'), { totalMs: 5000, callMs: 1000 });
    const b = pre(preInput([PLACES], 'toolu_b', 'term-b'), { totalMs: 5000, callMs: 1000 });
    // Both rounds are posted, each in its own session, before either is answered.
    while (server.rounds.size < 2) await new Promise((resolve) => setTimeout(resolve, 10));
    const rounds = [...server.rounds.values()];
    const colour = rounds.find((round) => round.questions[0].question === COLOUR.question);
    const places = rounds.find((round) => round !== colour);
    expect(colour.sessionId).not.toBe(places.sessionId);
    server.answerRound(places.id, { [PLACES.question]: 'Footer' });
    server.answerRound(colour.id, { [COLOUR.question]: 'Cyan' });

    expect((await a).hookSpecificOutput.updatedInput.answers).toEqual({ [COLOUR.question]: 'Cyan' });
    expect((await b).hookSpecificOutput.updatedInput.answers).toEqual({ [PLACES.question]: 'Footer' });
    expect(server.sessions.size).toBe(2);
    expect(readTerminal(root, 'term-a').sessionId).toBe(colour.sessionId);
    expect(readTerminal(root, 'term-b').sessionId).toBe(places.sessionId);
  });

  it('waits across several waits for an answer given later on the page', async () => {
    // The page answers as the third wait comes in: two waits have come back `open` by then.
    let waits = 0;
    const onCall = (call) => {
      if (!call.path.endsWith('/wait') || (waits += 1) < 3) return;
      const [round] = server.rounds.values();
      server.answerRound(round.id, { [COLOUR.question]: 'Cyan' });
    };
    const { pre } = await modeOn({ holdMs: 30, onCall });
    const output = await pre(preInput([COLOUR]), { totalMs: 5000, callMs: 1000 });
    expect(output.hookSpecificOutput.updatedInput.answers).toEqual({ [COLOUR.question]: 'Cyan' });
    expect(waits).toBe(3);
  });

  it('passes a multi-select joined with ", " and Other text verbatim', async () => {
    const other = '  Neither: use the green of an answered round, please  ';
    const { pre } = await modeOn({ answer: () => ({ [COLOUR.question]: other, [PLACES.question]: 'Header, History' }) });
    const output = await pre(preInput([COLOUR, PLACES]));
    expect(output.hookSpecificOutput.updatedInput.answers).toEqual({ [COLOUR.question]: other, [PLACES.question]: 'Header, History' });
  });

  it('with no answer within the total wait, abandons the round and prints nothing', async () => {
    const { root, pre } = await modeOn({ holdMs: 50 });
    const started = Date.now();
    expect(await pre(preInput([COLOUR]), { totalMs: 200, callMs: 1000 })).toBeNull();
    expect(Date.now() - started).toBeLessThan(1500);
    const [round] = server.rounds.values();
    expect(round.status).toBe('abandoned');
    expect(server.calls.at(-1).path).toBe(`/api/ask/rounds/${round.id}/abandon`);
    expect(readRound(root, 'toolu_01')).toEqual({ roundId: round.id, status: 'abandoned' });
  });

  it('never waits past the total, even inside one long wait', async () => {
    const { pre } = await modeOn({ holdMs: 5000 });
    const started = Date.now();
    expect(await pre(preInput([COLOUR]), { totalMs: 300, callMs: 60000 })).toBeNull();
    expect(Date.now() - started).toBeLessThan(1500);
    expect([...server.rounds.values()][0].status).toBe('abandoned');
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
    const { pre, tokens } = await modeOn({ answer: (round) => firstOptionAnswers(round.questions) });
    server.expireAccess();
    const output = await pre(preInput([COLOUR]));
    expect(output.hookSpecificOutput.updatedInput.answers).toEqual({ [COLOUR.question]: 'Yellow (Recommended)' });
    expect(server.calls.filter((call) => call.path === '/api/ask/token')).toHaveLength(1);
    expect(tokens.store[server.host].access_token).toBe('access-2');
  });

  it('when its session is closed, deletes only this terminal\'s files, keeps the mode on, and the next question opens a new session', async () => {
    let closeNext = true;
    const answer = (round) => {
      if (closeNext) {
        closeNext = false;
        // The session closes while the hook waits on its round, the moment that round is posted.
        setImmediate(() => server.closeSession(round.sessionId));
        return null;
      }
      return firstOptionAnswers(round.questions);
    };
    const { root, pre } = await modeOn({ answer });
    writeTerminal(root, 'term-b', { sessionId: 'sess-b', host: server.host });
    writeRound(root, 'toolu_b', { roundId: 'round-b', status: 'open' });

    expect(await pre(preInput([COLOUR]), { totalMs: 2000, callMs: 1000 })).toBeNull();
    const [first] = server.sessions.values();
    expect(first.status).toBe('closed');
    expect(readTerminal(root, TERMINAL)).toBeNull();
    expect(readRound(root, 'toolu_01')).toBeNull();
    expect(readMode(root)).toEqual({ host: server.host, sessionId: null });
    expect(readTerminal(root, 'term-b')).toEqual({ sessionId: 'sess-b', host: server.host });
    expect(readRound(root, 'toolu_b')).toEqual({ roundId: 'round-b', status: 'open' });

    const next = await pre(preInput([COLOUR], 'toolu_02'));
    expect(next.hookSpecificOutput.updatedInput.answers).toEqual({ [COLOUR.question]: 'Yellow (Recommended)' });
    const second = readTerminal(root, TERMINAL);
    expect(second.sessionId).not.toBe(first.id);
    expect(server.sessions.get(second.sessionId).status).toBe('open');
  });

  it('when the server no longer takes rounds in its session, forgets it, and the next question opens a new one', async () => {
    const { root, pre } = await modeOn({ answer: (round) => firstOptionAnswers(round.questions) });
    const gone = server.openSession(TITLE);
    server.closeSession(gone.id);
    writeTerminal(root, TERMINAL, { sessionId: gone.id, host: server.host });

    expect(await pre(preInput([COLOUR]))).toBeNull();
    expect(readTerminal(root, TERMINAL)).toBeNull();
    expect(server.rounds.size).toBe(0);

    expect((await pre(preInput([COLOUR], 'toolu_02'))).hookSpecificOutput.updatedInput.answers).toEqual({ [COLOUR.question]: 'Yellow (Recommended)' });
    expect(readTerminal(root, TERMINAL).sessionId).not.toBe(gone.id);
  });

  it('opens a new session when this terminal\'s was opened on another host', async () => {
    const { root, pre } = await modeOn({ answer: (round) => firstOptionAnswers(round.questions) });
    writeTerminal(root, TERMINAL, { sessionId: 'sess-elsewhere', host: 'elsewhere.example.com' });
    expect(await pre(preInput([COLOUR]))).not.toBeNull();
    expect(readTerminal(root, TERMINAL)).toEqual({ sessionId: onlySession().id, host: server.host });
  });

  it('prints nothing when the page\'s answer leaves a question out', async () => {
    const { pre } = await modeOn({ answer: () => ({ [COLOUR.question]: 'Cyan' }) });
    expect(await pre(preInput([COLOUR, PLACES]))).toBeNull();
    expect([...server.rounds.values()][0].status).toBe('abandoned');
  });

  it('prints nothing and opens nothing for another tool, an input with no questions, or no safe session or tool use id', async () => {
    const { root, pre } = await modeOn();
    expect(await pre({ ...preInput([COLOUR]), tool_name: 'Bash' })).toBeNull();
    expect(await pre(preInput([]))).toBeNull();
    expect(await pre({})).toBeNull();
    const { session_id: _, ...noTerminal } = preInput([COLOUR]);
    expect(await pre(noTerminal)).toBeNull();
    expect(await pre(preInput([COLOUR], 'toolu_01', '../escape'))).toBeNull();
    expect(await pre(preInput([COLOUR], 'toolu_01', ''))).toBeNull();
    expect(await pre(preInput([COLOUR], '../escape'))).toBeNull();
    expect(await pre(preInput([COLOUR], null))).toBeNull();
    expect(server.calls).toEqual([]);
    expect(readTerminal(root, TERMINAL)).toBeNull();
  });

  it('keeps every other field of the tool input', async () => {
    const { pre } = await modeOn({ answer: (round) => firstOptionAnswers(round.questions) });
    const input = preInput([COLOUR]);
    input.tool_input.metadata = { source: 'brainstorm' };
    const output = await pre(input);
    expect(output.hookSpecificOutput.updatedInput).toEqual({
      questions: [COLOUR],
      metadata: { source: 'brainstorm' },
      answers: { [COLOUR.question]: 'Yellow (Recommended)' },
    });
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
  const postInput = (answers, toolUseId = 'toolu_01') => ({
    hook_event_name: 'PostToolUse',
    session_id: TERMINAL,
    tool_name: 'AskUserQuestion',
    tool_input: { questions: [COLOUR] },
    tool_response: { questions: [COLOUR], answers },
    tool_use_id: toolUseId,
  });

  /** A round on the server, in a session of its own, abandoned as a terminal takes it. */
  async function abandonedRound(client) {
    const { id } = server.openSession(TITLE);
    const { roundId } = await client.openRound(id, [COLOUR]);
    await client.abandon(roundId);
    return roundId;
  }

  it('posts an answer typed in the terminal with via "terminal" to its own round, then deletes that round only', async () => {
    const { root, client } = await modeOn();
    const roundId = await abandonedRound(client);
    writeRound(root, 'toolu_01', { roundId, status: 'abandoned' });
    writeRound(root, 'toolu_02', { roundId: 'round-other', status: 'open' });
    await postHook({ root, client, input: postInput({ [COLOUR.question]: 'Cyan' }) });
    expect(server.rounds.get(roundId)).toMatchObject({ status: 'answered', answeredVia: 'terminal', answers: { [COLOUR.question]: 'Cyan' } });
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
    await postHook({ root, client, input: postInput({ [COLOUR.question]: 'Cyan' }, 'toolu_01') });
    await postHook({ root, client, input: postInput({ [COLOUR.question]: 'Cyan' }, '../rounds/toolu_00') });
    await postHook({ root, client, input: postInput({ [COLOUR.question]: 'Cyan' }, null) });
    expect(server.calls).toEqual([]);
    expect(readRound(root, 'toolu_00')).toEqual({ roundId: 'round-9', status: 'open' });
  });

  it('does nothing without a round, and still deletes the round when the server is down', async () => {
    const { root, client } = await modeOn();
    await postHook({ root, client, input: postInput({ [COLOUR.question]: 'Cyan' }) });
    expect(server.calls).toEqual([]);
    writeRound(root, 'toolu_01', { roundId: 'round-9', status: 'open' });
    await server.close();
    await postHook({ root, client, input: postInput({ [COLOUR.question]: 'Cyan' }) });
    expect(readRound(root, 'toolu_01')).toBeNull();
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

    expect(server.sessions.get(a.id).status).toBe('closed');
    expect(server.sessions.get(b.id).status).toBe('open');
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
