import { describe, expect, it } from 'vitest';
import { parseApprovalReply } from 'omni-loop/kit/lib/approval/approval.ts';
import { approveDossier, answerApproval, type ApprovalDeps } from './approval-api';

// The approval route and a Tech Approval (PRD 2608 s3), with a stubbed Supabase client: the reply's `tech`,
// absent when nobody asked (BR-PRODUCT-127), and a POST with `kind: 'tech'` that asks the product's approvers
// with nothing else run and adds no approved label. A product approval refused while it waits (BR-PRODUCT-126)
// reaches the caller in the database's words.

const DOSSIER = '11111111-1111-4111-8111-111111111111';
const URL_ = `https://omni.example/prd/${DOSSIER}`;
const ADA = { id: '00000000-0000-4000-8000-0000000000a1', email: 'ada@acme.test' };
const FILES = [{ kind: 'spec', path: 'spec.md', sha256: 'a'.repeat(64), versionId: '22222222-2222-4222-8222-222222222222', content: 'the spec' }];
const APPROVED = { dossier: DOSSIER, approval: { approver: { login: 'bob-gh', member: true }, approvedAt: '2026-10-09T10:00:00.123456+00:00', files: FILES } };
const IN_FORCE = { url: URL_, approval: { ...APPROVED.approval, approvedAt: '2026-10-09T10:00:00.123Z' } };

type Answer = { data: unknown; error: { code?: string; message?: string } | null };

function world({ answers = {}, askProduct = () => Promise.resolve() }: { answers?: Record<string, Answer>; askProduct?: () => Promise<void> } = {}) {
  const calls: Array<{ fn: string; args: unknown }> = [];
  const labelled: Array<[string, number]> = [];
  const told: unknown[] = [];
  const asked: Array<{ repo: string; prd: number; origin: string }> = [];
  const rpc = (fn: string, args: unknown) => {
    calls.push({ fn, args });
    return Promise.resolve(answers[fn] ?? (fn === 'dossier_approval' ? { data: APPROVED, error: null } : { data: { id: 'a1', repo: 'acme/widgets', prd: 1299 }, error: null }));
  };
  const connect = () => ({
    auth: { getUser: () => Promise.resolve({ data: { user: ADA }, error: null }) },
    rpc,
  });
  const deps: ApprovalDeps = {
    connect: connect as unknown as NonNullable<ApprovalDeps['connect']>,
    session: () => Promise.resolve({ rpc } as unknown as Awaited<ReturnType<ApprovalDeps['session']>>),
    label: (repo, prd) => { labelled.push([repo, prd]); return Promise.resolve(); },
    tellApp: (event) => { told.push(event); return Promise.resolve(true); },
    askProduct: (_db, repo, prd, origin) => { asked.push({ repo, prd, origin }); return askProduct(); },
  };
  const get = async () => {
    const response = await answerApproval(new Request('https://omni.example/api/dossiers/approval?repo=acme/widgets&prd=1299', { headers: { authorization: 'Bearer t' } }), deps);
    return { status: response.status, body: (await response.json()) as unknown };
  };
  const post = async (body: unknown) => {
    const response = await approveDossier(new Request('https://omni.example/api/dossiers/approval', { method: 'POST', body: JSON.stringify(body) }), deps);
    return { status: response.status, body: (await response.json()) as unknown };
  };
  return { calls, labelled, told, asked, get, post };
}

