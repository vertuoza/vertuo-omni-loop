import { describe, expect, it, vi } from 'vitest';
import type { WaitingReads } from './waiting.service';
import { DocumentsSchema, QuestionsSchema, RunnersWaitingSchema, WaitingErrorSchema } from './waiting.contract';

vi.mock('server-only', () => ({}));
vi.mock('../data/viewer', () => ({ viewer: () => Promise.resolve({ kind: 'sign-in' }) }));

const { getDocuments, getQuestions, getReviews, getRunners, waitingReadHandlers } = await import('./waiting.controller');

// The bell's read routes (PRD 1318, s4), on a fake service: signed out → 401 `signed-out` and the
// service never called (a tab whose sign-in expired stops asking the database, bug #1316); a failed
// read → 500 `database`; signed in, the contract's shapes, read for that person, now. The Runners
// badge's route (PRD 2255, s4) answers a member's session only, with the count for the workspace they
// joined first.

const ME = '00000000-0000-4000-8000-0000000000a1';
const WORKSPACE = { id: '00000000-0000-4000-8000-0000000000c1' };
const NOW = Date.parse('2026-10-09T09:00:00Z');

const question = { kind: 'question', id: 'r1', sessionTitle: 'vertuo-omni-loop · feat/x', question: 'Which?', askedAt: NOW - 1000, sharedBy: 'Ada', sharedByFace: { kind: 'initial', letter: 'A' } } as const;
const review = { kind: 'review', id: 'w1', prd: 7, pr: 70, repo: 'acme/widgets', since: NOW - 5000 } as const;
const document = { id: 'v1', kind: 'spec', created_at: '2026-10-09T08:00:00Z', dossier: { id: 'd1', prd: 7, title: 'Widgets' } } as const;

/** A fake service that records each call, answering, or throwing when `fails`. */
function fakeReads(fails = false, waiting = 3) {
  const calls: string[] = [];
  const give = <T>(what: string, value: T): Promise<T> => {
    calls.push(what);
    return fails ? Promise.reject(new Error('connection lost')) : Promise.resolve(value);
  };
  const reads = {
    questionsReader: (me: string) => (now: number) => give(`questions ${me} ${now}`, [question]),
    documents: (me: string, now: number) => give(`documents ${me} ${now}`, [document]),
    runnersWaiting: (workspace: string) => give(`runners ${workspace}`, waiting),
    reviews: (me: string, workspace: string) => give(`reviews ${me} ${workspace}`, [review]),
  } as unknown as WaitingReads;
  return { calls, reads };
}

const signedIn = (reads: WaitingReads, workspace: () => Promise<{ id: string } | null> = () => Promise.resolve(WORKSPACE)) =>
  waitingReadHandlers({ signedIn: () => Promise.resolve({ userId: ME, reads, workspace }), now: () => NOW });
const body = async (r: Response) => ({ status: r.status, json: (await r.json()) as unknown, cache: r.headers.get('cache-control') });

describe('signed out', () => {
  it('answers 401 signed-out on every read, and calls no service', async () => {
    const signedIn = vi.fn(() => Promise.resolve(null));
    const handlers = waitingReadHandlers({ signedIn, now: () => NOW });
    expect(await body(await handlers.questions())).toEqual({ status: 401, json: { error: 'signed-out' }, cache: 'no-store' });
    const refused = await body(await handlers.documents());
    expect(refused).toEqual({ status: 401, json: { error: 'signed-out' }, cache: 'no-store' });
    expect(WaitingErrorSchema.parse(refused.json)).toEqual({ error: 'signed-out' });
    expect(await body(await handlers.runners())).toEqual({ status: 401, json: { error: 'signed-out' }, cache: 'no-store' });
    expect(await body(await handlers.reviews())).toEqual({ status: 401, json: { error: 'signed-out' }, cache: 'no-store' });
    expect(signedIn).toHaveBeenCalledTimes(4);
  });

  it('is what the live routes answer when the viewer is not signed in: a kit or runner token is no session', async () => {
    expect((await getQuestions()).status).toBe(401);
    expect((await getDocuments()).status).toBe(401);
    expect((await getRunners()).status).toBe(401);
    expect((await getReviews()).status).toBe(401);
  });
});

