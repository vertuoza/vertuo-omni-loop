import { createHmac } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { receiveOutbox, signatureMatches, SIGNATURE_HEADER, type OutboxDeps } from './api';
import { OUTBOX_MAX_BYTES } from './contract';
import { fakeOutboxDb } from './store.fake';

const SECRET = 'shared-secret';
const VERTUOZA = '00000000-0000-4000-8000-00000000a0a0';
const ACME = '00000000-0000-4000-8000-00000000aced';
const KEPT = '00000000-0000-4000-8000-0000000000d7';

const sign = (raw: string, secret = SECRET) => `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;

// An outbox as the App sends it (apps/omni-app/src/relay/relay.mjs): one open item, one adopted, one
// pending answer, one settled entry.
const OUTBOX = {
  repo: 'Vertuoza/Vertuo-Omni-Loop',
  prd: 7,
  pr: { number: 12, url: 'https://github.com/vertuoza/vertuo-omni-loop/pull/12', headSha: 'abc1234def', state: 'open' },
  evaluatedAt: '2026-09-27T10:00:00.000Z',
  numbering: [{ number: 1, id: 's1-01-colour', since: '2026-09-27T09:00:00.000Z' }, { number: 2, id: 's1-02-size', since: '2026-09-27T09:00:00.000Z' }],
  open: [{ number: 1, id: 's1-01-colour', rank: 'high', text: '---\nid: s1-01-colour\n---\n' }],
  adopted: [{ number: 2, id: 's1-02-size', text: '---\nid: s1-02-size\n---\n' }],
  pending: [{ number: 1, id: 's1-01-colour', text: 'B because red', by: 'ada', at: '2026-09-27T09:30:00Z', url: 'https://github.com/vertuoza/vertuo-omni-loop/pull/12#issuecomment-5', via: 'github' }],
  settled: [{ number: null, id: 's1-00-name', verdict: 'agreed', approvedBy: 'ada', approvedAt: '2026-09-26T10:00:00Z', channel: 'feature pull request #12', channelUrl: null, answer: 'A. Keep it.' }],
};

type Call = { raw?: string; signature?: string | null; headers?: Record<string, string> };

function world({ database = true, secret = SECRET as string | null } = {}) {
  const db = fakeOutboxDb(
    [{ id: VERTUOZA, github_org: 'vertuoza' }, { id: ACME, github_org: 'acme' }],
    [{ id: KEPT, workspace_id: VERTUOZA, home_repo: 'vertuoza/vertuo-omni-loop', prd: 8, title: 'Team inbox' }],
  );
  // The stub answers only the call the store makes, so it is not a whole Supabase client.
  const deps: OutboxDeps = { secret, connect: database ? () => db.client as unknown as ReturnType<NonNullable<OutboxDeps['connect']>> : null };
  const send = async (body: unknown, { raw, signature, headers = {} }: Call = {}) => {
    const text = raw ?? JSON.stringify(body);
    const response = await receiveOutbox(
      new Request('https://omni.example/api/outbox', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(signature === null ? {} : { [SIGNATURE_HEADER]: signature ?? sign(text) }),
          ...headers,
        },
        body: text,
      }),
      deps,
    );
    return { status: response.status, body: await response.json() };
  };
  return { db, deps, send };
}

describe('POST /api/outbox: the page keeps the latest outbox', () => {
  it('stores a good body on the dossier it creates by its key, and answers the Outbox address', async () => {
    const w = world();
    const { status, body } = await w.send(OUTBOX);

    expect(status).toBe(200);
    expect(body).toEqual({ id: expect.any(String), url: `https://omni.example/prd/${body.id}?tab=outbox`, stale: false });
    expect(w.db.tables.dossiers.find((d) => d.id === body.id)).toMatchObject({
      workspace_id: VERTUOZA, home_repo: 'vertuoza/vertuo-omni-loop', prd: 7, title: 'PRD 7',
    });
    const [stored] = w.db.tables.dossier_outboxes;
    expect(stored).toMatchObject({
      dossier_id: body.id, pr_number: 12, pr_url: OUTBOX.pr.url, head_sha: 'abc1234def', state: 'open', evaluated_at: OUTBOX.evaluatedAt,
    });
    expect(stored.outbox).toEqual({
      numbering: OUTBOX.numbering, open: OUTBOX.open, adopted: OUTBOX.adopted, pending: OUTBOX.pending, settled: OUTBOX.settled,
    });
  });

  it('finds the dossier already keyed by the repository and the PRD, rather than making another', async () => {
    const w = world();
    const { status, body } = await w.send({ ...OUTBOX, prd: 8 });
    expect(status).toBe(200);
    expect(body.id).toBe(KEPT);
    expect(w.db.tables.dossiers.filter((d) => d.prd === 8)).toHaveLength(1);
    expect(w.db.tables.dossiers.find((d) => d.id === KEPT)?.title).toBe('Team inbox');
  });

  it('keeps the stored outbox when an older evaluation arrives, and says it was stale', async () => {
    const w = world();
    await w.send(OUTBOX);
    const older = { ...OUTBOX, evaluatedAt: '2026-09-27T09:00:00.000Z', open: [] };
    const { status, body } = await w.send(older);
    expect(status).toBe(200);
    expect(body.stale).toBe(true);
    expect((w.db.tables.dossier_outboxes[0].outbox as { open: unknown[] }).open).toHaveLength(1);

    const newer = { ...OUTBOX, evaluatedAt: '2026-09-27T11:00:00.000Z', open: [], pr: { ...OUTBOX.pr, state: 'merged' } };
    expect((await w.send(newer)).body.stale).toBe(false);
    expect(w.db.tables.dossier_outboxes).toHaveLength(1);
    expect(w.db.tables.dossier_outboxes[0]).toMatchObject({ state: 'merged', outbox: { open: [] } });
  });

  it('answers 404, and stores nothing, when no workspace owns the repository’s organisation', async () => {
    const w = world();
    const { status, body } = await w.send({ ...OUTBOX, repo: 'nobody/widgets' });
    expect(status).toBe(404);
    expect(body.error).toMatch(/nobody/);
    expect(w.db.tables.dossier_outboxes).toEqual([]);
  });

  it('drops a field the App adds later, rather than refusing the body', async () => {
    const w = world();
    const { status } = await w.send({ ...OUTBOX, extra: 'from a newer App', open: [{ ...OUTBOX.open[0], extra: true }] });
    expect(status).toBe(200);
    expect(w.db.tables.dossier_outboxes[0].outbox).not.toHaveProperty('extra');
    expect((w.db.tables.dossier_outboxes[0].outbox as { open: object[] }).open[0]).not.toHaveProperty('extra');
  });
});