describe('GET /api/dossiers/approval, a Tech Approval', () => {
  it('passes the tech part on when there is one, in the shape the kit reads', async () => {
    for (const state of ['asked', 'approved', 'voided']) {
      const w = world({ answers: { dossier_approval: { data: { dossier: DOSSIER, approval: null, tech: { login: 'irisa', state } }, error: null } } });
      const { body } = await w.get();
      expect(body).toEqual({ url: URL_, approval: null, tech: { login: 'irisa', state } });
      expect(parseApprovalReply(body)?.tech).toEqual({ login: 'irisa', state });
    }
    const both = world({ answers: { dossier_approval: { data: { ...APPROVED, tech: { login: 'irisa', state: 'approved' } }, error: null } } });
    expect((await both.get()).body).toEqual({ ...IN_FORCE, tech: { login: 'irisa', state: 'approved' } });
  });

  it('leaves the tech part out when nobody asked: absent, not empty', async () => {
    const w = world({ answers: { dossier_approval: { data: { dossier: DOSSIER, approval: null }, error: null } } });
    expect((await w.get()).body).not.toHaveProperty('tech');
    expect((await world().get()).body).not.toHaveProperty('tech');
  });

  it('answers 500 for a tech part out of shape', async () => {
    const w = world({ answers: { dossier_approval: { data: { dossier: DOSSIER, approval: null, tech: { login: 'irisa', state: 'dreaming' } }, error: null } } });
    expect((await w.get()).status).toBe(500);
  });
});

describe('POST /api/dossiers/approval, giving a Tech Approval', () => {
  const given = { dossier_approve: { data: { id: 'a1', repo: 'acme/widgets', prd: 1299, kind: 'tech' }, error: null } };
  const read = { dossier_approval: { data: { dossier: DOSSIER, approval: null, tech: { login: 'irisa', state: 'approved' } }, error: null } };

  it('gives it by its kind, asks the product approvers with nothing else run, and adds no approved label', async () => {
    const w = world({ answers: { ...given, ...read } });
    expect(await w.post({ dossier: DOSSIER, kind: 'tech' })).toEqual({
      status: 201, body: { url: URL_, approval: null, tech: { login: 'irisa', state: 'approved' } },
    });
    expect(w.calls.map((c) => [c.fn, c.args])).toEqual([
      ['dossier_approve', { p_dossier: DOSSIER, p_kind: 'tech' }],
      ['dossier_approval', { p_repo: 'acme/widgets', p_prd: 1299 }],
    ]);
    expect(w.asked).toEqual([{ repo: 'acme/widgets', prd: 1299, origin: 'https://omni.example' }]);
    expect(w.labelled).toEqual([]);
    expect(w.told).toEqual([]);
  });

  it('keeps the tech approval when the approvers cannot be asked', async () => {
    const w = world({ answers: { ...given, ...read }, askProduct: () => Promise.reject(new Error('boom')) });
    expect((await w.post({ dossier: DOSSIER, kind: 'tech' })).status).toBe(201);
    expect(w.labelled).toEqual([]);
  });

  it('asks nobody when the database refuses it, in its own words', async () => {
    const w = world({ answers: { dossier_approve: { data: null, error: { code: '42501', message: "Only irisa gives this PRD's Tech Approval." } } } });
    expect(await w.post({ dossier: DOSSIER, kind: 'tech' })).toEqual({ status: 403, body: { error: "Only irisa gives this PRD's Tech Approval." } });
    expect(w.asked).toEqual([]);
  });

  it('labels as ever, and asks nobody, for a product approval named by its kind', async () => {
    const w = world({ answers: { dossier_approve: { data: { id: 'a1', repo: 'acme/widgets', prd: 1299, kind: 'product' }, error: null } } });
    expect((await w.post({ dossier: DOSSIER, kind: 'product' })).status).toBe(201);
    expect(w.calls[0]?.args).toEqual({ p_dossier: DOSSIER });
    expect(w.labelled).toEqual([['acme/widgets', 1299]]);
    expect(w.asked).toEqual([]);
  });

  it("answers a product approval refused for want of the tech approval in the database's words, labelling nothing", async () => {
    const w = world({ answers: { dossier_approve: { data: null, error: { code: '22023', message: "PRD #1299 waits for irisa's Tech Approval first." } } } });
    expect(await w.post({ dossier: DOSSIER })).toEqual({ status: 400, body: { error: "PRD #1299 waits for irisa's Tech Approval first." } });
    expect(w.labelled).toEqual([]);
  });

  it('refuses a kind it does not know, with no database call', async () => {
    const w = world();
    expect(await w.post({ dossier: DOSSIER, kind: 'other' })).toMatchObject({ status: 400 });
    expect(w.calls).toEqual([]);
  });
});
