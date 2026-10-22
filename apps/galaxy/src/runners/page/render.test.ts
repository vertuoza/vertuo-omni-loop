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
const render = (view: RunnersPageView, terminal: string | null = null, answer: string | null = null) =>
  renderToStaticMarkup(createElement(RunnersPage, { view, supabase: null, signinError: null, terminal, answer }));

function demo(): Extract<RunnersPageView, { kind: 'board' }> {
  const view = demoRunnersPage(NOW);
  if (view.kind !== 'board') throw new Error('the demo is a board');
  return view;
}
const withBoard = (change: (board: Board) => Board): RunnersPageView => { const view = demo(); return { ...view, board: change(view.board) }; };

/** The buttons of a job row, but its Terminal. */
const actionsOf = (row: string): (string | undefined)[] => [...row.matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map((m) => m[1]).filter((a) => a !== 'Terminal');

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

  it('reads ` · for <acting_for>` after made by, under the key, when the app said whom it acted for (PRD 2425)', () => {
    const row = jobRow(html, '/omni:bug-fix 314');
    expect(text(row)).toContain('API key cleaner made by @ada · for Jane D.');
    expect(row).toContain('<small class="runners-muted runners-made-by"> made by @ada · for Jane D.</small>');
    expect(text(jobRow(html, '/omni:bug-fix 322'))).toContain('API key cleaner made by @ada · for Jane D.');
  });

  it('reads a key\'s job as before when the app named no one, and a person\'s job with no for part (PRD 2425)', () => {
    expect(text(jobRow(html, '/omni:bug-fix Issue 548 totals'))).toContain('API key QA dashboard made by @ada Any runner');
    expect(text(jobRow(html, '/omni:bug-fix Issue 548 totals'))).not.toContain(' · for ');
    expect(text(jobRow(html, '/omni:pr-care 1801'))).not.toContain(' · for ');
    expect(text(jobRow(html, '/omni:yolo 1717'))).not.toContain(' · for ');
  });

  it('reads Cancelled with `by API key <name>` under it for a job a key cancelled, and a person\'s cancel as before (PRD 2425)', () => {
    const row = jobRow(html, '/omni:bug-fix 318');
    expect(text(row)).toContain('Cancelled by API key cleaner');
    expect(row).toContain('<span class="runners-by" data-content="true">by API key cleaner</span>');
    expect(row).toContain('runners-status is-off');
    expect(text(row)).toContain('API key cleaner made by @ada · for Jane D.');
    expect(actionsOf(row)).toEqual(['Send again']);
    const person = jobRow(html, '/omni:plan 1699');
    expect(text(person)).toContain('Cancelled');
    expect(person).not.toContain('runners-by');
    expect(text(person)).not.toContain('by API key');
  });

  it('shows a key\'s cancel on no job that is not cancelled', () => {
    const page = render(withBoard((board) => ({ ...board, jobs: board.jobs.map((job): Job => ({ ...job, status: 'done', cancelledByKey: 'cleaner' })) })));
    expect(page).not.toContain('runners-by');
  });

  it('reads a key\'s done bug fix as Done, whatever the bug fix ended on (PRD 2425)', () => {
    const row = jobRow(html, '/omni:bug-fix 322');
    expect(text(row)).toContain('Done');
    expect(row).toContain('runners-status is-done');
    expect(row).not.toContain('data-answer');
    expect(row).not.toContain('PRD page');
  });

  it('names the Omni app as the sender of a retro job, with retro of PRD <n> under it, linked to the retro PR (PRD 2338)', () => {
    const row = jobRow(html, '/omni:retro-apply --retro 2340');
    expect(text(row)).toContain('Omni app retro of PRD 1717');
    expect(row).toContain('<a href="https://github.com/acme/widgets/pull/2340">retro of PRD 1717</a>');
    expect(row).not.toContain('made by');
    expect(text(row)).not.toContain('A member');
  });

  it('shows PRD <n>, linking its page, and its title under the line of a job that builds a known PRD', () => {
    const row = jobRow(html, '/omni:yolo 1717');
    expect(row).toContain('<a href="/prd/at/acme/widgets/1717?to=page"');
    expect(text(row)).toContain('PRD 1717 · Sync widgets across devices');
  });

  it('shows no PRD line for a PRD the repository has no dossier of, or a line that names none', () => {
    expect(text(jobRow(html, '/omni:pr-care 1801'))).not.toContain('PRD 1801');
    expect(jobRow(html, '/omni:bug-fix Issue 548 totals')).not.toContain('/prd/at/');
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

  it('reads a done yolo job by its outcome, with a PRD page link beside its PR link (PRD 2223)', () => {
    const answers = jobRow(html, '/omni:yolo 1855');
    expect(text(answers)).toContain('Waiting on answers');
    expect(answers).toContain('runners-status is-wait');
    expect(answers).toContain('<a href="https://github.com/acme/widgets/pull/1861">PR #1861</a><a href="/prd/at/acme/widgets/1855">PRD page</a>');
    const held = jobRow(html, '/omni:yolo 1856');
    expect(text(held)).toContain('Held');
    expect(held).toContain('runners-status is-wait');
    expect(held).toContain('<a href="/prd/at/acme/widgets/1856">PRD page</a>');
    const ready = jobRow(html, '/omni:yolo-fix 1857');
    expect(text(ready)).toContain('Ready');
    expect(ready).toContain('runners-status is-done');
    expect(ready).toContain('href="/prd/at/acme/widgets/1857"');
  });

  it('keeps a done job without an outcome as Done, with no PRD page link, and a failed job too', () => {
    const plain = jobRow(html, '/omni:bug-fix 1790');
    expect(text(plain)).toContain('Done');
    expect(plain).not.toContain('PRD page');
    expect(jobRow(html, '/omni:yolo 1702')).not.toContain('PRD page');
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

  it('hides Cancel on a running job once a cancel was asked for', () => {
    const asked = render(withBoard((board) => ({ ...board, jobs: board.jobs.map((job): Job => (job.line === '/omni:pr-care 1801' ? { ...job, status: 'running', cancelRequested: true } : job)) })));
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

const idOf = (line: string): string => demo().board.jobs.find((job) => job.line === line)?.id ?? '';
const ASKING = idOf('/omni:bug-fix 314');
const ANSWERED = idOf('/omni:bug-fix 301');
const KEY_ANSWERED = idOf('/omni:bug-fix 322');
/** The demo as a page read from the database is: its questions are not on the page, the drawer reads them. */
const live = (): RunnersPageView => { const view = demo(); return { kind: 'board', name: view.name, board: view.board, fleets: view.fleets, prds: view.prds, now: view.now, answered: view.answered }; };

describe('a done job that needs a human (PRD 2255 s3)', () => {
  const html = render(demo());
  const actions = (page: string, line: string) => [...jobRow(page, line).matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map((m) => m[1]).filter((a) => a !== 'Terminal');

  it('reads Need human, filled, with a Need human button', () => {
    const row = jobRow(html, '/omni:bug-fix 314');
    expect(text(row)).toContain('Need human');
    expect(row).toContain('runners-status is-wait is-human');
    expect(row).toContain(`data-answer="${ASKING}"`);
    expect(actions(html, '/omni:bug-fix 314')).toEqual(['Need human']);
  });

  it('reads Done once its questions were answered or dismissed, with no button', () => {
    const row = jobRow(html, '/omni:bug-fix 301');
    expect(text(row)).toContain('Done');
    expect(row).not.toContain('is-human');
    expect(row).not.toContain('data-answer');
    expect(actions(html, '/omni:bug-fix 301')).toEqual([]);
  });

  it('shows no button on a job that asked and then failed or was cancelled', () => {
    const page = render(withBoard((board) => ({
      ...board,
      jobs: board.jobs.filter((job) => job.status === 'failed' || job.status === 'cancelled').map((job): Job => ({ ...job, outcome: 'human' })),
    })));
    expect(page).not.toContain('data-answer');
    expect(page).not.toContain('is-human');
    expect(text(page)).not.toContain('Need human');
  });

  it('keeps the page\'s one primary action on the first Send again: the Need human button is not primary', () => {
    expect(html.match(/data-primary/g)).toHaveLength(1);
    expect(jobRow(html, '/omni:bug-fix 314')).not.toContain('data-primary');
  });

  it('opens no drawer without ?answer=', () => {
    expect(html).not.toContain('data-screen="runner-need-human"');
  });
});

describe('the page opened with ?answer=<job id> (PRD 2255 s3)', () => {
  const html = render(demo(), null, ASKING);
  const t = text(html);
  const drawer = html.slice(html.indexOf('data-screen="runner-need-human"'));

  it('opens the drawer over the board, as a modal dialog the focus can move into', () => {
    expect(html).toContain('data-screen="runners"');
    expect(html).toContain('data-screen="runner-need-human"');
    expect(drawer).toMatch(/role="dialog"/);
    expect(drawer).toMatch(/aria-modal="true"/);
    expect(drawer).toMatch(/tabindex="-1"/);
    expect(html).toContain('need-scrim');
  });

  it('heads it Need human, the repository and the issue, which links GitHub, with a Close button', () => {
    expect(t).toContain('Need human · widgets · #314');
    expect(drawer).toContain('<a href="https://github.com/acme/widgets/issues/314"');
    expect(drawer).toContain('aria-label="Close"');
  });

  it('holds the lead and each question with its options, one pick or several', () => {
    expect(t).toContain('The planning query fails for 31 tenants');
    expect(t).toContain('How should the planning show an assignment whose project the user may not open?');
    expect(t).toContain('Make the project nullable');
    expect(t).toContain('Recommended');
    expect(t).toContain('Filter those assignments out');
    expect(t).toContain('Which tenants first?');
    expect(t).toContain('Pick one');
    expect(t).toContain('Pick any that apply');
    expect(drawer).toContain('type="radio"');
    expect(drawer).toContain('type="checkbox"');
  });

  it('gives each question a free answer of at most 2,000 characters', () => {
    expect(drawer.match(/<textarea/g)).toHaveLength(2);
    expect(drawer.match(/maxlength="2000"/gi)).toHaveLength(2);
  });

  it('ends with Dismiss and Send answers, which stays off until every question has an answer', () => {
    expect(drawer).toMatch(/<button[^>]*>Dismiss<\/button>/);
    const send = /<button[^>]*>Send answers<\/button>/.exec(drawer)?.[0] ?? '';
    expect(send).toContain('disabled=""');
    expect(send).toContain('data-primary');
  });

  it('keeps the Terminal panel shut, so two panels never stack', () => {
    expect(render(demo(), ASKING, ASKING)).not.toContain('data-screen="runner-terminal"');
  });

  it('reads who answered a closed row, with neither button', () => {
    const closed = render(demo(), null, ANSWERED);
    expect(text(closed)).toContain('Need human · widgets · #301');
    expect(text(closed)).toContain('Already answered by @ada');
    expect(closed).not.toContain('need-foot');
    expect(text(closed)).not.toContain('Send answers');
    expect(closed).not.toContain('>Dismiss<');
  });

  it('reads who dismissed it when it was dismissed', () => {
    const view = demo();
    const dismissed = render({ ...view, demoQuestions: (view.demoQuestions ?? []).map((row) => (row.job === ANSWERED ? { ...row, state: 'dismissed' as const, answers: null, byLogin: 'olga' } : row)) }, null, ANSWERED);
    expect(text(dismissed)).toContain('Dismissed by @olga');
    expect(dismissed).not.toContain('need-foot');
  });

  it('reads `Already answered by API key <name>`, then ` · for <acting_for>`, for a round a key answered, with neither button (PRD 2425)', () => {
    const closed = render(demo(), null, KEY_ANSWERED);
    expect(text(closed)).toContain('Need human · widgets · #322');
    expect(text(closed)).toContain('Already answered by API key cleaner · for Jane D.');
    expect(closed).not.toContain('Already answered by @');
    expect(closed).not.toContain('need-foot');
    expect(text(closed)).not.toContain('Send answers');
    expect(closed).not.toContain('>Dismiss<');
  });

  it('reads `Dismissed by API key <name>`, then ` · for <acting_for>`, for a round a key dismissed (PRD 2425)', () => {
    const view = demo();
    const dismissed = render({ ...view, demoQuestions: (view.demoQuestions ?? []).map((row) => (row.job === KEY_ANSWERED ? { ...row, state: 'dismissed' as const, answers: null } : row)) }, null, KEY_ANSWERED);
    expect(text(dismissed)).toContain('Dismissed by API key cleaner · for Jane D.');
    expect(dismissed).not.toContain('need-foot');
  });

  it('reads the key alone when the app named no one, and a person\'s close as before (PRD 2425)', () => {
    const view = demo();
    const unnamed = render({ ...view, demoQuestions: (view.demoQuestions ?? []).map((row) => (row.job === KEY_ANSWERED ? { ...row, actingFor: null } : row)) }, null, KEY_ANSWERED);
    const inDrawer = (page: string) => text(page.slice(page.indexOf('data-screen="runner-need-human"')));
    expect(inDrawer(unnamed)).toContain('Already answered by API key cleaner');
    expect(inDrawer(unnamed)).not.toContain(' · for ');
    expect(inDrawer(render(demo(), null, ANSWERED))).toContain('Already answered by @ada');
    expect(inDrawer(render(demo(), null, ANSWERED))).not.toContain('API key');
  });

  it('says the questions are being read, and offers no button yet, on a page read from the database', () => {
    const page = render(live(), null, ASKING);
    expect(text(page)).toContain('Reading the questions…');
    expect(page).not.toContain('need-foot');
  });

  it('ignores a parameter that names no job id, or a job the board does not list', () => {
    expect(render(demo(), null, 'nope')).not.toContain('data-screen="runner-need-human"');
    expect(render(demo(), null, '00000000-0000-4000-8000-0000000000ff')).not.toContain('data-screen="runner-need-human"');
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

describe('a job that waited, once its answers are in (PRD 2270 s2)', () => {
  const find = (view: Extract<RunnersPageView, { kind: 'board' }>, line: string): Job => {
    const found = view.board.jobs.find((job) => job.line === line);
    if (!found) throw new Error(line);
    return found;
  };
  const waited = find(demo(), '/omni:yolo 1855');
  const fixed = (status: Job['status']): Job => ({ ...waited, id: '99999999-eeee-4000-8000-000000000009', line: '/omni:yolo-fix 1855', status, outcome: null, continues: waited.id, prUrl: null });
  const withFix = (status: Job['status']) => render(withBoard((board) => ({ ...board, jobs: [...board.jobs, fixed(status)] })));

  it('reads Answered · fixing while its continuation runs, linking it, and the fix job reads after answers · job <id>, linking back', () => {
    const html = withFix('running');
    const row = jobRow(html, '/omni:yolo 1855');
    expect(text(row)).toContain('Answered · fixing');
    expect(row).toContain(`<a href="#job-${fixed('running').id}">Answered · fixing</a>`);
    expect(row).toContain('runners-status is-run');
    expect(row).not.toContain('Fix with answers');
    const fix = jobRow(html, '/omni:yolo-fix 1855');
    expect(text(fix)).toContain(`after answers · job ${waited.id.slice(0, 8)}`);
    expect(fix).toContain(`<a href="#job-${waited.id}" data-content="true">after answers · job ${waited.id.slice(0, 8)}</a>`);
  });

  it('reads Answered · fixed once the continuation ended', () => {
    const row = jobRow(withFix('done'), '/omni:yolo 1855');
    expect(text(row)).toContain('Answered · fixed');
    expect(row).toContain('runners-status is-done');
  });

  it('reads Answered with Fix with answers, the row\'s primary action, when every asked item is answered and nothing continued it', () => {
    const alone = withBoard((board) => ({ ...board, jobs: [waited] }));
    const row = jobRow(render({ ...(alone as Extract<RunnersPageView, { kind: 'board' }>), answered: [waited.id] }), '/omni:yolo 1855');
    expect(text(row)).toContain('Answered');
    expect(text(row)).not.toContain('Waiting on answers');
    expect(row).toContain('runners-status is-wait');
    expect(row).toContain('data-primary');
    expect(text(row)).toContain('Fix with answers');
    expect(text(row)).toContain('PRD page');
  });

  it('keeps Waiting on answers, with no button, while answers are missing', () => {
    const row = jobRow(render(demo()), '/omni:yolo 1855');
    expect(text(row)).toContain('Waiting on answers');
    expect(text(row)).not.toContain('Fix with answers');
  });
});

describe('a job stopped mid-way (PRD 2375 s3)', () => {
  const stopped = (change: Partial<Job> = {}) => withBoard((board) => ({
    ...board,
    jobs: [...board.jobs, { ...board.jobs[0] as Job, id: '77777777-aaaa-4000-8000-000000000077', line: '/omni:yolo 2338', status: 'done', outcome: 'stopped', slicesMerged: 0, slicesTotal: 5, released: [1908], exitCode: 0, endedAt: NOW.toISOString(), ...change }],
  }));
  const actions = (html: string, line: string) => [...jobRow(html, line).matchAll(/<button[^>]*>([^<]+)<\/button>/g)].map((m) => m[1]).filter((a) => a !== 'Terminal');

  it('reads Stopped mid-way in red, with its slice count and released claims, and one Resume', () => {
    const html = render(stopped());
    const row = jobRow(html, '/omni:yolo 2338');
    expect(row).toContain('runners-status is-fail');
    expect(text(row)).toContain('Stopped mid-way');
    expect(text(row)).not.toContain('Done');
    expect(text(row)).toContain('0 / 5 slices merged');
    expect(text(row)).toContain('Released #1908');
    expect(actions(html, '/omni:yolo 2338')).toEqual(['Resume']);
  });

  it('leaves the count out when the runner could not read the board', () => {
    const row = jobRow(render(stopped({ slicesMerged: null, slicesTotal: null })), '/omni:yolo 2338');
    expect(text(row)).toContain('Stopped mid-way');
    expect(text(row)).not.toContain('slices merged');
  });

  it('makes Resume the page\'s one primary, ahead of the first Send again', () => {
    const html = render(stopped());
    expect(html.match(/data-primary/g)).toHaveLength(1);
    expect(jobRow(html, '/omni:yolo 2338')).toContain('data-primary');
    expect(jobRow(html, '/omni:yolo 1702')).not.toContain('data-primary');
  });

  it('leaves a done job with a hand-off outcome with no Resume, and the other jobs as before', () => {
    const html = render(demo());
    expect(html).not.toContain('Resume');
    expect(actions(html, '/omni:yolo 1702')).toEqual(['Send again']);
  });
});
