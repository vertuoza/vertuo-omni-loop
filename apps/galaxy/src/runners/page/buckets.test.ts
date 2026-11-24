import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Board, Job, Runner } from '../runners.contract';
import { bucketCounts, bucketsOf, jobBucket, jobTabOf, lastJobWords, type JobBucket, type RunnersPageView } from './model';
import { RunnersPage } from './RunnersPage';

// The jobs' buckets, tabs and Needs you band (PRD 3232 s1): the pure bucket of every status the `runners` screen lists,
// then the page drawn on the server for each tab.

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const NOW = new Date('2027-02-01T12:00:00Z');
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ').trim();
const id = (n: number) => `00000000-0000-4000-8000-00000000e${String(n).padStart(3, '0')}`;
const BOX = id(900);

const runner: Runner = { id: BOX, name: 'box', owner: id(901), fleet: null, slots: 2, used: 0, repos: ['acme/widgets'], version: '0.0.700', lastSeenAt: at(0), state: 'online', githubApp: true };
let seq = 0;
const job = (over: Partial<Job> & Pick<Job, 'line' | 'status'>): Job => {
  seq += 1;
  return {
    id: id(seq), repo: 'acme/widgets', toRunner: null, toFleet: null, sentBy: null, sentByLogin: 'ada', sentByKey: null, runner: null, cancelRequested: false, logTail: '',
    prUrl: null, exitCode: null, reason: null, queuedAt: at(-60), claimedAt: null, runningAt: null, endedAt: null, ...over,
  };
};
const ended = (over: Partial<Job> & Pick<Job, 'line' | 'status'>) => job({ runner: BOX, endedAt: at(-10), ...over });
const boardOf = (jobs: Job[]): Board => ({ runners: [runner], jobs, viewer: { id: id(901), owner: true, fleet: null } });
const bucket = (one: Job, jobs: Job[] = [one], answered: string[] = []): JobBucket => jobBucket(one, boardOf(jobs), [], answered, NOW);

describe('jobBucket', () => {
  it('AC-4: puts one job of every status the runners screen lists in exactly one bucket', () => {
    const waiting = ended({ line: 'waiting', status: 'done', outcome: 'answers' });
    const answeredButton = ended({ line: 'answered', status: 'done', outcome: 'answers' });
    const fixing = ended({ line: 'fixing', status: 'done', outcome: 'answers' });
    const fixingJob = job({ line: 'fix running', status: 'running', continues: fixing.id });
    const fixed = ended({ line: 'fixed', status: 'done', outcome: 'answers' });
    const fixedJob = ended({ line: 'fix done', status: 'done', continues: fixed.id });
    const lostA = ended({ line: 'lost a', status: 'failed', reason: 'runner lost' });
    const resume = job({ line: 'lost a', status: 'queued', resumes: lostA.id, attempt: 2 });
    const lost1 = ended({ line: 'l1', status: 'failed', reason: 'runner lost' });
    const lost2 = ended({ line: 'l2', status: 'failed', reason: 'runner lost', resumes: lost1.id, attempt: 2 });
    const lost3 = ended({ line: 'l3', status: 'failed', reason: 'runner lost', resumes: lost2.id, attempt: 3 });
    const lostPlain = ended({ line: 'lost plain', status: 'failed', reason: 'runner lost' });
    const table: [Job, JobBucket][] = [
      [ended({ line: 'human', status: 'done', outcome: 'human' }), 'needs'],
      [waiting, 'needs'],
      [ended({ line: 'held', status: 'done', outcome: 'held' }), 'needs'],
      [answeredButton, 'needs'],
      [ended({ line: 'stopped', status: 'done', outcome: 'stopped' }), 'needs'],
      [lost3, 'needs'],
      [job({ line: 'queued', status: 'queued' }), 'running'],
      [job({ line: 'starting', status: 'claimed', runner: BOX }), 'running'],
      [job({ line: 'running', status: 'running', runner: BOX }), 'running'],
      [lostA, 'running'],
      [fixing, 'running'],
      [job({ line: 'cannot', status: 'queued', repo: 'acme/none' }), 'cannot'],
      [ended({ line: 'failed', status: 'failed', exitCode: 2 }), 'failed'],
      [ended({ line: 'timeout', status: 'failed', reason: 'timeout' }), 'failed'],
      [lostPlain, 'failed'],
      [ended({ line: 'done', status: 'done' }), 'done'],
      [ended({ line: 'ready', status: 'done', outcome: 'ready' }), 'done'],
      [fixed, 'done'],
      [ended({ line: 'bug fix end', status: 'done', outcome: 'review' }), 'done'],
      [ended({ line: 'changes', status: 'done', outcome: 'changes' }), 'done'],
      [ended({ line: 'cancelled', status: 'cancelled' }), 'done'],
      [ended({ line: 'key cancel', status: 'cancelled', cancelledByKey: 'cleaner' }), 'done'],
    ];
    const jobs = [...table.map(([one]) => one), fixingJob, fixedJob, resume, lost1, lost2];
    for (const [one, expected] of table) expect(bucket(one, jobs, [answeredButton.id]), one.line).toBe(expected);
    const counts = bucketCounts(bucketsOf(boardOf(jobs), [], [answeredButton.id], NOW));
    expect(counts.all).toBe(jobs.length);
    expect(counts.needs + counts.running + counts.cannot + counts.failed + counts.done).toBe(jobs.length);
  });

  it('reads any other `?jobs=` value as Running', () => {
    expect(jobTabOf('failed')).toBe('failed');
    expect(jobTabOf('all')).toBe('all');
    expect(jobTabOf('nope')).toBe('running');
    expect(jobTabOf(null)).toBe('running');
  });

  it('names the last job that ended, with its age', () => {
    expect(lastJobWords([job({ line: 'x', status: 'running' })], NOW)).toBeNull();
    const words = lastJobWords([ended({ line: '/omni:yolo 1', status: 'done', endedAt: at(-60) }), ended({ line: '/omni:yolo 2', status: 'failed', reason: 'timeout', endedAt: at(-5) })], NOW);
    expect(words).toBe('Last job: Timeout · /omni:yolo 2 · 5 min ago');
  });
});

