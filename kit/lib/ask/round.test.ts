// The round's core (PRD 1831, s1), as the CLI entry will drive it: a wait that runs out leaves the
// round open and abandons nothing, each wait call is capped, the screenshots written are listed, and
// a terminal's session opens once and closes once. The Claude hook's behaviour over the same core is
// `./hook.test.ts`, unedited.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { makeRepo } from '../../test/fixture.ts';
import { LOCAL_DIR, readTerminal, writeTerminal } from './local-state.ts';
import type { Client, Terminal } from './round.ts';
import { awaitRound, closeTerminal, openRound, withScreenshots } from './round.ts';

const QUESTION = { question: 'Which colour?', header: 'Colour', multiSelect: false, options: [{ label: 'Red', description: 'warm' }] };
const ROUND = 'round-1';

/** A client whose `wait` answers each call with the next reply, and that records every call. */
function stub(replies: unknown[] = []) {
  const calls: unknown[][] = [];
  const client = {
    openSession: (title: string) => { calls.push(['openSession', title]); return Promise.resolve({ id: 'sess-1' }); },
    openRound: (sessionId: string) => { calls.push(['openRound', sessionId]); return Promise.resolve({ roundId: ROUND }); },
    wait: (roundId: string, options: unknown) => {
      calls.push(['wait', roundId, options]);
      const reply = replies.shift();
      return reply instanceof Error ? Promise.reject(reply) : Promise.resolve(reply ?? { status: 'open' });
    },
    abandon: () => { calls.push(['abandon']); return Promise.resolve(); },
    closeSession: (id: string) => { calls.push(['closeSession', id]); return Promise.resolve(); },
    download: (url: string) => (url.endsWith('/bad') ? Promise.reject(new Error('gone')) : Promise.resolve(new Uint8Array([1, 2]))),
  } as unknown as Client;
  return { client, calls };
}

/** A clock that moves `step` ms each time it is read. */
function ticking(step: number) {
  let at = 0;
  return () => (at += step);
}

describe('awaitRound', () => {
  it('reads the answer, shaped as AskUserQuestion takes it, with its attachments', async () => {
    const attachments = { [QUESTION.question]: [] };
    const { client } = stub([{ status: 'open' }, { status: 'answered', answers: { [QUESTION.question]: ['Red'] }, attachments }]);
    const outcome = await awaitRound({ client, roundId: ROUND, questions: [QUESTION], deadline: 10_000, callMs: 50, now: () => 0 });
    expect(outcome).toEqual({ kind: 'answered', answers: { [QUESTION.question]: 'Red' }, attachments });
  });

  it('runs out with the round still open, and abandons nothing: the entry decides', async () => {
    const { client, calls } = stub();
    const outcome = await awaitRound({ client, roundId: ROUND, questions: [QUESTION], deadline: 100, callMs: 50, now: ticking(30) });
    expect(outcome).toEqual({ kind: 'open' });
    expect(calls.some(([what]) => what === 'abandon')).toBe(false);
  });

  it('waits in calls of at most callMs, and never past the deadline', async () => {
    const { client, calls } = stub();
    await awaitRound({ client, roundId: ROUND, questions: [QUESTION], deadline: 120, callMs: 50, now: ticking(40) });
    const timeouts = calls.filter(([what]) => what === 'wait').map(([, , options]) => (options as { timeoutMs: number }).timeoutMs);
    expect(timeouts).toEqual([50, 40]);
  });

  it.each([
    ['closed', { status: 'closed' }, { kind: 'closed' }],
    ['abandoned', { status: 'abandoned' }, { kind: 'abandoned' }],
    ['answered without every answer', { status: 'answered', answers: {} }, { kind: 'failed' }],
    ['a status it does not know', { status: 'lost' }, { kind: 'failed' }],
    ['a wait that fails', new Error('offline'), { kind: 'failed' }],
  ])('reads %s', async (_, reply, expected) => {
    const { client } = stub([reply]);
    expect(await awaitRound({ client, roundId: ROUND, questions: [QUESTION], deadline: 10_000, callMs: 50, now: () => 0 })).toEqual(expected);
  });
});

describe('withScreenshots', () => {
  it('appends each screenshot to its answer and lists the paths it wrote', async () => {
    const { root } = makeRepo({ files: { '.omni-loop/config.yml': 'kit: 1\n' } });
    const { client } = stub();
    const shots: string[] = [];
    const attachments = { [QUESTION.question]: [{ name: '1.png', url: 'https://files.example/1' }, { name: '2.png', url: 'https://files.example/bad' }] };
    const answers = await withScreenshots({ root, client, roundId: ROUND, answers: { [QUESTION.question]: 'Red' }, attachments, shots, deadline: 10_000, now: () => 0 });
    const path = join(root, LOCAL_DIR, 'ask', 'shots', ROUND, '1.png');
    expect(shots).toEqual([path]);
    expect(answers[QUESTION.question]).toBe(`Red\n\nScreenshots (open each with Read):\n- ${path}\n- Screenshot 2 could not be downloaded`);
  });
});

describe('a terminal\'s session', () => {
  function terminal(client: Client): { root: string; terminal: Terminal } {
    const { root } = makeRepo({ files: { '.omni-loop/config.yml': 'kit: 1\n' } });
    return { root, terminal: { root, host: 'ask.example', client, terminalId: 'term-a', title: () => 'acme/widgets · main', readSessionContext: () => null } };
  }
  const extras = { readContext: () => null, readLead: () => null };

  it('opens once, then posts each round into it', async () => {
    const { client, calls } = stub();
    const { root, terminal: t } = terminal(client);
    expect(await openRound({ ...t, ...extras, questions: [QUESTION] })).toBe(ROUND);
    expect(await openRound({ ...t, ...extras, questions: [QUESTION] })).toBe(ROUND);
    expect(calls.filter(([what]) => what === 'openSession')).toHaveLength(1);
    expect(readTerminal(root, 'term-a')).toEqual({ sessionId: 'sess-1', host: 'ask.example' });
  });

  it('closes on the page and forgets it; a session on another host is only forgotten', async () => {
    const { client, calls } = stub();
    const { root, terminal: t } = terminal(client);
    writeTerminal(root, 'term-a', { sessionId: 'sess-1', host: 'ask.example' });
    await closeTerminal(t);
    writeTerminal(root, 'term-a', { sessionId: 'sess-2', host: 'other.example' });
    await closeTerminal(t);
    expect(calls).toEqual([['closeSession', 'sess-1']]);
    expect(readTerminal(root, 'term-a')).toBeNull();
  });
});