describe('signed in', () => {
  it('answers the Questions part read for me, now, in the contract\'s shape', async () => {
    const { calls, reads } = fakeReads();
    const answer = await body(await signedIn(reads).questions());
    expect(answer).toEqual({ status: 200, json: { questions: [question] }, cache: 'no-store' });
    expect(QuestionsSchema.parse(answer.json)).toEqual({ questions: [question] });
    expect(calls).toEqual([`questions ${ME} ${NOW}`]);
  });

  it('answers the New documents part read for me, now, in the contract\'s shape', async () => {
    const { calls, reads } = fakeReads();
    const answer = await body(await signedIn(reads).documents());
    expect(answer).toEqual({ status: 200, json: { documents: [document] }, cache: 'no-store' });
    expect(DocumentsSchema.parse(answer.json)).toEqual({ documents: [document] });
    expect(calls).toEqual([`documents ${ME} ${NOW}`]);
  });

  it('answers the Runners part\'s count for the workspace the person joined first, in the contract\'s shape (PRD 2255)', async () => {
    const { calls, reads } = fakeReads();
    const answer = await body(await signedIn(reads).runners());
    expect(answer).toEqual({ status: 200, json: { count: 3 }, cache: 'no-store' });
    expect(RunnersWaitingSchema.parse(answer.json)).toEqual({ count: 3 });
    expect(calls).toEqual([`runners ${WORKSPACE.id}`]);
  });

  it('answers the Reviews part read for me in the workspace they joined first (PRD 2377 s5)', async () => {
    const { calls, reads } = fakeReads();
    expect(await body(await signedIn(reads).reviews())).toEqual({ status: 200, json: { items: [review] }, cache: 'no-store' });
    expect(calls).toEqual([`reviews ${ME} ${WORKSPACE.id}`]);
  });

  it('answers no reviews for a person in no workspace, and reads nothing', async () => {
    const { calls, reads } = fakeReads();
    expect(await body(await signedIn(reads, () => Promise.resolve(null)).reviews())).toEqual({ status: 200, json: { items: [] }, cache: 'no-store' });
    expect(calls).toEqual([]);
  });

  it('answers a count of 0 for a person in no workspace, and reads nothing', async () => {
    const { calls, reads } = fakeReads();
    expect(await body(await signedIn(reads, () => Promise.resolve(null)).runners())).toEqual({ status: 200, json: { count: 0 }, cache: 'no-store' });
    expect(calls).toEqual([]);
  });

  it('answers 500 database when a read fails, logged', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { reads } = fakeReads(true);
    expect(await body(await signedIn(reads).questions())).toEqual({ status: 500, json: { error: 'database' }, cache: 'no-store' });
    expect(await body(await signedIn(reads).documents())).toEqual({ status: 500, json: { error: 'database' }, cache: 'no-store' });
    expect(await body(await signedIn(reads).runners())).toEqual({ status: 500, json: { error: 'database' }, cache: 'no-store' });
    expect(await body(await signedIn(reads).reviews())).toEqual({ status: 500, json: { error: 'database' }, cache: 'no-store' });
    expect(error).toHaveBeenCalledTimes(4);
    error.mockRestore();
  });

  it('answers 500 database when the person\'s workspace cannot be read, and reads no count', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { calls, reads } = fakeReads();
    const lost = signedIn(reads, () => Promise.reject(new Error('workspace read failed')));
    expect(await body(await lost.runners())).toEqual({ status: 500, json: { error: 'database' }, cache: 'no-store' });
    expect(calls).toEqual([]);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});