describe('POST /api/outbox: what it refuses', () => {
  it('answers 401, and stores nothing, to a bad signature, one made with another secret, or none', async () => {
    const w = world();
    const raw = JSON.stringify(OUTBOX);
    for (const signature of [null, 'sha256=00', sign(raw, 'another-secret'), sign(raw).replace('sha256=', 'sha1='), 'garbage']) {
      const { status, body } = await w.send(OUTBOX, { raw, signature });
      expect(status, String(signature)).toBe(401);
      expect(body.error).toEqual(expect.any(String));
    }
    expect(w.db.state.calls).toEqual([]);
  });

  it('answers 401 when the body changed after it was signed', async () => {
    const w = world();
    const signed = JSON.stringify(OUTBOX);
    const { status } = await w.send(OUTBOX, { raw: JSON.stringify({ ...OUTBOX, prd: 9 }), signature: sign(signed) });
    expect(status).toBe(401);
  });

  it('answers 400 to a signed body that is not JSON, or not an outbox', async () => {
    const w = world();
    const malformed = [
      'not json',
      '[1, 2]',
      JSON.stringify({ ...OUTBOX, repo: 'no-slash' }),
      JSON.stringify({ ...OUTBOX, prd: 0 }),
      JSON.stringify({ ...OUTBOX, pr: { ...OUTBOX.pr, state: 'reopened' } }),
      JSON.stringify({ ...OUTBOX, pr: { ...OUTBOX.pr, headSha: 'head1' } }),
      JSON.stringify({ ...OUTBOX, evaluatedAt: 'yesterday' }),
      JSON.stringify({ ...OUTBOX, pending: [{ ...OUTBOX.pending[0], via: 'carrier pigeon' }] }),
      JSON.stringify({ ...OUTBOX, open: undefined }),
    ];
    for (const raw of malformed) {
      const { status, body } = await w.send(undefined, { raw });
      expect(status, raw.slice(0, 60)).toBe(400);
      expect(body.error).toEqual(expect.any(String));
    }
    expect(w.db.state.calls).toEqual([]);
  });

  it('answers 413 to a body over 2 MiB, by its declared length or by its bytes', async () => {
    const w = world();
    const big = JSON.stringify({ ...OUTBOX, open: [{ ...OUTBOX.open[0], text: 'x'.repeat(OUTBOX_MAX_BYTES) }] });
    expect((await w.send(undefined, { raw: big })).status).toBe(413);
    expect((await w.send(OUTBOX, { headers: { 'content-length': String(OUTBOX_MAX_BYTES + 1) } })).status).toBe(413);
    expect(w.db.state.calls).toEqual([]);
  });

  it('answers 503 when this deployment has no database, or no secret', async () => {
    expect((await world({ database: false }).send(OUTBOX)).status).toBe(503);
    expect((await world({ secret: null }).send(OUTBOX)).status).toBe(503);
  });

  it('answers 500, not a guess, when the database fails', async () => {
    const w = world();
    w.db.state.fail = { message: 'connection reset' };
    const { status, body } = await w.send(OUTBOX);
    expect(status).toBe(500);
    expect(body.error).toEqual(expect.any(String));
  });
});

describe('signatureMatches', () => {
  const raw = new TextEncoder().encode('{"a":1}');
  it('matches the HMAC of the raw bytes, keyed with the secret', () => {
    expect(signatureMatches(raw, sign('{"a":1}'), SECRET)).toBe(true);
    expect(signatureMatches(raw, sign('{"a":2}'), SECRET)).toBe(false);
    expect(signatureMatches(raw, sign('{"a":1}'), 'other')).toBe(false);
    expect(signatureMatches(raw, null, SECRET)).toBe(false);
  });
});
