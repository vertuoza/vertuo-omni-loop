// The `checkpoints-forget` job's database and bucket (PRD 2809 s6) against a stubbed PostgREST and storage: no test
// calls Supabase.
import { describe, expect, it } from 'vitest';
import { checkpointStore } from './store.ts';

type Call = { method: string; path: string; search: string; body: unknown };

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** PostgREST and storage answering by `answers[path]` (a function of the query), or a refusal when it is null. */
function dbFetch(answers: Record<string, unknown>) {
  const calls: Call[] = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(request.url);
    const text = request.method === 'GET' ? '' : await request.text();
    const path = url.pathname.replace('/rest/v1/', '').replace('/storage/v1/', 'storage/');
    const search = decodeURIComponent(url.search);
    calls.push({ method: request.method, path, search, body: text ? JSON.parse(text) : null });
    const answer = answers[path];
    if (answer === null) return json({ message: 'permission denied', code: '42501' }, 403);
    return json(typeof answer === 'function' ? (answer as (s: string) => unknown)(search) : (answer ?? []));
  };
  return { fetch, calls };
}

const store = (fetch: typeof globalThis.fetch) => checkpointStore({ url: 'https://db.example', key: 'service-key', fetch });

describe('checkpointStore.kept', () => {
  it('reads the portable saves still in the bucket, the oldest first, a page from the offset', async () => {
    const db = dbFetch({ runner_checkpoints: [{ id: 'c-1', job_id: 'j-1', storage_path: 'w/j-1/a.bundle', created_at: '2027-01-20T00:00:00Z', keep_until: '2027-01-27T00:00:00Z' }] });
    expect(await store(db.fetch).kept(400, 200)).toEqual([{ id: 'c-1', jobId: 'j-1', path: 'w/j-1/a.bundle', createdAt: '2027-01-20T00:00:00Z', keepUntil: '2027-01-27T00:00:00Z' }]);
    const [call] = db.calls;
    expect(call?.search).toContain('kind=eq.portable');
    expect(call?.search).toContain('deleted_at=is.null');
    expect(call?.search).toContain('order=created_at');
    expect(call?.search).toContain('offset=400');
    expect(call?.search).toContain('limit=200');
    expect(call?.search).not.toContain('manifest');
  });

  it('throws what the database refused', async () => {
    await expect(store(dbFetch({ runner_checkpoints: null }).fetch).kept(0, 10)).rejects.toThrow('the database refused: permission denied (42501)');
  });
});

describe('checkpointStore.ended', () => {
  /** Jobs: a (done), b (lost, resumed by c, which is running), d (lost, resumed by e, which is cancelled). */
  const jobs = (search: string) => (search.includes('select=id,resumes') ? [{ id: 'c', resumes: 'b' }, { id: 'e', resumes: 'd' }] : []);

  it('is a job whose own chain is over with nothing resumed', async () => {
    const db = dbFetch({ runner_jobs: (search: string) => (search.includes('select=id,status') ? [{ id: 'a', status: 'done' }] : []) });
    expect([...(await store(db.fetch).ended(['a']))]).toEqual(['a']);
  });

  it('follows the resumes to the last attempt: a chain still going has not ended, a cancelled last attempt has', async () => {
    const db = dbFetch({
      runner_jobs: (search: string) =>
        search.includes('select=id,status')
          ? [
              { id: 'c', status: 'running' },
              { id: 'e', status: 'cancelled' },
            ]
          : jobs(search),
    });
    expect([...(await store(db.fetch).ended(['b', 'd']))]).toEqual(['d']);
  });

  it('asks nothing of no job', async () => {
    const db = dbFetch({});
    expect((await store(db.fetch).ended([])).size).toBe(0);
    expect(db.calls).toEqual([]);
  });
});

describe('checkpointStore.remove and stamp', () => {
  it('deletes the bundles from the runner-checkpoints bucket', async () => {
    const db = dbFetch({ 'storage/object/runner-checkpoints': [] });
    await store(db.fetch).remove(['w/j-1/a.bundle']);
    expect(db.calls).toEqual([{ method: 'DELETE', path: 'storage/object/runner-checkpoints', search: '', body: { prefixes: ['w/j-1/a.bundle'] } }]);
  });

  it('calls nothing to delete nothing, and fails by the bucket\'s refusal without the path', async () => {
    const none = dbFetch({});
    await store(none.fetch).remove([]);
    expect(none.calls).toEqual([]);
    const refused = dbFetch({ 'storage/object/runner-checkpoints': null });
    await expect(store(refused.fetch).remove(['w/j-1/a.bundle'])).rejects.toThrow(/^the bucket refused: (?!.*a\.bundle)/);
  });

  it('stamps deleted_at on the rows', async () => {
    const db = dbFetch({ runner_checkpoints: [] });
    await store(db.fetch).stamp(['c-1', 'c-2'], new Date('2027-01-20T12:00:00.000Z'));
    const [call] = db.calls;
    expect(call?.method).toBe('PATCH');
    expect(call?.search).toContain('id=in.(c-1,c-2)');
    expect(call?.body).toEqual({ deleted_at: '2027-01-20T12:00:00.000Z' });
  });
});
