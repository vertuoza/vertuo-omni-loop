import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Board } from '../runners.contract';
import { demoRunnersPage } from './demo';
import type { RunnersPageView } from './model';
import { RunnersPage } from './RunnersPage';

// The health line as the server renders it (PRD 2102 s3), on the demo's board: the gauges, the warn colour, Paused, a field
// that was not read, an offline runner greyed, an old runner, a runner with no sample in the hour, and a queued job's reason.

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const NOW = new Date('2026-10-13T14:00:00Z');
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const render = (view: RunnersPageView) => renderToStaticMarkup(createElement(RunnersPage, { view, supabase: null, signinError: null }));

function demo(): Extract<RunnersPageView, { kind: 'board' }> {
  const view = demoRunnersPage(NOW);
  if (view.kind !== 'board') throw new Error('the demo is a board');
  return view;
}
const withBoard = (change: (board: Board) => Board): RunnersPageView => { const view = demo(); return { ...view, board: change(view.board) }; };
/** The markup of the runner row named `name`, up to the next runner. */
function runnerRow(html: string, name: string): string {
  const start = html.indexOf(`>${name}<`);
  expect(start, name).toBeGreaterThan(-1);
  const next = html.indexOf('runners-name', start + 1);
  return html.slice(start, next < 0 ? undefined : next);
}

describe('the health line', () => {
  const html = render(demo());

  it('draws four gauges under a live runner, each with its hour\'s sparkline', () => {
    const row = runnerRow(html, 'mac-mini-office');
    for (const key of ['cpu', 'memory', 'disk', 'tokens']) expect(row).toContain(`data-gauge="${key}"`);
    expect(text(row)).toContain('CPU 18% · load 2.3 / 8');
    expect(text(row)).toContain('Memory 7.1 of 16.0 GB');
    expect((row.match(/<polyline/g) ?? []).length).toBe(3);
  });

  it('reads a figure it could not read as — with no bar', () => {
    const row = runnerRow(html, 'mac-mini-office');
    expect(text(row)).toContain('Disk —');
    expect(row.split('data-gauge="disk"')[1]?.split('data-gauge="tokens"')[0]).not.toContain('runners-gauge-fill');
    expect(text(row)).toContain('Tokens —');
  });

  it('colours a gauge past the runner\'s limit, and only that one', () => {
    const row = runnerRow(html, 'acme-agents');
    expect(row).toContain('runners-gauge is-over" data-gauge="memory"');
    expect((row.match(/is-over/g) ?? []).length).toBe(1);
  });

  it('reads Paused: <reason> as the state, in place of Busy', () => {
    const row = runnerRow(html, 'acme-agents');
    expect(row).toContain('runners-state is-paused');
    expect(text(row)).toContain('Paused: memory 91%');
    expect(text(row)).not.toContain('Busy');
  });

  it('greys an offline runner\'s last figures under as of <age>', () => {
    const row = runnerRow(html, 'ada-laptop');
    expect(row).toContain('runners-health is-grey');
    expect(text(row)).toContain('Offline, 3 h ago');
    expect(text(row)).toContain('as of 3 h ago');
  });

  it('draws no sparkline for a runner with no sample in the hour', () => {
    expect(runnerRow(html, 'ada-laptop')).not.toContain('<polyline');
    expect(text(runnerRow(html, 'ada-laptop'))).toContain('Memory 6.0 of 16.0 GB');
  });

  it('shows an old runner the update line, with omni update to copy', () => {
    const old = render(withBoard((board) => ({ ...board, runners: board.runners.map((r) => ({ ...r, health: null })) })));
    expect(text(old)).toContain('Update this runner to see its health.');
    expect(old).toContain('omni update');
    expect(old).not.toContain('data-gauge');
    expect(html).not.toContain('Update this runner');
  });
});

