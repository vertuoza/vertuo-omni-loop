import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';
import { historyRepository, type ApprovalHistory } from './approvals.repository';
import { eventsOf, startOf } from './stream.service';

// A Tech Approval in the approval stream (PRD 2608 s3), against a fake history: each tech row is an event
// of its own, under a name an older kit ignores, so `asked`, `approved` and `voided` stay the product
// approval's. And the history read that tells them apart.

const DOSSIER = '11111111-1111-4111-8111-111111111111';
const REQUEST = '22222222-2222-4222-8222-222222222222';
const USER = '00000000-0000-4000-8000-0000000000a4';
const ADA = '00000000-0000-4000-8000-0000000000a2';
const IRISA = USER;
const PAUL = '00000000-0000-4000-8000-0000000000a5';
const A = 'a'.repeat(64);
const B = 'b'.repeat(64);

const request = (id: string, askedAt: string) => ({
  id, kind: 'asked' as const, askedAt, askedBy: ADA, asked: [IRISA, PAUL], nobodyElse: false, product: 'Mobile', approvalKind: 'product' as const,
});
const approval = (id: string, approvedAt: string) => ({ id, approver: 'irisa-gh', approvedAt, pinned: 3, kind: 'product' as const });
const voided = (id: string, voidedAt: string, ofApproval: string) => ({ id, approval: ofApproval, pusher: 'ada-gh', kind: 'spec', from: A, to: B, voidedAt });
const techRequest = (id: string, askedAt: string) => ({ ...request(id, askedAt), asked: [IRISA], product: null, approvalKind: 'tech' as const });
const techApproval = (id: string, approvedAt: string) => ({ ...approval(id, approvedAt), kind: 'tech' as const });

const history = (over: Partial<ApprovalHistory> = {}): ApprovalHistory => ({
  dossier: DOSSIER,
  author: null,
  requests: [],
  approvals: [],
  voids: [],
  people: [
    { user: ADA, login: 'Ada-GH', name: 'Ada' },
    { user: IRISA, login: 'irisa-gh', name: ' Irisa ' },
    { user: PAUL, login: null, name: '' },
  ],
  ...over,
});

const names = (events: Array<{ id: string; event: string }>) => events.map((e) => `${e.id}:${e.event}`);

describe('a Tech Approval in the stream', () => {
  const tech = eventsOf(history({
    requests: [techRequest('t1', '2026-10-09T10:00:00Z'), request('r1', '2026-10-09T10:02:00Z')],
    approvals: [techApproval('ta', '2026-10-09T10:01:00Z'), approval('pa', '2026-10-09T10:03:00Z')],
    voids: [voided('v1', '2026-10-09T10:04:00Z', 'pa'), voided('v2', '2026-10-09T10:04:00.000001Z', 'ta')],
  }));

  it('sends each tech row as an event of its own, naming the person', () => {
    expect(tech.map(({ id, event, data }) => ({ id, event, data }))).toEqual([
      { id: '1', event: 'tech-asked', data: { login: 'irisa-gh' } },
      { id: '2', event: 'tech-approved', data: { login: 'irisa-gh', approvedAt: '2026-10-09T10:01:00Z' } },
      { id: '3', event: 'asked', data: { asked: [{ login: 'irisa-gh', name: 'Irisa' }, { login: PAUL, name: null }], nobodyElse: false, author: 'ada-gh', product: 'Mobile' } },
      { id: '4', event: 'approved', data: { approver: 'irisa-gh', approvedAt: '2026-10-09T10:03:00Z', pinned: 3 } },
      { id: '5', event: 'voided', data: { pusher: 'ada-gh', kind: 'spec', from: A, to: B } },
      { id: '6', event: 'tech-voided', data: { login: 'irisa-gh', pusher: 'ada-gh', kind: 'spec', from: A, to: B } },
    ]);
  });

  it('never sends a tech row under a name an older kit acts on: a tech approval never ends its wait', () => {
    const alone = eventsOf(history({
      requests: [techRequest('t1', '2026-10-09T10:00:00Z')],
      approvals: [techApproval('ta', '2026-10-09T10:01:00Z')],
      voids: [voided('v1', '2026-10-09T10:02:00Z', 'ta')],
    }));
    expect(names(alone)).toEqual(['1:tech-asked', '2:tech-approved', '3:tech-voided']);
  });

  it('starts as ever from the latest product request, and with every tech event when none was asked', () => {
    // A product void came last of the product events: the latest request, then only what followed the void.
    expect(names(startOf(tech, null))).toEqual(['3:asked', '6:tech-voided']);
    const alone = eventsOf(history({ requests: [techRequest('t1', '2026-10-09T10:00:00Z')] }));
    expect(names(startOf(alone, null))).toEqual(['1:tech-asked']);
  });

  it("names the latest person named, an owner's rename included", () => {
    const renamed = eventsOf(history({
      requests: [techRequest('t1', '2026-10-09T10:00:00Z'), { ...techRequest('t2', '2026-10-09T10:01:00Z'), asked: [ADA], kind: 'asked' as const }],
    }));
    expect(renamed.map((e) => e.data)).toEqual([{ login: 'irisa-gh' }, { login: 'ada-gh' }]);
  });
});

describe('the history read', () => {
  it('reads each row with its kind, and each void with the approval it voided', async () => {
    const selects: Array<[string, string]> = [];
    const tables: Record<string, unknown> = {
      dossiers: [{ id: DOSSIER, workspace_id: DOSSIER, opened_by: null }],
      approval_requests: [{ id: REQUEST, kind: 'asked', asked_at: '2026-10-09T10:00:00Z', asked_by: USER, asked: [USER], nobody_else: false, product_id: null, approval_kind: 'tech' }],
      approvals: [{ id: REQUEST, approver_login: 'ada', approved_at: '2026-10-09T10:01:00Z', files: [], approval_kind: 'tech' }],
      approval_voids: [{ id: USER, approval_id: REQUEST, pusher_login: 'ada', kind: 'spec', from_sha256: 'a', to_sha256: 'b', voided_at: '2026-10-09T10:02:00Z' }],
    };
    const from = (table: string) => {
      const q: Record<string, unknown> = { then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: tables[table], error: null }).then(ok) };
      for (const verb of ['eq', 'order', 'limit']) q[verb] = () => q;
      q.select = (columns: string) => { selects.push([table, columns]); return q; };
      return q;
    };
    const db = { from, rpc: () => Promise.resolve({ data: [], error: null }) } as unknown as Pick<SupabaseClient, 'from'> as never;
    const read = await historyRepository(db, 'token').read('acme/mobile', parsePrd(7));
    expect(read).toMatchObject({
      ok: true,
      value: {
        requests: [{ id: REQUEST, approvalKind: 'tech' }],
        approvals: [{ id: REQUEST, kind: 'tech' }],
        voids: [{ id: USER, approval: REQUEST }],
      },
    });
    expect(selects).toContainEqual(['approval_requests', expect.stringContaining('approval_kind')]);
    expect(selects).toContainEqual(['approvals', expect.stringContaining('approval_kind')]);
    expect(selects).toContainEqual(['approval_voids', expect.stringContaining('approval_id')]);
  });
});
