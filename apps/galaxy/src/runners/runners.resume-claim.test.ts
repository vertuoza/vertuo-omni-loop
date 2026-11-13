import { describe, expect, it } from 'vitest';
import { RunnerJobSchema, type CheckpointManifest } from './runners.contract';
import type { CheckpointRow } from './runners.repository';
import { runnersService, SIGNED_DOWNLOAD_MS, type ResumeSaves } from './runners.service';
import { fakeStore, jobRow, MO, OLGA, SHARED, T0, WORKSPACE } from './fixtures/store.fake';
import { stubGithub } from './fixtures/github.fake';

// The claim of a resume (PRD 2809, s5), on realistic rows in memory and a fixed clock: the runner that claims it is
// handed its attempt, the earlier jobs of its chain, oldest first, and the saves they left — a portable one with a
// signed download link of minutes, a local one with its manifest alone. Which runner claims a resume whose chain keeps
// a local save is runner_claim()'s rule, proven on a database by supabase/checks/runner_resume.sql.

const DAY_MS = 24 * 60 * 60 * 1000;
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000).toISOString();

const lost = (more: Parameters<typeof jobRow>[0] = {}) =>
  jobRow({ line: '/omni:wave 2803', status: 'failed', reason: 'runner lost', runner_id: SHARED, claimed_at: at(-900), running_at: at(-890), ended_at: at(-600), ...more });

function manifest(job: string, kind: 'portable' | 'local', runner: string): CheckpointManifest {
  return {
    job, runner, repo: 'demo-org/app', kind, savedAt: at(-600), keepUntil: new Date(T0.getTime() + 7 * DAY_MS).toISOString(), bundleBytes: 2048, bytes: kind === 'local' ? 1_048_576 : 2048,
    branches: [{ branch: 'feat/x--s3', ref: 'refs/heads/omni-checkpoint/feat/x--s3', path: '.', base: 'a'.repeat(40), head: 'b'.repeat(40), files: 3, commits: 1 }],
    handoff: 'Next: the route.', failed: kind === 'local' ? 'the upload failed: the storage is unreachable' : null,
  };
}

function saveRow(job: string, kind: 'portable' | 'local', more: Partial<CheckpointRow> = {}): CheckpointRow {
  return {
    id: `00000000-0000-4000-8000-00002809d${job.slice(-3)}`, job_id: job, workspace_id: WORKSPACE, runner_id: SHARED, kind,
    manifest: manifest(job, kind, kind === 'local' ? 'box-1' : 'box-2'), bytes: 2048,
    storage_path: kind === 'portable' ? `${WORKSPACE}/${job}/00000000-0000-4000-8000-000028090b01.bundle` : null,
    keep_until: new Date(T0.getTime() + 7 * DAY_MS).toISOString(), deleted_at: null, ...more,
  };
}

/** The saves in memory, as the repository reads them: those of the jobs asked, their bundle not deleted; the links it signed. */
function fakeSaves(rows: CheckpointRow[], { signs = true } = {}) {
  const asked: string[][] = [];
  const signed: { path: string; seconds: number }[] = [];
  const saves: ResumeSaves = {
    savesOf: (jobs) => {
      asked.push([...jobs]);
      return Promise.resolve(rows.filter((row) => jobs.includes(row.job_id) && row.deleted_at === null));
    },
    signDownload: (path, seconds) => {
      if (!signs) return Promise.reject(new Error('runner-checkpoints: the storage is down'));
      signed.push({ path, seconds });
      return Promise.resolve({ url: `https://store.test/storage/v1/object/sign/runner-checkpoints/${path}?token=signed` });
    },
  };
  return { saves, asked, signed };
}

function world(jobs: ReturnType<typeof jobRow>[], saves?: ResumeSaves) {
  const { store } = fakeStore({ jobs, now: () => T0 });
  return runnersService(store, { now: () => T0, sleep: () => Promise.resolve() }, stubGithub().deps, undefined, undefined, saves);
}

