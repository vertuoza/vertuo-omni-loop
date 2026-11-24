import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Board, Job } from '../../runners/runners.contract';
import { DEMO_FLEETS, DEMO_MISSIONS, DEMO_PRDS, demoFleetBoard } from './runners-view.demo';
import { fleetRunnersView } from './runners-view';
import { fleetHeadOf, runnersTabOf } from './runners-tab';
import { FleetHeadLines } from './RunsOn';
import { RunnersTabScreen } from './RunnersTab';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));

// The Runners tab and the Runs on line on the demo world (PRD 3233 s4, screens 4.A to 4.E).

const NOW = new Date('2027-02-01T12:00:00.000Z');
const board = demoFleetBoard(NOW);
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const jobAt = (i: number): Job => {
  const found = board.jobs[i];
  if (found === undefined) throw new Error('no such demo job');
  return found;
};
const viewOf = (name: keyof typeof DEMO_MISSIONS, b: Board = board) =>
  fleetRunnersView(b, DEMO_FLEETS.find((f) => f.name === name) ?? { name, label: name }, [DEMO_MISSIONS[name]], NOW, DEMO_PRDS, DEMO_FLEETS);
const tabHtml = (name: keyof typeof DEMO_MISSIONS, b: Board = board) =>
  renderToStaticMarkup(createElement(RunnersTabScreen, {
    tab: runnersTabOf(viewOf(name, b), b), terminal: b.jobs.map((j) => ({ id: j.id, repo: j.repo, runner: j.runner, status: j.status })), need: [], openTerminal: null, openAnswer: null, demo: [],
  }));

describe('the Runners tab as the server renders it', () => {
  it('AC-3: Orion\'s own runner, its Engineer job, PRD and time, with Terminal', () => {
    const t = text(tabHtml('orion'));
    expect(t).toContain('Its own runners orbit-1');
    expect(t).toContain('Engineer PRD 412 · Checkout totals Running 18 min');
    expect(t).toContain('Terminal');
  });

  it('AC-4: the Shared runner says 1 for Orion and names the repository', () => {
    const t = text(tabHtml('orion'));
    expect(t).toContain('Shared runners running its work');
    expect(t).toContain('1 for Orion');
    expect(t).toContain('No runner of Orion holds acme/mobile');
  });

  it('AC-5: no runner of its own, box-west under Shared runners', () => {
    const t = text(tabHtml('nova'));
    expect(t).toContain('No runner of its own.');
    expect(t).toContain('Shared runners running its work box-west');
  });

  it('AC-6: Atlas reads Offline, 2 h ago and 2 jobs wait for atlas-1.', () => {
    const t = text(tabHtml('atlas'));
    expect(t).toContain('Offline, 2 h ago');
    expect(t).toContain('2 jobs wait for atlas-1.');
    expect(t).toContain('Waiting for a slot');
    expect(t).toContain('Give it a runner: Runners');
  });

  it('with no runner at all it says how to start one', () => {
    const t = text(tabHtml('orion', { ...board, runners: [], jobs: [] }));
    expect(t).toContain('No runner in this workspace.');
    expect(t).toContain('Start one:');
    expect(t).toContain('omni runner --name <name> --repos <dir>');
  });

  it('a job waiting on the viewer carries Answer, which opens the Need human drawer', () => {
    const asking = { ...jobAt(0), id: 'a1', status: 'done' as const, outcome: 'human' as const, endedAt: NOW.toISOString() };
    const b: Board = { ...board, jobs: [...board.jobs, asking] };
    expect(tabHtml('orion', b)).toContain('data-answer="a1"');
  });
});

describe('the Runs on line', () => {
  it('shows under the fleet\'s name, each runner linking to the Runners tab', () => {
    const html = renderToStaticMarkup(createElement(FleetHeadLines, { head: fleetHeadOf(viewOf('orion'), []), href: '/app/ai-fleet?fleet=orion&tab=runners' }));
    expect(text(html)).toBe('Runs on orbit-1 Busy, 3 of 3 shared-mac-3 Shared, 1 job');
    expect(html.match(/href="\/app\/ai-fleet\?fleet=orion&amp;tab=runners"/g)).toHaveLength(2);
  });
});
