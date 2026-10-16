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
      runners: board.runners.filter((r) => r.state !== 'offline').map((r) => (r.state === 'online' ? { ...r, health: r.health && { ...r.health, paused: 'disk 6 GB free' } } : r)),
    })));
    expect(text(html)).toContain('Waiting: every runner paused');
  });

  it('shows nothing when a free runner could take the job', () => {
    const html = render(withBoard((board) => ({ ...board, jobs: board.jobs.map((job) => (job.status === 'queued' ? { ...job, toFleet: null } : job)) })));
    expect(html).not.toContain('Waiting:');
  });
});
