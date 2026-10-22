import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { parsePr } from 'omni-loop/kit/lib/ids.ts';
import type { MilestoneId, MilestoneRow } from './store';
import { PrdTimelinePane } from './TimelineView';
import { demoDossier, DEMO_VIEWER } from '../dossier/page/demo';
import { dossierView } from '../dossier/page/view';
import { headerLine, timelineView } from './view';

// A PRD's time line and Timeline tab (PRD 2370, s5), rendered from fixtures and a fixed `now`.

const DAY = 24 * 60 * 60 * 1000;
const T0 = Date.parse('2026-10-01T00:00:00Z');
const at = (days: number) => new Date(T0 + days * DAY).toISOString();
const row = (lane: string, milestone: MilestoneId, days: number, pr: number | null = null): MilestoneRow =>
  ({ lane, milestone, reached_at: at(days), pr: pr === null ? null : parsePr(pr) });
const REPO = 'acme/app';
const merged = (): MilestoneRow[] => [
  row(REPO, 'idea', 0), row(REPO, 'plan', 1), row(REPO, 'approved', 3),
  row(REPO, 'opened', 2, 10), row(REPO, 'first-slice', 4, 11), row(REPO, 'last-slice', 6, 12),
  row(REPO, 'ready', 7, 10), row(REPO, 'merged', 12, 10),
];
const NOW = T0 + 20 * DAY;

describe('the line under the stage words', () => {
  it('reads total and longest gap for a merged PRD', () => {
    expect(headerLine(merged(), NOW)).toBe('Idea → merged: 12.0 d · Longest: Review, 5.0 d');
  });

  it('reads the running total and the step it is in now for a PRD being built', () => {
    const building = merged().filter((m) => m.milestone !== 'ready' && m.milestone !== 'merged');
    expect(headerLine(building, T0 + 8 * DAY)).toBe('Running for 8.0 d · Now: Finishing, 2.0 d');
  });

  it('shows no line with no milestone, nor when they were not read', () => {
    expect(headerLine([], NOW)).toBeNull();
    expect(headerLine(null, NOW)).toBeNull();
    expect(headerLine(undefined, NOW)).toBeNull();
  });
});

describe('the Timeline tab', () => {
  it('lists the PRD then its lane, each gap with its duration and who it waits on, the longest marked', () => {
    const view = timelineView(merged(), NOW);
    if (view.state !== 'sections') throw new Error('expected sections');
    expect(view.sections.map((s) => s.title)).toEqual(['The PRD', REPO]);
    const html = renderToStaticMarkup(<PrdTimelinePane timeline={view} />);
    expect(html).toContain('href="https://github.com/acme/app/pull/11"');
    expect(html).toContain('Review · 5.0 d · waits on reviewer');
    expect(html).toContain('Approval · 2.0 d · waits on approver');
    expect(html.match(/prd-gap-mark/g)).toHaveLength(1);
    expect(html).toMatch(/prd-gap-longest[^>]*>(?:(?!<\/li>).)*Review/);
  });

  it('draws one lane per repository', () => {
    const more = [...merged(), row('acme/web', 'opened', 5, 3), row('acme/web', 'first-slice', 6, 4)];
    const view = timelineView(more, NOW);
    if (view.state !== 'sections') throw new Error('expected sections');
    expect(view.sections.map((s) => s.title)).toEqual(['The PRD', 'acme/app', 'acme/web']);
  });

  it('writes not yet and not recorded as the fix pages do, and running with its duration', () => {
    const view = timelineView([row(REPO, 'idea', 0), row(REPO, 'approved', 3), row(REPO, 'opened', 3, 10)], NOW);
    const html = renderToStaticMarkup(<PrdTimelinePane timeline={view} />);
    expect(html).toContain('not recorded');
    expect(html).toContain('not yet');
    expect(html).toContain('running 17.0 d');
  });

  it('says so with no milestone, and when they could not be read', () => {
    expect(renderToStaticMarkup(<PrdTimelinePane timeline={timelineView([], NOW)} />)).toContain('No milestone is recorded');
    expect(renderToStaticMarkup(<PrdTimelinePane timeline={timelineView(null, NOW)} />)).toContain('could not be read');
  });
});

describe('the page', () => {
  const now = Date.parse('2026-10-20T12:00:00Z');
  const demo = demoDossier(now);

  it('shows the demo dossier a time line and a Timeline tab', () => {
    const view = dossierView(demo, DEMO_VIEWER, { tab: 'timeline', version: null }, now);
    expect(view.timelineLine).toMatch(/^Running for 3\.0 d · Now: Building, /);
    expect(view.tabs.map((t) => t.kind)).toContain('timeline');
    expect(view.timeline?.state).toBe('sections');
  });

  it('dims the tab and shows no line with no milestone, and shows none when not asked for', () => {
    const none = dossierView({ ...demo, milestones: [] }, DEMO_VIEWER, { tab: null, version: null }, now);
    expect(none.timelineLine).toBeNull();
    expect(none.tabs.find((t) => t.kind === 'timeline')?.empty).toBe(true);
    const left = dossierView({ ...demo, milestones: undefined }, DEMO_VIEWER, { tab: null, version: null }, now);
    expect(left.timeline).toBeNull();
    expect(left.tabs.find((t) => t.kind === 'timeline')?.empty).toBe(false);
  });
});
