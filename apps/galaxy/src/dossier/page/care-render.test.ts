import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { CareState } from '../github/care';
import { UNREAD, type GithubSummary } from '../github/summary';
import type { DossierRow } from '../store';
import { DossierPage } from './DossierPage';
import { dossierView, readPick } from './view';
import { parsePr, parsePrd } from 'vertuo-omni-plan/kit/lib/ids.ts';

vi.mock('server-only', () => ({}));

// The PR care tab of /prd/<id> as the server renders it (PRD 790, s4): the CI, Conflicts and Review
// rows, the threads asked first, the watcher line in both states, and what it says merged, or
// with GitHub unread. The chip's three looks are in render.test.ts, beside the stage header's.

const ID = '00000000-0000-4000-8000-0000000000d1';
const PIERRE = { user_id: 'u-pierre', email: 'pierre@vertuoza.com', name: 'Pierre' };
const dossier: DossierRow = {
  id: ID, workspace_id: 'w1', home_repo: 'vertuoza/vertuo-omni-loop', prd: parsePrd(216), title: 'PRD dossiers',
  opened_by: PIERRE.user_id, created_at: '2026-09-27T09:12:00Z', numbered_at: '2026-09-27T10:00:00Z',
};
const NOW = Date.parse('2026-09-30T12:00:00Z');
const FEATURE = { number: parsePr(221), url: 'https://github.com/vertuoza/vertuo-omni-loop/pull/221', state: 'open' as const, draft: false };
const RUN = 'https://github.com/vertuoza/vertuo-omni-loop/actions/runs/9';
const thread = (verdict: CareState['threads'][number]['verdict'], n: number, reason: string | null = null) => ({
  url: `https://github.com/vertuoza/vertuo-omni-loop/pull/221#discussion_r${n}`, login: `rev${n}`, avatar: null,
  firstLine: `Comment <${n}>`, verdict, reason, resolved: verdict === 'fixed' || verdict === 'pushed-back',
});
const CARE: CareState = {
  ci: 'red', failedUrl: RUN, conflict: true, base: 'main',
  threads: [
    thread('asked', 1, 'This needs a product decision: the PM will decide.'),
    thread('open', 2),
    thread('fixed', 3, 'Fixed in a1b2c3d: the duplicate is gone.'),
    thread('pushed-back', 4, 'Low value for this PR: naming preference, no linter rule.'),
  ],
  watchingSince: '2026-09-30T10:00:00Z', lastRound: '2026-09-30T11:57:00Z',
};
const summary = (more: Partial<GithubSummary> = {}): GithubSummary => ({
  repo: 'vertuoza/vertuo-omni-loop', prd: parsePrd(216), folder: '0216-prd-dossiers', topic: 'prd-dossiers', issue: null, retro: null,
  phase0: null, feature: FEATURE, mergedSlices: 1, outbox: null, outboxComment: null, care: CARE, ...more,
});
const page = (github: GithubSummary | null, tab: 'care' | null = 'care') => {
  const view = dossierView({ dossier, versions: [], members: [PIERRE], rounds: [], github }, PIERRE.user_id, readPick(tab ? { tab } : {}), NOW);
  return renderToStaticMarkup(createElement(DossierPage, { view, markdown: null, supabase: null }));
};

