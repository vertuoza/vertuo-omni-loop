import { describe, expect, it } from 'vitest';
import { approveDossier, type ApprovalDeps } from './approval-api';

// The approval route and the business laws (PRD 2632 s4), with a stubbed Supabase client: a POST has the spec
// judged first, as the caller, then approves; a judging that fails never stops it; a red verdict's refusal
// comes back in the database's words. Beside the route's own tests (./approval-api.test.ts), which prove
// BR-PRODUCT-108 and stay as they are.

const DOSSIER = '11111111-1111-4111-8111-111111111111';
const IN_FORCE = { dossier: DOSSIER, approval: { approver: { login: 'bob-gh', member: true }, approvedAt: '2026-10-09T10:00:00Z', files: [] } };

type Answer = { data: unknown; error: { code?: string; message?: string } | null };

function world({ approve, judge }: { approve?: Answer; judge?: ApprovalDeps['judge'] }) {
  const calls: string[] = [];
  const labelled: string[] = [];
  const rpc = (fn: string) => {
    calls.push(fn);
    if (fn === 'dossier_approve') return Promise.resolve(approve ?? { data: { id: 'a1', repo: 'acme/widgets', prd: 1299 }, error: null });
    if (fn === 'dossier_approval') return Promise.resolve({ data: IN_FORCE, error: null });
    return Promise.resolve({ data: null, error: null });
  };
  const deps: ApprovalDeps = {
    connect: (() => ({ rpc })) as unknown as NonNullable<ApprovalDeps['connect']>,
    session: () => Promise.resolve({ rpc } as unknown as Awaited<ReturnType<ApprovalDeps['session']>>),
    label: (repo) => { labelled.push(repo); return Promise.resolve(); },
    ...(judge ? { judge } : {}),
  };
  const post = async (body: unknown) => {
    const response = await approveDossier(new Request('https://omni.example/api/dossiers/approval', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    }), deps);
    return { status: response.status, body: (await response.json()) as unknown };
  };
  return { calls, labelled, post };
}

describe('POST /api/dossiers/approval — the business laws (PRD 2632 s4)', () => {
  it('has the spec judged first, as the caller, then approves', async () => {
    const judged: string[] = [];
    const w = world({
      judge: async (db, dossier) => {
        judged.push(dossier);
        await db.rpc('business_law_verdict_of', { p_dossier: dossier });
      },
    });
    expect((await w.post({ dossier: DOSSIER })).status).toBe(201);
    expect(judged).toEqual([DOSSIER]);
    expect(w.calls).toEqual(['business_law_verdict_of', 'dossier_approve', 'dossier_approval']);
  });

  it('never judges a Tech Approval: a red holds the product approval only', async () => {
    const judged: string[] = [];
    const w = world({ judge: (_db, dossier) => { judged.push(dossier); return Promise.resolve(); } });
    expect((await w.post({ dossier: DOSSIER, kind: 'tech' })).status).toBe(201);
    expect(judged).toEqual([]);
    expect(w.calls[0]).toBe('dossier_approve');
  });

  it('approves when the judging fails: the database still decides', async () => {
    const w = world({ judge: () => Promise.reject(new Error('the model is down')) });
    expect((await w.post({ dossier: DOSSIER })).status).toBe(201);
  });

  it('answers a red verdict\'s refusal in the database\'s words, and labels nothing', async () => {
    const said = "Business laws: PRD #7's spec breaks BL-QUOTES-1. Change the spec, or ask the law's owner to amend it.";
    const w = world({ approve: { data: null, error: { code: '22023', message: said } }, judge: () => Promise.resolve() });
    expect(await w.post({ dossier: DOSSIER })).toEqual({ status: 400, body: { error: said } });
    expect(w.labelled).toEqual([]);
  });

  it('judges nothing for a body that names no dossier', async () => {
    const judged: string[] = [];
    const w = world({ judge: (_db, dossier) => { judged.push(dossier); return Promise.resolve(); } });
    expect((await w.post({ dossier: 'nope' })).status).toBe(400);
    expect(judged).toEqual([]);
  });
});