const value = <T>(served: { ok: true; value: T } | { ok: false; kind: string; error: string }): T => {
  if (!served.ok) throw new Error(`refused: ${served.kind} ${served.error}`);
  return served.value;
};

describe('the claim of a resume (PRD 2809, s5)', () => {
  it('carries its attempt, the earlier jobs of its chain oldest first, and their saves: a portable one with a link of minutes, a local one alone', async () => {
    const first = lost();
    const second = lost({ resumes: first.id, attempt: 2 });
    const third = jobRow({ line: '/omni:wave 2803', resumes: second.id, attempt: 3, resume_after: at(-1), queued_at: at(-60), sent_by: MO });
    const { saves, asked, signed } = fakeSaves([saveRow(second.id, 'local'), saveRow(first.id, 'portable')]);
    const claimed = value(await world([first, second, third], saves).next(OLGA, SHARED));
    const path = `${WORKSPACE}/${first.id}/00000000-0000-4000-8000-000028090b01.bundle`;
    expect(claimed?.resume).toEqual({
      attempt: 3,
      chain: [first.id, second.id],
      saves: [
        { job: first.id, kind: 'portable', manifest: manifest(first.id, 'portable', 'box-2'), url: `https://store.test/storage/v1/object/sign/runner-checkpoints/${path}?token=signed`, expiresAt: new Date(T0.getTime() + SIGNED_DOWNLOAD_MS).toISOString() },
        { job: second.id, kind: 'local', manifest: manifest(second.id, 'local', 'box-1') },
      ],
    });
    expect(asked).toEqual([[first.id, second.id]]);
    expect(signed).toEqual([{ path, seconds: 600 }]);
    // The route answers it in the contract's shape, which the kit reads with the same schema.
    expect(RunnerJobSchema.parse(claimed).resume?.saves).toHaveLength(2);
  });

  it('leaves out a save whose bundle was deleted, and one whose manifest reads as none', async () => {
    const first = lost();
    const resume = jobRow({ line: '/omni:wave 2803', resumes: first.id, attempt: 2, resume_after: at(-1), queued_at: at(-60) });
    const { saves } = fakeSaves([saveRow(first.id, 'portable', { deleted_at: at(-10) })]);
    expect(value(await world([first, resume], saves).next(OLGA, SHARED))?.resume).toEqual({ attempt: 2, chain: [first.id], saves: [] });
    const { saves: unread } = fakeSaves([saveRow(first.id, 'local', { manifest: null })]);
    expect(value(await world([first, resume], unread).next(OLGA, SHARED))?.resume).toEqual({ attempt: 2, chain: [first.id], saves: [] });
  });

  it('carries a portable save the storage could not sign a link for with none, so its runner says it could not come', async () => {
    const first = lost();
    const resume = jobRow({ line: '/omni:wave 2803', resumes: first.id, attempt: 2, resume_after: at(-1), queued_at: at(-60) });
    const { saves } = fakeSaves([saveRow(first.id, 'portable')], { signs: false });
    expect(value(await world([first, resume], saves).next(OLGA, SHARED))?.resume?.saves).toEqual([
      { job: first.id, kind: 'portable', manifest: manifest(first.id, 'portable', 'box-2'), url: null, expiresAt: null },
    ]);
  });

  it('carries no resume for a job that resumes none, and no save on a service that reads none', async () => {
    const sent = jobRow({ line: '/omni:wave 2803' });
    const claimed = value(await world([sent], fakeSaves([]).saves).next(OLGA, SHARED));
    expect(claimed).not.toHaveProperty('resume');
    const first = lost();
    const resume = jobRow({ line: '/omni:wave 2803', resumes: first.id, attempt: 2, resume_after: at(-1), queued_at: at(-60) });
    expect(value(await world([first, resume]).next(OLGA, SHARED))?.resume).toEqual({ attempt: 2, chain: [first.id], saves: [] });
  });
});
