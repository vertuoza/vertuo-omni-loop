import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { renderMarkdown } from '../markdown';
import type { DossierRow, DossierVersionRow } from '../store';
import { DossierPage } from './DossierPage';
import { fixPageView, type FixPageView } from '../../fixes/timeline';
import { dossierView, readPick } from './view';

vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: () => {} }),
}));

// A fix's page as the server renders it (PRD 627): `#n ↗` with its Visual or Bug badge, no stage, its
// kind's tabs, a round of variations framed on its sandboxed route with a Round picker, and a bug record
// rendered from markdown.

const ID = '00000000-0000-4000-8000-0000000000f1';
const PIERRE = { user_id: 'u-pierre', email: 'pierre@vertuoza.com', name: 'Pierre' };
const SUPABASE = { url: 'http://127.0.0.1:54321', key: 'anon' };

const dossier = (kind: 'visual' | 'bug', prd: number): DossierRow => ({
  id: ID, workspace_id: 'w1', home_repo: 'vertuoza/vertuo-omni-loop', prd, kind, title: 'Darker sidebar',
  opened_by: PIERRE.user_id, created_at: '2026-09-29T09:00:00Z', numbered_at: '2026-09-29T09:00:00Z',
});
const version = (id: string, kind: DossierVersionRow['kind'], at: string): DossierVersionRow => ({
  id, dossier_id: ID, kind, bytes: 10, source: 'kit', uploaded_by: PIERRE.user_id, commit_sha: null, created_at: at,
});

const render = (kind: 'visual' | 'bug', versions: DossierVersionRow[], query: Record<string, string> = {}, markdown: string | null = null) => {
  const view = dossierView({ dossier: dossier(kind, kind === 'visual' ? 548 : 571), versions, members: [PIERRE], rounds: [] }, PIERRE.user_id, readPick(query));
  return renderToStaticMarkup(createElement(DossierPage, { view, markdown: markdown === null ? null : renderMarkdown(markdown), supabase: SUPABASE }));
};

const VISUAL = [version('r1', 'variations', '2026-09-29T09:10:00Z'), version('r2', 'variations', '2026-09-29T09:20:00Z'), version('b1', 'before-after', '2026-09-29T09:30:00Z')];

describe('a visual fix\'s page', () => {
  it('is headed #n ↗ to its issue with a Visual badge, and shows no stage', () => {
    const html = render('visual', VISUAL);
    expect(html).toContain('<span class="dossier-kind">Visual</span> <a class="dossier-number" href="https://github.com/vertuoza/vertuo-omni-loop/issues/548" target="_blank" rel="noopener noreferrer">#548 ↗</a>');
    expect(html).not.toContain('stage-track');
    expect(html).not.toContain('Delete draft');
  });

  it('lists Timeline, Before/after, Variations and Questions, and nothing of a PRD', () => {
    const html = render('visual', VISUAL);
    const labels = [...html.matchAll(/class="dossier-tab[^"]*" href="[^"]*"[^>]*>([^<]+)/g)].map((m) => m[1]);
    expect(labels).toEqual(['Timeline', 'Before/after', 'Variations', 'Questions']);
  });

  it('frames the round picked on its sandboxed route, with a Round picker kept on its route', () => {
    const html = render('visual', VISUAL, { tab: 'variations', v: '1' });
    expect(html).toContain(`<form class="dossier-picker" action="/visual/${ID}" method="get"><input type="hidden" name="tab" value="variations"/>`);
    expect(html).toContain('<span class="ask-hint">Round</span>');
    expect(html).toContain(`<iframe src="/visual/${ID}/r/1/page" sandbox="allow-scripts" title="Variations, Round 1">`);
  });

  it('says a round of variations has not been sent yet', () => {
    expect(render('visual', [], { tab: 'variations' })).toContain('No round of variations yet.');
  });
});

