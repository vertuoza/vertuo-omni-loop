import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Board, BoardSave, Job, Runner } from '../runners.contract';
import type { RunnersPageView } from './model';
import { RunnersPage } from './RunnersPage';

// The Runners page on a lost job, its resume and a runner's kept save (PRD 2809, s7), drawn on the server to static markup.

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const NOW = new Date('2027-01-20T12:00:00Z');
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000).toISOString();
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ').trim();
const BOX1 = '00000000-0000-4000-8000-00000000b001';
const BOX3 = '00000000-0000-4000-8000-00000000b003';
const id = (n: number) => `00000000-0000-4000-8000-00000000c${String(n).padStart(3, '0')}`;

const runner = (over: Partial<Runner> & Pick<Runner, 'id' | 'name'>): Runner => ({
  owner: id(900), fleet: null, slots: 1, used: 0, repos: ['acme/widgets'], version: '0.0.640', lastSeenAt: at(0), state: 'online', githubApp: true, ...over,
});
const job = (over: Partial<Job> & Pick<Job, 'id' | 'line'>): Job => ({
  repo: 'acme/widgets', toRunner: null, toFleet: null, sentBy: null, sentByLogin: 'ada', sentByKey: null, status: 'queued', runner: null, cancelRequested: false, logTail: '',
  prUrl: null, exitCode: null, reason: null, queuedAt: at(-60), claimedAt: null, runningAt: null, endedAt: null, ...over,
});
const lost = (over: Partial<Job> & Pick<Job, 'id' | 'line'>) => job({ status: 'failed', runner: BOX1, reason: 'runner lost', endedAt: at(-10), ...over });
const save = (over: Partial<BoardSave> & Pick<BoardSave, 'job' | 'kind'>): BoardSave => ({ runner: 'box-1', savedAt: at(-11), keepUntil: at(7 * 24 * 60), bytes: 1_048_576, branches: 2, files: 4, ...over });

function page(jobs: Job[], saves: BoardSave[] = []): string {
  const board: Board = {
    runners: [runner({ id: BOX1, name: 'box-1', state: 'offline' }), runner({ id: BOX3, name: 'box-3' })], jobs, saves, viewer: { id: id(900), owner: true, fleet: null },
  };
  const view: RunnersPageView = { kind: 'board', name: 'Acme', board, fleets: [], prds: {}, now: NOW.toISOString(), answered: [] };
  return renderToStaticMarkup(createElement(RunnersPage, { view, supabase: null, signinError: null }));
}

