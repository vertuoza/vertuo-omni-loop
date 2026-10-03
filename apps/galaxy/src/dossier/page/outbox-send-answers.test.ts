import { afterEach, describe, expect, it, vi } from 'vitest';
import { sentView, type SendRow } from '../../outbox/sent';
import { ReadAnswer, readAnswerOf, StartAnswer, startAnswerOf } from './outbox-send-answers';

// What /api/outbox/send answers, parsed where the Outbox tab reads it (PRD 1030): the bodies the
// route writes parse as they are, and a body that does not is the tab's failed read.

const row: SendRow = {
  id: 'a1', dossier_id: 'd1', pr_number: 12, reply: '1A', nonce_hash: 'h', created_at: '2026-10-03T10:00:00Z',
  posted_at: '2026-10-03T10:01:00Z', comment_url: 'https://github.com/acme/widgets/pull/12#issuecomment-1', login: 'ada', counted: true, error: null,
};
const posted = sentView(row, 7, null);
const started = { send: 'a1', authorize: 'https://github.com/login/oauth/authorize?client_id=x', dropped: [2] };

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the outcome of a send (GET)', () => {
  it('parses every outcome the route writes, and its refusals', () => {
    for (const answer of [posted, sentView({ ...row, error: 'GitHub said no.' }, 7, null), sentView({ ...row, posted_at: null }, 7, null), { error: 'No such send.' }]) {
      expect(ReadAnswer.parse(answer)).toEqual(answer);
    }
  });

  it('refuses a missing field, a wrong type and a forbidden null', () => {
    expect(ReadAnswer.safeParse({ ...posted, url: undefined }).success).toBe(false);
    expect(ReadAnswer.safeParse({ ...posted, counted: 'yes' }).success).toBe(false);
    expect(ReadAnswer.safeParse({ ...posted, login: null }).success).toBe(false);
    expect(ReadAnswer.safeParse({ state: 'sent' }).success).toBe(false);
  });

  it('reads no body as none, and a body that does not parse as none, logged with no value', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(readAnswerOf(null)).toBeNull();
    expect(log).not.toHaveBeenCalled();
    expect(readAnswerOf({ state: 'posted', login: 'secret-login' })).toBeNull();
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[0])).toContain('dossier/OutboxSend: GET /api/outbox/send');
    expect(String(log.mock.calls[0]?.[0])).not.toContain('secret-login');
  });
});

describe('starting a send (POST)', () => {
  it('parses what the route answers, and its refusals', () => {
    expect(StartAnswer.parse(started)).toEqual(started);
    expect(StartAnswer.parse({ error: 'Sign in first.' })).toEqual({ error: 'Sign in first.' });
    expect(StartAnswer.parse({ error: 'Settled meanwhile.', dropped: [1] })).toEqual({ error: 'Settled meanwhile.', dropped: [1] });
  });

  it('refuses a wrong type, a forbidden null and an unknown field', () => {
    expect(StartAnswer.safeParse({ ...started, dropped: ['2'] }).success).toBe(false);
    expect(StartAnswer.safeParse({ ...started, send: null }).success).toBe(false);
    expect(StartAnswer.safeParse({ ...started, sent: 'a1' }).success).toBe(false);
  });

  it('says nothing of a body that is missing or does not parse', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(startAnswerOf(null)).toEqual({});
    expect(startAnswerOf({ send: 3 })).toEqual({});
  });
});