describe('a bug fix\'s page', () => {
  it('is headed #n ↗ with a Bug badge, and renders its record from markdown', () => {
    const html = render('bug', [version('g1', 'bug-record', '2026-09-29T10:00:00Z')], { tab: 'bug-record' }, '# The bug\n\nIt <b>broke</b>.\n');
    expect(html).toContain('<span class="dossier-kind">Bug</span> <a class="dossier-number"');
    expect(html).toContain('<h1>The bug</h1>');
    expect(html).toContain('<span class="ask-hint">Version</span>');
  });

  it('says the bug record has not been sent yet', () => {
    expect(render('bug', [], { tab: 'bug-record' })).toContain('The bug record has no version yet.');
  });
});

describe('a fix\'s Timeline and state (PRD 627, s5)', () => {
  const ISSUE = {
    number: 548, url: 'https://github.com/vertuoza/vertuo-omni-loop/issues/548', state: 'closed' as const, author: 'anna',
    createdAt: '2026-09-29T08:00:00Z', risk: null, regression: false,
  };
  const PULL = { number: 562, url: 'https://github.com/vertuoza/vertuo-omni-loop/pull/562', state: 'merged' as const, mergedAt: '2026-09-29T12:00:00Z', mergedBy: 'pierre-derval' };
  const withFix = (kind: 'visual' | 'bug', fix: FixPageView | undefined, query: Record<string, string> = {}) => {
    const view = dossierView({ dossier: dossier(kind, 548), versions: VISUAL, members: [PIERRE], rounds: [], fix }, PIERRE.user_id, readPick(query));
    return renderToStaticMarkup(createElement(DossierPage, { view, markdown: null, supabase: SUPABASE }));
  };
  const summary = { issue: ISSUE, pull: PULL, approvals: [{ login: 'carla', at: '2026-09-29T11:00:00Z' }], release: null };

  it('opens on the Timeline: each moment with who and when, linked, then not yet', () => {
    const html = withFix('visual', fixPageView('visual', summary, { letter: 'C', login: 'pierre-derval', date: '2026-09-29' }));
    const moments = [...html.matchAll(/<li class="fix-moment fix-moment-([a-z-]+)">(.*?)<\/li>/g)].map((m) => [m[1], m[2]?.replace(/<[^>]+>/g, '')]);
    expect(moments).toEqual([
      ['done', 'Asked by @anna · 29 Sep 2026, 08:00 UTC'],
      ['done', 'Picked C by @pierre-derval · 29 Sep 2026'],
      ['done', 'Approved by @carla · 29 Sep 2026, 11:00 UTC'],
      ['done', 'Merged by @pierre-derval · 29 Sep 2026, 12:00 UTC'],
      ['not-yet', 'Released not yet'],
    ]);
    expect(html).toContain('<a href="https://github.com/vertuoza/vertuo-omni-loop/issues/548" target="_blank" rel="noopener noreferrer">Asked</a>');
  });

  it('shows the state pill and the issue and PR in the header', () => {
    const html = withFix('visual', fixPageView('visual', summary, 'none'), { tab: 'before-after' });
    expect(html).toContain('<dt>State</dt><dd><span class="fix-state fix-state-merged">Merged</span></dd>');
    expect(html).toContain('<a href="https://github.com/vertuoza/vertuo-omni-loop/pull/562" target="_blank" rel="noopener noreferrer">PR #562</a>');
    expect(html).toContain('>Issue #548</a>');
  });

  it('reads — and every moment unknown when GitHub did not answer', () => {
    const html = withFix('bug', fixPageView('bug', null, 'no-page'));
    expect(html).toContain('<span class="fix-state fix-state-unknown">—</span>');
    expect(html).not.toContain('Picked');
    expect([...html.matchAll(/fix-moment-unknown/g)]).toHaveLength(4);
  });

  it('says so when the route read nothing of GitHub', () => {
    expect(withFix('bug', undefined)).toContain('GitHub could not be read for this fix.');
  });
});
