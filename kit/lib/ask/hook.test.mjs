import { afterEach, describe, expect, it } from 'vitest';
import { firstOptionAnswers, startFakeAskServer } from '../../test/fake-ask-server.mjs';
import { makeRepo } from '../../test/fixture.mjs';
import { askClient } from './client.mjs';
import { activeSession, postHook, preHook, PROMPT_CONTEXT, promptOutput, toolAnswers } from './hook.mjs';
import { readRound, readSession, writeRound, writeSession } from './local-state.mjs';

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

function preInput(questions, toolUseId = 'toolu_01') {
  return { hook_event_name: 'PreToolUse', tool_name: 'AskUserQuestion', tool_input: { questions }, tool_use_id: toolUseId };
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

/** A checkout with ask mode on against a fake server. */
async function modeOn(options = {}) {
  server = await startFakeAskServer({ holdMs: 50, ...options });
  const { root, write } = makeRepo({ files: { '.omni-loop/config.yml': `kit: 1\nask:\n  url: ${server.url}\n` } });
  const { id, url } = server.openSession('acme/widgets · main');
  const session = { sessionId: id, url, host: server.host };
  writeSession(root, session);
  const tokens = memoryTokens({ [server.host]: { access_token: 'access-1', refresh_token: 'refresh-1' } });
  const client = askClient({ baseUrl: server.url, host: server.host, tokens });
  return { root, write, session, client, tokens };
}

describe('activeSession', () => {
  it('is the session while ask.json is there and ask.url names its host', async () => {
    const { root, session } = await modeOn();
    expect(activeSession(root)).toEqual({ session, baseUrl: server.url });
  });

  it('is off without ask.json, with ask.url null, on another host, or with a config it cannot read', async () => {
    const { root, write, session } = await modeOn();
    write('.omni-loop/config.yml', 'kit: 1\n');
    expect(activeSession(root)).toBeNull();
    write('.omni-loop/config.yml', 'kit: 1\nask:\n  url: https://elsewhere.example.com\n');
    expect(activeSession(root)).toBeNull();
    write('.omni-loop/config.yml', 'kit: 1\nask: [\n');
    expect(activeSession(root)).toBeNull();
    const bare = makeRepo({ files: { '.omni-loop/config.yml': `kit: 1\nask:\n  url: ${server.url}\n` } });
    expect(activeSession(bare.root)).toBeNull();
    writeSession(bare.root, session);
    expect(activeSession(bare.root)).not.toBeNull();
  });
});

describe('the pre hook', () => {
  it('hands the page\'s answer back to AskUserQuestion, exactly', async () => {
    const { root, session, client } = await modeOn({ answer: (round) => firstOptionAnswers(round.questions) });
    const output = await preHook({ root, session, client, input: preInput([COLOUR]), limits: FAST });
    expect(output).toEqual({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'allow',
        updatedInput: { questions: [COLOUR], answers: { 'Which colour should the badge be?': 'Yellow (Recommended)' } },
      },
    });
    const [round] = server.rounds.values();
    expect(round.questions).toEqual([COLOUR]);
    expect(readRound(root)).toEqual({ roundId: round.id, toolUseId: 'toolu_01', status: 'answered' });
  });

  it('waits across several waits for an answer given later on the page', async () => {
    // The page answers as the third wait comes in: two waits have come back `open` by then.
    let waits = 0;
    const onCall = (call) => {
      if (!call.path.endsWith('/wait') || (waits += 1) < 3) return;
      const [round] = server.rounds.values();
      server.answerRound(round.id, { [COLOUR.question]: 'Cyan' });
    };
    const { root, session, client } = await modeOn({ holdMs: 30, onCall });
    const output = await preHook({ root, session, client, input: preInput([COLOUR]), limits: { totalMs: 5000, callMs: 1000 } });
    expect(output.hookSpecificOutput.updatedInput.answers).toEqual({ [COLOUR.question]: 'Cyan' });
    expect(waits).toBe(3);
  });

  it('passes a multi-select joined with ", " and Other text verbatim', async () => {
    const other = '  Neither: use the green of an answered round, please  ';
    const { root, session, client } = await modeOn({
      answer: () => ({ [COLOUR.question]: other, [PLACES.question]: 'Header, History' }),
    });
    const output = await preHook({ root, session, client, input: preInput([COLOUR, PLACES]), limits: FAST });
    expect(output.hookSpecificOutput.updatedInput.answers).toEqual({ [COLOUR.question]: other, [PLACES.question]: 'Header, History' });
  });

  it('with no answer within the total wait, abandons the round and prints nothing', async () => {
    const { root, session, client } = await modeOn({ holdMs: 50 });
    const started = Date.now();
    expect(await preHook({ root, session, client, input: preInput([COLOUR]), limits: { totalMs: 200, callMs: 1000 } })).toBeNull();
    expect(Date.now() - started).toBeLessThan(1500);
    const [round] = server.rounds.values();
    expect(round.status).toBe('abandoned');
    expect(server.calls.at(-1).path).toBe(`/api/ask/rounds/${round.id}/abandon`);
    expect(readRound(root)).toEqual({ roundId: round.id, toolUseId: 'toolu_01', status: 'abandoned' });
  });

  it('never waits past the total, even inside one long wait', async () => {
    const { root, session, client } = await modeOn({ holdMs: 5000 });
    const started = Date.now();
    expect(await preHook({ root, session, client, input: preInput([COLOUR]), limits: { totalMs: 300, callMs: 60000 } })).toBeNull();
    expect(Date.now() - started).toBeLessThan(1500);
    expect([...server.rounds.values()][0].status).toBe('abandoned');
  });

  it('with the server down, prints nothing within 2 s and writes no round', async () => {
    const { root, session, client } = await modeOn();
    await server.close();
    const started = Date.now();
    expect(await preHook({ root, session, client, input: preInput([COLOUR]), limits: FAST })).toBeNull();
    expect(Date.now() - started).toBeLessThan(2000);
    expect(readRound(root)).toBeNull();
    expect(readSession(root)).not.toBeNull();
  });

  it('on a 401, refreshes once and retries', async () => {
    const { root, session, client, tokens } = await modeOn({ answer: (round) => firstOptionAnswers(round.questions) });
    server.expireAccess();
    const output = await preHook({ root, session, client, input: preInput([COLOUR]), limits: FAST });
    expect(output.hookSpecificOutput.updatedInput.answers).toEqual({ [COLOUR.question]: 'Yellow (Recommended)' });
    expect(server.calls.filter((call) => call.path === '/api/ask/token')).toHaveLength(1);
    expect(tokens.store[server.host].access_token).toBe('access-2');
  });

  it('when the session is closed, deletes ask.json and the round, and prints nothing', async () => {
    // The session closes while the hook waits on its round, the moment that round is posted.
    const { root, session, client } = await modeOn({ answer: (round) => { setImmediate(() => server.closeSession(round.sessionId)); return null; } });
    expect(await preHook({ root, session, client, input: preInput([COLOUR]), limits: { totalMs: 2000, callMs: 1000 } })).toBeNull();
    expect(server.rounds.size).toBe(1);
    expect(readSession(root)).toBeNull();
    expect(readRound(root)).toBeNull();
  });

  it('prints nothing when the page\'s answer leaves a question out', async () => {
    const { root, session, client } = await modeOn({ answer: () => ({ [COLOUR.question]: 'Cyan' }) });
    expect(await preHook({ root, session, client, input: preInput([COLOUR, PLACES]), limits: FAST })).toBeNull();
    expect([...server.rounds.values()][0].status).toBe('abandoned');
  });

  it('prints nothing for another tool, or an input with no questions', async () => {
    const { root, session, client } = await modeOn();
    expect(await preHook({ root, session, client, input: { ...preInput([COLOUR]), tool_name: 'Bash' }, limits: FAST })).toBeNull();
    expect(await preHook({ root, session, client, input: preInput([]), limits: FAST })).toBeNull();
    expect(await preHook({ root, session, client, input: {}, limits: FAST })).toBeNull();
    expect(server.calls).toEqual([]);
  });

  it('keeps every other field of the tool input', async () => {
    const { root, session, client } = await modeOn({ answer: (round) => firstOptionAnswers(round.questions) });
    const input = preInput([COLOUR]);
    input.tool_input.metadata = { source: 'brainstorm' };
    const output = await preHook({ root, session, client, input, limits: FAST });
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
    tool_name: 'AskUserQuestion',
    tool_input: { questions: [COLOUR] },
    tool_response: { questions: [COLOUR], answers },
    tool_use_id: toolUseId,
  });

  it('posts an answer typed in the terminal with via "terminal", then deletes the round', async () => {
    const { root, client } = await modeOn();
    const { roundId } = await client.openRound(readSession(root).sessionId, [COLOUR]);
    await client.abandon(roundId);
    writeRound(root, { roundId, toolUseId: 'toolu_01', status: 'abandoned' });
    await postHook({ root, client, input: postInput({ [COLOUR.question]: 'Cyan' }) });
    expect(server.rounds.get(roundId)).toMatchObject({ status: 'answered', answeredVia: 'terminal', answers: { [COLOUR.question]: 'Cyan' } });
    expect(server.calls.at(-1)).toMatchObject({ path: `/api/ask/rounds/${roundId}/answers`, body: { answers: { [COLOUR.question]: 'Cyan' }, via: 'terminal' } });
    expect(readRound(root)).toBeNull();
  });

  it('posts nothing for a round answered on the page, and deletes it', async () => {
    const { root, client } = await modeOn();
    writeRound(root, { roundId: 'round-9', toolUseId: 'toolu_01', status: 'answered' });
    await postHook({ root, client, input: postInput({ [COLOUR.question]: 'Cyan' }) });
    expect(server.calls).toEqual([]);
    expect(readRound(root)).toBeNull();
  });

  it('posts nothing for a round another tool call left behind, and deletes it', async () => {
    const { root, client } = await modeOn();
    writeRound(root, { roundId: 'round-9', toolUseId: 'toolu_00', status: 'open' });
    await postHook({ root, client, input: postInput({ [COLOUR.question]: 'Cyan' }, 'toolu_01') });
    expect(server.calls).toEqual([]);
    expect(readRound(root)).toBeNull();
  });

  it('does nothing without a round, and still deletes the round when the server is down', async () => {
    const { root, client } = await modeOn();
    await postHook({ root, client, input: postInput({ [COLOUR.question]: 'Cyan' }) });
    expect(server.calls).toEqual([]);
    writeRound(root, { roundId: 'round-9', toolUseId: 'toolu_01', status: 'open' });
    await server.close();
    await postHook({ root, client, input: postInput({ [COLOUR.question]: 'Cyan' }) });
    expect(readRound(root)).toBeNull();
  });
});

describe('the prompt hook', () => {
  it('is one sentence of additional context', () => {
    expect(PROMPT_CONTEXT).toBe('Ask mode is on: ask every question to the person through the AskUserQuestion tool, never as plain text.');
    expect(promptOutput()).toEqual({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: PROMPT_CONTEXT } });
  });
});