/** The markup of the job row whose id is `jobId`, up to the next row. */
function row(html: string, jobId: string): string {
  const start = html.indexOf(`id="job-${jobId}"`);
  expect(start, jobId).toBeGreaterThan(-1);
  const next = html.indexOf('runners-job"', start + 1);
  return html.slice(start, next < 0 ? undefined : next);
}
const buttons = (markup: string): string[] => [...markup.matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map((m) => m[1] ?? '').filter((label) => label !== 'Terminal');

describe('a lost job that resumes', () => {
  const first = lost({ id: id(1), line: '/omni:wave 2803' });
  const resume = job({ id: id(2), line: '/omni:wave 2803', status: 'queued', resumes: first.id, attempt: 2, resumeAfter: at(1) });
  const html = page([resume, first]);

  it('reads Lost · resuming in the failed tone, in place of Runner lost, with who went silent and the next attempt linking the resume', () => {
    const lostRow = row(html, first.id);
    expect(lostRow).toContain('<span class="runners-status is-fail">Lost · resuming</span>');
    expect(text(lostRow)).toContain('box-1 went silent at 11:50 · attempt 2 of 3 in 1 min');
    expect(lostRow).toContain(`<a href="#job-${resume.id}"`);
    expect(text(lostRow)).not.toContain('Runner lost');
  });

  it('offers nothing to press on the lost job, since its resume is queued, and takes no primary action for it', () => {
    expect(buttons(row(html, first.id))).toEqual([]);
    expect(html).not.toContain('data-primary');
  });

  it('reads the resume as after a loss linking the job, then its attempt on a line of its own, and Cancel while it waits', () => {
    const resumeRow = row(html, resume.id);
    expect(resumeRow).toContain(`<a href="#job-${first.id}" data-content="true">after a loss · job ${first.id.slice(0, 8)}</a>`);
    expect(resumeRow).toContain('<span class="runners-why" data-content="true">attempt 2 of 3</span>');
    expect(buttons(resumeRow)).toEqual(['Cancel']);
    expect(text(resumeRow)).not.toContain('Resumed from');
  });
});

describe('what came back, once the resume started', () => {
  const first = lost({ id: id(1), line: '/omni:wave 2803' });
  const running = job({ id: id(2), line: '/omni:wave 2803', status: 'running', runner: BOX3, resumes: first.id, attempt: 2, claimedAt: at(-1), runningAt: at(-1) });

  it('reads the save it resumed from with its branches', () => {
    expect(text(row(page([running, first], [save({ job: first.id, kind: 'portable' })]), running.id))).toContain('Resumed from the 11:49 save · 2 branches');
  });

  it('reads Started over when nothing was unsaved', () => {
    expect(text(row(page([running, first]), running.id))).toContain('Started over: nothing was unsaved');
  });

  it('reads the files that stayed on a runner whose save is local', () => {
    expect(text(row(page([running, first], [save({ job: first.id, kind: 'local', files: 3 })]), running.id))).toContain('3 files stayed on box-1');
  });
});

describe('Lost 3 times', () => {
  const first = lost({ id: id(1), line: '/omni:yolo 2803', endedAt: at(-40) });
  const second = lost({ id: id(2), line: '/omni:yolo 2803', resumes: first.id, attempt: 2, endedAt: at(-30) });
  const third = lost({ id: id(3), line: '/omni:yolo 2803', resumes: second.id, attempt: 3, endedAt: at(-10) });
  const html = page([third, second, first]);

  it('reads Lost 3 times in the failed tone with the losses\' times under it, Resume its one action and the page\'s primary', () => {
    const thirdRow = row(html, third.id);
    expect(thirdRow).toContain('<span class="runners-status is-fail">Lost 3 times</span>');
    expect(text(thirdRow)).toContain('Lost at 11:20 · 11:30 · 11:50');
    expect(buttons(thirdRow)).toEqual(['Resume']);
    expect(thirdRow).toContain('runners-ghost is-primary" data-primary');
  });

  it('leaves the two losses that resumed as Lost · resuming, with no button', () => {
    expect(text(row(html, second.id))).toContain('Lost · resuming');
    expect(buttons(row(html, first.id))).toEqual([]);
  });
});

describe('a lost job nothing resumes', () => {
  it('reads Runner lost with Send again, as before, for a skill outside the resumable ones', () => {
    const plain = lost({ id: id(1), line: '/omni:plan 2803' });
    const markup = row(page([plain]), plain.id);
    expect(text(markup)).toContain('Runner lost');
    expect(buttons(markup)).toEqual(['Send again']);
  });
});

describe('a runner keeping a local save', () => {
  it('reads Keeps <size> until <day time> under its name, and a runner keeping none reads no such line', () => {
    const html = page([], [save({ job: id(1), kind: 'local', bytes: 1_258_291, keepUntil: at(7 * 24 * 60 - 31) })]);
    expect(html).toContain('<span class="runners-name" data-content="true">box-1<small class="runners-keeps runners-muted">Keeps 1.2 MB until Wed 11:29</small></span>');
    expect(html).toContain('<span class="runners-name" data-content="true">box-3</span>');
  });

  it('keeps no line for a save that is in the bucket', () => {
    expect(page([], [save({ job: id(1), kind: 'portable' })])).not.toContain('Keeps');
  });
});
