import { describe, expect, it } from 'vitest';
import type { TokenCheck } from '../ask/auth';
import { checkpointJob, type RunnersDeps } from './runners.controller';
import type { CheckpointManifest } from './runners.contract';
import type { CheckpointRow, CheckpointSave, CheckpointsRepository, Recorded } from './runners.repository';
import { checkpointsService, SIGNED_UPLOAD_MS } from './runners.service';
import { CIA_BOX, EVE, fakeStore, jobRow, MO, OLGA, SHARED, T0, WORKSPACE } from './fixtures/store.fake';

// A job's save (PRD 2809, s4), through `POST /api/runners/jobs/<id>/checkpoint` with the real service: the job's own
// runner asks a signed upload link to the private bucket `runner-checkpoints`, then records the save's manifest,
// read by the kit's CheckpointManifestSchema; a lost job's runner may still save it. The checkpoints' storage is in
// memory, refusing as runner_checkpoint_record() refuses (supabase/checks/runner_checkpoints.sql proves the function).

const TOKENS: Record<string, string> = { 'olga-token': OLGA, 'mo-token': MO, 'eve-token': EVE };
const connect = (): TokenCheck => ({
  auth: {
    getUser: (jwt: string) => {
      const id = TOKENS[jwt];
      return Promise.resolve(id ? { data: { user: { id, email: null } }, error: null } : { data: { user: null }, error: { status: 401 } });
    },
  },
});

const DAY_MS = 24 * 60 * 60 * 1000;
const BUNDLE_ID = '00000000-0000-4000-8000-000028090b01';
const iso = (ms: number) => new Date(T0.getTime() + ms).toISOString();

function manifest(job: string, more: Partial<CheckpointManifest> = {}): CheckpointManifest {
  return {
    job, runner: 'shared', repo: 'demo-org/app', kind: 'portable', savedAt: T0.toISOString(), keepUntil: iso(7 * DAY_MS), bundleBytes: 2048, bytes: 1_048_576,
    branches: [{ branch: 'feat/x--s3', ref: 'refs/heads/omni-checkpoint/feat/x--s3', path: '.', base: null, head: 'a'.repeat(40), files: 3, commits: 1 }],
    handoff: 'Next: the route.', failed: null, ...more,
  };
}

/** The checkpoints' storage in memory: the links it signed, and the saves as runner_checkpoint_record() keeps them. */
function fakeCheckpoints() {
  /** The bundles in the bucket, by path: a test puts one there as its runner's upload would. */
  const uploaded: string[] = [];
  const signed: string[] = [];
  const saves: CheckpointRow[] = [];
  const repository: Pick<CheckpointsRepository, 'signUpload' | 'record'> = {
    signUpload: (path) => {
      signed.push(path);
      return Promise.resolve({ url: `https://store.test/storage/v1/object/upload/sign/runner-checkpoints/${path}?token=signed` });
    },
    record: (save: CheckpointSave): Promise<Recorded> => {
      if (save.kind === 'portable' && (save.path === null || !uploaded.includes(save.path))) {
        return Promise.resolve({ ok: false, refusal: 'malformed', error: 'No bundle was uploaded at this path.' });
      }
      const held = saves.find((row) => row.job_id === save.job);
      if (held?.kind === 'portable') return Promise.resolve({ ok: false, refusal: 'conflict', error: 'This job\'s save is already in the bucket.' });
      const keepUntil = new Date(Math.min(Date.parse(save.keepUntil), T0.getTime() + 7 * DAY_MS)).toISOString();
      const row: CheckpointRow = {
        id: held?.id ?? `00000000-0000-4000-8000-00002809c${String(saves.length + 1).padStart(3, '0')}`, job_id: save.job, workspace_id: WORKSPACE, runner_id: save.runner,
        kind: save.kind, manifest: save.manifest, bytes: save.bytes, storage_path: save.path, keep_until: keepUntil, deleted_at: null,
      };
      if (held) Object.assign(held, row);
      else saves.push(row);
      return Promise.resolve({ ok: true, value: row });
    },
  };
  return { repository, signed, saves, uploaded };
}

