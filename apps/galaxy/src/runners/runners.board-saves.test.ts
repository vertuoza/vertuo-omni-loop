import { describe, expect, it } from 'vitest';
import type { CheckpointManifest } from './runners.contract';
import type { CheckpointRow } from './runners.repository';
import { runnersService, type ResumeSaves } from './runners.service';
import { fakeStore, jobRow, MO, SHARED, T0, WORKSPACE } from './fixtures/store.fake';
import { stubGithub } from './fixtures/github.fake';

// What the Runners page reads of a workspace's saves (PRD 2809, s7): the board lists each save of the jobs it shows, by its
// manifest, never its bundle's link or any file's content; a service built without storage lists none.

const DAY_MS = 24 * 60 * 60 * 1000;
const at = (seconds: number) => new Date(T0.getTime() + seconds * 1000).toISOString();
const KEEP = new Date(T0.getTime() + 7 * DAY_MS).toISOString();

function manifest(job: string, kind: 'portable' | 'local'): CheckpointManifest {
  return {
    job, runner: 'box-1', repo: 'demo-org/app', kind, savedAt: at(-600), keepUntil: KEEP, bundleBytes: 2048, bytes: 1_048_576,
    branches: [
      { branch: 'feat/x--s3', ref: 'refs/heads/omni-checkpoint/feat/x--s3', path: '.', base: 'a'.repeat(40), head: 'b'.repeat(40), files: 3, commits: 1 },
      { branch: 'feat/x--s4', ref: 'refs/heads/omni-checkpoint/feat/x--s4', path: 'w', base: null, head: 'c'.repeat(40), files: 2, commits: 0 },
    ],
    handoff: 'Next: the route.', failed: null,
  };
}

const row = (job: string, kind: 'portable' | 'local'): CheckpointRow => ({
  id: '00000000-0000-4000-8000-00002809e001', job_id: job, workspace_id: WORKSPACE, runner_id: SHARED, kind, manifest: manifest(job, kind), bytes: 1_048_576,
  storage_path: kind === 'portable' ? `${WORKSPACE}/${job}/x.bundle` : null, keep_until: KEEP, deleted_at: null,
});

const LOST = '00000000-0000-4000-8000-00002809e0a1';

function board(rows: CheckpointRow[], withSaves = true) {
  const lost = jobRow({ id: LOST, line: '/omni:wave 2803', status: 'failed', reason: 'runner lost', runner_id: SHARED, ended_at: at(-600) });
  const asked: string[][] = [];
  const saves: ResumeSaves = {
    savesOf: (jobs) => { asked.push([...jobs]); return Promise.resolve(rows.filter((r) => jobs.includes(r.job_id))); },
    signDownload: () => Promise.reject(new Error('never signed for the page')),
  };
  const { store } = fakeStore({ jobs: [lost], now: () => T0 });
  const service = runnersService(store, { now: () => T0, sleep: () => Promise.resolve() }, stubGithub().deps, undefined, undefined, withSaves ? saves : undefined);
  return { lost, asked, read: () => service.board(MO, WORKSPACE) };
}

describe('the board\'s saves (PRD 2809, s7)', () => {
  it('lists each save of the jobs it shows from its manifest: the runner, the kind, when, until when, the bytes, the branches and the files', async () => {
    const withRow = board([row(LOST, 'local')]);
    const served = await withRow.read();
    expect(served.ok && served.value.saves).toEqual([
      { job: withRow.lost.id, runner: 'box-1', kind: 'local', savedAt: at(-600), keepUntil: KEEP, bytes: 1_048_576, branches: 2, files: 5 },
    ]);
    expect(withRow.asked).toEqual([[withRow.lost.id]]);
  });

  it('lists none for a service without storage, and for a save whose manifest is out of shape', async () => {
    const bare = await board([], false).read();
    expect(bare.ok && bare.value.saves).toEqual([]);
    const broken = board([{ ...row(LOST, 'local'), manifest: null }]);
    const served = await broken.read();
    expect(served.ok && served.value.saves).toEqual([]);
  });
});
