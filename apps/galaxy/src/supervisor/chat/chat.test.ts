import { describe, expect, it, vi } from 'vitest';
import { UNREACHABLE } from '../../runners/runners.client';
import { QUICK_ASKS, sayable, say, waitWords } from './chat';

// The chat box's words and its call (PRD omni-loop-34 s6): what the box says while the seat cannot answer, what it
// sends, and POST /api/supervisor/messages on a fake fetch.

const MESSAGE = { id: 'm9', finding: null, kind: 'owner', by: 'pierre', body: 'What is running now?', replyTo: null, remembered: null, at: '2026-11-25T14:40:00.000Z' };
const answer = (status: number, body: unknown) => vi.fn(() => Promise.resolve(new Response(JSON.stringify(body), { status })));

describe('waitWords', () => {
  it('says nothing while the Supervisor watches', () => {
    expect(waitWords('watching')).toBeNull();
  });

  it('says the message waits while the seat is offline, paused, past its limit or not placed', () => {
    expect(waitWords('offline')).toBe('The Supervisor is offline. Your message waits until it looks again.');
    expect(waitWords('paused')).toBe('The Supervisor is paused. Your message waits until an owner resumes it.');
    expect(waitWords('limit')).toBe('Thinking paused until midnight. Your message waits until then.');
    expect(waitWords('none')).toBe('No Supervisor seat yet. Your message waits until an owner places it.');
  });
});

describe('sayable', () => {
  it('sends the text trimmed, and nothing empty or past 4,000 characters', () => {
    expect(sayable('  Why is box-3 idle?  ')).toBe('Why is box-3 idle?');
    expect(sayable('   ')).toBeNull();
    expect(sayable('x'.repeat(4001))).toBeNull();
    expect(sayable('x'.repeat(4000))).toHaveLength(4000);
  });

  it('offers the two quick questions the page draws', () => {
    expect(QUICK_ASKS).toEqual(['What is running now?', 'Summarize today']);
  });
});

describe('say', () => {
  it('sends the workspace, the thread and the text, and reads the stored message back', async () => {
    const fetcher = answer(200, { message: MESSAGE });
    expect(await say('ws-1', 'f-1', 'What is running now?', fetcher)).toEqual({ ok: true, value: MESSAGE });
    expect(fetcher).toHaveBeenCalledWith('/api/supervisor/messages', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ workspace: 'ws-1', finding: 'f-1', text: 'What is running now?' }),
    }));
  });

  it('gives the route\'s words for a refusal, and says unreachable otherwise', async () => {
    expect(await say('ws-1', null, 'hi', answer(403, { error: 'Only an owner writes to the Supervisor.' }))).toEqual({ ok: false, error: 'Only an owner writes to the Supervisor.' });
    expect(await say('ws-1', null, 'hi', answer(500, 'nope'))).toEqual({ ok: false, error: UNREACHABLE });
    expect(await say('ws-1', null, 'hi', answer(200, { message: 'x' }))).toEqual({ ok: false, error: UNREACHABLE });
    expect(await say('ws-1', null, 'hi', vi.fn(() => Promise.reject(new Error('offline'))))).toEqual({ ok: false, error: UNREACHABLE });
  });
});
