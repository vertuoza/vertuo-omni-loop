import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../ask/page/history-live', () => ({ readHistoryLive: () => Promise.reject(new Error('not read in a test')) }));

import type { User } from '@supabase/supabase-js';
import { DEMO_TEAMMATE } from '../ask/page/demo';
import type { HistoryRead } from '../ask/page/history-live';
import type { MemberSession } from '../data/member-session';
import { doneViewOf, inboxViewOf } from './inbox.controller';

// The Inbox's controller (PRD omni-loop-22, s5): who reads the page decides what it draws, and the Done
// tab's history, or why it could not be read.

const NOW = Date.parse('2026-11-22T10:00:00Z');

describe('who the Inbox is drawn for', () => {
  it('the demo answers as the demo’s teammate, from the demo', () => {
    expect(inboxViewOf({ kind: 'demo' })).toEqual({ kind: 'answering', source: { kind: 'demo' }, me: DEMO_TEAMMATE });
  });

  it('closed with no database, the sign-in card signed out', () => {
    expect(inboxViewOf({ kind: 'closed' })).toEqual({ kind: 'closed' });
    expect(inboxViewOf({ kind: 'sign-in' })).toEqual({ kind: 'sign-in' });
  });

  it('signed in, answers as that person, through the database the page signs in to', () => {
    const user: Pick<User, 'id'> = { id: 'user-1' };
    const session = { kind: 'signed-in', db: {}, user, env: { url: 'https://db.example', key: 'anon' } } as unknown as MemberSession;
    expect(inboxViewOf(session)).toEqual({ kind: 'answering', source: { kind: 'database', url: 'https://db.example', key: 'anon' }, me: 'user-1' });
  });
});

describe('the Done tab', () => {
  const read = (result: HistoryRead) => () => Promise.resolve(result);

  it('is the history, newest first, under the query’s filters', async () => {
    const view = await doneViewOf({}, NOW, read({ kind: 'rows', rows: [], members: [] }));
    expect(view).toMatchObject({ kind: 'history', items: [] });
  });

  it('passes on a history that could not be read as the person', async () => {
    expect(await doneViewOf({}, NOW, read({ kind: 'unavailable' }))).toEqual({ kind: 'unavailable' });
    const supabase = { url: 'https://db.example', key: 'anon' };
    expect(await doneViewOf({}, NOW, read({ kind: 'signed-out', supabase }))).toEqual({ kind: 'signed-out', supabase });
  });

  it('says the history is unreachable when its read fails, and logs why', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await doneViewOf({}, NOW, () => Promise.reject(new Error('down')))).toEqual({ kind: 'unreachable' });
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });
});