describe('the PR care tab (PRD 790, s4)', () => {
  it('sits after Outbox, and is left out once GitHub says there is no feature PR', () => {
    const html = page(summary());
    expect(html).toContain(`<a class="dossier-tab" href="/prd/${ID}?tab=care" aria-current="page">PR care<small>2 open</small></a>`);
    expect(html.indexOf('>Outbox')).toBeLessThan(html.indexOf('>PR care<'));
    expect(html.indexOf('>PR care<')).toBeLessThan(html.indexOf('>Retro'));
    expect(html).toContain('<section class="dossier-pane" aria-label="PR care">');
    expect(page(summary({ feature: null }), null)).not.toContain('PR care');
  });

  it('shows the CI row linking the failed run, the conflict with its base, and the counts', () => {
    const html = page(summary());
    expect(html).toContain(`<div class="care-row care-ci-red"><dt>CI</dt><dd><a href="${RUN}" target="_blank" rel="noopener noreferrer">red</a></dd></div>`);
    expect(html).toContain('<div class="care-row care-conflict-conflict"><dt>Conflicts</dt><dd>conflicting with main</dd></div>');
    expect(html).toContain('<dt>Review</dt><dd>1 open · 1 fixed · 1 pushed back · 1 asked</dd>');
    const green = page(summary({ care: { ...CARE, ci: 'green', failedUrl: null, conflict: false } }));
    expect(green).toContain('<div class="care-row care-ci-green"><dt>CI</dt><dd>green</dd></div>');
    expect(green).toContain('<dt>Conflicts</dt><dd>none</dd>');
  });

  it('lists each thread, asked first: the reviewer, the first line, the verdict with its reason, and its link', () => {
    const html = page(summary());
    const order = [1, 2, 3, 4].map((n) => html.indexOf(`discussion_r${n}"`));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).toMatch(/<li class="care-thread care-verdict-asked"><span class="person-chip is-inline"><img class="person-face is-photo" src="https:\/\/github.com\/rev1.png\?size=48"[^>]*\/>rev1<\/span>/);
    expect(html).toContain('<span class="care-first">Comment &lt;1&gt;</span>');
    expect(html).toContain('<span class="care-verdict"><strong>asked: the PM decides</strong><span class="ask-hint"> · This needs a product decision: the PM will decide.</span></span>');
    expect(html).toContain('<span class="care-verdict"><strong>not handled yet</strong></span>');
    expect(html).toContain('<strong>pushed back</strong><span class="ask-hint"> · Low value for this PR: naming preference, no linter rule.</span>');
    expect(html).toContain('<a href="https://github.com/vertuoza/vertuo-omni-loop/pull/221#discussion_r1" target="_blank" rel="noopener noreferrer">on GitHub ↗</a>');
    expect(page(summary({ care: { ...CARE, threads: [] } }))).not.toContain('care-threads');
  });

  it('says Claude is watching under 15 minutes, else nobody, with /omni:pr-care <n> to copy', () => {
    const watching = page(summary());
    expect(watching).toContain('<p class="care-watcher care-watching"><span>Claude is watching · last round 3 min ago</span></p>');
    expect(watching).not.toContain('/omni:pr-care');
    for (const lastRound of ['2026-09-30T11:45:00Z', null]) {
      const nobody = page(summary({ care: { ...CARE, lastRound } }));
      expect(nobody).toContain('<p class="care-watcher"><span>Nobody is watching</span> <span class="stage-copy">');
      expect(nobody).toContain('title="/omni:pr-care 216">Copy</button><code class="stage-command">/omni:pr-care 216</code>');
    }
  });

  it('says there is nothing to look after once merged, and when GitHub did not answer', () => {
    const merged = page(summary({ feature: { ...FEATURE, state: 'merged' }, care: null }));
    expect(merged).toContain(`<a class="dossier-tab dossier-tab-empty" href="/prd/${ID}?tab=care" aria-current="page">PR care</a>`);
    expect(merged).toContain('<p class="dossier-empty">The feature PR is merged: nothing is left to look after.</p>');
    expect(merged).toContain(`<a class="ask-button" href="${FEATURE.url}" target="_blank" rel="noopener noreferrer">Open the feature PR</a>`);
    expect(merged).not.toContain('care-rows');
    const unread = page(summary({ care: UNREAD }));
    expect(unread).toContain('<p class="ask-problem" role="alert">GitHub did not answer. The page tries again within a minute.</p>');
    expect(unread).not.toContain('care-rows');
  });
});
