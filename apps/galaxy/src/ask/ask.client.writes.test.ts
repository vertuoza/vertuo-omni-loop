import { describe, expect, it } from 'vitest';
import { SHOT_MAX_BYTES } from './answer-model';
import { askClient, AskSignedOut, TOO_LARGE, type Fetch } from './ask.client';
import { stageShots, trayOf } from './page/attachments';
import { questionWrites, sessionWrites } from './page/writes';

// The ask pages' writes from the browser (PRD 1318, s3), on a fake fetch: answering, deleting, sorting
// and sharing go through the routes the terminal calls, with the sign-in cookie and no bearer token;
// each screenshot goes first, one per request, and one over 4 MB is refused before any request; a 401
// throws AskSignedOut, as a read does.

const SESSION_ID = '00000000-0000-4000-8000-000000000001';
const ROUND_ID = '00000000-0000-4000-8000-000000000002';
const ANSWERS = { 'Which?': 'A' };

type Sent = { url: string; method: string | undefined; body: unknown; type: string | null; credentials: RequestCredentials | undefined; auth: string | null };

/** A fetch answering each request with `answer(url, method)`, and every request it was sent. */
function fakeFetch(answer: (url: string, method: string) => { status: number; body?: unknown }) {
  const sent: Sent[] = [];
  const fetchFn: Fetch = (url, init) => {
    const headers = new Headers(init.headers);
    const body: unknown = init.body instanceof Blob ? `blob:${init.body.size}` : typeof init.body === 'string' ? JSON.parse(init.body) : undefined;
    sent.push({ url, method: init.method, body, type: headers.get('content-type'), credentials: init.credentials, auth: headers.get('authorization') });
    const { status, body: reply = {} } = answer(url, init.method ?? 'GET');
    return Promise.resolve(Response.json(reply, { status }));
  };
  return { sent, fetchFn };
}

const ok = () => ({ status: 200 });

describe('the page\'s writes, through the routes the terminal calls', () => {
  it('answers via the page, with the cookie and no bearer token', async () => {
    const { sent, fetchFn } = fakeFetch(ok);
    expect(await askClient(fetchFn).answer(ROUND_ID, ANSWERS)).toBe('answered');
    expect(sent).toEqual([{
      url: `/api/ask/rounds/${ROUND_ID}/answers`, method: 'POST', body: { answers: ANSWERS, via: 'page' }, type: 'application/json', credentials: 'same-origin', auth: null,
    }]);
  });

  it('reads a round no longer open, or not the person\'s to answer, as taken', async () => {
    for (const status of [409, 404]) expect(await askClient(fakeFetch(() => ({ status })).fetchFn).answer(ROUND_ID, ANSWERS)).toBe('taken');
    await expect(askClient(fakeFetch(() => ({ status: 500, body: { error: 'The ask database could not answer.' } })).fetchFn).answer(ROUND_ID, ANSWERS))
      .rejects.toMatchObject({ name: 'AskReadFailed', status: 500 });
  });

  it('deletes, sorts and shares, each on its route', async () => {
    const { sent, fetchFn } = fakeFetch((url) => ({ status: 200, body: url.endsWith('/category') ? { id: ROUND_ID, category: 'product', category_by: 'ada' } : {} }));
    const client = askClient(fetchFn);
    expect(await client.remove(SESSION_ID)).toBe(true);
    expect(await client.sort(ROUND_ID, 'product')).toEqual({ category: 'product', category_by: 'ada' });
    expect(await client.share(ROUND_ID, 'bob')).toBe(true);
    expect(sent.map((s) => [s.method, s.url, s.body])).toEqual([
      ['DELETE', `/api/ask/sessions/${SESSION_ID}`, undefined],
      ['PATCH', `/api/ask/rounds/${ROUND_ID}/category`, { category: 'product' }],
      ['POST', `/api/ask/rounds/${ROUND_ID}/shares`, { member: 'bob' }],
    ]);
  });

  it('reads the refusals the page has words for: not the owner, not a member, not readable', async () => {
    const client = (status: number) => askClient(fakeFetch(() => ({ status })).fetchFn);
    expect(await client(403).remove(SESSION_ID)).toBe(false);
    expect(await client(404).sort(ROUND_ID, null)).toBeNull();
    expect(await client(400).share(ROUND_ID, 'carl')).toBe(false);
    await expect(client(500).share(ROUND_ID, 'carl')).rejects.toMatchObject({ status: 500 });
  });

  it('throws AskSignedOut on a 401, on every write', async () => {
    const client = askClient(fakeFetch(() => ({ status: 401, body: { error: 'Sign in first' } })).fetchFn);
    for (const write of [() => client.answer(ROUND_ID, ANSWERS), () => client.remove(SESSION_ID), () => client.sort(ROUND_ID, null), () => client.share(ROUND_ID, 'bob')]) {
      await expect(write()).rejects.toBeInstanceOf(AskSignedOut);
    }
  });
});

