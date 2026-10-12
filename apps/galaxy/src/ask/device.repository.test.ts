import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { Database } from '../../../../supabase/database.types';
import { deviceRepository } from './device.repository';

type Answer = { data: unknown; error: { message: string } | null };

/** A client whose rpc() answers from `answers` by function name, and records each call. */
function client(answers: Record<string, Answer>) {
  const calls: { fn: string; args: unknown }[] = [];
  const db = {
    rpc(fn: string, args: unknown) {
      calls.push({ fn, args });
      return Promise.resolve(answers[fn] ?? { data: null, error: null });
    },
  };
  // The repository asks nothing of the client but rpc(): the rest of SupabaseClient is never reached.
  return { db: db as unknown as SupabaseClient<Database>, calls };
}

const HASH = 'a'.repeat(64);
const ROW = {
  status: 'pending', purpose: 'token', name: 'cloud', days: 30, workspace: 'vertuoza',
  poll_interval: 5, last_polled_at: null, expires_at: '2026-10-12T09:10:00+00:00',
};

describe('the device store over the database\'s functions', () => {
  it('issues with the token\'s fields, leaving out what a sign-in has not, and reads a taken user code', async () => {
    const { db, calls } = client({ ask_cli_device_issue: { data: true, error: null } });
    const store = deviceRepository(db);
    const at = { device_hash: HASH, user_code: 'BCDFGHJK', now: '2026-10-12T09:00:00.000Z', expires_at: '2026-10-12T09:10:00.000Z' };
    expect(await store.issue({ ...at, request: { purpose: 'token', name: 'cloud', days: 30, workspace: null } })).toBe('issued');
    expect(calls[0]).toEqual({ fn: 'ask_cli_device_issue', args: {
      p_device_hash: HASH, p_user_code: 'BCDFGHJK', p_purpose: 'token', p_name: 'cloud', p_days: 30,
      p_now: at.now, p_expires_at: at.expires_at,
    } });
    const taken = client({ ask_cli_device_issue: { data: false, error: null } });
    expect(await deviceRepository(taken.db).issue({ ...at, request: { purpose: 'signin' } })).toBe('taken');
    expect(taken.calls[0]?.args).toEqual({ p_device_hash: HASH, p_user_code: 'BCDFGHJK', p_purpose: 'signin', p_now: at.now, p_expires_at: at.expires_at });
  });

  it('reads and finds a row, its poll interval as `interval`, or null', async () => {
    const { db } = client({ ask_cli_device_read: { data: [ROW], error: null }, ask_cli_device_find: { data: [], error: null } });
    const store = deviceRepository(db);
    expect(await store.read(HASH)).toEqual({
      status: 'pending', purpose: 'token', name: 'cloud', days: 30, workspace: 'vertuoza', interval: 5, last_polled_at: null,
      expires_at: '2026-10-12T09:10:00+00:00',
    });
    expect(await store.find('BCDFGHJK')).toBeNull();
  });

  it('takes a payload once, or null', async () => {
    const payload = { purpose: 'signin', payload: 'code', payload_expires_at: null };
    expect(await deviceRepository(client({ ask_cli_device_take: { data: [payload], error: null } }).db).take(HASH)).toEqual(payload);
    expect(await deviceRepository(client({ ask_cli_device_take: { data: [], error: null } }).db).take(HASH)).toBeNull();
  });

  it('records a poll, approves and denies with the arguments the functions take', async () => {
    const { db, calls } = client({ ask_cli_device_approve: { data: true, error: null }, ask_cli_device_deny: { data: false, error: null } });
    const store = deviceRepository(db);
    await store.polled(HASH, '2026-10-12T09:00:03.000Z', 5);
    expect(await store.approve('BCDFGHJK', 'token', 'sealed', '2027-01-10T00:00:00.000Z', '2026-10-12T09:01:00.000Z')).toBe(true);
    expect(await store.deny('BCDFGHJK', '2026-10-12T09:01:00.000Z')).toBe(false);
    expect(calls).toEqual([
      { fn: 'ask_cli_device_polled', args: { p_device_hash: HASH, p_polled_at: '2026-10-12T09:00:03.000Z', p_interval: 5 } },
      { fn: 'ask_cli_device_approve', args: {
        p_user_code: 'BCDFGHJK', p_purpose: 'token', p_payload: 'sealed', p_payload_expires_at: '2027-01-10T00:00:00.000Z', p_now: '2026-10-12T09:01:00.000Z',
      } },
      { fn: 'ask_cli_device_deny', args: { p_user_code: 'BCDFGHJK', p_now: '2026-10-12T09:01:00.000Z' } },
    ]);
  });

  it('throws the database\'s refusal, named after its function, and a row of a shape it does not know', async () => {
    const down = deviceRepository(client({ ask_cli_device_read: { data: null, error: { message: 'connection refused' } } }).db);
    await expect(down.read(HASH)).rejects.toThrow('ask_cli_device_read: connection refused');
    const odd = deviceRepository(client({ ask_cli_device_find: { data: [{ ...ROW, status: 'lost' }], error: null } }).db);
    await expect(odd.find('BCDFGHJK')).rejects.toThrow();
  });
});