function page(jobs: Job[], tab: string | null = null): string {
  const view: RunnersPageView = { kind: 'board', name: 'Acme', board: boardOf(jobs), fleets: [], prds: {}, now: NOW.toISOString(), answered: [] };
  return renderToStaticMarkup(createElement(RunnersPage, { view, supabase: null, signinError: null, jobs: tab }));
}
const lines = (html: string): string[] => [...html.matchAll(/<code data-content="true">([^<]+)<\/code>/g)].map((m) => m[1] ?? '');
const mixed = () => [
  job({ line: 'run-1', status: 'running', runner: BOX }),
  job({ line: 'queue-1', status: 'queued' }),
  job({ line: 'cannot-1', status: 'queued', repo: 'acme/none' }),
  ended({ line: 'fail-1', status: 'failed', exitCode: 1 }),
  ended({ line: 'fail-2', status: 'failed', exitCode: 2 }),
  ended({ line: 'done-1', status: 'done' }),
];

describe('the Runners page, by tab', () => {
  it('AC-1: opens on the running jobs, each tab with its count, Cannot run and Failed in red', () => {
    const html = page(mixed());
    expect(lines(html)).toEqual(['run-1', 'queue-1']);
    expect(text(html)).toContain('Running 2 ▲ Cannot run 1 ▲ Failed 2 Done 1 All 6');
    expect(html).toContain('runners-tab is-red"');
    expect(html.match(/runners-tab is-selected/g)).toHaveLength(1);
    expect(html).toContain('href="?jobs=failed"');
    expect(lines(page(mixed(), 'bogus'))).toEqual(['run-1', 'queue-1']);
  });

  it('AC-2: lists exactly the failed jobs for ?jobs=failed, with that tab selected', () => {
    const html = page(mixed(), 'failed');
    expect(lines(html)).toEqual(['fail-1', 'fail-2']);
    expect(html).toMatch(/runners-tab is-selected is-red"[^>]*aria-current="page"[^>]*>(<i[^>]*>[^<]*<\/i>)?Failed/);
    expect(lines(page(mixed(), 'cannot'))).toEqual(['cannot-1']);
    expect(lines(page(mixed(), 'done'))).toEqual(['done-1']);
    expect(lines(page(mixed(), 'all'))).toHaveLength(6);
  });

  it('AC-3: shows the Needs you band on every tab, and draws none when empty', () => {
    const jobs = [...mixed(), ended({ line: 'human-1', status: 'done', outcome: 'human' }), ended({ line: 'stopped-1', status: 'done', outcome: 'stopped', slicesMerged: 1, slicesTotal: 3 })];
    for (const tab of ['running', 'cannot', 'failed', 'done']) {
      const html = page(jobs, tab);
      expect(html, tab).toContain('aria-label="Needs you"');
      const band = html.slice(html.indexOf('runners-needs'), html.indexOf('runners-tabs'));
      expect(lines(band), tab).toEqual(['human-1', 'stopped-1']);
      expect(band).toContain('Need human');
      expect(band).toContain('Resume');
      expect(band).toContain('Terminal');
      expect(lines(html.slice(html.indexOf('runners-tabs'))), tab).not.toContain('human-1');
    }
    expect(lines(page(jobs, 'all'))).toContain('human-1');
    expect(page(mixed())).not.toContain('runners-needs');
  });

  it('chooses the one primary action among the band, then the open tab', () => {
    const jobs = [ended({ line: 'stopped-1', status: 'done', outcome: 'stopped' }), ended({ line: 'fail-1', status: 'failed', exitCode: 1 })];
    const primary = (html: string) => [...html.matchAll(/is-primary[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(primary(page(jobs, 'failed'))).toEqual(['Resume']);
    expect(primary(page([jobs[1] as Job], 'running'))).toEqual([]);
    expect(primary(page([jobs[1] as Job], 'failed'))).toEqual(['Send again']);
  });

  it('AC-5: says Nothing running with the last job and a link to each tab with jobs', () => {
    const html = page([ended({ line: 'fail-1', status: 'failed', exitCode: 1, endedAt: at(-5) }), ended({ line: 'done-1', status: 'done', endedAt: at(-30) })]);
    const t = text(html);
    expect(t).toContain('Nothing running.');
    expect(t).toContain('Last job: Failed, exit 1 · fail-1 · 5 min ago');
    expect(html).toContain('href="?jobs=failed">Failed 1</a>');
    expect(html).toContain('href="?jobs=done">Done 1</a>');
    expect(html).not.toContain('href="?jobs=cannot">Cannot run');
  });

  it('reads another empty tab as No job here', () => {
    const t = text(page([job({ line: 'run-1', status: 'running', runner: BOX })], 'failed'));
    expect(t).toContain('No job here.');
    expect(t).toContain('Nothing here in the last 50.');
  });
});
