import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Board, Job } from '../runners.contract';
import { demoRunnersPage } from './demo';
import { START_COMMAND, type RunnersPageView } from './model';
import { RunnersPage } from './RunnersPage';

// /app/runners as the server renders it (PRD 1830 s3), to static markup, on the demo's board: each
// runner state, each job status, the owner's and a member's fleet cell, Cancel and Send again only
// where they apply, the empty page, and every situation before the board.

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const NOW = new Date('2026-10-13T14:00:00Z');
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const render = (view: RunnersPageView, terminal: string | null = null) =>
  renderToStaticMarkup(createElement(RunnersPage, { view, supabase: null, signinError: null, terminal }));

function demo(): Extract<RunnersPageView, { kind: 'board' }> {
  const view = demoRunnersPage(NOW);
  if (view.kind !== 'board') throw new Error('the demo is a board');
  return view;
}
const withBoard = (change: (board: Board) => Board): RunnersPageView => { const view = demo(); return { ...view, board: change(view.board) }; };

/** The markup of the job row whose line is `line`, up to the next one. */
function jobRow(html: string, line: string): string {
  const start = html.indexOf(`>${line}<`);
  expect(start, line).toBeGreaterThan(-1);
  const next = html.indexOf('runners-job"', start + 1);
  return html.slice(start, next < 0 ? undefined : next);
}

