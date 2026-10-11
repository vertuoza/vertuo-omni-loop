import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { answerJudge, judgeSigningString, type JudgeDeps } from './judge.controller';
import { judgeRepository } from './judge.repository';
import { approvalInForce } from './judge.service';

vi.mock('server-only', () => ({}));

// The App-signed judge route (PRD 1612 s2, spec §3), on a stubbed service-role database: a request
// signed with STAGE_EVENT_SECRET over its path and query gets the approval in force, in the kit's
// shape with `voided` said outright; an unsigned or wrongly signed one gets 401, and nothing is read.

const SECRET = 'stage-secret';
const DOSSIER = '11111111-1111-4111-8111-111111111111';
const WORKSPACE = '22222222-2222-4222-8222-222222222222';
const APPROVAL = '33333333-3333-4333-8333-333333333333';
const IRISA = '00000000-0000-4000-8000-0000000000a4';
const V_SPEC = '44444444-4444-4444-8444-444444444444';
const V_PLAN = '55555555-5555-4555-8555-555555555555';
const V_PAGE = '66666666-6666-4666-8666-666666666666';
const SHA = (c: string) => c.repeat(64);

type Raw = { data: unknown; error: { code?: string; message?: string } | null };
type Call = { table: string; ops: Array<[string, ...unknown[]]> };

/** A service-role client whose every query answers what `tables` holds for its table. */
function stubDb(tables: Record<string, Raw>) {
  const calls: Call[] = [];
  const db = {
    from(table: string) {
      const call: Call = { table, ops: [] };
      calls.push(call);
      const answer = tables[table] ?? { data: null, error: { code: 'P0001', message: `no stub for ${table}` } };
      const chain: Record<string, unknown> = {
        then: (resolve: (raw: Raw) => unknown, reject: (e: unknown) => unknown) => Promise.resolve(answer).then(resolve, reject),
      };
      for (const op of ['select', 'eq', 'in', 'order', 'limit']) {
        chain[op] = (...args: unknown[]) => { call.ops.push([op, ...args]); return chain; };
      }
      return chain;
    },
  };
  return { calls, db: db as unknown as Parameters<typeof judgeRepository>[0] };
}

const APPROVED_ROW = {
  id: APPROVAL, approved_by: IRISA, approver_login: 'irisa', approved_at: '2026-10-11 09:00:00+00',
  files: [
    { kind: 'spec', path: '.omni-loop/delivery/inbox/7-team-inbox/spec.md', sha256: SHA('a'), version_id: V_SPEC },
    { kind: 'plan', path: '.omni-loop/delivery/inbox/7-team-inbox/plan.md', sha256: SHA('b'), version_id: V_PLAN },
    { kind: 'before-after', path: '.omni-loop/delivery/inbox/7-team-inbox/before-after.html', sha256: SHA('c'), version_id: V_PAGE },
  ],
};

const record = (overrides: Partial<Record<string, Raw>> = {}) => {
  const tables: Record<string, Raw> = {
    dossiers: { data: [{ id: DOSSIER, workspace_id: WORKSPACE }], error: null },
    approvals: { data: [APPROVED_ROW], error: null },
    approval_voids: { data: [], error: null },
    dossier_versions: { data: [{ id: V_SPEC, content: '# spec\n' }, { id: V_PLAN, content: '# plan\n' }], error: null },
    workspace_members: { data: [{ user_id: IRISA }], error: null },
  };
  return stubDb({ ...tables, ...overrides } as Record<string, Raw>);
};

const sign = (pathAndQuery: string, secret = SECRET) => `sha256=${createHmac('sha256', secret).update(pathAndQuery).digest('hex')}`;

function get(query: string, { signature, path = '/api/approvals/judge' }: { signature?: string | null; path?: string } = {}) {
  const pathAndQuery = `${path}${query}`;
  const headers = new Headers({ host: 'omni.example', 'x-forwarded-proto': 'https' });
  const signed = signature === undefined ? sign(pathAndQuery) : signature;
  if (signed !== null) headers.set('x-omni-signature-256', signed);
  return new Request(`https://omni.example${pathAndQuery}`, { headers });
}

function deps(stub = record(), overrides: Partial<JudgeDeps> = {}): JudgeDeps & { lines: string[] } {
  const lines: string[] = [];
  return { secret: SECRET, record: () => judgeRepository(stub.db), log: (line) => { lines.push(line); }, lines, ...overrides };
}

