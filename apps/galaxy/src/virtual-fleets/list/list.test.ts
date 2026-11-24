import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AiFleetListScreen } from './AiFleetList';
import { missionCellOf, waitsOf, type ListFleetRead } from './list';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => undefined, refresh: () => undefined }) }));
const { demoAiFleets } = await import('./list.demo');

// The AI Fleet list (PRD 3233 s3, AC-2): one row per AI fleet, from one read of the Runners board, and the empty page.

const NOW = new Date('2026-11-24T10:00:00Z');
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const mission = (over: Partial<ListFleetRead['missions'][number]> = {}): ListFleetRead['missions'][number] => ({ id: 'm1', title: 'Checkout rework', status: 'running', progress: '3 of 6 merged · 2 ready', waits: [], ...over });

describe('the mission line', () => {
  it('names the running mission and its progress', () => {
    expect(missionCellOf([mission()])).toEqual({ kind: 'mission', title: 'Checkout rework', line: '3 of 6 merged · 2 ready' });
  });

  it('says a goal-only mission writes its PRDs', () => {
    expect(missionCellOf([mission({ progress: 'Writing the roadmap' })])).toEqual({ kind: 'goal-only', title: 'Checkout rework', line: 'Goal only: PM writing PRDs' });
  });

  it('says no mission yet when none moves', () => {
    expect(missionCellOf([])).toEqual({ kind: 'none', title: null, line: 'No mission yet.' });
    expect(missionCellOf([mission({ status: 'delivered' }), mission({ status: 'draft' })]).kind).toBe('none');
  });
});

describe('what waits on you', () => {
  it('counts answers and approvals, or says Nothing', () => {
    expect(waitsOf(1, 0)).toBe('1 answer');
    expect(waitsOf(0, 1)).toBe('1 approval');
    expect(waitsOf(2, 3)).toBe('2 answers · 3 approvals');
    expect(waitsOf(0, 0)).toBe('Nothing');
  });
});

describe('the list on the demo world', () => {
  const list = demoAiFleets(NOW).list;

  it('AC-2: shows Orion\'s runner orbit-1 "Busy, 3 of 3" and shared-mac-3 marked Shared', () => {
    const orion = list.fleets.find((row) => row.name === 'orion');
    expect(orion?.runsOn.map((r) => [r.name, r.words, r.shared])).toEqual([['orbit-1', 'Busy, 3 of 3', false], ['shared-mac-3', 'Busy, 1 of 2', true]]);
    const html = renderToStaticMarkup(createElement(AiFleetListScreen, { view: list, make: null }));
    expect(text(html)).toContain('orbit-1 Busy, 3 of 3');
    expect(text(html)).toContain('shared-mac-3 Busy, 1 of 2 Shared · 1 for Orion');
  });

  it('warns on a fleet with no runner of its own, and on one whose only runner is offline', () => {
    expect(list.fleets.map((row) => [row.name, row.warning])).toEqual([['orion', null], ['nova', 'No runner of its own'], ['atlas', 'Its only runner is offline']]);
  });

  it('draws one row per fleet with its heroes, its mission line and an Open link, and the players\' fleets link', () => {
    const html = renderToStaticMarkup(createElement(AiFleetListScreen, { view: list, make: null }));
    const t = text(html);
    expect(t).toContain('AI Fleet 0 of 3 fleets wait on you');
    expect(t).toContain('PM · Engineer · QA · Reviewer');
    expect(t).toContain('3 of 6 merged · 2 ready');
    expect(t).toContain('Goal only: PM writing PRDs');
    expect(t).toContain('No mission yet.');
    expect(html).toContain('href="/app/ai-fleet?fleet=orion"');
    expect(html).toContain('<a href="/app/fleet">Fleet</a>');
  });
});

describe('the empty page', () => {
  it('says there is no AI fleet and offers New AI fleet as its main action', () => {
    const html = renderToStaticMarkup(createElement(AiFleetListScreen, { view: { fleets: [], line: '0 of 0 fleets wait on you' }, make: { workspace: null, mascots: ['robot'] } }));
    expect(text(html)).toContain('No AI fleet yet.');
    expect(html).toContain('<button type="button" class="ask-button vf-open" data-primary="">+ New AI fleet</button>');
    expect(text(html)).not.toContain('wait on you');
  });
});
