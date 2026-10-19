import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Board, Job } from '../runners.contract';
import { demoRunnersPage } from './demo';
import { releaseNotes, type RunnersPageView } from './model';
import { RunnersPage } from './RunnersPage';

// A job's released claims on the Runners page (PRD 2175 s2), as the `runners` draft screen draws them:
// under the status of a job whose runner released its claims, `Released #<n>, …` in `--ask-red`, each
// number linking its sub-PR; a release that failed reads `Could not release this job's claims: <why>`;
// and nothing at all when its runner released nothing and nothing failed.

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => undefined }) }));

const NOW = new Date('2026-10-13T14:00:00Z');
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, '\'').replace(/\s+/g, ' ').trim();

function demo(): Extract<RunnersPageView, { kind: 'board' }> {
  const view = demoRunnersPage(NOW);
  if (view.kind !== 'board') throw new Error('the demo is a board');
  return view;
}

/** The page with the demo's `/omni:yolo 1702` job changed by `change`, and the markup of that job's row. */
function rowOf(change: Partial<Job>): string {
  const view = demo();
  const board: Board = { ...view.board, jobs: view.board.jobs.map((job) => (job.line === '/omni:yolo 1702' ? { ...job, ...change } : job)) };
  const html = renderToStaticMarkup(createElement(RunnersPage, { view: { ...view, board }, supabase: null, signinError: null }));
  const start = html.indexOf('>/omni:yolo 1702<');
  const next = html.indexOf('runners-job"', start + 1);
  return html.slice(start, next < 0 ? undefined : next);
}

describe('releaseNotes', () => {
  const job = { repo: 'acme/widgets', released: null, releaseError: null };

  it('lists the sub-PRs released, each with its link in the job\'s repository', () => {
    expect(releaseNotes({ ...job, released: [1908, 1909] })).toEqual([{
      kind: 'released',
      prs: [{ number: 1908, url: 'https://github.com/acme/widgets/pull/1908' }, { number: 1909, url: 'https://github.com/acme/widgets/pull/1909' }],
    }]);
  });

  it('says why a release failed', () => {
    expect(releaseNotes({ ...job, releaseError: 'HTTP 401: Bad credentials' })).toEqual([{ kind: 'failed', text: 'Could not release this job\'s claims: HTTP 401: Bad credentials' }]);
  });

  it('says both when some claims were released and others failed, the released first', () => {
    expect(releaseNotes({ ...job, released: [7], releaseError: '#8: HTTP 502' }).map((note) => note.kind)).toEqual(['released', 'failed']);
  });

  it('says nothing when nothing was released and nothing failed, or the runner reported neither', () => {
    expect(releaseNotes(job)).toEqual([]);
    expect(releaseNotes({ ...job, released: [], releaseError: null })).toEqual([]);
    expect(releaseNotes({ ...job, releaseError: '' })).toEqual([]);
    expect(releaseNotes({ repo: 'acme/widgets' })).toEqual([]);
  });
});

describe('the Runners page', () => {
  it('shows Released #1908, #1909 under the job\'s status in --ask-red, each number linking its sub-PR', () => {
    const row = rowOf({ released: [1908, 1909], releaseError: null });
    expect(text(row)).toContain('Runner lost Released #1908 , #1909');
    expect(row).toContain('<span class="runners-why">Released');
    expect(row).toContain('<a href="https://github.com/acme/widgets/pull/1908" data-content="true">#1908</a>');
    expect(row).toContain('<a href="https://github.com/acme/widgets/pull/1909" data-content="true">#1909</a>');
    expect(row).not.toContain('Could not release');
  });

  it('shows why a release failed, in --ask-red', () => {
    const row = rowOf({ released: [], releaseError: 'HTTP 401: Bad credentials' });
    expect(row).toContain('<span class="runners-why" data-content="true">Could not release this job&#x27;s claims: HTTP 401: Bad credentials</span>');
    expect(text(row)).not.toContain('Released');
  });

  it('shows neither line when its runner released nothing and nothing failed', () => {
    for (const change of [{ released: null, releaseError: null }, { released: [], releaseError: null }, { released: undefined, releaseError: undefined }]) {
      const row = rowOf(change);
      expect(row).not.toContain('runners-why');
      expect(text(row)).not.toMatch(/Released|Could not release/);
    }
  });

  it('draws the demo\'s lost job with the claims its runner released, as the screen does', () => {
    expect(text(rowOf({}))).toContain('Released #1908 , #1909');
  });
});