describe('GET /api/approvals/judge', () => {
  it('answers a signed request with the approval in force, its pinned files, their content and the PRD page', async () => {
    const stub = record();
    const res = await answerJudge(get('?repo=Acme/Mobile&prd=7'), deps(stub));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({
      url: `https://omni.example/prd/${DOSSIER}`,
      approval: {
        approver: { login: 'irisa', member: true },
        approvedAt: '2026-10-11T09:00:00.000Z',
        files: [
          { kind: 'spec', path: '.omni-loop/delivery/inbox/7-team-inbox/spec.md', sha256: SHA('a'), versionId: V_SPEC, content: '# spec\n' },
          { kind: 'plan', path: '.omni-loop/delivery/inbox/7-team-inbox/plan.md', sha256: SHA('b'), versionId: V_PLAN, content: '# plan\n' },
          { kind: 'before-after', path: '.omni-loop/delivery/inbox/7-team-inbox/before-after.html', sha256: SHA('c'), versionId: V_PAGE },
        ],
        voids: [],
        voided: false,
      },
    });
    const dossiers = stub.calls.find((c) => c.table === 'dossiers');
    expect(dossiers?.ops).toContainEqual(['eq', 'home_repo', 'acme/mobile']);
    expect(dossiers?.ops).toContainEqual(['eq', 'prd', 7]);
    expect(stub.calls.find((c) => c.table === 'approval_voids')?.ops).toContainEqual(['eq', 'approval_id', APPROVAL]);
    expect(stub.calls.find((c) => c.table === 'dossier_versions')?.ops).toContainEqual(['in', 'id', [V_SPEC, V_PLAN, V_PAGE]]);
  });

  it('says a voided approval is voided, naming each push that changed a pinned file', async () => {
    const res = await answerJudge(get('?repo=acme/mobile&prd=7'), deps(record({
      approval_voids: { data: [{ pusher_login: 'ada-gh', kind: 'plan', from_sha256: SHA('b'), to_sha256: SHA('d'), voided_at: '2026-10-11 10:00:00+00' }], error: null },
      workspace_members: { data: [], error: null },
    })));
    const body = await res.json() as { approval: { voided: boolean; voids: unknown[]; approver: unknown } };
    expect(body.approval.voided).toBe(true);
    expect(body.approval.voids).toEqual([{ pusher: 'ada-gh', kind: 'plan', from: SHA('b'), to: SHA('d'), voidedAt: '2026-10-11T10:00:00.000Z' }]);
    expect(body.approval.approver).toEqual({ login: 'irisa', member: false });
  });

  it('answers approval null before anyone approved, and 404 for a PRD with no dossier', async () => {
    const waiting = await answerJudge(get('?repo=acme/mobile&prd=7'), deps(record({ approvals: { data: [], error: null } })));
    expect(waiting.status).toBe(200);
    expect(await waiting.json()).toEqual({ url: `https://omni.example/prd/${DOSSIER}`, approval: null });
    const none = await answerJudge(get('?repo=acme/mobile&prd=7'), deps(record({ dossiers: { data: [], error: null } })));
    expect(none.status).toBe(404);
  });

  it('refuses an unsigned, a wrongly signed or a re-aimed request with 401, reading nothing', async () => {
    for (const request of [
      get('?repo=acme/mobile&prd=7', { signature: null }),
      get('?repo=acme/mobile&prd=7', { signature: sign('/api/approvals/judge?repo=acme/mobile&prd=7', 'other-secret') }),
      get('?repo=acme/mobile&prd=7', { signature: sign('/api/approvals/judge?repo=acme/mobile&prd=8') }),
      get('?repo=acme/mobile&prd=7', { signature: 'sha256=zz' }),
    ]) {
      const stub = record();
      const res = await answerJudge(request, deps(stub));
      expect(res.status).toBe(401);
      expect(stub.calls).toEqual([]);
    }
  });

  it('refuses every request with 401 where STAGE_EVENT_SECRET is not set', async () => {
    const d = deps(record(), { secret: undefined });
    const res = await answerJudge(get('?repo=acme/mobile&prd=7'), d);
    expect(res.status).toBe(401);
    expect(d.lines).toEqual(['approval judge: STAGE_EVENT_SECRET is not set on this deployment, every request is refused']);
  });

  it('refuses a signed but malformed query with 400', async () => {
    expect((await answerJudge(get('?repo=acme&prd=7'), deps())).status).toBe(400);
    expect((await answerJudge(get('?repo=acme/mobile&prd=seven'), deps())).status).toBe(400);
  });

  it('answers 503 without a service role, and 500 when the database fails or answers out of shape', async () => {
    expect((await answerJudge(get('?repo=acme/mobile&prd=7'), deps(record(), { record: null }))).status).toBe(503);
    const failed = deps(record({ approvals: { data: null, error: { code: '57014', message: 'timeout' } } }));
    expect((await answerJudge(get('?repo=acme/mobile&prd=7'), failed)).status).toBe(500);
    expect(failed.lines).toEqual(['approval judge: acme/mobile #7 could not be read: timeout']);
    const odd = deps(record({ approvals: { data: [{ ...APPROVED_ROW, files: 'nope' }], error: null } }));
    expect((await answerJudge(get('?repo=acme/mobile&prd=7'), odd)).status).toBe(500);
  });

  it('signs over the path and the query exactly as sent', () => {
    expect(judgeSigningString(new Request('https://omni.example/api/approvals/judge?repo=acme%2Fmobile&prd=7'))).toBe('/api/approvals/judge?repo=acme%2Fmobile&prd=7');
  });
});

describe('approvalInForce', () => {
  it('reads nothing past the dossier when there is none', async () => {
    const stub = record({ dossiers: { data: [], error: null } });
    const read = await approvalInForce(judgeRepository(stub.db), 'acme/mobile', 7 as never);
    expect(read).toEqual({ ok: true, value: null });
    expect(stub.calls.map((c) => c.table)).toEqual(['dossiers']);
  });
});
