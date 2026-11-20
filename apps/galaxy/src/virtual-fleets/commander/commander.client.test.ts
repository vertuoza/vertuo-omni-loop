import { describe, expect, it } from 'vitest';
import { demoCommanderPort, httpCommanderPort } from './commander.client';
import { NORTHWIND } from './commander.fake';

// The Commander tab's calls from the browser (PRD 3107 s1): each answer checked against the contract, a refusal's words,
// question and state kept, anything else read as no answer.

const QUESTION = { kind: 'question', id: 'cccccccc-0000-4000-8000-000000000001', at: '2026-11-21T09:30:00Z', login: 'mira-k', text: 'What waits?' };
const REPLY = { kind: 'reply', id: 'cccccccc-0000-4000-8000-000000000002', at: '2026-11-21T09:30:05Z', replyTo: QUESTION.id, reply: { verdict: null, claims: [], read: 3, removed: 0 } };
const VIEW = {
  workspace: NORTHWIND, fleet: 'blue-fleet', state: { kind: 'ready' }, status: { running: 1, waiting: 0, paused: 0, spent: 0, cap: null },
  messages: [], suggestions: ['What waits on me?'], reading: { missions: 1, jobs: 0 },
};

function answering(status: number, body: unknown) {
  const calls: { url: string; body: string }[] = [];
  const fetch = ((url: string, init?: RequestInit) => {
    calls.push({ url, body: typeof init?.body === 'string' ? init.body : '' });
    return Promise.resolve(Response.json(body, { status }));
  }) as typeof globalThis.fetch;
  return { calls, fetch };
}

describe('the Commander port', () => {
  it('loads the tab for the workspace and the fleet', async () => {
    const { calls, fetch } = answering(200, { view: VIEW });
    expect(await httpCommanderPort(NORTHWIND, 'blue-fleet', fetch).load()).toEqual({ ok: true, view: VIEW });
    expect(calls[0]?.url).toBe(`/api/virtual-fleets/commander?workspace=${NORTHWIND}&fleet=blue-fleet`);
  });

  it('asks, and reads the question and the reply', async () => {
    const { calls, fetch } = answering(201, { question: QUESTION, reply: REPLY });
    expect(await httpCommanderPort(NORTHWIND, 'blue-fleet', fetch).ask('What waits?')).toEqual({ ok: true, answer: { question: QUESTION, reply: REPLY } });
    expect(JSON.parse(calls[0]?.body ?? '')).toEqual({ workspace: NORTHWIND, fleet: 'blue-fleet', text: 'What waits?' });
  });

  it('keeps a refusal\'s words, its question and its state', async () => {
    const noAnswer = answering(502, { error: 'No answer: try again.', question: QUESTION });
    expect(await httpCommanderPort(NORTHWIND, 'blue-fleet', noAnswer.fetch).ask('What waits?')).toEqual({ ok: false, message: 'No answer: try again.', question: QUESTION, state: null });
    const usedUp = answering(429, { error: 'Tokens used up. Back at 00:00 UTC.', state: { kind: 'used-up', backAt: '2026-11-22T00:00:00.000Z' } });
    expect(await httpCommanderPort(NORTHWIND, 'blue-fleet', usedUp.fetch).ask('x')).toMatchObject({ ok: false, state: { kind: 'used-up' } });
  });

  it('reads anything else as no answer, and the demo as having no Commander', async () => {
    expect(await httpCommanderPort(NORTHWIND, 'blue-fleet', answering(200, { nope: true }).fetch).ask('x')).toEqual({ ok: false, message: 'No answer: try again.', question: null, state: null });
    expect(await httpCommanderPort(NORTHWIND, 'blue-fleet', answering(500, 'oops').fetch).load()).toEqual({ ok: false, message: 'Couldn’t load the Commander. Try again in a moment.' });
    expect(await demoCommanderPort.load()).toEqual({ ok: false, message: 'The demo world has no Commander.' });
  });
});
