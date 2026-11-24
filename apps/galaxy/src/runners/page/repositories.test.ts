import { describe, expect, it } from 'vitest';
import type { Job, Runner } from '../runners.contract';
import { filterRows, repositoryRows, reposWords, withRepos } from './repositories';

// The repositories drawer's rules (PRD 3232 s4): the card's words, the rows busy first then A to Z, the search, the URL.

const NOW = new Date('2027-01-20T12:00:00Z');
const id = (n: number) => `00000000-0000-4000-8000-00000000f${String(n).padStart(3, '0')}`;
const runner = (over: Partial<Runner> & Pick<Runner, 'id' | 'name'>): Runner => ({
  owner: id(900), fleet: null, slots: 3, used: 0, repos: [], version: '0.0.640', lastSeenAt: NOW.toISOString(), state: 'online', githubApp: true, ...over,
});
const job = (over: Partial<Job> & Pick<Job, 'id' | 'line'>): Job => ({
  repo: 'acme/widgets', toRunner: null, toFleet: null, sentBy: null, sentByLogin: 'ada', sentByKey: null, status: 'queued', runner: null, cancelRequested: false, logTail: '',
  prUrl: null, exitCode: null, reason: null, queuedAt: NOW.toISOString(), claimedAt: null, runningAt: null, endedAt: null, ...over,
});

const REPOS = ['acme/zebra', 'acme/Alpha', 'acme/mobile', 'acme/widgets', 'acme/beta'];
const BOX = runner({ id: id(1), name: 'box-1', repos: REPOS });
const OTHER = runner({ id: id(2), name: 'box-2', repos: ['acme/mobile', 'acme/beta'] });
const JOBS = [
  job({ id: id(10), line: '/omni:wave 1', repo: 'acme/zebra', status: 'running', runner: BOX.id }),
  job({ id: id(11), line: '/omni:wave 2', repo: 'acme/zebra', status: 'queued' }),
  job({ id: id(12), line: '/omni:wave 3', repo: 'acme/widgets', status: 'queued' }),
  job({ id: id(13), line: '/omni:wave 4', repo: 'acme/mobile', status: 'done', prUrl: 'https://github.com/acme/mobile/pull/12', endedAt: new Date(NOW.getTime() - 3 * 3_600_000).toISOString() }),
  job({ id: id(14), line: '/omni:wave 5', repo: 'acme/mobile', status: 'failed', endedAt: new Date(NOW.getTime() - 9 * 3_600_000).toISOString() }),
];
const rows = (search = '') => repositoryRows(BOX, { jobs: JOBS, runners: [BOX, OTHER] }, [], NOW, search);

describe('repositoryRows', () => {
  it('AC-7: lists the repositories with a job queued or running first, then the others A to Z', () => {
    expect(rows().map((row) => row.repo)).toEqual(['acme/widgets', 'acme/zebra', 'acme/Alpha', 'acme/beta', 'acme/mobile']);
  });

  it('counts each repository\'s running and queued jobs, and names its last ended job with its pull request and age', () => {
    const [widgets, zebra, , , mobile] = rows();
    expect(zebra).toMatchObject({ owner: 'acme', name: 'zebra', running: 1, queued: 1, cannot: 0, busy: true, counts: '1 running · 1 queued' });
    expect(widgets).toMatchObject({ running: 0, queued: 1, counts: '1 queued' });
    expect(mobile).toMatchObject({ busy: false, counts: 'No job queued or running', last: 'Done · PR #12 · 3 h ago' });
    expect(zebra?.last).toBe('No job in the last 50');
  });

  it('names the other runners that hold the repository, or says it is only on this runner', () => {
    const byRepo = Object.fromEntries(rows().map((row) => [row.repo, row.alsoOn]));
    expect(byRepo['acme/mobile']).toBe('Also on box-2');
    expect(byRepo['acme/zebra']).toBe('Only on this runner');
  });

  it('marks a queued job no runner can take as Cannot run, not as queued', () => {
    const stuck = [job({ id: id(20), line: '/omni:wave 9', repo: 'acme/beta', status: 'queued', toRunner: id(77) })];
    const [beta] = repositoryRows(BOX, { jobs: stuck, runners: [BOX, OTHER] }, [], NOW, 'beta');
    expect(beta).toMatchObject({ queued: 0, cannot: 1, busy: true, counts: '1 cannot run' });
  });

  it('AC-7: a search keeps only the repositories that match, whatever the case', () => {
    expect(rows('  ALP ').map((row) => row.repo)).toEqual(['acme/Alpha']);
    expect(rows('acme/m').map((row) => row.repo)).toEqual(['acme/mobile']);
    expect(rows('nothing')).toEqual([]);
    expect(filterRows(rows(), '')).toHaveLength(5);
  });
});

describe('reposWords', () => {
  it('AC-7: reads `<n> repositories`, then `· <k> with jobs` when some have a job', () => {
    expect(reposWords(rows())).toBe('5 repositories · 2 with jobs');
    expect(reposWords([])).toBe('0 repositories');
    expect(reposWords(rows().slice(0, 1))).toBe('1 repository · 1 with jobs');
    expect(reposWords(rows().slice(2, 3))).toBe('1 repository');
  });
});

describe('withRepos', () => {
  it('sets or clears `?repos=`, keeping every other parameter and the hash', () => {
    expect(withRepos('https://x.test/app/runners?jobs=failed#top', 'box 1')).toBe('/app/runners?jobs=failed&repos=box+1#top');
    expect(withRepos('https://x.test/app/runners?jobs=failed&repos=box-1', null)).toBe('/app/runners?jobs=failed');
  });
});
