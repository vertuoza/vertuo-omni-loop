import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';
import { approvalsRepository, reachRepository } from './approvals.repository';

// The approvals' storage (PRD 1322 s2), on a stubbed Supabase client: which function it calls with
// what, what it makes of the answer (parsed, a refusal's code and message, `shape` for anything else),
// and a gone device removed from push_subscriptions.

const DOSSIER = '11111111-1111-4111-8111-111111111111';
const REQUEST = '22222222-2222-4222-8222-222222222222';
const USER = '00000000-0000-4000-8000-0000000000a4';
const PRD = parsePrd(7);

type Raw = { data: unknown; error: { code?: string; message?: string } | null };

function stub(answers: Record<string, Raw>, deleted: Raw = { data: null, error: null }) {
  const calls: Array<{ fn: string; args: unknown }> = [];
  const removed: Array<{ table: string; column: string; value: string }> = [];
  const client = {
    rpc: (fn: string, args?: unknown) => {
      calls.push({ fn, args });
      return Promise.resolve(answers[fn] ?? { data: null, error: { code: 'P0001', message: `no stub for ${fn}` } });
    },
    from: (table: string) => ({
      delete: () => ({
        eq: (column: string, value: string) => { removed.push({ table, column, value }); return Promise.resolve(deleted); },
      }),
    }),
  };
  return { db: client as unknown as Pick<SupabaseClient, 'rpc' | 'from'>, calls, removed };
}

const REQUESTED = {
  id: REQUEST, dossier: DOSSIER, repo: 'acme/mobile', prd: 7, title: 'T', kind: 're-asked', askedAt: '2026-10-09T10:00:00.123456+00:00',
  product: null, author: 'ada', nobodyElse: true, asked: [{ user: USER, login: 'ada', name: null }],
  files: [{ kind: 'spec', sha256: 'a'.repeat(64) }], spec: '# T',
};

describe('approvalsRepository', () => {
  it('calls approval_request() with the repository and the number, and parses its answer', async () => {
    const s = stub({ approval_request: { data: REQUESTED, error: null } });
    expect(await approvalsRepository(s.db).request('acme/mobile', PRD)).toEqual({ ok: true, value: REQUESTED });
    expect(s.calls).toEqual([{ fn: 'approval_request', args: { p_repo: 'acme/mobile', p_prd: 7 } }]);
  });

  it("passes the database's refusal on, and calls an answer out of shape `shape`", async () => {
    const refused = stub({ approval_request: { data: null, error: { code: 'P0002', message: 'No dossier for PRD #7 of acme/mobile.' } } });
    expect(await approvalsRepository(refused.db).request('acme/mobile', PRD))
      .toEqual({ ok: false, refusal: { code: 'P0002', message: 'No dossier for PRD #7 of acme/mobile.' } });
    const bare = stub({ approval_request: { data: null, error: {} } });
    expect(await approvalsRepository(bare.db).request('acme/mobile', PRD)).toEqual({ ok: false, refusal: { code: null, message: null } });
    const odd = stub({ approval_request: { data: { ...REQUESTED, kind: 'maybe' }, error: null } });
    expect(await approvalsRepository(odd.db).request('acme/mobile', PRD))
      .toEqual({ ok: false, refusal: { code: 'shape', message: 'approval_request() answered out of shape' } });
  });

  it('reads the bell through approval_requests_waiting()', async () => {
    const row = { id: REQUEST, dossier: DOSSIER, repo: 'acme/mobile', prd: 7, title: 'T', askedAt: '2026-10-09T10:00:00+00:00' };
    const s = stub({ approval_requests_waiting: { data: [row], error: null } });
    expect(await approvalsRepository(s.db).waiting()).toEqual({ ok: true, value: [row] });
    expect(s.calls).toEqual([{ fn: 'approval_requests_waiting', args: undefined }]);
  });
});

describe('reachRepository', () => {
  it('reads who a request reaches through approval_recipients()', async () => {
    const reached = [{ user: USER, email: null, devices: [{ id: REQUEST, endpoint: 'https://push.example/1', p256dh: 'k', auth: 'a' }] }];
    const s = stub({ approval_recipients: { data: reached, error: null } });
    expect(await reachRepository(s.db).recipients(REQUEST)).toEqual({ ok: true, value: reached });
    expect(s.calls).toEqual([{ fn: 'approval_recipients', args: { p_request: REQUEST } }]);
  });

  it('removes a gone device by its id, and throws when the database refuses', async () => {
    const s = stub({});
    await reachRepository(s.db).forget(REQUEST);
    expect(s.removed).toEqual([{ table: 'push_subscriptions', column: 'id', value: REQUEST }]);
    const refused = stub({}, { data: null, error: { message: 'permission denied' } });
    await expect(reachRepository(refused.db).forget(REQUEST)).rejects.toThrow('permission denied');
  });
});
