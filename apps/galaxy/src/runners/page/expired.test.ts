import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Board, Job, Runner } from '../runners.contract';
import { bucketsOf, canSendAgain, expiredWhy, statusTone, statusWords, type RunnersPageView } from './model';
import { RunnersPage } from './RunnersPage';

// Jobs that expired after 48 h doing nothing (PRD omni-loop-35 s4), on the Runners page: a job that ended Held, Waiting on
// answers or Need human that nobody continued reads Expired, in the ended tone of Cancelled, with why under it and Send
// again; a queued job no runner took reads Failed with its reason, no runner ever having claimed it.

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const NOW = new Date('2027-02-01T12:00:00Z');
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ').trim();
const id = (n: number) => `00000000-0000-4000-8000-00000000f${String(n).padStart(3, '0')}`;
const BOX = id(900);

const runner: Runner = { id: BOX, name: 'box', owner: id(901), fleet: null, slots: 2, used: 0, repos: ['acme/widgets'], version: '0.0.700', lastSeenAt: at(0), state: 'online', githubApp: true };
let seq = 0;
const job = (over: Partial<Job> & Pick<Job, 'line' | 'status'>): Job => {
  seq += 1;
  return {
    id: id(seq), repo: 'acme/widgets', toRunner: null, toFleet: null, sentBy: null, sentByLogin: 'ada', sentByKey: null, runner: null, cancelRequested: false, logTail: '',
    prUrl: null, exitCode: null, reason: null, queuedAt: at(-60 * 50), claimedAt: null, runningAt: null, endedAt: null, ...over,
  };
};
/** A held job the sweep expired: it ran on the box, ended Held, and nobody continued it in 48 h. */
const expired = (over: Partial<Job> = {}) => job({
  line: '/omni:yolo 3190', status: 'done', outcome: 'expired', reason: 'Expired: nobody continued it in 48 h', runner: BOX,
  claimedAt: at(-60 * 50), runningAt: at(-60 * 50), endedAt: at(-60 * 49), prUrl: 'https://github.com/acme/widgets/pull/3204', ...over,
});
/** A queued job no runner took in 48 h: it ended failed, with no runner and no claim. */
const neverTaken = (over: Partial<Job> = {}) => job({ line: '/omni:rewind 67', status: 'failed', reason: 'Expired: no runner took it in 48 h', endedAt: at(-2), ...over });
const boardOf = (jobs: Job[]): Board => ({ runners: [runner], jobs, viewer: { id: id(901), owner: true, fleet: null } });

function page(jobs: Job[], tab: string | null = 'all'): string {
  const view: RunnersPageView = { kind: 'board', name: 'Acme', board: boardOf(jobs), fleets: [], prds: {}, now: NOW.toISOString(), answered: [] };
  return renderToStaticMarkup(createElement(RunnersPage, { view, supabase: null, signinError: null, jobs: tab }));
}
/** The html of the one job row of `line` in the table (the band's rows have their own ids). */
const rowOf = (html: string, one: Job): string => {
  const from = html.indexOf(`id="job-${one.id}"`);
  const to = html.indexOf('runners-row runners-job', from);
  return html.slice(from, to === -1 ? undefined : to);
};

describe('an expired job, on the Runners page', () => {
  it('AC-3: a job whose outcome is expired reads Expired with its reason, in the ended tone, and offers Send again', () => {
    const one = expired();
    expect(statusWords(one, NOW)).toBe('Expired');
    expect(statusTone(one.status, one.outcome)).toBe('off');
    expect(statusTone('cancelled')).toBe('off');
    expect(expiredWhy(one)).toBe('nobody continued it in 48 h');
    expect(canSendAgain(one)).toBe(true);

    const row = rowOf(page([one]), one);
    expect(row).toContain('runners-status is-off');
    expect(text(row)).toContain('Expired nobody continued it in 48 h');
    expect(row).toContain('Send again');
    expect(row).toContain('Terminal');
    expect(row).toContain('href="https://github.com/acme/widgets/pull/3204"');
  });

  it('reads Expired for each wait it came from, and leaves every other done job without Send again', () => {
    expect(canSendAgain({ status: 'done', outcome: 'expired' })).toBe(true);
    for (const outcome of ['held', 'answers', 'human', 'ready', 'stopped', null] as const) expect(canSendAgain({ status: 'done', outcome }), String(outcome)).toBe(false);
    expect(canSendAgain({ status: 'failed' })).toBe(true);
    expect(canSendAgain({ status: 'cancelled' })).toBe(true);
  });

  it('says why only for an expired job: its reason without the Expired it already reads, and nothing when the row gave none', () => {
    expect(expiredWhy(expired({ reason: null }))).toBeNull();
    expect(expiredWhy({ status: 'done', outcome: 'held', reason: 'Expired: nobody continued it in 48 h' })).toBeNull();
    expect(expiredWhy({ status: 'failed', reason: 'Expired: no runner took it in 48 h' })).toBeNull();
    expect(expiredWhy(expired({ reason: 'nobody looked' }))).toBe('nobody looked');
  });

  it('lists an expired job under Done, never in the Needs you band', () => {
    const one = expired();
    const held = job({ line: '/omni:yolo 3191', status: 'done', outcome: 'held', runner: BOX, endedAt: at(-30) });
    expect(bucketsOf(boardOf([one, held]), [], [], NOW).get(one.id)).toBe('done');
    const html = page([one, held], 'running');
    const band = html.slice(html.indexOf('runners-needs'), html.indexOf('runners-tabs'));
    expect(band).toContain('/omni:yolo 3191');
    expect(band).not.toContain('/omni:yolo 3190');
    expect(text(html)).toContain('Done 1');
  });

  it('draws a queued job no runner took as Failed with its reason and Send again, though no runner ever held it', () => {
    const one = neverTaken();
    expect(statusWords(one, NOW)).toBe('Failed');
    const html = page([one], 'failed');
    const row = rowOf(html, one);
    expect(row).toContain('runners-status is-fail');
    expect(text(row)).toContain('Failed Expired: no runner took it in 48 h');
    expect(text(row)).toContain('Any runner');
    expect(row).toContain('Send again');
  });

  it('gives the page\'s one primary action to the failed job, and Send again on Expired stays quiet beside it', () => {
    const html = page([neverTaken(), expired()]);
    expect([...html.matchAll(/is-primary[^>]*>([^<]+)</g)].map((m) => m[1])).toEqual(['Send again']);
    expect(html.match(/>Send again</g)).toHaveLength(2);
  });
});
