import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import type { BreakRow, MainWatchRead, WatchRow } from '../../main-watch/store';
import type { FindingView } from '../../rewind/rewind.contract';
import type { DossierRow } from '../store';
import { DEMO_VIEWER, demoDossier } from './demo';
import { DossierPage } from './DossierPage';
import { dossierView, readPick } from './view';
import { parsePrd } from 'omni-loop/kit/lib/ids.ts';

vi.mock('server-only', () => ({}));

vi.mock('next/navigation', async (original) => ({
  ...(await original<typeof import('next/navigation')>()),
  useRouter: () => ({ refresh: () => {} }),
}));

// The Main status and tab of /prd/<id> as the server renders them (PRD 2410, s3): no cell and no tab
// for a PRD nobody watches; the four states in the facts strip; the Main tab's breaks with their links,
// and, for a PRD that broke, that no rewind ran yet with the line to run it.

const ID = '00000000-0000-4000-8000-0000000000d2';
const PIERRE = { user_id: 'u-pierre', email: 'pierre@example.com', name: 'Pierre' };
const SUPABASE = { url: 'http://127.0.0.1:54321', key: 'anon' };
const NOW = Date.parse('2026-10-22T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const iso = (offset: number) => new Date(NOW + offset).toISOString();
const LANE = 'vertuoza/vertuo-omni-loop';

const numbered: DossierRow = {
  id: ID, workspace_id: 'w1', home_repo: LANE, prd: parsePrd(2410), title: 'Broke main',
  opened_by: PIERRE.user_id, created_at: '2026-09-27T09:12:00Z', numbered_at: '2026-09-27T10:00:00Z',
};
const watch = (more: Partial<WatchRow> = {}): WatchRow => ({
  lane: LANE, merge_sha: 'a'.repeat(40), merged_at: iso(-2 * DAY), watch_until: iso(5 * DAY), status: 'watching', unread: [], ...more,
});
const red: BreakRow = {
  lane: LANE, kind: 'ci-red', source: 'run-1', url: 'https://github.com/vertuoza/vertuo-omni-loop/actions/runs/1', title: 'lint <b>job</b>', parent: 'green', at: iso(-DAY),
};

const html = (mainWatch: MainWatchRead | null | undefined, query: Record<string, string> = {}) => renderToStaticMarkup(createElement(DossierPage, {
  view: dossierView({ dossier: numbered, versions: [], members: [PIERRE], rounds: [], mainWatch }, PIERRE.user_id, readPick(query), NOW),
  markdown: null, supabase: SUPABASE,
}));
const head = (page: string) => page.slice(0, page.indexOf('class="dossier-tabs"'));

describe('a PRD nobody watches', () => {
  it('shows no Main cell and no Main tab', () => {
    for (const read of [undefined, null, { watches: [], breaks: [] }]) {
      const page = html(read);
      expect(page).not.toContain('>Main<');
      expect(page).not.toContain('Watching');
    }
  });

  it('opens the page on its default tab when the address asks for Main', () => {
    expect(html(null, { tab: 'main' })).toContain('aria-label="Before/after"');
  });
});

describe('the Main cell of the facts strip', () => {
  it('says Watching · n days left', () => {
    const page = html({ watches: [watch()], breaks: [] });
    expect(head(page)).toContain('<dt>Main</dt>');
    expect(head(page)).toContain('Watching · 5 days left');
    expect(head(page)).toContain('href="/prd/' + ID + '?tab=main"');
  });

  it('says Clean', () => {
    expect(head(html({ watches: [watch({ status: 'clean' })], breaks: [] }))).toContain('<strong>Clean</strong>');
  });

  it('says Broke main', () => {
    const page = html({ watches: [watch({ status: 'broke' })], breaks: [red] });
    expect(head(page)).toContain('dossier-main-broke');
    expect(head(page)).toContain('<strong>Broke main</strong>');
  });

  it('says Could not check, never Clean', () => {
    const page = html({ watches: [watch({ unread: ['issues'] })], breaks: [] });
    expect(head(page)).toContain('<strong>Could not check</strong>');
    expect(head(page)).not.toContain('Clean');
  });
});

describe('the Main tab', () => {
  const broken = { watches: [watch({ status: 'broke' })], breaks: [red] };

  it('is in the bar once the PRD is watched', () => {
    expect(html({ watches: [watch()], breaks: [] })).toContain('>Main</a>');
  });

  it('lists each break with its kind and its link, escaped, the parent result beside a CI red', () => {
    const page = html(broken, { tab: 'main' });
    expect(page).toContain('aria-label="What broke main"');
    expect(page).toContain('CI red');
    expect(page).toContain(`href="${red.url}"`);
    expect(page).toContain('lint &lt;b&gt;job&lt;/b&gt;');
    expect(page).not.toContain('<b>job</b>');
    expect(page).toContain('the parent commit was green');
  });

  it('says that no rewind ran yet, with the line to run it', () => {
    const page = html(broken, { tab: 'main' });
    expect(page).toContain('No rewind yet.');
    expect(page).toContain('<code>/omni:rewind 2410</code>');
  });

  it('says nothing broke for a PRD still watched, and offers no rewind', () => {
    const page = html({ watches: [watch()], breaks: [] }, { tab: 'main' });
    expect(page).toContain('Nothing broke main so far.');
    expect(page).not.toContain('No rewind yet');
  });

  it('names the signals it could not read', () => {
    expect(html({ watches: [watch({ unread: ['issues of the week'] })], breaks: [] }, { tab: 'main' })).toContain('Could not read: issues of the week');
  });
});

describe('the rewind\'s findings on the Main tab (PRD 2410, s5)', () => {
  const broken = { watches: [watch({ status: 'broke' })], breaks: [red] };
  const found = (more: Partial<FindingView> = {}): FindingView => ({
    id: 'f1', check: 'ci', origin: 'omni-setup', happened: 'The lint was <b>red</b> on the slice.', evidence: ['https://github.com/vertuoza/vertuo-omni-loop/actions/runs/2'],
    fix: 'Require the lint job.', state: 'proposed', reason: null, decidedBy: null, decidedAt: null, ...more,
  });
  const withFindings = (findings: FindingView[]) => renderToStaticMarkup(createElement(DossierPage, {
    view: dossierView({ dossier: numbered, versions: [], members: [PIERRE], rounds: [], mainWatch: broken, rewindFindings: findings }, PIERRE.user_id, readPick({ tab: 'main' }), NOW),
    markdown: null, supabase: SUPABASE,
  }));

  it('lists each with its check, where it started, what happened, its evidence and its fix, under the breaks', () => {
    const page = withFindings([found()]);
    expect(page).toContain('aria-label="What the rewind found"');
    expect(page).toContain('>CI<');
    expect(page).toContain('Started in: The Omni setup');
    expect(page).toContain('Proposed');
    expect(page).toContain('href="https://github.com/vertuoza/vertuo-omni-loop/actions/runs/2"');
    expect(page).toContain('<strong>Fix:</strong> Require the lint job.');
    expect(page).not.toContain('No rewind yet');
    expect(page.indexOf('What broke main')).toBeLessThan(page.indexOf('What the rewind found'));
  });

  it('escapes what the rewind wrote', () => {
    const page = withFindings([found()]);
    expect(page).toContain('&lt;b&gt;red&lt;/b&gt;');
    expect(page).not.toContain('<b>red</b>');
  });

  it('shows a rejected finding with its reason, and never links evidence that is not https', () => {
    const page = withFindings([found({ state: 'rejected', reason: 'Not our lint', evidence: ['https://a.test/x', 'javascript:alert(1)'] })]);
    expect(page).toContain('Rejected: Not our lint');
    expect(page).toContain('href="https://a.test/x"');
    expect(page).not.toContain('javascript:');
  });

  it('keeps saying no rewind ran yet when there is no finding', () => {
    expect(withFindings([])).toContain('No rewind yet.');
  });

  // PRD 2410, s7: a member approves or rejects each proposed finding, once.
  const buttons = (page: string) => [...page.matchAll(/<button[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]).filter((b) => b === 'Approve' || b === 'Reject');

  it('offers Approve and Reject on a proposed finding, the reason optional', () => {
    const page = withFindings([found()]);
    expect(buttons(page)).toEqual(['Approve', 'Reject']);
    expect(page).toContain('placeholder="Why reject it (optional)"');
  });

  it('shows who decided a finding and when, and no button', () => {
    const page = withFindings([
      found({ id: 'f1', state: 'approved', decidedBy: 'ada-gh', decidedAt: '2026-10-21T09:30:00Z' }),
      found({ id: 'f2', state: 'rejected', reason: 'Not our lint', decidedBy: 'bob-gh', decidedAt: '2026-10-22T10:00:00Z' }),
    ]);
    expect(buttons(page)).toEqual([]);
    expect(page).toContain('Approved by @ada-gh · 2026-10-21');
    expect(page).toContain('Rejected by @bob-gh · 2026-10-22: Not our lint');
  });

  it('says a decision whose member it cannot name, without inventing one', () => {
    const page = withFindings([found({ state: 'approved', decidedBy: null, decidedAt: '2026-10-21T09:30:00Z' })]);
    expect(page).toContain('Approved · 2026-10-21');
    expect(page).not.toContain('by @');
  });

  it('offers the buttons on the proposed findings only', () => {
    const page = withFindings([found({ id: 'f1' }), found({ id: 'f2', state: 'approved', decidedBy: 'ada-gh', decidedAt: '2026-10-21T09:30:00Z' })]);
    expect(buttons(page)).toEqual(['Approve', 'Reject']);
  });
});

describe('the demo dossier', () => {
  it('shows a PRD that broke main, with its red job', () => {
    const read = demoDossier(NOW);
    const page = renderToStaticMarkup(createElement(DossierPage, { view: dossierView(read, DEMO_VIEWER, readPick({ tab: 'main' }), NOW), markdown: null, supabase: null }));
    expect(page).toContain('<strong>Broke main</strong>');
    expect(page).toContain('CI red');
    expect(page).toContain('/omni:rewind 71');
  });
});