describe('the board', () => {
  const html = render(demo());
  const t = text(html);

  it('names the API key that sent a job, with who made it, and a person\'s job by login (PRD 2022 s4)', () => {
    expect(text(jobRow(html, '/omni:bug-fix Issue 548 totals'))).toContain('API key QA dashboard made by @ada');
    expect(text(jobRow(html, '/omni:pr-care 1801'))).toContain('@ada');
    expect(text(jobRow(html, '/omni:pr-care 1801'))).not.toContain('made by');
  });

  it('is the marked runners screen, titled Runners, with its two tables', () => {
    expect(html).toContain('data-screen="runners"');
    expect(html).toContain('<h1 class="dash-name">Runners</h1>');
    expect(t).toContain('Runner State Fleet Slots Repositories Kit');
    expect(t).toContain('Line Repository Sent by Where Status');
  });

  it('gives each job row the anchor Send to terminal\'s View job links to, #job-<id>', () => {
    for (const job of demo().board.jobs) expect(html).toContain(`id="job-${job.id}"`);
  });

  it('shows each runner state: Busy, Online, and Offline with when it was last seen', () => {
    expect(t).toContain('acme-agents Paused: memory 91%'); // Busy, until its last report names a pressure (PRD 2102)
    expect(t).toContain('mac-mini-office Online');
    expect(t).toContain('ada-laptop Offline, 3 h ago');
    for (const state of ['paused', 'online', 'offline']) expect(html).toContain(`runners-state is-${state}`);
  });

  it('shows slots used out of slots, the repositories and the kit version', () => {
    expect(t).toContain('1 of 1');
    expect(t).toContain('0 of 2 widgets · mobile 0.0.388');
    expect(t).toContain('0.0.385');
  });

  it('shows each job status: Running with its time, Queued, Done, Runner lost, Cancelled', () => {
    expect(t).toContain('Running 12 min');
    expect(t).toContain('Queued');
    expect(t).toContain('Done');
    expect(t).toContain('Runner lost');
    expect(t).toContain('Cancelled');
  });

  it('names who sent each job and where it went', () => {
    expect(text(jobRow(html, '/omni:pr-care 1801'))).toContain('@ada Comets Queued');
    expect(text(jobRow(html, '/omni:yolo 1717'))).toContain('@you acme-agents Running 12 min');
    expect(text(jobRow(html, '/omni:bug-fix 1790'))).toContain('Any runner · mac-mini-office Done');
  });

  it('links a done job\'s pull request, and shows no log tail in the row any more', () => {
    expect(jobRow(html, '/omni:bug-fix 1790')).toContain('<a href="https://github.com/acme/widgets/pull/1838">PR #1838</a>');
    expect(html).not.toContain('<details');
    expect(html).not.toContain('wave 1 · slice s1 · tests green');
  });

  it('gives each job row a Terminal button on that job (PRD 1904)', () => {
    for (const job of demo().board.jobs) {
      expect(jobRow(html, job.line)).toContain(`data-terminal="${job.id}">Terminal</button>`);
    }
  });

  it('gives each runner row a Terminal button: its running job, else its last, else disabled "No job yet"', () => {
    const jobs = demo().board.jobs;
    const runnerRow = (page: string, name: string) => { const start = page.indexOf(`>${name}<`); return page.slice(start, page.indexOf('</div>', start)); };
    const running = jobs.find((job) => job.line === '/omni:yolo 1717');
    const last = jobs.find((job) => job.line === '/omni:yolo 1702');
    expect(runnerRow(html, 'acme-agents')).toContain(`data-terminal="${running?.id ?? ''}"`);
    expect(runnerRow(html, 'ada-laptop')).toContain(`data-terminal="${last?.id ?? ''}"`);
    const none = render(withBoard((board) => ({ ...board, jobs: [] })));
    expect(runnerRow(none, 'acme-agents')).toContain('<button type="button" class="runners-ghost" disabled="" title="No job yet">Terminal</button>');
  });

  it('opens no panel without ?terminal=', () => {
    expect(html).not.toContain('data-screen="runner-terminal"');
  });

  it('offers Cancel on queued and running jobs only, Send again on failed and cancelled ones only', () => {
    const actions = (line: string) => [...jobRow(html, line).matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map((m) => m[1]).filter((a) => a !== 'Terminal');
    expect(actions('/omni:yolo 1717')).toEqual(['Cancel']);
    expect(actions('/omni:pr-care 1801')).toEqual(['Cancel']);
    expect(actions('/omni:bug-fix 1790')).toEqual([]);
    expect(actions('/omni:yolo 1702')).toEqual(['Send again']);
    expect(actions('/omni:plan 1699')).toEqual(['Send again']);
  });

  it('has one primary action at most: the first Send again', () => {
    expect(html.match(/data-primary/g)).toHaveLength(1);
    expect(jobRow(html, '/omni:yolo 1702')).toContain('data-primary');
  });

  it('gives a workspace owner a fleet picker per runner, Shared first, the runner\'s fleet chosen', () => {
    expect(html).toContain('aria-label="Fleet of acme-agents"');
    expect(html).toMatch(/aria-label="Fleet of acme-agents"[^>]*><option value="">Shared<\/option><option value="comets" selected="">Comets<\/option><option value="nebula">Nebula<\/option><\/select>/);
    expect(html).toMatch(/aria-label="Fleet of mac-mini-office"[^>]*><option value="" selected="">Shared<\/option>/);
  });

  it('gives a member who is not an owner each fleet as text, with no picker', () => {
    const member = render(withBoard((board) => ({ ...board, viewer: { ...board.viewer, owner: false } })));
    expect(member).not.toContain('<select');
    expect(text(member)).toContain('acme-agents Paused: memory 91% Comets 1 of 1');
    expect(text(member)).toContain('mac-mini-office Online Shared 0 of 2');
  });

  it('hides Cancel once a cancel was asked for', () => {
    const asked = render(withBoard((board) => ({ ...board, jobs: board.jobs.map((job): Job => (job.line === '/omni:pr-care 1801' ? { ...job, cancelRequested: true } : job)) })));
    expect(jobRow(asked, '/omni:pr-care 1801')).not.toContain('>Cancel<');
  });

  it('says Timeout, and a failure\'s exit code, for the other failed jobs', () => {
    const failed = render(withBoard((board) => ({
      ...board,
      jobs: [
        { ...board.jobs[3] as Job, line: '/omni:wave 1', reason: 'timeout' },
        { ...board.jobs[3] as Job, id: '00000000-0000-4000-8000-00000000d299', line: '/omni:wave 2', reason: null, exitCode: 3 },
      ],
    })));
    expect(text(failed)).toContain('Timeout');
    expect(text(failed)).toContain('Failed, exit 3');
  });

  it('says so when no job was sent yet', () => {
    expect(text(render(withBoard((board) => ({ ...board, jobs: [] }))))).toContain('No job yet.');
  });
});

describe('the page opened with ?terminal=<job id>', () => {
  it('opens the panel on that job, over the board', () => {
    const job = demo().board.jobs[0] as Job;
    const html = render(demo(), job.id);
    expect(html).toContain('data-screen="runners"');
    expect(html).toContain('data-screen="runner-terminal"');
    expect(text(html)).toContain(`job ${job.id.slice(0, 8)} · widgets · acme-agents`);
  });

  it('ignores a parameter that names no job id', () => {
    expect(render(demo(), 'nope')).not.toContain('data-screen="runner-terminal"');
  });
});

describe('the empty page', () => {
  const html = render(withBoard((board) => ({ ...board, runners: [], jobs: [] })));

  it('says how to start a runner, with the command to copy', () => {
    expect(text(html)).toContain('No runner yet');
    expect(text(html)).toContain(START_COMMAND);
    expect(html).toContain('>Copy</button>');
    expect(html).not.toContain('Line Repository Sent by');
  });
});

describe('before the board', () => {
  it('says the page is not open where there is no database', () => {
    expect(text(render({ kind: 'closed' }))).toContain('The Runners page is not open here');
  });

  it('asks a member with no workspace to switch account', () => {
    expect(text(render({ kind: 'no-workspace' }))).toContain('The Runners page is for the members of a workspace');
  });

  it('says when the board could not be read', () => {
    expect(text(render({ kind: 'unreadable' }))).toContain('The runners could not be read');
  });
});
