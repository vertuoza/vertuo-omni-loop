import { describe, expect, it } from 'vitest';
import { answerApproval, type ApprovalDeps } from './approval-api';

// The approval route tells the terminal where a repository PRD's spec stands with its business laws (bug #2793),
// as it does a product PRD's (bug #2696, ./approval-api.laws.test.ts), with a stubbed Supabase client: a GET of
// `?repo=<owner/name>&prd=<n>` carries `laws`, read for the PRD's dossier; nothing to say leaves it out.

const DOSSIER = '11111111-1111-4111-8111-111111111111';
const RED = { state: 'red' as const, reason: '1 law broken', judgedAt: '2026-12-01T09:00:00Z', findings: [{ law: 'BL-QUOTES-1', statement: 'A quote has a total above zero.', quote: 'a zero total', broken: 'The design sends an empty quote.' }] };

function world(laws: NonNullable<ApprovalDeps['laws']>) {
  const asked: string[] = [];
  const client = {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u-1' } }, error: null }) },
    rpc: () => Promise.resolve({ data: { dossier: DOSSIER, approval: null }, error: null }),
  };
  const deps: ApprovalDeps = {
    connect: (() => client) as unknown as NonNullable<ApprovalDeps['connect']>,
    session: () => Promise.resolve(null),
    label: () => Promise.resolve(),
    laws: (db, dossier) => { asked.push(dossier); return laws(db, dossier); },
  };
  const get = async (query: string) => {
    const response = await answerApproval(new Request(`https://omni.example/api/dossiers/approval?${query}`, { headers: { authorization: 'Bearer access-1' } }), deps);
    return { status: response.status, body: (await response.json()) as unknown };
  };
  return { asked, get };
}

describe('GET /api/dossiers/approval — the business laws of a repository PRD (bug #2793)', () => {
  it('carries where the spec stands, read for the PRD\'s dossier', async () => {
    const w = world(() => Promise.resolve(RED));
    expect(await w.get('repo=acme/widgets&prd=7')).toEqual({ status: 200, body: { url: `https://omni.example/prd/${DOSSIER}`, approval: null, laws: RED } });
    expect(w.asked).toEqual([DOSSIER]);
  });

  it('leaves it out with nothing to say, and when the read fails', async () => {
    const bare = { status: 200, body: { url: `https://omni.example/prd/${DOSSIER}`, approval: null } };
    expect(await world(() => Promise.resolve(null)).get('repo=acme/widgets&prd=7')).toEqual(bare);
    expect(await world(() => Promise.reject(new Error('down'))).get('repo=acme/widgets&prd=7')).toEqual(bare);
  });
});