describe('screenshots, one per request (PRD 620; PRD 1318, s3)', () => {
  const shot = (id: string, size = 10) => ({ id, type: 'image/png', size, file: new Blob(['x'.repeat(size)], { type: 'image/png' }) });

  it('uploads each staged screenshot first, then answers with their paths', async () => {
    const { sent, fetchFn } = fakeFetch(ok);
    stageShots(ROUND_ID, { 'Which?': [shot('a'), shot('b')] });
    expect(await sessionWrites(askClient(fetchFn), SESSION_ID).send(ROUND_ID, ANSWERS)).toBe('answered');
    expect(sent.map((s) => [s.method, s.url, s.body, s.type])).toEqual([
      ['POST', `/api/ask/rounds/${ROUND_ID}/attachments/1.png`, 'blob:10', 'image/png'],
      ['POST', `/api/ask/rounds/${ROUND_ID}/attachments/2.png`, 'blob:10', 'image/png'],
      ['POST', `/api/ask/rounds/${ROUND_ID}/answers`, { answers: ANSWERS, via: 'page', attachments: { 'Which?': [`${ROUND_ID}/1.png`, `${ROUND_ID}/2.png`] } }, 'application/json'],
    ]);
    expect(trayOf(ROUND_ID).uploaded.size).toBe(0);
  });

  it('refuses one over 4 MB before any request, and records nothing', async () => {
    const { sent, fetchFn } = fakeFetch(ok);
    const round = '00000000-0000-4000-8000-000000000003';
    stageShots(round, { 'Which?': [shot('big', SHOT_MAX_BYTES + 1)] });
    await expect(questionWrites(askClient(fetchFn)).send(round, ANSWERS)).rejects.toThrow();
    expect(sent).toEqual([]);
    expect(await askClient(fetchFn).bucket().upload(`${round}/1.png`, new Blob(['x'.repeat(SHOT_MAX_BYTES + 1)]), { contentType: 'image/png', upsert: false }))
      .toEqual({ error: { message: TOO_LARGE, statusCode: '413' } });
    expect(sent).toEqual([]);
  });

  it('says the server\'s too-large in the page\'s words, and passes one already there on as 409', async () => {
    const bucket = (status: number) => askClient(fakeFetch(() => ({ status, body: { error: 'too-large' } })).fetchFn).bucket();
    const file = new Blob(['x']);
    expect(await bucket(413).upload(`${ROUND_ID}/1.png`, file, { contentType: 'image/png', upsert: false })).toEqual({ error: { message: TOO_LARGE, statusCode: '413' } });
    expect((await bucket(409).upload(`${ROUND_ID}/1.png`, file, { contentType: 'image/png', upsert: false })).error).toMatchObject({ statusCode: '409' });
  });

  it('deletes a dropped screenshot on its own route', async () => {
    const { sent, fetchFn } = fakeFetch(ok);
    expect(await askClient(fetchFn).bucket().remove([`${ROUND_ID}/1.png`, `${ROUND_ID}/2.webp`])).toEqual({ error: null });
    expect(sent.map((s) => [s.method, s.url])).toEqual([
      ['DELETE', `/api/ask/rounds/${ROUND_ID}/attachments/1.png`],
      ['DELETE', `/api/ask/rounds/${ROUND_ID}/attachments/2.webp`],
    ]);
  });
});

describe('the way back (PRD 384)', () => {
  it('reads a dossier\'s rounds through its route, null when it cannot be read', async () => {
    const rounds = [{ round_id: ROUND_ID, status: 'open', created_at: '2026-10-09T08:30:00Z' }];
    const { sent, fetchFn } = fakeFetch(() => ({ status: 200, body: { rounds } }));
    expect(await askClient(fetchFn).dossierRounds('dossier-1')).toEqual(rounds);
    expect(sent.map((s) => s.url)).toEqual(['/api/ask/dossiers/dossier-1/rounds']);
    expect(await askClient(fakeFetch(() => ({ status: 404 })).fetchFn).dossierRounds('dossier-1')).toBeNull();
  });
});