describe('why a queued job waits', () => {
  it('names the one paused runner of the job\'s fleet', () => {
    expect(text(render(demo()))).toContain('Queued Waiting: acme-agents paused (memory 91%)');
  });

  it('says every runner paused when the job can go to several', () => {
    const html = render(withBoard((board) => ({
      ...board,
      jobs: board.jobs.map((job) => (job.status === 'queued' ? { ...job, toFleet: null } : job)),
      // Both runners are without a fleet: a runner with one is not a runner a job sent to any runner can take (PRD 2482).
      runners: board.runners.filter((r) => r.state !== 'offline').map((r) => ({ ...r, fleet: null })).map((r) => (r.state === 'online' ? { ...r, health: r.health && { ...r.health, paused: 'disk 6 GB free' } } : r)),
    })));
    expect(text(html)).toContain('Waiting: every runner paused');
  });

  it('shows nothing when a free runner could take the job', () => {
    const html = render(withBoard((board) => ({ ...board, jobs: board.jobs.map((job) => (job.status === 'queued' ? { ...job, toFleet: null } : job)) })));
    expect(html).not.toContain('Waiting:');
  });
});

describe('the tokens', () => {
  const html = render(demo());

  it('fills the Tokens gauge with the machine\'s last 5 h and today, the split in its title, and its sparkline', () => {
    const row = runnerRow(html, 'acme-agents');
    expect(text(row)).toContain('Tokens 10.2M in 5 h · 15.7M today');
    expect(row).toContain('title="Last 5 h: input 81k · output 402k · cache read 9.1M · cache write 611k\nToday: ');
    expect((row.match(/<polyline/g) ?? []).length).toBe(4);
    expect(row.split('data-gauge="tokens"')[1]).not.toContain('runners-gauge-fill');
    expect(row).not.toContain('runners-gauge is-over" data-gauge="tokens"');
  });

  it('keeps — for a runner whose tokens were not sent', () => {
    expect(text(runnerRow(html, 'mac-mini-office'))).toContain('Tokens —');
  });

  it('shows a job\'s tokens beside its status once a report carried them, the split in the title', () => {
    expect(text(html)).toContain('Running 12 min 1.5M tokens');
    expect(html).toContain('<span class="runners-tokens" title="input 31k · output 190k · cache read 1.2M · cache write 84k">1.5M tokens</span>');
  });

  it('shows no tokens on a job whose runner reported none', () => {
    expect((html.match(/runners-tokens/g) ?? []).length).toBe(1);
  });
});

describe('the account chips and the tokens pause (PRD 2537 s6)', () => {
  it('shows a runner\'s accounts as chips in order, each titled with its agent and state', () => {
    const row = runnerRow(render(demo()), 'acme-agents');
    expect(row.indexOf('>claude-1<')).toBeGreaterThan(-1);
    expect(row.indexOf('>claude-1<')).toBeLessThan(row.indexOf('>codex-1<'));
    expect(row.indexOf('>codex-1<')).toBeLessThan(row.indexOf('>claude-2<'));
    expect(row).toContain('runners-chip is-out');
    expect(row).toContain('runners-chip is-active');
    expect(row).toContain('runners-chip is-ready');
    expect(row).toContain('title="claude · out until 18:00 UTC"');
  });

  it('shows no chips for a runner that reported no accounts', () => {
    expect(runnerRow(render(demo()), 'mac-mini-office')).not.toContain('runners-chip');
  });

  it('reads Paused: no tokens left until 18:00 in place of Online, and Waiting: every runner out of tokens on a queued job', () => {
    const paused = { paused: 'no tokens left until 18:00', accounts: [{ id: 'claude-1', agent: 'claude', state: 'out' as const, resetsAt: '2026-10-13T18:00:00Z' }] };
    const html = render(withBoard((board) => ({
      ...board,
      jobs: board.jobs.map((job) => (job.status === 'queued' ? { ...job, toFleet: null } : job)),
      runners: board.runners.filter((r) => r.state !== 'offline').map((r) => ({ ...r, fleet: null, health: r.health && { ...r.health, ...paused } })),
    })));
    expect(text(runnerRow(html, 'mac-mini-office'))).toContain('Paused: no tokens left until 18:00');
    expect(text(html)).toContain('Waiting: every runner out of tokens until 18:00');
  });
});