function world({ database = true, wired = true } = {}) {
  // The shared runner holds the running job; the cia box held the one it lost.
  const running = jobRow({ status: 'running', runner_id: SHARED, claimed_at: iso(-600_000), running_at: iso(-540_000) });
  const lost = jobRow({ status: 'failed', reason: 'runner lost', runner_id: CIA_BOX, claimed_at: iso(-600_000), running_at: iso(-540_000), ended_at: iso(-60_000) });
  const queued = jobRow();
  const { store } = fakeStore({ jobs: [running, lost, queued], now: () => T0 });
  const checkpoints = fakeCheckpoints();
  const logged: string[] = [];
  const deps: RunnersDeps = {
    connect: database ? connect : null,
    session: null,
    service: null,
    checkpoints: wired ? checkpointsService(store, checkpoints.repository, { now: () => T0 }, () => BUNDLE_ID) : null,
    log: (line) => { logged.push(line); },
  };
  /** Where the job's bundle goes in the bucket. */
  const bundlePath = (job: { id: string }) => `${WORKSPACE}/${job.id}/${BUNDLE_ID}.bundle`;
  return { deps, running, lost, queued, checkpoints, logged, bundlePath };
}

const post = (id: string, token: string | null, body: unknown) =>
  new Request(`https://omni.test/api/runners/jobs/${id}/checkpoint`, { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers: token ? { authorization: `Bearer ${token}` } : {} });

async function read(response: Response) {
  return { status: response.status, body: await response.json() as unknown };
}

describe('POST /api/runners/jobs/<id>/checkpoint: the link', () => {
  it('gives the job’s own runner a signed upload link at a path of the job’s folder, and says when it stops working', async () => {
    const w = world();
    const path = `${WORKSPACE}/${w.running.id}/${BUNDLE_ID}.bundle`;
    expect(await read(await checkpointJob(post(w.running.id, 'olga-token', { step: 'link', bytes: 2048 }), w.running.id, w.deps))).toEqual({
      status: 200, body: { path, url: `https://store.test/storage/v1/object/upload/sign/runner-checkpoints/${path}?token=signed`, expiresAt: iso(SIGNED_UPLOAD_MS) },
    });
    expect(w.checkpoints.signed).toEqual([path]);
  });

  it('gives a link for a job its runner lost, so the runner that comes back saves its work before the resume starts', async () => {
    const w = world();
    expect((await checkpointJob(post(w.lost.id, 'olga-token', { step: 'link', bytes: 10 }), w.lost.id, w.deps)).status).toBe(200);
  });

  it('refuses a bundle over 100 MB, so the runner keeps it as a local save, and signs nothing', async () => {
    const w = world();
    expect(await read(await checkpointJob(post(w.running.id, 'olga-token', { step: 'link', bytes: 100 * 1024 * 1024 + 1 }), w.running.id, w.deps)))
      .toEqual({ status: 400, body: { error: 'This save is over 100 MB: keep it on the runner.' } });
    expect(w.checkpoints.signed).toEqual([]);
  });

  it('refuses another person’s runner, a job no runner holds, no job, the signed out and a body out of shape', async () => {
    const w = world();
    const cases: [Request, string, number][] = [
      [post(w.running.id, 'eve-token', { step: 'link', bytes: 1 }), w.running.id, 403],
      [post(w.running.id, 'mo-token', { step: 'link', bytes: 1 }), w.running.id, 403],
      [post(w.queued.id, 'olga-token', { step: 'link', bytes: 1 }), w.queued.id, 403],
      [post('00000000-0000-4000-8000-0000280900ff', 'olga-token', { step: 'link', bytes: 1 }), '00000000-0000-4000-8000-0000280900ff', 404],
      [post('not-a-job', 'olga-token', { step: 'link', bytes: 1 }), 'not-a-job', 404],
      [post(w.running.id, null, { step: 'link', bytes: 1 }), w.running.id, 401],
      [post(w.running.id, 'olga-token', { step: 'link', bytes: -1 }), w.running.id, 400],
      [post(w.running.id, 'olga-token', { step: 'upload' }), w.running.id, 400],
      [post(w.running.id, 'olga-token', 'not json'), w.running.id, 400],
    ];
    for (const [request, id, status] of cases) {
      const answered = await read(await checkpointJob(request, id, w.deps));
      expect(answered.status, `${request.url} ${String(status)}`).toBe(status);
      expect(answered.body).toEqual({ error: expect.any(String) as string });
    }
    expect(w.checkpoints.signed).toEqual([]);
  });

  it('answers 503 where there is no database, or no service role for the checkpoints', async () => {
    for (const w of [world({ database: false }), world({ wired: false })]) {
      expect((await checkpointJob(post(w.running.id, 'olga-token', { step: 'link', bytes: 1 }), w.running.id, w.deps)).status).toBe(503);
    }
  });
});

