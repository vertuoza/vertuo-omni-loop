import { describe, expect, it } from 'vitest';
import { checkpointsRepository, type CheckpointsDb } from './runners.repository';
import type { CheckpointManifest } from './runners.contract';

// The checkpoints' storage (PRD 2809, s4): the signed upload link it asks of the bucket runner-checkpoints, and the save
// it records through runner_checkpoint_record(), whose refusals come back in the database's words. The function's own
// rules are proven on the database by supabase/checks/runner_checkpoints.sql.

type Answer = { data: unknown; error: { code?: string; message?: string } | null };

const JOB = '00000000-0000-4000-8000-000028090a01';
const RUNNER = '00000000-0000-4000-8000-000028090f01';
const PATH = `00000000-0000-4000-8000-000028090001/${JOB}/00000000-0000-4000-8000-000028090b01.bundle`;
const MANIFEST: CheckpointManifest = {
  job: JOB, runner: 'box-1', repo: 'demo-org/app', kind: 'portable', savedAt: '2027-01-20T10:00:00.000Z', keepUntil: '2027-01-27T10:00:00.000Z',
  bundleBytes: 2048, bytes: 4096, branches: [{ branch: 'feat/x--s3', ref: 'refs/heads/omni-checkpoint/feat/x--s3', path: '.', base: null, head: 'a'.repeat(40), files: 1, commits: 0 }],
  handoff: null, failed: null,
};
const ROW = {
  id: '00000000-0000-4000-8000-000028090c01', job_id: JOB, workspace_id: '00000000-0000-4000-8000-000028090001', runner_id: RUNNER, kind: 'portable',
  manifest: MANIFEST, bytes: 2048, storage_path: PATH, keep_until: '2027-01-27T10:00:00+00:00', deleted_at: null, created_at: '2027-01-20T10:00:00+00:00', updated_at: '2027-01-20T10:00:00+00:00',
};

function fakeDb({ rpc = { data: ROW, error: null }, sign = { data: { signedUrl: 'https://store.test/sign?token=t', token: 't', path: PATH }, error: null } }: { rpc?: Answer; sign?: Answer } = {}) {
  const calls: unknown[] = [];
  const db = {
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ rpc: fn, args });
      return Promise.resolve(rpc);
    },
    storage: {
      from: (bucket: string) => ({
        createSignedUploadUrl: (path: string) => {
          calls.push({ bucket, sign: path });
          return Promise.resolve(sign);
        },
      }),
    },
  } as unknown as CheckpointsDb;
  return { db, calls };
}

const SAVE = { job: JOB, runner: RUNNER, kind: 'portable' as const, manifest: MANIFEST, bytes: 2048, path: PATH, keepUntil: '2027-01-27T10:00:00.000Z' };

describe('checkpointsRepository().signUpload()', () => {
  it('asks the bucket runner-checkpoints for an upload link at the path, and answers it', async () => {
    const { db, calls } = fakeDb();
    expect(await checkpointsRepository(db).signUpload(PATH)).toEqual({ url: 'https://store.test/sign?token=t' });
    expect(calls).toEqual([{ bucket: 'runner-checkpoints', sign: PATH }]);
  });

  it('throws, naming the bucket, when the storage gives no link', async () => {
    const { db } = fakeDb({ sign: { data: null, error: { message: 'Bucket not found' } } });
    await expect(checkpointsRepository(db).signUpload(PATH)).rejects.toThrow('runner-checkpoints: Bucket not found');
  });
});

describe('checkpointsRepository().record()', () => {
  it('calls runner_checkpoint_record() with the save, and answers its row', async () => {
    const { db, calls } = fakeDb();
    expect(await checkpointsRepository(db).record(SAVE)).toEqual({ ok: true, value: expect.objectContaining({ id: ROW.id, kind: 'portable', storage_path: PATH, manifest: MANIFEST }) as unknown });
    expect(calls).toEqual([{ rpc: 'runner_checkpoint_record', args: { p_job: JOB, p_runner: RUNNER, p_kind: 'portable', p_manifest: MANIFEST, p_bytes: 2048, p_path: PATH, p_keep_until: SAVE.keepUntil } }]);
  });

  it('sends no path for a local save', async () => {
    const { db, calls } = fakeDb({ rpc: { data: { ...ROW, kind: 'local', storage_path: null }, error: null } });
    await checkpointsRepository(db).record({ ...SAVE, kind: 'local', path: null });
    expect(calls[0]).toMatchObject({ args: { p_path: undefined, p_kind: 'local' } });
  });

  it('answers the database’s refusals in its words, and throws on anything else', async () => {
    for (const [code, refusal] of [['P0002', 'missing'], ['22023', 'malformed'], ['55000', 'conflict']] as const) {
      const { db } = fakeDb({ rpc: { data: null, error: { code, message: `words of ${code}` } } });
      expect(await checkpointsRepository(db).record(SAVE)).toEqual({ ok: false, refusal, error: `words of ${code}` });
    }
    await expect(checkpointsRepository(fakeDb({ rpc: { data: null, error: { code: '42501', message: 'permission denied' } } }).db).record(SAVE))
      .rejects.toThrow('runner_checkpoint_record: permission denied');
    await expect(checkpointsRepository(fakeDb({ rpc: { data: { id: 1 }, error: null } }).db).record(SAVE)).rejects.toThrow('runner_checkpoint_record answered out of shape');
  });
});