describe('POST /api/runners/jobs/<id>/checkpoint: the record', () => {
  it('records a portable save at its bundle, for the job’s runner, its bytes the bundle’s, kept 7 days', async () => {
    const w = world();
    const at = w.bundlePath(w.running);
    w.checkpoints.uploaded.push(at);
    const answered = await read(await checkpointJob(post(w.running.id, 'olga-token', { step: 'record', kind: 'portable', path: at, manifest: manifest(w.running.id) }), w.running.id, w.deps));
    expect(answered).toEqual({ status: 200, body: { id: '00000000-0000-4000-8000-00002809c001', kind: 'portable', keepUntil: iso(7 * DAY_MS) } });
    expect(w.checkpoints.saves).toEqual([expect.objectContaining({ job_id: w.running.id, runner_id: SHARED, kind: 'portable', storage_path: at, bytes: 2048, manifest: manifest(w.running.id) }) as unknown]);
  });

  it('records a failed upload as a local save, with its runner, its size on the runner and its keep_until', async () => {
    const w = world();
    const local = manifest(w.lost.id, { kind: 'local', runner: 'cia-box', keepUntil: iso(3 * DAY_MS), failed: 'the upload failed: the storage is unreachable' });
    expect(await read(await checkpointJob(post(w.lost.id, 'olga-token', { step: 'record', kind: 'local', manifest: local }), w.lost.id, w.deps)))
      .toEqual({ status: 200, body: { id: '00000000-0000-4000-8000-00002809c001', kind: 'local', keepUntil: iso(3 * DAY_MS) } });
    expect(w.checkpoints.saves[0]).toMatchObject({ runner_id: CIA_BOX, kind: 'local', storage_path: null, bytes: 1_048_576 });
  });

  it('never keeps a local save past 7 days, whatever its runner says', async () => {
    const w = world();
    await checkpointJob(post(w.lost.id, 'olga-token', { step: 'record', kind: 'local', manifest: manifest(w.lost.id, { kind: 'local', keepUntil: iso(30 * DAY_MS) }) }), w.lost.id, w.deps);
    expect(w.checkpoints.saves[0]?.keep_until).toBe(iso(7 * DAY_MS));
  });

  it('refuses a manifest of another job or kind, one that holds a credential, and a key it does not know', async () => {
    const w = world();
    const token = ['ghs', 'fakeTokenOfTheJob0123456789ABCDEF'].join('_');
    const bodies = [
      { step: 'record', kind: 'local', manifest: manifest(w.lost.id, { kind: 'local' }) },
      { step: 'record', kind: 'local', manifest: manifest(w.running.id) },
      { step: 'record', kind: 'local', manifest: manifest(w.running.id, { kind: 'local', handoff: `push with ${token}` }) },
      { step: 'record', kind: 'local', manifest: { ...manifest(w.running.id, { kind: 'local' }), folder: '/home/olga/wt/app-job-1' } },
      { step: 'record', kind: 'portable', manifest: manifest(w.running.id) },
    ];
    for (const body of bodies) {
      const answered = await read(await checkpointJob(post(w.running.id, 'olga-token', body), w.running.id, w.deps));
      expect(answered.status).toBe(400);
      expect(JSON.stringify(answered.body)).not.toContain(token);
    }
    expect(w.checkpoints.saves).toEqual([]);
  });

  it('answers the database’s refusals in its words: a bundle never uploaded, a local save after the portable one', async () => {
    const w = world();
    const at = w.bundlePath(w.running);
    const record = (body: unknown) => checkpointJob(post(w.running.id, 'olga-token', body), w.running.id, w.deps).then(read);
    expect(await record({ step: 'record', kind: 'portable', path: at, manifest: manifest(w.running.id) }))
      .toEqual({ status: 400, body: { error: 'No bundle was uploaded at this path.' } });
    w.checkpoints.uploaded.push(at);
    expect((await record({ step: 'record', kind: 'portable', path: at, manifest: manifest(w.running.id) })).status).toBe(200);
    expect(await record({ step: 'record', kind: 'local', manifest: manifest(w.running.id, { kind: 'local' }) }))
      .toEqual({ status: 409, body: { error: 'This job\'s save is already in the bucket.' } });
  });
});
